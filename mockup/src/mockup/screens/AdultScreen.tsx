import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  Bug,
  ChevronDown,
  Copy,
  Download,
  Images,
  Info,
  LogOut,
  Palette,
  Pin,
  Plus,
  RotateCcw,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  StarOff,
  Trash2,
  Upload,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ArtworkSvg } from "../ArtworkSvg";
import { archivedProfiles, activeProfiles, MAX_ACTIVE_PROFILES } from "../profiles";
import {
  AGE_LABELS,
  CAPABILITY_COPY,
  CAPABILITY_KEYS,
  capsOf,
  uiModeOf,
  type AgeBand,
  type CapabilityKey,
  type UiMode,
} from "../capabilities";
import { EMOJI_CATEGORIES, type EmojiCategoryId } from "../emojis";
import { downloadText, exportArtwork, exportPng } from "../exportPng";
import { purgeWarning } from "../lifecycle";
import { PAPERS, PAPER_KEYS } from "../palette";
import { MAX_PERSONA_LENGTH, defaultPersonaLine } from "../persona";
import { AVATAR_ART, profileTheme, themeDotStyle, themeSurfaceStyle } from "../profileThemes";
import {
  THEME_SEEDS,
  activeThemes as activeThemeList,
  renameTheme,
  validateNewTheme,
  type Theme,
  type ThemeDraft,
} from "../themes";
import {
  parseBackup,
  useLowPowerDevice,
  useStore,
  type Artwork,
  type AvatarKey,
  type Profile,
  type Screen,
  type ToneKey,
  type Visibility,
} from "../store";
import { COLOR_SCHEME_LABEL, useResolvedScheme, type ColorScheme } from "../theme";
import { Dialog, useRetained } from "../overlay";
import { EdgeRow } from "../edgeSelect";
import { AVATARS, Avatar, ConfirmDialog, TONES, placeholderPhotoUri } from "../ui";
import { cn } from "@/lib/utils";

/**
 * Adult area, in two scopes that never mix (backlog §6.1):
 *  - "global": the tutor's own home — family profiles (one accordion card per
 *    profile: create, identity, theme, age band, mode, the six capabilities,
 *    order, duplicate, archive, remove), mural moderation, kept pieces, trash,
 *    backup, about. Reached only from Home's single gear.
 *  - "profile": "Ajustes de {nome}" — identity (name, avatar, emoji, photo,
 *    the catalogue theme it may wear), this profile's files (its drawings,
 *    duplicate, archive) and the favourite activity. Age, mode, layout and the
 *    tool set belong to the tutor and are NOT editable here.
 * The identity editor is the same component in both places; the rules card
 * lives ONLY inside the tutor's per-profile card, never in a list below it.
 */
