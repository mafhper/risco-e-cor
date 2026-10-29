// BANCADA DE TRAÇOS — superfície de DESENVOLVIMENTO, não é tela nem dado do app.
//
// Uma prancha de amostras para comparar MATERIAL com as pranchas de referência:
// uma linha por material que deposita pigmento, três traços por linha (tamanhos
// 4, 14 e 40), todos na mesma tinta quase-preta sobre o mesmo papel creme. Sem
// cor de propósito: o que precisa aparecer é a ESTRUTURA de cada meio (grão,
// veio, placa, véu, gota), e uma cor saturada esconde exatamente isso.
//
// O motor é o de verdade. Cada amostra é um `StrokeCommand` como o que a folha
// recebe — mesmo `brush`, mesmo `size`, pontos no espaçamento que um dedo
// produziria — e é pintada por `paintStrokes` através do `canvasSink`. Nenhum
// perfil é recalculado aqui e nenhuma tabela paralela existe: se um perfil
// mudar, a bancada muda junto, e é esse o ponto.
//
// Nada aqui lê store, histórico ou sessão: pintar é a única coisa que acontece,
// uma vez, quando a página monta.
import { canvasSink, paintStrokes, type RasterBrush, type StampSink } from "./brushCanvas";
import type { Point, StrokeCommand } from "./history";

/**
 * Os materiais da bancada, na ordem da prancha. A borracha fica de fora: ela
 * não deposita pigmento, então não há traço para comparar.
 */
export const BENCH_BRUSHES = [
  "pencil",
  "charcoal",
  "crayon",
  "marker",
  "ink",
  "brush",
  "watercolor",
  "oil",
  "spray",
] as const satisfies readonly RasterBrush[];

/** Os três tamanhos de cada linha: fino, médio e cheio. */
export const BENCH_SIZES = [4, 14, 40] as const;

/** A tinta única da prancha: quase-preta e neutra, sem matiz. */
export const BENCH_INK = "#1C1410";

/** O papel do app, o mesmo sob as amostras. */
export const BENCH_PAPER = "#F2ECE0";

/** O comprimento de cada traço, em unidades de arte (1 unidade = 1 CSS px). */
export const BENCH_LENGTH = 320;

/**
 * Distância entre os pontos que formam a linha. O motor COLAPSA pontos mais
 * próximos que `SPEED_FLOOR` (2 unidades) e, se todos caírem abaixo disso, o
 * traço vira um TOQUE — um único dab. 2,5 fica acima do piso, então todo ponto
 * sobrevive, e ainda é um dedo lento: a perda de velocidade no menor tamanho
 * (4) fica em ~7%, dentro da janela de 10% que o tamanho promete.
 */
export const BENCH_POINT_STEP = 2.5;

/** A prancha inteira, em CSS px. O buffer é este tamanho × devicePixelRatio. */
export const BENCH_WIDTH = 1400;
export const BENCH_HEIGHT = 760;

/** Margem externa da prancha. */
const PAD = 24;
/** Coluna dos rótulos, antes do primeiro traço. */
const LABEL_W = 92;
/** Respiro entre os três traços da mesma linha. */
const COLUMN_GAP = 96;
/** Margem vertical, dividida entre a primeira e a última linha. */
const ROW_PAD = 22;

/** Onde começa a coluna `column` (0..2) da prancha. */
export function benchStrokeX(column: number): number {
  return PAD + LABEL_W + column * (BENCH_LENGTH + COLUMN_GAP);
}

/** O eixo da linha `row` (0..8), no meio da sua faixa vertical. */
export function benchRowY(row: number): number {
  const usable = BENCH_HEIGHT - 2 * ROW_PAD;
  return ROW_PAD + (usable * (row + 0.5)) / BENCH_BRUSHES.length;
}

/** A linha de pontos de uma amostra: horizontal, reta, do começo ao fim. */
export function benchLine(x: number, y: number): Point[] {
  const points: Point[] = [];
  for (let at = 0; at < BENCH_LENGTH; at += BENCH_POINT_STEP) points.push([x + at, y]);
  // O último ponto é o fim EXATO: o traço mede BENCH_LENGTH em todos os casos.
  points.push([x + BENCH_LENGTH, y]);
  return points;
}

/**
 * Os 27 traços da prancha — 9 materiais × 3 tamanhos — prontos para o motor.
 *
 * O `id` é determinístico: o grão de cada amostra é o mesmo em toda abertura da
 * bancada e em toda captura, então duas pranchas são comparáveis pixel a pixel.
 */
export function benchStrokes(): StrokeCommand[] {
  return BENCH_BRUSHES.flatMap((brush, row) =>
    BENCH_SIZES.map((size, column) => ({
      t: "stroke" as const,
      id: `bench-${brush}-${size}`,
      color: BENCH_INK,
      size,
      brush,
      points: benchLine(benchStrokeX(column), benchRowY(row)),
    })),
  );
}

/**
 * O buffer em pixels de dispositivo. Um `devicePixelRatio` inválido (0, NaN) cai
 * em 1 em vez de gerar um canvas de tamanho zero.
 */
export function benchPixelSize(dpr: number): { width: number; height: number; scale: number } {
  const scale = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  return {
    width: Math.max(1, Math.round(BENCH_WIDTH * scale)),
    height: Math.max(1, Math.round(BENCH_HEIGHT * scale)),
    scale,
  };
}

/** Pinta as 27 amostras num destino qualquer. Devolve quantos dabs foram postos. */
export function paintBench(sink: StampSink): number {
  return paintStrokes(sink, benchStrokes());
}

