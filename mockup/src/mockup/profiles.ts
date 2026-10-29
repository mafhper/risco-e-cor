// The seven profile operations of the family screen, as pure functions over
// the profile list (crud-perfis-global.md §4). The reducer applies what these
// return, so the invariants are testable without a browser:
//
//   I1  `order` is unique and rewritten to 0..n-1 on create/reorder/remove
//   I2  at least one active profile always exists
//   I3  the active profile is never archived or removed
//   I4  archived profiles disappear from the Home (never from their own save)
//   I5  no profile operation touches an artwork — remove refuses while any exist
//   I6  duplicating copies identity/preferences, never artworks
//   I8  a refused operation returns the exact same list (no partial change)
//
// `order` is the ONLY source of order: screens sort by it, never by array
// index. Archived profiles keep their slot, so unarchiving returns the profile
// to the position the adult left it in.
import type { AgeBand } from "./capabilities";
import type { AvatarKey, Profile, ToneKey } from "./store";

export const MAX_ACTIVE_PROFILES = 4;
export const MAX_NAME_LENGTH = 16;

/**
 * How the family presents itself on the Home (briefing §7, mono-perfil k=1):
 *  - `shared` — every active profile has a chip and the Home asks who draws.
 *  - `single` — exactly one child stays on the Home, and the Home becomes
 *    that child's hero; the others are archived BY THE MODE, never removed.
 */
export type FamilyMode = "single" | "shared";

export type ProfileDraft = {
  name: string;
  age: AgeBand;
  avatar: AvatarKey;
  tone: ToneKey;
  /** Any id in the live theme catalog (see themes.ts), never a fixed union. */
  themeId: string;
};

export type ProfileChange = { profiles: Profile[]; profile?: Profile; error?: string };

const byOrder = (a: Profile, b: Profile) =>
  a.order - b.order || a.createdAt - b.createdAt || a.name.localeCompare(b.name);

/** Every profile, in `order` — the tutor list. */
export const sortedProfiles = (profiles: Profile[]): Profile[] => [...profiles].sort(byOrder);

/** Only the profiles the Home shows, in `order`. */
export const activeProfiles = (profiles: Profile[]): Profile[] =>
  sortedProfiles(profiles).filter((p) => !p.archived);

export const archivedProfiles = (profiles: Profile[]): Profile[] =>
  sortedProfiles(profiles).filter((p) => p.archived);

/** Rewrites `order` to 0..n-1 over the current order (the only normalizer). */
export function normalizeOrder(profiles: Profile[]): Profile[] {
  return sortedProfiles(profiles).map((p, index) =>
    p.order === index ? p : { ...p, order: index },
  );
}

export const nextOrder = (profiles: Profile[]): number =>
  profiles.reduce((max, p) => Math.max(max, p.order + 1), 0);

const cleanName = (name: string) => name.trim().slice(0, MAX_NAME_LENGTH);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function nameTaken(profiles: Profile[], name: string, exceptId?: string): boolean {
  return profiles.some((p) => p.id !== exceptId && sameName(p.name, name));
}

/** The name a copy would take: "{name} 2", truncated, incremented until free. */
export function copyName(profiles: Profile[], source: Profile): string {
  const base = source.name.replace(/\s+\d+$/, "").slice(0, MAX_NAME_LENGTH - 2);
  for (let n = 2; n < 100; n += 1) {
    const candidate = `${base} ${n}`.slice(0, MAX_NAME_LENGTH).trim();
    if (!nameTaken(profiles, candidate)) return candidate;
  }
  return `${base} ${Date.now() % 100}`.slice(0, MAX_NAME_LENGTH);
}

/** Validation shared by create and duplicate. `error` is product copy. */
export function validateNewProfile(profiles: Profile[], name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Dê um nome para o perfil.";
  if (trimmed.length > MAX_NAME_LENGTH) return `Use até ${MAX_NAME_LENGTH} letras.`;
  if (nameTaken(profiles, trimmed)) return "Já existe um perfil com esse nome.";
  if (activeProfiles(profiles).length >= MAX_ACTIVE_PROFILES)
    return `A família já tem ${MAX_ACTIVE_PROFILES} perfis ativos.`;
  return null;
}

/** The new profile is NOT made active: the adult comes back to the list. */
export function createProfile(
  profiles: Profile[],
  draft: ProfileDraft,
  id: string,
  now: number,
): ProfileChange {
  const error = validateNewProfile(profiles, draft.name);
  if (error) return { profiles, error };
  const profile: Profile = {
    id,
    name: cleanName(draft.name),
    avatar: draft.avatar,
    tone: draft.tone,
    age: draft.age,
    themeId: draft.themeId,
    avatarCustom: null,
    emojiAvatar: null,
    photoUri: null,
    uiModeOverride: null,
    capsOverride: null,
    personaLine: null,
    favoriteActivity: "livre",
    recentColors: [],
    favoriteColors: [],
    order: nextOrder(profiles),
    createdAt: now,
    archived: false,
  };
  return { profiles: normalizeOrder([...profiles, profile]), profile };
}

