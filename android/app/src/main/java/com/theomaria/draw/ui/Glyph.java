package com.theomaria.draw.ui;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.view.View;

/**
 * Ícones desenhados em um grid de 24 unidades. Sem vetores externos, sem fonte
 * de ícone: o traço é o mesmo em qualquer densidade e herda a cor do papel.
 */
public final class Glyph {

    public enum Kind {
        BACK, GEAR, PLUS, MINUS, IMAGES, UNDO, REDO, PENCIL, CRAYON, BUCKET, ERASER,
        CHECK, CHEVRON_UP, CHEVRON_DOWN, TRASH, STAR, PLAY, CLOSE, BOOK, SHEET, USER,
        MAXIMIZE
    }

    /**
     * Os dois unicos pesos de traco do desenho (mockup: 1.5 regular, 2 semibold).
     * Um valor por glifo, nao por tela: o mesmo icone tem o mesmo peso onde quer
     * que apareca.
     */
    public static final float STROKE_REGULAR = 1.5f;
    public static final float STROKE_SEMIBOLD = 2f;

    /**
     * O peso de cada glifo. Semibold fica com as marcas de acao afirmativa —
     * criar (mais), concluir (check) e o play — que precisam de presenca mesmo
     * em 13 dp; o resto da interface e traco regular.
     */
    public static float strokeFor(Kind kind) {
        if (kind == Kind.PLAY || kind == Kind.CHECK || kind == Kind.PLUS) {
            return STROKE_SEMIBOLD;
        }
        return STROKE_REGULAR;
    }

    /**
     * Correcao optica em unidades do grid de 24: o triangulo do play e centrado
     * pelo eixo dele, nao pela caixa (1 unidade para a direita, como o `translate:
     * 1px` do mockup).
     */
    public static float opticalNudge(Kind kind) {
        return kind == Kind.PLAY ? 1f : 0f;
    }

    private Glyph() {
    }

