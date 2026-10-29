// THE CANVAS'S TWO BANDS (owner's composition, 27/10, `chrome-v2` §12).
//
// The rail and the hamburger were REVOKED. What is left is a screen with no
// permanent control over the paper and two bands, neither of them over it:
//
//   top     the workspace selector alone (plus the page's name on 9+ when the
//           path offers no switch), in the frame's flow ABOVE the stage
//   bottom  [ Início ] and the tools pill, two targets in a fixed order
//
// Everything the rail carried has a new home, and this file holds the contract:
// the undo pair moved INTO the sheet's action bar (9+) and into the compact
// preview row (3-5); papel and grade were already folds of the sheet; `Início`
// is the bottom band's first target and the clear gesture stays a 550ms hold.
//
// Seam: the TOP BAND (what it draws, when it draws nothing, and the geometry
// that decides where the selector lands) plus the ONE door that left it, which is
// also the clear gesture now. The selector's own content, state and contrast stay
// in `workspace-switcher.test.tsx`; the bottom band's anatomy is in
// `canvas-hud.test.tsx`.
//
//   a) composition  no rail, no hamburger, no flank: the band is the selector
//   b) empty        3-5 without a switch draws NO band at all (0dp)
//   c) centre       the MEASURED deviation from the band's centre at 390 and at
//                   360 — 0dp, because there is no flank left to weigh
//   d) protected    a HOLD on `Início` (550ms) clears the sheet, ANNOUNCES itself
//                   and hands back a "Desfazer"; the next undo brings the whole
//                   drawing back, and a TAP still leaves
//   e) latch        the level switch hangs from the drawer, never from a band
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StoreProvider, useStore, type Screen as ScreenName } from "@/mockup/store";
import { blankArtwork } from "@/mockup/artworks";
import { emptyHistory, push } from "@/mockup/history";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { openTools } from "./open-panel";
import {
  chromeBandHeight,
  doorSize,
  latchIsCentred,
  latchIsGlued,
  topRowGeometry,
} from "./top-row";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
});

/** The canvas the store says is open — one stub for the screens beside it. */
function Screen() {
  const { state } = useStore();
  const s = state.screen;
  if (s.name === "canvas")
    return <CanvasScreen key={s.artworkId} artworkId={s.artworkId} back={s.back} />;
  return <span data-testid="other-screen" />;
}

/**
 * Boots one profile on one sheet. `back` decides whether the path offers BOTH
 * workspaces: `profile` and `pages` do, everything else does not — and that is
 * the switch the top band's whole existence depends on (`workspacePathOf`).
 */
