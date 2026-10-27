package com.theomaria.poc.doc;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;
import java.util.TreeMap;

/**
 * Journal append-only: formato, CRC, tolerancia a linha truncada, reparo do tail e compaction.
 *
 * <p>O caso A8 (kill no meio da escrita) e o teste
 * {@link #appendAfterATruncatedTailKeepsTheFileParseable()} — se o append nao reparasse a quebra,
 * o registro seguinte se colaria no fragmento e a linha inteira seria descartada na proxima carga.
 */
public class JournalTest {

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    private File journalFile() throws Exception {
        return new File(tmp.newFolder(), "journal.dat");
    }

    @Test
    public void lineHasTheDocumentedShape() {
        JournalRecord record = new JournalRecord(12, 3, 0xFFEEDDCC);
        String line = record.format();
        String[] parts = line.split("\\|", -1);
        assertEquals(4, parts.length);
        assertEquals("12", parts[0]);
        assertEquals("3", parts[1]);
        assertEquals("FFEEDDCC", parts[2]);
        assertEquals(8, parts[3].length());

        JournalRecord parsed = JournalRecord.parse(line);
        assertNotNull(parsed);
        assertEquals(12, parsed.seq);
        assertEquals(3, parsed.region);
        assertEquals(0xFFEEDDCC, parsed.color);
    }

    @Test
    public void lineStaysUnderTheByteBudget() {
        // Pior caso plausivel: seq de 6 digitos, regiao de 5, cor 8 hex, crc 8.
        JournalRecord worst = new JournalRecord(999999, 65534, 0xFFFFFFFF);
        assertTrue("linha de " + worst.format().length() + " B",
                worst.format().getBytes(StandardCharsets.US_ASCII).length <= 64);
        // Caso tipico do POC (seq < 1000, regiao < 10).
        JournalRecord typical = new JournalRecord(12, 3, 0xFFEEDDCC);
        assertTrue(typical.format().length() <= 30);
    }

    @Test
    public void corruptedChecksumIsDiscarded() {
        String good = new JournalRecord(1, 2, 0xFF112233).format();
        assertNotNull(JournalRecord.parse(good));

        char[] chars = good.toCharArray();
        int hexIndex = good.indexOf("FF112233");
        chars[hexIndex + 7] = chars[hexIndex + 7] == '3' ? '4' : '3';
        assertNull(JournalRecord.parse(new String(chars)));
    }

    @Test
    public void malformedLinesAreDiscarded() {
        assertNull(JournalRecord.parse(""));
        assertNull(JournalRecord.parse("1|2|FF"));
        assertNull(JournalRecord.parse("1|2|FF112233"));
        assertNull(JournalRecord.parse("x|2|FF112233|00000000"));
        assertNull(JournalRecord.parse("1|2|ZZ112233|00000000"));
    }

    @Test
    public void truncatedLastLineIsDroppedOnLoad() throws Exception {
        File file = journalFile();
        Journal journal = new Journal(file);
        journal.append(new JournalRecord(1, 2, 0xFF112233));
        journal.append(new JournalRecord(2, 3, 0xFF445566));

        String text = new String(Files.readAllBytes(file.toPath()), StandardCharsets.US_ASCII);
        int cut = text.lastIndexOf('\n', text.length() - 2);
        // Corta a ultima linha no meio, como um kill no meio do write.
        Files.write(file.toPath(),
                text.substring(0, cut + 7).getBytes(StandardCharsets.US_ASCII));

        Journal reloaded = new Journal(file);
        List<JournalRecord> records = reloaded.load();

        assertEquals(1, records.size());
        assertEquals(2, records.get(0).region);
        assertEquals(1, reloaded.skippedLines());
    }

    @Test
    public void appendAfterATruncatedTailKeepsTheFileParseable() throws Exception {
        File file = journalFile();
        Journal journal = new Journal(file);
        journal.append(new JournalRecord(1, 2, 0xFF112233));
        journal.append(new JournalRecord(2, 3, 0xFF445566));

        String text = new String(Files.readAllBytes(file.toPath()), StandardCharsets.US_ASCII);
        int cut = text.lastIndexOf('\n', text.length() - 2);
        Files.write(file.toPath(),
                text.substring(0, cut + 7).getBytes(StandardCharsets.US_ASCII));

        Journal reopened = new Journal(file);
        reopened.load();
        reopened.append(new JournalRecord(7, 4, 0xFF778899));

        List<JournalRecord> records = new Journal(file).load();

        assertEquals(2, records.size());
        assertEquals(2, records.get(0).region);
        assertEquals(4, records.get(1).region);
        assertEquals(7, records.get(1).seq);
    }

    @Test
    public void compactionWritesOneLinePerRegion() throws Exception {
        File file = journalFile();
        Journal journal = new Journal(file);
        for (int i = 0; i < 600; i++) {
            journal.append(new JournalRecord(i + 1, 2 + (i % 3), 0xFF000000 | i));
        }
        assertEquals(600, Files.readAllLines(file.toPath()).size());

        TreeMap<Integer, Integer> colors = new TreeMap<>();
        colors.put(2, 0xFFAABBCC);
        colors.put(4, 0xFF123456);
        journal.compact(colors);

        assertEquals(2, Files.readAllLines(file.toPath()).size());
        List<JournalRecord> records = new Journal(file).load();
        assertEquals(2, records.size());
        assertEquals(2, records.get(0).region);
        assertEquals(0xFFAABBCC, records.get(0).color);
        assertEquals(4, records.get(1).region);
        assertEquals(0xFF123456, records.get(1).color);
    }

    @Test
    public void appendCounterFlipsAtTheThreshold() throws Exception {
        Journal journal = new Journal(journalFile());
        for (int i = 0; i < Journal.COMPACT_THRESHOLD - 1; i++) {
            journal.append(new JournalRecord(i + 1, 2, 0xFF000000 | i));
        }
        assertFalse(journal.shouldCompact());

        journal.append(new JournalRecord(Journal.COMPACT_THRESHOLD, 2, 0xFFFFFFFF));
        assertTrue(journal.shouldCompact());

        journal.compact(new TreeMap<>());
        assertFalse(journal.shouldCompact());
    }

    @Test
    public void loadOfAMissingFileIsEmpty() throws Exception {
        Journal journal = new Journal(new File(tmp.getRoot(), "nao-existe.dat"));
        assertTrue(journal.load().isEmpty());
    }
}
