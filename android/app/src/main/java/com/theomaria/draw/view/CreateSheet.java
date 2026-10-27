package com.theomaria.draw.view;

import android.content.Context;
import android.graphics.Color;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.theomaria.draw.AppActivity;
import com.theomaria.draw.R;
import com.theomaria.draw.model.Inks;
import com.theomaria.draw.model.Profile;
import com.theomaria.draw.ui.Glyph;
import com.theomaria.draw.ui.Motion;
import com.theomaria.draw.ui.Palette;
import com.theomaria.draw.ui.Ui;

/**
 * Folha de criação: o mesmo estúdio, com ou sem contorno por baixo. Duas portas,
 * nenhuma escondida — a atividade favorita só decide a ordem.
 */
public final class CreateSheet extends FrameLayout {

    private final Palette palette;

    public interface Choice {
        void onBlank();

        void onPage();
    }

    public CreateSheet(AppActivity host, Palette palette, Profile profile, Choice choice) {
        super(host);
        this.palette = palette;
        Context context = host;
        setBackgroundColor(Ui.withAlpha(0xFF1C1B1A, 0.28f));
        setClickable(true);
        Ui.staticSurface(this);
        setOnClickListener(v -> close());

        LinearLayout sheet = Ui.column(context);
        sheet.setBackground(Ui.rounded(palette.card, Ui.dpf(context, 28f), Color.TRANSPARENT, 0));
        Ui.padding(sheet, 18, 10, 18, 24);
        setOnClickListener(v -> close());

        View handle = new View(context);
        handle.setBackground(Ui.rounded(palette.border, Ui.dpf(context, 999f), 0, 0));
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(
                Ui.dp(context, 34f), Ui.dp(context, 4f));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        handleParams.bottomMargin = Ui.dp(context, 12f);
        sheet.addView(handle, handleParams);

        TextView title = Ui.text(context, context.getString(R.string.create_title), 22f,
                Ui.display(), palette.ink);
        sheet.addView(title);
        TextView body = Ui.text(context, context.getString(R.string.create_body), 14f,
                Ui.sans(), palette.inkMuted);
        LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bodyParams.topMargin = Ui.dp(context, 2f);
        sheet.addView(body, bodyParams);

        LinearLayout options = Ui.column(context);
        LinearLayout.LayoutParams optionsParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        optionsParams.topMargin = Ui.dp(context, 12f);
        sheet.addView(options, optionsParams);

        View blank = option(context, R.string.blank_sheet, null, Glyph.Kind.IMAGES,
                () -> {
                    close();
                    choice.onBlank();
                });
        View pages = option(context, R.string.color_page,
                context.getResources().getQuantityString(R.plurals.color_page_hint, 1, 1),
                Glyph.Kind.BOOK,
                () -> {
                    close();
                    choice.onPage();
                });
        options.addView(blank);
        LinearLayout.LayoutParams gap = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        gap.topMargin = Ui.dp(context, 10f);
        options.addView(pages, gap);

        LayoutParams sheetParams = new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        sheetParams.gravity = Gravity.BOTTOM;
        addView(sheet, sheetParams);
        sheet.setOnClickListener(v -> {
            // Consome o toque dentro da folha.
        });
        // O corpo da folha não é alvo: consome o tap, não reage a ele.
        Ui.staticSurface(sheet);
    }

    private View option(Context context, int labelRes, String hint, Glyph.Kind kind,
                        Runnable action) {
        LinearLayout row = Ui.row(context);
        row.setBackground(Ui.rippleRounded(context, palette.raised, 14f, palette.border,
                Ui.withAlpha(palette.ink, 0.06f)));
        Ui.padding(row, 14, 12, 14, 12);
        row.setClickable(true);
        row.setFocusable(true);
        Ui.pressable(row);
        row.setOnClickListener(v -> action.run());
        row.setContentDescription(context.getString(labelRes));
        row.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        FrameLayout art = new FrameLayout(context);
        art.setBackground(Ui.rounded(palette.paper, Ui.dpf(context, 8f), palette.border,
                Ui.dpf(context, 1f)));
        Glyph.View24 icon = new Glyph.View24(context, kind, Inks.INK, 20f);
        LayoutParams iconParams = new LayoutParams(Ui.dp(context, 20f), Ui.dp(context, 20f));
        iconParams.gravity = Gravity.CENTER;
        art.addView(icon, iconParams);
        row.addView(art, new LinearLayout.LayoutParams(Ui.dp(context, 34f), Ui.dp(context, 34f)));

        LinearLayout labels = Ui.column(context);
        TextView title = Ui.text(context, context.getString(labelRes), 16f, Ui.sansBold(),
                palette.ink);
        labels.addView(title);
        if (hint != null) {
            TextView sub = Ui.text(context, hint, 12.5f, Ui.sans(), palette.inkMuted);
            labels.addView(sub);
        }
        LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        labelParams.leftMargin = Ui.dp(context, 12f);
        row.addView(labels, labelParams);

        Glyph.View24 arrow = new Glyph.View24(context, Glyph.Kind.BACK, palette.inkMuted, 16f);
        arrow.setRotation(180f);
        row.addView(arrow, new LinearLayout.LayoutParams(Ui.dp(context, 16f), Ui.dp(context, 16f)));
        return row;
    }

    public void close() {
        // Saida sutil: 12 dp + fade em 150 ms; a view sai quando a animacao acaba.
        Motion.exitSheet(this, getChildCount() > 0 ? getChildAt(0) : null, this::detach);
    }

    private void detach() {
        if (getParent() instanceof ViewGroup) {
            ((ViewGroup) getParent()).removeView(this);
        }
    }

    public static void show(ViewGroup container, CreateSheet sheet) {
        container.addView(sheet, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        Motion.enterSheet(sheet, sheet.getChildAt(0));
    }
}
