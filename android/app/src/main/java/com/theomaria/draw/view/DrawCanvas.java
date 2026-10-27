package com.theomaria.draw.view;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.view.MotionEvent;
import android.view.View;

import com.theomaria.draw.model.ArtworkSession;
import com.theomaria.draw.model.Command;
import com.theomaria.draw.ui.Palette;
import com.theomaria.draw.ui.Ui;

/**
 * O papel sobre a mesa. A folha e desenhada o maior possivel, centrada, com a
 * mesa aparecendo em volta — papel sobre papel, nao card flutuante.
 *
 * <p>Um dedo desenha. Dois dedos nunca deixam marca: eles movem e ampliam o
 * papel (escala 1..6), com o ponto sob os dedos parado — a regra do mockup. O
 * papel nunca sai do proprio quadro, entao um desenho nao se perde fora da tela.
 */
public final class DrawCanvas extends View {

    public static final int TOOL_FILL = 10;
    public static final int TOOL_ERASER = 11;

    public static final float MIN_SCALE = 1f;
    public static final float MAX_SCALE = 6f;

    public interface Listener {
        void onChanged();

        void onFill(ArtworkSession.FillReport report);

        /** A vista mudou por gesto ou por botao (o HUD le o novo percentual). */
        void onViewChanged();

        /** Um dedo encostou no papel: o dock recolhe e a folha fica livre. */
        void onPaperTouch();
    }

