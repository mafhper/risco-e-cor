// Colors are artwork content (what the child paints with), not UI theme.
// The catalog follows the M3/spectrum spec (m3-temas-cor.md §6): 18 families
// (15 chromatic + 3 neutral) x 11 steps (50..950) = 198 swatches, plus black
// and white = 200.
//
// Two rules keep the toolbar honest:
//  1. the ramps are Tailwind CSS v4's published oklch values, copied from
//     `node_modules/tailwindcss/theme.css` — not a shared lightness ramp, which
//     made "amarelo" a mustard and "lima" a forest green;
//  2. the name of a swatch is derived from its own oklch (hue word + measured
//     tone), so "vermelho" can never point at a pink. The catalog passes its
//     family only to choose the hue word; the tone always comes from the hex.
//
// The 3-5 band never sees this catalog: it gets six big circles (KID_COLORS).

export type Crayon = { hex: string };

/**
 * The steps the COLOUR BAR's ladder carries: ten, not eleven (owner's decision,
 * 27/10). The bar's row opens on white and closes on black, and the two neutrals
 * are cells of it — so the derived family keeps ten rungs to close the row on
 * twelve cells: `branco + 10 degraus + preto`, in 6 + 6.
 *
 * 900 is the step that left: 50 and 950 are the extremes and stay, and of the
 * eleven published steps dropping 900 is the one that keeps every remaining gap
 * equal (the 800 → 950 jump is the single wider step, at the dark end where the
 * eye resolves least).
 *
 * The CATALOGUE is not this list: each family still ships eleven published
 * steps (`FAMILY_STEPS`), because the 200-colour product rule is 18 × 11 + 2.
 */
export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 950] as const;
export type ScaleStep = (typeof SCALE_STEPS)[number];

/**
 * The catalogue's scale: the eleven published steps of every family, 50…950.
 * A family's `steps` array is indexed by THIS list, never by `SCALE_STEPS` —
 * the two differ by the 900 rung, and an `indexOf` read against the wrong one
 * would point a family's 950 at its 900.
 */
export const FAMILY_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
export type FamilyStep = (typeof FAMILY_STEPS)[number];

/**
 * Paper appearance — the studio surface, not the color catalog. The three
 * materials are the owner's vocabulary (linho / grafite / quadriculado); the
 * grid overlay on the canvas is a separate working aid and never one of these.
 *
 * Two surfaces, never one color:
 *  - `surface` is the DESK around the page (the canvas the tools float on);
 *  - `paperHex` is the PAGE itself, locked to #FFFFFF on every material so a
 *    coloring page keeps its printed-paper contract and its line art readable.
 * The desk is deliberately at least one tone away from white: a white page on
 * a white desk is the defect this model exists to prevent.
 */
export type PaperKey = "linho" | "grafite" | "quadriculado";
export const PAPER_KEYS: PaperKey[] = ["linho", "grafite", "quadriculado"];

/**
 * THE SHEET'S PRINTED TEXTURE AND TONE (owner's decision, 27/10, `chrome-v2`).
 *
 * `texture` is how pronounced the paper's own grain is — never the working grid:
 * `lisa` paints no grain, `media` and `acentuada` paint the same linen hatch at
 * two inks. It ENTERS the file (the paper is the artwork's surface, `exportPng`
 * paints it); the grid never does.
 *
 * `tone` is the near-white the page is printed on: `claro` is the #FFFFFF the
 * page always had, `areia` and `creme` are two warmer stocks. It is a param of
 * the PROFILE and is blocked on 3–5 (a kid's paper is neutral by ADR).
 */
export type PaperTexture = "lisa" | "media" | "acentuada";
export const PAPER_TEXTURES: PaperTexture[] = ["lisa", "media", "acentuada"];

export type PaperTone = "claro" | "areia" | "creme";
export const PAPER_TONES: PaperTone[] = ["claro", "areia", "creme"];

/** The weave's ink, as an opacity over the sheet: 0 / light / pronounced. */
export const PAPER_TEXTURE_ALPHA: Record<PaperTexture, number> = {
  lisa: 0,
  media: 0.05,
  acentuada: 0.09,
};

