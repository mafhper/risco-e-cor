// Command-based document model: every action is a command, so undo/redo,
// autosave and (future) replay all come from the same list.
//
// A stroke carries *style* as optional data (brush, opacity, effects,
// gradient). The command list and the undo/redo engine are unchanged: a save
// written before the shelf existed simply has none of these fields and paints
// as a plain round stroke.

import type { BrushKind } from "./brush";
import type { StrokeGradient } from "./palette";

export type Point = [number, number];

/**
 * The spray nozzle. The can is the one material whose tip the author tunes, and
 * it travels WITH the mark: undo/redo, the thumbnails and the export all
 * re-derive the drawing from the command list, so a stroke that replayed with a
 * different nozzle would not be the same stroke.
 *
 * Absent = the shelf's own nozzle (`SPRAY_DEFAULTS`), which is exactly how a
 * save written before the nozzle existed replays (brush-seco-e-spray §3).
 */
export type SpraySettings = {
  /** Ponta: droplet radius, as a fraction of the brush size. */
  tip: number;
  /** Dispersão: perpendicular deviation, as a fraction of the brush size. */
  spread: number;
  /** Intensidade: droplets per step and their opacity. */
  intensity: number;
};

/** §3 of brush-seco-e-spray: the nozzle a new spray stroke starts from. */
export const SPRAY_DEFAULTS: SpraySettings = { tip: 0.1, spread: 0.55, intensity: 0.6 };

/**
 * The ranges the panel exposes. The engine clamps a replayed command with the
 * SAME object, so the slider and the paint can never disagree about the bounds.
 */
export const SPRAY_RANGE = {
  tip: { min: 0.04, max: 0.2, step: 0.01 },
  spread: { min: 0, max: 1.2, step: 0.05 },
  intensity: { min: 0.2, max: 1, step: 0.05 },
} as const;

/** A number read inside a band; anything that is not one reads the fallback. */
function withinBand(
  value: number | undefined,
  fallback: number,
  range: { min: number; max: number },
): number {
  const n = value ?? fallback;
  return Number.isFinite(n) ? Math.min(range.max, Math.max(range.min, n)) : fallback;
}

/**
 * The one nozzle reader. A save written before the field existed has none and
 * lands on the shelf's own; a number outside the panel's range (a hand-edited
 * save or a backup) is clamped instead of trusted. Profile, panel and engine
 * share this function, so the three can never disagree about the bounds.
 */
export function nozzleOf(spray: SpraySettings | undefined): SpraySettings {
  const raw: Partial<SpraySettings> = spray ?? {};
  return {
    tip: withinBand(raw.tip, SPRAY_DEFAULTS.tip, SPRAY_RANGE.tip),
    spread: withinBand(raw.spread, SPRAY_DEFAULTS.spread, SPRAY_RANGE.spread),
    intensity: withinBand(raw.intensity, SPRAY_DEFAULTS.intensity, SPRAY_RANGE.intensity),
  };
}

/**
 * Sombra and brilho are the two effects of a stroke (efeitos-chevrons §7.3).
 *
 * They are OPTIONAL DATA on the command, exactly like the nozzle: absent = the
 * effect does not exist, so a save written before them replays pixel by pixel.
 * `on` belongs to the object because the profile remembers each tool's switch
 * with its parameters (turning the effect off must not throw the tuning away);
 * the COMMAND only ever carries an effect that is on.
 *
 * The colour of the shadow is fixed black — a shadow is depth, not ink — while
 * the glow is "auto" (the stroke's own colour at paint time) or a hex.
 */
export type ShadowEffect = {
  on: boolean;
  /** 0..100; on the layer it is an alpha, never a flat black. */
  intensity: number;
  /** −6..6, artwork units at 1×. Negative = to the left. */
  dx: number;
  /** 0..6; an adhesive shadow never goes up. */
  dy: number;
  /** 0..8; blur of the silhouette (0 = a hard, offset contour). */
  radius: number;
  /** 0..4; grows the silhouette BEFORE the blur. */
  spread: number;
};

