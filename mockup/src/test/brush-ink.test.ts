// The ninth paint medium — "Nanquim de fio" — proven at the engine's seam.
//
// SEAM UNDER TEST: `stampsOf(stroke)`, the pure and deterministic stamp stream
// that the paper, the thumbnails and the PNG export all replay. Every assertion
// below reads only `x, y, rx, ry, rot, alpha, square` of that stream: not one
// reads a colour, so the proof survives any palette change.
//
// The material comes in through `RasterBrush` (the engine's vocabulary) because
// the shelf cannot wear it yet: the illustrated tool band is one DRAWN glyph per
// tool, generated from an SVG, and there is no nib drawing — see `RasterBrush`.
//
// The eight neighbours are measured here ONLY where the spec asks for a contrast
// (flatness, tip deposit, section). No existing band is re-anchored: this file
// adds the ink and nothing else.
import { describe, expect, it } from "vitest";
import { MAX_STAMPS, stampsOf, type RasterBrush, type Stamp } from "@/mockup/brushCanvas";
import { WIDTH_WINDOW } from "@/mockup/brush";
import type { Point } from "@/mockup/history";

/** A horizontal reference line: the tangent is 0, so `rx` is the width readout. */
const line = (from: number, to: number, step: number, y = 100): Point[] => {
  const points: Point[] = [];
  for (let x = from; x <= to + 0.001; x += step) points.push([x, y]);
  return points;
};

/**
 * The stroke the material has to answer for. `step` 2 is the densest sampling
 * the engine keeps (`SPEED_FLOOR`): the slowest hand it can see, so the numbers
 * of a small brush are not read through the velocity thinning.
 */
const ink = (patch: { id?: string; size?: number; points?: Point[] } = {}) => ({
  id: "ink-body",
  size: 12,
  points: line(0, 300, 2),
  brush: "ink" as const,
  ...patch,
});

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
};

/** The 95th percentile: a band's edge, never one stray mark. */
const p95 = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.95))] ?? Number.NaN;
};

/** Does this mark's footprint cover the artwork point? (Inverse rotation.) */
function covers(stamp: Stamp, x: number, y: number): boolean {
  const dx = x - stamp.x;
  const dy = y - stamp.y;
  const cos = Math.cos(-stamp.rot);
  const sin = Math.sin(-stamp.rot);
  const u = dx * cos - dy * sin;
  const v = dx * sin + dy * cos;
  return (u / stamp.rx) ** 2 + (v / stamp.ry) ** 2 <= 1;
}

/** Mean alpha sum over the middle third: the section's density at one offset. */
const density = (stamps: Stamp[], y: number) => {
  const xs = Array.from({ length: 30 }, (_, i) => 120 + i * 2);
  return (
    xs.reduce(
      (acc, x) => acc + stamps.filter((s) => covers(s, x, y)).reduce((a, s) => a + s.alpha, 0),
      0,
    ) / xs.length
  );
};

/**
 * The step groups, in the order the engine documents: core, file, file. Grouping
 * by position would guess; grouping by the stream's own order asserts it.
 */
const groupsOf = (stamps: Stamp[]): Array<[Stamp, Stamp, Stamp]> => {
  const groups: Array<[Stamp, Stamp, Stamp]> = [];
  for (let i = 0; i + 2 < stamps.length; i += 3) {
    groups.push([stamps[i]!, stamps[i + 1]!, stamps[i + 2]!]);
  }
  return groups;
};

describe("brush ink: three marks per step — one core and two files", () => {
  it("deposits exactly three marks per step, one on each side of the core", () => {
    const stamps = stampsOf(ink());
    expect(stamps.length % 3).toBe(0);

    // 300 units at the profile's 0.05 × 12 = 0.6 step: 500 steps, ± the leftover
    // of the budget walk (the spec allows one step of remainder).
    const steps = stamps.length / 3;
    expect(Math.abs(steps - 500)).toBeLessThanOrEqual(1);

    for (const [core, left, right] of groupsOf(stamps)) {
      const a = left.y - core.y;
      const b = right.y - core.y;
      expect(Math.abs(a), "a file leaves the core").toBeGreaterThan(0);
      expect(Math.abs(b), "a file leaves the core").toBeGreaterThan(0);
      expect(Math.sign(a), "one file per side").toBe(-Math.sign(b));
    }

    // Never the marker's plate, never a radial chip.
    expect(stamps.some((s) => s.square === true)).toBe(false);
  });

  it("keeps the declared step at the larger size too", () => {
    // The PACE is the readout, never one gap: every core carries the profile's
    // own along jitter, so a single interval is a band and the average is the
    // step the profile declares (0.05 × size).
    const stamps = stampsOf(ink({ size: 60 }));
    const cores = stamps.filter((_, i) => i % 3 === 0);
    const gaps = cores.slice(1).map((s, i) => s.x - cores[i]!.x);
    expect(cores.length).toBeGreaterThanOrEqual(100);

    const step = 60 * 0.05;
    const pace = (cores[cores.length - 1]!.x - cores[0]!.x) / (cores.length - 1);
    expect(pace).toBeCloseTo(step, 1);
    expect(median(gaps) / step).toBeGreaterThan(0.85);
    expect(median(gaps) / step).toBeLessThan(1.15);
  });
});

