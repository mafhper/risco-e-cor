import { createContext, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import {
  SEED_AGES,
  capsOf,
  type AgeBand,
  type Capabilities,
  type CapabilityKey,
  type UiMode,
} from "./capabilities";
import {
  emptyHistory,
  glowOf,
  nozzleOf,
  push,
  shadowOf,
  type Command,
  type GlowEffect,
  type History,
  type Point,
  type ShadowEffect,
  type SpraySettings,
} from "./history";
import { archivePiece, duplicatePiece, unarchivePiece } from "./lifecycle";
import { themeAvatarArt, type AvatarArtId } from "./profileThemes";
import {
  archiveTheme,
  createTheme,
  defaultThemes,
  duplicateTheme,
  normalizeThemes,
  renameTheme,
  themeIdOrFallback,
  unarchiveTheme,
  updateTheme,
  type Theme,
  type ThemeDraft,
} from "./themes";
import { MAX_PERSONA_LENGTH } from "./persona";
import {
  GRID_CELL_UNITS,
  GRID_DENSITIES,
  GRID_PATTERNS,
  GRID_STRENGTHS,
  PAPER_TEXTURES,
  PAPER_TONES,
  isPaperKey,
  type GridDensity,
  type GridPattern,
  type GridStrength,
  type PaperKey,
  type PaperTexture,
  type PaperTone,
} from "./palette";
import { PHONE_SHEET, growSheetToPhone, type Workspace } from "./artworks";
import {
  archiveProfile,
  createProfile,
  duplicateProfile,
  fallbackProfile,
  moveProfile,
  normalizeOrder,
  removeProfile,
  setFamilyMode,
  unarchiveProfile,
  type FamilyMode,
  type ProfileDraft,
} from "./profiles";
import { isColorScheme, type ColorScheme } from "./theme";

export type { AgeBand, UiMode } from "./capabilities";
export type { ColorScheme } from "./theme";
export type { FamilyMode } from "./profiles";

export type AvatarKey = "cat" | "dog" | "bird" | "fish" | "rabbit" | "turtle";
export type ToneKey = "coral" | "sun" | "sky" | "mint" | "lilac";

/** The pencil's point, as the sheet's segmented control names it. */
export type Hardness = "soft" | "medium" | "hard";

/**
 * What one material remembers for one person: the colour it carries and the
 * settings that belong to its own stroke. Absent keys read the band defaults — a
 * material the author never tuned does not get a row of zeroes, and a save
 * written before this field loads exactly as before.
 *
 * The thickness (1..100) is deliberately NOT here: it is ONE number per person,
 * outside the per-material map, so switching materials keeps the point in use
 * and the new material inherits it (owner's decision, 26/10, §11.3). A save
 * written when this map still carried `size` keeps its colour, opacity, water
 * and hardness — only the old per-material point is dropped, because reading it
 * back would be exactly the "each material returns to its own size" that the
 * decision forbids.
 *
 * The spray's nozzle is NOT here either: it already lives in `Profile.spray`,
 * which is the same one-per-person memory (and the stroke carries its own copy).
 */
export type ToolMemory = {
  color?: string;
  /** 20..100, as the sheet's slider. */
  opacity?: number;
  /** 0..100, watercolour only. */
  water?: number;
  hardness?: Hardness;
  /**
   * The two stroke effects this material was last tuned with (efeitos-chevrons
   * §7.5). The object carries the switch AND the parameters, so turning the
   * effect off remembers the tuning instead of throwing it away. Absent = off,
   * which is how a save written before them (or a material nobody tuned) reads.
   */
  sombra?: ShadowEffect;
  brilho?: GlowEffect;
};

/** The band a stored value may live in; a backup is never trusted. */
const clampInt = (value: unknown, min: number, max: number): number | undefined => {
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, Math.round(n)));
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

const isHardness = (value: unknown): value is Hardness =>
  value === "soft" || value === "medium" || value === "hard";

/**
 * One memory entry, cleaned key by key. Only what the panel can show survives:
 * an out-of-range number, an unknown hardness or a malformed colour is DROPPED
 * (the default reads through), never clamped into a value nobody chose.
 */
export function toolMemoryOf(raw: unknown): ToolMemory {
  if (!raw || typeof raw !== "object") return {};
  const stored = raw as Record<string, unknown>;
  const memory: ToolMemory = {};
  const opacity = clampInt(stored["opacity"], 20, 100);
  if (opacity !== undefined) memory.opacity = opacity;
  const water = clampInt(stored["water"], 0, 100);
  if (water !== undefined) memory.water = water;
  if (isHardness(stored["hardness"])) memory.hardness = stored["hardness"];
  if (isHexColor(stored["color"])) memory.color = stored["color"].toUpperCase();
  // The effects are cleaned by the SAME readers the panel and the engine use:
  // a stored value out of range is clamped, a malformed colour falls back to
  // "auto", and the switch only survives as a real boolean.
  if (stored["sombra"] && typeof stored["sombra"] === "object") {
    memory.sombra = shadowOf(stored["sombra"] as ShadowEffect);
  }
  if (stored["brilho"] && typeof stored["brilho"] === "object") {
    memory.brilho = glowOf(stored["brilho"] as GlowEffect);
  }
  return memory;
}

/** The whole map, with only entries that still carry something to remember. */
export function normalizeToolSettings(raw: unknown): Record<string, ToolMemory> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const entries: [string, ToolMemory][] = [];
  for (const [tool, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof tool !== "string" || !tool) continue;
    const memory = toolMemoryOf(value);
    if (Object.keys(memory).length > 0) entries.push([tool, memory]);
    if (entries.length >= 24) break;
  }
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** The four folds of the pro sheet, in the order they are read (§7.1 + efeitos §7.1). */
export const PANEL_SECTION_KEYS = ["ajustes", "cor", "sombra", "brilho"] as const;
export type PanelSectionKey = (typeof PANEL_SECTION_KEYS)[number];
/** Which fold of the pro sheet is open, per person. */
export type PanelSections = Record<PanelSectionKey, boolean>;

/**
 * A profile that never touched the folds reads these (owner's decision, 27/10;
 * it supersedes the 26/10 pair): ALL FOUR CLOSED. The sheet opens as a short
 * list — the shelf, the preview and four headers — and the person opens exactly
 * the fold they came for instead of scrolling past sliders and a palette they
 * did not ask for. The two effect folds were already closed (an effect nobody
 * turned on does not earn a longer sheet, `efeitos-chevrons` §7.5).
 *
 * Being the DEFAULT is all this is: the choice is still remembered per profile
 * from the first touch (`profile.secoesPainel`), so a fold left open comes back
 * open — and `panelSectionsOf` keeps reading an older save's keys one by one.
 */
export const PANEL_SECTIONS_DEFAULT: PanelSections = {
  ajustes: false,
  cor: false,
  sombra: false,
  brilho: false,
};