export type GlowEffect = {
  on: boolean;
  /** 0..100; the alpha of the glow layer. */
  intensity: number;
  /** 2..12; below 2 the glow reads as an outline. */
  radius: number;
  /** "auto" = the stroke's own colour at paint time; a hex = a fixed colour. */
  color: string;
};

/** The two effects a stroke may carry, both OFF until the author turns them on. */
export const SHADOW_DEFAULTS = { on: false, intensity: 50, dx: 0, dy: 2, radius: 3, spread: 0 };
export const GLOW_DEFAULTS = { on: false, intensity: 60, radius: 6, color: "auto" };

/**
 * The ranges the chevrons expose. The engine clamps a replayed command with the
 * SAME object, so the slider and the paint can never disagree about the bounds.
 */
export const SHADOW_RANGE = {
  intensity: { min: 0, max: 100, step: 5 },
  dx: { min: -6, max: 6, step: 1 },
  dy: { min: 0, max: 6, step: 1 },
  radius: { min: 0, max: 8, step: 1 },
  spread: { min: 0, max: 4, step: 1 },
} as const;
export const GLOW_RANGE = {
  intensity: { min: 0, max: 100, step: 5 },
  radius: { min: 2, max: 12, step: 1 },
} as const;

const isHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

/**
 * The one shadow reader — panel, profile memory and engine share it, so a
 * stored value the panel could not show is clamped (or dropped) instead of
 * trusted. Absent = off, with the factory parameters.
 */
export function shadowOf(shadow: ShadowEffect | undefined): ShadowEffect {
  const raw: Partial<ShadowEffect> = shadow ?? {};
  return {
    on: raw.on === true,
    intensity: withinBand(raw.intensity, SHADOW_DEFAULTS.intensity, SHADOW_RANGE.intensity),
    dx: withinBand(raw.dx, SHADOW_DEFAULTS.dx, SHADOW_RANGE.dx),
    dy: withinBand(raw.dy, SHADOW_DEFAULTS.dy, SHADOW_RANGE.dy),
    radius: withinBand(raw.radius, SHADOW_DEFAULTS.radius, SHADOW_RANGE.radius),
    spread: withinBand(raw.spread, SHADOW_DEFAULTS.spread, SHADOW_RANGE.spread),
  };
}

/** …and the glow's: "auto" is the only colour that is not a hex. */
export function glowOf(glow: GlowEffect | undefined): GlowEffect {
  const raw: Partial<GlowEffect> = glow ?? {};
  return {
    on: raw.on === true,
    intensity: withinBand(raw.intensity, GLOW_DEFAULTS.intensity, GLOW_RANGE.intensity),
    radius: withinBand(raw.radius, GLOW_DEFAULTS.radius, GLOW_RANGE.radius),
    color: raw.color === "auto" ? "auto" : isHex(raw.color) ? raw.color.toUpperCase() : "auto",
  };
}

export type StrokeCommand = {
  t: "stroke";
  id: string;
  color: string;
  size: number;
  points: Point[];
  /** The shelf brush that drew it; absent = plain round brush (legacy). */
  brush?: BrushKind;
  /** 20..100; absent = 100. */
  opacity?: number;
  /** Legacy SVG filter of a save written before the raster pass; never written now. */
  shadow?: boolean;
  /** Legacy SVG filter of a save written before the raster pass; never written now. */
  glow?: boolean;
  /** Gradient paint; absent = solid `color`. */
  gradient?: StrokeGradient;
  /** Spray nozzle this stroke was painted with; absent = the shelf's own. */
  spray?: SpraySettings;
  /** Shadow of the raster post-pass; absent = no shadow (efeitos-chevrons §7.6). */
  sombra?: ShadowEffect;
  /** Glow of the raster post-pass; absent = no glow. */
  brilho?: GlowEffect;
};
export type FillCommand = { t: "fill"; region: string; color: string };
/**
 * A whole-stroke erase, plus the region fills it also wipes. `regions` is
 * optional so every save written before it still replays: an old erase only
 * carried strokes.
 */
