// The compact colour area, re-decided by the owner on 27/10
// (`compacta-unificada` §12.6, `cor-compacta` §9–§10, revised on the owner's
// print of the same day and on the order decision he took with a capture).
// Seam: the pieces the hand sees in the bar, the numbers they are drawn with,
// and the absence of everything the decision took away.
//
//   carousel  → ONE box, one height, FULL WIDTH, paged by a horizontal drag:
//               panel 1 the spectrum strip (24dp of track in 48dp of touch),
//               panel 2 the saturation × lightness field (hue from the strip),
//               panel 3 the HEX field — 9+ only. 3–5 has TWO panels — the strip
//               and the same field with no word on it — because the field is the
//               band's only route to grey; the band still reads no text at all.
//   ladder    → the SAME row on both bands: TWELVE cells in 6 + 6 — WHITE, the
//               ten rungs 50…950, BLACK — 44dp on the tools block's own 304dp.
//               The two neutrals are the end cells of the row (they left the
//               strip's line, so the strip is the whole width again), the family
//               never generates either of them, and each rung carries its own
//               step INSIDE its own cell on 9+ — 3–5 has no label band at all.
//               The kids 3 × 3 of nine 52dp targets, its 12dp breath and its
//               loose pair of neutrals are gone: without text, regularity is the
//               only thing that can make two bands read as one system (owner's
//               decision, 27/10, with a capture)
//   gone      → the separate step row, the neutral pair beside the strip, the
//               kids 3 × 3 and its group breath, the HSL readout, the VERTICAL
//               hue bar, CORES/RECENTES/FAVORITAS tabs, family catalogue,
//               favourites row and the 600ms hold.
//               Absent from the DOM on BOTH bands.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import {
  BLACK,
  COMPACT_LIGHTNESS,
  PALETTE_FAMILIES,
  SCALE_STEPS,
  WHITE,
  derivedRamp,
} from "@/mockup/palette";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { openFold } from "./open-panel";
import {
  CompactColor,
  CAROUSEL_FIELD,
  CAROUSEL_HEIGHT,
  COLOR_CELL,
  COLOR_COLUMNS,
  COLOR_COUNT,
  COLOR_EDGE,
  COLOR_GAP,
  COLOR_ROWS,
  COLOR_ROW_WIDTH,
  COLOR_STEP_BAND,
  COLOR_SWATCH,
} from "@/mockup/screens/PaletteTray";

const STARTER = "#FB2C36";

/** The bar's inner box, measured on the owner's 390dp capture: 390 − 2·12 − 2·16. */
const BAR_INNER_WIDTH = 334;

/** The compact colour area with its own state, like the bar's own machine. */
function ColorHost({ kids = false, color = STARTER }: { kids?: boolean; color?: string }) {
  const [picked, setPicked] = useState(color);
  return (
    <>
      <span data-testid="picked">{picked}</span>
      <CompactColor color={picked} kids={kids} onPick={setPicked} />
    </>
  );
}

const ladder = () => screen.getByTestId("compact-colors");
const cells = () => within(ladder()).getAllByRole("radio");
const cellHexes = () => cells().map((cell) => cell.getAttribute("data-hex"));
const spectrum = () => within(screen.getByTestId("compact-spectrum")).getByRole("slider");
const carousel = () => screen.getByTestId("compact-carousel");
const panelIndex = () => Number(carousel().getAttribute("data-index"));
const panelsOf = () =>
  Array.from(carousel().querySelectorAll("[data-panel]")).map((panel) =>
    panel.getAttribute("data-panel"),
  );

