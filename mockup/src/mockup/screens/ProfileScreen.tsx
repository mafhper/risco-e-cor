import { useState } from "react";
import { ArrowRight, ChevronDown, Images, Plus, UserRoundCog } from "lucide-react";
import { ArtworkPaint } from "../ArtworkPaint";
import { ArtworkSvg } from "../ArtworkSvg";
import { blankArtwork } from "../artworks";
import { uiModeOf } from "../capabilities";
import { PAGES } from "../pages";
import { personaOf } from "../persona";
import { profileTheme, themeStyle } from "../profileThemes";
import { STROKE } from "../motion";
import { Sheet } from "../overlay";
import { uid, useStore } from "../store";
import { useResolvedScheme } from "../theme";
import { Avatar, TopBar } from "../ui";
import { KidsHome } from "./KidsHome";
import { cn } from "@/lib/utils";

/**
 * HOME DO PERFIL — a pessoa, não o app.
 *
 * Identity first and CENTRED, like a social card: the face at the top, the name
 * under it, the person's own vocabulary below, and the creations filling every
 * pixel under the actions in a two-column vertical feed. No theme picker: a
 * theme is a preference of the device, so it lives in the settings, never on
 * someone's profile. The actions are one primary and one quiet secondary at
 * their natural width — never two full-width bars stacked.
 */
