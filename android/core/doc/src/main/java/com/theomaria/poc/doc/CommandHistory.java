package com.theomaria.poc.doc;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Histórico de comandos com cursor: desfazer/refazer sem snapshot de bitmap.
 *
 * <p>A profundidade limita <b>quantos passos o undo alcança</b> (50 no app) e
 * nunca descarta comando do documento: apagar uma linha da lista apagaria
 * pintura de verdade. O orçamento de undo reinicia a cada comando novo; refazer
 * devolve orçamento até o teto.
 *
 * <p>Um comando novo depois de um undo descarta a frente de redo — comportamento
 * esperado de editor, não bug.
 *
 * <p>Genérico de propósito: o {@code :core:doc} guarda a mecânica, e o {@code :app}
 * guarda o que é um comando (fill, traço, borracha).
 */
public final class CommandHistory<T> {

    public static final int DEFAULT_DEPTH = 50;

    private final int depth;
    private final List<T> entries = new ArrayList<>();
    private int cursor;
    private int undoBudget;

    public CommandHistory() {
        this(DEFAULT_DEPTH);
    }

    public CommandHistory(int depth) {
        if (depth < 1) {
            throw new IllegalArgumentException("profundidade invalida: " + depth);
        }
        this.depth = depth;
    }

    /** Recomeça com a lista já aplicada (carregar do disco). */
    public void reset(List<T> applied) {
        entries.clear();
        entries.addAll(applied);
        cursor = entries.size();
        undoBudget = depth;
    }

    public void push(T command) {
        while (entries.size() > cursor) {
            entries.remove(entries.size() - 1);
        }
        entries.add(command);
        cursor = entries.size();
        undoBudget = depth;
    }

    /** @return comando desfeito, ou null */
    public T undo() {
        if (!canUndo()) {
            return null;
        }
        cursor--;
        undoBudget--;
        return entries.get(cursor);
    }

    /** @return comando refeito, ou null */
    public T redo() {
        if (!canRedo()) {
            return null;
        }
        T command = entries.get(cursor);
        cursor++;
        undoBudget = Math.min(depth, undoBudget + 1);
        return command;
    }

    public boolean canUndo() {
        return cursor > 0 && undoBudget > 0;
    }

    public boolean canRedo() {
        return cursor < entries.size();
    }

    /** Comandos aplicados, na ordem — a fonte do replay de pixels. */
    public List<T> applied() {
        return Collections.unmodifiableList(new ArrayList<>(entries.subList(0, cursor)));
    }

    public int appliedCount() {
        return cursor;
    }

    public int size() {
        return entries.size();
    }

    public int depth() {
        return depth;
    }

    public int undoBudget() {
        return undoBudget;
    }

    public void clear() {
        entries.clear();
        cursor = 0;
        undoBudget = depth;
    }
}
