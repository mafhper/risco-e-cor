// The raster stroke engine: paint is STAMPED onto a canvas, not drawn as one
// vector path.
//
// In a single <path> every sub-path shares one fill and one opacity, so
// overlapping marks never accumulate alpha (the nonzero rule). That is the
// structural reason crayon, charcoal and watercolour read as "a ribbon with
// stripes" instead of pigment (brush-engine-raster.md). Here every stamp is its
// own ellipse with its own `globalAlpha`, so density comes from overlap — the
// way chalk deposits wax and a wash stacks veils.
//
// Seams that keep this testable without a real canvas:
//   - `stampsOf(stroke)` is pure and deterministic: the same command always
//     yields the same stamps, because undo/redo, autosave and the thumbnails
//     all re-derive the drawing from the command list.
//   - `paintStrokes(sink, commands)` talks to a sink that only knows how to
//     draw one ellipse. A stroke that carries sombra/brilho also asks that sink
//     for an ISOLATED LAYER, so the effect is measured as an order of passes
//     (layer → shadow → glow → crisp mark) instead of as pixels.
//   - `canvasSink` is the only adapter that touches a real context: it turns
//     those passes into blur, `source-in` tint and a blended `drawImage`, which
//     is what makes the screen and the PNG agree. It is also the only place that
//     knows what a SPRITE is: a stamp marked `soft` (the can's droplets and its
//     haze) is stamped from a 64 px image whose border is drawn soft, never from
//     a filled ellipse — a filled ellipse has the same alpha at its middle and
//     at its rim, and a cloud of those reads as pointillism.
//
// Nothing here creates a DOM node per stamp: a whole stroke is one canvas, and
// the isolated layer lives only while a stroke with an effect is being painted.
import type { BrushKind, PaintBrush } from "./brush";
import {
  SPRAY_DEFAULTS,
  cumulativeLengths,
  derive,
  glowOf,
  inGap,
  nozzleOf,
  originIndexes,
  shadowOf,
  type Command,
  type Gap,
  type Point,
  type StrokeCommand,
} from "./history";
import { gradientPoints, type StrokeGradient } from "./palette";
import { hashId, seeded } from "./random";

/**
 * The materials the raster engine can stamp. Wider than the shelf ON PURPOSE:
 * `ink` (the pen line of brush-novo §6.2) lands here first, where its profile,
 * its threads and its tip paste are proven by the stroke suite, and the shelf
 * wears it once its own drawn glyph exists — the illustrated band is one
 * drawing per tool, generated from its SVG, so a tool cannot reach the shelf
 * without one. Until then nothing a command can carry points here, and nothing
 * else in the engine knows the difference.
 */
export type RasterBrush = PaintBrush | "ink";

/** One dab of paint. `rx` runs along the stroke, `ry` across it. */
export type Stamp = {
  x: number;
  y: number;
  /** Half-width along the stroke, in artwork units. */
  rx: number;
  /** Half-width across the stroke, in artwork units. */
  ry: number;
  /** Rotation in radians (the stroke's tangent, plus the material's wobble). */
  rot: number;
  /** Opacity of this single stamp, 0.02..0.35. Never 1: density is overlap. */
  alpha: number;
  /** Flat tip: the canvas adapter draws a rectangle instead of an ellipse. */
  square?: boolean;
  /**
   * This dab is not an ellipse with a border: it is the ATOMISED SPRITE of the
   * can (`spriteOf`), stamped with `drawImage`. `"drop"` is one droplet of the
   * cloud and `"mist"` is the veil under it (`MIST_EVERY`) — a wide, very faint
   * puff that turns a row of dots into aerosol. It is a field of the STAMP and
   * not a flag of the sink on purpose: the sink only knows how to place a mark,
   * and the mark is what the command declares, so undo, the export and the
   * bench all replay the same aerosol.
   *
   * Only the spray declares it. Every other material stamps ellipses and pays
   * nothing for this field.
   */
  soft?: "drop" | "mist";
  /**
   * This dab is the material's BODY — the continuous deposit under the grain —
   * and not one of its particles. The two are counted apart on purpose: the
   * grain's identity (particle size, flatness, dust) is measured on the
   * particles, and the body is measured on the composition of the whole stroke
   * (`brush-core.test`). The flag is also the paint order: every body stamp of a
   * stroke lands before its first particle, so the texture rides on top.
   */
  core?: boolean;
};

/** The only thing `paintStrokes` knows about its destination. */
export type StampSink = {
  ellipse: (stamp: Stamp, color: string) => void;
};

/**
 * One composited pass of an isolated layer: the shadow or the glow.
 *
 * It is declared in ARTWORK UNITS, like every other number of the engine, and
 * the adapter turns units into device pixels with the same `view.scale` it uses
 * for the stamps. That is what makes the paper and the PNG agree: the same
 * command and the same pass, at two different raster scales.
 */
export type LayerPass = {
  kind: "shadow" | "glow";
  /** Alpha that reaches the destination, 0..1. */
  alpha: number;
  /** Gaussian blur of the silhouette, in artwork units. */
  blur: number;
  /** Growth applied to the silhouette BEFORE the blur, in artwork units. */
  spread: number;
  /** Destination offset, in artwork units. */
  dx: number;
  dy: number;
  /** The tint the silhouette is filled with. */
  color: string;
  /** "source-over" for the shadow, "lighter" for the glow. */
  blend: "source-over" | "lighter";
};

/**
 * An isolated, transparent layer the size of the destination. Stamps land here
 * first; `composite` reads the layer's ALPHA (never its colours) and paints it
 * into the destination. It does not consume the layer, so one stroke asks for
 * the shadow and the glow from the same silhouette.
 */
export type EffectLayer = StampSink & {
  composite: (pass: LayerPass) => void;
};

/**
 * A sink that can hand out isolated layers. `layer()` is called once per stroke
 * that CARRIES an effect and never otherwise — the "zero cost with the effects
 * off" rule. A sink without it still paints every stroke, plain.
 */
export type EffectSink = StampSink & {
  layer: () => EffectLayer;
};

/**
 * The most opaque a shadow gets: 100% of the slider is ~45% black on the paper,
 * never a flat silhouette. A shadow is depth under the ink, not a second mark.
 */
export const SHADOW_ALPHA = 0.45;

/**
 * The ceiling a weak device's effect blur is contained to, in ARTWORK UNITS
 * (efeitos-chevrons §7.7.6). Above it a full-paper blur costs more than the
 * effect buys, so the fallback clamps the radius here instead of guessing the
 * device: the tier is declared by a person (`Profile.lowPower`), never measured.
 */
export const LOW_POWER_BLUR = 4;

/** The layer's own powers, or null when the destination cannot isolate one. */
function layerOf(sink: StampSink): (() => EffectLayer) | null {
  if (!("layer" in sink)) return null;
  const layer = (sink as Partial<EffectSink>).layer;
  return typeof layer === "function" ? layer.bind(sink) : null;
}

/**
 * The passes of one stroke, in the one legal order: shadow, then glow. The
 * crisp stroke is painted after both, by the caller, so the mark stays legible
 * over its own effect.
 *
 * Absent or off = no pass at all, which is the whole default: a stroke nobody
 * turned an effect on never allocates a layer.
 *
 * `lowPower` is the weak-device fallback of §7.7.6, and it shapes the PASS
 * rather than the adapter, so every destination (paper, card, file) gets the
 * same answer: the blur is contained at `LOW_POWER_BLUR`, the spread is dropped
 * (it is the ring that multiplies the blurred copies) and each effect stays a
 * single pass. It never touches the command, the alpha or the order — the
 * artwork is the same, only what the engine emits changes.
 */
function effectPasses(stroke: StrokeCommand, opacity: number, lowPower: boolean): LayerPass[] {
  const passes: LayerPass[] = [];
  /** The blur the destination is asked for, contained on a weak device. */
  const blurOf = (radius: number) => (lowPower ? Math.min(radius, LOW_POWER_BLUR) : radius);
  /** Growing the silhouette costs one blurred copy per direction. */
  const spreadOf = (spread: number) => (lowPower ? 0 : spread);
  const shadow = shadowOf(stroke.sombra);
  if (shadow.on && shadow.intensity > 0) {
    passes.push({
      kind: "shadow",
      // Intensity is an ALPHA, never a solid: 100% is still translucent.
      alpha: (shadow.intensity / 100) * SHADOW_ALPHA * opacity,
      blur: blurOf(shadow.radius),
      spread: spreadOf(shadow.spread),
      dx: shadow.dx,
      dy: shadow.dy,
      // Fixed black: the shadow is depth, not ink (efeitos-chevrons §7.3).
      color: "#000000",
      blend: "source-over",
    });
  }
  const glow = glowOf(stroke.brilho);
  if (glow.on && glow.intensity > 0) {
    passes.push({
      kind: "glow",
      alpha: (glow.intensity / 100) * opacity,
      blur: blurOf(glow.radius),
      // A glow never grows: one blurred copy in both tiers (§7.7.3), which is
      // what keeps it a single pass on a weak device.
      spread: 0,
      dx: 0,
      dy: 0,
      // Auto resolves against the stroke at paint time, so a glow follows a
      // colour change without the command carrying a second hex.
      color: glow.color === "auto" ? stroke.color : glow.color,
      blend: "lighter",
    });
  }
  return passes;
}

/**
 * Hard ceiling per stroke. A 4000 px stroke costs the same as a 400 px one: the
 * spacing widens until the whole stroke fits, so no command can blow the frame
 * budget up. 3000 elliptical fills is the measured ceiling for one repaint.
 */
export const MAX_STAMPS = 3000;

/** The stamp with the lowest alpha a material may deposit. */
const MIN_ALPHA = 0.02;
/** …and the highest. A single stamp is never opaque. */
const MAX_ALPHA = 0.35;
/**
 * THE PHASE (measured 27/10, the bench at 40×). Every mark of the GRAIN slides
 * along the line by a uniform ±half step — its own cell, and no more.
 *
 * The number is not a taste: a row of stamps at an EXACT interval is a comb, and
 * a slide of `s` steps only ATTENUATES its fundamental by `|sinc(π·s)|`. At 0.4
 * (the first cut) that is 84% of the teeth still there, at 1.2 it is 13% — and
 * the 40× bench counted both. At exactly one step the kernel is a box of the
 * same width as the lattice, `sinc(π) = 0`, and the deposit is a stratified
 * sample: uniform density, no period at all. Two neighbours may now and then
 * swap places, which is why the slide stays on the GRAIN — a ribbon dab is 10
 * steps long, so a swapped body dab would pile up.
 *
 * It is spent on the grain and NOT on the body, and that is the other measured
 * part: holding the body still makes the overlap count constant and the band
 * perfectly flat, while sliding it mottles the band instead.
 */
const PHASE_SLIDE = 1;
/** The fastest stretch keeps 55% of the body width (1 - 0.45). */
const SPEED_LOSS = 0.45;
/** Slow strokes are collapsed to ~2 px steps before the speed is measured, so a
 *  finger that lingers does not read as a faster one with a denser event rate. */
const SPEED_FLOOR = 2;
/** The thinnest possible stamp, in artwork units. */
const MIN_RADIUS = 0.15;