    /** Desenha centrado no canvas, ocupando {@code size} px. */
    public static void draw(Canvas canvas, Kind kind, Paint paint, float size) {
        float scale = size / 24f;
        int save = canvas.save();
        canvas.translate(-12f * scale, -12f * scale);
        canvas.scale(scale, scale);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(strokeFor(kind));
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setAntiAlias(true);
        float nudge = opticalNudge(kind);
        if (nudge != 0f) {
            canvas.translate(nudge, 0f);
        }

        Path p = new Path();
        switch (kind) {
            case BACK:
                p.moveTo(14.5f, 5f);
                p.lineTo(7.5f, 12f);
                p.lineTo(14.5f, 19f);
                canvas.drawPath(p, paint);
                break;
            case GEAR:
                // Três trilhos com botões: "ajustes" sem engrenagem dentada.
                canvas.drawLine(3.5f, 6.5f, 8.5f, 6.5f, paint);
                canvas.drawLine(11.5f, 6.5f, 20.5f, 6.5f, paint);
                canvas.drawLine(3.5f, 12f, 14.5f, 12f, paint);
                canvas.drawLine(17.5f, 12f, 20.5f, 12f, paint);
                canvas.drawLine(3.5f, 17.5f, 6.5f, 17.5f, paint);
                canvas.drawLine(9.5f, 17.5f, 20.5f, 17.5f, paint);
                Paint fill = new Paint(paint);
                fill.setStyle(Paint.Style.FILL);
                canvas.drawCircle(10f, 6.5f, 2.1f, fill);
                canvas.drawCircle(16f, 12f, 2.1f, fill);
                canvas.drawCircle(8f, 17.5f, 2.1f, fill);
                break;
            case PLUS:
                canvas.drawLine(12f, 5f, 12f, 19f, paint);
                canvas.drawLine(5f, 12f, 19f, 12f, paint);
                break;
            case MINUS:
                canvas.drawLine(5f, 12f, 19f, 12f, paint);
                break;
            case BOOK:
                p.moveTo(12f, 6.2f);
                p.cubicTo(9.8f, 4.6f, 6.6f, 4.6f, 3.8f, 6.2f);
                p.lineTo(3.8f, 19.2f);
                p.cubicTo(6.6f, 17.6f, 9.8f, 17.6f, 12f, 19.2f);
                p.cubicTo(14.2f, 17.6f, 17.4f, 17.6f, 20.2f, 19.2f);
                p.lineTo(20.2f, 6.2f);
                p.cubicTo(17.4f, 4.6f, 14.2f, 4.6f, 12f, 6.2f);
                p.close();
                canvas.drawPath(p, paint);
                canvas.drawLine(12f, 6.2f, 12f, 19.2f, paint);
                break;
            case SHEET:
                p.moveTo(6f, 3.2f);
                p.lineTo(14.6f, 3.2f);
                p.lineTo(18.4f, 7f);
                p.lineTo(18.4f, 20.8f);
                p.lineTo(6f, 20.8f);
                p.close();
                canvas.drawPath(p, paint);
                p.reset();
                p.moveTo(14.6f, 3.2f);
                p.lineTo(14.6f, 7f);
                p.lineTo(18.4f, 7f);
                canvas.drawPath(p, paint);
                canvas.drawLine(9f, 12f, 15.4f, 12f, paint);
                canvas.drawLine(9f, 15.6f, 15.4f, 15.6f, paint);
                break;
            case IMAGES:
                RectF back = new RectF(3.5f, 5.5f, 15.5f, 16.5f);
                canvas.drawRoundRect(back, 2.2f, 2.2f, paint);
                RectF front = new RectF(8.5f, 10.5f, 20.5f, 20.5f);
                canvas.drawRoundRect(front, 2.2f, 2.2f, paint);
                break;
            case UNDO:
                p.moveTo(9.5f, 5f);
                p.lineTo(4.5f, 10f);
                p.lineTo(9.5f, 15f);
                canvas.drawPath(p, paint);
                p.reset();
                p.moveTo(4.5f, 10f);
                p.lineTo(14f, 10f);
                p.cubicTo(17.6f, 10f, 20f, 12.4f, 20f, 15f);
                p.cubicTo(20f, 17.6f, 17.6f, 20f, 14f, 20f);
                p.lineTo(10f, 20f);
                canvas.drawPath(p, paint);
                break;
            case REDO:
                p.moveTo(14.5f, 5f);
                p.lineTo(19.5f, 10f);
                p.lineTo(14.5f, 15f);
                canvas.drawPath(p, paint);
                p.reset();
                p.moveTo(19.5f, 10f);
                p.lineTo(10f, 10f);
                p.cubicTo(6.4f, 10f, 4f, 12.4f, 4f, 15f);
                p.cubicTo(4f, 17.6f, 6.4f, 20f, 10f, 20f);
                p.lineTo(14f, 20f);
                canvas.drawPath(p, paint);
                break;
            case PENCIL:
                p.moveTo(4f, 20f);
                p.lineTo(5.2f, 14.8f);
                p.lineTo(15.2f, 4.8f);
                p.lineTo(19.2f, 8.8f);
                p.lineTo(9.2f, 18.8f);
                p.close();
                canvas.drawPath(p, paint);
                canvas.drawLine(5.2f, 14.8f, 9.2f, 18.8f, paint);
                break;
            case CRAYON:
                p.moveTo(6.5f, 20f);
                p.lineTo(3.8f, 16.4f);
                p.lineTo(14.6f, 5.6f);
                p.lineTo(18.4f, 9.4f);
                p.lineTo(7.6f, 20.2f);
                p.close();
                canvas.drawPath(p, paint);
                canvas.drawLine(12.6f, 7.6f, 16.4f, 11.4f, paint);
                break;
            case BUCKET:
                p.moveTo(4.5f, 10.5f);
                p.lineTo(19.5f, 10.5f);
                p.lineTo(17.6f, 19.5f);
                p.lineTo(6.4f, 19.5f);
                p.close();
                canvas.drawPath(p, paint);
                p.reset();
                p.moveTo(8.4f, 10.5f);
                p.cubicTo(8.4f, 6.6f, 15.6f, 6.6f, 15.6f, 10.5f);
                canvas.drawPath(p, paint);
                canvas.drawLine(9f, 14f, 15f, 14f, paint);
                break;
            case ERASER:
                p.moveTo(3.8f, 17.2f);
                p.lineTo(11.2f, 8.4f);
                p.lineTo(20.2f, 12.8f);
                p.lineTo(15.2f, 20.4f);
                p.lineTo(7.4f, 20.4f);
                p.close();
                canvas.drawPath(p, paint);
                canvas.drawLine(6.6f, 12.8f, 15.4f, 17.2f, paint);
                break;
            case CHECK:
                p.moveTo(5f, 12.8f);
                p.lineTo(10f, 18f);
                p.lineTo(19f, 6.2f);
                canvas.drawPath(p, paint);
                break;
            case CHEVRON_UP:
                p.moveTo(6f, 15f);
                p.lineTo(12f, 9f);
                p.lineTo(18f, 15f);
                canvas.drawPath(p, paint);
                break;
            case CHEVRON_DOWN:
                p.moveTo(6f, 9f);
                p.lineTo(12f, 15f);
                p.lineTo(18f, 9f);
                canvas.drawPath(p, paint);
                break;
            case TRASH:
                canvas.drawLine(4f, 7f, 20f, 7f, paint);
                p.moveTo(9f, 7f);
                p.lineTo(9f, 4.6f);
                p.lineTo(15f, 4.6f);
                p.lineTo(15f, 7f);
                canvas.drawPath(p, paint);
                p.reset();
                p.moveTo(6f, 7f);
                p.lineTo(7.1f, 20f);
                p.lineTo(16.9f, 20f);
                p.lineTo(18f, 7f);
                canvas.drawPath(p, paint);
                canvas.drawLine(10.2f, 10.8f, 10.2f, 16.4f, paint);
                canvas.drawLine(13.8f, 10.8f, 13.8f, 16.4f, paint);
                break;
            case STAR:
                Path star = new Path();
                for (int i = 0; i < 10; i++) {
                    double angle = -Math.PI / 2 + i * Math.PI / 5;
                    float r = (i % 2 == 0) ? 8.2f : 3.6f;
                    float x = 12f + (float) Math.cos(angle) * r;
                    float y = 12f + (float) Math.sin(angle) * r;
                    if (i == 0) {
                        star.moveTo(x, y);
                    } else {
                        star.lineTo(x, y);
                    }
                }
                star.close();
                Paint solid = new Paint(paint);
                solid.setStyle(Paint.Style.FILL);
                canvas.drawPath(star, solid);
                break;
            case PLAY:
                // Traco, nao preenchimento: o triangulo vazado do mockup, com o
                // nudge optico aplicado no canvas e o join arredondado.
                p.moveTo(8.5f, 6.5f);
                p.lineTo(18f, 12f);
                p.lineTo(8.5f, 17.5f);
                p.close();
                canvas.drawPath(p, paint);
                break;
            case CLOSE:
                canvas.drawLine(6f, 6f, 18f, 18f, paint);
                canvas.drawLine(18f, 6f, 6f, 18f, paint);
                break;
            case USER:
                canvas.drawCircle(12f, 8.6f, 3.6f, paint);
                p.moveTo(4.8f, 19.6f);
                p.lineTo(5.8f, 16.4f);
                p.lineTo(9f, 14.4f);
                p.lineTo(15f, 14.4f);
                p.lineTo(18.2f, 16.4f);
                p.lineTo(19.2f, 19.6f);
                canvas.drawPath(p, paint);
                break;
            case MAXIMIZE:
                canvas.drawLine(4f, 9f, 4f, 4f, paint);
                canvas.drawLine(4f, 4f, 9f, 4f, paint);
                canvas.drawLine(15f, 4f, 20f, 4f, paint);
                canvas.drawLine(20f, 4f, 20f, 9f, paint);
                canvas.drawLine(20f, 15f, 20f, 20f, paint);
                canvas.drawLine(20f, 20f, 15f, 20f, paint);
                canvas.drawLine(9f, 20f, 4f, 20f, paint);
                canvas.drawLine(4f, 20f, 4f, 15f, paint);
                break;
            default:
                break;
        }
        canvas.restoreToCount(save);
    }

