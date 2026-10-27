package com.theomaria.draw.model;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.util.Log;

import com.theomaria.poc.doc.CommandHistory;
import com.theomaria.poc.fill.pure.FillEngine;
import com.theomaria.poc.fill.pure.RegionMap;
import com.theomaria.poc.fill.pure.TapResult;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Documento em memória: comandos, mapa de regiões e o bitmap derivado.
 *
 * <p>Ordem de composição (de baixo para cima): papel branco, fills das regiões,
 * contorno da página em MULTIPLY, traços do usuário. Assim um fill sempre fica
 * abaixo do traço e o contorno nunca esconde a cor — e um traço novo pode passar
 * por cima do contorno, como em papel de verdade.
 *
 * <p>O tamanho do documento é a página (1024 px no lote atual); a view escala.
 */
public final class ArtworkSession {

    private static final String TAG = "MeuDesenho";

    /** Resultado de um toque com o balde, para a UI e para o log de prova. */
    public static final class FillReport {
        public final TapResult.Decision decision;
        public final int label;
        public final int paintedPx;
        public final int leaks;
        public final long millis;

        FillReport(TapResult.Decision decision, int label, int paintedPx, int leaks, long millis) {
            this.decision = decision;
            this.label = label;
            this.paintedPx = paintedPx;
            this.leaks = leaks;
            this.millis = millis;
        }

        public boolean painted() {
            return decision == TapResult.Decision.FILL || decision == TapResult.Decision.SNAP;
        }
    }

    private final Context context;
    private final Artwork artwork;
    private final ArtworkStore store;
    private final PageAssets page;
    private final FillEngine engine;
    private final CommandHistory<Command> history = new CommandHistory<>(CommandHistory.DEFAULT_DEPTH);

    private final int width;
    private final int height;
    private final Bitmap bitmap;
    private final int[] fillPixels;

    private final Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint inkPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

    private final List<Float> livePoints = new ArrayList<>();
    private int liveTool = Command.TOOL_PENCIL;
    private int liveWidth = 8;
    private int liveColor;
    private int nextStrokeId = 1;
    /** Buffer reutilizado pela checagem de vazamento (sem alocar por toque). */
    private int[] snapshot = new int[0];

    public ArtworkSession(Context context, Artwork artwork, ArtworkStore store) {
        this.context = context.getApplicationContext();
        this.artwork = artwork;
        this.store = store;
        this.width = artwork.width;
        this.height = artwork.height;
        if (artwork.isPage()) {
            try {
                this.page = PageAssets.load(this.context.getAssets(), artwork.pageId);
            } catch (Exception e) {
                throw new IllegalStateException("pagina nao carregou: " + artwork.pageId, e);
            }
            this.engine = page.engine();
        } else {
            this.page = null;
            this.engine = null;
        }
        this.bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        this.fillPixels = new int[width * height];
        inkPaint.setColor(Inks.INK);
        // Sem MULTIPLY: no canvas de software do bitmap, ALPHA_8 + MULTIPLY zera o
        // destino no aparelho. O contorno é tinta opaca sobre a cor — mesmo resultado
        // visual e sem apagar o papel.
        inkPaint.setFilterBitmap(true);
        history.reset(new ArrayList<>(artwork.commands));
        for (Command command : artwork.commands) {
            if (command.isStroke() && command.strokeId >= nextStrokeId) {
                nextStrokeId = command.strokeId + 1;
            }
        }
        renderAll();
        Log.i(TAG, "sessao aberta peca=" + artwork.id + " pagina=" + artwork.pageId
                + " comandos=" + history.appliedCount() + " undoMax=" + history.depth());
    }

    public Artwork artwork() {
        return artwork;
    }

    public Bitmap bitmap() {
        return bitmap;
    }

    public boolean isPage() {
        return page != null;
    }

    public boolean canUndo() {
        return history.canUndo();
    }

    public boolean canRedo() {
        return history.canRedo();
    }

    public int commandCount() {
        return history.appliedCount();
    }

    // ---------------------------------------------------------------- fill ---

