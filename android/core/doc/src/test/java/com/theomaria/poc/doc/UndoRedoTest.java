package com.theomaria.poc.doc;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import com.theomaria.poc.fill.pure.FillEngine;
import com.theomaria.poc.fill.pure.RegionMap;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.nio.ByteBuffer;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Critério A6 — undo/redo — e a consistencia journal x estado (A8).
 *
 * <p>O hash e de <b>C1a</b> (o buffer de pixels), nao do mapa de cores: repintar as regioes e parte
 * do caminho de undo, e um erro de replay (dilatacao esquecida, ordem errada) tem de aparecer aqui.
 *
 * <p>A profundidade e 50. "Sequencia de 60 comandos e desfazer tudo" <b>nao</b> volta ao estado
 * inicial — volta ao estado do 10o comando, e o teste afirma exatamente isso em vez de fingir que
 * a pilha e infinita.
 */
public class UndoRedoTest {

    private static final int WHITE = 0xFFFFFFFF;
    private static final int[] PALETTE = {
            0xFFE57373, 0xFF64B5F6, 0xFFFFD54F, 0xFF81C784, 0xFFBA68C8, 0xFF4DD0E1
    };

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @Test
    public void undoEverythingReturnsToTheInitialHashAndRedoReapplies() throws Exception {
        RegionMap map = map();
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);
        int[] pixels = intArray(map.pixelCount(), WHITE);
        Document document = new Document(new Journal(new File(tmp.newFolder(), "journal.dat")));
        document.load();

        String initial = sha256(pixels);
        List<String> states = new ArrayList<>();
        states.add(initial);

        int applied = 0;
        for (int i = 0; i < 20; i++) {
            if (document.paint(2 + (i % 2), PALETTE[i % PALETTE.length])) {
                applied++;
                engine.replay(document.colors(), pixels, WHITE);
                states.add(sha256(pixels));
            }
        }
        assertEquals(20, applied);
        assertTrue(document.canUndo());

        for (int i = 0; i < applied; i++) {
            assertTrue("undo " + i, document.undo());
            engine.replay(document.colors(), pixels, WHITE);
        }
        assertEquals("desfazer tudo tem de voltar ao estado inicial", initial, sha256(pixels));
        assertFalse(document.canUndo());

