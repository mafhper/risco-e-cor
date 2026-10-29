import { useMemo, useState } from "react";
import { ArrowRight, Plus, Search, Settings, Sparkles, X } from "lucide-react";
import { PublishedCard } from "../ArtworkCard";
import { ArtworkSvg } from "../ArtworkSvg";
import { allMuralArtworks, blankArtwork, recentArtworks } from "../artworks";
import { activeProfiles } from "../profiles";
import { pageById } from "../pages";
import { STROKE } from "../motion";
import { Sheet } from "../overlay";
import { uid, useStore, type Artwork, type Profile } from "../store";
import { Avatar } from "../ui";
import { cn } from "@/lib/utils";

/**
 * HOME DO APP — a visão da família, não de uma criança.
 *
 * Here the material is the protagonist: a linen wall with the family's pieces
 * pinned at their own angles, and the profiles as people (avatar + name in
 * Fraunces), never as cards. No hero, no cartoon chrome, no creation tile that
 * bypasses a profile: the one floating action asks *with whom* first.
 *
 * This is the only place that changes the active profile and the only door to
 * the global tutor.
 */
export function HomeScreen() {
  const { state, dispatch, go } = useStore();
  const active = activeProfiles(state.profiles);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [all, setAll] = useState(false);
  const [picking, setPicking] = useState(false);

  const mural = useMemo(() => allMuralArtworks(state.artworks, state.profiles), [state]);
  const authorOf = (id: string) => state.profiles.find((p) => p.id === id) ?? null;
  /** k = 1: the Home stops being a list of people and becomes one child's hero. */
  const only = active.length === 1 ? active[0]! : null;
  const recent = only ? recentArtworks(state.artworks, only.id, 3) : [];
  const term = query.trim().toLowerCase();
  const filtered = term
    ? mural.filter((a) => {
        const author = authorOf(a.profileId)?.name.toLowerCase() ?? "";
        const page = pageById(a.pageId)?.name.toLowerCase() ?? "desenho livre";
        return author.includes(term) || page.includes(term);
      })
    : mural;
  const visible = all || term ? filtered : filtered.slice(0, 6);

  /** One tap from the hub to a blank sheet for a known author. */
  const startFor = (profileId: string) => {
    const id = uid();
    dispatch({ type: "createArtwork", artwork: blankArtwork(profileId, id) });
    dispatch({ type: "selectProfile", id: profileId });
    go({ name: "canvas", artworkId: id, back: { name: "profile" } });
  };

  return (
    <div className="paper-grain relative flex h-full flex-col bg-background" data-testid="home">
      <header className="shrink-0 px-5 pb-1 pt-4">
        <div className="flex items-center gap-2">
          {/* A marca no topo: o símbolo do set (`logo-symbol`), legível a partir
              de 16px. O arquivo em `public/brand/` é cópia do set, não desenho
              novo: não editar à mão. O texto ao lado carrega o nome, logo o
              ícone é decorativo (alt vazio).
              36dp ≠ cap-height do wordmark: o símbolo é de traço fino e o ink
              dele é 82% da caixa (29,5dp dos 36), então precisa ser MAIOR que
              a capitular para segurar o par pesar. */}
          <span data-testid="brand-lockup" className="flex min-w-0 items-center gap-2.5">
            <img
              src="/brand/risco-e-cor-mark.svg"
              alt=""
              aria-hidden="true"
              width={36}
              height={36}
              draggable={false}
              data-testid="brand-mark"
              className="h-9 w-9 shrink-0 select-none"
            />
            {/* A marca escrita é VOZ, não escala de UI: 32/700 na Baloo 2 e a
                caixa fechada por `leading-none`. 40dp dominava a linha e
                empurrava os dois ícones (a 360dp a folga caía a 8dp; a 32/700
                sobra 26dp). O par assenta no centro da linha por
                `translate-y-[3px]`: o ink da capitular nasce 3dp ACIMA do
                centro da caixa (medido a 32/700: inkCenter 37 num box de 32
                centrado em 40) e o ink do símbolo é centrado, então o ajuste
                põe os dois centros ópticos em 40. */}
            <span className="truncate font-voice text-[32px] font-bold leading-none tracking-tight text-foreground translate-y-[3px]">
              Risco e Cor
            </span>
          </span>

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setSearching((s) => !s);
                setQuery("");
              }}
              aria-label={searching ? "Fechar busca" : "Buscar no mural"}
              aria-expanded={searching}
              className="flex h-12 w-12 items-center justify-center rounded-full text-lapis transition-[translate,background-color] duration-150 ease-out hover:bg-card active:translate-y-0.5 active:scale-[0.96]"
            >
              {searching ? <X className="h-6 w-6" /> : <Search className="h-6 w-6" />}
            </button>
            <button
              type="button"
              onClick={() => go({ name: "gate", target: "global", back: { name: "home" } })}
              aria-label="Configurações gerais"
              title="Configurações gerais"
              className="flex h-12 w-12 items-center justify-center rounded-full text-lapis transition-[translate,background-color] duration-150 ease-out hover:bg-card active:translate-y-0.5 active:scale-[0.96]"
            >
              <Settings className="h-6 w-6" />
            </button>
          </div>
        </div>

        {searching && (
          <label className="mt-2 flex h-12 items-center gap-2 rounded-full border border-border bg-card px-4">
            <Search className="h-4 w-4 shrink-0 text-lapis" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Buscar por autor ou desenho"
              placeholder="Autor ou desenho…"
              className="type-body-md min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-lapis"
            />
          </label>
        )}

        {only ? (
          <MonoHero
            profile={only}
            recent={recent}
            onEnter={() => dispatch({ type: "selectProfile", id: only.id })}
            onDraw={() => startFor(only.id)}
            onOpen={(id) =>
              go({ name: "view", artworkId: id, readonly: true, back: { name: "home" } })
            }
          />
        ) : (
          <div
            className="mt-3 flex items-start gap-4 overflow-x-auto pb-2 [scrollbar-width:none]"
            role="group"
            aria-label="Perfis"
          >
            {active.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => dispatch({ type: "selectProfile", id: p.id })}
                aria-label={`Entrar no perfil de ${p.name}`}
                data-profile={p.id}
                className="group flex shrink-0 flex-col items-center gap-1.5 rounded-md px-1 py-0.5 transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]"
              >
                <span
                  className={cn(
                    "rounded-full p-0.5 transition-colors duration-150 ease-out",
                    state.profileId === p.id ? "ring-2 ring-ambar" : "ring-1 ring-border",
                  )}
                >
                  <Avatar profile={p} size={44} />
                </span>
                <span className="caption-hand max-w-[76px] truncate text-[13px] leading-none text-foreground">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </header>

      <div className="themed-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-24">
        <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-border pt-3">
          <h1 className="type-label-md font-sans text-lapis">Mural da família</h1>
          <span className="type-label-md font-mono text-lapis">
            {filtered.length} {filtered.length === 1 ? "peça" : "peças"}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-[var(--radius-card)] border border-dashed border-border px-4 py-10 text-center">
            <p className="type-headline-sm font-voice font-semibold text-foreground">
              {term ? "Nada com esse nome" : "A parede ainda está vazia"}
            </p>
            <p className="type-body-md mt-1 text-lapis">
              {term
                ? "Tente outro autor ou o nome do desenho."
                : "Entre em um perfil e publique a primeira peça."}
            </p>
          </div>
        ) : (
          <>
            <ul
              role="list"
              data-testid="mural-grid"
              className="mt-4 columns-2 gap-4 [column-fill:_balance]"
            >
              {visible.map((a) => (
                <li key={a.id} className="mb-4 break-inside-avoid">
                  <PublishedCard
                    artwork={a}
                    author={authorOf(a.profileId)}
                    kids={false}
                    fill
                    rotate
                    onOpen={() =>
                      go({ name: "view", artworkId: a.id, readonly: true, back: { name: "home" } })
                    }
                  />
                </li>
              ))}
            </ul>

            {!term && filtered.length > 6 && (
              <button
                type="button"
                onClick={() => setAll((v) => !v)}
                className="type-label-lg mt-1 flex h-11 w-full items-center justify-center gap-1.5 rounded-md border border-border text-lapis transition-colors duration-150 ease-out hover:bg-card active:scale-[0.96]"
              >
                {all ? "Mostrar menos" : `Ver todas as ${filtered.length} peças`}
                <ArrowRight
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-150 ease-out",
                    all ? "-rotate-90" : "rotate-90",
                  )}
                />
              </button>
            )}
          </>
        )}
      </div>

      <button
        type="button"
        onClick={() => (only ? startFor(only.id) : setPicking(true))}
        aria-label="Nova peça"
        className="absolute bottom-5 right-5 z-20 flex h-14 w-14 items-center justify-center rounded-2xl bg-ambar text-[#1c1b1a] shadow-tile transition-[translate,filter] duration-150 ease-out active:translate-y-0.5 active:scale-[0.96] active:brightness-95"
      >
        <Plus className="h-6 w-6" strokeWidth={STROKE.semibold} />
      </button>

      {/* Mounted with `open=false` from the first paint so the sheet has a
          presence to animate OUT of; `open` alone unmounts it instantly. */}
      <WhoDraws open={picking} onPick={setPicking} />
    </div>
  );
}

