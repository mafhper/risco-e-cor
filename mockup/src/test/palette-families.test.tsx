// Seam under test: the advanced palette's selector.
//
// Contract:
//   1. the 18 families are always on screen as colors — no names, no tags,
//      no disclosure, no search by color name;
//   2. HSL is the primary readout (H/S/L sliders + editable numbers); HEX is a
//      smaller secondary line under it;
//   3. picking a family picks its colour; there is ONE tone ramp — the
//      variations block under the picker — and it is derivedRamp(color) with the
//      50..950 labels under it, so the ramp always reflects the colour in the
//      hand; a family chip is highlighted (thin ring) by exact match or nearest
//      hue, never by the last tap;
//   4. no swatch announces a color name: accessibility uses position
//      ("variação 7 de 11") or the secondary HEX.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState, type ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DERIVED_LIGHTNESS,
  FAMILY_STEPS,
  PALETTE_FAMILIES,
  PALETTE_MIN,
  derivedRamp,
  hexLuminance,
  hslOfHex,
} from "@/mockup/palette";
import { PaletteTray } from "@/mockup/screens/PaletteTray";

type TrayProps = ComponentProps<typeof PaletteTray>;

afterEach(cleanup);

function mount(overrides: Partial<TrayProps> = {}) {
  const onPick = vi.fn();
  const onToggleFavorite = vi.fn();
  render(
    <PaletteTray
      simple={false}
      color="#F72633"
      recent={[]}
      favorites={[]}
      onPick={onPick}
      onToggleFavorite={onToggleFavorite}
      {...overrides}
    />,
  );
  return { onPick, onToggleFavorite };
}

function ControlledTray({ initial = "#F72633" }: { initial?: string }) {
  const [color, setColor] = useState(initial);
  return (
    <PaletteTray
      simple={false}
      color={color}
      recent={[]}
      favorites={[]}
      onPick={setColor}
      onToggleFavorite={() => {}}
    />
  );
}

const tags = () => screen.getAllByTestId("palette-family");
// The panel's ONE ramp: the variations block under the picker. Its labels ride
// inside it, and no second tone grid exists to query.
const ramp = () => screen.getByTestId("color-variations");
const steps = () => within(ramp()).getByRole("radiogroup", { name: "Variações da cor" });
const stepHexes = () =>
  within(steps())
    .getAllByRole("radio")
    .map((dot) => dot.getAttribute("data-hex")!);

