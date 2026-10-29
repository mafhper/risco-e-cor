// Fixtures raster do balde: a GEOMETRIA é a expectativa, não o algoritmo.
//
// Cada caso monta a folha à mão (papel, traço, buraco), roda a varredura e
// afirma a ÁREA e o HASH do que ficou pintado. A área sai de uma conta de
// retângulo — a conta está no comentário de cada caso. O hash esperado sai do
// buffer que a geometria manda (o retângulo que o balde DEVE pintar, montado
// aqui com `box`, nunca com o flood) assinado por uma FNV-1a de referência
// escrita a partir da publicação. Nada é recalculado com o código sob teste: um
// offset basis, um primo, uma ordem de canal ou uma expansão de span errada
// muda a assinatura e reprova o caso.
//
// A folha não é um canvas: o buffer é montado byte a byte, porque o defeito que
// importa aqui é o de fronteira (vazou? pintou fora? parou na hora?), e um
// canvas de mentira só acrescentaria a dúvida de quem pintou o quê.
import { describe, expect, it } from "vitest";
import { floodScanline, hashBuffer, paintSpans, type PixelBuffer } from "@/mockup/flood";

type Rgba = readonly [number, number, number, number];

/** Papel: branco em RGB, alfa 0 — ver `blank` para o porquê do alfa. */
const PAPER: Rgba = [255, 255, 255, 0];
/** Traço do usuário: opaco, e por isso barreira. */
const INK: Rgba = [17, 17, 17, 255];
/** A cor do balde. */
const RED: Rgba = [214, 48, 49, 255];
const RED_PAINT = { r: 214, g: 48, b: 49 };
/** Uma segunda cor, para o caso de duas áreas do mesmo desenho. */
const BLUE: Rgba = [41, 128, 185, 255];
const BLUE_PAINT = { r: 41, g: 128, b: 185 };

/**
 * Folha sem tinta. O branco do papel fica em RGB, mas o ALFA é 0: neste buffer
 * o alfa é cobertura de tinta — o canvas do app é transparente e o papel é a
 * camada CSS/SVG atrás dele. Alfa 255 aqui seria tinta na folha inteira e o
 * balde não teria onde pintar; é a mesma regra que o traço usa para fechar a
 * área, do lado do papel.
 */
function blank(w: number, h: number): PixelBuffer {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = PAPER[0];
    data[i + 1] = PAPER[1];
    data[i + 2] = PAPER[2];
    data[i + 3] = PAPER[3];
  }
  return { width: w, height: h, data };
}

function pixel(buf: PixelBuffer, x: number, y: number, [r, g, b, a]: Rgba): void {
  const i = (y * buf.width + x) * 4;
  buf.data[i] = r;
  buf.data[i + 1] = g;
  buf.data[i + 2] = b;
  buf.data[i + 3] = a;
}

/** Alfa de um pixel: a leitura de "tem tinta aqui?". */
function alphaAt(buf: PixelBuffer, x: number, y: number): number {
  return buf.data[(y * buf.width + x) * 4 + 3] ?? 0;
}

/** Linha horizontal, pontas inclusive. */
function hline(buf: PixelBuffer, x0: number, x1: number, y: number, rgba: Rgba): void {
  for (let x = x0; x <= x1; x++) pixel(buf, x, y, rgba);
}

/** Linha vertical, pontas inclusive. */
function vline(buf: PixelBuffer, x: number, y0: number, y1: number, rgba: Rgba): void {
  for (let y = y0; y <= y1; y++) pixel(buf, x, y, rgba);
}

/** Contorno de 1 px: o traço que o usuário desenha. */
function outline(
  buf: PixelBuffer,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rgba: Rgba,
): void {
  hline(buf, x0, x1, y0, rgba);
  hline(buf, x0, x1, y1, rgba);
  vline(buf, x0, y0, y1, rgba);
  vline(buf, x1, y0, y1, rgba);
}

/** Retângulo cheio: a expectativa do balde, desenhada à mão. */
function box(buf: PixelBuffer, x0: number, y0: number, x1: number, y1: number, rgba: Rgba): void {
  for (let y = y0; y <= y1; y++) hline(buf, x0, x1, y, rgba);
}

