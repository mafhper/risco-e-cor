// The family screen's seven operations, tested where they are decided: the
// pure functions in profiles.ts. Each case asserts an invariant from
// crud-perfis-global.md §3.3, not an implementation detail.
import { describe, expect, it } from "vitest";
import {
  activeProfiles,
  archiveProfile,
  copyName,
  createProfile,
  duplicateProfile,
  fallbackProfile,
  moveProfile,
  removeProfile,
  unarchiveProfile,
  validateNewProfile,
  type ProfileDraft,
} from "@/mockup/profiles";
import type { Profile } from "@/mockup/store";

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

const family = (): Profile[] => [
  profile({ id: "maria", name: "Maria", order: 0, createdAt: 10 }),
  profile({ id: "theo", name: "Theo", age: "3-5", order: 1, createdAt: 20 }),
];

const draft: ProfileDraft = {
  name: "Clara",
  age: "6-8",
  avatar: "bird",
  tone: "mint",
  themeId: "neutro",
};

const orders = (list: Profile[]) =>
  [...list].sort((a, b) => a.order - b.order).map((p) => `${p.name}:${p.order}`);

describe("create: new profile enters at the end", () => {
  it("never becomes the active profile and carries the chosen band", () => {
    const change = createProfile(family(), draft, "clara", 99);
    expect(change.error).toBeUndefined();
    expect(orders(change.profiles)).toEqual(["Maria:0", "Theo:1", "Clara:2"]);
    expect(change.profile).toMatchObject({ id: "clara", age: "6-8", archived: false, order: 2 });
    // The description starts empty: the band's suggestion is what the child sees.
    expect(change.profile).toMatchObject({ personaLine: null });
  });

  it("refuses a repeated name, an empty name and a fifth active profile", () => {
    expect(createProfile(family(), { ...draft, name: "maria" }, "x", 1).error).toBe(
      "Já existe um perfil com esse nome.",
    );
    expect(createProfile(family(), { ...draft, name: "   " }, "x", 1).error).toBe(
      "Dê um nome para o perfil.",
    );

    const four = [...family()];
    for (let i = 0; i < 2; i += 1) four.push(profile({ id: `k${i}`, name: `K${i}`, order: 2 + i }));
    expect(createProfile(four, draft, "x", 1).error).toContain("4 perfis ativos");
    expect(validateNewProfile(four, "Clara")).toContain("4 perfis ativos");
  });

  it("leaves the list untouched when it refuses", () => {
    const before = family();
    const after = createProfile(before, { ...draft, name: "Theo" }, "x", 1).profiles;
    expect(after).toBe(before);
  });
});

describe("reorder: stable and explicit", () => {
  it("moves down and up, rewriting order to 0..n-1", () => {
    const down = moveProfile(family(), "maria", 1).profiles;
    expect(orders(down)).toEqual(["Theo:0", "Maria:1"]);
    const up = moveProfile(down, "maria", -1).profiles;
    expect(orders(up)).toEqual(["Maria:0", "Theo:1"]);
  });

  it("never moves past the ends and never touches archived profiles", () => {
    const list = family();
    expect(moveProfile(list, "maria", -1).profiles).toBe(list);
    expect(moveProfile(list, "theo", 1).profiles).toBe(list);

    const withArchived = [
      profile({ id: "a", name: "Ana", order: 0 }),
      profile({ id: "b", name: "Bia", order: 1, archived: true }),
      profile({ id: "c", name: "Caio", order: 2 }),
    ];
    // Caio steps over Bia's slot, not over her record.
    const moved = moveProfile(withArchived, "c", -1).profiles;
    expect(activeProfiles(moved).map((p) => p.name)).toEqual(["Caio", "Ana"]);
    expect(moved.find((p) => p.id === "b")).toMatchObject({ archived: true });
  });
});

