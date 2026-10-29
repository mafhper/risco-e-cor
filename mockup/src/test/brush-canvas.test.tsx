// The raster stroke engine, measured at its seams.
//
// Seam 1 (this file, top): `stampsOf` — a pure, deterministic function of the
// command. Every assertion uses a value from the decision docs
// (brush-engine-raster.md, brush-seco-e-spray.md) or a ratio computed from the
// geometry, never a recalculated copy of the implementation.
//
// Seam 1.5: `paintStrokes` writes to a sink that only knows `ellipse`, so the
// stamp flow and the per-stamp alpha are measured with no canvas at all.
//
// Seam 2: the renderer stacks exactly one canvas between two SVGs, and the
// canvas never takes a pointer.
//
// Seam 3 (bottom): the spray nozzle is a panel control that rides INTO the
// command. A slider that changes the screen but not the stroke would pass every
// engine test above, so the end of the chain is measured too.
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gradientStops, installFakeCanvas } from "./fake-canvas";
import { openFold, openTools } from "./open-panel";
import {
  MAX_STAMPS,
  canvasSink,
  paintStrokes,
  stampsOf,
  type Stamp,
  type StampSink,
} from "@/mockup/brushCanvas";
import type { BrushKind } from "@/mockup/brush";
import { WIDTH_WINDOW } from "@/mockup/brush";
import type { Point, SpraySettings, StrokeCommand } from "@/mockup/history";
import { ArtworkPaint } from "@/mockup/ArtworkPaint";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { StoreProvider, useStore } from "@/mockup/store";

const stroke = (patch: Partial<StrokeCommand> = {}): StrokeCommand => ({
  t: "stroke",
  id: "s1",
  color: "#FB2C36",
  size: 8,
  points: [
    [0, 100],
    [300, 100],
  ],
  ...patch,
});

/** A straight horizontal line: the tangent is 0, so `rx` is the width readout. */
const line = (from: number, to: number, step: number, y = 100): Point[] => {
  const points: Point[] = [];
  for (let x = from; x <= to + 0.001; x += step) points.push([x, y]);
  return points;
};

/** Average of a band of stamps (the body of the stroke, never a single dab). */
const meanRx = (stamps: Stamp[]) =>
  stamps.reduce((sum, s) => sum + s.rx, 0) / Math.max(1, stamps.length);

/** Median of a sample: the grain's readout is never one lucky stamp. */
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? Number.NaN;
};

/** The 95th percentile: the BAND's readout (its edge, not one stray particle). */
const p95 = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.95))] ?? Number.NaN;
};

/** The 90th percentile: the outer CONTOUR at one station (dust included, tails not). */
const p90 = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * 0.9))] ?? Number.NaN;
};

/** Does this stamp's footprint cover the artwork point? (Inverse rotation.) */
function covers(stamp: Stamp, x: number, y: number): boolean {
  const dx = x - stamp.x;
  const dy = y - stamp.y;
  const cos = Math.cos(-stamp.rot);
  const sin = Math.sin(-stamp.rot);
  const u = dx * cos - dy * sin;
  const v = dx * sin + dy * cos;
  return (u / stamp.rx) ** 2 + (v / stamp.ry) ** 2 <= 1;
}

const MATERIALS: BrushKind[] = [
  "crayon",
  "charcoal",
  "pencil",
  "brush",
  "marker",
  "watercolor",
  "oil",
  "spray",
];

describe("brush canvas: deterministic", () => {
  it("replays the same stamps for the same id and different ones for another id", () => {
    const a = stampsOf(stroke({ id: "same" }));
    const b = stampsOf(stroke({ id: "same" }));
    expect(b).toEqual(a);

    // The seed is the stroke id: two strokes are never the same grain.
    const c = stampsOf(stroke({ id: "other" }));
    expect(c).not.toEqual(a);
  });

  it("keeps a legacy stroke with no brush on the plain round brush", () => {
    const legacy = stroke();
    delete legacy.brush;
    expect(stampsOf({ ...legacy, brush: "brush" })).toEqual(stampsOf(legacy));
  });
});

describe("brush canvas: the grain accumulates", () => {
  it("never paints an opaque stamp in any material", () => {
    // A real stroke (not a two-point capsule), sampled every 6 px.
    const points = line(0, 300, 6);
    for (const brush of MATERIALS) {
      const stamps = stampsOf(stroke({ brush, id: `acc-${brush}`, size: 12, points }));
      expect(stamps.length, brush).toBeGreaterThan(20);
      for (const s of stamps) {
        expect(s.alpha, brush).toBeGreaterThanOrEqual(0.02);
        expect(s.alpha, brush).toBeLessThan(0.4);
      }
    }
  });

  it("covers one point of a continuous stroke more than a single stamp", () => {
    // A <path> could only set one opacity for the whole line, so overlap never
    // accumulated. The continuous media cover their own step several times: that
    // is what one pass of pigment means. The dry five are measured next door —
    // their density comes from hundreds of lighter particles.
    for (const brush of ["brush", "marker"] as BrushKind[]) {
      const stamps = stampsOf(
        stroke({ brush, id: `acc-${brush}`, size: 12, points: line(0, 300, 6) }),
      );

      // Coverage of one artwork point, sampled along the middle third. The
      // median — not one lucky point — must pass a whole stamp's alpha.
      const band = Array.from({ length: 40 }, (_, i) => 110 + i * 2).map((x) =>
        stamps.filter((s) => covers(s, x, 100)).reduce((sum, s) => sum + s.alpha, 0),
      );
      band.sort((a, b) => a - b);
      expect(band[Math.floor(band.length / 2)]!, brush).toBeGreaterThan(1);
    }
  });

  it("scales every stamp by the authored opacity and by the eraser preview", () => {
    const base = stroke({ brush: "crayon", id: "faded", size: 10, points: line(0, 200, 8) });
    const seen: number[] = [];
    const sink: StampSink = { ellipse: (s) => seen.push(s.alpha) };
    paintStrokes(sink, [base]);
    expect(seen.length).toBeGreaterThan(0);

    const faded = stroke({ ...base, opacity: 50 });
    const fadedAlpha: number[] = [];
    paintStrokes({ ellipse: (s) => fadedAlpha.push(s.alpha) }, [faded], {
      fadedStrokes: new Set([base.id]),
    });
    // 50% authored × 20% eraser preview = 10% of the original deposit, per stamp.
    expect(fadedAlpha[0]).toBeCloseTo(seen[0]! * 0.1, 6);
  });
});

