import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import {
  TOOL_COLLECTIONS,
  brushStroke,
  shelfBrushOf,
  type BrushKind,
  type CanvasTool,
  type ShelfBrush,
} from "../brush";
import { canvasSink, paintStrokes } from "../brushCanvas";
import { nozzleOf, type Point, type SpraySettings, type StrokeCommand } from "../history";
import {
  INK_DEEP,
  INK_WHITE,
  materialPlate,
  mixHex,
  plateMaterialOf,
  plateStyle,
  rimStyle,
  type MaterialPlate,
} from "../kidsMaterials";
import { contrastRatio } from "../palette";
import { Sheet } from "../overlay";
import { TOOL_ICON_LAYERS, type ToolIconName } from "../toolIcons";
import { cn } from "@/lib/utils";

/**
 * The ONE glyph family both bands mount (owner's call, 26/10 — second round).
 *
 * The app drew its own objects until this batch; the owner replaced the whole
 * set with the measured icons of the Claude set, adopted as the single
 * source (`toolIcons.ts`, generated from the SVGs). One drawing per tool: what
 * changes between the bands is the tint, the contour ink and the plate under the
 * object — never the geometry.
 *
 * Where the colour goes is decided by the DRAWING: a layer whose source fill is
 * `currentColor` follows the tint (the accent of eight tools, the pencil's
 * graphite point, the `more` disc). Cream, metal, wood, cap and nib are the
 * material and stay fixed; `accent-shade`/`accent-tint` stay black and white with
 * the opacity the file declares, painted over the tint; the `outline` never takes
 * the colour — only the band's ink, so the silhouette survives a dark surface.
 *
 * `data-kid-part` is gone with the old drawings: the geometry now lives in the
 * generated data and the suite measures the real layers (`data-layer`).
 */

/** The `more` disc's resting tint: the cream the source file declares. */
const MORE_REST_TINT = "#efebde";

/**
 * One icon of the set, at any size: the file's own 1024 viewBox, scaled.
 *
 * The tint is `color`. It reaches ONLY the layers the drawing marks as
 * `currentColor` — the component never decides which part of an object carries
 * the colour, so a material cannot be repainted by a prop. `ink` is the contour
 * and never receives the tint; `active` exists for one icon, `more`, whose disc
 * is tinted only in the open state and keeps its cream at rest.
 */
export function ToolIcon({
  name,
  size = 32,
  color,
  ink,
  active = false,
  className,
  brushId,
  inkHex,
  bucket,
}: {
  name: ToolIconName;
  size?: number;
  /** The tint given to the drawing's `currentColor` layers. */
  color: string;
  /** The contour ink; absent = the file's own measured dark. */
  ink?: string | undefined;
  /** `more` only: the state that may take the tint. */
  active?: boolean;
  className?: string | undefined;
  /** The shelf's DOM contract: which material this drawing is. */
  brushId?: string | undefined;
  /** The contour actually painted, for the suite. */
  inkHex?: string | undefined;
  /** The bucket's paint, for the suite. */
  bucket?: string | undefined;
}) {
  const tint = name === "more" && !active ? MORE_REST_TINT : color;
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      data-tool-icon={name}
      data-brush={brushId}
      data-ink={inkHex}
      data-bucket={bucket}
      className={className}
      style={{ color: tint }}
    >
      {TOOL_ICON_LAYERS[name].map((layer) => (
        <path
          key={layer.id}
          data-layer={layer.id}
          // The contour keeps its own ink unless the band hands one in: the
          // silhouette is never the colour (decisão 4 do plano dos ícones).
          fill={layer.id === "outline" && ink ? ink : layer.fill}
          {...(layer.fillOpacity === undefined ? {} : { fillOpacity: layer.fillOpacity })}
          d={layer.d}
        />
      ))}
    </svg>
  );
}

/**
 * The one material glyph. Both bands mount this component: the drawing is the
 * same object, and only the plate under it and the contour ink change.
 *
 * `ink` exists for one reason: the file's ink is measured against PAPER, and the
 * pro chip is `bg-muted` — dark on dark. Pro passes `var(--foreground)`, so the
 * contour follows the theme instead of disappearing in it.
 *
 * The tint is the colour in hand. Watercolour is the only exception: its body is
 * a wash of that colour, which is what the medium lays on the paper (F2').
 */
