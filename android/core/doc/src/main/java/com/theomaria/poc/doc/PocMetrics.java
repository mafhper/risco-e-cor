package com.theomaria.poc.doc;

import java.io.BufferedWriter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/**
 * Instrumentacao do POC-A: uma linha JSONL por amostra, flush por linha.
 *
 * <p>Campos fixos do §5.6 (page, label, areaPct, decision, fillNs, paintNs, presentNs, refreshHz)
 * mais o retangulo sujo — que e o que permite provar o criterio A3 (zero vazamento) contra o
 * {@code .map} como oraculo.
 *
 * <p>Relogio unico: {@code System.nanoTime()} (CLOCK_MONOTONIC). O plano dizia
 * {@code elapsedRealtimeNanos}; foi trocado porque os timestamps de frame
 * ({@code FrameMetrics.VSYNC_TIMESTAMP} / {@code Choreographer}) estao em CLOCK_MONOTONIC —
 * misturar as duas bases produziria latencia negativa.
 */
public final class PocMetrics {

    /** Uma amostra de toque. Campos publicos por ser POC descartavel. */
    public static final class Sample {
        public int seq;
        public String page = "";
        public int label;
        public double areaPct;
        public String decision = "";
        public long tapNs;
        public long fillNs;
        public long paintNs;
        public long presentNs;
        public long frameNs;
        public String presentSrc = "";
        public double refreshHz;
        public int dirtyX;
        public int dirtyY;
        public int dirtyW;
        public int dirtyH;
        public int paintedPx;
    }

    private final File file;
    private BufferedWriter writer;

    public PocMetrics(File file) {
        if (file == null) {
            throw new IllegalArgumentException("arquivo de metricas nulo");
        }
        this.file = file;
    }

    public File file() {
        return file;
    }

    public synchronized void write(Sample s) throws IOException {
        StringBuilder b = new StringBuilder(320);
        b.append("{\"seq\":").append(s.seq)
                .append(",\"ev\":\"sample\"")
                .append(",\"page\":").append(quote(s.page))
                .append(",\"label\":").append(s.label)
                .append(",\"areaPct\":").append(dec(s.areaPct, 4))
                .append(",\"decision\":").append(quote(s.decision))
                .append(",\"tapNs\":").append(s.tapNs)
                .append(",\"fillNs\":").append(s.fillNs)
                .append(",\"paintNs\":").append(s.paintNs)
                .append(",\"presentNs\":").append(s.presentNs)
                .append(",\"frameNs\":").append(s.frameNs)
                .append(",\"src\":").append(quote(s.presentSrc))
                .append(",\"refreshHz\":").append(dec(s.refreshHz, 3))
                .append(",\"dirty\":[").append(s.dirtyX).append(',').append(s.dirtyY)
                .append(',').append(s.dirtyW).append(',').append(s.dirtyH).append(']')
                .append(",\"paintedPx\":").append(s.paintedPx)
                .append("}\n");
        writeLine(b.toString());
    }

    /** Evento de abertura de pagina (A4/A10). */
    public synchronized void open(String page, long readNs, long decodeNs, long mapNs, long totalNs)
            throws IOException {
        String line = "{\"ev\":\"open\""
                + ",\"page\":" + quote(page)
                + ",\"readNs\":" + readNs
                + ",\"decodeNs\":" + decodeNs
                + ",\"mapNs\":" + mapNs
                + ",\"totalNs\":" + totalNs
                + "}\n";
        writeLine(line);
    }

    /** Marca livre: inicio de lote, reset, troca de pagina, rejeicao. */
    public synchronized void note(String page, String kind, String detail) throws IOException {
        String line = "{\"ev\":\"note\""
                + ",\"page\":" + quote(page)
                + ",\"kind\":" + quote(kind)
                + ",\"detail\":" + quote(detail)
                + "}\n";
        writeLine(line);
    }

    public synchronized void close() {
        if (writer == null) {
            return;
        }
        try {
            writer.flush();
            writer.close();
        } catch (IOException ignored) {
            // POC: fechar metricas nunca derruba o app.
        } finally {
            writer = null;
        }
    }

    private void writeLine(String line) throws IOException {
        if (writer == null) {
            File dir = file.getParentFile();
            if (dir != null && !dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) {
                throw new IOException("nao foi possivel criar " + dir);
            }
            writer = new BufferedWriter(new OutputStreamWriter(
                    new FileOutputStream(file, true), StandardCharsets.UTF_8));
        }
        writer.write(line);
        writer.flush();
    }

    private static String dec(double value, int digits) {
        return String.format(Locale.ROOT, "%." + digits + "f", value);
    }

    private static String quote(String value) {
        if (value == null) {
            return "null";
        }
        StringBuilder b = new StringBuilder(value.length() + 2);
        b.append('"');
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"':
                    b.append("\\\"");
                    break;
                case '\\':
                    b.append("\\\\");
                    break;
                case '\n':
                    b.append("\\n");
                    break;
                case '\r':
                    b.append("\\r");
                    break;
                case '\t':
                    b.append("\\t");
                    break;
                default:
                    if (c < 0x20) {
                        b.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
                    } else {
                        b.append(c);
                    }
                    break;
            }
        }
        return b.append('"').toString();
    }
}
