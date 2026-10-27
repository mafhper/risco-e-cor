package com.theomaria.draw;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.os.Looper;
import android.view.View;

import com.theomaria.draw.model.Inks;
import com.theomaria.draw.view.CanvasScreen;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;

import java.io.File;
import java.io.FileOutputStream;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

/**
 * Renderiza as telas na JVM (Skia nativo) no MESMO viewport do mockup, 390x844
 * a 1x, para a comparacao lado a lado ser 1:1 — mesmo tamanho, mesma escala de
 * fonte, sem reamostragem no meio.
 *
 * <p>Nao substitui o screenshot do aparelho; e o mesmo layout e as mesmas
 * fontes que a Activity monta, e serve para medir tokens (cor por pixel, raio,
 * corpo de fonte) e para provar que nada se sobrepoe no canvas.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33, qualifiers = "w390dp-h844dp-mdpi")
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class ScreenshotTest {

    private static final int W = 390;
    private static final int H = 844;

    @Test
    public void renderScreens() throws Exception {
        seedFamilyWall();
        AppActivity activity = Robolectric.buildActivity(AppActivity.class).setup().get();
        Shadows.shadowOf(Looper.getMainLooper()).idle();

        capture(activity, "01-home");
        measure(activity, "01-home");

        click(activity, "Entrar no perfil de Maria");
        capture(activity, "02-perfil-maria");
        measure(activity, "02-perfil-maria");

        click(activity, "Começar a desenhar");
        capture(activity, "03-criar");

        click(activity, "Página para colorir");
        capture(activity, "04-canvas-mini");
        measure(activity, "04-canvas-mini");
        assertNoOverlap(activity, "04-canvas-mini");

        click(activity, "Trocar ferramenta");
        capture(activity, "05-canvas-compacto");

        click(activity, "Expandir painel");
        capture(activity, "06-canvas-expandido");
        click(activity, "Recolher painel");
        click(activity, "Recolher painel");
        click(activity, "Trocar ferramenta");

        click(activity, "Balde");
        click(activity, "vermelho");
        tapCanvas(activity, 730, 512);
        capture(activity, "07-fill");

        click(activity, "Trocar ferramenta");
        click(activity, "Ceras");
        click(activity, "verde");
        dragCanvas(activity, new int[][]{{260, 760}, {380, 820}, {520, 780}, {640, 840}});
        capture(activity, "08-traco");

        click(activity, "Aumentar zoom");
        capture(activity, "09-zoom");
        assertNoOverlap(activity, "09-zoom");
        measure(activity, "09-zoom");
        click(activity, "Ajustar à tela");

        click(activity, "Guardar");
        capture(activity, "10-guardar");
        click(activity, "Publicar no mural");
        capture(activity, "11-perfil-publicado");
        measure(activity, "11-perfil-publicado");

        click(activity, "Voltar");
        capture(activity, "12-home-mural");
        measure(activity, "12-home-mural");

        click(activity, "Entrar no perfil de Theo");
        capture(activity, "13-perfil-theo-kids");

        click(activity, "Página para colorir");
        capture(activity, "14-canvas-kids");

        CanvasScreen kidsCanvas = find(activity.getWindow().getDecorView(), CanvasScreen.class);
        if (kidsCanvas != null) {
            kidsCanvas.session().beginStroke(220, 620, 1, Inks.SIX[3], 26);
            kidsCanvas.session().extendStroke(330, 700);
            kidsCanvas.session().extendStroke(460, 640);
            kidsCanvas.session().endStroke();
        }
        capture(activity, "15-traco-kids");
    }

    @Test
    public void darkThemeRendersHome() throws Exception {
        Robolectric.buildActivity(AppActivity.class).setup().get()
                .getSharedPreferences("meu-desenho", 0).edit()
                .putInt("colorScheme", Prefs.DARK).commit();
        AppActivity dark = Robolectric.buildActivity(AppActivity.class).setup().get();
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        capture(dark, "16-home-escuro");
    }

    // ------------------------------------------------------------- prova ---

    /**
     * Duas pecas publicadas, como o estado semeado do mockup: a parede precisa
     * de peca para a comparacao lado a lado dizer alguma coisa (moldura, angulo,
     * barra de cores, etiqueta).
     */
    private void seedFamilyWall() {
        java.io.File dir = org.robolectric.RuntimeEnvironment.getApplication().getFilesDir();
        new com.theomaria.draw.model.Profiles(dir);
        com.theomaria.draw.model.ArtworkStore store =
                new com.theomaria.draw.model.ArtworkStore(dir);
        long now = System.currentTimeMillis();

        com.theomaria.draw.model.Artwork theo = new com.theomaria.draw.model.Artwork(
                "seed-theo", "p-theo", com.theomaria.draw.model.Artwork.KIND_BLANK, null,
                com.theomaria.draw.model.Artwork.SHEET_W,
                com.theomaria.draw.model.Artwork.SHEET_H, now - 3_600_000L);
        theo.published = true;
        theo.updatedAt = now;
        theo.commands.add(com.theomaria.draw.model.Command.stroke(1,
                com.theomaria.draw.model.Command.TOOL_CRAYON, 0xFFFB2C36, 22,
                new float[]{120, 380, 260, 520, 380, 440, 520, 640, 620, 560}));
        theo.commands.add(com.theomaria.draw.model.Command.stroke(2,
                com.theomaria.draw.model.Command.TOOL_CRAYON, 0xFFF0B100, 18,
                new float[]{140, 760, 300, 700, 470, 800, 600, 720}));
        store.saveNow(theo);

        com.theomaria.draw.model.Artwork maria = new com.theomaria.draw.model.Artwork(
                "seed-maria", "p-maria", com.theomaria.draw.model.Artwork.KIND_PAGE, "page_poc",
                1024, 1024, now - 90_000_000L);
        maria.published = true;
        maria.updatedAt = now - 86_400_000L;
        maria.commands.add(com.theomaria.draw.model.Command.stroke(3,
                com.theomaria.draw.model.Command.TOOL_PENCIL, 0xFF2F6E8A, 8,
                new float[]{180, 420, 280, 600, 420, 520, 540, 700, 640, 620}));
        maria.commands.add(com.theomaria.draw.model.Command.stroke(4,
                com.theomaria.draw.model.Command.TOOL_PENCIL, 0xFF7B2D3A, 8,
                new float[]{200, 900, 360, 820, 520, 940, 660, 860}));
        store.saveNow(maria);
    }

    /** O zoom e o dock nunca se cruzam; a folga minima e de 12 dp. */
    private void assertNoOverlap(AppActivity activity, String shot) {
        View dock = byDescription(activity.getWindow().getDecorView(), "Barra de ferramentas");
        View hud = byDescription(activity.getWindow().getDecorView(), "Zoom");
        assertNotNull(shot + ": dock na tela", dock);
        assertNotNull(shot + ": HUD de zoom na tela", hud);
        Rect dockRect = globalBounds(dock);
        Rect hudRect = globalBounds(hud);
        int gap = dockRect.top - hudRect.bottom;
        boolean intersects = Rect.intersects(dockRect, hudRect);
        report(shot + ".overlap",
                "dock=" + dockRect + " hud=" + hudRect + " gap_dp=" + gap + " intersects=" + intersects);
        assertTrue(shot + ": zoom e dock se cruzam (" + dockRect + " x " + hudRect + ")", !intersects);
        assertTrue(shot + ": folga menor que 12 dp (" + gap + ")", gap >= 12);
    }

    /** Mede o que da para medir sem fe: cor por pixel e caixas dos controles. */
    private void measure(AppActivity activity, String name) {
        View decor = activity.getWindow().getDecorView();
        Bitmap bitmap = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        decor.draw(canvas);
        StringBuilder out = new StringBuilder();
        out.append("viewport=").append(W).append("x").append(H).append(" density=")
                .append(activity.getResources().getDisplayMetrics().density).append('\n');
        out.append("pixel(4,120)=").append(hex(bitmap.getPixel(4, 120))).append('\n');
        out.append("pixel(195,700)=").append(hex(bitmap.getPixel(195, 700))).append('\n');
        out.append("pixel(195,430)=").append(hex(bitmap.getPixel(195, 430))).append('\n');
        for (String needle : new String[]{"ateliê", "Mural da família", "Entrar no perfil de Maria",
                "Começar a desenhar", "Meus desenhos", "No mural", "Barra de ferramentas",
                "Diminuir zoom", "Aumentar zoom", "Guardar"}) {
            View view = byDescription(decor, needle);
            if (view != null) {
                out.append("bounds ").append(needle).append('=').append(globalBounds(view))
                        .append('\n');
            }
        }
        bitmap.recycle();
        report(name + ".tokens", out.toString());
    }

    private static String hex(int color) {
        return String.format("#%06X", 0xFFFFFF & color);
    }

    private static Rect globalBounds(View view) {
        int left = 0;
        int top = 0;
        View current = view;
        while (current != null) {
            left += current.getLeft();
            top += current.getTop();
            if (!(current.getParent() instanceof View)) {
                break;
            }
            current = (View) current.getParent();
        }
        return new Rect(left, top, left + view.getWidth(), top + view.getHeight());
    }

    private static void report(String name, String content) {
        try {
            File dir = new File(System.getProperty("user.dir"), "build/evidence");
            if (!dir.exists() && !dir.mkdirs()) {
                throw new IllegalStateException("nao criou " + dir);
            }
            try (java.io.FileWriter writer = new java.io.FileWriter(new File(dir, name + ".txt"))) {
                writer.write(content);
            }
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    // ------------------------------------------------------------ toque ---

    private void tapCanvas(AppActivity activity, float pageX, float pageY) {
        dispatch(activity, pageX, pageY, android.view.MotionEvent.ACTION_DOWN);
        dispatch(activity, pageX, pageY, android.view.MotionEvent.ACTION_UP);
    }

    private void dragCanvas(AppActivity activity, int[][] pagePoints) {
        com.theomaria.draw.view.DrawCanvas canvas =
                find(activity.getWindow().getDecorView(), com.theomaria.draw.view.DrawCanvas.class);
        if (canvas == null) {
            return;
        }
        layout(activity);
        android.graphics.RectF rect = paperRect(canvas);
        long now = android.os.SystemClock.uptimeMillis();
        float x = rect.left + pagePoints[0][0] * rect.width() / 1024f;
        float y = rect.top + pagePoints[0][1] * rect.height() / 1024f;
        android.view.MotionEvent down = android.view.MotionEvent.obtain(now, now,
                android.view.MotionEvent.ACTION_DOWN, x, y, 0);
        canvas.dispatchTouchEvent(down);
        for (int i = 1; i < pagePoints.length; i++) {
            float px = rect.left + pagePoints[i][0] * rect.width() / 1024f;
            float py = rect.top + pagePoints[i][1] * rect.height() / 1024f;
            android.view.MotionEvent move = android.view.MotionEvent.obtain(now, now + i * 16L,
                    android.view.MotionEvent.ACTION_MOVE, px, py, 0);
            canvas.dispatchTouchEvent(move);
            move.recycle();
        }
        float ux = rect.left + pagePoints[pagePoints.length - 1][0] * rect.width() / 1024f;
        float uy = rect.top + pagePoints[pagePoints.length - 1][1] * rect.height() / 1024f;
        android.view.MotionEvent up = android.view.MotionEvent.obtain(now, now + 100L,
                android.view.MotionEvent.ACTION_UP, ux, uy, 0);
        canvas.dispatchTouchEvent(up);
        down.recycle();
        up.recycle();
        Shadows.shadowOf(Looper.getMainLooper()).idle();
    }

    private void dispatch(AppActivity activity, float pageX, float pageY, int action) {
        com.theomaria.draw.view.DrawCanvas canvas =
                find(activity.getWindow().getDecorView(), com.theomaria.draw.view.DrawCanvas.class);
        if (canvas == null) {
            return;
        }
        layout(activity);
        android.graphics.RectF rect = paperRect(canvas);
        float x = rect.left + pageX * rect.width() / 1024f;
        float y = rect.top + pageY * rect.height() / 1024f;
        long now = android.os.SystemClock.uptimeMillis();
        android.view.MotionEvent event = android.view.MotionEvent.obtain(now, now, action, x, y, 0);
        canvas.dispatchTouchEvent(event);
        event.recycle();
        Shadows.shadowOf(Looper.getMainLooper()).idle();
    }

    /** O quadro da folha em escala 1, com a margem da mesa — igual ao DrawCanvas. */
    private static android.graphics.RectF paperRect(View canvas) {
        float pad = 10f * canvas.getResources().getDisplayMetrics().density;
        // As telas deste teste sao paginas de colorir: 1024x1024 (ver PageAssets).
        float pageW = 1024f;
        float pageH = 1024f;
        float fit = Math.min((canvas.getWidth() - pad * 2) / pageW,
                (canvas.getHeight() - pad * 2) / pageH);
        float w = pageW * fit;
        float h = pageH * fit;
        float left = (canvas.getWidth() - w) / 2f;
        float top = (canvas.getHeight() - h) / 2f;
        return new android.graphics.RectF(left, top, left + w, top + h);
    }

    // ----------------------------------------------------------- helper ---

    private void capture(AppActivity activity, String name) {
        layout(activity);
        View decor = activity.getWindow().getDecorView();
        Bitmap bitmap = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        decor.draw(canvas);
        File dir = new File(System.getProperty("user.dir"), "build/evidence");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("nao criou " + dir);
        }
        try (FileOutputStream out = new FileOutputStream(new File(dir, name + ".png"))) {
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, out);
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
        bitmap.recycle();
        StringBuilder hierarchy = new StringBuilder();
        dump(decor, 0, hierarchy);
        report(name + ".hierarchy", hierarchy.toString());
    }

    private static void layout(AppActivity activity) {
        View decor = activity.getWindow().getDecorView();
        decor.measure(View.MeasureSpec.makeMeasureSpec(W, View.MeasureSpec.EXACTLY),
                View.MeasureSpec.makeMeasureSpec(H, View.MeasureSpec.EXACTLY));
        decor.layout(0, 0, W, H);
    }

    private static void dump(View view, int depth, StringBuilder out) {
        StringBuilder indent = new StringBuilder();
        for (int i = 0; i < depth; i++) {
            indent.append("  ");
        }
        out.append(indent).append(view.getClass().getSimpleName())
                .append(" ").append(view.getWidth()).append("x").append(view.getHeight())
                .append(" @").append(view.getLeft()).append(",").append(view.getTop());
        CharSequence description = view.getContentDescription();
        if (description != null) {
            out.append(" desc=").append(description);
        }
        if (view instanceof android.widget.TextView) {
            out.append(" text=").append(((android.widget.TextView) view).getText());
            out.append(" sp=").append(((android.widget.TextView) view).getTextSize()
                    / view.getResources().getDisplayMetrics().scaledDensity);
        }
        out.append("\n");
        if (view instanceof android.view.ViewGroup) {
            android.view.ViewGroup group = (android.view.ViewGroup) view;
            for (int i = 0; i < group.getChildCount(); i++) {
                dump(group.getChildAt(i), depth + 1, out);
            }
        }
    }

    private void click(AppActivity activity, String needle) {
        View target = byDescription(activity.getWindow().getDecorView(), needle);
        if (target == null) {
            throw new IllegalStateException("nao achei " + needle);
        }
        target.performClick();
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        layout(activity);
    }

    private static View byDescription(View root, String needle) {
        if (!(root instanceof android.view.ViewGroup)) {
            return null;
        }
        android.view.ViewGroup group = (android.view.ViewGroup) root;
        for (int i = 0; i < group.getChildCount(); i++) {
            View child = group.getChildAt(i);
            CharSequence description = child.getContentDescription();
            if (description != null && description.toString().contains(needle)) {
                return child;
            }
            if (child instanceof android.widget.TextView) {
                CharSequence text = ((android.widget.TextView) child).getText();
                if (text != null && text.toString().contains(needle)) {
                    return child;
                }
            }
            View nested = byDescription(child, needle);
            if (nested != null) {
                return nested;
            }
        }
        return null;
    }

    private static <T extends View> T find(View root, Class<T> type) {
        if (type.isInstance(root)) {
            return type.cast(root);
        }
        if (!(root instanceof android.view.ViewGroup)) {
            return null;
        }
        android.view.ViewGroup group = (android.view.ViewGroup) root;
        for (int i = 0; i < group.getChildCount(); i++) {
            T found = find(group.getChildAt(i), type);
            if (found != null) {
                return found;
            }
        }
        return null;
    }
}