/** One horizontal drag on the carousel, from x to x, at the box's own height. */
const swipe = (from: number, to: number) => {
  fireEvent.pointerDown(carousel(), { pointerId: 1, clientX: from, clientY: 40 });
  fireEvent.pointerMove(carousel(), { pointerId: 1, clientX: to, clientY: 42 });
  fireEvent.pointerUp(carousel(), { pointerId: 1, clientX: to, clientY: 42 });
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("two pieces, in the panel's own order", () => {
  it("stacks the carousel and the ladder, and nothing else", () => {
    render(<ColorHost />);
    const root = screen.getByTestId("compact-color");

    // 1 the carousel · 2 the ladder (owner's order decision, 27/10).
    expect(root.children).toHaveLength(2);
    expect(root.firstElementChild).toBe(screen.getByTestId("compact-color-top"));
    expect(within(root).getByTestId("compact-carousel")).toBeInTheDocument();
    expect(within(root).getByTestId("compact-colors")).toBeInTheDocument();
    // The neutral pair is not a piece of its own any more: white and black are
    // cells of the ladder below.
    expect(root.firstElementChild!.children).toHaveLength(1);
  });

  it("draws the spectrum as a 24dp track inside 48dp of touch", () => {
    render(<ColorHost />);
    const strip = screen.getByTestId("compact-spectrum");
    expect(strip.getAttribute("data-track")).toBe("24");
    expect(strip.getAttribute("data-touch")).toBe("48");
    expect(strip).toHaveClass("h-12");
    // The visible band is the track itself: 24dp, full width, no label.
    expect(spectrum()).toHaveClass("h-6", "w-full");
    expect(spectrum()).toHaveAttribute("aria-label", "Espectro de cores");
    expect(spectrum().textContent?.trim() ?? "").toBe("");
    // A slider, not a button: the value is the hue, read but never printed.
    expect(spectrum()).toHaveAttribute("role", "slider");
    expect(spectrum().getAttribute("aria-valuemin")).toBe("0");
    expect(spectrum().getAttribute("aria-valuemax")).toBe("360");
    // Not one word of its own, and no button on the track.
    expect(spectrum().querySelectorAll("button")).toHaveLength(0);
  });

  it("(c) gives the strip the whole width of the block again", () => {
    for (const kids of [false, true]) {
      render(<ColorHost kids={kids} />);
      const top = screen.getByTestId("compact-color-top");

      // One child, and it is the carousel: the strip no longer divides the line
      // with two 44dp targets, so nothing takes 96dp of its measure away.
      expect(top.children).toHaveLength(1);
      expect(top.firstElementChild).toBe(carousel());
      expect(carousel()).toHaveClass("w-full");
      expect(carousel().getAttribute("data-span")).toBe("full");
      expect(top.getAttribute("data-span")).toBe("full");
      // The carousel owns the full width, never a flex share of it.
      expect(carousel()).not.toHaveClass("flex-1");
      cleanup();
    }
  });

  it("scrubs the hue continuously while the finger drags", () => {
    render(<ColorHost />);
    const track = spectrum();
    const picked = () => screen.getByTestId("picked").textContent;

    // The jsdom rect is a 300dp strip starting at x=0: 0 is its left edge.
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 10, clientY: 12 });
    const first = picked();
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 90, clientY: 12 });
    const second = picked();
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 180, clientY: 12 });
    const third = picked();

    // Every step of the drag is a new colour — no dead zone, no commit on up.
    expect(second).not.toBe(first);
    expect(third).not.toBe(second);
    // The same hue can be reached again: the strip is a position, not a queue.
    fireEvent.pointerMove(track, { pointerId: 1, clientX: 90, clientY: 12 });
    expect(picked()).toBe(second);
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 90, clientY: 12 });

    // The scrub is the strip's own: it never pages the carousel under the finger.
    expect(panelIndex()).toBe(0);
  });

  it("changes the hue from the keyboard too", () => {
    render(<ColorHost />);
    const track = spectrum();
    const before = Number(track.getAttribute("aria-valuenow"));
    fireEvent.keyDown(track, { key: "ArrowRight" });
    expect(
      Number(
        screen
          .getByTestId("compact-spectrum")
          .querySelector("[role=slider]")!
          .getAttribute("aria-valuenow"),
      ),
    ).not.toBe(before);
  });
});

