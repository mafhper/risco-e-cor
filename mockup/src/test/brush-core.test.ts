// O CORPO do traço — o depósito que o olho lê como banda.
//
// SEAM: `stampsOf(stroke)`, o mesmo fluxo puro e determinístico que o papel, as
// miniaturas e o PNG repetem. A diferença para `brush-canvas.test` é a UNIDADE
// da leitura: aqui os carimbos são COMPOSTOS (source-over, um alfa por carimbo)
// numa grade de cobertura, então as asserções falam do que o olho vê — quanto da
// banda pedida está de fato coberto — e não da forma de um dab isolado.
//
// Por que este arquivo existe (medido em 27/10): os cinco materiais de textura
// depositavam uma NUVEM. O leito espalhava um dab por passo por ±0,4 do tamanho,
// e a partícula tem metade de ~0,1: no meio da faixa, menos de um carimbo cobria
// um ponto e a soma de alfa ficava em ~0,06. Faltava o núcleo contínuo por baixo
// da textura (pranchas de referencia do dono, `tecnica.md`).
//
// O piso de cada material vem da prancha, não da implementação: grafite lê uma
// linha clara e contínua, carvão um corpo roto quase preto, giz uma banda sólida
// que falha em grumos, aquarela uma mancha translúcida e o óleo uma banda opaca.
import { describe, expect, it } from "vitest";
import { stampsOf, type RasterBrush, type Stamp } from "@/mockup/brushCanvas";
import type { Point } from "@/mockup/history";

/** Uma linha horizontal de referência: a tangente é 0, então `y` é o eixo do traço. */
const line = (from: number, to: number, step: number, y = 100): Point[] => {
  const points: Point[] = [];
  for (let x = from; x <= to + 0.001; x += step) points.push([x, y]);
  return points;
};

const AXIS = 100;
const LENGTH = 300;
/** Lado da célula da grade de cobertura, em unidades de arte. */
const CELL = 0.5;

const strokeOf = (brush: RasterBrush, size: number, id = "body", step = 6) => ({
  id,
  size,
  points: line(0, LENGTH, step),
  brush,
});

/** A elipse do carimbo (ou a caixa do marcador) contém o ponto? */
function inside(stamp: Stamp, x: number, y: number): boolean {
  const dx = x - stamp.x;
  const dy = y - stamp.y;
  const cos = Math.cos(-stamp.rot);
  const sin = Math.sin(-stamp.rot);
  const u = dx * cos - dy * sin;
  const v = dx * sin + dy * cos;
  return stamp.square
    ? Math.abs(u) <= stamp.rx && Math.abs(v) <= stamp.ry
    : (u / stamp.rx) ** 2 + (v / stamp.ry) ** 2 <= 1;
}

/**
 * Densidade ótica média dentro da banda pedida: a massa de pigmento dividida
 * pela área do retângulo `LENGTH × size`. É a leitura de "a banda está cheia?" —
 * uma nuvem de partículas num leito largo rende ~0,05, uma banda coberta ≥ 0,7.
 */
function mass(stamps: readonly Stamp[], size: number, cell = 0.5): number {
  const grid = new Map<number, number>();
  for (const stamp of stamps) {
    const reach = Math.max(stamp.rx, stamp.ry) + cell;
    const x0 = Math.floor((stamp.x - reach) / cell);
    const x1 = Math.ceil((stamp.x + reach) / cell);
    const y0 = Math.floor((stamp.y - reach) / cell);
    const y1 = Math.ceil((stamp.y + reach) / cell);
    for (let ix = x0; ix <= x1; ix++) {
      for (let iy = y0; iy <= y1; iy++) {
        const x = (ix + 0.5) * cell;
        const y = (iy + 0.5) * cell;
        if (!inside(stamp, x, y)) continue;
        const key = ix * 100000 + iy;
        grid.set(key, 1 - (1 - (grid.get(key) ?? 0)) * (1 - stamp.alpha));
      }
    }
  }
  const half = size / 2;
  let sum = 0;
  let cells = 0;
  for (let ix = 0; ix < LENGTH / cell; ix++) {
    for (let iy = Math.floor((AXIS - half) / cell); iy < Math.ceil((AXIS + half) / cell); iy++) {
      sum += grid.get(ix * 100000 + iy) ?? 0;
      cells++;
    }
  }
  return sum / cells;
}

