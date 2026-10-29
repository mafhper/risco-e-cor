// THE CANVAS BANDS' GEOMETRY, read from the DOM instead of copied by hand.
//
// Since 27/10 (`chrome-v2` §12) the canvas has TWO bands and NEITHER is over the
// paper. The top row with two flanks and a hamburger was revoked with the rail:
//
//   top     the workspace selector alone (plus the page's name on 9+ when there
//           is no switch), in the frame's flow, ABOVE the stage
//   bottom  [ Voltar ] and the tools pill, two targets in a fixed order
//
// jsdom has no layout, so what is measured here is the MODEL the browser
// applies — the same kind of measurement the previous batches used to reproduce
// the −54dp that Chrome measured and the 0dp that followed it:
//
//   - the top band centres with `justify-center` and one `p-3` gutter. With ONE
//     child, the free space is split equally, so the child's centre is the
//     band's centre at any width: 0dp of deviation BY CONSTRUCTION, not by luck,
//     and with no flank left to weigh against it;
//   - the bottom band is a `1fr auto 1fr` grid: the two side columns weigh the
//     same even though only the first one is drawn, so the middle column (the
//     tools) is the band's centre.
//
// The drawer's LATCH (`latchIsGlued` / `latchIsCentred`) still lives here: it is
// the control that hangs from the drawer's top edge and the reason the sheet
// reserves `latch + 8dp` above itself.

/** `p-3` — every band's own gutter, the same token the HUD band uses. */
export const ROW_PAD = 12;
/** `gap-1` — one gap between two side-by-side targets. */
export const ROW_GAP = 4;

/** The two declared door sizes, in dp: 9+ and 3-5. */
export const DOOR_W: Record<string, number> = { "w-11": 44, "w-13": 52 };

function doorWidthDp(node: Element): number {
  for (const name of node.classList) {
    const dp = DOOR_W[name];
    if (dp !== undefined) return dp;
  }
  throw new Error(`porta sem largura declarada: ${node.outerHTML.slice(0, 90)}`);
}

/** The declared size of a door, in dp (`w-11` = 44 on 9+, `w-13` = 52 on 3-5). */
export function doorSize(node: Element): number {
  return doorWidthDp(node);
}

export type BandGeometry = {
  /** Which band was read: the one above the stage, or the one below it. */
  mode: "top" | "bottom";
  /** Element children of the band — the targets, not the wrappers' leaves. */
  children: number;
  /** The band's gutter, in dp. */
  pad: number;
  /** The gap between the band's children, in dp. */
  gap: number;
  /** The width the centred content DECLARES (`data-width`), when it declares one. */
  contentW: number;
  /** Air on each side of the centred content, in dp. */
  air: number;
  /**
   * The centre of the centred content against the band's centre, in dp — the
   * number the owner guards. Zero is the contract.
   */
  offset: number;
  /** Whether the centring is a DECLARATION read from the DOM (not an estimate). */
  centred: boolean;
  /** Whether the band's children are laid out as a `1fr auto 1fr` grid. */
  grid: boolean;
};

/**
 * One band's geometry, modelled from what it declares: the gutter (`p-3`), the
 * centring (`justify-center` with a single child, or a `1fr auto 1fr` grid) and
 * the width the centred content declares.
 *
 * `bandWidth` is the frame the band is laid out in — the phone's own width, since
 * both bands are `inset-x-0`/full-bleed in the frame.
 */
export function topRowGeometry(band: HTMLElement, bandWidth: number): BandGeometry {
  const mode = band.getAttribute("data-band") === "bottom" ? "bottom" : "top";
  const children = [...band.children];
  const grid = [...band.classList].some((name) => name.startsWith("grid-cols-[1fr_auto_1fr]"));
  const centred = grid || band.classList.contains("justify-center");
  const content = children.find((child) =>
    child.querySelector('[data-testid="workspace-switcher"]'),
  );
  const pill = band.querySelector<HTMLElement>('[data-testid="workspace-switcher"]');
  const declared = Number(pill?.getAttribute("data-width") ?? "0");
  const contentW =
    declared > 0
      ? declared
      : content
        ? Number(content.getAttribute("data-width") ?? "0")
        : children.length > 0
          ? bandWidth - ROW_PAD * 2
          : 0;
  // Both layouts split the free space EQUALLY around the centre:
  //  - `justify-center` with one child: the child sits in the middle of the
  //    content box, so its centre is the band's centre;
  //  - `1fr auto 1fr`: the side columns are equal by definition.
  const offset = centred && children.length <= (grid ? 2 : 1) ? 0 : Number.NaN;
  const air = (bandWidth - ROW_PAD * 2 - contentW) / 2;
  return {
    mode,
    children: children.length,
    pad: ROW_PAD,
    gap: ROW_GAP,
    contentW,
    air,
    offset,
    centred,
    grid,
  };
}

/**
 * The band's own height, in dp: `p-3` above the content box, the content box,
 * `p-3` below. The content box is the chrome's target — 44 on 9+, 52 on 3-5 —
 * because that is the floor every control of a band declares. `border-box` is
 * why the DOM class is `min-h-17`/`min-h-19` for these two numbers: min-height
 * counts the padding, so the band lands at 68/76 and not at 44/52.
 */
export function chromeBandHeight(doorDp: number): number {
  return ROW_PAD * 2 + doorDp;
}

/**
 * THE DRAWER'S LATCH — the door that hangs from the drawer's top edge
 * (owner's report, 27/10). jsdom has no layout, so what a unit test can hold is
 * the DECLARATION: the control says where it is, in classes, and the browser
 * pass measures the pixels it produces at 390 and at 360.
 *
 *   - centred   `left-1/2` + `-translate-x-1/2`: the box's centre is the
 *               container's centre at any width, so the drawer's centre line is
 *               the same in the compact bar (inset by `mx-3` on both sides) and
 *               in the full-bleed sheet
 *   - glued     `bottom-full`: the box's bottom sits on the container's top
 *               edge and the control takes ZERO dp of the drawer's content
 */
export function latchIsCentred(node: Element): boolean {
  return node.classList.contains("left-1/2") && node.classList.contains("-translate-x-1/2");
}

export function latchIsGlued(node: Element): boolean {
  return node.classList.contains("bottom-full");
}
