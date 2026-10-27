package com.theomaria.poc.doc;

import org.junit.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

public class CommandHistoryTest {

    @Test
    public void newCommandAfterUndoDropsTheRedoFront() {
        CommandHistory<String> history = new CommandHistory<>(50);
        history.push("a");
        history.push("b");
        assertEquals("b", history.undo());
        history.push("c");
        assertFalse(history.canRedo());
        assertEquals(Arrays.asList("a", "c"), history.applied());
    }

    @Test
    public void sixtyCommandsKeepTheWholeDocumentAndLimitUndoToFifty() {
        CommandHistory<Integer> history = new CommandHistory<>(50);
        for (int i = 1; i <= 60; i++) {
            history.push(i);
        }
        // Nada é descartado: a criança continua vendo as 60 marcas.
        assertEquals(60, history.size());
        assertEquals(60, history.appliedCount());

        int undone = 0;
        while (history.canUndo()) {
            history.undo();
            undone++;
        }
        // Mas o undo alcança no máximo 50 passos.
        assertEquals(50, undone);
        assertEquals(10, history.appliedCount());
        assertNull(history.undo());
        assertEquals(10, history.applied().get(9).intValue());
    }

    @Test
    public void redoWalksForwardInOrder() {
        CommandHistory<String> history = new CommandHistory<>();
        history.push("a");
        history.push("b");
        history.push("c");
        assertEquals("c", history.undo());
        assertEquals("b", history.undo());
        assertEquals("b", history.redo());
        assertEquals("c", history.redo());
        assertNull(history.redo());
    }

    @Test
    public void undoBudgetRefillsOnNewCommand() {
        CommandHistory<String> history = new CommandHistory<>(3);
        history.push("a");
        history.push("b");
        history.push("c");
        assertEquals("c", history.undo());
        assertEquals("b", history.undo());
        assertEquals("a", history.undo());
        assertFalse(history.canUndo());
        history.push("d");
        assertEquals(3, history.undoBudget());
        assertTrue(history.canUndo());
    }

    @Test
    public void resetLoadsAppliedListWithoutRedoFront() {
        CommandHistory<String> history = new CommandHistory<>();
        history.push("x");
        history.reset(Arrays.asList("a", "b"));
        assertEquals(2, history.appliedCount());
        assertFalse(history.canRedo());
        assertEquals("b", history.undo());
    }

    @Test
    public void budgetIsNeverMoreThanDepth() {
        CommandHistory<String> history = new CommandHistory<>(2);
        history.push("a");
        history.push("b");
        history.push("c");
        List<String> applied = history.applied();
        assertEquals(3, applied.size());
        assertEquals("c", history.undo());
        assertEquals("b", history.undo());
        assertFalse(history.canUndo());
        assertEquals("b", history.redo());
        // Refazer devolve exatamente uma vaga de undo, nunca o teto inteiro.
        assertEquals(1, history.undoBudget());
    }
}
