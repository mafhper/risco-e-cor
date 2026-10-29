// A bancada de traços, medida no seu único seam de interesse: a LISTA DE
// COMANDOS que ela entrega ao motor real.
//
// O grão de cada material não é testado aqui — o motor já tem a suíte dele
// (`brush-canvas`, `brush-ink`). O que esta bancada promete é outra coisa: uma
// linha por material na ordem da prancha, três traços por linha nos três
// tamanhos, um único preto sobre o papel do app, e pontos espaçados o bastante
// para o motor não ler o traço como um TOQUE. É isso que os testes abaixo
// fixam, com os números vindos do pedido (9 materiais, 4/14/40, 1400 × 760,
// 320 px, `#1C1410`, `#F2ECE0`) — nunca de uma conta que repete a implementação.
import { describe, expect, it } from "vitest";
import {
  BENCH_BRUSHES,
  BENCH_HEIGHT,
  BENCH_INK,
  BENCH_LENGTH,
  BENCH_PAPER,
  BENCH_SIZES,
  BENCH_WIDTH,
  SPRAY_BENCH_INTENSITIES,
  SPRAY_BENCH_LENGTH,
  SPRAY_BENCH_NOZZLE,
  SPRAY_BENCH_SIZES,
  benchLine,
  benchPixelSize,
  benchStrokes,
  paintBench,
  sprayBenchStrokes,
  sprayBenchX,
  sprayBenchY,
} from "@/mockup/strokeBench";
import { stampsOf, type Stamp } from "@/mockup/brushCanvas";
import type { StrokeCommand } from "@/mockup/history";

/** O piso de velocidade do motor: pontos mais próximos que isto são colapsados. */
const SPEED_FLOOR = 2;

const byRow = (): StrokeCommand[][] => {
  const rows: StrokeCommand[][] = BENCH_BRUSHES.map(() => []);
  for (const stroke of benchStrokes()) {
    const row = BENCH_BRUSHES.indexOf(stroke.brush as (typeof BENCH_BRUSHES)[number]);
    rows[row]!.push(stroke);
  }
  return rows;
};

describe("bancada de traços: a prancha", () => {
  it("tem uma linha por material de pintura, na ordem do pedido", () => {
    expect(BENCH_BRUSHES).toEqual([
      "pencil",
      "charcoal",
      "crayon",
      "marker",
      "ink",
      "brush",
      "watercolor",
      "oil",
      "spray",
    ]);
    // A borracha não deposita pigmento: não há amostra dela.
    expect(BENCH_BRUSHES).not.toContain("eraser");
  });

  it("pinta 27 amostras — três tamanhos em cada uma das nove linhas", () => {
    const strokes = benchStrokes();
    expect(strokes).toHaveLength(27);
    expect(new Set(strokes.map((s) => s.id)).size).toBe(27);
    for (const row of byRow()) {
      expect(row.map((s) => s.size)).toEqual([...BENCH_SIZES]);
    }
    expect(BENCH_SIZES).toEqual([4, 14, 40]);
  });

  it("usa a mesma tinta em todas as amostras, sobre o papel do app", () => {
    expect(BENCH_INK).toBe("#1C1410");
    expect(BENCH_PAPER).toBe("#F2ECE0");
    for (const stroke of benchStrokes()) expect(stroke.color).toBe(BENCH_INK);
  });

  it("desenha traços horizontais de 320 unidades, com pontos acima do piso", () => {
    expect(BENCH_LENGTH).toBe(320);
    for (const stroke of benchStrokes()) {
      const { points } = stroke;
      const [x0, y0] = points[0]!;
      const [x1, y1] = points[points.length - 1]!;
      expect(x1 - x0).toBeCloseTo(BENCH_LENGTH, 6);
      expect(y1).toBe(y0);
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1]!;
        const [bx, by] = points[i]!;
        // Um ponto mais perto que o piso seria descartado; se todos fossem, o
        // traço viraria um toque (um dab só), que é o defeito que se evita.
        expect(Math.hypot(bx - ax, by - ay)).toBeGreaterThanOrEqual(SPEED_FLOOR);
      }
    }
  });

  it("reserva um canvas de 1400 × 760 CSS px e aplica o devicePixelRatio", () => {
    expect(BENCH_WIDTH).toBe(1400);
    expect(BENCH_HEIGHT).toBe(760);
    expect(benchPixelSize(1)).toEqual({ width: 1400, height: 760, scale: 1 });
    expect(benchPixelSize(2)).toEqual({ width: 2800, height: 1520, scale: 2 });
    expect(benchPixelSize(3)).toEqual({ width: 4200, height: 2280, scale: 3 });
    // Um ambiente sem densidade declarada não pode zerar o buffer.
    expect(benchPixelSize(0).width).toBe(1400);
  });
});

