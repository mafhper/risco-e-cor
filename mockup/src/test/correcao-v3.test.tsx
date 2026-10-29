// Correção v3 — the owner's decisions, measured on the DOM the user meets.
//
// The seam is the screen, not the module:
//   1. no permanent save button; the dialog only exists when the piece is dirty;
//   2. zoom is a magnifier that opens − / ● / + with no number and no top badge;
//   3. paper material and grid are two separate controls;
//   4. one stroke panel: no "Mais" overlay, no techniques, no tools;
//   5. the color selector is a picker plus a derived palette (HSL first);
//   6. settings separate Ajustes from Conteúdo, and the full appearance is there.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { AdultScreen } from "@/mockup/screens/AdultScreen";
import { PaletteTray } from "@/mockup/screens/PaletteTray";
import { openFold } from "./open-panel";

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

function AdultHarness() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
  }, [dispatch]);
  return (
    <div>
      <span data-testid="paper-setting">{state.settings.paper}</span>
      <AdultScreen focus="global" back={{ name: "home" }} />
    </div>
  );
}

describe("D1 — saving is not a permanent canvas control", () => {
  it("renders no save button and asks nothing when the piece was not edited", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );

    expect(screen.queryByTestId("canvas-hud-save")).toBeNull();
    expect(screen.queryByLabelText("Guardar")).toBeNull();

    fireEvent.click(screen.getByTestId("chrome-back"));
    expect(screen.queryByText("Guardar desenho?")).toBeNull();
    expect(screen.queryByTestId("save-dialog")).toBeNull();
  });
});

describe("D2 — zoom is a gesture, never a row of the panel", () => {
  it("has no zoom control in the panel, and the readout only while pinching", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );

    const band = screen.getByTestId("canvas-top-band");
    expect(band.textContent).not.toMatch(/%/);
    // The paper's corners belong to the sheet in every resting state.
    expect(screen.queryByTestId("zoom-controls")).toBeNull();
    expect(screen.queryByTestId("zoom-hud")).toBeNull();

    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
    // The sheet has no zoom row any more: the gesture is the way.
    expect(screen.queryByTestId("zoom-controls")).toBeNull();
    expect(screen.queryByLabelText("Aumentar zoom")).toBeNull();
    expect(screen.queryByText("%")).toBeNull();
    expect(screen.getByTestId("canvas-top-band").textContent).not.toMatch(/%/);
    expect(screen.getByTestId("canvas-band").textContent).not.toMatch(/%/);
    expect(screen.getByTestId("canvas-title").textContent).toBe("Peixe");
  });
});

describe("D3 — paper appearance and grid do not share a control", () => {
  it("opens the paper's fold for the material and the grid's fold for the guide", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );

    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper", "linho");
    // Both are FOLDS of the sheet since `chrome-v2` §12 — one sheet, two folds,
    // and neither is a door on a band.
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    fireEvent.click(screen.getByTestId("fold-papel"));
    fireEvent.click(screen.getByRole("radio", { name: "Papel Grafite" }));
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper", "grafite");
    fireEvent.click(screen.getByRole("radio", { name: "Papel Quadriculado" }));
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper", "quadriculado");

    // The grid is a DIFFERENT fold, with its own switch, and it never touches the
    // paper's material.
    expect(screen.getByTestId("fold-grade")).toHaveAccessibleName(/Grade/);
    fireEvent.click(screen.getByLabelText("Ativar grade"));
    expect(screen.getByTestId("paper-grid")).toBeInTheDocument();
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper", "quadriculado");
  });
});

describe("D4 — one stroke panel, no second door", () => {
  it("has no 'Mais' overlay: opacity, gradient and effects live in the sheet", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );

    // The chrome no longer carries the "Mais ferramentas" chip (owner, 26/10),
    // and the overlay it opened is gone: the sheet is the one home.
    expect(screen.queryByLabelText("Mais ferramentas")).toBeNull();
    expect(screen.queryByTestId("more-panel")).toBeNull();

    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    const panel = screen.getByTestId("canvas-panel");
    // A material that paints, so the sheet shows what a stroke can carry.
    fireEvent.click(within(panel).getByLabelText("Pincel"));

    // Size lives in the toolbar, never in the sheet as its own control.
    // The parameters are inside Ajustes, which opens CLOSED since 27/10.
    openFold("fold-ajustes");
    expect(within(panel).queryByText("Tamanho do traço")).toBeNull();
    expect(within(panel).getByText("Opacidade")).toBeInTheDocument();
    expect(within(panel).getByText("Gradiente")).toBeInTheDocument();
    // Sombra and brilho are their own folds of this same sheet, and there is no
    // second "Efeitos" section anywhere (one owner per effect).
    expect(within(panel).queryByText("Efeitos")).toBeNull();
    expect(within(panel).queryByLabelText("Sombra suave")).toBeNull();

    expect(within(panel).queryByText(/Técnicas|Pontilhismo/)).toBeNull();
    expect(within(panel).queryByLabelText("Conta-gotas")).toBeNull();
    expect(within(panel).queryByLabelText(/^Forma /)).toBeNull();
  });
});

