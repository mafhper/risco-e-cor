// The dock's THREE states (painel-intermediario-kids §2/§3). The seam is the
// state machine the user sees, not the components:
//
//   pill --material/color--> compact --^--> expanded --Feito/v/Esc--> compact --v/Esc--> pill
//   any state --first touch on the paper--> pill (and the stroke already started)
//   one stroke ends --> still the pill (nothing reopens by itself)
//
// Plus the 3-5 rule that makes the bar usable without reading: the compact bar
// contains no functional text at all (3-5 has no sheet — spec 26/10).
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openFold, openTools } from "./open-panel";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { PALETTE_MIN, COMPACT_LIGHTNESS, WHITE, derivedRamp } from "@/mockup/palette";

/**
 * The compact row, re-decided by the owner on 27/10 (order decision, with a
 * capture): TWELVE cells in 6 + 6 — white, the ten published steps 50…950 of the
 * family in hand, black. The catalogue keeps its own eleven steps
 * (`PALETTE_MIN.stepsPerFamily`); the two neutrals are the ends of this row.
 */
const COMPACT_TONES = 12;

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function CanvasHarness({
  profileId,
  pageId,
  countStrokes = false,
}: {
  profileId: string;
  pageId: string | null;
  /** Exposes how many commands the piece carries, to prove the touch painted. */
  countStrokes?: boolean;
}) {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return (
    <>
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
      {countStrokes && <span data-testid="commands">{art.history.commands.length}</span>}
    </>
  );
}

function mount(profileId = "maria", pageId: string | null = "peixe", countStrokes = false) {
  return render(
    <StoreProvider>
      <CanvasHarness profileId={profileId} pageId={pageId} countStrokes={countStrokes} />
    </StoreProvider>,
  );
}

const openCompactFromTool = () =>
  fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
const openCompact = () => fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
const openPanel = () => openTools();
const paper = () => screen.getByTestId("paper-view").querySelector("svg")!;