describe("advanced palette: family colors, no names", () => {
  it("renders all 18 families at once, each a color with a positional name", () => {
    mount();

    expect(tags()).toHaveLength(PALETTE_MIN.families);
    expect(screen.getByRole("group", { name: "Famílias de cor" })).toBeInTheDocument();
    expect(screen.getByLabelText("Espectro de cores")).toBeInTheDocument();
    // Navigation is the color itself: the chips print nothing.
    for (const tag of tags()) expect(tag.textContent?.trim() ?? "").toBe("");
    expect(tags()[0]).toHaveAccessibleName(`família 1 de ${PALETTE_MIN.families}`);
    // The derived tone row stays on screen.
    expect(steps()).toBeInTheDocument();
  });

  it("picking a family picks its colour and the eleven tones follow it", () => {
    render(<ControlledTray />);
    const before = stepHexes();
    const base = tags()[10]!.getAttribute("data-hex")!;

    fireEvent.click(tags()[10]!);

    // Owner's rule (25/10): picking a family IS picking its colour — the tone
    // ramp and the colour in the hand can never disagree.
    expect(screen.getByTestId("color-chip")).toHaveAttribute("data-hex", base);
    const selected = tags().filter((tag) => tag.getAttribute("aria-pressed") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName("família 11 de 18");

    const after = stepHexes();
    expect(after).toHaveLength(11);
    expect(after).not.toEqual(before);
    // Every tone keeps the chosen hue and gets darker down the row: the ramp is
    // the chosen colour's, never a neighbour's.
    const hue = hslOfHex(base).h;
    for (const hex of after) expect(Math.abs(hslOfHex(hex).h - hue)).toBeLessThan(1);
    const lums = after.map(hexLuminance);
    for (let i = 1; i < lums.length; i++) expect(lums[i]!).toBeLessThan(lums[i - 1]!);
  });

  it("hands the family's base colour to the caller", () => {
    const { onPick } = mount();
    const base = tags()[10]!.getAttribute("data-hex");
    fireEvent.click(tags()[10]!);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(base);
  });

  it("highlights the family that owns the colour with a thin ring", () => {
    mount({ color: PALETTE_FAMILIES[10]!.base.hex });
    const highlighted = tags().filter((tag) => tag.getAttribute("aria-pressed") === "true");
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]).toHaveAccessibleName("família 11 de 18");
    // Navigation, not selection: thin ring. The thick ring marks the chosen tone.
    expect(highlighted[0]!.className).toContain("ring-1");
    expect(highlighted[0]!.className).not.toContain("ring-2");
  });

  it("falls back to the nearest hue when the colour is outside the catalog", () => {
    mount(); // #F72633 has no catalog step; the nearest base hue is red (1st).
    const highlighted = tags().filter((tag) => tag.getAttribute("aria-pressed") === "true");
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]).toHaveAccessibleName("família 1 de 18");
  });

  it("never highlights a neutral family as the nearest hue", () => {
    // Hue 26°, saturation 80: pedra's base hue is the closest of all 18, but a
    // neutral has no hue to own — the chromatic nearest is laranja.
    mount({ color: "#E6721A" });
    const highlighted = tags().filter((tag) => tag.getAttribute("aria-pressed") === "true");
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0]).toHaveAccessibleName("família 2 de 18");
  });

  it("never invents a family for a colour with no hue", () => {
    mount({ color: "#808080" });
    expect(tags().filter((tag) => tag.getAttribute("aria-pressed") === "true")).toHaveLength(0);
  });

  it("labels the ramp with the eleven published steps, column by column", () => {
    mount();
    const labels = within(ramp()).getByTestId("color-variation-steps");
    // Same eleven columns and gap as the swatches above: a label can never
    // drift away from its tone at another width. The SHEET's ramp keeps the whole
    // catalogue scale (`FAMILY_STEPS`); the bar's ten-step ladder is another row.
    expect(labels).toHaveClass("grid", "grid-cols-11", "gap-1");
    expect(labels).toHaveAttribute("aria-hidden", "true");
    expect(
      within(labels)
        .getAllByText(/^\d+$/)
        .map((el) => el.textContent),
    ).toEqual(FAMILY_STEPS.map(String));
  });

  it("renders one ramp only: a single collection of eleven, one marker", () => {
    // The 7th rung of a pure red is #FF1414: it is on its own ramp, so exactly
    // one tone may look chosen. The duplicated grid used to allow two.
    mount({ color: "#FF1414" });
    const palette = screen.getByTestId("pro-palette");
    expect(within(palette).queryByRole("radiogroup", { name: "Tons da cor" })).toBeNull();
    const ramps = within(palette).getAllByRole("radiogroup", { name: "Variações da cor" });
    expect(ramps).toHaveLength(1);
    expect(palette.querySelectorAll('[aria-checked="true"]')).toHaveLength(1);
  });

  it("picking a tone hands the hex to the caller", () => {
    const { onPick } = mount();
    const dot = within(steps()).getAllByRole("radio")[7]!;
    fireEvent.click(dot);
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(dot.getAttribute("data-hex"));
  });
});

