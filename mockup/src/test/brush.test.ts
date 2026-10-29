// Seams under test:
//  1. brush catalog — the six shelf tools render a distinguishable stroke
//  2. stroke geometry — width/dash per brush, eraser separate from paint
//  3. SVG filters — shadow, glow and the combined filter get stable ids
import { describe, expect, it } from "vitest";
import {
  BRUSH_SHELF,
  brushStroke,
  DEFAULT_EFFECTS,
  filterIdFor,
  isPaintBrush,
  THICKNESS_TOLERANCE,
  WIDTH_WINDOW,
  type BrushKind,
} from "@/mockup/brush";

describe("brush shelf", () => {
  it("lists every media in drawing order, eraser last", () => {
    expect(BRUSH_SHELF.map((b) => b.id)).toEqual([
      "pencil",
      "charcoal",
      "crayon",
      "marker",
      "brush",
      "watercolor",
      "oil",
      "spray",
      "ink",
      "eraser",
    ]);
    expect(BRUSH_SHELF.filter((b) => isPaintBrush(b.id))).toHaveLength(9);
  });

  it("gives each tool its own glyph, name and sample path", () => {
    const glyphs = new Set(BRUSH_SHELF.map((b) => b.icon));
    expect(glyphs.size).toBe(BRUSH_SHELF.length); // never one generic brush
    for (const b of BRUSH_SHELF) {
      expect(b.label.length).toBeGreaterThan(2);
      expect(b.short.length).toBeGreaterThan(2);
      expect(b.sample.length).toBeGreaterThan(4);
    }
  });
});

describe("stroke geometry: the number is the thickness (owner's rule, 26/10)", () => {
  const KINDS: BrushKind[] = [
    "pencil",
    "charcoal",
    "crayon",
    "marker",
    "brush",
    "watercolor",
    "oil",
    "spray",
    "ink",
    "eraser",
  ];

  it("gives every material the same band, within the declared tolerance", () => {
    // Independent of the table: the rule is "same authored size, same band" and
    // the tolerance is the one the module publishes. Before this the factors ran
    // 0.45..2.2 — a 37 was a 17px pencil and an 81px wash.
    for (const size of [1, 3, 12, 37, 60, 100]) {
      for (const kind of KINDS) {
        const width = brushStroke(kind, size).width;
        expect(Math.abs(width / size - 1), `${kind}@${size} = ${width}`).toBeLessThanOrEqual(
          THICKNESS_TOLERANCE,
        );
      }
    }
  });

  it("declares every band inside the parity window the paper is held to", () => {
    // espessura-raster.md §6.1: the SINGLE target is the authored size — the
    // preview declares it here and the raster engine deposits it there, both
    // charged against the same ±10%. A factor outside `WIDTH_WINDOW` would put
    // the preview out of the paper's window even with the engine perfectly
    // calibrated, which is the divergence this suite exists to close.
    for (const kind of KINDS) {
      for (const size of [3, 12, 37, 100]) {
        const width = brushStroke(kind, size).width;
        expect(Math.abs(width / size - 1), `${kind}@${size} = ${width}`).toBeLessThanOrEqual(
          WIDTH_WINDOW,
        );
      }
    }
  });

  it("keeps the shelf distinguishable now that every band is near the number", () => {
    // Conforming the weight must not collapse the table into one factor: the
    // nine paint media still declare different bands at the same authored size
    // (the pencil is the finest, the wash the widest), and identity keeps living
    // in the dash, the cap and the wash.
    const bands = [
      "pencil",
      "charcoal",
      "crayon",
      "marker",
      "brush",
      "watercolor",
      "oil",
      "spray",
      "ink",
    ].map((kind) => brushStroke(kind as BrushKind, 100).width);
    expect(new Set(bands).size).toBeGreaterThanOrEqual(6);
    expect(brushStroke("pencil", 100).width).toBeLessThan(brushStroke("marker", 100).width);
    expect(brushStroke("marker", 100).width).toBeLessThan(brushStroke("watercolor", 100).width);
  });

  it("keeps each medium's identity in the dash, the cap and the wash", () => {
    expect(brushStroke("brush", 10)).toEqual({ width: 10, linecap: "round" });
    expect(brushStroke("marker", 10).linecap).toBe("square");
    expect(brushStroke("crayon", 10).dasharray).toBeTruthy();
    expect(brushStroke("spray", 10).dasharray).toBeTruthy();
    // Aquarela lays a wash; carvão leaves dust.
    expect(brushStroke("watercolor", 10).opacity).toBeLessThan(1);
    expect(brushStroke("charcoal", 10).opacity).toBeLessThan(1);
    // Every tool still has its own sample: conforming the weight must not turn
    // the shelf into one drawing nine times.
    expect(new Set(BRUSH_SHELF.map((b) => `${b.sampleWidth}:${b.dasharray ?? ""}`)).size).toBe(
      BRUSH_SHELF.length,
    );
  });

  it("never returns a zero-width stroke, even for the smallest size", () => {
    expect(brushStroke("pencil", 1).width).toBeGreaterThanOrEqual(1);
  });

  it("falls back to the plain brush for legacy strokes without a brush kind", () => {
    expect(brushStroke(undefined, 9)).toEqual(brushStroke("brush", 9));
  });
});

describe("effects", () => {
  it("defaults to plain, fully opaque strokes", () => {
    expect(DEFAULT_EFFECTS).toEqual({ shadow: false, glow: false, opacity: 100 });
  });

  it("gives each effect combination its own filter id", () => {
    expect(filterIdFor(false, false)).toBeNull();
    expect(filterIdFor(true, false)).toBe("fx-shadow");
    expect(filterIdFor(false, true)).toBe("fx-glow");
    expect(filterIdFor(true, true)).toBe("fx-shadow-glow");
  });
});

describe("paint brushes", () => {
  it("excludes the eraser from the painting tools", () => {
    const kinds: BrushKind[] = [
      "pencil",
      "charcoal",
      "crayon",
      "marker",
      "brush",
      "watercolor",
      "oil",
      "spray",
      "ink",
    ];
    expect(kinds.every(isPaintBrush)).toBe(true);
    expect(isPaintBrush("eraser")).toBe(false);
  });
});
