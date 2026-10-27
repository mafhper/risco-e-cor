package com.theomaria.draw.ui;

/**
 * Os três temas de persona do MVP-0. Cada tema é só um conjunto de papéis de
 * destaque (container, on-container, primary); claro/escuro continua global.
 * Os valores vêm dos tokens medidos do mockup (oklch convertido para sRGB).
 */
public final class Themes {

    public static final String DINOS = "dinos";
    public static final String HEROI = "heroi";
    public static final String NEUTRO = "neutro";

    public final String id;
    public final String label;
    public final int containerLight;
    public final int onContainerLight;
    public final int primaryLight;
    public final int containerDark;
    public final int onContainerDark;
    public final int primaryDark;

    private Themes(String id, String label,
                   int containerLight, int onContainerLight, int primaryLight,
                   int containerDark, int onContainerDark, int primaryDark) {
        this.id = id;
        this.label = label;
        this.containerLight = containerLight;
        this.onContainerLight = onContainerLight;
        this.primaryLight = primaryLight;
        this.containerDark = containerDark;
        this.onContainerDark = onContainerDark;
        this.primaryDark = primaryDark;
    }

    public static final Themes DINOSAURS = new Themes(
            DINOS, "Dinossauros",
            0xFFF5DCF2, 0xFF562353, 0xFFAE53A8,
            0xFF653161, 0xFFF5DCF2, 0xFFD79ACC);

    public static final Themes HERO = new Themes(
            HEROI, "Herói",
            0xFFD1EDD9, 0xFF002C0F, 0xFF00883D,
            0xFF005129, 0xFFD1EDD9, 0xFF6FC08A);

    public static final Themes NEUTRAL = new Themes(
            NEUTRO, "Neutro",
            0xFFE1E5EB, 0xFF1C222B, 0xFF56647A,
            0xFF2C3440, 0xFFE1E5EB, 0xFF9AA7B8);

    public static Themes byId(String id) {
        if (DINOS.equals(id)) {
            return DINOSAURS;
        }
        if (HEROI.equals(id)) {
            return HERO;
        }
        return NEUTRAL;
    }

    public int container(boolean dark) {
        return dark ? containerDark : containerLight;
    }

    public int onContainer(boolean dark) {
        return dark ? onContainerDark : onContainerLight;
    }

    public int primary(boolean dark) {
        return dark ? primaryDark : primaryLight;
    }
}
