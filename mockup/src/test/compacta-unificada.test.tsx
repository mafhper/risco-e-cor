// Compacta unificada (spec 26/10). Seam: the bar the hand actually touches, in
// both bands — ONE component, two densities, one rule per row.
//
//   thickness: one 1..100 capsule (minus / slider / plus) on 3-5 and on 9+
//   tools:     ELEVEN targets in 6 + 5 — the ten tools plus the "more
//              adjustments" door that always closes the row (§11.1). No
//              overflow door: nothing is hidden, nothing is half-visible and
//              nothing scrolls
//   order:     the profile's saved list, VERBATIM, in both panels — the eraser
//              and the bucket are the DEFAULT (pins in front), never a pin on
//              top of a stored order (owner's report, 27/10)
//   groups:    pins / materials / dropper told apart by SPACE, never by a surface
//   machine:   Theo stops at the compact bar (no sheet, no expand door)
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreProvider, useStore } from "@/mockup/store";
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

/**
 * The same canvas with a hand on the STORE: it seeds a stored list and then
 * rewrites it while the bar is open, which is the only way to see whether the
 * row is a view of the profile or a portrait taken when the dock opened.
 */
function LiveHarness() {
  const { state, dispatch } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
    dispatch({ type: "setToolSlots", id: "maria", slots: ["fill", "eraser"] });
  }, [dispatch]);
  const art = state.artworks.find((a) => a.profileId === "maria" && a.pageId === "peixe");
  if (!art) return null;
  return (
    <>
      <CanvasScreen artworkId={art.id} back={{ name: "home" }} />
      <button
        type="button"
        data-testid="reorder"
        onClick={() => dispatch({ type: "setToolSlots", id: "maria", slots: ["eraser", "fill"] })}
      />
    </>
  );
}

/** Pill → compact: the one door both bands share. */
function openCompact(profileId: string, pageId: string | null, slots?: string[]) {
  render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} slots={slots} />
    </StoreProvider>,
  );
  fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
  return screen.getByTestId("canvas-compact");
}

/** Every chip of the row, in reading order (line 1 then line 2). */
const rowOf = (compact: HTMLElement) =>
  within(within(compact).getByTestId("compact-tools"))
    .getAllByRole("button")
    .map((chip) => chip.getAttribute("data-tool"))
    .filter((tool): tool is string => tool !== null);

const lineOf = (compact: HTMLElement, line: "1" | "2") =>
  within(compact)
    .getAllByTestId("compact-tools-line")
    .find((node) => node.getAttribute("data-line") === line)!;

const thickness = (compact: HTMLElement) =>
  within(compact).getByTestId("compact-thickness-slider") as HTMLInputElement;

