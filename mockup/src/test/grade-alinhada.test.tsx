// THE WORKING GRID lives in the sheet's own coordinate system, and never in the
// piece (owner's decision, 27/10, `chrome-v2` §4).
//
//   guide   a `<pattern patternUnits="userSpaceOnUse">` inside the page's SVG:
//           the cell is the DENSITY's own number in ARTWORK units (16/24/32), so
//           it zooms with the paper instead of sitting on the screen.
//   paper   its own `<pattern>` (the graph stock), which is the PAPER and does
//           reach the file.
//
// The seam is the sheet's SVG and the two `<pattern>`s in it: the guide must ride
// the same user space, take the cell the density declares, draw at the strength
// the fold names, and stay out of both the exported file and the command list.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ArtworkSvg } from "@/mockup/ArtworkSvg";
import { PAPERS } from "@/mockup/palette";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { exportArtwork } from "@/mockup/exportPng";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function CanvasHarness({ profileId, pageId }: { profileId: string; pageId: string | null }) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

const mount = (profileId = "maria", pageId: string | null = "peixe") =>
  render(
    <StoreProvider>
      <CanvasHarness profileId={profileId} pageId={pageId} />
    </StoreProvider>,
  );

/** The guide's own group. */
const guide = () => screen.getByTestId("paper-grid");
/** The paper's own texture, in the half of the sheet that paints it. */
const paperPattern = () =>
  screen.getByTestId("page-area").querySelector<SVGPatternElement>('pattern[id^="paper-graph"]');
/** The guide's lattice. */
const guidePattern = () =>
  guide().querySelector<SVGPatternElement>("pattern") ??
  guide().closest("svg")?.querySelector<SVGPatternElement>('pattern[id^="paper-guide"]') ??
  null;

const cellOf = (pattern: SVGPatternElement | null) => ({
  w: Number(pattern?.getAttribute("width")),
  h: Number(pattern?.getAttribute("height")),
});

/**
 * The guide is a FOLD of the tools sheet since 27/10 (`chrome-v2` §12): the pill
 * opens the bar, the bar's latch opens the sheet, and the fold's own switch is
 * what turns the guide on. Idempotent — a test may arrive with the sheet already
 * open and the guide already on.
 */
function openGuide() {
  if (!screen.queryByTestId("canvas-panel")) {
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
  }
  if (!screen.queryByTestId("paper-grid")) fireEvent.click(screen.getByLabelText("Ativar grade"));
}

/** One of the fold's three parameters, by its own accessible name. */
const choose = (name: string) => fireEvent.click(screen.getByRole("radio", { name }));

/* ------------------------------------------------------------------ *
 * 1. The guide rides the sheet's user space                           *
 * ------------------------------------------------------------------ */

