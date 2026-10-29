// The tool shelf is data: each tool carries the stroke it leaves, the icon it
// wears and the name it answers to. The same function that shapes the sample
// shapes the real stroke on the paper, so the preview never lies.
//
// Kept intentionally cheap — no turbulence filters on the canvas, texture is
// dashed geometry plus a per-media opacity (the spec's mitigation for low-end
// phones).
import {
  Droplets,
  Eraser,
  Feather,
  Highlighter,
  Paintbrush,
  Palette,
  Pen,
  Pencil,
  PencilLine,
  SprayCan,
  type LucideIcon,
} from "lucide-react";

export type BrushKind =
  | "pencil"
  | "charcoal"
  | "crayon"
  | "marker"
  | "brush"
  | "watercolor"
  | "oil"
  | "spray"
  | "ink"
  | "eraser";
export type PaintBrush = Exclude<BrushKind, "eraser">;
export type LineCap = "round" | "square";

export type StrokeGeometry = {
  width: number;
  linecap: LineCap;
  dasharray?: string;
  /** Media that lay down less than a solid colour (wash, dust). 1 = solid. */
  opacity?: number;
};

export type ShelfBrush = {
  id: BrushKind;
  label: string;
  /** Label that fits under a 56dp button. */
  short: string;
  /** The media's own glyph — never a generic brush for everything. */
  icon: LucideIcon;
  /** Sample path drawn inside the 24x24 button (same paper coordinates). */
  sample: string;
  sampleWidth: number;
  linecap: LineCap;
  dasharray?: string;
};

export const BRUSH_SHELF: ShelfBrush[] = [
  {
    id: "pencil",
    label: "Lápis",
    short: "Lápis",
    icon: Pencil,
    sample: "M3 17 Q9 6 21 12",
    sampleWidth: 1.6,
    linecap: "round",
  },
  {
    id: "charcoal",
    label: "Carvão",
    short: "Carvão",
    icon: PencilLine,
    sample: "M3 16 Q10 8 21 13",
    sampleWidth: 3.4,
    linecap: "round",
    dasharray: "5 1.6",
  },
  {
    id: "crayon",
    label: "Giz de cera",
    short: "Giz",
    icon: Pen,
    sample: "M3 16 Q9 7 21 13",
    sampleWidth: 7,
    linecap: "round",
    dasharray: "2.4 1.4",
  },
  {
    id: "marker",
    label: "Marcador",
    short: "Marcador",
    icon: Highlighter,
    sample: "M3 15 L21 12",
    sampleWidth: 9,
    linecap: "square",
  },
  {
    id: "brush",
    label: "Pincel",
    short: "Pincel",
    icon: Paintbrush,
    sample: "M3 16 Q9 6 21 13",
    sampleWidth: 5,
    linecap: "round",
  },
  {
    id: "watercolor",
    label: "Aquarela",
    short: "Aquarela",
    icon: Droplets,
    sample: "M3 15 Q11 6 21 13",
    sampleWidth: 13,
    linecap: "round",
    dasharray: "7 3",
  },
  {
    id: "oil",
    label: "Óleo",
    short: "Óleo",
    icon: Palette,
    sample: "M3 16 Q11 7 21 12",
    sampleWidth: 10,
    linecap: "round",
    dasharray: "10 1.2",
  },
  {
    id: "spray",
    label: "Spray",
    short: "Spray",
    icon: SprayCan,
    sample: "M3 15 Q12 5 21 14",
    sampleWidth: 12,
    linecap: "round",
    dasharray: "0.01 2.6",
  },
  {
    id: "ink",
    label: "Nanquim",
    short: "Nanquim",
    icon: Feather,
    // A continuous thread: no dash, no wash. The quill is the material, the
    // drawn line is the one the hand leaves.
    sample: "M3 17 Q8 7 14 14 T21 12",
    sampleWidth: 2.4,
    linecap: "round",
  },
  {
    id: "eraser",
    label: "Borracha",
    short: "Borracha",
    icon: Eraser,
    sample: "M4 16 L20 12",
    sampleWidth: 6,
    linecap: "round",
    dasharray: "3 2.4",
  },
];

export const isPaintBrush = (kind: BrushKind): kind is PaintBrush => kind !== "eraser";

/** Pixelmator-style collections: the shelf groups the same tools by family. */
export type ToolCollection = { id: string; label: string; tools: BrushKind[] };

export const TOOL_COLLECTIONS: ToolCollection[] = [
  { id: "basico", label: "Básico", tools: ["pencil", "brush", "eraser"] },
  { id: "secos", label: "Secos", tools: ["pencil", "charcoal", "crayon"] },
  { id: "canetas", label: "Canetas", tools: ["marker", "ink"] },
  { id: "pinceis", label: "Pincéis", tools: ["brush"] },
  { id: "tintas", label: "Tintas", tools: ["watercolor", "oil"] },
  { id: "efeitos", label: "Efeitos", tools: ["spray"] },
];

/** Every tool a profile may use, once each (search and favorites read this). */
export const ALL_TOOLS: BrushKind[] = [...new Set(TOOL_COLLECTIONS.flatMap((c) => c.tools))];

/** Anything the canvas can have selected. */
export type CanvasTool = "fill" | BrushKind | "eyedropper";

/** The shelf entry for a tool, when it is one (fill and eyedropper are not). */
export const shelfBrushOf = (id: string): ShelfBrush | undefined =>
  BRUSH_SHELF.find((b) => b.id === id);

