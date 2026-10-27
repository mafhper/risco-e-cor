package com.theomaria.draw.view;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.theomaria.draw.AppActivity;
import com.theomaria.draw.model.Artwork;
import com.theomaria.draw.model.Profile;
import com.theomaria.draw.ui.Glyph;
import com.theomaria.draw.ui.Palette;
import com.theomaria.draw.ui.Ui;

/** Peça pendurada no mural: papel, miniatura, autor e selo de estado. */
public final class ArtworkCard extends FrameLayout {

    private final ImageView image;

    @SuppressLint("ClickableViewAccessibility")
    public ArtworkCard(AppActivity host, Palette palette, Artwork artwork, Profile author,
                       boolean showAuthor, boolean showBadge, boolean showDelete,
                       int sidePx, float radiusDp, float insetDp, Runnable onOpen,
                       Runnable onDelete) {
        super(host);
        Context context = host;
        setBackground(Ui.rippleRounded(context, palette.paper, radiusDp, palette.border,
                Ui.withAlpha(palette.ink, 0.08f)));
        setClickable(true);
        setFocusable(true);
        Ui.pressable(this);
        if (onOpen != null) {
            setOnClickListener(v -> onOpen.run());
        }
        setContentDescription(context.getString(com.theomaria.draw.R.string.open_piece));

        image = new ImageView(context);
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        // Raio concentrico: a folha de papel interna e o cartao menos o inset.
        // O clip evita que o bitmap quadrado fure o canto arredondado.
        image.setBackground(Ui.rounded(palette.paper,
                Ui.dpf(context, Ui.concentric(radiusDp, insetDp)), 0, 0));
        image.setClipToOutline(true);
        LayoutParams imageParams = new LayoutParams(LayoutParams.MATCH_PARENT,
                LayoutParams.MATCH_PARENT);
        int inset = Ui.dp(context, insetDp);
        imageParams.setMargins(inset, inset, inset, inset);
        addView(image, imageParams);
        Thumbnails.into(context, image, artwork, host.store(), sidePx);

        if (showBadge) {
            FrameLayout badge = new FrameLayout(context);
            boolean published = artwork.published;
            badge.setBackground(Ui.rippleRounded(context,
                    published ? palette.amber : palette.card,
                    999f, published ? Color.TRANSPARENT : palette.border, Color.TRANSPARENT));
            int badgeSize = Ui.dp(context, 28f);
            LayoutParams badgeParams = new LayoutParams(badgeSize, badgeSize);
            badgeParams.gravity = Gravity.TOP | Gravity.END;
            badgeParams.setMargins(0, Ui.dp(context, 8f), Ui.dp(context, 8f), 0);
            Glyph.View24 icon = new Glyph.View24(context,
                    published ? Glyph.Kind.STAR : Glyph.Kind.PLAY,
                    published ? palette.onAmber : palette.inkMuted, 13f);
            FrameLayout.LayoutParams iconParams = new FrameLayout.LayoutParams(
                    Ui.dp(context, 14f), Ui.dp(context, 14f));
            iconParams.gravity = Gravity.CENTER;
            badge.addView(icon, iconParams);
            badge.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
            addView(badge, badgeParams);
        }

        if (showDelete && !artwork.published && onDelete != null) {
            Ui.IconButton delete = new Ui.IconButton(context, Glyph.Kind.TRASH,
                    Ui.withAlpha(palette.card, 0.94f), palette.border, palette.danger, 38f);
            delete.setContentDescription(context.getString(
                    com.theomaria.draw.R.string.discard_draft));
            delete.setOnClickListener(v -> onDelete.run());
            LayoutParams params = new LayoutParams(Ui.dp(context, 38f), Ui.dp(context, 38f));
            params.gravity = Gravity.TOP | Gravity.START;
            params.setMargins(Ui.dp(context, 8f), Ui.dp(context, 8f), 0, 0);
            delete.setLayoutParams(params);
            addView(delete);
        }

        if (showAuthor) {
            LinearLayout chip = Ui.row(context);
            chip.setBackground(Ui.rounded(Ui.withAlpha(palette.card, 0.94f), Ui.dpf(context, 999f),
                    palette.border, Ui.dpf(context, 1f)));
            Ui.padding(chip, 8, 4, 10, 4);
            View dot = new View(context);
            dot.setBackground(Ui.rounded(author == null ? palette.inkMuted
                    : author.theme().primary(palette.dark), Ui.dpf(context, 999f), 0, 0));
            LinearLayout.LayoutParams dotParams = new LinearLayout.LayoutParams(
                    Ui.dp(context, 6f), Ui.dp(context, 6f));
            dotParams.rightMargin = Ui.dp(context, 6f);
            chip.addView(dot, dotParams);
            TextView name = Ui.text(context, author == null ? "" : author.name, 12f,
                    Ui.sansBold(), palette.ink);
            chip.addView(name);
            LayoutParams chipParams = new LayoutParams(LayoutParams.WRAP_CONTENT,
                    LayoutParams.WRAP_CONTENT);
            chipParams.gravity = Gravity.BOTTOM | Gravity.START;
            chipParams.setMargins(Ui.dp(context, 8f), 0, Ui.dp(context, 8f), Ui.dp(context, 8f));
            chip.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
            addView(chip, chipParams);
        }
    }

    public ImageView image() {
        return image;
    }
}
