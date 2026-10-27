package com.theomaria.draw.view;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.theomaria.draw.AppActivity;
import com.theomaria.draw.model.Artwork;
import com.theomaria.draw.model.Command;
import com.theomaria.draw.model.Inks;
import com.theomaria.draw.model.Profile;
import com.theomaria.draw.ui.Palette;
import com.theomaria.draw.ui.Type;
import com.theomaria.draw.ui.Ui;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Uma peca pendurada na parede: moldura do papel, miniatura, barra de cores da
 * obra e a etiqueta manuscrita com autor e data.
 *
 * <p>A moldura pertence a peca, nunca a tela: o fundo e um sussurro da cor
 * dominante (`color-mix(dominante 16%, card)`) e o angulo sai do id, entao a
 * mesma peca fica sempre torta do mesmo jeito. Sem sombra difusa: o que separa
 * do linho e uma borda de 1 px, papel sobre papel.
 */
public final class PieceCard extends LinearLayout {

    private static final int PALETTE_COLORS = 5;

    private PieceCard(Context context) {
        super(context);
        setOrientation(VERTICAL);
    }

    /**
     * @param widthPx   largura da celula (a coluna ja resolveu o gutter)
     * @param rotate    peca de parede: angulo -2..2 derivado do id
     * @param showAuthor  etiqueta com autor e data
     * @return cartao com altura propria; a coluna so empilha
     */
    public static PieceCard create(AppActivity host, Palette palette, Artwork artwork,
                                   Profile author, int widthPx, boolean rotate,
                                   boolean showAuthor, Runnable onOpen) {
        PieceCard card = new PieceCard(host);
        Context context = host;
        int pad = Ui.dp(context, 6f);
        int radius = Ui.dp(context, Ui.RADIUS);
        List<Integer> colors = paletteOf(artwork);

        FrameLayout frame = new FrameLayout(context);
        frame.setBackground(paperFrame(context, palette, colors.isEmpty() ? null : colors.get(0)));
        frame.setClickable(true);
        frame.setFocusable(true);
        Ui.pressable(frame);
        frame.setContentDescription(context.getString(com.theomaria.draw.R.string.open_piece));
        if (onOpen != null) {
            frame.setOnClickListener(v -> onOpen.run());
        }

        int previewW = widthPx - pad * 2;
        int previewH = Math.max(Ui.dp(context, 40f),
                Math.round(previewW * artwork.height / (float) Math.max(1, artwork.width)));
        ImageView image = new ImageView(context);
        // A miniatura em cache e quadrada (mesma escala nos dois eixos). Exibir
        // num quadro com a proporcao real desfaz a distorcao sem cortar a peca.
        image.setScaleType(ImageView.ScaleType.FIT_XY);
        FrameLayout.LayoutParams imageParams = new FrameLayout.LayoutParams(previewW, previewH);
        imageParams.gravity = Gravity.CENTER;
        frame.addView(image, imageParams);
        Thumbnails.into(context, image, artwork, host.store(), Math.max(160, previewW));

        LinearLayout.LayoutParams frameParams = new LinearLayout.LayoutParams(widthPx,
                previewH + pad * 2);
        card.addView(frame, frameParams);

        int barHeight = Ui.dp(context, 8f);
        if (!colors.isEmpty()) {
            PaletteBar bar = new PaletteBar(context, colors, palette.mutedSurface);
            LinearLayout.LayoutParams barParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, barHeight);
            barParams.topMargin = Ui.dp(context, 4f);
            card.addView(bar, barParams);
        }

        int captionHeight = 0;
        if (showAuthor) {
            TextView caption = Ui.typed(context,
                    (author == null ? "?" : author.name) + " · " + dayLabel(artwork.updatedAt),
                    Type.LABEL_SM, 14f, 0.01f, Ui.hand(), palette.inkMuted);
            caption.setMaxLines(1);
            caption.setEllipsize(android.text.TextUtils.TruncateAt.END);
            LinearLayout.LayoutParams captionParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            captionParams.topMargin = Ui.dp(context, 2f);
            captionParams.leftMargin = Ui.dp(context, 2f);
            card.addView(caption, captionParams);
            captionHeight = Ui.dp(context, 18f);
        }

