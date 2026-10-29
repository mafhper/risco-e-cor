import { forwardRef, type SVGProps } from "react";
import { filterIdFor } from "./brush";
import { derive, type Command, type StrokeCommand } from "./history";
import { strokesOf } from "./strokeTexture";
import {
  OUTLINE_HEX,
  PAPER_HEX,
  PAPER_TEXTURE_ALPHA,
  gradientId,
  gradientPoints,
  type PaperTexture,
  type StrokeGradient,
} from "./palette";
import { pageById } from "./pages";

type Props = {
  pageId: string | null;
  w: number;
  h: number;
  commands: Command[];
  live?: StrokeCommand | null | undefined;
  fadedStrokes?: Set<string> | undefined;
  interactiveRegions?: boolean | undefined;
  /** Paper appearance supplied by the studio; defaults to plain white paper. */
  paperHex?: string | undefined;
  /** "Quadriculado": the paper carries its own graph texture. */
  paperPattern?: boolean | undefined;
  /**
   * How pronounced the sheet's printed grain is (owner's decision, 27/10). It is
   * the PAPER's texture, not the working grid: the export paints the same
   * hatch, so the file and the sheet age together. Absent = `lisa`.
   */
  paperTexture?: PaperTexture | undefined;
  /**
   * The working grid, as a lattice in the SHEET's own user space — the same
   * viewBox and the same origin as the paper, so it scales with the zoom and
   * coincides with the paper's graph instead of being a second grid in screen
   * pixels. Absent = no guide, which is what the export always passes: the
   * guide is a screen aid and has no way to reach the file.
   *
   * Only one `ArtworkSvg` per document may carry it (the id is per sheet size):
   * `ArtworkPaint` gives it to the top half alone.
   */
  gridGuide?: GridGuide | undefined;
  /** Line-art ink; a dark paper needs light lines. */
  outlineHex?: string | undefined;
  /**
   * Square window in artwork coordinates (card-gradiente-obra §1). The card
   * frames the piece, not the sheet; the canvas never passes this.
   */
  focus?: { x: number; y: number; size: number } | null;
  /**
   * Which layers this SVG owns. `all` (default) is the whole piece, strokes
   * included, as every screen has always received it. `regions` and `outline`
   * are the two halves ArtworkPaint stacks around the raster paint: an SVG must
   * never draw the strokes when it is only one half of the paper, or the same
   * stroke would appear twice.
   */
  layer?: "all" | "regions" | "outline";
} & Omit<SVGProps<SVGSVGElement>, "ref">;

/** One def id per gradient *and* canvas size: equal paint shares a definition. */
const defId = (g: StrokeGradient, w: number, h: number) => `${gradientId(g)}-${w}x${h}`;

/** The grid guide's two strengths: full, or the subtle one. */
export type GridGuide = {
  pattern: "quadrado" | "pontilhado" | "linhas";
  /** The cell, in ARTWORK units (16 / 24 / 32 — the density's own number). */
  cell: number;
  strength: "sutil" | "nitida";
};

/**
 * The guide's ink and its two strengths. The ink is the value the CSS utility
 * carried before the guide moved into the SVG: 34% of the same dark teal, which
 * reads on white in BOTH themes — deriving it from `--pigmento` made it
 * invisible in the dark theme, at 14% effective alpha over #FFFFFF.
 *
 * The line weight is 1 with `non-scaling-stroke`: a guide is a hairline at every
 * zoom, or at 4× a 4,8px band competes with the drawing.
 */
const GUIDE_INK = "rgba(18, 44, 54, 0.34)";
const GUIDE_SUBTLE = 0.45;

/**
 * The paper's graph cell, in ARTWORK units: `max(12, round(w / 14))`, so a
 * 300-unit sheet gets 21 units. It is the ONE rule for the texture and for the
 * guide, and it scales with the sheet — never with the phone it was drawn on.
 * `exportPng` carries its own copy of the same rule: the file is painted from a
 * plan and never touches a component.
 */
const paperCell = (w: number) => Math.max(12, Math.round(w / 14));

/**
 * The guide's cell is the DENSITY's own number (16 / 24 / 32 artwork units,
 * `GRID_CELL_UNITS`), passed in by the caller — a fixed rule instead of a
 * fraction of the sheet, so the guide is the same guide on every piece.
 */

/**
 * The sheet's printed grain: a linen hatch at 45°, one line every 6 units, in
 * the same ink at the tone's own alpha. Both the SVG half and the file paint it,
 * because it is the PAPER — unlike the grid, which no file ever carries.
 */
const WEAVE_STEP = 6;
const WEAVE_INK = "28,27,26";

/**
 * Layers, bottom to top:
 *   1. region fills (tap-to-fill)   2. freehand strokes   3. line-art outline
 * The outline uses white fill + multiply, so it always sits "over" the color
 * like a printed coloring book, even when a stroke goes past the lines.
 *
 * Strokes may carry gradient paint and SVG filters; the `<defs>` only lists
 * what the command list actually uses, so a plain sketch stays cheap.
 *
 * `layer` splits the same drawing in halves for ArtworkPaint, which puts the
 * raster strokes between them: `regions` (1) and `outline` (3) never paint a
 * stroke, or the same command would appear twice on the paper.
 */
