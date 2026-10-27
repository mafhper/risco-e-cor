package com.theomaria.draw;

import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.theomaria.draw.model.Inks;
import com.theomaria.draw.ui.Ui;
import com.theomaria.draw.view.CanvasScreen;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;

import java.util.ArrayList;
import java.util.List;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

/**
 * O press scale é 100% das superfícies — e isso se prova pela árvore de views
 * que cada tela realmente monta, não por uma lista de call sites lembrados.
 *
 * <p>Percorre Home (com a folha "com quem"), perfil pro e kids, folha de criar,
 * canvas nos três estados, folha de guardar, galeria e configurações. Falha
 * apontando a view e a tela de qualquer alvo clicável que tenha ficado de fora,
 * exceto os marcados como estáticos (HUD do canvas e scrims).
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class PressCoverageTest {

    @Test
    public void everyClickableSurfaceHasPressScale() {
        AppActivity activity = open();

        assertCoverage(activity, "home");

        click(activity, "Nova peça");
        assertCoverage(activity, "home/folha-com-quem");
        activity.onBackPressed();
        idle();

        click(activity, "Entrar no perfil de Maria");
        assertCoverage(activity, "perfil");

        click(activity, "Começar a desenhar");
        assertCoverage(activity, "perfil/criar");

        click(activity, "Página para colorir");
        assertCoverage(activity, "canvas/mini");

        click(activity, "Trocar ferramenta");
        assertCoverage(activity, "canvas/compacto");

        click(activity, "Expandir painel");
        assertCoverage(activity, "canvas/expandido");

        click(activity, "Recolher painel");
        click(activity, "Recolher painel");

        CanvasScreen canvas = find(activity.findViewById(android.R.id.content), CanvasScreen.class);
        assertNotNull("canvas aberto", canvas);
        canvas.session().beginStroke(120, 140, 1, Inks.SIX[3], 22);
        canvas.session().extendStroke(240, 260);
        canvas.session().extendStroke(300, 200);
        assertTrue("traço registrado", canvas.session().endStroke());

        click(activity, "Guardar");
        assertCoverage(activity, "canvas/guardar");

        click(activity, "Publicar no mural");
        idle();
        assertCoverage(activity, "perfil/publicado");

        click(activity, "Meus desenhos");
        assertCoverage(activity, "galeria");

        activity.onBackPressed();
        idle();
        activity.onBackPressed();
        idle();

        click(activity, "Configurações");
        assertCoverage(activity, "configuracoes");

        activity.onBackPressed();
        idle();
        click(activity, "Entrar no perfil de Theo");
        assertCoverage(activity, "perfil kids");
    }

    // ------------------------------------------------------------ prova ---

    private void assertCoverage(AppActivity activity, String where) {
        View root = activity.findViewById(android.R.id.content);
        assertNotNull(where + ": raiz", root);
        List<String> missing = new ArrayList<>();
        collect(root, missing);
        report(where, missing);
        assertTrue(where + ": sem press em " + missing, missing.isEmpty());
    }

    private void collect(View view, List<String> missing) {
        if (view.getVisibility() != View.VISIBLE) {
            return;
        }
        if (view.isClickable() && view.isEnabled()
                && !Ui.pressStatic(view) && view.getStateListAnimator() == null) {
            missing.add(describe(view));
        }
        if (!(view instanceof ViewGroup)) {
            return;
        }
        ViewGroup group = (ViewGroup) view;
        for (int i = 0; i < group.getChildCount(); i++) {
            collect(group.getChildAt(i), missing);
        }
    }

    private static String describe(View view) {
        StringBuilder out = new StringBuilder(view.getClass().getSimpleName());
        CharSequence description = view.getContentDescription();
        if (description != null) {
            out.append(" desc=").append(description);
        }
        if (view instanceof TextView) {
            out.append(" text=").append(((TextView) view).getText());
        }
        return out.toString();
    }

    private static void report(String where, List<String> missing) {
        try {
            java.io.File dir = new java.io.File(System.getProperty("user.dir"), "build/evidence");
            if (!dir.exists() && !dir.mkdirs()) {
                throw new IllegalStateException("nao criou " + dir);
            }
            String name = "press-" + where.replace('/', '-').replace(' ', '-') + ".txt";
            try (java.io.FileWriter writer = new java.io.FileWriter(new java.io.File(dir, name))) {
                writer.write("tela=" + where + " sem_press=" + missing.size() + "\n");
                for (String item : missing) {
                    writer.write(item + "\n");
                }
            }
        } catch (java.io.IOException e) {
            throw new IllegalStateException(e);
        }
    }

    // ----------------------------------------------------------- helpers ---

    private AppActivity open() {
        AppActivity activity = Robolectric.buildActivity(AppActivity.class).setup().get();
        idle();
        return activity;
    }

    private void idle() {
        Shadows.shadowOf(Looper.getMainLooper()).idle();
    }

    private void click(AppActivity activity, String needle) {
        View target = byDescription(activity.findViewById(android.R.id.content), needle);
        assertNotNull("nao achei '" + needle + "'", target);
        target.performClick();
        idle();
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