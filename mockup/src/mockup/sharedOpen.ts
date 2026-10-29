// The one shared-element handoff the mockup has (P1, galeria → canvas).
//
// The gallery measures the card at the tap and stashes its screen rect; the
// canvas — which mounts a frame later — takes it once and grows the sheet from
// that rect. A module-level handoff is deliberate: the two screens never share
// a React tree, and a store field would persist a value that is only valid for
// one frame. `take` consumes, so a reload or a back-navigation never replays.
export type OpenRect = { x: number; y: number; w: number; h: number };

let pending: OpenRect | null = null;

const valid = (r: OpenRect | null | undefined): r is OpenRect =>
  !!r && [r.x, r.y, r.w, r.h].every((n) => Number.isFinite(n)) && r.w > 0 && r.h > 0;

export function stashOpenRect(rect: OpenRect | null): void {
  pending = valid(rect) ? rect : null;
}

export function takeOpenRect(): OpenRect | null {
  const rect = pending;
  pending = null;
  return valid(rect) ? rect : null;
}

/** Test/utility: is there a handoff waiting? Never used by the screens. */
export function hasOpenRect(): boolean {
  return valid(pending);
}