describe("thickness: one 1..100 capsule in both bands", () => {
  it("gives 3-5 and 9+ the same control, the same value and the same clamp", () => {
    for (const [profileId, pageId] of [
      ["theo", null],
      ["maria", "peixe"],
    ] as const) {
      const compact = openCompact(profileId, pageId);
      // The band's capsule belongs to a material that has a size: Maria's page
      // opens on the bucket, which has none (owner's call, 26/10), so the test
      // starts by picking the crayon — the one material both bands carry.
      fireEvent.click(within(compact).getByLabelText("Giz de cera"));
      const slider = () => thickness(compact);

      expect(slider(), profileId).toHaveAttribute("type", "range");
      expect(slider(), profileId).toHaveAttribute("min", "1");
      expect(slider(), profileId).toHaveAttribute("max", "100");
      expect(slider(), profileId).toHaveAttribute("step", "1");

      // Both ends are doors, never vanishing controls: minus at 1 and plus at
      // 100 stay in the row, disabled in place.
      const start = Number(slider().value);
      fireEvent.click(within(compact).getByLabelText("Mais espessura"));
      expect(Number(slider().value), profileId).toBe(start + 1);
      fireEvent.click(within(compact).getByLabelText("Menos espessura"));
      expect(Number(slider().value), profileId).toBe(start);

      fireEvent.change(slider(), { target: { value: "100" } });
      expect(within(compact).getByLabelText("Mais espessura"), profileId).toBeDisabled();
      expect(within(compact).getByLabelText("Menos espessura"), profileId).toBeEnabled();
      fireEvent.change(slider(), { target: { value: "1" } });
      expect(within(compact).getByLabelText("Menos espessura"), profileId).toBeDisabled();
      expect(within(compact).getByLabelText("Mais espessura"), profileId).toBeEnabled();

      // The number is ONE per person and the material that arrives inherits it
      // (owner's decision, 26/10, §11.3): no material opens at a default of its
      // own, and coming back never restores a saved per-material point.
      fireEvent.change(slider(), { target: { value: "42" } });
      fireEvent.click(within(compact).getByLabelText("Marcador"));
      expect(Number(slider().value), profileId).toBe(42);
      fireEvent.click(within(compact).getByLabelText("Giz de cera"));
      expect(Number(slider().value), profileId).toBe(42);
      if (profileId === "theo") {
        // The ERASER reads the same capsule AND the same number: one thickness,
        // one control, in both bands (owner's call, 26/10: P/M/G is gone).
        fireEvent.click(within(compact).getByLabelText("Borracha"));
        expect(within(compact).getByTestId("compact-thickness")).toHaveAttribute("data-size", "42");
        expect(Number(slider().value), profileId).toBe(42);
        fireEvent.change(slider(), { target: { value: "37" } });
        expect(Number(slider().value), profileId).toBe(37);
      } else {
        // The bucket has no size at all: no row, not a slider that lies.
        fireEvent.click(within(compact).getByLabelText("Pintar"));
        expect(within(compact).queryByTestId("compact-thickness")).toBeNull();
        fireEvent.click(within(compact).getByLabelText("Giz de cera"));
        expect(Number(slider().value), profileId).toBe(42);
      }

      cleanup();
      localStorage.clear();
    }
  });

  it("retires the three growth dots from the compact bar, keeping 44dp targets", () => {
    const compact = openCompact("theo", null);

    expect(within(compact).queryByRole("radiogroup", { name: "Tamanho" })).toBeNull();
    // The row is the capsule, not a capsule plus a sample that shifts it.
    expect(within(compact).queryByTestId("param-preview")).toBeNull();

    expect(within(compact).getByTestId("compact-thickness")).toHaveClass("h-14");
    expect(within(compact).getByLabelText("Menos espessura")).toHaveClass("h-12", "w-12");
    expect(within(compact).getByLabelText("Mais espessura")).toHaveClass("h-12", "w-12");

    // The bucket has no size — it fills the largest area inside the perimeter —
    // so its row is ABSENT, not a slider that changes nothing (owner's call,
    // 26/10). Coming back to a material brings the row back with its number.
    fireEvent.click(within(compact).getByLabelText("Pintar"));
    expect(within(compact).queryByTestId("compact-thickness")).toBeNull();
    fireEvent.click(within(compact).getByLabelText("Marcador"));
    expect(within(compact).getByTestId("compact-thickness")).toBeInTheDocument();
  });
});

describe("tools: twelve targets in 6 + 6, never a scroll", () => {
  it("shows the kid set on one line of five, with no eleventh target", () => {
    const compact = openCompact("theo", "foguete");
    const row = within(compact).getByTestId("compact-tools");

    expect(row).not.toHaveClass("overflow-x-auto");
    expect(lineOf(compact, "1").querySelectorAll("button")).toHaveLength(5);
    // Five fit on one line: there is no second line to draw.
    expect(within(compact).queryAllByTestId("compact-tools-line")).toHaveLength(1);
    expect(within(compact).queryByTestId("compact-more-adjustments")).toBeNull();
  });

  it("lays the pro row out as six tools and five tools plus the door", () => {
    const compact = openCompact("maria", "peixe");
    expect(within(compact).getAllByTestId("compact-tools-line")).toHaveLength(2);
    expect(within(compact).getByTestId("compact-tools")).not.toHaveClass("overflow-x-auto");

    const first = within(lineOf(compact, "1")).getAllByRole("button");
    const second = within(lineOf(compact, "2")).getAllByRole("button");
    expect(first).toHaveLength(6);
    expect(second).toHaveLength(6);
    // Every tool is reachable, each one exactly once, in reading order.
    const shown = rowOf(compact);
    expect(shown).toHaveLength(11);
    expect(new Set(shown).size).toBe(shown.length);
    expect(second.at(-1)).toHaveAttribute("data-target", "more-adjustments");
  });
});

