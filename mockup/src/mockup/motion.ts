import { useEffect, useState } from "react";

/**
 * The motion and stroke language, in one place (better-ui batch).
 *
 * These numbers are a contract, not a preference: the CSS variables in
 * `styles.css` publish the same values and `ui-motion.test.tsx` fails if the two
 * drift. Feedback stays at or under 150ms; only the contextual icon swap gets
 * the 300ms cross-fade the eye needs to read the change.
 */
export const MOTION = {
  /** High-frequency feedback and every exit. */
  micro: 150,
  /** Contextual icon cross-fade (CSS approximation of spring 0.3, bounce 0). */
  icon: 300,
  /** One chunk of an infrequent staged entrance. */
  stagger: 100,
  /** Sheet enter (the promise the exit answers). */
  sheetEnter: 280,
  /** Paired exit: shorter than the enter, same ease-out. */
  sheetExit: 150,
  /** Always 0.96 — below 0.95 reads as a glitch. */
  pressScale: 0.96,
  /** Fixed exit shift, never the full container height. */
  exitShift: 12,
  easeOut: "cubic-bezier(0.2, 0, 0, 1)",
} as const;

/** Exact cross-fade values from the icon-transitions recipe. */
export const ICON_SWAP = { scale: 0.25, blur: 4 } as const;

/** Icon stroke follows the text weight: 1.5 beside regular, 2 beside semibold. */
export const STROKE = { regular: 1.5, semibold: 2 } as const;

/** Reactive `prefers-reduced-motion`; also disables timed exits. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);
  return reduced;
}
