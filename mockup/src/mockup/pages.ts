// Line-art pages for the "Colorir" mode. Each region is a closed SVG path;
// regions are listed back-to-front (the last one is on top). Regions are
// defined up front (as the content pipeline would pre-compute them), so a
// tap can never "leak" into another area.

export type Region = { id: string; d: string };
export type ColoringPage = {
  id: string;
  theme: ThemeId;
  name: string;
  regions: Region[];
  /** Outline-only details (no fill), drawn on top. */
  details?: string[];
};
export type ThemeId = "animais" | "familia" | "festas" | "espaco" | "natureza";

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: "animais", label: "Animais" },
  { id: "familia", label: "Família" },
  { id: "festas", label: "Festas" },
  { id: "espaco", label: "Espaço" },
  { id: "natureza", label: "Natureza" },
];

const r = (x: number, y: number, w: number, h: number, rad = 0) =>
  rad
    ? `M${x + rad} ${y} H${x + w - rad} Q${x + w} ${y} ${x + w} ${y + rad} V${y + h - rad} Q${x + w} ${y + h} ${x + w - rad} ${y + h} H${x + rad} Q${x} ${y + h} ${x} ${y + h - rad} V${y + rad} Q${x} ${y} ${x + rad} ${y} Z`
    : `M${x} ${y} H${x + w} V${y + h} H${x} Z`;
const e = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
const poly = (...pts: number[]) => {
  let d = `M${pts[0]} ${pts[1]}`;
  for (let i = 2; i < pts.length; i += 2) d += ` L${pts[i]} ${pts[i + 1]}`;
  return d + " Z";
};
const star = (cx: number, cy: number, R: number, ri = R * 0.45) => {
  const p: number[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? R : ri;
    p.push(+(cx + Math.cos(a) * rad).toFixed(1), +(cy + Math.sin(a) * rad).toFixed(1));
  }
  return poly(...p);
};

export const BG = r(0, 0, 300, 300);

