import { useLayoutEffect, useRef } from "react";

/**
 * A theme flip changes color, background, border and shadow on nearly every
 * node at once. Every transition on those properties would fire together and
 * the switch would smear instead of snapping.
 *
 * The recipe: inject `*,*::before,*::after{transition:none !important}`, force a
 * synchronous style flush so the new values commit under the override, then
 * drop the override after the next painted frame. The nested rAF is deliberate
 * — the first callback runs before the paint, the second removes the sheet once
 * the new colors are on screen.
 */
export const SUPPRESS_STYLE_ID = "theme-swap-suppress";

const RULE = "*,*::before,*::after{transition:none !important}";

let removalToken = 0;

export function suppressTransitionsNow(): void {
  if (typeof document === "undefined" || !document.body) return;

  let style = document.getElementById(SUPPRESS_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = SUPPRESS_STYLE_ID;
    style.textContent = RULE;
    document.head.append(style);
  }

  // Read for its side effect: forces the style flush while the override is in
  // the document, so no transition starts from the theme change.
  void document.body.offsetHeight;

  const token = ++removalToken;
  const drop = () => {
    // A second flip before the frame landed keeps the sheet alive: it is still
    // suppressing a change that has not painted yet.
    if (token === removalToken) style?.remove();
  };

  if (typeof requestAnimationFrame !== "function") {
    drop();
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(drop));
}

/**
 * Runs the suppression whenever the theme identity changes — scheme, theme id
 * or the resolved tokens (editing a theme's seed flips colors too). The first
 * render is skipped: there is no change to suppress on mount.
 */
export function useThemeSwapSuppress(key: string): void {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    suppressTransitionsNow();
  }, [key]);
}
