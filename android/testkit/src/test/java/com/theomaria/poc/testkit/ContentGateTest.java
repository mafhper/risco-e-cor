package com.theomaria.poc.testkit;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.BeforeClass;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

import javax.imageio.ImageIO;

/**
 * Portao de conteudo do POC-A: as duas paginas sinteticas tem de ter a geometria planejada, a
 * pagina adversaria tem de produzir o caminho de rejeicao, e os tres arquivos tem de respeitar o
 * contrato de formato.
 *
 * <p>As areas esperadas vem da tabela do §5 da especificacao (fonte independente do gerador). A
 * tolerancia de 2% cobre a convencao de raster inclusiva ({@code |dx| <= meia-medida} produz 181 px
 * onde a conta ideal previu 180).
 *
 * <p>Sobre as classes de area: o §5.5 do plano pede "pequena &lt;2%, media ~10%, grande &gt;25%",
 * mas a tabela do §5 da especificacao nao tem nenhuma regiao perto de 10% — as duas "medias" caem
 * em 6,74% e 6,41%. O portao usa a faixa 4–15% para "media" e registra a divergencia em vez de
 * esconder: a geometria medida e a da tabela.
 */
public class ContentGateTest {

    private static PageGenerator.Rendered control;
    private static PageGenerator.Rendered adversarial;

    @Rule
    public TemporaryFolder tmp = new TemporaryFolder();

    @BeforeClass
    public static void renderOnce() {
        control = PageGenerator.render(PageSpec.pagePoc());
        adversarial = PageGenerator.render(PageSpec.adversarial());
    }

    @Test
    public void controlPageHasTheEightPlannedRegions() {
        assertEquals(8, control.regions().size());
        for (int id = 2; id <= 9; id++) {
            assertNotNull("regiao " + id + " ausente", control.region(id));
        }
        assertTrue(control.orphans().isEmpty());
    }

    @Test
    public void controlRegionAreasMatchThePlanTable() {
        double[][] planned = {
                {2, 20106},
                {3, 25200},
                {4, 70686},
                {5, 20000},
                {6, 264104},
                {7, 67200},
                {8, 25447},
                {9, 9800}
        };
        for (double[] row : planned) {
            int id = (int) row[0];
            double expected = row[1];
            PageGenerator.RegionStat stat = control.region(id);
            assertNotNull("regiao " + id, stat);
            double tolerance = expected * 0.02;
            assertTrue("regiao " + id + ": areaPx=" + stat.areaPx + " esperado " + expected
                            + " +-2%", Math.abs(stat.areaPx - expected) <= tolerance);
        }
    }

    @Test
    public void everyControlRegionIsUnderTheFillCap() {
        for (PageGenerator.RegionStat stat : control.regions()) {
            assertTrue("regiao " + stat.id + " com " + stat.areaPct + "%",
                    stat.areaPct < 40.0);
        }
    }

    @Test
    public void controlPageCoversTheThreeAreaClasses() {
        boolean small = false;
        boolean medium = false;
        boolean large = false;
        for (PageGenerator.RegionStat stat : control.regions()) {
            if (stat.areaPct <= 2.5) {
                small = true;
            }
            if (stat.areaPct >= 4.0 && stat.areaPct <= 15.0) {
                medium = true;
            }
            if (stat.areaPct >= 20.0) {
                large = true;
            }
        }
        assertTrue("nenhuma regiao pequena (<2,5%)", small);
        assertTrue("nenhuma regiao media (4-15%)", medium);
        assertTrue("nenhuma regiao grande (>=20%)", large);
    }

    @Test
    public void controlPageBboxesDoNotOverlap() {
        for (int i = 0; i < control.regions().size(); i++) {
            PageGenerator.RegionStat a = control.regions().get(i);
            for (int j = i + 1; j < control.regions().size(); j++) {
                PageGenerator.RegionStat b = control.regions().get(j);
                boolean overlap = a.x < b.x + b.w && b.x < a.x + a.w
                        && a.y < b.y + b.h && b.y < a.y + a.h;
                assertTrue("bbox de " + a.id + " e " + b.id + " se sobrepoem", !overlap);
            }
        }
    }

    @Test
    public void adversarialPageHasARegionAboveTheCap() {
        boolean found = false;
        for (PageGenerator.RegionStat stat : adversarial.regions()) {
            if (stat.areaPct > 40.0) {
                found = true;
                assertEquals("a regiao fechada grande e a 2", 2, stat.id);
            }
        }
        assertTrue("a pagina adversaria precisa de uma regiao > 40%", found);
    }

    @Test
    public void adversarialGapMergesTheSmallCircleIntoTheExterior() {
        assertNull("o rotulo 3 deveria ter fundido com o exterior pela lacuna de 1 px",
                adversarial.region(3));
        assertNotNull("a regiao 4 e o controle fechado", adversarial.region(4));
        assertTrue(adversarial.region(4).areaPct < 40.0);
        assertTrue("a pagina adversaria nao deveria ter componentes orfas",
                adversarial.orphans().isEmpty());
    }

