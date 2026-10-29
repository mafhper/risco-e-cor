// The compact bar's four measured defects (owner's audit, 26/10, 390×844 with
// the dock 366dp wide at x=12). Seam: the DOM the bar actually paints.
//
//  1. grid     line 1 began at x=47 and line 2 at x=71, because each line was
//              centred on its own natural width. Both lines now mount ONE
//              6-column grid (6 × 44 + 5 × 8 = 304, centred in 358 → 27/27).
//              Since the nanquim the second line is FULL — five materials plus
//              the door — so no empty column is left over.
//  2. preview  the band read 0.6 on a 24dp box: the scale was keyed to the
//              can's widest cloud (280 units), so the default pen drew a
//              hairline and the floor froze sizes 1..7. The strip now maps the
//              1..100 range, and 10/50/100 read 2/10/20dp.
//  3. Mais     the chrome's "Mais ferramentas" chip was a second door to a
//              panel whose preferences live in the sheet's folds.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { StrokePreview } from "@/mockup/screens/BrushShelf";
import { openFold } from "./open-panel";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Harness({ profileId, pageId }: { profileId: string; pageId: string | null }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

function mount(profileId = "maria", pageId: string | null = "peixe") {
  render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} />
    </StoreProvider>,
  );
}

const openCompact = () => {
  mount();
  fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
  return screen.getByTestId("canvas-compact");
};

const linesOf = (compact: HTMLElement) => within(compact).getAllByTestId("compact-tools-line");

/* ------------------------------------------------------------------ *
 * 1. The two lines are one grid                                       *
 * ------------------------------------------------------------------ */

describe("both tool lines ride the same 6-column grid", () => {
  it("declares the same tracks, the same gap and the same width on both lines", () => {
    const compact = openCompact();
    const [first, second] = linesOf(compact);
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    for (const line of [first!, second!]) {
      // One grid definition per line, read from the element that paints it.
      expect(line.style.gridTemplateColumns).toBe("repeat(6, 44px)");
      expect(line.style.gap).toBe("8px");
      // The tracks are CENTRED in the bar's own box: same box, same tracks,
      // same origin — a line has nowhere else to start.
      expect(line).toHaveClass("justify-center");
      expect(line).toHaveClass("w-full");
      expect(line.getAttribute("data-columns")).toBe("6");
      expect(line.getAttribute("data-cell")).toBe("44");
      expect(line.getAttribute("data-gap")).toBe("8");
    }

    // The closed account of `compacta-distribuicao` §2: 6·44 + 5·8 = 304, and
    // 304 + 27 + 27 = 358 — the bar's inner width (366 − 2·4 of `px-1`).
    const blockWidth = (line: HTMLElement) =>
      Number(line.getAttribute("data-columns")) * Number(line.getAttribute("data-cell")) +
      (Number(line.getAttribute("data-columns")) - 1) * Number(line.getAttribute("data-gap"));
    expect(blockWidth(first!)).toBe(304);
    expect(blockWidth(second!)).toBe(304);
    expect(304 + 27 * 2).toBe(358);

    // Neither line is offset by a leading element: the first grid item of each
    // line is the first chip, so both begin on column 1.
    const firstChipOf = (line: HTMLElement) => within(line).getAllByRole("button")[0]!;
    expect(first!.firstElementChild).toHaveAttribute("role", "group");
    expect(second!.firstElementChild).toHaveAttribute("role", "group");
    expect(firstChipOf(first!)).toHaveAttribute("data-tool", "eraser");
    expect(firstChipOf(second!)).toHaveAttribute("data-tool", "brush");
  });

  it("closes the second line on the door, with no empty column left", () => {
    const compact = openCompact();
    const second = linesOf(compact)[1]!;

    // Five materials + the adjustments door = the six columns, all occupied.
    expect(within(second).queryByTestId("compact-tools-gap")).toBeNull();
    const last = second.lastElementChild!;
    expect(last).toHaveAttribute("data-testid", "compact-more-adjustments");
    expect(last.tagName).toBe("BUTTON");
    // The door still closes the row on its own: it is a direct child of the
    // line, not a member of a category.
    for (const group of within(second).queryAllByRole("group")) {
      expect(group.contains(last)).toBe(false);
    }
  });

  it("keeps the child's five on one line of its own width, still centred", () => {
    // 3-5 has no second line, so its grid is its own five columns: 5·52 + 4·8
    // = 292, centred in the same 358 (33/33) — the spec's kids block.
    mount("theo", "foguete");
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    const [only] = linesOf(compact);
    expect(only!.style.gridTemplateColumns).toBe("repeat(5, 52px)");
    expect(only!.style.gap).toBe("8px");
    expect(only!.getAttribute("data-cell")).toBe("52");
    expect(within(only!).queryByTestId("compact-tools-gap")).toBeNull();
    expect(5 * 52 + 4 * 8).toBe(292);
  });
});