    private final Palette palette;
    private final Paint bitmapPaint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.DITHER_FLAG);
    private final Paint deskPaint = new Paint();
    private final Paint grainPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint edgePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Rect src = new Rect();
    private final RectF dst = new RectF();
    private final RectF base = new RectF();

    private ArtworkSession session;
    private Listener listener;

    private int tool = TOOL_FILL;
    private int color;
    private int widthPx = 10;
    private float eraserRadius = 28f;

    private boolean drawing;
    private boolean fingerBudgetUsed;
    private boolean transforming;
    private float lastX;
    private float lastY;
    private int erasedDuringGesture;

    private float scale = 1f;
    private float offsetX;
    private float offsetY;

    private float gestureSpan;
    private float gestureAnchorX;
    private float gestureAnchorY;
    private float gestureStartScale;
    private float gestureStartLeft;
    private float gestureStartTop;

    public DrawCanvas(Context context, Palette palette) {
        super(context);
        this.palette = palette;
        deskPaint.setColor(palette.desk);
        grainPaint.setColor(Ui.withAlpha(palette.deskInk, 0.10f));
        shadowPaint.setColor(0x22000000);
        edgePaint.setStyle(Paint.Style.STROKE);
        edgePaint.setStrokeWidth(Ui.dpf(context, 1f));
        edgePaint.setColor(Ui.withAlpha(Color.BLACK, 0.08f));
        setFocusable(true);
    }

    public void setListener(Listener listener) {
        this.listener = listener;
    }

    public void setSession(ArtworkSession session) {
        this.session = session;
        if (session != null) {
            src.set(0, 0, session.bitmap().getWidth(), session.bitmap().getHeight());
            recomputeBase();
        }
        invalidate();
    }

    public void setTool(int tool) {
        this.tool = tool;
        invalidate();
    }

    public int tool() {
        return tool;
    }

    public void setColor(int color) {
        this.color = color;
    }

    public int color() {
        return color;
    }

    public void setWidthPx(int widthPx) {
        this.widthPx = widthPx;
        this.eraserRadius = Math.max(24f, widthPx * 2.2f);
    }

    public int widthPx() {
        return widthPx;
    }

    // ------------------------------------------------------------ vista ---

    public float scale() {
        return scale;
    }

    public boolean zoomed() {
        return scale > MIN_SCALE + 0.001f;
    }

    /** Amplia em torno do centro da vista (o gesto usa os dedos). */
    public void zoomBy(float factor) {
        zoomAround(getWidth() / 2f, getHeight() / 2f, scale * factor);
    }

    public void resetView() {
        scale = MIN_SCALE;
        offsetX = 0f;
        offsetY = 0f;
        applyView();
        invalidate();
        if (listener != null) {
            listener.onViewChanged();
        }
    }

    private void zoomAround(float px, float py, float target) {
        if (dst.width() <= 0f) {
            return;
        }
        float next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, target));
        float u = (px - dst.left) / dst.width();
        float v = (py - dst.top) / dst.height();
        float w = base.width() * next;
        float h = base.height() * next;
        float left = px - u * w;
        float top = py - v * h;
        scale = next;
        offsetX = clamp(left - base.left, base.left + base.width() - w - base.left, 0f);
        offsetY = clamp(top - base.top, base.top + base.height() - h - base.top, 0f);
        applyView();
        invalidate();
        if (listener != null) {
            listener.onViewChanged();
        }
    }

    private static float clamp(float value, float low, float high) {
        return Math.max(Math.min(low, high), Math.min(Math.max(low, high), value));
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        recomputeBase();
    }

    /** O quadro da folha em escala 1: a mesa em volta e o que separa papel de mesa. */
    private void recomputeBase() {
        if (session == null || getWidth() == 0 || getHeight() == 0) {
            return;
        }
        float pad = Ui.dpf(getContext(), Ui.DESK_PAD);
        int pageW = session.bitmap().getWidth();
        int pageH = session.bitmap().getHeight();
        float fit = Math.min((getWidth() - pad * 2) / pageW, (getHeight() - pad * 2) / pageH);
        float w = pageW * fit;
        float h = pageH * fit;
        float left = (getWidth() - w) / 2f;
        float top = (getHeight() - h) / 2f;
        base.set(left, top, left + w, top + h);
        applyView();
    }

    private void applyView() {
        float w = base.width() * scale;
        float h = base.height() * scale;
        offsetX = clamp(offsetX, base.width() - w, 0f);
        offsetY = clamp(offsetY, base.height() - h, 0f);
        float left = base.left + offsetX;
        float top = base.top + offsetY;
        dst.set(left, top, left + w, top + h);
    }

    // ----------------------------------------------------------- desenho ---

    @Override
    protected void onDraw(Canvas canvas) {
        canvas.drawColor(palette.desk);
        if (session == null || dst.width() <= 0) {
            return;
        }
        drawDeskGrain(canvas);
        // Papel impresso: uma borda de 1 px e um degrau de sombra curto, sem
        // difusao — a folha esta apoiada, nao flutuando.
        shadowPaint.setAlpha(18);
        canvas.drawRect(dst.left + 1f, dst.top + Ui.dpf(getContext(), 2f), dst.right + 1f,
                dst.bottom + Ui.dpf(getContext(), 3f), shadowPaint);
        shadowPaint.setAlpha(28);
        canvas.drawRect(dst.left, dst.top + 1f, dst.right, dst.bottom + 1f, shadowPaint);
        canvas.drawBitmap(session.bitmap(), src, dst, bitmapPaint);
        canvas.drawRect(dst, edgePaint);
    }

    private void drawDeskGrain(Canvas canvas) {
        float step = Ui.dpf(getContext(), 18f);
        float radius = Math.max(1f, Ui.dpf(getContext(), 0.9f));
        for (float y = step / 2f; y < getHeight(); y += step) {
            for (float x = step / 2f; x < getWidth(); x += step) {
                canvas.drawCircle(x, y, radius, grainPaint);
            }
        }
    }

    // ------------------------------------------------------------ toque ---

    @Override
    public boolean onTouchEvent(MotionEvent event) {
        if (session == null) {
            return false;
        }
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                fingerBudgetUsed = false;
                transforming = false;
                erasedDuringGesture = 0;
                onDown(event.getX(), event.getY());
                return true;
            case MotionEvent.ACTION_POINTER_DOWN:
                fingerBudgetUsed = true;
                if (drawing) {
                    drawing = false;
                    session.cancelStroke();
                    invalidate();
                    if (listener != null) {
                        listener.onChanged();
                    }
                }
                if (event.getPointerCount() >= 2) {
                    beginTransform(event);
                }
                return true;
            case MotionEvent.ACTION_MOVE:
                if (transforming && event.getPointerCount() >= 2) {
                    updateTransform(event);
                    return true;
                }
                if (fingerBudgetUsed || event.getPointerCount() > 1) {
                    return true;
                }
                onMove(event.getX(), event.getY());
                return true;
            case MotionEvent.ACTION_POINTER_UP:
                if (event.getPointerCount() <= 2) {
                    transforming = false;
                }
                return true;
            case MotionEvent.ACTION_UP:
                if (!fingerBudgetUsed) {
                    onUp(event.getX(), event.getY());
                }
                transforming = false;
                performClick();
                return true;
            case MotionEvent.ACTION_CANCEL:
                if (drawing) {
                    drawing = false;
                    session.cancelStroke();
                    invalidate();
                    if (listener != null) {
                        listener.onChanged();
                    }
                }
                transforming = false;
                return true;
            default:
                return true;
        }
    }

    private void beginTransform(MotionEvent event) {
        transforming = true;
        gestureSpan = span(event);
        if (gestureSpan <= 1f) {
            gestureSpan = 1f;
        }
        gestureAnchorX = (event.getX(0) + event.getX(1)) / 2f;
        gestureAnchorY = (event.getY(0) + event.getY(1)) / 2f;
        gestureStartScale = scale;
        gestureStartLeft = dst.left;
        gestureStartTop = dst.top;
    }

    private float span(MotionEvent event) {
        float dx = event.getX(1) - event.getX(0);
        float dy = event.getY(1) - event.getY(0);
        return (float) Math.hypot(dx, dy);
    }

    /**
     * Um passo do gesto: a distancia muda a escala, o ponto medio anda com os
     * dedos, e as duas coisas compoem porque a ancora e o papel sob o meio.
     */
    private void updateTransform(MotionEvent event) {
        if (dst.width() <= 0f) {
            return;
        }
        float now = Math.max(1f, span(event));
        float midX = (event.getX(0) + event.getX(1)) / 2f;
        float midY = (event.getY(0) + event.getY(1)) / 2f;
        float next = Math.max(MIN_SCALE,
                Math.min(MAX_SCALE, gestureStartScale * (now / gestureSpan)));
        float startW = base.width() * gestureStartScale;
        float startH = base.height() * gestureStartScale;
        float u = startW <= 0f ? 0.5f : (gestureAnchorX - gestureStartLeft) / startW;
        float v = startH <= 0f ? 0.5f : (gestureAnchorY - gestureStartTop) / startH;
        float w = base.width() * next;
        float h = base.height() * next;
        float left = midX - u * w;
        float top = midY - v * h;
        scale = next;
        offsetX = clamp(left, base.left + base.width() - w, base.left) - base.left;
        offsetY = clamp(top, base.top + base.height() - h, base.top) - base.top;
        applyView();
        invalidate();
        if (listener != null) {
            listener.onViewChanged();
        }
    }

    private void onDown(float viewX, float viewY) {
        if (!dst.contains(viewX, viewY)) {
            return;
        }
        if (listener != null) {
            listener.onPaperTouch();
        }
        float x = toPageX(viewX);
        float y = toPageY(viewY);
        lastX = x;
        lastY = y;
        if (tool == TOOL_FILL) {
            ArtworkSession.FillReport report = session.fill(Math.round(x), Math.round(y), color);
            invalidate();
            if (listener != null) {
                listener.onFill(report);
                listener.onChanged();
            }
        } else if (tool == TOOL_ERASER) {
            erasedDuringGesture += session.eraseAt(x, y, eraserRadius);
            invalidate();
        } else {
            drawing = true;
            session.beginStroke(x, y, tool, color, widthPx);
            invalidate();
        }
    }

    private void onMove(float viewX, float viewY) {
        if (!dst.contains(viewX, viewY)) {
            return;
        }
        float x = toPageX(viewX);
        float y = toPageY(viewY);
        if (drawing) {
            session.extendStroke(x, y);
            invalidate();
        } else if (tool == TOOL_ERASER) {
            int erased = session.eraseAt(x, y, eraserRadius);
            if (erased > 0) {
                erasedDuringGesture += erased;
                invalidate();
            }
        }
        lastX = x;
        lastY = y;
    }

    private void onUp(float viewX, float viewY) {
        if (drawing) {
            drawing = false;
            boolean committed = session.endStroke();
            invalidate();
            if (committed && listener != null) {
                listener.onChanged();
            }
        } else if (tool == TOOL_ERASER) {
            if (listener != null) {
                listener.onChanged();
            }
        }
    }

    @Override
    public boolean performClick() {
        return super.performClick();
    }

    private float toPageX(float viewX) {
        return (viewX - dst.left) * session.bitmap().getWidth() / dst.width();
    }

    private float toPageY(float viewY) {
        return (viewY - dst.top) * session.bitmap().getHeight() / dst.height();
    }

    /** Faixa etaria 3-5 usa alvos de 56 dp; o resto 48 dp. */
    public static int toolAt(boolean kids, int index) {
        if (index == 0) {
            return Command.TOOL_PENCIL;
        }
        if (index == 1) {
            return Command.TOOL_CRAYON;
        }
        if (index == 2) {
            return TOOL_FILL;
        }
        return TOOL_ERASER;
    }
}