    @Test
    public void pngAlphaIsExactlyTheContour() throws Exception {
        File dir = tmp.newFolder("png");
        PageGenerator.Rendered written = PageGenerator.write(PageSpec.pagePoc(), dir);

        BufferedImage image = ImageIO.read(new File(dir, "page_poc.png"));
        assertNotNull(image);
        assertEquals(1024, image.getWidth());
        assertEquals(1024, image.getHeight());

        int mismatches = 0;
        int firstX = -1;
        int firstY = -1;
        int opaque = 0;
        for (int y = 0; y < image.getHeight(); y++) {
            for (int x = 0; x < image.getWidth(); x++) {
                int alpha = (image.getRGB(x, y) >>> 24) & 0xFF;
                boolean isContour = written.labels[y * 1024 + x] == PageGenerator.LABEL_CONTOUR;
                boolean isOpaque = alpha == 255;
                if (isOpaque) {
                    opaque++;
                }
                if (isContour != isOpaque) {
                    if (mismatches == 0) {
                        firstX = x;
                        firstY = y;
                    }
                    mismatches++;
                }
            }
        }
        assertEquals("primeiro mismatch em " + firstX + "," + firstY, 0, mismatches);
        assertEquals(written.inkPixels(), opaque);
    }

    @Test
    public void mapFollowsTheBinaryContract() throws Exception {
        File dir = tmp.newFolder("map");
        PageGenerator.Rendered written = PageGenerator.write(PageSpec.pagePoc(), dir);
        byte[] bytes = Files.readAllBytes(new File(dir, "page_poc.map").toPath());

        assertEquals(16 + 2 * 1024 * 1024, bytes.length);
        assertEquals('R', bytes[0] & 0xFF);
        assertEquals('M', bytes[1] & 0xFF);
        assertEquals('A', bytes[2] & 0xFF);
        assertEquals('P', bytes[3] & 0xFF);
        assertEquals(1, bytes[4] & 0xFF);
        assertEquals(0, bytes[5] & 0xFF);
        assertEquals(0, bytes[6] & 0xFF);
        assertEquals(0, bytes[7] & 0xFF);
        assertEquals(1024, labelAt(bytes, 8));
        assertEquals(1024, labelAt(bytes, 12));

        // Oracolo geometrico independente do escritor: offset = 16 + 2*(y*W + x).
        assertEquals(1, pixelAt(bytes, 0, 0));
        assertEquals(2, pixelAt(bytes, 200, 140));
        assertEquals(4, pixelAt(bytes, 200, 620));
        assertEquals(6, pixelAt(bytes, 730, 512));
        assertEquals(6, pixelAt(bytes, 440, 512));
        assertEquals(0, pixelAt(bytes, 439, 512));
        assertEquals(9, pixelAt(bytes, 950, 930));

        int diffs = 0;
        for (int i = 0; i < written.labels.length; i++) {
            if ((bytes[16 + 2 * i] & 0xFF) != written.labels[i]) {
                diffs++;
            }
        }
        assertEquals("rotulos empacotados divergem do raster", 0, diffs);
    }

    @Test
    public void sidecarCarriesThePageMetadata() throws Exception {
        File dir = tmp.newFolder("json");
        PageGenerator.write(PageSpec.pagePoc(), dir);
        PageGenerator.write(PageSpec.adversarial(), dir);

        String controlJson = new String(
                Files.readAllBytes(new File(dir, "page_poc.json").toPath()), StandardCharsets.UTF_8);
        assertTrue(controlJson.contains("\"pageId\": \"page_poc\""));
        assertTrue(controlJson.contains("\"fillableMaxAreaPct\": 40.0"));
        assertTrue(controlJson.contains("\"closingPx\": 9"));
        assertEquals(8, countOf(controlJson, "\"id\":"));

        String adversarialJson = new String(
                Files.readAllBytes(new File(dir, "page_adversarial.json").toPath()),
                StandardCharsets.UTF_8);
        assertEquals(2, countOf(adversarialJson, "\"id\":"));
        int bigRegion = adversarialJson.indexOf("\"id\": 2,");
        assertTrue(bigRegion > 0);
        String bigRegionBlock = adversarialJson.substring(bigRegion,
                adversarialJson.indexOf('}', bigRegion));
        assertTrue("a regiao de 46,8% tem de estar marcada como nao pintavel",
                bigRegionBlock.contains("\"fillable\": false"));
    }

    private static int countOf(String text, String needle) {
        int count = 0;
        int from = 0;
        while (true) {
            int index = text.indexOf(needle, from);
            if (index < 0) {
                return count;
            }
            count++;
            from = index + needle.length();
        }
    }

    private static int pixelAt(byte[] bytes, int x, int y) {
        int offset = 16 + 2 * (y * 1024 + x);
        return (bytes[offset] & 0xFF) | ((bytes[offset + 1] & 0xFF) << 8);
    }

    /** Le um uint32 LE do cabecalho. */
    private static long labelAt(byte[] bytes, int offset) {
        return (bytes[offset] & 0xFFL)
                | ((bytes[offset + 1] & 0xFFL) << 8)
                | ((bytes[offset + 2] & 0xFFL) << 16)
                | ((bytes[offset + 3] & 0xFFL) << 24);
    }
}
