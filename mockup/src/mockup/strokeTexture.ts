// The stroke texture engine: the media's GRAIN, not a cosmetic dash.
//
// One stroke used to be one <path> with a dash pattern, so crayon, charcoal and
// spray were the same line with different spacing (brush.ts `brushStroke`).
// Here the grain is real geometry: stamps emitted along the polyline, each one a
// closed sub-path INSIDE the same `d`. A stroke with 200 stamps is still one DOM
// node per layer — that is the whole point, because the target is a kid's phone.
//
// Determinism is not a nicety: undo/redo, autosave and the artwork preview all
// re-derive the drawing from the command list, so the same id must always give
// the same grain. The seed is the stroke id, already persisted — no migration.
import { brushStroke, type BrushKind } from "./brush";
import {
  cumulativeLengths,
  inGap,
  originIndexes,
  strokePath,
  type Gap,
  type Point,
} from "./history";
import { hashId, seeded } from "./random";

/** One paint pass of a stroke. A grainy material has 2; a marker has 1. */
export type StrokeLayer = {
  role: "core" | "grain" | "wash";
  /** The path to paint: the stroke itself (core) or the stamp sub-paths. */
  d: string;
  /** `stroke` outlines `d`; `stamp` fills the sub-paths of `d`. */
  mode: "stroke" | "stamp";
  /** Outline width for `stroke`; 0 for `stamp`. */
  width: number;
  linecap: "round" | "square";
  /** Absent when the grain replaced the media's dash. */
  dasharray?: string | undefined;
  /** Multiplier applied on top of the stroke's own opacity (0..1). */
  opacity: number;
};

/**
 * Hard ceiling per stroke: a 4000 px stroke costs the same as a 400 px one.
 * 200 is the number the plan measured at ≤12 KB of `d`; at 240 the same worst
 * case measured 12.3 KB, and shaving precision to fit the round number would
 * flatten the grain's radius variation.
 */
export const MAX_STAMPS = 200;
/** Points are subsampled above this; the polyline itself is never rewritten. */
export const MAX_POINTS = 400;

type GrainProfile = {
  /** Core width, as a fraction of the brush size. */
  core: number;
  /** Distance between stamps, as a fraction of the brush size. */
  spacing: number;
  /** Stamp radius, as a fraction of the brush size. */
  radius: number;
  /** Perpendicular scatter of the whole stamp, as a fraction of the size. 0 = on the line. */
  scatter?: number;
  /** Radius jitter, 0..1. */
  jitter: number;
  /** Vertical squash of the stamp (min, max): a crayon is not a dot. */
  squash: [number, number];
  /** Opacity of the grain pass. */
  opacity: number;
  /** Stamps only, no solid core (spray). */
  grainOnly?: boolean;
  /** Soft passes instead of grain (watercolour). */
  wash?: boolean;
  /** Adds a lighter second wash pass on strokes longer than this, in px. */
  secondAbove?: number;
};

/**
 * The grain of each material. Values are fractions of the brush size, so the
 * texture scales with the stroke instead of looking pasted on.
 *
 * Two invariants hold every entry:
 *
 *   1. the BAND is the pen's thickness (owner's call, 26/10): the visible width
 *      `2 · max(core / 2, radius + scatter)` follows the same factor as
 *      `strokeWidth` (pencil 0.8, charcoal 0.95, crayon 1, oil 1.05, watercolour
 *      1.15, spray 0.9). Before this, the replay painted a 0.45·size pencil next
 *      to a 2.1·size wash for the same authored number.
 *   2. `radius > core / 2`, so the stamps break the core's edge and the texture
 *      is visible at all. A stamp that fits inside the core paints nothing.
 *
 * The grain's own ratios (radius/spacing, radius/squash) are untouched: only the
 * scale at which the material works changed.
 */