describe("brush canvas: dry media are particles, not bubbles", () => {
  // The table below is §2 of brush-seco-e-spray, and it is the source of every
  // expectation here: a dry medium deposits SMALL particles (radius ≤ 0.18 ×
  // size, alpha 0.05..0.12), and density comes from hundreds of overlapping
  // particles rather than from a few big blobs.
  //
  // The BODY is read elsewhere (brush-core.test): it is not a particle, and the
  // statements here are about the grain — particle size, deposit, flatness,
  // dust — so every readout below drops the `core` stamps and measures exactly
  // what it measured before the body existed.
  const SIZE = 12;
  /** One id for every material, so the per-stroke opacity noise cancels out. */
  const body = (brush: BrushKind) =>
    stampsOf(stroke({ brush, id: "grain", size: SIZE, points: line(0, 300, 6) })).filter(
      (s) => s.core !== true,
    );
  const width = (brush: BrushKind) => median(body(brush).map((s) => s.rx)) / SIZE;
  const opacity = (brush: BrushKind) => median(body(brush).map((s) => s.alpha));

  it("lays hundreds of small, faint particles in every dry material", () => {
    for (const brush of ["charcoal", "crayon", "pencil", "watercolor", "oil"] as BrushKind[]) {
      const stamps = body(brush);
      expect(stamps.length, brush).toBeGreaterThan(200);
      // No bubble: the widest particle is a fraction of the brush size.
      expect(Math.max(...stamps.map((s) => s.rx)) / SIZE, brush).toBeLessThanOrEqual(0.3);
      // Never opaque: pigment accumulates, one particle does not cover.
      expect(Math.max(...stamps.map((s) => s.alpha)), brush).toBeLessThan(0.2);
      // Dry media are not dots: the particle is squashed across the line.
      expect(median(stamps.map((s) => s.ry / s.rx)), brush).toBeLessThan(1);
    }
  });

  it("orders the particles by the width the table gives them", () => {
    // pencil 0.10 < crayon 0.18 < oil 0.20 < watercolor 0.22. Charcoal is
    // measured by its dust next: it is a dab PLUS fragments, so one median
    // would describe neither.
    expect(width("pencil")).toBeLessThan(width("crayon"));
    expect(width("crayon")).toBeLessThan(width("oil"));
    expect(width("oil")).toBeLessThan(width("watercolor"));
    // The faintest medium of the shelf is the wash (0.06).
    expect(opacity("watercolor")).toBeLessThan(opacity("pencil"));
    expect(opacity("watercolor")).toBeLessThan(opacity("crayon"));
    expect(opacity("watercolor")).toBeLessThan(opacity("oil"));
  });

  it("breaks charcoal's edge with fragments, where chalk stays one piece", () => {
    // Charcoal × chalk are separated by the SHAPE of the particle (§2), never by
    // size: charcoal sheds 2-3 fragments per step and chalk is one flat flake.
    // Same spacing, so the count ratio IS the fragment count.
    const charcoal = body("charcoal");
    const chalk = body("crayon");
    expect(charcoal.length).toBeGreaterThan(chalk.length * 2.5);
    expect(charcoal.length).toBeLessThan(chalk.length * 4.5);

    // …and the fragments are smaller than the dab, which the chalk never is:
    // measured against each material's own widest particle.
    const smallest = (stamps: Stamp[]) =>
      median(stamps.map((s) => s.rx)) / Math.max(...stamps.map((s) => s.rx));
    expect(smallest(charcoal)).toBeLessThan(0.7);
    expect(smallest(chalk)).toBeGreaterThan(0.5);
  });

  it("separates charcoal from chalk by the shape of the particle, not its size", () => {
    // brush-separacao §6.1: this pair shares `spacing` and sits a few
    // hundredths of `size` apart in radius ON PURPOSE — what the eye reads is
    // the SHAPE of the deposit. Chalk is one flat flake (its squash ceiling is
    // below the charcoal's), charcoal ranges from a flat chip to a round dab.
    const chalk = body("crayon");
    const charcoal = body("charcoal");
    const flatness = (stamps: Stamp[]) => median(stamps.map((s) => s.ry / s.rx));

    expect(flatness(chalk), "chalk flake").toBeLessThanOrEqual(0.62);
    expect(flatness(charcoal), "charcoal grain").toBeGreaterThanOrEqual(0.55);
    expect(flatness(chalk)).toBeLessThan(flatness(charcoal));

    // …and the border: charcoal throws its dabs and its dust further off the
    // line than chalk ever does, so its contour is broken, never a clean flake.
    // Read at the CONTOUR (the 95th percentile of `|across| + ry`), not at the
    // median: the dust is a tail, and a median only says where the middle of the
    // grain sits — the two materials share that middle on purpose (§6.1).
    const contour = (stamps: Stamp[]) => p95(stamps.map((s) => Math.abs(s.y - 100) + s.ry));
    expect(contour(charcoal)).toBeGreaterThan(contour(chalk) * 1.05);
  });

  it("keeps the oil's bristle grooves: four ridges per step, the others one", () => {
    // Same 0.08 spacing as chalk, so the count is the ridge count.
    const oil = body("oil");
    const chalk = body("crayon");
    expect(oil.length).toBeGreaterThan(chalk.length * 3.5);
    expect(oil.length).toBeLessThan(chalk.length * 4.5);
  });
});

