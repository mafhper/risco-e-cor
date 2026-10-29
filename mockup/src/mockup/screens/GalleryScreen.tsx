import { useState, type MouseEvent } from "react";
import {
  Brush,
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Download,
  Layers,
  PaintBucket,
  Pencil,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ArtworkPaint } from "../ArtworkPaint";
import { PaletteBar } from "../ArtworkCard";
import { artworkPalette, dayLabel, galleryArtworks, keptArtworks } from "../artworks";
import { uiModeOf } from "../capabilities";
import { exportArtwork, exportPng } from "../exportPng";
import { DISCARD_LABEL, VISIBILITY_LABEL, canChildDiscard } from "../lifecycle";
import { pageById } from "../pages";
import { PAPERS } from "../palette";
import { profileTheme } from "../profileThemes";
import { stashOpenRect } from "../sharedOpen";
import { useLowPowerDevice, useStore, type Artwork, type Screen } from "../store";
import { Avatar, TopBar } from "../ui";
import { cn } from "@/lib/utils";

/** How the author's own collection is grouped. Persisted per profile. */
export type GroupMode = "criacao" | "tipo" | "mes";

export const groupKey = (profileId: string) => `galeria.agrupamento.${profileId}`;

export function readGroupMode(profileId: string): GroupMode {
  try {
    const stored = localStorage.getItem(groupKey(profileId));
    return stored === "tipo" || stored === "mes" ? stored : "criacao";
  } catch {
    // Private mode / corrupted prefs: the collection still opens, in creation order.
    return "criacao";
  }
}

export function writeGroupMode(profileId: string, mode: GroupMode) {
  try {
    localStorage.setItem(groupKey(profileId), mode);
  } catch {
    /* the choice is a convenience, never a blocker */
  }
}

type Section = {
  key: string;
  label: string;
  icon: "layers" | "bucket" | "pencil" | "calendar";
  items: Artwork[];
};

const dayStart = (ts: number) => {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

/** Type = what the piece IS, never its name: a page has line-art underneath. */
export function groupByType(items: Artwork[]): Section[] {
  return [
    {
      key: "pintura",
      label: "Pintura preenchida",
      icon: "bucket",
      items: items.filter((a) => a.pageId),
    },
    { key: "livre", label: "Desenho livre", icon: "pencil", items: items.filter((a) => !a.pageId) },
  ];
}

/** Date = when it changed last, in the device's own timezone. */
export function groupByDate(items: Artwork[], now = Date.now()): Section[] {
  const today = dayStart(now);
  const week = today - 6 * 86_400_000;
  const monthStart = new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1).getTime();
  const buckets: Section[] = [
    { key: "hoje", label: "Hoje", icon: "calendar", items: [] },
    { key: "semana", label: "Esta semana", icon: "calendar", items: [] },
    { key: "mes", label: "Este mês", icon: "calendar", items: [] },
  ];
  const older = new Map<string, Section>();
  for (const a of items) {
    const at = a.updatedAt;
    if (at >= today) buckets[0]!.items.push(a);
    else if (at >= week) buckets[1]!.items.push(a);
    else if (at >= monthStart) buckets[2]!.items.push(a);
    else {
      const d = new Date(at);
      const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      const section = older.get(key) ?? {
        key,
        label: label.charAt(0).toUpperCase() + label.slice(1),
        icon: "calendar" as const,
        items: [],
      };
      section.items.push(a);
      older.set(key, section);
    }
  }
  return [
    ...buckets,
    ...[...older.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([, s]) => s),
  ];
}

/** Card border = the colours the piece actually uses, never a separate strip. */
export function artworkGradient(colors: string[]): string {
  if (colors.length === 0) return "transparent";
  if (colors.length === 1) return colors[0]!;
  return `linear-gradient(135deg, ${colors.join(", ")})`;
}

const MODES = [
  { id: "criacao" as const, label: "Ver em ordem de criação", Icon: Layers },
  { id: "tipo" as const, label: "Agrupar por tipo de desenho", Icon: PaintBucket },
  { id: "mes" as const, label: "Agrupar por mês", Icon: CalendarDays },
];

function SectionIcon({ icon, className }: { icon: Section["icon"]; className?: string }) {
  const Icon =
    icon === "bucket"
      ? PaintBucket
      : icon === "pencil"
        ? Pencil
        : icon === "calendar"
          ? CalendarDays
          : Layers;
  return <Icon aria-hidden className={className} />;
}