/** Cobertura no eixo do traço, no trecho do meio (as pontas afinam por contrato). */
function spine(stamps: readonly Stamp[]): number[] {
  // 60..240 de 300: dentro do corpo em todos os tamanhos (a rampa mede no
  // máximo 15% do comprimento de cada lado) e largo o bastante para a média de
  // um material que falha em grumos não depender de onde caíram os grumos.
  return Array.from({ length: 60 }, (_, i) => {
    const x = 60 + i * 3;
    let a = 0;
    for (const stamp of stamps) {
      if (!inside(stamp, x, AXIS)) continue;
      a = 1 - (1 - a) * (1 - stamp.alpha);
    }
    return a;
  });
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]!;

/**
 * Quantos carimbos cobrem, em média, um ponto do eixo. É o número que explicava a
 * nuvem: abaixo de 1, o "traço" é uma sequência de acertos isolados.
 */
function hits(stamps: readonly Stamp[]): number {
  const xs = Array.from({ length: 60 }, (_, i) => 60 + i * 3);
  return (
    xs.reduce((acc, x) => acc + stamps.filter((stamp) => inside(stamp, x, AXIS)).length, 0) /
    xs.length
  );
}

/**
 * Piso de cobertura no eixo, por material, lido da prancha do dono: grafite é a
 * linha contínua e CLARA (o mais baixo dos opacos), carvão e giz são quase
 * pretos, o óleo é a banda mais opaca e a aquarela é véu por definição.
 */
const FLOOR: Partial<Record<RasterBrush, number>> = {
  pencil: 0.55,
  charcoal: 0.65,
  crayon: 0.75,
  watercolor: 0.35,
  oil: 0.8,
};

const table = ["pencil", "charcoal", "crayon", "watercolor", "oil"] as const;

describe("brush core: the textured five deposit a body, not a cloud", () => {
  it("reads the deposit at the seam and reports it", () => {
    const rows: string[] = [];
    for (const brush of [...table, "brush", "marker", "ink"] as RasterBrush[]) {
      for (const size of [12, 40]) {
        const stamps = stampsOf(strokeOf(brush, size, `body-${size}`));
        rows.push(
          `${brush}@${size}: dabs=${stamps.length} eixo=${mean(spine(stamps)).toFixed(3)} ` +
            `massa=${mass(stamps, size).toFixed(3)} toques=${hits(stamps).toFixed(2)}`,
        );
      }
    }
    console.log(rows.join("\n"));
    expect(rows.length).toBe(16);
  });

  it("closes the band at every size and every hand, for the five textured media", () => {
    for (const brush of table) {
      for (const size of [12, 40]) {
        for (const step of [6, 2]) {
          const stamps = stampsOf(strokeOf(brush, size, `floor-${size}-${step}`, step));
          const cover = mean(spine(stamps));
          expect(
            cover,
            `${brush}@${size} passo ${step}: eixo ${cover.toFixed(3)} (piso ${FLOOR[brush]})`,
          ).toBeGreaterThanOrEqual(FLOOR[brush]!);
        }
      }
    }
  });

  it("fills the authored band with pigment instead of speckling it", () => {
    for (const brush of table) {
      const stamps = stampsOf(strokeOf(brush, 40, "fill"));
      const density = mass(stamps, 40);
      expect(density, `${brush}: massa ${density.toFixed(3)}`).toBeGreaterThanOrEqual(
        FLOOR[brush]! * 0.7,
      );
    }
  });

  it("orders the bodies the way the plate does", () => {
    // véu translúcido < grafite claro < giz e carvão (quase pretos) ≤ óleo opaco
    const cover = (brush: RasterBrush) => mean(spine(stampsOf(strokeOf(brush, 40, "order"))));
    expect(cover("watercolor")).toBeLessThan(cover("pencil"));
    expect(cover("pencil")).toBeLessThan(cover("crayon"));
    expect(cover("crayon")).toBeLessThanOrEqual(cover("oil"));
  });

  it("keeps the texture on top of the body, reaching past it", () => {
    // O núcleo é o CORPO: ele não pode ser a coisa mais larga do traço, senão a
    // textura vira decoração interna. A poeira/o leito continuam sendo a borda.
    for (const brush of table) {
      const stamps = stampsOf(strokeOf(brush, 40, "edge"));
      const core = stamps.filter((s) => s.core === true);
      expect(core.length, brush).toBeGreaterThan(0);
      const grain = stamps.filter((s) => s.core !== true);
      const coreHalf = Math.max(...core.map((s) => s.ry));
      const grainEdge = Math.max(...grain.map((s) => Math.abs(s.y - AXIS) + s.ry));
      expect(grainEdge, `${brush}: textura ${grainEdge.toFixed(2)}`).toBeGreaterThan(coreHalf);
    }
  });

  it("gives the broken media holes inside the body", () => {
    // Carvão e giz FALHAM em grumos (tecnica.md): o corpo tem buracos claros.
    // O lápis não — ele é a linha contínua.
    const samples = (brush: RasterBrush) =>
      [...spine(stampsOf(strokeOf(brush, 40, "holes")))].sort((a, b) => a - b);
    const crayon = samples("crayon");
    const charcoal = samples("charcoal");
    const pencil = samples("pencil");
    // O mais claro de vinte: nos roto, cai abaixo do corpo; no lápis, não.
    expect(crayon[Math.floor(crayon.length * 0.05)]!).toBeLessThan(FLOOR.crayon!);
    expect(charcoal[Math.floor(charcoal.length * 0.05)]!).toBeLessThan(FLOOR.charcoal!);
    expect(pencil[Math.floor(pencil.length * 0.05)]!).toBeGreaterThan(FLOOR.pencil! * 0.8);
  });
});

