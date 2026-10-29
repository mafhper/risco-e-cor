// The profile Home is a persona screen, not a smaller copy of the app Home
// (redesenho-estudio 2B). The persona is DERIVED from what the app knows —
// the age band and the theme — never invented authorship facts. Kids get
// objects and gestures; older profiles get technique vocabulary.
//
// The band suggests the line; the adult owns it. `personaLine` is the one
// field a tutor writes, and it never carries the age: the child sees a
// description, not a label for how old they are (2026-10-22).
import type { AgeBand } from "./capabilities";
import type { Profile } from "./store";

export type Persona = {
  /** One line of character, in the adult's voice. */
  line: string;
  /** The vocabulary the profile already answers to. */
  chips: string[];
  /** What the big button promises. */
  cta: string;
};

/** The field's cap — one caption line, never an essay (spec: 70 chars). */
export const MAX_PERSONA_LENGTH = 70;

const PERSONA: Record<AgeBand, Persona> = {
  "3-5": {
    line: "Gosta de carimbos, tintas grossas e de ver a cor encher o papel.",
    chips: ["Carimbo", "Balde", "Dedo"],
    cta: "Começar a desenhar",
  },
  "6-8": {
    line: "Mistura lápis e aquarela e já pede contorno para pintar.",
    chips: ["Lápis", "Aquarela", "Contorno"],
    cta: "Começar a desenhar",
  },
  "9+": {
    line: "Traço realista, paleta fria, trabalho em camadas.",
    chips: ["Aquarela molhada", "Hachura", "Camadas"],
    cta: "Começar a desenhar",
  },
};

/** The suggestion for a band — the placeholder of an empty description. */
export function defaultPersonaLine(age: AgeBand): string {
  return PERSONA[age].line;
}

/**
 * The persona of one profile. Pure, so the two homes can be told apart in
 * tests. A blank/absent description falls back to the band's suggestion, so
 * the persona section is never empty.
 */
export function personaOf(
  profile: Pick<Profile, "age"> & { personaLine?: string | null },
): Persona {
  const suggested = PERSONA[profile.age];
  const written = profile.personaLine?.trim();
  return written ? { ...suggested, line: written } : suggested;
}