/** Moves one active profile past its nearest active neighbour. */
export function moveProfile(profiles: Profile[], id: string, direction: -1 | 1): ProfileChange {
  const list = sortedProfiles(profiles);
  const active = list.filter((p) => !p.archived);
  const from = active.findIndex((p) => p.id === id);
  if (from < 0) return { profiles };
  const to = from + direction;
  if (to < 0 || to >= active.length) return { profiles };
  const reordered = [...active];
  const [moved] = reordered.splice(from, 1);
  reordered.splice(to, 0, moved!);
  // Archived profiles keep their slot; the active ones get the new sequence.
  let cursor = 0;
  const merged = list.map((p) => (p.archived ? p : reordered[cursor++]!));
  return {
    profiles: merged.map((p, index) => (p.order === index ? p : { ...p, order: index })),
  };
}

/** Copy sits right after the original, with identity and preferences only. */
export function duplicateProfile(
  profiles: Profile[],
  id: string,
  newId: string,
  now: number,
): ProfileChange {
  const source = profiles.find((p) => p.id === id);
  if (!source) return { profiles };
  if (activeProfiles(profiles).length >= MAX_ACTIVE_PROFILES)
    return { profiles, error: `A família já tem ${MAX_ACTIVE_PROFILES} perfis ativos.` };
  const copy: Profile = {
    ...source,
    id: newId,
    name: copyName(profiles, source),
    archived: false,
    createdAt: now,
    order: source.order + 1,
  };
  const list = sortedProfiles(profiles).flatMap((p) => (p.id === id ? [p, copy] : [p]));
  return {
    profiles: list.map((p, index) => (p.order === index ? p : { ...p, order: index })),
    profile: copy,
  };
}

export function archiveProfile(profiles: Profile[], id: string): ProfileChange {
  const target = profiles.find((p) => p.id === id);
  if (!target || target.archived) return { profiles };
  if (activeProfiles(profiles).length <= 1)
    return { profiles, error: "Deixe pelo menos um perfil ativo." };
  return {
    profiles: profiles.map((p) => (p.id === id ? { ...p, archived: true } : p)),
  };
}

export function unarchiveProfile(profiles: Profile[], id: string): ProfileChange {
  const target = profiles.find((p) => p.id === id);
  if (!target || !target.archived) return { profiles };
  if (activeProfiles(profiles).length >= MAX_ACTIVE_PROFILES)
    return { profiles, error: `A família já tem ${MAX_ACTIVE_PROFILES} perfis ativos.` };
  return {
    profiles: profiles.map((p) => (p.id === id ? { ...p, archived: false } : p)),
  };
}

/**
 * Collapses the family to one child (or opens it back up) without deleting
 * anything. The profiles the mode puts away carry `modeArchived`, so going
 * back to `shared` restores those and leaves the adult's own archive alone.
 * The first active profile in `order` is the one that stays.
 */
export function setFamilyMode(profiles: Profile[], mode: FamilyMode): ProfileChange {
  const ordered = sortedProfiles(profiles);
  if (mode === "shared") {
    const restored = ordered.map((p) =>
      p.modeArchived ? { ...p, archived: false, modeArchived: false } : p,
    );
    const changed = restored.some((p, i) => p !== ordered[i]);
    return changed ? { profiles: normalizeOrder(restored) } : { profiles };
  }
  const keeper = ordered.find((p) => !p.archived) ?? ordered[0];
  if (!keeper) return { profiles };
  const next = ordered.map((p) => {
    if (p.id === keeper.id) {
      return p.archived ? { ...p, archived: false, modeArchived: false } : p;
    }
    if (p.archived) return p; // already away by the adult's hand
    return { ...p, archived: true, modeArchived: true };
  });
  return { profiles: normalizeOrder(next) };
}

/**
 * Removing is the only irreversible profile act, so it refuses while the
 * gallery is not empty: `trash` keeps `profileId`, and a restored artwork with
 * no profile would be an orphan.
 */
export function removeProfile(
  profiles: Profile[],
  id: string,
  artworks: { profileId: string }[],
): ProfileChange {
  const target = profiles.find((p) => p.id === id);
  if (!target) return { profiles };
  if (activeProfiles(profiles).length <= 1 && !target.archived)
    return { profiles, error: "Deixe pelo menos um perfil ativo." };
  if (artworks.some((a) => a.profileId === id))
    return { profiles, error: "Mova os desenhos para a lixeira e esvazie-a antes de remover." };
  return { profiles: normalizeOrder(profiles.filter((p) => p.id !== id)) };
}

/** Where the active pointer should land when the current profile goes away. */
export function fallbackProfile(profiles: Profile[], removedId: string): Profile | null {
  return activeProfiles(profiles).find((p) => p.id !== removedId) ?? null;
}
