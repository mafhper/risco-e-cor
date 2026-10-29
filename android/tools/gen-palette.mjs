// Gera `app/src/main/java/com/theomaria/draw/ui/PaletteCatalog.java` a partir
// dos valores do protótipo (`palette.ts`, informado por argumento — o protótipo
// mora fora do repositório, então o caminho não tem padrão).
//
// Por que gerar em vez de calcular em runtime: o catalogo e dado estatico (18
// familias x 11 degraus), e o app nao precisa carregar oklch nem uma tabela de
// nomes em tempo de execucao. O protótipo continua sendo a fonte; este script só
// transpila os mesmos numeros, com as mesmas regras de nome.
//
// Uso: node tools/gen-palette.mjs <caminho-do-palette.ts>
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..", "..");

const source = process.argv[2];
if (!source) {
  console.error("uso: node tools/gen-palette.mjs <caminho-do-palette.ts>");
  process.exit(1);
}

const text = readFileSync(source, "utf8");

// --- parse: FAMILY_SEEDS -----------------------------------------------------
const seedsBlock = text.slice(text.indexOf("const FAMILY_SEEDS"), text.indexOf("const NEUTRAL_IDS"));
const familyRe = /\{\s*id:\s*"([^"]+)",\s*name:\s*"([^"]+)",\s*steps:\s*\[([^\]]+)\]/gs;
const families = [];
for (const m of seedsBlock.matchAll(familyRe)) {
  const steps = [...m[3].matchAll(/"([\d.]+%\s+[\d.]+\s+[\d.]+)"/g)].map((s) => s[1]);
  if (steps.length !== 11) throw new Error(`familia ${m[1]} com ${steps.length} degraus`);
  families.push({ id: m[1], name: m[2], steps: steps.map(parseTriple) });
}
if (families.length !== 18) throw new Error(`esperava 18 familias, achei ${families.length}`);

const quickIds = [...text.matchAll(/^const QUICK_IDS = \[([^\]]+)\]/gm)][0][1]
  .match(/"([^"]+)"/g)
  .map((s) => s.replace(/"/g, ""));
const kidIds = [...text.matchAll(/^const KID_IDS = \[([^\]]+)\]/gm)][0][1]
  .match(/"([^"]+)"/g)
  .map((s) => s.replace(/"/g, ""));

// --- as mesmas funcoes do mockup --------------------------------------------
function parseTriple(triple) {
  const [l, c, h] = triple.trim().split(/\s+/);
  return { l: parseFloat(l) / 100, c: parseFloat(c), h: parseFloat(h) };
}

const clamp01 = (n) => Math.min(1, Math.max(0, n));

function oklchToHex(l, c, hue) {
  const rad = (hue * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b;
  const l3 = lPrime ** 3;
  const m3 = mPrime ** 3;
  const s3 = sPrime ** 3;
  const toSrgb = (v) =>
    clamp01(v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055);
  const r = toSrgb(4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3);
  const g = toSrgb(-1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3);
  const bl = toSrgb(-0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3);
  const byte = (v) => Math.round(v * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${byte(r)}${byte(g)}${byte(bl)}`;
}

const NEUTRAL_IDS = new Set(["ardosia", "cinza", "pedra"]);
const WORD = {
  vermelho: { word: "vermelho", gender: "m" },
  laranja: { word: "laranja", gender: "i" },
  ambar: { word: "âmbar", gender: "m" },
  amarelo: { word: "amarelo", gender: "m" },
  lima: { word: "lima", gender: "f" },
  verde: { word: "verde", gender: "i" },
  esmeralda: { word: "esmeralda", gender: "f" },
  teal: { word: "turquesa", gender: "f" },
  ciano: { word: "ciano", gender: "m" },
  ceu: { word: "céu", gender: "m" },
  azul: { word: "azul", gender: "m" },
  indigo: { word: "índigo", gender: "m" },
  violeta: { word: "violeta", gender: "f" },
  roxo: { word: "roxo", gender: "m" },
  rosa: { word: "rosa", gender: "f" },
};

const baseL = new Map(families.map((f) => [f.id, f.steps[5].l]));

function toneSuffix(delta, gender) {
  const f = gender === "f";
  if (delta >= 0.18) return f ? "bem-clara" : "bem-claro";
  if (delta >= 0.08) return f ? "clara" : "claro";
  if (delta <= -0.16) return f ? "bem-escura" : "bem-escuro";
  if (delta <= -0.06) return f ? "escura" : "escuro";
  return "";
}

function neutralName(l) {
  if (l >= 0.95) return "branco";
  if (l >= 0.8) return "cinza-claro";
  if (l >= 0.55) return "cinza";
  if (l >= 0.35) return "grafite";
  return "preto";
}

const isWarmDark = (l, c, h) => l <= 0.46 && c <= 0.08 && h >= 30 && h <= 110;

function catalogName(familyId, lch) {
  if (NEUTRAL_IDS.has(familyId)) return neutralName(lch.l);
  const { word, gender } = WORD[familyId];
  if (
    (familyId === "vermelho" || familyId === "laranja") &&
    lch.h >= 15 &&
    lch.h <= 42 &&
    lch.l >= 0.66 &&
    lch.c >= 0.1
  ) {
    if (lch.l >= 0.85) return "coral-bem-claro";
    if (lch.l >= 0.76) return "coral-claro";
    return "coral";
  }
  if (isWarmDark(lch.l, lch.c, lch.h) && ["laranja", "ambar", "amarelo"].includes(familyId)) {
    return lch.h < 65 ? "marrom" : "oliva";
  }
  if (familyId === "vermelho" && lch.l <= 0.4) return "vinho";
  if (familyId === "rosa" && lch.l <= 0.34) return "vinho";
  const suffix = toneSuffix(lch.l - baseL.get(familyId), gender);
  return suffix ? `${word}-${suffix}` : word;
}

const steps = families.map((family) => ({
  id: family.id,
  name: family.name,
  hex: family.steps.map((s) => oklchToHex(s.l, s.c, s.h)),
  labels: family.steps.map((s) => catalogName(family.id, s)),
}));

const find = (id) => steps.find((f) => f.id === id);
const neutrals = ["#FFFFFF", find("cinza").hex[2], find("cinza").hex[4], find("cinza").hex[6], "#000000"];
const neutralLabels = ["branco", "cinza-claro", "cinza", "grafite", "preto"];
const spectrum = steps.filter((f) => !NEUTRAL_IDS.has(f.id)).map((f) => f.hex[5]);

// --- emite Java --------------------------------------------------------------
const hexInt = (hex) => `0xFF${hex.replace("#", "").toUpperCase()}`;
const javaStr = (s) => JSON.stringify(s).replace(/\\"/g, '\\"');

const lines = [];
lines.push("package com.theomaria.draw.ui;");
lines.push("");
lines.push("/**");
lines.push(" * Catalogo de cores do atelie: 18 familias (15 cromaticas + 3 neutras) x 11");
lines.push(" * degraus (50..950), mais preto e branco. Arquivo GERADO por");
lines.push(" * `tools/gen-palette.mjs` a partir do `palette.ts` do protótipo —");
lines.push(" * nao editar a mao: rode o script e o diff mostra o que mudou.");
lines.push(" *");
lines.push(" * <p>Os degraus sao os ramps publicados do Tailwind v4 em oklch, convertidos");
lines.push(" * para sRGB com o mesmo arredondamento do mockup; o nome de cada amostra sai");
lines.push(" * do proprio oklch (palavra de matiz + tom), entao \"vermelho\" nunca aponta");
lines.push(" * para um rosa.");
lines.push(" */");
lines.push("public final class PaletteCatalog {");
lines.push("");
lines.push("    public static final int[] SCALE_STEPS = {50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950};");
lines.push("");
lines.push("    /** Uma familia de matiz: rotulo, 11 tons e o nome falado de cada tom. */");
lines.push("    public static final class Family {");
lines.push("        public final String id;");
lines.push("        public final String label;");
lines.push("        public final int[] steps;");
lines.push("        public final String[] names;");
lines.push("");
lines.push("        Family(String id, String label, int[] steps, String[] names) {");
lines.push("            this.id = id;");
lines.push("            this.label = label;");
lines.push("            this.steps = steps;");
lines.push("            this.names = names;");
lines.push("        }");
lines.push("");
lines.push("        public int base() {");
lines.push("            return steps[5];");
lines.push("        }");
lines.push("    }");
lines.push("");

steps.forEach((family, index) => {
  lines.push(`    private static final int[] ${family.id.toUpperCase()}_STEPS = {`);
  for (let i = 0; i < family.hex.length; i += 6) {
    lines.push("            " + family.hex.slice(i, i + 6).map(hexInt).join(", ") + ",");
  }
  lines.push("    };");
  lines.push(`    private static final String[] ${family.id.toUpperCase()}_NAMES = {`);
  for (let i = 0; i < family.labels.length; i += 5) {
    lines.push(
      "            " + family.labels.slice(i, i + 5).map((n) => javaStr(n)).join(", ") + ",",
    );
  }
  lines.push("    };");
  lines.push("");
});

lines.push("    /** As 18 familias, na ordem do mockup (matiz crescente, neutras no fim). */");
lines.push("    public static final Family[] FAMILIES = {");
for (const family of steps) {
  lines.push(
    `            new Family(${javaStr(family.id)}, ${javaStr(family.name)}, ` +
      `${family.id.toUpperCase()}_STEPS, ${family.id.toUpperCase()}_NAMES),`,
  );
}
lines.push("    };");
lines.push("");
lines.push("    /** As seis cores rapidas do dock compacto: uma de cada canto do espectro. */");
lines.push(
  "    public static final int[] QUICK = {" +
    quickIds.map((id) => hexInt(find(id).hex[5])).join(", ") +
    "};",
);
lines.push("");
lines.push("    /** As seis cores grandes da faixa 3-5. */");
lines.push(
  "    public static final int[] KIDS = {" +
    kidIds.map((id) => hexInt(find(id).hex[5])).join(", ") +
    "};",
);
lines.push("");
lines.push("    /** Branco, tres cinzas e preto: os neutros da bandeja. */");
lines.push("    public static final int[] NEUTRALS = {" + neutrals.map(hexInt).join(", ") + "};");
lines.push("    public static final String[] NEUTRAL_NAMES = {" +
  neutralLabels.map(javaStr).join(", ") + "};");
lines.push("");
lines.push("    /** Os 15 matizes de base, na ordem da barra de espectro. */");
lines.push("    public static final int[] SPECTRUM = {" + spectrum.map(hexInt).join(", ") + "};");
lines.push("");
lines.push("    private PaletteCatalog() {");
lines.push("    }");
lines.push("");
lines.push("    public static Family byId(String id) {");
lines.push("        for (Family family : FAMILIES) {");
lines.push("            if (family.id.equals(id)) {");
lines.push("                return family;");
lines.push("            }");
lines.push("        }");
lines.push("        return FAMILIES[0];");
lines.push("    }");
lines.push("");
lines.push("    /** Nome falado de uma cor do catalogo (fallback: \"cor\"). */");
lines.push("    public static String nameOf(int color) {");
lines.push("        for (Family family : FAMILIES) {");
lines.push("            for (int i = 0; i < family.steps.length; i++) {");
lines.push("                if (family.steps[i] == color) {");
lines.push("                    return family.names[i];");
lines.push("                }");
lines.push("            }");
lines.push("        }");
lines.push("        for (int i = 0; i < NEUTRALS.length; i++) {");
lines.push("            if (NEUTRALS[i] == color) {");
lines.push("                return NEUTRAL_NAMES[i];");
lines.push("            }");
lines.push("        }");
lines.push("        return \"cor\";");
lines.push("    }");
lines.push("");
lines.push("    /** Indice do degrau de uma cor dentro da familia, ou -1. */");
lines.push("    public static int stepOf(Family family, int color) {");
lines.push("        for (int i = 0; i < family.steps.length; i++) {");
lines.push("            if (family.steps[i] == color) {");
lines.push("                return i;");
lines.push("            }");
lines.push("        }");
lines.push("        return -1;");
lines.push("    }");
lines.push("}");

const target = join(root, "android", "app", "src", "main", "java", "com", "theomaria", "draw",
  "ui", "PaletteCatalog.java");
writeFileSync(target, lines.join("\n") + "\n", "utf8");
console.log(`PaletteCatalog.java: ${families.length} familias, ${spectrum.length} matizes`);
console.log(`  quick=${quickIds.join(",")} kids=${kidIds.join(",")}`);
console.log(`  total de amostras=${families.length * 11 + 2}`);
console.log(`  gravado em ${target}`);