describe("white and black are the two ends of the ladder", () => {
  it("(a) puts #FFFFFF first and #000000 last: twelve cells in 6 + 6, none empty", () => {
    render(<ColorHost />);

    expect(cells()).toHaveLength(COLOR_COUNT);
    expect(COLOR_COUNT).toBe(12);
    expect(COLOR_ROWS).toBe(2);
    expect(ladder().getAttribute("data-count")).toBe("12");
    expect(ladder().children).toHaveLength(12);

    // 6 + 6 with no spacer and no empty cell: six columns, two whole rows.
    expect(ladder().getAttribute("data-columns")).toBe(String(COLOR_COLUMNS));
    expect(ladder().getAttribute("data-rows")).toBe(String(COLOR_ROWS));
    expect(COLOR_COLUMNS).toBe(6);
    expect(COLOR_COUNT).toBe(COLOR_COLUMNS * COLOR_ROWS);

    // The white cell opens the row and the black cell closes it — they are
    // colours of the ladder, not a pair beside the strip.
    expect(cellHexes()[0]).toBe(WHITE.hex);
    expect(cellHexes().at(-1)).toBe(BLACK.hex);
    // The two ends announce their own value; the ten rungs, a position.
    expect(within(ladder()).getByLabelText("Branco")).toBe(cells()[0]);
    expect(within(ladder()).getByLabelText("Preto")).toBe(cells().at(-1));
    expect(cells()[1]).toHaveAccessibleName("tom 2 de 12");
    // Every cell is a colour: there is no spacer to find and no hole to point at.
    expect(screen.queryByTestId("compact-colors-gap")).toBeNull();
    for (const cell of cells()) {
      const swatch = cell.querySelector<HTMLElement>("[data-swatch]")!;
      expect(swatch).not.toBeNull();
      expect(swatch.style.background.trim()).not.toBe("");
    }
  });

  it("applies exactly #FFFFFF and #000000, with the one in use marked", () => {
    for (const family of [PALETTE_FAMILIES[0]!, PALETTE_FAMILIES[7]!, PALETTE_FAMILIES[14]!]) {
      render(<ColorHost color={family.base.hex} />);
      const picked = () => screen.getByTestId("picked").textContent;
      const white = cells()[0]!;
      const black = cells().at(-1)!;

      expect(white.getAttribute("aria-checked")).toBe("false");
      expect(black.getAttribute("aria-checked")).toBe("false");

      fireEvent.click(white);
      expect(picked()).toBe("#FFFFFF");
      expect(white.getAttribute("aria-checked")).toBe("true");
      expect(black.getAttribute("aria-checked")).toBe("false");
      expect(cells().filter((c) => c.getAttribute("aria-checked") === "true")).toHaveLength(1);

      fireEvent.click(black);
      expect(picked()).toBe("#000000");
      expect(black.getAttribute("aria-checked")).toBe("true");
      expect(white.getAttribute("aria-checked")).toBe("false");

      cleanup();
    }
  });

  it("keeps both of them out of the family the ramp derives", () => {
    // The family never generates white or black: the ladder's middle ten are the
    // ten rungs of the colour in hand, whatever family it is.
    for (const family of [PALETTE_FAMILIES[0]!, PALETTE_FAMILIES[7]!, PALETTE_FAMILIES[14]!]) {
      render(<ColorHost color={family.base.hex} />);
      const middle = cellHexes().slice(1, -1);
      expect(middle).toHaveLength(SCALE_STEPS.length);
      expect(middle).not.toContain(WHITE.hex);
      expect(middle).not.toContain(BLACK.hex);
      expect(new Set(middle).size).toBe(middle.length);
      cleanup();
    }
    expect(derivedRamp(WHITE.hex, COMPACT_LIGHTNESS)).not.toContain(BLACK.hex);
  });

  it("selects a neutral without re-deriving the ladder under the finger", () => {
    render(<ColorHost />);
    const before = cellHexes();

    // White is a cell of this row, so it is a selection (P5), not a new ladder.
    fireEvent.click(cells()[0]!);
    expect(screen.getByTestId("picked").textContent).toBe("#FFFFFF");
    expect(cellHexes()).toEqual(before);
    expect(cells()[0]).toHaveAttribute("aria-checked", "true");

    // Same for black, the other end.
    fireEvent.click(cells().at(-1)!);
    expect(screen.getByTestId("picked").textContent).toBe("#000000");
    expect(cellHexes()).toEqual(before);
  });

  it("sizes the ladder on the tools block's own 304", () => {
    render(<ColorHost />);
    expect(ladder().getAttribute("data-cell")).toBe(String(COLOR_CELL));
    expect(ladder().getAttribute("data-gap")).toBe(String(COLOR_GAP));
    expect(ladder().style.gridTemplateColumns).toBe(`repeat(${COLOR_COLUMNS}, ${COLOR_CELL}px)`);
    expect(ladder().style.gap).toBe(`${COLOR_GAP}px`);
    // 6 · 44 + 5 · 8 = 304, the tools block's own width.
    expect(COLOR_ROW_WIDTH).toBe(304);
    expect(COLOR_COLUMNS * COLOR_CELL + (COLOR_COLUMNS - 1) * COLOR_GAP).toBe(COLOR_ROW_WIDTH);

    for (const cell of cells()) {
      expect(cell).toHaveClass("rounded-[12px]");
      expect(cell.style.width).toBe(`${COLOR_CELL}px`);
      expect(cell.style.height).toBe(`${COLOR_CELL}px`);
    }
  });
});

describe("the ten variations 50…950", () => {
  it("(b) keeps ten published steps, 50 and 950 among them, and drops 900", () => {
    expect(SCALE_STEPS).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 950]);
    expect(SCALE_STEPS).toHaveLength(10);
    expect(SCALE_STEPS[0]).toBe(50);
    expect(SCALE_STEPS.at(-1)).toBe(950);
    expect(SCALE_STEPS).not.toContain(900);
    expect(COMPACT_LIGHTNESS).toHaveLength(SCALE_STEPS.length);

    // Worked example: HSL 0° 100% at the ten rungs. The expected hexes come from
    // the HSL→RGB formulas, not from the implementation — the 950 rung keeps the
    // published scale's extreme, which is why it is the one wider step.
    expect(derivedRamp("#FF0000", COMPACT_LIGHTNESS)).toEqual([
      "#FFEBEB",
      "#FFC7C7",
      "#FFA3A3",
      "#FF8080",
      "#FF5C5C",
      "#FF3838",
      "#FF1414",
      "#F00000",
      "#CC0000",
      "#850000",
    ]);
    // The bar's ladder is that ramp, in the order the row reads it.
    render(<ColorHost />);
    expect(cellHexes().slice(1, -1)).toEqual(derivedRamp(STARTER, COMPACT_LIGHTNESS));
  });

  it("carries each step's own label inside its own cell, under the swatch", () => {
    render(<ColorHost />);
    const all = cells();
    const height = (node: HTMLElement) => Number(node.style.height.replace("px", ""));

    SCALE_STEPS.forEach((step, index) => {
      const cell = all[index + 1]!; // cell 0 is white, cell 11 is black
      const swatch = cell.querySelector<HTMLElement>("[data-swatch]")!;
      const band = cell.querySelector<HTMLElement>("[data-step]")!;

      // The label belongs to THIS cell: it is a descendant of the target it
      // names, and the cell is its containing block — a sibling row cannot own
      // it, which is what made "50…500" read as the line below's.
      expect(cell).toHaveClass("relative");
      expect(cell.contains(band)).toBe(true);
      expect(band.getAttribute("data-step")).toBe(String(step));
      expect(band.textContent).toBe(String(step));
      // Inside the box, measured in the cell's own numbers: frame + colour +
      // label band close on the cell's height.
      expect(height(cell)).toBe(COLOR_CELL);
      expect(height(swatch) + height(band) + 2 * COLOR_EDGE).toBe(COLOR_CELL);
      expect(height(band)).toBe(COLOR_STEP_BAND);
      expect(height(swatch)).toBe(COLOR_SWATCH);
      // Below the swatch, in that order, inside the cell.
      expect(cell.firstElementChild).toBe(swatch);
      expect(cell.lastElementChild).toBe(band);
    });

    // White and black name no step: same cell box, empty band, no number.
    for (const neutral of [all[0]!, all.at(-1)!]) {
      expect(neutral.querySelector("[data-step]")).toBeNull();
      const swatch = neutral.querySelector<HTMLElement>("[data-swatch]")!;
      expect(height(swatch)).toBe(COLOR_SWATCH);
      expect(neutral.children).toHaveLength(2);
    }

    // No row of its own is left for a label to be read against.
    expect(screen.queryByTestId("compact-rung-steps")).toBeNull();
  });

  it("selects a rung without re-deriving the ladder under the finger", () => {
    render(<ColorHost />);
    const before = cellHexes();
    expect(cells().filter((c) => c.getAttribute("aria-checked") === "true")).toHaveLength(0);

    fireEvent.click(cells()[4]!);

    expect(cellHexes()).toEqual(before);
    expect(cells()[4]).toHaveAttribute("aria-checked", "true");
    expect(cells().filter((c) => c.getAttribute("aria-checked") === "true")).toHaveLength(1);
    expect(screen.getByTestId("picked").textContent).toBe(before[4]);
  });

  it("re-anchors when the colour arrives from outside the row", () => {
    render(<ColorHost />);
    const before = cellHexes();

    // The spectrum is outside the ladder: its colour re-derives the rungs.
    const track = spectrum();
    fireEvent.pointerDown(track, { pointerId: 1, clientX: 150, clientY: 12 });
    fireEvent.pointerUp(track, { pointerId: 1, clientX: 150, clientY: 12 });
    const picked = screen.getByTestId("picked").textContent!;

    expect(before).not.toContain(picked);
    expect(cellHexes().slice(1, -1)).toEqual(derivedRamp(picked, COMPACT_LIGHTNESS));
    // The two ends did not move: white and black are not rungs of the family.
    expect(cellHexes()[0]).toBe(WHITE.hex);
    expect(cellHexes().at(-1)).toBe(BLACK.hex);
  });
});

