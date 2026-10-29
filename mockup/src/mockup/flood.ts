// A varredura do balde: a área que o desenho do usuário FECHA.
//
// O buffer deste módulo é cobertura de tinta, não a foto da tela. Alfa 0 é
// papel — o canvas do app é transparente e quem pinta o branco é a camada
// CSS/SVG atrás dele — e alfa >= 128 é traço. Por isso a barreira é uma fração
// de ALFA em qualquer cor: o que fecha a área é a tinta, não o matiz, e o
// antialiasing de 20/255 continua pintável. A borda do buffer é barreira
// também: o flood é recortado ao papel e nunca dá a volta na folha.
//
// Scanline, não BFS por pixel: cada span é expandido até a barreira da linha e
// só os trechos AINDA NÃO preenchidos das linhas vizinhas viram semente. Numa
// folha de 2048² (4,2 M px) a pilha de um pixel por pixel é o caso patológico
// que a spec proíbe; aqui o trabalho é linear no número de pixels considerados.
//
// Determinismo é requisito, não enfeite: undo/redo e export re-executam a lista
// de comandos, então a mesma semente tem de dar o mesmo resultado e o mesmo
// hash. Não há aleatoriedade, a ordem da pilha é fixa e os spans saem ordenados
// por linha e por x0 — quem consome não precisa ordenar, e dois replays dão o
// mesmo JSON.

/** Cobertura (0..255) a partir da qual o pixel é tinta: 0,5 de 255 arredonda em 128. */
const BARRIER_ALPHA = 128;

/**
 * Máscara ausente vira array vazio: "sem máscara" e "máscara curta" caem no
 * mesmo caso (índice fora do array = 0 = passável), e assim o caminho quente da
 * varredura não carrega `undefined`.
 */
const NO_MASK: Uint8Array = new Uint8Array(0);

/** Basta ser estruturalmente um ImageData: o snapshot do navegador entra sem cópia. */
export type PixelBuffer = { width: number; height: number; data: Uint8ClampedArray };

/** Um trecho horizontal já preenchido. `x1` é INCLUSIVO. */
export type Span = { y: number; x0: number; x1: number };

export type FloodOptions = {
  /** Cor-semente lida do buffer (o que o usuário tocou). */
  seed: { r: number; g: number; b: number; a: number };
  /** Distância máxima por canal para um pixel contar como "mesma cor". */
  tolerance: number;
  /** Teto de área: a varredura PARA ao atingi-lo (não termina). 0/undefined = sem teto. */
  maxArea?: number;
  /**
   * Máscara opcional w*h: `!= 0` é impassável, independente do alfa. É como o
   * chamador distingue traço de preenchimento — sem ela, só o alfa decide.
   */
  barrier?: Uint8Array;
};

export type FloodResult = {
  spans: Span[];
  /** Pixels que a varredura considerou. */
  area: number;
  /** true quando parou no teto em vez de terminar. */
  capped: boolean;
};

/**
 * Varre a área 4-conexa que contém `(x, y)`, comparando cada pixel com a cor da
 * SEMENTE (nunca com o vizinho: vizinho escorrega por degradê e vaza).
 *
 * A tolerância não abre barreira: alfa de tinta reprova em qualquer valor, e um
 * vão de 2 px vaza por definição — o balde não conserta arte, o pipeline de
 * contorno é que fecha o desenho.
 */