/** A cor dos rótulos: papel escurecido, longe do preto da amostra. */
const LABEL_INK = "#6F645A";
/** Tamanho do rótulo, em CSS px — minúsculo por contrato: é orientação, não UI. */
const LABEL_SIZE = 11;

/**
 * A prancha completa num canvas 2d de verdade: papel, amostras, rótulos.
 *
 * O desenho é sempre COMPLETO (papel → amostras → rótulos), então pintar duas
 * vezes no mesmo canvas não acumula nada: a segunda passada cobre a primeira.
 */
export function paintBenchPage(ctx: CanvasRenderingContext2D, dpr = 1): number {
  const { width, height, scale } = benchPixelSize(dpr);

  // O papel é do tamanho do BUFFER, em pixels de dispositivo: sem transform.
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.fillStyle = BENCH_PAPER;
  ctx.fillRect(0, 0, width, height);

  // O motor: as mesmas unidades de arte da prancha, um pixel de dispositivo por
  // unidade × dpr. Nenhum perfil, alpha ou ordem é reimplementado aqui.
  const painted = paintStrokes(canvasSink(ctx, { x: 0, y: 0, scale }), benchStrokes());

  // Rótulos por último: em CSS px, com a tinta de papel. O motor deixou o
  // `globalAlpha` do último dab, então o estado é reafirmado antes do texto.
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = LABEL_INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${LABEL_SIZE}px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
  BENCH_BRUSHES.forEach((brush, row) => {
    ctx.fillText(brush, PAD, benchRowY(row));
  });
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return painted;
}

// ---------------------------------------------------------------------------
// A PRANCHA DO SPRAY — a mesma lata em três Intensidades
// ---------------------------------------------------------------------------
//
// A diagnose do dono (27/10) foi feita nesta bancada: "o spray sai como
// pontilhismo". A prancha dos nove materiais mostra a lata uma vez, no bico
// padrão (Intensidade 60%), e uma amostra só não deixa julgar um controle de
// três eixos. Esta prancha isola o eixo que o dono ia mexer primeiro: a mesma
// Ponta e a mesma Dispersão, três Intensidades, em dois tamanhos — o cheio (40)
// e o fino (14), que é onde o defeito aparece mais.
//
// Nada aqui recalcula perfil: são `StrokeCommand` de verdade, pintados por
// `paintStrokes` pelo `canvasSink`, como no papel.

/** As três Intensidades da prancha: o piso, o padrão da prateleira e o teto. */
export const SPRAY_BENCH_INTENSITIES = [0.2, 0.6, 1] as const;

/** O bico das três amostras: Ponta e Dispersão fixas, só a Intensidade muda. */
export const SPRAY_BENCH_NOZZLE = { tip: 0.1, spread: 0.55 } as const;

/** Os dois tamanhos de cada linha: o cheio e o fino. */
export const SPRAY_BENCH_SIZES = [40, 14] as const;

/** Comprimento de cada amostra, em unidades de arte. */
export const SPRAY_BENCH_LENGTH = 320;

/** A prancha inteira, em CSS px. */
export const SPRAY_BENCH_WIDTH = 1400;
export const SPRAY_BENCH_HEIGHT = 360;

/** Onde começa a coluna `column` (0 = tamanho 40, 1 = tamanho 14). */
export function sprayBenchX(column: number): number {
  return 220 + column * 600;
}

/** O eixo da linha `row` (0..2), no meio da sua faixa vertical. */
export function sprayBenchY(row: number): number {
  return (SPRAY_BENCH_HEIGHT * (row + 0.5)) / SPRAY_BENCH_INTENSITIES.length;
}

/** As seis amostras — três Intensidades × dois tamanhos — prontas para o motor. */
export function sprayBenchStrokes(): StrokeCommand[] {
  return SPRAY_BENCH_INTENSITIES.flatMap((intensity, row) =>
    SPRAY_BENCH_SIZES.map((size, column) => ({
      t: "stroke" as const,
      id: `spray-bench-${row}-${size}`,
      color: BENCH_INK,
      size,
      brush: "spray" as const,
      points: benchLine(sprayBenchX(column), sprayBenchY(row)),
      spray: { ...SPRAY_BENCH_NOZZLE, intensity },
    })),
  );
}

/** A prancha do spray num canvas 2d de verdade: papel, amostras, rótulos. */
export function paintSprayBenchPage(ctx: CanvasRenderingContext2D, dpr = 1): number {
  const scale = Number.isFinite(dpr) && dpr > 0 ? dpr : 1;
  const width = Math.max(1, Math.round(SPRAY_BENCH_WIDTH * scale));
  const height = Math.max(1, Math.round(SPRAY_BENCH_HEIGHT * scale));

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";
  ctx.fillStyle = BENCH_PAPER;
  ctx.fillRect(0, 0, width, height);

  const painted = paintStrokes(canvasSink(ctx, { x: 0, y: 0, scale }), sprayBenchStrokes());

  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = LABEL_INK;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${LABEL_SIZE}px "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`;
  SPRAY_BENCH_INTENSITIES.forEach((intensity, row) => {
    ctx.fillText(`Intensidade ${Math.round(intensity * 100)}%`, PAD, sprayBenchY(row));
  });
  // Os dois tamanhos, como cabeçalho das colunas: é o único eixo que muda entre
  // elas, e sem o rótulo a coluna fina pareceria a mesma amostra mais fraca.
  ctx.fillText("tamanho 40", sprayBenchX(0) - 60, PAD);
  ctx.fillText("tamanho 14", sprayBenchX(1) - 60, PAD);
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return painted;
}