/**
 * The author's own collection: drafts and published pieces, plus a collapsed
 * "Guardados" section. The header counts them apart — a kept piece is not
 * gone, it is out of the way.
 */
export function GalleryScreen({ back }: { back: Screen }) {
  const { state, profile, go } = useStore();
  const [keptOpen, setKeptOpen] = useState(false);
  const [mode, setMode] = useState<GroupMode>(() =>
    profile ? readGroupMode(profile.id) : "criacao",
  );
  if (!profile) return null;
  const mine = galleryArtworks(state.artworks, profile.id);
  const kept = keptArtworks(state.artworks, profile.id);
  const kids = uiModeOf(profile) === "kids";
  const theme = profileTheme(profile.themeId, state.themes);
  const Frame = kids ? theme.frame : null;
  const sections: Section[] =
    mode === "criacao"
      ? [{ key: "todas", label: "Desenhos", icon: "layers", items: mine }]
      : mode === "tipo"
        ? groupByType(mine)
        : groupByDate(mine);
  const choose = (next: GroupMode) => {
    setMode(next);
    writeGroupMode(profile.id, next);
  };

  /**
   * P1: a card opens the studio directly — the card grows into the sheet
   * (shared element). The view screen stays for the wall/read-only paths and
   * for "Guardados" (an archived piece is not an editing target).
   */
  const open = (a: Artwork, e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    stashOpenRect({ x: rect.x, y: rect.y, w: rect.width, h: rect.height });
    go({ name: "canvas", artworkId: a.id, back: { name: "gallery", back } });
  };

  const peek = (a: Artwork) =>
    go({ name: "view", artworkId: a.id, back: { name: "gallery", back } });

  return (
    <div
      className="paper-grain flex h-full flex-col bg-background"
      data-testid="gallery"
      data-mode={kids ? "kids" : "pro"}
    >
      <TopBar
        title="Meus desenhos"
        subtitle={`${mine.length} ${mine.length === 1 ? "peça" : "peças"}${
          kept.length > 0 ? ` + ${kept.length} guardada${kept.length === 1 ? "" : "s"}` : ""
        }`}
        onBack={() => go(back)}
      />

      {/* The grouping switcher gets its own line: three 48dp segments beside a
          long title do not fit 390dp, and a cut control is a broken control. */}
      <div className="flex items-center justify-end px-3">
        <div role="group" aria-label="Agrupar desenhos" className="flex items-center gap-1">
          {MODES.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={mode === id}
              onClick={() => choose(id)}
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full transition-colors duration-150 ease-out",
                mode === id ? "bg-foreground text-background" : "text-lapis active:text-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
            </button>
          ))}
        </div>
      </div>

      {mine.length === 0 && kept.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <span className="flex h-20 w-20 items-center justify-center rounded-full border border-border bg-card text-lapis">
            <Brush className="h-9 w-9" />
          </span>
          <p className={cn("text-lapis", kids ? "type-title-lg font-display" : "type-body-md")}>
            Ainda não tem desenhos aqui
          </p>
        </div>
      ) : (
        <div className={cn("themed-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2")}>
          {sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <section key={section.key} className="mb-4" aria-label={section.label}>
                {mode !== "criacao" && (
                  <h2 className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-lapis">
                    <SectionIcon icon={section.icon} className="h-3.5 w-3.5" />
                    {!kids && <span>{section.label}</span>}
                    <span className="font-mono">· {section.items.length}</span>
                  </h2>
                )}
                <div
                  className={cn(
                    "grid auto-rows-min",
                    kids ? "grid-cols-2 gap-4" : "grid-cols-3 gap-2.5",
                  )}
                  role="list"
                  aria-label={section.label}
                >
                  {section.items.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      role="listitem"
                      onClick={(e) => open(a, e)}
                      aria-label={`Abrir ${pageById(a.pageId)?.name ?? "desenho livre"}`}
                      className={cn(
                        "relative flex flex-col gap-1 overflow-hidden bg-card text-left transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]",
                        kids
                          ? "rounded-md p-2 shadow-tile"
                          : "rounded-md border border-border p-1.5",
                      )}
                    >
                      <span
                        className={cn(
                          // ONE height for every piece (owner's call, 26/10): the
                          // cell is square, the same box a colouring page fills,
                          // and a phone-tall free drawing is fitted inside it
                          // instead of stretching the row. A grid whose rows grow
                          // with the sheet's own ratio mixes two card heights in
                          // the same line and reads as a broken column.
                          "relative block aspect-square w-full overflow-hidden",
                          kids ? "rounded-[12px] p-[3px]" : "rounded-[10px] p-[2px]",
                        )}
                        style={{ background: artworkGradient(artworkPalette(a.history.commands)) }}
                        data-testid="artwork-card-border"
                      >
                        <ArtworkPaint
                          pageId={a.pageId}
                          w={a.w}
                          h={a.h}
                          commands={a.history.commands}
                          // The card is a thumbnail: the whole sheet at 1x, the
                          // same engine (and the same crop decision) as the
                          // mural card. The box is the cell's, so the three
                          // painters letterbox the sheet inside it.
                          scale={1}
                          className="h-full w-full rounded-[8px] bg-white"
                        />
                        {Frame && (
                          <Frame className="pointer-events-none absolute inset-0 h-full w-full" />
                        )}
                        {a.visibility === "published" && (
                          <span
                            className={cn(
                              "absolute flex items-center justify-center rounded-full bg-sun text-foreground shadow-press",
                              kids ? "left-2 top-2 h-8 w-8" : "left-2 top-2 h-5 w-5",
                            )}
                            aria-label="No mural"
                          >
                            <Star className={cn("fill-current", kids ? "h-4 w-4" : "h-3 w-3")} />
                          </span>
                        )}
                      </span>
                      <span className="font-mono text-[9px] text-lapis">
                        {dayLabel(a.updatedAt)}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))}

          {kept.length > 0 && (
            <section className="mt-5" aria-label="Guardados">
              <button
                type="button"
                onClick={() => setKeptOpen((o) => !o)}
                aria-expanded={keptOpen}
                className="flex w-full items-center gap-2 border-t border-border pt-3 text-left"
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-lapis">
                  guardados ({kept.length})
                </span>
                <ChevronDown
                  className={cn(
                    "ml-auto h-4 w-4 text-lapis transition-transform duration-150 ease-out",
                    keptOpen && "rotate-180",
                  )}
                />
              </button>
              {keptOpen && (
                <div className="mt-2 grid grid-cols-3 gap-2.5">
                  {kept.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => peek(a)}
                      aria-label={`Abrir guardado ${pageById(a.pageId)?.name ?? "desenho livre"}`}
                      className="flex flex-col gap-1 rounded-md border border-dashed border-border bg-card p-1.5 text-left"
                    >
                      <span className="relative block aspect-square w-full overflow-hidden rounded-md bg-white">
                        <ArtworkPaint
                          pageId={a.pageId}
                          w={a.w}
                          h={a.h}
                          commands={a.history.commands}
                          scale={1}
                          className="h-full w-full rounded-sm opacity-80"
                        />
                      </span>
                      <span className="font-mono text-[9px] text-lapis">guardado</span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * View: owner mode offers Continue / photo / copy / discard; read-only (mural)
 * offers only Back and the author. Back returns to the screen that opened it —
 * never to another profile.
 *
 * The destructive verb here is "Jogar fora", and only a draft of the owner can
 * use it: a piece hanging on the mural is the adult's call. Discarding never
 * asks with a modal — it sends the piece to the trash and leaves a 5s "Desfazer"
 * in the app shell.
 */
export function ViewScreen({
  artworkId,
  readonly,
  back,
}: {
  artworkId: string;
  readonly: boolean;
  back: Screen;
}) {
  const { state, dispatch, go } = useStore();
  /** The device tier the piece is painted with, screen and file alike (§7.7.6). */
  const lowPower = useLowPowerDevice();
  const art = state.artworks.find((a) => a.id === artworkId);
  const author = state.profiles.find((p) => p.id === art?.profileId) ?? null;
  const [saved, setSaved] = useState(false);
  if (!art) return null;
  const kids = author ? uiModeOf(author) === "kids" : false;
  const palette = artworkPalette(art.history.commands);
  const isOwner = !readonly && state.profileId === art.profileId;
  const mayDiscard = isOwner && canChildDiscard(art, state.profileId);

  const save = async () => {
    // The file is described from the piece, never cloned from the SVG on the
    // screen: this button used to depend on a ref that only existed while the
    // preview was mounted (export-png.md §2, §7).
    await exportPng(
      exportArtwork(
        art.history.commands,
        art.pageId,
        art.w,
        art.h,
        PAPERS[state.settings.paper],
        lowPower,
      ),
      `desenho-${new Date(art.updatedAt).toISOString().slice(0, 10)}.png`,
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const duplicate = () => {
    dispatch({ type: "duplicateArtwork", id: art.id });
    toast.success("Cópia guardada nos rascunhos");
  };

  const discard = () => {
    dispatch({ type: "trash", id: art.id });
    go(back);
  };

  return (
    <div className="flex h-full flex-col bg-muted" data-mode={kids ? "kids" : "pro"}>
      <TopBar
        title={
          kids && author ? (
            <Avatar profile={author} size={40} />
          ) : readonly && author ? (
            `por ${author.name}`
          ) : (
            (pageById(art.pageId)?.name ?? "Desenho")
          )
        }
        subtitle={!kids && readonly ? dayLabel(art.updatedAt) : undefined}
        onBack={() => go(back)}
        right={
          kids ? (
            art.visibility === "published" ? (
              <Star className="h-6 w-6 fill-sun text-sun" aria-label="No mural" />
            ) : undefined
          ) : readonly && author ? (
            <Avatar profile={author} size={36} />
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-wide text-lapis">
              {VISIBILITY_LABEL[art.visibility]}
            </span>
          )
        }
      />

      <div className="flex min-h-0 flex-1 items-center justify-center p-5">
        <ArtworkPaint
          pageId={art.pageId}
          w={art.w}
          h={art.h}
          commands={art.history.commands}
          // Read at arm's length, like the studio paper: the same 2x it paints
          // at, so a stroke is the same drawing at the same weight.
          scale={2}
          className="h-auto max-h-full w-full shadow-tile"
          style={{ aspectRatio: `${art.w} / ${art.h}` }}
        />
      </div>

      <div className="space-y-3 px-5 pb-7">
        {!kids && (
          <p className="text-center text-[11px] text-lapis">
            {author?.name ?? "?"} · {dayLabel(art.updatedAt)} ·{" "}
            {art.visibility === "published"
              ? "no mural da família"
              : VISIBILITY_LABEL[art.visibility]}
          </p>
        )}
        {palette.length > 0 && <PaletteBar colors={palette} height={10} />}
        {isOwner && (
          <>
            <div className={cn("grid gap-2", kids ? "grid-cols-2" : "grid-cols-2")}>
              <button
                type="button"
                onClick={() =>
                  go({
                    name: "canvas",
                    artworkId: art.id,
                    back: { name: "view", artworkId: art.id, back },
                  })
                }
                aria-label="Continuar desenho"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md bg-ambar font-display text-[#1c1b1a] transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]",
                  kids ? "h-16" : "h-12 text-sm",
                )}
              >
                <Pencil className={kids ? "h-8 w-8" : "h-4 w-4"} />
                {!kids && "Continuar desenho"}
              </button>
              <button
                type="button"
                onClick={save}
                aria-label="Guardar foto (PNG)"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-md border border-border bg-card font-display text-foreground transition-colors duration-150 ease-out active:scale-[0.96]",
                  kids ? "h-16" : "h-12 text-sm",
                )}
              >
                {saved ? (
                  <Check className={kids ? "h-8 w-8" : "h-5 w-5"} />
                ) : (
                  <Download className={kids ? "h-8 w-8" : "h-5 w-5"} />
                )}
                {!kids && (saved ? "Guardada!" : "Guardar foto")}
              </button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={duplicate}
                aria-label="Fazer uma cópia"
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-2 font-semibold text-lapis underline decoration-border underline-offset-4",
                  kids ? "h-14 w-14 justify-center" : "h-9 text-[11px]",
                )}
              >
                <Copy className={kids ? "h-6 w-6" : "h-3.5 w-3.5"} /> {!kids && "Fazer uma cópia"}
              </button>
              {mayDiscard ? (
                <button
                  type="button"
                  onClick={discard}
                  aria-label={DISCARD_LABEL}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full bg-destructive font-semibold text-destructive-foreground transition-transform duration-150 ease-out active:scale-[0.96]",
                    kids ? "h-14 w-14 justify-center" : "h-9 px-3 text-[11px]",
                  )}
                >
                  <Trash2 className={kids ? "h-6 w-6" : "h-3.5 w-3.5"} /> {!kids && DISCARD_LABEL}
                </button>
              ) : art.visibility === "published" ? (
                !kids && (
                  <span className="text-[10px] text-lapis">
                    Peça do mural — só o adulto tira daqui.
                  </span>
                )
              ) : art.visibility === "archived" ? (
                !kids && (
                  <span className="text-[10px] text-lapis">Guardada — só o adulto desarquiva.</span>
                )
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
