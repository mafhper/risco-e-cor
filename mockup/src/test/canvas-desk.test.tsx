// Seam: PAPEL ≠ GRADE, measured on the canvas DOM.
//  - the desk has its own material (linho / grafite / quadriculado) and the
//    PAGE is always white paper, inset with a frame — never a dead "desk" that
//    shares the page's color;
//  - tap cycles the material, long press opens the quick sheet, and the COMPLETE
//    appearance lives in Preferences;
//  - the grid is its own control on the HUD (off / on / subtle) and a lattice in
//    the sheet's own SVG behind a prop the export never passes, so it can never
//    leak into the PNG.
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAPERS } from "@/mockup/palette";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { openTools } from "./open-panel";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
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

describe("paper material and grid are two different things", () => {
  it("starts on linho and puts the material on the desk, not on the page", () => {
    mount();
    const canvas = screen.getByTestId("canvas");
    expect(canvas).toHaveAttribute("data-paper", "linho");

    const sheet = screen.getByTestId("paper-view");
    expect(sheet).toHaveAttribute("data-paper-key", "linho");
    expect(sheet).toHaveAttribute("data-desk-color", PAPERS.linho.surface);
    // The material reaches the desk; the page itself is always white paper.
    const paper = screen.getByTestId("page-area").querySelector("svg rect");
    expect(paper?.getAttribute("fill")?.toLowerCase()).toBe("#ffffff");
    expect(sheet.getAttribute("style") ?? "").toContain("transform");
  });

  it("opens the paper's fold in two taps, where the material is chosen", () => {
    mount();
    // The paper has no door of its own since `chrome-v2` §12: it is a FOLD of the
    // sheet. The pill opens the bar, the bar's chevron opens the sheet, and the
    // fold is one more tap — the cost §12.3 accepted and recorded.
    openTools();
    const fold = screen.getByTestId("fold-papel");
    expect(fold).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(fold);
    expect(screen.getByTestId("fold-papel")).toHaveAttribute("aria-expanded", "true");
    // The canvas is untouched until a material is chosen.
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper", "linho");

    fireEvent.click(screen.getByRole("radio", { name: "Papel Quadriculado" }));
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper", "quadriculado");
    expect(screen.getByRole("radio", { name: "Papel Quadriculado" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Papel Linho" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("keeps the grid separate: its own fold, off → on → the three parameters", () => {
    mount();
    openTools();
    // Off, the fold is inert and the guide is not in the DOM: the way in is the
    // header's own switch, which also opens the disclosure.
    const fold = screen.getByTestId("fold-grade");
    expect(fold).toHaveAttribute("aria-expanded", "false");
    expect(fold).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByTestId("paper-grid")).toBeNull();

    fireEvent.click(screen.getByLabelText("Ativar grade"));
    expect(screen.getByTestId("fold-grade")).toHaveAttribute("aria-expanded", "true");
    const grid = screen.getByTestId("paper-grid");
    // The guide rides the SHEET's own user space (same viewBox, same origin):
    // it scales with the zoom instead of sitting on the screen in 24px steps.
    const sheet = screen.getByTestId("paper-view");
    expect(sheet.contains(grid)).toBe(true);
    expect(grid.closest("svg")).not.toBeNull();
    expect(grid.closest('[data-testid="page-area"]')).not.toBeNull();
    // A screen aid, never a surface: it takes no pointer and paints no paper.
    expect(grid.getAttribute("style")).toContain("pointer-events: none");

    // The three parameters of the fold are the grid's own: pattern, density and
    // strength — the density IS the cell, in artwork units.
    expect(screen.getByTestId("fold-grade-pattern")).toBeInTheDocument();
    expect(screen.getByTestId("fold-grade-density")).toBeInTheDocument();
    expect(screen.getByTestId("fold-grade-strength")).toBeInTheDocument();
    expect(grid).toHaveAttribute("data-grid-pattern", "quadrado");
    expect(grid).toHaveAttribute("data-grid-cell", "24");
    expect(grid).toHaveAttribute("data-grid-mode", "sutil");

    fireEvent.click(screen.getByRole("radio", { name: "Nítida" }));
    expect(screen.getByTestId("paper-grid")).toHaveAttribute("data-grid-mode", "nitida");
    fireEvent.click(screen.getByRole("radio", { name: "Pontilhado" }));
    expect(screen.getByTestId("paper-grid")).toHaveAttribute("data-grid-pattern", "pontilhado");
    fireEvent.click(screen.getByRole("radio", { name: "Grossa" }));
    expect(screen.getByTestId("paper-grid")).toHaveAttribute("data-grid-cell", "32");
    expect(screen.getByTestId("fold-grade-cell")).toHaveTextContent("célula 32 unidades");

    // The header's switch is the on/off: off, the guide leaves the DOM and the
    // fold refuses the chevron.
    const undoBefore = (screen.getByTestId("panel-undo") as HTMLButtonElement).disabled;
    fireEvent.click(screen.getByLabelText("Ativar grade"));
    expect(screen.queryByTestId("paper-grid")).toBeNull();
    expect(screen.getByTestId("fold-grade")).toHaveAttribute("aria-disabled", "true");
    // A working guide is never a command: the history is exactly what it was.
    expect((screen.getByTestId("panel-undo") as HTMLButtonElement).disabled).toBe(undoBefore);
  });

  it("keeps the kids canvas free of the paper tone but keeps the grid aid", () => {
    mount("theo", null);
    // The resting state draws no look controls at all: the folds live in the
    // sheet (`chrome-v2` §12), and the bands carry none of them.
    expect(screen.queryByTestId("fold-papel")).toBeNull();
    expect(screen.queryByTestId("dock-utilities")).toBeNull();
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper", "linho");
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper-tone", "claro");

    // The second level of the intermediate panel is where the two look folds
    // live on 3–5 — and it carries NO tone at all.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByTestId("compact-look"));
    expect(screen.getByTestId("kids-look")).toBeInTheDocument();
    // The Grade fold starts closed (and off): the glyph switch is what opens it.
    fireEvent.click(screen.getByTestId("kids-fold-grade-switch"));
    expect(screen.getByTestId("kids-grade-pattern")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("kids-fold-papel-head"));
    expect(screen.getByTestId("kids-papel-material")).toBeInTheDocument();
    expect(screen.queryByTestId("fold-papel-tone")).toBeNull();
    expect(screen.queryByLabelText("Tom")).toBeNull();
  });
});
