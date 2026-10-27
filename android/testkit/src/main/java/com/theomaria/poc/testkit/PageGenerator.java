package com.theomaria.poc.testkit;

import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import javax.imageio.ImageIO;

/**
 * Rasteriza a pagina: contorno, flood-fill do exterior, componentes por semente, e grava
 * {@code .map} (uint16 LE), {@code .png} (8 bits, sem antialias) e {@code .json} (sidecar).
 *
 * <p>Implementacao <b>independente</b> do {@code :core:fill} de proposito: o teste de round-trip e
 * o teste de leitura no app viram cruzamento entre duas implementacoes do mesmo contrato, e nao
 * uma implementacao conferindo a si mesma.
 */
public final class PageGenerator {

    public static final int MAGIC = 0x50414D52;
    public static final int VERSION = 1;
    public static final int HEADER_BYTES = 16;
    public static final int LABEL_CONTOUR = 0;
    public static final int LABEL_EXTERIOR = 1;

    private PageGenerator() {
    }

    /** Metadado derivado do raster. */
    public static final class RegionStat {
        public final int id;
        public final int areaPx;
        public final int x;
        public final int y;
        public final int w;
        public final int h;
        public final double areaPct;

        RegionStat(int id, int areaPx, int x, int y, int w, int h, double areaPct) {
            this.id = id;
            this.areaPx = areaPx;
            this.x = x;
            this.y = y;
            this.w = w;
            this.h = h;
            this.areaPct = areaPct;
        }

        public String bboxText() {
            return x + "," + y + " " + w + "x" + h;
        }
    }

    /** Resultado do raster. */
    public static final class Rendered {
        public final PageSpec spec;
        public final char[] labels;
        private final List<RegionStat> regions;
        private final Map<Integer, RegionStat> byId;
        private final List<Integer> orphans;
        private final int inkPixels;
        private final int exteriorPixels;

        Rendered(PageSpec spec, char[] labels, List<RegionStat> regions, List<Integer> orphans,
                 int inkPixels, int exteriorPixels) {
            this.spec = spec;
            this.labels = labels;
            this.regions = Collections.unmodifiableList(regions);
            Map<Integer, RegionStat> map = new HashMap<>();
            for (RegionStat stat : regions) {
                map.put(stat.id, stat);
            }
            this.byId = map;
            this.orphans = Collections.unmodifiableList(orphans);
            this.inkPixels = inkPixels;
            this.exteriorPixels = exteriorPixels;
        }

        public int width() {
            return spec.width;
        }

        public int height() {
            return spec.height;
        }

        public int labelAt(int x, int y) {
            return labels[y * spec.width + x];
        }

        public RegionStat region(int id) {
            return byId.get(id);
        }

        public List<RegionStat> regions() {
            return regions;
        }

        /** Componentes de area sem semente declarada — deveria ser vazio. */
        public List<Integer> orphans() {
            return orphans;
        }

        public int inkPixels() {
            return inkPixels;
        }

        public int exteriorPixels() {
            return exteriorPixels;
        }
    }

