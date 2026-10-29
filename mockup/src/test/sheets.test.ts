// Seam under test: the geometry of the sheet a free drawing opens on.
//
// The studio paper is full-bleed, so a sheet whose aspect is wider than the
// phone leaves a band above and below it — the defect this file prevents. The
// expectation is written from the phone (portrait, taller than 2:1) and from
// worked examples of the two dimensions, never re-derived from the code.
import { describe, expect, it } from "vitest";
import { blankArtwork, growSheetToPhone, PHONE_SHEET } from "@/mockup/artworks";
import { push, type History, type StrokeCommand } from "@/mockup/history";
import type { Artwork } from "@/mockup/store";

const stroke = (points: [number, number][]): StrokeCommand => ({
  t: "stroke",
  id: "s1",
  color: "#2f6fd6",
  size: 6,
  points,
});

const artwork = (over: Partial<Artwork> = {}): Artwork => ({
  id: "a",
  profileId: "theo",
  pageId: null,
  w: 300,
  h: 400,
  history: push(
    { commands: [], redo: [], undoable: 0 } as History,
    stroke([
      [10, 20],
      [10, 40],
    ]),
  ),
  createdAt: 0,
  updatedAt: 0,
  visibility: "draft",
  publishedAt: null,
  ...over,
});

describe("a new free sheet", () => {
  it("is taller than the old 3:4 sheet, matching a portrait phone", () => {
    const sheet = blankArtwork("theo", "new", 1);
    // 300x400 was 3:4 (0.75); a phone is a little under half as wide as tall.
    expect(sheet.w).toBe(PHONE_SHEET.w);
    expect(sheet.h).toBe(PHONE_SHEET.h);
    expect(sheet.w / sheet.h).toBeLessThan(0.5);
    expect(sheet.h / sheet.w).toBeGreaterThan(2);
  });

  it("opens empty, as a draft, with no page underneath", () => {
    const sheet = blankArtwork("theo", "new", 1);
    expect(sheet.history.commands).toEqual([]);
    expect(sheet.pageId).toBeNull();
    expect(sheet.visibility).toBe("draft");
    expect(sheet.publishedAt).toBeNull();
  });
});

describe("legacy sheets", () => {
  it("grows a 3:4 sheet around its drawing, without scaling or cropping it", () => {
    const legacy = artwork();
    const grown = growSheetToPhone(legacy);

    // Half the growth above, half below: the drawing keeps its centre.
    expect(grown.w).toBe(300);
    expect(grown.h).toBe(650);
    const moved = grown.history.commands[0]!;
    expect(moved.t).toBe("stroke");
    if (moved.t !== "stroke") throw new Error("expected a stroke");
    expect(moved.points).toEqual([
      [10, 145],
      [10, 165],
    ]);
    // Same stroke, same size: the paper grew, the drawing did not.
    expect(grown.history.undoable).toBe(legacy.history.undoable);
  });

  it("leaves an already phone-tall sheet untouched", () => {
    const tall = artwork({ h: PHONE_SHEET.h });
    expect(growSheetToPhone(tall)).toBe(tall);
  });

  it("never grows a coloring page: the page is the sheet", () => {
    const page = artwork({ pageId: "peixe", w: 300, h: 300 });
    expect(growSheetToPhone(page)).toBe(page);
  });
});