type MaterialProfile = {
  /** Distance between stamps, as a fraction of the brush size. */
  spacing: number;
  /** Stamp radius along the stroke, as a fraction of the brush size. */
  radius: number;
  /** Radius and rotation wobble, 0..1. */
  jitter: number;
  /**
   * Position wobble across the stroke, as a fraction of the brush size. Kept
   * apart from `jitter` (the reference model in brush-engine-raster.md also has
   * `scatter` on its own): radius jitter roughs the EDGE, position scatter
   * moves the whole dab. Scattering by the tip's radius instead of its width
   * would push dabs off the line and the body would never cover.
   */
  scatter: number;
  /** Squash across the stroke (min, max) — a crayon is not a dot. */
  squash: [number, number];
  /** Per-stamp opacity, before the stroke's own noise. */
  alpha: number;
  /**
   * Half-width of the BED the dab group is seated across, as a fraction of the
   * brush size. See the note under `PROFILES`: a dry medium fills the authored
   * band by WHERE the particle lands, never by making the particle bigger.
   * Absent = the dab stays on the line (continuous media are their own band).
   */
  bed?: number;
  /** Parallel ridges across the tip (oil keeps the bristle marks). */
  bristles?: number;
  /** Flat tip instead of a round one (marker). */
  square?: boolean;
  /**
   * Fragments shed around each dab (min, max) — charcoal's dust. Kept apart
   * from `bristles` because a fragment is not a ridge: it is a smaller particle
   * that lands anywhere around the dab, and that irregular edge is what
   * separates charcoal from chalk (brush-seco-e-spray §2).
   */
  satellites?: [number, number];
  /**
   * Longitudinal THREADS drawn beside the core, one per step each (ink). Apart
   * from `bristles` on purpose: a bristle splits the WHOLE tip into parallel
   * strips, all as thin as each other (the oil's four grooves). A thread is a
   * second, weaker mark that travels WITH a solid core, so the section keeps a
   * dense middle and two live files — the striation of ink held by a nib, not
   * the mark of a bristle (brush-novo §6.2, option A rejected for exactly
   * this reason).
   */
  threads?: number;
  /**
   * Paste at the tips: a pen leaves more ink where it lands and where it lifts.
   * `[zone, alphaFactor]`: inside the first and the last `zone` of the stroke's
   * length the stamp deposits `alphaFactor` × the alpha. The GEOMETRY of the
   * lift is not here — it belongs to `ENDS`, where each material's finish is
   * declared, and the two are read from the same `length` so they always agree
   * on where a tip is (brush-novo §6.2).
   */
  paste?: [number, number];
  /**
   * The material's BODY: the continuous deposit the texture rides on. Absent =
   * the medium has no separate body (the continuous three ARE their body, and
   * the can is particles by definition).
   */
  core?: CoreProfile;
};

/**
 * The continuous deposit under the grain — see the measured reason under
 * `PROFILES`.
 *
 * A dry medium declares its identity in its PARTICLES (`radius`, `squash`,
 * `scatter`, `satellites`), and those particles are seated across the `bed` so
 * the band reaches the authored width. What was missing is the thing under
 * them: a chain of dabs along the spine, each as wide as the band, whose
 * overlaps ACCUMULATE into pigment. Without it the particles are all there is,
 * and a particle a tenth of the size scattered over a bed three quarters of the
 * size is a cloud with paper between the dots — measured at 0.4..2.0 dabs
 * covering a point of the axis against the 13..30 of the continuous media.
 */
type CoreProfile = {
  /** Half-width across the spine, as a fraction of the brush size. */
  half: number;
  /**
   * Half-length along the spine, as a MULTIPLE of the step. Above 1 the dabs
   * overlap each other along the line, which is what turns a row of dabs into a
   * ribbon; it is a multiple and not a fraction of `size` so it follows a step
   * that the stamp budget had to widen.
   *
   * 6 is where the ribbon's BORDER becomes a straight line: an ellipse meeting
   * its neighbour `step/2` away dips by `1 - sqrt(1 - (1/12)²)` — 0.35% of the
   * half-width — against the 2% of 2.5, and 2% of a 40-unit band is a seam the
   * 40× bench counts. A longer dab costs no draw.
   */
  reach: number;
  /** Opacity of one body dab. The band's darkness is the overlap of several. */
  alpha: number;
  /**
   * Share of the steps that SKIP the body, 0..1 — the medium that fails in
   * clumps instead of covering evenly (charcoal, chalk). The skips arrive in
   * irregular runs of 1..`run` steps, drawn from the body's own seed stream, so
   * the holes are patches and never a period.
   */
  gaps?: number;
  /**
   * The longest skip, in steps. It has to beat `reach`: a hole is only a hole if
   * the dabs on either side of it cannot reach across, so the run grows with the
   * ribbon (a 4-step skip inside a 6-step reach is bridged and leaves no hole).
   */
  run?: number;
  /** The body is combed into N ridges, like the tip that laid it (oil). */
  ridges?: number;
  /**
   * A second, darker line riding INSIDE the rim — the drying edge of a wash
   * (`tecnica.md`: the pigment migrates to the periphery as the water leaves).
   * `at` is the distance from the spine in body halves, so 1 is the edge.
   */
  rim?: { at: number; alpha: number };
};

/**
 * The grain of each material, all as fractions of `size` so the texture scales
 * with the brush instead of looking pasted on (brush-engine-raster.md).
 *
 * Dry media are PARTICLES, not bubbles (brush-seco-e-spray §2): a dab wider than
 * the step leaves a scalloped edge, so `radius ≤ 0.18 × size` and
 * `spacing ≤ 0.6 × radius`, with 0.05..0.12 alpha. Density comes from hundreds
 * of overlapping particles, never from a few opaque blobs.
 *
 * The alphas are low on purpose: at the listed spacing every point of the line
 * is covered by several stamps, and it is the SUM that lays down the pigment.
 *
 * The pairs that used to read alike are separated by FORM, not by density
 * (brush-separacao §6.1). Charcoal × chalk: chalk is one flat flake (its squash
 * ceiling stays below the charcoal's), charcoal is a chip-to-round grain that
 * sheds dust, so its contour is broken and never a clean flake. Marker × brush:
 * the marker is the flat plate — square tip, near-zero scatter and the most
 * opaque deposit of the continuous two — while the brush is the round dab that
 * breathes. `spacing`, `radius` and the per-step counts are frozen for exactly
 * that reason: `step`, `budget`, `MAX_STAMPS` and the dry pair's volume ratio
 * must not move while the form does.
 *
 * THE BED (espessura-raster.md §6.1, owner's single target). The number the
 * author picks is the width on the paper for EVERY material: half-width 0.50 of
 * the size, inside ±10% at the 95th percentile. A dry particle has radius
 * 0.10..0.22 of the size — on purpose, and the half it covers is 0.06..0.19 —
 * so widening the particle would recreate the bubble that the dry rule forbids
 * and push it past the 0.30 ceiling. The width comes from WHERE the particle
 * lands: each step seats the whole dab group uniformly across `bed`, and `bed`
 * is the target half (0.50) minus the particle's own half. Particle, spacing,
 * alpha and per-step counts keep their grain; only the seat moves. The
 * continuous media need no bed (their dab IS the band, so the marker's radius
 * was the one over target), and the can is its own band — the nozzle's, never a
 * fixed number.
 *
 * THE INSIDE (brush-novo §6.2). `ink` is the first material whose INTERIOR is
 * declared: a solid core plus `threads` files beside it, and a `paste` that
 * deposits more where the pen lands and lifts. Both are counted per step before
 * the budget is divided, so the ceiling holds by construction, and both cost zero
 * draws for every material that does not declare them — the seed stream of the
 * eight existing media is untouched, stamp for stamp.
 *
 * THE BODY (measured 27/10, owner's diagnosis). The `bed` above puts the band on
 * the paper, but it left the dry five with TEXTURE and no body: one particle per
 * step, seated anywhere across ±bed, and the particle is a tenth of the size. At
 * the centre of the authored band, `stampsOf` deposited **0.38 (pencil), 0.78
 * (chalk), 1.02 (oil), 1.43 (charcoal) and 1.78 (wash) dabs per point** against
 * **13.1 for the brush, 18.9 for the marker and 30.1 for the ink**, and the mean
 * optical density inside the band was **0.03..0.10 against 0.59..0.91** — a
 * cloud of dots with paper between them, exactly what the bench shows at size 40
 * and what makes the size 4 sample nearly vanish. The number that explains it is
 * the seat: consecutive dabs sit **0.23..0.60 × rx apart along the spine** (they
 * overlap, so the line is strung) but the bed throws them **2.3..3.4 × ry apart
 * ACROSS it**, so two neighbours never touch sideways and the band never closes.
 *
 * So every dry medium carries a `core`: a chain of body dabs, one per step, as
 * wide as the band and `reach` steps long, whose overlaps accumulate into
 * pigment the way the brush's own dabs do. The grain is unchanged — particle
 * radius, squash, scatter, bed, count and deposit keep their numbers and their
 * seed stream (the body draws from its OWN seed, `hash(seed ^ K)`, so every
 * existing stroke keeps its grain bit for bit and gains the body underneath).
 * What the body does NOT do: it is never the widest thing in the stroke. Its
 * half stops short of the band so the particles and the dust still own the edge,
 * and the `P95` width of the authored size keeps being read from the same
 * profile.
 *
 * THE SILHOUETTE (measured 27/10, second pass — `bancada/crop-40.png`). The plate
 * showed the nine materials as ONE shape: a leaf. One `envelopeAt` tapered every
 * material over the same 15% of both ends, so the widest point of any stroke was
 * its middle and the tips met in a point; and the enlargement counted the stamps,
 * because the body was a chain of 2.5-step lenses whose seams are a period. The
 * owner's plates have PARALLEL SIDES and a finish per material. Three changes,
 * and they are the shape of every material from here on:
 *
 *   1. the band keeps the authored width from just after the landing to just
 *      before the lift — no shared taper, no leaf;
 *   2. what happens at the ends is declared PER MATERIAL in `ENDS` (the pencil's
 *      lift thins, charcoal's crumbles, the wash's blooms, the ink's pools) and
 *      the default is the blunt end the marker and the can already had;
 *   3. the body is a RIBBON — one dab per step, `reach` steps long, all of them
 *      with the same alpha at the same interval — so the overlap count along the
 *      line is constant and its border is a straight line. The GRAIN is what
 *      slides along the line (`PHASE_SLIDE`), because the grain is the one
 *      population that really is a row of discrete dabs.
 *
 * The three are measured, and the measurements are what chose them: a per-dab
 * alpha (±15%) or a "breathing" waist (±2.5%) anywhere on the RIBBON turns each
 * ellipse's border into a chain of coins 48 units long, because a dab is that
 * long; the same draws on the GRAIN are invisible, because a particle is a tenth
 * of the size. `brush-core.test` reads the border's spectrum, `brush-canvas.test`
 * reads the silhouette and the ends, and the bench is the eye on both.
 */