describe("categories: named in the DOM, never given a second surface", () => {
  const groupsOf = (host: HTMLElement) =>
    within(host)
      .getAllByRole("group")
      .map((group) => ({
        label: group.getAttribute("aria-label"),
        tools: within(group)
          .getAllByRole("button")
          .map((chip) => chip.getAttribute("data-tool")),
        className: group.className,
      }));

  it("splits the first pro line into pins and materials on the one 6-column grid", () => {
    const compact = openCompact("maria", "peixe");
    const line = lineOf(compact, "1");

    // Pins keep the pin order; materials keep the row order they arrived in.
    expect(groupsOf(line)).toEqual([
      {
        label: "Ferramentas fixas",
        tools: ["eraser", "fill"],
        className: "contents",
      },
      {
        label: "Materiais",
        tools: ["pencil", "charcoal", "crayon", "marker"],
        className: "contents",
      },
    ]);

    // The block has ONE gap (8dp): line 2 must land on the same columns as line
    // 1, and a wider breath at a category boundary would push it off the grid
    // (`compacta-distribuicao` §1/§5). The category is semantic — a `contents`
    // box, so the chips are the grid's own items — and the space between them
    // is the grid's.
    expect(line.style.gap).toBe("8px");
    expect(line.style.gridTemplateColumns).toBe("repeat(6, 44px)");
    for (const group of within(line).getAllByRole("group")) {
      expect(group).toHaveClass("contents");
    }
    // And it is only a name: no divider, no second plate, no label to read.
    for (const group of within(line).getAllByRole("group")) {
      expect(group).not.toHaveClass("bg-muted");
      expect(group.className).not.toMatch(/border|rounded/);
    }
    expect(line.querySelector("hr")).toBeNull();
    // The category is a name in the DOM only: the tool row's surface carries no
    // label to read (the bar's words live in the colour area, below it).
    expect(line.textContent?.trim() ?? "").toBe("");
  });

  it("keeps the 3-5 row on the same groups, one cell wider", () => {
    const compact = openCompact("theo", "foguete");
    const line = lineOf(compact, "1");

    expect(groupsOf(line).map((group) => [group.label, group.tools])).toEqual([
      ["Ferramentas fixas", ["eraser", "fill"]],
      ["Materiais", ["crayon", "marker", "brush"]],
    ]);
    // Five 52dp cells and the same 8dp gap: 292dp, centred (33/33) — the kids'
    // block of `compacta-distribuicao` §4, and still zero text on the surface.
    expect(line.style.gridTemplateColumns).toBe("repeat(5, 52px)");
    expect(line.style.gap).toBe("8px");
    for (const group of within(line).getAllByRole("group")) {
      expect(group).toHaveClass("contents");
    }
    expect(line.textContent?.trim() ?? "").toBe("");
  });

  it("renders a lone group with one spacer, never a ghost gap", () => {
    // The pins were switched off: only materials are left in the line.
    const compact = openCompact("maria", "peixe", ["marker"]);
    const line = lineOf(compact, "1");

    expect(groupsOf(line).map((group) => [group.label, group.tools])).toEqual([
      ["Materiais", ["marker"]],
    ]);
    // The group is the line's only content, and the five empty columns are ONE
    // spacer: the block keeps its width, so column 1 never moves.
    expect(line.children).toHaveLength(2);
    expect(within(line).getByTestId("compact-tools-gap")).toHaveAttribute("data-span", "5");
  });

  it("applies the same grouping inside the second line", () => {
    const compact = openCompact("maria", "peixe");
    const second = lineOf(compact, "2");

    // Same grid as the first line: 6 × 44 + 5 × 8. With eleven tools the
    // second line is FULL — five materials and the door — so no column is left
    // over and no spacer is rendered.
    expect(second.style.gridTemplateColumns).toBe("repeat(6, 44px)");
    expect(second.style.gap).toBe("8px");
    expect(groupsOf(second).map((group) => [group.label, group.tools])).toEqual([
      ["Materiais", ["brush", "watercolor", "oil", "spray", "ink"]],
    ]);
    expect(within(second).queryByTestId("compact-tools-gap")).toBeNull();
  });
});