function Boot({
  profileId,
  page = false,
  back = { name: "profile" },
}: {
  profileId: string;
  page?: boolean;
  back?: ScreenName;
}) {
  const { dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    const id = page ? "row-page" : "row-draw";
    dispatch({
      type: "createArtwork",
      artwork: page
        ? {
            id,
            profileId,
            pageId: "peixe",
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
  }, [dispatch, profileId, page, back]);
  return (
    <>
      <Screen />
      <Lab />
    </>
  );
}

/** The test's own hand: what the bucket does, and what the sheet now holds. */
function Lab() {
  const { state, dispatch } = useStore();
  const s = state.screen;
  const art = s.name === "canvas" ? state.artworks.find((a) => a.id === s.artworkId) : undefined;
  const paint = (color: string) => {
    if (!art) return;
    dispatch({
      type: "setHistory",
      id: art.id,
      history: push(art.history, { t: "fill", region: "fundo", color }),
    });
  };
  return (
    <div>
      <span data-testid="commands">{art?.history.commands.length ?? 0}</span>
      <span data-testid="redos">{art?.history.redo.length ?? 0}</span>
      <button type="button" onClick={() => paint("#C81E1E")}>
        pintar de vermelho
      </button>
      <button type="button" onClick={() => paint("#1E3AC8")}>
        pintar de azul
      </button>
    </div>
  );
}

const mount = (profileId: string, page = false, back: ScreenName = { name: "profile" }) =>
  render(
    <StoreProvider>
      <Boot profileId={profileId} page={page} back={back} />
    </StoreProvider>,
  );

const topBand = () => screen.getByTestId("canvas-top-band");
const band = (testid: string) => screen.getByTestId(testid);
const door = (testid: string) => screen.getByTestId(testid);
const commands = () => Number(screen.getByTestId("commands").textContent);
const redos = () => Number(screen.getByTestId("redos").textContent);
/** The fill the sheet is actually wearing: the region's own SVG, not the store. */
const ground = () =>
  screen.getByTestId("canvas").querySelector('[data-region="fundo"]')?.getAttribute("fill") ?? null;
const topGeometry = (width: number) => topRowGeometry(topBand(), width);
const bottomGeometry = (width: number) => topRowGeometry(band("canvas-band"), width);
const labels = (root: ParentNode) =>
  [...root.querySelectorAll("button")].map((b) => b.getAttribute("aria-label"));

/**
 * THE UNDO OF THE 9+ SCREEN, walked as a hand walks it: the pill opens the
 * compact bar, the bar's latch opens the sheet, and the pair is in the sheet's
 * action bar. This is the cost `chrome-v2` §12.3 accepted and recorded.
 */
function panelUndo() {
  openTools();
  return screen.getByTestId("panel-undo") as HTMLButtonElement;
}

/** THE UNDO OF THE 3-5 SCREEN: one level down, in the compact preview row. */
function compactUndo() {
  fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
  return screen.getByTestId("compact-undo") as HTMLButtonElement;
}

/* ------------------------------------------------------------------ *
 * a) the composition: no rail, no hamburger, no flank                 *
 * ------------------------------------------------------------------ */

describe("the top band is the workspace selector and nothing else", () => {
  it("has no rail, no hamburger and no flank, on either band", () => {
    mount("maria");
    for (const gone of ["chrome-rail", "chrome-menu", "chrome-flank-left", "chrome-flank-right"]) {
      expect(screen.queryByTestId(gone)).toBeNull();
    }
    // The band is ONE target group: the pill's two segments.
    expect(within(topBand()).getAllByRole("radio")).toHaveLength(2);
    expect(topBand()).toHaveAttribute("data-chip-count", "2");
    // `Início` is not one of them either: it is the bottom band's left target.
    expect(within(topBand()).queryByTestId("chrome-back")).toBeNull();
  });

  it("sits OUTSIDE the stage, above it in the frame's flow", () => {
    mount("maria");
    const stage = screen.getByTestId("canvas-stage");
    expect(stage.contains(topBand())).toBe(false);
    expect(screen.getByTestId("canvas")).toContainElement(topBand());
    // BEFORE the stage in document order: the band owns the top of the frame.
    expect(
      topBand().compareDocumentPosition(stage) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // And it is a sibling of the stage, not a child of some overlay.
    expect(topBand().parentElement).toBe(stage.parentElement);
  });

  it("keeps the page's name on 9+ when the path offers no switch", () => {
    mount("maria", true, { name: "home" });
    // A piece opened from the gallery already had its workspace chosen: no pill,
    // and the label owns the band instead.
    expect(screen.queryByTestId("workspace-switcher")).toBeNull();
    expect(within(topBand()).getByTestId("canvas-title")).toBeInTheDocument();
  });

  it("keeps the paper's folds reachable without the rail", () => {
    mount("maria");
    openTools();
    // Papel and Grade are folds of the sheet, with their three parameters each.
    expect(screen.getByTestId("fold-grade")).toBeInTheDocument();
    expect(screen.getByTestId("fold-papel")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ *
 * b) the band that draws nothing                                       *
 * ------------------------------------------------------------------ */

describe("an empty band takes no dp", () => {
  it("3-5 without a workspace switch renders no band at all", () => {
    mount("theo", true, { name: "home" });
    // No band node: 0dp, not an empty plate with a gutter. The air goes back to
    // the paper (`chrome-v2` §12.1).
    expect(screen.queryByTestId("canvas-top-band")).toBeNull();
    expect(screen.getByTestId("canvas-stage")).toBeInTheDocument();
  });

  it("3-5 WITH a switch draws the band, at the kid target", () => {
    mount("theo", true, { name: "profile" });
    expect(topBand()).toBeInTheDocument();
    // The band declares its own height: p-3 (12 + 12) around the kid target of
    // 52dp, and `border-box` counts the padding — so `min-h-19` = 76dp.
    expect(topBand()).toHaveClass("min-h-19", "p-3");
    expect(chromeBandHeight(52)).toBe(76);
  });

  it("9+ keeps the band's height whether it holds the pill or the name", () => {
    mount("maria", true, { name: "home" });
    // Same box with a label instead of the pill: the paper never jumps because a
    // path offers no switch.
    expect(topBand()).toHaveClass("min-h-17", "p-3");
    expect(chromeBandHeight(44)).toBe(68);
  });
});

/* ------------------------------------------------------------------ *
 * c) the selector against the band's centre, measured                  *
 * ------------------------------------------------------------------ */

describe("the selector is dead centre on its band", () => {
  it("9+: 0dp of deviation, the same at 390 and at 360", () => {
    mount("maria");
    for (const width of [390, 360]) {
      const g = topGeometry(width);
      expect(g.centred).toBe(true);
      expect(g.children).toBe(1);
      expect(g.offset).toBe(0);
      // The pill fits with air on both sides at both widths.
      expect(g.contentW).toBe(92);
      expect(g.air).toBeGreaterThan(0);
    }
  });

  it("3-5: 0dp as well, and the same declared pill width", () => {
    mount("theo", true, { name: "profile" });
    const g = topGeometry(390);
    expect(g.offset).toBe(0);
    expect(g.contentW).toBe(92);
  });

  it("the bottom band's pill is centred too, with only two targets drawn", () => {
    mount("maria");
    const g = bottomGeometry(390);
    expect(g.grid).toBe(true);
    expect(g.centred).toBe(true);
    expect(g.children).toBe(2);
    expect(g.offset).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 * d) apagar a obra is a hold on Início — and undo lives in the sheet   *
 * ------------------------------------------------------------------ */

describe("apagar a obra is a hold on Início", () => {
  // A BLANK sheet: `fundo` is the region the sheet's own SVG paints, so the
  // test's hand and the test's eye look at the same surface.
  it("erases on a 550ms hold, and the next undo brings the whole sheet back", () => {
    vi.useFakeTimers();
    mount("maria");
    fireEvent.click(screen.getByText("pintar de vermelho"));
    expect(ground()).toBe("#C81E1E");

    const back = door("chrome-back");
    fireEvent.pointerDown(back);
    act(() => {
      vi.advanceTimersByTime(560);
    });
    fireEvent.pointerUp(back);

    // Gone from the sheet and from the document: the clear is a real step. The
    // region wears the sheet's own blank fill again, not the hand's colour.
    expect(ground()).toBe("#FFFFFF");
    expect(commands()).toBe(0);
    // …and the way back is the sheet's undo, which is live again thanks to the
    // clear's own memory (`undoReady`).
    const undo = panelUndo();
    expect(undo).toBeEnabled();
    fireEvent.click(undo);
    expect(ground()).toBe("#C81E1E");
  });

  it("offers the way back where the hand is: a notice with 'Desfazer a limpeza'", () => {
    vi.useFakeTimers();
    mount("maria");
    fireEvent.click(screen.getByText("pintar de vermelho"));
    const back = door("chrome-back");
    fireEvent.pointerDown(back);
    act(() => {
      vi.advanceTimersByTime(560);
    });
    fireEvent.pointerUp(back);

    const notice = screen.getByTestId("clear-notice");
    fireEvent.click(within(notice).getByLabelText("Desfazer a limpeza"));
    expect(ground()).toBe("#C81E1E");
    expect(screen.queryByTestId("clear-notice")).toBeNull();
  });

  it("the notice leaves on its own: it never becomes permanent chrome", () => {
    vi.useFakeTimers();
    mount("maria");
    fireEvent.click(screen.getByText("pintar de vermelho"));
    const back = door("chrome-back");
    fireEvent.pointerDown(back);
    act(() => {
      vi.advanceTimersByTime(560);
    });
    fireEvent.pointerUp(back);
    expect(screen.getByTestId("clear-notice")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(8100);
    });
    expect(screen.queryByTestId("clear-notice")).toBeNull();
    // …and the sheet still answers after the sentence goes: the clear's memory
    // is a ref, not the notice (destructive action stays undoable).
    expect(panelUndo()).toBeEnabled();
  });

  it("3-5 gets the undo target without a word: no text on the child's screen", () => {
    vi.useFakeTimers();
    mount("theo");
    fireEvent.click(screen.getByText("pintar de vermelho"));
    const back = door("chrome-back");
    fireEvent.pointerDown(back);
    act(() => {
      vi.advanceTimersByTime(560);
    });
    fireEvent.pointerUp(back);

    const notice = screen.getByTestId("clear-notice");
    // The target IS the child of the notice — no sentence anywhere.
    expect(notice.textContent?.trim()).toBe("");
    const undo = within(notice).getByLabelText("Desfazer a limpeza");
    expect(undo).toHaveClass("h-13", "w-13");
    fireEvent.click(undo);
    expect(ground()).toBe("#C81E1E");
  });

  it("the hold never fires the tap: the release does not leave the screen", () => {
    vi.useFakeTimers();
    mount("maria");
    fireEvent.click(screen.getByText("pintar de vermelho"));
    const back = door("chrome-back");
    fireEvent.pointerDown(back);
    act(() => {
      vi.advanceTimersByTime(560);
    });
    fireEvent.pointerUp(back);
    fireEvent.click(back);
    // Still on the canvas: one gesture, one consequence.
    expect(screen.getByTestId("canvas")).toBeInTheDocument();
  });

  it("a TAP still leaves — the leave path, never the clear", () => {
    vi.useFakeTimers();
    mount("maria", true);
    const back = door("chrome-back");
    fireEvent.pointerDown(back);
    act(() => {
      vi.advanceTimersByTime(120);
    });
    fireEvent.pointerUp(back);
    fireEvent.click(back);
    // A clean sheet leaves on the tap, with nothing asked and nothing erased.
    expect(screen.queryByTestId("canvas")).toBeNull();
  });

  it("a short press on a sheet with ink erases nothing", () => {
    vi.useFakeTimers();
    mount("maria");
    fireEvent.click(screen.getByText("pintar de vermelho"));
    const back = door("chrome-back");
    fireEvent.pointerDown(back);
    act(() => {
      vi.advanceTimersByTime(120);
    });
    fireEvent.pointerUp(back);
    fireEvent.click(back);
    // Whatever the leave path asks (a dirty piece asks), the ink is untouched:
    // the hold is the only destructive gesture on this door.
    expect(commands()).toBe(1);
    expect(ground()).toBe("#C81E1E");
    expect(screen.queryByTestId("clear-notice")).toBeNull();
  });

  it("an empty sheet has nothing to hold: the release still leaves", () => {
    vi.useFakeTimers();
    mount("maria");
    const back = door("chrome-back");
    fireEvent.pointerDown(back);
    act(() => {
      vi.advanceTimersByTime(560);
    });
    fireEvent.pointerUp(back);
    fireEvent.click(back);
    expect(screen.queryByTestId("canvas")).toBeNull();
  });

  it("holding UNDO does not erase: the destructive gesture has one owner", () => {
    vi.useFakeTimers();
    mount("maria");
    fireEvent.click(screen.getByText("pintar de vermelho"));
    const undo = panelUndo();
    fireEvent.pointerDown(undo);
    act(() => {
      vi.advanceTimersByTime(900);
    });
    fireEvent.pointerUp(undo);
    fireEvent.click(undo);
    // One press = one step back, never a wipe.
    expect(screen.queryByTestId("clear-notice")).toBeNull();
    expect(ground()).toBe("#FFFFFF");
    expect(redos()).toBe(1);
  });
});

/* ------------------------------------------------------------------ *
 * e) the level switch is the DRAWER's latch - never a band             *
 * ------------------------------------------------------------------ */

describe("the level switch hangs from the drawer, never from a band", () => {
  it("9+: 44dp glued to the bar's top edge, centred on it", () => {
    mount("maria");
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const latch = band("chrome-panel");
    expect(doorSize(latch)).toBe(44);
    expect(latchIsGlued(latch)).toBe(true);
    expect(latchIsCentred(latch)).toBe(true);
    // It is a child of the drawer's region, never of a band.
    expect(band("canvas-band").contains(latch)).toBe(false);
    expect(topBand().contains(latch)).toBe(false);
  });

  it("3-5: 52dp on the same seat", () => {
    mount("theo", true);
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const latch = band("chrome-panel");
    expect(doorSize(latch)).toBe(52);
    expect(latchIsGlued(latch)).toBe(true);
  });

  it("never enters a band: 0dp with the latch on screen", () => {
    mount("maria");
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const latch = band("chrome-panel");
    // Both bands are complete without it — their children are their targets.
    expect([...band("canvas-band").children]).toHaveLength(2);
    expect(labels(topBand())).not.toContain(latch.getAttribute("aria-label"));
  });
});
