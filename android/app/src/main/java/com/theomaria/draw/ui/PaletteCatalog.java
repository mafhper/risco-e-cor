package com.theomaria.draw.ui;

/**
 * Catalogo de cores do atelie: 18 familias (15 cromaticas + 3 neutras) x 11
 * degraus (50..950), mais preto e branco. Arquivo GERADO por
 * `tools/gen-palette.mjs` a partir do `palette.ts` do protótipo —
 * nao editar a mao: rode o script e o diff mostra o que mudou.
 *
 * <p>Os degraus sao os ramps publicados do Tailwind v4 em oklch, convertidos
 * para sRGB com o mesmo arredondamento do mockup; o nome de cada amostra sai
 * do proprio oklch (palavra de matiz + tom), entao "vermelho" nunca aponta
 * para um rosa.
 */
public final class PaletteCatalog {

    public static final int[] SCALE_STEPS = {50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950};

    /** Uma familia de matiz: rotulo, 11 tons e o nome falado de cada tom. */
    public static final class Family {
        public final String id;
        public final String label;
        public final int[] steps;
        public final String[] names;

        Family(String id, String label, int[] steps, String[] names) {
            this.id = id;
            this.label = label;
            this.steps = steps;
            this.names = names;
        }

        public int base() {
            return steps[5];
        }
    }

    private static final int[] VERMELHO_STEPS = {
            0xFFFEF2F2, 0xFFFFE2E2, 0xFFFFC9C9, 0xFFFFA2A2, 0xFFFF6467, 0xFFFB2C36,
            0xFFE7000B, 0xFFC10007, 0xFF9F0712, 0xFF82181A, 0xFF460809,
    };
    private static final String[] VERMELHO_NAMES = {
            "vermelho-bem-claro", "vermelho-bem-claro", "vermelho-bem-claro", "coral-claro", "coral",
            "vermelho", "vermelho", "vermelho-escuro", "vermelho-bem-escuro", "vinho",
            "vinho",
    };

    private static final int[] LARANJA_STEPS = {
            0xFFFFF7ED, 0xFFFFEDD4, 0xFFFFD6A7, 0xFFFFB86A, 0xFFFF8904, 0xFFFF6900,
            0xFFF54900, 0xFFCA3500, 0xFF9F2D00, 0xFF7E2A0C, 0xFF441306,
    };
    private static final String[] LARANJA_NAMES = {
            "laranja-bem-claro", "laranja-bem-claro", "laranja-bem-claro", "laranja-claro", "laranja",
            "laranja", "laranja", "laranja-escuro", "laranja-bem-escuro", "laranja-bem-escuro",
            "marrom",
    };

    private static final int[] AMBAR_STEPS = {
            0xFFFFFBEB, 0xFFFEF3C6, 0xFFFEE685, 0xFFFFD230, 0xFFFFB900, 0xFFFE9A00,
            0xFFE17100, 0xFFBB4D00, 0xFF973C00, 0xFF7B3306, 0xFF461901,
    };
    private static final String[] AMBAR_NAMES = {
            "âmbar-bem-claro", "âmbar-bem-claro", "âmbar-claro", "âmbar-claro", "âmbar",
            "âmbar", "âmbar-escuro", "âmbar-bem-escuro", "âmbar-bem-escuro", "âmbar-bem-escuro",
            "marrom",
    };

    private static final int[] AMARELO_STEPS = {
            0xFFFEFCE8, 0xFFFEF9C2, 0xFFFFF085, 0xFFFFDF20, 0xFFFDC700, 0xFFF0B100,
            0xFFD08700, 0xFFA65F00, 0xFF894B00, 0xFF733E0A, 0xFF432004,
    };
    private static final String[] AMARELO_NAMES = {
            "amarelo-bem-claro", "amarelo-claro", "amarelo-claro", "amarelo-claro", "amarelo",
            "amarelo", "amarelo-escuro", "amarelo-bem-escuro", "amarelo-bem-escuro", "amarelo-bem-escuro",
            "marrom",
    };

    private static final int[] LIMA_STEPS = {
            0xFFF7FEE7, 0xFFECFCCA, 0xFFD8F999, 0xFFBBF451, 0xFF9AE600, 0xFF7CCF00,
            0xFF5EA500, 0xFF497D00, 0xFF3C6300, 0xFF35530E, 0xFF192E03,
    };
    private static final String[] LIMA_NAMES = {
            "lima-bem-clara", "lima-bem-clara", "lima-clara", "lima-clara", "lima",
            "lima", "lima-escura", "lima-bem-escura", "lima-bem-escura", "lima-bem-escura",
            "lima-bem-escura",
    };