describe("brush object: one glyph family in both bands", () => {
  const parts = (glyph: Element) =>
    ["accent", "metal", "outline"].map(
      (part) => glyph.querySelector(`[data-layer="${part}"]`) !== null,
    );

  it("draws the handle, the metal and the contour, with the ink in hand", () => {
    const compact = openCompact("maria", "peixe");
    // The brush is the fifth tool of the second line — visible, not behind a door.
    const chip = within(compact).getByLabelText("Pincel");
    // The chip uses the SHARED glyph component, not a compact-only copy: the
    // sheet, the bar and 3-5 cannot drift into three different brushes.
    const glyph = chip.querySelector("svg[data-brush='brush']");

    expect(glyph).not.toBeNull();
    // The three layers are the silhouette contract: a brush is a handle, a metal
    // band and a fan — and this is what keeps the glyph from regressing.
    expect(parts(glyph!)).toEqual([true, true, true]);

    // The fan wears the active colour, not a fixed one.
    const tone = within(compact)
      .getByTestId("compact-colors")
      .querySelectorAll<HTMLElement>("[data-hex]")[4]!;
    const hex = tone.getAttribute("data-hex")!;
    fireEvent.click(tone);
    // `currentColor` is the layer's fill; the colour itself rides the svg.
    expect(glyph!.querySelector('[data-layer="accent"]')).toHaveAttribute("fill", "currentColor");
    expect((glyph as SVGSVGElement).style.color).toBe(
      `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(
        hex.slice(5, 7),
        16,
      )})`,
    );
  });

  it("draws the SAME brush in 3-5 — one family, two inks", () => {
    // Owner's call (26/10): the two bands carried two icon sets, so the same
    // brush was two different objects depending on who was drawing. The drawing
    // is one; only the contour ink (theme-aware on pro) and the plate differ.
    const compact = openCompact("theo", "foguete");
    const chip = within(compact).getByLabelText("Pincel");
    const glyph = chip.querySelector("svg[data-brush='brush']");

    expect(glyph).not.toBeNull();
    expect(parts(glyph!)).toEqual([true, true, true]);
    // 3-5 keeps the ink measured against paper — on a card that is not in hand.
    expect(chip).toHaveAttribute("data-plate-state", "off");
    expect(glyph!.getAttribute("data-ink")).toBe("#1C1410");
  });
});

describe("doors: one switch, one shortcut", () => {
  it("hangs the mode switch from the bar's top edge and lets the adjustments door open the sheet", () => {
    const compact = openCompact("maria", "peixe");

    // The switch is a STATE, not a destination: it reports whether the sheet is
    // open and names the region it controls (§12.7). Since the owner's report of
    // 27/10 it is the drawer's own LATCH — a child of the bar, glued to its top
    // edge (`bottom-full`) and centred on it, so the door and the surface it
    // opens can never drift apart again.
    const toggle = within(compact).getByTestId("chrome-panel");
    expect(toggle.parentElement).toBe(compact);
    expect(toggle.className).toContain("bottom-full");
    expect(toggle.className).toContain("left-1/2");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute("aria-controls", "canvas-dock-region");
    // A glyph, and one that says "panel": the bar-shaped handle is gone.
    expect(toggle.querySelector("svg")?.getAttribute("data-glyph")).toBe("panel");
    // It hangs outside the box, so the bar's own content is untouched: the first
    // ROW of the card is still the stroke preview.
    expect(compact.children[1]).toBe(within(compact).getByTestId("compact-preview-row"));

    // The eleventh target is the other door to the same sheet, named for what
    // it lands on: the active tool's adjustments.
    const adjust = within(compact).getByLabelText("Mais ajustes");
    expect(adjust).not.toHaveAttribute("aria-expanded");
    expect(adjust).not.toHaveAttribute("aria-pressed");
    fireEvent.click(adjust);
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();
  });
});

