// The kid card is a PAPER CARD, not a tinted toolbar button (criteria change,
// 25/10 — owner's call after the 3× screenshot; see adr-kids-papel-neutro.md,
// which supersedes F1/F4 of destrave-kids.md §1):
//
//   F1'  the card surface is neutral paper for EVERY material, so a glyph never
//        has to be a dark or white silhouette just to survive its own card;
//   F2'  the material's colour is carried INSIDE the object (`pigment`), the way
//        the Tayasui reference does: coloured body, dark contour, paper details;
//   F3'  the contour is measured against paper (fixed, 15.4:1) — not against a
//        card that changes colour per material;
//   F4'  light kid colours no longer need a deeper step: yellow wax on a dark
//        contour is legible at any hue, and the card stays paper (no more step
//        700 for the marker).
//
// This module holds hexes only. The ratios are measured by the test, never
// estimated here.
import type { BrushKind, CanvasTool, ShelfBrush } from "./brush";

/** Every card the kids row can paint: the §8.7 materials plus the tools. */
export type PlateMaterial = BrushKind | "fill" | "eyedropper";

export type MaterialPlate = {
  /** The card surface: neutral paper, the same for every material (F1'). */
  plate: string;
  /** The contour and detail ink, always dark, measured against paper (F3'). */
  ink: string;
  /** The material's own colour, painted INSIDE the object (F2'). */
  pigment: string;
  /** 2dp inner rim: the border that separates a paper card from the panel (F3). */
  rim: string | null;
};

/** The palette's two inks (galeria §2) plus paper. No new colour is invented. */
export const INK_DEEP = "#1C1410";
export const INK_LIGHT = "#F0ECE0";
export const INK_WHITE = "#FFFFFF";

/** Material bodies inherited from the §2 matrix. */
const PLATE_WOOD = "#D4A574";
const PLATE_CHARCOAL = "#1C1410";
const PLATE_OIL = "#8A5A2B";
const PLATE_SPRAY = "#8A8F98";
/** A tool with no body of its own sits on paper, never on `bg-muted`. */
const PLATE_PAPER = INK_LIGHT;

/** The shared paper plate: every material, and the shelf doors. */
export const paperPlate: MaterialPlate = {
  plate: PLATE_PAPER,
  ink: INK_DEEP,
  pigment: INK_DEEP,
  rim: INK_DEEP,
};

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