describe("the resting dock is one mini pill with three material doors", () => {
  it("shows the three doors and the way to the bar, and keeps every panel closed", () => {
    mount();

    const pill = screen.getByTestId("canvas-dock");
    expect(pill).toHaveAttribute("data-mini", "true");
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();

    // The pill is the whole dormant dock: no shelf and no palette inside it.
    expect(within(pill).queryByTestId("tool-shelf")).toBeNull();
    expect(within(pill).queryByTestId("simple-palette")).toBeNull();

    // Owner's call (26/10): eraser, the material in hand and the colour in
    // hand, plus the one door that opens the compact bar.
    expect(within(pill).getByLabelText("Borracha")).toBeInTheDocument();
    expect(within(pill).getByLabelText("Pintar")).toBeInTheDocument();
    expect(within(pill).getByLabelText("Cor atual")).toBeInTheDocument();
    expect(within(pill).getByLabelText("Abrir barra de ferramentas")).toBeInTheDocument();
    expect(pill.querySelectorAll("button")).toHaveLength(4);
  });

  it("uses the material on a tap and opens the mini-pop only after a 500 ms hold", async () => {
    mount("maria", "peixe");
    const tool = within(screen.getByTestId("canvas-dock")).getByLabelText("Pintar");

    // Tap = use directly: no pop, no panel; the tool is in the hand.
    fireEvent.click(tool);
    expect(screen.queryByTestId("mini-pop")).toBeNull();
    expect(screen.getByTestId("mini-tool")).toHaveAttribute("data-tool", "fill");

    // Hold = that door's mini-pop, anchored on the pill.
    fireEvent.pointerDown(tool);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 520));
    });
    expect(screen.getByTestId("mini-pop-material")).toBeInTheDocument();

    // The release after a completed hold does not also use the door.
    fireEvent.click(tool);
    expect(screen.getByTestId("mini-pop-material")).toBeInTheDocument();

    // Choosing inside applies on the spot and closes back to the pill.
    fireEvent.click(screen.getByLabelText("Pincel"));
    expect(screen.queryByTestId("mini-pop")).toBeNull();
    expect(screen.getByTestId("mini-tool")).toHaveAttribute("data-tool", "brush");
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
  });

  it("opens the compact bar from its own chevron", () => {
    mount();
    openCompactFromTool();
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.queryByTestId("canvas-dock")).toBeNull();

    fireEvent.click(screen.getByTestId("dock-scrim"));
    openCompact();
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
  });

  it("opens the full sheet only from the chevron", () => {
    mount();
    openPanel();
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
    expect(screen.queryByTestId("canvas-dock")).toBeNull();
  });

  it("carries the active material and the active color", () => {
    mount();
    openCompactFromTool();
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    fireEvent.click(screen.getByLabelText("Aquarela"));
    // The 18 families are always on screen as colors — inside the Cor fold,
    // which opens CLOSED since 27/10 (owner's decision).
    openFold("fold-cor");
    fireEvent.click(screen.getAllByTestId("palette-family")[0]!);
    const tones = screen.getByRole("radiogroup", { name: "Variações da cor" });
    const step = within(tones).getAllByRole("radio")[7]!;
    const hex = step.getAttribute("data-hex")!;
    fireEvent.click(step);

    fireEvent.click(screen.getByLabelText("Feito"));
    fireEvent.click(screen.getByTestId("dock-scrim"));

    // The pill wears the SAME object as the chips and the shelf (owner's call,
    // 26/10): one material, one face. The stroke preview lives in the sheet's
    // full-width line, where it has room to be read as a stroke.
    const toolTarget = screen.getByTestId("mini-tool");
    expect(toolTarget).toHaveAttribute("data-tool", "watercolor");
    const glyph = toolTarget.querySelector("svg[data-brush='watercolor']")!;
    expect(glyph).not.toBeNull();
    expect(glyph.querySelector('[data-layer="accent"]')).not.toBeNull();
    expect(screen.getByTestId("canvas-dock")).toHaveAttribute("data-color", hex.toUpperCase());
  });

  it("shows the bucket on a coloring page, where painting comes first", () => {
    mount("maria", "peixe");
    const toolTarget = screen.getByTestId("mini-tool");
    expect(toolTarget).toHaveAttribute("data-tool", "fill");
    expect(toolTarget).toHaveAttribute("title", "Pintar");
    expect(toolTarget).toHaveAccessibleName("Pintar");
  });
});

