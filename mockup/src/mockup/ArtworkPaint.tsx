// The paper is THREE layers in one box, in one order:
//
//   1. region fills (SVG)   — the bucket, flat colour under everything
//   2. freehand paint (canvas) — the raster engine, one canvas for the piece
//   3. line art (SVG)       — the printed outline, multiplied over the paint
//
// Same box, same coordinates: the three layers share the artwork's user space,
// so a stroke lands exactly under the printed line it crosses. The canvas is
// never a node per stamp (`brushCanvas.ts`), and it never takes a pointer: the
// finger belongs to the paper, and region taps still reach the SVG underneath.
//
// The whole piece is repainted from `derive(commands)` whenever the command
// list or the live stroke changes — undo, redo and the eraser already work
// because the command list is the only source of truth.
import { forwardRef, useEffect, useMemo, useRef, type CSSProperties } from "react";
import { ArtworkSvg, type GridGuide } from "./ArtworkSvg";
import { canvasSink, paintStrokes } from "./brushCanvas";
import type { Command, StrokeCommand } from "./history";
import type { PaperTexture } from "./palette";
import { useLowPowerDevice } from "./store";
import { cn } from "@/lib/utils";

type Props = {
  commands: Command[];
  pageId: string | null;
  w: number;
  h: number;
  /** The stroke in progress; absent when the finger is up. */
  live?: StrokeCommand | null;
  /** Strokes the eraser marked: painted at 20% while the finger is down. */
  fadedStrokes?: Set<string>;
  paperHex?: string;
  paperPattern?: boolean;
  /** The sheet's printed grain (`lisa` paints none). It enters every file. */
  paperTexture?: PaperTexture | undefined;
  /**
   * The working grid (`ArtworkSvg`'s `gridGuide`). Only the canvas passes it,
   * and this component gives it to the TOP half alone — one guide per paper, or
   * two identical lattices would stack and double the ink.
   */
  gridGuide?: GridGuide | undefined;
  outlineHex?: string;
  interactiveRegions?: boolean;
  /**
   * Square window in artwork coordinates (`focusBox`). The card frames the
   * piece, so all three layers crop together; the canvas raster uses the same
   * window. The box must have the window's aspect ratio.
   */
  focus?: { x: number; y: number; size: number } | null;
  /** Canvas pixels per artwork unit. 2 keeps strokes crisp on a phone. */
  scale?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible name for the piece; the crossing layers stay hidden from AT. */
  label?: string;
};

export const ArtworkPaint = forwardRef<HTMLDivElement, Props>(function ArtworkPaint(
  {
    commands,
    pageId,
    w,
    h,
    live = null,
    fadedStrokes,
    paperHex,
    paperPattern = false,
    paperTexture,
    gridGuide,
    outlineHex,
    interactiveRegions = false,
    focus = null,
    scale = 2,
    className,
    style,
    label,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  /**
   * The device tier, declared by the profile in use (efeitos-chevrons §7.7.6).
   * Read here, at the one place the paper is painted, so the screen, the cards
   * and the file all ask the engine for the same passes — and turning the flag
   * on repaints the piece already open, because it is a dependency below.
   */
  const lowPower = useLowPowerDevice();

  /** The window all three layers draw, in artwork units. */
  const viewX = focus ? focus.x : 0;
  const viewY = focus ? focus.y : 0;
  const viewW = focus ? focus.size : Math.max(1, w);
  const viewH = focus ? focus.size : Math.max(1, h);

  // One raster pixel per `1 / scale` artwork unit: a 600-unit sheet at scale 2
  // is a 1200 px canvas, so the grain is not a blurry texture on a phone.
  const pixelW = Math.max(1, Math.round(viewW * scale));
  const pixelH = Math.max(1, Math.round(viewH * scale));

  const painted = useMemo(() => (live ? [...commands, live] : commands), [commands, live]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      // A substrate without 2d support (jsdom, an ancient webview): the SVG
      // layers still carry the page, so the screen is readable, not broken.
      ctx = null;
    }
    if (!ctx) return;

    // A full repaint: the command list decides the pixels, never the previous
    // frame. Undo and the eraser are safe by construction.
    ctx.clearRect(0, 0, pixelW, pixelH);
    paintStrokes(canvasSink(ctx, { x: viewX, y: viewY, scale: pixelW / viewW }), painted, {
      fadedStrokes,
      w,
      h,
      // The tier is declared only when the device lowered it: an unflagged
      // paper hands the engine exactly the options it always did (§7.7.6).
      ...(lowPower ? { lowPower: true } : {}),
    });
  }, [painted, fadedStrokes, lowPower, pixelW, pixelH, viewW, viewX, viewY, w, h]);

  return (
    <div
      ref={ref}
      className={cn("relative block h-full w-full", className)}
      style={style}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <ArtworkSvg
        pageId={pageId}
        w={w}
        h={h}
        commands={commands}
        interactiveRegions={interactiveRegions}
        paperHex={paperHex}
        paperPattern={paperPattern}
        paperTexture={paperTexture}
        outlineHex={outlineHex}
        focus={focus}
        layer="regions"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      />
      <canvas
        ref={canvasRef}
        width={pixelW}
        height={pixelH}
        aria-hidden
        data-testid="paint-canvas"
        className="pointer-events-none absolute inset-0 h-full w-full"
        // `contain`: the box a surface gives us need not carry the sheet's own
        // ratio (a square feed card, a height-capped preview). The SVG halves
        // letterbox themselves from their viewBox, so the raster must too, or
        // a stroke would be stretched against the line it crosses.
        style={{ pointerEvents: "none", objectFit: "contain" }}
      />
      <ArtworkSvg
        pageId={pageId}
        w={w}
        h={h}
        commands={commands}
        paperHex={paperHex}
        paperPattern={paperPattern}
        paperTexture={paperTexture}
        outlineHex={outlineHex}
        focus={focus}
        // The guide rides the TOP half: it is a screen aid over the whole
        // paper, and passing it to both halves would stack it twice.
        gridGuide={gridGuide}
        layer="outline"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      />
    </div>
  );
});