    private static final int[] VERDE_STEPS = {
            0xFFF0FDF4, 0xFFDCFCE7, 0xFFB9F8CF, 0xFF7BF1A8, 0xFF05DF72, 0xFF00C950,
            0xFF00A63E, 0xFF008236, 0xFF016630, 0xFF0D542B, 0xFF032E15,
    };
    private static final String[] VERDE_NAMES = {
            "verde-bem-claro", "verde-bem-claro", "verde-bem-claro", "verde-claro", "verde",
            "verde", "verde-escuro", "verde-bem-escuro", "verde-bem-escuro", "verde-bem-escuro",
            "verde-bem-escuro",
    };

    private static final int[] ESMERALDA_STEPS = {
            0xFFECFDF5, 0xFFD0FAE5, 0xFFA4F4CF, 0xFF5EE9B5, 0xFF00D492, 0xFF00BC7D,
            0xFF009966, 0xFF007A55, 0xFF006045, 0xFF004F3B, 0xFF002C22,
    };
    private static final String[] ESMERALDA_NAMES = {
            "esmeralda-bem-clara", "esmeralda-bem-clara", "esmeralda-bem-clara", "esmeralda-clara", "esmeralda",
            "esmeralda", "esmeralda-escura", "esmeralda-bem-escura", "esmeralda-bem-escura", "esmeralda-bem-escura",
            "esmeralda-bem-escura",
    };

    private static final int[] TEAL_STEPS = {
            0xFFF0FDFA, 0xFFCBFBF1, 0xFF96F7E4, 0xFF46ECD5, 0xFF00D5BE, 0xFF00BBA7,
            0xFF009689, 0xFF00786F, 0xFF005F5A, 0xFF0B4F4A, 0xFF022F2E,
    };
    private static final String[] TEAL_NAMES = {
            "turquesa-bem-clara", "turquesa-bem-clara", "turquesa-bem-clara", "turquesa-clara", "turquesa",
            "turquesa", "turquesa-escura", "turquesa-bem-escura", "turquesa-bem-escura", "turquesa-bem-escura",
            "turquesa-bem-escura",
    };

    private static final int[] CIANO_STEPS = {
            0xFFECFEFF, 0xFFCEFAFE, 0xFFA2F4FD, 0xFF53EAFD, 0xFF00D3F2, 0xFF00B8DB,
            0xFF0092B8, 0xFF007595, 0xFF005F78, 0xFF104E64, 0xFF053345,
    };
    private static final String[] CIANO_NAMES = {
            "ciano-bem-claro", "ciano-bem-claro", "ciano-bem-claro", "ciano-claro", "ciano",
            "ciano", "ciano-escuro", "ciano-bem-escuro", "ciano-bem-escuro", "ciano-bem-escuro",
            "ciano-bem-escuro",
    };

    private static final int[] CEU_STEPS = {
            0xFFF0F9FF, 0xFFDFF2FE, 0xFFB8E6FE, 0xFF74D4FF, 0xFF00BCFF, 0xFF00A6F4,
            0xFF0084D1, 0xFF0069A8, 0xFF00598A, 0xFF024A70, 0xFF052F4A,
    };
    private static final String[] CEU_NAMES = {
            "céu-bem-claro", "céu-bem-claro", "céu-bem-claro", "céu-claro", "céu",
            "céu", "céu-escuro", "céu-bem-escuro", "céu-bem-escuro", "céu-bem-escuro",
            "céu-bem-escuro",
    };

    private static final int[] AZUL_STEPS = {
            0xFFEFF6FF, 0xFFDBEAFE, 0xFFBEDBFF, 0xFF8EC5FF, 0xFF51A2FF, 0xFF2B7FFF,
            0xFF155DFC, 0xFF1447E6, 0xFF193CB8, 0xFF1C398E, 0xFF162456,
    };
    private static final String[] AZUL_NAMES = {
            "azul-bem-claro", "azul-bem-claro", "azul-bem-claro", "azul-bem-claro", "azul-claro",
            "azul", "azul-escuro", "azul-escuro", "azul-bem-escuro", "azul-bem-escuro",
            "azul-bem-escuro",
    };

