// Profile themes are USER DATA, not code: the tutor creates, duplicates,
// renames and archives them, and every screen reads the list from the store.
// The three shipped themes are only the starting catalog — there is no fixed
// theme and no limit of three.
//
// A theme owns one seed color. The M3 roles (primary / on-primary / container
// / on-container / secondary) are DERIVED from it, in both schemes, with the
// AA floor guaranteed by construction: the contrast test measures the result
// instead of trusting the ramp.
import { contrastRatio } from "./palette";

export type AvatarArtId = "dino" | "heroi";
/** The illustrated worlds a theme can wear. Custom themes have no illustration. */
export type ThemeArtId = "dinos" | "heroi";

/** M3 accent roles derived from the theme seed. */
export type ThemeTokens = {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
};

export type Theme = {
  id: string;
  /** Adult-facing name, editable. */
  label: string;
  /** One-liner shown in the picker. */
  hint: string;
  /** Identity emoji (never the only signal: the name is always there). */
  emoji: string;
  /** The color the roles are derived from. */
  seed: string;
  tokens: ThemeTokens;
  darkTokens: ThemeTokens;
  /** The illustration this theme wears by default; null = no illustration. */
  avatarArt: AvatarArtId | null;
  /** Which built-in world art the theme uses; null = flat seed surface. */
  art: ThemeArtId | null;
  /** Shipped themes cannot be renamed away from their art; they can be copied. */
  builtIn: boolean;
  /** Archived = out of the picker, still valid for profiles already wearing it. */
  archived: boolean;
  createdAt: number;
  /** Unique integer; the only source of order. */
  order: number;
};

export const MAX_THEME_NAME = 24;

const PAPER = "#FFFFFF";
const INK = "#1C1B1A";
const NIGHT = "#1A1815";

const clampByte = (n: number) => Math.min(255, Math.max(0, Math.round(n)));

const toRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

const toHex = (rgb: [number, number, number]) =>
  `#${rgb.map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`.toUpperCase();

/** sRGB mix: `weight` is how much of `b` ends up in the result (0..1). */
export function mixHex(a: string, b: string, weight: number): string {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  const w = Math.min(1, Math.max(0, weight));
  return toHex([ar + (br - ar) * w, ag + (bg - ag) * w, ab + (bb - ab) * w]);
}

/**
 * Walks a mix until `color` clears `min` against `against`. The loop is the
 * guarantee: a seed that is too light for white text gets darkened until the
 * measured ratio passes, so no palette can ship an unreadable pair.
 */
function fitContrast(
  from: string,
  toward: string,
  against: string,
  min = 4.5,
  step = 0.04,
  max = 0.92,
): string {
  let best = mixHex(from, toward, 0);
  for (let t = 0; t <= max; t += step) {
    best = mixHex(from, toward, t);
    if (contrastRatio(best, against) >= min) return best;
  }
  return best;
}

/** The theme roles for a seed color — light scheme. */
export function tokensFromSeed(seed: string): { tokens: ThemeTokens; darkTokens: ThemeTokens } {
  const primary = fitContrast(seed, "#000000", PAPER);
  const primaryContainer = mixHex(seed, PAPER, 0.88);
  const onPrimaryContainer = fitContrast(seed, "#000000", primaryContainer, 4.5, 0.04, 0.75);

  const darkPrimary = fitContrast(seed, "#FFFFFF", INK, 4.5, 0.04, 0.8);
  const darkContainer = mixHex(seed, NIGHT, 0.74);
  const darkOnContainer = fitContrast(seed, "#FFFFFF", darkContainer, 4.5, 0.04, 0.85);

  return {
    tokens: {
      primary,
      onPrimary: PAPER,
      primaryContainer,
      onPrimaryContainer,
      secondary: mixHex(seed, "#4B6470", 0.4),
    },
    darkTokens: {
      primary: darkPrimary,
      onPrimary: INK,
      primaryContainer: darkContainer,
      onPrimaryContainer: darkOnContainer,
      secondary: mixHex(seed, "#FFFFFF", 0.25),
    },
  };
}

/** Seed swatches the "new theme" form offers (plus the built-in seeds). */
export const THEME_SEEDS: { hex: string; name: string }[] = [
  { hex: "#C0567A", name: "Rosa" },
  { hex: "#B4482B", name: "Coral" },
  { hex: "#C47A2B", name: "Âmbar" },
  { hex: "#4B7D63", name: "Verde" },
  { hex: "#2F6E8A", name: "Pigmento" },
  { hex: "#4B5F9F", name: "Azul" },
  { hex: "#6B5A86", name: "Lilás" },
  { hex: "#8A5A2B", name: "Madeira" },
];

