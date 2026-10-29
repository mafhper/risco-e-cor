import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";
import { useEscapeOverlay } from "./escape";
import { MOTION, useReducedMotion } from "./motion";

/**
 * Presence for overlays, without a motion library.
 *
 * Enter animations are CSS (a one-shot staged sequence). The exit is the pair
 * the enter promises: a fixed 12px translate and a fade, 150ms, ease-out, kept
 * mounted until it finishes. `initial = false` mirrors AnimatePresence: an
 * overlay already open on the first paint renders settled, so a reload never
 * replays the entrance. Reduced motion collapses the exit to an instant
 * unmount — the static result is the cue.
 *
 * The exit ends on the animation's own `animationend`, not on a parallel
 * wall-clock timer: slowing the animation (the 10% replay in devtools) must not
 * have the panel disappear halfway through. Engines without the Web Animations
 * API fall back to the documented 150ms.
 */
export function usePresence(open: boolean, initial = false) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<"closed" | "open" | "exiting">(open ? "open" : "closed");
  const skipEnter = useRef(open && !initial);

  const finish = useCallback(
    // A stale animation-cancel (e.g. re-opening mid-exit) must not close a panel
    // that is already back open.
    () => setPhase((current) => (current === "exiting" ? "closed" : current)),
    [],
  );

  useEffect(() => {
    skipEnter.current = false;
  }, []);

  useEffect(() => {
    if (open) {
      setPhase("open");
      return;
    }
    setPhase((current) => (current === "open" ? (reduced ? "closed" : "exiting") : current));
  }, [open, reduced]);

  return {
    mounted: phase !== "closed",
    exiting: phase === "exiting",
    animateEnter: phase === "open" && !skipEnter.current,
    finish,
  };
}

/**
 * Keeps the last non-null payload while an overlay animates out. Closing a
 * dialog nulls its state first; without this the panel would empty mid-exit.
 */
export function useRetained<T>(value: T | null): T | null {
  const [retained, setRetained] = useState<T | null>(value);
  useEffect(() => {
    if (value !== null) setRetained(value);
  }, [value]);
  return retained;
}

/**
 * Ends the exit when the exit animation ends. Without Web Animations (jsdom,
 * very old engines) the documented duration is the only clock available.
 */
function useExitEnd(
  ref: RefObject<HTMLDivElement | null>,
  exiting: boolean,
  finish: () => void,
  animationName: string,
) {
  useEffect(() => {
    if (!exiting) return;
    const panel = ref.current;
    if (!panel || typeof panel.getAnimations !== "function") {
      const timer = setTimeout(finish, MOTION.sheetExit);
      return () => clearTimeout(timer);
    }

    const onEnd = (event: AnimationEvent) => {
      if (event.target !== panel) return;
      // A cancel is also an end: the panel must not stay mounted forever.
      if (event.type === "animationcancel" || event.animationName === animationName) finish();
    };
    panel.addEventListener("animationend", onEnd);
    panel.addEventListener("animationcancel", onEnd);

    // The animation may be disabled (a stylesheet turned it off): if nothing is
    // running after a frame, there is nothing to wait for.
    const frame = requestAnimationFrame(() => {
      const running = panel.getAnimations().some((a) => a.playState === "running");
      if (!running) finish();
    });
    return () => {
      cancelAnimationFrame(frame);
      panel.removeEventListener("animationend", onEnd);
      panel.removeEventListener("animationcancel", onEnd);
    };
  }, [exiting, finish, ref, animationName]);
}

