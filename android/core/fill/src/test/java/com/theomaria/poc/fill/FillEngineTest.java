package com.theomaria.poc.fill;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.theomaria.poc.fill.pure.FillEngine;
import com.theomaria.poc.fill.pure.RegionInfo;
import com.theomaria.poc.fill.pure.RegionMap;
import com.theomaria.poc.fill.pure.TapResult;

import org.junit.Assume;
import org.junit.Test;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.util.Arrays;

/**
 * Comportamento do fill sobre mapas sinteticos construidos no teste.
 *
 * <p>O mapa e montado <b>pelos bytes do contrato</b> (little-endian) e lido por
 * {@link RegionMap#fromBytes}: o parser participa do teste em vez de ser assumido.
 */
public class FillEngineTest {

    private static final int WHITE = 0xFFFFFFFF;
    private static final int RED = 0xFFFF0000;
    private static final int BLUE = 0xFF0000FF;

    /**
     * Pagina 32x32 com tres regioes retangulares e contorno de {@code stroke} px:
     * <pre>
     *  2: x 4..9   y 4..9   (36 px)
     *  3: x 14..17 y 4..7   (16 px)
     *  4: x 4..17  y 12..21 (140 px)
     * </pre>
     * Nenhuma passa de 40% (1024 px de pagina).
     */
    private static RegionMap smallPage(int stroke) {
        return buildMap(32, 32, stroke, 40.0, new int[][]{
                {2, 4, 4, 9, 9},
                {3, 14, 4, 17, 7},
                {4, 4, 12, 17, 21}
        }, new int[0]);
    }

    /** Pagina 20x20 com uma regiao de 14x14 = 49% — acima do limiar de 40%. */
    private static RegionMap bigPage() {
        return buildMap(20, 20, 1, 40.0, new int[][]{
                {2, 2, 2, 15, 15}
        }, new int[0]);
    }