const theme = (input: {
  id: string;
  label: string;
  hint: string;
  emoji: string;
  seed: string;
  tokens?: ThemeTokens;
  darkTokens?: ThemeTokens;
  avatarArt?: AvatarArtId | null;
  art?: ThemeArtId | null;
  builtIn?: boolean;
  order: number;
  createdAt?: number;
}): Theme => {
  const derived = tokensFromSeed(input.seed);
  return {
    id: input.id,
    label: input.label,
    hint: input.hint,
    emoji: input.emoji,
    seed: input.seed,
    tokens: input.tokens ?? derived.tokens,
    darkTokens: input.darkTokens ?? derived.darkTokens,
    avatarArt: input.avatarArt ?? null,
    art: input.art ?? null,
    builtIn: input.builtIn ?? false,
    archived: false,
    createdAt: input.createdAt ?? 0,
    order: input.order,
  };
};

/**
 * The shipped catalog. Their tokens are the ones measured by the original
 * investigation (oklch); a copy of a built-in theme derives hex roles from the
 * same seed, so it is automatically a first-class custom theme.
 */
export const BUILT_IN_THEMES: Theme[] = [
  theme({
    id: "dinos",
    label: "Dinossauros",
    hint: "Vale pastel com saurinhos fofos",
    emoji: "🦕",
    seed: "#C0567A",
    art: "dinos",
    avatarArt: "dino",
    builtIn: true,
    order: 0,
    createdAt: 0,
    tokens: {
      primary: "oklch(0.585 0.16 330)",
      onPrimary: "oklch(1 0 0)",
      primaryContainer: "oklch(0.92 0.04 330)",
      onPrimaryContainer: "oklch(0.35 0.10 330)",
      secondary: "oklch(0.65 0.10 165)",
    },
    darkTokens: {
      primary: "oklch(0.80 0.10 330)",
      onPrimary: "oklch(0.30 0.08 330)",
      primaryContainer: "oklch(0.40 0.10 330)",
      onPrimaryContainer: "oklch(0.92 0.04 330)",
      secondary: "oklch(0.72 0.09 165)",
    },
  }),
  theme({
    id: "heroi",
    label: "Herói",
    hint: "Herói genérico de capa dourada sobre a cidade",
    emoji: "⚡",
    seed: "#2F6E4E",
    art: "heroi",
    avatarArt: "heroi",
    builtIn: true,
    order: 1,
    createdAt: 0,
    tokens: {
      primary: "oklch(0.535 0.17 155)",
      onPrimary: "oklch(1 0 0)",
      primaryContainer: "oklch(0.92 0.04 155)",
      onPrimaryContainer: "oklch(0.25 0.08 155)",
      secondary: "oklch(0.70 0.12 75)",
    },
    darkTokens: {
      primary: "oklch(0.78 0.14 155)",
      onPrimary: "oklch(0.22 0.06 155)",
      primaryContainer: "oklch(0.38 0.10 155)",
      onPrimaryContainer: "oklch(0.92 0.04 155)",
      secondary: "oklch(0.78 0.12 75)",
    },
  }),
  theme({
    id: "neutro",
    label: "Neutro",
    hint: "Sem cenário — só as cores do perfil",
    emoji: "🎨",
    seed: "#5A5550",
    builtIn: true,
    order: 2,
    createdAt: 0,
    tokens: {
      primary: "oklch(0.50 0.04 260)",
      onPrimary: "oklch(1 0 0)",
      primaryContainer: "oklch(0.92 0.01 260)",
      onPrimaryContainer: "oklch(0.25 0.02 260)",
      secondary: "oklch(0.60 0.06 260)",
    },
    darkTokens: {
      primary: "oklch(0.75 0.04 260)",
      onPrimary: "oklch(0.22 0.02 260)",
      primaryContainer: "oklch(0.35 0.02 260)",
      onPrimaryContainer: "oklch(0.92 0.01 260)",
      secondary: "oklch(0.66 0.05 260)",
    },
  }),
];

/** Fresh copy of the shipped catalog (never share the array with the store). */
export const defaultThemes = (): Theme[] => BUILT_IN_THEMES.map((t) => ({ ...t }));

const byOrder = (a: Theme, b: Theme) =>
  a.order - b.order || a.createdAt - b.createdAt || a.label.localeCompare(b.label);

export const sortedThemes = (themes: Theme[]): Theme[] => [...themes].sort(byOrder);

