package com.theomaria.draw;

import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.theomaria.draw.model.Artwork;
import com.theomaria.draw.model.ArtworkSession;
import com.theomaria.draw.model.Inks;
import com.theomaria.draw.model.Profile;
import com.theomaria.draw.view.CanvasScreen;
import com.theomaria.draw.view.GalleryScreen;
import com.theomaria.draw.view.ViewerScreen;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;

import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

/**
 * Fluxo real na JVM: Home → perfil → criar → colorir → guardar/publicar →
 * galeria. Não substitui o smoke no aparelho; existe para o caminho de
 * navegação, fill, undo/redo e persistência não chegarem ao aparelho sem prova.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class FlowSmokeTest {

    private AppActivity openApp() {
        AppActivity activity = Robolectric.buildActivity(AppActivity.class).setup().get();
        Shadows.shadowOf(Looper.getMainLooper()).idle();
        return activity;
    }

    @Test
    public void homeProfileCanvasFillUndoPublishAndGallery() {
        AppActivity activity = openApp();
        View root = activity.findViewById(android.R.id.content);

        View maria = byDescription(root, "Entrar no perfil de Maria");
        assertNotNull("perfil Maria na Home", maria);
        maria.performClick();
        idle();

        assertNotNull("tela do perfil",
                byDescription(activity.findViewById(android.R.id.content), "Começar a desenhar"));
        assertNotNull(byDescription(activity.findViewById(android.R.id.content), "Meus desenhos"));

        click(activity, "Começar a desenhar");
        click(activity, "Página para colorir");
        idle();

        CanvasScreen canvas = find(activity.findViewById(android.R.id.content), CanvasScreen.class);
        assertNotNull("canvas aberto", canvas);
        ArtworkSession session = canvas.session();
        assertTrue("estampa da pagina carregada", session.isPage());
        assertEquals(0, session.commandCount());

        // Região 6 do page_poc (área 25%) pintada de vermelho.
        ArtworkSession.FillReport red = session.fill(730, 512, Inks.SIX[0]);
        assertTrue("fill pintou", red.painted());
        assertEquals(0, red.leaks);
        assertEquals(1, session.commandCount());

        // Região 4 em azul.
        ArtworkSession.FillReport blue = session.fill(200, 620, Inks.SIX[4]);
        assertTrue("segundo fill pintou", blue.painted());
        assertEquals(0, blue.leaks);
        assertEquals(2, session.commandCount());

        // Tocar a mesma cor na mesma região não cria comando novo.
        session.fill(730, 512, Inks.SIX[0]);
        assertEquals(2, session.commandCount());

        assertTrue(session.undo());
        assertEquals(1, session.commandCount());
        assertTrue(session.redo());
        assertEquals(2, session.commandCount());

        // Traço livre entra no mesmo histórico.
        session.beginStroke(100, 100, 0, Inks.SIX[2], 10);
        session.extendStroke(160, 140);
        session.extendStroke(220, 120);
        assertTrue(session.endStroke());
        assertEquals(3, session.commandCount());

        // Desfaz o traço para publicar só com os dois fills.
        assertTrue(session.undo());
        assertEquals(2, session.commandCount());

        click(activity, "Guardar");
        assertNotNull("folha de guardar", byDescription(activity.findViewById(android.R.id.content),
                "Publicar no mural"));
        click(activity, "Publicar no mural");
        idle();

        assertNotNull("voltou para o perfil",
                byDescription(activity.findViewById(android.R.id.content), "Começar a desenhar"));
        List<Artwork> published = activity.store().published();
        assertEquals(1, published.size());
        assertEquals(2, published.get(0).commands.size());
        assertTrue("arquivo da peca existe",
                new java.io.File(activity.store().dir(), published.get(0).id + ".json").exists());

        // Galeria lista a peça publicada e abre em modo leitura.
        click(activity, "Meus desenhos");
        idle();
        assertNotNull(find(activity.findViewById(android.R.id.content), GalleryScreen.class));
        View card = byDescription(activity.findViewById(android.R.id.content), "Abrir peça");
        assertNotNull("card na galeria", card);
        card.performClick();
        idle();
        assertNotNull(find(activity.findViewById(android.R.id.content), ViewerScreen.class));

        // Voltar duas vezes: galeria/visualizador → perfil → Home.
        activity.onBackPressed();
        idle();
        activity.onBackPressed();
        idle();
        activity.onBackPressed();
        idle();
        assertNotNull("Home de volta", byDescription(activity.findViewById(android.R.id.content),
                "Entrar no perfil de Maria"));
    }

    @Test
    public void kidsProfileHasNoFunctionalTextAndBlankSheetDiscardLeavesNoFile() {
        AppActivity activity = openApp();
        click(activity, "Entrar no perfil de Theo");
        idle();
        View root = activity.findViewById(android.R.id.content);
        assertNotNull("portal colorir", byDescription(root, "Página para colorir"));
        assertNotNull("portal folha", byDescription(root, "Folha em branco"));
        assertNull("kids sem rótulo de galeria", byDescription(root, "Meus desenhos"));
        assertNull("kids sem rótulo de criar", byDescription(root, "Criar com"));

        int before = activity.store().all().size();
        click(activity, "Folha em branco");
        idle();
        CanvasScreen canvas = find(activity.findViewById(android.R.id.content), CanvasScreen.class);
        assertNotNull(canvas);
        assertEquals(0, canvas.session().commandCount());
        canvas.onBack();
        idle();
        assertEquals("folha vazia não deixa arquivo", before, activity.store().all().size());
        assertNotNull("voltou ao perfil do Theo",
                byDescription(activity.findViewById(android.R.id.content), "Folha em branco"));
    }

    @Test
    public void draftDiscardWithUndoRestoresTheFile() {
        AppActivity activity = openApp();
        click(activity, "Entrar no perfil de Maria");
        click(activity, "Começar a desenhar");
        click(activity, "Folha em branco");
        idle();

        CanvasScreen canvas = find(activity.findViewById(android.R.id.content), CanvasScreen.class);
        assertNotNull(canvas);
        canvas.session().beginStroke(120, 140, 1, Inks.SIX[3], 22);
        canvas.session().extendStroke(240, 260);
        canvas.session().extendStroke(300, 200);
        assertTrue(canvas.session().endStroke());

        click(activity, "Guardar");
        click(activity, "Guardar rascunho");
        idle();
        assertEquals(1, activity.store().forProfile("p-maria").size());

        click(activity, "Meus desenhos");
        idle();
        assertEquals(1, activity.store().forProfile("p-maria").size());

        click(activity, "Apagar rascunho");
        assertEquals("rascunho apagado", 0, activity.store().forProfile("p-maria").size());

        click(activity, "Desfazer");
        assertEquals("desfazer restaura", 1, activity.store().forProfile("p-maria").size());
        assertNotNull(byDescription(activity.findViewById(android.R.id.content), "Abrir peça"));
    }

    @Test
    public void draftsSurviveARecreatedProcess() {
        AppActivity activity = openApp();
        Profile maria = activity.profiles().byId("p-maria");
        assertNotNull(maria);
        Artwork artwork = new Artwork("test-survive", maria.id, Artwork.KIND_BLANK, null,
                1024, 1024, System.currentTimeMillis());
        activity.store().saveNow(artwork);

        AppActivity recreated = openApp();
        List<Artwork> mine = recreated.store().forProfile(maria.id);
        assertEquals(1, mine.size());
        assertEquals("test-survive", mine.get(0).id);
        assertFalse(mine.get(0).published);
    }

    // ------------------------------------------------------------ helpers ---

    private void click(AppActivity activity, String needle) {
        View target = byDescription(activity.findViewById(android.R.id.content), needle);
        assertNotNull("nao achei '" + needle + "'", target);
        target.performClick();
        idle();
    }

    private void idle() {
        Shadows.shadowOf(Looper.getMainLooper()).idle();
    }

    private static View byDescription(View root, String needle) {
        if (!(root instanceof ViewGroup)) {
            return null;
        }
        ViewGroup group = (ViewGroup) root;
        for (int i = 0; i < group.getChildCount(); i++) {
            View child = group.getChildAt(i);
            CharSequence description = child.getContentDescription();
            if (description != null && description.toString().contains(needle)) {
                return child;
            }
            if (child instanceof TextView) {
                CharSequence text = ((TextView) child).getText();
                if (text != null && text.toString().contains(needle)) {
                    return child;
                }
            }
            View nested = byDescription(child, needle);
            if (nested != null) {
                return nested;
            }
        }
        return null;
    }

    private static <T extends View> T find(View root, Class<T> type) {
        if (type.isInstance(root)) {
            return type.cast(root);
        }
        if (!(root instanceof ViewGroup)) {
            return null;
        }
        ViewGroup group = (ViewGroup) root;
        for (int i = 0; i < group.getChildCount(); i++) {
            T found = find(group.getChildAt(i), type);
            if (found != null) {
                return found;
            }
        }
        return null;
    }
}
