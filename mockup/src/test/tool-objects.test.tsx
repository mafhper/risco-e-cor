// Iconografia v2 §1: the chip is the OBJECT, not the stroke. Before this, the
// professional shelf drew only the stroke sample in every chip, so Lápis,
// Carvão and Giz were three identical arcs — indistinguishable at 26dp.
//
// 26/10: the object set is shared with 3-5 (one glyph family for both bands), so
// the selector is the glyph itself — `svg[data-brush]` inside a tool chip — and
// `data-object` no longer distinguishes a band. The contract that matters is
// unchanged: every chip carries its own object and no sample crosses it.
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { BrushShelf } from "@/mockup/screens/BrushShelf";
import type { CanvasTool } from "@/mockup/brush";

const TOOLS: CanvasTool[] = [
  "fill",
  "pencil",
  "charcoal",
  "crayon",
  "marker",
  "brush",
  "watercolor",
  "oil",
  "spray",
  "eraser",
];

function shelf() {
  return render(
    <BrushShelf
      tools={TOOLS}
      catalog={TOOLS}
      active="brush"
      color="#2B7FFF"
      size={24}
      kids={false}
      grouped={false}
      organizeOpen={false}
      onOrganizeOpenChange={() => {}}
      onPick={() => {}}
      onToggleSlot={() => {}}
      onMoveSlot={() => {}}
    />,
  );
}

/** Every tool chip's own glyph: the object, never the stroke trace. */
const glyphs = (root: ParentNode) =>
  [...root.querySelectorAll("button[data-tool]")]
    .map((chip) => chip.querySelector("svg[data-brush]"))
    .filter((el): el is SVGSVGElement => el !== null);

afterEach(() => cleanup());

describe("professional shelf: one object per tool", () => {
  it("gives every brush tool its own object glyph", () => {
    const { container } = shelf();
    const brushes = glyphs(container).map((el) => el.getAttribute("data-brush"));
    expect(brushes).toEqual([
      "pencil",
      "charcoal",
      "crayon",
      "marker",
      "brush",
      "watercolor",
      "oil",
      "spray",
      "eraser",
    ]);
  });

  it("never puts two identical glyphs in the same row", () => {
    const { container } = shelf();
    const shapes = glyphs(container).map((el) => el.innerHTML);
    expect(new Set(shapes).size).toBe(shapes.length);
  });

  it("keeps the stroke sample out of the chip", () => {
    const { container } = shelf();
    // The sample lives in the header now; a sample-only chip would have no object.
    const chips = [...container.querySelectorAll("button[data-tool]")];
    for (const chip of chips) {
      const tool = chip.getAttribute("data-tool");
      if (tool === "fill") continue;
      expect(chip.querySelector("svg[data-brush]"), tool ?? "").not.toBeNull();
      // Nothing may be drawn across the object either.
      expect(chip.querySelector('[data-kid-part="trace"]'), tool ?? "").toBeNull();
    }
  });
});