describe("brush canvas: the flat tip is a ruler, the round tip breathes", () => {
  // brush-separacao §6.1: marker × brush share a dense spacing and a large
  // radius ON PURPOSE — what separates them is the BORDER (a flat tip with
  // near-zero scatter) and the deposit (one flat plate vs. an organic dab).
  const SIZE = 12;
  /** One id for both, so the per-stroke opacity noise cancels between them. */
  const body = (brush: BrushKind) =>
    stampsOf(stroke({ brush, id: "wet", size: SIZE, points: line(0, 300, 6) }));
  const plate = body("marker");
  const hair = body("brush");
  const opacity = (stamps: Stamp[]) => median(stamps.map((s) => s.alpha));

  it("makes the marker the more opaque of the two, so it reads flat", () => {
    // The real marker lays down a plate; the brush leaves a veil that the hand
    // works into. Before this, the marker was the fainter of the two.
    expect(opacity(plate)).toBeGreaterThan(opacity(hair) * 1.1);
  });

  it("rules the marker's border and lets the brush wander off it", () => {
    const offLine = (stamps: Stamp[]) => median(stamps.map((s) => Math.abs(s.y - 100) / SIZE));
    expect(offLine(plate)).toBeLessThan(offLine(hair));

    // Every stamp of the marker is a rectangle; not one of the brush is.
    expect(plate.every((s) => s.square === true)).toBe(true);
    expect(hair.some((s) => s.square === true)).toBe(false);
  });
});