/** Todo o papel vira tinta: a afirmação de "vazou até a folha inteira". */
function paintPaper(buf: PixelBuffer, rgba: Rgba): void {
  for (let y = 0; y < buf.height; y++) {
    for (let x = 0; x < buf.width; x++) if (alphaAt(buf, x, y) < 128) pixel(buf, x, y, rgba);
  }
}

function copy(buf: PixelBuffer): PixelBuffer {
  return { width: buf.width, height: buf.height, data: new Uint8ClampedArray(buf.data) };
}

/**
 * Cor-semente lida do buffer, como o chamador fará ao converter o toque em cor.
 * Lida aqui direto dos bytes — nunca pelo módulo.
 */
function seedAt(
  buf: PixelBuffer,
  x: number,
  y: number,
): { r: number; g: number; b: number; a: number } {
  const i = (y * buf.width + x) * 4;
  return {
    r: buf.data[i] ?? 0,
    g: buf.data[i + 1] ?? 0,
    b: buf.data[i + 2] ?? 0,
    a: buf.data[i + 3] ?? 0,
  };
}

/** FNV-1a de 32 bits escrita a partir da publicação — o oráculo do hash. */
function fnv1a(data: Uint8ClampedArray): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ (data[i] ?? 0), 0x01000193);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * O hash que a geometria manda: a folha original (traço, buraco e tudo) mais o
 * preenchimento esperado. `fill` desenha retângulos — não chama o balde.
 */
function expectedHash(sheet: PixelBuffer, fill: (sheet: PixelBuffer) => void): string {
  const expected = copy(sheet);
  fill(expected);
  return fnv1a(expected.data);
}

describe("hash do buffer", () => {
  it("assina com FNV-1a: a base publicada e um byte trocado mudam a assinatura", () => {
    // 0x811c9dc5 é o valor publicado da FNV-1a de entrada vazia — a assinatura
    // de uma folha sem pixel. Se o offset basis mudar, este caso cai.
    expect(hashBuffer({ width: 0, height: 0, data: new Uint8ClampedArray(0) })).toBe("811c9dc5");

    const sheet = blank(4, 4);
    const same = copy(sheet);
    expect(hashBuffer(same)).toBe(hashBuffer(sheet));

    // Um único pixel de tinta no canto muda a assinatura do buffer inteiro.
    pixel(same, 3, 3, INK);
    expect(hashBuffer(same)).not.toBe(hashBuffer(sheet));
  });
});

