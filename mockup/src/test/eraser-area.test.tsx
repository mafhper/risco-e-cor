// The area eraser (borracha-area.md, 26/10). Seam: the SPANS.
//
// The rubber no longer takes a whole stroke: it takes the spans of the stroke's
// own length that its circle covers. That one sentence has to hold in five
// places, and this file walks them in order:
//
//   gapsForStroke → the spans a rubber of a given radius takes (P < M < G);
//   planAreaErase → what ONE pass does to the drawing (spans + whole removals);
//   derive        → the spans every painter reads, merged across gestures;
//   both engines  → drop the stamps that sit inside a span, keep the rest bit
//                   for bit (raster) and cut the core at the same interval
//                   (vector);
//   the gesture   → one pass = one command = one undo, whatever it crossed.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";
import { openTools } from "./open-panel";
import { paintStrokes, stampsOf, type Stamp } from "@/mockup/brushCanvas";
import {
  derive,
  emptyHistory,
  capGaps,
  gapsForStroke,
  gapsLength,
  mergeGaps,
  MAX_GAPS,
  planAreaErase,
  push,
  strokeLength,
  undo,
  type AreaEraseCommand,
  type Command,
  type Gap,
  type Point,
  type StrokeCommand,
} from "@/mockup/history";
import { strokesOf } from "@/mockup/strokeTexture";

const SIZE = 10;
/** The reference stroke: 200 units long, drawn left to right at y = 100. */
const straight = (from = 100, to = 300, y = 100): Point[] => [
  [from, y],
  [to, y],
];

function stroke(over: Partial<StrokeCommand> = {}): StrokeCommand {
  return { t: "stroke", id: "s1", color: "#2B7FFF", size: SIZE, points: straight(), ...over };
}

const gap = (a: number, b: number): Gap => [a, b];

/** The command one pass writes, over the reference stroke. */
const area = (radius: number, ...gaps: Gap[]): AreaEraseCommand => ({
  t: "eraseArea",
  radius,
  edits: [{ strokeId: "s1", gaps: gaps.length > 0 ? gaps : [gap(85, 115)] }],
});

/* ------------------------------------------------------------------ *
 * 1. The spans a rubber of a given radius takes                       *
 * ------------------------------------------------------------------ */

