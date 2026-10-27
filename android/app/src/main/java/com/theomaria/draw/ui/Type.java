package com.theomaria.draw.ui;

import android.content.Context;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.util.TypedValue;
import android.widget.TextView;

import com.theomaria.draw.R;

/**
 * Tipografia do atelie. Os numeros saem da escala do mockup
 * (`src/styles.css`, utilities `type-*`), convertidos de rem para sp com raiz
 * de 16: 2.25rem = 36sp, 1.5rem = 24sp, 1.375rem = 22sp.
 *
 * <p>Tres familias, tres papeis: Fraunces no display (com os eixos SOFT/WONK
 * que dao o dente do papel), Geist na interface, IBM Plex Mono nos parametros
 * — o mono e o que da cara de instrumento ao painel. Todas OFL, empacotadas em
 * `res/font` e subset latin; se um arquivo faltar, o sans/serif do sistema
 * assume e o app continua legivel.
 */
public final class Type {

    /** Escala M3 publicada, copiada do mockup. Tamanho / altura de linha em sp. */
    public static final float DISPLAY_SM = 36f;
    public static final float DISPLAY_SM_LH = 44f;
    public static final float HEADLINE_SM = 24f;
    public static final float HEADLINE_SM_LH = 32f;
    public static final float TITLE_LG = 22f;
    public static final float TITLE_LG_LH = 28f;
    public static final float TITLE_MD = 16f;
    public static final float TITLE_MD_LH = 24f;
    public static final float TITLE_SM = 14f;
    public static final float TITLE_SM_LH = 20f;
    public static final float BODY_LG = 16f;
    public static final float BODY_LG_LH = 24f;
    public static final float BODY_MD = 14f;
    public static final float BODY_MD_LH = 20f;
    public static final float BODY_SM = 12f;
    public static final float BODY_SM_LH = 16f;
    public static final float LABEL_LG = 14f;
    public static final float LABEL_LG_LH = 20f;
    public static final float LABEL_MD = 12f;
    public static final float LABEL_MD_LH = 16f;
    public static final float LABEL_SM = 11f;
    public static final float LABEL_SM_LH = 16f;

    /** Tracking do mockup, em em (o mesmo que `letter-spacing` no CSS). */
    public static final float TRACK_DISPLAY = -0.01f;
    public static final float TRACK_BODY_MD = 0.017f;
    public static final float TRACK_BODY_SM = 0.033f;
    public static final float TRACK_LABEL_MD = 0.04f;
    public static final float TRACK_LABEL_SM = 0.06f;

    private static Typeface display;
    private static Typeface displayMedium;
    private static Typeface hand;
    private static Typeface ui;
    private static Typeface mono;

    private static boolean loaded;

    private Type() {
    }

    /** Carrega as fontes empacotadas. Idempotente e seguro antes de qualquer view. */
    public static void load(Context context) {
        if (loaded) {
            return;
        }
        loaded = true;
        display = font(context, R.font.fraunces_display, "serif");
        displayMedium = font(context, R.font.fraunces_display_medium, "serif");
        hand = font(context, R.font.fraunces_hand, "serif");
        ui = font(context, R.font.geist_ui, "sans-serif");
        mono = font(context, R.font.ibmplexmono_regular, "monospace");
    }

    private static Typeface font(Context context, int id, String fallback) {
        try {
            Typeface face = context.getResources().getFont(id);
            if (face != null) {
                return face;
            }
        } catch (RuntimeException e) {
            android.util.Log.w("MeuDesenho", "fonte " + id + " indisponivel: " + e.getMessage());
        }
        return Typeface.create(fallback, Typeface.NORMAL);
    }

    private static boolean ready() {
        return loaded && display != null && ui != null && mono != null;
    }

    public static Typeface display() {
        return ready() ? display : Typeface.create("serif", Typeface.NORMAL);
    }

    public static Typeface displayMedium() {
        return ready() ? displayMedium : Typeface.create("serif", Typeface.BOLD);
    }

    /** A etiqueta manuscrita: italico com SOFT 100 / WONK 1. */
    public static Typeface hand() {
        return ready() ? hand : Typeface.create("serif", Typeface.ITALIC);
    }

    public static Typeface sans() {
        return ready() ? ui : Typeface.create("sans-serif", Typeface.NORMAL);
    }

    public static Typeface sansMedium() {
        return weight(sans(), 500, Typeface.BOLD);
    }

    public static Typeface sansSemibold() {
        return weight(sans(), 600, Typeface.BOLD);
    }

    public static Typeface mono() {
        return ready() ? mono : Typeface.create("monospace", Typeface.NORMAL);
    }

    public static Typeface monoMedium() {
        return ready() ? weight(mono, 500, Typeface.BOLD) : Typeface.create("monospace", Typeface.BOLD);
    }

    private static Typeface weight(Typeface base, int wght, int fallbackStyle) {
        try {
            return Typeface.create(base, wght, false);
        } catch (RuntimeException e) {
            return Typeface.create(base, fallbackStyle);
        }
    }

    /**
     * Texto com tamanho, altura de linha e tracking declarados — nao "um pouco
     * maior": a altura de linha e aplicada como espacamento extra sobre a
     * metrica natural da fonte, entao o bloco mede o que o mockup mede.
     */
    public static TextView text(Context context, CharSequence value, float sizeSp,
                                float lineHeightSp, float trackingEm, Typeface face, int color) {
        TextView view = new TextView(context);
        view.setText(value);
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp);
        view.setTypeface(face);
        view.setTextColor(color);
        view.setIncludeFontPadding(false);
        if (trackingEm != 0f) {
            view.setLetterSpacing(trackingEm);
        }
        applyLineHeight(view, context, lineHeightSp);
        return view;
    }

    private static void applyLineHeight(TextView view, Context context, float lineHeightSp) {
        if (lineHeightSp <= 0f) {
            return;
        }
        Paint.FontMetrics metrics = view.getPaint().getFontMetrics();
        float natural = metrics.descent - metrics.ascent;
        float target = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_SP, lineHeightSp,
                context.getResources().getDisplayMetrics());
        view.setLineSpacing(target - natural, 1f);
    }
}