describe("brush core: the deposit does not repeat at the step", () => {
  // The bench at 40× counted the stamps: the body was a chain of ellipses and
  // every seam of the chain showed on the border, at the step's own interval — a
  // comb the plates never have. This is the measurement of that defect, and the
  // reason it reads the BORDER instead of the interior: ±6% of a dab's width is a
  // 1% change of the band's mean density (an eye cannot see it) and a 12% change
  // of its contour (an eye counts it at once).

  /** The upper contour per column: how high the painted band reaches at that x. */
  function edge(stamps: readonly Stamp[], size: number, from: number, to: number): number[] {
    const half = size * 0.9;
    const buckets = new Map<number, Stamp[]>();
    for (const stamp of stamps) {
      const reach = Math.max(stamp.rx, stamp.ry) + 1;
      for (let bx = Math.floor(stamp.x - reach); bx <= Math.ceil(stamp.x + reach); bx++) {
        const list = buckets.get(bx);
        if (list) list.push(stamp);
        else buckets.set(bx, [stamp]);
      }
    }
    const out: number[] = [];
    for (let x = from; x <= to; x += CELL) {
      const near = buckets.get(Math.floor(x)) ?? [];
      let top = 0;
      for (let y = AXIS - half; y <= AXIS + half; y += CELL) {
        let alpha = 0;
        for (const stamp of near) {
          if (!inside(stamp, x, y)) continue;
          alpha = 1 - (1 - alpha) * (1 - stamp.alpha);
        }
        if (alpha >= 0.5) top = Math.max(top, AXIS - y);
      }
      out.push(top);
    }
    return out;
  }

  /**
   * The strongest single spatial period of the border, as a percentage of the
   * band's half-width, searched from 1.5 units (below the finest step in the
   * table) to 10 (above the coarsest one at the reference size). A comb shows up
   * as a narrow peak at the step; a hand and a grain never do.
   */
  function seam(stamps: readonly Stamp[], size: number): number {
    const profile = edge(stamps, size, 40, 280);
    const radius = Math.round(30 / CELL);
    const base = profile.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let j = i - radius; j <= i + radius; j++) {
        if (j < 0 || j >= profile.length) continue;
        sum += profile[j]!;
        n++;
      }
      return sum / n;
    });
    const residual = profile.map((value, i) => value - base[i]!);
    const level = mean(base);
    const n = residual.length;
    let peak = 0;
    for (let k = Math.ceil(n / (10 / CELL)); k <= Math.floor(n / (1.5 / CELL)); k++) {
      let re = 0;
      let im = 0;
      for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * k * i) / n;
        re += residual[i]! * Math.cos(angle);
        im += residual[i]! * Math.sin(angle);
      }
      peak = Math.max(peak, (2 * Math.hypot(re, im)) / n);
    }
    return (peak / level) * 100;
  }

  it("reads the comb the plate showed, when one is planted there", () => {
    // The instrument's own check: the SAME grid the engine used to lay down, a
    // chain of ellipses 2.5 steps long, one per step, at the step's interval. It
    // has to read as a comb — otherwise a green assertion below would only mean
    // the ruler cannot see.
    const grid: Stamp[] = Array.from({ length: 130 }, (_, i) => ({
      x: i * 2.4,
      y: AXIS,
      rx: 2.4 * 2.5,
      ry: 40 * 0.48,
      rot: 0,
      alpha: 0.19,
      core: true,
    }));
    expect(seam(grid, 40), "the ruler sees a chain of dabs").toBeGreaterThan(8);
  });

  it("leaves no period at the step in the eight bands", () => {
    // The can is out: a cloud's contour is quantised to droplets (a drop either
    // reaches a column or it does not), so a spectrum of it measures the drops,
    // not a seam. Its own band is the nozzle's and is proven in the can's suite.
    for (const brush of [
      "pencil",
      "charcoal",
      "crayon",
      "marker",
      "ink",
      "brush",
      "watercolor",
      "oil",
    ] as RasterBrush[]) {
      const value = seam(stampsOf(strokeOf(brush, 40, `seam-${brush}`)), 40);
      expect(value, `${brush}: ${value.toFixed(2)}% of the border`).toBeLessThan(3);
    }
  });
});

