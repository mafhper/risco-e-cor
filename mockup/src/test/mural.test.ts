// Seams under test:
//  1. mural selection  — muralArtworks: published only, newest publish first
//  2. recent strip     — recentArtworks: per profile, newest edit first
//  3. save decision    — needsSaveDecision: only new strokes since open
//  4. legacy migration — normalizeProfiles / normalizeArtworks keep old saves
//  5. theme catalog    — PROFILE_THEMES is a list with a neutral fallback
//  6. artwork palette  — published cards read the piece's own top colors
import { describe, expect, it } from "vitest";
import {
  allMuralArtworks,
  artworkPalette,
  muralArtworks,
  needsSaveDecision,
  recentArtworks,
} from "@/mockup/artworks";
import {
  normalizeArtworks,
  normalizeBackupArtworks,
  normalizeProfiles,
  type Artwork,
} from "@/mockup/store";
import { PROFILE_THEMES, profileTheme } from "@/mockup/profileThemes";

function artwork(over: Partial<Artwork> & { id: string }): Artwork {
  const base: Artwork = {
    id: "a",
    profileId: "maria",
    pageId: "peixe",
    w: 300,
    h: 300,
    history: { commands: [], redo: [], undoable: 0 },
    createdAt: 0,
    updatedAt: 0,
    visibility: "draft",
    publishedAt: null,
  };
  return { ...base, ...over } as Artwork;
}

describe("mural selection", () => {
  it("keeps only published pieces, newest publish first", () => {
    const list = [
      artwork({ id: "old", visibility: "published", publishedAt: 100 }),
      artwork({ id: "draft", visibility: "draft", publishedAt: null, updatedAt: 999 }),
      artwork({ id: "new", visibility: "published", publishedAt: 300 }),
      artwork({ id: "fallback", visibility: "published", publishedAt: null, updatedAt: 200 }),
    ];
    expect(muralArtworks(list).map((a) => a.id)).toEqual(["new", "fallback", "old"]);
  });

  it("caps the strip at the limit", () => {
    const list = Array.from({ length: 9 }, (_, i) =>
      artwork({ id: `p${i}`, visibility: "published", publishedAt: i }),
    );
    expect(muralArtworks(list)).toHaveLength(6);
    expect(muralArtworks(list, 2).map((a) => a.id)).toEqual(["p8", "p7"]);
  });

  it("keeps the whole mural available for the inline expansion", () => {
    const list = Array.from({ length: 9 }, (_, i) =>
      artwork({ id: `p${i}`, visibility: "published", publishedAt: i }),
    );
    list.push(artwork({ id: "draft", visibility: "draft", publishedAt: null }));
    expect(allMuralArtworks(list).map((a) => a.id)).toEqual([
      "p8",
      "p7",
      "p6",
      "p5",
      "p4",
      "p3",
      "p2",
      "p1",
      "p0",
    ]);
  });
});

describe("artwork palette fingerprint", () => {
  it("ranks the colors the piece actually uses, ignoring the white paper", () => {
    const palette = artworkPalette([
      { t: "fill", region: "a", color: "#F72633" },
      { t: "fill", region: "b", color: "#2B7FFF" },
      { t: "fill", region: "c", color: "#2B7FFF" },
      { t: "stroke", id: "s", color: "#00B139", size: 4, points: [[0, 0]] },
      { t: "fill", region: "paper", color: "#FFFFFF" },
    ]);
    expect(palette[0]).toBe("#2B7FFF");
    expect(palette).toContain("#F72633");
    expect(palette).not.toContain("#FFFFFF");
    expect(palette).toHaveLength(5);
  });

  it("repeats a short palette so the card bar never looks broken", () => {
    expect(artworkPalette([{ t: "fill", region: "a", color: "#F72633" }])).toEqual([
      "#F72633",
      "#F72633",
      "#F72633",
      "#F72633",
      "#F72633",
    ]);
  });

  it("returns nothing for an empty piece", () => {
    expect(artworkPalette([])).toEqual([]);
  });
});

describe("recent strip", () => {
  it("is per profile and newest edit first", () => {
    const list = [
      artwork({ id: "m1", profileId: "maria", updatedAt: 10 }),
      artwork({ id: "t1", profileId: "theo", updatedAt: 20 }),
      artwork({ id: "m2", profileId: "maria", updatedAt: 30 }),
    ];
    expect(recentArtworks(list, "maria").map((a) => a.id)).toEqual(["m2", "m1"]);
    expect(recentArtworks(list, "theo").map((a) => a.id)).toEqual(["t1"]);
  });
});