describe("advanced palette: HSL first, HEX second", () => {
  it("shows an HSL readout and the three channel sliders by default", () => {
    mount();
    const picker = screen.getByTestId("hsl-picker");
    expect(picker).toBeInTheDocument();
    // #F72633 is a red: hue is the only channel with a stable, readable value.
    expect(screen.getByTestId("hsl-readout").textContent).toMatch(/^HSL \d+° \d+% \d+%$/);
    expect(screen.getByLabelText("Matiz")).toBeInTheDocument();
    expect(screen.getByLabelText("Saturação")).toBeInTheDocument();
    expect(screen.getByLabelText("Luminosidade")).toBeInTheDocument();
    expect(screen.getByLabelText("Alfa")).toBeInTheDocument();
  });

  it("keeps HEX as a smaller, secondary field — never the default", () => {
    mount();
    const picker = screen.getByTestId("hsl-picker");
    const hex = screen.getByLabelText("HEX (secundário)");
    expect(hex).toHaveValue("#F72633");
    // The hierarchy is structural: HSL is the bold readout, HEX is the small line.
    expect(screen.getByTestId("hsl-readout")).toHaveClass("font-semibold");
    expect(picker.contains(hex)).toBe(true);
    expect(hex.className).toContain("text-[10px]");
  });

  it("edits the color through the hue bar", () => {
    const { onPick } = mount();
    const hue = screen.getByLabelText("Matiz");
    // jsdom's measuring stub gives the bar a 300×300 box: the middle is 180°.
    fireEvent.pointerDown(hue, { clientY: 150 });
    expect(onPick).toHaveBeenCalled();
    const hex = onPick.mock.calls.at(-1)![0] as string;
    expect(hex).toMatch(/^#[0-9A-F]{6,8}$/);
  });

  it("accepts a HEX only when it is valid, and never shows a color name", () => {
    const { onPick } = mount();
    const hex = screen.getByLabelText("HEX (secundário)");
    fireEvent.change(hex, { target: { value: "#F0B1" } });
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.change(hex, { target: { value: "#F0B100" } });
    expect(onPick).toHaveBeenLastCalledWith("#F0B100");
    expect(screen.getByTestId("pro-palette").textContent).not.toMatch(
      /amarelo|âmbar|vermelho|laranja/i,
    );
  });
});

describe("the derived ramp: eleven tones of the chosen colour", () => {
  it("has one tone per published step, and pure red walks them light to dark", () => {
    expect(DERIVED_LIGHTNESS).toHaveLength(FAMILY_STEPS.length);
    expect(FAMILY_STEPS).toHaveLength(PALETTE_MIN.stepsPerFamily);
    // Worked example: HSL 0° 100% evaluated at the eleven rungs. The expected
    // hexes come from the HSL->RGB formulas, not from the implementation.
    expect(derivedRamp("#FF0000")).toEqual([
      "#FFEBEB",
      "#FFC7C7",
      "#FFA3A3",
      "#FF8080",
      "#FF5C5C",
      "#FF3838",
      "#FF1414",
      "#F00000",
      "#CC0000",
      "#A80000",
      "#850000",
    ]);
  });

  it("marks a variation only when the colour is that variation", () => {
    mount({ color: "#FF1414" });
    const dots = within(screen.getByTestId("color-variations")).getAllByRole("radio");
    const marked = dots.filter((dot) => dot.getAttribute("aria-checked") === "true");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveAttribute("data-hex", "#FF1414");
  });

  it("keeps the ring on a tone that hex -> HSL does not round-trip", () => {
    // 8th rung of the red base: recovering HSL from this exact hex lands on
    // 46.863% lightness, not 47%. Without anchoring, its own ramp would swap it
    // for a neighbour one byte away and the ring would vanish after the tap.
    render(<ControlledTray initial="#EB0410" />);
    const marked = within(screen.getByTestId("color-variations"))
      .getAllByRole("radio")
      .filter((tone) => tone.getAttribute("aria-checked") === "true");
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveAttribute("data-hex", "#EB0410");
    expect(marked[0]).toHaveAttribute("aria-label", "variação 8 de 11");
  });

  it("marks nothing when the colour is not on its own ramp", () => {
    mount();
    const dots = within(screen.getByTestId("color-variations")).getAllByRole("radio");
    expect(dots).toHaveLength(11);
    expect(dots.filter((dot) => dot.getAttribute("aria-checked") === "true")).toHaveLength(0);
    for (const dot of dots) expect(dot.getAttribute("data-hex")).not.toBe("#F72633");
  });
});