describe("brush canvas: the band is parallel, and each material ends its own way", () => {
  // The reference plates show PARALLEL sides and a finish that
  // belongs to the medium. The bench at 40× showed the nine samples as ONE shape:
  // a leaf, because a single shared envelope tapered every tip over 15% of the
  // length. Two statements keep the leaf from coming back — the band does not
  // change width between 20% and 80% of the stroke, and the last marks do what
  // the material does.
  const SIZE = 40;
  const SPAN = 320;
  const marks = (brush: BrushKind, id: string) =>
    stampsOf({ id, size: SIZE, brush, points: line(0, SPAN, 2.5) });

  /**
   * The ENVELOPE of the stroke, station by station.
   *
   * Two steps, and both separate the shape from the grain. First the band is
   * composed column by column over the whole stroke — one threshold for the
   * stroke (half the density of its own middle), because a threshold per window
   * would normalise a taper away. Then the width profile is read as a RUNNING
   * MEDIAN over ±48 units: a grain is symmetric noise and a median ignores it,
   * an envelope is not and a median tracks it. The window is wide on purpose (a
   * finish takes at most 12% of the length, never half the window), and every
   * reading is the median of three strokes — a brush's band IS its grain, and one
   * stroke's dab widths wander ±5% between stations on their own.
   */
  const HALF = SIZE * 0.65;
  const CELL = 0.5;
  const ENVELOPE = 48;

  /** The painted half-width at every column of the stroke, in artwork units. */
  const widthProfile = (stamps: Stamp[]): number[] => {
    const buckets = new Map<number, Stamp[]>();
    for (const stamp of stamps) {
      const reach = Math.max(stamp.rx, stamp.ry) + 1;
      for (let bx = Math.floor(stamp.x - reach); bx <= Math.ceil(stamp.x + reach); bx++) {
        const list = buckets.get(bx);
        if (list) list.push(stamp);
        else buckets.set(bx, [stamp]);
      }
    }
    const columns: number[][] = [];
    for (let x = 0; x <= SPAN; x += CELL) {
      const near = buckets.get(Math.floor(x)) ?? [];
      const column: number[] = [];
      for (let y = 100 - HALF; y <= 100 + HALF; y += CELL) {
        let alpha = 0;
        for (const stamp of near) {
          if (!covers(stamp, x, y)) continue;
          alpha = 1 - (1 - alpha) * (1 - stamp.alpha);
        }
        column.push(alpha);
      }
      columns.push(column);
    }
    const threshold =
      0.5 *
      median(
        columns
          .filter((_, i) => i * CELL > SPAN * 0.35 && i * CELL < SPAN * 0.65)
          .map((column) => column[Math.round((column.length - 1) / 2)]!),
      );
    return columns.map((column) => {
      let run = 0;
      for (const alpha of column) if (alpha >= threshold) run += CELL;
      return run / 2;
    });
  };

  /** The envelope at a fraction of the length: the running median there. */
  const envelopeAt = (profile: number[], fraction: number): number => {
    const centre = Math.round((fraction * SPAN) / CELL);
    const reach = Math.round(ENVELOPE / CELL);
    return median(profile.slice(Math.max(0, centre - reach), centre + reach + 1));
  };

  /**
   * The OUTER contour at a station: the 90th percentile of `|across| + ry` of the
   * marks that land there — the same edge espessura-raster §10.2 reads, and the
   * only reading that survives the can, whose cloud has no band to compose.
   */
  const contourAt = (stamps: Stamp[], fraction: number, spread = 0.03): number => {
    const station = fraction * SPAN;
    const near = stamps.filter((s) => Math.abs(s.x - station) <= SPAN * spread);
    return p90(near.map((s) => Math.abs(s.y - 100) + s.ry));
  };

  it("keeps the authored width from 20% to 80% of the length, in the eight bands", () => {
    // The can is measured apart: a cloud has no band to compose, so the same
    // read is noise on it (see the next test).
    const all: BrushKind[] = [
      "pencil",
      "charcoal",
      "crayon",
      "marker",
      "ink",
      "brush",
      "watercolor",
      "oil",
    ];
    for (const brush of all) {
      const profiles = IDS.map((id) => widthProfile(marks(brush, `parallel-${id}`)));
      for (const station of [0.2, 0.8]) {
        const ratio = medianOf(
          profiles.map((profile) => envelopeAt(profile, 0.5) / envelopeAt(profile, station)),
        );
        expect(
          Math.abs(ratio - 1),
          `${brush} at ${station * 100}%: the band is ${ratio.toFixed(3)} of its middle`,
        ).toBeLessThanOrEqual(0.05);
      }
    }
  });

  /**
   * The median of three strokes: the grain is per id, and a stochastic readout
   * (a cloud's reach, a medium that fails at the lift) is never one stroke's.
   */
  const medianOf = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[1]!;
  };
  const IDS = ["ends-a", "ends-b", "ends-c"] as const;

  it("keeps the can's cone open to the last of the throw", () => {
    // A cloud is its own band and it is SPARSE, so the stations are read on a
    // long throw (four times the plate's stroke) and the readout is how far the
    // droplets reach from the axis — no width factor, because the can declares no
    // end: it simply stops.
    const long = 1200;
    const reach = (id: string, fraction: number) => {
      const cloud = stampsOf({
        id,
        size: SIZE,
        brush: "spray",
        points: line(0, long, 2.5),
      });
      const near = cloud.filter((s) => Math.abs(s.x - fraction * long) <= long * 0.1);
      return p90(near.map((s) => Math.abs(s.y - 100)));
    };
    for (const station of [0.2, 0.8]) {
      const ratio = medianOf(IDS.map((id) => reach(id, 0.5) / reach(id, station)));
      expect(Math.abs(ratio - 1), `can at ${station * 100}%`).toBeLessThanOrEqual(0.05);
    }
    // …and the last of the throw is still a cloud of the same cone.
    expect(medianOf(IDS.map((id) => reach(id, 0.95) / reach(id, 0.5))), "no tip").toBeGreaterThan(
      0.85,
    );
  });

  it("ends by lifting, crumbling, failing, stopping or pooling — never by all tapering", () => {
    // The contour at the very last marks over the body's own. These are the
    // plates' signature: pencil and brush LIFT, the marker STOPS, charcoal
    // crumbles without thinning, chalk keeps the width and loses the deposit,
    // the ink POOLS and the wash BLOOMS.
    const tip = (brush: BrushKind): number => {
      const stamps = marks(brush, `tip-${brush}`);
      return contourAt(stamps, 0.985) / contourAt(stamps, 0.5, 0.06);
    };
    expect(tip("pencil"), "the hand lifts").toBeLessThan(0.65);
    expect(tip("brush"), "the hairs leave").toBeLessThan(0.65);
    for (const brush of ["marker", "charcoal", "crayon", "oil"] as BrushKind[]) {
      expect(tip(brush), `${brush} keeps its width to the end`).toBeGreaterThan(0.9);
    }
    // …and the two that END WIDER: the pen's pool and the wash's bloom.
    expect(tip("ink"), "the pool thickens").toBeGreaterThan(1.05);
    expect(tip("watercolor"), "the pigment spreads").toBeGreaterThan(1.02);
    // Chalk is blunt and FAILS: the contour holds (above) while the DEPOSIT of
    // the last stretch gives out — read on the body's own alpha, because a
    // failure is a hole in the paint and not a notch in the shape.
    const bodyAlpha = (id: string, brush: BrushKind, from: number, to: number) => {
      const body = stampsOf({ id, size: SIZE, brush, points: line(0, SPAN, 2.5) }).filter(
        (s) => s.core === true,
      );
      const near = body.filter((s) => s.x >= SPAN * from && s.x <= SPAN * to);
      return near.reduce((sum, s) => sum + s.alpha, 0) / Math.max(1, near.length);
    };
    const depositRatio = (brush: BrushKind) =>
      medianOf(IDS.map((id) => bodyAlpha(id, brush, 0.94, 1) / bodyAlpha(id, brush, 0.4, 0.6)));
    expect(depositRatio("crayon"), "the last stretch fails").toBeLessThan(0.8);
    // …while the pencil, which only thins, keeps depositing what it always did.
    expect(depositRatio("pencil")).toBeGreaterThan(0.85);
  });

  it("leaves a dot round and a two-point stroke a capsule", () => {
    // A tap is a bubble: one round stamp. Its radius is the profile's own
    // fraction of the size — pinned to a BAND, not to a number: the profiles are
    // tuned by eye, and a literal here turns every tune into a test edit.
    const dot = stampsOf(stroke({ brush: "brush", id: "dot", size: 10, points: [[50, 50]] }));
    expect(dot).toHaveLength(1);
    expect(dot[0]!.rx).toBeGreaterThan(10 * 0.45);
    expect(dot[0]!.rx).toBeLessThan(10 * 0.7);
    expect(dot[0]!.ry).toBeCloseTo(dot[0]!.rx, 5);

    // Two points are a short capsule, never a tapered stroke. The body is a
    // second population and is read in its own suite, so the capsule is the
    // GRAIN: one radius and one height, from the first dab to the last.
    const two = stampsOf(
      stroke({
        brush: "crayon",
        id: "two",
        size: 10,
        points: [
          [0, 100],
          [200, 100],
        ],
      }),
    ).filter((s) => s.core !== true);
    expect(two.length).toBeGreaterThan(10);
    expect(new Set(two.map((s) => s.rx)).size).toBe(1);
    expect(new Set(two.map((s) => s.ry)).size).toBe(1);
  });
});

describe("brush canvas: pressure", () => {
  it("thins the fast stretch of a stroke by at least 15% against its slow one", () => {
    // The same throw: the hand lingers at 2 px per sample, then moves at 20.
    const points = [...line(0, 100, 2), ...line(120, 300, 20)];
    const stamps = stampsOf(stroke({ brush: "brush", id: "speed", size: 6, points }));

    const slow = stamps.filter((s) => s.x > 30 && s.x < 90);
    const fast = stamps.filter((s) => s.x > 150 && s.x < 270);
    expect(slow.length).toBeGreaterThan(10);
    expect(fast.length).toBeGreaterThan(10);
    expect(meanRx(fast)).toBeLessThanOrEqual(meanRx(slow) * 0.85);
  });
});

