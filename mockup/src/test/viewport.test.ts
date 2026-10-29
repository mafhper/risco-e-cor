// Seam under test: the paper viewport transform (pure maths, no DOM).
//
// Two coordinate systems meet here, and mixing them is the defect this file
// exists to prevent:
//  - the screen: `clientX/clientY` from the fingers, and where the paper's own
//    top-left corner sits on screen (`origin`);
//  - the paper: what `translate(x, y) scale(scale)` moves, whose origin is the
//    paper's own corner.
//
// The invariant that matters is geometric, and it is asserted with worked
// examples instead of re-deriving the formula: the paper point under the
// fingers must still be under the fingers after the gesture, and the paper can
// never be dragged off its own box.
import { describe, expect, it } from "vitest";
import {
  applyGesture,
  clampViewport,
  FIT,
  MAX_SCALE,
  MIN_SCALE,
  spanBetween,
  transformOf,
  type Sheet,
  type Viewport,
} from "@/mockup/viewport";

const PAPER = { w: 300, h: 400 };
/** The paper flush with the screen origin: on-screen and paper coordinates coincide. */
const AT_ORIGIN: Sheet = { ...PAPER, origin: { x: 0, y: 0 } };

/** Where a paper point lands on screen, as the CSS transform defines it. */
const onScreen = (v: Viewport, sheet: Sheet, p: { x: number; y: number }) => ({
  x: sheet.origin.x + v.x + p.x * v.scale,
  y: sheet.origin.y + v.y + p.y * v.scale,
});

