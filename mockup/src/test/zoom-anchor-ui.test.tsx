// Seam under test: the `+ / − / ●` zoom controls against the paper-view's
// rendered transform — the screen, not the maths (zoom-anchor.test.ts owns the
// pure rule).
//
// What the user feels: a drawing that sits off-centre must stay under the eye
// when the zoom steps. Before this rule the translation was scaled with the
// scale, so the paper's own CORNER was pinned and every tap walked the drawing
// away. The pinch gesture is not in this seam: it anchors under the fingers and
// keeps its own contract (viewport.test.ts).
//
// jsdom has no layout, so the pointer fixture maps a touch 1:1 onto the 300dp
// artwork through the stubbed rect. The committed point is read back from the
// document (the command list), never assumed from the touch coordinates.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openTools } from "./open-panel";
import { blankArtwork } from "@/mockup/artworks";
import type { Point } from "@/mockup/history";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

/**
 * The studio plus the two readings this seam needs: the artwork's own size and
 * the last point committed to it. `blank` opens an empty sheet (no command at
 * all), which is the empty-canvas case.
 */
function Desk({ profileId = "maria", blank = false }: { profileId?: string; blank?: boolean }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    if (blank) dispatch({ type: "createArtwork", artwork: blankArtwork(profileId, "zoom-blank") });
  }, [dispatch, profileId, blank]);

  const art = blank
    ? state.artworks.find((a) => a.id === "zoom-blank")
    : state.artworks.find((a) => a.profileId === profileId && a.pageId === "peixe");
  if (!art) return null;

  const painted = [...art.history.commands].reverse().find((c) => c.t === "stroke");
  const lastPoint = painted?.t === "stroke" ? (painted.points.at(-1) ?? null) : null;

  return (
    <>
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
      <output data-testid="art-size">{`${art.w} ${art.h}`}</output>
      <output data-testid="last-point">{JSON.stringify(lastPoint)}</output>
    </>
  );
}

const mount = (props: { profileId?: string; blank?: boolean } = {}) =>
  render(
    <StoreProvider>
      <Desk {...props} />
    </StoreProvider>,
  );

const sheetEl = () => screen.getByTestId("paper-view");

/** The desk and the page exactly as the screen lays them out. */
function frame() {
  const sheet = sheetEl();
  const page = screen.getByTestId("page-area");
  const px = (el: HTMLElement, side: "width" | "height" | "left" | "top") =>
    Number.parseFloat(el.style[side]);
  return {
    sheetW: px(sheet, "width"),
    sheetH: px(sheet, "height"),
    pageLeft: px(page, "left"),
    pageTop: px(page, "top"),
    pageW: px(page, "width"),
    pageH: px(page, "height"),
  };
}

const artSize = (): [number, number] => {
  const [w = 0, h = 0] = (screen.getByTestId("art-size").textContent ?? "").split(" ").map(Number);
  return [w, h];
};

/** The viewport the paper-view is actually rendering. */
function view() {
  const transform = sheetEl().style.transform;
  const match = /translate\((-?[\d.e+]+)px, (-?[\d.e+]+)px\) scale\((-?[\d.e+]+)\)/.exec(transform);
  expect(match, `unreadable transform: ${transform}`).not.toBeNull();
  return { x: Number(match![1]), y: Number(match![2]), scale: Number(match![3]) };
}

/** Where a paper-view point lands on screen, as the transform defines it. */
const onScreen = (
  v: { x: number; y: number; scale: number },
  p: Point | { x: number; y: number },
) => ({
  x: v.x + (Array.isArray(p) ? p[0] : p.x) * v.scale,
  y: v.y + (Array.isArray(p) ? p[1] : p.y) * v.scale,
});

/** Artwork point -> paper-view px, through the page the screen is showing. */
function paperPoint(p: Point) {
  const f = frame();
  const [artW, artH] = artSize();
  return { x: f.pageLeft + (p[0] / artW) * f.pageW, y: f.pageTop + (p[1] / artH) * f.pageH };
}

/**
 * The zoom readout is TRANSIENT (owner's decision, 27/10, `chrome-v2` §4): it is
 * not in the drawer any more. On 9+ the pinch is what brings it up; on 3–5 the
 * corner is a touch target. A two-finger press that never moves does not change
 * the view (the gesture only steps on `pointermove`), so this opens the readout
 * without touching the zoom it is about to measure.
 */
function pointer(type: string, el: Element, pointerId: number, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  Object.defineProperty(event, "pointerType", { value: "touch" });
  fireEvent(el, event);
}