describe("brush canvas: the authored number is the width on the paper", () => {
  // espessura-raster.md §10.2 — the measure of authority since 27/10: the band a
  // material PAINTS is 2 × the 95th percentile of one stamp's half-width, its
  // displacement across the line plus its own `ry`, read on the profile the
  // engine really stamps. The old account (P95 of the SEAT + the MEDIAN of the
  // particle) mixed a position percentile with a radius median, so any material
  // whose grain has a wide spread — the brush's squash 0.72..1 times its ±18%
  // wobble — was read at its middle and not at its edge: 0.94..0.98 for a line
  // whose painted edge was 1.16. The median is still published as the GRAIN
  // readout, never as the target.
  const SIZE = 60;
  /** The grain's own noise: one id per stroke, so the band is a median of ids. */
  const IDS = ["band-a", "band-b", "band-c"];
  /**
   * `spacing` 6 is the suite's reference line; 2 is the slowest hand the engine
   * can see (`SPEED_FLOOR`), where the velocity thinning costs the least width.
   * Both are charged: the hand is part of the deposit, not an excuse.
   */
  const paintedBand = (brush: BrushKind, size = SIZE, spacing = 6) => {
    const ratios = IDS.map((id) => {
      const stamps = stampsOf(stroke({ brush, id, size, points: line(0, 300, spacing) }));
      return (2 * p95(stamps.map((s) => Math.abs(s.y - 100) + s.ry))) / size;
    });
    ratios.sort((a, b) => a - b);
    return ratios[1]!;
  };

  it("lands all seven stroke media inside 0,90..1,10 of the authored size", () => {
    const strokes: BrushKind[] = [
      "pencil",
      "charcoal",
      "crayon",
      "watercolor",
      "oil",
      "brush",
      "marker",
    ];
    for (const brush of strokes) {
      for (const size of [12, 24, SIZE]) {
        for (const spacing of [6, 2]) {
          const ratio = paintedBand(brush, size, spacing);
          expect(
            Math.abs(ratio - 1),
            `${brush}@${size} (passo ${spacing}) deposits ${ratio.toFixed(3)} of the size`,
          ).toBeLessThanOrEqual(WIDTH_WINDOW);
        }
      }
    }
  });

  it("fills the band with POSITION, leaving every dry particle under the ceiling", () => {
    // The frozen half of the contract: the bed moves the dab, never the grain.
    // The widest dry particle stays at 0.30 of the size (the ceiling from
    // brush-seco-e-spray), and the deposit per stamp stays under 0.20, so the
    // width above is coverage built from hundreds of small particles. The body
    // is the other half of the deposit and has its own ceiling (`MAX_ALPHA`);
    // read as a particle it would only repeat that a body exists.
    for (const brush of ["pencil", "charcoal", "crayon", "watercolor", "oil"] as BrushKind[]) {
      const stamps = stampsOf(
        stroke({ brush, id: "ceiling", size: 12, points: line(0, 300, 6) }),
      ).filter((s) => s.core !== true);
      expect(Math.max(...stamps.map((s) => s.rx)) / 12, brush).toBeLessThanOrEqual(0.3);
      expect(Math.max(...stamps.map((s) => s.alpha)), brush).toBeLessThan(0.2);
    }
  });

  it("sizes the can's cloud by the nozzle's Dispersão, never by a fixed number", () => {
    // §6.1: the can is out of the fixed target — its band is the nozzle's. The
    // dispersion is a ± deviation, so the SEAT's P95 is the number it declares;
    // the droplet (Ponta) then adds its radius on both sides.
    const nozzles: SpraySettings[] = [
      { tip: 0.1, spread: 0.55, intensity: 0.6 },
      { tip: 0.04, spread: 0.55, intensity: 0.6 },
      { tip: 0.2, spread: 1.2, intensity: 1 },
    ];
    for (const nozzle of nozzles) {
      const seats = IDS.map((id) => {
        const stamps = stampsOf(
          stroke({ brush: "spray", id, size: SIZE, points: line(0, 240, 4), spray: nozzle }),
        );
        return p95(stamps.map((s) => Math.abs(s.y - 100))) / SIZE / nozzle.spread;
      });
      seats.sort((a, b) => a - b);
      expect(
        Math.abs(seats[1]! - 1),
        `can ${nozzle.tip}/${nozzle.spread} reaches ${seats[1]!.toFixed(3)} of Dispersão`,
      ).toBeLessThanOrEqual(WIDTH_WINDOW);
    }
  });
});

describe("brush canvas: bounded", () => {
  it("caps a 4000 px stroke at MAX_STAMPS in every material", () => {
    // 401 points, 10 px apart: without the cap this would be ~3000 positions.
    const long = Array.from({ length: 401 }, (_, i) => [20, 20 + i * 10] as Point);
    for (const brush of MATERIALS) {
      const stamps = stampsOf(stroke({ brush, points: long, id: `long-${brush}` }));
      expect(stamps.length, brush).toBeLessThanOrEqual(MAX_STAMPS);
      // The cap is enforced by construction but never starves the grain.
      expect(stamps.length, brush).toBeGreaterThan(200);
    }
    // No clock assertion here on purpose. This block does 8 materials × 401
    // points in ~25 ms, and a wall-clock ceiling on a 25 ms window measures the
    // machine, not the product: with one concurrent suite on the same box the
    // unchanged code measured 153/159/226 ms against the old 150 ms ceiling
    // (1 red run in 3). Re-measured after removing it, five runs under a
    // concurrent suite: 148/183/123/150/110 ms — three of the five would have
    // failed a ceiling the stamps never justified. The bound itself is fully
    // proved by the two assertions above: the count is the contract, and it does
    // not depend on how busy the CPU is.
  });
});

