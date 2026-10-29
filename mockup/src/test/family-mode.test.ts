// Seam: the family mode as a pure decision over the profile list (plus the
// material contract of ADR-001). No DOM: this is the rule that decides whether
// the Home is a chip row or a single hero, and whether a 3-5 child has three
// materials or nine.
import { describe, expect, it } from "vitest";
import { KID_MATERIALS, kidTools } from "@/mockup/capabilities";
import { activeProfiles, setFamilyMode } from "@/mockup/profiles";
import type { Profile } from "@/mockup/store";

const p = (id: string, order: number, archived = false): Profile =>
  ({
    id,
    name: id,
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
    order,
    createdAt: order,
    archived,
  }) as Profile;

describe("ADR-001 as amended (24/10): the 3-5 studio is five tools", () => {
  it("adds two drawing materials to the three named objects", () => {
    expect(KID_MATERIALS).toEqual(["crayon", "marker", "brush", "fill", "eraser"]);
  });

  it("keeps the bucket on a blank sheet: it paints the paper itself", () => {
    expect(kidTools(true)).toEqual(["crayon", "marker", "brush", "fill", "eraser"]);
    expect(kidTools(false)).toEqual(["crayon", "marker", "brush", "fill", "eraser"]);
  });
});

describe("family mode: single, shared, and nothing lost", () => {
  it("single leaves exactly one active profile and keeps the rest archived by mode", () => {
    const out = setFamilyMode([p("a", 0), p("b", 1), p("c", 2)], "single");
    expect(activeProfiles(out.profiles).map((x) => x.id)).toEqual(["a"]);
    const away = out.profiles.filter((x) => x.archived);
    expect(away.map((x) => x.id)).toEqual(["b", "c"]);
    expect(away.every((x) => x.modeArchived === true)).toBe(true);
  });

  it("shared restores only what the mode put away, never the adult's archive", () => {
    const adultArchived = { ...p("c", 2, true), modeArchived: false };
    const single = setFamilyMode([p("a", 0), p("b", 1), adultArchived], "single");
    const shared = setFamilyMode(single.profiles, "shared");
    const active = activeProfiles(shared.profiles).map((x) => x.id);
    expect(active).toEqual(["a", "b"]);
    expect(shared.profiles.find((x) => x.id === "c")?.archived).toBe(true);
  });

  it("is idempotent: choosing single twice changes nothing the second time", () => {
    const once = setFamilyMode([p("a", 0), p("b", 1)], "single");
    const twice = setFamilyMode(once.profiles, "single");
    expect(activeProfiles(twice.profiles).map((x) => x.id)).toEqual(["a"]);
  });

  it("can only collapse when there is at least one profile", () => {
    const out = setFamilyMode([], "single");
    expect(out.profiles).toEqual([]);
  });
});
