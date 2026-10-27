package com.theomaria.poc.doc;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Journal append-only, tolerante a linha truncada.
 *
 * <p>Tres propriedades que o POC exige (A7/A8):
 * <ul>
 *   <li>toda escrita e seguida de flush — o ultimo comando confirmado sobrevive ao kill;</li>
 *   <li>se o arquivo termina sem {@code \n} (tail truncado), o proximo append <b>repara</b> a
 *       quebra antes de escrever, para nao colar dois registros numa linha ilegivel;</li>
 *   <li>acima de {@link #COMPACT_THRESHOLD} linhas, reescreve um arquivo com uma linha por regiao
 *       e troca por {@code ATOMIC_MOVE}.</li>
 * </ul>
 *
 * <p>Custo por linha: {@code seq|region|colorHex|crc32} = 25–30 B tipicos (alvo A7 &lt;= 64 B).
 */
public final class Journal {

    public static final int COMPACT_THRESHOLD = 512;

    private final File file;
    private int lastSeq;
    private int appendedSinceLoad;
    private int skippedLines;

    public Journal(File file) {
        if (file == null) {
            throw new IllegalArgumentException("arquivo de journal nulo");
        }
        this.file = file;
    }

    public File file() {
        return file;
    }

    public int lastSeq() {
        return lastSeq;
    }

    public int appendedSinceLoad() {
        return appendedSinceLoad;
    }

    public int skippedLines() {
        return skippedLines;
    }

    /** Le e valida todas as linhas; linhas invalidas sao descartadas e contadas. */
    public List<JournalRecord> load() throws IOException {
        List<JournalRecord> out = new ArrayList<>();
        skippedLines = 0;
        appendedSinceLoad = 0;
        if (!file.exists()) {
            lastSeq = 0;
            return out;
        }
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(
                new FileInputStream(file), StandardCharsets.US_ASCII))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.trim().isEmpty()) {
                    continue;
                }
                JournalRecord record = JournalRecord.parse(line);
                if (record == null) {
                    skippedLines++;
                    continue;
                }
                out.add(record);
                if (record.seq > lastSeq) {
                    lastSeq = record.seq;
                }
            }
        }
        return Collections.unmodifiableList(out);
    }

    /** Append com flush. Repara tail sem newline antes de escrever. */
    public synchronized void append(JournalRecord record) throws IOException {
        File dir = file.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new IOException("nao foi possivel criar " + dir);
        }
        boolean needsNewline = false;
        if (file.isFile() && file.length() > 0) {
            try (RandomAccessFile raf = new RandomAccessFile(file, "r")) {
                raf.seek(file.length() - 1);
                needsNewline = raf.read() != '\n';
            }
        }
        try (FileOutputStream fos = new FileOutputStream(file, true)) {
            if (needsNewline) {
                fos.write('\n');
            }
            fos.write(record.format().getBytes(StandardCharsets.US_ASCII));
            fos.write('\n');
            fos.flush();
        }
        appendedSinceLoad++;
        if (record.seq > lastSeq) {
            lastSeq = record.seq;
        }
    }

    /**
     * Reescreve o journal com uma linha por regiao colorida (estado atual), em ordem de id.
     * Perde o historico de undo — que vive na memoria do {@link Document}.
     */
    public synchronized void compact(Map<Integer, Integer> colorByLabel) throws IOException {
        File dir = file.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new IOException("nao foi possivel criar " + dir);
        }
        File tmp = new File(dir, file.getName() + ".tmp");
        List<Integer> ids = new ArrayList<>(colorByLabel.keySet());
        Collections.sort(ids);
        int seq = 0;
        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(
                new FileOutputStream(tmp), StandardCharsets.US_ASCII))) {
            for (Integer id : ids) {
                Integer color = colorByLabel.get(id);
                if (color == null) {
                    continue;
                }
                seq++;
                writer.write(new JournalRecord(seq, id, color).format());
                writer.write('\n');
            }
            writer.flush();
        }
        Files.move(tmp.toPath(), file.toPath(),
                StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        lastSeq = seq;
        appendedSinceLoad = 0;
    }

    public boolean shouldCompact() {
        return appendedSinceLoad >= COMPACT_THRESHOLD;
    }
}
