package com.theomaria.draw.ui;

import android.content.Context;
import android.content.res.ColorStateList;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.theomaria.draw.R;

import java.util.List;

/**
 * Peças de interface do ateliê: papel sobre papel, borda de 1 px em vez de
 * sombra difusa, tipografia serifada no display e sans no resto.
 */
public final class Ui {

    /** Raio unico do atelie (mockup `--radius`): um valor, nao uma escala. */
    public static final float RADIUS = 6f;
    /** Cartao de peca / persona (`--radius-card`). */
    public static final float RADIUS_CARD = 12f;
    /** Folha e dialogo (`--radius-sheet`). */
    public static final float RADIUS_SHEET = 28f;
    /** Pilula. */
    public static final float RADIUS_PILL = 999f;
    /** Cartao kids: 28 e o raio de folha; o que fica a 8 dp usa 20 (= 28 - 8). */
    public static final float RADIUS_KIDS = 28f;
    /** Inset do cartao kids: o raio interno sai dele, nunca de um valor solto. */
    public static final float RADIUS_KIDS_INSET = 8f;
    /** Raio interno concentrico do cartao kids. */
    public static final float RADIUS_KIDS_INNER = 20f;

    /**
     * Raio concentrico: um filho a {@code insetDp} da borda de um container com
     * {@code outerDp} tem o raio de fora menos o inset. Dois raios iguais aninhados
     * leem como canto "pontudo" no de dentro.
     */
    public static float concentric(float outerDp, float insetDp) {
        return Math.max(0f, outerDp - insetDp);
    }

    /** Margem da mesa em volta do papel (mockup: 10 dp no pro). */
    public static final float DESK_PAD = 10f;
    /** Distancia do dock a borda inferior (`--dock-gap`). */
    public static final float DOCK_GAP = 12f;
    /** Altura da pilula do dock (`--dock-pill-height`). */
    public static final float DOCK_PILL_H = 48f;
    /** Folga entre o dock e o HUD de zoom. O mockup usa 8; aqui 12 por aceite. */
    public static final float DOCK_HUD_GAP = 12f;

    private Ui() {
    }

    /** Carrega as fontes OFL empacotadas (uma vez por processo). */
    public static void loadFonts(Context context) {
        Type.load(context);
    }

    public static int dp(Context context, float value) {
        return Math.round(value * context.getResources().getDisplayMetrics().density);
    }

    public static float dpf(Context context, float value) {
        return value * context.getResources().getDisplayMetrics().density;
    }

    public static Typeface display() {
        return Type.display();
    }

    public static Typeface displayMedium() {
        return Type.displayMedium();
    }

    /** Etiqueta manuscrita (Fraunces italico, SOFT 100 / WONK 1). */
    public static Typeface hand() {
        return Type.hand();
    }

    public static Typeface sans() {
        return Type.sans();
    }

    public static Typeface sansMedium() {
        return Type.sansMedium();
    }

    public static Typeface sansBold() {
        return Type.sansSemibold();
    }

    public static Typeface mono() {
        return Type.mono();
    }

    public static Typeface monoMedium() {
        return Type.monoMedium();
    }

    public static TextView text(Context context, CharSequence value, float sizeSp,
                                Typeface face, int color) {
        return Type.text(context, value, sizeSp, 0f, 0f, face, color);
    }

    /** Texto com a escala do mockup: tamanho, altura de linha e tracking. */
    public static TextView typed(Context context, CharSequence value, float sizeSp,
                                 float lineHeightSp, float trackingEm, Typeface face, int color) {
        return Type.text(context, value, sizeSp, lineHeightSp, trackingEm, face, color);
    }

    /** `type-label-md`: o rotulo de secao do mockup, em caixa baixa. */
    public static TextView sectionLabel(Context context, CharSequence value, int color) {
        return typed(context, value, Type.LABEL_MD, Type.LABEL_MD_LH, Type.TRACK_LABEL_MD,
                sansMedium(), color);
    }

    /** Rótulo pequeno em caixa alta e tracking aberto (o "instrumento" do painel). */
    public static TextView label(Context context, CharSequence value, int color) {
        TextView view = text(context, value, 11.5f, sansBold(), color);
        view.setAllCaps(true);
        view.setLetterSpacing(0.09f);
        return view;
    }