describe("3–5: the same twelve-cell ladder as 9+, with no text", () => {
  it("(d) draws twelve cells in 6 + 6, one 44dp cell on the shared 304", () => {
    render(<ColorHost kids />);
    const grid = ladder();

    // The same row as 9+, number for number: six columns, two whole rows, the
    // one 44dp cell and the 8dp gap — the measured account of the tools block.
    expect(grid.getAttribute("data-columns")).toBe(String(COLOR_COLUMNS));
    expect(grid.getAttribute("data-rows")).toBe(String(COLOR_ROWS));
    expect(grid.getAttribute("data-cell")).toBe("44");
    expect(grid.getAttribute("data-gap")).toBe(String(COLOR_GAP));
    expect(grid.getAttribute("data-count")).toBe("12");
    expect(grid.style.gridTemplateColumns).toBe(`repeat(${COLOR_COLUMNS}, ${COLOR_CELL}px)`);
    expect(grid.style.gap).toBe(`${COLOR_GAP}px`);

    // 6 · 44 + 5 · 8 = 304 ≤ the bar's 334: the kid row and the pro row are the
    // same block, and the 352dp overflow of the old 6 × 52 row cannot come back.
    expect(COLOR_CELL).toBe(44);
    expect(COLOR_ROW_WIDTH).toBe(304);
    expect(COLOR_COLUMNS * COLOR_CELL + (COLOR_COLUMNS - 1) * COLOR_GAP).toBe(COLOR_ROW_WIDTH);
    expect(grid.getAttribute("data-width")).toBe("304");
    expect(COLOR_ROW_WIDTH).toBeLessThanOrEqual(BAR_INNER_WIDTH);
    expect(BAR_INNER_WIDTH - COLOR_ROW_WIDTH).toBe(30);
    // Two rows of 44 close on 2 · 44 + 8 = 96dp, and the block leaves 15dp of
    // air on each side of the bar's 334 — the same block the 9+ band draws.
    expect(COLOR_ROWS * COLOR_CELL + (COLOR_ROWS - 1) * COLOR_GAP).toBe(96);
    expect((BAR_INNER_WIDTH - COLOR_ROW_WIDTH) / 2).toBe(15);

    // Six cells a row, two rows: nothing orphaned, nothing stretched.
    expect(cells()).toHaveLength(12);
    expect(grid.children).toHaveLength(12);
    for (const cell of cells()) {
      expect(cell.style.width).toBe(`${COLOR_CELL}px`);
      expect(cell.style.height).toBe(`${COLOR_CELL}px`);
      expect(cell).toHaveClass("rounded-[12px]");
      // No label band inside a kid cell: one child, the swatch.
      expect(cell.children).toHaveLength(1);
    }
  });

  it("(d) opens on #FFFFFF and closes on #000000, like the 9+ row", () => {
    render(<ColorHost kids />);
    const hexes = cellHexes();

    expect(hexes[0]).toBe(WHITE.hex);
    expect(hexes.at(-1)).toBe(BLACK.hex);
    // The middle ten are the rungs of the colour in hand, on the same curve the
    // 9+ band reads — not a second family, not a catalogue.
    expect(hexes.slice(1, -1)).toEqual(derivedRamp(STARTER, COMPACT_LIGHTNESS));
    // Value still rides `data-hex`, the registered test seam. `sem-texto-3-5` §6
    // says it should not be here; it stays because removing it would weaken the
    // coverage, and that is a separate decision.
    for (const cell of cells()) expect(cell).toHaveAttribute("data-hex");

    // Both ends are cells of this row: a tap selects, it does not re-derive.
    const before = cellHexes();
    fireEvent.click(cells()[0]!);
    expect(screen.getByTestId("picked").textContent).toBe("#FFFFFF");
    expect(cellHexes()).toEqual(before);
    fireEvent.click(cells().at(-1)!);
    expect(screen.getByTestId("picked").textContent).toBe("#000000");
    expect(cellHexes()).toEqual(before);
  });

  it("(d) reads no word at all, step label included", () => {
    render(<ColorHost kids />);
    const area = screen.getByTestId("compact-color");

    expect(area.textContent?.trim() ?? "").toBe("");
    // The field is mounted — it is panel 2 of this band — and it adds no
    // character to the area: no value, no label, no readout, no HEX inside it.
    const field = screen.getByTestId("compact-hsl-field");
    expect(area.contains(field)).toBe(true);
    expect(field.textContent?.trim() ?? "").toBe("");
    expect(field.querySelector("input, output, label")).toBeNull();
    expect(area.textContent?.replace(/\s/g, "")).toBe("");
    expect(ladder().getAttribute("data-label-band")).toBe("0");
    expect(area.querySelectorAll("[data-step]")).toHaveLength(0);
    expect(screen.queryByTestId("compact-hex")).toBeNull();
    expect(screen.queryByLabelText("Cor em HEX")).toBeNull();

    // The cell is the swatch plus its own 1dp frame, and nothing else.
    const height = (node: HTMLElement) => Number(node.style.height.replace("px", ""));
    for (const cell of cells()) {
      expect(height(cell.querySelector<HTMLElement>("[data-swatch]")!)).toBe(
        COLOR_CELL - 2 * COLOR_EDGE,
      );
    }
  });

  it("(d) leaves no 3 × 3 grid, no 12dp breath and no loose neutrals in the DOM", () => {
    render(<ColorHost kids />);
    const grid = ladder();

    // The nine-target grid is gone from the DOM, not hidden behind a class: no
    // group, no second gap, twelve direct children and one gap for the lot.
    expect(grid.querySelectorAll("[data-group]")).toHaveLength(0);
    expect(grid.getAttribute("data-group-gap")).toBeNull();
    expect(grid.children).toHaveLength(12);
    expect(grid.style.gap).toBe(`${COLOR_GAP}px`);

    // The pair of neutrals under the old grid left with it: white and black are
    // cells 0 and 11 now, exactly as on 9+.
    expect(screen.queryByTestId("compact-neutrals")).toBeNull();
    expect(screen.queryByTestId("compact-neutral-white")).toBeNull();
    expect(screen.queryByTestId("compact-neutral-black")).toBeNull();
    expect(cellHexes()[0]).toBe(WHITE.hex);
    expect(cellHexes().at(-1)).toBe(BLACK.hex);

    // The 52dp cell is not on the surface either.
    for (const cell of cells()) expect(cell.style.width).not.toBe("52px");
  });
});

