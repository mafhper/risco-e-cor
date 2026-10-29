// The avatar is a circle, always: the container owns a square box and an
// explicit aspect ratio, so no external className can squash the illustrated
// face into an oval (measured defect: the portrait looked wider than tall while
// the ring around it stayed round).
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar } from "@/mockup/ui";
import type { Profile } from "@/mockup/store";

const base: Profile = {
  id: "maria",
  name: "Maria",
  avatar: "cat",
  tone: "lilac",
  age: "9+",
  themeId: "t1",
  avatarCustom: null,
  emojiAvatar: null,
  photoUri: null,
  uiModeOverride: null,
  capsOverride: null,
  personaLine: null,
  favoriteColors: [],
  recentColors: [],
  order: 0,
  createdAt: 0,
  archived: false,
};

function box(profile: Profile, size = 96) {
  const { container } = render(<Avatar profile={profile} size={size} />);
  const el = container.firstElementChild as HTMLElement;
  return el;
}

afterEach(() => cleanup());

const cases: Array<[string, Partial<Profile>]> = [
  ["animal icon", {}],
  ["themed illustration", { avatarCustom: "dino" as Profile["avatarCustom"] }],
  ["emoji", { emojiAvatar: "🦖" }],
  ["photo", { photoUri: "data:image/png;base64,AAAA" }],
];

describe("avatar never deforms", () => {
  for (const [name, patch] of cases) {
    it(`keeps a square box for the ${name}`, () => {
      const el = box({ ...base, ...patch });
      expect(el.style.aspectRatio).toBe("1 / 1");
      expect(el.style.width).toBe("96px");
      expect(el.style.height).toBe("96px");
      expect(el.className).toContain("rounded-full");
    });
  }
});