describe("order: the profile's list, with the pins only as the default", () => {
  it("puts the eraser and the bucket first when no list was ever stored", () => {
    const blank = openCompact("theo", null);
    expect(rowOf(blank).slice(0, 2)).toEqual(["eraser", "fill"]);

    cleanup();
    localStorage.clear();

    const page = openCompact("theo", "foguete");
    expect(rowOf(page).slice(0, 2)).toEqual(["eraser", "fill"]);

    cleanup();
    localStorage.clear();

    const pro = openCompact("maria", "peixe");
    expect(rowOf(pro).slice(0, 2)).toEqual(["eraser", "fill"]);
  });

  it("keeps the row FIXED: a pick never reorders it, not even on reopen", () => {
    const compact = openCompact("maria", "peixe");
    const before = rowOf(compact);
    expect(before).toEqual([
      "eraser",
      "fill",
      "pencil",
      "charcoal",
      "crayon",
      "marker",
      "brush",
      "watercolor",
      "oil",
      "spray",
      "ink",
    ]);

    // A pick inside the open bar never slides the chip out from under the finger.
    fireEvent.click(within(compact).getByLabelText("Marcador"));
    expect(rowOf(compact)).toEqual(before);

    fireEvent.click(screen.getByTestId("dock-scrim"));
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));

    // Owner's call (26/10): the order is a preference, not a history — using the
    // marker does NOT move it, and the band opens the same way every time.
    expect(rowOf(screen.getByTestId("canvas-compact"))).toEqual(before);
  });

  it("reads a stored list VERBATIM — pins included — and the sheet reads the same", () => {
    // The defect the owner reported (27/10): "a ordenação está sendo considerada
    // apenas no painel amplo". The compact pinned the eraser and the bucket in
    // front of whatever was stored, while the sheet read the same list as it
    // was. One profile, one row: the two panels have to agree — and with a list
    // stored, the stored order IS the order (owner's call, 26/10: "borracha e
    // balde são default; se alterados nos ajustes, segue os ajustes").
    const slots = ["pencil", "brush", "eraser", "fill"];
    const compact = openCompact("maria", "peixe", slots);
    expect(rowOf(compact)).toEqual(slots);

    // The sheet lists the same sequence, in the same order — read from ITS row,
    // not from the store.
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    const shelfRow = [
      ...screen.getByTestId("tool-shelf").querySelectorAll("button[data-tool]"),
    ].map((chip) => chip.getAttribute("data-tool"));
    expect(shelfRow).toEqual(slots);
  });

  it("gives BOTH panels the same default row, with the pins in front", () => {
    // No stored list is the band's default, and the default is the pins first
    // (owner's call, 26/10). The defect was the two panels disagreeing about
    // the same profile; the default now disagrees about nothing either.
    const compact = openCompact("maria", "peixe");
    const row = rowOf(compact);
    expect(row.slice(0, 2)).toEqual(["eraser", "fill"]);

    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    const shelfRow = [
      ...screen.getByTestId("tool-shelf").querySelectorAll("button[data-tool]"),
    ].map((chip) => chip.getAttribute("data-tool"));
    expect(shelfRow).toEqual(row);
  });

  it("derives the row from the profile: a change made live reaches the open bar", () => {
    // The row used to be a PORTRAIT taken when the dock opened (`compactRow`):
    // with the bar on screen, a list that changed stayed old behind it. The row
    // is a view of the profile now, so the bar shows the list as it is.
    render(
      <StoreProvider>
        <LiveHarness />
      </StoreProvider>,
    );
    fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
    const compact = screen.getByTestId("canvas-compact");
    expect(rowOf(compact)).toEqual(["fill", "eraser"]);

    fireEvent.click(screen.getByTestId("reorder"));
    expect(rowOf(screen.getByTestId("canvas-compact"))).toEqual(["eraser", "fill"]);
  });
});

describe("the machine: two states on 3-5, three on 9+", () => {
  it("offers no pro sheet and no hold-to-sheet on 3-5", async () => {
    const compact = openCompact("theo", "foguete");

    // The latch exists, but it opens the SECOND LEVEL of the intermediate panel
    // — the two look folds — never a pro sheet (`chrome-v2` §4).
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.getByTestId("kids-look")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("kids-look-done"));
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();

    expect(within(compact).queryByLabelText("Mais ajustes")).toBeNull();

    const chip = within(compact).getByLabelText("Giz de cera");
    fireEvent.pointerDown(chip);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 520));
    });
    // There is no hold-to-sheet on this band: the hold keeps the tool, nothing else.
    expect(screen.queryByTestId("canvas-panel")).toBeNull();
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();
  });

  it("keeps Maria's three states: pill, compact, sheet", () => {
    openCompact("maria", "peixe");
    fireEvent.click(screen.getByLabelText("Abrir painel de ferramentas"));
    expect(screen.getByTestId("canvas-panel")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Feito"));
    expect(screen.getByTestId("canvas-compact")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("dock-scrim"));
    expect(screen.getByTestId("canvas-dock")).toBeInTheDocument();
    expect(screen.queryByTestId("canvas-compact")).toBeNull();
  });
});
