// Seams under test:
//  1. scheme resolution — "system" follows the device, manual wins
//  2. legacy settings — a save with no colorScheme follows the device
import { describe, expect, it } from "vitest";
import { normalizeSettings } from "@/mockup/store";
import { isColorScheme, resolveScheme } from "@/mockup/theme";

describe("color scheme", () => {
  it("resolves system against the device and honours a manual choice", () => {
    expect(resolveScheme("system", false)).toBe("light");
    expect(resolveScheme("system", true)).toBe("dark");
    expect(resolveScheme("light", true)).toBe("light");
    expect(resolveScheme("dark", false)).toBe("dark");
  });

  it("only accepts the three documented values", () => {
    expect(isColorScheme("light")).toBe(true);
    expect(isColorScheme("dark")).toBe(true);
    expect(isColorScheme("system")).toBe(true);
    expect(isColorScheme("auto")).toBe(false);
    expect(isColorScheme(undefined)).toBe(false);
  });
});

describe("legacy settings", () => {
  it("defaults an old save to following the device", () => {
    expect(normalizeSettings({ sound: false }).colorScheme).toBe("system");
    expect(normalizeSettings({ colorScheme: "sepia" as never }).colorScheme).toBe("system");
    expect(normalizeSettings(null).colorScheme).toBe("system");
  });

  it("clamps the stabilization slider and preserves valid choices", () => {
    expect(normalizeSettings({ stabilization: 9 }).stabilization).toBe(3);
    expect(normalizeSettings({ stabilization: -2 }).stabilization).toBe(0);
    expect(normalizeSettings({ colorScheme: "dark" }).colorScheme).toBe("dark");
    expect(normalizeSettings({ sound: false }).sound).toBe(false);
  });
});
