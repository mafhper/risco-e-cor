// P1 — the remaining chrome seams, measured in the DOM:
//
//   paper panel: side panel (90%, sheet radius) with selection by edge bar
//   color:       the current-color band on top; kids get the 6×56dp grid, no text
//   gallery:     card -> canvas with the shared-element handoff, then pill + scrim
//   adult:       the three toolbar positions, with the kids rail locked
//   destructive: red, with the shell's 5s undo (no modal)
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openFold, openTools } from "./open-panel";
import { AppShell } from "@/mockup/AppShell";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { ProfileRules } from "@/mockup/screens/AdultScreen";
import { takeOpenRect } from "@/mockup/sharedOpen";
import { StoreProvider, useStore } from "@/mockup/store";

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

describe("the paper's look: a fold of the sheet, with no door of its own", () => {
  /** The paper is a FOLD of the sheet since 27/10 (`chrome-v2` §12.3). */
  const openPaper = () => {
    openTools();
    fireEvent.click(screen.getByTestId("fold-papel"));
    return screen.getByTestId("fold-papel");
  };

  it("opens the fold inside the sheet, and no band carries it", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );
    const fold = openPaper();
    expect(fold).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("canvas-panel").contains(fold)).toBe(true);
    // The two bands carry the selector and the way out, never a look control.
    expect(screen.getByTestId("canvas-top-band").contains(fold)).toBe(false);
    expect(screen.getByTestId("canvas-band").contains(fold)).toBe(false);
    expect(screen.queryByTestId("desk-sheet")).toBeNull();
  });

  it("offers the three materials, the three textures and the three tones", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );
    openPaper();

    // Material — the three stocks, never a fourth.
    const material = screen.getByTestId("fold-papel-material");
    expect(within(material).getAllByRole("radio")).toHaveLength(3);
    expect(within(material).getByRole("radio", { name: "Papel Linho" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // Texture — the sheet's grain.
    expect(within(screen.getByTestId("fold-papel-texture")).getAllByRole("radio")).toHaveLength(3);
    // Tone — the stock's near-white; 9+ gets all three.
    expect(within(screen.getByTestId("fold-papel-tone")).getAllByRole("radio")).toHaveLength(3);

    fireEvent.click(screen.getByRole("radio", { name: "Papel Grafite" }));
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper", "grafite");
    expect(screen.getByRole("radio", { name: "Papel Grafite" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Papel Linho" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    fireEvent.click(screen.getByRole("radio", { name: "Areia" }));
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper-tone", "areia");
    fireEvent.click(screen.getByRole("radio", { name: "Acentuada" }));
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-paper-texture", "acentuada");
  });
});

describe("color: the active swatch is the whole indicator", () => {
  it("shows the kids grid with no band, text, hex or slider", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="theo" pageId="foguete" />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    // The elongated band is gone: the circled swatch is the only indicator.
    expect(within(compact).queryByTestId("color-band")).toBeNull();
    expect(compact.textContent?.trim() ?? "").toBe("");

    const grid = within(compact).getByRole("radiogroup", { name: "Tons da cor" });
    const dots = within(grid).getAllByRole("radio");
    // Compact kids wears the same twelve cells as 9+ (owner's decision, 27/10):
    // 6 + 6, white first, black last, 44dp — no label band, because a step
    // number is text. The old 3 × 3 of nine and its loose neutrals are gone.
    expect(dots).toHaveLength(12);
    expect(grid.getAttribute("data-width")).toBe("304");
    expect(grid.getAttribute("data-label-band")).toBe("0");
    expect(dots[0]!.getAttribute("data-hex")).toBe("#FFFFFF");
    expect(dots.at(-1)!.getAttribute("data-hex")).toBe("#000000");
    expect(
      dots.filter((d) => d.getAttribute("aria-checked") === "true").length,
    ).toBeLessThanOrEqual(1);
    for (const dot of dots) {
      expect(dot).toHaveClass("rounded-[12px]");
      expect(dot.style.width).toBe("44px");
    }
    // A child never meets a number: no hex input, no HSL readout, no words. The
    // colour is chosen on the horizontal strip and the rungs.
    expect(within(compact).queryByLabelText("Cor em HEX")).toBeNull();
    expect(within(compact).queryByLabelText("HEX (secundário)")).toBeNull();
    expect(within(compact).getByTestId("compact-spectrum")).toBeInTheDocument();
    expect(within(compact).queryByTestId("hsl-readout")).toBeNull();
    expect(within(compact).queryByTestId("color-field")).toBeNull();
    expect(within(compact).queryByTestId("compact-rung-steps")).toBeNull();
  });

  it("opens the pro palette with the picker, the derived variations and HSL first", () => {
    render(
      <StoreProvider>
        <CanvasHarness profileId="maria" pageId="peixe" />
      </StoreProvider>,
    );
    // Two steps now: pill -> compact -> full sheet (owner's rule, 24/10).
    openTools();
    openFold("fold-cor");
    const palette = screen.getByTestId("pro-palette");

    // The picker replaces the old flat band: a field plus a hue bar.
    expect(within(palette).getByTestId("color-field")).toBeInTheDocument();
    expect(within(palette).getByLabelText("Matiz")).toBeInTheDocument();
    expect(within(palette).getByTestId("hsl-picker")).toBeInTheDocument();
    expect(within(palette).getByLabelText("HEX (secundário)")).toBeInTheDocument();
    expect(within(palette).getByTestId("hsl-readout").textContent).toMatch(/^HSL /);

    // The variations are a separate block, under the picker.
    const picker = within(palette).getByTestId("hsl-picker");
    const variations = within(palette).getByTestId("color-variations");
    expect(picker.compareDocumentPosition(variations) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    const toneDots = within(variations).getAllByRole("radio");
    expect(toneDots).toHaveLength(11);
    // The active colour is not one of its own derived tones, so no variation may
    // look chosen: the old first-swatch ring was a selection nobody made.
    const activeColor = within(palette).getByTestId("color-chip").getAttribute("data-hex")!;
    expect(toneDots.filter((dot) => dot.getAttribute("aria-checked") === "true")).toHaveLength(0);
    expect(
      toneDots.some(
        (dot) => dot.getAttribute("data-hex")?.toUpperCase() === activeColor.toUpperCase(),
      ),
    ).toBe(false);

    // No swatch carries a color name.
    expect(palette.textContent).not.toMatch(/vermelho|amarelo|âmbar/i);
  });
});

describe("gallery -> canvas", () => {
  it("grows from the card (shared handoff) and leaves with pill + scrim", async () => {
    function Harness() {
      const { state, dispatch } = useStore();
      useEffect(() => {
        dispatch({ type: "selectProfile", id: "maria" });
        dispatch({ type: "go", screen: { name: "gallery", back: { name: "profile" } } });
      }, [dispatch]);
      return (
        <>
          <span data-testid="screen">{state.screen.name}</span>
          <AppShell />
        </>
      );
    }

    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );

    const card = screen.getByRole("listitem", { name: /^Abrir / });
    // jsdom has no layout: hand the gallery a real rect to stash.
    card.getBoundingClientRect = () =>
      ({ x: 24, y: 180, width: 150, height: 190, top: 180, left: 24 }) as DOMRect;
    fireEvent.click(card);

    expect(screen.getByTestId("screen").textContent).toBe("canvas");
    // The handoff was consumed once and the canvas knows where it came from.
    expect(takeOpenRect()).toBeNull();
    expect(screen.getByTestId("canvas")).toHaveAttribute("data-shared-from", "24,180,150,190");

    fireEvent.click(within(screen.getByTestId("canvas")).getByTestId("chrome-back"));
    expect(screen.getByTestId("save-pill")).toBeInTheDocument();
    expect(screen.getByTestId("save-scrim")).toBeInTheDocument();
    expect(screen.getByTestId("screen").textContent).toBe("canvas");

    await waitFor(() => expect(screen.getByTestId("screen").textContent).toBe("gallery"), {
      timeout: 2000,
    });
  });
});

describe("no toolbar position setting: the bar is always at the bottom", () => {
  function RulesHarness({ id }: { id: string }) {
    const { state, dispatch } = useStore();
    useEffect(() => {
      dispatch({ type: "selectProfile", id });
    }, [dispatch, id]);
    const p = state.profiles.find((x) => x.id === id);
    return p ? <ProfileRules p={p} /> : null;
  }

  it("offers no position rows to a pro profile", () => {
    render(
      <StoreProvider>
        <RulesHarness id="maria" />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("toolbar-position")).toBeNull();
    expect(screen.queryByTestId("toolbar-pos-left")).toBeNull();
    expect(screen.queryByTestId("toolbar-pos-right")).toBeNull();
    expect(screen.queryByTestId("toolbar-pos-bottom")).toBeNull();
  });

  it("offers no position rows to a child either", () => {
    render(
      <StoreProvider>
        <RulesHarness id="theo" />
      </StoreProvider>,
    );
    expect(screen.queryByTestId("toolbar-position")).toBeNull();
    expect(screen.queryByTestId("toolbar-pos-left")).toBeNull();
    expect(screen.queryByTestId("toolbar-pos-right")).toBeNull();
  });
});

describe("destructive is red and temporal", () => {
  it("paints 'Jogar fora' with the destructive token and leaves the shell's undo", () => {
    function Harness() {
      const { state, dispatch } = useStore();
      const draft = state.artworks.find((a) => a.profileId === "theo" && a.pageId === null);
      useEffect(() => {
        dispatch({ type: "selectProfile", id: "theo" });
        if (draft)
          dispatch({
            type: "go",
            screen: { name: "view", artworkId: draft.id, back: { name: "profile" } },
          });
      }, [dispatch, draft]);
      return <AppShell />;
    }

    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );

    const discard = screen.getByLabelText("Jogar fora");
    expect(discard).toHaveClass("bg-destructive", "text-destructive-foreground");
    expect(discard.className).not.toContain("bg-foreground");

    fireEvent.click(discard);
    expect(screen.getByTestId("undo-bar")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});
