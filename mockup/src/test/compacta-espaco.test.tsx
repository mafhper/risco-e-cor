// The bar's breathing room and its closing rows (owner's call, 26/10, revised by
// the order decision of 27/10):
//
//   groups:  space only — 16dp between groups on 9+, 12dp on 3-5, per line
//   lines:   the second line never touches the first (8dp of air, twice the
//            ring + its offset) and no chip ever hangs over the card's edge
//   colour:  the row closes on TWELVE cells in 6 + 6 on 9+ — white, the ten
//            published steps of the colour in hand, black — and on NINE targets
//            in 3 + 3 + 3 on 3-5 (`cor-compacta` §10)
//   spectrum: Theo's strip is a strip — no family arrows on it
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
  const id = `space-${profileId}-${pageId ?? "blank"}-${slots?.join("-") ?? "auto"}`;
  const loaded = state.loaded;
  const selected = state.profileId;
  const key = slots ? slots.join("|") : "";
  useEffect(() => {
    if (!loaded) return;
    if (selected !== profileId) dispatch({ type: "selectProfile", id: profileId });
  }, [dispatch, profileId, selected, loaded]);
  useEffect(() => {
    dispatch({
      type: "createArtwork",
      artwork: {
        id,
        profileId,
        pageId,
        w: 300,
        h: 300,
        history: { commands: [], redo: [], undoable: 0 },
        createdAt: Date.now(),
        updatedAt: Date.now(),
        visibility: "draft",
        publishedAt: null,
      },
    });
    if (key)
      dispatch({ type: "updateProfile", id: profileId, patch: { toolSlots: key.split("|") } });
  }, [dispatch, profileId, pageId, id, key]);
  const art = state.artworks.find((a) => a.id === id);
  if (!art || state.profileId !== profileId) return null;
  return <CanvasScreen artworkId={art.id} back={{ name: "home" }} />;
}

const openCompact = (profileId = "maria", pageId: string | null = "peixe", slots?: string[]) => {
  render(
    <StoreProvider>
      <Harness profileId={profileId} pageId={pageId} slots={slots} />
    </StoreProvider>,
  );
  fireEvent.click(screen.getByLabelText("Abrir barra de ferramentas"));
  return screen.getByTestId("canvas-compact");
};

const lineOf = (compact: HTMLElement, line: "1" | "2") =>
  within(compact)
    .getAllByTestId("compact-tools-line")
    .find((node) => node.getAttribute("data-line") === line)!;

describe("the second line never touches the first", () => {
  it("keeps 8dp of air between the lines, ring included", () => {
    // The case the owner's print showed: a full first line carrying a ring that
    // reaches past its own box, over the line below.
    const compact = openCompact("maria", "peixe", [
      "fill",
      "eraser",
      "pencil",
      "charcoal",
      "crayon",
      "spray",
      "brush",
      "marker",
      "watercolor",
      "oil",
    ]);
    const first = lineOf(compact, "1");
    const second = lineOf(compact, "2");

    expect(within(first).getAllByRole("button")).toHaveLength(6);
    expect(within(first).getAllByRole("button").at(-1)).toHaveAttribute("data-tool", "spray");
    // 8dp of margin is twice the 4dp the ring + its offset occupy.
    expect(second).toHaveClass("mt-2");
    // Both lines are their own centred box: no chip is ever half-visible behind
    // the card's edge and the row never scrolls.
    expect(first).toHaveClass("justify-center");
    expect(second).toHaveClass("justify-center");
    expect(first).not.toHaveClass("overflow-x-auto");
    expect(second).not.toHaveClass("overflow-x-auto");
  });

  it("keeps the same air on the child's bar", () => {
    const compact = openCompact("theo", null);
    const line = lineOf(compact, "1");
    // Five chips fit, so there is no second line — and the line is its own
    // centred grid (5 × 52 + 4 × 8 = 292), not a single long line.
    expect(line.style.gridTemplateColumns).toBe("repeat(5, 52px)");
    expect(line.style.gap).toBe("8px");
    for (const group of within(line).getAllByRole("group")) {
      expect(group).toHaveClass("contents");
    }
    expect(within(compact).queryAllByTestId("compact-tools-line")).toHaveLength(1);
  });
});

describe("the colour row closes on twelve on both bands", () => {
  it("fills 6 + 6 on 9+, opening on white and closing on black", () => {
    const compact = openCompact("maria", "peixe");
    const tones = within(compact).getByTestId("compact-colors");
    expect(tones.getAttribute("data-columns")).toBe("6");
    expect(tones.getAttribute("data-rows")).toBe("2");
    expect(within(tones).getAllByRole("radio")).toHaveLength(12);
    expect(tones.children).toHaveLength(12);
    // The ends are the two neutrals the family never makes, and no cell is a
    // spacer (`cor-compacta` §9 as revised on 27/10).
    expect(tones.firstElementChild).toHaveAttribute("data-hex", "#FFFFFF");
    expect(tones.lastElementChild).toHaveAttribute("data-hex", "#000000");
    expect(within(tones).queryByTestId("compact-colors-gap")).toBeNull();
  });

  it("fills the very same 6 + 6 on 3-5, on the same 44dp cell", () => {
    const compact = openCompact("theo", null);
    const tones = within(compact).getByTestId("compact-colors");
    // Uniformity (owner's decision, 27/10): the kids band is not a second design,
    // it is the same row — 6 · 44 + 5 · 8 = 304dp inside the bar's 334dp.
    expect(tones.getAttribute("data-columns")).toBe("6");
    expect(tones.getAttribute("data-rows")).toBe("2");
    expect(within(tones).getAllByRole("radio")).toHaveLength(12);
    expect(tones.children).toHaveLength(12);
    expect(tones.getAttribute("data-cell")).toBe("44");
    expect(tones.getAttribute("data-width")).toBe("304");
    expect(tones.firstElementChild).toHaveAttribute("data-hex", "#FFFFFF");
    expect(tones.lastElementChild).toHaveAttribute("data-hex", "#000000");
    // No label band on a band that reads no text, and no group boundary either.
    expect(tones.getAttribute("data-label-band")).toBe("0");
    expect(tones.querySelectorAll("[data-step]")).toHaveLength(0);
    expect(tones.querySelectorAll("[data-group]")).toHaveLength(0);
  });
});

describe("Theo's spectrum is a strip, not a walker", () => {
  it("carries no arrow and no button on the track", () => {
    const compact = openCompact("theo", null);
    const strip = within(compact).getByTestId("compact-spectrum");
    const track = within(strip).getByRole("slider");
    expect(track.querySelectorAll("button")).toHaveLength(0);
    // The only child is the position marker, and it is decoration.
    expect(track.children).toHaveLength(1);
    expect(track.firstElementChild).toHaveAttribute("aria-hidden", "true");
    // The old walkers lived at the track's ends; neither label survives.
    expect(within(compact).queryByLabelText("Famílias anteriores")).toBeNull();
    expect(within(compact).queryByLabelText("Mais famílias")).toBeNull();
  });
});
