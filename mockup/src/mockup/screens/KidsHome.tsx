import { FilePlus2, Palette, Plus, Settings2 } from "lucide-react";
import { ArtworkSvg } from "../ArtworkSvg";
import { blankArtwork } from "../artworks";
import { profileTheme, themeSurfaceStyle } from "../profileThemes";
import { useStore } from "../store";
import { useResolvedScheme } from "../theme";
import { Avatar } from "../ui";
import { DemoHint } from "../onboarding";

/**
 * HOME DA CRIANÇA (3–5) — zero texto funcional (sem-texto-3-5 §1 H1–H4).
 *
 * The child sees their own face centred at the top, two doors side by side as
 * big cards, and then their own pieces filling the rest of the page in a
 * two-column vertical feed. No counts, no labels, no horizontal strip: the
 * artwork IS the button, and tapping it opens the EDITOR (a drawing is not a
 * video). The name stays as decoration (the adult's handwriting), never as the
 * only cue for an action.
 *
 * `startViewTransition` gives the portal a container transform where the
 * browser supports it; without it the tap still navigates immediately.
 */
export function KidsHome() {
  const { state, profile, go, dispatch } = useStore();
  const scheme = useResolvedScheme(state.settings.colorScheme);
  if (!profile) return null;

  const theme = profileTheme(profile.themeId, state.themes);
  // Every piece is the child's own: drafts and published ones are both doors
  // back into the editor.
  const pieces = state.artworks
    .filter((a) => a.profileId === profile.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const transform = (run: () => void) => {
    const doc = document as Document & {
      startViewTransition?: (callback: () => void) => unknown;
    };
    if (typeof doc.startViewTransition === "function") doc.startViewTransition(run);
    else run();
  };

  const blank = () => {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
    dispatch({ type: "createArtwork", artwork: blankArtwork(profile.id, id) });
    transform(() => go({ name: "canvas", artworkId: id, back: { name: "profile" } }));
  };

  return (
    <div
      className="paper-grain relative flex h-full flex-col bg-background"
      data-mode="kids"
      data-testid="kids-home"
      style={{ ...themeSurfaceStyle(theme, scheme) }}
    >
      {/* Identity centred at the top; the two chrome targets sit at the edges,
          never squeezing the face and the name into a two-column row. */}
      <header className="relative shrink-0 px-4 pb-1 pt-3">
        <div className="absolute left-4 top-3">
          <button
            type="button"
            aria-label="Voltar"
            onClick={() => go({ name: "home" })}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-foreground shadow-tile transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]"
          >
            <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
              <path
                d="M15 5 L8 12 L15 19"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        <div className="absolute right-4 top-3">
          <button
            type="button"
            aria-label="Ajustes do perfil"
            onClick={() => go({ name: "gate", target: "profile", back: { name: "profile" } })}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-lapis shadow-tile transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]"
          >
            <Settings2 className="h-7 w-7" />
          </button>
        </div>

        <div className="flex flex-col items-center pt-1">
          <span className="rounded-full p-1 ring-2 ring-ambar/70">
            <Avatar profile={profile} size={88} />
          </span>
          <span className="caption-hand mt-1.5 max-w-[12ch] truncate text-3xl leading-none text-foreground">
            {profile.name}
          </span>
        </div>
      </header>

      <div className="themed-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        {/* Two doors, side by side: the primary (coloring book) and the quiet
            one (a new sheet). Not two full-width bars stacked. */}
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="kids-portal-colorir"
            data-container-transform="kids-portal"
            aria-label="Livro de colorir"
            onClick={() => transform(() => go({ name: "pages", back: { name: "profile" } }))}
            className="flex h-[124px] min-h-[120px] items-center justify-center rounded-[28px] bg-md-primary-container text-md-on-primary-container shadow-tile transition-[translate,filter] duration-150 ease-out active:translate-y-0.5 active:scale-[0.96] active:brightness-95 [view-transition-name:portal-colorir]"
          >
            <Palette className="h-16 w-16" strokeWidth={2} />
          </button>

          <button
            type="button"
            data-testid="kids-portal-folha"
            data-container-transform="kids-portal"
            aria-label="Folha em branco"
            onClick={blank}
            className="relative flex h-[124px] min-h-[120px] items-center justify-center rounded-[28px] border border-black/[0.08] bg-white text-foreground shadow-paper transition-[translate,filter] duration-150 ease-out active:translate-y-0.5 active:scale-[0.96] active:brightness-95 [view-transition-name:portal-folha]"
          >
            <FilePlus2 className="h-16 w-16" strokeWidth={2} />
            <DemoHint kind="home" className="bottom-2 right-3" />
          </button>
        </div>

        {/* The child's own productions fill the page: a two-column vertical
            feed, no horizontal clothesline and no "play" badge — the card is
            the door to the editor. */}
        {pieces.length === 0 ? (
          <button
            type="button"
            aria-label="Desenhar"
            onClick={blank}
            data-testid="kids-feed-empty"
            className="mt-4 flex aspect-[3/2] w-full items-center justify-center rounded-[28px] border border-dashed border-border bg-card animate-slow-blink"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-ambar/90 text-[#1c1b1a]">
              <Plus className="h-9 w-9" strokeWidth={2} />
            </span>
          </button>
        ) : (
          <ul role="list" data-testid="kids-feed" className="mt-4 grid grid-cols-2 gap-3">
            {pieces.map((a) => (
              <li key={a.id} className="min-w-0">
                <button
                  type="button"
                  aria-label={`Abrir ${a.pageId ? "página" : "desenho"} no editor`}
                  data-artwork={a.id}
                  onClick={() => go({ name: "canvas", artworkId: a.id, back: { name: "profile" } })}
                  className="flex aspect-square w-full items-center justify-center rounded-[28px] border border-black/[0.08] bg-white p-2 shadow-paper transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]"
                >
                  <ArtworkSvg
                    pageId={a.pageId}
                    w={a.w}
                    h={a.h}
                    commands={a.history.commands}
                    // Concentric: 28 (outer) - 8 (p-2) = 20.
                    className="h-full w-full rounded-[20px]"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
