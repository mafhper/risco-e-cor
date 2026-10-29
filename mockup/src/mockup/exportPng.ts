// The PNG is the SHEET, not the screen (export-png.md §1).
//
// Two halves, one source of truth:
//   - `exportArtwork` is a pure description of the file — size, paper, ink,
//     layer order and the confirmed command list. No DOM, no canvas, no
//     `Image`: it is what undo/redo already guarantees, written down.
//   - `exportPng` rasterizes that description. Nothing here reads a node from
//     the screen, so the grid, the desk, the card's crop, the frame and the
//     stroke in progress have no way to leak into the file.
//
// Composing from a description is the fix for the old exporter, which cloned
// an `<svg>` node from the screen: the file inherited whatever that node
// happened to contain — the tiny preview box of a row, the SVG approximation
// of the strokes instead of the raster engine, and the paper without its
// texture. Now a stroke leaves the app exactly the way the child saw it.
import { canvasSink, paintStrokes } from "./brushCanvas";
import { derive, type Command } from "./history";
import { pageById } from "./pages";
import { OUTLINE_HEX, PAPERS, PAPER_TEXTURE_ALPHA, type PaperMaterial } from "./palette";

/** Longest side of the file, in pixels. Never the viewport, never the DPR (§3). */
const EXPORT_SIDE = 1200;

/** Line-art stroke width, in artwork units — the same as `ArtworkSvg`. */
const OUTLINE_WIDTH = 3;

/**
 * The graph ink of the paper texture. Same value as the `<pattern>` in
 * `ArtworkSvg`: the file and the paper must age together, and the pattern is
 * the paper's material, never the working grid.
 */
const GRAPH_INK = "#C3D4E4";

/** The sheet's grain, in artwork units and ink — the same rule as the SVG half. */
const WEAVE_STEP = 6;
const WEAVE_INK = "28,27,26";

/** Bottom to top, fixed: the order `ArtworkPaint` stacks on screen (§4). */
const LAYERS = ["regions", "strokes", "outline"] as const;

export type ExportPlan = {
  /** File size in px. The longest side is 1200, rounded. */
  width: number;
  /** …and the other side follows the sheet's proportion. */
  height: number;
  /** The whole sheet, in artwork units: the file's viewBox. */
  view: { w: number; h: number };
  /** The file's paper: the sheet's own hex (white unless a tone says so). */
  paper: { hex: string; pattern: boolean; texture: number };
  /** Line-art ink, the same as the screen's, because the file's paper is white. */
  outlineHex: string;
  layers: typeof LAYERS;
  /** The coloring page, if any: the line art the file must carry. */
  pageId: string | null;
  /** Only confirmed commands (`art.history.commands`). Never the live stroke. */
  commands: readonly Command[];
  /**
   * The device tier the file is painted with (efeitos-chevrons §7.7.6). The
   * file and the paper must ask the engine for the same passes: a device that
   * contains the blur on screen contains it in the PNG too (§7.8). Absent = the
   * full tier, which is what every export painted before the flag existed.
   */
  lowPower?: boolean;
};

/**
 * The plan of a piece — named `exportPlan` in export-png.md §3, where the
 * names are illustrative. It is pure on purpose: the tests read the file here,
 * and the driver reads nothing else.
 *
 * `material` contributes the paper's own look: the printed texture (`pattern`),
 * the grain's alpha (`texture`) and the sheet's tone (`paperHex`). It is the
 * PAPER, so all three enter the file — the working GRID never does: it is a
 * screen aid with no way into this description.
 *
 * `lowPower` is the profile's declared device tier, carried into the plan so the
 * file asks the engine for the same passes the paper did (efeitos-chevrons
 * §7.7.6/§7.8). It never changes the commands, only the cost.
 */
export function exportArtwork(
  commands: readonly Command[],
  pageId: string | null,
  w: number,
  h: number,
  material: PaperMaterial = PAPERS.linho,
  lowPower = false,
): ExportPlan {
  const view = { w: Math.max(1, w), h: Math.max(1, h) };
  const scale = EXPORT_SIDE / Math.max(view.w, view.h);
  return {
    width: Math.max(1, Math.round(view.w * scale)),
    height: Math.max(1, Math.round(view.h * scale)),
    view,
    paper: {
      hex: material.paperHex.toLowerCase(),
      pattern: material.pattern,
      texture: PAPER_TEXTURE_ALPHA[material.texture ?? "lisa"],
    },
    outlineHex: OUTLINE_HEX,
    layers: LAYERS,
    pageId,
    commands,
    ...(lowPower ? { lowPower: true } : {}),
  };
}

/**
 * File pixels per artwork unit. Rounded sides disagree by a fraction of a
 * pixel, so the larger ratio wins and the sheet is never left with a sliver.
 */
const scaleOf = (plan: ExportPlan) => Math.max(plan.width / plan.view.w, plan.height / plan.view.h);

/** One shape of the file's bottom layer: a path and the paint it carries. */
export type RegionPaint = { d: string; fill: string };

/** A blank sheet has no line-art page: its single region is the whole paper. */
const sheetPath = (view: { w: number; h: number }) => `M0 0 H${view.w} V${view.h} H0 Z`;