describe("gaps of one rubber pass", () => {
  it("bites the middle and leaves both ends", () => {
    const line = stroke();
    // The rubber sits still at the centre: reach = 10 (radius) + 10/2 (size).
    const gaps = gapsForStroke(line, [[200, 100]], 10);

    expect(gaps).toHaveLength(1);
    const [a, b] = gaps[0]!;
    // 100 + (100 − 15) … 100 + (100 + 15): the two ends survive untouched.
    expect(a).toBeCloseTo(85, 1);
    expect(b).toBeCloseTo(115, 1);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeLessThan(strokeLength(line.points));
  });

  it("writes the spans with one decimal — the zoom can never change them", () => {
    const gaps = gapsForStroke(stroke(), [[199.37, 100]], 10);
    expect(gaps).toHaveLength(1);
    for (const [a, b] of gaps) {
      for (const value of [a, b]) {
        expect(Math.abs(value * 10 - Math.round(value * 10))).toBeLessThan(1e-6);
      }
    }
  });

  it("takes more line the bigger the rubber: P < M < G", () => {
    const path: Point[] = [[200, 100]];
    const small = gapsLength(gapsForStroke(stroke(), path, 12));
    const medium = gapsLength(gapsForStroke(stroke(), path, 24));
    const big = gapsLength(gapsForStroke(stroke(), path, 40));

    expect(small).toBeLessThan(medium);
    expect(medium).toBeLessThan(big);
    // 2 · (12 + 5), 2 · (24 + 5), 2 · (40 + 5): the three sizes are REAL radii,
    // not three labels that take the same stroke.
    expect(small).toBeCloseTo(34, 0);
    expect(medium).toBeCloseTo(58, 0);
    expect(big).toBeCloseTo(90, 0);
  });

  it("leaves no span when the path never reaches the stroke", () => {
    expect(gapsForStroke(stroke(), [[200, 400]], 12)).toEqual([]);
    expect(gapsForStroke(stroke(), [], 40)).toEqual([]);
  });

  it("answers a dot with a zero-width span, not with nothing", () => {
    const dot = stroke({ points: [[200, 100]] });
    expect(gapsForStroke(dot, [[200, 100]], 12)).toEqual([gap(0, 0)]);
    expect(gapsForStroke(dot, [[290, 100]], 12)).toEqual([]);
  });

  it("is idempotent: a second pass over the void adds nothing", () => {
    const path: Point[] = [[200, 100]];
    const first = planAreaErase([stroke()], path, 12);
    expect(first.edits).toHaveLength(1);

    const again = planAreaErase([stroke()], path, 12, { s1: first.edits[0]!.gaps });
    expect(again.edits).toHaveLength(0);
    expect(again.strokeIds).toHaveLength(0);
  });

  it("collapses to a whole removal once the pass covers ~all of the stroke", () => {
    // A drag right along the stroke with the big rubber: nothing worth keeping.
    const plan = planAreaErase([stroke()], straight(), 40);
    expect(plan.edits).toEqual([]);
    expect(plan.strokeIds).toEqual(["s1"]);
  });

  it("leaves a stroke the pass cannot reach out of the command", () => {
    const far = stroke({ id: "far", points: straight(100, 300, 400) });
    expect(planAreaErase([far], [[200, 100]], 24)).toEqual({ strokeIds: [], edits: [] });
  });

  it("caps the spans of ONE stroke, merging the closest pair first", () => {
    // Thirty little islands on a long scribble: the command never grows without
    // bound, and the island given up is the cheapest one (borracha-area §8).
    const islands: Gap[] = [];
    for (let i = 0; i < 30; i++) islands.push(gap(i * 6, i * 6 + 2));

    const capped = capGaps(islands);
    expect(capped).toHaveLength(MAX_GAPS);
    // The ends of the stroke keep their own spans: what merged were the gaps
    // BETWEEN islands, never the outer edges of the pass.
    expect(capped[0]![0]).toBe(0);
    expect(capped.at(-1)![1]).toBe(176);
  });
});

/* ------------------------------------------------------------------ *
 * 2. What the document derives from the spans                         *
 * ------------------------------------------------------------------ */

describe("the document derives the spans, never stores them", () => {
  it("merges overlapping spans across gestures, ordered and without overlap", () => {
    const d = derive([stroke(), area(12, gap(40, 60)), area(24, gap(50, 70))]);
    expect(d.strokes.map((s) => s.id)).toEqual(["s1"]);
    expect(d.gaps["s1"]).toEqual([gap(40, 70)]);
  });

  it("keeps the stroke alive: a gap is not a new id and not a new command", () => {
    const d = derive([stroke(), area(12)]);
    expect(d.strokes).toHaveLength(1);
    expect(d.strokes[0]!.id).toBe("s1");
    // The command it came from is untouched: spans are derived, not rewritten.
    expect(d.strokes[0]!.points).toEqual(straight());
  });

  it("keeps the old whole-stroke command working, undo included", () => {
    const h = push(push(emptyHistory(), stroke()), { t: "erase", strokeIds: ["s1"] });
    expect(derive(h.commands).strokes).toHaveLength(0);
    expect(derive(undo(h).commands).strokes).toHaveLength(1);
  });

  it("drops the spans of a stroke that is gone, so a reused id is born whole", () => {
    const d = derive([stroke(), area(12), { t: "erase", strokeIds: ["s1"] }]);
    expect(d.strokes).toHaveLength(0);
    expect(d.gaps["s1"]).toBeUndefined();
  });

  it("replays a save written before the area command existed, byte for byte", () => {
    const legacy: Command[] = [stroke()];
    const d = derive(legacy);
    expect(d.gaps).toEqual({});
    expect(JSON.stringify(stampsOf(d.strokes[0]!))).toBe(JSON.stringify(stampsOf(stroke())));
  });

  it("quantizes what a save already carried, and merges it the same way", () => {
    expect(mergeGaps([gap(10, 20), gap(15, 30), gap(40, 50)])).toEqual([gap(10, 30), gap(40, 50)]);
    expect(mergeGaps([gap(10.04, 20.06)])).toEqual([gap(10, 20.1)]);
  });

  it("carries a region wipe in the same command as the spans", () => {
    const d = derive([
      stroke(),
      { t: "fill", region: "fundo", color: "#FFFFFF" },
      { ...area(12), regions: ["fundo"] },
    ]);
    expect(d.fills["fundo"]).toBeUndefined();
    expect(d.gaps["s1"]).toEqual([gap(85, 115)]);
  });
});