export function AdultScreen({ focus, back }: { focus: "global" | "profile"; back: Screen }) {
  const { state, dispatch, profile, go } = useStore();
  const [confirmReset, setConfirmReset] = useState(false);
  /** Settings and Content are two subjects, never one running list. */
  const [tab, setTab] = useState<"ajustes" | "conteudo">("ajustes");
  const [confirm, setConfirm] = useState<
    | { kind: "purge"; artwork: Artwork }
    | { kind: "empty" }
    | { kind: "removeProfile"; profile: Profile }
    | null
  >(null);
  // Closing nulls the state; the retained payload keeps the panel populated
  // through the 150ms exit instead of emptying mid-animation.
  const purge = useRetained(confirm?.kind === "purge" ? confirm : null);
  const removeProfile = useRetained(confirm?.kind === "removeProfile" ? confirm : null);
  const emptyCount = useRetained(confirm?.kind === "empty" ? state.trash.length : null);
  const { settings } = state;
  const set = (patch: Partial<typeof settings>) => dispatch({ type: "updateSettings", patch });
  const authorOf = (id: string) => state.profiles.find((p) => p.id === id) ?? null;

  return (
    <div className="paper-grain flex h-full flex-col bg-background" data-testid="adult">
      <div
        data-testid="adult-header"
        className="flex items-center justify-between gap-2 border-b border-border px-4 pb-3 pt-3"
      >
        <div className="min-w-0">
          <p className="type-label-sm text-lapis">
            {focus === "global" ? "Tutor global" : "Ajustes do perfil"}
          </p>
          <h2 className="type-headline-sm truncate font-voice font-semibold text-foreground">
            {focus === "profile" && profile ? `Ajustes de ${profile.name}` : "Configurações"}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => go(back)}
          className="type-label-lg flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 text-background"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </div>

      <div className="themed-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
        {focus === "global" ? (
          <>
            {/* Two subjects, two tabs: general adjustments stay accordions; the
                drawing library (filter, CRUD, share, backup) gets its own room. */}
            <div
              role="tablist"
              aria-label="Configurações"
              data-testid="canvas-tabs"
              className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1"
            >
              {(
                [
                  ["ajustes", "Ajustes"],
                  ["conteudo", "Conteúdo"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "h-9 rounded-full text-xs font-semibold transition-colors duration-150 ease-out",
                    tab === id ? "bg-card text-foreground shadow-press" : "text-lapis",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "conteudo" ? (
              <ContentTab />
            ) : (
              <>
                {/* Settings are six subjects, each a chevron. The header carries the
                main value ("Claro", "3 ativos"); the fine adjustments live one
                tap inside. No giant toggle and no full-width button per item. */}
                <Accordion
                  icon={Users}
                  title="Perfis"
                  summary={`${activeProfiles(state.profiles).length} ativos`}
                  defaultOpen
                  testid="acc-perfis"
                >
                  <FamilyProfiles
                    onRemove={(p) => setConfirm({ kind: "removeProfile", profile: p })}
                  />

                  <div className="mt-3 border-t border-border/60 pt-3">
                    <p className="text-xs font-semibold text-foreground">Tipo de família</p>
                    <p className="text-[11px] text-lapis">
                      Apenas 1 criança deixa a Home com um herói.
                    </p>
                    <div
                      className="mt-1.5 flex flex-wrap gap-1"
                      role="group"
                      aria-label="Tipo de família"
                    >
                      {(
                        [
                          ["single", "1 criança"],
                          ["shared", "Compartilhado"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          aria-pressed={settings.familyMode === value}
                          onClick={() => dispatch({ type: "setFamilyMode", mode: value })}
                          className={cn(
                            "h-8 whitespace-nowrap rounded-full px-3 text-[11px] font-semibold transition-colors duration-150 ease-out active:scale-[0.96]",
                            settings.familyMode === value
                              ? "bg-foreground text-background"
                              : "bg-muted text-lapis",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => set({ setupDone: false })}
                      className="mt-1 inline-flex h-8 items-center gap-1 rounded-full px-2 text-[11px] font-semibold text-lapis transition-colors duration-150 ease-out active:text-foreground"
                    >
                      Rever a escolha inicial
                    </button>
                  </div>
                </Accordion>

                <Accordion
                  icon={Palette}
                  title="Aparência"
                  summary={COLOR_SCHEME_LABEL[settings.colorScheme]}
                  testid="acc-aparencia"
                >
                  <p className="type-body-sm mb-1 text-lapis">
                    Vale para todos os perfis de uma vez.
                  </p>
                  <div className="space-y-1" role="group" aria-label="Tema do app">
                    {(["light", "dark", "system"] as ColorScheme[]).map((value) => (
                      <EdgeRow
                        key={value}
                        label={COLOR_SCHEME_LABEL[value]}
                        selected={settings.colorScheme === value}
                        testid={`scheme-${value}`}
                        onSelect={() => set({ colorScheme: value })}
                      />
                    ))}
                  </div>

                  {/* The COMPLETE paper appearance lives here; the canvas keeps only
                  the quick toggle (tap) and the quick sheet (long press). */}
                  <div className="mt-3 border-t border-border/60 pt-2">
                    <p className="type-label-sm font-semibold uppercase tracking-wide text-lapis">
                      Papel
                    </p>
                    <p className="type-body-sm mb-1 text-lapis">
                      O material da folha. A grade continua sendo uma guia do canvas.
                    </p>
                    <div className="space-y-1" role="group" aria-label="Aparência do papel">
                      {PAPER_KEYS.map((key) => (
                        <EdgeRow
                          key={key}
                          label={PAPERS[key].label}
                          selected={settings.paper === key}
                          testid={`settings-paper-${key}`}
                          onSelect={() => set({ paper: key })}
                        />
                      ))}
                    </div>
                  </div>
                </Accordion>

                <Accordion
                  icon={SlidersHorizontal}
                  title="Ferramentas"
                  summary={`Estabilização ${settings.stabilization}`}
                  testid="acc-ferramentas"
                >
                  <Row label="Sons de toque" hint="Confirma o traço e a página completa">
                    <Switch checked={settings.sound} onCheckedChange={(v) => set({ sound: v })} />
                  </Row>
                  <Row label="Vibração">
                    <Switch
                      checked={settings.vibration}
                      onCheckedChange={(v) => set({ vibration: v })}
                    />
                  </Row>
                  <Row label="Falar a cor" hint="Áudio em PT-BR, sem vozes instaladas">
                    <Switch checked={settings.voice} onCheckedChange={(v) => set({ voice: v })} />
                  </Row>
                  <Row label="Mão-fantasma" hint="A demonstração da primeira vez">
                    <Switch checked={settings.demo} onCheckedChange={(v) => set({ demo: v })} />
                  </Row>
                  <Row label="Estabilização" hint="Suaviza o traço do dedo">
                    <span className="w-6 text-right font-mono font-semibold">
                      {settings.stabilization}
                    </span>
                  </Row>
                  <Slider
                    value={[settings.stabilization]}
                    min={0}
                    max={3}
                    step={1}
                    onValueChange={([v]) => set({ stabilization: v ?? 0 })}
                    className="mt-1"
                  />
                </Accordion>

                <Accordion
                  icon={ShieldCheck}
                  title="Privacidade"
                  summary="Só neste aparelho"
                  testid="acc-privacidade"
                >
                  <p className="mb-2 text-[11px] text-lapis">
                    Os desenhos ficam só neste aparelho. A foto do perfil nunca entra no backup.
                  </p>

                  <ul className="mt-3 space-y-1 border-t border-border/60 pt-2 text-[11px] text-lapis">
                    <li>• Sem permissão de internet — o app não consegue enviar nada.</li>
                    <li>• Sem anúncios, compras, assinaturas ou conta.</li>
                    <li>• Sem analytics ou relatórios de erro externos.</li>
                    <li>• Todo o conteúdo liberado desde a instalação.</li>
                  </ul>

                  <div className="mt-3 border-t border-border/60 pt-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                      <Pin className="h-3.5 w-3.5 text-pigmento" /> Prender o app na tela
                    </p>
                    <p className="mt-1 text-[11px] text-lapis">
                      Use a fixação de tela do Android para a criança não sair sem querer:
                      Configurações › Segurança › Fixação de app. Para soltar, segure Voltar +
                      Recentes.
                    </p>
                  </div>

                  <div className="mt-2 border-t border-border/60 pt-2">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                      <Bug className="h-3.5 w-3.5 text-pigmento" /> Diagnóstico local
                    </p>
                    <p className="mt-1 text-[11px] text-lapis">
                      {state.crashLog.length === 0
                        ? "Nenhuma falha registrada neste aparelho."
                        : `${state.crashLog.length} falhas registradas.`}{" "}
                      O registro nunca sai do aparelho.
                    </p>
                  </div>
                </Accordion>

                <Accordion icon={Info} title="Sobre" summary="Protótipo local" testid="acc-sobre">
                  <p className="text-[11px] text-lapis">
                    Desenhos deste protótipo são originais. Na versão final, cada página terá autor,
                    origem e licença registrados.
                  </p>
                  <div className="mt-3 border-t border-border/60 pt-2">
                    <Row label="Dados de demonstração" hint="Volta ao estado de fábrica">
                      {confirmReset ? (
                        <span className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setConfirmReset(false)}
                            className="h-8 rounded-full bg-muted px-3 text-[11px] font-semibold"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              dispatch({ type: "reset" });
                              toast("Protótipo reiniciado");
                            }}
                            className="h-8 rounded-full bg-destructive px-3 text-[11px] font-semibold text-destructive-foreground"
                          >
                            Reiniciar
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmReset(true)}
                          className="flex h-8 items-center gap-1.5 rounded-full bg-muted px-3 text-[11px] font-semibold text-lapis"
                        >
                          <RotateCcw className="h-3 w-3" /> Reiniciar
                        </button>
                      )}
                    </Row>
                  </div>
                </Accordion>
              </>
            )}
          </>
        ) : profile ? (
          <ProfileSettings p={profile} back={back} />
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-lapis">
            Escolha um perfil na Home para abrir os ajustes dele.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirm?.kind === "purge"}
        title="Apagar de vez?"
        message={purge ? purgeWarning(authorOf(purge.artwork.profileId)?.name ?? null) : ""}
        confirmLabel="Apagar de vez"
        cancelLabel="Manter"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!purge) return;
          dispatch({ type: "purge", id: purge.artwork.id });
          setConfirm(null);
          toast.success("Apagado de vez");
        }}
      >
        {purge && (
          <div className="mt-3 flex items-center gap-2">
            <ArtworkSvg
              pageId={purge.artwork.pageId}
              w={purge.artwork.w}
              h={purge.artwork.h}
              commands={purge.artwork.history.commands}
              className="h-14 w-14 rounded-sm border border-border"
            />
            <p className="text-[11px] text-lapis">Não dá para desfazer.</p>
          </div>
        )}
      </ConfirmDialog>

      <EmptyTrashConfirm
        open={confirm?.kind === "empty"}
        count={emptyCount ?? 0}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          dispatch({ type: "emptyTrash" });
          setConfirm(null);
          toast.success("Lixeira esvaziada");
        }}
      />

      <ConfirmDialog
        open={confirm?.kind === "removeProfile"}
        title={removeProfile ? `Remover ${removeProfile.profile.name}?` : "Remover perfil?"}
        message="A galeria e a lixeira não têm desenhos deste perfil. Esta ação não tem desfazer."
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (!removeProfile) return;
          dispatch({ type: "removeProfile", id: removeProfile.profile.id });
          setConfirm(null);
          toast.success("Perfil removido");
        }}
      />
    </div>
  );
}