export type EraseCommand = { t: "erase"; strokeIds: string[]; regions?: string[] };
/**
 * A span of a stroke's own length, in ARTWORK UNITS, as `[start, end]` on the
 * accumulated length of its polyline. Always quantized to one decimal, ordered
 * and non-overlapping — the three properties every reader relies on, so the
 * same command derives the same spans on any phone and at any zoom.
 */
export type Gap = readonly [number, number];

/** One stroke a rubber pass BIT: the spans it took out of it. */
export type AreaEraseEdit = { strokeId: string; gaps: Gap[] };

/**
 * A RUBBER PASS — the area eraser, in spans of each stroke's own length.
 *
 * It exists because the rubber has a size, and a rubber whose size erases the
 * whole stroke is a rubber whose size does nothing (borracha-area §6.1): the
 * spans are what P, M and G actually change. The old `erase` command stays
 * untouched — a pass that covers a stroke completely is still WRITTEN as that
 * command (`planAreaErase`), so every save written before this one replays
 * exactly as it did.
 */
export type AreaEraseCommand = {
  t: "eraseArea";
  /** The rubber's radius used in the gesture (P/M/G = 12/24/40), for replay. */
  radius: number;
  /** The spans this pass took from the strokes that survived in part. */
  edits: AreaEraseEdit[];
  /** Strokes the pass covered WHOLE: removed exactly as the old command does. */
  strokeIds?: string[];
  /** Bucket regions wiped whole, same semantics as the old command's. */
  regions?: string[];
};
export type Command = StrokeCommand | FillCommand | EraseCommand | AreaEraseCommand;

export const UNDO_LIMIT = 50;

export type History = {
  commands: Command[];
  redo: Command[];
  /** How many of the latest commands can still be undone (max UNDO_LIMIT). */
  undoable: number;
};

export const emptyHistory = (): History => ({ commands: [], redo: [], undoable: 0 });

export function push(h: History, cmd: Command): History {
  return {
    commands: [...h.commands, cmd],
    redo: [], // any new command clears redo
    undoable: Math.min(UNDO_LIMIT, h.undoable + 1),
  };
}

export const canUndo = (h: History) => h.undoable > 0 && h.commands.length > 0;
export const canRedo = (h: History) => h.redo.length > 0;

export function undo(h: History): History {
  if (!canUndo(h)) return h;
  const last = h.commands[h.commands.length - 1]!;
  return {
    commands: h.commands.slice(0, -1),
    redo: [...h.redo, last],
    undoable: h.undoable - 1,
  };
}

export function redo(h: History): History {
  if (!canRedo(h)) return h;
  const next = h.redo[h.redo.length - 1]!;
  return {
    commands: [...h.commands, next],
    redo: h.redo.slice(0, -1),
    undoable: Math.min(UNDO_LIMIT, h.undoable + 1),
  };
}

export type Derived = {
  fills: Record<string, string>;
  strokes: StrokeCommand[];
  /**
   * The spans every area erase took out of a stroke, merged per stroke and
   * across gestures (borracha-area §6.1). A stroke absent from the map is
   * whole: nothing was ever taken from it.
   *
   * The map is derived, never stored: undo is the command leaving the list, and
   * the spans leave with it — there is no second source of truth to keep in
   * sync with the drawing.
   */
  gaps: Record<string, Gap[]>;
};