describe("brush ink: the files follow the line, they are not dust", () => {
  it("keeps both files inside the file-shape band of their own core", () => {
    for (const size of [12, 60]) {
      const stamps = stampsOf(ink({ size }));
      for (const [core, ...files] of groupsOf(stamps)) {
        for (const file of files) {
          const across = Math.abs(file.y - core.y);
          // Form of a filament, not a smaller dab: thinner and shorter than the
          // core it belongs to.
          expect(file.ry / core.ry, "file half across").toBeGreaterThanOrEqual(0.25);
          expect(file.ry / core.ry, "file half across").toBeLessThanOrEqual(0.5);
          // Displaced across the line only — a chip at a random angle would fail
          // the next assertion.
          expect(across / core.ry, "across the line").toBeGreaterThanOrEqual(0.2);
          expect(across / core.ry, "across the line").toBeLessThanOrEqual(0.55);
          expect(Math.abs(file.x - core.x), "never along the line").toBeLessThan(0.5 * across);
          // Subordinate deposit: a file never out-paints its core.
          expect(file.alpha).toBeLessThan(core.alpha);
        }
      }
    }
  });

  it("keeps every file on the tangent, where charcoal's dust is a circle", () => {
    // A real angle, so "tangent" is not the axis in disguise.
    const diagonal = Array.from({ length: 31 }, (_, i) => [i * 10, i * 4] as Point);
    const tangent = Math.atan2(120, 300);
    const stamps = stampsOf({ id: "diag", size: 12, points: diagonal, brush: "ink" });
    const deviation = (marks: Stamp[]) => Math.max(...marks.map((s) => Math.abs(s.rot - tangent)));

    expect(deviation(stamps.filter((_, i) => i % 3 !== 0))).toBeLessThan(0.3);
    expect(deviation(stamps.filter((_, i) => i % 3 === 0))).toBeLessThan(0.3);

    // The contrast the test exists for: the charcoal sheds chips drawn in a
    // circle, so their angle is uniform and most of them are far from the line.
    const dust = stampsOf({ id: "diag", size: 12, points: diagonal, brush: "charcoal" });
    expect(dust.filter((s) => Math.abs(s.rot - tangent) > 1.5).length).toBeGreaterThan(20);
  });
});

describe("brush ink: the section sits between the oil's grooves and the brush", () => {
  const flatness = (brush: RasterBrush) =>
    median(
      stampsOf({ id: "wet", size: 12, points: line(0, 300, 6), brush }).map((s) => s.ry / s.rx),
    );

  it("orders the file between the oil's grooves and the brush's round dab", () => {
    // Three bands, from the flat plate to the flat groove: oil (four strips per
    // step, squash 0.35..0.55) < ink (squash 0.58..0.82) < brush (0.72..1) <
    // marker (1, the ruler).
    const oil = flatness("oil");
    const pen = flatness("ink");
    const brush = flatness("brush");
    const marker = flatness("marker");

    expect(oil).toBeLessThan(pen);
    expect(pen).toBeLessThan(brush);
    expect(brush).toBeLessThan(marker);
    expect(marker).toBeCloseTo(1, 2);
  });
});

describe("brush ink: the tips paste, the neighbours only taper", () => {
  /** Median alpha of the 10% extremes over the body's own median. */
  const tipRatio = (brush: RasterBrush, size = 12) => {
    const stamps = stampsOf({ id: "tip", size, points: line(0, 300, 6), brush });
    const byX = [...stamps].sort((a, b) => a.x - b.x);
    const cut = Math.max(1, Math.round(byX.length * 0.1));
    const ends = [...byX.slice(0, cut), ...byX.slice(-cut)];
    return (
      median(ends.map((s) => s.alpha)) /
      median(byX.slice(cut, byX.length - cut).map((s) => s.alpha))
    );
  };

  it("deposits more where the pen lands and lifts", () => {
    expect(tipRatio("ink")).toBeGreaterThanOrEqual(1.15);
    expect(tipRatio("ink", 60)).toBeGreaterThanOrEqual(1.15);
  });

  it("leaves the brush and the marker thinning only", () => {
    expect(tipRatio("brush")).toBeLessThanOrEqual(1.05);
    expect(tipRatio("marker")).toBeLessThanOrEqual(1.05);
  });
});

