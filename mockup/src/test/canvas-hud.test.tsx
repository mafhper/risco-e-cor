// THE CHROME OF THE CANVAS — the two bands, the undo pair's new homes and the
// zoom readout.
//
// The design is `chrome-v2` §12 (owner's composition, 2026-10-27, third round):
// the side rail and the hamburger were REVOKED, the workspace selector moved to a
// band OUTSIDE the stage, and the undo pair went into the sheet (9+) and into the
// compact preview row (3-5). Seams, one per section:
//
//   a) band      [ Início ] [ pílula ], two targets in that order, outside the paper
//   b) gone      no rail, no hamburger, no `trilho` — there is nothing to open
//   c) undo      inside the sheet on 9+, in the compact preview row on 3-5,
//                ALWAYS drawn and disabled when there is nothing to do
//   d) zoom      NOT in the panel: a transient readout during the pinch, 1.5s
//                after it lets go; 3–5 also opens it by touching the corner
//   e) still     the chrome never covers the paper while ink flows — it cannot:
//                both bands live outside the stage
//
// The seam is the shape the DOM declares, never the pixels: jsdom has no layout,
// so what is measured here is the model the browser applies.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { blankArtwork } from "@/mockup/artworks";
import { emptyHistory } from "@/mockup/history";
import { HUD_DOCK_GAP } from "@/mockup/hud";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { normalizeProfiles, StoreProvider, useStore } from "@/mockup/store";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

/**
 * One profile on one sheet, created on the spot: `pageId: null` is a blank sheet
 * (the band's stroke tools are live there), a `pageId` is a coloring page.
 */
function Boot({
  profileId,
  pageId,
  back = { name: "home" },
}: {
  profileId: string;
  pageId: string | null;
  back?: { name: "home" } | { name: "profile" };
}) {
  const { state, dispatch } = useStore();
  const id = `hud-${profileId}-${pageId ?? "blank"}`;
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    dispatch({
      type: "createArtwork",
      artwork: pageId
        ? {
            id,
            profileId,
            pageId,
            w: 300,
            h: 300,
            history: emptyHistory(),
            createdAt: 1,
            updatedAt: 1,
            visibility: "draft",
            publishedAt: null,
          }
        : blankArtwork(profileId, id),
    });
    dispatch({ type: "go", screen: { name: "canvas", artworkId: id, back } });
  }, [dispatch, profileId, pageId, id, back]);
  const art = state.artworks.find((a) => a.id === id);
  if (!art) return null;
  return <CanvasScreen artworkId={id} back={back} />;
}

const mount = (
  profileId = "maria",
  pageId: string | null = "peixe",
  back: { name: "home" } | { name: "profile" } = { name: "home" },
) =>
  render(
    <StoreProvider>
      <Boot profileId={profileId} pageId={pageId} back={back} />
    </StoreProvider>,
  );

/**
 * A pointer event with an IDENTITY. jsdom ships no `PointerEvent`, so the setup
 * falls back to `MouseEvent` — which carries the coordinates but not the finger.
 * The canvas tracks fingers by `pointerId`, so the test hands it one.
 */
function pointer(type: string, el: Element, pointerId: number, clientX: number, clientY: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY });
  Object.defineProperty(event, "pointerId", { value: pointerId });
  Object.defineProperty(event, "pointerType", { value: "touch" });
  fireEvent(el, event);
}

const stage = () => screen.getByTestId("canvas-stage");
const band = () => screen.getByTestId("canvas-band");
const openBar = () => fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
const openPanel = () => {
  openBar();
  fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
};
const paperView = () => screen.getByTestId("paper-view");

/** The visible sheet's px: width, and the transform the view declares. */
function sheetGeometry() {
  const view = paperView();
  const width = Number.parseFloat(view.style.width);
  const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\((-?[\d.]+)\)/.exec(
    view.style.transform,
  );
  if (!match) throw new Error(`transform não declarado: ${view.style.transform}`);
  const page = screen.getByTestId("page-area");
  return {
    sheetW: width,
    scale: Number(match[3]),
    x: Number(match[1]),
    y: Number(match[2]),
    pageLeft: Number.parseFloat(page.style.left),
    pageTop: Number.parseFloat(page.style.top),
    pageW: Number.parseFloat(page.style.width),
    pageH: Number.parseFloat(page.style.height),
  };
}

/** Where a page fraction lands on the stage, in px — the model the browser applies. */
function screenOf(g: ReturnType<typeof sheetGeometry>, u: number, v: number) {
  return {
    x: g.x + g.scale * (g.pageLeft + u * g.pageW),
    y: g.y + g.scale * (g.pageTop + v * g.pageH),
  };
}

