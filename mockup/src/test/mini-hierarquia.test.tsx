// The resting pill's HIERARCHY (owner's report with a screenshot, 27/10).
// Seam: the pill a hand touches when nothing is open — WHICH door carries the
// state, and what the colour in hand is allowed to look like.
//
//   mark     the door in hand wears the compact row's own language: a flipped
//            plate (`data-plate-state`) plus the ring — never a ring alone
//   colour   a PROPERTY of that door: 28dp, no ring, no plate, no
//            `data-plate-state`, so it can never be read as the selected thing
//   breath   12dp of air between the tool group and the colour, and the two
//            tools are one `role="group"` — the boundary is structure, not luck
//   bands    the same rule on 9+ and 3-5, with the plate pair MEASURED at >= 3:1
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
import { contrastRatio } from "@/mockup/palette";
import { CanvasScreen } from "@/mockup/screens/CanvasScreen";

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Harness({ profileId }: { profileId: string }) {
  const { state, dispatch } = useStore();
  const id = `hier-${profileId}`;
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    dispatch({
      type: "createArtwork",
      artwork: {
        id,
        profileId,
        pageId: null,
        w: 300,
        h: 300,
        history: { commands: [], redo: [], undoable: 0 },
        createdAt: 1,
        updatedAt: 1,
        visibility: "draft",
        publishedAt: null,
      },
    });
  }, [dispatch, profileId, id]);
  const art = state.artworks.find((a) => a.id === id);
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

const mount = (profileId = "maria") =>
  render(
    <StoreProvider>
      <Harness profileId={profileId} />
    </StoreProvider>,
  );

const dock = () => screen.getByTestId("canvas-dock");
const doorOf = (testid: string) => within(dock()).getByTestId(testid);
/** The plate every tool door publishes: state, surface, ink. */
const plateIn = (testid: string) => doorOf(testid).querySelector("[data-plate-state]");
/** The doors that are TOOLS: exactly one of them may be in hand. */
const markedDoors = () =>
  [...dock().querySelectorAll("[data-plate-state]")].filter(
    (plate) => plate.getAttribute("data-plate-state") === "on",
  );

/**
 * The two tokens the 9+ plates paint, read from the stylesheet itself — jsdom
 * applies no cascade, so the numbers come from the source of truth. `--muted` is
 * the idle plate, `--foreground` the plate of the door in hand: the same pair
 * the compact row already registers.
 */
function schemeTokens(scheme: "light" | "dark"): Record<string, string> {
  const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");
  const scopes: Record<"light" | "dark", Record<string, string>> = { light: {}, dark: {} };
  let current: Record<string, string> = scopes.light;
  for (const line of css.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === ".dark," || trimmed.startsWith('[data-color-scheme="dark"]')) {
      current = scopes.dark;
    }
    const found = line.match(/^\s*(--[a-z-]+):\s*([^;]+);/);
    if (found) current[found[1]!] = found[2]!.trim();
  }
  const resolveToken = (name: string, depth = 0): string => {
    const raw = scopes[scheme][name];
    if (!raw) throw new Error(`${name} missing from the ${scheme} block`);
    const indirect = raw.match(/^var\((--[a-z-]+)\)$/);
    return indirect && depth < 4 ? resolveToken(indirect[1]!, depth + 1) : raw;
  };
  return { idle: resolveToken("--muted"), active: resolveToken("--foreground") };
}

/* ------------------------------------------------------------------ *
 * 9+ — the tool in hand is evident, the colour is a property          *
 * ------------------------------------------------------------------ */