const openZoom = () => {
  const corner = screen.queryByTestId("zoom-tap");
  if (corner) {
    fireEvent.click(corner);
    return;
  }
  const paper = sheetEl();
  pointer("pointerdown", paper, 11, 100, 200);
  pointer("pointerdown", paper, 12, 200, 200);
  pointer("pointerup", paper, 12, 200, 200);
  pointer("pointerup", paper, 11, 100, 200);
};
const zoomIn = () => fireEvent.click(screen.getByLabelText("Aumentar zoom"));
const zoomOut = () => fireEvent.click(screen.getByLabelText("Diminuir zoom"));

/** One tap with a shelf brush commits a single-point stroke where it landed. */
function paintAt(clientX: number, clientY: number) {
  openTools();
  fireEvent.click(screen.getByLabelText("Pincel"));
  const paper = sheetEl().querySelector("svg")!;
  fireEvent.pointerDown(paper, { pointerId: 1, clientX, clientY });
  fireEvent.pointerUp(paper, { pointerId: 1, clientX, clientY });
}

const lastPoint = (): Point => {
  const point = JSON.parse(screen.getByTestId("last-point").textContent ?? "null") as Point | null;
  expect(point, "the stroke was not committed").not.toBeNull();
  return point!;
};

describe("button zoom anchors on the last painted point", () => {
  it("steps to 1.15 and keeps that point on the same pixel", () => {
    mount();
    paintAt(220, 280);

    const anchor = paperPoint(lastPoint());
    const f = frame();
    // The point must be off the sheet centre, or a corner anchor would look
    // correct and this case would prove nothing.
    expect(Math.abs(anchor.x - f.sheetW / 2)).toBeGreaterThan(20);
    expect(Math.abs(anchor.y - f.sheetH / 2)).toBeGreaterThan(20);

    const before = onScreen(view(), anchor);
    openZoom();
    zoomIn();

    expect(sheetEl()).toHaveAttribute("data-zoom", "1.15");
    const after = onScreen(view(), anchor);
    expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.y - before.y)).toBeLessThanOrEqual(1);
  });

  it("comes back with − and lands on the fit corner with the second step", () => {
    mount();
    paintAt(220, 280);
    openZoom();

    zoomIn();
    expect(sheetEl()).toHaveAttribute("data-zoom", "1.15");

    zoomOut();
    expect(sheetEl()).toHaveAttribute("data-zoom", "1.00");

    zoomIn();
    expect(sheetEl()).toHaveAttribute("data-zoom", "1.15");

    zoomOut();
    // Fit again: the paper is back where it started, corner included.
    expect(sheetEl()).toHaveAttribute("data-zoom", "1.00");
    expect(view()).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("anchors an empty canvas on the sheet's own centre", () => {
    mount({ blank: true });
    const f = frame();
    openZoom();
    zoomIn();

    const v = view();
    const centre = { x: f.sheetW / 2, y: f.sheetH / 2 };
    const moved = onScreen(v, centre);
    expect(Math.abs(moved.x - centre.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(moved.y - centre.y)).toBeLessThanOrEqual(1);
    // The spec's own form: x' = centre * (1 - scale').
    expect(Math.abs(v.x - centre.x * (1 - v.scale))).toBeLessThanOrEqual(1);
    expect(Math.abs(v.y - centre.y * (1 - v.scale))).toBeLessThanOrEqual(1);
  });

  it("keeps the two targets at the project's floor, in both bands", () => {
    mount();
    openZoom();

    const readout = screen.getByTestId("zoom-hud");
    for (const label of ["Diminuir zoom", "Aumentar zoom"]) {
      // 44dp — `CHROME_TARGET`, the floor the old 40dp target violated (27/10).
      expect(within(readout).getByLabelText(label)).toHaveClass("h-11", "w-11");
    }
    // The number is the whole point of the readout: it is DATA over the paper.
    expect(within(readout).getByTestId("zoom-value").textContent).toMatch(/^\d+%$/);

    cleanup();
    // A second provider in the same test would load the first one's autosave
    // and drop the fresh sheet this mount is about.
    localStorage.clear();
    mount({ profileId: "theo", blank: true });
    openZoom();
    const kidsZoom = screen.getByTestId("zoom-hud");
    for (const label of ["Diminuir zoom", "Aumentar zoom"]) {
      expect(within(kidsZoom).getByLabelText(label)).toHaveClass("h-14", "w-14");
    }
  });
});
