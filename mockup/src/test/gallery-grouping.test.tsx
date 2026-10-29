// The collection groups itself three ways — creation order (default), type and
// month — and the choice belongs to the profile, not the device. A page is
// distinguished by having line-art underneath (`pageId`), never by its name.
import { useEffect } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  artworkGradient,
  GalleryScreen,
  groupByDate,
  groupByType,
  readGroupMode,
  writeGroupMode,
} from "@/mockup/screens/GalleryScreen";
import { emptyHistory } from "@/mockup/history";
import { blankArtwork } from "@/mockup/artworks";
import { StoreProvider, useStore, type Artwork } from "@/mockup/store";

const art = (patch: Partial<Artwork>): Artwork => ({
  id: "a",
  profileId: "maria",
  pageId: null,
  w: 300,
  h: 300,
  history: emptyHistory(),
  createdAt: 0,
  updatedAt: 0,
  visibility: "draft",
  publishedAt: null,
  ...patch,
});

function GalleryHarness() {
  const { dispatch, profile } = useStore();
  useEffect(() => {
    dispatch({ type: "selectProfile", id: "maria" });
  }, [dispatch]);
  return profile ? <GalleryScreen back={{ name: "home" }} /> : null;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("grouping by type", () => {
  it("splits painted pages from free drawings", () => {
    const sections = groupByType([
      art({ id: "p1", pageId: "peixe" }),
      art({ id: "d1" }),
      art({ id: "p2", pageId: "gato" }),
    ]);
    expect(sections.map((s) => [s.key, s.items.length])).toEqual([
      ["pintura", 2],
      ["livre", 1],
    ]);
  });

  it("never loses a legacy piece without pageId", () => {
    const sections = groupByType([art({ id: "legacy" })]);
    expect(sections[1]!.items.map((a) => a.id)).toEqual(["legacy"]);
  });
});

describe("grouping by date", () => {
  const now = new Date(2026, 9, 24, 12).getTime();

  it("keeps today, this week and this month apart", () => {
    const sections = groupByDate(
      [
        art({ id: "hoje", updatedAt: new Date(2026, 9, 24, 9).getTime() }),
        art({ id: "semana", updatedAt: new Date(2026, 9, 21, 9).getTime() }),
        art({ id: "mes", updatedAt: new Date(2026, 9, 3, 9).getTime() }),
      ],
      now,
    );
    expect(sections.map((s) => [s.key, s.items.length])).toEqual([
      ["hoje", 1],
      ["semana", 1],
      ["mes", 1],
    ]);
  });

  it("puts older pieces in their own month, newest month first", () => {
    const sections = groupByDate(
      [
        art({ id: "set", updatedAt: new Date(2026, 8, 10).getTime() }),
        art({ id: "ago", updatedAt: new Date(2026, 7, 10).getTime() }),
      ],
      now,
    );
    const older = sections.slice(3);
    expect(older.map((s) => s.key)).toEqual(["2026-08", "2026-07"]);
    expect(older[0]!.label).toMatch(/setembro/i);
  });
});

describe("the card border is the piece's own palette", () => {
  it("is solid for one colour and a gradient for several", () => {
    expect(artworkGradient([])).toBe("transparent");
    expect(artworkGradient(["#EF4444"])).toBe("#EF4444");
    expect(artworkGradient(["#EF4444", "#3B82F6"])).toBe(
      "linear-gradient(135deg, #EF4444, #3B82F6)",
    );
  });
});

describe("one height for every card", () => {
  /** Maria's page (300 × 300) plus a free drawing, which is phone-tall. */
  function MixedHarness() {
    const { dispatch, profile, state } = useStore();
    const id = "galeria-mista";
    const exists = state.artworks.some((a) => a.id === id);
    useEffect(() => {
      dispatch({ type: "selectProfile", id: "maria" });
      if (exists) return;
      dispatch({
        type: "createArtwork",
        artwork: { ...blankArtwork("maria", id), createdAt: 1, updatedAt: 1 },
      });
    }, [dispatch, exists, id]);
    return profile ? <GalleryScreen back={{ name: "home" }} /> : null;
  }

  it("gives the free drawing the box of a painted page, never its own ratio", () => {
    render(
      <StoreProvider>
        <MixedHarness />
      </StoreProvider>,
    );
    const cells = [...document.querySelectorAll('[data-testid="artwork-card-border"]')];
    expect(cells.length).toBeGreaterThanOrEqual(2);

    // The sheet's own ratio (300 × 650 against 300 × 300) used to make the row
    // grow with the piece: two card heights in one line read as a broken column
    // (owner's call, 26/10). ONE square cell, every piece fitted inside it.
    for (const cell of cells) {
      expect(cell.className).toContain("aspect-square");
      const paint = cell.querySelector("div")!;
      expect(paint.getAttribute("style") ?? "").not.toContain("aspect-ratio");
      expect(paint.className).toContain("h-full");
      expect(paint.className).toContain("w-full");
    }
  });
});

describe("the mode is the profile's", () => {
  it("defaults to creation order and survives a reload", () => {
    expect(readGroupMode("maria")).toBe("criacao");
    writeGroupMode("maria", "mes");
    expect(readGroupMode("maria")).toBe("mes");
    expect(readGroupMode("theo")).toBe("criacao");
  });

  it("offers one icon-only switcher with three named segments", () => {
    render(
      <StoreProvider>
        <GalleryHarness />
      </StoreProvider>,
    );
    const group = screen.getByRole("group", { name: "Agrupar desenhos" });
    const segments = group.querySelectorAll("button");
    expect(segments).toHaveLength(3);
    for (const segment of segments) {
      expect(segment.textContent).toBe("");
      expect(segment.getAttribute("aria-label")).toBeTruthy();
    }
  });
});