/** True when the tool draws a stroke (and therefore names a stored brush). */
export const isShelfTool = (tool: CanvasTool): tool is BrushKind =>
  BRUSH_SHELF.some((b) => b.id === tool);

/**
 * Material de PINTURA — o que põe tinta no papel. Ficam de fora o balde
 * (`fill` pinta a área, não a mão), o conta-gotas (`eyedropper`, que lê a cor)
 * e a borracha, que tira em vez de pôr.
 *
 * O porquê de existir: o pop-up da pílula lista SÓ material (decisão do dono,
 * 27/10) — balde e borracha já são alvos fixos da pílula, e repeti-los ali é a
 * mesma porta duas vezes. A regra sai do TIPO, não de uma lista literal
 * paralela, porque dois catálogos divergem com o tempo.
 */
export const isMaterial = (tool: CanvasTool): tool is PaintBrush =>
  tool !== "eraser" && isShelfTool(tool);

/**
 * The stroke's thickness, as a factor of the authored size (owner's call,
 * 26/10: "espessura conforme entre materiais no mesmo tamanho").
 *
 * The number belongs to the PEN, so it must mean the same thing whatever the
 * material: at 37 every material lands in a 37-band. Before this the factors ran
 * 0.45..2.2 — a pencil painted 17 and a watercolour 81 for the SAME setting, so
 * the value was not a thickness at all, it was a starting point of four
 * different scales.
 *
 * Every factor lives inside `WIDTH_WINDOW` (±10%) of the authored size, and that
 * is not a style choice: the raster engine is held to the SAME window by its own
 * suite (`brushCanvas`, width P95 of the deposited stamps), so the preview here,
 * the vector replay and the paper agree on what the number means. The factor is
 * the material's declared band, never a hidden multiplier — a pencil reads finer
 * through its particle and its edge, not through painting another scale under
 * the number.
 */
const THICKNESS: Record<BrushKind, number> = {
  pencil: 0.92,
  charcoal: 0.97,
  crayon: 1,
  marker: 1.05,
  brush: 1,
  watercolor: 1.08,
  oil: 1.03,
  spray: 0.94,
  ink: 1,
  eraser: 1,
};

/**
 * How far the GRAIN band may sit from the authored size, either way. It is the
 * vector band's tolerance, and it stays wide on purpose: a grain profile is
 * tuned by eye, and its visible band is `core` OR `stamp + scatter` — whichever
 * reaches further. Narrowing this number would turn every grain tune into a
 * test edit (frozen by `strokeTexture`).
 */
export const THICKNESS_TOLERANCE = 0.25;

/**
 * The parity window: the DECLARED band and the width the raster engine deposits
 * must both land inside 1 ± 0.10 of the authored size (`espessura-raster.md`
 * §6.1 — "largura P95 entre 0,90× e 1,10× do tamanho"). One number for the pen,
 * read by the shelf preview and by the paper.
 */
export const WIDTH_WINDOW = 0.1;

/**
 * The width a material paints at one authored size. ONE reader, so the sample
 * in the sheet, the trace under a shelf row and the paper can never disagree.
 * Legacy strokes (no kind) are the plain brush.
 */
export function strokeWidth(kind: BrushKind | undefined, size: number): number {
  const factor = kind ? THICKNESS[kind] : 1;
  return Math.max(1, size * factor);
}

/**
 * Width/dash/opacity for a stored brush kind. Legacy strokes have no kind:
 * they render as the plain round brush, exactly as they were drawn.
 */
export function brushStroke(kind: BrushKind | undefined, size: number): StrokeGeometry {
  const geometry = (
    width: number,
    linecap: LineCap,
    dasharray?: string,
    opacity?: number,
  ): StrokeGeometry => {
    const base: StrokeGeometry = { width: Math.max(1, width), linecap };
    if (dasharray) base.dasharray = dasharray;
    if (opacity !== undefined) base.opacity = opacity;
    return base;
  };
  // The thickness is the pen's; only texture, cap and wash vary below.
  const width = strokeWidth(kind, size);
  switch (kind) {
    case "pencil":
      return geometry(width, "round");
    case "charcoal":
      return geometry(width, "round", "5 1.6", 0.82);
    case "crayon":
      return geometry(width, "round", "2.5 1.8");
    case "marker":
      return geometry(width, "square");
    case "watercolor":
      return geometry(width, "round", "7 3", 0.55);
    case "oil":
      return geometry(width, "round", "10 1.2");
    case "spray":
      return geometry(width, "round", "0.01 7");
    case "ink":
      // The quill lays one continuous thread: solid, round cap, and the width
      // is the authored number itself.
      return geometry(width, "round");
    case "eraser":
      return geometry(width, "round", "4 4");
    case "brush":
    default:
      return geometry(width, "round");
  }
}

export type StrokeEffects = {
  shadow: boolean;
  glow: boolean;
  /** 20..100 — 100 is a solid stroke. */
  opacity: number;
};

export const DEFAULT_EFFECTS: StrokeEffects = { shadow: false, glow: false, opacity: 100 };

/** One `<filter>` id per combination: browsers only take one `filter` per path. */
export function filterIdFor(shadow: boolean, glow: boolean): string | null {
  if (shadow && glow) return "fx-shadow-glow";
  if (shadow) return "fx-shadow";
  if (glow) return "fx-glow";
  return null;
}
