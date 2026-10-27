package com.theomaria.draw.ui;

import org.junit.Test;

import static org.junit.Assert.assertEquals;

/**
 * O raio kids do mockup é um par, não um número: 28 de fora com 8 dp de inset
 * deixa 20 dentro. Se alguém mudar um dos dois, a conta denuncia.
 */
public class UiGeometryTest {

    @Test
    public void kidsInnerRadiusIsTheOuterRadiusMinusTheInset() {
        assertEquals(28f, Ui.RADIUS_KIDS, 0f);
        assertEquals(8f, Ui.RADIUS_KIDS_INSET, 0f);
        assertEquals(20f, Ui.RADIUS_KIDS_INNER, 0f);
        assertEquals(Ui.RADIUS_KIDS_INNER,
                Ui.concentric(Ui.RADIUS_KIDS, Ui.RADIUS_KIDS_INSET), 0f);
    }

    @Test
    public void concentricNeverGoesNegative() {
        assertEquals(0f, Ui.concentric(12f, 20f), 0f);
    }
}