    private static final int[] INDIGO_STEPS = {
            0xFFEEF2FF, 0xFFE0E7FF, 0xFFC6D2FF, 0xFFA3B3FF, 0xFF7C86FF, 0xFF615FFF,
            0xFF4F39F6, 0xFF432DD7, 0xFF372AAC, 0xFF312C85, 0xFF1E1A4D,
    };
    private static final String[] INDIGO_NAMES = {
            "índigo-bem-claro", "índigo-bem-claro", "índigo-bem-claro", "índigo-bem-claro", "índigo-claro",
            "índigo", "índigo-escuro", "índigo-escuro", "índigo-bem-escuro", "índigo-bem-escuro",
            "índigo-bem-escuro",
    };

    private static final int[] VIOLETA_STEPS = {
            0xFFF5F3FF, 0xFFEDE9FE, 0xFFDDD6FF, 0xFFC4B4FF, 0xFFA684FF, 0xFF8E51FF,
            0xFF7F22FE, 0xFF7008E7, 0xFF5D0EC0, 0xFF4D179A, 0xFF2F0D68,
    };
    private static final String[] VIOLETA_NAMES = {
            "violeta-bem-clara", "violeta-bem-clara", "violeta-bem-clara", "violeta-bem-clara", "violeta-clara",
            "violeta", "violeta-escura", "violeta-escura", "violeta-bem-escura", "violeta-bem-escura",
            "violeta-bem-escura",
    };

    private static final int[] ROXO_STEPS = {
            0xFFFAF5FF, 0xFFF3E8FF, 0xFFE9D4FF, 0xFFDAB2FF, 0xFFC27AFF, 0xFFAD46FF,
            0xFF9810FA, 0xFF8200DB, 0xFF6E11B0, 0xFF59168B, 0xFF3C0366,
    };
    private static final String[] ROXO_NAMES = {
            "roxo-bem-claro", "roxo-bem-claro", "roxo-bem-claro", "roxo-bem-claro", "roxo-claro",
            "roxo", "roxo-escuro", "roxo-escuro", "roxo-bem-escuro", "roxo-bem-escuro",
            "roxo-bem-escuro",
    };

    private static final int[] ROSA_STEPS = {
            0xFFFDF2F8, 0xFFFCE7F3, 0xFFFCCEE8, 0xFFFDA5D5, 0xFFFB64B6, 0xFFF6339A,
            0xFFE60076, 0xFFC6005C, 0xFFA3004C, 0xFF861043, 0xFF510424,
    };
    private static final String[] ROSA_NAMES = {
            "rosa-bem-clara", "rosa-bem-clara", "rosa-bem-clara", "rosa-clara", "rosa",
            "rosa", "rosa-escura", "rosa-escura", "rosa-bem-escura", "rosa-bem-escura",
            "vinho",
    };

    private static final int[] ARDOSIA_STEPS = {
            0xFFF8FAFC, 0xFFF1F5F9, 0xFFE2E8F0, 0xFFCAD5E2, 0xFF90A1B9, 0xFF62748E,
            0xFF45556C, 0xFF314158, 0xFF1D293D, 0xFF0F172B, 0xFF020618,
    };
    private static final String[] ARDOSIA_NAMES = {
            "branco", "branco", "cinza-claro", "cinza-claro", "cinza",
            "cinza", "grafite", "grafite", "preto", "preto",
            "preto",
    };

    private static final int[] CINZA_STEPS = {
            0xFFF9FAFB, 0xFFF3F4F6, 0xFFE5E7EB, 0xFFD1D5DC, 0xFF99A1AF, 0xFF6A7282,
            0xFF4A5565, 0xFF364153, 0xFF1E2939, 0xFF101828, 0xFF030712,
    };
    private static final String[] CINZA_NAMES = {
            "branco", "branco", "cinza-claro", "cinza-claro", "cinza",
            "cinza", "grafite", "grafite", "preto", "preto",
            "preto",
    };

    private static final int[] PEDRA_STEPS = {
            0xFFFAFAF9, 0xFFF5F5F4, 0xFFE7E5E4, 0xFFD6D3D1, 0xFFA6A09B, 0xFF79716B,
            0xFF57534D, 0xFF44403B, 0xFF292524, 0xFF1C1917, 0xFF0C0A09,
    };
    private static final String[] PEDRA_NAMES = {
            "branco", "branco", "cinza-claro", "cinza-claro", "cinza",
            "cinza", "grafite", "grafite", "preto", "preto",
            "preto",
    };