/** The sheet's own hex per tone. `claro` is the printed-paper contract. */
export const PAPER_TONE_HEX: Record<PaperTone, string> = {
  claro: "#FFFFFF",
  areia: "#FFF6E4",
  creme: "#FBEFD6",
};

export const PAPER_TEXTURE_LABEL: Record<PaperTexture, string> = {
  lisa: "Lisa",
  media: "Média",
  acentuada: "Acentuada",
};

export const PAPER_TONE_LABEL: Record<PaperTone, string> = {
  claro: "Claro",
  areia: "Areia",
  creme: "Creme",
};

/**
 * THE WORKING GRID, as the `Grade` fold names it. The DENSITY *is* the cell, in
 * artwork units: 16 / 24 / 32 — the number the canvas and the suite both read.
 * The strength is how hard the lattice is drawn; the switch is the fold's own
 * header, never a fourth segment here.
 */
export type GridPattern = "quadrado" | "pontilhado" | "linhas";
export const GRID_PATTERNS: GridPattern[] = ["quadrado", "pontilhado", "linhas"];

export type GridDensity = "fina" | "media" | "grossa";
export const GRID_DENSITIES: GridDensity[] = ["fina", "media", "grossa"];

export type GridStrength = "sutil" | "nitida";
export const GRID_STRENGTHS: GridStrength[] = ["sutil", "nitida"];

export const GRID_CELL_UNITS: Record<GridDensity, number> = {
  fina: 16,
  media: 24,
  grossa: 32,
};

export const GRID_PATTERN_LABEL: Record<GridPattern, string> = {
  quadrado: "Quadrado",
  pontilhado: "Pontilhado",
  linhas: "Linhas",
};

export const GRID_DENSITY_LABEL: Record<GridDensity, string> = {
  fina: "Fina",
  media: "Média",
  grossa: "Grossa",
};

export const GRID_STRENGTH_LABEL: Record<GridStrength, string> = {
  sutil: "Sutil",
  nitida: "Nítida",
};

export type PaperMaterial = {
  label: string;
  /** The desk around the page (full-bleed surface), never plain white. */
  surface: string;
  /** The page itself, where the artwork lives: #FFFFFF unless a tone says so. */
  paperHex: string;
  /** Line-art ink, readable against `paperHex`. */
  outline: string;
  /** Graph pattern painted inside the page (the paper's own texture). */
  pattern: boolean;
  /** How pronounced the sheet's grain is; absent = `lisa` (no grain). */
  texture?: PaperTexture;
  /** Swatch for the settings rows: the surface, because that is what changes. */
  swatch: string;
};

export const PAPERS: Record<PaperKey, PaperMaterial> = {
  linho: {
    label: "Papel Linho",
    surface: "#D8D0BE",
    paperHex: "#FFFFFF",
    outline: "#23252A",
    pattern: false,
    swatch: "#D8D0BE",
  },
  grafite: {
    label: "Papel Grafite",
    surface: "#2B2A29",
    paperHex: "#FFFFFF",
    outline: "#23252A",
    pattern: false,
    swatch: "#3B3D42",
  },
  quadriculado: {
    label: "Papel Quadriculado",
    surface: "#E8E1D1",
    paperHex: "#FFFFFF",
    outline: "#23252A",
    pattern: true,
    swatch: "#E4EDF6",
  },
};

export const isPaperKey = (value: unknown): value is PaperKey =>
  typeof value === "string" && (PAPER_KEYS as string[]).includes(value);

/** Half a lightness point: below what an 8-bit channel can resolve (drift ≤0.18). */
const RUNG_TOLERANCE = 0.5;

/**
 * The Tailwind-like ramp derived from one color: same hue and saturation, the
 * eleven lightness steps of the published scale (50..950, light to dark). The
 * picker chooses the main color; this ramp is the "variações" row under it and
 * the labelled 50→950 row of the family section.
 *
 * Eleven rungs, one per published step: the row sits under the 50..950 labels,
 * so a missing rung would take a label away from its tone. A color that already
 * sits on a rung anchors the ladder on itself, so a tapped variation re-derives
 * to itself instead of drifting one byte off (the hex -> HSL round trip is not
 * exact at every rung). A color between rungs gets the published ladder and is
 * not one of its tones — which is what makes "no variation selected" honest.
 */