describe("clampViewport", () => {
  it("never zooms below the fit or above the ceiling", () => {
    expect(clampViewport({ scale: 0.4, x: 0, y: 0 }, PAPER).scale).toBe(MIN_SCALE);
    expect(clampViewport({ scale: 9, x: 0, y: 0 }, PAPER).scale).toBe(MAX_SCALE);
  });

  it("has nothing to pan at fit scale", () => {
    expect(clampViewport({ scale: 1, x: -40, y: -70 }, PAPER)).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("keeps a zoomed paper covering its own box", () => {
    // scale 2 on a 300x400 paper: the origin may travel from -300 to 0.
    expect(clampViewport({ scale: 2, x: -40, y: -70 }, PAPER)).toEqual({
      scale: 2,
      x: -40,
      y: -70,
    });
    expect(clampViewport({ scale: 2, x: 120, y: 50 }, PAPER)).toEqual({ scale: 2, x: 0, y: 0 });
    expect(clampViewport({ scale: 2, x: -500, y: -900 }, PAPER)).toEqual({
      scale: 2,
      x: -300,
      y: -400,
    });
  });
});

describe("applyGesture", () => {
  it("doubles the scale around the midpoint between the fingers", () => {
    // Fingers 100 apart, centred at (150, 200); they end 200 apart, same centre.
    const out = applyGesture(
      FIT,
      { dist: 100, mid: { x: 150, y: 200 } },
      { dist: 200, mid: { x: 150, y: 200 } },
      AT_ORIGIN,
    );
    // Paper point (150,200) must still sit at (150,200): 150*2 - 150 = 150.
    expect(out).toEqual({ scale: 2, x: -150, y: -200 });
  });

  it("pans by the midpoint delta without changing the scale", () => {
    const start = { scale: 2, x: -150, y: -200 };
    const out = applyGesture(
      start,
      { dist: 100, mid: { x: 150, y: 200 } },
      { dist: 100, mid: { x: 170, y: 210 } },
      AT_ORIGIN,
    );
    expect(out).toEqual({ scale: 2, x: -130, y: -190 });
  });

  it("pins the paper corner when the fingers pinch at the origin", () => {
    const out = applyGesture(
      FIT,
      { dist: 100, mid: { x: 0, y: 0 } },
      { dist: 300, mid: { x: 0, y: 0 } },
      AT_ORIGIN,
    );
    expect(out).toEqual({ scale: 3, x: 0, y: 0 });
  });

  it("comes back to fit when the fingers collapse", () => {
    const out = applyGesture(
      { scale: 2, x: -150, y: -200 },
      { dist: 100, mid: { x: 150, y: 200 } },
      { dist: 10, mid: { x: 150, y: 200 } },
      AT_ORIGIN,
    );
    expect(out).toEqual({ scale: 1, x: 0, y: 0 });
  });

  it("stops at the ceiling instead of following the fingers past it", () => {
    const out = applyGesture(
      { scale: 4, x: 0, y: 0 },
      { dist: 100, mid: { x: 150, y: 200 } },
      { dist: 2000, mid: { x: 150, y: 200 } },
      AT_ORIGIN,
    );
    expect(out.scale).toBe(MAX_SCALE);
  });
});

// The paper is never at the screen origin in the app: the phone frame centres
// it inside the screen area, so its corner sits well below and to the right of
// (0, 0). The fingers are measured on screen; the transform lives in paper
// coordinates. These are the cases that tell the two apart.
describe("a paper that does not sit at the screen origin", () => {
  const ORIGIN = { x: 100, y: 162 };

  it("keeps the midpoint of a centred pinch fixed on screen", () => {
    // Paper 300x400 at (100, 162). Fingers pinch at (250, 362), which is the
    // paper point (150, 200) — the middle of the sheet.
    const sheet: Sheet = { ...PAPER, origin: ORIGIN };
    const out = applyGesture(
      FIT,
      { dist: 100, mid: { x: 250, y: 362 } },
      { dist: 200, mid: { x: 250, y: 362 } },
      sheet,
    );
    expect(out).toEqual({ scale: 2, x: -150, y: -200 });
    // The sheet moved, but the paper point under the fingers did not.
    expect(onScreen(out, sheet, { x: 150, y: 200 })).toEqual({ x: 250, y: 362 });
  });

  it("introduces no vertical slide when the frame offsets the paper from the top", () => {
    // The measured defect: a paper 162 px down the screen, pinched at its own
    // centre with a 3x spread. Reading the on-screen midpoint as a paper
    // coordinate threw the sheet 324 px up (and 324 px left here): the missing
    // offset, doubled by the zoom.
    const sheet: Sheet = { ...PAPER, origin: { x: 0, y: 162 } };
    const out = applyGesture(
      FIT,
      { dist: 100, mid: { x: 150, y: 362 } },
      { dist: 300, mid: { x: 150, y: 362 } },
      sheet,
    );
    expect(out).toEqual({ scale: 3, x: -300, y: -400 });
  });

  it("keeps the anchor on the second pinch, from an already zoomed viewport", () => {
    // The gesture starts perched at 2x, translated and offset on screen. The
    // paper point under the fingers is (150, 200) again; a 2x pinch there must
    // land the sheet at 4x with the corner at the frame's own origin.
    const sheet: Sheet = { ...PAPER, origin: ORIGIN };
    const out = applyGesture(
      { scale: 2, x: -150, y: -200 },
      { dist: 100, mid: { x: 250, y: 362 } },
      { dist: 200, mid: { x: 250, y: 362 } },
      sheet,
    );
    expect(out).toEqual({ scale: 4, x: -450, y: -600 });
    expect(onScreen(out, sheet, { x: 150, y: 200 })).toEqual({ x: 250, y: 362 });
  });

  it("keeps the anchored paper point under fingers that also travel", () => {
    // Real pinches do both at once: spread 2x while the midpoint moves 20/10.
    const sheet: Sheet = { ...PAPER, origin: ORIGIN };
    const out = applyGesture(
      FIT,
      { dist: 100, mid: { x: 250, y: 362 } },
      { dist: 200, mid: { x: 270, y: 372 } },
      sheet,
    );
    expect(out).toEqual({ scale: 2, x: -130, y: -190 });
    expect(onScreen(out, sheet, { x: 150, y: 200 })).toEqual({ x: 270, y: 372 });
  });

  it("pans one screen pixel per pixel under the fingers", () => {
    const sheet: Sheet = { ...PAPER, origin: ORIGIN };
    const start = { scale: 2, x: -150, y: -200 };
    const from = { dist: 100, mid: { x: 250, y: 362 } };
    const to = { dist: 100, mid: { x: 270, y: 372 } };
    const out = applyGesture(start, from, to, sheet);
    expect(out).toEqual({ scale: 2, x: -130, y: -190 });
    // The paper point that was under the midpoint travels with it, 1:1.
    const before = onScreen(start, sheet, { x: 150, y: 200 });
    expect(onScreen(out, sheet, { x: 150, y: 200 })).toEqual({
      x: before.x + 20,
      y: before.y + 10,
    });
  });

  it("still clamps at both ends when the paper is offset", () => {
    const sheet: Sheet = { ...PAPER, origin: ORIGIN };
    const spread = applyGesture(
      { scale: 4, x: -900, y: -1200 },
      { dist: 100, mid: { x: 250, y: 362 } },
      { dist: 2000, mid: { x: 250, y: 362 } },
      sheet,
    );
    expect(spread.scale).toBe(MAX_SCALE);
    expect(spread.x).toBeGreaterThanOrEqual(PAPER.w * (1 - MAX_SCALE));
    expect(spread.x).toBeLessThanOrEqual(0);
    expect(spread.y).toBeGreaterThanOrEqual(PAPER.h * (1 - MAX_SCALE));
    expect(spread.y).toBeLessThanOrEqual(0);

    const collapse = applyGesture(
      { scale: 2, x: -150, y: -200 },
      { dist: 100, mid: { x: 250, y: 362 } },
      { dist: 10, mid: { x: 250, y: 362 } },
      sheet,
    );
    expect(collapse).toEqual({ scale: MIN_SCALE, x: 0, y: 0 });
  });
});

describe("helpers", () => {
  it("reads distance and midpoint from two fingers", () => {
    expect(spanBetween({ x: 100, y: 100 }, { x: 200, y: 100 })).toEqual({
      dist: 100,
      mid: { x: 150, y: 100 },
    });
  });

  it("writes a CSS transform both axes can read", () => {
    expect(transformOf({ scale: 2, x: -30, y: 12 })).toBe("translate(-30px, 12px) scale(2)");
  });
});
