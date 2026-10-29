import { describe, expect, it } from "vitest";
import { canUndo, derive, emptyHistory, push, redo, undo, UNDO_LIMIT } from "@/mockup/history";
import { isCorrect, makeChallenge } from "@/mockup/gate";

const fill = (region: string, color: string) => ({ t: "fill" as const, region, color });

describe("undo/redo", () => {
  it("allows at most 50 consecutive undos", () => {
    let h = emptyHistory();
    for (let i = 0; i < 60; i++) h = push(h, fill(`r${i}`, "#f00"));
    let undos = 0;
    while (canUndo(h)) {
      h = undo(h);
      undos++;
    }
    expect(UNDO_LIMIT).toBe(50);
    expect(undos).toBe(50);
    expect(h.commands.length).toBe(10);
  });

  it("a new action clears redo", () => {
    let h = push(emptyHistory(), fill("a", "#f00"));
    h = undo(h);
    expect(h.redo.length).toBe(1);
    h = push(h, fill("b", "#00f"));
    expect(h.redo.length).toBe(0);
  });

  it("redo restores what undo removed", () => {
    let h = push(emptyHistory(), fill("a", "#f00"));
    h = push(h, fill("a", "#00f"));
    h = undo(h);
    expect(derive(h.commands).fills["a"]).toBe("#f00");
    h = redo(h);
    expect(derive(h.commands).fills["a"]).toBe("#00f");
  });

  it("the whole-stroke command removes the stroke and undo brings it back", () => {
    let h = push(emptyHistory(), {
      t: "stroke",
      id: "s1",
      color: "#000",
      size: 6,
      points: [
        [0, 0],
        [10, 10],
      ],
    });
    h = push(h, { t: "erase", strokeIds: ["s1"] });
    expect(derive(h.commands).strokes.length).toBe(0);
    h = undo(h);
    expect(derive(h.commands).strokes.length).toBe(1);
  });

  it("the block eraser also wipes a painted region, and undo paints it again", () => {
    // A child on a coloring page paints with the bucket, then reaches for the
    // third material (the eraser). If it only removed freehand strokes, the
    // card would be a dead door on the surface where a child meets it first.
    let h = push(emptyHistory(), fill("mar", "#2B7FFF"));
    h = push(h, { t: "erase", strokeIds: [], regions: ["mar"] });
    expect(derive(h.commands).fills["mar"]).toBeUndefined();
    h = undo(h);
    expect(derive(h.commands).fills["mar"]).toBe("#2B7FFF");
  });

  it("an erase written before regions existed still replays strokes", () => {
    // Legacy save: no `regions` field at all.
    let h = push(emptyHistory(), fill("mar", "#2B7FFF"));
    h = push(h, { t: "stroke", id: "s1", color: "#000", size: 6, points: [[0, 0]] });
    h = push(h, { t: "erase", strokeIds: ["s1"] });
    const out = derive(h.commands);
    expect(out.strokes).toHaveLength(0);
    expect(out.fills["mar"]).toBe("#2B7FFF");
  });
});

describe("parental gate", () => {
  it("asks a two-digit plus one-digit sum and accepts only the right answer", () => {
    const c = makeChallenge(() => 0.1);
    expect(c.a).toBeGreaterThanOrEqual(10);
    expect(c.a).toBeLessThan(100);
    expect(c.b).toBeLessThan(10);
    expect(isCorrect(c, String(c.a + c.b))).toBe(true);
    expect(isCorrect(c, String(c.a + c.b + 1))).toBe(false);
    expect(isCorrect(c, "")).toBe(false);
  });
});