export const DERIVED_LIGHTNESS = [96, 89, 82, 75, 68, 61, 54, 47, 40, 33, 26] as const;

/**
 * The COLOUR BAR's ladder: the same ramp with the 900 rung taken out, one
 * lightness per step of `SCALE_STEPS`. The bar's row is twelve cells — white,
 * these ten rungs, black — so the ladder it draws is the ten-rung one; the
 * expanded sheet keeps the eleven-rung `DERIVED_LIGHTNESS`, because there the
 * ramp is labelled with the whole published scale and did not change.
 */
export const COMPACT_LIGHTNESS = [96, 89, 82, 75, 68, 61, 54, 47, 40, 26] as const;

export function derivedRamp(hex: string, rungs: readonly number[] = DERIVED_LIGHTNESS): string[] {
  const { h, s, l } = hslOfHex(hex);
  const nearest = rungs.reduce((best, rung) =>
    Math.abs(rung - l) < Math.abs(best - l) ? rung : best,
  );
  const anchor = Math.abs(nearest - l) <= RUNG_TOLERANCE ? l - nearest : 0;
  return rungs.map((rung) => hexFromHsl({ h, s, l: rung + anchor, a: 100 }));
}

/** The minimum palette every surface must keep — asserted by the test suite. */
export const PALETTE_MIN = {
  families: 18,
  /** One per published step of the catalogue (`FAMILY_STEPS`), never the bar's ten. */
  stepsPerFamily: 11,
  swatches: 200,
  compact: 6,
  kids: 6,
} as const;

type FamilySeed = {
  id: string;
  /** Catalog label kept as source documentation; never rendered or spoken. */
  name: string;
  /** Tailwind v4 `oklch(L% C H)` triples for steps 50..950. */
  steps: readonly string[];
};

/**
 * Tailwind CSS v4 ramps — exact values shipped by `tailwindcss@4` in
 * `theme.css`. Keeping the per-step lightness and hue drift is what makes the
 * eleven variations of a family look like Tailwind's and not like one ramp
 * tinted eighteen times.
 */