/* ------------------------------------------------------------------ *
 * 3. The raster engine: drop, never shift                             *
 * ------------------------------------------------------------------ */

/** `kept` is `all` minus some entries, in order, with nothing rewritten. */
function isSubsequenceByValue(kept: readonly Stamp[], all: readonly Stamp[]): boolean {
  let j = 0;
  for (const stamp of kept) {
    const want = JSON.stringify(stamp);
    while (j < all.length && JSON.stringify(all[j]) !== want) j++;
    if (j === all.length) return false;
    j++;
  }
  return true;
}

describe("the raster engine drops only the stamps inside a span", () => {
  const gaps = [gap(85, 115)];

  it("keeps every surviving stamp bit for bit, in the same order", () => {
    const all = stampsOf(stroke());
    const kept = stampsOf(stroke(), gaps);

    expect(kept.length).toBeLessThan(all.length);
    // The survivors are the OLD stamps, in the old order: the filter removes,
    // it never re-generates, rounds or shifts one.
    expect(isSubsequenceByValue(kept, all)).toBe(true);
    expect(JSON.stringify(kept[0])).toBe(JSON.stringify(all[0]));
    expect(JSON.stringify(kept.at(-1))).toBe(JSON.stringify(all.at(-1)));
  });

  it("leaves nothing inside the span and everything outside it", () => {
    const kept = stampsOf(stroke(), gaps);
    expect(kept.some((stamp) => stamp.x > 186 && stamp.x < 214)).toBe(false);
    expect(kept.some((stamp) => stamp.x <= 185)).toBe(true);
    expect(kept.some((stamp) => stamp.x >= 215)).toBe(true);
  });

  it("deposits exactly the survivors through the command list", () => {
    const seen: Stamp[] = [];
    const painted = paintStrokes({ ellipse: (stamp) => seen.push(stamp) }, [stroke(), area(12)]);
    expect(painted).toBe(stampsOf(stroke(), gaps).length);
    expect(seen).toEqual(stampsOf(stroke(), gaps));
  });

  it("replays bit for bit after the save is reopened", () => {
    const commands: Command[] = [stroke(), area(12)];
    // What a save and a reload do: the numbers go through JSON and come back.
    const reopened = JSON.parse(JSON.stringify(commands)) as Command[];
    const grain = (list: Command[]) => {
      const d = derive(list);
      return d.strokes.map((s) => stampsOf(s, d.gaps[s.id]));
    };

    expect(reopened).not.toBe(commands);
    expect(JSON.stringify(grain(reopened))).toBe(JSON.stringify(grain(commands)));
    expect(grain(commands)[0]!).toHaveLength(stampsOf(stroke(), gaps).length);
  });
});

/* ------------------------------------------------------------------ *
 * 4. The vector engine: the same interval, core included              *
 * ------------------------------------------------------------------ */