/** What the picker shows: archived themes stay valid, just out of the list. */
export const activeThemes = (themes: Theme[]): Theme[] =>
  sortedThemes(themes).filter((t) => !t.archived);

export const nextThemeOrder = (themes: Theme[]): number =>
  themes.reduce((max, t) => Math.max(max, t.order + 1), 0);

const cleanLabel = (label: string) => label.trim().slice(0, MAX_THEME_NAME);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function themeNameTaken(themes: Theme[], label: string, exceptId?: string): boolean {
  return themes.some((t) => t.id !== exceptId && sameName(t.label, label));
}

/** "{name} 2", incremented until free. */
export function copyThemeName(themes: Theme[], source: Theme): string {
  const base = source.label.replace(/\s+\d+$/, "").slice(0, MAX_THEME_NAME - 2);
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base} ${n}`.slice(0, MAX_THEME_NAME).trim();
    if (!themeNameTaken(themes, candidate)) return candidate;
  }
  return `${base} ${Date.now() % 100}`.slice(0, MAX_THEME_NAME);
}

export type ThemeDraft = {
  label: string;
  emoji: string;
  /** The color the new theme derives its roles from. */
  seed: string;
  /** Existing theme to copy the roles/art from ("a partir de seed"). */
  fromId?: string;
};

export type ThemeChange = { themes: Theme[]; theme?: Theme; error?: string };

export function validateNewTheme(themes: Theme[], label: string): string | null {
  const trimmed = label.trim();
  if (trimmed.length === 0) return "Dê um nome para o tema.";
  if (trimmed.length > MAX_THEME_NAME) return `Use até ${MAX_THEME_NAME} letras.`;
  if (themeNameTaken(themes, trimmed)) return "Já existe um tema com esse nome.";
  return null;
}

/** Creates from scratch (a seed color) or from an existing theme's roles. */
export function createTheme(
  themes: Theme[],
  draft: ThemeDraft,
  id: string,
  now: number,
): ThemeChange {
  const error = validateNewTheme(themes, draft.label);
  if (error) return { themes, error };
  const source = draft.fromId ? themes.find((t) => t.id === draft.fromId) : undefined;
  const seed = source ? source.seed : draft.seed;
  const created: Theme = {
    ...theme({
      id,
      label: cleanLabel(draft.label),
      hint: source ? `Cópia de ${source.label}` : "Cores do perfil, criadas pelo tutor",
      emoji: draft.emoji,
      seed,
      order: nextThemeOrder(themes),
      createdAt: now,
    }),
    // A copy keeps the source's exact roles and illustration; only its name is new.
    tokens: source ? { ...source.tokens } : tokensFromSeed(seed).tokens,
    darkTokens: source ? { ...source.darkTokens } : tokensFromSeed(seed).darkTokens,
    avatarArt: source?.avatarArt ?? null,
    art: source?.art ?? null,
  };
  return { themes: sortedThemes([...themes, created]), theme: created };
}

/** Sits right after the original, keeping roles and art. */
export function duplicateTheme(
  themes: Theme[],
  id: string,
  newId: string,
  now: number,
): ThemeChange {
  const source = themes.find((t) => t.id === id);
  if (!source) return { themes };
  const copy: Theme = {
    ...source,
    id: newId,
    label: copyThemeName(themes, source),
    hint: `Cópia de ${source.label}`,
    builtIn: false,
    archived: false,
    createdAt: now,
    order: source.order + 1,
  };
  const list = sortedThemes(themes).flatMap((t) => (t.id === id ? [t, copy] : [t]));
  return {
    themes: list.map((t, index) => (t.order === index ? t : { ...t, order: index })),
    theme: copy,
  };
}

export function renameTheme(themes: Theme[], id: string, label: string): ThemeChange {
  const target = themes.find((t) => t.id === id);
  if (!target) return { themes };
  const trimmed = cleanLabel(label);
  if (!trimmed) return { themes, error: "Dê um nome para o tema." };
  if (themeNameTaken(themes, trimmed, id))
    return { themes, error: "Já existe um tema com esse nome." };
  if (target.label === trimmed) return { themes };
  return {
    themes: themes.map((t) => (t.id === id ? { ...t, label: trimmed } : t)),
    theme: { ...target, label: trimmed },
  };
}

/** Archive never deletes and never rewrites a profile: the theme stays valid. */
export function archiveTheme(themes: Theme[], id: string): ThemeChange {
  const target = themes.find((t) => t.id === id);
  if (!target || target.archived) return { themes };
  if (activeThemes(themes).length <= 1) return { themes, error: "Deixe pelo menos um tema ativo." };
  return {
    themes: themes.map((t) => (t.id === id ? { ...t, archived: true } : t)),
    theme: { ...target, archived: true },
  };
}

export function unarchiveTheme(themes: Theme[], id: string): ThemeChange {
  const target = themes.find((t) => t.id === id);
  if (!target || !target.archived) return { themes };
  return {
    themes: themes.map((t) => (t.id === id ? { ...t, archived: false } : t)),
    theme: { ...target, archived: false },
  };
}

/** Emoji/hint/seed edits. A new seed re-derives the roles (a copy of a built-in
 *  theme is a custom theme: its tokens are no longer the shipped oklch ramp). */
export function updateTheme(
  themes: Theme[],
  id: string,
  patch: Partial<Pick<Theme, "emoji" | "hint" | "seed">>,
): ThemeChange {
  const target = themes.find((t) => t.id === id);
  if (!target) return { themes };
  if (patch.seed && !/^#[0-9a-f]{6}$/i.test(patch.seed)) return { themes };
  const next: Theme = { ...target, ...patch };
  if (patch.seed && patch.seed.toUpperCase() !== target.seed) {
    const derived = tokensFromSeed(patch.seed);
    next.seed = patch.seed.toUpperCase();
    next.tokens = derived.tokens;
    next.darkTokens = derived.darkTokens;
    next.art = null;
    next.avatarArt = null;
    next.builtIn = false;
  }
  return {
    themes: themes.map((t) => (t.id === id ? next : t)),
    theme: next,
  };
}

/**
 * Old saves predate theme CRUD: they get the shipped catalog. A save from the
 * CRUD era keeps its list, normalized (ids unique, order 0..n-1). An empty or
 * unrecoverable list falls back to the catalog instead of leaving the app
 * without a theme.
 */
export function normalizeThemes(saved: unknown): Theme[] {
  if (!Array.isArray(saved) || saved.length === 0) return defaultThemes();
  const seen = new Set<string>();
  const mapped: Theme[] = [];
  for (const raw of saved as Partial<Theme>[]) {
    if (!raw || typeof raw.id !== "string" || typeof raw.label !== "string") continue;
    if (seen.has(raw.id)) continue;
    seen.add(raw.id);
    const builtIn = BUILT_IN_THEMES.find((t) => t.id === raw.id);
    const seed =
      typeof raw.seed === "string" && /^#[0-9a-f]{6}$/i.test(raw.seed)
        ? raw.seed.toUpperCase()
        : (builtIn?.seed ?? "#5A5550");
    const derived = tokensFromSeed(seed);
    const tokens = raw.tokens ?? builtIn?.tokens ?? derived.tokens;
    const darkTokens = raw.darkTokens ?? builtIn?.darkTokens ?? derived.darkTokens;
    mapped.push({
      id: raw.id,
      label: cleanLabel(raw.label) || "Tema",
      hint: typeof raw.hint === "string" ? raw.hint : (builtIn?.hint ?? ""),
      emoji: typeof raw.emoji === "string" && raw.emoji ? raw.emoji : "🎨",
      seed,
      tokens,
      darkTokens,
      avatarArt: raw.avatarArt ?? builtIn?.avatarArt ?? null,
      art: raw.art ?? builtIn?.art ?? null,
      builtIn: builtIn ? true : Boolean(raw.builtIn),
      archived: raw.archived === true,
      createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt! : 0,
      order: Number.isFinite(raw.order) ? raw.order! : mapped.length,
    });
  }
  if (mapped.length === 0) return defaultThemes();
  // The catalog is always present, even if a save predates one of its entries.
  for (const base of BUILT_IN_THEMES) {
    if (!seen.has(base.id)) mapped.push({ ...base });
  }
  // At least one active theme is an invariant, not a UI rule.
  const anyActive = mapped.some((t) => !t.archived);
  const list = anyActive
    ? mapped
    : mapped.map((t) => (t.id === mapped[0]!.id ? { ...t, archived: false } : t));
  return sortedThemes(list).map((t, index) => (t.order === index ? t : { ...t, order: index }));
}

/** Profiles whose theme disappeared land on the neutral one (never a blank UI). */
export function themeIdOrFallback(themes: Theme[], id: string | undefined): string {
  if (id && themes.some((t) => t.id === id)) return id;
  return themes.some((t) => t.id === "neutro") ? "neutro" : (themes[0]?.id ?? "neutro");
}
