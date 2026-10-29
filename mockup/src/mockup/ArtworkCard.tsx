// Cards are where the artwork itself is the style: a piece carries its own
// shape, its own chromatic fingerprint (m3-temas-cor.md §8) and a hand-written
// label underneath, as if it were pinned to a wall. Drafts keep the quiet
// card: no palette, no author — only the author sees them.
import { Star } from "lucide-react";
import { ArtworkPaint } from "./ArtworkPaint";
import { artworkPalette, authorTint, dayLabel, focusBox, pieceRotation } from "./artworks";
import { pageById } from "./pages";
import { profileTheme } from "./profileThemes";
import { useStore, type Artwork, type Profile } from "./store";
import { cn } from "@/lib/utils";

const labelOf = (pageId: string | null) => pageById(pageId)?.name ?? "Desenho livre";

export function PaletteBar({
  colors,
  height = 12,
}: {
  colors: string[];
  /** 16dp kids / 10dp pro (spec §8.3). */
  height?: number;
}) {
  if (colors.length === 0) return null;
  return (
    <span
      aria-hidden
      data-testid="palette-bar"
      className="flex w-full overflow-hidden rounded-full"
      style={{ height, background: "var(--muted)" }}
    >
      {colors.map((hex, i) => (
        <span key={`${hex}-${i}`} className="h-full flex-1" style={{ background: hex }} />
      ))}
    </span>
  );
}

export function AuthorChip({
  name,
  dominant,
  kids,
}: {
  name: string;
  dominant?: string | undefined;
  kids: boolean;
}) {
  return (
    <span
      data-testid="author-chip"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 font-semibold text-foreground",
        kids ? "text-xs" : "text-[10px]",
      )}
      style={{ background: authorTint(dominant) ?? "var(--muted)" }}
    >
      <Star className={cn("shrink-0 fill-current text-sun", kids ? "h-3 w-3" : "h-2.5 w-2.5")} />
      <span className="truncate">por {name}</span>
    </span>
  );
}

/**
 * A published piece — in the mural or a profile's grid. The frame belongs to
 * the piece (author theme), never to the screen, and the angle is derived from
 * the id so the same piece is always pinned the same way.
 *
 * ONE square art cell for every piece (owner's call, 27/10): a free drawing
 * takes the box of a painted page, so two cards in the same column share a
 * height and the wall reads as a wall. The sheet never stretches to fill the
 * box: a phone-tall drawing is contained whole inside it, and the empty bands
 * are the card's own surface, not a new colour.
 */
export function PublishedCard({
  artwork,
  author,
  kids,
  onOpen,
  fill = false,
  rotate = false,
  showAuthor = true,
  className,
}: {
  artwork: Artwork;
  author: Profile | null;
  kids: boolean;
  onOpen: () => void;
  /** Grid variant: the miniature takes the cell width. */
  fill?: boolean;
  /** Mural variant: pinned on the wall with its own angle. */
  rotate?: boolean;
  showAuthor?: boolean;
  className?: string;
}) {
  const { state } = useStore();
  const Frame = author ? profileTheme(author.themeId, state.themes).frame : null;
  const colors = artworkPalette(artwork.history.commands);
  /**
   * The card frames the piece, not the sheet (card-gradiente-obra §1) — but a
   * square window is only honest over a square sheet. Over a 300 × 650 sheet it
   * is exactly the cut that made a drawing lose its top and bottom, so the tall
   * sheet is shown whole (contain) and the square page keeps its focus crop.
   */
  const squareSheet = artwork.w === artwork.h;
  const focus = squareSheet ? focusBox(artwork.history.commands, artwork.w, artwork.h) : null;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1",
        fill ? "w-full" : kids ? "w-28" : "w-[84px]",
        className,
      )}
      data-artwork={artwork.id}
      data-mural-piece={rotate ? "" : undefined}
      style={
        rotate
          ? { transform: `rotate(${pieceRotation(artwork.id)}deg)`, transformOrigin: "50% 60%" }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver desenho de ${author?.name ?? "alguém"}`}
        style={{ background: authorTint(colors[0]) }}
        className={cn(
          "relative block w-full overflow-hidden bg-card transition-[translate,filter] duration-150 ease-out hover:brightness-[1.02] active:translate-y-0.5 active:scale-[0.96]",
          "shadow-tile",
          fill
            ? "aspect-square rounded-md p-1.5"
            : kids
              ? "h-28 rounded-md p-1.5"
              : "h-[84px] rounded-md p-1",
        )}
      >
        <span className="flex h-full w-full items-center justify-center overflow-hidden">
          {/* 80% of the card, centred, lifted 5% — the crop is a framed piece,
              not a full-bleed sheet (card-gradiente-obra §1). The sheet keeps
              its own ratio inside this square: `contain`, never a stretch. */}
          <span
            className="block overflow-hidden rounded-[8px]"
            style={{
              width: "80%",
              aspectRatio: "1",
              maxHeight: "100%",
              transform: "translateY(-5%)",
            }}
          >
            <ArtworkPaint
              pageId={artwork.pageId}
              w={artwork.w}
              h={artwork.h}
              commands={artwork.history.commands}
              focus={focus}
              // A thumbnail is a few dozen pixels wide: 1× is already sharp,
              // and 2× would cost four times the memory for nothing.
              scale={1}
              className="h-full w-full"
            />
          </span>
        </span>
        {Frame && <Frame className="pointer-events-none absolute inset-0 h-full w-full" />}
      </button>
      <PaletteBar colors={colors} height={kids ? 14 : 8} />
      {showAuthor && (
        <span className="caption-hand truncate px-0.5 text-[11px] leading-tight text-lapis">
          {author?.name ?? "?"}
          <span className="not-italic text-[10px] opacity-70">
            {" "}
            · {dayLabel(artwork.publishedAt ?? artwork.updatedAt)}
          </span>
        </span>
      )}
    </div>
  );
}

/** A draft of the active profile: filled card, no palette, no author. */
export function DraftCard({
  artwork,
  kids,
  published = false,
  onOpen,
  className,
}: {
  artwork: Artwork;
  kids: boolean;
  /** Kids exception: a published piece shown as "their last ones". */
  published?: boolean;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={(kids ? "Continuar " : "Abrir ") + labelOf(artwork.pageId)}
      style={{
        background: "color-mix(in oklab, var(--md-primary-container) 26%, var(--card))",
      }}
      className={cn(
        "relative overflow-hidden text-left transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]",
        kids ? "rounded-md p-2 shadow-tile" : "rounded-md border border-border p-1.5",
        className,
      )}
    >
      <ArtworkPaint
        pageId={artwork.pageId}
        w={artwork.w}
        h={artwork.h}
        commands={artwork.history.commands}
        scale={1}
        // A div has no intrinsic ratio: the SVG used to size itself from the
        // viewBox, so the box takes the sheet's ratio explicitly.
        style={{ aspectRatio: `${artwork.w} / ${artwork.h}` }}
        className="h-auto w-full rounded-sm"
      />
      {published && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-sun text-foreground shadow-press",
            kids ? "left-3 top-3 h-7 w-7" : "left-2 top-2 h-5 w-5",
          )}
          aria-label="No mural"
        >
          <Star className={cn("fill-current", kids ? "h-4 w-4" : "h-3 w-3")} />
        </span>
      )}
      <span
        className={cn(
          "mt-1 block truncate text-muted-foreground",
          kids ? "text-sm font-semibold" : "text-[10px] font-semibold",
        )}
      >
        {kids ? "Continuar" : labelOf(artwork.pageId)}
      </span>
    </button>
  );
}