const PROFILES: Record<RasterBrush, MaterialProfile> = {
  crayon: {
    spacing: 0.08,
    radius: 0.18,
    jitter: 0.32,
    scatter: 0.07,
    squash: [0.42, 0.75],
    alpha: 0.1,
    bed: 0.395,
    // A solid wax band that FAILS IN CLUMPS (tecnica.md): the body is the most
    // opaque of the dry five after the oil, and `gaps` opens the light holes a
    // falling pressure leaves inside the band.
    core: { half: 0.48, reach: 6, alpha: 0.181, gaps: 0.15, run: 6 },
  },
  charcoal: {
    spacing: 0.08,
    radius: 0.14,
    jitter: 0.68,
    scatter: 0.15,
    squash: [0.35, 1],
    alpha: 0.09,
    satellites: [2, 3],
    bed: 0.405,
    // Dense but BROKEN, with the dust thrown outside by the satellites above:
    // the body is nearly as dark as the chalk, skips far more often and reaches
    // further along the line so the runs it lays bridge its own holes.
    core: { half: 0.48, reach: 6, alpha: 0.175, gaps: 0.25, run: 6 },
  },
  brush: {
    spacing: 0.07,
    // The dab IS the band in the continuous media, so its radius is the only
    // field that moves — no bed, which would only widen it.
    //
    // 0.56 → 0.48 with the re-measurement of espessura §10.2 (27/10): the old
    // account ("P95 of the seat + MEDIAN of the particle") read 0.94..0.98 and
    // called the brush conforming, but that median is the middle of the grain,
    // not the edge. The PAINTED edge — 2 × P95(|across| + ry), the authority for
    // all nine materials — read 1.12..1.23 at 0.56, a fifth over the authored
    // size: the squash band (0.72..1) times the wobble (±18%) is a wide grain,
    // and a wide grain's median is far from its P95. At 0.48 the edge measures
    // 0.986..1.024 at 12 and 60 on both reference lines (0.97..1.07 from 6 to
    // 60). `spacing`, `alpha`, `squash`, `scatter` and the deposit are untouched,
    // so the grain band and the marker × brush separation (opacity, flat tip,
    // scatter) do not move.
    radius: 0.48,
    jitter: 0.1,
    scatter: 0.05,
    squash: [0.78, 1],
    alpha: 0.16,
  },
  marker: {
    // Same overlap as before (0.044 / 0.50 = 0.055 / 0.62), so the plate keeps
    // its coverage while its edge lands on the authored size.
    spacing: 0.044,
    radius: 0.5,
    jitter: 0.02,
    scatter: 0.008,
    squash: [1, 1],
    alpha: 0.19,
    square: true,
  },
  watercolor: {
    spacing: 0.1,
    radius: 0.22,
    jitter: 0.15,
    scatter: 0.06,
    squash: [0.7, 1],
    alpha: 0.06,
    bed: 0.313,
    // A translucent stain with a soft body and the DRYING EDGE darker than the
    // middle: the rim rides just inside the body's own edge (`at` in body
    // halves), which is where the pigment migrates as the water leaves. The
    // body is the faintest of the five and the rim carries the edge — a wash
    // reads by its periphery, not by its middle.
    core: { half: 0.48, reach: 6, alpha: 0.038, rim: { at: 0.78, alpha: 0.034 } },
  },
  oil: {
    spacing: 0.08,
    radius: 0.2,
    jitter: 0.2,
    scatter: 0.05,
    squash: [0.35, 0.55],
    alpha: 0.12,
    bristles: 4,
    // The bed seats the GROUP of four ridges: the grooves stay parallel and
    // visible, they just travel off the line together (§6.1). The group's
    // nominal half is 0.094 — the 0.406 of the table — but it spreads its mass
    // over four thin ridges, so its measured half is 0.049 and the deposit
    // landed at 0.86..0.89 of the size. §6.1's own rule (target half minus the
    // MEASURED half) recomputes the bed to 0.45 → 0.94..0.96.
    bed: 0.45,
    // The thickest body of the five, and the only one COMBED. The comb is what
    // carves the striation, so the grooves are the material and not a decoration
    // on top of it. FIVE ridges leave the four grooves of a bristle tip; the
    // count is ODD on purpose — with an even one the comb opens a groove down
    // the axis of the stroke and the band reads split in two (the bench showed
    // exactly that at four).
    core: { half: 0.5, reach: 10, alpha: 0.1, ridges: 5 },
  },
  spray: {
    spacing: 0.18,
    // The nozzle replaces the radius and the scatter at paint time (§3); these
    // two only keep the profile complete, and they are the same defaults.
    radius: SPRAY_DEFAULTS.tip,
    jitter: 0.8,
    scatter: SPRAY_DEFAULTS.spread,
    squash: [0.8, 1],
    alpha: 0.3,
    // No grain dab: the can deposits DROPLETS and VEILS and nothing else. The
    // one dab per step the grain used to add here was the widest thing in the
    // cloud (its ±80% wobble took a droplet of 0.10 to 0.18 of the size) and it
    // landed anywhere across the cone — a big blob at the rim of a cloud whose
    // rim is supposed to be the FINE part. The tip the author tunes is the
    // droplet radius, and now it is the only radius the can has. The veil is a
    // second population, but it is not a grain dab: it is the aerosol between
    // the drops (`MIST_EVERY`), it has its own deposit and its own seed, and it
    // rides the same cone.
    bristles: 0,
  },
  pencil: {
    spacing: 0.06,
    radius: 0.1,
    jitter: 0.3,
    scatter: 0.03,
    squash: [0.6, 0.9],
    // 0.08 → 0.10: the same particles now spread over a 6× wider bed, and the
    // deposit rises INSIDE the ceiling (still < 0.20 per stamp, never a wash)
    // instead of letting the pencil read as smoke (§6.1).
    alpha: 0.1,
    bed: 0.425,
    // The fine line: a continuous body and NO clumps (`gaps` absent), because
    // graphite is the one dry medium whose line closes (tecnica.md). Its body is
    // the faintest of the five — a clear line, not a black one.
    core: { half: 0.48, reach: 10, alpha: 0.0835 },
  },
  ink: {
    // brush-novo §6.2, the normative profile. A fluid line is neither a particle
    // (no bed, no dust) nor a plate (round tip, breathing edge): `spacing 0.05`
    // keeps ~26 core dabs on any point of the line, `squash 0.58..0.82` gives the
    // file its flat section, and the two THREADS add the longitudinal striation
    // the oil gets from bristles but with a solid core in the middle.
    spacing: 0.05,
    /**
     * 0.46 → 0.64, the ONLY number this material moved to reach the single
     * target (brush-novo §7, Passo 0 — measured, not tuned by eye). The spec's
     * 0.46 reads as if `radius` were the band, but the section's half-width
     * across the line is `radius × squash` (0.46 × ~0.70 = 0.32), so the stroke
     * deposited 0.69..0.72 of the authored size at 12..60 px — a quarter below
     * the 0.90 floor. The radius is the only lever that widens the body without
     * touching `spacing`, `alpha` or the files (the spec forbids those three):
     * at 0.64 the painted band measures 0.95..1.00 of the size, and the 0.46
     * was left in the spec instead of being silently "fixed" there.
     */
    radius: 0.64,
    jitter: 0.1,
    scatter: 0.02,
    squash: [0.58, 0.82],
    alpha: 0.22,
    threads: 2,
    // 8% of the length at each tip: alpha ×1.35 (clamped by the per-stamp
    // ceiling) — the paste where the pen lands and lifts. A tap has no tip to
    // paste, so the zone stays closed for a dot.
    paste: [0.08, 1.35],
  },
};

/**
 * THE ENDS — the material's signature where the hand lands and where it lifts.
 *
 * The bench at 40× (`.dev/investigations/mockup/bancada/crop-40.png`) showed the
 * nine samples as ONE shape: a leaf. Both tips narrowed and the widest point was
 * the middle, because a single `envelopeAt` tapered every material over the same
 * 15% of the length. The plates the owner gave (`.dev/img/brush-tunnig/`) show
 * the opposite: PARALLEL SIDES, and a finish that belongs to the medium — a
 * pencil lifts off the paper, charcoal crumbles, a wash blooms, a marker stops
 * dead. That is the largest distance between our stroke and the real one, so the
 * shape lives here, per material, and the default — no `ENDS` entry at all — is
 * the parallel band with blunt ends, which is exactly the marker and the can.
 *
 * Every number is a FRACTION OF THE STROKE'S LENGTH with a ceiling in brush
 * sizes, so a short stab never spends its whole body in a ramp: a 320-unit
 * stroke with a 40-unit pen tapers over 24 units (7.5%) and never over more than
 * 0.6 of its own width. The band keeps the authored width from just after the
 * landing to just before the lift — the acceptance number is the width at 80% of
 * the length, which is why no exit zone is allowed to reach past 12%.
 */
type EndSide = {
  /** How much of the stroke's length this end occupies. */
  length: number;
  /** …and the ceiling of that zone, in brush sizes. */
  cap: number;
  /** Width factor at the very first / very last mark. 1 = the body's own. */
  width?: number;
  /** Alpha factor there: the pen's paste (entry) and the pool (exit). */
  alpha?: number;
  /** Curve of the width: >1 holds the body longer, <1 lets it go earlier. */
  shape?: number;
};

type EndsProfile = {
  entry?: EndSide;
  exit?: EndSide;
  /**
   * Scatter and bed multiplier at the lift. The two media that DISPERSE instead
   * of thinning — charcoal's crumbs, the wash's bloom — spread their grain; they
   * do not narrow.
   */
  exitScatter?: number;
  /** Extra fragments shed per step at the lift (charcoal). */
  exitShed?: number;
  /** Share of the lift's steps where the BODY gives out (chalk, charcoal). */
  exitFail?: number;
  /**
   * Split the lift's dab into two fillets across the line, as a fraction of the
   * half-width (the brush's hairs separating).
   */
  exitSplit?: number;
  /** One extra ridge down the axis at the lift (the oil's crest of paste). */
  exitBead?: { half: number; alpha: number };
};

const ENDS: Partial<Record<RasterBrush, EndsProfile>> = {
  pencil: {
    // The hand LIFTS: a smooth thinning over the last ~7% of the length, and the
    // landing is already the full band — a pencil touches the paper flat.
    exit: { length: 0.09, cap: 0.6, width: 0.28, shape: 1.6 },
  },
  charcoal: {
    // The lift CRUMBLES: the band keeps its width while it breaks up, and the
    // grain — with its dust — is thrown wider, so the last marks scatter instead
    // of narrowing.
    exit: { length: 0.12, cap: 0.55, width: 1 },
    exitScatter: 1.6,
    exitShed: 1,
    exitFail: 0.45,
  },
  crayon: {
    // Blunt to the end, and the last stretch FAILS: the wax skips in clumps as
    // the pressure goes, which is a hole in the band, never a point.
    exit: { length: 0.08, cap: 0.45, width: 1 },
    exitFail: 0.85,
    exitScatter: 1.15,
  },
  // The marker and the can declare NO end: the plate stops at the chamfer its
  // own square already cuts, and the cloud simply ends.
  brush: {
    // The hairs SEPARATE as the brush lifts: the band thins AND each dab splits
    // into two fillets, so the tip reads as filaments, never as a spike.
    exit: { length: 0.12, cap: 0.6, width: 0.24, shape: 1.3 },
    exitSplit: 0.5,
  },
  watercolor: {
    // The pigment keeps travelling after the hand leaves: the wash widens a
    // little and fades, so the end is DIFFUSE. Four per cent of the length is a
    // finish, not a second band.
    exit: { length: 0.04, cap: 0.35, width: 1.12, alpha: 0.85, shape: 1.2 },
    exitScatter: 1.25,
  },
  oil: {
    // Blunt, with a CREST: the paint piles up under the bristles at the end, so
    // one bead of paste rides down the axis where the comb's groove was.
    exit: { length: 0.05, cap: 0.35, width: 1.02 },
    exitBead: { half: 0.9, alpha: 0.2 },
  },
  ink: {
    // The pen LANDS with paste and LIFTS with a pool: the last marks are
    // THICKER, not thinner. The pool is a mark at the lift — a few units at the
    // very end — and never a new band width.
    entry: { length: 0.08, cap: 0.5, alpha: 1.35 },
    exit: { length: 0.04, cap: 0.25, width: 1.45, alpha: 1.15 },
  },
};

/** Absent brush = the plain round brush a save written before the shelf has. */
const materialOf = (brush: BrushKind | RasterBrush | undefined): RasterBrush =>
  brush && brush !== "eraser" ? brush : "brush";

const profileOf = (brush: BrushKind | RasterBrush | undefined): MaterialProfile =>
  PROFILES[materialOf(brush)];

const endsOf = (brush: BrushKind | RasterBrush | undefined): EndsProfile =>
  ENDS[materialOf(brush)] ?? {};

/** The fields the engine needs; a full `StrokeCommand` satisfies it. */
export type StampSource = Pick<StrokeCommand, "id" | "size" | "points" | "spray"> & {
  /** The engine's material, wider than the shelf's (see `RasterBrush`). */
  brush?: BrushKind | RasterBrush | undefined;
};

const distance = (a: Point, b: Point) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/**
 * Collapse input points that are closer than `SPEED_FLOOR`. The speed of a
 * stroke is read from the distance between consecutive pointer samples, and a
 * dense event stream would otherwise pass for a slow hand.
 */