/** Replays the command list into what the screen shows. */
export function derive(commands: readonly Command[]): Derived {
  const fills: Record<string, string> = {};
  const strokes = new Map<string, StrokeCommand>();
  for (const c of commands) {
    if (c.t === "fill") fills[c.region] = c.color;
    else if (c.t === "stroke") strokes.set(c.id, c);
    else if (c.t === "erase") {
      for (const id of c.strokeIds) strokes.delete(id);
      // The block eraser wipes a painted region too: on a coloring page the
      // bucket's fill is the mark a child wants gone, and a tool that only
      // removes freehand strokes is a dead door on that surface.
      for (const region of c.regions ?? []) delete fills[region];
    } else {
      // The area pass removes whole strokes and whole regions the same way; its
      // spans are collected below, once every command has had its say.
      for (const id of c.strokeIds ?? []) strokes.delete(id);
      for (const region of c.regions ?? []) delete fills[region];
    }
  }

  // Second pass: every span of every pass, per stroke, merged in command order.
  // Merging ACROSS gestures is what keeps two overlapping passes from leaving
  // two islands where the paper shows one.
  const spans = new Map<string, Gap[]>();
  for (const c of commands) {
    if (c.t !== "eraseArea") continue;
    for (const edit of c.edits) {
      const list = spans.get(edit.strokeId);
      if (list) list.push(...edit.gaps);
      else spans.set(edit.strokeId, [...edit.gaps]);
    }
  }
  const gaps: Record<string, Gap[]> = {};
  for (const [id, list] of spans) {
    // A stroke that is gone cannot be painted: its spans go with it, so a later
    // stroke that happens to reuse the id is never born half erased.
    if (!strokes.has(id)) continue;
    const merged = mergeGaps(list);
    if (merged.length > 0) gaps[id] = merged;
  }
  return { fills, strokes: [...strokes.values()], gaps };
}

