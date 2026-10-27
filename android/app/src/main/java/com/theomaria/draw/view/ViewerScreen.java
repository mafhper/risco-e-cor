package com.theomaria.draw.view;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.theomaria.draw.AppActivity;
import com.theomaria.draw.R;
import com.theomaria.draw.model.Artwork;
import com.theomaria.draw.model.ArtworkSession;
import com.theomaria.draw.model.Profile;
import com.theomaria.draw.ui.Glyph;
import com.theomaria.draw.ui.Ui;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Peça publicada, só leitura: o desenho ocupa o papel inteiro. */
public final class ViewerScreen extends Screen {

    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "viewer");
        thread.setDaemon(true);
        return thread;
    });
    private static final Handler MAIN = new Handler(Looper.getMainLooper());

    private final ImageView image;

    public ViewerScreen(AppActivity host, Artwork artwork, Profile profile) {
        super(host);
        Context context = host;
        setBackgroundColor(palette.desk);

        image = new ImageView(context);
        image.setScaleType(ImageView.ScaleType.FIT_CENTER);
        image.setBackgroundColor(palette.paper);
        addView(image, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        LinearLayout top = Ui.row(context);
        Ui.padding(top, 10, 10, 16, 0);
        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        topParams.gravity = Gravity.TOP;
        addView(top, topParams);
        Ui.IconButton back = new Ui.IconButton(context, Glyph.Kind.BACK,
                Ui.withAlpha(palette.card, 0.94f), palette.border, palette.ink, 44f);
        back.setContentDescription(context.getString(R.string.back));
        back.setOnClickListener(v -> host.pop());
        top.addView(back);
        TextView author = Ui.text(context, profile == null ? "" : profile.name, 15f,
                Ui.display(), palette.ink);
        author.setBackground(Ui.rounded(Ui.withAlpha(palette.card, 0.92f),
                Ui.dpf(context, 999f), palette.border, Ui.dpf(context, 1f)));
        Ui.padding(author, 12, 6, 12, 6);
        LinearLayout.LayoutParams authorParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        authorParams.leftMargin = Ui.dp(context, 8f);
        top.addView(author, authorParams);

        load(artwork);
    }

    private void load(final Artwork artwork) {
        final ImageView target = image;
        target.setBackgroundColor(palette.paper);
        EXEC.execute(() -> {
            Bitmap bitmap = null;
            try {
                ArtworkSession session = new ArtworkSession(host, artwork, host.store());
                bitmap = session.thumbnail(Math.min(1024,
                        host.getResources().getDisplayMetrics().widthPixels));
                session.bitmap().recycle();
            } catch (Exception e) {
                android.util.Log.w("MeuDesenho", "viewer falhou: " + e.getMessage());
            }
            final Bitmap result = bitmap;
            MAIN.post(() -> {
                if (result != null) {
                    target.setImageBitmap(result);
                }
            });
        });
    }
}