describe("compact: fixed rows for thickness, tools and color", () => {
  it("has a 1..100 thickness capsule, icon-only tools and the derived tones", () => {
    mount();
    // The bucket has no parameters: the square sample used to appear and
    // disappear with the tool, moving every row below it. It is gone.
    openCompactFromTool();
    const compact = screen.getByTestId("canvas-compact");
    expect(within(compact).queryByTestId("param-preview")).toBeNull();

    // A brush changes nothing: same row, same place.
    fireEvent.click(within(compact).getByLabelText("Lápis"));
    expect(within(compact).queryByTestId("param-preview")).toBeNull();
    expect(within(compact).queryByTestId("pro-palette")).toBeNull();
    expect(within(compact).queryByTestId("simple-palette")).toBeNull();
    // The bar is the SIMPLE colour area (owner's call, 27/10): the spectrum
    // strip and the eleven rungs. The tabs and the sheet's palette are not here.
    expect(within(compact).queryByRole("tablist")).toBeNull();
    expect(within(compact).getByTestId("compact-spectrum")).toBeInTheDocument();
    expect(within(compact).queryByTestId("tool-shelf")).toBeNull();

    // Row 1: ONE capsule, 1..100, minus and plus at the ends. The value is the
    // pen's, not the material's — every brush reads the same number.
    const slider = () =>
      within(compact).getByTestId("compact-thickness-slider") as HTMLInputElement;
    expect(slider()).toHaveAttribute("type", "range");
    expect(slider()).toHaveAttribute("min", "1");
    expect(slider()).toHaveAttribute("max", "100");
    expect(within(compact).getByLabelText("Menos espessura")).toHaveClass("h-10", "w-10");
    expect(within(compact).getByLabelText("Mais espessura")).toHaveClass("h-10", "w-10");

    const start = Number(slider().value);
    fireEvent.click(within(compact).getByLabelText("Mais espessura"));
    expect(Number(slider().value)).toBe(start + 1);
    fireEvent.click(within(compact).getByLabelText("Menos espessura"));
    expect(Number(slider().value)).toBe(start);

    // The ends clamp and disable: neither button ever leaves the row.
    fireEvent.change(slider(), { target: { value: "1" } });
    expect(within(compact).getByLabelText("Menos espessura")).toBeDisabled();
    expect(within(compact).getByLabelText("Mais espessura")).toBeEnabled();
    fireEvent.change(slider(), { target: { value: "100" } });
    expect(within(compact).getByLabelText("Mais espessura")).toBeDisabled();
    expect(within(compact).getByLabelText("Menos espessura")).toBeEnabled();

    // The value is ONE number per person, outside the per-material memory
    // (owner's decision, 26/10, §11.3): a material that arrives INHERITS the
    // point in use, and coming back never restores a per-material number.
    fireEvent.change(slider(), { target: { value: "42" } });
    fireEvent.click(within(compact).getByLabelText("Marcador"));
    expect(Number(slider().value)).toBe(42);
    expect(within(compact).getByTestId("compact-thickness")).toHaveAttribute("data-size", "42");
    fireEvent.click(within(compact).getByLabelText("Lápis"));
    expect(Number(slider().value)).toBe(42);
    expect(within(compact).getByTestId("compact-thickness")).toHaveAttribute("data-size", "42");

    // Pro colour area, re-decided 27/10: the carousel (strip · HSL field · HEX)
    // at full width, and under it the twelve-cell ladder in 6 + 6 — white, the
    // ten rungs 50…950, black — each step labelled INSIDE its own cell. The
    // separate label row, the neutral pair beside the strip, the HSL readout, the
    // vertical hue bar, the tabs and the catalogue left this surface.
    const track = within(compact).getByRole("slider", { name: "Espectro de cores" });
    expect(track).toHaveClass("h-6", "w-full");
    expect(within(compact).queryByTestId("color-field")).toBeNull();
    expect(within(compact).queryByTestId("hsl-readout")).toBeNull();
    expect(within(compact).queryByTestId("compact-rung-steps")).toBeNull();

    const colors = within(compact).getByRole("radiogroup", { name: "Tons da cor" });
    const dots = within(colors).getAllByRole("radio");
    expect(dots).toHaveLength(COMPACT_TONES);
    expect(colors.getAttribute("data-columns")).toBe("6");
    expect(colors.getAttribute("data-rows")).toBe("2");
    for (const dot of dots) expect(dot).toHaveClass("rounded-[12px]");
    // Each step rides its own cell: the label cannot be read against the row below.
    expect(within(dots.at(-2)!).getByText("950")).toBeInTheDocument();
    // White opens the row and black closes it — the pair beside the strip is gone.
    expect(dots[0]).toHaveAttribute("data-hex", "#FFFFFF");
    expect(dots.at(-1)).toHaveAttribute("data-hex", "#000000");
    expect(within(compact).queryByTestId("compact-neutrals")).toBeNull();

    expect(within(compact).queryByText("Favoritas")).toBeNull();
  });

  it("keeps the color row still: one carousel, and an anchored tone ramp", () => {
    mount();
    openCompact();
    const compact = screen.getByTestId("canvas-compact");

    // The first piece is the colour carousel — the same row order the decision
    // fixed, and no picker around it.
    const area = within(compact).getByTestId("compact-color");
    expect(area.firstElementChild).toContainElement(
      within(compact).getByTestId("compact-carousel"),
    );
    expect(within(compact).queryByTestId("hsl-picker")).toBeNull();

    const tiles = () => within(screen.getByTestId("compact-colors")).getAllByRole("radio");
    const before = tiles().map((t) => t.getAttribute("data-hex"));
    // The catalogue colour sits between two rungs: no tone may look chosen.
    expect(tiles().filter((t) => t.getAttribute("aria-checked") === "true")).toHaveLength(0);
    for (const tile of tiles()) expect(tile).toHaveClass("rounded-[12px]", "border");

    const picked = tiles()[3]!;
    const hex = picked.getAttribute("data-hex")!;
    fireEvent.click(picked);

    // Same tiles, same order: the ramp is anchored, so a tap selects instead
    // of re-deriving every tile out from under the finger.
    const after = tiles();
    expect(after.map((t) => t.getAttribute("data-hex"))).toEqual(before);
    expect(after.filter((t) => t.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(after[3]).toHaveAttribute("aria-checked", "true");
    expect(after[3]).toHaveAttribute("data-hex", hex);
    for (const tile of after) expect(tile).toHaveClass("rounded-[12px]", "border");

    // The row did not grow a third channel: same carousel, same anchors.
    expect(area.firstElementChild).toContainElement(
      within(compact).getByTestId("compact-spectrum"),
    );
  });

  it("gives the strip the hue and the tones their own rows", () => {
    mount();
    openCompact();
    const compact = screen.getByTestId("canvas-compact");
    const rail = within(compact).getByTestId("compact-colors");
    const dots = within(rail).getAllByRole("radio");
    expect(dots).toHaveLength(COMPACT_TONES);
    expect(new Set(dots.map((d) => d.getAttribute("data-hex"))).size).toBe(COMPACT_TONES);

    // The colors are not inside the tool scroller that used to push them off-screen.
    const tools = within(compact).getByTestId("compact-tools");
    expect(tools.contains(rail)).toBe(false);
    expect(tools.querySelector("[data-hex]")).toBeNull();

    // One expand target, and it is the drawer's own LATCH — glued to the bar's
    // top edge (owner's report, 27/10): never a chevron buried in the colour
    // area, and never a second control inside the bar's rows.
    expect(screen.getAllByLabelText("Abrir painel de ferramentas")).toHaveLength(1);
    const latch = screen.getByLabelText("Abrir painel de ferramentas");
    expect(latch.parentElement).toBe(compact);
    expect(within(compact).getByTestId("compact-color").contains(latch)).toBe(false);
    const strip = within(compact).getByRole("slider", { name: "Espectro de cores" });
    const hueBefore = Number(strip.getAttribute("aria-valuenow"));
    fireEvent.keyDown(strip, { key: "ArrowRight" });
    expect(
      Number(
        within(compact)
          .getByRole("slider", { name: "Espectro de cores" })
          .getAttribute("aria-valuenow"),
      ),
    ).not.toBe(hueBefore);

    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
    openFold("fold-cor");
    expect(screen.getByTestId("pro-palette")).toBeInTheDocument();
  });

  it("derives the compact tones from the color in hand, never from recents", () => {
    mount();
    openCompact();
    const labels = within(screen.getByTestId("compact-colors"))
      .getAllByRole("radio")
      .map((d) => d.getAttribute("data-hex"));
    fireEvent.click(screen.getByTestId("dock-scrim"));
    const color = screen.getByTestId("canvas-dock").getAttribute("data-color")!;
    // White, the ten rungs of the colour in hand, black — and nothing else: the
    // ramp still comes from the colour in hand, never from a recents list.
    expect(labels).toEqual([WHITE.hex, ...derivedRamp(color, COMPACT_LIGHTNESS), "#000000"]);
  });

  it("closes on twelve cells: 6 + 6, opening on white and closing on black", () => {
    mount();
    openCompact();
    const grid = screen.getByTestId("compact-colors");
    const tiles = within(grid).getAllByRole("radio");

    expect(tiles).toHaveLength(COMPACT_TONES);
    expect(grid.children).toHaveLength(COMPACT_TONES);
    expect(COMPACT_TONES).toBe(12);
    // 6 + 6: two whole rows, no spacer and no empty cell.
    expect(2 * 6).toBe(COMPACT_TONES);
    expect(tiles[0]!.getAttribute("data-hex")).toBe(WHITE.hex);
    expect(tiles.at(-1)!.getAttribute("data-hex")).toBe("#000000");
    for (const tile of tiles) {
      expect(tile.tagName).toBe("BUTTON");
      // Every cell carries a colour: none of the twelve is a hole.
      expect(tile.querySelector("[data-swatch]")).not.toBeNull();
    }
  });

  it("shrinks to the pill with the scrim", () => {
    mount();
    openCompactFromTool();
    fireEvent.click(screen.getByTestId("dock-scrim"));
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
  });
});

describe("the sheet collapses in two steps", () => {
  it("Feito goes to the compact bar, not to the pill", () => {
    mount();
    openPanel();
    fireEvent.click(screen.getByLabelText("Feito"));
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-dock")).toBeNull();

    fireEvent.click(screen.getByTestId("dock-scrim"));
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
  });

  it("the scrim goes straight to the pill, never to the compact bar", () => {
    mount();
    openPanel();
    fireEvent.click(screen.getByTestId("dock-scrim"));
    // Owner's rule (25/10): one tap on the paper never leaves the toolbar
    // half-open — the full sheet goes to the PILL, not to the compact bar.
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
  });

  it("Escape still steps down one state", () => {
    mount();
    openPanel();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
  });
});

describe("a stroke owns the paper", () => {
  it("skips the compact bar when ink starts on the expanded sheet", () => {
    mount("maria", "peixe", true);
    const before = Number(screen.getByTestId("commands").textContent);
    openPanel();
    // A stroke tool: the bucket fills on tap and never enters the drawing state.
    fireEvent.click(screen.getByLabelText("Pincel"));
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();

    fireEvent.pointerDown(paper(), { pointerId: 1, clientX: 40, clientY: 60 });
    // Drawing always leaves the sheet in one step, and the same touch paints.
    // P1: the bar is gone for the duration of the stroke (it returns on up).
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
    expect(screen.queryByTestId("canvas-dock")).toBeNull();

    fireEvent.pointerUp(paper(), { pointerId: 1, clientX: 80, clientY: 90 });
    expect(screen.getByTestId("canvas-dock")).toHaveAttribute("data-mini", "true");
    expect(Number(screen.getByTestId("commands").textContent)).toBe(before + 1);
  });

  it("collapses the compact bar on the first touch and stays in the pill", () => {
    mount("theo", null, true);
    const before = Number(screen.getByTestId("commands").textContent);
    openCompact();
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();

    fireEvent.pointerDown(paper(), { pointerId: 1, clientX: 40, clientY: 60 });
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
    expect(screen.queryByTestId("canvas-dock")).toBeNull();

    fireEvent.pointerUp(paper(), { pointerId: 1, clientX: 80, clientY: 90 });
    expect(Number(screen.getByTestId("commands").textContent)).toBe(before + 1);
    expect(screen.getByTestId("canvas-dock")).toHaveAttribute("data-mini", "true");
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
  });
});

describe("expanded sheet", () => {
  it("keeps the whole pro spectrum reachable: 18 families x 11 steps + neutrals", () => {
    mount();
    openPanel();
    openFold("fold-cor");
    const palette = screen.getByTestId("pro-palette");

    const families = within(palette).getAllByTestId("palette-family");
    expect(families).toHaveLength(PALETTE_MIN.families);

    const steps = within(palette).getByRole("radiogroup", { name: "Variações da cor" });
    expect(within(steps).getAllByRole("radio")).toHaveLength(PALETTE_MIN.stepsPerFamily);

    const neutrals = within(palette).getByRole("radiogroup", { name: "Neutros" });
    const neutralDots = within(neutrals).getAllByRole("radio");
    expect(neutralDots.length).toBeGreaterThanOrEqual(5);
    for (const dot of neutralDots) expect(dot).toHaveAttribute("data-hex");

    // 18 chips x 11 steps + preto/branco = the 200-swatch catalog.
    expect(PALETTE_MIN.families * PALETTE_MIN.stepsPerFamily + 2).toBe(PALETTE_MIN.swatches);
  });

  it("shows the parameters of the active material, not a generic list", () => {
    mount();

    // Brush: size + opacity, no water, no hardness.
    openPanel();
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Pincel"));
    expect(screen.getByLabelText("Tamanho")).toBeInTheDocument();
    expect(screen.getByLabelText("Opacidade")).toBeInTheDocument();
    expect(screen.queryByLabelText("Água")).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Dureza" })).toBeNull();

    // Watercolor adds water.
    fireEvent.click(screen.getByLabelText("Aquarela"));
    expect(screen.getByLabelText("Água")).toBeInTheDocument();

    // Pencil adds hardness (H-B) and drops water.
    fireEvent.click(screen.getByLabelText("Lápis"));
    expect(screen.getByRole("radiogroup", { name: "Dureza" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Água")).toBeNull();

    // Eraser: only the size — one 1..100 slider, the same control the brushes
    // read (owner's call, 26/10: P/M/G is gone), and never a mode.
    fireEvent.click(screen.getByLabelText("Borracha"));
    expect(screen.getByLabelText("Tamanho")).toBeInTheDocument();
    expect(screen.queryByTestId("panel-eraser-sizes")).toBeNull();
    expect(screen.queryByLabelText("Borracha média")).toBeNull();
    expect(screen.queryByLabelText("Opacidade")).toBeNull();
  });

  it("gives the bucket a sheet with no text of its own and no sliders", () => {
    mount();
    openPanel();
    // Owner's call (26/10): the bucket's expanded sheet carried three pieces of
    // text — the name, a `px · %` readout of numbers that change nothing, and a
    // sentence explaining a single tap. The tool has no parameter, so it has no
    // copy: the ring on the shelf chip and the full-width line already say
    // which tool is in hand and what it will pour.
    const panel = screen.getByTestId("canvas-panel");
    expect(within(panel).queryByText("Balde de tinta")).toBeNull();
    expect(within(panel).queryByText(/px/)).toBeNull();
    expect(screen.queryByText(/Toque numa área do contorno/)).toBeNull();
    expect(screen.queryByLabelText("Tamanho")).toBeNull();
    expect(screen.queryByLabelText("Opacidade")).toBeNull();
    // The line is still there — the preview did not leave with the text.
    expect(within(panel).getByTestId("param-preview")).toBeInTheDocument();
  });

  it("previews the stroke as a full-width line BELOW the title, never a circle", () => {
    mount();
    openPanel();
    fireEvent.click(screen.getByLabelText("Pincel"));

    const panel = screen.getByTestId("canvas-panel");
    const preview = within(panel).getByTestId("param-preview");
    // A line that takes the whole sheet width, its own row under the title —
    // neither the old 44dp circular well nor a sample squeezed beside the name
    // (owner's call, 26/10).
    expect(preview).toHaveClass("w-full");
    expect(preview).not.toHaveClass("flex-1");
    expect(preview.className).not.toMatch(/rounded-full|w-11|bg-linho/);
    // The line is the paper's own raster sample, in the sheet's tall box
    // (owner's call, 26/10): a canvas the width of the row, never a vector path.
    const canvas = preview.querySelector("canvas")!;
    expect(canvas).not.toBeNull();
    expect(preview.querySelector("path")).toBeNull();
    expect(preview.getAttribute("data-preview-box")).toBe("96");
    expect(canvas.getAttribute("height")).toBe("96");
    expect(canvas).toHaveClass("w-full");
    // The title leads the sheet, and the line follows it on the page.
    const title = within(panel).getAllByText("Pincel")[0]!;
    expect(title.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Same scroll body, so it is the next block rather than a corner sample.
    expect(preview.parentElement).toBe(screen.getByTestId("sheet-scroll"));
    expect(title.closest('[data-testid="sheet-scroll"]')).toBe(screen.getByTestId("sheet-scroll"));
  });

  it("updates the live preview with the current size", () => {
    mount();
    openPanel();
    fireEvent.click(screen.getByLabelText("Pincel"));
    openFold("fold-ajustes");
    const preview = screen.getByTestId("param-preview");
    const before = Number(preview.getAttribute("data-stroke-width"));
    // One scale for every material: the sheet's slider is the same 1..100.
    fireEvent.change(screen.getByLabelText("Tamanho"), { target: { value: "48" } });
    const after = Number(preview.getAttribute("data-stroke-width"));
    expect(after).toBeGreaterThan(before);
    expect(screen.getByText("48px")).toBeInTheDocument();
  });

  it("dilutes the paint with water, which reaches the stroke command", () => {
    mount();
    openPanel();
    fireEvent.click(screen.getByLabelText("Aquarela"));
    openFold("fold-ajustes");
    fireEvent.change(screen.getByLabelText("Água"), { target: { value: "100" } });
    // 100% water leaves the medium's own wash (55% opacity).
    expect(screen.getByText(/água 100%/)).toBeInTheDocument();
    const preview = screen.getByTestId("param-preview");
    expect(Number(preview.getAttribute("data-stroke-opacity"))).toBeLessThan(1);
  });
});

describe("3-5: reading-zero bar, no third state", () => {
  it("has no functional text at all in the compact bar", () => {
    mount("theo", null);
    openCompactFromTool();
    const compact = screen.getByTestId("canvas-compact");
    expect(compact.textContent?.trim() ?? "").toBe("");
    expect(screen.queryByLabelText("Recolher")).toBeNull();
    // The latch is there, but it opens the 3-5 SECOND LEVEL (the two look folds)
    // — never the pro sheet, which does not exist in this band.
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.getByTestId("kids-look")).toBeInTheDocument();
  });

  it("has no pro sheet: the second level is the look folds, without text", () => {
    mount("theo", null);
    openCompactFromTool();
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.queryByTestId("simple-palette")).toBeNull();
    expect(screen.queryByTestId("pro-palette")).toBeNull();
    expect(screen.queryByTestId("tool-shelf")).toBeNull();
  });

  it("keeps the 3-5 ladder as the same twelve cells as 9+, with no sheet palette", () => {
    mount("theo", null);
    openCompactFromTool();
    const compact = screen.getByTestId("canvas-compact");
    const colors = within(compact).getByRole("radiogroup", { name: "Tons da cor" });
    const twelve = within(colors).getAllByRole("radio");
    // Uniformity (owner's decision, 27/10): the very same 6 + 6 as the pro bar —
    // white, ten rungs, black — on the 44dp cell, 6 · 44 + 5 · 8 = 304dp.
    expect(twelve).toHaveLength(COMPACT_TONES);
    expect(colors.getAttribute("data-columns")).toBe("6");
    expect(colors.getAttribute("data-rows")).toBe("2");
    expect(colors.getAttribute("data-width")).toBe("304");
    expect(colors.getAttribute("data-label-band")).toBe("0");
    for (const dot of twelve) {
      expect(dot).toHaveClass("rounded-[12px]");
      expect(dot.style.width).toBe("44px");
    }
    // The two neutrals ARE cells of the row, first and last — never a pair beside it.
    const hexes = twelve.map((dot) => dot.getAttribute("data-hex"));
    expect(hexes[0]).toBe(WHITE.hex);
    expect(hexes.at(-1)).toBe("#000000");
    expect(within(compact).queryByTestId("compact-neutrals")).toBeNull();
  });

  it("sizes with the same 1..100 capsule as 9+, on a 44dp floor", () => {
    mount("theo", null);
    openCompactFromTool();
    const compact = screen.getByTestId("canvas-compact");
    const slider = within(compact).getByTestId("compact-thickness-slider") as HTMLInputElement;
    expect(slider).toHaveAttribute("type", "range");
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "100");
    expect(within(compact).getByLabelText("Menos espessura")).toHaveClass("h-12", "w-12");
    expect(within(compact).getByLabelText("Mais espessura")).toHaveClass("h-12", "w-12");
    // The three growth dots are gone from the compact bar, not hidden in a sheet.
    expect(within(compact).queryByRole("radiogroup", { name: "Tamanho" })).toBeNull();
    expect(screen.queryByLabelText("Opacidade")).toBeNull();
  });

  it("offers no 'Mais' collections on a kids canvas", () => {
    mount("theo", null);
    openCompactFromTool();
    expect(screen.queryByLabelText("Mais ferramentas")).toBeNull();
    expect(screen.queryByLabelText("Organizar ferramentas")).toBeNull();
    expect(screen.queryByText("Mais")).toBeNull();
  });
});