function thinned(points: Point[]): Point[] {
  if (points.length <= 2) return points;
  const out: Point[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!;
    const last = out[out.length - 1]!;
    if (distance(last, p) >= SPEED_FLOOR) out.push(p);
  }
  const last = points[points.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * Where the mark sits relative to the two ends of the stroke: the WIDTH factor
 * the material keeps there, the ALPHA factor of its paste, and how deep into the
 * lift the mark is (0 = the body, 1 = the last mark) so the finish can read it.
 *
 * The BODY of every material keeps the authored width along its whole length;
 * what happens at the ends is the material's signature and lives in `ENDS`. A
 * zone is a fraction of the length with a ceiling in brush sizes, and a zone
 * that is not declared costs nothing.
 */
type EndMark = { width: number; alpha: number; exit: number };

function endAt(at: number, length: number, size: number, ends: EndsProfile): EndMark {
  if (length <= 0) return { width: 1, alpha: 1, exit: 0 };
  let width = 1;
  let alpha = 1;
  const entry = ends.entry;
  if (entry) {
    const zone = Math.min(entry.length * length, entry.cap * size);
    if (zone > 0 && at < zone) {
      const u = Math.max(0, at) / zone;
      const start = entry.width ?? 1;
      width *= start + (1 - start) * u ** (entry.shape ?? 1.4);
      alpha *= (entry.alpha ?? 1) + (1 - (entry.alpha ?? 1)) * u;
    }
  }
  const exit = ends.exit;
  let depth = 0;
  if (exit) {
    const zone = Math.min(exit.length * length, exit.cap * size);
    const fromEnd = length - at;
    if (zone > 0 && fromEnd < zone) {
      // 1 at the mouth of the zone, 0 on the last mark: the curve's own `u`.
      const u = Math.max(0, fromEnd) / zone;
      const end = exit.width ?? 1;
      width *= end + (1 - end) * u ** (exit.shape ?? 1.4);
      alpha *= (exit.alpha ?? 1) + (1 - (exit.alpha ?? 1)) * u;
      depth = 1 - u;
    }
  }
  return { width, alpha, exit: depth };
}

const clampAlpha = (value: number) => Math.min(MAX_ALPHA, Math.max(MIN_ALPHA, value));

/**
 * The can's seat across the cone: `rand()` mapped from -1..1 with the mass
 * pulled toward the axis. Exponent 1 is the bare uniform cloud; 1.5 halves the
 * tail (P95 of |seat| goes from 0.95 to 0.93, inside the ±10% the nozzle
 * promises) and puts ~54% of the drops in the middle 40% of the cone against
 * ~40% for the uniform one — a dense middle with a fine rim, which is what the
 * atomiser does (`tecnica.md`, spray).
 */
const coneAt = (u: number) => Math.sign(u) * Math.abs(u) ** 1.5;

/**
 * THE HAZE — the veil that turns a cloud of dots into AEROSOL.
 *
 * The owner's diagnosis (27/10, with the bench): the can read as POINTILLISM.
 * The droplets were right in size, seat and deposit; what was missing is the
 * thing between them. A real atomiser throws two populations at once — droplets
 * that land, and the finer mist that never quite coalesces, which is what makes
 * the mark read as a cloud instead of as a scatter of dots with paper between
 * them. The reference implementation (`fabric-brush`, `spray_brush.js`) gets it
 * from a soft sprite stamped with `drawImage`; here the veils are a second,
 * much fainter population that rides the SAME cone (see `MIST_EVERY`).
 *
 * The numbers were measured on the bench, one defect at a time:
 *
 *   - `MIST_EVERY` steps get one veil. At the shelf's nozzle that is one veil
 *     per 3 × 0.18 × size of travel: a noticeable FLOOR under the cloud and
 *     still well below one droplet.
 *   - the seat is pulled to the CORE of the cone (`HAZE_CONE` of the seat), not
 *     to its rim: a veil at the rim would paint a border on the cloud, and the
 *     rim is exactly where the atomiser has already run out of paint.
 *   - the veil is as wide as the cone (`HAZE_REACH` of `spread × size`), so it
 *     never widens the band the nozzle promises — it fills it. It is
 *     `HAZE_ELONGATION` times LONGER than wide: a round veil left the gaps
 *     between two steps and the plate drew a chain of bosses at size 14.
 *
 * Cost: one extra `drawImage` every `MIST_EVERY` steps, never one per droplet.
 */
export const MIST_EVERY = 3;
/** How much of the cone the veil's seat is allowed to reach (1 = the rim). */
const HAZE_CONE = 0.5;
/** Veil half-width across the line, as a fraction of the cone's own half-width. */
const HAZE_REACH = [0.85, 1.35] as const;
/**
 * How much longer than wide a veil is, ALONG the line. A round veil barely
 * overlaps its neighbour — at the shelf's nozzle the veils sat one cone-width
 * apart and the bench drew them as a chain of bosses at size 14 — so the veil is
 * a STREAK of haze, the way a swept atomiser lays it. It costs no draw: it is
 * the same ellipse, longer.
 */
const HAZE_ELONGATION = 2.6;
/** …and how far the veil may slide along the line, as a fraction of the step. */
const HAZE_SLIDE = 0.55;
/** Veil squash across the line: a puff is round, never a disc. */
const HAZE_SQUASH = [0.78, 1] as const;
/**
 * Deposit of one veil, before the stroke's noise and the trigger. It is the
 * number that decides whether the cloud reads as PAINT or as smoke: the bench
 * measured the spray's band at 22.7% covered before the veil, 53.7% at 0.42 and
 * 77.7% at 0.62 — a band that is half paper still reads as dots. The streak
 * above covers ~2.6× the area per veil, so the deposit came back down to keep
 * the same tone with three times the overlap: the tone is the same, the PERIOD
 * is gone.
 */
const HAZE_DEPOSIT = 0.26;

/**
 * The stamps of one stroke, in painting order.
 *
 * Deterministic by construction: the seed is `hashId(id)`, so the same command
 * replays the same grain on every device, and two strokes with different ids
 * never come out identical.
 *
 * `gaps` are the spans an area erase took out of this stroke. The filter is
 * applied AFTER the whole stroke has been stamped — every draw of the random
 * sequence still happens — so the grain that survives is bit for bit the grain
 * that was there before the rubber passed (borracha-area §6.4).
 */
export function stampsOf(stroke: StampSource, gaps?: readonly Gap[]): Stamp[] {
  return withGaps(stampedOf(stroke), gaps);
}

/** The stamps of a stroke plus the length each one sits at. */
type Stamped = { list: Stamp[]; at: number[] };

/**
 * The stamps and where they sit along the stroke's OWN length — the unit the
 * rubber's spans are written in.
 *
 * The walk is thinned, so the length a step reaches is read back through
 * `originIndexes`: both engines answer in the command's units, not in the units
 * of their own approximation of it.
 */
function stampedOf(stroke: StampSource): Stamped {
  const { id, size } = stroke;
  const points = stroke.points;
  if (points.length === 0) return { list: [], at: [] };

  const profile = profileOf(stroke.brush);
  /** The can's nozzle is the COMMAND's, never the profile's (§3). */
  const nozzle = stroke.brush === "spray" ? nozzleOf(stroke.spray) : null;
  const seed = hashId(id);
  const rand = seeded(seed);
  const pts = thinned(points);

  const base = Math.max(MIN_RADIUS, size * (nozzle ? nozzle.tip : profile.radius));
  /** Per-stroke opacity noise (±12%): two equal strokes are never twins. */
  const noise = 0.88 + ((seed % 997) / 996) * 0.24;
  /**
   * The can's trigger: intensity buys droplets per step AND opacity per
   * droplet, so "more paint" is density, never one bigger dot.
   */
  const droplets = nozzle ? Math.max(1, Math.round(nozzle.intensity * 5)) : 0;
  const trigger = nozzle ? 0.35 + nozzle.intensity * 0.65 : 1;
  /**
   * The veil's cadence and its own seed stream. It is drawn APART from the
   * droplets' (`hash(seed ^ K)`, like the body's) so the cloud written by an
   * earlier version replays its droplets bit for bit and only GAINS the haze
   * underneath — and so a change to the cadence can never reshuffle a drop.
   */
  const mistEvery = nozzle ? MIST_EVERY : 0;
  const mistRand = mistEvery > 0 ? seeded((seed ^ 0x2545f491) >>> 0) : null;

  // One or two points are a DOT, not a short stroke: no taper, no speed, no
  // wobble — a 3-5 child's tap must land exactly where the finger landed.
  const dot = pts.length <= 2;

  const segs: number[] = [];
  let length = 0;
  let maxGap = 0;
  for (let i = 1; i < pts.length; i++) {
    const seg = distance(pts[i - 1]!, pts[i]!);
    segs.push(seg);
    length += seg;
    if (seg > maxGap) maxGap = seg;
  }

  /**
   * The grain dabs of one step. `0` is legal and it is the can's: a spray has no
   * grain, only droplets — a "dab" the size of 0.18 × size thrown at random is
   * the big blob among the drops, and it contradicts the nozzle (the tip the
   * author tunes IS the droplet radius).
   */
  const bristles = Math.max(0, profile.bristles ?? 1);
  /**
   * The threads are counted HERE, where the step budget is decided: the ceiling
   * is preserved by construction only if every mark a step can lay down is in
   * the count (brush-novo §6.2, H3).
   */
  const threads = Math.max(0, profile.threads ?? 0);
  /**
   * The body (dry five): the ridge count of its own comb, plus the two lines of
   * the drying edge. Counted here for the same reason as the threads — the
   * ceiling is per stroke and the body is part of the stroke.
   */
  const core = profile.core ?? null;
  const coreRidges = Math.max(1, core?.ridges ?? 1);
  /** Two chains for a single-ridge band (see the body); a comb has its own. */
  const chains = coreRidges > 1 ? 1 : 2;
  const corePer = core ? coreRidges * chains + (core.rim ? 2 : 0) : 0;
  /**
   * The most stamps one step can add: ridges + droplets + fragments + files…
   * plus the veil, which is one more mark per `MIST_EVERY` steps and is counted
   * as if it landed on every one: the ceiling is preserved by construction, and
   * rounding the haze in at one per step is the only way `budget` can never be
   * exceeded by its cadence.
   */
  const perStep =
    bristles +
    droplets +
    (profile.satellites?.[1] ?? 0) +
    threads +
    corePer +
    (mistEvery > 0 ? 1 : 0);

  const budget = Math.max(1, Math.floor(MAX_STAMPS / perStep));
  const step = Math.max(0.6, size * profile.spacing, length / budget);
  /**
   * Speed is read from the distance between input samples (the command carries
   * no timestamps). It is normalised by the stroke's own fastest stretch, but
   * never below `size * 4`: normalising by the maximum alone would shrink a
   * stroke drawn at a constant rate to 55% of the width its radius promises, and
   * "size" would stop meaning anything. With the floor, only a stretch that is
   * genuinely fast for THIS brush loses width, and a slow hand keeps the full
   * body.
   */
  const speedRef = Math.max(maxGap, size * 4);
  const [squashMin, squashMax] = profile.squash;
  /**
   * The ends of this material: its own landing and its own lift. A tap has no
   * end to speak of — it IS one — so the whole table stays closed for a dot.
   */
  const ends: EndsProfile = dot ? {} : endsOf(stroke.brush);
  /**
   * The tip paste (ink), hoisted: a fraction of the stroke's own length, which
   * the walk below does not change, so the paste and the ends agree on where a
   * tip is.
   */
  const paste = dot ? null : (profile.paste ?? null);
  const pasteZone = paste ? paste[0] * length : 0;

  const out: Stamp[] = [];
  /**
   * The body's own dabs, kept apart so the whole body lands BEFORE the first
   * particle of the stroke: the texture rides on top of the deposit it textures,
   * and the seam's order is the paint order.
   */
  const body: Stamp[] = [];
  /**
   * The can's veils, kept apart for the same reason as the body: the whole haze
   * lands BEFORE the first droplet, so the cloud's floor is under the drops and
   * never over them.
   */
  const haze: Stamp[] = [];
  /** Where each stamp sits along the command's own polyline, step by step. */
  const positions: number[] = [];
  const bodyAt: number[] = [];
  const hazeAt: number[] = [];
  const cum = cumulativeLengths(points);
  const origin = originIndexes(points, pts);
  let place = 0;
  /** How many stamps the stroke holds, every population included: the ceiling is per stroke. */
  const filled = () => out.length + body.length + haze.length;
  const pushStamp = (stamp: Stamp) => {
    out.push(stamp);
    positions.push(place);
  };
  const pushBody = (stamp: Stamp) => {
    if (filled() >= MAX_STAMPS) return;
    body.push(stamp);
    bodyAt.push(place);
  };
  const pushHaze = (stamp: Stamp) => {
    if (filled() >= MAX_STAMPS) return;
    haze.push(stamp);
    hazeAt.push(place);
  };

  /**
   * The body's seed stream, apart from the grain's on purpose: the grain of a
   * stroke written before the body existed must replay bit for bit (the body is
   * an addition underneath, not a re-anchoring of the texture). The XOR salt
   * keeps the two streams from being the same sequence at an offset.
   */
  const coreRand = core ? seeded((seed ^ 0x9e3779b1) >>> 0) : null;

  /**
   * The run the body is in: positive = still laying pigment, negative = skipping
   * it. Drawn in irregular runs of 1..4 steps, so a medium that fails does it in
   * PATCHES (a period would read as a printed pattern, `tecnica.md`).
   */
  let coreRun = 0;
  let travelled = 0;
  let carry = 0;
  /** The index of the step, in the whole stroke: what the veil's cadence reads. */
  let stepIndex = 0;

  for (let i = 1; i < pts.length && filled() < MAX_STAMPS; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const seg = segs[i - 1]!;
    if (seg <= 0) continue;
    const ux = (x1 - x0) / seg;
    const uy = (y1 - y0) / seg;
    const angle = Math.atan2(uy, ux);
    // Speed at this segment, relative to the stroke's reference (see speedRef).
    const speed = dot ? 0 : Math.min(1, seg / speedRef);
    const velocity = 1 - SPEED_LOSS * speed;

    let t = carry;
    while (t <= seg && filled() < MAX_STAMPS) {
      /**
       * THE PHASE: the mark slides along the line, so no two steps stand at an
       * exact multiple of `step` (see `PHASE_SLIDE`). It is drawn first, from the
       * stroke's own stream, so every material is treated the same way and the
       * replay stays exact.
       */
      const phase = dot || nozzle ? 0 : (rand() * 2 - 1) * step * PHASE_SLIDE;
      // Where the mark actually is, on this segment and on the command's own
      // polyline (the walk here is thinned; the rubber's spans are not — see
      // `originIndexes`). The POSITION is never clamped to the segment: a mark
      // may sit a fraction of a step past a vertex, the polyline continues
      // there — and clamping would pile every mark on the vertex, a grid of its
      // own and exactly the period this removes. Only the length the rubber
      // reads is clamped, because it has to stay inside the span's own units.
      const k = (t + phase) / seg;
      const kPlace = Math.min(1, Math.max(0, k));
      const from = cum[origin[i - 1] ?? 0] ?? 0;
      const to = cum[origin[i] ?? i] ?? from;
      place = from + (to - from) * kPlace;
      const cx = x0 + (x1 - x0) * k;
      const cy = y0 + (y1 - y0) * k;
      /**
       * THE BODY'S OWN SEAT: the same step, at its exact interval, WITHOUT the
       * phase. This is the other half of the fix and it is measured: a long dab
       * whose neighbours are all present and all equal makes the overlap count
       * CONSTANT along the line — the union is a flat ribbon with no seam at all
       * (the 40× bench drew it as one smooth band). Slide a body dab and the
       * count becomes 19, 20, 21 at irregular places, which is mottling; slide
       * the whole grid and the count steps land on a comb. So the phase is spent
       * on the GRAIN, where a discrete dab per step would be counted, and the
       * body keeps the machinery of a solid deposit: equal dabs, equal spacing.
       */
      const bodyX = dot || phase === 0 ? cx : x0 + (x1 - x0) * (t / seg);
      const bodyY = dot || phase === 0 ? cy : y0 + (y1 - y0) * (t / seg);
      /**
       * Where this mark sits on the stroke. Outside the ends' zones the material
       * keeps the authored width — parallel sides, the way the plates in
       * `.dev/img/brush-tunnig/` read — and inside a zone the finish takes over
       * (`ENDS`). The paste (ink) is read from the SAME `length`, so a pool and
       * a paste never disagree about which end they are on.
       */
      const at = Math.min(length, Math.max(0, travelled + t + phase));
      const bodySeat = Math.min(length, Math.max(0, travelled + t));
      const pasted =
        paste !== null && pasteZone > 0 && (at <= pasteZone || at >= length - pasteZone);
      const end = endAt(at, length, size, ends);
      /**
       * The radius along the line does NOT follow the end: a lift that thins the
       * band is a band that gets narrower, not a tip made of shorter dabs. The
       * end's factor is applied ACROSS, on `ry`, and on everything that is
       * measured across the line (scatter, bed).
       */
      const radius = Math.max(MIN_RADIUS, base * velocity);

      const wobble = dot ? 1 : 1 + (rand() * 2 - 1) * profile.jitter;
      const rx = Math.max(MIN_RADIUS, radius * wobble);
      const ry = dot
        ? rx
        : Math.max(MIN_RADIUS, rx * (squashMin + rand() * (squashMax - squashMin)) * end.width);
      const rot = dot ? 0 : angle + (rand() * 2 - 1) * profile.jitter * 0.6;

      /**
       * Positional scatter: this is what makes the edge irregular. It is a
       * fraction of the tip, and it follows the end — a lift that disperses
       * throws its grain wider (charcoal's crumbs, the wash's bloom), a lift that
       * thins gathers it in.
       *
       * The dispersion is CUBED on purpose: it belongs to the very last marks,
       * where the hand has already left and the medium is on its own. A zone that
       * widened evenly would be a second band hanging off the stroke, and it
       * would move the width the material declares at its 95th percentile.
       */
      const bloom = 1 + ((ends.exitScatter ?? 1) - 1) * end.exit ** 3;
      const scatter = dot
        ? 0
        : size * (nozzle ? nozzle.spread : profile.scatter) * end.width * bloom;
      const acrossJitter = (rand() * 2 - 1) * scatter;
      const alongJitter = (rand() * 2 - 1) * scatter * 0.6;
      /**
       * The bed: the whole dab group's seat across the line, uniform over the
       * material's band (espessura-raster.md §6.1). The particle does not grow
       * — the grain keeps its size, its alpha and its count — only WHERE it
       * lands changes, which is how a 0.10 particle covers a 1.0 band without
       * becoming the bubble the dry rule forbids. One draw per step, and only
       * for a material that declares a bed, so the seed stream of the
       * continuous media and of the can is untouched.
       */
      const bed = dot ? 0 : size * (profile.bed ?? 0) * end.width * bloom;
      const seat = bed > 0 ? (rand() * 2 - 1) * bed : 0;
      const seatX = -uy * seat;
      const seatY = ux * seat;
      /**
       * The per-dab deposit belongs to the PARTICLES, and its AMPLITUDE belongs to
       * their size. A particle is a chance landing of pigment: ±14% from dab to
       * dab is its texture, and it is short enough that the draw reads as grain.
       * The dab of a continuous medium IS the band — 38 units long — so the same
       * draw paints a disc, and the bench drew the brush as a chain of coins
       * until this line learned the difference. The draw itself is kept (it is
       * the stream every stroke replays), only its swing is turned down.
       */
      const grain = 0.86 + rand() * 0.28;
      const grainDeposit = core ? grain : 1 + (grain - 1) * 0.3;
      const alpha = clampAlpha(
        profile.alpha *
          noise *
          grainDeposit *
          trigger *
          (pasted && paste ? paste[1] : 1) *
          end.alpha,
      );

      /**
       * The BODY: the continuous deposit the grain rides on. One dab per step at
       * the spine, as wide as the band and `reach` steps long, so consecutive
       * dabs overlap and the band closes by ACCUMULATION — the same mechanism the
       * brush uses, only with the grain moved to a second, lighter population
       * that owns the edge.
       *
       * It follows the same end and velocity as the particle, because a fast or
       * lifting stretch has less paint under it too.
       *
       * The run below is what a medium that FAILS does: charcoal and chalk skip
       * the body in irregular patches of 1..4 steps, so the band keeps dense
       * places and light holes instead of an even film.
       *
       * THE RIBBON (measured 27/10 at 40×). 2.5..3 steps of `reach` made the
       * body a CHAIN OF LENSES: each ellipse's border met its neighbour's at a
       * sharp V, and the enlargement counted one V per step along the whole band
       * — the period the task calls "serrilhado". At 6 steps a dab overlaps its
       * neighbour twelve times, the border is a straight line, and the deposit
       * at any point is the sum of a dozen equal terms. `reach` costs no draw:
       * it is the same one dab per step, only longer.
       */
      if (core && coreRand) {
        if (coreRun === 0) {
          const run = 1 + Math.floor(coreRand() * (core.run ?? 4));
          coreRun = coreRand() < (core.gaps ?? 0) ? -run : run;
        }
        const solid = coreRun > 0;
        /**
         * The LIFT of chalk and charcoal fails on its own account: the hand is
         * already leaving, so a share of the last steps gives out whatever the
         * run says (`ENDS.exitFail`) — and those steps also DEPOSIT less, because
         * the last stretch of the plate is where the band goes pale with the
         * marks still there. A hole in the deposit is what the eye reads as
         * "giving out"; a hole in the geometry would be a notch.
         */
        const givingUp = end.exit > 0.3 && coreRand() < (ends.exitFail ?? 0);
        const laying = solid && !givingUp;
        /**
         * …and the ribbon stops within a step of each END. A long dab whose
         * centre sits on the last step would hang 6 steps past it and taper the
         * lift over that whole length — the leaf again, this time per dab. Short
         * at the ends and long in the middle gives the chamfer the plates show.
         */
        const reach = Math.max(
          MIN_RADIUS,
          Math.min(step * core.reach, bodySeat + step * 1.2, length - bodySeat + step * 1.2),
        );
        const half = Math.max(MIN_RADIUS, size * core.half * velocity * end.width);
        /**
         * THE BANK IS ONE COLOUR, and that is measured, not an omission. Every
         * dab of the body carries the SAME alpha: as soon as two neighbours
         * differ, each ellipse's border shows in the union and the band reads as a
         * chain of coins 48 units long — the 40× bench drew exactly that when this
         * draw was ±15%. A ±2.5% "breathing" of the waist did the same at a longer
         * wavelength. The texture is the GRAIN on top — its own per-dab deposit,
         * its own short dabs, its own slid positions — and the body stays the
         * quiet bank underneath, exactly as the plates show it.
         */
        const waist = half;
        const deposit = clampAlpha(core.alpha * noise * (givingUp ? 0.3 : 1) * end.alpha);
        /**
         * A step of a failing medium loses only PART of the tip: what stopped
         * touching the paper is a bite out of one side of the band, never a slit
         * across it. A full-width gap of a few steps is a printed bar (that is
         * exactly what the first cut of this drew); a bite keeps the band solid
         * on one side and leaves a light hole on the other, which is what a
         * crayon does when the pressure falls (`tecnica.md`).
         */
        const bite = laying ? 1 : 0.3 + coreRand() * 0.25;
        const ryBody = Math.max(MIN_RADIUS, waist * bite);
        const shift = laying ? 0 : (coreRand() < 0.5 ? -1 : 1) * (waist - ryBody * 0.85);
        /**
         * The comb's own proportions (oil): N ridges and N-1 grooves of 45% of a
         * ridge must fill the band exactly, so the outer ridge's edge IS the
         * band's edge and the grooves open instead of blending into a gradient.
         * Solving `N·H + (N-1)·0.45H = 2·waist` gives H below; the centres then
         * sit at ±(waist − H/2), which is what keeps the outer edge on the band.
         *
         * A combed body takes a `bite` as THINNER ridges with wider grooves, and
         * never as the sideways shift: a brush that loses contact flexes, but a
         * comb that jumped to one side would be a different mark.
         */
        const ridgeHalf = coreRidges > 1 ? (2 * waist * bite) / (1.45 * coreRidges - 0.45) : ryBody;
        /**
         * TWO CHAINS, HALF A STEP APART, and this is the last of the three
         * measured numbers. A lattice of equal dabs has an overlap count that
         * alternates between n and n+1 — the bench counted those teeth on the
         * crayon and the wash, 6 and 8 px apart — and the ripple is 1/n of the
         * band. A second chain whose seams fall between the first chain's adds a
         * ripple of the same size half a period away: the two cancel to half the
         * height and twice the frequency, which puts the residue under a pixel at
         * the plate's own scale. Each dab carries the alpha that keeps the band's
         * density: `1 - sqrt(1 - a)` is the half of one dab's deposit.
         *
         * A COMBED body (oil) keeps ONE chain: its ridges already break the band
         * into strips, the seam between two dabs runs ACROSS the stroke instead of
         * along it, and doubling its dabs eats the step budget of a small brush
         * (measured: the 12 oil's grain went from 0.96 to 1.4 units a step).
         */
        const subAlpha = chains > 1 ? clampAlpha(1 - Math.sqrt(1 - deposit)) : deposit;
        for (let b = 0; b < coreRidges; b++) {
          // A combed body: the ridges that split the particle also carve the
          // grooves, so the striation is the material itself.
          const ridge = coreRidges > 1 ? (b / (coreRidges - 1) - 0.5) * 2 * (waist - ridgeHalf) : 0;
          const across = ridge + (coreRidges > 1 ? 0 : shift);
          for (const sub of chains > 1 ? [-0.25, 0.25] : [0]) {
            if (filled() >= MAX_STAMPS) break;
            const along = sub * step;
            pushBody({
              x: bodyX + ux * along - uy * across,
              y: bodyY + uy * along + ux * across,
              rx: reach,
              ry: Math.max(MIN_RADIUS, ridgeHalf),
              rot: angle,
              alpha: subAlpha,
              core: true,
            });
          }
        }
        /**
         * The CREST (oil): the paste piles up under the bristles as the brush
         * leaves, so a bead of paint rides the axis where the comb had its
         * groove. One dab, only at the lift — a lift that thickens, never a tip.
         */
        if (ends.exitBead && end.exit > 0.5) {
          pushBody({
            x: bodyX,
            y: bodyY,
            rx: reach,
            ry: Math.max(MIN_RADIUS, waist * ends.exitBead.half),
            rot: angle,
            alpha: clampAlpha(ends.exitBead.alpha),
            core: true,
          });
        }
        if (core.rim) {
          // The drying edge: two darker lines inside the rim, where a wash
          // leaves its pigment as the water goes.
          const rimAt = core.rim.at * waist;
          for (const side of [-1, 1]) {
            pushBody({
              x: bodyX - uy * rimAt * side,
              y: bodyY + ux * rimAt * side,
              rx: Math.max(MIN_RADIUS, reach * (0.8 + coreRand() * 0.4)),
              ry: Math.max(MIN_RADIUS, waist * 0.2),
              rot: angle,
              alpha: clampAlpha(core.rim.alpha * noise * (0.85 + coreRand() * 0.3)),
              core: true,
            });
          }
        }
        if (coreRun > 0) coreRun--;
        else coreRun++;
      }

      /**
       * The lift SPLITS (brush): as the pressure goes, the tip stops touching
       * with one flat face and its hairs come apart, so the last dabs are two
       * fillets with paper between them instead of a single blob. It rides only
       * on the last marks — a split band would be a second material, not a
       * finish.
       */
      const split = ends.exitSplit && end.exit > 0.35 ? ends.exitSplit : 0;
      const lobes = split > 0 ? 2 : 1;
      for (let b = 0; b < bristles && filled() < MAX_STAMPS; b++) {
        // Bristles are parallel ridges across the tip: offset along the normal,
        // thinner than the tip so the grooves between them stay visible.
        const ridge = bristles > 1 ? (b / (bristles - 1) - 0.5) * 2 * ry * 0.62 : 0;
        const grainRy = bristles > 1 ? ry * 0.42 : ry;
        for (let lobe = 0; lobe < lobes && filled() < MAX_STAMPS; lobe++) {
          const fillet = lobes > 1 ? (lobe === 0 ? -1 : 1) * ry * split : 0;
          const across = acrossJitter + ridge + fillet;
          const stamp: Stamp = {
            x: cx + seatX + ux * alongJitter - uy * across,
            y: cy + seatY + uy * alongJitter + ux * across,
            rx,
            ry: lobes > 1 ? grainRy * 0.45 : grainRy,
            rot,
            alpha,
          };
          if (profile.square) stamp.square = true;
          pushStamp(stamp);
        }
      }

      /**
       * The threads (ink): one per side, displaced ONLY across the line — the
       * opposite of the charcoal's dust, which is drawn in a circle. A file that
       * wandered along the stroke would read as a speck; riding the normal it
       * reads as a second filament of the same line, and its own tremor (rotation
       * and shape, drawn per file) is what keeps it from turning into pinstripe
       * (brush-novo §6.2). The core keeps the middle: no `bristles` here, so the
       * section has three peaks instead of four equal strips.
       */
      const coreRy = bristles > 1 ? ry * 0.42 : ry;
      for (let f = 0; f < threads && filled() < MAX_STAMPS; f++) {
        const side = f % 2 === 0 ? -1 : 1;
        const away = side * coreRy * (0.32 + rand() * 0.1);
        const shape = rand();
        const deposit = rand();
        const fileRx = Math.max(MIN_RADIUS, rx * (0.55 + shape * 0.25));
        pushStamp({
          x: cx + seatX + ux * alongJitter - uy * (acrossJitter + away),
          y: cy + seatY + uy * alongJitter + ux * (acrossJitter + away),
          rx: fileRx,
          ry: Math.max(MIN_RADIUS, coreRy * (0.28 + shape * 0.15)),
          rot: angle + (rand() * 2 - 1) * profile.jitter * 0.3,
          alpha: clampAlpha(alpha * (0.55 + deposit * 0.15)),
        });
      }

      // Charcoal does not have a clean edge: it sheds 2-3 fragments per step, and
      // more of them as it CRUMBLES at the lift — concentrated on the very last
      // marks, because a stream of extra dust over the whole lift would widen the
      // band the material declares at its 95th percentile. This is what separates
      // it from chalk, which is the same family of widths but a single flat flake
      // (§2) — and the count is drawn per step, so the dust never settles into a
      // regular pattern.
      const shed = ends.exitShed ? Math.round(ends.exitShed * end.exit ** 2) : 0;
      const fragments =
        (profile.satellites
          ? profile.satellites[0] +
            Math.floor(rand() * (profile.satellites[1] - profile.satellites[0] + 1))
          : 0) + shed;
      for (let f = 0; f < fragments && filled() < MAX_STAMPS; f++) {
        /**
         * The chip's throw: it lands anywhere in a circle around the dab. 1.4 ×
         * the dab is as far as it may go and still be dust of THIS line — the
         * band a material declares is its 95th percentile, and a throw of 1.8
         * put the charcoal's own width a point past the window it promises
         * (`brush-canvas`, the seven-media test).
         */
        const reach = rx * (0.6 + rand() * 0.8);
        const kick = rand() * Math.PI * 2;
        const chip = Math.max(MIN_RADIUS, rx * (0.25 + rand() * 0.4));
        pushStamp({
          x: cx + seatX + Math.cos(kick) * reach,
          y: cy + seatY + Math.sin(kick) * reach,
          rx: chip,
          ry: Math.max(MIN_RADIUS, chip * (0.5 + rand() * 0.5)),
          rot: kick,
          alpha: clampAlpha(alpha * (0.55 + rand() * 0.45)),
        });
      }

      // The can's droplets: each one has its own size and its own seat inside
      // the cone. The seat is pulled toward the axis and the drop shrinks with
      // the distance, so the cloud is DENSE in the middle and fine at the rim —
      // the atomiser stands on the middle of the band, and the drops that make
      // it to the edge are the small ones (`tecnica.md`, spray).
      //
      // `soft` is what makes a drop a DROP and not a dot: the adapter stamps it
      // from the atomised sprite (a gradient with an opaque core and a falloff
      // drawn into the image), so the border is soft because it is painted soft,
      // never because the dab is big (see `stampSoft`).
      for (let d = 0; d < droplets && filled() < MAX_STAMPS; d++) {
        const cone = coneAt(rand() * 2 - 1);
        const pull = Math.abs(cone);
        const drop = Math.max(MIN_RADIUS, base * (0.5 + rand() * 0.9) * (1 - 0.5 * pull));
        const across = cone * scatter;
        const along = (rand() * 2 - 1) * scatter * 0.6;
        pushStamp({
          x: cx + seatX + ux * along - uy * across,
          y: cy + seatY + uy * along + ux * across,
          rx: drop,
          ry: Math.max(MIN_RADIUS, drop * (0.75 + rand() * 0.25)),
          rot: rand() * Math.PI,
          alpha: clampAlpha(alpha * (0.7 + rand() * 0.6)),
          soft: "drop",
        });
      }

      /**
       * The VEIL (see `MIST_EVERY`): every third step lays one long, very faint
       * STREAK of haze in the CORE of the cone, at the axis' own reach. It is the
       * floor the drops sit on — a fraction of one drop's deposit spread over ten
       * times its area, which is what an atomiser leaves between the droplets.
       *
       * It follows the trigger like the drops do (more paint = more mist), it is
       * drawn from its own stream (so the drops above are untouched), and it is
       * LONGER than it is wide: a round veil left the gaps between two steps and
       * the bench read them as a chain of bosses at size 14.
       */
      if (nozzle && mistRand && mistEvery > 0 && stepIndex % mistEvery === 0) {
        const cone = coneAt(mistRand() * 2 - 1) * HAZE_CONE;
        const across = cone * scatter;
        const along = (mistRand() * 2 - 1) * step * HAZE_SLIDE;
        const reach = scatter * (HAZE_REACH[0] + mistRand() * (HAZE_REACH[1] - HAZE_REACH[0]));
        const wide = Math.max(
          MIN_RADIUS,
          base + reach * (HAZE_SQUASH[0] + mistRand() * (HAZE_SQUASH[1] - HAZE_SQUASH[0])),
        );
        pushHaze({
          x: cx + seatX + ux * along - uy * across,
          y: cy + seatY + uy * along + ux * across,
          rx: Math.max(MIN_RADIUS, base + reach * HAZE_ELONGATION),
          ry: wide,
          rot: angle,
          alpha: clampAlpha(profile.alpha * noise * trigger * HAZE_DEPOSIT),
          soft: "mist",
        });
      }

      t += step;
      stepIndex++;
    }
    carry = t - seg;
    travelled += seg;
  }

  // A zero-length polyline (all duplicate points) is still a tap, not nothing.
  if (out.length === 0) {
    const [x, y] = pts[0]!;
    if (nozzle) {
      // A tap with the can is a PUFF, not one drop: same nozzle, zero travel.
      /**
       * …and a puff is a cloud too, so it gets its veils: two wide puffs at the
       * centre, drawn from the haze's own stream. A tap that landed as one crisp
       * dot was the most visible version of the defect this fixes.
       */
      if (mistRand) {
        for (let v = 0; v < 2 && filled() < MAX_STAMPS; v++) {
          const puff = Math.max(
            MIN_RADIUS,
            base + size * nozzle.spread * HAZE_REACH[1] * (0.8 + mistRand() * 0.4),
          );
          pushHaze({
            x,
            y,
            rx: puff,
            ry: Math.max(
              MIN_RADIUS,
              puff * (HAZE_SQUASH[0] + mistRand() * (HAZE_SQUASH[1] - HAZE_SQUASH[0])),
            ),
            rot: mistRand() * Math.PI,
            alpha: clampAlpha(profile.alpha * noise * trigger * HAZE_DEPOSIT),
            soft: "mist",
          });
        }
      }
      for (let d = 0; d <= droplets && filled() < MAX_STAMPS; d++) {
        const u = rand() * 2 - 1;
        const cone = coneAt(u);
        const drop = Math.max(MIN_RADIUS, base * (0.5 + rand() * 0.9) * (1 - 0.5 * Math.abs(cone)));
        // The puff is round on purpose: a tap has no axis to be biased along.
        const seat = rand() * Math.PI * 2;
        const reach = Math.abs(cone) * size * nozzle.spread;
        pushStamp({
          x: x + Math.cos(seat) * reach,
          y: y + Math.sin(seat) * reach,
          rx: drop,
          ry: Math.max(MIN_RADIUS, drop * (0.75 + rand() * 0.25)),
          rot: seat,
          alpha: clampAlpha(profile.alpha * noise * trigger * (0.7 + rand() * 0.6)),
          soft: "drop",
        });
      }
    } else {
      place = 0;
      // A tap of a textured medium is the whole finger: body first, then the
      // particle that owns the edge — the same order the walk paints in.
      if (core) {
        pushBody({
          x,
          y,
          rx: Math.max(MIN_RADIUS, size * core.half),
          ry: Math.max(MIN_RADIUS, size * core.half),
          rot: 0,
          alpha: clampAlpha(core.alpha * noise),
          core: true,
        });
      }
      const stamp: Stamp = { x, y, rx: base, ry: base, rot: 0, alpha: clampAlpha(profile.alpha) };
      if (profile.square) stamp.square = true;
      pushStamp(stamp);
      // A tap of ink is the nib's own blob, not a cloud: the threads land
      // CONCENTRIC and round, so the dot stays one round mark (brush-novo §6.3).
      for (let f = 0; f < threads && filled() < MAX_STAMPS; f++) {
        const shape = rand();
        const size = Math.max(MIN_RADIUS, base * (0.55 + shape * 0.25));
        pushStamp({
          x,
          y,
          rx: size,
          ry: size,
          rot: 0,
          alpha: clampAlpha(profile.alpha * (0.55 + rand() * 0.15)),
        });
      }
    }
  }

  // The haze lands first, then the body, then the grain: the deposit is under
  // the texture it textures, and the veil is under both. A gap span still
  // removes a whole step (every array carries the step's own position).
  if (body.length === 0 && haze.length === 0) return { list: out, at: positions };
  return {
    list: [...haze, ...body, ...out],
    at: [...hazeAt, ...bodyAt, ...positions],
  };
}

/**
 * Cached stamps. Commands are immutable by contract (every edit builds a new
 * object), so the cache is keyed by identity and can be collected with the
 * stroke. It keeps a live stroke from re-stamping the whole drawing on every
 * pointer move.
 */
const stampCache = new WeakMap<object, Stamped>();

function stampedFor(stroke: StampSource): Stamped {
  const cached = stampCache.get(stroke);
  if (cached) return cached;
  const stamped = stampedOf(stroke);
  stampCache.set(stroke, stamped);
  return stamped;
}

/**
 * The stamps that survive the spans. The whole stroke was generated first, so
 * the surviving grain is the SAME objects, in the same order, with the same
 * values — the rubber takes stamps away, it never shifts them.
 *
 * A step is the unit: a satellite chip belongs to the dab that shed it, so a
 * step inside a span leaves no dust behind.
 */
function withGaps(stamped: Stamped, gaps: readonly Gap[] | undefined): Stamp[] {
  if (!gaps || gaps.length === 0) return stamped.list;
  return stamped.list.filter((_, i) => !inGap(gaps, stamped.at[i] ?? 0));
}

export type PaintOptions = {
  /** Strokes the eraser marked: painted at 20% while the finger is down. */
  fadedStrokes?: ReadonlySet<string> | undefined;
  /** Artwork box; the canvas needs it to place a gradient. */
  w?: number | undefined;
  h?: number | undefined;
  /**
   * The device tier of the post-pass: `true` = the weak-device fallback of
   * efeitos-chevrons §7.7.6 (`Profile.lowPower`) — blur contained at
   * `LOW_POWER_BLUR`, spread dropped, one pass per effect. Absent or `false` =
   * the full tier, which is exactly what the engine painted before the flag
   * existed, so a stroke nobody flagged keeps today's count and order.
   */
  lowPower?: boolean | undefined;
};

/** "20..100" -> 0.2..1, plus the eraser's faded preview. */
function strokeOpacity(stroke: { id: string; opacity?: number }, opts: PaintOptions): number {
  const authored = (stroke.opacity ?? 100) / 100;
  return authored * (opts.fadedStrokes?.has(stroke.id) ? 0.2 : 1);
}

function withAlpha(stamp: Stamp, alpha: number): Stamp {
  return { ...stamp, alpha };
}

/** #rrggbb (or #rrggbbaa) -> [r, g, b]; anything else reads as black. */
function rgbOf(hex: string): [number, number, number] {
  const clean = hex.trim().replace("#", "");
  const at = (i: number) => parseInt(clean.slice(i, i + 2), 16) || 0;
  if (clean.length !== 6 && clean.length !== 8) return [0, 0, 0];
  return [at(0), at(2), at(4)];
}

/** Linear mix in sRGB, which is what the palette's hex stops are written in. */
function mixHex(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgbOf(a);
  const [r2, g2, b2] = rgbOf(b);
  const byte = (v: number) => Math.round(v).toString(16).padStart(2, "0").toUpperCase();
  return `#${byte(r1 + (r2 - r1) * t)}${byte(g1 + (g2 - g1) * t)}${byte(b1 + (b2 - b1) * t)}`;
}

/**
 * The gradient painted per stamp rather than per path. The geometry matches the
 * SVG defs in ArtworkSvg (userSpaceOnUse, the artwork box), so a gradient stroke
 * keeps its direction when it moves to the canvas.
 */
function gradientHex(g: StrokeGradient, w: number, h: number, x: number, y: number): string {
  let t: number;
  if (g.kind === "radial") {
    t = Math.hypot(x - w / 2, y - h / 2) / Math.max(1, Math.max(w, h) / 2);
  } else {
    const [x1, y1, x2, y2] = gradientPoints(g.angle);
    const ax = (x1 / 100) * w;
    const ay = (y1 / 100) * h;
    const dx = ((x2 - x1) / 100) * w;
    const dy = ((y2 - y1) / 100) * h;
    const len = dx * dx + dy * dy;
    t = len === 0 ? 0 : ((x - ax) * dx + (y - ay) * dy) / len;
  }
  return mixHex(g.stop1, g.stop2, Math.min(1, Math.max(0, t)));
}

/** One pass of stamps into a sink, at the stroke's own opacity. */
function deposit(
  target: StampSink,
  stamps: readonly Stamp[],
  opacity: number,
  colorAt: (stamp: Stamp) => string,
): number {
  for (const stamp of stamps) {
    target.ellipse(opacity === 1 ? stamp : withAlpha(stamp, stamp.alpha * opacity), colorAt(stamp));
  }
  return stamps.length;
}

/**
 * Paint a whole command list into a sink. The list is replayed with `derive`,
 * so undo, redo and the erase command behave exactly as they do on screen: the
 * commands are the only source of truth.
 *
 * A stroke that carries sombra/brilho is painted in TWO halves, in the order of
 * efeitos-chevrons §7.7: its stamps go into an isolated layer (whose alpha is
 * the silhouette), the shadow and the glow are composited from that layer in a
 * fixed order, and only then the crisp stamps land in the destination. One blur
 * per effect per stroke — never one per stamp.
 *
 * Everything else is untouched: a stroke with no effect takes the same path it
 * always did (no layer, no allocation), and a sink that cannot isolate a layer
 * still paints the stroke plain. `opts.lowPower` only shapes the passes that a
 * stroke with an effect asks for (the weak-device fallback of §7.7.6).
 *
 * Returns the number of stamps deposited ON THE DESTINATION (the layer's own
 * copies are not counted: the caller measures the mark, not the mask).
 */
export function paintStrokes(
  sink: StampSink,
  commands: readonly Command[],
  opts: PaintOptions = {},
): number {
  const { strokes, gaps: gapsOf } = derive(commands);
  const lowPower = opts.lowPower === true;
  let painted = 0;

  for (const stroke of strokes) {
    // The same spans the vector engine reads: one contract, two painters.
    const stamps = withGaps(stampedFor(stroke), gapsOf[stroke.id]);
    if (stamps.length === 0) continue;

    const opacity = strokeOpacity(stroke, opts);
    if (opacity <= 0) continue;

    const gradient = stroke.gradient;
    const gradientW = opts.w;
    const gradientH = opts.h;
    const place =
      gradient && gradientW !== undefined && gradientH !== undefined
        ? (stamp: Stamp) => gradientHex(gradient, gradientW, gradientH, stamp.x, stamp.y)
        : null;
    const colorAt = (stamp: Stamp) => (place ? place(stamp) : stroke.color);

    const passes = effectPasses(stroke, opacity, lowPower);
    const isolate = passes.length > 0 ? layerOf(sink) : null;
    if (isolate) {
      const layer = isolate();
      deposit(layer, stamps, opacity, colorAt);
      for (const pass of passes) layer.composite(pass);
    }

    painted += deposit(sink, stamps, opacity, colorAt);
  }

  return painted;
}

/** Artwork units -> canvas pixels: the window drawn and how many px per unit. */
export type CanvasView = {
  /** Left edge of the window, in artwork units (the card's focus crop). */
  x: number;
  /** Top edge of the window. */
  y: number;
  /** Pixels per artwork unit. */
  scale: number;
};

const NO_TRANSFORM: CanvasView = { x: 0, y: 0, scale: 1 };

/**
 * The canvas adapter. One `globalAlpha` per stamp is the whole point: the path
 * that comes before this file could only set an opacity for the entire stroke,
 * which is why overlap never accumulated.
 *
 * It is also the ONLY place that knows what a layer is: an offscreen canvas of
 * the destination's own size, painted with the same view and composited from
 * its alpha. Both scratch canvases are created on the first stroke that carries
 * an effect and reused for the rest of the repaint — a drawing without effects
 * never allocates one (efeitos-chevrons §7.7.7).
 */
export function canvasSink(
  ctx: CanvasRenderingContext2D,
  view: CanvasView = NO_TRANSFORM,
): EffectSink {
  const width = () => ctx.canvas?.width ?? 0;
  const height = () => ctx.canvas?.height ?? 0;

  /** A transparent scratch of the destination's size. */
  const scratch = (): CanvasRenderingContext2D | null => {
    const doc = ctx.canvas?.ownerDocument ?? null;
    const w = width();
    const h = height();
    if (!doc || w <= 0 || h <= 0) return null;
    const canvas = doc.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    try {
      return canvas.getContext("2d");
    } catch {
      return null;
    }
  };

  let layerCtx: CanvasRenderingContext2D | null = null;
  let workCtx: CanvasRenderingContext2D | null = null;
  /** Warmed only when a stroke with an effect needs it. */
  const work = () => {
    if (!workCtx) workCtx = scratch();
    return workCtx;
  };

  /**
   * The layer's silhouette, blurred, tinted and blended into the page.
   *
   * Three steps and no shortcut: (1) the layer is copied into the scratch —
   * `spread` first, by stamping a ring of copies, because growing is a job for
   * the ALPHA and the blur only softens it; (2) `source-in` replaces the paint
   * with the pass's colour while keeping that alpha, so the layer's own colours
   * never leak into a black shadow or a coloured glow; (3) the tinted copy is
   * drawn into the destination at the pass's alpha, offset, in the pass's blend
   * mode. The layer itself is never modified, so the glow reads the same
   * silhouette the shadow did.
   */
  const composite = (
    dest: CanvasRenderingContext2D,
    pass: LayerPass,
    source: HTMLCanvasElement,
  ) => {
    const workCtxNow = work();
    if (!workCtxNow) return;
    const w = workCtxNow.canvas.width;
    const h = workCtxNow.canvas.height;

    workCtxNow.setTransform(1, 0, 0, 1, 0, 0);
    workCtxNow.globalAlpha = 1;
    workCtxNow.globalCompositeOperation = "source-over";
    workCtxNow.filter = "none";
    workCtxNow.clearRect(0, 0, w, h);

    // 1. Spread, then blur. The ring dilates the silhouette; the filter (in
    // device pixels, like every offset here) is applied to each copy, which is
    // why it is set once, before the draws.
    const blurPx = pass.blur * view.scale;
    workCtxNow.filter = blurPx > 0 ? `blur(${blurPx}px)` : "none";
    const ring = pass.spread > 0 ? 8 : 0;
    const reach = pass.spread * view.scale;
    for (let i = 0; i < ring; i++) {
      const angle = (i / ring) * Math.PI * 2;
      workCtxNow.drawImage(source, Math.cos(angle) * reach, Math.sin(angle) * reach);
    }
    workCtxNow.drawImage(source, 0, 0);
    workCtxNow.filter = "none";

    // 2. The tint.
    workCtxNow.globalCompositeOperation = "source-in";
    workCtxNow.fillStyle = pass.color;
    workCtxNow.fillRect(0, 0, w, h);
    workCtxNow.globalCompositeOperation = "source-over";

    // 3. Onto the page.
    dest.save();
    dest.setTransform(1, 0, 0, 1, 0, 0);
    dest.globalAlpha = Math.min(1, Math.max(0, pass.alpha));
    dest.globalCompositeOperation = pass.blend;
    dest.drawImage(workCtxNow.canvas, pass.dx * view.scale, pass.dy * view.scale);
    dest.restore();
  };

  return {
    ellipse(stamp, color) {
      stampEllipse(ctx, view, stamp, color);
    },
    layer() {
      if (!layerCtx) layerCtx = scratch();
      const own = layerCtx;
      if (!own) {
        // No substrate to isolate (an ancient webview, a fake context): the
        // stroke still lands, only without its effect.
        return { ellipse: () => {}, composite: () => {} };
      }
      // The layer is used once per stroke: clear it, never grow it.
      own.setTransform(1, 0, 0, 1, 0, 0);
      own.globalAlpha = 1;
      own.globalCompositeOperation = "source-over";
      own.filter = "none";
      own.clearRect(0, 0, own.canvas.width, own.canvas.height);
      return {
        ellipse(stamp, color) {
          stampEllipse(own, view, stamp, color);
        },
        composite(pass) {
          composite(ctx, pass, own.canvas);
        },
      };
    },
  };
}

/**
 * One stamp on a 2d context, in device pixels of the sink's own view.
 *
 * A stamp that carries `soft` is not an ellipse at all: it is the atomised
 * sprite, stamped with `drawImage` (see `stampSoft`). Everything else — the
 * body of every material, the grain of the dry five, the plate of the marker —
 * keeps the elliptical fill it always had, so nothing but the can pays for the
 * sprite.
 */
function stampEllipse(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  stamp: Stamp,
  color: string,
) {
  if (stamp.soft && stampSoft(ctx, view, stamp, color)) return;

  const x = (stamp.x - view.x) * view.scale;
  const y = (stamp.y - view.y) * view.scale;
  const rx = stamp.rx * view.scale;
  const ry = stamp.ry * view.scale;
  if (!(rx > 0) || !(ry > 0)) return;

  ctx.globalAlpha = Math.min(1, Math.max(0, stamp.alpha));
  ctx.fillStyle = color;

  if (stamp.square) {
    // A rotated rectangle drawn by hand: save/restore per stamp is too
    // expensive, and the flat tip is only the marker.
    const cos = Math.cos(stamp.rot);
    const sin = Math.sin(stamp.rot);
    const ax = cos * rx;
    const ay = sin * rx;
    const bx = -sin * ry;
    const by = cos * ry;
    ctx.beginPath();
    ctx.moveTo(x - ax - bx, y - ay - by);
    ctx.lineTo(x + ax - bx, y + ay - by);
    ctx.lineTo(x + ax + bx, y + ay + by);
    ctx.lineTo(x - ax + bx, y - ay + by);
    ctx.closePath();
    ctx.fill();
    return;
  }

  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, stamp.rot, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// THE ATOMISED SPRITE — how a drop of the can is actually painted
// ---------------------------------------------------------------------------

/**
 * THE DROP IS A SPRITE, NOT AN ELLIPSE (owner's diagnosis, 27/10).
 *
 * The can painted every drop as an ellipse FILLED WITH ONE COLOUR, and a filled
 * ellipse has a border — the alpha is the same at its middle and at its rim.
 * Stacked a few dozen times per stroke, those borders are exactly what the eye
 * reads as PONTILHISMO: a scatter of dots of different sizes, each with a clean
 * edge, instead of a cloud. Making the dab bigger or fainter does not fix it;
 * the edge itself is the defect.
 *
 * The reference implementation (`fabric-brush`, `src/brushes/spray_brush.js`)
 * solves it in the ASSET: the brush carries an 89 KB PNG whose pixels are the
 * dab, and stamps it with `drawImage`, varying rotation, scale and position. The
 * border is soft because the IMAGE is soft. That is the shape we copy here,
 * with the image drawn in code instead of shipped: a 64 × 64 offscreen canvas,
 * built once per colour and reused for the whole session.
 *
 * The falloff is why the sprite looks sprayed and a radial gradient with two
 * stops looks like a blur: the deposit holds near the core, drops fast through
 * the middle and trails off in a long tail — `1, 0.92, 0.62, 0.31, 0.10` at
 * `0, .18, .38, .58, .78` of the radius is the atomiser's own profile, and it is
 * NOT linear (a linear ramp reads as a cone, not as a drop). Two faint lobes,
 * off centre, break the perfect circle: a dab that is exactly round survives
 * random rotation unchanged, and the cloud would show the sprite's symmetry.
 *
 * Everything here is paid ONCE per colour per session, and one `drawImage` per
 * dab afterwards — the alternative (a `createRadialGradient` per dab) allocates
 * a gradient object per stamp, which is the one thing a live stroke cannot do.
 */
const SPRITE_SIZE = 64;

/**
 * How many coloured sprites are kept. A drawing has a handful of colours, so
 * the cache is a formality for the normal case; the pathological one is a
 * GRADIENT stroke, whose colour changes stamp by stamp (see `spriteOf`).
 */
const SPRITE_LIMIT = 32;

/** Colour → its baked sprite. Module level: one cache for the whole session. */
const sprites = new Map<string, HTMLCanvasElement>();
/** The white sprite the tint scratch borrows, built once. */
let maskSprite: HTMLCanvasElement | null = null;
/** The scratch that tints the mask, used only when the cache is full. */
let tintCtx: CanvasRenderingContext2D | null = null;

/** The 2d context of a canvas, or null on a substrate that has none. */
function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  try {
    return canvas.getContext("2d");
  } catch {
    return null;
  }
}

/**
 * The collar of the sprite: two faint lobes, off centre, whose job is to make
 * the dab's CONTOUR irregular. `[dx, dy, reach, alpha]`, all as fractions of the
 * sprite's half-size, and all small enough to stay inside the canvas — a lobe
 * cut by the edge would be a straight line in the middle of a soft dab.
 */
const SPRITE_LOBES = [
  [0.34, -0.3, 0.4, 0.17],
  [-0.38, 0.26, 0.32, 0.12],
] as const;

/** Draw the soft dab, in one colour, on an already-created context. */
function paintSprite(ctx: CanvasRenderingContext2D, color: string) {
  const half = SPRITE_SIZE / 2;
  const [r, g, b] = rgbOf(color);
  const tint = (alpha: number) => `rgba(${r}, ${g}, ${b}, ${alpha})`;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // The body: opaque in the middle, then the atomiser's own falloff. Six stops
  // because the curve has three bends — the plateau of the core, the shoulder
  // where the pigment thins and the long tail — and a straight line between them
  // is exactly the cone this avoids. The plateau is what carries the DEPOSIT:
  // measured on the bench (27/10), a dab that gave up at 0.18 of its radius read
  // as a smudge on paper, and the cloud only closed at ~0.45 of mean alpha.
  const halo = ctx.createRadialGradient(half, half, 0, half, half, half);
  halo.addColorStop(0, tint(1));
  halo.addColorStop(0.26, tint(0.97));
  halo.addColorStop(0.46, tint(0.86));
  halo.addColorStop(0.64, tint(0.58));
  halo.addColorStop(0.78, tint(0.28));
  halo.addColorStop(0.9, tint(0.07));
  halo.addColorStop(1, tint(0));
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  // The collar: a contour that is not a circle, so rotation is not a no-op.
  for (const [dx, dy, reach, alpha] of SPRITE_LOBES) {
    const cx = half * (1 + dx);
    const cy = half * (1 + dy);
    const lobe = ctx.createRadialGradient(cx, cy, 0, cx, cy, half * reach);
    lobe.addColorStop(0, tint(alpha));
    lobe.addColorStop(0.55, tint(alpha * 0.4));
    lobe.addColorStop(1, tint(0));
    ctx.fillStyle = lobe;
    ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  }
}

/** A sprite of its own for this canvas — the cached face of the dab. */
function buildSprite(doc: Document, color: string): HTMLCanvasElement | null {
  const canvas = doc.createElement("canvas");
  canvas.width = SPRITE_SIZE;
  canvas.height = SPRITE_SIZE;
  const ctx = context2d(canvas);
  if (!ctx) return null;
  paintSprite(ctx, color);
  return canvas;
}

/**
 * The dab in a colour the cache has no room for — a GRADIENT stroke, whose
 * colour is a different value on every stamp. Baking one canvas per dab would
 * allocate a canvas per dab, so the mask is tinted into a single scratch that
 * every such dab shares; the sprite is still the same soft image, only painted
 * four operations ahead of the draw.
 */
function tintedSprite(doc: Document, color: string): HTMLCanvasElement | null {
  if (!maskSprite) maskSprite = buildSprite(doc, "#FFFFFF");
  const mask = maskSprite;
  if (!mask) return null;
  if (!tintCtx) {
    const canvas = doc.createElement("canvas");
    canvas.width = SPRITE_SIZE;
    canvas.height = SPRITE_SIZE;
    tintCtx = context2d(canvas);
    if (!tintCtx) return null;
  }
  const own = tintCtx;
  own.setTransform(1, 0, 0, 1, 0, 0);
  own.globalAlpha = 1;
  own.globalCompositeOperation = "source-over";
  own.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  own.drawImage(mask, 0, 0);
  // `source-in` keeps the mask's ALPHA and replaces its paint: the tint never
  // adds a second silhouette.
  own.globalCompositeOperation = "source-in";
  own.fillStyle = color;
  own.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
  own.globalCompositeOperation = "source-over";
  return own.canvas;
}

/** The sprite of one colour: cached, or tinted on the fly once the cache is full. */
function spriteOf(doc: Document, color: string): HTMLCanvasElement | null {
  const cached = sprites.get(color);
  if (cached) return cached;
  if (sprites.size < SPRITE_LIMIT) {
    const built = buildSprite(doc, color);
    if (built) sprites.set(color, built);
    return built;
  }
  return tintedSprite(doc, color);
}

/**
 * Stamp one dab from the sprite, in device pixels of the sink's own view.
 *
 * The sprite is drawn into the stamp's own box — `-1..1` in a space scaled by
 * `rx`/`ry` and rotated by `rot` — so a soft dab covers exactly the footprint an
 * ellipse of the same numbers covered. The transform is set ABSOLUTE and wrapped
 * in `save`/`restore` for the same reason the ellipse path computes device
 * pixels by hand: this adapter owns the mapping, and the destination's own
 * transform must survive the stamp.
 *
 * Returns false when the substrate cannot give a sprite (no document, no 2d
 * context): the caller then falls back to the ellipse, so a dab always lands.
 */
function stampSoft(
  ctx: CanvasRenderingContext2D,
  view: CanvasView,
  stamp: Stamp,
  color: string,
): boolean {
  const doc = ctx.canvas?.ownerDocument ?? null;
  if (!doc) return false;
  const sprite = spriteOf(doc, color);
  if (!sprite) return false;

  const x = (stamp.x - view.x) * view.scale;
  const y = (stamp.y - view.y) * view.scale;
  const rx = stamp.rx * view.scale;
  const ry = stamp.ry * view.scale;
  if (!(rx > 0.01) || !(ry > 0.01)) return true;

  const cos = Math.cos(stamp.rot);
  const sin = Math.sin(stamp.rot);
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, stamp.alpha));
  ctx.setTransform(cos * rx, sin * rx, -sin * ry, cos * ry, x, y);
  ctx.drawImage(sprite, -1, -1, 2, 2);
  ctx.restore();
  return true;
}