describe("duplicate: identity yes, artworks no", () => {
  it("sits right after the original with a free name and a fresh date", () => {
    const change = duplicateProfile(family(), "theo", "theo2", 500);
    expect(orders(change.profiles)).toEqual(["Maria:0", "Theo:1", "Theo 2:2"]);
    expect(change.profile).toMatchObject({
      id: "theo2",
      name: "Theo 2",
      age: "3-5",
      createdAt: 500,
      archived: false,
    });
  });

  it("inserts a copy of the first profile in the middle, not at the end", () => {
    const three = [
      profile({ id: "a", name: "Ana", order: 0, createdAt: 1 }),
      profile({ id: "b", name: "Bia", order: 1, createdAt: 2 }),
      profile({ id: "c", name: "Caio", order: 2, createdAt: 3 }),
    ];
    const change = duplicateProfile(three, "a", "a2", 99);
    expect(orders(change.profiles)).toEqual(["Ana:0", "Ana 2:1", "Bia:2", "Caio:3"]);
  });

  it("copies preferences but never the artworks (I6)", () => {
    const withColors = family().map((p) =>
      p.id === "maria"
        ? {
            ...p,
            favoriteColors: ["#2F6E8A"],
            capsOverride: { tecnicas: false },
            personaLine: "Faz tirinhas.",
            // The nozzle is a preference too: the copy is another person who
            // draws like the original, not a stranger with the shelf's can.
            spray: { tip: 0.12, spread: 0.4, intensity: 0.7 },
          }
        : p,
    );
    const copy = duplicateProfile(withColors, "maria", "m2", 1).profile!;
    expect(copy.favoriteColors).toEqual(["#2F6E8A"]);
    expect(copy.capsOverride).toEqual({ tecnicas: false });
    expect(copy.personaLine).toBe("Faz tirinhas.");
    expect(copy.spray).toEqual({ tip: 0.12, spread: 0.4, intensity: 0.7 });
    // The caller never passes artworks: the operation cannot see them.
    expect(Object.keys(copy)).not.toContain("artworks");
  });

  it("names copies 2, 3, 4 without colliding", () => {
    let list = family();
    for (let i = 0; i < 2; i += 1) {
      const change = duplicateProfile(list, "theo", `t${i}`, 1);
      list = change.profiles;
    }
    expect(list.map((p) => p.name)).toContain("Theo 3");
    expect(copyName(list, list[1]!)).toBe("Theo 4");
  });

  it("refuses when the family is already at four active profiles", () => {
    const four = family();
    four.push(profile({ id: "k1", name: "K1", order: 2 }));
    four.push(profile({ id: "k2", name: "K2", order: 3 }));
    expect(duplicateProfile(four, "maria", "x", 1).error).toContain("4 perfis ativos");
  });
});

describe("archive: out of the Home, kept in the tutor list", () => {
  it("hides the profile without touching order or artworks", () => {
    const change = archiveProfile(family(), "theo");
    const theo = change.profiles.find((p) => p.id === "theo")!;
    expect(theo.archived).toBe(true);
    expect(theo.order).toBe(1);
    expect(activeProfiles(change.profiles).map((p) => p.id)).toEqual(["maria"]);
  });

  it("refuses to archive the last active profile (I2)", () => {
    const single = [profile({ id: "solo", name: "Solo" })];
    expect(archiveProfile(single, "solo").error).toBe("Deixe pelo menos um perfil ativo.");
  });

  it("unarchiving returns the profile to the slot order kept", () => {
    const archived = [
      profile({ id: "maria", name: "Maria", order: 0 }),
      profile({ id: "theo", name: "Theo", order: 1, archived: true }),
      profile({ id: "ana", name: "Ana", order: 2 }),
    ];
    const back = unarchiveProfile(archived, "theo").profiles;
    expect(activeProfiles(back).map((p) => p.name)).toEqual(["Maria", "Theo", "Ana"]);
  });
});

describe("remove: the only irreversible act", () => {
  it("refuses while the gallery still has a piece (no orphan in trash)", () => {
    const change = removeProfile(family(), "maria", [{ profileId: "maria" }]);
    expect(change.error).toBe("Mova os desenhos para a lixeira e esvazie-a antes de remover.");
    expect(change.profiles).toHaveLength(2);
  });

  it("removes an empty profile and recompacts order", () => {
    const change = removeProfile(family(), "theo", []);
    expect(change.error).toBeUndefined();
    expect(change.profiles.map((p) => p.id)).toEqual(["maria"]);
    expect(change.profiles[0]!.order).toBe(0);
  });

  it("refuses to remove the last active profile", () => {
    const single = [profile({ id: "solo", name: "Solo" })];
    expect(removeProfile(single, "solo", []).error).toBe("Deixe pelo menos um perfil ativo.");
  });

  it("points the active profile somewhere valid", () => {
    expect(fallbackProfile(family(), "maria")?.id).toBe("theo");
    expect(fallbackProfile([profile({ id: "sole", name: "Sole" })], "sole")).toBeNull();
  });
});
