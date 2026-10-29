// The canvas viewport: how the paper is translated and scaled inside its box.
//
// Kept as pure maths so the gesture rules are testable without a DOM. The
// transform is `translate(x, y) scale(scale)` with the origin at the paper's
// own top-left corner, so a paper point `p` lands at `p * scale + (x, y)` —
// measured from that corner, not from the screen.
//
// Three rules, all geometric rather than numeric:
//  1. the paper point under the fingers stays under the fingers;
//  2. the paper never leaves its own box, so a drawing can't be lost offscreen;
//  3. the buttons' zoom fixes the LAST PAINTED POINT, not the corner: a drawing
//     that sits off-centre must not slide away on `+`.
//
// One finger draws; two fingers pan and pinch. That is why the transform lives
// here and not in the pointer handlers: the handler only measures fingers.
//
// The fingers are measured on screen while the transform lives in paper
// coordinates, so a gesture has to be told where the paper sits (its `origin`).
// Reading `clientX/clientY` as if they were paper coordinates is what made the
// sheet slide upwards whenever the frame pushed it down the screen.

import { derive, type Command, type Point } from "./history";

export type Viewport = { scale: number; x: number; y: number };
export type Pt = { x: number; y: number };
/** Two fingers on screen: how far apart, and where their midpoint is. */
export type Span = { dist: number; mid: Pt };
/**
 * The paper as a gesture meets it: its layout size, and where its own top-left
 * corner sits on screen before the gesture transform is applied. The rendered
 * rect cannot be used for `origin` — it already carries the translation.
 */
export type Sheet = { w: number; h: number; origin: Pt };

export const MIN_SCALE = 1;
export const MAX_SCALE = 6;
export const FIT: Viewport = { scale: 1, x: 0, y: 0 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function spanBetween(a: Pt, b: Pt): Span {
  return {
    dist: Math.hypot(b.x - a.x, b.y - a.y),
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  };
}

/** Keeps the scale inside its range and the paper inside its own box. */
export function clampViewport(v: Viewport, paper: { w: number; h: number }): Viewport {
  const scale = clamp(v.scale, MIN_SCALE, MAX_SCALE);
  const minX = paper.w * (1 - scale);
  const minY = paper.h * (1 - scale);
  return {
    scale,
    x: minX >= 0 ? 0 : clamp(v.x, minX, 0),
    y: minY >= 0 ? 0 : clamp(v.y, minY, 0),
  };
}

/**
 * One BUTTON zoom step (`+` / `−`), fixed on a paper point: whatever sits at
 * `anchor` stays on the same screen pixel while everything around it scales.
 *
 * The anchor is a paper coordinate — the same space as `x`/`y`, not the screen
 * — because that is where the transform lives: a paper point `p` lands at
 * `p * scale + (x, y)`. Holding `anchor` on its pixel is exactly the
 * translation below. The old `x * factor` pinned the paper's own corner
 * instead, which walked an off-centre drawing away from the eye on every tap.
 *
 * The two-finger gesture is a different rule (the paper stays under the
 * fingers) and never comes through here.
 */
export function zoomAnchored(
  view: Viewport,
  factor: number,
  anchor: Pt,
  sheet: { w: number; h: number },
): Viewport {
  const scale = clamp(view.scale * factor, MIN_SCALE, MAX_SCALE);
  return clampViewport(
    {
      scale,
      x: view.x + anchor.x * (view.scale - scale),
      y: view.y + anchor.y * (view.scale - scale),
    },
    sheet,
  );
}

/** The desk is a region of its own; every other fill region belongs to the page. */
const DESK_REGION = "desk";

/** Where the page sits inside the desk, and the artwork it carries. */
export type ZoomGeometry = {
  artW: number;
  artH: number;
  pageLeft: number;
  pageTop: number;
  pageW: number;
  pageH: number;
  sheetW: number;
  sheetH: number;
};

/**
 * Where a button zoom should fix the view, in paper-view px (the space of the
 * viewport's `x`/`y`).
 *
 * The last place the author painted is what the eye follows:
 *  1. the last painted command — a stroke's last point, or the centre of the
 *     surface a bucket painted (page or desk). An erase does not move the
 *     anchor: it is a wipe, not a mark, so the command before it answers;
 *  2. with nothing pointable, the centre of what survives re-derivation (a
 *     broken point has no pixel of its own);
 *  3. an empty sheet zooms on its own centre.
 *
 * Pure on purpose: the screen passes the commands and the measured geometry,
 * so the rule is testable without a DOM and without the store.
 */
export function resolveZoomAnchor(commands: readonly Command[], g: ZoomGeometry): Pt {
  const pageCentre: Pt = { x: g.pageLeft + g.pageW / 2, y: g.pageTop + g.pageH / 2 };
  const sheetCentre: Pt = { x: g.sheetW / 2, y: g.sheetH / 2 };
  /** Artwork point -> paper-view px; a point with no pixel gives no anchor. */
  const toSheet = (p: Point): Pt | null => {
    const [x, y] = p;
    if (!(g.artW > 0) || !(g.artH > 0)) return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return { x: g.pageLeft + (x / g.artW) * g.pageW, y: g.pageTop + (y / g.artH) * g.pageH };
  };

  for (let i = commands.length - 1; i >= 0; i--) {
    const command = commands[i]!;
    // Both wipes are a wipe, not a mark: the command before them answers.
    if (command.t === "erase" || command.t === "eraseArea") continue;
    if (command.t === "stroke") {
      const last = command.points[command.points.length - 1];
      const at = last ? toSheet(last) : null;
      if (at) return at;
      break; // A point with no pixel: fall through to the derived centre.
    }
    return command.region === DESK_REGION ? sheetCentre : pageCentre;
  }

  const { strokes, fills } = derive(commands);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      const at = toSheet(point);
      if (!at) continue;
      minX = Math.min(minX, at.x);
      minY = Math.min(minY, at.y);
      maxX = Math.max(maxX, at.x);
      maxY = Math.max(maxY, at.y);
    }
  }
  if (minX <= maxX) return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  // Only the bucket marked the sheet: the page's own rectangle is the drawing.
  if (Object.keys(fills).length > 0) return pageCentre;
  return sheetCentre;
}