/**
 * The stored fold state, cleaned one key at a time: only a real boolean is
 * trusted, and a key a save does not name keeps its default. Absence (a save
 * written before the folds, or a profile the author just restored) therefore
 * reads the defaults without migration.
 */
export function panelSectionsOf(raw: unknown): PanelSections {
  const sections: PanelSections = { ...PANEL_SECTIONS_DEFAULT };
  if (!raw || typeof raw !== "object") return sections;
  const stored = raw as Record<string, unknown>;
  for (const key of PANEL_SECTION_KEYS) {
    const value = stored[key];
    if (typeof value === "boolean") sections[key] = value;
  }
  return sections;
}

/**
 * THE PAPER'S OWN LOOK, as one object (owner's decision, 27/10, `chrome-v2`):
 * the material (`linho / grafite / quadriculado`), the printed texture
 * (`lisa / média / acentuada`) and the tone (`claro / areia / creme`), plus the
 * fold's open state. It lives in the PROFILE, not in the global settings: two
 * people share the device and one of them choosing a cream sheet must not
 * repaint the other's. Absent keys read `PAPER_LOOK_DEFAULT`.
 *
 * The tone is BLOCKED on 3–5 (a kid's paper is neutral by ADR) — the reader
 * here is band-agnostic and returns exactly what was stored; the screen is what
 * refuses to paint a tone on a child's sheet (`paperToneOf`).
 */
export type PaperLook = {
  key: PaperKey;
  texture: PaperTexture;
  tone: PaperTone;
  /** The `Papel` fold's disclosure, remembered like every other fold. */
  open: boolean;
};

export const PAPER_LOOK_DEFAULT: PaperLook = {
  key: "linho",
  texture: "lisa",
  tone: "claro",
  open: false,
};

/**
 * THE GRID'S OWN LOOK (same decision, same day): the switch the fold's header
 * carries, the pattern, the density (which IS the cell: 16/24/32 artwork units)
 * and the strength. It is a WORKING guide and never a command — no key here
 * ever reaches the artwork, the save or the export.
 */
export type GridLook = {
  on: boolean;
  pattern: GridPattern;
  density: GridDensity;
  strength: GridStrength;
  /** The `Grade` fold's disclosure. */
  open: boolean;
};

export const GRID_LOOK_DEFAULT: GridLook = {
  on: false,
  pattern: "quadrado",
  density: "media",
  strength: "sutil",
  open: false,
};

/**
 * The stored paper look, cleaned key by key: an unknown material, texture or
 * tone is DROPPED (the default reads through), exactly like every other field a
 * backup may carry. `base` is the global preference the profile has never
 * overridden — a canvas opened before this field existed starts on the paper the
 * adult chose in Preferences.
 */
export function paperLookOf(raw: unknown, base: PaperKey = "linho"): PaperLook {
  const look: PaperLook = { ...PAPER_LOOK_DEFAULT, key: isPaperKey(base) ? base : "linho" };
  if (!raw || typeof raw !== "object") return look;
  const stored = raw as Record<string, unknown>;
  if (isPaperKey(stored["key"])) look.key = stored["key"];
  if (PAPER_TEXTURES.includes(stored["texture"] as PaperTexture)) {
    look.texture = stored["texture"] as PaperTexture;
  }
  if (PAPER_TONES.includes(stored["tone"] as PaperTone)) look.tone = stored["tone"] as PaperTone;
  if (typeof stored["open"] === "boolean") look.open = stored["open"];
  return look;
}

/** The stored grid look, cleaned the same way — absence is the default. */
export function gridLookOf(raw: unknown): GridLook {
  const look: GridLook = { ...GRID_LOOK_DEFAULT };
  if (!raw || typeof raw !== "object") return look;
  const stored = raw as Record<string, unknown>;
  if (typeof stored["on"] === "boolean") look.on = stored["on"];
  if (GRID_PATTERNS.includes(stored["pattern"] as GridPattern)) {
    look.pattern = stored["pattern"] as GridPattern;
  }
  if (GRID_DENSITIES.includes(stored["density"] as GridDensity)) {
    look.density = stored["density"] as GridDensity;
  }
  if (GRID_STRENGTHS.includes(stored["strength"] as GridStrength)) {
    look.strength = stored["strength"] as GridStrength;
  }
  if (typeof stored["open"] === "boolean") look.open = stored["open"];
  return look;
}

/** The guide the sheet paints, or `null` when the grid is off. */
export function gridGuideOf(look: GridLook): {
  pattern: GridPattern;
  cell: number;
  strength: GridStrength;
} | null {
  if (!look.on) return null;
  return { pattern: look.pattern, cell: GRID_CELL_UNITS[look.density], strength: look.strength };
}

