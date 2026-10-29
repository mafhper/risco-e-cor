// Claro/escuro is ONE global preference (backlog B6/B9): the default follows
// the device, and a manual choice applies to every profile at once. The theme
// (dino/herói/neutro) and the ui mode never touch this axis.
import { useEffect, useState } from "react";

export type ColorScheme = "light" | "dark" | "system";

export const COLOR_SCHEME_LABEL: Record<ColorScheme, string> = {
  light: "Claro",
  dark: "Escuro",
  system: "Seguir aparelho",
};

export const isColorScheme = (value: unknown): value is ColorScheme =>
  value === "light" || value === "dark" || value === "system";

/** Pure decision, so the toggle is testable without a browser. */
export function resolveScheme(pref: ColorScheme, systemDark: boolean): "light" | "dark" {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

const QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

/** Follows the device in real time while the preference is "system". */
export function useResolvedScheme(pref: ColorScheme): "light" | "dark" {
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(QUERY);
    const onChange = () => setSystemDark(media.matches);
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  return resolveScheme(pref, systemDark);
}