describe("the vector engine cuts the same span", () => {
  const gaps = [gap(85, 115)];
  const grainMarks = (layers: ReturnType<typeof strokesOf>) =>
    layers.reduce(
      (n, layer) => n + (layer.mode === "stamp" ? (layer.d.match(/M/g)?.length ?? 0) : 0),
      0,
    );

  it("breaks the solid core at the span instead of leaving a smooth line", () => {
    const core = strokesOf(stroke({ brush: "crayon" }), gaps).find(
      (layer) => layer.role === "core",
    )!;
    // Two runs of ONE path: 100 → 185 and 215 → 300 — exactly the interval the
    // raster left empty.
    expect(core.d).toBe("M100.0 100.0 L185.0 100.0M215.0 100.0 L300.0 100.0");
  });

  it("drops the grain the raster drops, and no more", () => {
    const before = grainMarks(strokesOf(stroke({ brush: "crayon" })));
    const after = grainMarks(strokesOf(stroke({ brush: "crayon" }), gaps));
    expect(after).toBeLessThan(before);
    // 30 of 200 units gone ≈ 15% of the stamps: both engines lose the rubber's
    // own share, because both read the same spans.
    const share = 1 - after / before;
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.22);
  });

  it("keeps a stroke with no span exactly as it was", () => {
    const plain = stroke({ brush: "crayon" });
    expect(JSON.stringify(strokesOf(plain, []))).toBe(JSON.stringify(strokesOf(plain)));
    expect(JSON.stringify(strokesOf(plain, [gap(400, 500)]))).toBe(
      JSON.stringify(strokesOf(plain)),
    );
  });
});

/* ------------------------------------------------------------------ *
 * 5. The gesture: one pass, one command, one undo                     *
 * ------------------------------------------------------------------ */

const SEED_A = "a";
const SEED_B = "b";

/** Two long strokes ten units apart, so one drag crosses both. */
const SEED: Command[] = [
  { t: "stroke", id: SEED_A, color: "#2B7FFF", size: SIZE, points: straight(20, 280, 150) },
  { t: "stroke", id: SEED_B, color: "#FB2C36", size: SIZE, points: straight(20, 280, 160) },
];

function Desk({ commands: seed }: { commands: Command[] }) {
  const { state, dispatch } = useStore();
  const id = "eraser-area-desk";
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
    dispatch({
      type: "createArtwork",
      artwork: {
        id,
        profileId: "maria",
        pageId: null,
        w: 300,
        h: 300,
        history: { commands: seed, redo: [], undoable: seed.length },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        visibility: "draft",
        publishedAt: null,
      },
    });
  }, [dispatch, id, seed]);
  const art = state.artworks.find((w) => w.id === id);
  if (!art) return null;
  return (
    <>
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
      <span data-testid="commands">{JSON.stringify(art.history.commands)}</span>
    </>
  );
}

const desk = (seed: Command[] = SEED) =>
  render(
    <StoreProvider>
      <Desk commands={seed} />
    </StoreProvider>,
  );
const commands = () => JSON.parse(screen.getByTestId("commands").textContent || "[]") as Command[];

/**
 * The eraser in hand. Without a size it comes from the compact bar (the size
 * last used); with one, the pill's hold opens its size pop — the same 1..100
 * capsule the brushes read (owner's call, 26/10: P/M/G is gone).
 */
async function pickRubber(size?: number) {
  if (size === undefined) {
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    fireEvent.click(within(screen.getByTestId("canvas-compact")).getByLabelText("Borracha"));
    return;
  }
  const door = within(screen.getByTestId("canvas-dock")).getByLabelText("Borracha");
  fireEvent.pointerDown(door);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 520));
  });
  fireEvent.pointerUp(door);
  fireEvent.change(screen.getByLabelText("Espessura"), { target: { value: String(size) } });
  // The tap that follows the hold is what puts the rubber in the hand.
  fireEvent.click(door);
}