/**
 * The one creation entry on the hub: it asks who is drawing, because a piece
 * always belongs to a profile. One tap lands on a blank sheet in the studio.
 */
function WhoDraws({ open, onPick }: { open: boolean; onPick: (open: boolean) => void }) {
  const { state, dispatch, go } = useStore();
  const active = activeProfiles(state.profiles);

  const start = (profileId: string) => {
    const id = uid();
    dispatch({ type: "createArtwork", artwork: blankArtwork(profileId, id) });
    dispatch({ type: "selectProfile", id: profileId });
    onPick(false);
    go({ name: "canvas", artworkId: id, back: { name: "profile" } });
  };

  return (
    <Sheet
      open={open}
      onClose={() => onPick(false)}
      label="Nova peça"
      backdrop="bg-nanquim/25 backdrop-blur-[1px]"
      panel="rounded-t-[var(--radius-sheet)] bg-card px-4 pb-6 pt-4 shadow-tile"
    >
      <span aria-hidden className="mx-auto mb-3 block h-1 w-8 rounded-full bg-border" />
      <p className="type-title-lg font-voice font-semibold text-foreground">Nova peça</p>
      <p className="type-body-md mt-0.5 text-lapis">Com quem vamos desenhar?</p>
      <div className="mt-3 space-y-1.5">
        {active.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => start(p.id)}
            aria-label={`Desenhar com ${p.name}`}
            className="flex h-14 w-full items-center gap-3 rounded-md border border-border bg-background px-3 text-left transition-colors duration-150 ease-out active:scale-[0.96]"
          >
            <Avatar profile={p} size={34} />
            <span className="type-body-lg min-w-0 flex-1 truncate font-display text-foreground">
              {p.name}
            </span>
            <ArrowRight className="h-4 w-4 text-lapis" strokeWidth={STROKE.regular} />
          </button>
        ))}
      </div>
    </Sheet>
  );
}