/** The keys a stored paper/grid object may carry, for the two writers below. */
const isOneOf = <T extends string>(order: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (order as readonly string[]).includes(value);

/** What a `setPaperLook` patch may carry, already validated. */
export function paperLookPatch(patch: Partial<PaperLook>): Partial<PaperLook> {
  const clean: Partial<PaperLook> = {};
  if (isPaperKey(patch.key)) clean.key = patch.key;
  if (isOneOf(PAPER_TEXTURES, patch.texture)) clean.texture = patch.texture;
  if (isOneOf(PAPER_TONES, patch.tone)) clean.tone = patch.tone;
  if (typeof patch.open === "boolean") clean.open = patch.open;
  return clean;
}

export function gridLookPatch(patch: Partial<GridLook>): Partial<GridLook> {
  const clean: Partial<GridLook> = {};
  if (typeof patch.on === "boolean") clean.on = patch.on;
  if (isOneOf(GRID_PATTERNS, patch.pattern)) clean.pattern = patch.pattern;
  if (isOneOf(GRID_DENSITIES, patch.density)) clean.density = patch.density;
  if (isOneOf(GRID_STRENGTHS, patch.strength)) clean.strength = patch.strength;
  if (typeof patch.open === "boolean") clean.open = patch.open;
  return clean;
}

/** The cell a density paints, in artwork units (the one rule the suite reads). */
export const cellOfDensity = (density: GridDensity): number => GRID_CELL_UNITS[density];

export type Profile = {
  id: string;
  name: string;
  avatar: AvatarKey;
  tone: ToneKey;
  age: AgeBand;
  /** Which theme dresses this profile; an id in `state.themes`, never fixed. */
  themeId: string;
  /** Themed avatar illustration; null = emoji or the animal icon below. */
  avatarCustom: AvatarArtId | null;
  /** Chosen identity emoji; null = themed illustration / animal icon. */
  emojiAvatar: string | null;
  /** Local photo placeholder (data URI) — never leaves the device. */
  photoUri: string | null;
  /** Adult lock on kids/pro; null = derived from the age band. */
  uiModeOverride: UiMode | null;
  /** Only what the adult changed; defaults are re-derived from the band. */
  capsOverride: Partial<Capabilities> | null;
  /**
   * The one-line description of this person, written by the adult. null =
   * the band's suggestion (persona.ts). Never derived from anything the child
   * did, and never shows the age band.
   */
  personaLine: string | null;
  /** Which creation entry this person reaches for first. Absent = free drawing. */
  favoriteActivity?: "livre" | "colorir";
  /** Palette memory for the pro tray (max 16 each, most recent first). */
  recentColors: string[];
  favoriteColors: string[];
  /**
   * The tools this profile keeps in the toolbar row, in its own order. Absent
   * = the band's default set. This replaced "favorite tools": the list is the
   * shortcut itself, so a tool is either in the row or out of it — there is no
   * second, decorative state (owner's call, 24/10).
   */
  toolSlots?: string[];
  /**
   * The spray nozzle this person draws with, so the can opens where they left
   * it. Absent = the shelf's own (history.ts `SPRAY_DEFAULTS`), which is how a
   * save written before the field existed loads. The STROKE still carries its
   * own copy: a gallery piece must not change when the author tunes the panel.
   */
  spray?: SpraySettings;
  /**
   * What each material remembers for this person — colour, opacity, water,
   * hardness and the two effects. Absent = the band defaults. Kept per profile
   * because a child and an adult share the device, and one of them tuning the
   * watercolour must not move the other's.
   *
   * The thickness is NOT in here: it is `strokeSize`, one number per person.
   */
  toolSettings?: Record<string, ToolMemory>;
  /**
   * The 1..100 thickness in use, ONE per person and outside the per-material
   * map (owner's decision, 26/10, `painel-chevrons` §11.3). Switching material
   * keeps the number, and the material that arrives inherits it — no material
   * has "its own" point to return to. Absent = the band default.
   */
  strokeSize?: number;
  /**
   * Which fold of the pro sheet this person keeps open (owner's decision,
   * 26/10). Absent = `PANEL_SECTIONS_DEFAULT`, which is also what "Restaurar
   * padrão da idade" returns to. Kids profiles never read or write it: they
   * have no sheet.
   */
  secoesPainel?: PanelSections;
  /**
   * The weak-device fallback of the stroke effects, DECLARED by a person and
   * never detected (owner's decision, 26/10, efeitos-chevrons §7.7.6). On, the
   * post-pass contains the blur at `LOW_POWER_BLUR`, drops the spread and keeps
   * each effect in a single pass; off, the engine emits exactly what it always
   * did. Absent = the full tier, which is how a save written before the field
   * loads: no device falls into the fallback on its own.
   *
   * It changes no command, no save and no replay — the artwork is the same,
   * only how many blurs/passes the engine emits changes. Remembered per profile
   * like the rest of the panel's memory, and turning it off restores the
   * ABSENCE, so "never touched" and "turned off" are the same state.
   */
  lowPower?: boolean;
  /**
   * The paper's own look (material + printed texture + tone) for this person
   * (owner's decision, 27/10, `chrome-v2` §4). Absent = the defaults over the
   * adult's global preference, which is how a save written before the fold loads.
   */
  papel?: PaperLook;
  /** The working grid this person keeps (pattern/density/strength), same date. */
  grade?: GridLook;
  /** Unique integer; the ONLY source of order (never the array index). */
  order: number;
  /** Epoch ms, fixed at creation — duplicating gets a fresh one. */
  createdAt: number;
  /** Out of the Home, kept in the tutor list: nothing is deleted. */
  archived: boolean;
  /**
   * The profile left the Home because the family chose "Apenas 1 criança",
   * not because the adult archived it. Returning to "Compartilhado" restores
   * exactly these, never the ones the adult put away by hand.
   */
  modeArchived?: boolean;
};

/** Where a piece lives: the family mural, the author's gallery, or "Guardados". */
export type Visibility = "draft" | "published" | "archived";

export type Settings = {
  sound: boolean;
  vibration: boolean;
  voice: boolean;
  stabilization: number; // 0..3
  /** Global (level G): follows the device unless the adult pins it. */
  colorScheme: ColorScheme;
  /** The complete paper appearance lives in Preferences; the canvas reads it. */
  paper: PaperKey;
  /** "Apenas 1 criança" collapses the Home to one hero; never deletes. */
  familyMode: FamilyMode;
  /** First-run choice already made; false opens the setup screen. */
  setupDone: boolean;
  /** The demonstration hand is allowed (the adult can turn it off). */
  demo: boolean;
};

export type Artwork = {
  id: string;
  profileId: string;
  pageId: string | null;
  w: number;
  h: number;
  history: History;
  createdAt: number;
  updatedAt: number;
  visibility: Visibility;
  /** When it entered the mural; republishing bumps it so the piece rises. */
  publishedAt: number | null;
  celebrated?: boolean;
};

/**
 * Screens carry their own return target. The stack is data, not history:
 * back always returns exactly where the screen was opened from, and a child
 * never crosses from one profile's interior into another's.
 *
 * There is no entry picker: the app opens on `home`, and a profile is entered
 * from the Home's profile row — the only place that changes the active profile.
 */
export type Screen =
  | { name: "home" }
  | { name: "setup" }
  | { name: "profile" }
  | { name: "pages"; back: Screen }
  | { name: "canvas"; artworkId: string; back: Screen }
  | { name: "gallery"; back: Screen }
  | { name: "view"; artworkId: string; readonly?: boolean; back: Screen }
  | { name: "gate"; target: "global" | "profile"; back: Screen }
  | { name: "adult"; focus: "global" | "profile"; back: Screen };

/** Which pieces the mural inside a profile shows. Kept in the store so the
 *  choice survives a detour to the canvas or the gallery. */
export type MuralScope = "mine" | "all";

/**
 * The dock's three levels (owner's decision, 27/10, `compacta-unificada` §12.7).
 * The level is SESSION state per profile — it survives closing and re-entering
 * the profile, switches when the profile switches, and is deliberately NOT part
 * of the localStorage payload: a reload starts at the pill.
 */
export type DockLevel = "mini" | "compact" | "expanded";

/**
 * The artwork each person last had open in each workspace (owner's decision,
 * 27/10, `workspace-switcher` §6.1). Two live works at once, one per workspace:
 * switching takes the other one back exactly as it was left — same commands,
 * same undo/redo, because the piece is the stored artwork, never a copy.
 *
 * Session state per profile, like `dockLevels`: a reload starts from the sheet
 * the navigation asked for, and an id that no longer exists is simply ignored.
 */
export type WorkspaceArt = { draw?: string; paint?: string };

export type State = {
  loaded: boolean;
  screen: Screen;
  profileId: string | null;
  profiles: Profile[];
  /** The live theme catalog: shipped themes plus everything the tutor created. */
  themes: Theme[];
  settings: Settings;
  artworks: Artwork[];
  trash: Artwork[];
  crashLog: { at: number; message: string }[];
  muralScope: MuralScope;
  /** The dock level each profile keeps for this session, by profile id. */
  dockLevels: Record<string, DockLevel>;
  /** The artwork open in each workspace, per profile, for this session. */
  workspaceArts: Record<string, WorkspaceArt>;
  /** The 5-second net under "Jogar fora": the last piece sent to the trash. */
  undoTrash: { id: string } | null;
};

type Action =
  | { type: "load"; state: Partial<State> }
  | { type: "go"; screen: Screen }
  | { type: "selectProfile"; id: string }
  | { type: "setMuralScope"; scope: MuralScope }
  | { type: "setDockLevel"; id: string; level: DockLevel }
  | { type: "rememberWorkspace"; profileId: string; workspace: Workspace; artworkId: string }
  | { type: "updateProfile"; id: string; patch: Partial<Profile> }
  | { type: "createProfile"; draft: ProfileDraft }
  | { type: "moveProfile"; id: string; direction: -1 | 1 }
  | { type: "duplicateProfile"; id: string }
  | { type: "archiveProfile"; id: string }
  | { type: "unarchiveProfile"; id: string }
  | { type: "removeProfile"; id: string }
  | { type: "setFamilyMode"; mode: FamilyMode }
  | { type: "createTheme"; draft: ThemeDraft }
  | { type: "duplicateTheme"; id: string }
  | { type: "renameTheme"; id: string; label: string }
  | { type: "updateTheme"; id: string; patch: Partial<Pick<Theme, "emoji" | "hint" | "seed">> }
  | { type: "archiveTheme"; id: string }
  | { type: "unarchiveTheme"; id: string }
  | { type: "rememberColor"; id: string; hex: string }
  | { type: "toggleFavoriteColor"; id: string; hex: string }
  | { type: "setToolSlots"; id: string; slots: string[] }
  | { type: "setSpray"; id: string; spray: SpraySettings }
  | { type: "setToolMemory"; id: string; tool: string; patch: ToolMemory }
  | { type: "setStrokeSize"; id: string; size: number }
  | { type: "setPanelSection"; id: string; key: PanelSectionKey; open: boolean }
  | { type: "setLowPower"; id: string; on: boolean }
  | { type: "setPaperLook"; id: string; patch: Partial<PaperLook> }
  | { type: "setGridLook"; id: string; patch: Partial<GridLook> }
  | { type: "restoreAgeDefaults"; id: string }
  | { type: "toggleCap"; id: string; key: CapabilityKey }
  | { type: "updateSettings"; patch: Partial<Settings> }
  | { type: "createArtwork"; artwork: Artwork }
  | { type: "setHistory"; id: string; history: History }
  | { type: "celebrated"; id: string }
  | { type: "publish"; id: string }
  | { type: "unpublish"; id: string }
  | { type: "discardIfEmpty"; id: string }
  | { type: "trash"; id: string }
  | { type: "trashAllOf"; profileId: string }
  | { type: "restore"; id: string }
  | { type: "purge"; id: string }
  | { type: "emptyTrash" }
  | { type: "dismissUndo" }
  | { type: "archiveArtwork"; id: string }
  | { type: "unarchiveArtwork"; id: string }
  | { type: "duplicateArtwork"; id: string }
  | { type: "importBackup"; profiles: Profile[]; artworks: Artwork[]; settings: Settings }
  | { type: "reset" };

export const uid = () => Math.random().toString(36).slice(2, 10);

function seedHistory(cmds: Command[]): History {
  return cmds.reduce(push, emptyHistory());
}

function spiral(cx: number, cy: number, turns: number, r: number): Point[] {
  const pts: Point[] = [];
  const n = turns * 28;
  for (let i = 0; i <= n; i++) {
    const a = (i / 28) * Math.PI * 2;
    const rad = (i / n) * r;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return pts;
}

function seed(): Omit<State, "loaded"> {
  const now = Date.now();
  const profiles: Profile[] = [
    {
      id: "maria",
      name: "Maria",
      avatar: "cat",
      tone: "coral",
      age: "9+",
      themeId: "dinos",
      avatarCustom: "dino",
      emojiAvatar: null,
      photoUri: null,
      uiModeOverride: null,
      capsOverride: null,
      personaLine: null,
      favoriteActivity: "livre",
      recentColors: [],
      favoriteColors: [],
      order: 0,
      createdAt: now - 86400000 * 400,
      archived: false,
    },
    {
      id: "theo",
      name: "Theo",
      avatar: "dog",
      tone: "sky",
      age: "3-5",
      themeId: "heroi",
      avatarCustom: "heroi",
      emojiAvatar: null,
      photoUri: null,
      uiModeOverride: null,
      capsOverride: null,
      personaLine: null,
      favoriteActivity: "colorir",
      recentColors: [],
      favoriteColors: [],
      order: 1,
      createdAt: now - 86400000 * 200,
      archived: false,
    },
  ];
  const fishFills: Record<string, string> = {
    mar: "#5ec4e8",
    areia: "#ffd23f",
    corpo: "#f7853b",
    listra: "#ffffff",
    cauda: "#e8423f",
    nadadeira: "#e8423f",
    alga1: "#2fa35b",
  };
  const rocketFills: Record<string, string> = {
    espaco: "#2a2b30",
    planeta: "#8a5cd6",
    anel: "#f28bc0",
    fogo: "#f7853b",
    asaE: "#e8423f",
    asaD: "#e8423f",
    corpo: "#ffffff",
    ponta: "#e8423f",
    janela: "#5ec4e8",
    estrela1: "#ffd23f",
    estrela2: "#ffd23f",
    estrela3: "#ffd23f",
    lua: "#ffd23f",
  };
  const fills = (f: Record<string, string>): Command[] =>
    Object.entries(f).map(([region, color]) => ({ t: "fill", region, color }));
  const drawing: Command[] = [
    { t: "stroke", id: uid(), color: "#ffd23f", size: 16, points: spiral(80, 80, 3, 40) },
    {
      t: "stroke",
      id: uid(),
      color: "#2fa35b",
      size: 9,
      points: [
        [20, 330],
        [80, 310],
        [150, 335],
        [220, 312],
        [285, 330],
      ],
    },
    {
      t: "stroke",
      id: uid(),
      color: "#e8423f",
      size: 9,
      points: [
        [110, 300],
        [110, 220],
        [190, 220],
        [190, 300],
        [110, 300],
      ],
    },
    {
      t: "stroke",
      id: uid(),
      color: "#9a6236",
      size: 9,
      points: [
        [100, 225],
        [150, 170],
        [200, 225],
      ],
    },
    {
      t: "stroke",
      id: uid(),
      color: "#2f6fd6",
      size: 4,
      points: [
        [200, 70],
        [215, 60],
        [230, 70],
        [245, 60],
        [260, 70],
      ],
    },
  ];
  /** Authored on a 3:4 sheet; the studio sheet is phone-tall, so centre it. */
  const dy = (PHONE_SHEET.h - 400) / 2;
  const drawingOnPhoneSheet: Command[] = drawing.map((c) =>
    c.t === "stroke" ? { ...c, points: c.points.map(([x, y]) => [x, y + dy] as Point) } : c,
  );
  const artworks: Artwork[] = [
    {
      id: uid(),
      profileId: "maria",
      pageId: "peixe",
      w: 300,
      h: 300,
      history: seedHistory(fills(fishFills)),
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
      visibility: "published",
      publishedAt: now - 86400000,
    },
    {
      id: uid(),
      profileId: "theo",
      pageId: "foguete",
      w: 300,
      h: 300,
      history: seedHistory(fills(rocketFills)),
      createdAt: now - 3600000,
      updatedAt: now - 3600000,
      visibility: "published",
      publishedAt: now - 3600000,
      celebrated: true,
    },
    {
      id: uid(),
      profileId: "theo",
      pageId: null,
      w: PHONE_SHEET.w,
      h: PHONE_SHEET.h,
      history: seedHistory(drawingOnPhoneSheet),
      createdAt: now - 7200000,
      updatedAt: now - 7200000,
      visibility: "draft",
      publishedAt: null,
    },
  ];
  return {
    screen: { name: "home" },
    profileId: null,
    profiles,
    themes: defaultThemes(),
    settings: {
      sound: true,
      vibration: true,
      voice: false,
      stabilization: 1,
      colorScheme: "system",
      paper: "linho",
      familyMode: "shared",
      // The demo family already exists: the first-run choice stays out of the
      // way and is re-openable from the adult area.
      setupDone: true,
      demo: true,
    },
    artworks,
    trash: [],
    crashLog: [],
    muralScope: "mine",
    dockLevels: {},
    workspaceArts: {},
    undoTrash: null,
  };
}

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "load":
      return { ...s, ...a.state, loaded: true };
    case "go":
      return { ...s, screen: a.screen };
    case "selectProfile": {
      // The one and only switch, and it happens on the Home: it also enters
      // that profile's space. An archived profile is never enterable.
      const target = s.profiles.find((p) => p.id === a.id);
      if (!target || target.archived) return s;
      return { ...s, profileId: a.id, screen: { name: "profile" } };
    }
    case "setMuralScope":
      return { ...s, muralScope: a.scope };
    case "setDockLevel": {
      // Same level = same state: a pointer-down on the paper asks for "mini" on
      // every stroke, and that must not re-render the tree when it is already
      // there.
      if (s.dockLevels[a.id] === a.level) return s;
      return { ...s, dockLevels: { ...s.dockLevels, [a.id]: a.level } };
    }
    case "rememberWorkspace": {
      // Same workspace, same piece = same state: an effect that runs on every
      // render of the canvas must not re-render the tree.
      const current = s.workspaceArts[a.profileId] ?? {};
      if (current[a.workspace] === a.artworkId) return s;
      const memory: WorkspaceArt = { ...current };
      memory[a.workspace] = a.artworkId;
      return { ...s, workspaceArts: { ...s.workspaceArts, [a.profileId]: memory } };
    }
    case "updateProfile":
      return { ...s, profiles: s.profiles.map((p) => (p.id === a.id ? { ...p, ...a.patch } : p)) };
    case "createProfile": {
      const change = createProfile(s.profiles, a.draft, uid(), Date.now());
      return change.error ? s : { ...s, profiles: change.profiles };
    }
    case "moveProfile": {
      const change = moveProfile(s.profiles, a.id, a.direction);
      return change.profiles === s.profiles ? s : { ...s, profiles: change.profiles };
    }
    case "duplicateProfile": {
      const change = duplicateProfile(s.profiles, a.id, uid(), Date.now());
      return change.error ? s : { ...s, profiles: change.profiles };
    }
    case "archiveProfile": {
      const change = archiveProfile(s.profiles, a.id);
      if (change.profiles === s.profiles) return s;
      // Archiving the active profile lands the app on the Home.
      if (s.profileId !== a.id) return { ...s, profiles: change.profiles };
      const next = fallbackProfile(change.profiles, a.id);
      return {
        ...s,
        profiles: change.profiles,
        profileId: next?.id ?? null,
        screen: { name: "home" },
      };
    }
    case "unarchiveProfile": {
      const change = unarchiveProfile(s.profiles, a.id);
      return change.error ? s : { ...s, profiles: change.profiles };
    }
    case "removeProfile": {
      // Trash keeps `profileId`: removing while it still holds pieces of this
      // profile would leave an orphan to restore. Both lists are checked.
      const change = removeProfile(s.profiles, a.id, [...s.artworks, ...s.trash]);
      if (change.error) return s;
      if (s.profileId !== a.id) return { ...s, profiles: change.profiles };
      const next = fallbackProfile(change.profiles, a.id);
      return {
        ...s,
        profiles: change.profiles,
        profileId: next?.id ?? null,
        screen: { name: "home" },
      };
    }
    case "setFamilyMode": {
      const change = setFamilyMode(s.profiles, a.mode);
      const settings = { ...s.settings, familyMode: a.mode, setupDone: true };
      if (change.profiles === s.profiles) return { ...s, settings };
      // Only a SELECTED profile that just left the Home sends the app Home.
      // Choosing the mode from the adult area must not close the adult area.
      if (s.profileId) {
        const current = change.profiles.find((p) => p.id === s.profileId);
        if (!current || current.archived) {
          return {
            ...s,
            profiles: change.profiles,
            settings,
            profileId: null,
            screen: { name: "home" },
          };
        }
      }
      return { ...s, profiles: change.profiles, settings };
    }
    case "createTheme": {
      const change = createTheme(s.themes, a.draft, uid(), Date.now());
      return change.error ? s : { ...s, themes: change.themes };
    }
    case "duplicateTheme": {
      const change = duplicateTheme(s.themes, a.id, uid(), Date.now());
      return change.error ? s : { ...s, themes: change.themes };
    }
    case "renameTheme": {
      const change = renameTheme(s.themes, a.id, a.label);
      return change.error ? s : { ...s, themes: change.themes };
    }
    case "updateTheme": {
      const change = updateTheme(s.themes, a.id, a.patch);
      return { ...s, themes: change.themes };
    }
    case "archiveTheme": {
      const change = archiveTheme(s.themes, a.id);
      return change.error ? s : { ...s, themes: change.themes };
    }
    case "unarchiveTheme": {
      const change = unarchiveTheme(s.themes, a.id);
      return change.error ? s : { ...s, themes: change.themes };
    }
    case "rememberColor":
      return {
        ...s,
        profiles: s.profiles.map((p) =>
          p.id === a.id
            ? {
                ...p,
                recentColors: [a.hex, ...p.recentColors.filter((h) => h !== a.hex)].slice(0, 16),
              }
            : p,
        ),
      };
    case "toggleFavoriteColor":
      return {
        ...s,
        profiles: s.profiles.map((p) => {
          if (p.id !== a.id) return p;
          const has = p.favoriteColors.includes(a.hex);
          return {
            ...p,
            favoriteColors: has
              ? p.favoriteColors.filter((h) => h !== a.hex)
              : [a.hex, ...p.favoriteColors].slice(0, 24),
          };
        }),
      };
    case "setToolSlots":
      return {
        ...s,
        profiles: s.profiles.map((p) =>
          p.id === a.id
            ? {
                ...p,
                // Unique and ordered: the row is exactly this array, so a
                // duplicate would render two identical buttons and two taps
                // would fight over the same slot.
                toolSlots: [...new Set(a.slots)].slice(0, 24),
              }
            : p,
        ),
      };
    case "setSpray":
      return {
        ...s,
        profiles: s.profiles.map((p) =>
          // Clamped on the way in: the profile is the one place that remembers
          // it, so a value the panel cannot show must never be stored.
          p.id === a.id ? { ...p, spray: nozzleOf(a.spray) } : p,
        ),
      };
    case "setToolMemory":
      return {
        ...s,
        profiles: s.profiles.map((p) => {
          if (p.id !== a.id) return p;
          // Cleaned on the way in: opacity and water stay inside the ranges the
          // panel can show, so a value it cannot display is never stored. The
          // colour is normalised to upper case, as every save is.
          const clean = toolMemoryOf(a.patch);
          if (Object.keys(clean).length === 0) return p;
          const current = p.toolSettings?.[a.tool] ?? {};
          return {
            ...p,
            toolSettings: { ...(p.toolSettings ?? {}), [a.tool]: { ...current, ...clean } },
          };
        }),
      };
    case "setStrokeSize": {
      // ONE number per person, outside the per-material map (§11.3): it is
      // clamped here so a value the panel cannot show is never stored, and it
      // is written whatever material is in hand — the material is not a key.
      const size = clampInt(a.size, 1, 100);
      if (size === undefined) return s;
      return {
        ...s,
        profiles: s.profiles.map((p) => (p.id === a.id ? { ...p, strokeSize: size } : p)),
      };
    }
    case "setPanelSection":
      return {
        ...s,
        profiles: s.profiles.map((p) => {
          if (p.id !== a.id) return p;
          const current = panelSectionsOf(p.secoesPainel);
          // Same state = same profile: opening a fold that is already open must
          // not re-render the sheet (and must not write a field equal to the
          // default, which would look like a preference nobody made).
          if (current[a.key] === a.open) return p;
          return { ...p, secoesPainel: { ...current, [a.key]: a.open } };
        }),
      };
    case "setLowPower":
      return {
        ...s,
        profiles: s.profiles.map((p) => {
          if (p.id !== a.id) return p;
          // The tier is absence-first, like the folds: turning it off DELETES
          // the field, so a profile that never declared it and one whose owner
          // turned it off are the same state (full tier) and nothing is written
          // twice. Turning it on only ever writes `true`, never a copy of the
          // current tuning: it touches no artwork, colour, tool or slot.
          if (!a.on) {
            if (p.lowPower === undefined) return p;
            const cleared: Profile = { ...p };
            delete cleared.lowPower;
            return cleared;
          }
          return p.lowPower === true ? p : { ...p, lowPower: true };
        }),
      };
    case "setPaperLook":
      return {
        ...s,
        profiles: s.profiles.map((p) => {
          if (p.id !== a.id) return p;
          // Cleaned on the way in, like every other profile field: a value the
          // picker cannot show is never stored, and a patch that changes nothing
          // does not re-render the canvas.
          const clean = paperLookPatch(a.patch);
          if (Object.keys(clean).length === 0) return p;
          const current = paperLookOf(p.papel);
          const next: PaperLook = { ...current, ...clean };
          if (
            next.key === current.key &&
            next.texture === current.texture &&
            next.tone === current.tone &&
            next.open === current.open
          ) {
            return p;
          }
          return { ...p, papel: next };
        }),
      };
    case "setGridLook":
      return {
        ...s,
        profiles: s.profiles.map((p) => {
          if (p.id !== a.id) return p;
          const clean = gridLookPatch(a.patch);
          if (Object.keys(clean).length === 0) return p;
          const current = gridLookOf(p.grade);
          const next: GridLook = { ...current, ...clean };
          if (
            next.on === current.on &&
            next.pattern === current.pattern &&
            next.density === current.density &&
            next.strength === current.strength &&
            next.open === current.open
          ) {
            return p;
          }
          return { ...p, grade: next };
        }),
      };
    case "toggleCap":
      return {
        ...s,
        profiles: s.profiles.map((p) => {
          if (p.id !== a.id) return p;
          // Only the difference from the band is stored; "restore" clears it.
          const next = { ...(p.capsOverride ?? {}), [a.key]: !capsOf(p)[a.key] };
          return { ...p, capsOverride: next };
        }),
      };
    case "restoreAgeDefaults":
      return {
        ...s,
        profiles: s.profiles.map((p) => {
          if (p.id !== a.id) return p;
          // The tool memory is "the last settings of each material", which is
          // exactly what restoring the band resets — the drawings, the palette's
          // recents and the slots are other preferences and stay where they are.
          // The thickness goes back to the band's own number, and the folds go
          // back to their defaults (Ajustes/Cor open, Sombra/Brilho closed):
          // deleting the fields IS the default, so nothing is written twice.
          // The device tier goes back to the FULL one for the same reason: a
          // restored profile is a profile nobody declared the fallback on
          // (owner's decision, 26/10, efeitos-chevrons §7.7.6).
          const cleared: Profile = { ...p, uiModeOverride: null, capsOverride: null };
          delete cleared.toolSettings;
          delete cleared.strokeSize;
          delete cleared.secoesPainel;
          delete cleared.lowPower;
          // The paper's look and the grid are band parameters too: restoring
          // the age returns the neutral sheet and the guide OFF — the same state
          // as a profile nobody ever tuned.
          delete cleared.papel;
          delete cleared.grade;
          return cleared;
        }),
      };
    case "updateSettings":
      return { ...s, settings: { ...s.settings, ...a.patch } };
    case "createArtwork":
      return { ...s, artworks: [a.artwork, ...s.artworks] };
    case "setHistory":
      return {
        ...s,
        artworks: s.artworks.map((w) =>
          w.id === a.id ? { ...w, history: a.history, updatedAt: Date.now() } : w,
        ),
      };
    case "celebrated":
      return {
        ...s,
        artworks: s.artworks.map((w) => (w.id === a.id ? { ...w, celebrated: true } : w)),
      };
    case "publish":
      return {
        ...s,
        artworks: s.artworks.map((w) =>
          w.id === a.id ? { ...w, visibility: "published", publishedAt: Date.now() } : w,
        ),
      };
    case "unpublish":
      return {
        ...s,
        artworks: s.artworks.map((w) =>
          w.id === a.id ? { ...w, visibility: "draft", publishedAt: null } : w,
        ),
      };
    case "discardIfEmpty":
      return {
        ...s,
        artworks: s.artworks.filter((w) => w.id !== a.id || w.history.commands.length > 0),
      };
    case "trash": {
      const w = s.artworks.find((x) => x.id === a.id);
      if (!w) return s;
      return {
        ...s,
        artworks: s.artworks.filter((x) => x.id !== a.id),
        trash: [w, ...s.trash],
        undoTrash: { id: w.id },
      };
    }
    case "trashAllOf": {
      const moving = s.artworks.filter((x) => x.profileId === a.profileId);
      return {
        ...s,
        artworks: s.artworks.filter((x) => x.profileId !== a.profileId),
        trash: [...moving, ...s.trash],
        undoTrash: null,
      };
    }
    case "restore": {
      const w = s.trash.find((x) => x.id === a.id);
      if (!w) return s;
      return {
        ...s,
        trash: s.trash.filter((x) => x.id !== a.id),
        artworks: [w, ...s.artworks],
        undoTrash: s.undoTrash?.id === a.id ? null : s.undoTrash,
      };
    }
    case "purge":
      return {
        ...s,
        trash: s.trash.filter((x) => x.id !== a.id),
        undoTrash: s.undoTrash?.id === a.id ? null : s.undoTrash,
      };
    case "emptyTrash":
      return { ...s, trash: [], undoTrash: null };
    case "dismissUndo":
      return s.undoTrash ? { ...s, undoTrash: null } : s;
    case "archiveArtwork":
      return {
        ...s,
        artworks: s.artworks.map((w) => (w.id === a.id ? archivePiece(w) : w)),
      };
    case "unarchiveArtwork":
      return {
        ...s,
        artworks: s.artworks.map((w) => (w.id === a.id ? unarchivePiece(w) : w)),
      };
    case "duplicateArtwork": {
      const source = s.artworks.find((w) => w.id === a.id);
      if (!source) return s;
      return {
        ...s,
        artworks: [duplicatePiece(source, uid(), Date.now()), ...s.artworks],
      };
    }
    case "importBackup":
      return {
        ...s,
        // A backup may name themes this device never had: those profiles land
        // on the neutral theme instead of a blank surface. The local catalog is
        // never replaced by a file.
        profiles: normalizeOrder(
          a.profiles.map((p) => ({
            ...p,
            themeId: themeIdOrFallback(s.themes, p.themeId),
          })),
        ),
        artworks: a.artworks,
        settings: a.settings,
        profileId: null,
        screen: { name: "home" },
        undoTrash: null,
      };
    case "reset":
      return { ...seed(), loaded: true };
  }
}

