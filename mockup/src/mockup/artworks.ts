// Selectors over the artwork list: what the family mural shows, what a
// profile's home shows, when leaving the canvas must ask where to save, and
// the chromatic fingerprint a published card wears.
import type { Command, Point } from "./history";
import { emptyHistory } from "./history";
import { inMainGallery, showsOnMural } from "./lifecycle";
import type { Artwork, Profile } from "./store";

export const MURAL_LIMIT = 6;
export const RECENT_LIMIT = 4;
export const PALETTE_SIZE = 5;

/**
 * The sheet a free drawing opens on. Tall like a phone on purpose: the studio
 * paper is full-bleed, so a 3:4 sheet would leave a band above and below it.
 * Coloring pages keep their own square sheet — a page is never cropped.
 */
export const PHONE_SHEET = { w: 300, h: 650 } as const;
const PHONE_ASPECT = PHONE_SHEET.w / PHONE_SHEET.h;

/**
 * The two workspaces the canvas top switches between (owner's decision, 27/10):
 * a blank sheet ("Desenho livre") and a coloring page ("Pintura").
 *
 * The type belongs to the ARTWORK, not to the person and not to the session: a
 * page is paint, a sheet is draw, and the segment in hand is the kind of sheet
 * that is open. There is no third one and there is no stored preference.
 */
export type Workspace = "draw" | "paint";

/** Which workspace an artwork belongs to — read from the artwork itself. */
export const workspaceOf = (a: Pick<Artwork, "pageId">): Workspace =>
  a.pageId === null ? "draw" : "paint";

/** A new empty sheet for one profile: the studio always opens on a draft. */
export function blankArtwork(profileId: string, id: string, now = Date.now()): Artwork {
  return {
    id,
    profileId,
    pageId: null,
    w: PHONE_SHEET.w,
    h: PHONE_SHEET.h,
    history: emptyHistory(),
    createdAt: now,
    updatedAt: now,
    visibility: "draft",
    publishedAt: null,
  };
}

/**
 * Legacy free drawings were authored on a 3:4 sheet, which the full-bleed paper
 * turned into a card with a band above and below. Growing the sheet to the
 * phone aspect — and carrying every stroke by half the growth — keeps the
 * drawing centred while the paper becomes the screen. Nothing is scaled, so a
 * stroke keeps its physical size; nothing is cropped, so nothing is lost.
 *
 * Coloring pages are never grown: their sheet is the page, and enlarging it
 * would move the line art under the colors.
 */
export function growSheetToPhone(a: Artwork): Artwork {
  if (a.pageId !== null) return a;
  if (a.w / a.h <= PHONE_ASPECT + 0.001) return a;
  const w = Math.max(a.w, PHONE_SHEET.w);
  const h = Math.max(a.h, PHONE_SHEET.h);
  if (w === a.w && h === a.h) return a;
  const dx = (w - a.w) / 2;
  const dy = (h - a.h) / 2;
  const shift = (commands: Command[]): Command[] =>
    commands.map((c) =>
      c.t === "stroke" ? { ...c, points: c.points.map(([x, y]) => [x + dx, y + dy] as Point) } : c,
    );
  return {
    ...a,
    w,
    h,
    history: {
      ...a.history,
      commands: shift(a.history.commands),
      redo: shift(a.history.redo),
    },
  };
}

/** The family mural: published pieces only, newest publish first. */
export function muralArtworks(artworks: Artwork[], limit = MURAL_LIMIT): Artwork[] {
  return allMuralArtworks(artworks).slice(0, limit);
}

/**
 * The whole mural, for the inline "ver N" expansion (no new route).
 *
 * A piece whose author is archived leaves the mural (crud-perfis-global I4):
 * archiving is "guardar longe da vista", and the mural is the family showcase.
 * Pass the profiles to apply that rule; without them only visibility counts.
 */
export function allMuralArtworks(artworks: Artwork[], profiles?: Profile[]): Artwork[] {
  const hiddenAuthors = new Set((profiles ?? []).filter((p) => p.archived).map((p) => p.id));
  return artworks
    .filter((a) => showsOnMural(a) && !hiddenAuthors.has(a.profileId))
    .sort((a, b) => (b.publishedAt ?? b.updatedAt) - (a.publishedAt ?? a.updatedAt));
}