describe("the label band is a node, not a declaration", () => {
  // `data-label-band` is what the grid says about itself; the node is what the
  // screen draws. They are two statements of one decision, and the pair is only
  // worth something when both are checked: a `0` beside twelve drawn bands reads
  // green and looks wrong (owner's print, 27/10). `data-band` marks the box
  // itself, so the two neutral cells — which carry a band and no word — count.
  const bands = () => ladder().querySelectorAll("[data-band]");
  const declared = () => Number(ladder().getAttribute("data-label-band"));
  const height = (node: HTMLElement) => Number(node.style.height.replace("px", ""));

  it("(d) draws no band on 3–5: the cell ends at the swatch", () => {
    render(<ColorHost kids />);

    expect(declared()).toBe(0);
    // The declaration is not the evidence — the node count is.
    expect(bands()).toHaveLength(0);

    for (const cell of cells()) {
      // One child, and it is the colour: no empty box under it, no spacer.
      expect(cell.children).toHaveLength(1);
      expect(cell.firstElementChild).toBe(cell.querySelector("[data-swatch]"));
      expect(cell.querySelector("[data-band]")).toBeNull();
      // No dead space, and the target does not shrink to get there: the swatch
      // closes the cell's inner box — 44 − 2·1 = 42 inside the 44dp target.
      expect(height(cell.firstElementChild as HTMLElement)).toBe(COLOR_CELL - 2 * COLOR_EDGE);
      expect(cell.style.height).toBe(`${COLOR_CELL}px`);
    }
  });

  it("keeps it on 9+, once per cell, at 12dp inside the same 44", () => {
    render(<ColorHost />);

    expect(declared()).toBe(COLOR_STEP_BAND);
    // Every cell has the box, the two neutrals included: they name no step, but
    // the grid keeps one height instead of two taller ends.
    expect(bands()).toHaveLength(COLOR_COUNT);

    for (const cell of cells()) {
      const band = cell.querySelector<HTMLElement>("[data-band]")!;
      expect(band).not.toBeNull();
      expect(cell.lastElementChild).toBe(band);
      expect(height(band)).toBe(COLOR_STEP_BAND);
      expect(height(cell.querySelector<HTMLElement>("[data-swatch]")!)).toBe(COLOR_SWATCH);
    }
    // The ends carry the box with no character in it.
    expect(bands()[0]!.textContent).toBe("");
    expect(bands()[COLOR_COUNT - 1]!.textContent).toBe("");

    // The two bands close on the same box: 1 + 42 + 1 = 44 and 1 + 30 + 12 + 1 = 44.
    expect(2 * COLOR_EDGE + COLOR_SWATCH + COLOR_STEP_BAND).toBe(COLOR_CELL);
  });
});

