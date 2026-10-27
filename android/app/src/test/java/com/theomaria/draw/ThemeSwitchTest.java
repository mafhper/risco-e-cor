package com.theomaria.draw;

import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import com.theomaria.draw.ui.Motion;
import com.theomaria.draw.view.SettingsScreen;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.Shadows;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

/**
 * A troca de tema é um commit, não uma transição: a paleta vira, a tela em que o
 * adulto estava continua em pé, e nada anima durante o recreate.
 *
 * <p>Antes do lote, trocar o tema a partir das configurações devolvia a Home —
 * o adulto trocava o esquema e perdia a tela. Aqui o caminho é o de verdade:
 * gear → "Escuro" → recreate → mesma tela, paleta nova.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class ThemeSwitchTest {

    @Test
    public void themeSwitchKeepsTheScreenAndFlipsThePalette() {
        ActivityController<AppActivity> controller =
                Robolectric.buildActivity(AppActivity.class).setup();
        AppActivity activity = controller.get();
        idle();

        click(activity, "Configurações");
        assertTrue("abriu configurações", activity.top() instanceof SettingsScreen);
        boolean wasDark = activity.dark();

        click(activity, wasDark ? "Claro" : "Escuro");
        idle();

        AppActivity after = controller.get();
        assertNotNull("activity viva depois do commit", after);
        assertTrue("continua na tela de configurações",
                after.top() instanceof SettingsScreen);
        assertEquals("a paleta virou", !wasDark, after.dark());
        assertEquals("e a preferência foi gravada", wasDark ? Prefs.LIGHT : Prefs.DARK,
                after.prefs().scheme());
        assertFalse("o commit soltou a supressão no frame seguinte", Motion.suppressed());
        assertEquals("a rota é consumida uma vez", null, after.prefs().takeRoute());
    }

    @Test
    public void leavingSettingsDoesNotLeaveAStaleRouteBehind() {
        ActivityController<AppActivity> controller =
                Robolectric.buildActivity(AppActivity.class).setup();
        AppActivity activity = controller.get();
        idle();
        activity.openSettings();
        idle();
        activity.pop();
        idle();

        activity.setScheme(activity.prefs().scheme() == Prefs.DARK ? Prefs.LIGHT : Prefs.DARK);
        idle();

        AppActivity after = controller.get();
        assertFalse("a Home continua sendo a tela depois do commit",
                after.top() instanceof SettingsScreen);
        assertEquals("sem rota pendente", null, after.prefs().takeRoute());
    }

    // ----------------------------------------------------------- helpers ---

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
}