describe("brush canvas: the spray nozzle travels with the mark", () => {
  // §3 of brush-seco-e-spray: the can is the only material whose tip the author
  // tunes. The three numbers are persisted in the command, because undo, the
  // thumbnails and the export replay the command list — a cloud that came back
  // with another nozzle would not be the same cloud.
  const can = (nozzle: SpraySettings | undefined, id = "can") => {
    const base = stroke({ brush: "spray", id, size: 20, points: line(0, 240, 4) });
    return stampsOf(nozzle ? { ...base, spray: nozzle } : base);
  };
  /** How far from the line the cloud reaches, in artwork units. */
  const reached = (stamps: Stamp[]) => Math.max(...stamps.map((s) => Math.abs(s.y - 100)));

  it("replays a stroke saved before the nozzle existed with the shelf's own", () => {
    // The documented defaults: Ponta 0.10, Dispersão 0.55, Intensidade 0.60.
    expect(can(undefined)).toEqual(can({ tip: 0.1, spread: 0.55, intensity: 0.6 }));
  });

  it("sizes the droplet with Ponta and opens the cloud with Dispersão", () => {
    const narrow = can({ tip: 0.04, spread: 0.3, intensity: 0.6 });
    const wide = can({ tip: 0.2, spread: 0.3, intensity: 0.6 });
    expect(median(wide.map((s) => s.rx))).toBeGreaterThan(median(narrow.map((s) => s.rx)) * 3);

    const tight = can({ tip: 0.1, spread: 0, intensity: 0.6 });
    const loose = can({ tip: 0.1, spread: 1.2, intensity: 0.6 });
    // No spread is a line, not a cloud; 1.2 × size is 24 units of deviation.
    expect(reached(tight)).toBeLessThan(1);
    expect(reached(loose)).toBeGreaterThan(12);
  });

  it("throws more paint with Intensidade, in droplets and in opacity", () => {
    const soft = can({ tip: 0.1, spread: 0.55, intensity: 0.2 });
    const hard = can({ tip: 0.1, spread: 0.55, intensity: 1 });
    expect(hard.length).toBeGreaterThanOrEqual(soft.length * 1.6);
    expect(median(hard.map((s) => s.alpha))).toBeGreaterThan(
      median(soft.map((s) => s.alpha)) * 1.4,
    );
  });

  it("answers a tap with a puff instead of a single drop", () => {
    const tap = stampsOf(stroke({ brush: "spray", id: "puff", size: 20, points: [[50, 50]] }));
    expect(tap.length).toBeGreaterThan(1);
  });

  it("keeps the same cloud for the same id, and a different one for another", () => {
    const nozzle: SpraySettings = { tip: 0.16, spread: 0.9, intensity: 0.8 };
    expect(can(nozzle, "a")).toEqual(can(nozzle, "a"));
    expect(can(nozzle, "b")).not.toEqual(can(nozzle, "a"));
  });

  it("caps the most intense can at MAX_STAMPS", () => {
    const long = Array.from({ length: 401 }, (_, i) => [20, 20 + i * 10] as Point);
    const stamps = stampsOf(
      stroke({
        brush: "spray",
        id: "can-long",
        size: 20,
        points: long,
        spray: { tip: 0.2, spread: 1.2, intensity: 1 },
      }),
    );
    expect(stamps.length).toBeLessThanOrEqual(MAX_STAMPS);
    expect(stamps.length).toBeGreaterThan(1000);
  });
});