describe("bancada de traços: o motor real", () => {
  const run = () => {
    const stamps: Array<Stamp & { color: string }> = [];
    const dabs = paintBench({
      ellipse: (stamp, color) => stamps.push({ ...stamp, color }),
    });
    return { stamps, dabs };
  };

  it("deposita as 27 amostras pela mesma tinta, com muitos dabs em cada", () => {
    const { stamps, dabs } = run();
    expect(dabs).toBeGreaterThan(0);
    expect(stamps).toHaveLength(dabs);
    expect(new Set(stamps.map((s) => s.color))).toEqual(new Set([BENCH_INK]));

    for (const stroke of benchStrokes()) {
      const [x0, y0] = stroke.points[0]!;
      const inSample = stamps.filter(
        (s) =>
          s.x >= x0 - stroke.size &&
          s.x <= x0 + BENCH_LENGTH + stroke.size &&
          Math.abs(s.y - y0) <= stroke.size,
      );
      // Um traço que virou toque teria 1 dab; a amostra real tem dezenas.
      expect(inSample.length, `${stroke.id} (${stroke.size})`).toBeGreaterThan(20);
    }
  });

  it("nunca pinta um dab opaco: a densidade é sobreposição", () => {
    const { stamps } = run();
    for (const stamp of stamps) {
      expect(stamp.alpha).toBeGreaterThanOrEqual(0.02);
      expect(stamp.alpha).toBeLessThanOrEqual(0.35);
    }
  });
});

describe("bancada do spray: a mesma lata em três Intensidades", () => {
  it("pinta seis amostras — três Intensidades × dois tamanhos", () => {
    const strokes = sprayBenchStrokes();
    expect(strokes).toHaveLength(6);
    expect(new Set(strokes.map((s) => s.id)).size).toBe(6);
    // Uma amostra por (Intensidade, tamanho), e só a Intensidade muda a cada
    // linha: Ponta e Dispersão são as mesmas em todas.
    for (const stroke of strokes) {
      expect(stroke.brush).toBe("spray");
      expect(stroke.color).toBe(BENCH_INK);
      expect(stroke.spray?.tip).toBe(SPRAY_BENCH_NOZZLE.tip);
      expect(stroke.spray?.spread).toBe(SPRAY_BENCH_NOZZLE.spread);
    }
    expect(strokes.map((s) => s.spray?.intensity)).toEqual([0.2, 0.2, 0.6, 0.6, 1, 1]);
    expect(strokes.map((s) => s.size)).toEqual([40, 14, 40, 14, 40, 14]);
    expect(SPRAY_BENCH_INTENSITIES).toEqual([0.2, 0.6, 1]);
    expect(SPRAY_BENCH_SIZES).toEqual([40, 14]);
  });

  it("entrega ao motor um traço de verdade, com pontos acima do piso", () => {
    sprayBenchStrokes().forEach((stroke, index) => {
      const { points } = stroke;
      const [x0, y0] = points[0]!;
      const [x1] = points[points.length - 1]!;
      expect(x1 - x0).toBeCloseTo(SPRAY_BENCH_LENGTH, 6);
      for (let i = 1; i < points.length; i++) {
        const [ax, ay] = points[i - 1]!;
        const [bx, by] = points[i]!;
        expect(Math.hypot(bx - ax, by - ay)).toBeGreaterThanOrEqual(SPEED_FLOOR);
      }
      // Cada amostra mora no eixo da SUA linha (duas por linha: 40 e 14).
      expect(y0).toBe(sprayBenchY(Math.floor(index / 2)));
    });
  });

  it("deposita mais com mais Intensidade, no mesmo tamanho", () => {
    // O eixo que a prancha isola: mais Intensidade é mais gota e mais véu, com a
    // mesma nuvem. A contagem vem de `stampsOf`, o mesmo fluxo que o papel usa.
    const count = (intensity: number) =>
      stampsOf({
        id: `spray-bench-${intensity}-40`,
        size: 40,
        brush: "spray",
        points: benchLine(sprayBenchX(0), sprayBenchY(0)),
        spray: { ...SPRAY_BENCH_NOZZLE, intensity },
      }).length;
    expect(count(1)).toBeGreaterThan(count(0.6));
    expect(count(0.6)).toBeGreaterThan(count(0.2));
  });
});