    /** View mínima que desenha um ícone centrado e aceita cor por estado. */
    public static final class View24 extends View {
        private final Kind kind;
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private float sizePx;
        private float blurPx;
        private android.graphics.BlurMaskFilter blurFilter;

        public View24(Context context, Kind kind, int color, float sizeDp) {
            super(context);
            this.kind = kind;
            this.sizePx = Ui.dp(context, sizeDp);
            paint.setColor(color);
            setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
            setLayerType(LAYER_TYPE_SOFTWARE, null);
        }

        public Kind kind() {
            return kind;
        }

        public void setColor(int color) {
            if (paint.getColor() != color) {
                paint.setColor(color);
                invalidate();
            }
        }

        /** Desfoque do cross-fade (4 dp -> 0); 0 desenha o glifo nítido. */
        public void setBlurDp(float blurDp) {
            float px = blurDp <= 0f ? 0f : Ui.dpf(getContext(), blurDp);
            if (Math.abs(px - blurPx) > 0.01f) {
                blurPx = px;
                // O filtro nasce aqui, fora do onDraw: desenhar não aloca.
                blurFilter = px > 0f
                        ? new android.graphics.BlurMaskFilter(px,
                        android.graphics.BlurMaskFilter.Blur.NORMAL)
                        : null;
                invalidate();
            }
        }

