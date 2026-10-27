package com.theomaria.poc.testkit;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Locale;

/**
 * Ponto de entrada do {@code :testkit:generateContent}: grava {@code content/*.map|.png|.json}
 * e imprime a tabela de areas que o relatorio cita.
 */
public final class Main {

    private Main() {
    }

    public static void main(String[] args) throws Exception {
        File dir = new File(args.length > 0 ? args[0] : "content");
        if (!dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new IOException("nao foi possivel criar " + dir);
        }
        System.out.println("content = " + dir.getAbsolutePath());

        int problems = 0;
        PageSpec[] specs = {PageSpec.pagePoc(), PageSpec.adversarial()};
        for (PageSpec spec : specs) {
            PageGenerator.Rendered rendered = PageGenerator.write(spec, dir);
            print(spec, rendered);
            if (!rendered.orphans().isEmpty()) {
                problems++;
                System.out.println("  ATENCAO: componentes sem semente: " + rendered.orphans());
            }
        }

        System.out.println();
        for (String name : new String[]{"page_poc", "page_adversarial"}) {
            for (String ext : new String[]{".map", ".png", ".json"}) {
                File f = new File(dir, name + ext);
                System.out.printf(Locale.ROOT, "  %-28s %9d B%n", f.getName(), f.length());
            }
        }
        if (problems > 0) {
            throw new IllegalStateException("geracao com " + problems + " problema(s)");
        }
    }

    private static void print(PageSpec spec, PageGenerator.Rendered rendered) {
        double pagePx = (double) spec.width * spec.height;
        int regionPx = 0;
        for (PageGenerator.RegionStat stat : rendered.regions()) {
            regionPx += stat.areaPx;
        }
        System.out.println();
        System.out.printf(Locale.ROOT,
                "== %s %dx%d · contorno %d px · %d regioes · contorno %d px · exterior %d px "
                        + "(regioes %.2f%% da pagina)%n",
                spec.pageId, spec.width, spec.height, spec.closingPx, rendered.regions().size(),
                rendered.inkPixels(), rendered.exteriorPixels(), regionPx * 100.0 / pagePx);
        System.out.println("   id  forma                areaPx    areaPct   bbox            fillable");
        for (PageGenerator.RegionStat stat : rendered.regions()) {
            boolean fillable = stat.areaPct <= spec.fillableMaxAreaPct;
            System.out.printf(Locale.ROOT, "   %-3d %-19s %7d  %7.3f%%  %-14s %s%n",
                    stat.id, shapeName(spec, stat.id), stat.areaPx, stat.areaPct,
                    stat.bboxText(), fillable ? "sim" : "NAO (>limiar)");
        }
        List<PageGenerator.RegionStat> regions = rendered.regions();
        if (regions.isEmpty()) {
            System.out.println("   (nenhuma regiao)");
        }
    }

    private static String shapeName(PageSpec spec, int id) {
        for (Shape shape : spec.shapes) {
            if (shape.id == id) {
                return shape.describe();
            }
        }
        return "?";
    }
}
