package com.theomaria.poc.fill.pure;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Algoritmo de fill sobre o mapa de regioes. Sem nenhum import de {@code android.*} — e por isso
 * que os testes de comportamento rodam na JVM.
 *
 * <pre>
 * tap(x,y)
 *   label = labels[y*W+x]
 *   label == 0            -> SNAP: anel Chebyshev r=snapInner..snapOuter, primeiro label >= 2
 *                            nenhum -> REJECT_NONE (no-op, sem punicao)
 *   label == 1            -> REJECT_BG
 *   area(label) > maxPct% -> REJECT_AREA
 *   senao                 -> FILL
 * </pre>
 *
 * <p>Dilatacao de 1 px <b>so sobre pixels de contorno</b> (label 0) com vizinho-4 igual ao rotulo
 * pintado. E o que esconde a emenda sob o traco sem invadir a regiao vizinha: um pixel com
 * label &gt;= 2 nunca e escrito pela dilatacao.
 *
 * <p>Fonte: {@code .dev/plans/poc-a-implementacao.md} §4.5.
 */
public final class FillEngine {

    /** Valor default quando o sidecar nao traz {@code fillableMaxAreaPct}. */
    public static final double DEFAULT_MAX_AREA_PCT = 40.0;

    private final RegionMap map;
    private final double maxAreaPct;
    private final int snapInner;
    private final int snapOuter;

    /**
     * @param maxAreaPct limiar de rejeicao por area (o sidecar manda 40.0)
     * @param snapInner  raio interno do anel de snap, em px
     * @param snapOuter  raio externo do anel de snap, em px
     */
    public FillEngine(RegionMap map, double maxAreaPct, int snapInner, int snapOuter) {
        if (map == null) {
            throw new IllegalArgumentException("map nulo");
        }
        if (snapInner < 1 || snapOuter < snapInner) {
            throw new IllegalArgumentException("anel de snap invalido: " + snapInner + ".." + snapOuter);
        }
        this.map = map;
        this.maxAreaPct = maxAreaPct;
        this.snapInner = snapInner;
        this.snapOuter = snapOuter;
    }

    public RegionMap map() {
        return map;
    }

    public double maxAreaPct() {
        return maxAreaPct;
    }

    /** Decide o que fazer com o toque. Nao altera pixels. */
    public TapResult tap(int x, int y) {
        if (x < 0 || y < 0 || x >= map.width() || y >= map.height()) {
            return TapResult.reject(TapResult.Decision.REJECT_NONE, -1, 0.0, x, y);
        }
        int label = map.labelAt(x, y);
        int rx = x;
        int ry = y;
        boolean snapped = false;

        if (label == RegionMap.LABEL_CONTOUR) {
            int[] hit = findSnap(x, y);
            if (hit == null) {
                return TapResult.reject(TapResult.Decision.REJECT_NONE, label, 0.0, x, y);
            }
            rx = hit[0];
            ry = hit[1];
            label = hit[2];
            snapped = true;
        }

        if (label == RegionMap.LABEL_EXTERIOR) {
            return TapResult.reject(TapResult.Decision.REJECT_BG, label, 0.0, x, y);
        }
        if (label < RegionMap.LABEL_REGION_MIN) {
            // Defensivo: rotulo fora do contrato.
            return TapResult.reject(TapResult.Decision.REJECT_NONE, label, 0.0, x, y);
        }

        RegionInfo info = map.region(label);
        if (info == null) {
            return TapResult.reject(TapResult.Decision.REJECT_NONE, label, 0.0, x, y);
        }
        if (info.areaPct > maxAreaPct) {
            return TapResult.reject(TapResult.Decision.REJECT_AREA, label, info.areaPct, x, y);
        }
        return TapResult.paint(snapped ? TapResult.Decision.SNAP : TapResult.Decision.FILL,
                label, info.areaPct, x, y, rx, ry, info);
    }

    /**
     * Pinta a regiao decidida e preenche o retangulo sujo do resultado.
     *
     * @return true se algum pixel foi escrito
     */
    public boolean apply(TapResult result, int[] pixels, int color) {
        checkPixels(pixels);
        if (!result.paints()) {
            return false;
        }
        int[] dirty = new int[4];
        int written = paintRegion(result.label, pixels, color, dirty);
        result.paintedPx = written;
        result.dirtyX = dirty[0];
        result.dirtyY = dirty[1];
        result.dirtyW = dirty[2];
        result.dirtyH = dirty[3];
        return written > 0;
    }