describe("the carousel: one box, one height, a panel per adjustment", () => {
  it("(c) mounts three panels on 9+ and two on 3–5", () => {
    render(<ColorHost />);
    expect(carousel().getAttribute("data-panels")).toBe("3");
    expect(panelsOf()).toEqual(["spectrum", "hsl", "hex"]);
    const field = screen.getByTestId("compact-hsl-field");
    expect(field).toBeInTheDocument();
    // 9+ reads the value of the field, in words.
    expect(field.getAttribute("aria-valuetext")).toMatch(/^HSL /);
    expect(screen.getByLabelText("Cor em HEX")).toBeInTheDocument();
    cleanup();

    // 3–5 pages through the strip and the field, and nothing else. The field is
    // the band's route to grey, mounted exactly as on 9+ — the same box, the
    // same two axes — and it drops the spoken value: no word reaches the band.
    render(<ColorHost kids />);
    expect(carousel().getAttribute("data-panels")).toBe("2");
    expect(panelsOf()).toEqual(["spectrum", "hsl"]);
    const kidsField = screen.getByTestId("compact-hsl-field");
    expect(kidsField).toBeInTheDocument();
    expect(kidsField).toHaveAttribute("data-axis", "s-l");
    expect(kidsField).not.toHaveAttribute("aria-valuetext");
    // The name is the screen reader's, never a visible label.
    expect(kidsField).toHaveAttribute("aria-label", "Saturação e luminosidade");
    expect(kidsField.textContent?.trim() ?? "").toBe("");
    // HEX stays out of the kids band, mounted nowhere.
    expect(screen.queryByTestId("compact-hex")).toBeNull();
    expect(screen.queryByLabelText("Cor em HEX")).toBeNull();
  });

  it("pages on a horizontal drag and snaps to the nearest panel", () => {
    render(<ColorHost />);
    expect(panelIndex()).toBe(0);

    // The jsdom box is 300dp wide: a 160dp drag is past the halfway mark.
    swipe(260, 100);
    expect(panelIndex()).toBe(1);
    swipe(260, 100);
    expect(panelIndex()).toBe(2);
    // The end of the set is a wall, not a wrap.
    swipe(260, 100);
    expect(panelIndex()).toBe(2);

    // Back the other way, same rule.
    swipe(100, 260);
    expect(panelIndex()).toBe(1);

    // A drag shorter than half a panel falls back to where it started.
    swipe(200, 230);
    expect(panelIndex()).toBe(1);
  });

  it("(c) never resizes the box: same height on every panel and both bands", () => {
    render(<ColorHost />);
    expect(carousel().getAttribute("data-height")).toBe(String(CAROUSEL_HEIGHT));
    expect(carousel().style.height).toBe(`${CAROUSEL_HEIGHT}px`);
    for (const panel of carousel().querySelectorAll("[data-panel]")) {
      expect(panel).toHaveClass("h-full");
    }
    swipe(260, 100);
    expect(panelIndex()).toBe(1);
    expect(carousel().style.height).toBe(`${CAROUSEL_HEIGHT}px`);
    cleanup();

    // 3–5 has two panels and the very same box: one height, no resize, and the
    // end of the set is a wall like on 9+.
    render(<ColorHost kids />);
    expect(carousel().getAttribute("data-height")).toBe(String(CAROUSEL_HEIGHT));
    expect(carousel().style.height).toBe(`${CAROUSEL_HEIGHT}px`);
    for (const panel of carousel().querySelectorAll("[data-panel]")) {
      expect(panel).toHaveClass("h-full");
    }
    swipe(260, 100);
    expect(panelIndex()).toBe(1);
    swipe(260, 100);
    expect(panelIndex()).toBe(1);
    expect(carousel().style.height).toBe(`${CAROUSEL_HEIGHT}px`);

    // The field is the same box on both bands: one number, not two.
    expect(CAROUSEL_FIELD).toBeLessThan(CAROUSEL_HEIGHT);
  });

  it("adjusts saturation and lightness from the field, keeping the strip's hue", () => {
    render(<ColorHost color="#FB2C36" />);
    const field = screen.getByTestId("compact-hsl-field");
    const picked = () => screen.getByTestId("picked").textContent!;

    // Bottom-left of the field: no saturation, no lightness — black.
    fireEvent.pointerDown(field, { pointerId: 1, clientX: 0, clientY: 300 });
    expect(picked().toUpperCase()).toBe("#000000");
    fireEvent.pointerUp(field, { pointerId: 1, clientX: 0, clientY: 300 });

    // Top-right: full saturation, full lightness — white, whatever the hue.
    fireEvent.pointerDown(field, { pointerId: 1, clientX: 300, clientY: 0 });
    expect(picked().toUpperCase()).toBe("#FFFFFF");
    fireEvent.pointerUp(field, { pointerId: 1, clientX: 300, clientY: 0 });

    // The field is its own gesture: it never pages the carousel.
    expect(panelIndex()).toBe(0);
  });

  it("gives 3–5 the field, and with it the way to grey", () => {
    render(<ColorHost kids />);
    swipe(260, 100);
    expect(panelIndex()).toBe(1);
    const field = screen.getByTestId("compact-hsl-field");
    const picked = () => screen.getByTestId("picked").textContent!;

    // Left edge of the field is `s = 0`, mid-height is `l = 50`: a true grey,
    // whatever hue the strip left in hand. This is the path the strip alone
    // cannot offer — rotating the hue never desaturates.
    fireEvent.pointerDown(field, { pointerId: 1, clientX: 0, clientY: 150 });
    expect(picked()).toBe("#808080");
    fireEvent.pointerUp(field, { pointerId: 1, clientX: 0, clientY: 150 });

    // The field's own gesture never pages the carousel, and it still reads no
    // word: no value, no label, no HEX inside the panel.
    expect(panelIndex()).toBe(1);
    expect(field.textContent?.trim() ?? "").toBe("");
    expect(field.querySelector("input")).toBeNull();
  });

  it("takes a HEX code on 9+, and only a whole one", () => {
    render(<ColorHost />);
    const field = screen.getByLabelText("Cor em HEX") as HTMLInputElement;
    fireEvent.change(field, { target: { value: "#12345" } });
    expect(screen.getByTestId("picked").textContent).toBe(STARTER);
    fireEvent.change(field, { target: { value: "#12ab34" } });
    expect(screen.getByTestId("picked").textContent).toBe("#12AB34");
  });

  it("carries a discrete cue on both bands, since both have a page to reach", () => {
    for (const kids of [false, true]) {
      render(<ColorHost kids={kids} />);
      const dots = screen.getByTestId("compact-carousel-dots");

      // The cue is silent on both bands: `aria-hidden`, 4dp, no character — and
      // one dot per panel, so the kids' second panel is announced by position
      // alone.
      expect(dots).toHaveAttribute("aria-hidden", "true");
      expect(dots.getAttribute("data-size")).toBe("4");
      expect(dots.textContent).toBe("");
      expect(dots.children).toHaveLength(Number(carousel().getAttribute("data-panels")));
      expect(dots.children[0]).toHaveAttribute("data-on", "true");
      for (const dot of Array.from(dots.children)) {
        expect(dot).toHaveClass("h-1");
        expect(dot.textContent).toBe("");
      }
      cleanup();
    }
  });
});