describe("D5/D6 — picker first, derived palette under it, HSL first", () => {
  const mountTray = (kids = false) =>
    render(
      <PaletteTray
        kids={kids}
        simple={false}
        color="#F72633"
        kidFamily={0}
        onKidFamily={() => {}}
        recent={[]}
        favorites={[]}
        onPick={() => {}}
        onToggleFavorite={() => {}}
      />,
    );

  it("shows the field and the hue bar before a separate variations block", () => {
    mountTray();
    const palette = screen.getByTestId("pro-palette");
    const picker = within(palette).getByTestId("hsl-picker");
    const variations = within(palette).getByTestId("color-variations");

    expect(within(picker).getByTestId("color-field")).toBeInTheDocument();
    expect(within(picker).getByLabelText("Matiz")).toBeInTheDocument();
    expect(picker.compareDocumentPosition(variations) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );

    const tones = within(variations).getAllByRole("radio");
    expect(tones).toHaveLength(11);
    // #F72633 is not one of its own derived tones: nothing is marked. A ring on
    // the first tone would be a selection the user never made.
    expect(tones.filter((tone) => tone.getAttribute("aria-checked") === "true")).toHaveLength(0);
    expect(tones.some((tone) => tone.getAttribute("data-hex") === "#F72633")).toBe(false);
    expect(tones[0]!.getAttribute("data-hex")).not.toBe(tones.at(-1)!.getAttribute("data-hex"));

    expect(within(picker).getByTestId("hsl-readout").textContent).toMatch(/^HSL /);
    expect(within(picker).getByLabelText("HEX (secundário)")).toBeInTheDocument();
  });

  it("gives 3–5 two steps instead of a picker: family, then its ramp", () => {
    mountTray(true);
    const palette = screen.getByTestId("kids-palette");
    expect(palette.textContent?.trim() ?? "").toBe("");

    // Owner's call (24/10): the spectrum is gone from the expanded sheet — the
    // family row plus the ramp already reach every colour.
    expect(within(palette).queryByTestId("hsl-picker")).toBeNull();
    expect(within(palette).queryByTestId("color-field")).toBeNull();

    const tones = within(within(palette).getByTestId("kids-tone-row")).getAllByRole("radio");
    expect(tones).toHaveLength(11);
    for (const tone of tones) expect(tone).toHaveClass("h-12", "w-12");
    expect(within(palette).getByTestId("kids-neutral-row")).toBeInTheDocument();
  });
});

describe("D8 — settings separate Ajustes from Conteúdo", () => {
  it("has two tabs, and the complete paper appearance lives in Ajustes", () => {
    render(
      <StoreProvider>
        <AdultHarness />
      </StoreProvider>,
    );

    const settingsTab = screen.getByRole("tab", { name: "Ajustes" });
    const contentTab = screen.getByRole("tab", { name: "Conteúdo" });
    expect(settingsTab).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: /^Aparência/ }));
    expect(screen.getByTestId("settings-paper-linho")).toHaveAttribute("data-selected", "true");
    fireEvent.click(screen.getByTestId("settings-paper-grafite"));
    expect(screen.getByTestId("paper-setting").textContent).toBe("grafite");

    fireEvent.click(contentTab);
    expect(contentTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("content-tab")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filtrar por status" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filtrar por perfil" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exportar backup/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importar backup/ })).toBeInTheDocument();
    // Accordions do not leak into the Content tab.
    expect(screen.queryByTestId("acc-perfis")).toBeNull();
  });

  it("filters the library by status and shows the actions of the visible pieces", () => {
    render(
      <StoreProvider>
        <AdultHarness />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Conteúdo" }));

    const byStatus = screen.getByRole("group", { name: "Filtrar por status" });
    fireEvent.click(within(byStatus).getByRole("button", { name: "Mural" }));
    expect(screen.getAllByText("no mural").length).toBe(2);
    fireEvent.click(screen.getByLabelText("Tirar do mural o desenho de Theo"));
    expect(screen.getAllByText("no mural").length).toBe(1);
  });
});