export function MaterialGlyph({
  brush,
  color,
  size = 48,
  ink,
}: {
  brush: ShelfBrush;
  color: string;
  size?: number;
  /** Contour ink; defaults to the plate's measured ink. */
  ink?: string | undefined;
}) {
  const plate = materialPlate(brush.id, color);
  const contour = ink ?? plate.ink;
  const tint = brush.id === "watercolor" ? mixHex(color, INK_WHITE, 0.5) : color;
  return (
    <ToolIcon
      name={brush.id}
      size={size}
      color={tint}
      ink={contour}
      brushId={brush.id}
      inkHex={contour}
    />
  );
}

/**
 * The bucket wears the paint it pours. A fixed-colour bucket is a lie on a
 * palette: the child picked a colour, and the tool that fills with it must show
 * that colour. The paint inside the bucket is the drawing's `accent` layer, so it
 * follows the tint; the outline keeps the surface's ink (never the tint).
 */
export function BucketGlyph({
  color,
  size = 24,
  ink,
}: {
  color: string;
  size?: number;
  /** The contour ink of the surface it sits on; absent = the file's own. */
  ink?: string | undefined;
}) {
  return <ToolIcon name="fill" size={size} color={color} ink={ink} bucket={color.toUpperCase()} />;
}

/**
 * The plate's inner rim as its own layer. It has to be a child: an inline
 * `box-shadow` on the button would cancel the `ring-*` that marks the active
 * card, and the rim must never hide the selection.
 */
export function PlateRim({ plate }: { plate: MaterialPlate }) {
  const style = rimStyle(plate);
  if (!style) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
      style={style}
    />
  );
}

/**
 * The plate read as "this one is in hand" (spec §11.2): the card inverts — the
 * surface takes the object's ink and the contour takes the card — and the rim
 * follows the new surface, so the edge survives the flip.
 *
 * Why invert instead of tinting: the state owes 3:1 against the idle card, and
 * two values of the same paper cannot reach it (paper #F0ECE0 against its own
 * darker sibling tops out around 1.4:1). The flip clears it by an order of
 * magnitude and keeps the material readable, because the pigment inside the
 * object never changes — only the plate under it and the contour around it.
 *
 * This is STATE, not material: F1' (`kidsMaterials`) still holds — every card
 * is the same paper for every material; the one in hand is read as ink.
 */
export function activePlate(plate: MaterialPlate): MaterialPlate {
  return { plate: plate.ink, ink: plate.plate, pigment: plate.pigment, rim: plate.plate };
}

/**
 * The authored range a preview maps onto its box: 1..100, the one number every
 * material reads. The strip is a SAMPLE of that range, not a millimetre ruler —
 * a 24dp bar cannot show the 119dp a size-100 stroke paints — so the range is
 * what the scale fits, and the shape of the line is preserved: twice the size is
 * twice the band, on the paper and in the box (owner's defect, 26/10).
 */
const PREVIEW_SPAN = 100;

/**
 * Air kept at the top and the bottom of the box, in dp: the widest band (the
 * top of the range) never touches the edge of the strip.
 */
const PREVIEW_BREATH = 4;

/**
 * A FIXED aspect scale for a preview box: the box is `box` dp tall, and the
 * whole authored range fills it minus a breath. One scale for every material at
 * a given size, so the previews are comparable, and the shape of the line is
 * preserved: twice the size is twice the band, on the paper and in the box.
 *
 * This is also the factor that converts the preview's dp back into AUTHORED
 * units (`band / previewScale(box)`), which is how the parity suite compares the
 * declared number with the width the paper deposits without ever holding px
 * against artwork units.
 *
 * Why the ceiling is the range and not the can's widest cloud (the previous
 * `200 × (Ponta + Dispersão)` = 280 units): at a small strip that scale flattens
 * the pen to a hairline a `max(0.6, …)` floor then freezes between size 1 and 7 —
 * a strip that never answers the slider. The scale now spends the box on the
 * range the slider owns: 88dp → 0.84 px/unit, so 10/50/100 read 8/42/84. The
 * can's cloud is WIDER than a pen's band at the same size; when size and spread
 * are both near the top the cloud reaches past the box and is cut by its own
 * viewport — the declared band stays the honest number, and a cloud wider than
 * the box is the truth, not a drawing error.
 */