export function ProfileScreen() {
  const { state, profile, dispatch, go } = useStore();
  const scheme = useResolvedScheme(state.settings.colorScheme);
  const [creating, setCreating] = useState(false);
  const [repertoireOpen, setRepertoireOpen] = useState(false);
  if (!profile) return null;

  const kids = uiModeOf(profile) === "kids";
  const theme = profileTheme(profile.themeId, state.themes);
  const persona = personaOf(profile);
  const activity = profile.favoriteActivity === "colorir" ? "Colorir" : "Desenho livre";

  // The feed is the author's own work: drafts and published pieces together,
  // newest first. Tapping a card opens the EDITOR — a piece is never a video.
  const mine = state.artworks
    .filter((a) => a.profileId === profile.id)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const createBlank = () => {
    const id = uid();
    dispatch({ type: "createArtwork", artwork: blankArtwork(profile.id, id) });
    setCreating(false);
    go({ name: "canvas", artworkId: id, back: { name: "profile" } });
  };

  // The 3-5 home is a DIFFERENT screen, not this one with bigger buttons.
  // Zero functional text is a rule, and a rule spread across conditionals is a
  // rule that leaks: the kids skin gets its own component.
  if (kids) {
    return (
      <div data-testid="profile" data-mode="kids" className="h-full">
        <KidsHome />
      </div>
    );
  }

  return (
    <div
      className={cn("paper-grain relative flex h-full flex-col bg-background")}
      data-mode="pro"
      data-testid="profile"
      style={themeStyle(theme, scheme)}
    >
      <TopBar
        title={<span className="font-display">{profile.name}</span>}
        onBack={() => go({ name: "home" })}
        right={
          <button
            type="button"
            aria-label="Editar este perfil"
            title="Editar este perfil"
            onClick={() => go({ name: "gate", target: "profile", back: { name: "profile" } })}
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-card px-3 text-xs font-semibold text-foreground shadow-press"
          >
            <UserRoundCog className="h-4 w-4" />
            <span className="text-[11px]">Perfil</span>
          </button>
        }
      />

      <div className="themed-scroll min-h-0 flex-1 overflow-y-auto px-4 pb-8">
        {/* Identidade: one centred column, nothing squeezed beside a portrait. */}
        <section
          aria-label={`Persona de ${profile.name}`}
          data-testid="profile-hero"
          className="flex flex-col items-center pt-2 text-center"
        >
          <span className="rounded-full p-1.5 ring-2 ring-ambar/60">
            <Avatar profile={profile} size={96} />
          </span>
          <h1 className="caption-hand mt-2 text-3xl leading-none text-foreground">
            {profile.name}
          </h1>
          <p className="type-label-sm mt-1 font-mono uppercase tracking-wide text-lapis">
            {activity}
          </p>
          {/* One line, sans, never hand-italic: a caption the child can read. */}
          <p
            title={persona.line}
            aria-label={persona.line}
            className="type-body-md mt-2 w-full max-w-[34ch] truncate text-lapis"
          >
            {persona.line}
          </p>

          {/* Repertório is one quiet disclosure, not three chips competing with
              the CTA: the techniques live inside it. */}
          <div className="mt-3 w-full max-w-[34ch] border-t border-border">
            <button
              type="button"
              aria-expanded={repertoireOpen}
              aria-label={`Repertório, ${persona.chips.length} técnicas`}
              onClick={() => setRepertoireOpen((open) => !open)}
              className="flex h-11 w-full items-center justify-between gap-2 px-1 text-left text-lapis transition-colors duration-150 ease-out active:text-foreground"
            >
              <span className="type-label-md">Repertório · {persona.chips.length} técnicas</span>
              <ChevronDown
                aria-hidden
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform duration-150 ease-out",
                  repertoireOpen && "rotate-180",
                )}
                strokeWidth={STROKE.regular}
              />
            </button>
            {repertoireOpen && (
              <ul role="list" className="pb-1">
                {persona.chips.map((chip) => (
                  <li
                    key={chip}
                    className="type-label-md flex h-11 items-center gap-2 px-1 text-foreground"
                  >
                    <span aria-hidden className="text-ambar">
                      ✦
                    </span>
                    {chip}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {profile.favoriteColors.length > 0 && (
            <span className="mt-3 flex gap-1" aria-label={`Cores favoritas de ${profile.name}`}>
              {profile.favoriteColors.slice(0, 6).map((hex) => (
                <span
                  key={hex}
                  className="h-4 w-4 rounded-full ring-1 ring-border"
                  style={{ background: hex }}
                  aria-hidden
                />
              ))}
            </span>
          )}
        </section>

        {/* Uma ação primária e uma secundária discreta, na largura natural. */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="type-title-md flex h-12 items-center justify-center gap-2 rounded-full bg-ambar px-5 font-display text-[#1c1b1a] transition-[translate,filter] duration-150 ease-out active:translate-y-0.5 active:scale-[0.96] active:brightness-95"
          >
            <Plus className="h-5 w-5" strokeWidth={STROKE.semibold} />
            {persona.cta}
          </button>
          <button
            type="button"
            onClick={() => go({ name: "gallery", back: { name: "profile" } })}
            aria-label="Meus desenhos"
            className="type-label-lg flex h-12 items-center justify-center gap-1.5 rounded-full px-4 text-lapis transition-colors duration-150 ease-out active:text-foreground"
          >
            <Images className="h-4 w-4" />
            Meus desenhos
          </button>
        </div>

        {/* Produções: a two-column vertical feed filling everything below. */}
        <section className="mt-6" aria-label={`Criações de ${profile.name}`}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="type-label-md font-sans text-lapis">Criações</h2>
            <span className="type-label-sm font-mono text-lapis">{mine.length}</span>
          </div>

          {mine.length === 0 ? (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-3 flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-border text-lapis"
            >
              <Plus className="h-8 w-8" strokeWidth={STROKE.regular} />
              <span className="type-label-md">O primeiro desenho começa aqui</span>
            </button>
          ) : (
            <ul role="list" data-testid="profile-feed" className="mt-3 grid grid-cols-2 gap-3">
              {mine.map((a) => (
                <li key={a.id} className="min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      go({ name: "canvas", artworkId: a.id, back: { name: "profile" } })
                    }
                    aria-label={`Abrir no editor: ${a.pageId ? (PAGES.find((p) => p.id === a.pageId)?.name ?? "página") : "desenho livre"}`}
                    data-artwork={a.id}
                    data-visibility={a.visibility}
                    className="block w-full overflow-hidden rounded-[var(--radius-card)] bg-card p-1.5 shadow-tile transition-[translate,filter] duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]"
                  >
                    <ArtworkPaint
                      pageId={a.pageId}
                      w={a.w}
                      h={a.h}
                      commands={a.history.commands}
                      // The feed cuts a square out of the sheet, exactly as the
                      // SVG did: the raster letterboxes itself inside it.
                      scale={1}
                      className="aspect-square h-auto w-full rounded-sm"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CreateSheet
        open={creating}
        name={profile.name}
        kids={false}
        favorite={profile.favoriteActivity ?? "livre"}
        onBlank={createBlank}
        onPages={() => {
          setCreating(false);
          go({ name: "pages", back: { name: "profile" } });
        }}
        onClose={() => setCreating(false)}
      />
    </div>
  );
}

/**
 * The one creation entry. Drawing and coloring are the same studio: the only
 * difference is whether the paper opens with a line-art layer underneath, so
 * the pages are a choice here instead of a parallel mode. The profile's
 * favourite activity only decides which option comes first — neither is hidden.
 */
function CreateSheet({
  open,
  name,
  kids,
  favorite,
  onBlank,
  onPages,
  onClose,
}: {
  open: boolean;
  name: string;
  kids: boolean;
  favorite: "livre" | "colorir";
  onBlank: () => void;
  onPages: () => void;
  onClose: () => void;
}) {
  const optionClass = cn(
    "type-label-lg flex w-full items-center gap-3 rounded-md border border-border bg-background px-3 text-left text-foreground transition-colors duration-150 ease-out active:scale-[0.96]",
    kids ? "h-16 text-base" : "h-14",
  );

  const blank = (
    <button
      key="livre"
      type="button"
      onClick={onBlank}
      aria-label="Folha em branco"
      className={optionClass}
    >
      <ArtworkSvg
        pageId={null}
        w={300}
        h={400}
        commands={[]}
        className="h-8 w-6 rounded-sm border border-border"
      />
      <span className="flex-1">Folha em branco</span>
      <ArrowRight className="h-4 w-4 text-lapis" />
    </button>
  );
  const pages = (
    <button
      key="colorir"
      type="button"
      onClick={onPages}
      aria-label="Página para colorir"
      className={optionClass}
    >
      <ArtworkSvg
        pageId={PAGES[0]!.id}
        w={300}
        h={300}
        commands={[]}
        className="h-8 w-8 rounded-sm border border-border"
      />
      <span className="min-w-0 flex-1 truncate">
        Página para colorir
        <span className="block type-body-sm font-normal text-lapis">
          {PAGES.length} contornos para pintar
        </span>
      </span>
      <ArrowRight className="h-4 w-4 text-lapis" />
    </button>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      label="Criar"
      backdrop="bg-nanquim/25 backdrop-blur-[1px]"
      panel="rounded-t-[var(--radius-sheet)] bg-card px-4 pb-6 pt-4 shadow-tile"
    >
      <span aria-hidden className="mx-auto mb-3 block h-1 w-8 rounded-full bg-border" />
      <p
        className={cn(
          "type-title-lg font-voice font-semibold text-foreground",
          kids && "text-[1.625rem]",
        )}
      >
        Criar com {name}
      </p>
      <p className="type-body-md mt-0.5 text-lapis">
        O mesmo estúdio — com ou sem o contorno por baixo.
      </p>

      <div className="mt-3 space-y-2">
        {favorite === "colorir" ? [pages, blank] : [blank, pages]}
      </div>
    </Sheet>
  );
}
