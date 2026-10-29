// One toolbar, always at the bottom.
//
// The bar is the SAME bar on every skin — the kids skin and the pro skin both
// draw with the thumb, so the bar never moves to a side and no position is
// stored. What the bar carries is decided by what the profile can USE. Nothing the profile
// cannot open is rendered at all: no padlock, no dimmed copy, no dead door. A
// tool the profile may not use simply is not there, and the row closes the gap.
// The shelf is one door away, and it exists only when the profile has more tools
// than the bar can carry.
import type { CanvasTool } from "./brush";
import { kidTools } from "./capabilities";

/** The top chrome is five actions at most (spec §0.1). */
export const CHROME_CHIP_LIMIT = 5;

/**
 * The base set the bar carries. The bucket works on a coloring page AND on a
 * blank sheet (it paints the paper itself), so it is always available — a child
 * who wants to fill a space never meets a locked tool.
 */
export function baseTools(kids: boolean): CanvasTool[] {
  // One source of truth for the kids set: the bar used to keep its own copy of
  // the three-tool list and stayed behind when ADR-001 was amended (owner's
  // report: "no modo compacto está travado o lápis").
  if (kids) return kidTools();
  return ["fill", "pencil", "brush", "marker", "eraser"];
}