const FAMILY_SEEDS: FamilySeed[] = [
  {
    id: "vermelho",
    name: "Vermelho",
    steps: [
      "97.1% 0.013 17.38",
      "93.6% 0.032 17.717",
      "88.5% 0.062 18.334",
      "80.8% 0.114 19.571",
      "70.4% 0.191 22.216",
      "63.7% 0.237 25.331",
      "57.7% 0.245 27.325",
      "50.5% 0.213 27.518",
      "44.4% 0.177 26.899",
      "39.6% 0.141 25.723",
      "25.8% 0.092 26.042",
    ],
  },
  {
    id: "laranja",
    name: "Laranja",
    steps: [
      "98% 0.016 73.684",
      "95.4% 0.038 75.164",
      "90.1% 0.076 70.697",
      "83.7% 0.128 66.29",
      "75% 0.183 55.934",
      "70.5% 0.213 47.604",
      "64.6% 0.222 41.116",
      "55.3% 0.195 38.402",
      "47% 0.157 37.304",
      "40.8% 0.123 38.172",
      "26.6% 0.079 36.259",
    ],
  },
  {
    id: "ambar",
    name: "Âmbar",
    steps: [
      "98.7% 0.022 95.277",
      "96.2% 0.059 95.617",
      "92.4% 0.12 95.746",
      "87.9% 0.169 91.605",
      "82.8% 0.189 84.429",
      "76.9% 0.188 70.08",
      "66.6% 0.179 58.318",
      "55.5% 0.163 48.998",
      "47.3% 0.137 46.201",
      "41.4% 0.112 45.904",
      "27.9% 0.077 45.635",
    ],
  },
  {
    id: "amarelo",
    name: "Amarelo",
    steps: [
      "98.7% 0.026 102.212",
      "97.3% 0.071 103.193",
      "94.5% 0.129 101.54",
      "90.5% 0.182 98.111",
      "85.2% 0.199 91.936",
      "79.5% 0.184 86.047",
      "68.1% 0.162 75.834",
      "55.4% 0.135 66.442",
      "47.6% 0.114 61.907",
      "42.1% 0.095 57.708",
      "28.6% 0.066 53.813",
    ],
  },
  {
    id: "lima",
    name: "Lima",
    steps: [
      "98.6% 0.031 120.757",
      "96.7% 0.067 122.328",
      "93.8% 0.127 124.321",
      "89.7% 0.196 126.665",
      "84.1% 0.238 128.85",
      "76.8% 0.233 130.85",
      "64.8% 0.2 131.684",
      "53.2% 0.157 131.589",
      "45.3% 0.124 130.933",
      "40.5% 0.101 131.063",
      "27.4% 0.072 132.109",
    ],
  },
  {
    id: "verde",
    name: "Verde",
    steps: [
      "98.2% 0.018 155.826",
      "96.2% 0.044 156.743",
      "92.5% 0.084 155.995",
      "87.1% 0.15 154.449",
      "79.2% 0.209 151.711",
      "72.3% 0.219 149.579",
      "62.7% 0.194 149.214",
      "52.7% 0.154 150.069",
      "44.8% 0.119 151.328",
      "39.3% 0.095 152.535",
      "26.6% 0.065 152.934",
    ],
  },
  {
    id: "esmeralda",
    name: "Esmeralda",
    steps: [
      "97.9% 0.021 166.113",
      "95% 0.052 163.051",
      "90.5% 0.093 164.15",
      "84.5% 0.143 164.978",
      "76.5% 0.177 163.223",
      "69.6% 0.17 162.48",
      "59.6% 0.145 163.225",
      "50.8% 0.118 165.612",
      "43.2% 0.095 166.913",
      "37.8% 0.077 168.94",
      "26.2% 0.051 172.552",
    ],
  },
  {
    id: "teal",
    name: "Turquesa",
    steps: [
      "98.4% 0.014 180.72",
      "95.3% 0.051 180.801",
      "91% 0.096 180.426",
      "85.5% 0.138 181.071",
      "77.7% 0.152 181.912",
      "70.4% 0.14 182.503",
      "60% 0.118 184.704",
      "51.1% 0.096 186.391",
      "43.7% 0.078 188.216",
      "38.6% 0.063 188.416",
      "27.7% 0.046 192.524",
    ],
  },
  {
    id: "ciano",
    name: "Ciano",
    steps: [
      "98.4% 0.019 200.873",
      "95.6% 0.045 203.388",
      "91.7% 0.08 205.041",
      "86.5% 0.127 207.078",
      "78.9% 0.154 211.53",
      "71.5% 0.143 215.221",
      "60.9% 0.126 221.723",
      "52% 0.105 223.128",
      "45% 0.085 224.283",
      "39.8% 0.07 227.392",
      "30.2% 0.056 229.695",
    ],
  },
  {
    id: "ceu",
    name: "Céu",
    steps: [
      "97.7% 0.013 236.62",
      "95.1% 0.026 236.824",
      "90.1% 0.058 230.902",
      "82.8% 0.111 230.318",
      "74.6% 0.16 232.661",
      "68.5% 0.169 237.323",
      "58.8% 0.158 241.966",
      "50% 0.134 242.749",
      "44.3% 0.11 240.79",
      "39.1% 0.09 240.876",
      "29.3% 0.066 243.157",
    ],
  },
  {
    id: "azul",
    name: "Azul",
    steps: [
      "97% 0.014 254.604",
      "93.2% 0.032 255.585",
      "88.2% 0.059 254.128",
      "80.9% 0.105 251.813",
      "70.7% 0.165 254.624",
      "62.3% 0.214 259.815",
      "54.6% 0.245 262.881",
      "48.8% 0.243 264.376",
      "42.4% 0.199 265.638",
      "37.9% 0.146 265.522",
      "28.2% 0.091 267.935",
    ],
  },
  {
    id: "indigo",
    name: "Índigo",
    steps: [
      "96.2% 0.018 272.314",
      "93% 0.034 272.788",
      "87% 0.065 274.039",
      "78.5% 0.115 274.713",
      "67.3% 0.182 276.935",
      "58.5% 0.233 277.117",
      "51.1% 0.262 276.966",
      "45.7% 0.24 277.023",
      "39.8% 0.195 277.366",
      "35.9% 0.144 278.697",
      "25.7% 0.09 281.288",
    ],
  },
  {
    id: "violeta",
    name: "Violeta",
    steps: [
      "96.9% 0.016 293.756",
      "94.3% 0.029 294.588",
      "89.4% 0.057 293.283",
      "81.1% 0.111 293.571",
      "70.2% 0.183 293.541",
      "60.6% 0.25 292.717",
      "54.1% 0.281 293.009",
      "49.1% 0.27 292.581",
      "43.2% 0.232 292.759",
      "38% 0.189 293.745",
      "28.3% 0.141 291.089",
    ],
  },
  {
    id: "roxo",
    name: "Roxo",
    steps: [
      "97.7% 0.014 308.299",
      "94.6% 0.033 307.174",
      "90.2% 0.063 306.703",
      "82.7% 0.119 306.383",
      "71.4% 0.203 305.504",
      "62.7% 0.265 303.9",
      "55.8% 0.288 302.321",
      "49.6% 0.265 301.924",
      "43.8% 0.218 303.724",
      "38.1% 0.176 304.987",
      "29.1% 0.149 302.717",
    ],
  },
  {
    id: "rosa",
    name: "Rosa",
    steps: [
      "97.1% 0.014 343.198",
      "94.8% 0.028 342.258",
      "89.9% 0.061 343.231",
      "82.3% 0.12 346.018",
      "71.8% 0.202 349.761",
      "65.6% 0.241 354.308",
      "59.2% 0.249 0.584",
      "52.5% 0.223 3.958",
      "45.9% 0.187 3.815",
      "40.8% 0.153 2.432",
      "28.4% 0.109 3.907",
    ],
  },
  {
    id: "ardosia",
    name: "Ardósia",
    steps: [
      "98.4% 0.003 247.858",
      "96.8% 0.007 247.896",
      "92.9% 0.013 255.508",
      "86.9% 0.022 252.894",
      "70.4% 0.04 256.788",
      "55.4% 0.046 257.417",
      "44.6% 0.043 257.281",
      "37.2% 0.044 257.287",
      "27.9% 0.041 260.031",
      "20.8% 0.042 265.755",
      "12.9% 0.042 264.695",
    ],
  },
  {
    id: "cinza",
    name: "Cinza",
    steps: [
      "98.5% 0.002 247.839",
      "96.7% 0.003 264.542",
      "92.8% 0.006 264.531",
      "87.2% 0.01 258.338",
      "70.7% 0.022 261.325",
      "55.1% 0.027 264.364",
      "44.6% 0.03 256.802",
      "37.3% 0.034 259.733",
      "27.8% 0.033 256.848",
      "21% 0.034 264.665",
      "13% 0.028 261.692",
    ],
  },
  {
    id: "pedra",
    name: "Pedra",
    steps: [
      "98.5% 0.001 106.423",
      "97% 0.001 106.424",
      "92.3% 0.003 48.717",
      "86.9% 0.005 56.366",
      "70.9% 0.01 56.259",
      "55.3% 0.013 58.071",
      "44.4% 0.011 73.639",
      "37.4% 0.01 67.558",
      "26.8% 0.007 34.298",
      "21.6% 0.006 56.043",
      "14.7% 0.004 49.25",
    ],
  },
];

