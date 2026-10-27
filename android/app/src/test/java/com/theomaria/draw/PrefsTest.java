package com.theomaria.draw;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/**
 * Duas preferências novas do lote better-ui: o "já aconteceu uma vez" do stagger
 * (que não pode repetir a cada visita) e a rota pendente que mantém a tela em pé
 * quando o tema recria a Activity.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class PrefsTest {

    private Prefs prefs() {
        return new Prefs(RuntimeEnvironment.getApplication());
    }

    @Test
    public void firstRunIsTrueExactlyOnce() {
        assertTrue("primeira vez", prefs().firstRun("stagger:teste"));
        assertFalse("segunda vez", prefs().firstRun("stagger:teste"));
        assertFalse("terceira vez", prefs().firstRun("stagger:teste"));
        assertTrue("chave diferente, primeira vez", prefs().firstRun("stagger:outro"));
    }

    @Test
    public void pendingRouteIsReadOnce() {
        Prefs prefs = prefs();
        assertEquals("sem rota pendente", null, prefs.takeRoute());
        prefs.setRoute(Prefs.ROUTE_SETTINGS);
        assertEquals(Prefs.ROUTE_SETTINGS, prefs().takeRoute());
        assertEquals("a rota é consumida", null, prefs().takeRoute());
    }
}
