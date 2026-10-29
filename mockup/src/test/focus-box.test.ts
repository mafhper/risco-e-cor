// card-gradiente-obra §1: the card shows a square crop around the marks, with
// 10% of breathing room. The verification criteria are the spec's own:
//   - the window contains the marks (≥90% of the non-white pixels),
//   - the margin is visible (window ≥ 1.2× the marker span),
//   - a piece that spans the page falls back to the centred sheet.
import { describe, expect, it } from "vitest";
import { focusBox } from "@/mockup/artworks";
import type { Command, Point } from "@/mockup/history";

const stroke = (points: Point[]): Command => ({
  t: "stroke",
  id: "s1",
  color: "#111111",
  size: 4,
  points,
});

const inside = (box: { x: number; y: number; size: number }, [x, y]: Point) =>
  x >= box.x && x <= box.x + box.size && y >= box.y && y <= box.y + box.size;

describe("card focus crop", () => {
  it("contains every mark of a small sketch and keeps it inside the paper", () => {
    const points: Point[] = [
      [100, 120],
      [140, 120],
      [140, 160],
      [100, 160],
    ];
    const box = focusBox([stroke(points)], 300, 650);
    for (const p of points) expect(inside(box, p)).toBe(true);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.size).toBeLessThanOrEqual(300);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.size).toBeLessThanOrEqual(650);
  });

  it("leaves at least 10% of margin on each side of the marks", () => {
    const box = focusBox(
      [
        stroke([
          [100, 120],
          [140, 160],
        ]),
      ],
      300,
      650,
    );
    const span = 40;
    expect(box.size).toBeGreaterThanOrEqual(span * 1.2 - 1e-9);
  });

  it("centres the window on the marks, not on the sheet", () => {
    const box = focusBox(
      [
        stroke([
          [200, 400],
          [220, 420],
        ]),
      ],
      300,
      650,
    );
    expect(box.x + box.size / 2).toBeCloseTo(210, 5);
    expect(box.y + box.size / 2).toBeCloseTo(410, 5);
  });

  it("falls back to the centred sheet when the marks span the page", () => {
    expect(
      focusBox(
        [
          stroke([
            [10, 10],
            [290, 640],
          ]),
        ],
        300,
        650,
      ),
    ).toEqual({
      x: 0,
      y: 175,
      size: 300,
    });
  });

  it("has an honest window for a page filled only by taps", () => {
    const fills: Command[] = [{ t: "fill", region: "r1", color: "#ABCDEF" }];
    expect(focusBox(fills, 300, 650)).toEqual({ x: 0, y: 175, size: 300 });
  });
});