const NEUTRAL_IDS = new Set(["ardosia", "cinza", "pedra"]);

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** oklch -> sRGB hex. Values are clamped: out-of-gamut ramps keep their hue. */
export function oklchToHex(l: number, c: number, hue: number): string {
  const rad = (hue * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = lPrime ** 3;
  const m3 = mPrime ** 3;
  const s3 = sPrime ** 3;

  const toSrgb = (v: number) =>
    clamp01(v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055);

  const r = toSrgb(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3);
  const g = toSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3);
  const bl = toSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3);

  const byte = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  return `#${byte(r)}${byte(g)}${byte(bl)}`;
}

export type Oklch = { l: number; c: number; h: number };

/** Parse a Tailwind `oklch(L% C H)` triple (the values above). */
function parseTriple(triple: string): Oklch {
  const [lightness, chroma, hue] = triple.split(/\s+/);
  return {
    l: parseFloat(lightness!) / 100,
    c: parseFloat(chroma!),
    h: parseFloat(hue!),
  };
}

export type PaletteFamily = {
  id: string;
  /** The 11 steps of this family, light to dark. */
  steps: Crayon[];
  /** The 500 step — the family's identity color. */
  base: Crayon;
};

export const PALETTE_FAMILIES: PaletteFamily[] = FAMILY_SEEDS.map((seed) => {
  const steps = seed.steps.map((triple) => {
    const lch = parseTriple(triple);
    return { hex: oklchToHex(lch.l, lch.c, lch.h) };
  });
  return {
    id: seed.id,
    steps,
    base: steps[FAMILY_STEPS.indexOf(500)]!,
  };
});