    /** As 18 familias, na ordem do mockup (matiz crescente, neutras no fim). */
    public static final Family[] FAMILIES = {
            new Family("vermelho", "Vermelho", VERMELHO_STEPS, VERMELHO_NAMES),
            new Family("laranja", "Laranja", LARANJA_STEPS, LARANJA_NAMES),
            new Family("ambar", "Âmbar", AMBAR_STEPS, AMBAR_NAMES),
            new Family("amarelo", "Amarelo", AMARELO_STEPS, AMARELO_NAMES),
            new Family("lima", "Lima", LIMA_STEPS, LIMA_NAMES),
            new Family("verde", "Verde", VERDE_STEPS, VERDE_NAMES),
            new Family("esmeralda", "Esmeralda", ESMERALDA_STEPS, ESMERALDA_NAMES),
            new Family("teal", "Turquesa", TEAL_STEPS, TEAL_NAMES),
            new Family("ciano", "Ciano", CIANO_STEPS, CIANO_NAMES),
            new Family("ceu", "Céu", CEU_STEPS, CEU_NAMES),
            new Family("azul", "Azul", AZUL_STEPS, AZUL_NAMES),
            new Family("indigo", "Índigo", INDIGO_STEPS, INDIGO_NAMES),
            new Family("violeta", "Violeta", VIOLETA_STEPS, VIOLETA_NAMES),
            new Family("roxo", "Roxo", ROXO_STEPS, ROXO_NAMES),
            new Family("rosa", "Rosa", ROSA_STEPS, ROSA_NAMES),
            new Family("ardosia", "Ardósia", ARDOSIA_STEPS, ARDOSIA_NAMES),
            new Family("cinza", "Cinza", CINZA_STEPS, CINZA_NAMES),
            new Family("pedra", "Pedra", PEDRA_STEPS, PEDRA_NAMES),
    };

    /** As seis cores rapidas do dock compacto: uma de cada canto do espectro. */
    public static final int[] QUICK = {0xFFFB2C36, 0xFFF0B100, 0xFF00C950, 0xFF00B8DB, 0xFF2B7FFF, 0xFFAD46FF};

    /** As seis cores grandes da faixa 3-5. */
    public static final int[] KIDS = {0xFFFB2C36, 0xFFFF6900, 0xFFF0B100, 0xFF00C950, 0xFF2B7FFF, 0xFFAD46FF};

    /** Branco, tres cinzas e preto: os neutros da bandeja. */
    public static final int[] NEUTRALS = {0xFFFFFFFF, 0xFFE5E7EB, 0xFF99A1AF, 0xFF4A5565, 0xFF000000};
    public static final String[] NEUTRAL_NAMES = {"branco", "cinza-claro", "cinza", "grafite", "preto"};

    /** Os 15 matizes de base, na ordem da barra de espectro. */
    public static final int[] SPECTRUM = {0xFFFB2C36, 0xFFFF6900, 0xFFFE9A00, 0xFFF0B100, 0xFF7CCF00, 0xFF00C950, 0xFF00BC7D, 0xFF00BBA7, 0xFF00B8DB, 0xFF00A6F4, 0xFF2B7FFF, 0xFF615FFF, 0xFF8E51FF, 0xFFAD46FF, 0xFFF6339A};

    private PaletteCatalog() {
    }

    public static Family byId(String id) {
        for (Family family : FAMILIES) {
            if (family.id.equals(id)) {
                return family;
            }
        }
        return FAMILIES[0];
    }

    /** Nome falado de uma cor do catalogo (fallback: "cor"). */
    public static String nameOf(int color) {
        for (Family family : FAMILIES) {
            for (int i = 0; i < family.steps.length; i++) {
                if (family.steps[i] == color) {
                    return family.names[i];
                }
            }
        }
        for (int i = 0; i < NEUTRALS.length; i++) {
            if (NEUTRALS[i] == color) {
                return NEUTRAL_NAMES[i];
            }
        }
        return "cor";
    }

    /** Indice do degrau de uma cor dentro da familia, ou -1. */
    public static int stepOf(Family family, int color) {
        for (int i = 0; i < family.steps.length; i++) {
            if (family.steps[i] == color) {
                return i;
            }
        }
        return -1;
    }
}