    public static Rendered render(PageSpec spec) {
        final int w = spec.width;
        final int h = spec.height;
        final int n = w * h;
        final int stroke = spec.closingPx;

        boolean[] ink = new boolean[n];
        for (Shape shape : spec.shapes) {
            int reach = shape.reach(stroke);
            int x0 = Math.max(0, shape.cx - reach);
            int x1 = Math.min(w - 1, shape.cx + reach);
            int y0 = Math.max(0, shape.cy - reach);
            int y1 = Math.min(h - 1, shape.cy + reach);
            for (int y = y0; y <= y1; y++) {
                int row = y * w;
                for (int x = x0; x <= x1; x++) {
                    if (shape.isInk(x, y, stroke)) {
                        ink[row + x] = true;
                    }
                }
            }
        }
        for (int[] punch : spec.punches) {
            int x0 = Math.max(0, punch[0]);
            int x1 = Math.min(w - 1, punch[2]);
            int y0 = Math.max(0, punch[1]);
            int y1 = Math.min(h - 1, punch[3]);
            for (int y = y0; y <= y1; y++) {
                int row = y * w;
                for (int x = x0; x <= x1; x++) {
                    ink[row + x] = false;
                }
            }
        }

        // -2 = contorno, -1 = nao atribuido; qualquer valor >= 0 e rotulo final.
        int[] lab = new int[n];
        for (int i = 0; i < n; i++) {
            lab[i] = ink[i] ? -2 : -1;
        }

        int[] stack = new int[n];

        // Exterior: tudo que e alcancavel a partir da borda, andando em 4-conectividade.
        for (int x = 0; x < w; x++) {
            flood(lab, stack, w, h, x, 0, LABEL_EXTERIOR);
            flood(lab, stack, w, h, x, h - 1, LABEL_EXTERIOR);
        }
        for (int y = 0; y < h; y++) {
            flood(lab, stack, w, h, 0, y, LABEL_EXTERIOR);
            flood(lab, stack, w, h, w - 1, y, LABEL_EXTERIOR);
        }

        // Regioes: cada componente que contem a semente (centro) da forma recebe o id dela.
        // Se a lacuna fundiu a forma com o exterior, a semente ja vale 1 e o id desaparece — que e
        // exatamente o efeito que a pagina adversaria precisa provar.
        for (Shape shape : spec.shapes) {
            int seed = shape.cy * w + shape.cx;
            if (lab[seed] == -2) {
                throw new IllegalStateException("semente da forma " + shape.id + " caiu no contorno");
            }
            if (lab[seed] != -1) {
                continue;
            }
            flood(lab, stack, w, h, shape.cx, shape.cy, shape.id);
        }

        // Componentes sem semente: nao deveria existir; se existir, ganha id alto e e reportado.
        List<Integer> orphans = new ArrayList<>();
        int nextOrphan = 1000;
        for (int i = 0; i < n; i++) {
            if (lab[i] == -1) {
                int id = nextOrphan++;
                flood(lab, stack, w, h, i % w, i / w, id);
                orphans.add(id);
            }
        }

        char[] labels = new char[n];
        int inkCount = 0;
        int exteriorCount = 0;
        int maxLabel = 0;
        for (int i = 0; i < n; i++) {
            int value = lab[i];
            if (value == -2) {
                labels[i] = LABEL_CONTOUR;
                inkCount++;
            } else if (value == LABEL_EXTERIOR) {
                labels[i] = LABEL_EXTERIOR;
                exteriorCount++;
            } else {
                labels[i] = (char) value;
                if (value > maxLabel) {
                    maxLabel = value;
                }
            }
        }

        int[] area = new int[maxLabel + 1];
        int[] bx0 = new int[maxLabel + 1];
        int[] by0 = new int[maxLabel + 1];
        int[] bx1 = new int[maxLabel + 1];
        int[] by1 = new int[maxLabel + 1];
        for (int i = 0; i <= maxLabel; i++) {
            bx0[i] = Integer.MAX_VALUE;
            by0[i] = Integer.MAX_VALUE;
            bx1[i] = -1;
            by1[i] = -1;
        }
        for (int y = 0; y < h; y++) {
            int row = y * w;
            for (int x = 0; x < w; x++) {
                int id = labels[row + x];
                if (id < 2) {
                    continue;
                }
                area[id]++;
                if (x < bx0[id]) {
                    bx0[id] = x;
                }
                if (x > bx1[id]) {
                    bx1[id] = x;
                }
                if (y < by0[id]) {
                    by0[id] = y;
                }
                if (y > by1[id]) {
                    by1[id] = y;
                }
            }
        }

        List<RegionStat> regions = new ArrayList<>();
        double pagePx = (double) w * h;
        for (int id = 2; id <= maxLabel; id++) {
            if (area[id] == 0) {
                continue;
            }
            regions.add(new RegionStat(id, area[id], bx0[id], by0[id],
                    bx1[id] - bx0[id] + 1, by1[id] - by0[id] + 1, area[id] * 100.0 / pagePx));
        }

        assertNoBboxOverlap(regions);

        return new Rendered(spec, labels, regions, orphans, inkCount, exteriorCount);
    }

    /** Escreve os tres arquivos e devolve o raster. */
    public static Rendered write(PageSpec spec, File dir) throws IOException {
        Rendered rendered = render(spec);
        if (!dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new IOException("nao foi possivel criar " + dir);
        }
        writeMap(spec, rendered, new File(dir, spec.pageId + ".map"));
        writePng(spec, rendered, new File(dir, spec.pageId + ".png"));
        writeJson(spec, rendered, new File(dir, spec.pageId + ".json"));
        return rendered;
    }

    private static void flood(int[] lab, int[] stack, int w, int h, int sx, int sy, int id) {
        int start = sy * w + sx;
        if (lab[start] != -1) {
            return;
        }
        int sp = 0;
        lab[start] = id;
        stack[sp++] = start;
        while (sp > 0) {
            int index = stack[--sp];
            int x = index % w;
            int y = index / w;
            if (x > 0 && lab[index - 1] == -1) {
                lab[index - 1] = id;
                stack[sp++] = index - 1;
            }
            if (x + 1 < w && lab[index + 1] == -1) {
                lab[index + 1] = id;
                stack[sp++] = index + 1;
            }
            if (y > 0 && lab[index - w] == -1) {
                lab[index - w] = id;
                stack[sp++] = index - w;
            }
            if (y + 1 < h && lab[index + w] == -1) {
                lab[index + w] = id;
                stack[sp++] = index + w;
            }
        }
    }