    public FillReport fill(int x, int y, int color) {
        long t0 = System.nanoTime();
        if (engine == null) {
            return new FillReport(TapResult.Decision.REJECT_NONE, -1, 0, 0, 0L);
        }
        TapResult result = engine.tap(x, y);
        if (!result.paints()) {
            Log.i(TAG, "fill rejeitado " + result.decisionName() + " label=" + result.label
                    + " tap=(" + x + "," + y + ")");
            return new FillReport(result.decision, result.label, 0, 0, millis(t0));
        }

        // Foto do retângulo afetado + 1 px: é o que prova ausência de vazamento.
        int bx = Math.max(0, result.regionX - 1);
        int by = Math.max(0, result.regionY - 1);
        int bw = Math.min(width - bx, result.regionW + 2);
        int bh = Math.min(height - by, result.regionH + 2);
        int needed = bw * bh;
        if (snapshot.length < needed) {
            snapshot = new int[needed];
        }
        int[] before = snapshot;
        for (int row = 0; row < bh; row++) {
            System.arraycopy(fillPixels, (by + row) * width + bx, before, row * bw, bw);
        }

        engine.apply(result, fillPixels, color);
        int leaks = 0;
        for (int row = 0; row < bh; row++) {
            int pageRow = (by + row) * width;
            for (int col = 0; col < bw; col++) {
                int index = pageRow + bx + col;
                if (fillPixels[index] == before[row * bw + col]) {
                    continue;
                }
                int label = page.map.labelAt(bx + col, by + row);
                if (label != result.label && label != RegionMap.LABEL_CONTOUR) {
                    leaks++;
                }
            }
        }
        long elapsed = millis(t0);
        Log.i(TAG, String.format(Locale.ROOT,
                "fill label=%d area=%.2f%% px=%d dirty=%d,%d,%d,%d leaks=%d %dms color=%08X",
                result.label, result.areaPct, result.paintedPx, result.dirtyX, result.dirtyY,
                result.dirtyW, result.dirtyH, leaks, elapsed, color));

        if (leaks > 0) {
            // Nunca aceitar um estado que vazou: restaura a foto e não grava comando.
            for (int row = 0; row < bh; row++) {
                System.arraycopy(before, row * bw, fillPixels, (by + row) * width + bx, bw);
            }
            renderAll();
            Log.e(TAG, "fill abortado: " + leaks + " pixels fora da regiao " + result.label);
            return new FillReport(TapResult.Decision.REJECT_NONE, result.label, 0, leaks, elapsed);
        }
        if (result.dirtyW == 0) {
            // Tocar a mesma cor na mesma região não vira comando.
            Log.i(TAG, "fill sem mudanca label=" + result.label);
            return new FillReport(result.decision, result.label, 0, 0, elapsed);
        }

        history.push(Command.fill(result.label, color));
        renderAll();
        autosave();
        return new FillReport(result.decision, result.label, result.paintedPx, 0, elapsed);
    }

    // -------------------------------------------------------------- stroke ---

    public void beginStroke(float x, float y, int tool, int color, int widthPx) {
        livePoints.clear();
        livePoints.add(x);
        livePoints.add(y);
        liveTool = tool;
        liveWidth = widthPx;
        liveColor = color;
        configureStrokePaint(tool, color, widthPx);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawCircle(x, y, widthPx / 2f, strokePaint);
    }

    public void extendStroke(float x, float y) {
        int size = livePoints.size();
        if (size < 2) {
            return;
        }
        float lastX = livePoints.get(size - 2);
        float lastY = livePoints.get(size - 1);
        float dx = x - lastX;
        float dy = y - lastY;
        if (dx * dx + dy * dy < 4f) {
            return;
        }
        livePoints.add(x);
        livePoints.add(y);
        configureStrokePaint(liveTool, liveColor, liveWidth);
        Canvas canvas = new Canvas(bitmap);
        canvas.drawLine(lastX, lastY, x, y, strokePaint);
    }

    /** @return true quando o traço virou comando */
    public boolean endStroke() {
        if (livePoints.size() < 2) {
            return false;
        }
        float[] points = new float[livePoints.size()];
        for (int i = 0; i < livePoints.size(); i++) {
            points[i] = livePoints.get(i);
        }
        livePoints.clear();
        history.push(Command.stroke(nextStrokeId++, liveTool, liveColor, liveWidth, points));
        renderAll();
        autosave();
        Log.i(TAG, "traco id=" + (nextStrokeId - 1) + " pontos=" + (points.length / 2)
                + " tool=" + liveTool + " w=" + liveWidth);
        return true;
    }

    public void cancelStroke() {
        livePoints.clear();
        renderAll();
    }

    // ------------------------------------------------------------- eraser ---

    /** Apaga traços inteiros tocados; devolve quantos saíram. */
    public int eraseAt(float x, float y, float radius) {
        Set<Integer> hit = new HashSet<>();
        List<Command> applied = history.applied();
        Set<Integer> alreadyGone = erasedIds(applied);
        for (Command command : applied) {
            if (!command.isStroke() || alreadyGone.contains(command.strokeId)) {
                continue;
            }
            if (touches(command.points, x, y, radius)) {
                hit.add(command.strokeId);
            }
        }
        if (hit.isEmpty()) {
            return 0;
        }
        int[] ids = new int[hit.size()];
        int i = 0;
        for (Integer id : hit) {
            ids[i++] = id;
        }
        history.push(Command.erase(ids));
        renderAll();
        autosave();
        Log.i(TAG, "borracha apagou " + ids.length + " traco(s)");
        return ids.length;
    }

    // -------------------------------------------------------------- history ---

    public boolean undo() {
        Command command = history.undo();
        if (command == null) {
            return false;
        }
        renderAll();
        autosave();
        Log.i(TAG, "undo tipo=" + command.type + " restam=" + history.appliedCount());
        return true;
    }

