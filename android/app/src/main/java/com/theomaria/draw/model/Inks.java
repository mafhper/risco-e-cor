package com.theomaria.draw.model;

/** As seis cores grandes do MVP-0. Cor é conteúdo, não tema de interface. */
public final class Inks {

    public static final int PAPER = 0xFFFFFFFF;
    public static final int INK = 0xFF23252A;

    public static final int[] SIX = {
            0xFFF72633, // vermelho
            0xFFF65C00, // laranja
            0xFFD99B00, // amarelo
            0xFF00B139, // verde
            0xFF2B7FFF, // azul
            0xFFAB44FF  // roxo
    };

    public static final String[] NAMES = {
            "vermelho", "laranja", "amarelo", "verde", "azul", "roxo"
    };

    private Inks() {
    }

    public static String nameOf(int color) {
        for (int i = 0; i < SIX.length; i++) {
            if (SIX[i] == color) {
                return NAMES[i];
            }
        }
        return "cor";
    }
}