    private static void assertNoBboxOverlap(List<RegionStat> regions) {
        for (int i = 0; i < regions.size(); i++) {
            RegionStat a = regions.get(i);
            for (int j = i + 1; j < regions.size(); j++) {
                RegionStat b = regions.get(j);
                boolean overlap = a.x < b.x + b.w && b.x < a.x + a.w
                        && a.y < b.y + b.h && b.y < a.y + a.h;
                if (overlap) {
                    throw new IllegalStateException("bbox das regioes " + a.id + " e " + b.id
                            + " se sobrepoem: [" + a.bboxText() + "] x [" + b.bboxText() + "]");
                }
            }
        }
    }

    private static void writeMap(PageSpec spec, Rendered rendered, File file) throws IOException {
        int n = spec.width * spec.height;
        byte[] data = new byte[HEADER_BYTES + 2 * n];
        putLe32(data, 0, MAGIC);
        putLe16(data, 4, VERSION);
        putLe16(data, 6, 0);
        putLe32(data, 8, spec.width);
        putLe32(data, 12, spec.height);
        int p = HEADER_BYTES;
        for (int i = 0; i < n; i++) {
            putLe16(data, p, rendered.labels[i]);
            p += 2;
        }
        Files.write(file.toPath(), data);
    }

    private static void writePng(PageSpec spec, Rendered rendered, File file) throws IOException {
        int n = spec.width * spec.height;
        BufferedImage image = new BufferedImage(spec.width, spec.height, BufferedImage.TYPE_INT_ARGB);
        int[] argb = new int[n];
        for (int i = 0; i < n; i++) {
            // Sem antialias de proposito: o oraculo do A3 compara "pixels do label" com "pixels
            // pintados"; fringe com alpha intermediario criaria mismatch de 1 px.
            argb[i] = rendered.labels[i] == LABEL_CONTOUR ? 0xFF000000 : 0x00000000;
        }
        image.setRGB(0, 0, spec.width, spec.height, argb, 0, spec.width);
        if (!ImageIO.write(image, "png", file)) {
            throw new IOException("nenhum writer PNG disponivel para " + file);
        }
    }

    private static void writeJson(PageSpec spec, Rendered rendered, File file) throws IOException {
        StringBuilder b = new StringBuilder(4096);
        b.append("{\n");
        b.append("  \"version\": ").append(VERSION).append(",\n");
        b.append("  \"pageId\": \"").append(spec.pageId).append("\",\n");
        b.append("  \"width\": ").append(spec.width).append(",\n");
        b.append("  \"height\": ").append(spec.height).append(",\n");
        b.append("  \"closingPx\": ").append(spec.closingPx).append(",\n");
        b.append("  \"fillableMaxAreaPct\": ")
                .append(String.format(Locale.ROOT, "%.1f", spec.fillableMaxAreaPct)).append(",\n");
        b.append("  \"regions\": [\n");
        List<RegionStat> regions = rendered.regions();
        for (int i = 0; i < regions.size(); i++) {
            RegionStat stat = regions.get(i);
            b.append("    {\"id\": ").append(stat.id)
                    .append(", \"areaPx\": ").append(stat.areaPx)
                    .append(", \"bbox\": [").append(stat.x).append(", ").append(stat.y)
                    .append(", ").append(stat.w).append(", ").append(stat.h).append(']')
                    .append(", \"fillable\": ").append(stat.areaPct <= spec.fillableMaxAreaPct)
                    .append('}');
            if (i + 1 < regions.size()) {
                b.append(',');
            }
            b.append('\n');
        }
        b.append("  ]\n");
        b.append("}\n");
        Files.write(file.toPath(), b.toString().getBytes(StandardCharsets.UTF_8));
    }

    private static void putLe16(byte[] b, int o, int value) {
        b[o] = (byte) (value & 0xFF);
        b[o + 1] = (byte) ((value >>> 8) & 0xFF);
    }

    private static void putLe32(byte[] b, int o, int value) {
        b[o] = (byte) (value & 0xFF);
        b[o + 1] = (byte) ((value >>> 8) & 0xFF);
        b[o + 2] = (byte) ((value >>> 16) & 0xFF);
        b[o + 3] = (byte) ((value >>> 24) & 0xFF);
    }
}