const KEY = "colorir-mockup-v1";

/** Themes for the demo seeds, so saves from before themes keep their look. */
const SEED_THEMES: Record<string, string> = { maria: "dinos", theo: "heroi" };

/** The shape written by saves from before themes/photos existed. */
type StoredProfile = Omit<
  Profile,
  | "themeId"
  | "avatarCustom"
  | "emojiAvatar"
  | "photoUri"
  | "age"
  | "uiModeOverride"
  | "capsOverride"
  | "recentColors"
  | "favoriteColors"
  | "personaLine"
  | "order"
  | "createdAt"
  | "archived"
> &
  Partial<
    Pick<
      Profile,
      | "themeId"
      | "avatarCustom"
      | "emojiAvatar"
      | "photoUri"
      | "age"
      | "uiModeOverride"
      | "capsOverride"
      | "recentColors"
      | "favoriteColors"
      | "personaLine"
      | "order"
      | "createdAt"
      | "archived"
    >
  >;
/** The shape written by saves from before draft/published existed. */
type StoredArtwork = Omit<Artwork, "visibility" | "publishedAt"> &
  Partial<Pick<Artwork, "visibility" | "publishedAt">>;

/**
 * Old saves predate themes, photos, modes and capabilities. Fill the defaults
 * and fix the two demo seeds, whose age bands were written inverted — the
 * product truth is Theo ~4 and Maria ~12. A profile the adult created keeps
 * the band they chose. Nothing else is touched.
 *
 * Saves that predate `order`/`createdAt`/`archived` get the array index as
 * order, 0 as createdAt and `archived: false` — the order the adult already
 * sees, so nothing moves on upgrade (crud-perfis-global §6, F1).
 */