    /**
     * Pinta a regiao (interior + dilatacao de 1 px no contorno) com a cor dada.
     *
     * @param dirtyOut quando nao nulo, recebe {x, y, w, h} dos pixels que <b>mudaram de valor</b>;
     *                 w=0 quando nada mudou. Bounds exatos — util para o assert de vazamento.
     * @return quantidade de pixels escritos (interior + dilatacao)
     */
    public int paintRegion(int label, int[] pixels, int color, int[] dirtyOut) {
        checkPixels(pixels);
        RegionInfo info = map.region(label);
        if (info == null) {
            clearDirty(dirtyOut);
            return 0;
        }
        final int w = map.width();
        final int h = map.height();
        final int bx0 = info.x;
        final int by0 = info.y;
        final int bx1 = info.x + info.w;
        final int by1 = info.y + info.h;

        int minX = Integer.MAX_VALUE;
        int minY = Integer.MAX_VALUE;
        int maxX = -1;
        int maxY = -1;
        int written = 0;

        for (int y = by0; y < by1; y++) {
            final int row = y * w;
            for (int x = bx0; x < bx1; x++) {
                final int i = row + x;
                if (map.labelAtIndex(i) != label) {
                    continue;
                }
                written++;
                if (pixels[i] != color) {
                    pixels[i] = color;
                    if (x < minX) {
                        minX = x;
                    }
                    if (x > maxX) {
                        maxX = x;
                    }
                    if (y < minY) {
                        minY = y;
                    }
                    if (y > maxY) {
                        maxY = y;
                    }
                }
            }
        }

        // Dilatacao: 1 px, somente em contorno, e somente se um vizinho-4 pertence a regiao.
        final int dx0 = Math.max(0, bx0 - 1);
        final int dy0 = Math.max(0, by0 - 1);
        final int dx1 = Math.min(w, bx1 + 1);
        final int dy1 = Math.min(h, by1 + 1);
        for (int y = dy0; y < dy1; y++) {
            final int row = y * w;
            for (int x = dx0; x < dx1; x++) {
                final int i = row + x;
                if (map.labelAtIndex(i) != RegionMap.LABEL_CONTOUR) {
                    continue;
                }
                boolean near = (x > 0 && map.labelAtIndex(i - 1) == label)
                        || (x + 1 < w && map.labelAtIndex(i + 1) == label)
                        || (y > 0 && map.labelAtIndex(i - w) == label)
                        || (y + 1 < h && map.labelAtIndex(i + w) == label);
                if (!near) {
                    continue;
                }
                written++;
                if (pixels[i] != color) {
                    pixels[i] = color;
                    if (x < minX) {
                        minX = x;
                    }
                    if (x > maxX) {
                        maxX = x;
                    }
                    if (y < minY) {
                        minY = y;
                    }
                    if (y > maxY) {
                        maxY = y;
                    }
                }
            }
        }

        if (dirtyOut != null) {
            if (maxX < 0) {
                clearDirty(dirtyOut);
            } else {
                dirtyOut[0] = minX;
                dirtyOut[1] = minY;
                dirtyOut[2] = maxX - minX + 1;
                dirtyOut[3] = maxY - minY + 1;
            }
        }
        return written;
    }

    /**
     * Reconstroi a pagina do zero: branco + uma passada por regiao colorida, em ordem crescente de
     * id. O undo/redo usa replay (e nao desfazer pixel a pixel) porque duas dilatacoes podem
     * disputar o mesmo pixel de contorno; a ordem fixa deixa o resultado deterministico.
     */
    public void replay(Map<Integer, Integer> colorByLabel, int[] pixels, int white) {
        checkPixels(pixels);
        Arrays.fill(pixels, white);
        if (colorByLabel == null || colorByLabel.isEmpty()) {
            return;
        }
        List<Integer> ids = new ArrayList<>(colorByLabel.keySet());
        Collections.sort(ids);
        for (Integer id : ids) {
            Integer color = colorByLabel.get(id);
            if (color == null) {
                continue;
            }
            paintRegion(id, pixels, color, null);
        }
    }

    /**
     * Anel Chebyshev de {@code snapInner} a {@code snapOuter} px; devolve o primeiro pixel com
     * rotulo de regiao. Ordem deterministica (raio crescente, depois dy, depois dx).
     *
     * @return {x, y, label} ou null
     */
    private int[] findSnap(int cx, int cy) {
        final int w = map.width();
        final int h = map.height();
        for (int r = snapInner; r <= snapOuter; r++) {
            for (int dy = -r; dy <= r; dy++) {
                for (int dx = -r; dx <= r; dx++) {
                    if (Math.max(Math.abs(dx), Math.abs(dy)) != r) {
                        continue;
                    }
                    int x = cx + dx;
                    int y = cy + dy;
                    if (x < 0 || y < 0 || x >= w || y >= h) {
                        continue;
                    }
                    int label = map.labelAt(x, y);
                    if (label >= RegionMap.LABEL_REGION_MIN) {
                        return new int[]{x, y, label};
                    }
                }
            }
        }
        return null;
    }

    private void checkPixels(int[] pixels) {
        if (pixels == null || pixels.length != map.pixelCount()) {
            throw new IllegalArgumentException("buffer de pixels incompativel: "
                    + (pixels == null ? "null" : String.valueOf(pixels.length))
                    + " (esperado " + map.pixelCount() + ")");
        }
    }

    private static void clearDirty(int[] dirtyOut) {
        if (dirtyOut != null) {
            dirtyOut[0] = 0;
            dirtyOut[1] = 0;
            dirtyOut[2] = 0;
            dirtyOut[3] = 0;
        }
    }
}