    public static GradientDrawable rounded(int fill, float radiusPx, int stroke, float strokePx) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setColor(fill);
        drawable.setCornerRadius(radiusPx);
        if (strokePx > 0f) {
            drawable.setStroke(Math.max(1, Math.round(strokePx)), stroke);
        }
        return drawable;
    }

    public static Drawable ripple(Drawable content, int color) {
        return new RippleDrawable(ColorStateList.valueOf(color), content, null);
    }

    public static Drawable rippleRounded(Context context, int fill, float radiusDp,
                                         int stroke, int rippleColor) {
        GradientDrawable shape = rounded(fill, dpf(context, radiusDp), stroke, dpf(context, 1f));
        return ripple(shape, rippleColor);
    }

    public static LinearLayout column(Context context) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.VERTICAL);
        return layout;
    }

    public static LinearLayout row(Context context) {
        LinearLayout layout = new LinearLayout(context);
        layout.setOrientation(LinearLayout.HORIZONTAL);
        layout.setGravity(Gravity.CENTER_VERTICAL);
        return layout;
    }

    public static LinearLayout.LayoutParams lp(int width, int height) {
        return new LinearLayout.LayoutParams(width, height);
    }

    public static LinearLayout.LayoutParams lpw(float weight) {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, weight);
    }

    public static LinearLayout.LayoutParams lpw(float weight, int height) {
        return new LinearLayout.LayoutParams(0, height, weight);
    }

    public static void margins(View view, float left, float top, float right, float bottom) {
        ViewGroup.LayoutParams params = view.getLayoutParams();
        if (!(params instanceof ViewGroup.MarginLayoutParams)) {
            return;
        }
        Context context = view.getContext();
        ViewGroup.MarginLayoutParams margin = (ViewGroup.MarginLayoutParams) params;
        margin.setMargins(dp(context, left), dp(context, top), dp(context, right), dp(context, bottom));
        view.setLayoutParams(margin);
    }

    public static void padding(View view, float left, float top, float right, float bottom) {
        Context context = view.getContext();
        view.setPadding(dp(context, left), dp(context, top), dp(context, right), dp(context, bottom));
    }

    public static View divider(Context context, int color) {
        View view = new View(context);
        view.setBackgroundColor(color);
        view.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                Math.max(1, dp(context, 1f))));
        return view;
    }

    public static View space(Context context, float heightDp) {
        View view = new View(context);
        view.setLayoutParams(new LinearLayout.LayoutParams(1, dp(context, heightDp)));
        return view;
    }

    /**
     * Grade de colunas fixas, sem GridLayout: a célula tem o tamanho exato que a
     * tela calculou. GridLayout esticava a coluna e cortava a miniatura.
     */
    public static LinearLayout grid(Context context, List<View> cells, int columns,
                                    int cellPx, int gapPx) {
        LinearLayout root = column(context);
        LinearLayout row = null;
        for (int i = 0; i < cells.size(); i++) {
            if (i % columns == 0) {
                row = row(context);
                LinearLayout.LayoutParams rowParams = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, cellPx);
                if (i > 0) {
                    rowParams.topMargin = gapPx;
                }
                root.addView(row, rowParams);
            }
            View cell = cells.get(i);
            LinearLayout.LayoutParams cellParams = new LinearLayout.LayoutParams(cellPx, cellPx);
            if (i % columns < columns - 1) {
                cellParams.rightMargin = gapPx;
            }
            if (row != null) {
                row.addView(cell, cellParams);
            }
        }
        return root;
    }

    /**
     * Linha que quebra: os chips de repertório não podem sair da coluna nem
     * virar letra cortada. Mede com a largura disponível e abre nova linha.
     */
    public static final class FlowRow extends ViewGroup {
        private final int gapPx;

        public FlowRow(Context context, float gapDp) {
            super(context);
            this.gapPx = dp(context, gapDp);
        }

        @Override
        protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
            int widthLimit = MeasureSpec.getSize(widthMeasureSpec);
            if (MeasureSpec.getMode(widthMeasureSpec) == MeasureSpec.UNSPECIFIED) {
                widthLimit = Integer.MAX_VALUE;
            }
            int x = 0;
            int y = 0;
            int lineHeight = 0;
            int maxWidth = 0;
            for (int i = 0; i < getChildCount(); i++) {
                View child = getChildAt(i);
                if (child.getVisibility() == GONE) {
                    continue;
                }
                measureChild(child, MeasureSpec.makeMeasureSpec(widthLimit, MeasureSpec.AT_MOST),
                        MeasureSpec.makeMeasureSpec(0, MeasureSpec.UNSPECIFIED));
                int childWidth = child.getMeasuredWidth();
                int childHeight = child.getMeasuredHeight();
                if (x > 0 && x + gapPx + childWidth > widthLimit) {
                    maxWidth = Math.max(maxWidth, x);
                    x = 0;
                    y += lineHeight + gapPx;
                    lineHeight = 0;
                }
                x += (x == 0 ? 0 : gapPx) + childWidth;
                lineHeight = Math.max(lineHeight, childHeight);
            }
            maxWidth = Math.max(maxWidth, x);
            int totalHeight = y + lineHeight;
            setMeasuredDimension(resolveSize(maxWidth, widthMeasureSpec),
                    resolveSize(totalHeight, heightMeasureSpec));
        }

        @Override
        protected void onLayout(boolean changed, int l, int t, int r, int b) {
            int widthLimit = r - l;
            int x = 0;
            int y = 0;
            int lineHeight = 0;
            for (int i = 0; i < getChildCount(); i++) {
                View child = getChildAt(i);
                if (child.getVisibility() == GONE) {
                    continue;
                }
                int childWidth = child.getMeasuredWidth();
                int childHeight = child.getMeasuredHeight();
                if (x > 0 && x + gapPx + childWidth > widthLimit) {
                    x = 0;
                    y += lineHeight + gapPx;
                    lineHeight = 0;
                }
                int left = x == 0 ? 0 : x + gapPx;
                child.layout(left, y, left + childWidth, y + childHeight);
                x = left + childWidth;
                lineHeight = Math.max(lineHeight, childHeight);
            }
        }

        @Override
        protected ViewGroup.LayoutParams generateDefaultLayoutParams() {
            return new ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT);
        }

        @Override
        public ViewGroup.LayoutParams generateLayoutParams(android.util.AttributeSet attrs) {
            return new ViewGroup.LayoutParams(getContext(), attrs);
        }

        @Override
        protected boolean checkLayoutParams(ViewGroup.LayoutParams params) {
            return params != null;
        }
    }

    /**
     * Parede de pecas: duas ou tres colunas equilibradas por altura, como o
     * `columns-2` do mockup. Cada cartao ja carrega a propria altura, entao a
     * coluna so escolhe a mais curta — nao ha celula quadrada forcada, e a peca
     * retrato nao perde o formato.
     */
    public static LinearLayout masonry(Context context, List<View> cards, int columns, int gapPx) {
        LinearLayout root = row(context);
        root.setGravity(Gravity.TOP);
        LinearLayout[] cols = new LinearLayout[Math.max(1, columns)];
        int[] heights = new int[cols.length];
        for (int i = 0; i < cols.length; i++) {
            cols[i] = column(context);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0,
                    ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            if (i < cols.length - 1) {
                params.rightMargin = gapPx;
            }
            root.addView(cols[i], params);
        }
        for (View card : cards) {
            int shortest = 0;
            for (int i = 1; i < cols.length; i++) {
                if (heights[i] < heights[shortest]) {
                    shortest = i;
                }
            }
            ViewGroup.LayoutParams params = card.getLayoutParams();
            int height = params == null ? 0 : params.height;
            LinearLayout.LayoutParams cell = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    height > 0 ? height : ViewGroup.LayoutParams.WRAP_CONTENT);
            cell.bottomMargin = gapPx;
            cols[shortest].addView(card, cell);
            heights[shortest] += (height > 0 ? height : 0) + gapPx;
        }
        return root;
    }

    /**
     * Liga o press scale de 0.96 em qualquer superficie clicavel. Uma superficie
     * e um alvo: o estado pressionado do framework e que dispara o movimento,
     * portanto clique, ripple e acessibilidade continuam valendo.
     */
    public static void pressable(View view) {
        if (view == null || pressStatic(view) || view.getStateListAnimator() != null) {
            return;
        }
        view.setStateListAnimator(Motion.pressAnimator(view));
    }

    /**
     * Marca a superficie como estatica: existe onde o movimento distrai (o HUD
     * de zoom do canvas) ou onde o alvo e um scrim que so fecha a folha.
     */
    public static void staticSurface(View view) {
        if (view == null) {
            return;
        }
        view.setTag(R.id.tag_press, "static");
        view.setStateListAnimator(null);
    }

    public static boolean pressStatic(View view) {
        return view != null && "static".equals(view.getTag(R.id.tag_press));
    }

    /** Alvo circular com ícone; usa o fundo como camada de ripple. */
    public static final class IconButton extends FrameLayout {
        private final Glyph.View24 glyph;
        private final int idleColor;

        public IconButton(Context context, Glyph.Kind kind, int fillColor, int strokeColor,
                          int glyphColor, float sizeDp) {
            super(context);
            this.idleColor = glyphColor;
            setBackground(rippleRounded(context, fillColor, sizeDp / 2f, strokeColor,
                    withAlpha(glyphColor, 0.18f)));
            glyph = new Glyph.View24(context, kind, glyphColor, sizeDp * 0.44f);
            LayoutParams params = new LayoutParams(dp(context, sizeDp * 0.52f),
                    dp(context, sizeDp * 0.52f));
            params.gravity = Gravity.CENTER;
            addView(glyph, params);
            setClickable(true);
            setFocusable(true);
            pressable(this);
            setLayoutParams(new LinearLayout.LayoutParams(dp(context, sizeDp), dp(context, sizeDp)));
        }

        public void setGlyphColor(int color) {
            glyph.setColor(color);
        }

        public void setEnabledLook(boolean enabled) {
            setEnabled(enabled);
            setAlpha(enabled ? 1f : 0.32f);
            setClickable(enabled);
            glyph.setColor(enabled ? idleColor : withAlpha(idleColor, 0.55f));
        }
    }

    /** Botão retangular de texto (ação principal/secundária). */
    public static TextView button(Context context, CharSequence label, float heightDp,
                                  int fill, int textColor, float radiusDp, boolean primary) {
        TextView view = text(context, label, primary ? 17f : 15f,
                primary ? sansBold() : sansBold(), textColor);
        view.setGravity(Gravity.CENTER);
        view.setBackground(rippleRounded(context, fill, radiusDp, Color.TRANSPARENT,
                withAlpha(textColor, 0.16f)));
        view.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                dp(context, heightDp)));
        view.setClickable(true);
        view.setFocusable(true);
        pressable(view);
        return view;
    }

    public static int withAlpha(int color, float alpha) {
        return (color & 0x00FFFFFF) | (((int) (Math.max(0f, Math.min(1f, alpha)) * 255)) << 24);
    }

    /** Avatar de persona: disco no container do tema + emoji grande. */
    public static final class AvatarView extends View {
        private final Themes theme;
        private final String emoji;
        private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint ring = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final Paint glyph = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final RectF circle = new RectF();
        private boolean dark;
        private int ringColor;
        private float ringWidthPx;
        private float sizePx;

        public AvatarView(Context context, Themes theme, String emoji, float sizeDp,
                          boolean dark, int ringColor, float ringWidthDp) {
            super(context);
            this.theme = theme;
            this.emoji = emoji;
            this.dark = dark;
            this.ringColor = ringColor;
            this.ringWidthPx = dpf(context, ringWidthDp);
            this.sizePx = dpf(context, sizeDp);
            glyph.setTextAlign(Paint.Align.CENTER);
            glyph.setTypeface(Typeface.create("sans-serif", Typeface.NORMAL));
            glyph.setColor(theme.onContainer(dark));
            ring.setStyle(Paint.Style.STROKE);
            ring.setColor(ringColor);
            ring.setStrokeWidth(ringWidthPx);
            setLayerType(LAYER_TYPE_SOFTWARE, null);
        }

        public void setDark(boolean dark) {
            this.dark = dark;
            glyph.setColor(theme.onContainer(dark));
            invalidate();
        }

        public void setRingColor(int color) {
            ringColor = color;
            ring.setColor(color);
            invalidate();
        }

        @Override
        protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
            int side = Math.round(sizePx);
            int widthMode = MeasureSpec.getMode(widthMeasureSpec);
            int widthSize = MeasureSpec.getSize(widthMeasureSpec);
            int heightMode = MeasureSpec.getMode(heightMeasureSpec);
            int heightSize = MeasureSpec.getSize(heightMeasureSpec);
            if (widthMode == MeasureSpec.EXACTLY) {
                side = widthSize;
            } else if (widthMode == MeasureSpec.AT_MOST) {
                side = Math.min(side, widthSize);
            } else if (heightMode == MeasureSpec.EXACTLY) {
                side = heightSize;
            } else if (heightMode == MeasureSpec.AT_MOST) {
                side = Math.min(side, heightSize);
            }
            setMeasuredDimension(side, side);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float w = getWidth();
            float h = getHeight();
            float inset = ringWidthPx > 0 ? ringWidthPx : 0f;
            circle.set(inset, inset, w - inset, h - inset);
            fill.setColor(theme.container(dark));
            canvas.drawOval(circle, fill);
            if (ringWidthPx > 0) {
                canvas.drawOval(circle, ring);
            }
            glyph.setTextSize(h * 0.44f);
            Paint.FontMetrics metrics = glyph.getFontMetrics();
            float baseline = h / 2f - (metrics.ascent + metrics.descent) / 2f;
            canvas.drawText(emoji, w / 2f, baseline, glyph);
        }
    }

    /** Fundo de "mesa" com grão discreto: linhas de 1 px, sem bitmap. */
    public static View grain(Context context, int background, int grainColor) {
        return new GrainView(context, background, grainColor);
    }

    private static final class GrainView extends View {
        private final Paint bgPaint = new Paint();
        private final Paint linePaint = new Paint();

        GrainView(Context context, int background, int grainColor) {
            super(context);
            bgPaint.setColor(background);
            linePaint.setColor(grainColor);
            linePaint.setStrokeWidth(1f);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            canvas.drawRect(0, 0, getWidth(), getHeight(), bgPaint);
            int step = Math.max(6, Math.round(getResources().getDisplayMetrics().density * 7f));
            for (int y = 0; y < getHeight(); y += step) {
                canvas.drawLine(0, y, getWidth(), y, linePaint);
            }
        }
    }
}