/** The 198 chromatic swatches, flat. */
export const PALETTE_TONES: Crayon[] = PALETTE_FAMILIES.flatMap((f) => f.steps);

export const BLACK: Crayon = { hex: "#000000" };
export const WHITE: Crayon = { hex: "#FFFFFF" };

/** Everything the palette can paint with: 198 + preto + branco = 200. */
export const PALETTE_ALL: Crayon[] = [...PALETTE_TONES, BLACK, WHITE];

/** Quick neutrals the tray shows next to the chromatic steps. */
const neutralStep = (familyId: string, step: FamilyStep) =>
  PALETTE_FAMILIES.find((f) => f.id === familyId)!.steps[FAMILY_STEPS.indexOf(step)]!;

export const PALETTE_NEUTRALS: Crayon[] = [
  WHITE,
  neutralStep("cinza", 300),
  neutralStep("cinza", 500),
  neutralStep("cinza", 700),
  BLACK,
];

/** The 18 family colors the collapsed grid shows before a family opens. */
export const BASE_COLORS: Crayon[] = PALETTE_FAMILIES.map((f) => f.base);

/**
 * Six quick colors for the compact bar. A balanced spread, not the first six
 * families: red, yellow, green, cyan, blue, purple are visible at a glance.
 */
const QUICK_IDS = ["vermelho", "amarelo", "verde", "ciano", "azul", "roxo"] as const;
export const QUICK_COLORS: Crayon[] = QUICK_IDS.map(
  (id) => PALETTE_FAMILIES.find((f) => f.id === id)!.base,
);

/** Six big colors for the 3-5 band (no chrome, no tabs, no texts). */
const KID_IDS = ["vermelho", "laranja", "amarelo", "verde", "azul", "roxo"] as const;
export const KID_COLORS: Crayon[] = KID_IDS.map(
  (id) => PALETTE_FAMILIES.find((f) => f.id === id)!.base,
);

/**
 * Swatches the gradient editor offers as stops (18 bases + 5 neutrals). The
 * neutral families also appear in BASE_COLORS, so the list is filtered to one
 * swatch per hex — the picker keys its buttons by hex.
 */
export const GRADIENT_STOPS: Crayon[] = [...BASE_COLORS, ...PALETTE_NEUTRALS].filter(
  (crayon, index, all) =>
    all.findIndex((other) => other.hex.toLowerCase() === crayon.hex.toLowerCase()) === index,
);

/** The fifteen chromatic families, in hue order — the spectrum bar's stops. */
export const SPECTRUM_FAMILIES = PALETTE_FAMILIES.filter((f) => !NEUTRAL_IDS.has(f.id));

/** The spectro bar: the 15 family bases, looping back to red. */
export const SPECTRUM_CSS = `linear-gradient(90deg, ${[
  ...SPECTRUM_FAMILIES.map((f) => f.base.hex),
  SPECTRUM_FAMILIES[0]!.base.hex,
].join(", ")})`;

export const PAPER_HEX = "#ffffff";
export const OUTLINE_HEX = "#23252a";
/** `--foreground` in sRGB, for contrast math on artifacts outside CSS. */
export const INK_HEX = "#000000";