describe("varredura do balde", () => {
  it("(a) quadrado fechado: preenche só o miolo e a área de fora fica intacta", () => {
    // Parede de 1 px em (4,4)-(19,19) numa folha 24×24. O miolo é x 5..18 e
    // y 5..18: 14 × 14 = 196 px. Como o miolo é retangular, cada uma das 14
    // linhas rende um span só — 14 spans, todos de x0=5 a x1=18.
    const sheet = blank(24, 24);
    outline(sheet, 4, 4, 19, 19, INK);

    const result = floodScanline(sheet, 10, 10, { seed: seedAt(sheet, 10, 10), tolerance: 12 });
    expect(result.area).toBe(196);
    expect(result.capped).toBe(false);
    expect(result.spans).toHaveLength(14);
    expect(result.spans.map((span) => span.y)).toEqual([
      5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
    ]);
    expect(result.spans.every((span) => span.x0 === 5 && span.x1 === 18)).toBe(true);

    // A parede e o papel de fora continuam exatamente como estavam: o hash
    // esperado é o da folha original com o retângulo 14×14 pintado à mão.
    const expected = expectedHash(sheet, (s) => box(s, 5, 5, 18, 18, RED));
    expect(paintSpans(sheet, result.spans, RED_PAINT)).toBe(sheet);
    expect(hashBuffer(sheet)).toBe(expected);
    expect(alphaAt(sheet, 4, 10)).toBe(255);
  });

  it("(b) lacuna de 1 px na diagonal não vaza: dentro e fora são duas áreas", () => {
    // Mesma ideia em 12×12, com o canto (8,8) reaberto. O miolo (4..7 × 4..7)
    // toca o canto apenas na DIAGONAL: 8-conexo vazaria, 4-conexo não.
    // Contas: 144 px - 19 de parede (20 do contorno menos o canto aberto) = 125
    // pintáveis; miolo 4 × 4 = 16; fora = 125 - 16 = 109.
    const sheet = blank(12, 12);
    outline(sheet, 3, 3, 8, 8, INK);
    pixel(sheet, 8, 8, PAPER);

    const inside = floodScanline(sheet, 5, 5, { seed: seedAt(sheet, 5, 5), tolerance: 12 });
    expect(inside.area).toBe(16);

    const outside = floodScanline(sheet, 0, 0, { seed: seedAt(sheet, 0, 0), tolerance: 12 });
    expect(outside.area).toBe(109);
    expect(inside.area + outside.area).toBe(125);

    // Pintar por dentro não alcança o canto aberto nem a folha de fora.
    const expected = expectedHash(sheet, (s) => box(s, 4, 4, 7, 7, RED));
    paintSpans(sheet, inside.spans, RED_PAINT);
    expect(hashBuffer(sheet)).toBe(expected);
    expect(alphaAt(sheet, 8, 8)).toBe(0);
  });

  it("(c) lacuna de 2 px vaza: arte reprovada, não bug do balde", () => {
    // O mesmo quadrado com DOIS pixels de canto abertos — (8,8) e (8,7). Agora
    // existe face, não diagonal: o miolo alcança a folha de fora e a varredura
    // pinta o papel inteiro. Isso é a spec (§2.2): tolerância não conserta
    // lacuna, quem fecha o contorno é o pipeline de arte. Registrado aqui para
    // que ninguém "conserte" o balde depois.
    // Contas: 144 px - 18 de parede (20 do contorno menos os 2 abertos) = 126.
    const sheet = blank(12, 12);
    outline(sheet, 3, 3, 8, 8, INK);
    pixel(sheet, 8, 8, PAPER);
    pixel(sheet, 8, 7, PAPER);

    const leak = floodScanline(sheet, 5, 5, { seed: seedAt(sheet, 5, 5), tolerance: 12 });
    expect(leak.area).toBe(126);
    expect(leak.capped).toBe(false);

    const expected = expectedHash(sheet, (s) => paintPaper(s, RED));
    paintSpans(sheet, leak.spans, RED_PAINT);
    expect(hashBuffer(sheet)).toBe(expected);
  });

  it("(d) traço cruzando divide o quadrado em duas áreas que somam o interior", () => {
    // Parede em (4,4)-(19,19) e uma travessa em y=11, de dentro a dentro.
    // Interior: 14 × 14 = 196, menos a travessa (14 px) = 182.
    //   acima: y 5..10 = 6 linhas × 14 = 84
    //   abaixo: y 12..18 = 7 linhas × 14 = 98
    //   84 + 98 = 182 ✓
    const sheet = blank(24, 24);
    outline(sheet, 4, 4, 19, 19, INK);
    hline(sheet, 5, 18, 11, INK);

    const top = floodScanline(sheet, 10, 8, { seed: seedAt(sheet, 10, 8), tolerance: 12 });
    const bottom = floodScanline(sheet, 10, 14, { seed: seedAt(sheet, 10, 14), tolerance: 12 });
    expect(top.area).toBe(84);
    expect(bottom.area).toBe(98);
    expect(top.area + bottom.area + 14).toBe(196);

    const north = copy(sheet);
    paintSpans(north, top.spans, RED_PAINT);
    expect(hashBuffer(north)).toBe(expectedHash(sheet, (s) => box(s, 5, 5, 18, 10, RED)));

    const south = copy(sheet);
    paintSpans(south, bottom.spans, BLUE_PAINT);
    expect(hashBuffer(south)).toBe(expectedHash(sheet, (s) => box(s, 5, 12, 18, 18, BLUE)));
  });

  it("(e) nada pinta fora do papel: a moldura da folha e a borda do buffer seguram", () => {
    // Moldura encostada na borda de uma folha 20×18: o miolo é x 1..18 e
    // y 1..16, ou seja 18 × 16 = 288 px. Nada do anel de 1 px pode ser tocado.
    const framed = blank(20, 18);
    outline(framed, 0, 0, 19, 17, INK);
    const inside = floodScanline(framed, 10, 9, { seed: seedAt(framed, 10, 9), tolerance: 12 });
    expect(inside.area).toBe(18 * 16);
    expect(inside.area).toBe(288);

    const expected = expectedHash(framed, (s) => box(s, 1, 1, 18, 16, RED));
    paintSpans(framed, inside.spans, RED_PAINT);
    expect(hashBuffer(framed)).toBe(expected);
  });

  it("(e) a borda do buffer é barreira: a varredura não dá a volta na folha", () => {
    // Folha 8×5 com uma parede vertical em x=4, de ponta a ponta. Esquerda:
    // 4 × 5 = 20; direita: 3 × 5 = 15; parede: 5. Total 40 = folha inteira.
    // Se a varredura "desse a volta" na borda, uma semente pintaria as duas.
    const sheet = blank(8, 5);
    vline(sheet, 4, 0, 4, INK);

    const left = floodScanline(sheet, 0, 0, { seed: seedAt(sheet, 0, 0), tolerance: 12 });
    const right = floodScanline(sheet, 7, 4, { seed: seedAt(sheet, 7, 4), tolerance: 12 });
    expect(left.area).toBe(20);
    expect(right.area).toBe(15);
    expect(left.area + right.area + 5).toBe(sheet.width * sheet.height);

    const sidebar = copy(sheet);
    paintSpans(sidebar, left.spans, RED_PAINT);
    expect(hashBuffer(sidebar)).toBe(expectedHash(sheet, (s) => box(s, 0, 0, 3, 4, RED)));
  });

  it("(f) área já na cor de destino: repetir a pintura não muda um byte", () => {
    // O caso real é o replay/redo do mesmo comando. A área pintada já é
    // barreira para um novo flood (regra 2), então quem decide o no-op de cor é
    // o chamador — o que se prova aqui é que `paintSpans` com a mesma cor é
    // byte-idêntico.
    const sheet = blank(16, 16);
    outline(sheet, 2, 2, 13, 13, INK);
    const spans = floodScanline(sheet, 8, 8, { seed: seedAt(sheet, 8, 8), tolerance: 12 }).spans;

    paintSpans(sheet, spans, RED_PAINT);
    const painted = hashBuffer(sheet);
    paintSpans(sheet, spans, RED_PAINT);
    expect(hashBuffer(sheet)).toBe(painted);
  });

  it("(g) determinismo: mesma folha, mesma ordem de spans e mesmo hash", () => {
    // Moldura em (2,2)-(29,29) com uma cruz em x=16 e y=16: quatro áreas. A
    // semente cai no quadrante de cima à esquerda, x 3..15 e y 3..15 = 13 × 13.
    const build = (): PixelBuffer => {
      const sheet = blank(32, 32);
      outline(sheet, 2, 2, 29, 29, INK);
      hline(sheet, 3, 28, 16, INK);
      vline(sheet, 16, 3, 28, INK);
      return sheet;
    };
    const first = build();
    const second = build();

    const a = floodScanline(first, 6, 6, { seed: seedAt(first, 6, 6), tolerance: 12 });
    const b = floodScanline(second, 6, 6, { seed: seedAt(second, 6, 6), tolerance: 12 });
    expect(a.area).toBe(169);
    expect(b.area).toBe(a.area);
    expect(JSON.stringify(b.spans)).toBe(JSON.stringify(a.spans));

    paintSpans(first, a.spans, RED_PAINT);
    paintSpans(second, b.spans, RED_PAINT);
    expect(hashBuffer(second)).toBe(hashBuffer(first));
  });

  it("(h) teto: para no meio da linha, com os spans já fechados preservados", () => {
    // Folha 64×64 sem traço. Teto de 100 px: a primeira linha fecha inteira
    // (64 px) e a segunda para no pixel que estoura o teto — 100 - 64 + 1 = 37.
    // Área = 64 + 37 = 101 = teto + 1, e não "teto + uma linha inteira".
    const sheet = blank(64, 64);
    const seed = seedAt(sheet, 32, 32);
    const capped = floodScanline(sheet, 32, 32, { seed, tolerance: 12, maxArea: 100 });
    expect(capped.capped).toBe(true);
    expect(capped.area).toBe(101);
    expect(capped.area).toBeLessThanOrEqual(100 + 64);
    expect(capped.spans.map((span) => span.x1 - span.x0 + 1)).toEqual([64, 37]);

    // Sem teto a mesma folha é uma área só: 64 × 64 = 4096.
    const full = floodScanline(sheet, 32, 32, { seed, tolerance: 12 });
    expect(full.capped).toBe(false);
    expect(full.area).toBe(4096);
  });

  it("(h) teto menor que a primeira linha: um span truncado e nada depois dele", () => {
    // Teto de 10 px: a primeira linha nem fecha. O span é x0=0..x1=10 (11 px,
    // o pixel que estoura) na linha da semente, e a varredura para ali.
    const sheet = blank(64, 64);
    const cut = floodScanline(sheet, 32, 32, {
      seed: seedAt(sheet, 32, 32),
      tolerance: 12,
      maxArea: 10,
    });
    expect(cut.capped).toBe(true);
    expect(cut.area).toBe(11);
    expect(cut.spans).toEqual([{ y: 32, x0: 0, x1: 10 }]);

    const expected = expectedHash(sheet, (s) => hline(s, 0, 10, 32, RED));
    paintSpans(sheet, cut.spans, RED_PAINT);
    expect(hashBuffer(sheet)).toBe(expected);
  });

  it("(i) 1024×1024 sem teto fica longe de 1,5 s", () => {
    // Não é benchmark: é o alarme de complexidade quadrática acidental. Um
    // span-fill linear nesta folha gasta dezenas de ms; um que revarre linhas
    // fechadas gasta minutos.
    const sheet = blank(1024, 1024);
    const started = performance.now();
    const result = floodScanline(sheet, 512, 512, { seed: seedAt(sheet, 512, 512), tolerance: 12 });
    const elapsed = performance.now() - started;

    expect(result.area).toBe(1024 * 1024);
    expect(result.capped).toBe(false);
    expect(elapsed).toBeLessThan(1500);
  });
});

