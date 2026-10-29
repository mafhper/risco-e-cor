// WCAG AA for the deep theme roles (m3-temas-cor.md §4.3/§4.4, §11):
// every theme x scheme combination must clear 4.5:1 on the two pairs that
// carry text — on-primary over primary, and on-primary-container over
// primary-container. The values are measured from the rendered hex, not
// copied from the spec table.
import { describe, expect, it } from "vitest";
import { contrastRatio, oklchToHex } from "@/mockup/palette";
import { PROFILE_THEMES, themeStyle } from "@/mockup/profileThemes";

function toHex(oklch: string): string {
  const match = oklch.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/);
  if (!match) throw new Error(`not oklch: ${oklch}`);
  return oklchToHex(Number(match[1]), Number(match[2]), Number(match[3]));
}

describe("theme contrast", () => {
  for (const theme of PROFILE_THEMES) {
    for (const scheme of ["light", "dark"] as const) {
      it(`${theme.id} ${scheme}: text roles clear WCAG AA`, () => {
        const style = themeStyle(theme, scheme);
        const primary = toHex(style["--md-primary"]!);
        const onPrimary = toHex(style["--md-on-primary"]!);
        const container = toHex(style["--md-primary-container"]!);
        const onContainer = toHex(style["--md-on-primary-container"]!);

        expect(contrastRatio(primary, onPrimary)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(container, onContainer)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
