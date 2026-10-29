// Row 2 of the compact bar, 26/10 (`compacta-unificada` §11.1/§11.2). Seam: the
// panel minimum a hand actually touches — two lines of chips in both bands.
//
//   composition: TWELVE targets in 6 + 6 — the eleven tools plus the door to
//                the ACTIVE tool's adjustments, which always closes the row
//   no overflow: no chevron, no second state, nothing hidden and nothing open
//   3-5:         five materials on one line, no eleventh target (no tool panel)
//   selection:   ring + a DIFFERENT PLATE, and the plate pair is MEASURED at
//                ≥3:1 in both bands, both lines, both schemes — a ring alone
//                is no longer a pass (§11.2)
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

function Harness({
  profileId,
  pageId,
  slots,
}: {
  profileId: string;
  pageId: string | null;
  slots?: string[] | undefined;
}) {
  const { state, dispatch } = useStore();
  const key = slots ? slots.join("|") : "";
  useEffect(() => {
    dispatch({ type: "selectProfile", id: profileId });
    if (key)
      dispatch({ type: "updateProfile", id: profileId, patch: { toolSlots: key.split("|") } });
  }, [dispatch, profileId, key]);
  const art = state.artworks.find((a) => a.profileId === profileId && a.pageId === pageId);
  if (!art) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

function openCompact(profileId: string, pageId: string | null, slots?: string[]) {
  render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} slots={slots} />
    </StoreProvider>,
  );
  fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
  return screen.getByTestId("canvas-compact");
}

const lines = (compact: HTMLElement) =>
  within(compact)
    .getAllByTestId("compact-tools-line")
    .map((line) => ({
      line: line.getAttribute("data-line"),
      tools: within(line)
        .getAllByRole("button")
        .map((chip) => chip.getAttribute("data-tool") ?? chip.getAttribute("data-target")),
    }));

const chipOf = (compact: HTMLElement, tool: string) =>
  within(compact)
    .getAllByRole("button")
    .find((chip) => chip.getAttribute("data-tool") === tool)!;

