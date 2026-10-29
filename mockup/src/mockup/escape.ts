import { useEffect, useRef } from "react";

/**
 * One Escape, one layer.
 *
 * The shell used to mirror the top-bar back button on its own `keydown`
 * listener, and every sheet did the same for its close button. The shell's
 * listener was registered first, so one Escape ran *both*: the "Criar" sheet on
 * a profile closed and the profile navigated to the Home in the same keystroke —
 * a child pressing Esc once was thrown out of their space.
 *
 * So the shell and the overlays now share one listener and one rule: Escape goes
 * to the topmost open overlay; only with no overlay open does it reach the
 * screen's back action. Overlays register in mount order, which is also their
 * paint order, so the sheet that mounts last is the one on top and consumes the
 * keystroke. The keystroke is consumed once: the winning layer gets it, and the
 * browser's default action for that Escape is cancelled.
 */

type EscapeHandler = () => void;

/** Open overlays, oldest first; the last one is the topmost. */
const overlays: EscapeHandler[] = [];
/** The screen's back action, consulted only when no overlay is open. */
let back: EscapeHandler | null = null;
let listening = false;

function onKeyDown(event: KeyboardEvent) {
  if (event.key !== "Escape") return;
  const top = overlays[overlays.length - 1] ?? back;
  if (!top) return;
  // Exactly one layer consumes this Escape, and nothing else may act on it.
  event.preventDefault();
  top();
}

/** Installs or removes the single window listener as layers come and go. */
function syncListener() {
  const needed = overlays.length > 0 || back !== null;
  if (needed === listening) return;
  if (needed) window.addEventListener("keydown", onKeyDown);
  else window.removeEventListener("keydown", onKeyDown);
  listening = needed;
}

function pushOverlay(handler: EscapeHandler): () => void {
  overlays.push(handler);
  syncListener();
  return () => {
    const index = overlays.indexOf(handler);
    if (index >= 0) overlays.splice(index, 1);
    syncListener();
  };
}

/**
 * Registers an overlay (sheet, dialog, panel) that closes on Escape while open.
 * Mount it where the overlay is mounted: mount order is stacking order.
 */
export function useEscapeOverlay(handler: EscapeHandler, open = true): void {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!open) return;
    return pushOverlay(() => ref.current());
  }, [open]);
}

/**
 * Registers the screen's back action. It only runs when no overlay is open, so
 * closing a sheet never also leaves the screen.
 */
export function useEscapeBack(handler: EscapeHandler | null): void {
  const ref = useRef<EscapeHandler | null>(handler);
  const active = handler !== null;
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    if (!active) return;
    const entry: EscapeHandler = () => ref.current?.();
    back = entry;
    syncListener();
    return () => {
      if (back === entry) back = null;
      syncListener();
    };
  }, [active]);
}
