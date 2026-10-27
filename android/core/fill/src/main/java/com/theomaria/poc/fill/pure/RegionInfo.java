package com.theomaria.poc.fill.pure;

import java.util.Locale;

/**
 * Metadado de uma regiao do mapa, derivado dos rotulos — nunca lido de um arquivo.
 *
 * <p>Fonte: {@code .dev/plans/poc-a-implementacao.md} §4.1 (formato do mapa) e §4.5 (algoritmo).
 */
public final class RegionInfo {

    public final int id;
    public final int areaPx;

    /** bbox inclusivo em pixels da pagina. */
    public final int x;
    public final int y;
    public final int w;
    public final int h;

    public final double areaPct;
    public final boolean fillable;

    public RegionInfo(int id, int areaPx, int x, int y, int w, int h, double areaPct, boolean fillable) {
        this.id = id;
        this.areaPx = areaPx;
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.areaPct = areaPct;
        this.fillable = fillable;
    }

    public int centerX() {
        return x + w / 2;
    }

    public int centerY() {
        return y + h / 2;
    }

    @Override
    public String toString() {
        return String.format(Locale.ROOT, "region %d area=%d (%.3f%%) bbox=[%d,%d,%d,%d]%s",
                id, areaPx, areaPct, x, y, w, h, fillable ? "" : " NAO-PINTAVEL");
    }
}
