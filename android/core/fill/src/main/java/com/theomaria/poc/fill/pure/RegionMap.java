package com.theomaria.poc.fill.pure;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Mapa de regioes: rotulos uint16, row-major, lidos do contrato binario {@code .map}.
 *
 * <pre>
 * offset 0   magic   uint32 LE = 0x50414D52  ("RMAP")
 * offset 4   version uint16 LE = 1
 * offset 6   reserved uint16 LE = 0
 * offset 8   width   uint32 LE
 * offset 12  height  uint32 LE
 * offset 16  labels  uint16[width*height] LE, row-major
 * </pre>
 *
 * <p>{@code 0} = contorno · {@code 1} = exterior · {@code 2..65534} = regiao.
 * Os rotulos sao guardados em {@code char[]} (16 bits sem sinal, 2 MiB em 1024x1024).
 *
 * <p>Fonte: a spec de implementacao do POC-A §4.1. O plano original pedia PNG cinza
 * 16 bits; a correcao D-A4 esta registrada na especificacao.
 */
public final class RegionMap {

    public static final int MAGIC = 0x50414D52;
    public static final int VERSION = 1;
    public static final int HEADER_BYTES = 16;

    public static final int LABEL_CONTOUR = 0;
    public static final int LABEL_EXTERIOR = 1;
    public static final int LABEL_REGION_MIN = 2;

    private final int width;
    private final int height;
    private final char[] labels;
    private final double maxAreaPct;

    /** Construido sob demanda: uma varredura so, cacheada. */
    private List<RegionInfo> regions;
    private Map<Integer, RegionInfo> byId;

    private RegionMap(int width, int height, char[] labels, double maxAreaPct) {
        this.width = width;
        this.height = height;
        this.labels = labels;
        this.maxAreaPct = maxAreaPct;
    }

    /**
     * @param maxAreaPct limiar de pintabilidade (default 40.0, vem do sidecar)
     */
    public static RegionMap fromBytes(byte[] data, double maxAreaPct) {
        if (data == null) {
            throw new IllegalArgumentException("map nulo");
        }
        if (data.length < HEADER_BYTES) {
            throw new IllegalArgumentException("map menor que o cabecalho: " + data.length + " B");
        }
        int magic = le32(data, 0);
        if (magic != MAGIC) {
            throw new IllegalArgumentException(
                    String.format(Locale.ROOT, "magic invalido: 0x%08X (esperado 0x%08X)", magic, MAGIC));
        }
        int version = le16(data, 4);
        if (version != VERSION) {
            throw new IllegalArgumentException("versao nao suportada: " + version);
        }
        int w = le32(data, 8);
        int h = le32(data, 12);
        if (w <= 0 || h <= 0 || w > 8192 || h > 8192) {
            throw new IllegalArgumentException("dimensoes invalidas: " + w + "x" + h);
        }
        long need = HEADER_BYTES + 2L * w * h;
        if (data.length < need) {
            throw new IllegalArgumentException(
                    "map truncado: " + data.length + " B, esperado " + need + " B");
        }
        char[] labels = new char[w * h];
        int p = HEADER_BYTES;
        for (int i = 0; i < labels.length; i++) {
            labels[i] = (char) le16(data, p);
            p += 2;
        }
        return new RegionMap(w, h, labels, maxAreaPct);
    }

    public int width() {
        return width;
    }

    public int height() {
        return height;
    }

    public int pixelCount() {
        return width * height;
    }

    public double maxAreaPct() {
        return maxAreaPct;
    }

    /** Rotulo na coordenada, com checagem de limites (fora da pagina devolve -1). */
    public int labelAt(int x, int y) {
        if (x < 0 || y < 0 || x >= width || y >= height) {
            return -1;
        }
        return labels[y * width + x];
    }

    /** Rotulo por indice linear (sem checagem de limites). */
    public int labelAtIndex(int index) {
        return labels[index];
    }

    public RegionInfo region(int id) {
        if (id < LABEL_REGION_MIN) {
            return null;
        }
        ensureRegions();
        return byId.get(id);
    }

    /** Regioes presentes (id >= 2), em ordem crescente de id. */
    public List<RegionInfo> regions() {
        ensureRegions();
        return regions;
    }

    public boolean isFillable(int id) {
        RegionInfo info = region(id);
        return info != null && info.fillable;
    }

    public int[] copyLabels() {
        int[] out = new int[labels.length];
        for (int i = 0; i < labels.length; i++) {
            out[i] = labels[i];
        }
        return out;
    }

    private void ensureRegions() {
        if (regions != null) {
            return;
        }
        int max = 0;
        for (int i = 0; i < labels.length; i++) {
            if (labels[i] > max) {
                max = labels[i];
            }
        }
        int n = max + 1;
        int[] area = new int[n];
        int[] x0 = new int[n];
        int[] y0 = new int[n];
        int[] x1 = new int[n];
        int[] y1 = new int[n];
        for (int i = 0; i < n; i++) {
            x0[i] = Integer.MAX_VALUE;
            y0[i] = Integer.MAX_VALUE;
            x1[i] = -1;
            y1[i] = -1;
        }
        for (int y = 0; y < height; y++) {
            int row = y * width;
            for (int x = 0; x < width; x++) {
                int label = labels[row + x];
                if (label < LABEL_REGION_MIN) {
                    continue;
                }
                area[label]++;
                if (x < x0[label]) {
                    x0[label] = x;
                }
                if (x > x1[label]) {
                    x1[label] = x;
                }
                if (y < y0[label]) {
                    y0[label] = y;
                }
                if (y > y1[label]) {
                    y1[label] = y;
                }
            }
        }
        List<RegionInfo> list = new ArrayList<>();
        Map<Integer, RegionInfo> map = new HashMap<>();
        double pagePx = (double) width * height;
        for (int id = LABEL_REGION_MIN; id < n; id++) {
            if (area[id] == 0) {
                continue;
            }
            double pct = area[id] * 100.0 / pagePx;
            RegionInfo info = new RegionInfo(id, area[id], x0[id], y0[id],
                    x1[id] - x0[id] + 1, y1[id] - y0[id] + 1, pct, pct <= maxAreaPct);
            list.add(info);
            map.put(id, info);
        }
        this.regions = Collections.unmodifiableList(list);
        this.byId = map;
    }

    private static int le16(byte[] b, int o) {
        return (b[o] & 0xFF) | ((b[o + 1] & 0xFF) << 8);
    }

    private static int le32(byte[] b, int o) {
        return (b[o] & 0xFF)
                | ((b[o + 1] & 0xFF) << 8)
                | ((b[o + 2] & 0xFF) << 16)
                | ((b[o + 3] & 0xFF) << 24);
    }
}