/**
 * One gesture step: `from` is the span that started the gesture and the
 * viewport it started from; `to` is the span now. Both spans are measured on
 * screen, and `sheet` says where the paper sits there. Pinch changes the scale,
 * moving both fingers translates, and the two compose because the anchor is the
 * same paper point in both spans.
 */
export function applyGesture(start: Viewport, from: Span, to: Span, sheet: Sheet): Viewport {
  const factor = from.dist > 0 ? to.dist / from.dist : 1;
  const scale = clamp(start.scale * factor, MIN_SCALE, MAX_SCALE);
  // The paper point under the fingers, in the paper's own coordinates: take the
  // on-screen midpoint back past the paper's corner and undo the translation.
  const anchorX = (from.mid.x - sheet.origin.x - start.x) / start.scale;
  const anchorY = (from.mid.y - sheet.origin.y - start.y) / start.scale;
  // Put that same paper point back under the fingers at the new scale.
  return clampViewport(
    {
      scale,
      x: to.mid.x - sheet.origin.x - anchorX * scale,
      y: to.mid.y - sheet.origin.y - anchorY * scale,
    },
    sheet,
  );
}

export function transformOf(v: Viewport): string {
  return `translate(${v.x}px, ${v.y}px) scale(${v.scale})`;
}

/** Where the sheet and the page sit inside it, in the sheet's own px. */
export type PaperFrame = {
  sheetW: number;
  sheetH: number;
  pageLeft: number;
  pageTop: number;
  pageW: number;
  pageH: number;
};

/**
 * THE SHEET RE-FRAMED (owner's decision, 27/10, `chrome-v2` §3). When the side
 * rail opens, the useful width shrinks and the page is laid out again inside
 * it; the drawing must not jump under the eye, so the paper point that was
 * sitting at the centre of the visible sheet is put back at the centre of the
 * new one.
 *
 * `before` and `after` are the two layouts. The point is read in PAGE
 * coordinates (a fraction, so it survives the page itself getting smaller) and
 * the transform is solved for it — the zoom the person chose is never touched:
 * what changed is the frame, not the drawing.
 *
 * `clampViewport` still rules: at FIT the whole sheet is visible, so the answer
 * is the paper simply re-centred and no pan can be asked for.
 */
export function reanchorView(view: Viewport, before: PaperFrame, after: PaperFrame): Viewport {
  if (
    before.sheetW <= 0 ||
    before.sheetH <= 0 ||
    before.pageW <= 0 ||
    before.pageH <= 0 ||
    after.sheetW <= 0 ||
    after.sheetH <= 0 ||
    after.pageW <= 0 ||
    after.pageH <= 0
  ) {
    return view;
  }
  const { scale } = view;
  // The page fraction under the centre of what the person was looking at.
  const u = ((before.sheetW / 2 - view.x) / scale - before.pageLeft) / before.pageW;
  const v = ((before.sheetH / 2 - view.y) / scale - before.pageTop) / before.pageH;
  // Where that point sat in the sheet's own px, and where it sits now. The
  // translation takes the difference at the SAME scale: the person's zoom is
  // never touched, only the frame moves.
  const dx = before.pageLeft + u * before.pageW - (after.pageLeft + u * after.pageW);
  const dy = before.pageTop + v * before.pageH - (after.pageTop + v * after.pageH);
  return clampViewport(
    { scale, x: view.x + dx * scale, y: view.y + dy * scale },
    { w: after.sheetW, h: after.sheetH },
  );
}