export const PAGES: ColoringPage[] = [
  {
    id: "peixe",
    theme: "animais",
    name: "Peixe",
    regions: [
      { id: "mar", d: BG },
      { id: "areia", d: "M0 250 Q75 232 150 248 T300 244 V300 H0 Z" },
      { id: "alga1", d: "M40 250 Q20 210 42 180 Q62 150 44 120 Q70 150 58 185 Q48 215 62 248 Z" },
      {
        id: "alga2",
        d: "M250 246 Q236 214 252 190 Q268 166 256 140 Q280 168 270 196 Q262 222 272 244 Z",
      },
      { id: "cauda", d: poly(208, 150, 262, 108, 252, 150, 262, 192) },
      { id: "nadadeira", d: "M120 104 Q150 62 192 96 Z" },
      { id: "corpo", d: e(150, 150, 70, 48) },
      {
        id: "listra",
        d: "M150 103 Q168 150 150 197 Q138 197 132 194 Q148 150 134 106 Q142 103 150 103 Z",
      },
      { id: "olho", d: e(112, 140, 13) },
      { id: "pupila", d: e(108, 140, 6) },
      { id: "bolha1", d: e(70, 92, 10) },
      { id: "bolha2", d: e(56, 62, 7) },
      { id: "bolha3", d: e(74, 38, 5) },
    ],
    details: ["M92 168 Q104 176 116 168", "M168 170 Q182 150 172 130"],
  },
  {
    id: "gato",
    theme: "animais",
    name: "Gato",
    regions: [
      { id: "fundo", d: BG },
      { id: "chao", d: r(0, 240, 300, 60) },
      {
        id: "rabo",
        d: "M196 236 Q260 230 252 170 Q250 150 236 152 Q232 170 236 190 Q234 214 192 216 Z",
      },
      { id: "corpo", d: e(150, 206, 62, 46) },
      { id: "orelhaE", d: poly(100, 96, 106, 44, 140, 78) },
      { id: "orelhaD", d: poly(200, 96, 194, 44, 160, 78) },
      { id: "cabeca", d: e(150, 118, 58, 50) },
      { id: "barriga", d: e(150, 214, 30, 28) },
      { id: "olhoE", d: e(128, 112, 10, 12) },
      { id: "olhoD", d: e(172, 112, 10, 12) },
      { id: "nariz", d: poly(144, 132, 156, 132, 150, 140) },
      { id: "pataE", d: e(122, 248, 16, 10) },
      { id: "pataD", d: e(178, 248, 16, 10) },
    ],
    details: [
      "M150 140 Q140 152 130 146",
      "M150 140 Q160 152 170 146",
      "M118 136 L86 130",
      "M118 142 L88 146",
      "M182 136 L214 130",
      "M182 142 L212 146",
    ],
  },
  {
    id: "casa",
    theme: "familia",
    name: "Casa",
    regions: [
      { id: "ceu", d: BG },
      { id: "grama", d: "M0 232 Q150 214 300 232 V300 H0 Z" },
      { id: "sol", d: e(246, 56, 26) },
      { id: "nuvem", d: "M40 76 Q42 56 62 58 Q72 40 92 50 Q110 44 114 62 Q130 66 124 80 Z" },
      { id: "chamine", d: r(184, 82, 22, 46) },
      { id: "telhado", d: poly(70, 140, 150, 72, 230, 140) },
      { id: "parede", d: r(84, 140, 132, 102) },
      { id: "porta", d: r(134, 182, 34, 60, 6) },
      { id: "janelaE", d: r(98, 158, 28, 28, 4) },
      { id: "janelaD", d: r(176, 158, 28, 28, 4) },
      { id: "caminho", d: "M134 242 H168 L186 300 H116 Z" },
    ],
    details: ["M112 158 V186", "M98 172 H126", "M190 158 V186", "M176 172 H204"],
  },
  {
    id: "bolo",
    theme: "festas",
    name: "Bolo",
    regions: [
      { id: "fundo", d: BG },
      { id: "prato", d: e(150, 248, 110, 18) },
      { id: "andar1", d: r(60, 178, 180, 66, 10) },
      { id: "andar2", d: r(90, 124, 120, 56, 10) },
      {
        id: "cobertura",
        d: "M90 134 Q90 124 100 124 H200 Q210 124 210 134 Q200 150 190 136 Q180 152 170 136 Q160 152 150 136 Q140 152 130 136 Q120 152 110 136 Q100 150 90 134 Z",
      },
      { id: "vela1", d: r(110, 86, 12, 38, 3) },
      { id: "vela2", d: r(144, 78, 12, 46, 3) },
      { id: "vela3", d: r(178, 86, 12, 38, 3) },
      { id: "chama1", d: "M116 82 Q106 70 116 56 Q126 70 116 82 Z" },
      { id: "chama2", d: "M150 74 Q140 62 150 48 Q160 62 150 74 Z" },
      { id: "chama3", d: "M184 82 Q174 70 184 56 Q194 70 184 82 Z" },
      { id: "balao", d: e(46, 70, 22, 28) },
      { id: "estrela", d: star(256, 64, 22) },
    ],
    details: ["M46 98 Q40 130 50 160", "M74 210 H226"],
  },
  {
    id: "foguete",
    theme: "espaco",
    name: "Foguete",
    regions: [
      { id: "espaco", d: BG },
      { id: "planeta", d: e(66, 236, 40) },
      { id: "anel", d: "M14 248 Q66 210 120 222 Q124 230 118 232 Q66 222 20 256 Q12 254 14 248 Z" },
      { id: "fogo", d: "M132 222 Q150 290 168 222 Z" },
      { id: "asaE", d: poly(122, 160, 96, 214, 124, 210) },
      { id: "asaD", d: poly(178, 160, 204, 214, 176, 210) },
      { id: "corpo", d: "M150 40 Q190 90 180 216 H120 Q110 90 150 40 Z" },
      { id: "ponta", d: "M150 40 Q168 60 174 82 H126 Q132 60 150 40 Z" },
      { id: "janela", d: e(150, 124, 16) },
      { id: "estrela1", d: star(240, 60, 16) },
      { id: "estrela2", d: star(56, 70, 11) },
      { id: "estrela3", d: star(250, 190, 10) },
      { id: "lua", d: "M240 120 A22 22 0 1 0 262 150 A16 16 0 1 1 240 120 Z" },
    ],
    details: ["M126 170 H174"],
  },
  {
    id: "flor",
    theme: "natureza",
    name: "Flor",
    regions: [
      { id: "fundo", d: BG },
      { id: "caule", d: r(144, 140, 12, 106, 4) },
      { id: "folhaE", d: "M144 208 Q104 210 94 180 Q130 176 144 196 Z" },
      { id: "folhaD", d: "M156 188 Q196 190 206 160 Q170 156 156 176 Z" },
      { id: "petala1", d: e(150, 70, 22) },
      { id: "petala2", d: e(184, 92, 22) },
      { id: "petala3", d: e(176, 130, 22) },
      { id: "petala4", d: e(124, 130, 22) },
      { id: "petala5", d: e(116, 92, 22) },
      { id: "miolo", d: e(150, 104, 22) },
      { id: "vaso", d: poly(104, 236, 196, 236, 184, 290, 116, 290) },
      { id: "borda", d: r(98, 228, 104, 16, 4) },
      {
        id: "borboleta",
        d: "M244 60 Q226 40 222 62 Q226 78 244 66 Q262 78 266 62 Q262 40 244 60 Z",
      },
    ],
  },
];

export const pageById = (id: string | null | undefined) => PAGES.find((p) => p.id === id);
