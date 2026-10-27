package com.theomaria.poc.testkit;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Especificacao de uma pagina sintetica. As duas paginas do POC-A estao aqui, com as geometrias
 * conferidas a mao no §5 de {@code .dev/plans/poc-a-implementacao.md}.
 */
public final class PageSpec {

    public final String pageId;
    public final int width;
    public final int height;
    public final int closingPx;
    public final double fillableMaxAreaPct;
    public final List<Shape> shapes;

    /** Retangulos inclusivos {x0,y0,x1,y1} que removem contorno — a lacuna da pagina adversaria. */
    public final List<int[]> punches;

    public PageSpec(String pageId, int width, int height, int closingPx, double fillableMaxAreaPct,
                    List<Shape> shapes, List<int[]> punches) {
        this.pageId = pageId;
        this.width = width;
        this.height = height;
        this.closingPx = closingPx;
        this.fillableMaxAreaPct = fillableMaxAreaPct;
        this.shapes = Collections.unmodifiableList(new ArrayList<>(shapes));
        this.punches = Collections.unmodifiableList(new ArrayList<>(punches));
    }

    /**
     * Pagina de controle: 8 regioes fechadas, todas abaixo de 40% da pagina, cobrindo as tres
     * classes de area. Contorno de 9 px. Soma ~47,9% — sobra exterior para o path de REJECT_BG.
     */
    public static PageSpec pagePoc() {
        List<Shape> shapes = new ArrayList<>();
        shapes.add(Shape.circle(2, 200, 140, 80));
        shapes.add(Shape.rect(3, 200, 380, 90, 70));
        shapes.add(Shape.circle(4, 200, 620, 150));
        shapes.add(Shape.diamond(5, 200, 880, 100));
        shapes.add(Shape.circle(6, 730, 512, 290));
        shapes.add(Shape.rect(7, 730, 120, 240, 70));
        shapes.add(Shape.circle(8, 730, 930, 90));
        shapes.add(Shape.diamond(9, 950, 930, 70));
        return new PageSpec("page_poc", 1024, 1024, 9, 40.0, shapes, Collections.emptyList());
    }

    /**
     * Pagina adversaria: prova o caminho de rejeicao sem conteudo licenciado.
     * <ul>
     *   <li>2 — retangulo 700x700 (46,7%) fechado: REJECT_AREA;</li>
     *   <li>3 — circulo r=55 com lacuna de 1 px de largura em (156..164, 100): funde com o exterior,
     *       o rotulo 3 desaparece;</li>
     *   <li>4 — circulo r=60 fechado: controle pintavel.</li>
     * </ul>
     */
    public static PageSpec adversarial() {
        List<Shape> shapes = new ArrayList<>();
        shapes.add(Shape.rect(2, 512, 512, 350, 350));
        shapes.add(Shape.circle(3, 100, 100, 55));
        shapes.add(Shape.circle(4, 930, 930, 60));
        List<int[]> punches = new ArrayList<>();
        // A faixa de contorno do circulo 3 em y=100 cobre x=156..164 (55 < d <= 64).
        punches.add(new int[]{156, 100, 164, 100});
        return new PageSpec("page_adversarial", 1024, 1024, 9, 40.0, shapes, punches);
    }
}