export function previewScale(box: number): number {
  return Math.max(0, box - PREVIEW_BREATH) / PREVIEW_SPAN;
}

/**
 * The sample line's own constants:
 *
 *  - `PREVIEW_STEP` is how far apart its points sit, in ARTWORK UNITS. Above
 *    `SPEED_FLOOR` (2), so the engine does not read the sample as a tap, and far
 *    below `size × 4`, so the line reads as a hand moving at a normal pace
 *    instead of a flick (a flick is thinner, and the preview would then promise
 *    a hairline).
 *  - `PREVIEW_PAD` is the air at both ends, in dp, so the round caps and the
 *    taper of the tips stay inside the box.
 *  - `PREVIEW_MEASURE` is the width the box falls back to before it is measured:
 *    a phone's compact card, so the first frame is never empty.
 *  - `PREVIEW_LENGTH` is how many SIZES long the sample may be. It is the cost
 *    gate, not a look: the engine dabs every `size × spacing` units, so a thin
 *    pen on a long line is thousands of dabs per preview — and the sheet mounts
 *    one preview per material. Forty sizes is longer than any box at any size,
 *    so the only lines it shortens are the ones a hairline would leave empty.
 */
const PREVIEW_STEP = 4;
const PREVIEW_PAD = 6;
const PREVIEW_MEASURE = 320;

/**
 * How solid the painted field of the eraser's preview is. Enough to read as
 * "paint over paper" on the card, low enough that the punched lane is the thing
 * the eye finds first.
 */
const ERASER_FIELD_ALPHA = 0.5;
const PREVIEW_LENGTH = 40;

/** The stroke id of every sample: one grain, stable across renders. */
const PREVIEW_STROKE_ID = "previa";

/**
 * The command a preview paints: ONE short horizontal line, in artwork units, in
 * the box's own view. Exported because it is the seam the suite holds: given the
 * same canvas and the same scale, `stampsOf(previewCommand(...))` is exactly the
 * list of dabs the canvas receives — so "the preview uses the paper's engine" is
 * a measurable claim, not a comment.
 */
export function previewCommand({
  brush,
  color,
  size,
  opacity,
  spray,
  pixelW,
  pixelH,
  pixelScale,
}: {
  brush: BrushKind;
  color: string;
  size: number;
  opacity: number;
  spray?: SpraySettings | undefined;
  pixelW: number;
  pixelH: number;
  pixelScale: number;
}): StrokeCommand {
  const centre = pixelH / 2 / pixelScale;
  const from = PREVIEW_PAD / pixelScale;
  const canvasUnits = pixelW / pixelScale - PREVIEW_PAD / pixelScale;
  const to = Math.max(
    from + PREVIEW_STEP,
    from + Math.min(canvasUnits, Math.max(PREVIEW_STEP, size * PREVIEW_LENGTH)),
  );
  const points: Point[] = [];
  for (let x = from; x < to; x += PREVIEW_STEP) points.push([x, centre]);
  points.push([to, centre]);
  return {
    t: "stroke",
    id: PREVIEW_STROKE_ID,
    brush,
    color,
    size,
    opacity,
    points,
    ...(brush === "spray" ? { spray: nozzleOf(spray) } : {}),
  };
}

/**
 * The field behind a sample is COMPUTED, not fixed (owner's defect, 27/10, item
 * 11): the strip was always the panel's paper, so a lilac, a yellow or a white
 * stroke nearly vanished into it.
 *
 * The two anchors are the project's own stock, never a new colour: the card
 * paper (`--card` in `styles.css`, `#F2ECE0`) and the palette's nanquim ink
 * (`INK_DEEP`, `#1C1410` — the ink the kid plate is measured against at 15.4:1).
 * The rule is minimal and deterministic: the paper stays while it can carry the
 * pair at the 3:1 floor the rest of the UI owes; only a colour the paper cannot
 * carry falls back to the ink field. When the paper fails, the ink is at least
 * 5.14:1 against that same colour (the worst point is the paper passing at
 * 2.999), so the floor holds by measurement, not by taste.
 *
 * It is local: same colour ⇒ same field, at any size, material or box. There is
 * no randomness, no hash and no per-band table — two different light colours do
 * not diverge by chance. And it changes ONLY the field: the sample is still the
 * engine's own raster (`paintStrokes`), with its grain and band untouched.
 */
