package com.theomaria.poc.doc;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.zip.CRC32;

/**
 * Uma linha do journal: {@code seq|region|colorHex|crc32}.
 *
 * <p>O CRC32 cobre exatamente {@code "seq|region|colorHex"} (sem o separador final). Linha que nao
 * parseia ou cujo CRC falha e descartada — e assim que a linha truncada por kill e detectada.
 *
 * <p>Fonte: a spec de implementacao do POC-A §4.4.
 */
public final class JournalRecord {

    public final int seq;
    public final int region;
    public final int color;

    public JournalRecord(int seq, int region, int color) {
        if (seq < 0) {
            throw new IllegalArgumentException("seq negativo: " + seq);
        }
        if (region < 2) {
            throw new IllegalArgumentException("region fora do contrato: " + region);
        }
        this.seq = seq;
        this.region = region;
        this.color = color;
    }

    /** Payload sem CRC: {@code seq|region|colorHex}. */
    public String payload() {
        return seq + "|" + region + "|" + colorHex();
    }

    public String format() {
        String payload = payload();
        return payload + "|" + crcHex(payload);
    }

    public String colorHex() {
        return String.format(Locale.ROOT, "%08X", color);
    }

    /** @return registro, ou null se a linha estiver truncada/corrompida */
    public static JournalRecord parse(String line) {
        if (line == null) {
            return null;
        }
        String trimmed = line.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        String[] parts = trimmed.split("\\|", -1);
        if (parts.length != 4) {
            return null;
        }
        if (parts[2].length() != 8 || parts[3].length() != 8) {
            return null;
        }
        try {
            int seq = Integer.parseInt(parts[0]);
            int region = Integer.parseInt(parts[1]);
            int color = Integer.parseUnsignedInt(parts[2], 16);
            String payload = parts[0] + "|" + parts[1] + "|" + parts[2];
            String expected = crcHex(payload);
            if (!expected.equalsIgnoreCase(parts[3])) {
                return null;
            }
            return new JournalRecord(seq, region, color);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String crcHex(String payload) {
        CRC32 crc = new CRC32();
        crc.update(payload.getBytes(StandardCharsets.US_ASCII));
        return String.format(Locale.ROOT, "%08X", crc.getValue());
    }

    @Override
    public String toString() {
        return format();
    }
}