/** Bottom sheet: the app's one dismissible surface. */
export function Sheet({
  open,
  onClose,
  label,
  labelledBy,
  testid,
  panel = "",
  backdrop = "bg-nanquim/25",
  z = "z-30",
  initial = false,
  closeLabel = "Fechar",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  labelledBy?: string | undefined;
  testid?: string;
  panel?: string;
  backdrop?: string;
  z?: string;
  initial?: boolean;
  closeLabel?: string;
  children: ReactNode;
}) {
  const { mounted, exiting, animateEnter, finish } = usePresence(open, initial);
  const panelRef = useRef<HTMLDivElement>(null);
  useExitEnd(panelRef, exiting, finish, "sheet-out");
  useEscapeOverlay(onClose, open);
  if (!mounted) return null;

  return (
    <div className={cn("absolute inset-0 flex items-end justify-center", z)}>
      <button
        type="button"
        aria-label={closeLabel}
        className={cn(
          "absolute inset-0",
          backdrop,
          exiting ? "animate-scrim-out" : "animate-scrim-in",
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        data-testid={testid}
        data-state={exiting ? "closed" : "open"}
        aria-hidden={exiting || undefined}
        className={cn(
          "relative w-full",
          panel,
          exiting ? "animate-sheet-out pointer-events-none" : animateEnter && "animate-sheet-in",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Side panel: the one surface that slides in from an edge (P1 — layers/paper
 * share the choreography). It is 90% wide on purpose: the canvas stays visible
 * on the other side, so a side panel never needs an opaque scrim. Radius is the
 * sheet token on the inner edge — never 0.
 */
export function SidePanel({
  open,
  onClose,
  label,
  testid,
  side = "left",
  initial = false,
  closeLabel = "Fechar",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  testid?: string;
  side?: "left" | "right";
  initial?: boolean;
  closeLabel?: string;
  children: ReactNode;
}) {
  const { mounted, exiting, animateEnter, finish } = usePresence(open, initial);
  const panelRef = useRef<HTMLDivElement>(null);
  useExitEnd(panelRef, exiting, finish, "panel-out");
  useEscapeOverlay(onClose, open);
  if (!mounted) return null;

  const from = side === "left" ? "-100%" : "100%";
  return (
    <div className="absolute inset-0 z-40">
      <button
        type="button"
        aria-label={closeLabel}
        className={cn(
          "absolute inset-0 bg-nanquim/10",
          exiting ? "animate-scrim-out" : "animate-scrim-in",
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        data-testid={testid}
        data-panel-side={side}
        data-radius="sheet"
        data-state={exiting ? "closed" : "open"}
        aria-hidden={exiting || undefined}
        style={{ "--panel-from": from, "--panel-exit": "12px" } as CSSProperties}
        className={cn(
          "absolute inset-y-0 flex w-[90%] max-w-[380px] flex-col bg-card shadow-tile",
          side === "left"
            ? "left-0 rounded-r-[var(--radius-sheet)]"
            : "right-0 rounded-l-[var(--radius-sheet)]",
          exiting ? "animate-panel-out pointer-events-none" : animateEnter && "animate-panel-in",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Centered dialog: only for irreversible acts, so it exits faster than it enters. */
export function Dialog({
  open,
  onClose,
  label,
  role = "dialog",
  labelledBy,
  testid,
  panel = "",
  initial = false,
  closeLabel = "Fechar",
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  role?: "dialog" | "alertdialog";
  labelledBy?: string;
  testid?: string;
  panel?: string;
  initial?: boolean;
  closeLabel?: string;
  children: ReactNode;
}) {
  const { mounted, exiting, animateEnter, finish } = usePresence(open, initial);
  const panelRef = useRef<HTMLDivElement>(null);
  useExitEnd(panelRef, exiting, finish, "pop-out");
  useEscapeOverlay(onClose, open);
  if (!mounted) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-5">
      <button
        type="button"
        aria-label={closeLabel}
        className={cn(
          "absolute inset-0 bg-nanquim/30",
          exiting ? "animate-scrim-out" : "animate-scrim-in",
        )}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-label={label}
        aria-labelledby={labelledBy}
        data-testid={testid}
        data-state={exiting ? "closed" : "open"}
        aria-hidden={exiting || undefined}
        className={cn(
          "relative w-full max-w-sm rounded-[var(--radius-sheet)] bg-card p-6 shadow-tile",
          panel,
          exiting ? "animate-pop-out pointer-events-none" : animateEnter && "animate-pop-in",
        )}
      >
        {children}
      </div>
    </div>
  );
}