export const PREVIEW_PAPER = "#F2ECE0";
export const PREVIEW_INK = INK_DEEP;
/** The non-text floor the field owes its sample (WCAG 1.4.11). */
export const PREVIEW_FIELD_FLOOR = 3;

export type PreviewField = { surface: string; ratio: number };

/** The measured field for one colour: paper while it clears the floor, else ink. */
export function previewField(color: string): PreviewField {
  const paper = contrastRatio(color, PREVIEW_PAPER);
  if (paper >= PREVIEW_FIELD_FLOOR) return { surface: PREVIEW_PAPER, ratio: paper };
  return { surface: PREVIEW_INK, ratio: contrastRatio(color, PREVIEW_INK) };
}

/**
 * The stroke a material will leave, at the size in hand — the ONE preview used
 * by the sheet's header, the compact bar and the shelf's list.
 *
 * It is a RASTER SAMPLE OF THE PAPER, not a drawing of it (owner's call,
 * 26/10). The line is painted by the very engine that paints the sheet —
 * `paintStrokes` into a `canvasSink`, on a canvas the size of the box — so the
 * grain, the taper, the dust, the ridges, the wash and the can's cloud are the
 * ones the material deposits. Nothing here restates a factor, a dash or an
 * alpha: a preview cannot drift from a stroke it does not draw.
 *
 * The box (`box` dp tall, full width) owns the scale. The whole authored range
 * 1..100 fits it minus a breath (`previewScale`), so a size-100 band takes about
 * 0.84 of a 88dp box and twice the size is twice the band, here and on the
 * paper. The canvas is measured (`ResizeObserver`) and painted at
 * `devicePixelRatio`, so the grain is not a blurry texture on a phone; a
 * substrate with no 2d context (jsdom) shows an empty box, the same degradation
 * the paper takes.
 *
 * `data-stroke-width` still DECLARES the band in dp (`authored × previewScale`)
 * and `data-stroke-opacity` the ink the sample carries (the medium's own wash
 * times the opacity in hand) — the two numbers the suite reads from the DOM,
 * with the engine's own paint as the drawing behind them.
 *
 * The FIELD behind the sample is computed from the colour in hand
 * (`previewField`): the card paper while the pair clears 3:1, the nanquim ink
 * when it cannot — so a white, a yellow or a lilac stroke no longer disappears
 * into the panel. The strip also wears the interface's 1px contour ring as its
 * own layer, so the sample reads as an area of its own. Neither touches the
 * drawing: the canvas is cleared and repainted by the engine on every change.
 *
 * The ERASER is the one tool drawn inverted, and it is the same sample: a field
 * of paint is laid over the box and the rubber's own stamps punch the lane out
 * (`destination-out`), so the strip shows the AREA the tool takes away and how
 * wide that area is at this size. `data-preview-mode` says which of the two
 * readings is on screen.
 *
 * The BUCKET is the other tool drawn as an AREA, and since the owner's feedback
 * of 27/10 it is a PLATE: the whole field in the colour in hand, no dabs at all
 * (`data-preview-mode="area"`, `data-stroke-width="0"`). A bucket does not leave
 * a line, so the preview cannot promise one — the same full-bleed geometry the
 * eraser's field uses, on the same computed `previewField(color)` surface, in the
 * same box every material gets. The strip does not change size when the material
 * changes; only what it says changes.
 */