/**
 * k = 1 — the Home has ONE child, so it stops asking and starts greeting.
 * Big face, the name in the hand-written display face, the last pieces right
 * below. No chip row, no "with whom?" sheet: the only person who draws here is
 * already known. The mode restores the chip row the moment a second child is
 * shared back.
 */
function MonoHero({
  profile,
  recent,
  onEnter,
  onDraw,
  onOpen,
}: {
  profile: Profile;
  recent: Artwork[];
  onEnter: () => void;
  onDraw: () => void;
  onOpen: (artworkId: string) => void;
}) {
  return (
    <section data-testid="mono-hero" className="mt-3 rounded-[28px] bg-card p-3 shadow-tile">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onEnter}
          aria-label={`Entrar no perfil de ${profile.name}`}
          className="flex min-w-0 items-center gap-3 text-left transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]"
        >
          <span className="shrink-0 rounded-full p-1 ring-2 ring-ambar">
            <Avatar profile={profile} size={88} />
          </span>
          <span className="caption-hand min-w-0 truncate text-4xl leading-none text-foreground">
            {profile.name}
          </span>
        </button>
        <button
          type="button"
          onClick={onDraw}
          aria-label={`Desenhar com ${profile.name}`}
          className="ml-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ambar text-[#1c1b1a] shadow-tile transition-[translate,filter] duration-150 ease-out active:translate-y-0.5 active:scale-[0.96] active:brightness-95"
        >
          <Plus className="h-7 w-7" strokeWidth={STROKE.semibold} />
        </button>
      </div>

      {recent.length > 0 && (
        <ul role="list" className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {recent.map((a) => (
            <li key={a.id} className="w-24 shrink-0">
              <button
                type="button"
                onClick={() => onOpen(a.id)}
                aria-label={`Abrir ${a.pageId ? "página" : "desenho"} recente`}
                className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-black/[0.08] bg-white p-1 shadow-paper transition-transform duration-150 ease-out active:translate-y-0.5 active:scale-[0.96]"
              >
                <ArtworkSvg
                  pageId={a.pageId}
                  w={a.w}
                  h={a.h}
                  commands={a.history.commands}
                  className="h-full w-full rounded-xl"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
