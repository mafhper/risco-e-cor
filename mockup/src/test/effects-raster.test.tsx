// Sombra and brilho reach the RASTER as a post-pass per stroke
// (efeitos-chevrons §7.7), and this file measures the two seams that decide it.
//
// Seam 1 — `paintStrokes` against a sink that can hand out an isolated layer.
// The recorded ORDER is the contract: layer first, shadow, glow, and only then
// the crisp stamps on the destination. A stroke without effects never asks for
// a layer at all, which is the "zero cost" half of the same contract.
//
// Seam 2 — the canvas adapter (`canvasSink`): the same pass, in device pixels.
// The fake context records what the substrate was asked to do — blur filter,
// `source-in` tint, blend mode, offset and alpha — so the pixel maths is checked
// without a canvas and the export inherits it for free (same engine).
//
// Every expectation is a value from the spec's table (§7.3) or a ratio between
// two readings, never a copy of the implementation.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { installFakeCanvas, type DrawOp } from "./fake-canvas";
import { exportArtwork, exportPng } from "@/mockup/exportPng";
import { PAPERS } from "@/mockup/palette";
import {
  LOW_POWER_BLUR,
  SHADOW_ALPHA,
  canvasSink,
  paintStrokes,
  stampsOf,
  type EffectLayer,
  type EffectSink,
  type LayerPass,
  type StampSink,
} from "@/mockup/brushCanvas";
import {
  GLOW_DEFAULTS,
  SHADOW_DEFAULTS,
  glowOf,
  shadowOf,
  type StrokeCommand,
} from "@/mockup/history";

const stroke = (patch: Partial<StrokeCommand> = {}): StrokeCommand => ({
  t: "stroke",
  id: "fx",
  color: "#E8423F",
  size: 10,
  points: [
    [20, 120],
    [280, 120],
  ],
  ...patch,
});

/** A shadow that is ON with the factory parameters; `patch` tunes one axis. */
const sombra = (patch: Partial<ReturnType<typeof shadowOf>> = {}) =>
  shadowOf({ ...SHADOW_DEFAULTS, on: true, ...patch });
const brilho = (patch: Partial<ReturnType<typeof glowOf>> = {}) =>
  glowOf({ ...GLOW_DEFAULTS, on: true, ...patch });

type Op = { op: "layer" | "layer-stamp" | "stamp" | "composite"; pass?: LayerPass };

/** A sink that logs which part of itself was used, in order. */
function recordingSink(): { sink: EffectSink; ops: Op[] } {
  const ops: Op[] = [];
  const sink: EffectSink = {
    ellipse: () => ops.push({ op: "stamp" }),
    layer: (): EffectLayer => {
      ops.push({ op: "layer" });
      return {
        ellipse: () => ops.push({ op: "layer-stamp" }),
        composite: (pass) => ops.push({ op: "composite", pass }),
      };
    },
  };
  return { sink, ops };
}

const passes = (ops: Op[]) => ops.flatMap((o) => (o.pass ? [o.pass] : []));
const firstOf = (ops: Op[], kind: Op["op"]) => ops.findIndex((o) => o.op === kind);

describe("the effect pass: isolated layer, fixed order, crisp mark last", () => {
  it("isolates a stroke with an effect and stamps the crisp mark after both passes", () => {
    const { sink, ops } = recordingSink();
    const command = stroke({ sombra: sombra(), brilho: brilho() });
    const painted = paintStrokes(sink, [command]);
    const stamps = stampsOf(command).length;

    // The whole stroke is stamped twice — once into the mask, once as the mark.
    expect(painted).toBe(stamps);
    expect(ops.filter((o) => o.op === "layer-stamp")).toHaveLength(stamps);
    expect(ops.filter((o) => o.op === "stamp")).toHaveLength(stamps);

    // One layer, two composites, and the order is the spec's: the layer is
    // opened before anything is composited, the shadow precedes the glow, and
    // the first crisp stamp comes after both.
    expect(ops.filter((o) => o.op === "layer")).toHaveLength(1);
    expect(passes(ops).map((p) => p.kind)).toEqual(["shadow", "glow"]);
    expect(firstOf(ops, "layer")).toBe(0);
    const lastPass = ops.map((o) => o.op).lastIndexOf("composite");
    expect(firstOf(ops, "stamp")).toBeGreaterThan(lastPass);
  });

  it("paints a stroke with no effect on the plain path, allocating nothing", () => {
    const { sink, ops } = recordingSink();
    const command = stroke();
    const painted = paintStrokes(sink, [command]);

    expect(painted).toBe(stampsOf(command).length);
    expect(ops.every((o) => o.op === "stamp")).toBe(true);
    expect(firstOf(ops, "layer")).toBe(-1);
    expect(passes(ops)).toHaveLength(0);
  });

  it("treats a switch that is off as no effect, whatever the parameters say", () => {
    const { sink, ops } = recordingSink();
    paintStrokes(sink, [
      stroke({ sombra: sombra({ on: false, intensity: 100 }), brilho: brilho({ on: false }) }),
    ]);
    expect(firstOf(ops, "layer")).toBe(-1);
  });

  it("paints the mark without the effect when the sink cannot isolate a layer", () => {
    // A substrate with no scratch canvas still gets the stroke, never an error.
    const seen: number[] = [];
    const plain: StampSink = { ellipse: () => seen.push(1) };
    const command = stroke({ sombra: sombra(), brilho: brilho() });
    expect(paintStrokes(plain, [command])).toBe(stampsOf(command).length);
    expect(seen).toHaveLength(stampsOf(command).length);
  });
});