        for (int i = 0; i < applied; i++) {
            assertTrue("redo " + i, document.redo());
            engine.replay(document.colors(), pixels, WHITE);
        }
        assertEquals("redo tem de reaplicar o ultimo estado", states.get(applied), sha256(pixels));
    }

    @Test
    public void sixtyCommandsWithAFiftyDeepStackStopAtTheTenth() throws Exception {
        RegionMap map = map();
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);
        int[] pixels = intArray(map.pixelCount(), WHITE);
        Document document = new Document(new Journal(new File(tmp.newFolder(), "journal.dat")));
        document.load();

        List<String> states = new ArrayList<>();
        states.add(sha256(pixels));
        for (int i = 0; i < 60; i++) {
            // Cor unica por comando: todo paint altera o estado e entra na pilha.
            assertTrue(document.paint(2 + (i % 2), 0xFF000000 | i));
            engine.replay(document.colors(), pixels, WHITE);
            states.add(sha256(pixels));
        }

        int undone = 0;
        while (document.undo()) {
            undone++;
            engine.replay(document.colors(), pixels, WHITE);
            if (undone > 100) {
                break; // trava contra pilha infinita
            }
        }
        assertEquals(50, undone);
        assertEquals("desfazer 50 de 60 comandos cai no estado do 10o", states.get(10), sha256(pixels));
    }

    @Test
    public void journalSurvivesUndoAndRedoOnReload() throws Exception {
        File file = new File(tmp.newFolder(), "journal.dat");
        RegionMap map = map();
        FillEngine engine = new FillEngine(map, 40.0, 1, 2);
        int[] pixels = intArray(map.pixelCount(), WHITE);

        Document document = new Document(new Journal(file));
        document.load();
        assertTrue(document.paint(2, 0xFFE57373));
        assertTrue(document.paint(3, 0xFF64B5F6));
        assertTrue(document.undo()); // LIFO: desfaz o ultimo comando, que foi a regiao 3

        Document reloaded = new Document(new Journal(file));
        reloaded.load();
        assertEquals("a regiao 2 continua pintada (undo e LIFO)", 0xFFE57373, reloaded.colorOf(2));
        assertEquals("a regiao 3 voltou a branco", Document.WHITE, reloaded.colorOf(3));

        engine.replay(reloaded.colors(), pixels, WHITE);
        String afterUndo = sha256(pixels);

        assertTrue(document.redo());
        engine.replay(document.colors(), pixels, WHITE);
        Document reloadedAgain = new Document(new Journal(file));
        reloadedAgain.load();
        engine.replay(reloadedAgain.colors(), pixels, WHITE);

        assertEquals(0xFF64B5F6, reloadedAgain.colorOf(3));
        assertFalse(afterUndo.equals(sha256(pixels)));
    }

    @Test
    public void compactionTriggeredByVolumeKeepsTheCurrentState() throws Exception {
        File file = new File(tmp.newFolder(), "journal.dat");
        Document document = new Document(new Journal(file));
        document.load();

        for (int i = 0; i < 600; i++) {
            document.paint(2 + (i % 2), PALETTE[i % PALETTE.length]);
        }
        int expected2 = document.colorOf(2);
        int expected3 = document.colorOf(3);
        assertTrue("journal deveria ter compactado", document.journal().appendedSinceLoad() < 600);

        Document reloaded = new Document(new Journal(file));
        reloaded.load();
        assertEquals(expected2, reloaded.colorOf(2));
        assertEquals(expected3, reloaded.colorOf(3));
        assertEquals(600, document.commands());
    }

    @Test
    public void paintingTheSameColourIsNotACommand() throws Exception {
        File file = new File(tmp.newFolder(), "journal.dat");
        Document document = new Document(new Journal(file));
        document.load();

        assertTrue(document.paint(2, 0xFFE57373));
        assertFalse(document.paint(2, 0xFFE57373));
        assertEquals(1, document.commands());
        assertEquals(1, new Journal(file).load().size());
        assertFalse(document.canRedo());
    }

    @Test
    public void undoStackDropsTheOldestEntryInsteadOfGrowing() throws Exception {
        Document document = new Document(new Journal(new File(tmp.newFolder(), "journal.dat")));
        document.load();

        for (int i = 0; i < 80; i++) {
            document.paint(2 + (i % 2), 0xFF000000 | i);
        }
        int undone = 0;
        while (document.undo()) {
            undone++;
        }
        assertEquals(UndoStack.DEFAULT_DEPTH, undone);
    }

    // --- fixtures ---

    /** 16x16, regioes 2 e 3 de 3x3, contorno de 1 px, resto exterior. */
    private static RegionMap map() {
        int w = 16;
        int h = 16;
        int[] labels = new int[w * h];
        Arrays.fill(labels, -1);
        for (int y = 2; y <= 4; y++) {
            for (int x = 2; x <= 4; x++) {
                labels[y * w + x] = 2;
            }
        }
        for (int y = 10; y <= 12; y++) {
            for (int x = 10; x <= 12; x++) {
                labels[y * w + x] = 3;
            }
        }
        for (int y = 0; y < h; y++) {
            for (int x = 0; x < w; x++) {
                if (labels[y * w + x] >= 2) {
                    continue;
                }
                boolean near = false;
                for (int dy = -1; dy <= 1 && !near; dy++) {
                    for (int dx = -1; dx <= 1; dx++) {
                        int nx = x + dx;
                        int ny = y + dy;
                        if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
                            continue;
                        }
                        if (labels[ny * w + nx] >= 2) {
                            near = true;
                            break;
                        }
                    }
                }
                labels[y * w + x] = near ? 0 : 1;
            }
        }

        byte[] data = new byte[16 + 2 * labels.length];
        data[0] = 0x52;
        data[1] = 0x4D;
        data[2] = 0x41;
        data[3] = 0x50;
        data[4] = 1;
        data[8] = (byte) w;
        data[12] = (byte) h;
        int p = 16;
        for (int label : labels) {
            data[p] = (byte) (label & 0xFF);
            data[p + 1] = (byte) ((label >>> 8) & 0xFF);
            p += 2;
        }
        return RegionMap.fromBytes(data, 40.0);
    }

    private static int[] intArray(int size, int value) {
        int[] out = new int[size];
        Arrays.fill(out, value);
        return out;
    }

    private static String sha256(int[] pixels) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            ByteBuffer buffer = ByteBuffer.allocate(pixels.length * 4);
            for (int pixel : pixels) {
                buffer.putInt(pixel);
            }
            byte[] hash = digest.digest(buffer.array());
            StringBuilder sb = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                sb.append(String.format(Locale.ROOT, "%02x", b));
            }
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