    public boolean redo() {
        Command command = history.redo();
        if (command == null) {
            return false;
        }
        renderAll();
        autosave();
        Log.i(TAG, "redo tipo=" + command.type + " aplicados=" + history.appliedCount());
        return true;
    }

    // --------------------------------------------------------------- render ---

    public void renderAll() {
        Map<Integer, Integer> colors = new TreeMap<>();
        Set<Integer> erased = new HashSet<>();
        List<Command> applied = history.applied();
        for (Command command : applied) {
            if (command.isFill()) {
                colors.put(command.region, command.color);
            } else if (command.isErase()) {
                for (int id : command.erased) {
                    erased.add(id);
                }
            }
        }
        if (engine != null) {
            engine.replay(colors, fillPixels, Inks.PAPER);
        } else {
            java.util.Arrays.fill(fillPixels, Inks.PAPER);
        }
        bitmap.setPixels(fillPixels, 0, width, 0, 0, width, height);
        Canvas canvas = new Canvas(bitmap);
        if (page != null) {
            canvas.drawBitmap(page.inkMask, 0f, 0f, inkPaint);
        }
        for (Command command : applied) {
            if (command.isStroke() && !erased.contains(command.strokeId)) {
                drawStroke(canvas, command);
            }
        }
    }

    private void drawStroke(Canvas canvas, Command command) {
        if (command.points.length < 2) {
            return;
        }
        configureStrokePaint(command.tool, command.color, command.width);
        if (command.points.length == 2) {
            canvas.drawCircle(command.points[0], command.points[1], command.width / 2f, strokePaint);
            return;
        }
        Path path = new Path();
        path.moveTo(command.points[0], command.points[1]);
        for (int i = 2; i + 1 < command.points.length; i += 2) {
            path.lineTo(command.points[i], command.points[i + 1]);
        }
        canvas.drawPath(path, strokePaint);
    }

    private void configureStrokePaint(int tool, int color, int widthPx) {
        strokePaint.setStyle(Paint.Style.STROKE);
        strokePaint.setStrokeWidth(widthPx);
        strokePaint.setStrokeCap(Paint.Cap.ROUND);
        strokePaint.setStrokeJoin(Paint.Join.ROUND);
        strokePaint.setColor(color);
        // Ceras deixam o papel respirar um pouco; lápis é opaco e fino.
        strokePaint.setAlpha(tool == Command.TOOL_CRAYON ? 232 : 255);
    }

    // ------------------------------------------------------------ thumbnail ---

    public Bitmap thumbnail(int side) {
        return Bitmap.createScaledBitmap(bitmap, side, side, true);
    }

    public void sync() {
        artwork.commands.clear();
        artwork.commands.addAll(history.applied());
        artwork.updatedAt = System.currentTimeMillis();
    }

    public void autosave() {
        sync();
        store.autosave(artwork);
    }

    // --------------------------------------------------------------- helpers ---

    private static Set<Integer> erasedIds(List<Command> commands) {
        Set<Integer> erased = new HashSet<>();
        for (Command command : commands) {
            if (command.isErase()) {
                for (int id : command.erased) {
                    erased.add(id);
                }
            }
        }
        return erased;
    }

    private static boolean touches(float[] points, float x, float y, float radius) {
        if (points.length == 2) {
            return distance(points[0], points[1], x, y) <= radius;
        }
        for (int i = 0; i + 3 < points.length; i += 2) {
            if (distanceToSegment(x, y, points[i], points[i + 1], points[i + 2], points[i + 3]) <= radius) {
                return true;
            }
        }
        return false;
    }

    private static float distance(float ax, float ay, float bx, float by) {
        float dx = ax - bx;
        float dy = ay - by;
        return (float) Math.sqrt(dx * dx + dy * dy);
    }

    private static float distanceToSegment(float px, float py, float ax, float ay, float bx, float by) {
        float dx = bx - ax;
        float dy = by - ay;
        float lengthSquared = dx * dx + dy * dy;
        if (lengthSquared == 0f) {
            return distance(px, py, ax, ay);
        }
        float t = ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
        t = Math.max(0f, Math.min(1f, t));
        return distance(px, py, ax + t * dx, ay + t * dy);
    }

    private static long millis(long startNanos) {
        return (System.nanoTime() - startNanos) / 1_000_000;
    }

    /** Estado curto para a linha de prova no logcat. */
    public String debugState() {
        Map<Integer, Integer> colors = new HashMap<>();
        int strokes = 0;
        for (Command command : history.applied()) {
            if (command.isFill()) {
                colors.put(command.region, command.color);
            } else if (command.isStroke()) {
                strokes++;
            }
        }
        return "peca=" + artwork.id + " regioes=" + colors.size() + " tracos=" + strokes
                + " comandos=" + history.appliedCount() + " undo=" + history.canUndo()
                + " redo=" + history.canRedo();
    }
}