describe("the shadow pass: black silhouette, offset down, alpha as intensity", () => {
  it("carries the offsets, the blur, the spread and a black tint", () => {
    const { sink, ops } = recordingSink();
    paintStrokes(sink, [
      stroke({ sombra: sombra({ intensity: 50, dx: -2, dy: 2, radius: 3, spread: 1 }) }),
    ]);
    const [shadow] = passes(ops);

    expect(shadow).toMatchObject({
      kind: "shadow",
      // A shadow is depth, not ink: black whatever the stroke's colour is.
      color: "#000000",
      blend: "source-over",
      dx: -2,
      dy: 2,
      blur: 3,
      spread: 1,
    });
  });

  it("turns intensity into a proportional alpha that is never solid", () => {
    const alphaOf = (intensity: number) => {
      const { sink, ops } = recordingSink();
      paintStrokes(sink, [stroke({ sombra: sombra({ intensity }) })]);
      return passes(ops)[0]!.alpha;
    };
    // 100% of the slider is a fraction of black (SHADOW_ALPHA), never a plate.
    expect(alphaOf(100)).toBeCloseTo(SHADOW_ALPHA, 10);
    expect(alphaOf(100)).toBeLessThan(1);
    expect(alphaOf(100)).toBeGreaterThan(0.3);
    // …and half the slider is half the alpha: it is an alpha, not a flag.
    expect(alphaOf(50)).toBeCloseTo(alphaOf(100) / 2, 10);
  });

  it("never paints a shadow when the intensity is zero", () => {
    const { sink, ops } = recordingSink();
    paintStrokes(sink, [stroke({ sombra: sombra({ intensity: 0 }) })]);
    expect(passes(ops)).toHaveLength(0);
    expect(firstOf(ops, "layer")).toBe(-1);
  });
});

describe("the glow pass: additive, in the stroke's colour or a fixed one", () => {
  it("composites additively and follows the stroke's colour on auto", () => {
    const { sink, ops } = recordingSink();
    paintStrokes(sink, [
      stroke({ color: "#2F6FD6", brilho: brilho({ radius: 6, intensity: 60 }) }),
    ]);
    const [glow] = passes(ops);

    expect(glow).toMatchObject({ kind: "glow", blend: "lighter", color: "#2F6FD6", blur: 6 });
    expect(glow!.alpha).toBeCloseTo(0.6, 10);
    expect(glow!.spread).toBe(0);
  });

  it("keeps a custom hex instead of the stroke's colour", () => {
    const { sink, ops } = recordingSink();
    paintStrokes(sink, [
      stroke({ color: "#2F6FD6", brilho: brilho({ color: "#FEBB02", intensity: 80 }) }),
    ]);
    const [glow] = passes(ops);
    expect(glow!.color).toBe("#FEBB02");
    expect(glow!.alpha).toBeCloseTo(0.8, 10);
  });

  it("does not move the shadow when only the glow is on, and vice versa", () => {
    const shadowOnly = recordingSink();
    paintStrokes(shadowOnly.sink, [stroke({ sombra: sombra() })]);
    expect(passes(shadowOnly.ops).map((p) => p.kind)).toEqual(["shadow"]);

    const glowOnly = recordingSink();
    paintStrokes(glowOnly.sink, [stroke({ brilho: brilho() })]);
    expect(passes(glowOnly.ops).map((p) => p.kind)).toEqual(["glow"]);
  });
});