describe("brush core: the can concentrates, it does not spread evenly", () => {
  const cloudOf = (id: string) =>
    stampsOf({ id, size: 40, points: line(0, LENGTH, 4), brush: "spray" });
  /**
   * The DROPS only. The can throws two populations (`MIST_EVERY`): droplets,
   * which are the grain the nozzle sizes, and VEILS — wide, very faint puffs
   * that sit under them so the mark reads as aerosol instead of as dots. Every
   * statement below is about the droplets (`brush-seco-e-spray` §3: "o bico é a
   * única fonte de raio da lata"), so the veils are dropped exactly like the
   * `core` dabs of the dry five are dropped from the grain's readings.
   */
  const cloud = (id: string) => cloudOf(id).filter((s) => s.soft !== "mist");
  const veils = (id: string) => cloudOf(id).filter((s) => s.soft === "mist");

  it("keeps the cloud made of drops only, sized by the nozzle", () => {
    // O bico é a única fonte de raio da lata (§3): um "grão" de 0,18 × tamanho
    // jogado ao acaso é o blob grande no meio das gotas.
    const widest = Math.max(...cloud("can-only").map((s) => s.rx));
    // Ponta 0,10 com o multiplicador do bico (0,5..1,4) fica em 0,14 × tamanho.
    expect(widest / 40).toBeLessThan(0.15);
  });

  it("throws a veil under the drops: wide, rarer and far fainter", () => {
    const drops = cloud("can-veil");
    const mist = veils("can-veil");
    expect(mist.length).toBeGreaterThan(0);
    // The haze is a SECOND population, never a second cloud: a small share of
    // the marks and a fraction of their deposit.
    expect(mist.length).toBeLessThan(drops.length / 3);
    const widestDrop = Math.max(...drops.map((s) => s.rx));
    expect(Math.min(...mist.map((s) => s.rx))).toBeGreaterThan(widestDrop);
    expect(median(mist.map((s) => s.alpha))).toBeLessThan(median(drops.map((s) => s.alpha)) * 0.5);
    // …and it rides the cone, not a ring around it: a veil at the rim would
    // paint a border on a cloud whose rim is the fine part.
    const reach = Math.max(...cloud("can-veil").map((s) => Math.abs(s.y - AXIS)));
    expect(Math.max(...mist.map((s) => Math.abs(s.y - AXIS)))).toBeLessThan(reach);
  });

  it("piles the drops toward the axis instead of filling the cone", () => {
    // Semente uniforme daria mediana |desvio| = metade do alcance; o bico
    // concentrado puxa a mediana para perto de um terço.
    const stamps = cloud("can-middle");
    const reach = Math.max(...stamps.map((s) => Math.abs(s.y - AXIS)));
    const mid = median(stamps.map((s) => Math.abs(s.y - AXIS)));
    expect(mid / reach, `mediana ${(mid / reach).toFixed(3)} do alcance`).toBeLessThan(0.42);
  });

  it("throws smaller droplets at the rim", () => {
    const stamps = [...cloud("can-size")].sort(
      (a, b) => Math.abs(a.y - AXIS) - Math.abs(b.y - AXIS),
    );
    const cut = Math.floor(stamps.length / 4);
    expect(median(stamps.slice(-cut).map((s) => s.rx))).toBeLessThan(
      median(stamps.slice(0, cut).map((s) => s.rx)) * 0.85,
    );
  });
});
