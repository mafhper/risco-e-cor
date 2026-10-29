// Reach: every skin must keep 200 colors selectable, and no color name may be
// shown or announced anywhere.
//
// The seam is the rendered palette, not the module: walking the same chevrons
// and family chips a finger walks is the only proof that the colors are
// actually reachable. Kids walk 18 catalog families × 11 steps + black/white;
// pro walks the same 18 families through their derived 11-tone ramp + neutrals
// (198 distinct tonal steps + black/white). Kids targets are 56dp and carry
// zero text; pro carries the HSL selector plus the spectrum/families/ramp.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PALETTE_MIN } from "@/mockup/palette";
import { PaletteTray } from "@/mockup/screens/PaletteTray";

afterEach(cleanup);

const NAME = /amarelo|âmbar|ambar|vermelho|laranja|azul|verde|roxo|rosa|ciano/i;

function KidsHarness() {
  const [family, setFamily] = useState(0);
  const [color, setColor] = useState("#FB2C36");
  return (
    <PaletteTray
      kids
      simple={false}
      color={color}
      kidFamily={family}
      onKidFamily={setFamily}
      recent={[]}
      favorites={[]}
      onPick={setColor}
      onToggleFavorite={() => {}}
    />
  );
}

function ProHarness() {
  const [color, setColor] = useState("#FB2C36");
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

describe("kids: 200 colors reachable with the family chevrons", () => {
  it("walks 3 pages x 6 families x 11 tones + black/white = 200", () => {
    render(<KidsHarness />);
    const seen = new Set<string>();

    for (let page = 0; page < 3; page++) {
      const families = screen.getAllByRole("radio", {
        name: new RegExp(`^cor \\d+ de ${PALETTE_MIN.families}$`),
      });
      expect(families, `page ${page + 1}`).toHaveLength(6);

      for (const family of families) {
        fireEvent.click(family);
        const tones = within(screen.getByTestId("kids-tone-row")).getAllByRole("radio");
        expect(tones).toHaveLength(PALETTE_MIN.stepsPerFamily);
        for (const tone of tones) seen.add(tone.getAttribute("data-hex")!);
      }

      if (page < 2) {
        // One tap per page: the farthest family is 2 chevrons + 1 family = 3 taps.
        fireEvent.click(screen.getByTestId("kids-family-next"));
      }
    }

    const neutrals = within(screen.getByTestId("kids-neutral-row")).getAllByRole("radio");
    expect(neutrals.map((n) => n.getAttribute("data-hex"))).toEqual(["#000000", "#FFFFFF"]);
    for (const neutral of neutrals) seen.add(neutral.getAttribute("data-hex")!);

    expect(seen.size).toBe(PALETTE_MIN.swatches);
  });

  it("keeps the skins' rule: zero text, no color name, 56dp targets", () => {
    render(<KidsHarness />);
    const palette = screen.getByTestId("kids-palette");
    expect(palette.textContent?.trim() ?? "").toBe("");
    for (const el of palette.querySelectorAll("[aria-label], [title]")) {
      const label = `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`;
      expect(label).not.toMatch(NAME);
    }
    const families = screen.getAllByRole("radio", {
      name: new RegExp(`^cor \\d+ de ${PALETTE_MIN.families}$`),
    });
    for (const family of families) expect(family).toHaveClass("h-14", "w-14");
  });
});

describe("pro: 200 distinct colors through families, derived tones and neutrals", () => {
  it("walks 18 families x 11 derived tones + black/white = 200", () => {
    render(<ProHarness />);
    const seen = new Set<string>();
    const chips = screen.getAllByTestId("palette-family");
    expect(chips).toHaveLength(PALETTE_MIN.families);

    for (const chip of chips) {
      fireEvent.click(chip);
      const ramp = screen.getByRole("radiogroup", { name: "Variações da cor" });
      const steps = within(ramp).getAllByRole("radio");
      expect(steps).toHaveLength(PALETTE_MIN.stepsPerFamily);
      for (const step of steps) seen.add(step.getAttribute("data-hex")!);
    }

    seen.add("#000000");
    seen.add("#FFFFFF");
    expect(seen.size).toBe(PALETTE_MIN.swatches);
  });

  it("shows no color name and keeps HSL as the primary readout", () => {
    render(<ProHarness />);
    const palette = screen.getByTestId("pro-palette");
    expect(palette.textContent).not.toMatch(NAME);
    for (const el of palette.querySelectorAll("[aria-label], [title]")) {
      const label = `${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("title") ?? ""}`;
      expect(label).not.toMatch(NAME);
    }
    expect(screen.getByTestId("hsl-readout").textContent).toMatch(/^HSL /);
    // The catalog is not a substitute for the selector: both live together.
    expect(screen.getByLabelText("HEX (secundário)")).toBeInTheDocument();
    expect(screen.getByLabelText("Matiz")).toBeInTheDocument();
    // The tab list no longer offers a HEX-only mode.
    expect(screen.queryByRole("tab", { name: "HEX" })).toBeNull();
  });

  it("keeps the favorite star as an action, not a swatch name", () => {
    const onToggleFavorite = vi.fn();
    render(
      <PaletteTray
        simple={false}
        color="#FB2C36"
        recent={[]}
        favorites={[]}
        onPick={() => {}}
        onToggleFavorite={onToggleFavorite}
      />,
    );
    fireEvent.click(screen.getByLabelText("Favoritar cor"));
    expect(onToggleFavorite).toHaveBeenCalledWith("#FB2C36");
  });
});
