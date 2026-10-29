// The visual identity of a profile: label, emoji, accent roles and (for the
// shipped worlds) the hero/frame illustrations. The list itself lives in the
// store — this module only RESOLVES a theme id into what a screen renders.
//
// The three axes stay orthogonal (m3-temas-cor.md §1): the theme owns the
// accent roles, claro/escuro is a global preference, and uiMode only changes
// shape/density. Roles are applied as CSS variables, so the same component
// works in every theme x scheme combination.
import type { CSSProperties, ComponentType } from "react";
import { AvatarDino } from "./avatars/AvatarDino";
import { AvatarHeroi } from "./avatars/AvatarHeroi";
import { FrameDino } from "./frames/FrameDino";
import { FrameHeroi } from "./frames/FrameHeroi";
import { HeroDino } from "./heroes/HeroDino";
import { HeroHeroi } from "./heroes/HeroHeroi";
import {
  BUILT_IN_THEMES,
  defaultThemes,
  type AvatarArtId,
  type Theme,
  type ThemeArtId,
  type ThemeTokens,
} from "./themes";

export type { AvatarArtId, Theme, ThemeTokens } from "./themes";

/** Kept for call sites written before themes became data: any theme id. */
export type ProfileThemeId = string;

export type ArtComponent = ComponentType<{ className?: string }>;

export type ProfileTheme = Theme & {
  hero: ArtComponent | null;
  frame: ArtComponent | null;
};

export const AVATAR_ART: Record<AvatarArtId, ArtComponent> = {
  dino: AvatarDino,
  heroi: AvatarHeroi,
};

const HEROES: Record<ThemeArtId, ArtComponent> = {
  dinos: HeroDino,
  heroi: HeroHeroi,
};

const FRAMES: Record<ThemeArtId, ArtComponent> = {
  dinos: FrameDino,
  heroi: FrameHeroi,
};

const resolve = (theme: Theme): ProfileTheme => ({
  ...theme,
  hero: theme.art ? HEROES[theme.art] : null,
  frame: theme.art ? FRAMES[theme.art] : null,
});

/** The shipped catalog as resolved themes (illustration included). */
export const PROFILE_THEMES: ProfileTheme[] = BUILT_IN_THEMES.map(resolve);

/**
 * Resolves an id against the live list. A theme archived while a profile wears
 * it still resolves — archiving hides it from the picker, never undresses the
 * profile. Unknown ids fall back to the neutral theme.
 */
export function profileTheme(
  id: ProfileThemeId | undefined,
  themes: Theme[] = defaultThemes(),
): ProfileTheme {
  const found = themes.find((t) => t.id === id);
  if (found) return resolve(found);
  const neutral = themes.find((t) => t.id === "neutro") ?? themes[0];
  return resolve(neutral ?? BUILT_IN_THEMES[2]!);
}

/** The avatar illustration a theme wears by default. */
export function themeAvatarArt(id: ProfileThemeId | undefined): AvatarArtId | null {
  return themeAvatarArtOf(profileTheme(id));
}

export function themeAvatarArtOf(theme: Theme): AvatarArtId | null {
  return theme.avatarArt;
}

/** CSS custom properties for a themed surface, scheme-aware. */
export function themeStyle(theme: Theme, scheme: "light" | "dark"): Record<string, string> {
  const t = scheme === "dark" ? theme.darkTokens : theme.tokens;
  return {
    "--md-primary": t.primary,
    "--md-on-primary": t.onPrimary,
    "--md-primary-container": t.primaryContainer,
    "--md-on-primary-container": t.onPrimaryContainer,
    "--md-secondary": t.secondary,
  };
}

/** The seed surface a theme paints behind its illustration. */
export function themeSurfaceStyle(theme: Theme, scheme: "light" | "dark"): CSSProperties {
  const t = scheme === "dark" ? theme.darkTokens : theme.tokens;
  return {
    background: t.primaryContainer,
    color: t.onPrimaryContainer,
    // A theme without illustration still gets a material surface, but the
    // gradient never reaches full primary: the text keeps its AA pair.
    ...(theme.art === null
      ? {
          backgroundImage: `linear-gradient(135deg, ${t.primaryContainer}, color-mix(in oklab, ${t.primary} 24%, ${t.primaryContainer}))`,
        }
      : {}),
  };
}

/** Solid dot / chip color for the theme. */
export function themeDotStyle(theme: Theme, scheme: "light" | "dark"): CSSProperties {
  const t = scheme === "dark" ? theme.darkTokens : theme.tokens;
  return { background: t.primary };
}
