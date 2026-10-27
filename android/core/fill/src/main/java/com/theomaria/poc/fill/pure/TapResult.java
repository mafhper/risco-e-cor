package com.theomaria.poc.fill.pure;

/**
 * Resultado de um toque. Imutavel na decisao; o retangulo sujo e preenchido por
 * {@link FillEngine#apply(TapResult, int[], int)} porque so existe depois de pintar.
 */
public final class TapResult {

    public enum Decision {
        /** Pintou direto no rotulo tocado. */
        FILL,
        /** Tocou no contorno e o snap achou uma regiao pintavel. */
        SNAP,
        /** Tocou o exterior (rotulo 1). */
        REJECT_BG,
        /** A regiao existe mas passa de {@code fillableMaxAreaPct}. */
        REJECT_AREA,
        /** Nada a fazer: contorno sem regiao no anel de snap, ou fora da pagina. */
        REJECT_NONE
    }

    public final Decision decision;
    public final int label;
    public final double areaPct;

    /** Coordenada original do toque. */
    public final int tapX;
    public final int tapY;

    /** Coordenada resolvida (igual ao toque, ou o pixel de snap). */
    public final int x;
    public final int y;

    /** bbox da regiao alvo; w=h=0 quando nao existe regiao. */
    public final int regionX;
    public final int regionY;
    public final int regionW;
    public final int regionH;

    /** Preenchidos por {@link FillEngine#apply}. */
    public int paintedPx;
    public int dirtyX;
    public int dirtyY;
    public int dirtyW;
    public int dirtyH;

    private TapResult(Decision decision, int label, double areaPct, int tapX, int tapY, int x, int y,
                      RegionInfo region) {
        this.decision = decision;
        this.label = label;
        this.areaPct = areaPct;
        this.tapX = tapX;
        this.tapY = tapY;
        this.x = x;
        this.y = y;
        if (region == null) {
            this.regionX = 0;
            this.regionY = 0;
            this.regionW = 0;
            this.regionH = 0;
        } else {
            this.regionX = region.x;
            this.regionY = region.y;
            this.regionW = region.w;
            this.regionH = region.h;
        }
    }

    static TapResult reject(Decision decision, int label, double areaPct, int tapX, int tapY) {
        return new TapResult(decision, label, areaPct, tapX, tapY, tapX, tapY, null);
    }

    static TapResult paint(Decision decision, int label, double areaPct, int tapX, int tapY,
                           int x, int y, RegionInfo region) {
        return new TapResult(decision, label, areaPct, tapX, tapY, x, y, region);
    }

    /** true quando a decisao muda pixels. */
    public boolean paints() {
        return decision == Decision.FILL || decision == Decision.SNAP;
    }

    public boolean isReject() {
        return !paints();
    }

    public String decisionName() {
        return decision.name();
    }

    @Override
    public String toString() {
        return decision.name() + " label=" + label
                + " area=" + String.format(java.util.Locale.ROOT, "%.3f%%", areaPct)
                + " tap=(" + tapX + "," + tapY + ") -> (" + x + "," + y + ")";
    }
}