    /** Contorno por distancia Chebyshev; o resto e exterior. */
    private static RegionMap buildMap(int w, int h, int stroke, double maxPct, int[][] rects,
                                      int[] punch) {
        int n = w * h;
        int[] labels = new int[n];
        Arrays.fill(labels, -1);
        for (int[] r : rects) {
            for (int y = r[2]; y <= r[4]; y++) {
                for (int x = r[1]; x <= r[3]; x++) {
                    labels[y * w + x] = r[0];
                }
            }
        }
        int[] dist = new int[n];
        Arrays.fill(dist, Integer.MAX_VALUE);
        int[] queue = new int[n];
        int head = 0;
        int tail = 0;
        for (int i = 0; i < n; i++) {
            if (labels[i] >= 2) {
                dist[i] = 0;
                queue[tail++] = i;
            }
        }
        while (head < tail) {
            int index = queue[head++];
            int x = index % w;
            int y = index / w;
            int d = dist[index];
            if (d >= stroke) {
                continue;
            }
            for (int dy = -1; dy <= 1; dy++) {
                for (int dx = -1; dx <= 1; dx++) {
                    if (dx == 0 && dy == 0) {
                        continue;
                    }
                    int nx = x + dx;
                    int ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
                        continue;
                    }
                    int ni = ny * w + nx;
                    if (dist[ni] > d + 1) {
                        dist[ni] = d + 1;
                        queue[tail++] = ni;
                    }
                }
            }
        }
        for (int i = 0; i < n; i++) {
            if (labels[i] >= 2) {
                continue;
            }
            labels[i] = dist[i] <= stroke ? 0 : 1;
        }
        for (int i = 0; i + 3 < punch.length; i += 4) {
            for (int y = punch[i + 1]; y <= punch[i + 3]; y++) {
                for (int x = punch[i]; x <= punch[i + 2]; x++) {
                    labels[y * w + x] = 1;
                }
            }
        }
        return RegionMap.fromBytes(toMapBytes(w, h, labels), maxPct);
    }

    private static byte[] toMapBytes(int w, int h, int[] labels) {
        byte[] data = new byte[16 + 2 * labels.length];
        putLe32(data, 0, 0x50414D52);
        putLe16(data, 4, 1);
        putLe16(data, 6, 0);
        putLe32(data, 8, w);
        putLe32(data, 12, h);
        int p = 16;
        for (int label : labels) {
            putLe16(data, p, label);
            p += 2;
        }
        return data;
    }

    private static void putLe16(byte[] b, int o, int v) {
        b[o] = (byte) (v & 0xFF);
        b[o + 1] = (byte) ((v >>> 8) & 0xFF);
    }

    private static void putLe32(byte[] b, int o, int v) {
        b[o] = (byte) (v & 0xFF);
        b[o + 1] = (byte) ((v >>> 8) & 0xFF);
        b[o + 2] = (byte) ((v >>> 16) & 0xFF);
        b[o + 3] = (byte) ((v >>> 24) & 0xFF);
    }

    private static int[] whitePage(RegionMap map) {
        int[] pixels = new int[map.pixelCount()];
        Arrays.fill(pixels, WHITE);
        return pixels;
    }

    /** Procura {@code content/<nome>} subindo a partir do diretorio de trabalho do teste. */
    private static File findContent(String name) {
        File dir = new File(System.getProperty("user.dir", ".")).getAbsoluteFile();
        for (int i = 0; i < 5 && dir != null; i++) {
            File candidate = new File(dir, "content/" + name);
            if (candidate.isFile()) {
                return candidate;
            }
            dir = dir.getParentFile();
        }
        return null;
    }

    @Test
    public void readsGeometryFromLabels() {
        RegionMap map = smallPage(2);
        assertEquals(32, map.width());
        assertEquals(32, map.height());

        RegionInfo two = map.region(2);
        assertNotNull(two);
        assertEquals(36, two.areaPx);
        assertEquals(4, two.x);
        assertEquals(4, two.y);
        assertEquals(6, two.w);
        assertEquals(6, two.h);
        assertTrue(two.fillable);

        RegionInfo four = map.region(4);
        assertEquals(140, four.areaPx);
        assertEquals(4, four.x);
        assertEquals(12, four.y);
        assertEquals(14, four.w);
        assertEquals(10, four.h);

        assertEquals(3, map.regions().size());
        assertEquals(1, map.labelAt(0, 0));
        assertEquals(0, map.labelAt(3, 4));
    }

    @Test
    public void tapOnExteriorIsRejected() {
        RegionMap map = smallPage(2);
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);
        int[] pixels = whitePage(map);

        TapResult result = engine.tap(0, 0);

        assertEquals(TapResult.Decision.REJECT_BG, result.decision);
        assertFalse(result.paints());
        assertFalse(engine.apply(result, pixels, RED));
        for (int pixel : pixels) {
            assertEquals(WHITE, pixel);
        }
    }

    @Test
    public void tapOnContourSnapsToTheRegionInTheRing() {
        RegionMap map = smallPage(2);
        // (2,2) e contorno a distancia 2 de (4,4): com anel 1..2 o snap acha a regiao 2.
        assertEquals(0, map.labelAt(2, 2));
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);

        TapResult result = engine.tap(2, 2);

        assertEquals(TapResult.Decision.SNAP, result.decision);
        assertEquals(2, result.label);
        assertEquals(4, result.x);
        assertEquals(4, result.y);
    }

    @Test
    public void contourWithoutRegionInsideTheRingIsANoOp() {
        RegionMap map = smallPage(2);
        // Mesmo pixel, anel de raio 1 apenas: nada da regiao 2 esta a distancia 1.
        FillEngine engine = new FillEngine(map, 40.0, 1, 1);
        int[] pixels = whitePage(map);

        TapResult result = engine.tap(2, 2);

        assertEquals(TapResult.Decision.REJECT_NONE, result.decision);
        assertFalse(engine.apply(result, pixels, RED));
        for (int pixel : pixels) {
            assertEquals(WHITE, pixel);
        }
    }

    @Test
    public void regionAboveTheCapIsRejectedWithoutTouchingPixels() {
        RegionMap map = bigPage();
        FillEngine engine = new FillEngine(map, map.maxAreaPct(), 1, 2);
        int[] pixels = whitePage(map);

        TapResult result = engine.tap(8, 8);

        assertEquals(TapResult.Decision.REJECT_AREA, result.decision);
        assertTrue(result.areaPct > 40.0);
        assertFalse(engine.apply(result, pixels, RED));
        for (int pixel : pixels) {
            assertEquals(WHITE, pixel);
        }
    }

    @Test
    public void fillPaintsTheRegionAndDilatesOnePixelOfContourOnly() {
        RegionMap map = smallPage(2);
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);
        int[] pixels = whitePage(map);

        TapResult result = engine.tap(6, 6);
        assertEquals(TapResult.Decision.FILL, result.decision);
        assertTrue(engine.apply(result, pixels, RED));

        // Interior inteiro pintado.
        for (int y = 4; y <= 9; y++) {
            for (int x = 4; x <= 9; x++) {
                assertEquals("interior " + x + "," + y, RED, pixels[y * 32 + x]);
            }
        }
        // Contorno adjacente pintado (dilatacao de 1 px).
        assertEquals(RED, pixels[4 * 32 + 3]);
        assertEquals(RED, pixels[3 * 32 + 4]);
        // Contorno a 2 px NAO e pintado.
        assertEquals(WHITE, pixels[2 * 32 + 2]);
        assertEquals(WHITE, pixels[4 * 32 + 2]);
        // Exterior intacto.
        assertEquals(WHITE, pixels[0]);
        // Regiao vizinha intacta.
        for (int y = 4; y <= 7; y++) {
            for (int x = 14; x <= 17; x++) {
                assertEquals("regiao 3 em " + x + "," + y, WHITE, pixels[y * 32 + x]);
            }
        }
        // 36 de interior + 24 de contorno: o anel Chebyshev de distancia 1 tem 28 px
        // (8x8 - 6x6), menos os 4 cantos diagonais, que nao tem vizinho-4 da regiao.
        assertEquals(60, result.paintedPx);
    }

    @Test
    public void fillNeverWritesRegionPixelsOfANeighbour() {
        RegionMap map = smallPage(2);
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);
        int[] pixels = whitePage(map);

        engine.apply(engine.tap(15, 5), pixels, BLUE);   // regiao 3
        engine.apply(engine.tap(6, 6), pixels, RED);     // regiao 2, vizinha de contorno

        for (int y = 4; y <= 9; y++) {
            for (int x = 4; x <= 9; x++) {
                assertEquals("vazou da regiao 3 para a 2 em " + x + "," + y,
                        RED, pixels[y * 32 + x]);
            }
        }
        // O pixel de contorno compartilhado (10,4) recebeu a ultima cor (last-write-wins).
        assertEquals(RED, pixels[4 * 32 + 10]);
    }

    @Test
    public void dilationNeverPaintsTheExterior() {
        RegionMap map = smallPage(1);
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);
        int[] pixels = whitePage(map);

        for (RegionInfo info : map.regions()) {
            engine.apply(engine.tap(info.centerX(), info.centerY()), pixels, RED);
        }

        int paintedExterior = 0;
        for (int y = 0; y < map.height(); y++) {
            for (int x = 0; x < map.width(); x++) {
                if (map.labelAt(x, y) == RegionMap.LABEL_EXTERIOR && pixels[y * 32 + x] != WHITE) {
                    paintedExterior++;
                }
            }
        }
        assertEquals("nenhum pixel de exterior pode receber cor (A3-b)", 0, paintedExterior);
    }

    @Test
    public void dirtyRectMatchesTheChangedPixelsExactly() {
        RegionMap map = smallPage(2);
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);
        int[] pixels = whitePage(map);

        TapResult result = engine.tap(6, 6);
        engine.apply(result, pixels, RED);

        assertTrue(result.dirtyW > 0);
        int minX = Integer.MAX_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxX = -1;
        int maxY = -1;
        for (int y = 0; y < map.height(); y++) {
            for (int x = 0; x < map.width(); x++) {
                if (pixels[y * 32 + x] == WHITE) {
                    continue;
                }
                boolean inside = x >= result.dirtyX && x < result.dirtyX + result.dirtyW
                        && y >= result.dirtyY && y < result.dirtyY + result.dirtyH;
                assertTrue("pixel alterado " + x + "," + y + " fora do dirty rect", inside);
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }
        // O rect e exato (bbox dos pixels que mudaram), nao uma margem folgada.
        assertEquals(minX, result.dirtyX);
        assertEquals(minY, result.dirtyY);
        assertEquals(maxX - minX + 1, result.dirtyW);
        assertEquals(maxY - minY + 1, result.dirtyH);
    }

    @Test
    public void replayPaintsTheSamePixelsAsTheIncrementalOrder() {
        RegionMap map = smallPage(2);
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);

        int[] incremental = whitePage(map);
        engine.apply(engine.tap(6, 6), incremental, RED);
        engine.apply(engine.tap(15, 5), incremental, BLUE);

        int[] replayed = whitePage(map);
        java.util.Map<Integer, Integer> colors = new java.util.TreeMap<>();
        colors.put(2, RED);
        colors.put(3, BLUE);
        engine.replay(colors, replayed, WHITE);

        assertTrue(Arrays.equals(incremental, replayed));
    }

    @Test
    public void parserRejectsBadMagicAndTruncatedPayload() {
        byte[] good = toMapBytes(4, 4, new int[16]);
        assertNotNull(RegionMap.fromBytes(good, 40.0));

        byte[] badMagic = good.clone();
        badMagic[0] = 0;
        try {
            RegionMap.fromBytes(badMagic, 40.0);
            fail("magic invalido deveria falhar");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("magic"));
        }

        byte[] truncated = new byte[good.length - 4];
        System.arraycopy(good, 0, truncated, 0, truncated.length);
        try {
            RegionMap.fromBytes(truncated, 40.0);
            fail("map truncado deveria falhar");
        } catch (IllegalArgumentException expected) {
            assertTrue(expected.getMessage().contains("truncado"));
        }
    }

    @Test
    public void tapOutsideThePageIsANoOp() {
        FillEngine engine = new FillEngine(smallPage(2), 40.0, 1, 2);
        assertEquals(TapResult.Decision.REJECT_NONE, engine.tap(-1, 0).decision);
        assertEquals(TapResult.Decision.REJECT_NONE, engine.tap(0, 32).decision);
    }

    /**
     * Fecha a costura entre duas implementacoes do mesmo contrato: os bytes escritos pelo
     * {@code :testkit} (implementacao independente, em Java puro) lidos pelo {@link RegionMap} que
     * o app usa no aparelho. Os testes acima usam mapas montados aqui; este usa o arquivo gerado.
     *
     * <p>Se {@code content/} ainda nao foi gerado, o teste e <b>pulado</b> (Assume) em vez de
     * falhar: a ordem natural e {@code generateContent} antes de {@code test}.
     */
    @Test
    public void readsTheGeneratedPagePocWhenContentExists() throws IOException {
        File candidate = findContent("page_poc.map");
        Assume.assumeTrue("content/page_poc.map nao encontrado a partir de "
                + System.getProperty("user.dir"), candidate != null);

        RegionMap map = RegionMap.fromBytes(Files.readAllBytes(candidate.toPath()), 40.0);

        assertEquals(1024, map.width());
        assertEquals(1024, map.height());
        assertEquals(8, map.regions().size());
        assertEquals(1, map.labelAt(0, 0));
        assertEquals(2, map.labelAt(200, 140));
        assertEquals(6, map.labelAt(730, 512));
        assertEquals(0, map.labelAt(439, 512));

        RegionInfo biggest = map.region(6);
        assertNotNull(biggest);
        assertTrue("area da regiao 6 = " + biggest.areaPct, biggest.areaPct > 25.0 && biggest.areaPct < 26.0);
        assertTrue(biggest.fillable);
    }
}