/** The author's main grid: drafts and published pieces, newest edit first. */
export function galleryArtworks(artworks: Artwork[], profileId: string): Artwork[] {
  return artworks
    .filter((a) => a.profileId === profileId && inMainGallery(a))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** "Guardados": archived pieces live in a collapsed section, not the grid. */
export function keptArtworks(artworks: Artwork[], profileId: string): Artwork[] {
  return artworks
    .filter((a) => a.profileId === profileId && a.visibility === "archived")
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** A profile's latest pieces, for the home screen strip. */
export function recentArtworks(
  artworks: Artwork[],
  profileId: string,
  limit = RECENT_LIMIT,
): Artwork[] {
  return artworks
    .filter((a) => a.profileId === profileId && a.visibility !== "archived")
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

/**
 * The save dialog appears only when something new was drawn since the canvas
 * opened — reopening a piece and leaving it untouched never interrupts.
 */
export function needsSaveDecision(commandsAtOpen: number, currentCommands: number): boolean {
  return currentCommands > 0 && currentCommands !== commandsAtOpen;
}

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * Top colors of a piece, most used first (m3-temas-cor.md §8.2). White is the
 * paper, not a color; unknown/transparent values are ignored. A piece with
 * fewer than 5 colors repeats them so the card bar never looks broken.
 */
export function artworkPalette(commands: Command[], limit = PALETTE_SIZE): string[] {
  const counts = new Map<string, number>();
  const add = (hex: string | undefined) => {
    if (!hex || !HEX.test(hex)) return;
    const up = hex.toUpperCase();
    if (up === "#FFFFFF") return;
    counts.set(up, (counts.get(up) ?? 0) + 1);
  };

  for (const c of commands) {
    if (c.t === "fill") {
      // The desk fill is canvas customization, never artwork: the thumbnail and
      // the exported PNG do not carry it, so the card's color bar must not.
      if (c.region === "desk") continue;
      add(c.color);
      continue;
    }
    if (c.t !== "stroke") continue;
    add(c.color);
    if (c.gradient) {
      add(c.gradient.stop1);
      add(c.gradient.stop2);
    }
  }

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([hex]) => hex)
    .slice(0, limit);
  if (ranked.length === 0) return [];

  const out = [...ranked];
  for (let i = ranked.length; i < limit; i += 1) out.push(ranked[i % ranked.length]!);
  return out;
}

/** Author chip tint: a whisper of the piece's dominant color. */
export function authorTint(dominant: string | undefined): string | undefined {
  if (!dominant || !HEX.test(dominant)) return undefined;
  return `color-mix(in oklab, ${dominant} 16%, var(--card))`;
}

/**
 * The wall rotation of a piece, deterministic from its id: the same piece is
 * always pinned at the same angle (-2°..2°), and a re-render never shuffles
 * the wall. Injected as a transform so reduced motion can drop it.
 */
export function pieceRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  const step = Math.abs(hash) % 41; // 0..40
  return (step - 20) / 10; // -2.0 .. 2.0
}

/** Gallery label: "hoje", "ontem", "há 3 dias" — never a raw timestamp. */
export function dayLabel(at: number, now = Date.now()): string {
  const days = Math.floor((now - at) / 86_400_000);
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  if (days < 30) return `há ${Math.floor(days / 7)} sem`;
  return `há ${Math.floor(days / 30)} meses`;
}

export type FocusBox = { x: number; y: number; size: number };

/**
 * The card shows the piece, not the whole sheet (card-gradiente-obra §1): a
 * square window around the marks, with 10% of breathing room on every side so
 * the crop never cuts a peripheral stroke. When the marks already span most of
 * the sheet there is no honest crop — a square window would have to leave the
 * paper — so the window becomes the sheet itself, centred.
 *
 * Only strokes carry coordinates; a coloring page filled by taps has none, and
 * falls into the same centred window.
 */
export function focusBox(commands: Command[], w: number, h: number): FocusBox {
  const side = Math.min(w, h);
  const centred: FocusBox = { x: (w - side) / 2, y: (h - side) / 2, size: side };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const c of commands) {
    if (c.t !== "stroke") continue;
    for (const [x, y] of c.points) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return centred;

  const span = Math.max(maxX - minX, maxY - minY);
  if (span > side * 0.8) return centred;

  const size = Math.min(side, Math.max(span * 1.2, side * 0.25));
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    x: Math.min(Math.max(cx - size / 2, 0), w - size),
    y: Math.min(Math.max(cy - size / 2, 0), h - size),
    size,
  };
}
