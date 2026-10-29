// The theme catalog is data (not code): the tutor can create from scratch or
// from an existing theme, duplicate, rename, archive and restore it — with no
// cap. The seam under test is those pure operations plus the AA guarantee of
// the roles derived from any seed.
import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/mockup/palette";
import {
  BUILT_IN_THEMES,
  THEME_SEEDS,
  activeThemes,
  archiveTheme,
  createTheme,
  defaultThemes,
  duplicateTheme,
  normalizeThemes,
  renameTheme,
  themeNameTaken,
  tokensFromSeed,
  unarchiveTheme,
} from "@/mockup/themes";

const NOW = 1_700_000_000_000;

const pairContrast = (theme: ReturnType<typeof createTheme>["theme"]) => {
  const t = theme!;
  return {
    lightText: contrastRatio(t.tokens.primary, t.tokens.onPrimary),
    lightContainer: contrastRatio(t.tokens.primaryContainer, t.tokens.onPrimaryContainer),
    darkText: contrastRatio(t.darkTokens.primary, t.darkTokens.onPrimary),
    darkContainer: contrastRatio(t.darkTokens.primaryContainer, t.darkTokens.onPrimaryContainer),
  };
};

describe("theme roles from a seed", () => {
  it("clears WCAG AA in both schemes for every offered seed", () => {
    for (const seed of THEME_SEEDS) {
      const { tokens, darkTokens } = tokensFromSeed(seed.hex);
      expect(contrastRatio(tokens.primary, tokens.onPrimary)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(tokens.primaryContainer, tokens.onPrimaryContainer),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(darkTokens.primary, darkTokens.onPrimary),
        `${seed.name} dark primary`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(darkTokens.primaryContainer, darkTokens.onPrimaryContainer),
        `${seed.name} dark container`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("derives different roles per seed (a theme is not a repaint of the same one)", () => {
    const a = tokensFromSeed("#2F6E8A");
    const b = tokensFromSeed("#C47A2B");
    expect(a.tokens.primary).not.toBe(b.tokens.primary);
    expect(a.tokens.primaryContainer).not.toBe(b.tokens.primaryContainer);
  });
});

describe("theme CRUD", () => {
  it("starts from the shipped catalog and has no cap of three", () => {
    expect(defaultThemes().map((t) => t.id)).toEqual(BUILT_IN_THEMES.map((t) => t.id));
    let themes = defaultThemes();
    for (let i = 0; i < 6; i += 1) {
      const change = createTheme(
        themes,
        { label: `Tema ${i}`, emoji: "🎨", seed: THEME_SEEDS[i % THEME_SEEDS.length]!.hex },
        `t${i}`,
        NOW + i,
      );
      expect(change.error).toBeUndefined();
      themes = change.themes;
    }
    expect(themes).toHaveLength(9);
    expect(activeThemes(themes)).toHaveLength(9);
  });

  it("creates from scratch with a seed color and from an existing theme's roles", () => {
    const fromScratch = createTheme(
      defaultThemes(),
      { label: "Jardim", emoji: "🌻", seed: "#4B7D63" },
      "jardim",
      NOW,
    );
    expect(fromScratch.theme?.tokens.primary).toMatch(/^#[0-9A-F]{6}$/);
    for (const ratio of Object.values(pairContrast(fromScratch.theme))) {
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
    expect(fromScratch.theme?.art).toBeNull();

    const fromTheme = createTheme(
      defaultThemes(),
      { label: "Dinos 2", emoji: "🦕", seed: "#000000", fromId: "dinos" },
      "dinos-2",
      NOW,
    );
    const dinos = defaultThemes().find((t) => t.id === "dinos")!;
    expect(fromTheme.theme?.tokens).toEqual(dinos.tokens);
    expect(fromTheme.theme?.darkTokens).toEqual(dinos.darkTokens);
    expect(fromTheme.theme?.art).toBe("dinos");
  });

  it("refuses an empty or duplicate name and accepts a real rename", () => {
    const themes = defaultThemes();
    expect(createTheme(themes, { label: "  ", emoji: "🎨", seed: "#2F6E8A" }, "x", NOW).error).toBe(
      "Dê um nome para o tema.",
    );
    expect(
      createTheme(themes, { label: "Herói", emoji: "🎨", seed: "#2F6E8A" }, "x", NOW).error,
    ).toBe("Já existe um tema com esse nome.");

    const renamed = renameTheme(themes, "dinos", "Vale dos dinos");
    expect(renamed.themes.find((t) => t.id === "dinos")?.label).toBe("Vale dos dinos");
    expect(renameTheme(themes, "dinos", "Herói").error).toBeTruthy();
    expect(themeNameTaken(themes, "vale dos dinos")).toBe(false);
    expect(themeNameTaken(renamed.themes, "vale dos dinos")).toBe(true);
  });

  it("duplicates next to the original with a free name and the same roles", () => {
    const themes = defaultThemes();
    const first = duplicateTheme(themes, "heroi", "heroi-2", NOW);
    expect(first.theme?.label).toBe("Herói 2");
    expect(first.theme?.tokens).toEqual(themes.find((t) => t.id === "heroi")?.tokens);
    expect(first.theme?.id).not.toBe("heroi");
    const second = duplicateTheme(first.themes, "heroi", "heroi-3", NOW + 1);
    expect(second.theme?.label).toBe("Herói 3");
    const order = second.themes.map((t) => t.order);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("archives out of the picker but never undresses a profile or deletes data", () => {
    const themes = defaultThemes();
    const archived = archiveTheme(themes, "dinos");
    expect(archived.themes).toHaveLength(3);
    expect(activeThemes(archived.themes).map((t) => t.id)).toEqual(["heroi", "neutro"]);
    // The theme still exists and still resolves by id — archiving is a filter.
    expect(archived.themes.find((t) => t.id === "dinos")?.archived).toBe(true);

    const restored = unarchiveTheme(archived.themes, "dinos");
    expect(restored.themes.find((t) => t.id === "dinos")?.archived).toBe(false);
  });

  it("keeps at least one active theme", () => {
    let themes = defaultThemes();
    for (const id of ["dinos", "heroi"]) {
      themes = archiveTheme(themes, id).themes;
    }
    const refused = archiveTheme(themes, "neutro");
    expect(refused.error).toBe("Deixe pelo menos um tema ativo.");
    expect(refused.themes).toBe(themes);
  });
});

describe("theme migration", () => {
  it("gives pre-CRUD saves the shipped catalog", () => {
    expect(normalizeThemes(undefined).map((t) => t.id)).toEqual(["dinos", "heroi", "neutro"]);
    expect(normalizeThemes([]).map((t) => t.id)).toEqual(["dinos", "heroi", "neutro"]);
  });

  it("keeps a CRUD-era catalog, fills the missing roles and normalizes order", () => {
    const saved = [
      { id: "meu", label: "Meu tema", emoji: "🌻", seed: "#4B7D63", order: 7 },
      { id: "dinos", label: "Dinossauros", emoji: "🦕", seed: "#C0567A", order: 2 },
    ];
    const out = normalizeThemes(saved);
    const mine = out.find((t) => t.id === "meu")!;
    expect(mine.tokens.primary).toBeTruthy();
    expect(mine.darkTokens.primary).toBeTruthy();
    // The catalog is never lost when a save only knows part of it.
    expect(out.some((t) => t.id === "neutro")).toBe(true);
    expect(out.map((t) => t.order)).toEqual(out.map((_, i) => i));
  });

  it("reactivates one theme when a save archived every single one", () => {
    const saved = defaultThemes().map((t) => ({ ...t, archived: true }));
    expect(activeThemes(normalizeThemes(saved))).toHaveLength(1);
  });
});