/**
 * The region layer — bucket fills, under the paint, back to front.
 *
 * Every region of the SHEET answers: "fundo" (a blank sheet) and the page's
 * own region ids. A `desk` fill is canvas customization and has no region to
 * land on, so it can never become part of the file.
 *
 * On a coloring page, an unpainted region shows the sheet itself — white,
 * exactly like the SVG half on screen. It matters because region 0 covers the
 * whole sheet: a later region left unpainted must stay paper-white on top of
 * it, not let the background colour show through. On a textured paper the
 * sheet is left alone (null here) so the graph stays visible.
 */
export function fileRegions(plan: ExportPlan): RegionPaint[] {
  const { fills } = derive(plan.commands);
  const page = pageById(plan.pageId);

  if (!page) {
    // A blank sheet has no regions to hide the paper: no fill, no layer.
    const fundo = fills["fundo"];
    return fundo ? [{ d: sheetPath(plan.view), fill: fundo }] : [];
  }

  const sheet = plan.paper.pattern || plan.paper.texture > 0 ? null : plan.paper.hex;
  return page.regions.flatMap((region) => {
    const fill = fills[region.id] ?? sheet;
    return fill ? [{ d: region.d, fill }] : [];
  });
}

/**
 * The outline — ink over the colour, under `multiply`. Region 0 is the sheet
 * itself (the background of the page), so it is filled, never outlined; the
 * details are stroke-only by definition.
 */
export function fileOutline(plan: ExportPlan): string[] {
  const page = pageById(plan.pageId);
  if (!page) return [];
  return [...page.regions.slice(1).map((region) => region.d), ...(page.details ?? [])];
}

/** The paper's own graph texture: a lattice of cells, drawn inside the file. */
function paintGraphPaper(ctx: CanvasRenderingContext2D, plan: ExportPlan, scale: number) {
  // Same cell rule as the `<pattern>` in ArtworkSvg, and the same unit: the
  // texture belongs to the paper, so it scales with the sheet, not with the
  // phone it was drawn on.
  const cell = Math.max(12, Math.round(plan.view.w / 14));
  const columns = Math.floor(plan.view.w / cell);
  const rows = Math.floor(plan.view.h / cell);

  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.strokeStyle = GRAPH_INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= columns; i++) {
    const x = i * cell;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, plan.view.h);
  }
  for (let i = 0; i <= rows; i++) {
    const y = i * cell;
    ctx.moveTo(0, y);
    ctx.lineTo(plan.view.w, y);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The sheet's printed grain: the same 45° linen hatch the SVG half paints, at
 * the tone's alpha. It belongs to the PAPER, so it is the one thing about the
 * surface that always reaches the file.
 */
function paintWeave(ctx: CanvasRenderingContext2D, plan: ExportPlan, scale: number) {
  const alpha = plan.paper.texture;
  if (!(alpha > 0)) return;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.strokeStyle = `rgba(${WEAVE_INK},${alpha})`;
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  const side = Math.max(plan.view.w, plan.view.h);
  for (let at = -side; at <= side; at += WEAVE_STEP) {
    ctx.moveTo(at, 0);
    ctx.lineTo(at + side, side);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * The file, layer by layer, in the order `ArtworkPaint` uses on screen:
 * paper → texture → regions → strokes → outline. The browser adapter — the
 * only place in this module that knows what a pixel is.
 */
function paintPlan(ctx: CanvasRenderingContext2D, plan: ExportPlan) {
  const scale = scaleOf(plan);

  // 1. Paper. Opaque by construction: there is no path that skips this fill.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = plan.paper.hex;
  ctx.fillRect(0, 0, plan.width, plan.height);

  // 2. The paper's texture (paperPattern) — never the working grid.
  if (plan.paper.pattern) paintGraphPaper(ctx, plan, scale);
  // 2b. The sheet's grain: the paper's own look, and the only surface detail
  //     that is not a guide — so it rides into the file, grid or no grid.
  paintWeave(ctx, plan, scale);

  // 3. Region fills, under the paint.
  const regions = fileRegions(plan);
  if (regions.length > 0) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    for (const region of regions) {
      ctx.fillStyle = region.fill;
      ctx.fill(new Path2D(region.d));
    }
    ctx.restore();
  }

  // 4. Strokes through the same engine as the paper: `w`/`h` are mandatory, or
  // the gradient has no artwork box to be placed in and comes out flat.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  paintStrokes(canvasSink(ctx, { x: 0, y: 0, scale }), plan.commands, {
    w: plan.view.w,
    h: plan.view.h,
    // Same rule as the paper: the file names the tier only when it is lowered.
    ...(plan.lowPower === true ? { lowPower: true } : {}),
  });
  ctx.restore();

  // 5. Outline: ink over the colour, multiplied — the same intent as the SVG
  // half, so the line art never reads as a white cap on the paint.
  const outline = fileOutline(plan);
  if (outline.length > 0) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = plan.outlineHex;
    ctx.lineWidth = OUTLINE_WIDTH;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const path of outline) ctx.stroke(new Path2D(path));
    ctx.restore();
  }
}

/**
 * Writes the file and downloads it. On Android this is where the bitmap would
 * be handed to MediaStore (no storage permission on Android 10+).
 *
 * The error surfaces to the caller instead of being swallowed: a piece that
 * cannot be exported must not look saved (§8.4).
 */
export async function exportPng(plan: ExportPlan, filename: string): Promise<void> {
  const canvas = document.createElement("canvas");
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("export: this device has no 2D canvas");

  paintPlan(ctx, plan);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = filename;
  a.click();
}

export function downloadText(text: string, filename: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