/** One run of the polyline, drawn as its own sub-path (a stroke with gaps). */
function pathOf(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const [x, y] = points[0]!;
    return `M${x} ${y} L${x + 0.01} ${y}`;
  }
  const p0 = points[0]!;
  let d = `M${p0[0].toFixed(1)} ${p0[1].toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]!;
    const [nx, ny] = points[i + 1]!;
    d += ` Q${x.toFixed(1)} ${y.toFixed(1)} ${((x + nx) / 2).toFixed(1)} ${((y + ny) / 2).toFixed(1)}`;
  }
  const [lx, ly] = points[points.length - 1]!;
  d += ` L${lx.toFixed(1)} ${ly.toFixed(1)}`;
  return d;
}

/**
 * Smooth SVG path through points (quadratic midpoints).
 *
 * With `gaps`, the path is CUT at the spans the rubber took: one `M` per
 * surviving run inside the same `d`. The solid core has to break too — a grain
 * that stops while the core keeps going leaves a smooth line where the rubber
 * passed, which is the defect borracha-area §6.5 names.
 */
export function strokePath(points: Point[], gaps?: readonly Gap[]): string {
  if (!gaps || gaps.length === 0) return pathOf(points);
  const runs = clippedRuns(points, gaps);
  if (runs.length === 0) return "";
  return runs.map(pathOf).join("");
}

function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = dx * dx + dy * dy;
  let t = len === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len;
  t = Math.max(0, Math.min(1, t));
  const x = a[0] + t * dx - p[0];
  const y = a[1] + t * dy - p[1];
  return Math.sqrt(x * x + y * y);
}

/**
 * Does `p` touch the stroke's own line? The eyedropper samples with this rule,
 * and so did the block eraser before the rubber had an area — the area rule is
 * the same distance applied per point of the polyline (`gapsForStroke`).
 */
export function strokeHit(stroke: StrokeCommand, p: Point, radius: number) {
  const pts = stroke.points;
  const r = radius + stroke.size / 2;
  if (pts.length === 1) return Math.hypot(pts[0]![0] - p[0], pts[0]![1] - p[1]) <= r;
  for (let i = 0; i < pts.length - 1; i++) {
    if (distToSegment(p, pts[i]!, pts[i + 1]!) <= r) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ *
 * The rubber's geometry: spans of a stroke's OWN length               *
 *                                                                     *
 * One contract, two readers (borracha-area §6.5): a stamp is dropped  *
 * when the length it sits at falls inside a span. The raster engine   *
 * and the vector engine both ask `inGap` with the same numbers, so    *
 * the paper and the thumbnail cannot disagree about where the rubber  *
 * passed.                                                             *
 * ------------------------------------------------------------------ */

/** Spans are written with one decimal: the zoom can never change them. */
export const GAP_DECIMALS = 1;
/** Above this share of the stroke's length, a pass takes the whole stroke. */
export const GAP_COLLAPSE = 0.95;
/** Spans a single pass may leave on ONE stroke before islands merge. */
export const MAX_GAPS = 24;

const roundGap = (v: number) => {
  const f = 10 ** GAP_DECIMALS;
  return Math.round(v * f) / f;
};

/** Accumulated length at each point: `[0, |p0p1|, |p0p1|+|p1p2|, …]`. */
export function cumulativeLengths(points: readonly Point[]): number[] {
  const out = [0];
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1]!;
    const [bx, by] = points[i]!;
    out.push(out[i - 1]! + Math.hypot(bx - ax, by - ay));
  }
  return out;
}

/** The stroke's own length, in artwork units. */
export function strokeLength(points: readonly Point[]): number {
  const cum = cumulativeLengths(points);
  return cum[cum.length - 1] ?? 0;
}

/**
 * The index of each WALKED point inside the command's own `points`.
 *
 * The engines walk a thinned (raster) or subsampled (vector) copy of the
 * polyline, but the rubber's spans are measured on the command's points — so a
 * stamp has to answer in the same units as the span it is compared against.
 * Both walks only ever DROP points, in order, so a cursor finds each one.
 */
export function originIndexes(points: readonly Point[], walked: readonly Point[]): number[] {
  const out: number[] = [];
  let cursor = 0;
  const last = Math.max(0, points.length - 1);
  for (const p of walked) {
    while (cursor < last && points[cursor] !== p) cursor++;
    out.push(cursor);
  }
  return out;
}

/**
 * Ordered, non-overlapping spans — the canonical form `derive` publishes and
 * every reader assumes. Touching spans merge: the paper shows one island, not
 * two whose ends happen to coincide.
 */
export function mergeGaps(gaps: readonly Gap[]): Gap[] {
  const sorted = gaps
    .filter((g) => Number.isFinite(g[0]) && Number.isFinite(g[1]))
    .map((g) => [roundGap(Math.min(g[0], g[1])), roundGap(Math.max(g[0], g[1]))] as Gap)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: Gap[] = [];
  for (const g of sorted) {
    const last = out[out.length - 1];
    if (last && g[0] <= last[1]) {
      if (g[1] > last[1]) out[out.length - 1] = [last[0], g[1]];
    } else {
      out.push([g[0], g[1]]);
    }
  }
  return out;
}

/** How much line the spans take, in artwork units. */
export function gapsLength(gaps: readonly Gap[]): number {
  let total = 0;
  for (const [a, b] of gaps) total += Math.max(0, b - a);
  return total;
}

/**
 * True when the length `at` falls inside one of the spans. Binary search: the
 * painters ask this once per stamp, on every repaint.
 */
export function inGap(gaps: readonly Gap[] | undefined, at: number): boolean {
  if (!gaps || gaps.length === 0) return false;
  let lo = 0;
  let hi = gaps.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const gap = gaps[mid]!;
    if (at < gap[0]) hi = mid - 1;
    else if (at > gap[1]) lo = mid + 1;
    else return true;
  }
  return false;
}

/** `gaps` minus `remove`: erasing the void again adds nothing (idempotent). */
export function subtractGaps(gaps: readonly Gap[], remove: readonly Gap[]): Gap[] {
  let out = mergeGaps(gaps);
  for (const [ra, rb] of mergeGaps(remove)) {
    const next: Gap[] = [];
    for (const [a, b] of out) {
      if (rb <= a || ra >= b) {
        next.push([a, b]);
        continue;
      }
      if (a < ra) next.push([a, ra]);
      if (rb < b) next.push([rb, b]);
    }
    out = next;
  }
  return out.filter(([a, b]) => b > a);
}

/**
 * At most `MAX_GAPS` spans, merging the CLOSEST pair first: the island between
 * them is the cheapest to give up, so a sinuous pass over a long scribble can
 * never grow the command without bound (borracha-area §8).
 */
export function capGaps(gaps: readonly Gap[]): Gap[] {
  let out = mergeGaps(gaps);
  while (out.length > MAX_GAPS) {
    let at = 1;
    let closest = Number.POSITIVE_INFINITY;
    for (let i = 1; i < out.length; i++) {
      const bridge = out[i]![0] - out[i - 1]![1];
      if (bridge < closest) {
        closest = bridge;
        at = i;
      }
    }
    const left = out[at - 1]!;
    const right = out[at]!;
    out = [...out.slice(0, at - 1), [left[0], right[1]] as Gap, ...out.slice(at + 1)];
  }
  return out;
}

/** Distance from a point to the rubber's own path (a capsule chain). */
function distToPath(p: Point, path: readonly Point[]): number {
  if (path.length === 1) return Math.hypot(path[0]![0] - p[0], path[0]![1] - p[1]);
  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < path.length; i++) {
    const d = distToSegment(p, path[i - 1]!, path[i]!);
    if (d < best) best = d;
  }
  return best;
}

/** The point of the polyline at length `at` (interpolated inside its segment). */
function pointAtLength(points: readonly Point[], cum: readonly number[], at: number): Point {
  const total = cum[cum.length - 1] ?? 0;
  const clamped = Math.max(0, Math.min(total, at));
  let lo = 0;
  let hi = Math.max(0, points.length - 1);
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if ((cum[mid] ?? 0) <= clamped) lo = mid;
    else hi = mid;
  }
  const a = points[lo]!;
  const b = points[hi]!;
  const span = (cum[hi] ?? 0) - (cum[lo] ?? 0);
  const k = span > 0 ? (clamped - (cum[lo] ?? 0)) / span : 0;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/** The polyline cut into the runs that survive `gaps`, in order. */
function clippedRuns(points: readonly Point[], gaps: readonly Gap[]): Point[][] {
  const cum = cumulativeLengths(points);
  const total = cum[cum.length - 1] ?? 0;
  if (!(total > 0)) return inGap(gaps, 0) ? [] : [points as Point[]];
  const runs: Point[][] = [];
  let from = 0;
  for (const [a, b] of mergeGaps(gaps)) {
    const start = Math.max(0, Math.min(total, a));
    const end = Math.max(0, Math.min(total, b));
    if (start > from) runs.push(runBetween(points, cum, from, start));
    from = Math.max(from, end);
  }
  if (from < total) runs.push(runBetween(points, cum, from, total));
  return runs.filter((run) => run.length > 0);
}

/** The sub-polyline between two lengths: both ends are real points. */
function runBetween(
  points: readonly Point[],
  cum: readonly number[],
  from: number,
  to: number,
): Point[] {
  const out: Point[] = [pointAtLength(points, cum, from)];
  for (let i = 0; i < points.length; i++) {
    const at = cum[i]!;
    if (at > from && at < to) out.push(points[i]!);
  }
  out.push(pointAtLength(points, cum, to));
  return out;
}

/**
 * The spans of `stroke` a rubber of `radius` wipes while travelling `path`.
 *
 * The hit rule is the one the block eraser always used — `radius + size / 2` —
 * applied PER POINT of the polyline instead of per stroke (borracha-area §3.1):
 * that is what makes the size of the rubber mean something. The scan walks the
 * stroke's own length, refines each edge by bisection (far below the 0.1 the
 * spans are written with) and returns merged, quantized, ordered spans.
 */
export function gapsForStroke(
  stroke: Pick<StrokeCommand, "points" | "size">,
  path: readonly Point[],
  radius: number,
): Gap[] {
  const pts = stroke.points;
  const hit = radius + stroke.size / 2;
  if (pts.length === 0 || path.length === 0 || !(hit > 0)) return [];

  const cum = cumulativeLengths(pts);
  const total = cum[cum.length - 1] ?? 0;
  const covered = (at: number) => distToPath(pointAtLength(pts, cum, at), path) <= hit;

  // A dot has no length of its own: the rubber covers its one point or it does
  // not, and a zero-width span is the honest way to say so.
  if (!(total > 0)) return covered(0) ? [[0, 0]] : [];

  /** Where `covered` flips between `lo` (state `loState`) and `hi`. */
  const edgeBetween = (lo: number, hi: number, loState: boolean): number => {
    let a = lo;
    let b = hi;
    for (let i = 0; i < 14; i++) {
      const mid = (a + b) / 2;
      if (covered(mid) === loState) a = mid;
      else b = mid;
    }
    return (a + b) / 2;
  };

  // Eight samples per reach: an island narrower than that is a graze, and a
  // graze that lands on no stamp cannot show anyway.
  const stride = Math.max(0.4, hit / 8, total / 3000);
  const spans: Gap[] = [];
  let state = covered(0);
  let start = state ? 0 : -1;
  let at = 0;
  while (at < total) {
    const next = Math.min(total, at + stride);
    const now = covered(next);
    if (now !== state) {
      const edge = edgeBetween(at, next, state);
      if (now) start = edge;
      else if (start >= 0) {
        spans.push([roundGap(start), roundGap(edge)]);
        start = -1;
      }
      state = now;
    }
    at = next;
  }
  if (state && start >= 0) spans.push([roundGap(start), roundGap(total)]);
  return mergeGaps(spans).filter(([a, b]) => b > a);
}

/** What one rubber pass does to the drawing. */
export type AreaErasePlan = {
  /** Strokes the pass covers whole (>= `GAP_COLLAPSE` of their length). */
  strokeIds: string[];
  /** Strokes that survive in part: the spans the pass took. */
  edits: AreaEraseEdit[];
};

/**
 * Plans a rubber pass over the strokes of the document.
 *
 * `confirmed` is the map the document already derives, so a pass over a void
 * adds nothing. A stroke covered to `GAP_COLLAPSE` of its length is removed as
 * a whole — a long cleaning gesture must not become an endless list of islands.
 * The plan is pure: the same drawing, the same path and the same radius always
 * give the same spans, which is what makes the preview and the commit agree.
 */
export function planAreaErase(
  strokes: readonly StrokeCommand[],
  path: readonly Point[],
  radius: number,
  confirmed: Readonly<Record<string, readonly Gap[]>> = {},
): AreaErasePlan {
  const strokeIds: string[] = [];
  const edits: AreaEraseEdit[] = [];
  if (path.length === 0) return { strokeIds, edits };

  const pathBox = boundsOf(path);
  for (const stroke of strokes) {
    const reach = radius + stroke.size / 2;
    if (!near(pathBox, boundsOf(stroke.points), reach)) continue;
    const total = strokeLength(stroke.points);
    const before = confirmed[stroke.id] ?? [];
    const fresh = capGaps(subtractGaps(gapsForStroke(stroke, path, radius), before));
    if (fresh.length === 0) continue;
    const all = mergeGaps([...before, ...fresh]);
    const coverage = total > 0 ? Math.min(1, gapsLength(all) / total) : 1;
    if (coverage >= GAP_COLLAPSE) {
      strokeIds.push(stroke.id);
      continue;
    }
    edits.push({ strokeId: stroke.id, gaps: fresh });
  }
  return { strokeIds, edits };
}

type Bounds = { x0: number; y0: number; x1: number; y1: number };

function boundsOf(points: readonly Point[]): Bounds {
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/** Two boxes closer than `reach`: the cheap "can this rubber even touch it". */
function near(a: Bounds, b: Bounds, reach: number): boolean {
  if (!Number.isFinite(a.x0) || !Number.isFinite(b.x0)) return false;
  return (
    a.x0 - reach <= b.x1 && a.x1 + reach >= b.x0 && a.y0 - reach <= b.y1 && a.y1 + reach >= b.y0
  );
}