describe("regras que não são fixture de desenho", () => {
  it("toque sobre traço é no-op: ninguém preenche em cima da linha", () => {
    const sheet = blank(8, 8);
    vline(sheet, 4, 0, 7, INK);
    const result = floodScanline(sheet, 4, 3, { seed: seedAt(sheet, 4, 3), tolerance: 12 });
    expect(result).toEqual({ spans: [], area: 0, capped: false });
  });

  it("semente fora do buffer é no-op: a mesa não é papel", () => {
    const sheet = blank(8, 8);
    const seed = seedAt(sheet, 0, 0);
    expect(floodScanline(sheet, -1, 4, { seed, tolerance: 12 })).toEqual({
      spans: [],
      area: 0,
      capped: false,
    });
    expect(floodScanline(sheet, 8, 4, { seed, tolerance: 12 })).toEqual({
      spans: [],
      area: 0,
      capped: false,
    });
  });

  it("a tolerância compara com a SEMENTE, não com o vizinho", () => {
    // Degradê de 200 a 150 em passos de 10, alfa 0. Com tolerância 12 a área
    // para no primeiro pixel que difere 20 da semente; se a comparação fosse
    // com o vizinho, o degradê inteiro (6 px) entraria.
    const sheet = blank(6, 1);
    for (let x = 0; x < 6; x++) pixel(sheet, x, 0, [200 - x * 10, 0, 0, 0]);
    const seed = seedAt(sheet, 0, 0);

    expect(floodScanline(sheet, 0, 0, { seed, tolerance: 12 }).area).toBe(2);
    expect(floodScanline(sheet, 0, 0, { seed, tolerance: 20 }).area).toBe(3);
    expect(floodScanline(sheet, 0, 0, { seed, tolerance: 0 }).area).toBe(1);
  });
});

