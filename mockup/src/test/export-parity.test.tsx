// Slice 3 of export-png.md §7: the file and the paper on the screen are the
// same drawing — same command list, same stamps, same order of layers.
//
// jsdom has no 2d canvas and no Path2D, so this file installs its own: a
// context that records operations instead of painting them, and a Path2D that
// keeps the `d` it was handed. Both paths are executed for real; what is
// measured is what they asked the substrate to draw.
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ArtworkPaint } from "@/mockup/ArtworkPaint";
import { exportArtwork, exportPng, fileOutline, fileRegions } from "@/mockup/exportPng";
import { PAPERS } from "@/mockup/palette";
import { paintStrokes } from "@/mockup/brushCanvas";
import type { Command } from "@/mockup/history";

// The screen's own call into the engine is observed, not guessed: whatever
// ArtworkPaint passes is what the file must pass too.
vi.mock("@/mockup/brushCanvas", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/mockup/brushCanvas")>();
  return { ...actual, paintStrokes: vi.fn(actual.paintStrokes) };
});

const engine = vi.mocked(paintStrokes);

type Dab = {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rot: number;
  alpha: number;
  color: string;
};
type Op = { op: string; args: unknown[] };

const SHEET = { w: 300, h: 650 };
const PLAN = exportArtwork([], null, SHEET.w, SHEET.h, PAPERS.linho);
/** The screen at the file's own raster scale: only §6's difference (scale) is left. */
const FILE_SCALE = PLAN.width / SHEET.w;

const STROKES: Command[] = [
  {
    t: "stroke",
    id: "s1",
    color: "#E8423F",
    size: 12,
    points: [
      [20, 40],
      [160, 300],
      [280, 600],
    ],
  },
  {
    t: "stroke",
    id: "s2",
    color: "#2F6FD6",
    size: 8,
    brush: "crayon",
    points: [
      [60, 90],
      [240, 520],
    ],
  },
];

/** A 2d context that records instead of painting; every canvas gets it. */
function recordingContext() {
  const ops: Op[] = [];
  const ctx = {
    fillStyle: "#000000",
    strokeStyle: "#000000",
    globalAlpha: 1,
    globalCompositeOperation: "source-over",
    lineWidth: 1,
    lineJoin: "miter",
    lineCap: "butt",
    save() {
      ops.push({ op: "save", args: [] });
    },
    restore() {
      ops.push({ op: "restore", args: [] });
    },
    setTransform(a: number, _b: number, _c: number, d: number) {
      ops.push({ op: "setTransform", args: [a, d] });
    },
    beginPath() {},
    moveTo() {},
    lineTo() {},
    closePath() {},
    clearRect(x: number, y: number, w: number, h: number) {
      ops.push({ op: "clearRect", args: [x, y, w, h] });
    },
    fill(target?: { d?: string }) {
      ops.push({ op: "fill", args: [target?.d ?? null, ctx.fillStyle] });
    },
    stroke(target?: { d?: string }) {
      ops.push({
        op: "stroke",
        args: [target?.d ?? null, ctx.strokeStyle, ctx.lineWidth, ctx.globalCompositeOperation],
      });
    },
    fillRect(x: number, y: number, w: number, h: number) {
      ops.push({ op: "fillRect", args: [x, y, w, h, ctx.fillStyle] });
    },
    ellipse(x: number, y: number, rx: number, ry: number, rot: number) {
      ops.push({
        op: "ellipse",
        args: [{ x, y, rx, ry, rot, alpha: ctx.globalAlpha }, ctx.fillStyle],
      });
    },
  };
  return { ctx, ops };
}

let ctxOps: Op[];
let drawing: ReturnType<typeof recordingContext>;
let downloadName: string | null = null;
const realClick = HTMLAnchorElement.prototype.click;
const realToDataURL = HTMLCanvasElement.prototype.toDataURL;

beforeEach(() => {
  localStorage.clear();
  engine.mockClear();
  drawing = recordingContext();
  ctxOps = drawing.ops;
  downloadName = null;

  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: () => drawing.ctx,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    writable: true,
    value: () => "data:image/png;base64,AA==",
  });
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    writable: true,
    value: function click(this: HTMLAnchorElement) {
      downloadName = this.download;
    },
  });
  Object.defineProperty(globalThis, "Path2D", {
    configurable: true,
    writable: true,
    value: class {
      constructor(public d: string) {}
    },
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    writable: true,
    value: () => null,
  });
  Object.defineProperty(HTMLCanvasElement.prototype, "toDataURL", {
    configurable: true,
    writable: true,
    value: realToDataURL,
  });
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    writable: true,
    value: realClick,
  });
  delete (globalThis as { Path2D?: unknown }).Path2D;
});

const dabs = (ops: Op[]): Dab[] =>
  ops
    .filter((o) => o.op === "ellipse")
    .map((o) => ({ ...(o.args[0] as Omit<Dab, "color">), color: o.args[1] as string }));