describe("brush canvas: the can's dab is a sprayed sprite, not a bordered ellipse", () => {
  // §3 + the owner's diagnosis (27/10): the can read as PONTILHISMO — circles
  // with a hard border and varied sizes, read as dots. The defect is the EDGE,
  // not the size: a filled ellipse has the same alpha at its middle and at its
  // rim. The fix is a sprite whose edge is drawn soft (as `fabric-brush` does
  // with its PNG), stamped with `drawImage`.
  //
  // The seam measured here is the canvas adapter against the recording context,
  // so the assertion is "the engine asked the substrate for an IMAGE, never for
  // an ellipse", plus the sprite's own shape (an opaque core and a transparent
  // rim). Whether the pixels look soft is the bench's job — it is the eye, not
  // the ruler, that judges "sprayed".
  let fake: ReturnType<typeof installFakeCanvas>;
  beforeEach(() => {
    fake = installFakeCanvas();
  });
  afterEach(() => fake.restore());

  /** A can's stroke painted on a recording destination at 2 px per unit. */
  const paintCan = (brush: BrushKind = "spray", nozzle?: SpraySettings, color = "#FB2C36") => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const dest = fake.of(canvas);
    const command = stroke({
      brush,
      id: `soft-${brush}`,
      color,
      size: 20,
      points: line(0, 240, 4),
      ...(nozzle ? { spray: nozzle } : {}),
    });
    paintStrokes(canvasSink(dest.ctx, { x: 0, y: 0, scale: 2 }), [command]);
    const stamps = stampsOf(command);
    return {
      canvas,
      ops: dest.ops,
      stamps,
      draws: dest.ops.filter((op) => op.op === "drawImage"),
    };
  };

  it("stamps every mark of the can from the sprite and never from an ellipse", () => {
    const { ops, stamps, draws } = paintCan();
    expect(stamps.length).toBeGreaterThan(100);
    // Nothing of the can is a filled ellipse: the border cannot exist.
    expect(ops.filter((op) => op.op === "ellipse")).toHaveLength(0);
    // One image per mark, drops and veils alike — the cost is the count.
    expect(draws).toHaveLength(stamps.length);
  });

  it("bakes one 64 px sprite per colour and reuses it for the whole stroke", () => {
    // A colour of its own, so the sprite is certainly built during THIS paint:
    // the cache is the session's, and a colour used by an earlier test would
    // arrive already baked.
    const { canvas, draws } = paintCan(undefined, undefined, "#3E5C7A");
    const images = new Set(draws.map((op) => op.args[0]));
    expect(images.size).toBe(1);
    const sprite = [...images][0] as HTMLCanvasElement;
    expect(sprite.width).toBe(64);
    expect(sprite.height).toBe(64);
    // One temporary behind the page: the sprite. Nothing per stamp.
    const created = fake.createdFor(canvas);
    expect(created).toHaveLength(1);
    expect(created[0]!.canvas).toBe(sprite);
  });

  it("draws the sprite's edge soft: an opaque core and a transparent rim", () => {
    const { draws } = paintCan(undefined, undefined, "#5A3E7A");
    const sprite = draws[0]!.args[0] as HTMLCanvasElement;
    const body = fake.of(sprite).ops.find((op) => op.op === "fillRect");
    expect(body).toBeTruthy();
    const stops = gradientStops(body!);
    // Not a two-stop ramp: the atomiser's falloff has a shoulder and a tail.
    expect(stops.length).toBeGreaterThanOrEqual(4);
    // Opaque in the middle…
    expect(stops[0]).toMatch(/,\s*1\)$/);
    // …and fully gone at the rim, which is the softness itself.
    expect(stops[stops.length - 1]).toMatch(/,\s*0\)$/);
  });

  it("leaves every other material on the ellipse", () => {
    const { ops, draws } = paintCan("brush");
    expect(draws).toHaveLength(0);
    expect(ops.filter((op) => op.op === "ellipse").length).toBeGreaterThan(100);
  });

  it("replays the same aerosol for the same stroke, stamp for stamp", () => {
    // Determinism is the whole reason the grain is seeded: undo, the thumbnail
    // and the export re-derive the drawing from the command list.
    const command = stroke({ brush: "spray", id: "replay", size: 20, points: line(0, 240, 4) });
    expect(stampsOf(command)).toEqual(stampsOf({ ...command }));
    // …and the SAME painted ops, alpha and all.
    const trace = (ops: ReturnType<typeof paintCan>["ops"]) =>
      ops.map((op) => [
        op.op,
        op.alpha,
        ...op.args.map((a) => (typeof a === "number" ? a : "img")),
      ]);
    const first = paintCan();
    const again = paintCan();
    expect(trace(again.ops)).toEqual(trace(first.ops));
  });

  it("pays one image per drop plus one veil every three steps", () => {
    // The cost contract, in the nozzle's own numbers: Intensidade 0.6 is
    // `round(0.6 × 5) = 3` droplets per step (the engine's density formula),
    // and the veil is one every MIST_EVERY = 3 steps. Occupancy is +11% of the
    // draws and no more, which is what keeps the sprite affordable.
    const { stamps } = paintCan(undefined, { tip: 0.1, spread: 0.55, intensity: 0.6 });
    const drops = stamps.filter((s) => s.soft === "drop").length;
    const mist = stamps.filter((s) => s.soft === "mist").length;
    const steps = drops / 3;
    expect(Number.isInteger(steps)).toBe(true);
    expect(mist).toBeGreaterThanOrEqual(Math.floor(steps / 3) - 1);
    expect(mist).toBeLessThanOrEqual(Math.ceil(steps / 3) + 1);
    // Before this change a step cost 3 draws; it now costs 3 + 1/3.
    const perStep = (drops + mist) / steps;
    expect(perStep, `${perStep.toFixed(2)} draws per step`).toBeLessThan(3.4);
  });

  it("keeps a GRADIENT can on the sprite, tinting instead of baking per dab", () => {
    // A gradient stroke changes colour stamp by stamp, so no sprite can be baked
    // for it: the adapter tints the mask into one shared scratch and draws it.
    // What must NOT happen is a canvas per dab (that is the allocation the whole
    // sprite exists to avoid) nor a fall back to the hard ellipse.
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const dest = fake.of(canvas);
    const command = stroke({
      brush: "spray",
      id: "soft-gradient",
      size: 20,
      points: line(0, 240, 4),
      gradient: { kind: "linear", stop1: "#000000", stop2: "#FFFFFF", angle: 90 },
    });
    paintStrokes(canvasSink(dest.ctx, { x: 0, y: 0, scale: 2 }), [command], { w: 300, h: 300 });

    const stamps = stampsOf(command);
    const draws = dest.ops.filter((op) => op.op === "drawImage");
    expect(dest.ops.filter((op) => op.op === "ellipse")).toHaveLength(0);
    expect(draws).toHaveLength(stamps.length);
    // Bounded by the sprite cache, never by the number of dabs.
    expect(fake.createdFor(canvas).length).toBeLessThan(stamps.length / 2);
  });
});