        int total = previewH + pad * 2 + (colors.isEmpty() ? 0 : barHeight + Ui.dp(context, 4f))
                + captionHeight;
        card.setLayoutParams(new LinearLayout.LayoutParams(widthPx, total));
        if (rotate) {
            card.setRotation(rotationOf(artwork.id));
            card.setPivotX(widthPx / 2f);
            card.setPivotY(total * 0.6f);
        }
        return card;
    }

    /** Papel da moldura, um tom mais claro que o fundo, com a cor da obra. */
    private static Drawable paperFrame(Context context, Palette palette, Integer dominant) {
        int fill = dominant == null ? palette.card : palette.blend(palette.card, dominant, 0.12f);
        GradientDrawable body = new GradientDrawable();
        body.setShape(GradientDrawable.RECTANGLE);
        body.setColor(fill);
        body.setCornerRadius(Ui.dpf(context, Ui.RADIUS));
        GradientDrawable edge = new GradientDrawable();
        edge.setShape(GradientDrawable.RECTANGLE);
        edge.setColor(Color.TRANSPARENT);
        edge.setCornerRadius(Ui.dpf(context, Ui.RADIUS));
        edge.setStroke(Math.max(1, Ui.dp(context, 1f)), palette.blend(palette.ink, fill, 0.92f));
        LayerDrawable layered = new LayerDrawable(new Drawable[]{body, edge});
        return Ui.ripple(layered, Ui.withAlpha(palette.ink, 0.06f));
    }

    /**
     * As cores da obra, as mais usadas primeiro (regra do mockup: branco e
     * papel, nao cor; a peca sem cor nao tem barra). Repete para nao deixar
     * buraco quando ha menos de cinco.
     */
    public static List<Integer> paletteOf(Artwork artwork) {
        Map<Integer, Integer> counts = new LinkedHashMap<>();
        for (Command command : artwork.commands) {
            if (command.color == 0 || command.color == Inks.PAPER) {
                continue;
            }
            if (!command.isFill() && !command.isStroke()) {
                continue;
            }
            counts.merge(command.color, 1, Integer::sum);
        }
        List<Map.Entry<Integer, Integer>> ranked = new ArrayList<>(counts.entrySet());
        ranked.sort((a, b) -> {
            int byCount = b.getValue() - a.getValue();
            return byCount != 0 ? byCount : Integer.compare(a.getKey(), b.getKey());
        });
        List<Integer> out = new ArrayList<>();
        for (int i = 0; i < ranked.size() && out.size() < PALETTE_COLORS; i++) {
            out.add(ranked.get(i).getKey());
        }
        if (out.isEmpty()) {
            return out;
        }
        List<Integer> full = new ArrayList<>(out);
        for (int i = out.size(); i < PALETTE_COLORS; i++) {
            full.add(out.get(i % out.size()));
        }
        return full;
    }

    /** Angulo fixo por peca (-2..2), o mesmo hash do mockup. */
    public static float rotationOf(String id) {
        int hash = 0;
        for (int i = 0; i < id.length(); i++) {
            hash = (hash * 31 + id.charAt(i));
        }
        int step = Math.abs(hash) % 41;
        return (step - 20) / 10f;
    }

    /** "hoje", "ontem", "ha 3 dias" — nunca um timestamp cru. */
    public static String dayLabel(long at) {
        long days = (System.currentTimeMillis() - at) / 86_400_000L;
        if (days <= 0) {
            return "hoje";
        }
        if (days == 1) {
            return "ontem";
        }
        if (days < 7) {
            return "há " + days + " dias";
        }
        if (days < 30) {
            return "há " + (days / 7) + " sem";
        }
        return "há " + (days / 30) + " meses";
    }

    /** Barra de cores da obra: segmentos iguais sobre o cinza do papel. */
    static final class PaletteBar extends View {
        private final int[] colors;
        private final Paint base = new Paint();
        private final Paint segment = new Paint();
        private final RectF rect = new RectF();

        PaletteBar(Context context, List<Integer> colors, int muted) {
            super(context);
            this.colors = new int[colors.size()];
            for (int i = 0; i < colors.size(); i++) {
                this.colors[i] = colors.get(i);
            }
            base.setColor(muted);
            segment.setAntiAlias(true);
        }

        @Override
        protected void onDraw(Canvas canvas) {
            float radius = getHeight() / 2f;
            rect.set(0, 0, getWidth(), getHeight());
            canvas.drawRoundRect(rect, radius, radius, base);
            int save = canvas.save();
            canvas.clipRect(rect);
            float step = getWidth() / (float) colors.length;
            for (int i = 0; i < colors.length; i++) {
                segment.setColor(colors[i]);
                canvas.drawRect(i * step, 0, (i + 1) * step + 1f, getHeight(), segment);
            }
            canvas.restoreToCount(save);
        }
    }
}