const GRAIN: Partial<Record<BrushKind, GrainProfile>> = {
  crayon: {
    core: 0.7,
    spacing: 0.26,
    radius: 0.5,
    jitter: 0.3,
    squash: [0.6, 0.9],
    opacity: 0.95,
  },
  charcoal: {
    core: 0.35,
    spacing: 0.4,
    radius: 0.475,
    jitter: 0.55,
    squash: [0.6, 1],
    opacity: 0.9,
  },
  pencil: {
    core: 0.55,
    spacing: 0.22,
    radius: 0.4,
    jitter: 0.3,
    squash: [0.6, 0.9],
    opacity: 0.45,
  },
  oil: {
    core: 0.8,
    spacing: 0.2,
    radius: 0.525,
    jitter: 0.12,
    squash: [0.35, 0.55],
    opacity: 0.95,
  },
  spray: {
    core: 0,
    spacing: 0.3,
    radius: 0.1,
    // The cloud is the nozzle's width, not the droplet's: the droplets stay
    // small and the SCATTER carries the band, which is what the raster engine
    // already does with `SPRAY_DEFAULTS.spread`.
    scatter: 0.35,
    jitter: 0.7,
    squash: [0.8, 1],
    opacity: 0.9,
    grainOnly: true,
  },
  // Two passes only where the stroke is long enough for the darker edge to
  // show; a 3-5 tap should not pay for a second layer. The halo is WIDER than
  // the core: that is the bleed.
  watercolor: {
    core: 0.9,
    spacing: 0.16,
    radius: 0.575,
    jitter: 0.3,
    squash: [0.7, 1],
    opacity: 0.16,
    wash: true,
    secondAbove: 150,
  },
};

/** Canvas coordinates are ~1000 units wide: the unit is invisible, the tenth is not. */
const c = (v: number) => Math.round(v);
/**
 * Radii keep one decimal — a 2.6-unit stamp and a 2-unit one do look different.
 * The leading zero is dropped (`.5`), which SVG accepts and which saves 240×4
 * characters on a capped stroke.
 */
const f = (v: number) => String(Math.round(v * 10) / 10).replace(/^(-?)0\./, "$1.");

/** An ellipse as two half-arcs: one closed sub-path, cheap in `d`. */
function stamp(cx: number, cy: number, rx: number, ry: number, rot: number): string {
  return `M${c(cx - rx)} ${c(cy)}a${f(rx)} ${f(ry)} ${c(rot)} 1 0 ${f(rx * 2)} 0a${f(rx)} ${f(ry)} ${c(rot)} 1 0 ${f(-rx * 2)} 0Z`;
}

/**
 * The polyline, subsampled when the stroke is long. The command keeps every
 * point — hit-testing and undo still use the original list.
 */
function sampled(points: Point[]): Point[] {
  if (points.length <= MAX_POINTS) return points;
  const stride = Math.ceil(points.length / MAX_POINTS);
  const out = points.filter((_, i) => i % stride === 0);
  const last = points[points.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/** Total polyline length, used only to decide the second wash pass. */
function pathLength(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
  }
  return total;
}

/** Stamps spaced along the polyline, never more than `budget`. */
function grainPath(
  points: Point[],
  size: number,
  profile: GrainProfile,
  rand: () => number,
  budget: number,
  gaps?: readonly Gap[],
): { d: string; count: number } {
  const pts = sampled(points);
  if (pts.length === 0) return { d: "", count: 0 };
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]);
  }
  const base = Math.max(0.6, size * profile.spacing);
  // The cap is enforced by construction: a denser base spacing is widened until
  // the whole stroke fits the budget, so no stroke can blow the DOM up.
  const step = Math.max(base, total / Math.max(1, budget));
  const rBase = Math.max(0.2, size * profile.radius);
  const [sqMin, sqMax] = profile.squash;
  // The spans are measured on the command's own points and this walk may be
  // subsampled, so each stamp reads its length back through the same table —
  // and only a stroke that was erased pays for the table at all.
  const erased = gaps && gaps.length > 0 ? gaps : null;
  const cum = erased ? cumulativeLengths(points) : null;
  const origin = erased ? originIndexes(points, pts) : null;

  const out: string[] = [];
  /** The length each stamp sits at, in the command's own units. */
  const at: number[] = [];
  let carry = 0;
  let count = 0;
  for (let i = 1; i < pts.length && count < budget; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg === 0) continue;
    // The segment's normal, for the materials whose band comes from scatter
    // (spray): the stamp walks across the line instead of along it.
    const ux = (x1 - x0) / seg;
    const uy = (y1 - y0) / seg;
    const scatter = profile.scatter ? size * profile.scatter : 0;
    // Where this walked segment starts and ends on the command's own length.
    const from = cum && origin ? (cum[origin[i - 1] ?? 0] ?? 0) : 0;
    const to = cum && origin ? (cum[origin[i] ?? i] ?? from) : 0;
    let t = carry;
    while (t <= seg && count < budget) {
      const k = t / seg;
      const cx = x0 + (x1 - x0) * k;
      const cy = y0 + (y1 - y0) * k;
      // `scatter` is 0 for every material but the can, so the seed stream of the
      // others is untouched: their grain replays exactly as before this change.
      const off = scatter ? (rand() * 2 - 1) * scatter : 0;
      const jitter = 1 + (rand() * 2 - 1) * profile.jitter;
      const rx = Math.max(0.15, rBase * jitter);
      const ry = rx * (sqMin + rand() * (sqMax - sqMin));
      out.push(stamp(cx - uy * off, cy + ux * off, rx, ry, rand() * 180));
      if (erased) at.push(from + (to - from) * k);
      count++;
      t += step;
    }
    carry = t - seg;
  }
  // The rubber takes stamps away AFTER the whole grain exists: the survivors
  // are the same ellipses, in the same order, from the same random sequence.
  const kept = erased ? out.filter((_, i) => !inGap(erased, at[i] ?? 0)) : out;
  return { d: kept.join(""), count };
}