describe("export — the file is the drawing", () => {
  it("deposits the same dabs as the paper on the screen", async () => {
    const plan = exportArtwork(STROKES, null, SHEET.w, SHEET.h, PAPERS.linho);

    // The screen, at the file's raster scale, through its own paint call.
    render(
      <ArtworkPaint pageId={null} w={SHEET.w} h={SHEET.h} commands={STROKES} scale={FILE_SCALE} />,
    );
    const screenOps = [...ctxOps];
    ctxOps.length = 0;

    await exportPng(plan, "desenho.png");
    const fileOps = [...ctxOps];

    // Measured, not copied: the screen handed the engine the SHEET's box —
    // never the card's crop — and the whole confirmed list.
    const [sinkSource, screenCommands, screenOptions] = engine.mock.calls[0]!;
    expect(sinkSource).toBeDefined();
    expect(screenCommands).toBe(STROKES);
    expect(screenOptions).toEqual({ fadedStrokes: undefined, w: SHEET.w, h: SHEET.h });

    expect(dabs(screenOps).length).toBeGreaterThan(100);
    expect(dabs(fileOps)).toEqual(dabs(screenOps));
  });

  it("lays the file down in the screen's order: paper, texture, regions, strokes, outline", async () => {
    const commands: Command[] = [{ t: "fill", region: "mar", color: "#1E90FF" }, ...STROKES];
    const plan = exportArtwork(commands, "peixe", 300, 300, PAPERS.linho);
    await exportPng(plan, "desenho.png");

    const paint = (op: string) => ctxOps.findIndex((o) => o.op === op);
    const first = ctxOps.find((o) => o.op === "fillRect")!;
    // Opaque by construction: the paper is the first thing written, whole.
    expect(first.args).toEqual([0, 0, plan.width, plan.height, "#ffffff"]);
    expect(paint("fillRect")).toBeLessThan(paint("fill"));

    const firstFill = ctxOps.findIndex((o) => o.op === "fill");
    const firstDab = ctxOps.findIndex((o) => o.op === "ellipse");
    const firstStroke = ctxOps.findIndex((o) => o.op === "stroke");
    expect(firstFill).toBeGreaterThan(0);
    expect(firstFill).toBeLessThan(firstDab);
    expect(firstDab).toBeLessThan(firstStroke);

    // Exactly the regions the description carries, painted under the dabs.
    // (`fill()` with no path is a stamp; the bucket always fills a path.)
    const painted = ctxOps.filter((o) => o.op === "fill" && o.args[0] !== null).map((o) => o.args);
    expect(painted).toEqual(fileRegions(plan).map((r) => [r.d, r.fill]));
  });

  it("draws the outline as ink over the colour, never as a white cap", async () => {
    const page = exportArtwork([], "peixe", 300, 300, PAPERS.linho);
    await exportPng(page, "peixe.png");

    const outline = ctxOps.filter((o) => o.op === "stroke").map((o) => o.args);
    expect(outline).toEqual(fileOutline(page).map((d) => [d, page.outlineHex, 3, "multiply"]));
  });

  it("puts the paper's graph texture under the paint, and only when the paper has it", async () => {
    const plain = exportArtwork(STROKES, null, SHEET.w, SHEET.h, PAPERS.linho);
    await exportPng(plain, "liso.png");
    expect(ctxOps.filter((o) => o.op === "stroke")).toHaveLength(0);
    ctxOps.length = 0;

    const graph = exportArtwork(STROKES, null, SHEET.w, SHEET.h, PAPERS.quadriculado);
    await exportPng(graph, "quadriculado.png");
    const strokes = ctxOps.map((o, i) => ({ ...o, i })).filter((o) => o.op === "stroke");
    expect(strokes.length).toBeGreaterThan(0);
    // The lattice is drawn before the first dab: it is the paper, not a layer
    // on top of the drawing.
    expect(strokes[0]!.i).toBeLessThan(ctxOps.findIndex((o) => o.op === "ellipse"));
  });

  it("hands the file to the browser under the name it was given", async () => {
    const plan = exportArtwork(STROKES, null, SHEET.w, SHEET.h, PAPERS.linho);
    await exportPng(plan, "desenho-2026-10-26.png");
    expect(downloadName).toBe("desenho-2026-10-26.png");
  });

  it("never carries the stroke in progress: the paper shows it, the file does not", async () => {
    const live = {
      t: "stroke" as const,
      id: "live-1",
      color: "#000000",
      size: 4,
      points: [
        [10, 10],
        [20, 20],
      ] as [number, number][],
    };
    render(
      <ArtworkPaint
        pageId={null}
        w={SHEET.w}
        h={SHEET.h}
        commands={STROKES}
        live={live}
        scale={FILE_SCALE}
      />,
    );
    // What the paper is asked to paint does include the finger's stroke…
    const onPaper = engine.mock.calls[0]![1] as readonly Command[];
    expect(onPaper.some((c) => c.t === "stroke" && c.id === "live-1")).toBe(true);

    ctxOps.length = 0;
    const plan = exportArtwork(STROKES, null, SHEET.w, SHEET.h, PAPERS.linho);
    await exportPng(plan, "sem-live.png");
    // …and what the file is asked to paint does not: only what was confirmed.
    expect(plan.commands.some((c) => c.t === "stroke" && c.id === "live-1")).toBe(false);
    expect(engine.mock.calls.at(-1)![1]).toBe(STROKES);
  });
});
