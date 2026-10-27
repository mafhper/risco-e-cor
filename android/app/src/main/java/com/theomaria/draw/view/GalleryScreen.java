package com.theomaria.draw.view;

import android.content.Context;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.theomaria.draw.AppActivity;
import com.theomaria.draw.R;
import com.theomaria.draw.model.Artwork;
import com.theomaria.draw.model.Profile;
import com.theomaria.draw.ui.Glyph;
import com.theomaria.draw.ui.Ui;

import java.util.List;

/**
 * Galeria do perfil: rascunhos e publicadas na mesma grade, cada peça com seu
 * selo. Rascunho pode ser apagado — e o apagar tem desfazer, como toda ação
 * destrutiva do app.
 */
public final class GalleryScreen extends Screen {

    private final Profile profile;
    private final LinearLayout gridBox;
    private final TextView count;
    private final ScrollView scroll;
    private final LinearLayout column;

    public GalleryScreen(AppActivity host, Profile profile) {
        super(host);
        this.profile = profile;
        Context context = host;

        LinearLayout root = Ui.column(context);
        root.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout bar = Ui.row(context);
        Ui.padding(bar, 12, 8, 16, 4);
        Ui.IconButton back = new Ui.IconButton(context, Glyph.Kind.BACK, palette.card,
                palette.border, palette.ink, 44f);
        back.setContentDescription(context.getString(R.string.back));
        back.setOnClickListener(v -> host.pop());
        bar.addView(back);
        TextView title = Ui.text(context, context.getString(R.string.gallery_title), 21f,
                Ui.display(), palette.ink);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        titleParams.leftMargin = Ui.dp(context, 8f);
        bar.addView(title, titleParams);
        count = Ui.text(context, "", 12f, Ui.mono(), palette.inkMuted);
        bar.addView(count);
        root.addView(bar);

        scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        column = Ui.column(context);
        Ui.padding(column, 16, 8, 16, 28);
        gridBox = Ui.column(context);
        column.addView(gridBox, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        scroll.addView(column, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        addView(root);
        rebuild();
    }

    @Override
    public void onResumeScreen() {
        rebuild();
    }

    private void rebuild() {
        List<Artwork> pieces = host.store().forProfile(profile.id);
        count.setText(String.valueOf(pieces.size()));
        gridBox.removeAllViews();
        int gap = Ui.dp(host, 12f);
        int screen = host.getResources().getDisplayMetrics().widthPixels;
        int cell = (screen - Ui.dp(host, 32f) - gap) / 2;
        List<View> cells = new java.util.ArrayList<>();
        for (Artwork artwork : pieces) {
            cells.add(new ArtworkCard(host, palette, artwork, profile, false, true,
                    true, Math.max(cell, Ui.dp(host, 140f)), 14f, 3f,
                    () -> open(artwork), () -> discard(artwork)));
        }
        if (!cells.isEmpty()) {
            gridBox.addView(Ui.grid(host, cells, 2, cell, gap));
        }
        if (pieces.isEmpty()) {
            LinearLayout empty = Ui.column(host);
            empty.setGravity(Gravity.CENTER);
            empty.setBackground(Ui.rounded(Color.TRANSPARENT, Ui.dpf(host, 14f), palette.border,
                    Ui.dpf(host, 1f)));
            Ui.padding(empty, 18, 30, 18, 30);
            TextView title = Ui.text(host, host.getString(R.string.gallery_empty_title), 19f,
                    Ui.display(), palette.ink);
            title.setGravity(Gravity.CENTER);
            empty.addView(title);
            TextView body = Ui.text(host, host.getString(R.string.gallery_empty_body), 13.5f,
                    Ui.sans(), palette.inkMuted);
            body.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            bodyParams.topMargin = Ui.dp(host, 4f);
            empty.addView(body, bodyParams);
            gridBox.addView(empty, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
    }

    private void open(Artwork artwork) {
        if (artwork.published) {
            host.openViewer(artwork, profile);
        } else {
            host.openCanvas(profile, artwork);
        }
    }

    private void discard(final Artwork artwork) {
        host.store().delete(artwork);
        Thumbnails.invalidate(artwork.id);
        rebuild();
        host.undoable(host.getString(R.string.discarded), host.getString(R.string.undo_action),
                () -> {
                    host.store().saveNow(artwork);
                    Thumbnails.invalidate(artwork.id);
                    rebuild();
                    host.message(host.getString(R.string.discarded_restored));
                });
    }
}
