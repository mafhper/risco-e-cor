package com.theomaria.draw.ui;

import android.graphics.Color;
import android.os.Looper;
import android.view.View;
import android.widget.FrameLayout;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.Shadows;
import org.robolectric.annotation.Config;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

/**
 * O movimento do better-ui, medido no mockup, agora como contrato do app:
 * durações, supressão na troca de tema, fim de saída dirigido pela animação
 * (não por um timer paralelo), cross-fade de ícone e stagger só na primeira vez.
 *
 * <p>Os números esperados vêm do relatório do mockup (fonte independente), não
 * de uma conta feita aqui com as mesmas constantes do código.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class MotionTest {

    private final android.app.Application app = RuntimeEnvironment.getApplication();

    private void idle(long millis) {
        Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofMillis(millis));
    }

    @Test
    public void durationsAndScalesAreTheOnesMeasuredInTheMockup() {
        assertEquals("entrada de folha", 280L, Motion.ENTER_MS);
        assertEquals("saída de folha", 150L, Motion.EXIT_MS);
        assertEquals("pressionar", 150L, Motion.PRESS_MS);
        assertEquals("cross-fade", 300L, Motion.CROSSFADE_MS);
        assertEquals("intervalo do stagger", 100L, Motion.STAGGER_MS);
        assertEquals("escala do press", 0.96f, Motion.PRESS_SCALE, 0f);
        assertEquals("deslocamento da saída", 12f, Motion.EXIT_DY_DP, 0f);
        assertEquals("escala inicial do cross-fade", 0.25f, Motion.CROSSFADE_SCALE_FROM, 0f);
        assertEquals("blur inicial do cross-fade", 4f, Motion.CROSSFADE_BLUR_DP, 0f);
    }

    @Test
    public void themeSwitchCommitsSettledAndThenMotionComesBack() {
        FrameLayout overlay = new FrameLayout(app);
        View content = new View(app);

        Motion.beginThemeSwitch();
        assertTrue("supressão ligada", Motion.suppressed());
        Motion.enterSheet(overlay, content);
        assertEquals("folha já assentada", 1f, content.getAlpha(), 0.001f);
        assertEquals("sem deslocamento", 0f, content.getTranslationY(), 0.001f);

        Motion.endThemeSwitch();
        assertFalse("supressão desligada", Motion.suppressed());
        Motion.enterSheet(overlay, content);
        assertTrue("o scrim volta a fundir", overlay.getAlpha() < 1f);
        assertTrue("a folha vem de baixo", content.getTranslationY() > 0f);

        idle(600);
        assertEquals(1f, overlay.getAlpha(), 0.001f);
        assertEquals(0f, content.getTranslationY(), 0.001f);
    }

    @Test
    public void exitUnmountsOnlyWhenTheAnimationEnds() {
        FrameLayout overlay = new FrameLayout(app);
        View content = new View(app);
        overlay.addView(content);
        final boolean[] ended = {false};

        Motion.exitSheet(overlay, content, () -> ended[0] = true);
        assertFalse("o unmount não antecipa o movimento", ended[0]);

        idle(400);
        assertTrue("o unmount segue o fim da animação", ended[0]);
    }

    @Test
    public void crossFadeEndsWithOnlyTheIncomingIcon() {
        FrameLayout parent = new FrameLayout(app);
        Glyph.View24 outgoing = new Glyph.View24(app, Glyph.Kind.STAR, Color.BLACK, 24f);
        Glyph.View24 incoming = new Glyph.View24(app, Glyph.Kind.PLAY, Color.BLACK, 24f);
        parent.addView(outgoing);
        parent.addView(incoming);

        Motion.crossFade(outgoing, incoming);
        assertEquals("entra invisível", 0f, incoming.getAlpha(), 0.001f);
        assertEquals("entra pequeno", 0.25f, incoming.getScaleX(), 0.001f);
        assertEquals("entra desfocado", 4f, incoming.blurDp(), 0.001f);

        idle(600);
        assertEquals("só o ícone novo fica", 1, parent.getChildCount());
        assertSame(incoming, parent.getChildAt(0));
        assertEquals(1f, incoming.getAlpha(), 0.001f);
        assertEquals(1f, incoming.getScaleX(), 0.001f);
        assertEquals(0f, incoming.blurDp(), 0.001f);
    }

    @Test
    public void staggerMovesOnlyOnTheFirstRun() {
        List<View> blocks = Arrays.asList(new View(app), new View(app));

        Motion.stagger(blocks, false);
        assertEquals("sem stagger, o bloco já está no lugar", 1f, blocks.get(1).getAlpha(), 0.001f);

        Motion.stagger(blocks, true);
        assertEquals("no stagger o bloco espera invisível", 0f, blocks.get(1).getAlpha(), 0.001f);
        assertTrue("e deslocado", blocks.get(1).getTranslationY() > 0f);

        idle(900);
        assertEquals(1f, blocks.get(1).getAlpha(), 0.001f);
        assertEquals(0f, blocks.get(1).getTranslationY(), 0.001f);
    }

    @Test
    public void pressSurfaceScalesToNinetySixAndComesBack() {
        View view = new View(app);
        view.setClickable(true);
        Ui.pressable(view);
        assertNotNull("superfície com press", view.getStateListAnimator());

        view.setPressed(true);
        idle(300);
        assertEquals(Motion.PRESS_SCALE, view.getScaleX(), 0.01f);
        assertEquals(Motion.PRESS_SCALE, view.getScaleY(), 0.01f);

        view.setPressed(false);
        idle(300);
        assertEquals(1f, view.getScaleX(), 0.01f);
        assertEquals(1f, view.getScaleY(), 0.01f);
    }

    @Test
    public void staticSurfaceOptsOutOfPressScale() {
        View view = new View(app);
        view.setClickable(true);
        Ui.staticSurface(view);
        Ui.pressable(view);

        assertTrue(Ui.pressStatic(view));
        assertEquals("HUD não escala", null, view.getStateListAnimator());
    }
}