// ---------------------------------------------------------------------------
// Seam 2: the canvas adapter. A recording 2d context, one per canvas.
// ---------------------------------------------------------------------------

/** The recorder is shared with the screen-level suite (`fake-canvas.ts`). */
let fake: ReturnType<typeof installFakeCanvas>;

beforeEach(() => {
  fake = installFakeCanvas();
});

afterEach(() => {
  fake.restore();
});

/** A destination canvas at 2 px per artwork unit, like the paper. */
function destination(scale = 2) {
  const canvas = document.createElement("canvas");
  canvas.width = 300 * scale;
  canvas.height = 300 * scale;
  const view = { x: 0, y: 0, scale };
  const dest = fake.of(canvas);
  return { canvas, view, ops: dest.ops, sink: canvasSink(dest.ctx, view) };
}

const scratches = (dest: HTMLCanvasElement) => fake.createdFor(dest).map((rec) => rec.ops);

describe("the canvas adapter: the same pass, in device pixels", () => {
  it("allocates no scratch canvas and draws no blur when the stroke has no effect", () => {
    const { canvas, sink } = destination();
    paintStrokes(sink, [stroke()]);
    // Zero cost is measured, not assumed: nothing was created behind the page.
    expect(scratches(canvas)).toHaveLength(0);
  });

  it("blurs, tints black with source-in and draws the shadow offset on the page", () => {
    const { canvas, view, ops, sink } = destination();
    paintStrokes(sink, [
      stroke({ sombra: sombra({ intensity: 50, dx: -2, dy: 2, radius: 3, spread: 1 }) }),
    ]);

    const [layer, work] = scratches(canvas);
    expect(scratches(canvas)).toHaveLength(2); // the layer, then the work copy
    expect(layer!.filter((o) => o.op === "ellipse").length).toBeGreaterThan(0);

    // The blur is declared in artwork units and lands in device pixels: 3 × 2.
    const copies = work!.filter((o) => o.op === "drawImage");
    expect(copies).toHaveLength(9); // 8 offsets of the ring + the centre
    expect(copies.every((o) => o.filter === `blur(${3 * view.scale}px)`)).toBe(true);

    // The tint keeps the blurred alpha: fill the silhouette, source-in, black.
    const tint = work!.find((o) => o.op === "fillRect")!;
    expect(tint.composite).toBe("source-in");
    expect(tint.fill).toBe("#000000");

    // On the page: one offset draw at the pass's alpha, under the crisp mark.
    const composed = ops.filter((o) => o.op === "drawImage");
    expect(composed).toHaveLength(1);
    expect(composed[0]!.args[1]).toBe(-2 * view.scale);
    expect(composed[0]!.args[2]).toBe(2 * view.scale);
    expect(composed[0]!.alpha).toBeCloseTo(SHADOW_ALPHA / 2, 10);
    expect(composed[0]!.composite).toBe("source-over");
    expect(ops.findIndex((o) => o.op === "drawImage")).toBeLessThan(
      ops.findIndex((o) => o.op === "ellipse"),
    );
  });

  it("composites the glow additively, with no offset and the glow's own colour", () => {
    const { canvas, ops, sink } = destination();
    paintStrokes(sink, [stroke({ color: "#2F6FD6", brilho: brilho({ intensity: 60 }) })]);

    const [, work] = scratches(canvas);
    expect(work!.filter((o) => o.op === "drawImage")).toHaveLength(1);
    expect(work!.find((o) => o.op === "fillRect")!.fill).toBe("#2F6FD6");

    const composed = ops.filter((o) => o.op === "drawImage");
    expect(composed[0]!.composite).toBe("lighter");
    expect(composed[0]!.args[1]).toBe(0);
    expect(composed[0]!.args[2]).toBe(0);
    expect(composed[0]!.alpha).toBeCloseTo(0.6, 10);
  });

  it("keeps one layer and one scratch for the whole repaint, and the shadow under the glow", () => {
    const { canvas, ops, sink } = destination();
    paintStrokes(sink, [
      stroke({ id: "a", sombra: sombra(), brilho: brilho() }),
      stroke({ id: "b", sombra: sombra({ spread: 3 }) }),
    ]);
    // Two effect strokes, still one layer + one working copy.
    expect(scratches(canvas)).toHaveLength(2);

    // Three composites, in order: shadow, glow, shadow (per stroke, always).
    const composed = ops.filter((o) => o.op === "drawImage");
    expect(composed.map((o) => o.composite)).toEqual(["source-over", "lighter", "source-over"]);
  });

  it("carries the effect into the exported file: same engine, same pass", async () => {
    // The file is not a second renderer: it calls `paintStrokes` with the same
    // sink, so the shadow must appear in the export's own canvas (§7.8).
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    const click = HTMLAnchorElement.prototype.click;
    Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
      configurable: true,
      writable: true,
      value: () => "data:image/png;base64,AA==",
    });
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: () => {},
    });
    try {
      const plan = exportArtwork([stroke({ sombra: sombra() })], null, 300, 300, PAPERS.linho);
      const before = new Set(fake.contexts.keys());
      await exportPng(plan, "sombra.png");

      const created = [...fake.contexts.entries()].filter(([canvas]) => !before.has(canvas));
      // The file's canvas, then the adapter's layer and working copy.
      expect(created).toHaveLength(3);
      const [file] = created;
      const composed = file![1].ops.filter((op) => op.op === "drawImage");
      expect(composed).toHaveLength(1);
      expect(composed[0]!.alpha).toBeCloseTo(SHADOW_ALPHA / 2, 10);
    } finally {
      Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
        configurable: true,
        writable: true,
        value: toDataURL,
      });
      Object.defineProperty(HTMLAnchorElement.prototype, "click", {
        configurable: true,
        writable: true,
        value: click,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// The weak-device fallback (efeitos-chevrons §7.7.6). The tier is a DECLARED
// flag on the profile, so it arrives as `opts.lowPower` and is measured here at
// the same two seams: the pass the stroke asks for, and what the adapter then
// does with it. Nothing below reads a pixel — a count of blurred copies and the
// radius they carry is the whole contract.
// ---------------------------------------------------------------------------

/** A stroke that asks for everything: a wide spread shadow and a huge glow. */
const heavy = (patch: Partial<StrokeCommand> = {}) =>
  stroke({
    id: "heavy",
    sombra: sombra({ radius: 8, spread: 3, dy: 2 }),
    brilho: brilho({ radius: 12 }),
    ...patch,
  });

/** One destination per call, so only THIS call's temporaries are counted. */
function paintWith(command: StrokeCommand, opts: { lowPower?: boolean } = {}) {
  // Canvases already registered by an earlier call in the same test belong to
  // that call's story, not to this one.
  const before = new Set(fake.contexts.keys());
  const dest = destination();
  paintStrokes(dest.sink, [command], opts);
  const temporaries = [...fake.contexts.entries()]
    .filter(([canvas]) => canvas !== dest.canvas && !before.has(canvas))
    .map(([, rec]) => trace(rec.ops));
  return { ...dest, temporaries, trace: trace(dest.ops) };
}

/** Every op as plain data: the canvas an op drew from is not comparable. */
const trace = (ops: DrawOp[]) =>
  ops.map((op) => ({
    op: op.op,
    args: op.args.map((arg) =>
      typeof arg === "number" ? arg : typeof arg === "string" ? arg : "[img]",
    ),
    alpha: op.alpha,
    fill: op.fill,
    composite: op.composite,
    filter: op.filter,
  }));

/** The copies the adapter blurred, across the destination and its temporaries. */
const blurred = (painted: ReturnType<typeof paintWith>) =>
  [...painted.temporaries.flat(), ...painted.trace].filter(
    (op) => op.op === "drawImage" && op.filter !== "none",
  );

describe("the weak-device fallback: contained blur, no spread, one pass per effect", () => {
  it("clamps the radius of both effects at the ceiling and drops the spread", () => {
    const { sink, ops } = recordingSink();
    paintStrokes(sink, [heavy()], { lowPower: true });
    const [shadow, glow] = passes(ops);

    // The ceiling is the spec's number (§7.7.6), not a copy of the constant.
    expect(LOW_POWER_BLUR).toBe(4);
    // The order is the one legal order, lowered tier or not.
    expect(passes(ops).map((p) => p.kind)).toEqual(["shadow", "glow"]);
    expect(shadow).toMatchObject({ blur: 4, spread: 0 });
    expect(glow).toMatchObject({ blur: 4, spread: 0 });
    // A radius already under the ceiling is not rounded up to it.
    const soft = recordingSink();
    paintStrokes(soft.sink, [stroke({ sombra: sombra({ radius: 3, spread: 2 }) })], {
      lowPower: true,
    });
    expect(passes(soft.ops)[0]).toMatchObject({ blur: 3, spread: 0 });
  });

  it("asks the adapter for far fewer blurred copies, and never above the ceiling", () => {
    const full = paintWith(heavy());
    const low = paintWith(heavy(), { lowPower: true });

    // Ring of 8 + the centre for the shadow, one copy for the glow = 10 today.
    expect(blurred(full)).toHaveLength(10);
    // The spread is gone, so each effect is a single copy; both clamped to 4.
    expect(blurred(low)).toHaveLength(2);
    expect(blurred(low).every((op) => op.filter === `blur(${4 * 2}px)`)).toBe(true);
  });

  it("keeps the glow a single pass in both tiers, at its own radius on the full one", () => {
    const glowOnly = () => stroke({ id: "g", brilho: brilho({ radius: 12 }) });
    const full = paintWith(glowOnly());
    const low = paintWith(glowOnly(), { lowPower: true });

    expect(blurred(full)).toHaveLength(1);
    expect(blurred(full)[0]!.filter).toBe(`blur(${12 * 2}px)`);
    expect(blurred(low)).toHaveLength(1);
    expect(blurred(low)[0]!.filter).toBe(`blur(${4 * 2}px)`);
    // One composite per effect, in both tiers: the flag adds no second pass.
    const composites = (p: ReturnType<typeof paintWith>) =>
      p.trace.filter((op) => op.op === "drawImage").length;
    expect(composites(full)).toBe(1);
    expect(composites(low)).toBe(1);
  });

  it("paints exactly today's sequence when the flag is off or absent", () => {
    const absent = paintWith(heavy());
    const declaredOff = paintWith(heavy(), { lowPower: false });

    // One trace for the page, one per temporary: same ops, same order, same
    // filters, same alphas. "Nobody flipped the switch" is a byte-level no-op.
    expect(declaredOff.trace).toEqual(absent.trace);
    expect(declaredOff.temporaries).toEqual(absent.temporaries);
    // …and the values are the ones the full tier always carried.
    expect(absent.temporaries.flat().filter((op) => op.op === "drawImage")).toHaveLength(10);
    expect(absent.temporaries.flat().map((op) => op.filter)).toContain(`blur(${8 * 2}px)`);
  });

  it("holds the same tier for every stroke of one repaint", () => {
    // Three strokes, one tuning, one call: the tier is decided per paint, never
    // per stroke, so the three ask for identical passes.
    const same = () => heavy();
    const low = paintWith(same(), { lowPower: true });
    const again = paintWith(same(), { lowPower: true });
    expect(again.temporaries).toEqual(low.temporaries);

    const { sink, ops } = recordingSink();
    paintStrokes(sink, [heavy({ id: "a" }), heavy({ id: "b" }), heavy({ id: "c" })], {
      lowPower: true,
    });
    const all = passes(ops);
    expect(all).toHaveLength(6); // shadow + glow, three times
    expect(all.every((p) => p.blur === 4 && p.spread === 0)).toBe(true);
  });

  it("costs nothing for a stroke without an effect, in both tiers", () => {
    for (const opts of [{}, { lowPower: true }, { lowPower: false }]) {
      const plain = paintWith(stroke(), opts);
      expect(plain.temporaries).toHaveLength(0);
      expect(plain.trace.every((op) => op.filter === "none")).toBe(true);
      expect(plain.trace.some((op) => op.op === "drawImage")).toBe(false);
    }
  });

  it("never asks the substrate for an SVG filter, in either tier", () => {
    const filters = [
      ...paintWith(heavy()).temporaries.flat(),
      ...paintWith(heavy(), { lowPower: true }).temporaries.flat(),
    ]
      .map((op) => op.filter)
      .filter((filter) => filter !== "none");
    expect(filters.length).toBeGreaterThan(0);
    // The raster path speaks canvas filters and nothing else (§7.7.6).
    expect(filters.every((filter) => /^blur\([\d.]+px\)$/.test(filter))).toBe(true);
    expect(filters.some((filter) => /url\(|feGaussianBlur|feTurbulence/.test(filter))).toBe(false);
  });
});
