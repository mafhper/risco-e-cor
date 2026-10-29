// Deterministic randomness shared by the stroke engines.
//
// Grain is not a cosmetic detail: undo/redo, autosave and every thumbnail
// re-derive the drawing from the command list, so the same stroke id must
// always produce the same texture. The seed is the id, which is already
// persisted — no migration, no clock, no Math.random anywhere.
//
// Both engines (the SVG grain in `strokeTexture.ts` and the raster stamping in
// `brushCanvas.ts`) draw from this module so a stroke keeps its identity when
// it moves from one substrate to the other.

/** FNV-1a: a small, stable hash so the seed is the id and not the clock. */
export function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32: tiny deterministic PRNG, good enough for grain. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