export const ArtworkSvg = forwardRef<SVGSVGElement, Props>(function ArtworkSvg(
  {
    pageId,
    w,
    h,
    commands,
    live,
    fadedStrokes,
    interactiveRegions,
    paperHex = PAPER_HEX,
    paperPattern = false,
    paperTexture = "lisa",
    gridGuide,
    outlineHex = OUTLINE_HEX,
    focus = null,
    layer = "all",
    ...rest
  },
  ref,
) {
  const page = pageById(pageId);
  const showRegions = layer !== "outline";
  const showStrokes = layer === "all";
  const showOutline = layer !== "regions";
  const { fills, strokes, gaps } = derive(commands);
  const all = showStrokes ? (live ? [...strokes, live] : strokes) : [];
  const patternId = `paper-graph-${w}x${h}`;
  const weaveId = `paper-weave-${w}x${h}`;
  const weaveAlpha = PAPER_TEXTURE_ALPHA[paperTexture] ?? 0;
  const textured = weaveAlpha > 0;
  /** A texture of either kind is the sheet's paint: a region must not cover it. */
  const regionPaper = paperPattern || textured ? "transparent" : paperHex;
  /** The paper's graph cell, in artwork units: the texture belongs to the sheet. */
  const paperCellUnits = paperCell(w);
  const guideId = `paper-guide-${w}x${h}`;
  /** The paper's base paint, in one place: graph over grain over plain hex. */
  const sheetFill = paperPattern ? `url(#${patternId})` : textured ? `url(#${weaveId})` : paperHex;

  const gradients = new Map<string, StrokeGradient>();
  let needsShadow = false;
  let needsGlow = false;
  for (const s of all) {
    if (s.gradient) gradients.set(defId(s.gradient, w, h), s.gradient);
    if (s.shadow) needsShadow = true;
    if (s.glow) needsGlow = true;
  }

  return (
    <svg
      ref={ref}
      viewBox={focus ? `${focus.x} ${focus.y} ${focus.size} ${focus.size}` : `0 0 ${w} ${h}`}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {showRegions && (paperPattern || textured) && (
        <defs>
          {/* The grain is UNDER the graph: the graph pattern's field is the
              weave itself, so `quadriculado + acentuada` composes instead of
              one of the two disappearing. */}
          {textured && (
            <pattern
              id={weaveId}
              width={WEAVE_STEP}
              height={WEAVE_STEP}
              patternUnits="userSpaceOnUse"
            >
              <rect width={WEAVE_STEP} height={WEAVE_STEP} fill={paperHex} />
              <path
                d={`M0 ${WEAVE_STEP}L${WEAVE_STEP} 0`}
                fill="none"
                stroke={`rgba(${WEAVE_INK},${weaveAlpha})`}
                strokeWidth="0.75"
              />
            </pattern>
          )}
          {paperPattern && (
            <pattern
              id={patternId}
              width={paperCellUnits}
              height={paperCellUnits}
              patternUnits="userSpaceOnUse"
            >
              <rect
                width={paperCellUnits}
                height={paperCellUnits}
                fill={textured ? `url(#${weaveId})` : paperHex}
              />
              <path
                d={`M${paperCellUnits} 0H0V${paperCellUnits}`}
                fill="none"
                stroke="#C3D4E4"
                strokeWidth="1"
              />
            </pattern>
          )}
        </defs>
      )}
      {gradients.size > 0 || needsShadow || needsGlow ? (
        <defs>
          {[...gradients].map(([id, g]) => {
            const [x1, y1, x2, y2] = gradientPoints(g.angle);
            return g.kind === "radial" ? (
              <radialGradient
                key={id}
                id={id}
                gradientUnits="userSpaceOnUse"
                cx={w / 2}
                cy={h / 2}
                r={Math.max(w, h) / 2}
              >
                <stop offset="0%" stopColor={g.stop1} />
                <stop offset="100%" stopColor={g.stop2} />
              </radialGradient>
            ) : (
              <linearGradient
                key={id}
                id={id}
                gradientUnits="userSpaceOnUse"
                x1={(x1 / 100) * w}
                y1={(y1 / 100) * h}
                x2={(x2 / 100) * w}
                y2={(y2 / 100) * h}
              >
                <stop offset="0%" stopColor={g.stop1} />
                <stop offset="100%" stopColor={g.stop2} />
              </linearGradient>
            );
          })}
          {needsShadow && (
            <filter id="fx-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2.5"
                floodColor="#000000"
                floodOpacity="0.32"
              />
            </filter>
          )}
          {needsGlow && (
            <filter id="fx-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
          {needsShadow && needsGlow && (
            <filter id="fx-shadow-glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge result="lit">
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
              <feDropShadow
                in="lit"
                dx="0"
                dy="2"
                stdDeviation="2.5"
                floodColor="#000000"
                floodOpacity="0.3"
              />
            </filter>
          )}
        </defs>
      ) : null}
      {showRegions && (
        <rect
          width={w}
          height={h}
          // A blank sheet is one paintable region ("fundo"): the bucket keeps its
          // job even without a line-art page, so a child never meets a dead tool.
          data-region={page ? undefined : "fundo"}
          fill={page ? sheetFill : (fills["fundo"] ?? sheetFill)}
          style={{
            pointerEvents: interactiveRegions && !page ? "auto" : "none",
            transition: "fill 150ms ease-out",
          }}
        />
      )}
      {showRegions && page && (
        <g>
          {page.regions.map((r) => (
            <path
              key={r.id}
              d={r.d}
              data-region={r.id}
              fill={fills[r.id] ?? regionPaper}
              style={{
                pointerEvents: interactiveRegions ? "auto" : "none",
                transition: "fill 150ms ease-out",
              }}
            />
          ))}
        </g>
      )}
      {showStrokes && (
        <g
          style={{ pointerEvents: "none" }}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {all.map((s) => {
            const filter = filterIdFor(Boolean(s.shadow), Boolean(s.glow));
            const paint = s.gradient ? `url(#${defId(s.gradient, w, h)})` : s.color;
            // The style opacity the author picked, and the eraser's faded preview.
            const styleOpacity = (s.opacity ?? 100) / 100;
            const faded = fadedStrokes?.has(s.id) ? 0.2 : 1;
            // One <path> per layer, never one per stamp: the grain of a long stroke
            // is hundreds of sub-paths inside a single `d` (strokeTexture.ts). The
            // spans an area erase took cut both the core and the grain, so the
            // paper and the thumbnail lose the same ink.
            return strokesOf(s, gaps[s.id]).map((layer, i) => {
              const stamp = layer.mode === "stamp";
              return (
                <path
                  key={`${s.id}-${layer.role}-${i}`}
                  data-layer={layer.role}
                  d={layer.d}
                  fill={stamp ? paint : "none"}
                  stroke={stamp ? "none" : paint}
                  strokeWidth={stamp ? undefined : layer.width}
                  strokeLinecap={stamp ? undefined : layer.linecap}
                  strokeDasharray={stamp ? undefined : layer.dasharray}
                  opacity={faded * styleOpacity * layer.opacity}
                  filter={filter ? `url(#${filter})` : undefined}
                />
              );
            });
          })}
        </g>
      )}
      {showOutline && page && (
        <g
          style={{ pointerEvents: "none", mixBlendMode: "multiply" }}
          stroke={outlineHex}
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {/* No fill: under multiply a white fill is invisible over the colours,
              so it only existed to keep the path from defaulting to black. With
              it gone, this layer is nothing but ink — even if a browser ever
              isolates the SVG from the canvas behind it, the paint underneath
              is never knocked out. */}
          {page.regions.slice(1).map((r) => (
            <path key={r.id} d={r.d} fill="none" />
          ))}
          {page.details?.map((d, i) => (
            <path key={i} d={d} fill="none" />
          ))}
        </g>
      )}
      {/* THE WORKING GRID. A lattice in the sheet's own user space: same
          viewBox, same origin, `userSpaceOnUse` — so it zooms with the paper.
          The PATTERN and the CELL are the person's (`Grade` fold); the strength
          is the alpha. It is drawn last (a guide reads over the colour) and is
          never a command, a fill or a node the export reads: no file ever
          carries it. */}
      {gridGuide && (
        <g
          data-testid="paper-grid"
          data-grid-mode={gridGuide.strength}
          data-grid-pattern={gridGuide.pattern}
          data-grid-cell={gridGuide.cell}
          opacity={gridGuide.strength === "sutil" ? GUIDE_SUBTLE : 1}
          aria-hidden
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <pattern
              id={guideId}
              width={gridGuide.cell}
              height={gridGuide.cell}
              patternUnits="userSpaceOnUse"
            >
              {gridGuide.pattern === "quadrado" && (
                <path
                  d={`M${gridGuide.cell} 0H0V${gridGuide.cell}`}
                  fill="none"
                  stroke={GUIDE_INK}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              )}
              {gridGuide.pattern === "pontilhado" && (
                <circle cx={gridGuide.cell / 2} cy={gridGuide.cell / 2} r="1" fill={GUIDE_INK} />
              )}
              {gridGuide.pattern === "linhas" && (
                <path
                  d={`M0 ${gridGuide.cell}H${gridGuide.cell}`}
                  fill="none"
                  stroke={GUIDE_INK}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              )}
            </pattern>
          </defs>
          <rect
            x={focus ? focus.x : 0}
            y={focus ? focus.y : 0}
            width={focus ? focus.size : w}
            height={focus ? focus.size : h}
            fill={`url(#${guideId})`}
          />
        </g>
      )}
    </svg>
  );
});