/** One drag across both strokes, right through their middles. */
function drag() {
  const paper = screen.getByTestId("paper-view");
  fireEvent.pointerDown(paper, { pointerId: 1, clientX: 100, clientY: 155 });
  fireEvent.pointerMove(paper, { pointerId: 1, clientX: 200, clientY: 155 });
  fireEvent.pointerUp(paper, { pointerId: 1, clientX: 200, clientY: 155 });
}

const took = (command: AreaEraseCommand) =>
  command.edits.reduce((n, edit) => n + gapsLength(edit.gaps), 0);

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("one rubber pass is one command and one undo", () => {
  it("takes a span from every stroke it crossed, in a single command", async () => {
    desk();
    await pickRubber();
    drag();

    const all = commands();
    expect(all).toHaveLength(SEED.length + 1);
    const last = all.at(-1) as AreaEraseCommand;
    expect(last.t).toBe("eraseArea");
    expect(last.edits.map((edit) => edit.strokeId).sort()).toEqual([SEED_A, SEED_B]);
    for (const edit of last.edits) {
      expect(edit.gaps).toHaveLength(1);
      const [a, b] = edit.gaps[0]!;
      // The bite is in the middle: both strokes keep their two ends.
      expect(a).toBeGreaterThan(0);
      expect(b).toBeLessThan(260);
    }

    // Both strokes are still there, under their own ids, with their own spans.
    const derived = derive(all);
    expect(derived.strokes.map((s) => s.id)).toEqual([SEED_A, SEED_B]);
    expect(Object.keys(derived.gaps).sort()).toEqual([SEED_A, SEED_B]);
  });

  it("is one undo: the spans leave with the command and both strokes are whole", async () => {
    desk();
    await pickRubber();
    drag();
    const taken = derive(commands()).gaps;
    expect(taken).not.toEqual({});

    // 9+'s undo lives in the sheet's action bar (`chrome-v2` §12.3): the drawer is
    // already open, so the latch is the only step left.
    openTools();
    fireEvent.click(screen.getByLabelText("Desfazer no painel"));

    const after = commands();
    expect(after).toHaveLength(SEED.length);
    expect(derive(after).gaps).toEqual({});
    expect(derive(after).strokes).toHaveLength(2);

    // Redo puts the SAME command back: the spans are the ones that were taken,
    // not a new plan from a new gesture.
    fireEvent.click(screen.getByLabelText("Refazer no painel"));
    expect(derive(commands()).gaps).toEqual(taken);
  });

  it("writes the radius in the hand, and the bigger rubber takes more line", async () => {
    desk();
    await pickRubber(40);
    drag();
    const big = commands().at(-1) as AreaEraseCommand;
    expect(big.t).toBe("eraseArea");
    expect(big.radius).toBe(40);

    cleanup();
    localStorage.clear();

    desk();
    await pickRubber();
    drag();
    const medium = commands().at(-1) as AreaEraseCommand;
    // An untouched rubber opens at the thickness in use — the band default,
    // because the thickness is ONE number now (owner's decision, 26/10).
    expect(medium.radius).toBe(6);

    // Same stroke, same drag, bigger rubber: strictly more paper gone.
    expect(took(big)).toBeGreaterThan(took(medium));
  });

  it("still wipes a painted region on its own, with the command of always", async () => {
    desk([...SEED, { t: "fill", region: "fundo", color: "#FB2C36" }]);
    await pickRubber();
    // A tap on the paper's own region: the fill goes back to bare paper, in the
    // legacy command, so a save written before the area eraser reads the same.
    const region = screen.getByTestId("paper-view").querySelector('[data-region="fundo"]')!;
    fireEvent.pointerDown(region, { pointerId: 1, clientX: 10, clientY: 290 });
    fireEvent.pointerUp(region, { pointerId: 1, clientX: 10, clientY: 290 });

    expect(commands().at(-1)).toMatchObject({ t: "erase", regions: ["fundo"] });
  });
});
