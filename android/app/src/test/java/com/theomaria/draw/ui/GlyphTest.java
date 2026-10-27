package com.theomaria.draw.ui;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

/**
 * O peso do traço do glifo: 1,5 regular e 2 semibold (o mockup usa esses dois
 * valores e nenhum outro). O teste mede o {@link Paint} que o desenho realmente
 * usa — não uma constante ao lado dele.
 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class GlyphTest {

    private Paint draw(Glyph.Kind kind) {
        Bitmap bitmap = Bitmap.createBitmap(48, 48, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        canvas.translate(24f, 24f);
        Glyph.draw(canvas, kind, paint, 48f);
        bitmap.recycle();
        return paint;
    }

    @Test
    public void strokeIsOneOfTheTwoWeightsForEveryGlyph() {
        for (Glyph.Kind kind : Glyph.Kind.values()) {
            float stroke = Glyph.strokeFor(kind);
            assertTrue(kind + " com traço " + stroke,
                    stroke == Glyph.STROKE_REGULAR || stroke == Glyph.STROKE_SEMIBOLD);
        }
    }

    @Test
    public void regularGlyphDrawsWithFifteen() {
        assertEquals(1.5f, Glyph.STROKE_REGULAR, 0f);
        assertEquals(1.5f, draw(Glyph.Kind.UNDO).getStrokeWidth(), 0f);
        assertEquals(1.5f, draw(Glyph.Kind.PENCIL).getStrokeWidth(), 0f);
        assertEquals(1.5f, draw(Glyph.Kind.CLOSE).getStrokeWidth(), 0f);
    }

    @Test
    public void semiboldGlyphDrawsWithTwo() {
        assertEquals(2f, Glyph.STROKE_SEMIBOLD, 0f);
        assertEquals(2f, draw(Glyph.Kind.PLAY).getStrokeWidth(), 0f);
        assertEquals(2f, draw(Glyph.Kind.CHECK).getStrokeWidth(), 0f);
        assertEquals(2f, draw(Glyph.Kind.PLUS).getStrokeWidth(), 0f);
    }

    @Test
    public void playIsStrokedAndNudgedOneUnitForOpticalCentering() {
        assertEquals("o triângulo do play é traço, não preenchimento", 2f,
                draw(Glyph.Kind.PLAY).getStrokeWidth(), 0f);
        assertEquals(1f, Glyph.opticalNudge(Glyph.Kind.PLAY), 0f);
        assertEquals(0f, Glyph.opticalNudge(Glyph.Kind.UNDO), 0f);
    }
}