export const BRUSH_SIZES = [3, 6, 10, 16, 24] as const;
export const BRUSH_SIZE_LABELS = ["Fino", "Médio", "Grosso", "Extra", "Enorme"] as const;
/** The 3-5 band only gets the first three sizes. */
export const KID_SIZE_COUNT = 3;

export const OPACITY_MIN = 20;
export const OPACITY_MAX = 100;

/** WCAG relative luminance of a #rrggbb color. */
export function hexLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(clean)) return 0;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(clean.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two #rrggbb colors. */
export function contrastRatio(a: string, b: string): number {
  const la = hexLuminance(a);
  const lb = hexLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Ink to use on top of a swatch. Spec rule is "L > 60% => dark text"; the
 * measured contrast check is the same decision with a guaranteed AA floor.
 */
export function paletteTextColor(hex: string): "paper" | "foreground" {
  return contrastRatio(hex, PAPER_HEX) >= 4.5 ? "paper" : "foreground";
}

/**
 * Color math for the advanced selector. HSL is the primary model on purpose:
 * "H 45° S 100% L 47%" is a set of three adjustable numbers, while a hex is a
 * single opaque token nobody edits by hand. `a` is 0..100; `h` is 0..360.
 */
export type Hsl = { h: number; s: number; l: number; a: number };

/** #rgb, #rrggbb and #rrggbbaa -> HSL(A). Invalid input is black. */
export function hslOfHex(hex: string): Hsl {
  let clean = hex.trim().replace("#", "");
  if (/^[0-9a-f]{3}$/i.test(clean)) clean = clean.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(clean)) return { h: 0, s: 0, l: 0, a: 100 };
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(clean.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const a = clean.length === 8 ? (parseInt(clean.slice(6, 8), 16) / 255) * 100 : 100;
  return { h, s: s * 100, l: l * 100, a };
}

/** HSL(A) -> #RRGGBB (or #RRGGBBAA when alpha is below 100). */
export function hexFromHsl(hsl: Hsl): string {
  const h = ((hsl.h % 360) + 360) % 360;
  const s = Math.min(100, Math.max(0, hsl.s)) / 100;
  const l = Math.min(100, Math.max(0, hsl.l)) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  const byte = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
  const rgb = `#${byte(r)}${byte(g)}${byte(b)}`;
  const a = Math.min(100, Math.max(0, hsl.a));
  if (a >= 100) return rgb;
  return `${rgb}${Math.round((a / 100) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase()}`;
}

/** The readout: HSL, or HSLA only when there is alpha to show. */
export function hslLabel(hsl: Hsl): string {
  const base = `${Math.round(hsl.h)}° ${Math.round(hsl.s)}% ${Math.round(hsl.l)}%`;
  return hsl.a >= 100 ? `HSL ${base}` : `HSLA ${base} ${Math.round(hsl.a)}%`;
}

export const isValidHex = (value: string) => /^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(value.trim());

export type GradientKind = "linear" | "radial";

export type StrokeGradient = {
  kind: GradientKind;
  stop1: string;
  stop2: string;
  angle: number;
};

/** CSS angles: 0deg points up, growing clockwise. The eight presets. */
export const GRADIENT_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

/**
 * The same angle as objectBoundingBox vectors, so the SVG def and the CSS
 * preview bar show the same direction. Returns [x1, y1, x2, y2] in percent.
 */
export function gradientPoints(angle: number): [number, number, number, number] {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = -Math.cos(rad);
  const round = (n: number) => Math.round(n * 100) / 100;
  return [round(50 - 50 * dx), round(50 - 50 * dy), round(50 + 50 * dx), round(50 + 50 * dy)];
}

const hexSlug = (hex: string) => hex.replace("#", "").toLowerCase();

/** Stable id: equal gradients share one `<defs>` entry. */
export function gradientId(g: StrokeGradient): string {
  return `grad-${g.kind}-${g.angle}-${hexSlug(g.stop1)}-${hexSlug(g.stop2)}`;
}

/** CSS preview that matches the SVG direction (no `background` shorthand). */
export function gradientCss(g: StrokeGradient): string {
  if (g.kind === "radial") return `radial-gradient(circle, ${g.stop1}, ${g.stop2})`;
  return `linear-gradient(${g.angle}deg, ${g.stop1}, ${g.stop2})`;
}