export function floodScanline(
  buf: PixelBuffer,
  x: number,
  y: number,
  opts: FloodOptions,
): FloodResult {
  const { width: w, height: h, data } = buf;
  const none: FloodResult = { spans: [], area: 0, capped: false };

  // Semente fora do papel (ou folha vazia) não tem área: é o recorte da borda.
  if (w <= 0 || h <= 0 || x < 0 || y < 0 || x >= w || y >= h) return none;

  // A máscara do chamador é o que separa traço de preenchimento: os dois são
  // opacos, e só ela diz qual opaco é parede. Lida por PIXEL (y*w+x), nunca por
  // byte — o buffer é RGBA e a máscara tem um byte por pixel. Máscara curta (ou
  // ausente) é "sem marca" no que falta: o balde prefere pintar a derrubar o
  // comando por um buffer de tamanho errado, e a barreira de alfa continua
  // segurando o caso degenerado.
  const barrier: Uint8Array = opts.barrier ?? NO_MASK;
  const blocked = (i: number): boolean => {
    const px = i >> 2;
    return px < barrier.length && (barrier[px] ?? 0) !== 0;
  };
  /** A máscara TEM opinião sobre este pixel? Fora dela não tem, e o alfa decide. */
  const maskCovers = (i: number): boolean => i >> 2 < barrier.length;

  const seedIndex = (y * w + x) * 4;
  // Pixel mascarado na semente é o MESMO no-op do toque sobre traço: a máscara
  // é a opinião do chamador sobre onde tem tinta, e ela pode saber mais que o
  // alfa deste buffer — é o caso da área já preenchida, que o alfa só vê como
  // parede.
  if (blocked(seedIndex)) return none;
  // Toque sobre traço não pinta: ninguém preenche por cima da linha. Vale só
  // onde a máscara não opina; onde ela opina, quem decide é ela (ver acima).
  if (!maskCovers(seedIndex) && (data[seedIndex + 3] ?? 0) >= BARRIER_ALPHA) return none;

  const tolerance = Math.max(0, opts.tolerance);
  const { seed } = opts;
  const maxArea = opts.maxArea ?? 0;

  /**
   * O pixel entra na área? A máscara vem PRIMEIRO — é a regra mais forte, e é
   * ela que permite repintar uma área que o alfa já marcou como tinta.
   */
  const admitted = (i: number): boolean => {
    if (blocked(i)) return false;
    const a = data[i + 3] ?? 0;
    // Onde a máscara opina, o alfa não barra: ela é a opinião do chamador sobre
    // o que é parede, e sem isso repintar uma área já preenchida seria no-op.
    if (!maskCovers(i) && a >= BARRIER_ALPHA) return false;
    return (
      Math.abs((data[i] ?? 0) - seed.r) <= tolerance &&
      Math.abs((data[i + 1] ?? 0) - seed.g) <= tolerance &&
      Math.abs((data[i + 2] ?? 0) - seed.b) <= tolerance &&
      Math.abs(a - seed.a) <= tolerance
    );
  };

  // "Já visitado" é o que impede re-varredura de linha fechada: sem ele, uma
  // forma côncava faz a mesma linha ser percorrida por cada span vizinho.
  const visited = new Uint8Array(w * h);
  const spans: Span[] = [];
  const stack: number[] = [y * w + x];
  let area = 0;
  let capped = false;

  for (let at = stack.pop(); at !== undefined; at = stack.pop()) {
    if (visited[at]) continue;
    if (!admitted(at * 4)) continue;

    const row = Math.floor(at / w);
    const col = at - row * w;
    const base = row * w;

    // Expande a linha inteira antes de decidir qualquer coisa: o span é máximo
    // por construção, e é isso que faz dois replays darem os mesmos spans.
    let x0 = col;
    while (x0 > 0 && !visited[base + x0 - 1] && admitted((base + x0 - 1) * 4)) x0--;
    let x1 = col;
    while (x1 < w - 1 && !visited[base + x1 + 1] && admitted((base + x1 + 1) * 4)) x1++;

    if (maxArea > 0 && area + (x1 - x0 + 1) > maxArea) {
      // Fecha só o que o teto permite e para. Terminar a linha depois de
      // estourar seria justamente o "pinta a folha inteira" que o teto evita.
      const last = x0 + (maxArea - area);
      for (let px = x0; px <= last; px++) visited[base + px] = 1;
      spans.push({ y: row, x0, x1: last });
      area += last - x0 + 1;
      capped = true;
      break;
    }

    for (let px = x0; px <= x1; px++) visited[base + px] = 1;
    spans.push({ y: row, x0, x1 });
    area += x1 - x0 + 1;

    // Só os trechos novos viram semente. A ordem (cima, baixo; da esquerda para
    // a direita) é fixa de propósito: é ela que dá o mesmo JSON em todo replay.
    for (const nrow of [row - 1, row + 1]) {
      if (nrow < 0 || nrow >= h) continue;
      const nbase = nrow * w;
      let px = x0;
      while (px <= x1) {
        while (px <= x1 && (visited[nbase + px] || !admitted((nbase + px) * 4))) px++;
        if (px > x1) break;
        stack.push(nbase + px);
        while (px <= x1 && !visited[nbase + px] && admitted((nbase + px) * 4)) px++;
      }
    }
  }

  // Ordem canônica: o consumidor compara, recorta e persiste spans sem ordenar.
  spans.sort((a, b) => a.y - b.y || a.x0 - b.x0);
  return { spans, area, capped };
}

/** Escreve os spans no buffer (mesma cor, alpha 255 por padrão). Puro, devolve o próprio buffer. */
export function paintSpans(
  buf: PixelBuffer,
  spans: Span[],
  rgba: { r: number; g: number; b: number; a?: number },
): PixelBuffer {
  const { width: w, height: h, data } = buf;
  const a = rgba.a ?? 255;
  for (const span of spans) {
    // Recorte defensivo: um span vindo de outro tamanho de folha não estoura a
    // faixa do buffer nem pinta na linha errada.
    if (span.y < 0 || span.y >= h) continue;
    const from = Math.max(0, span.x0);
    const to = Math.min(w - 1, span.x1);
    const base = span.y * w;
    for (let px = from; px <= to; px++) {
      const i = (base + px) * 4;
      data[i] = rgba.r;
      data[i + 1] = rgba.g;
      data[i + 2] = rgba.b;
      data[i + 3] = a;
    }
  }
  return buf;
}

/**
 * Hash estável do buffer inteiro — FNV-1a de 32 bits, hexadecimal.
 *
 * Só os bytes entram: o uso é comparar dois renders do MESMO tamanho (antes e
 * depois de um comando). Dobrar a dimensão no hash faria dois recortes iguais
 * de folhas diferentes divergirem sem que um pixel tivesse mudado.
 */
export function hashBuffer(buf: PixelBuffer): string {
  const { data } = buf;
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ (data[i] ?? 0), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}