describe("brush canvas: one canvas, no node per stamp", () => {
  afterEach(cleanup);

  it("paints the command list through the sink, and the erase command removes it", () => {
    const s = stroke({ brush: "crayon", size: 10, points: line(0, 200, 8) });
    const seen: Stamp[] = [];
    const painted = paintStrokes({ ellipse: (stamp) => seen.push(stamp) }, [s]);
    expect(painted).toBe(stampsOf(s).length);
    expect(seen).toEqual(stampsOf(s));

    const erased = paintStrokes({ ellipse: () => {} }, [s, { t: "erase", strokeIds: [s.id] }]);
    expect(erased).toBe(0);
  });

  it("keeps a gradient stroke's paint across the canvas, not one flat colour", () => {
    const gradient = { kind: "linear" as const, stop1: "#000000", stop2: "#FFFFFF", angle: 90 };
    const colors: string[] = [];
    paintStrokes(
      { ellipse: (_stamp, color) => colors.push(color) },
      [stroke({ id: "grad", points: line(0, 300, 6), gradient })],
      { w: 300, h: 300 },
    );
    // Angle 90 runs left to right: the first stamp is the first stop, and the
    // body sweeps the whole axis instead of collapsing to the stroke colour.
    expect(colors[0]).toBe("#000000");
    expect(new Set(colors).size).toBeGreaterThan(10);
    expect(colors[colors.length - 1]).not.toBe("#000000");
  });

  it("paints the command list onto the canvas, in device pixels, and repaints from zero", () => {
    const ellipses: Array<{
      x: number;
      y: number;
      rx: number;
      ry: number;
      alpha: number;
      color: string;
    }> = [];
    let clears = 0;
    let alpha = 1;
    let fill = "";
    const ctx = {
      get globalAlpha() {
        return alpha;
      },
      set globalAlpha(v: number) {
        alpha = v;
      },
      get fillStyle() {
        return fill;
      },
      set fillStyle(v: string) {
        fill = v;
      },
      clearRect: () => {
        clears++;
      },
      beginPath: () => {},
      ellipse: (x: number, y: number, rx: number, ry: number) => {
        ellipses.push({ x, y, rx, ry, alpha, color: fill });
      },
      fill: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
    };
    const proto = HTMLCanvasElement.prototype;
    const original = proto.getContext;
    proto.getContext = (() => ctx) as unknown as typeof proto.getContext;

    try {
      const s = stroke({ brush: "crayon", id: "painted", size: 10, points: line(0, 200, 6) });
      const { rerender } = render(<ArtworkPaint pageId={null} w={300} h={600} commands={[s]} />);

      // The SAME stamps the seam produced, at 2 px per artwork unit.
      const stamps = stampsOf(s);
      expect(ellipses).toHaveLength(stamps.length);
      expect(clears).toBe(1);
      expect(ellipses[0]!.x).toBeCloseTo(stamps[0]!.x * 2, 5);
      expect(ellipses[0]!.y).toBeCloseTo(stamps[0]!.y * 2, 5);
      expect(ellipses[0]!.rx).toBeCloseTo(stamps[0]!.rx * 2, 5);
      expect(ellipses[0]!.alpha).toBeCloseTo(stamps[0]!.alpha, 5);
      expect(ellipses[0]!.color).toBe("#FB2C36");

      // The stroke in progress rides on top of the committed list.
      const liveStroke = stroke({ id: "live", size: 10, points: line(0, 80, 6) });
      ellipses.length = 0;
      rerender(<ArtworkPaint pageId={null} w={300} h={600} commands={[s]} live={liveStroke} />);
      expect(ellipses).toHaveLength(stampsOf(s).length + stampsOf(liveStroke).length);

      // Undo/erase is a command, so the repaint simply has nothing to draw.
      ellipses.length = 0;
      const clearsBefore = clears;
      rerender(
        <ArtworkPaint
          pageId={null}
          w={300}
          h={600}
          commands={[s, { t: "erase", strokeIds: [s.id] }]}
        />,
      );
      expect(clears).toBe(clearsBefore + 1);
      expect(ellipses).toHaveLength(0);
    } finally {
      proto.getContext = original;
    }
  });

  it("renders exactly one canvas between two SVGs, and the canvas takes no pointer", () => {
    const { container } = render(
      <ArtworkPaint pageId={null} w={600} h={600} commands={[stroke({ brush: "crayon" })]} />,
    );

    const canvases = container.querySelectorAll("canvas");
    expect(canvases).toHaveLength(1);
    const layers = [...container.querySelectorAll("svg, canvas")].map((n) =>
      n.tagName.toLowerCase(),
    );
    // The order IS the artwork: flat colour, then paint, then the printed line.
    expect(layers).toEqual(["svg", "canvas", "svg"]);

    const [regions, outline] = container.querySelectorAll("svg");
    expect(regions!.classList.contains("pointer-events-none")).toBe(false);
    // The ink is over the paint but must not eat the child's bucket tap: the
    // regions layer below it is the one that answers `data-region`.
    expect(outline!.classList.contains("pointer-events-none")).toBe(true);

    const canvas = canvases[0]!;
    expect(canvas.style.pointerEvents).toBe("none");
    // 2× the artwork units by default, and never one node per stamp.
    expect(canvas.getAttribute("width")).toBe("1200");
    expect(canvas.getAttribute("height")).toBe("1200");
    expect(container.querySelectorAll("path[data-layer]")).toHaveLength(0);
  });
});

describe("brush canvas: the nozzle is a panel control that reaches the command", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  /** The studio for a pro profile, with the last command exposed as JSON. */
  function Desk() {
    const { state, dispatch } = useStore();
    useEffect(() => {
      dispatch({ type: "selectProfile", id: "maria" });
    }, [dispatch]);
    const art = state.artworks.find((a) => a.profileId === "maria" && a.pageId === "peixe");
    if (!art) return null;
    return (
      <>
        <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
        <output data-testid="last-command">
          {JSON.stringify(art.history.commands.at(-1) ?? null)}
        </output>
      </>
    );
  }

  it("offers the three controls only for the can, and writes them into the stroke", () => {
    render(
      <StoreProvider>
        <Desk />
      </StoreProvider>,
    );

    // Every other material has no nozzle: a slider that changes nothing is a lie.
    openTools();
    // The nozzle is a control of the Ajustes fold, which opens CLOSED.
    openFold("fold-ajustes");
    fireEvent.click(screen.getByLabelText("Pincel"));
    expect(screen.queryByLabelText("Ponta")).toBeNull();

    fireEvent.click(screen.getByLabelText("Spray"));
    const range = (label: string) => {
      const control = screen.getByLabelText(label);
      return [control.getAttribute("min"), control.getAttribute("max")];
    };
    expect(range("Ponta")).toEqual(["0.04", "0.2"]);
    expect(range("Dispersão")).toEqual(["0", "1.2"]);
    expect(range("Intensidade")).toEqual(["0.2", "1"]);

    fireEvent.change(screen.getByLabelText("Ponta"), { target: { value: "0.18" } });
    fireEvent.change(screen.getByLabelText("Dispersão"), { target: { value: "1.1" } });
    fireEvent.change(screen.getByLabelText("Intensidade"), { target: { value: "0.9" } });

    // The first touch on the paper collapses the panel and starts the stroke.
    const paper = screen.getByTestId("paper-view").querySelector("svg")!;
    fireEvent.pointerDown(paper, { pointerId: 1, clientX: 40, clientY: 60 });
    fireEvent.pointerUp(paper, { pointerId: 1, clientX: 80, clientY: 90 });

    const command = JSON.parse(screen.getByTestId("last-command").textContent!) as StrokeCommand;
    expect(command.brush).toBe("spray");
    expect(command.spray).toEqual({ tip: 0.18, spread: 1.1, intensity: 0.9 });
  });
});
