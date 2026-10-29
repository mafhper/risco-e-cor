// Artwork lifecycle seams (ciclo-vida-obra.md §2–§4): where a piece lives,
// who may discard it, and what comes back when it is restored. The store keeps
// the trash list, so the piece keeps its own visibility — this is the contract
// the restore path relies on.
import { describe, expect, it } from "vitest";
import {
  allMuralArtworks,
  galleryArtworks,
  keptArtworks,
  pieceRotation,
  recentArtworks,
} from "@/mockup/artworks";
import {
  archivePiece,
  canChildDiscard,
  duplicatePiece,
  inMainGallery,
  showsOnMural,
  unarchivePiece,
} from "@/mockup/lifecycle";
import type { Artwork, Profile } from "@/mockup/store";

const artwork = (over: Partial<Artwork> & { id: string }): Artwork => ({
  profileId: "maria",
  pageId: null,
  w: 300,
  h: 400,
  history: { commands: [], redo: [], undoable: 0 },
  createdAt: 0,
  updatedAt: 0,
  visibility: "draft",
  publishedAt: null,
  ...over,
});

const profile = (over: Partial<Profile> & { id: string }): Profile => ({
  name: over.id,
  avatar: "cat",
  tone: "coral",
  age: "9+",
  themeId: "neutro",
  avatarCustom: null,
  emojiAvatar: null,
  photoUri: null,
  uiModeOverride: null,
  capsOverride: null,
  personaLine: null,
  recentColors: [],
  favoriteColors: [],
  order: 0,
  createdAt: 0,
  archived: false,
  ...over,
});

describe("where a piece lives", () => {
  it("only published pieces hang on the mural", () => {
    expect(showsOnMural(artwork({ id: "p", visibility: "published" }))).toBe(true);
    expect(showsOnMural(artwork({ id: "d", visibility: "draft" }))).toBe(false);
    expect(showsOnMural(artwork({ id: "a", visibility: "archived" }))).toBe(false);
  });

  it("archiving moves the piece out of the grid without losing its publish date", () => {
    const published = artwork({ id: "p", visibility: "published", publishedAt: 777 });
    const kept = archivePiece(published);
    expect(kept.visibility).toBe("archived");
    expect(kept.publishedAt).toBe(777); // restore fidelity
    expect(inMainGallery(kept)).toBe(false);
    expect(keptArtworks([kept], "maria").map((a) => a.id)).toEqual(["p"]);
    expect(galleryArtworks([kept], "maria")).toEqual([]);
  });

  it("unarchiving comes back as a draft, never auto-published", () => {
    const back = unarchivePiece(artwork({ id: "a", visibility: "archived", publishedAt: 10 }));
    expect(back.visibility).toBe("draft");
    expect(back.publishedAt).toBe(10); // kept as "publicado antes em ..."
  });

  it("a copy is always a draft with its own history", () => {
    const original = artwork({ id: "p", visibility: "published", publishedAt: 5 });
    const copy = duplicatePiece(original, "copy", 999);
    expect(copy).toMatchObject({
      id: "copy",
      visibility: "draft",
      publishedAt: null,
      createdAt: 999,
    });
    expect(copy.history).not.toBe(original.history);
  });
});

describe("who may discard", () => {
  it("lets the author discard their own draft only", () => {
    const draft = artwork({ id: "d", profileId: "theo", visibility: "draft" });
    expect(canChildDiscard(draft, "theo")).toBe(true);
    expect(canChildDiscard(draft, "maria")).toBe(false);
    expect(canChildDiscard({ ...draft, visibility: "published" }, "theo")).toBe(false);
    expect(canChildDiscard({ ...draft, visibility: "archived" }, "theo")).toBe(false);
  });
});

describe("mural and gallery selectors", () => {
  const maria = profile({ id: "maria", name: "Maria", order: 0 });
  const kept = profile({ id: "bia", name: "Bia", order: 1, archived: true });

  it("drops a piece whose author is archived, and brings it back on unarchive", () => {
    const list = [
      artwork({ id: "m", profileId: "maria", visibility: "published", publishedAt: 2 }),
      artwork({ id: "b", profileId: "bia", visibility: "published", publishedAt: 3 }),
    ];
    expect(allMuralArtworks(list, [maria, kept]).map((a) => a.id)).toEqual(["m"]);
    const back = [{ ...kept, archived: false }, maria];
    expect(allMuralArtworks(list, back).map((a) => a.id)).toEqual(["b", "m"]);
  });

  it("keeps archived pieces out of the recent strip", () => {
    const list = [
      artwork({ id: "d", updatedAt: 5 }),
      artwork({ id: "a", updatedAt: 9, visibility: "archived" }),
    ];
    expect(recentArtworks(list, "maria").map((a) => a.id)).toEqual(["d"]);
  });
});

describe("wall rotation", () => {
  it("is stable per piece and stays inside the -2..2 band", () => {
    expect(pieceRotation("abc")).toBe(pieceRotation("abc"));
    for (const id of ["a", "peixe", "foguete", "maria-1", "0"]) {
      expect(Math.abs(pieceRotation(id))).toBeLessThanOrEqual(2);
    }
  });
});