/**
 * The two tokens the pro plates paint, read from the stylesheet itself — jsdom
 * applies no cascade, so the numbers come from the source of truth rather than
 * from a table copied into the test. `--muted` is the idle plate, `--foreground`
 * the plate of the chip in hand (the classes `bg-muted` / `bg-foreground` name
 * exactly these two).
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

describe("row 2 is twelve targets in 6 + 6", () => {
  it("puts six tools on the first line and five plus the adjustments door on the second", () => {
    const compact = openCompact("maria", "peixe");

    expect(lines(compact)).toEqual([
      { line: "1", tools: ["eraser", "fill", "pencil", "charcoal", "crayon", "marker"] },
      { line: "2", tools: ["brush", "watercolor", "oil", "spray", "ink", "more-adjustments"] },
    ]);
    // Twelve targets, eleven of them tools — counted on the DOM, not assumed.
    const buttons = within(compact).getAllByRole("button");
    expect(buttons.filter((chip) => chip.hasAttribute("data-tool"))).toHaveLength(11);
    expect(buttons.filter((chip) => chip.getAttribute("data-role") === "door")).toHaveLength(1);
  });

  it("closes the row with the adjustments door: last, neutral, outside every group", () => {
    const compact = openCompact("maria", "peixe");
    const second = within(compact).getAllByTestId("compact-tools-line")[1]!;
    const door = within(second).getByTestId("compact-more-adjustments");

    // LAST in the row, and a direct child of the line: the door is not inside
    // any tool category, it closes the row on its own.
    expect(within(second).getAllByRole("button").at(-1)).toBe(door);
    expect(door).toHaveAccessibleName("Mais ajustes");
    expect(door.parentElement).toBe(second);
    for (const group of within(second).queryAllByRole("group")) {
      expect(group.contains(door)).toBe(false);
    }
    // A door, never a state: no ring, no pressed state, no plate state.
    expect(door).not.toHaveAttribute("aria-pressed");
    expect(door).not.toHaveAttribute("data-plate-state");
    expect(door.className).not.toContain("ring-2");
    expect(door.className).toContain("h-11");
    expect(door.className).toContain("w-11");
  });

  it("opens the sheet on the tool in hand, without changing it", () => {
    const compact = openCompact("maria", "peixe");
    fireEvent.click(chipOf(compact, "watercolor"));
    fireEvent.click(within(compact).getByTestId("compact-more-adjustments"));

    const panel = screen.getByTestId("canvas-panel");
    // The door lands on the ACTIVE tool's adjustments: the sheet names the
    // watercolour, which was picked on the second line.
    expect(within(panel).getAllByText("Aquarela").length).toBeGreaterThan(0);
  });

  it("has no overflow door left: nothing is hidden, so nothing opens", () => {
    const compact = openCompact("maria", "peixe");
    expect(within(compact).queryByLabelText("Ver todas as ferramentas")).toBeNull();
    expect(within(compact).queryByTestId("compact-tools-overflow")).toBeNull();
    expect(within(compact).queryByTestId("compact-tools-more")).toBeNull();
    // No TOOL carries disclosure state; the only `aria-expanded` in the bar is
    // the mode switch at the top (§12.7).
    expect(
      within(compact).getByTestId("compact-tools").querySelector("[aria-expanded]"),
    ).toBeNull();
    expect(within(compact).queryAllByLabelText(/Ver todas|Mais ferramentas/)).toHaveLength(0);
  });

  it("never lets the door climb to the first line, even on a one-tool profile", () => {
    const compact = openCompact("maria", "peixe", ["marker"]);
    expect(lines(compact)).toEqual([
      { line: "1", tools: ["marker"] },
      { line: "2", tools: ["more-adjustments"] },
    ]);
  });

  it("keeps 3-5 on one line of five, with no adjustments door at all", () => {
    const compact = openCompact("theo", "foguete");
    expect(lines(compact)).toEqual([
      { line: "1", tools: ["eraser", "fill", "crayon", "marker", "brush"] },
    ]);
    expect(within(compact).queryByTestId("compact-more-adjustments")).toBeNull();
    expect(within(compact).queryByLabelText("Mais ajustes")).toBeNull();
  });
});

describe("the chip in hand is evident, not deduced", () => {
  it("wears the ring AND a different plate on both lines, ring never alone", () => {
    const compact = openCompact("maria", "peixe");

    // Line 1: the pencil.
    fireEvent.click(chipOf(compact, "pencil"));
    let on = chipOf(compact, "pencil");
    expect(on).toHaveAttribute("data-plate-state", "on");
    expect(on.className).toContain("ring-2");
    expect(on.className).toContain("bg-foreground");
    expect(chipOf(compact, "charcoal").className).toContain("bg-muted");

    // Line 2: the watercolour — the other end of the row.
    fireEvent.click(chipOf(compact, "watercolor"));
    on = chipOf(compact, "watercolor");
    expect(on).toHaveAttribute("data-plate-state", "on");
    expect(on.className).toContain("ring-2");
    expect(on.className).toContain("bg-foreground");
    expect(chipOf(compact, "pencil").className).toContain("bg-muted");

    // Exactly one chip is in hand, in the whole row.
    expect(
      within(compact)
        .getAllByRole("button")
        .filter((chip) => chip.getAttribute("data-plate-state") === "on"),
    ).toHaveLength(1);
  });

  it("measures ≥3:1 between the two pro plates, in both schemes", () => {
    // Registered pair (measured on this lote, not estimated):
    //   light  #1c1b1a in hand against #ddd5c4 idle → 11.78:1
    //   dark   #efe7d8 in hand against #2e2a24 idle → 11.60:1
    for (const scheme of ["light", "dark"] as const) {
      const { idle, active } = schemeTokens(scheme);
      expect(contrastRatio(active!, idle!), `${scheme} plate pair`).toBeGreaterThanOrEqual(3);
    }
  });

  it("measures ≥3:1 between the two kid cards, from the hexes they paint", () => {
    // Registered pair: #1C1410 (card in hand) against #F0ECE0 (paper) → 15.37:1.
    const compact = openCompact("theo", "foguete");
    // A material in hand (a coloring page opens on the bucket, which has no
    // contour of its own to read).
    fireEvent.click(within(compact).getByLabelText("Giz de cera"));
    const on = within(compact)
      .getAllByRole("button")
      .filter((chip) => chip.getAttribute("data-plate-state") === "on");
    const off = within(compact)
      .getAllByRole("button")
      .filter((chip) => chip.getAttribute("data-plate-state") === "off");
    expect(on).toHaveLength(1);

    const activePlate = on[0]!.getAttribute("data-plate")!;
    const idles = new Set(off.map((chip) => chip.getAttribute("data-plate")));
    // One shared paper card for every material that is not in hand (F1'), so
    // the pair is one number, not a per-material lottery.
    expect(idles.size).toBe(1);
    const idlePlate = [...idles][0]!;
    expect(activePlate).not.toBe(idlePlate);
    expect(contrastRatio(activePlate, idlePlate)).toBeGreaterThanOrEqual(3);
    // The object keeps its pigment: only the card and the contour flipped.
    expect(on[0]!.querySelector("svg[data-ink]")?.getAttribute("data-ink")).toBe(idlePlate);
  });
});
