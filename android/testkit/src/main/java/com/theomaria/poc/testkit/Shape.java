package com.theomaria.poc.testkit;

import java.util.Locale;

/**
 * Uma forma do line-art sintetico. As medidas {@code a}/{@code b} sao <b>raio / meia-medida</b>,
 * como na tabela do §5 da especificacao (um retangulo "350x350" tem 700 px de lado).
 */
public final class Shape {

    public enum Kind { CIRCLE, RECT, DIAMOND }

    public final int id;
    public final Kind kind;
    public final int cx;
    public final int cy;
    public final int a;
    public final int b;

    private Shape(int id, Kind kind, int cx, int cy, int a, int b) {
        this.id = id;
        this.kind = kind;
        this.cx = cx;
        this.cy = cy;
        this.a = a;
        this.b = b;
    }

    public static Shape circle(int id, int cx, int cy, int r) {
        return new Shape(id, Kind.CIRCLE, cx, cy, r, r);
    }

    /** @param halfW meia-largura @param halfH meia-altura */
    public static Shape rect(int id, int cx, int cy, int halfW, int halfH) {
        return new Shape(id, Kind.RECT, cx, cy, halfW, halfH);
    }

    public static Shape diamond(int id, int cx, int cy, int r) {
        return new Shape(id, Kind.DIAMOND, cx, cy, r, r);
    }

    /** Pixel de contorno: fora do interior da forma e dentro da faixa de {@code stroke} px. */
    public boolean isInk(int x, int y, int stroke) {
        int dx = x - cx;
        int dy = y - cy;
        switch (kind) {
            case CIRCLE: {
                long d2 = (long) dx * dx + (long) dy * dy;
                long inner = (long) a * a;
                long outer = (long) (a + stroke) * (a + stroke);
                return d2 > inner && d2 <= outer;
            }
            case RECT: {
                int ax = Math.abs(dx);
                int ay = Math.abs(dy);
                boolean inside = ax <= a && ay <= b;
                boolean within = ax <= a + stroke && ay <= b + stroke;
                return within && !inside;
            }
            case DIAMOND: {
                int manhattan = Math.abs(dx) + Math.abs(dy);
                return manhattan > a && manhattan <= a + stroke;
            }
            default:
                return false;
        }
    }

    /** Margem para varrer o bbox da faixa. */
    public int reach(int stroke) {
        return Math.max(a, b) + stroke + 1;
    }

    public double idealAreaPx() {
        switch (kind) {
            case CIRCLE:
                return Math.PI * a * a;
            case RECT:
                return 4.0 * a * b;
            case DIAMOND:
                return 2.0 * a * a;
            default:
                return 0;
        }
    }

    public String describe() {
        switch (kind) {
            case CIRCLE:
                return String.format(Locale.ROOT, "circulo r=%d", a);
            case RECT:
                return String.format(Locale.ROOT, "retangulo %dx%d", a, b);
            case DIAMOND:
                return String.format(Locale.ROOT, "losango r=%d", a);
            default:
                return "?";
        }
    }
}
