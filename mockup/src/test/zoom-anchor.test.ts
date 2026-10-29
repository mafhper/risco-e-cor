// Seam under test: where the BUTTON zoom (+ / −) puts its fixed point — pure
// maths, no DOM.
//
// The controls used to scale the translation with the scale, which anchors the
// paper-view's own corner: a drawing sitting off-centre slid away from the eye
// on every tap. The rule now is geometric, and it is checked with worked
// examples instead of by re-deriving the formula:
//
//  1. the paper point chosen as the anchor lands on the same pixel after the
//     step, zooming in and zooming out;
//  2. the anchor is the last place the author painted; an erase is a wipe, not
//     a move, so it never invents one;
//  3. with nothing painted, the sheet's own centre is the answer.
//
// The pinch gesture is NOT this seam: it anchors under the fingers and is
// covered by viewport.test.ts.
import { describe, expect, it } from "vitest";
import type { Command } from "@/mockup/history";
import {
  FIT,
  MAX_SCALE,
  MIN_SCALE,
  resolveZoomAnchor,
  zoomAnchored,
  type Pt,
  type Viewport,
  type ZoomGeometry,
} from "@/mockup/viewport";

/** The desk (paper-view) the transform lives in. */
const SHEET = { w: 800, h: 600 };

/**
 * A page inside that desk: 400×300 artwork px on a 400×300 page, pushed to
 * pageLeft 200 / pageTop 60 so the page centre is NOT the sheet centre.
 */
const GEOMETRY: ZoomGeometry = {
  artW: 800,
  artH: 600,
  pageLeft: 200,
  pageTop: 60,
  pageW: 400,
  pageH: 300,
  sheetW: SHEET.w,
  sheetH: SHEET.h,
};

/** Where a paper point lands on screen, as the CSS transform defines it. */
const onScreen = (v: Viewport, p: Pt) => ({ x: v.x + p.x * v.scale, y: v.y + p.y * v.scale });

/** The contract: the anchored point did not move on screen. */
function expectPinned(before: Viewport, after: Viewport, p: Pt) {
  const a = onScreen(before, p);
  const b = onScreen(after, p);
  expect(b.x).toBeCloseTo(a.x, 6);
  expect(b.y).toBeCloseTo(a.y, 6);
}

const stroke = (id: string, points: [number, number][]): Command => ({
  t: "stroke",
  id,
  color: "#111111",
  size: 8,
  points,
});

describe("zoomAnchored", () => {
  it("keeps the anchor on the same pixel for +15% and for −15%", () => {
    const centre: Pt = { x: 400, y: 300 };

    // Worked example: 15% of 400 pushes the sheet 60px left, 15% of 300 45px up.
    const zoomed = zoomAnchored(FIT, 1.15, centre, SHEET);
    expect(zoomed.scale).toBe(1.15);
    expect(zoomed.x).toBeCloseTo(-60, 6);
    expect(zoomed.y).toBeCloseTo(-45, 6);
    expectPinned(FIT, zoomed, centre);

    // The far corner: 15% of the whole sheet, i.e. the clamp's own limit.
    const corner: Pt = { x: 800, y: 600 };
    const toCorner = zoomAnchored(FIT, 1.15, corner, SHEET);
    expect(toCorner.scale).toBe(1.15);
    expect(toCorner.x).toBeCloseTo(-120, 6);
    expect(toCorner.y).toBeCloseTo(-90, 6);
    expectPinned(FIT, toCorner, corner);

    // And the way back lands on the fit again, with the anchor still pinned.
    const back = zoomAnchored(zoomed, 1 / 1.15, centre, SHEET);
    expect(back).toEqual(FIT);
    expectPinned(zoomed, back, centre);
  });

  it("stops at the ceiling instead of following the factor past it", () => {
    const perched: Viewport = { scale: MAX_SCALE, x: -200, y: -150 };
    const out = zoomAnchored(perched, 1.15, { x: 400, y: 300 }, SHEET);

    expect(out.scale).toBe(MAX_SCALE);
    // At the ceiling the anchor term is zero: the view does not jump.
    expect(out).toEqual(perched);
    expect(out.x).toBeGreaterThanOrEqual(SHEET.w * (1 - MAX_SCALE));
    expect(out.x).toBeLessThanOrEqual(0);
    expect(out.y).toBeGreaterThanOrEqual(SHEET.h * (1 - MAX_SCALE));
    expect(out.y).toBeLessThanOrEqual(0);
  });

  it("stops at the floor and comes back to the fit", () => {
    const out = zoomAnchored(FIT, 1 / 1.15, { x: 400, y: 300 }, SHEET);
    expect(out.scale).toBe(MIN_SCALE);
    expect(out).toEqual({ scale: 1, x: 0, y: 0 });
  });
});

describe("resolveZoomAnchor", () => {
  it("takes the last painted point of the last stroke", () => {
    const commands: Command[] = [
      stroke("s1", [
        [100, 100],
        [200, 150],
        [300, 200],
      ]),
    ];

    // 300 of 800 artwork px is 150 of the 400px page (+200); 200 of 600 is 100
    // of the 300px page (+60).
    expect(resolveZoomAnchor(commands, GEOMETRY)).toEqual({ x: 350, y: 160 });
  });

  it("anchors a desk fill on the sheet and a page fill on the page", () => {
    const offCentre: ZoomGeometry = { ...GEOMETRY, pageLeft: 120, pageTop: 40 };

    const desk: Command[] = [{ t: "fill", region: "desk", color: "#ffffff" }];
    expect(resolveZoomAnchor(desk, offCentre)).toEqual({ x: 400, y: 300 });

    const page: Command[] = [{ t: "fill", region: "fundo", color: "#ffffff" }];
    expect(resolveZoomAnchor(page, offCentre)).toEqual({ x: 320, y: 190 });
  });

  it("ignores an erase on top and falls back to the bbox when the point is lost", () => {
    const painted = stroke("s1", [
      [100, 100],
      [200, 200],
    ]);
    const erased: Command = { t: "erase", strokeIds: ["s1"] };
    // The wipe is not a move: the stroke before it still says where the hand was.
    expect(resolveZoomAnchor([painted, erased], GEOMETRY)).toEqual({ x: 300, y: 160 });

    // A broken last point has no pixel to offer: the centre of what survives is
    // the honest answer (bbox 100..200 → 150,150 artwork px → 275,135 here).
    const broken = stroke("s2", [[Number.NaN, Number.NaN]]);
    expect(resolveZoomAnchor([painted, broken], GEOMETRY)).toEqual({ x: 275, y: 135 });
  });

  it("centres an empty canvas on the sheet", () => {
    expect(resolveZoomAnchor([], GEOMETRY)).toEqual({ x: 400, y: 300 });
  });
});