describe("máscara do chamador: traço e preenchimento no mesmo alfa", () => {
  it("(j) repintar área já opaca: máscara zerada devolve a área ao balde", () => {
    // Traço e preenchimento são os DOIS opacos: pela regra de alfa uma área já
    // preenchida é parede dura e não poderia ser repintada — e repintar é o laço
    // central de um app de colorir. A máscara zerada diz "aqui não há parede".
    // Contas: folha 16 × 16 inteira coberta = 256 px, 16 linhas de 16.
    const sheet = blank(16, 16);
    box(sheet, 0, 0, 15, 15, RED);
    const mask = new Uint8Array(sheet.width * sheet.height);

    // Controle: sem máscara o mesmo toque é no-op, porque o alfa manda sozinho.
    expect(floodScanline(sheet, 8, 8, { seed: seedAt(sheet, 8, 8), tolerance: 12 }).area).toBe(0);

    const result = floodScanline(sheet, 8, 8, {
      seed: seedAt(sheet, 8, 8),
      tolerance: 12,
      barrier: mask,
    });
    expect(result.area).toBe(16 * 16);
    expect(result.area).toBe(256);
    expect(result.capped).toBe(false);
    expect(result.spans).toHaveLength(16);
    expect(result.spans.every((span) => span.x0 === 0 && span.x1 === 15)).toBe(true);

    // A cor B cobre a área toda: não sobra um pixel da cor antiga.
    const expected = expectedHash(sheet, (s) => box(s, 0, 0, 15, 15, BLUE));
    paintSpans(sheet, result.spans, BLUE_PAINT);
    expect(hashBuffer(sheet)).toBe(expected);
  });

  it("(k) a máscara manda mais que o alfa: coluna marcada barra papel transparente", () => {
    // Papel 8×8 (alfa 0, passável pela regra de alfa) com a coluna x=4 inteira
    // mascarada. Esquerda: colunas 0..3 = 4 × 8 = 32 px. Direita: 3 × 8 = 24.
    // Se a varredura atravessasse a coluna, a esquerda daria 64 - 8 = 56.
    const sheet = blank(8, 8);
    const mask = new Uint8Array(sheet.width * sheet.height);
    for (let y = 0; y < sheet.height; y++) mask[y * sheet.width + 4] = 1;

    const left = floodScanline(sheet, 0, 0, {
      seed: seedAt(sheet, 0, 0),
      tolerance: 12,
      barrier: mask,
    });
    expect(left.area).toBe(4 * 8);
    expect(left.area).toBe(32);
    expect(left.spans).toHaveLength(8);
    expect(left.spans.every((span) => span.x0 === 0 && span.x1 === 3)).toBe(true);

    // O lado de lá da coluna existe e é menor: a barreira dividiu, não truncou.
    const right = floodScanline(sheet, 7, 0, {
      seed: seedAt(sheet, 7, 0),
      tolerance: 12,
      barrier: mask,
    });
    expect(right.area).toBe(3 * 8);
    expect(right.area).toBe(24);
    expect(left.area + right.area + 8).toBe(sheet.width * sheet.height);
  });

  it("(l) semente em pixel mascarado é no-op: a máscara barra o toque", () => {
    // Mesma folha e mesma máscara do caso (k), com a semente DENTRO da coluna
    // barrada: é o toque que acerta o traço, e não pinta nada.
    const sheet = blank(8, 8);
    const mask = new Uint8Array(sheet.width * sheet.height);
    for (let y = 0; y < sheet.height; y++) mask[y * sheet.width + 4] = 1;

    expect(
      floodScanline(sheet, 4, 3, { seed: seedAt(sheet, 4, 3), tolerance: 12, barrier: mask }),
    ).toEqual({ spans: [], area: 0, capped: false });
  });
});
