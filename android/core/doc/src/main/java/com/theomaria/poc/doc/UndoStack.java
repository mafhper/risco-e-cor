package com.theomaria.poc.doc;

import java.util.ArrayList;
import java.util.List;

/**
 * Pilha de undo/redo com profundidade fixa (default 50, criterio A6).
 *
 * <p>Um {@link Entry} guarda a cor anterior e a nova de uma regiao. Quando a pilha enche, a entrada
 * mais antiga e descartada: desfazer "tudo" so alcanca as {@code depth} ultimas operacoes — o
 * limite e do criterio, nao um bug (registrado no relatorio).
 */
public final class UndoStack {

    public static final int DEFAULT_DEPTH = 50;

    public static final class Entry {
        public final int region;
        public final int before;
        public final int after;

        public Entry(int region, int before, int after) {
            this.region = region;
            this.before = before;
            this.after = after;
        }
    }

    private final int depth;
    private final List<Entry> entries = new ArrayList<>();
    private int cursor;

    public UndoStack(int depth) {
        if (depth < 1) {
            throw new IllegalArgumentException("profundidade invalida: " + depth);
        }
        this.depth = depth;
    }

    public void push(int region, int before, int after) {
        while (entries.size() > cursor) {
            entries.remove(entries.size() - 1);
        }
        entries.add(new Entry(region, before, after));
        cursor++;
        while (entries.size() > depth) {
            entries.remove(0);
            cursor--;
        }
    }

    /** @return entrada desfeita, ou null */
    public Entry undo() {
        if (cursor == 0) {
            return null;
        }
        cursor--;
        return entries.get(cursor);
    }

    /** @return entrada refeita, ou null */
    public Entry redo() {
        if (cursor >= entries.size()) {
            return null;
        }
        Entry entry = entries.get(cursor);
        cursor++;
        return entry;
    }

    public boolean canUndo() {
        return cursor > 0;
    }

    public boolean canRedo() {
        return cursor < entries.size();
    }

    public int applied() {
        return cursor;
    }

    public int size() {
        return entries.size();
    }

    public int depth() {
        return depth;
    }

    public void clear() {
        entries.clear();
        cursor = 0;
    }
}
