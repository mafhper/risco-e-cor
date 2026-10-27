package com.theomaria.draw.ui;

import android.graphics.Color;

/**
 * Papéis de cor do app. O material é o mesmo em toda tela: linho cru, nanquim
 * quente, lápis e — com parcimônia — pigmento e âmbar.
 *
 * <p>Claro/escuro é UMA preferência global (segue o aparelho por padrão). O tema
 * do perfil não toca nesta camada: ele define apenas os papéis de destaque
 * (container, on-container, primary) que a persona usa.
 */
public final class Palette {

    public final boolean dark;

    /** Fundo da tela (a parede de linho). */
    public final int bg;
    /** Superfície de cartão (o mesmo papel, um tom mais limpo). */
    public final int card;
    /** Superfície elevada (folhas, popovers). */
    public final int raised;
    /** Papel de desenho. */
    public final int paper;
    /** Mesa atrás do papel no canvas. */
    public final int desk;
    /** Grão da mesa (o ponto de 10% que dá textura ao linho/grafite). */
    public final int deskInk;

    public final int ink;
    public final int inkMuted;
    public final int border;
    public final int mutedSurface;

    /** Azul-pigmento: ação secundária e seleção. */
    public final int primary;
    public final int onPrimary;
    /** Âmbar: a única ação de criação. */
    public final int amber;
    public final int onAmber;
    /** Vinho: destruição. */
    public final int danger;
    public final int onDanger;

    private Palette(boolean dark, int bg, int card, int raised, int paper, int desk, int deskInk,
                    int ink, int inkMuted, int border, int mutedSurface,
                    int primary, int onPrimary, int amber, int onAmber,
                    int danger, int onDanger) {
        this.dark = dark;
        this.bg = bg;
        this.card = card;
        this.raised = raised;
        this.paper = paper;
        this.desk = desk;
        this.deskInk = deskInk;
        this.ink = ink;
        this.inkMuted = inkMuted;
        this.border = border;
        this.mutedSurface = mutedSurface;
        this.primary = primary;
        this.onPrimary = onPrimary;
        this.amber = amber;
        this.onAmber = onAmber;
        this.danger = danger;
        this.onDanger = onDanger;
    }

    private static final Palette LIGHT = new Palette(
            false,
            0xFFE8E1D1, // linho
            0xFFF2ECE0, // card
            0xFFF6F1E6, // popover
            0xFFFFFFFF, // papel
            0xFFF3EFE6, // mesa linho
            0xFF2A2724, // grão da mesa linho
            0xFF1C1B1A, // nanquim
            0xFF5A5550, // lápis
            0xFFCEC5B2,
            0xFFDDD5C4,
            0xFF2F6E8A, // pigmento
            0xFFFFFFFF,
            0xFFC47A2B, // âmbar
            0xFF1C1B1A,
            0xFF7B2D3A, // vinho
            0xFFFFF8F2);

    private static final Palette DARK = new Palette(
            true,
            0xFF1A1815,
            0xFF24211C,
            0xFF2A2621,
            0xFFFFFFFF,
            0xFF2A2B2E, // mesa grafite
            0xFFF2ECE0, // grão da mesa grafite
            0xFFEFE7D8,
            0xFFB7AE9E,
            0xFF3B352D,
            0xFF2E2A24,
            0xFF8FBDCC,
            0xFF10262E,
            0xFFD9A15E,
            0xFF1C1B1A,
            0xFFD98A94,
            0xFF2A1114);

    public static Palette of(boolean dark) {
        return dark ? DARK : LIGHT;
    }

    /** Tinta legível sobre uma cor qualquer (para selos de cor). */
    public int inkOn(int color) {
        double lum = luminance(color);
        return lum > 0.42 ? 0xFF1C1B1A : 0xFFFFFFFF;
    }

    /** Mistura uma cor com o fundo: superfícies suaves sem inventar token novo. */
    public int blend(int color, int with, float amount) {
        float a = Math.max(0f, Math.min(1f, amount));
        int r = (int) (Color.red(color) * (1 - a) + Color.red(with) * a);
        int g = (int) (Color.green(color) * (1 - a) + Color.green(with) * a);
        int b = (int) (Color.blue(color) * (1 - a) + Color.blue(with) * a);
        return Color.rgb(r, g, b);
    }

    public int alpha(int color, float alpha) {
        return (color & 0x00FFFFFF) | (((int) (alpha * 255)) << 24);
    }

    private static double luminance(int color) {
        double r = channel(Color.red(color));
        double g = channel(Color.green(color));
        double b = channel(Color.blue(color));
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    private static double channel(int v) {
        double c = v / 255.0;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
}