const hexOf = (rgb: number[]) =>
  (
    "#" +
    rgb
      .map((c) =>
        Math.round(Math.min(1, Math.max(0, c)) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  ).toUpperCase();

/** Linear interpolation between two sRGB hexes; `t` is the weight of `b`. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = channels(a);
  const cb = channels(b);
  return hexOf(ca.map((v, i) => v + (cb[i]! - v) * t));
}

const relativeLuminance = (hex: string) => {
  const [r, g, b] = channels(hex);
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
};

/** WCAG 2.x contrast ratio — the same formula the @verify used. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Aquarela: the same hue, diluted 50% over paper (§2 "cor diluída"). */
const wash = (color: string) => mixHex(color, "#FFFFFF", 0.5);

/** The plate a tool wears on 3-5: its own material, or paper when it has none. */
export const plateMaterialOf = (tool: CanvasTool, brush?: ShelfBrush): PlateMaterial =>
  brush?.id ?? (tool === "fill" ? "fill" : "eyedropper");

/**
 * The plate and the pigment for one material at one kid colour.
 *
 * One surface for every material — paper. The colour moved into the object, so
 * the card no longer has to be the colour and the object no longer has to be a
 * dark or white silhouette. Materials whose identity IS a neutral body (pencil
 * wood, charcoal, oil, spray) keep their own body colour, which is what the
 * child is looking at; the four kid materials carry the active colour.
 */
export function materialPlate(kind: PlateMaterial, color: string): MaterialPlate {
  /** A paper card with a coloured body inside it, outlined in the same ink. */
  const body = (pigment: string): MaterialPlate => ({
    plate: PLATE_PAPER,
    ink: INK_DEEP,
    pigment,
    rim: INK_DEEP,
  });

  switch (kind) {
    case "crayon":
    case "marker":
    case "brush":
      return body(color);
    case "watercolor":
      return body(wash(color));
    case "pencil":
      return body(PLATE_WOOD);
    case "charcoal":
      return body(PLATE_CHARCOAL);
    case "oil":
      return body(PLATE_OIL);
    case "spray":
      return body(PLATE_SPRAY);
    case "eraser":
    case "fill":
    case "eyedropper":
    default:
      return body(color);
  }
}

/**
 * The inline style a kid card wears: the surface, and the ink as `currentColor`
 * so a line icon (bucket, eyedropper) inherits the same measured ink.
 *
 * The rim is NOT here: it is a child layer (`PlateRim`), because an inline
 * `box-shadow` would silently cancel the selection ring the card needs.
 */
export function plateStyle(plate: MaterialPlate): { background: string; color: string } {
  return { background: plate.plate, color: plate.ink };
}

/** The 2dp rim that separates a light plate — drawn inside, under the glyph. */
export function rimStyle(plate: MaterialPlate): { boxShadow: string } | null {
  return plate.rim ? { boxShadow: `inset 0 0 0 2px ${plate.rim}` } : null;
}

/* ------------------------------------------------------------------ *
 * F6 — the sample stroke varies by MATERIAL FAMILY.                  *
 * The six cards used one shared `d`, so the mark under the object     *
 * said "thick/thin, dashed/solid" and nothing more.                  *
 * ------------------------------------------------------------------ */

export type KidTraceFamily = "straight" | "wave" | "broken";

export type KidTrace = {
  family: KidTraceFamily;
  d: string;
};

/**
 * Three families, six distinct paths (destrave-kids F6):
 *   straight — marker and pencil: the tip decides, the mark is a line;
 *   wave     — brush and watercolour: the hand follows the wet edge;
 *   broken   — wax crayon and charcoal: the dry medium skips on the paper.
 * Width, dash and opacity still come from `brushStroke`, so the sample keeps
 * the real media's weight on top of the geometry.
 */
export const KID_TRACE: Record<BrushKind, KidTrace> = {
  pencil: { family: "straight", d: "M3.4 16.8 L20.6 15.2" },
  marker: { family: "straight", d: "M3.4 17.4 L20.6 14.8" },
  // The zigzag's amplitude has to beat the stroke's own weight, or the round
  // caps merge the corners into a wave and the family stops reading.
  crayon: {
    family: "broken",
    d: "M3.2 19.2 L6.6 14.6 L10.2 19 L13.8 14.4 L17.4 19.2 L20.8 14.8",
  },
  charcoal: {
    family: "broken",
    d: "M3.2 18.6 L6.2 14.8 L9 18.8 L11.8 14.4 L14.6 19 L17.6 14.6 L20.8 18.4",
  },
  brush: { family: "wave", d: "M3.2 17.4 Q7.4 14.4 11.4 16.4 T20.8 15.2" },
  watercolor: { family: "wave", d: "M3.2 16.8 Q8.2 13.4 12.4 16 T20.8 14.2" },
  oil: { family: "wave", d: "M3.2 16.6 Q8 13 12.6 15.6 T20.8 14.4" },
  spray: { family: "broken", d: "M3.2 18.2 L6 14.6 L9 18.4 L12 14.4 L15 18.6 L18 14.8 L20.8 17.8" },
  // Nanquim is the continuous thread (a quill's own line). It stays out of the
  // 3-5 row — `KID_MATERIALS` is the five-target set — but the map is total
  // over `BrushKind`, so the entry exists and reads as what the material is.
  ink: { family: "straight", d: "M3.2 15.6 L20.8 16.2" },
  eraser: { family: "straight", d: "M4 16.6 L20 14.6" },
};