describe("9+: the door in hand is marked, the colour is not a door", () => {
  it("flips the plate and adds the ring to the material in hand", () => {
    mount("maria");
    // A blank sheet opens on the brush: that is the door in hand.
    expect(doorOf("mini-tool")).toHaveAttribute("data-tool", "brush");
    expect(doorOf("mini-tool")).toHaveAttribute("aria-pressed", "true");

    const on = plateIn("mini-tool")!;
    expect(on).toHaveAttribute("data-plate-state", "on");
    // A DIFFERENT SURFACE plus the ring — a ring alone is no longer a pass
    // (`compacta-alvos` §11.2), and this is the same pair of classes.
    expect(on.className).toContain("bg-foreground");
    expect(on.className).toContain("ring-2");
    expect(on.className).toContain("ring-offset-2");

    // The eraser is idle, and says so on its own plate.
    const off = plateIn("mini-eraser")!;
    expect(off).toHaveAttribute("data-plate-state", "off");
    expect(off.className).toContain("bg-muted");
    expect(off.className).not.toContain("ring-2");

    // Exactly one door is in hand in the whole pill: the pill answers "what am
    // I holding" by itself, without reading the rest of the panel.
    expect(markedDoors()).toHaveLength(1);
    expect(markedDoors()[0]).toBe(on);
  });

  it("moves the mark with the tool, and never leaves two doors marked", () => {
    mount("maria");
    fireEvent.click(doorOf("mini-eraser"));

    expect(doorOf("mini-eraser")).toHaveAttribute("aria-pressed", "true");
    expect(plateIn("mini-eraser")).toHaveAttribute("data-plate-state", "on");
    expect(plateIn("mini-tool")).toHaveAttribute("data-plate-state", "off");
    expect(plateIn("mini-tool")!.className).not.toContain("ring-2");
    expect(markedDoors()).toHaveLength(1);

    // And back: the mark belongs to whoever is in hand, not to a position.
    fireEvent.click(doorOf("mini-tool"));
    expect(plateIn("mini-tool")).toHaveAttribute("data-plate-state", "on");
    expect(plateIn("mini-eraser")).toHaveAttribute("data-plate-state", "off");
    expect(markedDoors()).toHaveLength(1);
  });

  it("draws the colour as a glyph-sized swatch with no ring and no plate", () => {
    mount("maria");
    const color = doorOf("mini-color");
    const swatch = within(color).getByTestId("mini-color-swatch");

    // No state of its own: the colour is never a door that can be "on".
    expect(color.querySelector("[data-plate-state]")).toBeNull();
    expect(color.querySelector("[data-plate]")).toBeNull();
    expect(color).not.toHaveAttribute("data-plate-state");
    expect(color.className).not.toContain("ring-");
    expect(swatch.className).not.toContain("ring-");
    // The white INNER ring the old disc carried is what read as "selected".
    expect(swatch.className).not.toContain("shadow-");

    // Same size as the drawing beside it: the numbers are the DOM's own.
    const glyph = doorOf("mini-tool").querySelector("svg")!;
    expect(swatch.style.width).toBe("28px");
    expect(swatch.style.height).toBe("28px");
    expect(glyph.getAttribute("width")).toBe("28");
    expect(swatch.style.width).toBe(`${glyph.getAttribute("width")}px`);
  });

  it("keeps 12dp of air between the tool group and the colour", () => {
    mount("maria");
    const pill = dock();
    const tools = within(pill).getByRole("group", { name: "Ferramentas" });
    const breath = within(pill).getByTestId("mini-color-breath");
    const color = doorOf("mini-color");

    // The two tools are one group and the colour is OUTSIDE it.
    expect(tools.contains(doorOf("mini-eraser"))).toBe(true);
    expect(tools.contains(doorOf("mini-tool"))).toBe(true);
    expect(tools.contains(color)).toBe(false);

    // Order: tools | 12dp | colour | the way into the bar.
    const order = [...pill.children];
    expect(order.indexOf(tools)).toBe(0);
    expect(order.indexOf(breath)).toBe(1);
    expect(order.indexOf(color)).toBe(2);
    expect(order.indexOf(doorOf("mini-expand"))).toBe(3);

    // A real 12dp box, not a side effect of a flex gap.
    expect(breath).toHaveAttribute("data-breath", "12");
    expect(breath.style.width).toBe("12px");
  });

  it("measures the plate pair at >= 3:1 in both schemes", () => {
    // Registered pair (already measured on the compact row): the 9+ pill paints
    // exactly these two classes, so it inherits the same numbers.
    for (const scheme of ["light", "dark"] as const) {
      const { idle, active } = schemeTokens(scheme);
      expect(contrastRatio(active!, idle!), `${scheme} plate pair`).toBeGreaterThanOrEqual(3);
    }
  });
});

/* ------------------------------------------------------------------ *
 * 3-5 — the same rule, with the kid card as the plate                 *
 * ------------------------------------------------------------------ */

describe("3-5: the same mark, the same demoted colour", () => {
  it("flips the kid card of the material in hand, ring included", () => {
    mount("theo");
    expect(doorOf("mini-tool")).toHaveAttribute("data-tool", "crayon");

    const on = plateIn("mini-tool")!;
    const off = plateIn("mini-eraser")!;
    expect(on).toHaveAttribute("data-plate-state", "on");
    expect(off).toHaveAttribute("data-plate-state", "off");

    // The card in hand is the material's ink and the idle card is paper — the
    // kid pair `compacta-alvos` registers, painted by `activePlate`.
    expect(on).toHaveAttribute("data-plate", "#1C1410");
    expect(off).toHaveAttribute("data-plate", "#F0ECE0");
    expect(on.className).toContain("ring-2");
    expect(off.className).not.toContain("ring-2");

    // The object keeps its pigment: only the card and the contour flipped.
    expect(on.querySelector("svg")!.getAttribute("data-ink")).toBe("#F0ECE0");
    expect(off.querySelector("svg")!.getAttribute("data-ink")).toBe("#1C1410");

    expect(markedDoors()).toHaveLength(1);
  });

  it("measures the kid card pair at >= 3:1", () => {
    mount("theo");
    const on = plateIn("mini-tool")!;
    const off = plateIn("mini-eraser")!;
    expect(
      contrastRatio(on.getAttribute("data-plate")!, off.getAttribute("data-plate")!),
    ).toBeGreaterThanOrEqual(3);
    // And the glyph survives the flipped card it ends on.
    expect(
      contrastRatio(
        on.querySelector("svg")!.getAttribute("data-ink")!,
        on.getAttribute("data-plate")!,
      ),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the colour a 28dp property, smaller than the child's object", () => {
    mount("theo");
    const color = doorOf("mini-color");
    const swatch = within(color).getByTestId("mini-color-swatch");
    const glyph = doorOf("mini-tool").querySelector("svg")!;

    expect(swatch.style.width).toBe("28px");
    expect(swatch.className).not.toContain("ring-");
    expect(swatch.className).not.toContain("shadow-");
    expect(color.querySelector("[data-plate-state]")).toBeNull();
    expect(color.className).not.toContain("ring-");

    // The kid object is 40 by the band's own spec, so the colour comes out
    // SMALLER than the glyph — never larger, which is the reading the rule holds.
    expect(glyph.getAttribute("width")).toBe("40");
    expect(Number(swatch.style.width.replace("px", ""))).toBeLessThanOrEqual(
      Number(glyph.getAttribute("width")),
    );
  });
});