export function normalizeProfiles(profiles: StoredProfile[]): Profile[] {
  const mapped = profiles.map((p, index) => {
    const themeId = p.themeId ?? SEED_THEMES[p.id] ?? "neutro";
    // A save written before the adaptive fields existed is exactly the save
    // whose seeds were inverted. Once the save carries the new fields it is a
    // band the adult may have chosen, so it is kept.
    const legacySave = p.uiModeOverride === undefined && p.capsOverride === undefined;
    const seedAge = legacySave ? SEED_AGES[p.id] : undefined;
    const toolSlots = Array.isArray(p.toolSlots)
      ? [...new Set(p.toolSlots.filter((id) => typeof id === "string"))].slice(0, 24)
      : null;
    // A save written before the profile kept a nozzle has none: the field is
    // DROPPED rather than filled, because the defaults are read from
    // `SPRAY_DEFAULTS` — one source for 0.10/0.55/0.60. A value that is there
    // is clamped to what the panel can show; a backup is not trusted.
    const base: StoredProfile = { ...p };
    delete base.spray;
    if (p.spray && typeof p.spray === "object") base.spray = nozzleOf(p.spray);
    // The per-material memory is cleaned entry by entry: a backup may carry a
    // colour that is not a hex, and the panel can only show what it has a
    // control for. Absent = the band defaults.
    delete base.toolSettings;
    const toolSettings = normalizeToolSettings(p.toolSettings);
    // The one thickness is outside that map (§11.3): an out-of-range value is
    // DROPPED (the band default reads through), never clamped into a point
    // nobody chose. Absent = the band default, as for every other field here.
    delete base.strokeSize;
    const strokeSize = clampInt(p.strokeSize, 1, 100);
    // The folds keep their ABSENCE when a save predates them: the defaults are
    // read by `panelSectionsOf`, so there is nothing to migrate and "restore"
    // and "never touched" are the same state.
    delete base.secoesPainel;
    const secoesPainel =
      p.secoesPainel && typeof p.secoesPainel === "object" ? panelSectionsOf(p.secoesPainel) : null;
    // The device tier is ABSENCE-first too, and only an explicit `true` is
    // trusted: a save written before the field, a backup carrying `false` and
    // garbage all open on the FULL tier — which is the same state as turning
    // the switch off, so nothing is normalized into a preference nobody made.
    delete base.lowPower;
    const lowPower = p.lowPower === true;
    // The look of the sheet and the guide keep their ABSENCE too: a save from
    // before the two folds reads the defaults, and only what the readers accept
    // survives a backup (an unknown material/texture/tone is dropped, never
    // clamped into a value nobody chose).
    delete base.papel;
    const papel = p.papel && typeof p.papel === "object" ? paperLookOf(p.papel) : null;
    delete base.grade;
    const grade = p.grade && typeof p.grade === "object" ? gridLookOf(p.grade) : null;
    return {
      ...base,
      // A save without a band falls back to the most restrictive one.
      age: seedAge ?? p.age ?? "3-5",
      themeId,
      avatarCustom: p.avatarCustom === undefined ? themeAvatarArt(themeId) : p.avatarCustom,
      emojiAvatar: p.emojiAvatar ?? null,
      photoUri: p.photoUri ?? null,
      uiModeOverride: p.uiModeOverride ?? null,
      capsOverride: p.capsOverride ?? null,
      recentColors: Array.isArray(p.recentColors) ? p.recentColors.slice(0, 16) : [],
      favoriteColors: Array.isArray(p.favoriteColors) ? p.favoriteColors.slice(0, 24) : [],
      ...(toolSlots ? { toolSlots } : {}),
      ...(toolSettings ? { toolSettings } : {}),
      ...(strokeSize !== undefined ? { strokeSize } : {}),
      ...(secoesPainel ? { secoesPainel } : {}),
      ...(lowPower ? { lowPower: true } : {}),
      ...(papel ? { papel } : {}),
      ...(grade ? { grade } : {}),
      personaLine:
        typeof p.personaLine === "string" && p.personaLine.trim()
          ? p.personaLine.slice(0, MAX_PERSONA_LENGTH)
          : null,
      order: Number.isFinite(p.order) ? p.order! : index,
      createdAt: Number.isFinite(p.createdAt) ? p.createdAt! : 0,
      archived: p.archived === true,
      modeArchived: p.modeArchived === true,
    };
  });
  return normalizeOrder(mapped);
}