describe("the guide lives in the paper's own coordinate system", () => {
  it("draws no screen-pixel background: it is a pattern in the sheet's SVG", () => {
    mount();
    expect(screen.queryByTestId("paper-grid")).toBeNull();

    openGuide();
    const node = guide();
    const svg = node.closest("svg");
    expect(svg).not.toBeNull();
    // The very SVG of the sheet, not a sibling div: same viewBox, same origin.
    expect(screen.getByTestId("page-area").contains(svg)).toBe(true);
    expect(svg!.getAttribute("viewBox")).toBe("0 0 300 300");

    // A background-image in px was the defect: what paints the guide is a
    // `<rect>` filled by its own `<pattern>`, and that rect covers the sheet.
    expect(node.tagName.toLowerCase()).toBe("g");
    const paint = node.querySelector("rect")!;
    expect(paint.getAttribute("width")).toBe("300");
    expect(paint.getAttribute("height")).toBe("300");
    expect(paint.getAttribute("fill")).toBe(`url(#${guidePattern()!.id})`);

    const pattern = guidePattern();
    expect(pattern).not.toBeNull();
    // `userSpaceOnUse` is what ties the lattice to the artwork's units; the
    // paper's pattern declares the same, and neither offsets its origin.
    expect(pattern!.getAttribute("patternUnits")).toBe("userSpaceOnUse");
    expect(pattern!.getAttribute("patternTransform")).toBeNull();
    expect(pattern!.getAttribute("x")).toBeNull();
    expect(pattern!.getAttribute("y")).toBeNull();
  });

  it("takes the cell the DENSITY declares, in artwork units", () => {
    mount();
    openGuide();
    // The default density is `média`: 24 artwork units, whatever the sheet size.
    expect(cellOf(guidePattern())).toEqual({ w: 24, h: 24 });
    expect(guide()).toHaveAttribute("data-grid-cell", "24");

    choose("Fina");
    expect(cellOf(guidePattern())).toEqual({ w: 16, h: 16 });
    choose("Grossa");
    expect(cellOf(guidePattern())).toEqual({ w: 32, h: 32 });
    expect(screen.getByTestId("fold-grade-cell")).toHaveTextContent("célula 32 unidades");
  });

  it("is its own lattice, never a second graph paper", () => {
    mount();
    // A graph stock carries its OWN pattern (the paper's texture); the guide is
    // a separate lattice that happens to live in the same space.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    fireEvent.click(screen.getByTestId("fold-papel"));
    choose("Papel Quadriculado");
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper", "quadriculado");
    expect(paperPattern()).not.toBeNull();
    expect(cellOf(paperPattern())).toEqual({ w: 21, h: 21 });

    openGuide();
    expect(cellOf(guidePattern())).toEqual({ w: 24, h: 24 });
    expect(guidePattern()!.getAttribute("patternUnits")).toBe(
      paperPattern()!.getAttribute("patternUnits"),
    );
    // Two patterns, two ids: the paper's paint is never the guide's.
    expect(guidePattern()!.id).not.toBe(paperPattern()!.id);
  });

  it("draws the three patterns the fold names", () => {
    mount();
    openGuide();
    // The default is the square lattice: two lines per cell.
    const square = guidePattern()!.innerHTML;
    expect(square).toContain("path");

    choose("Pontilhado");
    expect(guide()).toHaveAttribute("data-grid-pattern", "pontilhado");
    expect(guidePattern()!.innerHTML).toContain("circle");

    choose("Linhas");
    expect(guide()).toHaveAttribute("data-grid-pattern", "linhas");
    // A single horizontal rule per cell, no vertical one.
    expect(guidePattern()!.innerHTML).toContain("M0 24H24");
  });

  it("keeps `sutil` as the mesh's own opacity, and `nítida` at full strength", () => {
    mount();
    openGuide();
    expect(guide()).toHaveAttribute("data-grid-mode", "sutil");
    expect(Number(guide().getAttribute("opacity"))).toBe(0.45);

    choose("Nítida");
    expect(guide()).toHaveAttribute("data-grid-mode", "nitida");
    expect(Number(guide().getAttribute("opacity") ?? 1)).toBe(1);

    // The header's switch is the on/off, in both directions.
    fireEvent.click(screen.getByLabelText("Ativar grade"));
    expect(screen.queryByTestId("paper-grid")).toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * 2. The guide never enters the artwork — or the file                 *
 * ------------------------------------------------------------------ */

describe("the guide is a screen aid, never the piece", () => {
  /** The SVG the file would be made of: the plan's fields, no screen prop. */
  const exportHalf = () => {
    const plan = exportArtwork([], "peixe", 300, 300, PAPERS.quadriculado);
    const { unmount } = render(
      <ArtworkSvg
        pageId={plan.pageId}
        w={plan.view.w}
        h={plan.view.h}
        commands={[...plan.commands]}
        paperHex={plan.paper.hex}
        paperPattern={plan.paper.pattern}
        outlineHex={plan.outlineHex}
        layer="all"
        data-testid="export-svg"
      />,
    );
    const svg = screen.getByTestId("export-svg");
    const markup = svg.outerHTML;
    unmount();
    return { plan, markup };
  };

  it("does not exist in the SVG composed from the export plan", () => {
    mount();
    openGuide();
    choose("Nítida");
    // The guide is on screen, in the sheet's SVG — exactly once, or the ink of
    // two identical lattices would stack.
    expect(screen.getAllByTestId("paper-grid")).toHaveLength(1);

    const { plan, markup } = exportHalf();
    // The file's SVG DOES carry the paper's own texture (so this is not a
    // vacuous "nothing is there" check) and does not carry the guide.
    expect(markup).toContain("paper-graph-300x300");
    expect(screen.getByTestId("page-area").innerHTML).toContain("paper-guide");
    expect(markup).not.toContain("paper-guide");
    expect(markup).not.toContain('data-testid="paper-grid"');
    expect(markup).not.toContain("data-grid-mode");
    // And the description the writer reads has no field for it: the guide can
    // only travel as a prop, and the export never passes one.
    expect(Object.keys(plan).sort()).toEqual([
      "commands",
      "height",
      "layers",
      "outlineHex",
      "pageId",
      "paper",
      "view",
      "width",
    ]);
    expect(JSON.stringify(plan)).not.toContain("guide");
    // The paper's texture IS in the description: the one surface detail the file
    // carries, because it is the paper and not a guide.
    expect(plan.paper.pattern).toBe(true);
    expect(plan.paper).toHaveProperty("texture");
  });

  it("never becomes a command, a fill or a saved mark", () => {
    mount();
    const before = screen.getByTestId("canvas").getAttribute("data-drawing");
    openGuide();
    choose("Fina");
    choose("Pontilhado");
    choose("Grossa");
    fireEvent.click(screen.getByLabelText("Ativar grade"));
    // The whole session of the guide: the sheet is untouched (the canvas never
    // reports a stroke in progress) and the save dialog never opens.
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-drawing", before ?? "false");
    expect(screen.queryByRole("dialog", { name: /Guardar/ })).toBeNull();
  });
});
