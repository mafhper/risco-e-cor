// One place decides how old a profile is and what it may use. The derived
// values are never stored: only the age band and the adult's overrides are,
// so changing a default later migrates every save for free.
//
// Rule of thumb from the UX investigation: 3-5 is reading-zero and simple;
// 6-8 is the bridge (pro skin, contained toolset); 9+ is the full studio.

import type { CanvasTool } from "./brush";

export type AgeBand = "3-5" | "6-8" | "9+";

/** The skin (density and targets), never the style and never the activity. */
export type UiMode = "kids" | "pro";

/**
 * ADR-001, amended by the owner (24/10): the 3-5 studio keeps the three named
 * objects and gains two more drawing materials, because one material is not a
 * choice — "o Theo só tem lápis". The row is five targets and one screen wide:
 *
 *   `crayon`  Lápis de Cera     — the everyday tool, thick and forgiving
 *   `marker`  Canetinha         — a bold, even line; the second thing every child grabs
 *   `brush`   Pincel            — a wet stroke, wider than the hand
 *   `fill`    Balde Mágico      — tap-to-fill, only over a coloring page
 *   `eraser`  Borracha de Bloco — takes the area of its circle, never a smudge
 *
 * The rest of the shelf (pencil, watercolor, oil, charcoal/spray) stays Pro:
 * it is not hidden by accident, the age band decides — and the kids skin still
 * never shows functional text.
 */
export const KID_MATERIALS = ["crayon", "marker", "brush", "fill", "eraser"] as const;
export type KidMaterial = (typeof KID_MATERIALS)[number];

/** What a 3-5 child can pick. The bucket works on a page and on blank paper. */
export function kidTools(_hasPage = false): CanvasTool[] {
  return [...KID_MATERIALS];
}

/**
 * The adult toggles, in the order the adult area shows them. "Técnicas" left
 * the list with the "Mais" panel: a toggle that no longer changes any surface
 * would be a dead control. The key stays in `Capabilities` only so old saves
 * keep loading.
 */
export const CAPABILITY_KEYS = [
  "ferramentasComplexas",
  "paletaCompleta",
  "gradienteEfeitos",
  "variacaoClaroEscuro",
  "desafioDuo",
  "publicarMural",
] as const;

export type CapabilityKey =
  | (typeof CAPABILITY_KEYS)[number]
  /** Legacy: kept for old saves; never rendered as a toggle. */
  | "tecnicas";
export type Capabilities = Record<CapabilityKey, boolean>;

export const CAPABILITY_COPY: Record<CapabilityKey, { label: string; hint: string }> = {
  ferramentasComplexas: {
    label: "Ferramentas complexas",
    hint: "Painel “Mais”: tamanhos, formas rápidas e conta-gotas",
  },
  paletaCompleta: {
    label: "Paleta completa",
    hint: "Todas as famílias de cor; desligado deixa 6 cores grandes",
  },
  gradienteEfeitos: {
    label: "Gradiente e efeitos",
    hint: "Gradiente linear/radial, sombra e brilho no traço",
  },
  variacaoClaroEscuro: {
    label: "Temas do perfil",
    hint: "O perfil troca de tema sozinho na Home dele; o tutor sempre escolhe",
  },
  tecnicas: {
    label: "Pontilhismo e técnicas",
    hint: "Aba de técnicas no painel “Mais”",
  },
  desafioDuo: {
    label: "Desafio duo",
    hint: "Desenho a dois no espaço do perfil",
  },
  publicarMural: {
    label: "Publicar no mural",
    hint: "Desligado guarda só na galeria da criança",
  },
};

/** Defaults per age band — the table the adult area restores to. */
export const CAP_DEFAULTS: Record<AgeBand, Capabilities> = {
  "3-5": {
    ferramentasComplexas: false,
    paletaCompleta: false,
    gradienteEfeitos: false,
    variacaoClaroEscuro: false,
    tecnicas: false,
    desafioDuo: false,
    publicarMural: true,
  },
  "6-8": {
    ferramentasComplexas: true,
    paletaCompleta: true,
    gradienteEfeitos: false,
    variacaoClaroEscuro: true,
    tecnicas: false,
    desafioDuo: true,
    publicarMural: true,
  },
  "9+": {
    ferramentasComplexas: true,
    paletaCompleta: true,
    gradienteEfeitos: true,
    variacaoClaroEscuro: true,
    tecnicas: true,
    desafioDuo: true,
    publicarMural: true,
  },
};

export const AGE_LABELS: Record<AgeBand, string> = {
  "3-5": "3–5",
  "6-8": "6–8",
  "9+": "9+",
};

/** The bands a known demo seed is forced into — the old seeds were inverted. */
export const SEED_AGES: Record<string, AgeBand> = { maria: "9+", theo: "3-5" };

/** The slice of a profile the derivation needs. */
export type CapabilityProfile = {
  age: AgeBand;
  uiModeOverride: UiMode | null;
  capsOverride: Partial<Capabilities> | null;
};

/** What the adult overrode, over the defaults of the band. Never persisted derived. */
export function capsOf(p: CapabilityProfile): Capabilities {
  return { ...CAP_DEFAULTS[p.age], ...(p.capsOverride ?? {}) };
}

/**
 * Capabilities that actually take effect: gradient and techniques live inside
 * the "Mais" panel, so they cannot be on while that panel is off. The stored
 * override is kept, so turning the panel back on restores the previous choice.
 */
export function effectiveCaps(p: CapabilityProfile): Capabilities {
  const caps = capsOf(p);
  if (caps.ferramentasComplexas) return caps;
  return { ...caps, gradienteEfeitos: false, tecnicas: false };
}

/** Only the age band decides — unless the adult locked a mode for this profile. */
export function uiModeOf(p: CapabilityProfile): UiMode {
  return p.uiModeOverride ?? (p.age === "3-5" ? "kids" : "pro");
}

/** A session preview ("Ver como criança") outranks everything and is never saved. */
export function resolveUiMode(p: CapabilityProfile, session: UiMode | null = null): UiMode {
  return session ?? uiModeOf(p);
}