describe("brush ink: the line covers, and the section is striated", () => {
  const body = stampsOf(ink());

  it("never opens a gap along the middle third", () => {
    // The continuous rule: overlap IS the pigment, so one point of the line is
    // covered by many cores at once — every one of them, not the median.
    const coverage = Array.from({ length: 40 }, (_, i) => 110 + i * 2).map((x) =>
      body.filter((s) => covers(s, x, 100)).reduce((sum, s) => sum + s.alpha, 0),
    );
    expect(Math.min(...coverage)).toBeGreaterThan(1);
  });

  it("rises towards its files, where the brush and the marker only fall", () => {
    const cores = body.filter((_, i) => i % 3 === 0);
    const files = body.filter((_, i) => i % 3 !== 0);
    const fileOffset = median(files.map((s) => Math.abs(s.y - 100)));
    const coreHalf = median(cores.map((s) => s.ry));

    // Three peaks: the centre is a valley between the two files, so the density
    // at a file is HIGHER than at the middle of the line.
    const penRise = density(body, 100 + fileOffset) / density(body, 100);
    expect(penRise).toBeGreaterThanOrEqual(1.05);

    // …and the two continuous neighbours have no second peak to rise to: at the
    // same relative offset their section is already falling.
    const neighbourRise = (brush: RasterBrush) => {
      const stamps = stampsOf({ id: "ink-body", size: 12, points: line(0, 300, 2), brush });
      const half = median(stamps.map((s) => s.ry));
      return density(stamps, 100 + (fileOffset / coreHalf) * half) / density(stamps, 100);
    };
    expect(neighbourRise("brush")).toBeLessThan(penRise);
    expect(neighbourRise("marker")).toBeLessThan(penRise);
    expect(Math.max(neighbourRise("brush"), neighbourRise("marker"))).toBeLessThan(1);
  });
});

describe("brush ink: the authored number is the width on the paper", () => {
  /**
   * The band the material PAINTS: twice the 95th percentile of the outer edge of
   * a mark (its distance from the centreline plus its own half across).
   *
   * This is the one honest reading for the ink, and the reason is geometric: it
   * is the only material with two populations inside one step, so the median of
   * its marks is a FILE while its edge is the CORE. A median-based read reports
   * the files' envelope — 0.70 of the size — for a line whose edge is at 0.95,
   * and the error is not small. For a single-population material both readings
   * agree (the stroke suite's own P95-seat + particle-half lands in this same
   * window for the eight neighbours).
   */
  const painted = (size: number, spacing: number) => {
    const ratios = ["band-a", "band-b", "band-c"]
      .map((id) => {
        const stamps = stampsOf({
          id,
          size,
          points: line(0, 300, spacing),
          brush: "ink" as const,
        });
        return (2 * p95(stamps.map((s) => Math.abs(s.y - 100) + s.ry))) / size;
      })
      .sort((a, b) => a - b);
    return ratios[1]!;
  };

  it("lands inside the parity window at every shelf size", () => {
    // The shelf's own numbers: 3, 6, 10, 16, 24 — plus 60, the size the stroke
    // suite measures bands at. Step 0 of brush-novo §7 is the reason this test
    // exists: the profile's first radius deposited 0.69..0.72 of the size.
    for (const size of [3, 6, 10, 16, 24, 60]) {
      const ratio = painted(size, 2);
      expect(
        Math.abs(ratio - 1),
        `ink@${size} deposits ${ratio.toFixed(3)} of the size`,
      ).toBeLessThanOrEqual(WIDTH_WINDOW);
    }
  });

  it("keeps the window on the suite's own reference line", () => {
    for (const size of [12, 60]) {
      const ratio = painted(size, 6);
      expect(
        Math.abs(ratio - 1),
        `ink@${size} deposits ${ratio.toFixed(3)} of the size`,
      ).toBeLessThanOrEqual(WIDTH_WINDOW);
    }
  });
});

describe("brush ink: bounded, deterministic and round at the tap", () => {
  it("caps a 4000 px stroke at MAX_STAMPS and never starves the grain", () => {
    const long = Array.from({ length: 401 }, (_, i) => [20, 20 + i * 10] as Point);
    const stamps = stampsOf({ id: "long-ink", size: 12, points: long, brush: "ink" });
    expect(stamps.length).toBeLessThanOrEqual(MAX_STAMPS);
    expect(stamps.length).toBeGreaterThan(200);
  });

  it("replays the same marks for the same id and different ones for another", () => {
    expect(stampsOf(ink({ id: "same" }))).toEqual(stampsOf(ink({ id: "same" })));
    expect(stampsOf(ink({ id: "other" }))).not.toEqual(stampsOf(ink({ id: "same" })));
  });

  it("answers a tap with three concentric round marks", () => {
    // The child's finger lands where it landed: no cone, no cloud.
    const tap = stampsOf({ id: "tap", size: 10, points: [[50, 50]], brush: "ink" });
    expect(tap).toHaveLength(3);
    for (const mark of tap) {
      expect(mark.x).toBe(50);
      expect(mark.y).toBe(50);
      expect(mark.rx).toBeCloseTo(mark.ry, 6);
      expect(mark.rot).toBe(0);
    }
  });
});