/**
 * CONTENT: the drawing library, not a setting. It has its own tab so filtering,
 * CRUD, sharing and backup do not sit in the same running list as sound,
 * stabilization and color scheme. Filters are two axes (status and author) and
 * every row carries only the actions that apply to that piece.
 */
type ContentStatus = "all" | Visibility | "trash";

const CONTENT_STATUS: { id: ContentStatus; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "published", label: "Mural" },
  { id: "draft", label: "Rascunhos" },
  { id: "archived", label: "Guardados" },
  { id: "trash", label: "Lixeira" },
];

const VISIBILITY_TEXT: Record<Visibility, string> = {
  published: "no mural",
  draft: "rascunho",
  archived: "guardado",
};

function ContentTab() {
  const { state, dispatch } = useStore();
  /** The device tier the file is painted with — the same one the paper used. */
  const lowPower = useLowPowerDevice();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<ContentStatus>("all");
  const [author, setAuthor] = useState<string>("all");
  const [purge, setPurge] = useState<Artwork | null>(null);
  const [emptyOpen, setEmptyOpen] = useState(false);
  const nameOf = (id: string) => state.profiles.find((p) => p.id === id)?.name ?? "?";

  const pool =
    status === "trash"
      ? state.trash
      : state.artworks.filter((a) => status === "all" || a.visibility === status);
  const rows = pool
    .filter((a) => author === "all" || a.profileId === author)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const exportBackup = () => {
    // The photo never leaves the device: it is a local pointer, not data.
    const data = {
      app: "colorir",
      version: 1,
      exportedAt: new Date().toISOString(),
      profiles: state.profiles.map((p) => ({ ...p, photoUri: null })),
      artworks: state.artworks,
      settings: state.settings,
    };
    downloadText(
      JSON.stringify(data),
      `backup-desenhos-${new Date().toISOString().slice(0, 10)}.json`,
    );
    toast.success("Backup salvo no aparelho");
  };
  const importBackup = async (file: File) => {
    const parsed = parseBackup(await file.text());
    if (!parsed) {
      toast.error("Arquivo inválido — nada foi alterado");
      return;
    }
    dispatch({ type: "importBackup", ...parsed });
    toast.success(`${parsed.artworks.length} desenhos restaurados`);
  };

  const share = async (art: Artwork) => {
    // The sheet, described from the piece: no DOM lookup for a preview node,
    // so the file can never again be whatever that node happened to contain
    // (export-png.md §2, §6).
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
    toast.success("Imagem pronta para compartilhar");
  };

  return (
    <div className="space-y-3" data-testid="content-tab">
      <div className="rounded-2xl border border-border bg-card p-3">
        <p className="type-title-md font-display text-foreground">Desenhos</p>
        <p className="type-body-sm text-lapis">
          {rows.length} de {pool.length} peça{pool.length === 1 ? "" : "s"} nesta vista.
        </p>

        <div className="mt-2 space-y-1.5">
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por status">
            {CONTENT_STATUS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={status === option.id}
                onClick={() => setStatus(option.id)}
                className={cn(
                  "h-8 rounded-full px-2.5 text-[11px] font-semibold transition-colors duration-150 ease-out",
                  status === option.id ? "bg-foreground text-background" : "bg-muted text-lapis",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1" role="group" aria-label="Filtrar por perfil">
            <button
              type="button"
              aria-pressed={author === "all"}
              onClick={() => setAuthor("all")}
              className={cn(
                "h-8 rounded-full px-2.5 text-[11px] font-semibold transition-colors duration-150 ease-out",
                author === "all" ? "bg-foreground text-background" : "bg-muted text-lapis",
              )}
            >
              Todos os perfis
            </button>
            {state.profiles.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={author === p.id}
                onClick={() => setAuthor(p.id)}
                className={cn(
                  "h-8 rounded-full px-2.5 text-[11px] font-semibold transition-colors duration-150 ease-out",
                  author === p.id ? "bg-foreground text-background" : "bg-muted text-lapis",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-xs text-lapis">
          Nenhum desenho nesta vista.
        </p>
      ) : (
        <ul className="space-y-2" role="list">
          {rows.map((a) => {
            const name = nameOf(a.profileId);
            return (
              <li
                key={a.id}
                data-content-row
                data-artwork-id={a.id}
                className="rounded-2xl border border-border bg-card p-2"
              >
                <div className="flex items-center gap-2">
                  <ArtworkSvg
                    pageId={a.pageId}
                    w={a.w}
                    h={a.h}
                    commands={a.history.commands}
                    className="h-14 w-14 shrink-0 rounded-md border border-border"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-foreground">{name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-lapis">
                      {status === "trash" ? "lixeira" : VISIBILITY_TEXT[a.visibility]}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-1">
                    {status === "trash" ? (
                      <>
                        <RowAction
                          icon={ArchiveRestore}
                          label={`Restaurar desenho de ${name}`}
                          onClick={() => {
                            dispatch({ type: "restore", id: a.id });
                            toast.success("De volta ao lugar de antes");
                          }}
                        />
                        <RowAction
                          icon={Trash2}
                          label={`Apagar de vez o desenho de ${name}`}
                          tone="danger"
                          onClick={() => setPurge(a)}
                        />
                      </>
                    ) : (
                      <>
                        {a.visibility === "published" ? (
                          <RowAction
                            icon={StarOff}
                            label={`Tirar do mural o desenho de ${name}`}
                            onClick={() => {
                              dispatch({ type: "unpublish", id: a.id });
                              toast("Saiu do mural — virou rascunho de novo");
                            }}
                          />
                        ) : (
                          <RowAction
                            icon={Star}
                            label={`Publicar desenho de ${name}`}
                            onClick={() => {
                              dispatch({ type: "publish", id: a.id });
                              toast.success("No mural");
                            }}
                          />
                        )}
                        {a.visibility === "archived" ? (
                          <RowAction
                            icon={ArchiveRestore}
                            label={`Desarquivar desenho de ${name}`}
                            onClick={() => {
                              dispatch({ type: "unarchiveArtwork", id: a.id });
                              toast("De volta à galeria como rascunho");
                            }}
                          />
                        ) : (
                          <RowAction
                            icon={Archive}
                            label={`Guardar desenho de ${name}`}
                            onClick={() => {
                              dispatch({ type: "archiveArtwork", id: a.id });
                              toast("Guardado", {
                                duration: 5000,
                                action: {
                                  label: "Desfazer",
                                  onClick: () => dispatch({ type: "unarchiveArtwork", id: a.id }),
                                },
                              });
                            }}
                          />
                        )}
                        <RowAction
                          icon={Copy}
                          label={`Duplicar desenho de ${name}`}
                          onClick={() => {
                            dispatch({ type: "duplicateArtwork", id: a.id });
                            toast.success("Cópia guardada nos rascunhos");
                          }}
                        />
                        <RowAction
                          icon={Share2}
                          label={`Compartilhar desenho de ${name}`}
                          onClick={() => void share(a)}
                        />
                        <RowAction
                          icon={Trash2}
                          tone="danger"
                          label={`Mover p/ lixeira desenho de ${name}`}
                          onClick={() => {
                            dispatch({ type: "trash", id: a.id });
                            toast(`Desenho de ${name} foi para a lixeira`);
                          }}
                        />
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {status === "trash" && state.trash.length > 0 && (
        <button
          type="button"
          onClick={() => setEmptyOpen(true)}
          className="h-10 rounded-full bg-destructive px-3 text-xs font-semibold text-destructive-foreground"
        >
          Esvaziar lixeira ({state.trash.length})
        </button>
      )}

      <div className="rounded-2xl border border-border bg-card p-3">
        <p className="type-title-md font-display text-foreground">Backup</p>
        <p className="type-body-sm text-lapis">
          Os desenhos ficam só neste aparelho. A foto do perfil nunca entra no arquivo.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={exportBackup}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-secondary px-3 text-[11px] font-semibold text-secondary-foreground"
          >
            <Download className="h-3.5 w-3.5" /> Exportar backup
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center justify-center gap-1.5 rounded-md bg-muted px-3 text-[11px] font-semibold"
          >
            <Upload className="h-3.5 w-3.5" /> Importar backup
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importBackup(f);
            e.target.value = "";
          }}
        />
      </div>

      <ConfirmDialog
        open={purge !== null}
        title="Apagar de vez?"
        message={purge ? purgeWarning(nameOf(purge.profileId)) : ""}
        confirmLabel="Apagar de vez"
        cancelLabel="Manter"
        onCancel={() => setPurge(null)}
        onConfirm={() => {
          if (!purge) return;
          dispatch({ type: "purge", id: purge.id });
          setPurge(null);
          toast.success("Apagado de vez");
        }}
      />

      <ConfirmDialog
        open={emptyOpen}
        title="Esvaziar a lixeira?"
        message={`${state.trash.length} peça${state.trash.length === 1 ? "" : "s"} serão apagadas de vez.`}
        confirmLabel={`Apagar ${state.trash.length}`}
        cancelLabel="Manter"
        onCancel={() => setEmptyOpen(false)}
        onConfirm={() => {
          dispatch({ type: "emptyTrash" });
          setEmptyOpen(false);
          toast.success("Lixeira esvaziada");
        }}
      />
    </div>
  );
}

function RowAction({
  icon: Icon,
  label,
  tone,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "danger";
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full bg-muted transition-transform duration-150 ease-out active:scale-[0.96]",
        tone === "danger" ? "text-vinho" : "text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * The family list is the only place profiles are created, ordered, copied,
 * archived or removed — and every profile owns an accordion card. Opening the
 * card is how the adult reaches identity, theme, age, mode, the seven
 * capabilities, order and the actions: the same profile is never edited again
 * in a second list below the first.
 */
function FamilyProfiles({ onRemove }: { onRemove: (p: Profile) => void }) {
  const { state, dispatch } = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [band, setBand] = useState<AgeBand>("3-5");
  /** One open card at a time: a second tap closes it, another card replaces it. */
  const [openId, setOpenId] = useState<string | null>(null);
  const active = activeProfiles(state.profiles);
  const archived = archivedProfiles(state.profiles);
  const artworkCount = (id: string) => state.artworks.filter((a) => a.profileId === id).length;
  // Trash still points at the profile, so it counts as occupied too.
  const pieceCount = (id: string) =>
    artworkCount(id) + state.trash.filter((a) => a.profileId === id).length;

  const toggle = (id: string) => setOpenId((current) => (current === id ? null : id));

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Dê um nome para o perfil.");
      return;
    }
    if (state.profiles.some((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Já existe um perfil com esse nome.");
      return;
    }
    if (active.length >= MAX_ACTIVE_PROFILES) {
      toast.error(`A família já tem ${MAX_ACTIVE_PROFILES} perfis ativos.`);
      return;
    }
    dispatch({
      type: "createProfile",
      draft: { name: trimmed, age: band, avatar: "rabbit", tone: "mint", themeId: "neutro" },
    });
    setName("");
    setCreating(false);
    toast.success("Perfil criado");
  };

  return (
    <>
      <p className="mb-2 text-xs text-lapis">
        Cada cartão abre o perfil inteiro: identidade, tema, idade, modo, ferramentas e ordem. A
        ordem só muda aqui; usar um perfil nunca reordena a Home.
      </p>

      <ul className="space-y-1.5" role="list" data-testid="tutor-profiles">
        {active.map((p, index) => {
          const open = openId === p.id;
          return (
            <li
              key={p.id}
              className="overflow-hidden rounded-md bg-muted"
              data-testid={`tutor-card-${p.name}`}
            >
              <button
                type="button"
                aria-expanded={open}
                aria-label={`Ajustar ${p.name}`}
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-2 p-2 text-left"
              >
                <Avatar profile={p} size={34} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold">{p.name}</span>
                  <span className="block truncate font-mono text-[10px] text-lapis">
                    {AGE_LABELS[p.age]} · {artworkCount(p.id)} des.
                  </span>
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    "h-4 w-4 shrink-0 text-lapis transition-transform duration-150 ease-out",
                    open && "rotate-180",
                  )}
                />
              </button>

              {open && (
                <div className="space-y-2 border-t border-border/60 p-2">
                  <Block label="identidade e tema">
                    <ProfileIdentity p={p} />
                  </Block>

                  <Block label="idade, modo e ferramentas">
                    <ProfileRules p={p} />
                  </Block>

                  <Block label="ordem na Home">
                    <div className="flex flex-wrap gap-1">
                      {index > 0 && (
                        <button
                          type="button"
                          aria-label={`Mover ${p.name} para cima`}
                          onClick={() => dispatch({ type: "moveProfile", id: p.id, direction: -1 })}
                          className="flex h-9 items-center justify-center rounded-sm bg-muted px-3 text-[10px] font-semibold"
                        >
                          ↑ Subir
                        </button>
                      )}
                      {index < active.length - 1 && (
                        <button
                          type="button"
                          aria-label={`Mover ${p.name} para baixo`}
                          onClick={() => dispatch({ type: "moveProfile", id: p.id, direction: 1 })}
                          className="flex h-9 items-center justify-center rounded-sm bg-muted px-3 text-[10px] font-semibold"
                        >
                          ↓ Descer
                        </button>
                      )}
                    </div>
                  </Block>

                  <Block label="este perfil">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        aria-label={`Duplicar ${p.name}`}
                        title="Duplicar (identidade e preferências, sem desenhos)"
                        onClick={() => {
                          if (active.length >= MAX_ACTIVE_PROFILES) {
                            toast.error(`A família já tem ${MAX_ACTIVE_PROFILES} perfis ativos.`);
                            return;
                          }
                          dispatch({ type: "duplicateProfile", id: p.id });
                          toast.success("Cópia criada");
                        }}
                        className="flex h-9 items-center justify-center gap-1 rounded-sm bg-muted px-3 text-[10px] font-semibold text-foreground"
                      >
                        <Copy className="h-3.5 w-3.5" /> Duplicar
                      </button>
                      {/* Unavailable actions are absent, never dimmed: no ghost
                          button that a parent can tap into nothing. */}
                      {active.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Guardar perfil ${p.name}`}
                          title="Guardar (some da Home, não apaga)"
                          onClick={() => {
                            dispatch({ type: "archiveProfile", id: p.id });
                            setOpenId(null);
                            toast("Perfil guardado", {
                              duration: 5000,
                              action: {
                                label: "Desfazer",
                                onClick: () => dispatch({ type: "unarchiveProfile", id: p.id }),
                              },
                            });
                          }}
                          className="flex h-9 items-center justify-center gap-1 rounded-sm bg-muted px-3 text-[10px] font-semibold text-foreground"
                        >
                          <Archive className="h-3.5 w-3.5" /> Guardar
                        </button>
                      )}
                      {active.length > 1 && pieceCount(p.id) === 0 && (
                        <button
                          type="button"
                          aria-label={`Remover ${p.name}`}
                          onClick={() => onRemove(p)}
                          className="flex h-9 items-center justify-center gap-1 rounded-sm bg-muted px-3 text-[10px] font-semibold text-vinho"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remover
                        </button>
                      )}
                    </div>
                    {pieceCount(p.id) > 0 && (
                      <p className="mt-1 text-[10px] text-lapis">
                        Para remover, esvazie a galeria e a lixeira deste perfil.
                      </p>
                    )}
                  </Block>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {archived.length > 0 && (
        <div className="mt-3 rounded-md border border-dashed border-border p-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-lapis">
            guardados ({archived.length})
          </p>
          <ul className="space-y-1" role="list">
            {archived.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <Avatar profile={p} size={26} />
                <span className="min-w-0 flex-1 truncate text-xs">{p.name}</span>
                <button
                  type="button"
                  aria-label={`Desarquivar ${p.name}`}
                  onClick={() => {
                    if (active.length >= MAX_ACTIVE_PROFILES) {
                      toast.error(`A família já tem ${MAX_ACTIVE_PROFILES} perfis ativos.`);
                      return;
                    }
                    dispatch({ type: "unarchiveProfile", id: p.id });
                    toast.success(`${p.name} voltou para a Home`);
                  }}
                  className="flex h-8 items-center gap-1 rounded-full bg-card px-2.5 text-[10px] font-semibold"
                >
                  <ArchiveRestore className="h-3 w-3" /> Voltar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {creating ? (
        <div
          role="group"
          aria-label="Novo perfil"
          className="mt-2 rounded-md border border-border bg-background p-2.5"
        >
          <label className="block">
            <span className="text-[11px] font-medium">Nome</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 16))}
              aria-label="Nome do novo perfil"
              placeholder="Até 16 letras"
              className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-sm outline-none"
            />
          </label>
          <div className="mt-2">
            <Seg
              label="Idade"
              value={band}
              options={[
                ["3-5", AGE_LABELS["3-5"]],
                ["6-8", AGE_LABELS["6-8"]],
                ["9+", AGE_LABELS["9+"]],
              ]}
              onChange={(v) => setBand(v as AgeBand)}
            />
          </div>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="h-9 whitespace-nowrap rounded-full bg-muted px-3 text-xs font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              className="h-9 rounded-full bg-foreground px-3 text-xs font-semibold text-background"
            >
              Criar perfil
            </button>
          </div>
        </div>
      ) : (
        active.length < MAX_ACTIVE_PROFILES && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label="Adicionar perfil"
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3 text-[11px] font-semibold text-lapis"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar perfil
          </button>
        )
      )}

      {active.length >= MAX_ACTIVE_PROFILES && (
        <p className="mt-2 flex items-center gap-1.5 text-[10px] text-lapis">
          <UserPlus className="h-3 w-3" /> Limite de {MAX_ACTIVE_PROFILES} perfis ativos.
        </p>
      )}
    </>
  );
}

/** One named concern inside an open profile card. */
function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-sm bg-card p-2.5">
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-lapis">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Emptying is a two-tap act: the number anchors the weight of it. */
function EmptyTrashConfirm({
  open,
  count,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  count: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [armed, setArmed] = useState(false);

  // The panel stays mounted for the exit: re-arming on open keeps the second
  // tap a deliberate act instead of a leftover from the previous visit.
  useEffect(() => {
    if (open) setArmed(false);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      label="Esvaziar a lixeira?"
      role="alertdialog"
      labelledBy="empty-title"
      closeLabel="Cancelar"
      panel="max-w-sm rounded-lg p-4"
    >
      <p id="empty-title" className="font-display text-lg text-foreground">
        Esvaziar a lixeira?
      </p>
      <p className="mt-1 text-[12px] leading-snug text-lapis">
        {count} {count === 1 ? "desenho" : "desenhos"} serão apagados de vez. Não dá para desfazer.
      </p>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 flex-1 rounded-md bg-muted text-sm font-semibold text-foreground transition-colors duration-150 ease-out active:scale-[0.96]"
        >
          Cancelar
        </button>
        {armed ? (
          <button
            type="button"
            onClick={onConfirm}
            className="h-11 flex-1 rounded-md bg-destructive text-sm font-semibold text-destructive-foreground transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            Tenho certeza — apagar {count}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setArmed(true)}
            className="h-11 flex-1 rounded-md bg-destructive text-sm font-semibold text-destructive-foreground transition-transform duration-150 ease-out active:scale-[0.96]"
          >
            Esvaziar lixeira
          </button>
        )}
      </div>
    </Dialog>
  );
}

/**
 * One subject, one chevron. The header keeps the main value visible (the
 * current scheme, how many pieces are on the mural); the fine adjustments sit
 * inside. Never a full-width button per item, never a giant toggle in the list.
 */
function Accordion({
  icon: Icon,
  title,
  summary,
  children,
  defaultOpen = false,
  testid,
}: {
  icon: LucideIcon;
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  testid?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section
      className="overflow-hidden rounded-2xl border border-border bg-card"
      data-testid={testid}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <Icon className="h-5 w-5 shrink-0 text-pigmento" />
        <span className="min-w-0 flex-1">
          <span className="type-title-md block truncate font-display text-foreground">{title}</span>
          {summary && <span className="type-body-sm block truncate text-lapis">{summary}</span>}
        </span>
        <ChevronDown
          aria-hidden
          className={cn(
            "h-4 w-4 shrink-0 text-lapis transition-transform duration-150 ease-out",
            open && "rotate-180",
          )}
        />
      </button>
      {open && <div className="border-t border-border/60 px-4 py-3">{children}</div>}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="type-title-sm text-foreground">{label}</p>
        {hint && <p className="type-body-sm text-lapis">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** The identity editor: name, theme, avatar, emoji, photo and tone. It is one
 * component because it appears in two places — the profile scope and the inside
 * of the profile's own card in the tutor's global scope. The theme list is the
 * live catalog from the store: there is no fixed theme and no limit of three.
 */
function ProfileIdentity({ p }: { p: Profile }) {
  const { state, dispatch } = useStore();
  const scheme = useResolvedScheme(state.settings.colorScheme);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiTab, setEmojiTab] = useState<EmojiCategoryId>("animais");
  const up = (patch: Partial<Profile>) => dispatch({ type: "updateProfile", id: p.id, patch });
  const theme = profileTheme(p.themeId, state.themes);
  const Hero = theme.hero;
  const ThemeArt = theme.avatarArt ? AVATAR_ART[theme.avatarArt] : null;
  const available = activeThemeList(state.themes);
  const emojiGroup = EMOJI_CATEGORIES.find((c) => c.id === emojiTab) ?? EMOJI_CATEGORIES[0]!;

  return (
    <>
      <input
        value={p.name}
        onChange={(e) => up({ name: e.target.value.slice(0, 16) })}
        aria-label="Apelido"
        className="h-10 w-full rounded-md border border-border bg-background px-3"
      />

      <label className="mt-3 block">
        <span className="mb-1.5 block font-medium">Descrição</span>
        <textarea
          value={p.personaLine ?? ""}
          onChange={(e) => {
            const text = e.target.value;
            // Blank means "use the band's suggestion": the data stays null,
            // never an empty string that would look like a written line.
            up({ personaLine: text.trim() ? text : null });
          }}
          maxLength={MAX_PERSONA_LENGTH}
          rows={2}
          aria-label="Descrição"
          placeholder={defaultPersonaLine(p.age)}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-lapis"
        />
        <span className="mt-1 block text-[11px] text-lapis">
          É o que aparece na Home de {p.name}. Em branco, o app usa a sugestão da idade.
        </span>
      </label>

      <div className="mt-3">
        <p className="mb-1.5 font-medium">Tema do perfil</p>
        <div className="grid grid-cols-2 gap-1.5">
          {available.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() =>
                up({
                  themeId: t.id,
                  // A custom theme has no illustration: it must not wipe the
                  // avatar the profile already wears.
                  ...(t.avatarArt ? { avatarCustom: t.avatarArt } : {}),
                })
              }
              aria-pressed={p.themeId === t.id}
              aria-label={`Usar tema ${t.label}`}
              className={cn(
                "flex h-11 min-w-0 items-center gap-2 rounded-md border border-border bg-background px-2.5 text-xs font-semibold",
                p.themeId === t.id && "ring-2 ring-foreground",
              )}
            >
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={themeDotStyle(t, scheme)}
                aria-hidden
              />
              <span aria-hidden>{t.emoji}</span>
              <span className="min-w-0 truncate">{t.label}</span>
            </button>
          ))}
        </div>
        <div
          className="mt-2 h-20 overflow-hidden rounded-md"
          style={themeSurfaceStyle(theme, scheme)}
        >
          {Hero ? (
            <Hero className="h-full w-full" />
          ) : (
            <p className="flex h-full items-center justify-center px-3 text-center text-xs">
              {theme.hint}
            </p>
          )}
        </div>
        <ThemeManager themes={state.themes} currentId={theme.id} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ThemeArt && theme.avatarArt && (
          <button
            type="button"
            onClick={() => up({ avatarCustom: theme.avatarArt, emojiAvatar: null })}
            aria-label={`Ilustração do tema ${theme.label}`}
            className={cn(
              "flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted",
              p.avatarCustom === theme.avatarArt &&
                p.emojiAvatar === null &&
                "ring-2 ring-foreground",
            )}
          >
            <ThemeArt className="h-10 w-10" />
          </button>
        )}
        {(Object.keys(AVATARS) as AvatarKey[]).map((k) => {
          const Icon = AVATARS[k].icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => up({ avatar: k, avatarCustom: null, emojiAvatar: null })}
              aria-label={AVATARS[k].label}
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full bg-muted",
                p.avatarCustom === null &&
                  p.emojiAvatar === null &&
                  p.avatar === k &&
                  "ring-2 ring-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setEmojiOpen((o) => !o)}
          aria-expanded={emojiOpen}
          aria-label="Escolher emoji"
          className={cn(
            "flex h-10 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-semibold",
            p.emojiAvatar && "ring-2 ring-foreground",
          )}
        >
          {p.emojiAvatar ?? "🙂"} Emoji
        </button>
      </div>

      {emojiOpen && (
        <div className="mt-2 rounded-md bg-muted p-2">
          <div className="flex gap-1" role="tablist" aria-label="Categorias de emoji">
            {EMOJI_CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={emojiTab === c.id}
                onClick={() => setEmojiTab(c.id)}
                className={cn(
                  "h-8 rounded-full px-3 text-[11px] font-semibold",
                  emojiTab === c.id ? "bg-foreground text-background" : "text-lapis",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-8 gap-1">
            {emojiGroup.emojis.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`Emoji ${e}`}
                aria-pressed={p.emojiAvatar === e}
                onClick={() => {
                  up({ emojiAvatar: e });
                  setEmojiOpen(false);
                }}
                className={cn(
                  "flex h-9 items-center justify-center rounded-sm text-xl",
                  p.emojiAvatar === e ? "bg-card ring-2 ring-foreground" : "hover:bg-card",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      <Row
        label="Foto (demonstração)"
        hint="No app real: escolher uma foto do aparelho. Nada sai do aparelho."
      >
        {p.photoUri ? (
          <button
            type="button"
            onClick={() => up({ photoUri: null })}
            className="h-9 whitespace-nowrap rounded-full bg-muted px-3 text-xs font-semibold"
          >
            Remover foto
          </button>
        ) : (
          <button
            type="button"
            onClick={() => up({ photoUri: placeholderPhotoUri(p.name) })}
            className="h-9 whitespace-nowrap rounded-full bg-muted px-3 text-xs font-semibold"
          >
            Usar foto
          </button>
        )}
      </Row>

      <div className="mt-1 flex gap-2">
        {(Object.keys(TONES) as ToneKey[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => up({ tone: t })}
            aria-label={`Cor ${t}`}
            className={cn(
              "h-8 w-8 rounded-full",
              TONES[t].solid,
              p.tone === t && "ring-2 ring-foreground ring-offset-2 ring-offset-card",
            )}
          />
        ))}
      </div>
    </>
  );
}

/**
 * Theme CRUD, in the identity block because a theme exists for a person.
 * Create runs from scratch (a seed color) or from an existing theme's roles;
 * duplicate keeps art and roles; rename edits the label; archive takes the
 * theme out of the picker without ever undressing a profile that wears it.
 * The list is the store's catalog: no cap of three, no fixed theme.
 */
const THEME_EMOJIS = ["🦕", "⚡", "🎨", "🐙", "🌻", "🚀", "🐳", "🌈", "🍀", "🐞"];

function nextEmoji(current: string): string {
  const index = THEME_EMOJIS.indexOf(current);
  return THEME_EMOJIS[(index + 1) % THEME_EMOJIS.length]!;
}

function ThemeManager({ themes, currentId }: { themes: Theme[]; currentId: string }) {
  const { state, dispatch } = useStore();
  const scheme = useResolvedScheme(state.settings.colorScheme);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [emoji, setEmoji] = useState(THEME_EMOJIS[2]!);
  const [seed, setSeed] = useState(THEME_SEEDS[0]!.hex);
  const [fromId, setFromId] = useState("");
  const active = themes.filter((t) => !t.archived);
  const archived = themes.filter((t) => t.archived);

  const submit = () => {
    const error = validateNewTheme(themes, label);
    if (error) {
      toast.error(error);
      return;
    }
    const draft: ThemeDraft = { label, emoji, seed, ...(fromId ? { fromId } : {}) };
    dispatch({ type: "createTheme", draft });
    setLabel("");
    setEmoji(THEME_EMOJIS[2]!);
    setSeed(THEME_SEEDS[0]!.hex);
    setFromId("");
    setCreating(false);
    toast.success("Tema criado");
  };

  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md bg-muted text-[11px] font-semibold text-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Gerenciar temas ({active.length})
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 transition-transform duration-150 ease-out",
              open && "rotate-180",
            )}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setCreating((c) => !c);
          }}
          className="flex h-9 items-center gap-1 rounded-md bg-foreground px-2.5 text-[11px] font-semibold text-background"
        >
          <Plus className="h-3.5 w-3.5" /> Novo tema
        </button>
      </div>

      {open && (
        <div className="mt-2 space-y-2 rounded-md border border-border bg-background p-2">
          <ul className="space-y-1" role="list">
            {active.map((t) => (
              <ThemeRow
                key={t.id}
                theme={t}
                all={themes}
                scheme={scheme}
                current={t.id === currentId}
                onlyOne={active.length <= 1}
              />
            ))}
          </ul>

          {archived.length > 0 && (
            <div className="rounded-md border border-dashed border-border p-1.5">
              <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-lapis">
                arquivados ({archived.length})
              </p>
              <ul className="space-y-1" role="list">
                {archived.map((t) => (
                  <li key={t.id} className="flex items-center gap-1.5">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={themeDotStyle(t, scheme)}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[11px]">{t.label}</span>
                    <button
                      type="button"
                      aria-label={`Desarquivar tema ${t.label}`}
                      onClick={() => {
                        dispatch({ type: "unarchiveTheme", id: t.id });
                        toast.success(`${t.label} voltou`);
                      }}
                      className="flex h-7 items-center gap-1 rounded-full bg-card px-2 text-[10px] font-semibold"
                    >
                      <ArchiveRestore className="h-3 w-3" /> Voltar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {creating && (
            <div role="group" aria-label="Novo tema" className="rounded-md bg-muted p-2">
              <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value.slice(0, 24))}
                aria-label="Nome do novo tema"
                placeholder="Ex.: Jardim"
                className="h-9 w-full rounded-md border border-border bg-card px-2.5 text-sm outline-none"
              />

              <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-lapis">
                emoji
              </p>
              <div
                className="mt-1 flex flex-wrap gap-1"
                role="group"
                aria-label="Emoji do novo tema"
              >
                {THEME_EMOJIS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    aria-label={`Emoji ${e}`}
                    aria-pressed={emoji === e}
                    onClick={() => setEmoji(e)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md text-base",
                      emoji === e ? "bg-card ring-2 ring-foreground" : "bg-card/60",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>

              <label className="mt-2 block">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-lapis">
                  base
                </span>
                <select
                  aria-label="Base do novo tema"
                  value={fromId}
                  onChange={(e) => setFromId(e.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-xs"
                >
                  <option value="">Do zero (cor nova)</option>
                  {active.map((t) => (
                    <option key={t.id} value={t.id}>
                      A partir de {t.label}
                    </option>
                  ))}
                </select>
              </label>

              {!fromId && (
                <>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-lapis">
                    cor base
                  </p>
                  <div
                    className="mt-1 flex flex-wrap gap-1.5"
                    role="group"
                    aria-label="Cor base do tema"
                  >
                    {THEME_SEEDS.map((s) => (
                      <button
                        key={s.hex}
                        type="button"
                        aria-label={`Cor base ${s.name}`}
                        aria-pressed={seed === s.hex}
                        onClick={() => setSeed(s.hex)}
                        style={{ background: s.hex }}
                        className={cn(
                          "h-8 w-8 rounded-full border border-border",
                          seed === s.hex &&
                            "ring-2 ring-foreground ring-offset-2 ring-offset-muted",
                        )}
                      />
                    ))}
                  </div>
                </>
              )}

              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setCreating(false)}
                  className="h-9 flex-1 rounded-md bg-card text-[11px] font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submit}
                  aria-label="Criar tema"
                  className="h-9 flex-1 rounded-md bg-foreground text-[11px] font-semibold text-background"
                >
                  Criar tema
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ThemeRow({
  theme,
  all,
  scheme,
  current,
  onlyOne,
}: {
  theme: Theme;
  all: Theme[];
  scheme: "light" | "dark";
  current: boolean;
  onlyOne: boolean;
}) {
  const { dispatch } = useStore();
  const [draft, setDraft] = useState(theme.label);

  const commit = () => {
    if (draft.trim() === theme.label) return;
    const attempt = renameTheme(all, theme.id, draft);
    if (attempt.error) {
      toast.error(attempt.error);
      setDraft(theme.label);
      return;
    }
    dispatch({ type: "renameTheme", id: theme.id, label: draft });
    toast.success("Tema renomeado");
  };

  return (
    <li className="flex items-center gap-1 rounded-md bg-card px-1.5 py-1">
      <button
        type="button"
        aria-label={`Trocar emoji do tema ${theme.label}`}
        title="Trocar emoji"
        onClick={() =>
          dispatch({ type: "updateTheme", id: theme.id, patch: { emoji: nextEmoji(theme.emoji) } })
        }
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm"
      >
        <span aria-hidden>{theme.emoji}</span>
      </button>
      <span
        className="h-2.5 w-2.5 shrink-0 rounded-full"
        style={themeDotStyle(theme, scheme)}
        aria-hidden
      />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, 24))}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            (e.currentTarget as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setDraft(theme.label);
            (e.currentTarget as HTMLInputElement).blur();
          }
        }}
        aria-label={`Nome do tema ${theme.label}`}
        className="h-7 min-w-0 flex-1 rounded-sm border border-transparent bg-transparent px-1 text-[11px] font-semibold outline-none focus:border-border"
      />
      {current && <span className="shrink-0 font-mono text-[9px] text-lapis">em uso</span>}
      <button
        type="button"
        aria-label={`Duplicar tema ${theme.label}`}
        title="Duplicar tema"
        onClick={() => {
          dispatch({ type: "duplicateTheme", id: theme.id });
          toast.success("Tema duplicado");
        }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted"
      >
        <Copy className="h-3 w-3" />
      </button>
      {/* The last active theme cannot be archived: the action is absent, not a
          disabled button a parent keeps tapping into nothing. */}
      {!onlyOne && (
        <button
          type="button"
          aria-label={`Arquivar tema ${theme.label}`}
          title="Arquivar (sai do seletor, não apaga)"
          onClick={() => {
            dispatch({ type: "archiveTheme", id: theme.id });
            toast.success("Tema arquivado");
          }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted"
        >
          <Archive className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}

function ProfileSettings({ p, back }: { p: Profile; back: Screen }) {
  const { state, dispatch, go } = useStore();
  const up = (patch: Partial<Profile>) => dispatch({ type: "updateProfile", id: p.id, patch });
  const mine = state.artworks.filter((a) => a.profileId === p.id);
  const drawings = mine.filter((a) => a.visibility !== "archived").length;
  const kept = mine.length - drawings;
  const activeCount = activeProfiles(state.profiles).length;

  const duplicate = () => {
    if (activeCount >= MAX_ACTIVE_PROFILES) {
      toast.error(`A família já tem ${MAX_ACTIVE_PROFILES} perfis ativos.`);
      return;
    }
    dispatch({ type: "duplicateProfile", id: p.id });
    toast.success("Cópia criada");
  };
  const archive = () => {
    if (activeCount <= 1) {
      toast.error("Deixe pelo menos um perfil ativo.");
      return;
    }
    dispatch({ type: "archiveProfile", id: p.id });
    toast("Perfil guardado", {
      duration: 5000,
      action: {
        label: "Desfazer",
        onClick: () => dispatch({ type: "unarchiveProfile", id: p.id }),
      },
    });
  };

  return (
    <div className="space-y-3">
      <Accordion
        icon={Users}
        title="Identidade"
        summary={p.name}
        defaultOpen
        testid="acc-identidade"
      >
        <ProfileIdentity p={p} />
      </Accordion>

      <Accordion
        icon={Images}
        title="Arquivos"
        summary={`${drawings} desenho${drawings === 1 ? "" : "s"}`}
        testid="acc-arquivos"
      >
        <p className="mb-2 text-[11px] text-lapis">
          {drawings} {drawings === 1 ? "desenho" : "desenhos"}
          {kept > 0 ? ` + ${kept} guardado${kept === 1 ? "" : "s"}` : ""}. Nada aqui sai do
          aparelho.
        </p>
        <button
          type="button"
          onClick={() => go({ name: "gallery", back })}
          aria-label={`Meus desenhos de ${p.name}`}
          className="inline-flex h-9 items-center gap-2 rounded-full bg-muted px-3 text-[11px] font-semibold text-foreground"
        >
          <Images className="h-3.5 w-3.5 text-pigmento" />
          Meus desenhos
          <ArrowRight className="h-3.5 w-3.5 text-lapis" />
        </button>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={duplicate}
            aria-label={`Duplicar ${p.name}`}
            title="Duplicar identidade e preferências, sem desenhos"
            className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-muted px-3 text-[11px] font-semibold"
          >
            <Copy className="h-3.5 w-3.5" /> Duplicar
          </button>
          {activeCount > 1 && (
            <button
              type="button"
              onClick={archive}
              aria-label={`Guardar perfil ${p.name}`}
              title="Arquivar (some da Home, não apaga)"
              className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-muted px-3 text-[11px] font-semibold"
            >
              <Archive className="h-3.5 w-3.5" /> Arquivar
            </button>
          )}
        </div>
        <p className="mt-2 text-[10px] text-lapis">
          Arquivar não apaga: o perfil sai da Home e volta pelo tutor global.
        </p>
      </Accordion>

      <Accordion
        icon={Palette}
        title="Atividade"
        summary={p.favoriteActivity === "colorir" ? "Colorir" : "Desenho livre"}
        testid="acc-atividade"
      >
        <p className="mb-2 text-[11px] text-lapis">
          O botão de criar abre primeiro esta opção — o estúdio é o mesmo.
        </p>
        <Seg
          label="Preferida"
          value={p.favoriteActivity ?? "livre"}
          options={[
            ["livre", "Desenho livre"],
            ["colorir", "Colorir"],
          ]}
          onChange={(v) => up({ favoriteActivity: v === "colorir" ? "colorir" : "livre" })}
        />
      </Accordion>
    </div>
  );
}

/**
 * Age band, mode, the six capabilities and the device tier of ONE profile. The
 * first three are per-profile values by nature, but the decision belongs to the
 * tutor — a child inside their own space can never widen what they are allowed
 * to use, nor lower the cost of the paper. It renders inside the profile's own
 * card, so there is no second profile list.
 */
export function ProfileRules({ p }: { p: Profile }) {
  const { dispatch } = useStore();
  const [confirmRestore, setConfirmRestore] = useState(false);
  const caps = capsOf(p);
  const up = (patch: Partial<Profile>) => dispatch({ type: "updateProfile", id: p.id, patch });

  return (
    <>
      <p className="mb-2 text-[11px] text-lapis">
        A idade define o padrão; desligado esconde da criança, não apaga nada.
      </p>

      <Seg
        label="Idade"
        value={p.age}
        options={[
          ["3-5", AGE_LABELS["3-5"]],
          ["6-8", AGE_LABELS["6-8"]],
          ["9+", AGE_LABELS["9+"]],
        ]}
        onChange={(v) => up({ age: v as AgeBand })}
      />
      <div className="mt-2">
        <Seg
          label="Modo"
          value={p.uiModeOverride ?? "auto"}
          options={[
            ["auto", "Automático"],
            ["kids", "Kids"],
            ["pro", "Pro"],
          ]}
          onChange={(v) => up({ uiModeOverride: v === "auto" ? null : (v as UiMode) })}
        />
      </div>

      <div className="mt-2 space-y-1.5">
        {CAPABILITY_KEYS.map((key: CapabilityKey) => {
          const dependent = key === "gradienteEfeitos" || key === "tecnicas";
          // Gradiente and techniques live inside the "Mais" panel: without it
          // they are not a choice, so they are not listed.
          if (dependent && !caps.ferramentasComplexas) return null;
          return (
            <div key={key} className="flex items-start gap-2 rounded-md px-1 py-1">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{CAPABILITY_COPY[key].label}</p>
                <p className="text-[11px] text-lapis">{CAPABILITY_COPY[key].hint}</p>
              </div>
              <Switch
                aria-label={CAPABILITY_COPY[key].label}
                checked={caps[key]}
                onCheckedChange={() => dispatch({ type: "toggleCap", id: p.id, key })}
              />
            </div>
          );
        })}
      </div>

      {/*
        The device tier of the stroke effects (efeitos-chevrons §7.7.6): a
        DECLARED flag, never a detector. It is not a capability — nothing is
        hidden or taken away — so it sits apart from the switches above, and it
        is the adult's call on the device that struggles. It touches no artwork,
        colour, tool or slot: only how many blurs/passes the engine emits.
      */}
      <div
        className="mt-2 flex items-start gap-2 rounded-md bg-muted px-2 py-1.5"
        role="group"
        aria-label="Desempenho neste aparelho"
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold">Efeitos mais simples neste aparelho</p>
          <p className="text-[11px] text-lapis">
            Se a sombra e o brilho deixam o desenho lento aqui, ligue: o desenho continua o mesmo,
            só os efeitos ficam mais leves. Desligado é o padrão.
          </p>
        </div>
        <Switch
          aria-label="Efeitos mais simples neste aparelho"
          checked={p.lowPower === true}
          onCheckedChange={(on) => dispatch({ type: "setLowPower", id: p.id, on })}
        />
      </div>

      {confirmRestore ? (
        <div className="mt-2 rounded-md bg-muted p-2">
          <p className="text-[11px]">
            Voltar ao padrão {AGE_LABELS[p.age]} de {p.name}? Os desenhos ficam.
          </p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmRestore(false)}
              className="h-8 flex-1 rounded-sm bg-card text-[11px] font-semibold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                dispatch({ type: "restoreAgeDefaults", id: p.id });
                setConfirmRestore(false);
                toast(`Padrão de ${AGE_LABELS[p.age]} restaurado`);
              }}
              className="h-8 flex-1 rounded-sm bg-foreground text-[11px] font-semibold text-background"
            >
              Restaurar padrão
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirmRestore(true)}
          className="mt-2 h-8 w-full rounded-sm border border-border text-[11px] font-semibold text-lapis"
        >
          Restaurar padrão da idade
        </button>
      )}
    </>
  );
}

function Seg({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="font-medium">{label}</span>
      <div className="flex rounded-full bg-muted p-1">
        {options.map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "h-8 rounded-full px-3 text-xs font-semibold",
              value === v ? "bg-foreground text-background" : "text-lapis",
            )}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}
