// Seams under test:
//  1. uiMode derivation — age decides, the adult override wins
//  2. capability defaults — the 7 toggles per age band (adjusting doc table)
//  3. dependency rule — gradient/techniques only exist with "ferramentas complexas"
//  4. seed migration — the demo seeds were inverted; normalizeProfiles fixes them
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_KEYS,
  CAP_DEFAULTS,
  capsOf,
  effectiveCaps,
  resolveUiMode,
  uiModeOf,
  type CapabilityProfile,
} from "@/mockup/capabilities";
import { normalizeProfiles, type Profile } from "@/mockup/store";
import { MAX_PERSONA_LENGTH } from "@/mockup/persona";

const profile = (over: Partial<CapabilityProfile> = {}): CapabilityProfile => ({
  age: "3-5",
  uiModeOverride: null,
  capsOverride: null,
  ...over,
});

describe("ui mode", () => {
  it("derives kids from the 3-5 band and pro from the older bands", () => {
    expect(uiModeOf(profile({ age: "3-5" }))).toBe("kids");
    expect(uiModeOf(profile({ age: "6-8" }))).toBe("pro");
    expect(uiModeOf(profile({ age: "9+" }))).toBe("pro");
  });

  it("lets the adult override both ways, and the session preview outranks it", () => {
    expect(uiModeOf(profile({ age: "3-5", uiModeOverride: "pro" }))).toBe("pro");
    expect(uiModeOf(profile({ age: "9+", uiModeOverride: "kids" }))).toBe("kids");
    expect(resolveUiMode(profile({ age: "9+" }), "kids")).toBe("kids");
    expect(resolveUiMode(profile({ age: "9+" }), null)).toBe("pro");
  });
});

describe("capability defaults", () => {
  it("keeps the 3-5 band to the simple toolset", () => {
    expect(CAP_DEFAULTS["3-5"]).toEqual({
      ferramentasComplexas: false,
      paletaCompleta: false,
      gradienteEfeitos: false,
      variacaoClaroEscuro: false,
      tecnicas: false,
      desafioDuo: false,
      publicarMural: true,
    });
  });

  it("gives the 9+ band the full toolset but reserves gradient for older profiles only", () => {
    expect(CAP_DEFAULTS["9+"]).toMatchObject({
      ferramentasComplexas: true,
      paletaCompleta: true,
      gradienteEfeitos: true,
      variacaoClaroEscuro: true,
      tecnicas: true,
      desafioDuo: true,
      publicarMural: true,
    });
    expect(CAP_DEFAULTS["6-8"].gradienteEfeitos).toBe(false);
    expect(CAP_DEFAULTS["6-8"].ferramentasComplexas).toBe(true);
  });

  it("has six visible toggles and merges only what the adult overrode", () => {
    expect(CAPABILITY_KEYS).toHaveLength(6);
    // "Técnicas" is legacy: it never renders a toggle again.
    expect(CAPABILITY_KEYS).not.toContain("tecnicas");
    const caps = capsOf(profile({ age: "3-5", capsOverride: { paletaCompleta: true } }));
    expect(caps.paletaCompleta).toBe(true);
    expect(caps.ferramentasComplexas).toBe(false);
    expect(caps.publicarMural).toBe(true);
  });

  it("turns dependent capabilities off while 'ferramentas complexas' is off", () => {
    const caps = effectiveCaps(
      profile({
        age: "3-5",
        capsOverride: { gradienteEfeitos: true, tecnicas: true },
      }),
    );
    expect(caps.gradienteEfeitos).toBe(false);
    expect(caps.tecnicas).toBe(false);
    expect(capsOf(profile({ age: "3-5", capsOverride: { tecnicas: true } })).tecnicas).toBe(true);
  });
});

describe("seed migration", () => {
  const stored = (over: Partial<Profile> & { id: string }): Profile =>
    ({
      name: "Criança",
      avatar: "cat",
      tone: "coral",
      mode: "fill",
      age: "3-5",
      gestures: false,
      themeId: "neutro",
      avatarCustom: null,
      photoUri: null,
      ...over,
    }) as Profile;

  it("fixes the inverted seeds: Theo is 3-5 (kids) and Maria is 9+ (pro)", () => {
    const out = normalizeProfiles([
      stored({ id: "maria", age: "3-5" }),
      stored({ id: "theo", age: "6-8" }),
    ]);
    expect(out.map((p) => p.age)).toEqual(["9+", "3-5"]);
    expect(out.map((p) => uiModeOf(p))).toEqual(["pro", "kids"]);
  });

  it("keeps the band the adult chose for a profile they created", () => {
    const out = normalizeProfiles([stored({ id: "visitante", age: "6-8" })]);
    expect(out[0]!.age).toBe("6-8");
  });

  it("stops rewriting the seed band once the adult changed it in a current save", () => {
    const out = normalizeProfiles([
      stored({ id: "theo", age: "9+", uiModeOverride: null, capsOverride: null }),
    ]);
    expect(out[0]!.age).toBe("9+");
  });

  it("fills the new fields conservatively, so old saves derive the mode", () => {
    const out = normalizeProfiles([stored({ id: "visitante" })]);
    expect(out[0]!.uiModeOverride).toBeNull();
    expect(out[0]!.capsOverride).toBeNull();
    expect(out[0]!.emojiAvatar).toBeNull();
    expect(out[0]!.recentColors).toEqual([]);
    expect(out[0]!.favoriteColors).toEqual([]);
    expect(out[0]!.personaLine).toBeNull();
  });

  it("keeps the description the adult wrote for each profile", () => {
    const out = normalizeProfiles([
      stored({ id: "maria", personaLine: "Faz tirinhas em camadas." }),
      stored({ id: "theo", personaLine: "  " }),
    ]);
    expect(out[0]!.personaLine).toBe("Faz tirinhas em camadas.");
    // Blank is "use the suggestion", never an empty written line.
    expect(out[1]!.personaLine).toBeNull();
  });

  it("caps a description that arrives too long from a backup", () => {
    const out = normalizeProfiles([stored({ id: "maria", personaLine: "a".repeat(400) })]);
    expect(out[0]!.personaLine).toHaveLength(MAX_PERSONA_LENGTH);
  });

  it("assumes the most restrictive band when a save has no age", () => {
    const legacy = { ...stored({ id: "sem-idade" }) } as Partial<Profile>;
    delete legacy.age;
    const out = normalizeProfiles([legacy as Profile]);
    expect(out[0]!.age).toBe("3-5");
  });
});