/* ------------------------------------------------------------------ *
 * 2. The preview maps the size onto its box                           *
 * ------------------------------------------------------------------ */

describe("the preview paints the size, in real dp", () => {
  /** The compact panel's own box since 26/10: the band needs the room. */
  const BOX = 88;
  /** The box shows the whole 1..100 range: the top size fills it minus 4dp. */
  const target = (size: number) => ((BOX - 4) / 100) * size;
  const band = (size: number) => {
    const { container, unmount } = render(
      <StrokePreview tool="brush" color="#000000" size={size} box={BOX} />,
    );
    const host = container.querySelector("[data-stroke-width]")!;
    const declared = Number(host.getAttribute("data-stroke-width"));
    // The declared number is the band the canvas is painted at: one column of
    // pixels per dp, and no vector line behind it (the sample is the engine's).
    expect(host.querySelector("path")).toBeNull();
    expect(Number(host.querySelector("canvas")!.getAttribute("height"))).toBe(BOX);
    unmount();
    return declared;
  };

  it("puts 10, 50 and 100 inside ±10% of the box's own target", () => {
    for (const size of [10, 50, 100]) {
      expect(band(size) / target(size), `size ${size}`).toBeGreaterThanOrEqual(0.9);
      expect(band(size) / target(size), `size ${size}`).toBeLessThanOrEqual(1.1);
    }
  });

  it("makes the three sizes visibly different, and 10dp a real line", () => {
    const thin = band(10);
    const medium = band(50);
    const thick = band(100);

    // 8dp at the thin end is a line a hand can see; 0.6 was the defect's number.
    expect(thin).toBeGreaterThanOrEqual(6);
    // Twice the size is about twice the band, and five times is about five.
    expect(medium / thin).toBeGreaterThan(4.5);
    expect(medium / thin).toBeLessThan(5.5);
    expect(thick / medium).toBeGreaterThan(1.8);
    expect(thick).toBeLessThanOrEqual(BOX - 4);
  });

  it("no longer freezes the small end: 6 and 7 are different bands", () => {
    // The old floor (`max(0.6, …)`) made every size from 1 to 7 the same line.
    expect(band(7)).toBeGreaterThan(band(6));
    expect(band(6)).toBeGreaterThan(band(1));
  });

  it("maps the sheet's taller box with the same rule", () => {
    // The sheet's header has room for the same range at its own scale:
    // (96 - 4) / 100 = 0.92 px per unit — the box is taller, the rule is one.
    const { container, unmount } = render(
      <StrokePreview tool="brush" color="#000000" size={100} box={96} />,
    );
    const declared = Number(
      container.querySelector("[data-stroke-width]")!.getAttribute("data-stroke-width"),
    );
    unmount();
    expect(declared / 100).toBeCloseTo((96 - 4) / 100, 5);
  });
});

/* ------------------------------------------------------------------ *
 * 3. No "Mais" door left                                              *
 * ------------------------------------------------------------------ */

describe("the canvas has no second preferences panel", () => {
  it("carries no 'Mais ferramentas' chip and no MorePanel", () => {
    mount();
    expect(screen.queryByLabelText("Mais ferramentas")).toBeNull();
    expect(screen.queryByTestId("more-panel")).toBeNull();

    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    const panel = screen.getByTestId("canvas-panel");
    expect(within(panel).queryByLabelText("Mais ferramentas")).toBeNull();
    expect(within(panel).queryByTestId("more-panel")).toBeNull();
  });

  it("keeps the preferences in the sheet's own folds, gradient included", () => {
    mount();
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    const panel = screen.getByTestId("canvas-panel");
    // A material that paints: the bucket opens the canvas and has no stroke
    // parameters of its own, so the sheet would have nothing to show.
    fireEvent.click(within(panel).getByLabelText("Pincel"));

    // Opacity, the gradient and the two effects: one home, one door each.
    // The parameters are inside Ajustes, which opens CLOSED since 27/10.
    openFold("fold-ajustes");
    expect(within(panel).getByText("Opacidade")).toBeInTheDocument();
    const fold = within(panel).getByTestId("fold-gradiente");
    expect(fold).toHaveTextContent("Gradiente");
    // Off since 27/10: the summary says so, the chevron refuses, and the switch
    // on the header is the only way in (owner's feedback).
    expect(fold).toHaveTextContent("Desligado");
    expect(fold).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(within(panel).getByRole("switch", { name: "Ativar gradiente" }));
    fireEvent.click(within(panel).getByRole("button", { name: "Linear" }));
    expect(within(panel).getByTestId("gradient-preview")).toBeInTheDocument();
    expect(within(panel).getByTestId("gradient-editor")).toBeInTheDocument();
    // The effects kept their own folds next to it.
    expect(within(panel).getByTestId("fold-sombra")).toBeInTheDocument();
    expect(within(panel).getByTestId("fold-brilho")).toBeInTheDocument();
  });
});