describe("what the decision took out, on both bands", () => {
  const ABSENT = [
    "hsl-picker",
    "hsl-readout",
    "color-field",
    "color-field-marker",
    "compact-hue",
    "hue-bar",
    "compact-catalog",
    "compact-favorites",
    "palette-catalog",
    "palette-families",
    "compact-rung-steps",
  ] as const;

  it("keeps HSL mode, the hue bar, the tabs and catalogue out of 9+", () => {
    render(<ColorHost />);
    for (const id of ABSENT) expect(screen.queryByTestId(id), id).toBeNull();
    expect(screen.queryByLabelText("HEX (secundário)")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Cores favoritas" })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Neutros" })).toBeNull();
    // The neutrals are cells of the ladder now; the old pair beside the strip is
    // gone, and it is not the kids' pair either.
    expect(screen.queryByTestId("compact-neutrals")).toBeNull();
    // The compact area reads the word HEX and the ten step numbers, nothing else.
    expect(screen.getByTestId("compact-color").textContent?.replace(/\s/g, "")).toBe(
      "HEX50100200300400500600700800950",
    );
  });

  it("keeps the same pieces out of 3–5, with no text at all", () => {
    render(<ColorHost kids />);
    for (const id of ABSENT) expect(screen.queryByTestId(id), id).toBeNull();
    expect(screen.queryByLabelText("HEX (secundário)")).toBeNull();
    expect(screen.queryByLabelText("Cor em HEX")).toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Cores favoritas" })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Neutros" })).toBeNull();
    expect(screen.getByTestId("compact-color").textContent?.trim() ?? "").toBe("");
  });

  it("leaves no 600ms save gesture on the surface", () => {
    render(<ColorHost />);
    // The gesture existed to fill the favourites row; both left the bar.
    expect(screen.getByTestId("compact-color").querySelector("[data-hold-label]")).toBeNull();
  });
});