/** Old saves predate the global color scheme: follow the device. */
export function normalizeSettings(saved: Partial<Settings> | null | undefined): Settings {
  const base: Settings = {
    sound: true,
    vibration: true,
    voice: false,
    stabilization: 1,
    colorScheme: "system",
    paper: "linho",
    familyMode: "shared",
    setupDone: true,
    demo: true,
  };
  if (!saved || typeof saved !== "object") return base;
  const stabilization = Number(saved.stabilization);
  return {
    sound: saved.sound ?? base.sound,
    vibration: saved.vibration ?? base.vibration,
    voice: saved.voice ?? base.voice,
    stabilization: Number.isFinite(stabilization)
      ? Math.min(3, Math.max(0, Math.round(stabilization)))
      : base.stabilization,
    colorScheme: isColorScheme(saved.colorScheme) ? saved.colorScheme : base.colorScheme,
    paper: isPaperKey(saved.paper) ? saved.paper : base.paper,
    familyMode: saved.familyMode === "single" ? "single" : "shared",
    setupDone: saved.setupDone ?? base.setupDone,
    demo: saved.demo ?? base.demo,
  };
}

/**
 * Old saves predate draft/published. Legacy rule: celebrated pieces and
 * coloring pages enter the mural; old freehand scribbles become drafts.
 * Explicit values are never flipped back. `archived` is a newer, explicit
 * value: a save without it can never guess "guardado".
 *
 * Free drawings from before the full-bleed studio keep their strokes but get
 * the phone-tall sheet (see growSheetToPhone) — otherwise the paper would come
 * back as a card with a band above and below it.
 */