/* ------------------------------------------------------------------ *
 * a) the bottom band: two targets, in order, outside the paper         *
 * ------------------------------------------------------------------ */

describe("the bottom band carries two targets and nothing else", () => {
  it("reads Início · pílula in that order, at the declared size", () => {
    mount();
    const children = [...band().children];
    expect(children).toHaveLength(2);
    expect(children[0]).toBe(screen.getByTestId("chrome-back"));
    expect(children[1]).toBe(screen.getByTestId("band-tools"));
    expect(band()).toHaveAttribute("data-order", "back,tools");
    expect(within(children[1] as HTMLElement).getByTestId("canvas-dock")).toBeInTheDocument();

    // 44dp on 9+ — the same floor as every door of the chrome.
    expect(screen.getByTestId("chrome-back")).toHaveClass("h-11", "w-11");
  });

  it("draws the way out as a HOUSE named Início, on both floors", () => {
    // Owner's feedback, 27/10: an arrow promised "one step back", and the
    // canvas sits directly under the home. The control is the same door, the
    // same seat and the same gesture — only the drawing and the name change.
    mount("maria", null);
    const adult = screen.getByTestId("chrome-back");
    expect(adult).toHaveAccessibleName("Início");
    expect(adult.querySelector("svg")!.getAttribute("data-glyph")).toBe("home");
    expect(adult.querySelector('[data-glyph="back"]')).toBeNull();
    expect(adult).toHaveClass("h-11", "w-11");
    expect(adult).toHaveAttribute("data-seat", "band-left");
    expect(screen.getByTestId("canvas-band")).toHaveAttribute("data-order", "back,tools");

    cleanup();
    localStorage.clear();

    mount("theo", "foguete");
    const kid = screen.getByTestId("chrome-back");
    expect(kid).toHaveAccessibleName("Início");
    expect(kid.querySelector("svg")!.getAttribute("data-glyph")).toBe("home");
    expect(kid).toHaveClass("h-13", "w-13");
    expect(kid).toHaveAttribute("data-seat", "band-left");
  });

  it("sits OUTSIDE the paper's area on both bands", () => {
    mount();
    // The band is a sibling of the stage: nothing of it is over the sheet.
    expect(stage().contains(band())).toBe(false);
    expect(screen.getByTestId("canvas")).toContainElement(band());
    cleanup();
    // The saving provider re-reads storage on mount: without this the second
    // provider would restore the FIRST test's state and drop the new sheet.
    localStorage.clear();

    mount("theo", "foguete");
    expect(stage().contains(band())).toBe(false);
    expect(screen.getByTestId("chrome-back")).toHaveClass("h-13", "w-13");
  });

  it("keeps the drawer above it, packed against the band", () => {
    mount();
    expect(screen.getByTestId("canvas-hud-band")).toHaveAttribute(
      "data-hud-gap",
      String(HUD_DOCK_GAP),
    );
    // The dock's zone starts at the STAGE's own top edge now: the old row that
    // bounded it left the stage (`chrome-v2` §12.3).
    expect(screen.getByTestId("canvas-hud-band")).toHaveAttribute("data-dock-top", "0");
    expect(stage()).toContainElement(screen.getByTestId("canvas-hud-band"));
    expect(stage().contains(band())).toBe(false);
  });

  it("keeps Início as the clear gesture: a 550ms hold, not a second door", () => {
    mount("maria", null);
    // Nothing to erase yet: the name is just the way out.
    expect(screen.getByTestId("chrome-back")).toHaveAccessibleName("Início");

    const paper = paperView();
    pointer("pointerdown", paper, 1, 150, 150);
    pointer("pointermove", paper, 1, 180, 170);
    pointer("pointerup", paper, 1, 180, 170);

    // With ink on the sheet the door says the hold out loud, and no second
    // control exists for it.
    expect(screen.getByTestId("chrome-back")).toHaveAccessibleName(/segure para apagar/i);
    expect(screen.queryByRole("button", { name: /^limpar|^apagar/i })).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * b) the rail and the hamburger are GONE                               *
 * ------------------------------------------------------------------ */

describe("the rail and the hamburger were revoked", () => {
  it("leaves no rail, no menu and no rail geometry in the DOM", () => {
    mount("maria", "peixe", { name: "profile" });
    for (const gone of ["chrome-rail", "chrome-menu", "rail-workspace", "desk-door", "dock-grid"]) {
      expect(screen.queryByTestId(gone)).toBeNull();
    }
    // No door answers to "Menu" any more: an unavailable control is not drawn.
    expect(screen.queryByLabelText("Menu")).toBeNull();
    expect(screen.queryByLabelText("Fechar menu")).toBeNull();
    // The stage declares no rail width and the paper area declares no split.
    expect(stage()).not.toHaveAttribute("data-rail");
    expect(screen.getByTestId("paper-area")).not.toHaveAttribute("data-rail-width");
    // The sheet is the whole stage: nothing takes width from it.
    expect(sheetGeometry().sheetW).toBe(300);
    expect(screen.getByTestId("paper-area")).toHaveAttribute("data-useful-width", "300");
  });

  it("writes no `trilho` to the profile: the field is gone from the store", () => {
    mount("maria", "peixe", { name: "profile" });
    // Walk the whole chrome: open the bar, open the sheet, close it again.
    openPanel();
    fireEvent.click(screen.getByLabelText("Feito"));
    const saved = JSON.parse(localStorage.getItem("colorir-mockup-v1") ?? "{}") as {
      profiles?: Record<string, unknown>[];
    };
    for (const profile of saved.profiles ?? []) expect(profile).not.toHaveProperty("trilho");
    // …and the OLD backup still opens: `trilho` is inert data now (nothing reads
    // it), which is why the field could leave the type without a migration.
    const reloaded = normalizeProfiles([
      { id: "maria", name: "Maria", age: "9+", trilho: true } as never,
    ]);
    expect(reloaded[0]?.id).toBe("maria");
  });
});

/* ------------------------------------------------------------------ *
 * c) undo lives where §12 put it                                       *
 * ------------------------------------------------------------------ */

describe("undo and redo live inside the chrome the owner chose", () => {
  it("9+: the sheet's action bar draws the pair ALWAYS, disabled on an empty sheet", () => {
    mount("maria", null);
    openPanel();
    const undo = screen.getByTestId("panel-undo") as HTMLButtonElement;
    const redo = screen.getByTestId("panel-redo") as HTMLButtonElement;
    // Drawn, announced, and refusing the tap — never absent.
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    expect(undo).toHaveAccessibleName("Desfazer no painel");
    expect(redo).toHaveAccessibleName("Refazer no painel");
    // The floor of a target, not a glyph.
    expect(undo).toHaveClass("h-11", "w-11");
    // A synthetic press cannot bypass the state.
    fireEvent.click(undo);
    fireEvent.click(redo);
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-drawing", "false");
  });

  it("9+: a stroke wakes undo, an undo wakes redo, in the same bar", () => {
    mount("maria", null);
    const paper = paperView();
    pointer("pointerdown", paper, 1, 150, 150);
    pointer("pointermove", paper, 1, 180, 170);
    pointer("pointerup", paper, 1, 180, 170);

    openPanel();
    const undo = screen.getByTestId("panel-undo") as HTMLButtonElement;
    const redo = screen.getByTestId("panel-redo") as HTMLButtonElement;
    expect(undo).toBeEnabled();
    expect(redo).toBeDisabled();

    fireEvent.click(undo);
    expect(screen.getByTestId("panel-undo")).toBeDisabled();
    expect(screen.getByTestId("panel-redo")).toBeEnabled();
  });

  it("9+: the old top-row pair is not drawn anywhere else", () => {
    mount("maria", null);
    expect(screen.queryByTestId("chrome-undo")).toBeNull();
    expect(screen.queryByTestId("chrome-redo")).toBeNull();
    openPanel();
    expect(screen.queryByTestId("chrome-undo")).toBeNull();
  });

  it("3-5: the pair sits in the compact preview row, at 52dp", () => {
    mount("theo", null);
    openBar();
    const row = screen.getByTestId("compact-preview-row");
    const undo = screen.getByTestId("compact-undo") as HTMLButtonElement;
    const redo = screen.getByTestId("compact-redo") as HTMLButtonElement;
    // Right of the preview, inside the row, at the kid target.
    expect(row.contains(undo)).toBe(true);
    expect(row.contains(redo)).toBe(true);
    expect(undo).toHaveClass("h-13", "w-13");
    expect(undo).toHaveAccessibleName("Desfazer");
    expect(redo).toHaveAccessibleName("Refazer");
    // Both inert on an empty sheet, and the preview gives up the width instead.
    expect(undo).toBeDisabled();
    expect(redo).toBeDisabled();
    expect(screen.getByTestId("compact-preview").className).toContain("min-w-0");
    expect(screen.getByTestId("compact-preview").className).toContain("flex-1");
  });

  it("3-5: the pair comes alive with the history, in the same row", () => {
    mount("theo", null);
    const paper = paperView();
    pointer("pointerdown", paper, 1, 150, 150);
    pointer("pointermove", paper, 1, 180, 170);
    pointer("pointerup", paper, 1, 180, 170);

    openBar();
    const undo = screen.getByTestId("compact-undo") as HTMLButtonElement;
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    expect(screen.getByTestId("compact-undo")).toBeDisabled();
    expect(screen.getByTestId("compact-redo")).toBeEnabled();
  });
});

/* ------------------------------------------------------------------ *
 * d) zoom: out of the panel, in the gesture                            *
 * ------------------------------------------------------------------ */

describe("zoom is a gesture with a transient readout", () => {
  it("has no zoom control anywhere in the panel", () => {
    mount();
    openBar();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();

    // The utilities row is GONE: no zoom, no grid and no paper door in the sheet.
    for (const testid of ["dock-utilities", "sheet-utilities", "zoom-controls"]) {
      expect(screen.queryByTestId(testid)).toBeNull();
    }
    for (const label of ["Diminuir zoom", "Ajustar à tela", "Aumentar zoom", "Zoom"]) {
      expect(screen.queryByLabelText(label)).toBeNull();
    }
  });

  it("shows the percentage during the pinch and ~1.5s after it lets go", () => {
    vi.useFakeTimers();
    mount("maria", null);
    const paper = paperView();
    expect(screen.queryByTestId("zoom-hud")).toBeNull();

    pointer("pointerdown", paper, 1, 100, 200);
    pointer("pointerdown", paper, 2, 200, 200);
    const readout = screen.getByTestId("zoom-hud");
    expect(readout).toHaveAttribute("data-percent", "100");
    expect(within(readout).getByTestId("zoom-value")).toHaveTextContent("100%");
    // The number is DATA: tabular figures, so the box never changes width.
    expect(within(readout).getByTestId("zoom-value").className).toContain("tabular-nums");

    pointer("pointermove", paper, 2, 300, 200);
    expect(screen.getByTestId("zoom-hud")).toHaveAttribute("data-percent", "200");

    pointer("pointerup", paper, 2, 300, 200);
    pointer("pointerup", paper, 1, 100, 200);
    // Still there right after the release…
    expect(screen.getByTestId("zoom-hud")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1600);
    });
    expect(screen.queryByTestId("zoom-hud")).toBeNull();
  });

  it("does not intercept the stroke: the container refuses the pointer", () => {
    mount("maria", null);
    const paper = paperView();
    pointer("pointerdown", paper, 1, 100, 200);
    pointer("pointerdown", paper, 2, 200, 200);
    const readout = screen.getByTestId("zoom-hud");
    expect(readout.className).toContain("pointer-events-none");
    // Only the two targets take it, at the project's floor.
    for (const label of ["Diminuir zoom", "Aumentar zoom"]) {
      const target = within(readout).getByLabelText(label);
      expect(target).toHaveClass("pointer-events-auto", "h-11", "w-11");
    }
  });

  it("3-5 opens the same readout by touching the corner, at 52dp", () => {
    mount("theo", "foguete");
    const tap = screen.getByTestId("zoom-tap");
    expect(tap).toHaveClass("h-13", "w-13");
    expect(screen.queryByTestId("zoom-hud")).toBeNull();
    fireEvent.click(tap);
    expect(screen.getByTestId("zoom-hud")).toBeInTheDocument();
  });

  it("9+ has no corner target: the pinch is the way", () => {
    mount();
    expect(screen.queryByTestId("zoom-tap")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * e) no chrome over the paper while ink flows                          *
 * ------------------------------------------------------------------ */

describe("nothing of the chrome reaches the paper while a stroke flows", () => {
  it("keeps Início live during the stroke: it is outside the stage", () => {
    mount("maria", null);
    const back = screen.getByTestId("chrome-back");
    fireEvent.pointerDown(paperView(), { pointerId: 7, clientX: 150, clientY: 150 });
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-drawing", "true");
    // Neither faded nor inert: a band outside the paper has nothing to release.
    expect(back).not.toHaveAttribute("data-faded");
    expect(back).not.toHaveAttribute("inert");
    expect(back.className).not.toContain("opacity-0");
    // The pill does leave — it is the drawer, and the drawer steps aside.
    expect(screen.queryByTestId("canvas-dock")).toBeNull();

    fireEvent.pointerUp(paperView(), { pointerId: 7, clientX: 150, clientY: 150 });
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-drawing", "false");
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
  });

  it("keeps both bands out of the stage, so no overlay can cover the sheet", () => {
    mount("maria", null);
    fireEvent.pointerDown(paperView(), { pointerId: 9, clientX: 150, clientY: 150 });
    // The paper's own box does not move when ink flows, and no band is inside it.
    expect(stage().contains(band())).toBe(false);
    expect(stage().contains(screen.getByTestId("canvas-top-band"))).toBe(false);
    fireEvent.pointerUp(paperView(), { pointerId: 9, clientX: 150, clientY: 150 });
  });
});