describe("save decision", () => {
  it("asks only when the command list changed since the canvas opened", () => {
    expect(needsSaveDecision(0, 0)).toBe(false);
    expect(needsSaveDecision(0, 1)).toBe(true);
    expect(needsSaveDecision(3, 3)).toBe(false);
    expect(needsSaveDecision(3, 4)).toBe(true);
    expect(needsSaveDecision(3, 2)).toBe(true); // undoing a saved stroke is a change too
  });
});

describe("legacy saves", () => {
  type StoredProfile = Parameters<typeof normalizeProfiles>[0][number];
  const legacyProfile = (over: Partial<StoredProfile> & { id: string }): StoredProfile => ({
    name: "Criança",
    avatar: "cat",
    tone: "coral",
    age: "3-5",
    ...over,
  });

  it("gives old profiles a theme (the demo seeds keep their look) and no photo", () => {
    const out = normalizeProfiles([
      legacyProfile({ id: "maria" }),
      legacyProfile({
        id: "theo",
        avatar: "dog",
        tone: "sky",
        age: "6-8",
      }),
      legacyProfile({ id: "visitante" }),
    ]);
    expect(out.map((p) => p.themeId)).toEqual(["dinos", "heroi", "neutro"]);
    expect(out.every((p) => p.photoUri === null)).toBe(true);
    expect(out.map((p) => p.avatarCustom)).toEqual(["dino", "heroi", null]);
    expect(out[1]!.name).toBe("Criança"); // nothing else is touched
  });

  it("keeps explicit choices (animal avatar, chosen theme, photo)", () => {
    const out = normalizeProfiles([
      legacyProfile({ id: "maria", themeId: "heroi", avatarCustom: null, photoUri: "data:x" }),
    ]);
    expect(out[0]!.themeId).toBe("heroi");
    expect(out[0]!.avatarCustom).toBeNull();
    expect(out[0]!.photoUri).toBe("data:x");
  });

  type StoredArtwork = Parameters<typeof normalizeArtworks>[0][number];
  const legacyArtwork = (over: Partial<StoredArtwork> & { id: string }): StoredArtwork => ({
    profileId: "theo",
    pageId: null,
    w: 300,
    h: 400,
    history: { commands: [], redo: [], undoable: 0 },
    createdAt: 0,
    updatedAt: 1234,
    ...over,
  });

  it("legacy rule: celebrated pieces and coloring pages enter the mural, scribbles become drafts", () => {
    const out = normalizeArtworks([
      legacyArtwork({ id: "peixe", pageId: "peixe" }),
      legacyArtwork({ id: "foguete", pageId: "foguete", celebrated: true }),
      legacyArtwork({ id: "rabisco", pageId: null }),
    ]);
    expect(out.map((w) => w.visibility)).toEqual(["published", "published", "draft"]);
    expect(out[0]!.publishedAt).toBe(1234);
    expect(out[2]!.publishedAt).toBeNull();
  });

  it("never flips an explicit visibility back", () => {
    const out = normalizeArtworks([
      legacyArtwork({ id: "d", pageId: "peixe", visibility: "draft" }),
      legacyArtwork({ id: "p", pageId: null, visibility: "published" }),
    ]);
    expect(out.map((w) => w.visibility)).toEqual(["draft", "published"]);
    expect(out[1]!.publishedAt).toBe(1234); // missing publish time falls back to last edit
  });

  it("backup files without visibility stay drafts (conservative)", () => {
    const out = normalizeBackupArtworks([
      legacyArtwork({ id: "b", pageId: "peixe", celebrated: true }),
    ]);
    expect(out[0]!.visibility).toBe("draft");
  });
});

describe("theme catalog", () => {
  it("is a list the UI reads, with a neutral fallback", () => {
    expect(PROFILE_THEMES.map((t) => t.id)).toEqual(["dinos", "heroi", "neutro"]);
    expect(profileTheme("dinos").hero).toBeTruthy();
    expect(profileTheme("heroi").hero).toBeTruthy();
    expect(profileTheme("neutro").hero).toBeNull();
    expect(profileTheme(undefined).id).toBe("neutro");
  });

  it("carries an identity emoji and both scheme token sets", () => {
    expect(PROFILE_THEMES.map((t) => t.emoji)).toEqual(["🦕", "⚡", "🎨"]);
    for (const theme of PROFILE_THEMES) {
      expect(theme.tokens.primary).toMatch(/^oklch/);
      expect(theme.darkTokens.primary).toMatch(/^oklch/);
      expect(theme.darkTokens.primary).not.toBe(theme.tokens.primary);
    }
  });

  it("names the avatar illustration each theme wears", () => {
    expect(profileTheme("heroi").avatarArt).toBe("heroi");
    expect(profileTheme("dinos").avatarArt).toBe("dino");
    expect(profileTheme("neutro").avatarArt).toBeNull();
  });
});