export function normalizeArtworks(artworks: StoredArtwork[]): Artwork[] {
  return artworks.map((w) => {
    if (w.visibility === "published" || w.visibility === "draft" || w.visibility === "archived") {
      const visibility = w.visibility;
      return growSheetToPhone({
        ...w,
        visibility,
        publishedAt: w.publishedAt ?? (visibility === "draft" ? null : w.updatedAt),
      });
    }
    const legacyPublished = Boolean(w.celebrated || w.pageId);
    return growSheetToPhone({
      ...w,
      visibility: legacyPublished ? "published" : "draft",
      publishedAt: legacyPublished ? w.updatedAt : null,
    });
  });
}

/** Backup files are the user's own data: absent visibility means draft. */
export function normalizeBackupArtworks(artworks: StoredArtwork[]): Artwork[] {
  return artworks.map((w) => ({
    ...w,
    visibility:
      w.visibility === "published" || w.visibility === "archived" ? w.visibility : "draft",
    publishedAt:
      w.visibility === "published" || w.visibility === "archived"
        ? (w.publishedAt ?? w.updatedAt)
        : null,
  }));
}

type Ctx = {
  state: State;
  dispatch: React.Dispatch<Action>;
  profile: Profile | null;
  go: (screen: Screen) => void;
};
const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({ ...seed(), loaded: false }));
  const ready = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<State>;
        const patch: Partial<State> = { screen: { name: "home" }, profileId: null };
        patch.settings = normalizeSettings(saved.settings);
        patch.themes = normalizeThemes(saved.themes);
        if (Array.isArray(saved.profiles)) patch.profiles = normalizeProfiles(saved.profiles);
        if (Array.isArray(saved.artworks)) patch.artworks = normalizeArtworks(saved.artworks);
        dispatch({ type: "load", state: patch });
      } else dispatch({ type: "load", state: {} });
    } catch {
      dispatch({ type: "load", state: {} });
    }
    ready.current = true;
  }, []);

  useEffect(() => {
    if (!ready.current || !state.loaded) return;
    const { profiles, settings, artworks, trash, crashLog, themes } = state;
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ profiles, settings, artworks, trash, crashLog, themes }),
      );
    } catch {
      /* storage full */
    }
  }, [state]);

  const profile = state.profiles.find((p) => p.id === state.profileId) ?? null;
  const go = (screen: Screen) => dispatch({ type: "go", screen });

  return <StoreCtx.Provider value={{ state, dispatch, profile, go }}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}