        public float blurDp() {
            if (blurPx <= 0f) {
                return 0f;
            }
            return blurPx / getResources().getDisplayMetrics().density;
        }

        public void setSizeDp(float sizeDp) {
            sizePx = Ui.dp(getContext(), sizeDp);
            requestLayout();
            invalidate();
        }

        @Override
        protected void onMeasure(int widthMeasureSpec, int heightMeasureSpec) {
            int side = Math.round(sizePx);
            setMeasuredDimension(resolveSize(side, widthMeasureSpec), resolveSize(side, heightMeasureSpec));
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float side = Math.min(getWidth(), getHeight());
            paint.setMaskFilter(blurFilter);
            int save = canvas.save();
            canvas.translate((getWidth() - side) / 2f, (getHeight() - side) / 2f);
            canvas.translate(side / 2f, side / 2f);
            Glyph.draw(canvas, kind, paint, side);
            canvas.restoreToCount(save);
        }
    }

    /**
     * Icone que troca de desenho no lugar. Os dois ficam na arvore durante a
     * troca: o que sai apaga e o que entra cresce de 0.25 a 1 com o blur caindo
     * de 4 dp para 0 — o cross-fade do mockup.
     */
    public static final class Swap extends android.widget.FrameLayout {
        private final float sizeDp;
        private View24 current;

        public Swap(Context context, Kind kind, int color, float sizeDp) {
            super(context);
            this.sizeDp = sizeDp;
            current = new View24(context, kind, color, sizeDp);
            addView(current, centered());
            setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
        }

        /** Troca o desenho com cross-fade; mesma cor/desenho nao reinicia nada. */
        public void show(Kind kind, int color) {
            if (current.kind() == kind) {
                current.setColor(color);
                return;
            }
            View24 next = new View24(getContext(), kind, color, sizeDp);
            addView(next, centered());
            View24 previous = current;
            current = next;
            Motion.crossFade(previous, next);
        }

        public Kind kind() {
            return current.kind();
        }

        private LayoutParams centered() {
            LayoutParams params = new LayoutParams(Ui.dp(getContext(), sizeDp),
                    Ui.dp(getContext(), sizeDp));
            params.gravity = android.view.Gravity.CENTER;
            return params;
        }
    }
}
