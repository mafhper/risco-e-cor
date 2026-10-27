package com.theomaria.poc.fill;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Regra dura de fronteira: o pacote {@code pure/} nao pode importar {@code android.*} nem
 * {@code androidx.*}. Sem isso, o algoritmo deixa de rodar na JVM e os testes de contrato viram
 * teste instrumentado — lento e dependente de aparelho.
 *
 * <p>Varre os fontes em vez de confiar em convencao. A contagem de arquivos e assertada para o
 * teste nao passar vazio se o caminho mudar (o modo de falha silenciosa classico de teste que varre
 * diretorio).
 */
public class PurityTest {

    private static final String[] EXPECTED = {
            "FillEngine.java", "RegionInfo.java", "RegionMap.java", "TapResult.java"
    };

    @Test
    public void purePackageHasNoAndroidImports() throws IOException {
        File dir = locatePureDir();
        assertTrue("diretorio nao encontrado: " + dir, dir.isDirectory());

        File[] files = dir.listFiles((d, name) -> name.endsWith(".java"));
        assertTrue("nenhum .java em " + dir, files != null && files.length > 0);

        List<String> names = new ArrayList<>();
        for (File f : files) {
            names.add(f.getName());
        }
        Collections.sort(names);
        List<String> expected = new ArrayList<>();
        Collections.addAll(expected, EXPECTED);
        Collections.sort(expected);
        assertEquals("arquivos do pacote pure/ mudaram — atualize EXPECTED", expected, names);

        List<String> violations = new ArrayList<>();
        for (File f : files) {
            int lineNumber = 0;
            for (String line : Files.readAllLines(f.toPath(), StandardCharsets.UTF_8)) {
                lineNumber++;
                String trimmed = line.trim();
                if (trimmed.startsWith("import android.") || trimmed.startsWith("import androidx.")) {
                    violations.add(f.getName() + ":" + lineNumber + " " + trimmed);
                }
                if (trimmed.contains("android.graphics.") || trimmed.contains("android.content.")) {
                    violations.add(f.getName() + ":" + lineNumber + " referencia " + trimmed);
                }
            }
        }
        assertEquals("pure/ tocou em android:", Collections.emptyList(), violations);
    }

    private static File locatePureDir() {
        File direct = new File("src/main/java/com/theomaria/poc/fill/pure");
        if (direct.isDirectory()) {
            return direct;
        }
        return new File("core/fill/src/main/java/com/theomaria/poc/fill/pure");
    }
}