/**
 * The device tier of the person using this device, for the surfaces that paint
 * through the raster engine (`ArtworkPaint`, and the export they share).
 *
 * It reads the ACTIVE profile's declared flag and nothing else: no capability
 * probe, no frame sampling, no per-stroke heuristic (owner's decision, 26/10,
 * efeitos-chevrons §7.7.6). Outside a provider — or with no active profile —
 * it answers `false`, so a surface rendered bare paints on the full tier,
 * exactly as every surface did before the flag existed.
 */
export function useLowPowerDevice(): boolean {
  return useContext(StoreCtx)?.profile?.lowPower === true;
}

/** Validates a backup file before it replaces local data. */
export function parseBackup(
  text: string,
): { profiles: Profile[]; artworks: Artwork[]; settings: Settings } | null {
  if (text.length > 5_000_000) return null;
  try {
    const d = JSON.parse(text);
    if (d?.app !== "colorir" || d?.version !== 1) return null;
    if (!Array.isArray(d.profiles) || !Array.isArray(d.artworks) || typeof d.settings !== "object")
      return null;
    if (d.profiles.some((p: Profile) => typeof p.id !== "string" || typeof p.name !== "string"))
      return null;
    if (d.artworks.some((w: Artwork) => !w.history || !Array.isArray(w.history.commands)))
      return null;
    return {
      profiles: normalizeProfiles(d.profiles),
      artworks: normalizeBackupArtworks(d.artworks),
      settings: normalizeSettings(d.settings),
    };
  } catch {
    return null;
  }
}