describe("in the bar, on both bands and both profiles", () => {
  function Harness({
    profileId,
    pageId,
    favorites,
  }: {
    profileId: string;
    pageId: string | null;
    favorites?: string[] | undefined;
  }) {
    const { state, dispatch } = useStore();
    const key = favorites ? favorites.join("|") : "";
    useEffect(() => {
      dispatch({ type: "selectProfile", id: profileId });
      if (key)
        dispatch({
          type: "updateProfile",
          id: profileId,
          patch: { favoriteColors: key.split("|") },
        });
    }, [dispatch, profileId, key]);
    const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
    if (!art) return null;
    return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
  }

  const open = (profileId: string, pageId: string | null, favorites?: string[]) => {
    render(
      <StoreProvider>
        <Harness profileId={profileId} pageId={pageId} favorites={favorites} />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    return screen.getByTestId("canvas-compact");
  };

  it("shows the same two pieces in the pro bar and in the kid bar", () => {
    for (const [profileId, pageId, panels, count] of [
      ["maria", "peixe", "3", "12"],
      ["theo", "foguete", "2", "12"],
    ] as const) {
      const compact = open(profileId, pageId, [STARTER]);
      const area = within(compact).getByTestId("compact-color");
      expect(within(area).getByTestId("compact-carousel").getAttribute("data-panels")).toBe(panels);
      expect(within(area).getByTestId("compact-spectrum")).toBeInTheDocument();

      const grid = within(area).getByTestId("compact-colors");
      expect(grid.getAttribute("data-count")).toBe(count);
      expect(within(grid).getAllByRole("radio")).toHaveLength(Number(count));
      // The strip is the whole width, and the ladder is its own block below.
      expect(within(area).getByTestId("compact-color-top").children).toHaveLength(1);
      // The SAME row on both bands: 6 + 6, 44dp, 304dp, white first, black last.
      expect(grid.getAttribute("data-columns")).toBe("6");
      expect(grid.getAttribute("data-rows")).toBe("2");
      expect(grid.getAttribute("data-cell")).toBe("44");
      expect(grid.getAttribute("data-width")).toBe("304");
      const row = within(grid).getAllByRole("radio");
      expect(row[0]).toHaveAttribute("data-hex", "#FFFFFF");
      expect(row.at(-1)).toHaveAttribute("data-hex", "#000000");
      // White and black are ends, never a pair beside the row.
      expect(within(area).queryByTestId("compact-neutral-white")).toBeNull();
      expect(within(area).queryByTestId("compact-neutral-black")).toBeNull();

      // Nothing the decision took away comes back through the bar.
      expect(within(compact).queryByTestId("compact-catalog")).toBeNull();
      expect(within(compact).queryByTestId("compact-favorites")).toBeNull();
      expect(within(compact).queryByTestId("hsl-readout")).toBeNull();
      expect(within(compact).queryByLabelText("HEX (secundário)")).toBeNull();
      expect(within(compact).queryByRole("tablist")).toBeNull();
      expect(within(compact).queryByTestId("compact-rung-steps")).toBeNull();

      // 3–5 reads no word at all; 9+ reads the step labels in their cells.
      if (profileId === "theo") expect(compact.textContent?.trim() ?? "").toBe("");
      else
        expect(within(within(area).getByTestId("compact-colors")).getAllByText("950")).toHaveLength(
          1,
        );

      cleanup();
      localStorage.clear();
    }
  });

  it("reaches black as the last cell of the bar's own ladder", () => {
    const compact = open("maria", "peixe");
    const area = within(compact).getByTestId("compact-color");
    const row = within(area).getAllByRole("radio");
    const last = row.at(-1)!;
    expect(last).toHaveAttribute("data-hex", "#000000");
    fireEvent.click(last);
    fireEvent.click(screen.getByTestId("dock-scrim"));
    // The colour in hand is exactly black — not the darkest rung of the ladder.
    expect(screen.getByTestId("canvas-dock").getAttribute("data-color")).toBe("#000000");
  });

  it("no longer shows the profile's saved colours as a row in the bar", () => {
    const compact = open("maria", "peixe", [STARTER, "#333333"]);
    expect(within(compact).queryAllByTestId("compact-favorite")).toHaveLength(0);
    expect(within(compact).queryByTestId("compact-favorites")).toBeNull();
  });

  it("still offers Favoritas in the expanded sheet, which is its only home", () => {
    open("maria", "peixe", ["#333333"]);
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));

    const panel = screen.getByTestId("canvas-panel");
    // The palette is the Cor fold, which opens CLOSED since 27/10.
    openFold("fold-cor");
    const tabs = within(panel).getByRole("tablist", { name: "Seções da paleta" });
    fireEvent.click(within(tabs).getByRole("tab", { name: "Favoritas" }));
    expect(within(panel).getByRole("radiogroup", { name: "Cores favoritas" })).toBeInTheDocument();
    expect(
      within(panel)
        .getAllByRole("radio")
        .some((swatch) => swatch.getAttribute("data-hex") === "#333333"),
    ).toBe(true);
  });

  it("puts the ladder on the tools block's own 304", () => {
    const compact = open("maria", "peixe");
    const tools = within(compact).getAllByTestId("compact-tools-line")[0]!;
    const row = within(compact).getByTestId("compact-colors");

    expect(row.getAttribute("data-cell")).toBe(tools.getAttribute("data-cell"));
    expect(row.getAttribute("data-gap")).toBe(tools.getAttribute("data-gap"));
    expect(row.getAttribute("data-columns")).toBe("6");
    expect(COLOR_ROW_WIDTH).toBe(304);
  });
});