export function StrokePreview({
  tool,
  color,
  size,
  box,
  opacity = 100,
  spray,
  className,
  testid = "stroke-preview",
}: {
  tool: CanvasTool;
  color: string;
  /** The authored size, 1..100. */
  size: number;
  /** Height of the preview box, in dp. */
  box: number;
  /** 20..100; multiplied by the medium's own wash. */
  opacity?: number;
  /** The can's nozzle in hand; absent = the shelf's own defaults. */
  spray?: SpraySettings | undefined;
  className?: string | undefined;
  testid?: string;
}) {
  const brush = shelfBrushOf(tool);
  /** The bucket leaves an AREA, not a line (owner's feedback, 27/10). */
  const isFill = tool === "fill";
  const geometry = brush ? brushStroke(brush.id, size) : null;
  const scale = previewScale(box);
  const nozzle = nozzleOf(spray);
  const authored =
    brush?.id === "spray"
      ? // The can is the one material whose band is the NOZZLE: `Dispersão` is a
        // ± deviation and `Ponta` a radius, so the cloud's width is twice their
        // sum. Opening the spread widens the preview exactly as it widens the
        // paper — there is no factor for the cloud.
        2 * size * (nozzle.tip + nozzle.spread)
      : geometry
        ? geometry.width
        : Math.max(1, size);
  /** Zero for the bucket: it has no band to promise, so it promises none. */
  const band = isFill ? 0 : authored * scale;
  const ink = isFill ? 1 : geometry ? (geometry.opacity ?? 1) * (opacity / 100) : opacity / 100;
  const brushId: BrushKind = brush?.id ?? "brush";
  const ink100 = Math.max(1, Math.min(100, opacity));
  const { tip, spread, intensity } = nozzle;
  /** The computed field behind the sample: paper, or ink when paper cannot carry it. */
  const field = previewField(color);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  /** CSS dp of the box, read from the surface it was given. */
  const [width, setWidth] = useState(PREVIEW_MEASURE);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? 0;
      if (measured > 0) setWidth(measured);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  /**
   * Retina: the sample is painted at the display's own density, capped at 3× so
   * a phone that reports a wild ratio does not paint a stamp a hundred times.
   */
  const ratio =
    typeof window === "undefined" ? 1 : Math.min(3, Math.max(1, window.devicePixelRatio || 1));
  const pixelW = Math.max(1, Math.round(width * ratio));
  const pixelH = Math.max(1, Math.round(box * ratio));
  /** Device pixels per artwork unit — the paper's unit, at the box's scale. */
  const pixelScale = scale * ratio;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      // A substrate without a 2d context still renders the rest of the screen.
      ctx = null;
    }
    if (!ctx) return;

    const sample = previewCommand({
      brush: brushId,
      color,
      size,
      opacity: ink100,
      spray: brushId === "spray" ? { tip, spread, intensity } : undefined,
      pixelW,
      pixelH,
      pixelScale,
    });

    // A full repaint from scratch: the box never accumulates a stale band.
    ctx.clearRect(0, 0, pixelW, pixelH);
    if (isFill) {
      // THE BUCKET IS AN AREA (owner's feedback, 27/10): the preview used to
      // draw a line, which is exactly what the bucket never leaves. The plate
      // covers the whole field in the colour in hand — full bleed, the same
      // geometry as the eraser's field, with the same 1px contour drawn over
      // it — and NOT a single dab is painted: `paintStrokes` is not called, so
      // there is no grain, no taper and no band to mistake for a stroke. The
      // field behind it is still `previewField(color)`, so a white or a pale
      // yellow plate reads against the ink surface instead of vanishing.
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, pixelW, pixelH);
      return;
    }
    const sink = canvasSink(ctx, { x: 0, y: 0, scale: pixelScale });
    if (brushId === "eraser") {
      // The rubber is previewed INVERTED (owner's call, 26/10): a field of paint
      // with the band the rubber takes OUT of it. The old preview drew the path
      // the hand walks, which is the one thing an eraser does not leave behind;
      // what the strip owes is the size of the hole.
      ctx.save();
      ctx.globalAlpha = ERASER_FIELD_ALPHA;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, pixelW, pixelH);
      ctx.restore();
      ctx.save();
      // The engine's own stamps punch the lane: same width, same grain, opposite
      // direction of paint.
      ctx.globalCompositeOperation = "destination-out";
      paintStrokes(sink, [sample], { w: pixelW, h: pixelH });
      ctx.restore();
      return;
    }
    paintStrokes(sink, [sample], { w: pixelW, h: pixelH });
  }, [brushId, isFill, color, size, ink100, tip, spread, intensity, pixelW, pixelH, pixelScale]);

  return (
    <span
      data-testid={testid}
      data-brush={brush?.id ?? tool}
      data-size={size}
      data-preview-mode={isFill ? "area" : brushId === "eraser" ? "erased" : "stroke"}
      data-preview-plate={isFill ? "full" : "none"}
      data-stroke-width={Number(band.toFixed(2))}
      data-stroke-opacity={Number(ink.toFixed(3))}
      data-preview-box={box}
      data-preview-scale={Number(pixelScale.toFixed(4))}
      data-preview-color={color}
      data-preview-surface={field.surface}
      data-preview-contrast={Number(field.ratio.toFixed(2))}
      className={cn("relative flex w-full min-w-0 items-center", className)}
      style={{ height: box, backgroundColor: field.surface }}
    >
      <canvas
        ref={canvasRef}
        width={pixelW}
        height={pixelH}
        aria-hidden
        data-testid={`${testid}-canvas`}
        className="pointer-events-none block h-full w-full"
      />
      {/* The 1px interface contour, as its own layer ON TOP of the sample: the
          field is a computed value and the strip has to read as its own area
          against the panel, never as a bleed of the card. */}
      <span
        aria-hidden
        data-preview-ring="1"
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 0 1px var(--border)" }}
      />
    </span>
  );
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

