package com.theomaria.poc.doc;

import java.io.IOException;
import java.util.Collections;
import java.util.Map;
import java.util.TreeMap;

/**
 * Estado de cor por regiao + pilha de undo/redo + journal.
 *
 * <p>Nao conhece {@code Bitmap}: o replay de pixels e do {@code FillEngine}, no {@code :app}. Isso
 * mantem este modulo testavel na JVM e a regra dura de fronteira (algoritmo puro x adaptadores).
 *
 * <p>Semantica do journal: <b>last-write-wins por regiao</b>. Carregar = aplicar as linhas em ordem.
 * {@code undo} e {@code redo} sao <b>appends</b> (com a cor anterior), nao marcadores — assim o
 * replay do historico reconstroi exatamente o estado final.
 */
public final class Document {

    /** Cor de "sem pintura". Journal grava FFFFFFFF para apagar. */
    public static final int WHITE = 0xFFFFFFFF;

    private final Journal journal;
    private final TreeMap<Integer, Integer> colors = new TreeMap<>();
    private final UndoStack undoStack = new UndoStack(UndoStack.DEFAULT_DEPTH);

    private int seq;
    private int commands;
    private int replayedLines;

    public Document(Journal journal) {
        if (journal == null) {
            throw new IllegalArgumentException("journal nulo");
        }
        this.journal = journal;
    }

    /** Carrega o journal e reaplica o estado. Chamar antes de desenhar. */
    public void load() throws IOException {
        colors.clear();
        undoStack.clear();
        seq = 0;
        commands = 0;
        for (JournalRecord record : journal.load()) {
            applyReplay(record);
            replayedLines++;
        }
        if (journal.lastSeq() > seq) {
            seq = journal.lastSeq();
        }
    }

    /** Aplica a cor a uma regiao, empilha undo e grava no journal. */
    public boolean paint(int region, int color) throws IOException {
        int before = colorOf(region);
        if (before == color) {
            return false;
        }
        put(region, color);
        undoStack.push(region, before, color);
        append(region, color);
        return true;
    }

    public boolean undo() throws IOException {
        UndoStack.Entry entry = undoStack.undo();
        if (entry == null) {
            return false;
        }
        put(entry.region, entry.before);
        append(entry.region, entry.before);
        return true;
    }

    public boolean redo() throws IOException {
        UndoStack.Entry entry = undoStack.redo();
        if (entry == null) {
            return false;
        }
        put(entry.region, entry.after);
        append(entry.region, entry.after);
        return true;
    }

    public boolean canUndo() {
        return undoStack.canUndo();
    }

    public boolean canRedo() {
        return undoStack.canRedo();
    }

    /** Cor atual; {@link #WHITE} quando a regiao nao esta pintada. */
    public int colorOf(int region) {
        Integer color = colors.get(region);
        return color == null ? WHITE : color;
    }

    /** Visao somente leitura, ordenada por id — entrada do replay de pixels. */
    public Map<Integer, Integer> colors() {
        return Collections.unmodifiableMap(colors);
    }

    public int commands() {
        return commands;
    }

    /** Quantas linhas validas foram lidas do journal na ultima carga. */
    public int replayedLines() {
        return replayedLines;
    }

    /** Linhas descartadas (truncadas/corrompidas) na ultima carga. */
    public int skippedLines() {
        return journal.skippedLines();
    }

    public Journal journal() {
        return journal;
    }

    private void append(int region, int color) throws IOException {
        seq++;
        journal.append(new JournalRecord(seq, region, color));
        commands++;
        if (journal.shouldCompact()) {
            journal.compact(colors);
            seq = journal.lastSeq();
        }
    }

    private void put(int region, int color) {
        if (color == WHITE) {
            colors.remove(region);
        } else {
            colors.put(region, color);
        }
    }

    private void applyReplay(JournalRecord record) {
        put(record.region, record.color);
    }
}
