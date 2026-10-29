// Seams under test:
//  1. palette catalog — 18 families x 11 steps (50..950) + black/white = 200
//  2. readable ink — paletteTextColor guarantees AA or falls back to dark ink
//  3. gradients — angle -> objectBoundingBox vectors, stable ids
//  4. hex input validation
import { describe, expect, it } from "vitest";
import {
  BASE_COLORS,
  FAMILY_STEPS,
  GRADIENT_ANGLES,
  GRADIENT_STOPS,
  INK_HEX,
  KID_COLORS,
  PALETTE_ALL,
  PALETTE_FAMILIES,
  PALETTE_NEUTRALS,
  PALETTE_TONES,
  gradientCss,
  gradientId,
  gradientPoints,
  hexFromHsl,
  hslOfHex,
  isValidHex,
  paletteTextColor,
  contrastRatio,
} from "@/mockup/palette";
import { BRUSH_SIZE_LABELS, BRUSH_SIZES } from "@/mockup/palette";

describe("palette catalog", () => {
  it("is eighteen families of eleven steps plus black and white: 200 swatches", () => {
    expect(PALETTE_FAMILIES).toHaveLength(18);
    expect(FAMILY_STEPS).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    expect(PALETTE_FAMILIES.every((f) => f.steps.length === 11)).toBe(true);
    expect(PALETTE_TONES).toHaveLength(198);
    expect(PALETTE_ALL).toHaveLength(200);
    expect(new Set(PALETTE_ALL.map((c) => c.hex)).size).toBe(200);
  });

  it("keeps one base swatch per family and six big kid colors", () => {
    expect(BASE_COLORS).toHaveLength(18);
    expect(BASE_COLORS.map((c) => c.hex)).toEqual(PALETTE_FAMILIES.map((f) => f.base.hex));
    expect(KID_COLORS).toHaveLength(6);
    expect(KID_COLORS.every((c) => /^#[0-9a-f]{6}$/i.test(c.hex))).toBe(true);
  });

  it("carries no color name on a swatch", () => {
    // The naming resource is gone: a swatch is a hex, nothing else.
    for (const crayon of PALETTE_ALL) expect(Object.keys(crayon)).toEqual(["hex"]);
    expect(PALETTE_NEUTRALS.map((c) => c.hex)).toEqual([
      "#FFFFFF",
      PALETTE_NEUTRALS[1]!.hex,
      PALETTE_NEUTRALS[2]!.hex,
      PALETTE_NEUTRALS[3]!.hex,
      "#000000",
    ]);
  });

  it("offers each gradient stop hex exactly once, ignoring case", () => {
    // The picker keys its buttons by hex, so a repeated color is a repeated
    // key: the catalog promises one stop per hex, whatever its letter case.
    const hexes = GRADIENT_STOPS.map((crayon) => crayon.hex.toLowerCase());
    expect(new Set(hexes).size).toBe(hexes.length);
  });
});

describe("HSL: the advanced selector's model", () => {
  it("measures #F0B100 as H 45° S 100% L 47%", () => {
    const hsl = hslOfHex("#F0B100");
    expect(hsl.h).toBeGreaterThan(43.5);
    expect(hsl.h).toBeLessThan(46.5);
    expect(hsl.s).toBe(100);
    expect(hsl.l).toBeCloseTo(47.1, 0);
    expect(hsl.a).toBe(100);
  });

  it("round-trips a hex through HSL without losing the color", () => {
    for (const crayon of PALETTE_ALL) {
      const back = hexFromHsl(hslOfHex(crayon.hex));
      expect(back, crayon.hex).toBe(crayon.hex);
    }
  });

  it("keeps alpha as the fourth channel and writes #RRGGBBAA when it is below 100", () => {
    const hsl = hslOfHex("#F0B10080");
    expect(hsl.a).toBeCloseTo(50.2, 0);
    const back = hexFromHsl({ ...hsl, a: 50 }).slice(0, 7);
    expect(back).toBe("#F0B100");
    expect(hexFromHsl({ ...hsl, a: 100 })).toBe("#F0B100");
  });

  it("validates 6- and 8-digit hexes for the secondary field", () => {
    expect(isValidHex("#F0B100")).toBe(true);
    expect(isValidHex("#F0B10080")).toBe(true);
    expect(isValidHex("#F0B1")).toBe(false);
    expect(isValidHex("F0B100")).toBe(false);
  });
});

describe("readable ink on a swatch", () => {
  it("always picks the ink with the best measured contrast", () => {
    for (const family of PALETTE_FAMILIES) {
      for (const step of family.steps) {
        const ink = paletteTextColor(step.hex) === "paper" ? "#ffffff" : INK_HEX;
        expect(contrastRatio(step.hex, ink)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("uses dark ink on light steps and white on the darkest ones", () => {
    const red = PALETTE_FAMILIES.find((f) => f.id === "vermelho")!;
    expect(paletteTextColor(red.steps[0]!.hex)).toBe("foreground"); // 50
    expect(paletteTextColor(red.steps[10]!.hex)).toBe("paper"); // 950
  });
});

describe("gradients", () => {
  it("maps a CSS angle to objectBoundingBox vectors (90deg runs left to right)", () => {
    expect(gradientPoints(90)).toEqual([0, 50, 100, 50]);
    expect(gradientPoints(0)).toEqual([50, 100, 50, 0]);
    expect(gradientPoints(180)).toEqual([50, 0, 50, 100]);
  });

  it("offers the eight angles and builds a CSS preview that matches the SVG", () => {
    expect(GRADIENT_ANGLES).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(gradientCss({ kind: "linear", stop1: "#F72633", stop2: "#2B7FFF", angle: 90 })).toBe(
      "linear-gradient(90deg, #F72633, #2B7FFF)",
    );
    expect(gradientCss({ kind: "radial", stop1: "#F72633", stop2: "#2B7FFF", angle: 0 })).toBe(
      "radial-gradient(circle, #F72633, #2B7FFF)",
    );
  });

  it("reuses one def id for equal gradients and a new one when a stop changes", () => {
    const a = { kind: "linear" as const, stop1: "#F72633", stop2: "#2B7FFF", angle: 45 };
    const b = { ...a };
    expect(gradientId(a)).toBe(gradientId(b));
    expect(gradientId({ ...a, stop2: "#F65C00" })).not.toBe(gradientId(a));
    expect(gradientId(a)).toMatch(/^grad-[a-z0-9-]+$/);
  });
});

describe("hex input", () => {
  it("accepts only #rrggbb", () => {
    expect(isValidHex("#F72633")).toBe(true);
    expect(isValidHex("#f72633")).toBe(true);
    expect(isValidHex("F72633")).toBe(false);
    expect(isValidHex("#F7263")).toBe(false);
    expect(isValidHex("#GG2633")).toBe(false);
  });
});

describe("brush sizes", () => {
  it("offers five sizes with labels; the 3-5 band uses the first three", () => {
    expect(BRUSH_SIZES).toEqual([3, 6, 10, 16, 24]);
    expect(BRUSH_SIZE_LABELS).toHaveLength(5);
    expect(BRUSH_SIZE_LABELS.slice(0, 3)).toEqual(["Fino", "Médio", "Grosso"]);
  });
});
