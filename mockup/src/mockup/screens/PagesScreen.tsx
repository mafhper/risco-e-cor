import { useState, type ReactNode } from "react";
import { Flower2, House, PartyPopper, PawPrint, Rocket, type LucideIcon } from "lucide-react";
import { ArtworkSvg } from "../ArtworkSvg";
import { PAGES, THEMES, type ThemeId } from "../pages";
import { uiModeOf } from "../capabilities";
import { emptyHistory } from "../history";
import { profileTheme } from "../profileThemes";
import { uid, useStore, type Screen } from "../store";
import { TopBar } from "../ui";
import { cn } from "@/lib/utils";

const THEME_ICON: Record<ThemeId, LucideIcon> = {
  animais: PawPrint,
  familia: House,
  festas: PartyPopper,
  espaco: Rocket,
  natureza: Flower2,
};

/** Coloring pages live inside one profile; back returns to where it opened. */
export function PagesScreen({ back }: { back: Screen }) {
  const { state, profile, dispatch, go } = useStore();
  const [theme, setTheme] = useState<ThemeId | "todos">("todos");
  if (!profile) return null;
  const profileThemeArt = profileTheme(profile.themeId);
  const kids = uiModeOf(profile) === "kids";

  const pages = theme === "todos" ? PAGES : PAGES.filter((p) => p.theme === theme);
  const latestFor = (pageId: string) =>
    state.artworks
      .filter((a) => a.profileId === profile.id && a.pageId === pageId)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  const open = (pageId: string) => {
    const existing = latestFor(pageId);
    if (existing)
      return go({ name: "canvas", artworkId: existing.id, back: { name: "pages", back } });
    const id = uid();
    dispatch({
      type: "createArtwork",
      artwork: {
        id,
        profileId: profile.id,
        pageId,
        w: 300,
        h: 300,
        history: emptyHistory(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        visibility: "draft",
        publishedAt: null,
      },
    });
    go({ name: "canvas", artworkId: id, back: { name: "pages", back } });
  };

  return (
    <div className="flex h-full flex-col bg-background" data-mode={kids ? "kids" : "pro"}>
      <TopBar
        title="Páginas para colorir"
        subtitle={`${PAGES.length} páginas · ${profileThemeArt.label}`}
        onBack={() => go(back)}
        right={
          <span className="rounded-full bg-md-primary-container px-2 py-1 text-xs font-semibold text-md-on-primary-container">
            {profileThemeArt.emoji}
          </span>
        }
      />

      <div className="flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        <ThemeChip active={theme === "todos"} onClick={() => setTheme("todos")} label="Todos">
          <span className="font-display text-lg">★</span>
        </ThemeChip>
        {THEMES.map((t) => {
          const Icon = THEME_ICON[t.id];
          return (
            <ThemeChip
              key={t.id}
              active={theme === t.id}
              onClick={() => setTheme(t.id)}
              label={t.label}
            >
              <Icon className="h-5 w-5" />
            </ThemeChip>
          );
        })}
      </div>

      <div
        className={cn(
          "themed-scroll grid flex-1 auto-rows-min overflow-y-auto pb-6 pt-2",
          kids ? "grid-cols-2 gap-4 px-4" : "grid-cols-3 gap-2.5 px-4",
        )}
      >
        {pages.map((p) => {
          const art = latestFor(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => open(p.id)}
              aria-label={`Colorir ${p.name}`}
              className={cn(
                "relative overflow-hidden bg-card transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96] active:shadow-press",
                kids ? "rounded-2xl p-2 shadow-tile" : "rounded-xl border border-border p-1.5",
              )}
            >
              <ArtworkSvg
                pageId={p.id}
                w={300}
                h={300}
                commands={art?.history.commands ?? []}
                className={cn("aspect-square w-full", kids ? "rounded-xl" : "rounded-lg")}
              />
              {art && (
                <span
                  className="absolute bottom-3 right-3 h-4 w-4 rounded-full border-2 border-card bg-md-primary"
                  aria-label="Em andamento"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ThemeChip({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors duration-150 ease-out active:scale-[0.96]",
        active
          ? "bg-md-primary text-md-on-primary"
          : "border border-border bg-card text-foreground",
      )}
    >
      {children}
      <span className={active ? "" : "sr-only"}>{label}</span>
    </button>
  );
}