/**
 * How one stroke paints, layer by layer.
 *
 * A material with grain drops the dash from its core (the grain replaces it —
 * stacking both would double-texture the spray, whose dash is still in
 * `brushStroke` for the shelf preview).
 *
 * `gaps` are the spans an area erase took out of this stroke: the CORE is cut at
 * them (a grain that stops while the core keeps going would paint a smooth line
 * exactly where the rubber passed) and the grain drops the stamps that sit
 * inside them. Same spans the raster engine reads.
 */
export function strokesOf(
  stroke: {
    id: string;
    brush?: BrushKind;
    size: number;
    points: Point[];
  },
  gaps?: readonly Gap[],
): StrokeLayer[] {
  const { id, brush, size, points } = stroke;
  const geometry = brushStroke(brush, size);
  const profile = brush ? GRAIN[brush] : undefined;
  const core: StrokeLayer = {
    role: "core",
    d: strokePath(points, gaps),
    mode: "stroke",
    // The profile decides how wide the core is: narrow, so the stamps can break
    // its edge and the texture is visible at all.
    width: Math.max(1, profile ? size * profile.core : geometry.width),
    linecap: geometry.linecap,
    // Grain replaces the dash. Keeping both would double-texture the spray,
    // whose `0.01 7` dash is still what the shelf preview shows.
    dasharray: profile ? undefined : geometry.dasharray,
    // A wash keeps the media's own translucency; a grain gets an opaque core so
    // the stamps read as texture, not as a second lighter line.
    opacity: profile && !profile.wash ? 1 : (geometry.opacity ?? 1),
  };
  if (!profile) return [core];

  const rand = seeded(hashId(id));
  const role = profile.wash ? "wash" : "grain";
  const layers: StrokeLayer[] = profile.grainOnly ? [] : [core];
  // The cap is per STROKE, not per layer: a second wash pass spends from the
  // same budget instead of doubling it.
  const share = profile.secondAbove ? Math.round(MAX_STAMPS * 0.65) : MAX_STAMPS;
  const first = grainPath(points, size, profile, rand, share, gaps);
  layers.push({
    role,
    d: first.d,
    mode: "stamp",
    width: 0,
    linecap: "round",
    opacity: profile.opacity,
  });
  if (profile.secondAbove && pathLength(points) > profile.secondAbove) {
    // Same colour, same seed stream, lighter and sparser: the darker edge a
    // second pass of water leaves. Only where it can be seen.
    const second = grainPath(
      points,
      size,
      { ...profile, spacing: profile.spacing * 1.6 },
      rand,
      MAX_STAMPS - first.count,
      gaps,
    );
    layers.push({
      role,
      d: second.d,
      mode: "stamp",
      width: 0,
      linecap: "round",
      opacity: profile.opacity * 0.7,
    });
  }
  return layers;
}