/**
 * The tool row (always visible, one scrollable line) plus the grouped shelf
 * (m3-temas-cor.md §7): search, family collections and per-tool favorites.
 *
 * Every button carries the stroke preview *and* the tool's own name: the
 * generic brush glyph is gone, and the full label lives in the sheet. The row
 * only ever lists tools this profile can pick: a tool that is out of reach is
 * absent, not padlocked.
 *
 * The ORDERING list is a sheet of this component, but its door is not: since
 * 27/10 the door sits in the expanded panel's title band (owner's decision), so
 * the level that owns both — the panel — holds the flag and passes it down. The
 * shelf is then a pure list plus the disclosure it controls.
 */
export function BrushShelf({
  tools,
  catalog,
  active,
  color,
  size,
  kids,
  grouped,
  organizeOpen,
  onOrganizeOpenChange,
  onPick,
  onToggleSlot,
  onMoveSlot,
}: {
  tools: CanvasTool[];
  /** Every tool this profile may use — the sheet lists this, not the row. */
  catalog: CanvasTool[];
  active: CanvasTool;
  color: string;
  /** The authored size in hand, so a row previews the band it will leave. */
  size: number;
  kids: boolean;
  /** Only profiles with the complex toolset get the grouped shelf. */
  grouped: boolean;
  /** Whether the ordering sheet is open — owned by the panel's title band. */
  organizeOpen: boolean;
  onOrganizeOpenChange: (open: boolean) => void;
  onPick: (tool: CanvasTool) => void;
  onToggleSlot: (tool: CanvasTool) => void;
  onMoveSlot: (tool: CanvasTool, dir: -1 | 1) => void;
}) {
  const [collection, setCollection] = useState<string>("minhas");
  const [query, setQuery] = useState("");

  /** The name the row shows; fill and eyedropper have no brush record. */
  const labelOf = (id: CanvasTool) =>
    id === "fill"
      ? "Pintar"
      : id === "eyedropper"
        ? "Conta-gotas"
        : (shelfBrushOf(id)?.label ?? id);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const allowed = (id: CanvasTool) => catalog.includes(id);
    if (q) return catalog.filter((id) => normalize(labelOf(id)).includes(q));
    // "Minhas" IS the toolbar row, in the profile's own order — the only list
    // that can be reordered (owner's call, 24/10).
    if (collection === "minhas") return tools;
    const group = TOOL_COLLECTIONS.find((c) => c.id === collection) ?? TOOL_COLLECTIONS[0]!;
    const ids: CanvasTool[] = group.id === "basico" ? ["fill", ...group.tools] : [...group.tools];
    return ids.filter(allowed);
  }, [collection, query, catalog, tools]);

  const pick = (tool: CanvasTool) => {
    onPick(tool);
    onOrganizeOpenChange(false);
  };

  return (
    <>
      <div
        className={cn(
          "flex items-stretch pb-0.5 [scrollbar-width:none]",
          // Kids centres the shelf; with the nine complex tools a centred
          // non-wrapping row pushed the first cards off the left edge, so it
          // wraps instead of overflowing. Pro wraps too: a clipped card on the
          // right edge reads as a broken control (iconografia-v2 §3.3), and a
          // horizontal scroller hides tools behind a gesture nobody sees.
          kids ? "flex-wrap justify-center gap-0.5" : "flex-wrap gap-1",
        )}
        role="group"
        aria-label="Ferramentas"
        data-testid="tool-shelf"
      >
        {tools.map((tool) => {
          const on = tool === active;
          const brush = shelfBrushOf(tool);
          // F1: on 3-5 the card IS the material — its surface carries the body
          // colour and the glyph wears one measured silhouette ink (F2/F3).
          const plate = kids ? materialPlate(plateMaterialOf(tool, brush), color) : null;
          return (
            <button
              key={tool}
              type="button"
              onClick={() => onPick(tool)}
              aria-label={brush?.label ?? (tool === "fill" ? "Tocar para pintar" : "Conta-gotas")}
              aria-pressed={on}
              data-tool={tool}
              data-plate={plate?.plate}
              data-ink={plate?.ink}
              style={plate ? plateStyle(plate) : undefined}
              className={cn(
                "flex shrink-0 flex-col items-center justify-center gap-0.5 transition-colors duration-150 ease-out active:scale-[0.96]",
                kids ? "relative h-16 w-16 rounded-[20px]" : "h-14 w-16 rounded-xl",
                kids
                  ? on && "ring-2 ring-foreground ring-offset-2 ring-offset-card"
                  : on
                    ? "bg-pigmento/10 text-foreground ring-1 ring-pigmento/40"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {plate && <PlateRim plate={plate} />}
              {brush ? (
                // The same object in both bands (owner's call, 26/10); only the
                // plate and the contour ink change.
                <MaterialGlyph
                  brush={brush}
                  color={color}
                  size={kids ? 64 : 32}
                  ink={kids ? undefined : "var(--foreground)"}
                />
              ) : (
                <ToolIcon
                  name={tool === "fill" ? "fill" : "eyedropper"}
                  size={kids ? 40 : 20}
                  color={color}
                  ink={kids ? plate?.ink : "var(--foreground)"}
                />
              )}
              {/* 3-5 is reading-zero: the glyph IS the name. */}
              {!kids && (
                <span className="max-w-full truncate px-0.5 text-[9px] font-semibold">
                  {brush?.short ?? (tool === "fill" ? "Pintar" : "Conta-gotas")}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* The door to the ordering list no longer lives here (owner's decision,
          27/10): a 40dp line under the row, holding two words at the right
          edge, was a whole line of the sheet spent on a way in. The door is in
          the panel's TITLE band now — `data-seat="panel-top"` — and the sheet
          below renders only what it was asked to open. */}
      <Sheet
        open={organizeOpen && grouped}
        onClose={() => onOrganizeOpenChange(false)}
        label="Ferramentas"
        testid="shelf-sheet"
        backdrop="bg-foreground/25"
        closeLabel="Fechar ferramentas"
        panel={cn(
          "themed-scroll max-h-[78%] overflow-y-auto bg-card p-4 shadow-tile",
          kids ? "rounded-t-3xl" : "rounded-t-2xl",
        )}
      >
        <div className="flex items-center gap-2">
          <p className="flex-1 font-display text-base font-semibold">Ferramentas</p>
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => onOrganizeOpenChange(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mt-2 flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Buscar ferramentas"
            placeholder="Buscar ferramentas…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>

        {!query && (
          <div
            className="mt-2 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none]"
            role="group"
            aria-label="Coleções"
          >
            <CollectionChip
              label="Minhas"
              active={collection === "minhas"}
              onClick={() => setCollection("minhas")}
            />
            {TOOL_COLLECTIONS.map((c) => (
              <CollectionChip
                key={c.id}
                label={c.label}
                active={collection === c.id}
                onClick={() => setCollection(c.id)}
              />
            ))}
          </div>
        )}

        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
          {collection === "minhas"
            ? "Ligue, desligue e ordene as ferramentas da barra."
            : "Toque para usar. O interruptor decide se fica na barra."}
        </p>

        <ul className="mt-2 space-y-1" role="list" aria-live="polite">
          {visible.length === 0 ? (
            <li className="py-6 text-center text-xs text-muted-foreground">
              {query
                ? "Nenhuma ferramenta encontrada."
                : "Barra vazia — ligue uma ferramenta para voltar a ela."}
            </li>
          ) : (
            visible.map((id, index) => {
              const brush = shelfBrushOf(id);
              const label = labelOf(id);
              const iconName: ToolIconName = brush?.id ?? (id === "fill" ? "fill" : "eyedropper");
              const on = id === active;
              const inRow = tools.includes(id);
              const canUp = collection === "minhas" && index > 0;
              const canDown = collection === "minhas" && index < visible.length - 1;
              return (
                <li key={id} className="flex items-center gap-1.5" data-tool-row={id}>
                  <button
                    type="button"
                    onClick={() => pick(id)}
                    aria-pressed={on}
                    className={cn(
                      "flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 text-left transition-colors duration-150 ease-out active:scale-[0.96]",
                      kids ? "h-14" : "h-11",
                      on ? "bg-md-primary-container text-md-on-primary-container" : "bg-muted",
                    )}
                  >
                    <span className="flex w-12 shrink-0 items-center">
                      {brush ? (
                        // The row previews the band THIS material leaves at the
                        // size in hand — not a fixed 5-unit sample that made
                        // every brush look the same above 50 (owner's report).
                        <StrokePreview
                          tool={id}
                          color={color}
                          size={size}
                          box={kids ? 28 : 22}
                          testid="row-stroke"
                        />
                      ) : (
                        // The door that does not paint still wears its object:
                        // the bucket pours, the dropper picks — never a bucket
                        // for both.
                        <ToolIcon name={iconName} size={kids ? 40 : 28} color={color} />
                      )}
                    </span>
                    <ToolIcon
                      name={iconName}
                      size={16}
                      color={color}
                      className="shrink-0 opacity-80"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{label}</span>
                    <span className="shrink-0 pr-1 text-[10px] text-muted-foreground">
                      {inRow ? "na barra" : "fora"}
                    </span>
                  </button>
                  {(canUp || canDown) && (
                    <span className="flex shrink-0 flex-col gap-0.5">
                      {canUp && (
                        <button
                          type="button"
                          aria-label={`Mover ${label} para cima`}
                          onClick={() => onMoveSlot(id, -1)}
                          className="flex h-[21px] w-8 items-center justify-center rounded-md bg-muted text-muted-foreground active:scale-[0.94]"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDown && (
                        <button
                          type="button"
                          aria-label={`Mover ${label} para baixo`}
                          onClick={() => onMoveSlot(id, 1)}
                          className="flex h-[21px] w-8 items-center justify-center rounded-md bg-muted text-muted-foreground active:scale-[0.94]"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={inRow}
                    aria-label={`Mostrar ${label} na barra`}
                    data-testid={`slot-switch-${id}`}
                    onClick={() => onToggleSlot(id)}
                    className={cn(
                      "flex h-6 w-10 shrink-0 items-center rounded-full px-0.5 transition-colors duration-150 ease-out",
                      inRow ? "bg-foreground" : "bg-border",
                    )}
                  >
                    <span
                      className={cn(
                        "h-5 w-5 rounded-full bg-card shadow-sm transition-transform duration-150 ease-out",
                        inRow && "translate-x-4",
                      )}
                    />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </Sheet>
    </>
  );
}

function CollectionChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 shrink-0 rounded-full px-3 text-[11px] font-semibold transition-colors duration-150 ease-out active:scale-[0.96]",
        active ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </button>
  );
}
