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
import com.theomaria.draw.ui.Glyph;
import com.theomaria.draw.ui.Motion;
import com.theomaria.draw.ui.Palette;
import com.theomaria.draw.ui.Ui;

/**
 * As três saídas depois do desenho: publicar no mural, guardar rascunho ou
 * continuar. Kids (3–5) veem os mesmos três caminhos como ícones de 56 dp, sem
 * texto funcional.
 */
public final class SaveSheet extends FrameLayout {

    private final Palette palette;

    public interface Choice {
        void publish();

        void draft();

        void keepDrawing();
    }

    public SaveSheet(AppActivity host, Palette palette, boolean kids, Choice choice) {
        super(host);
        this.palette = palette;
        Context context = host;
        setBackgroundColor(Ui.withAlpha(0xFF1C1B1A, 0.30f));
        setClickable(true);
        Ui.staticSurface(this);
        setOnClickListener(v -> choice.keepDrawing());

        LinearLayout sheet = Ui.column(context);
        sheet.setBackground(Ui.rounded(palette.card, Ui.dpf(context, 28f), Color.TRANSPARENT, 0));
        Ui.padding(sheet, kids ? 16 : 18, 10, kids ? 16 : 18, 22);

        View handle = new View(context);
        handle.setBackground(Ui.rounded(palette.border, Ui.dpf(context, 999f), 0, 0));
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(
                Ui.dp(context, 34f), Ui.dp(context, 4f));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        handleParams.bottomMargin = Ui.dp(context, 12f);
        sheet.addView(handle, handleParams);

        if (kids) {
            LinearLayout row = Ui.row(context);
            row.setGravity(Gravity.CENTER);
            row.addView(option(context, Glyph.Kind.STAR, palette.amber, palette.onAmber,
                    R.string.publish, choice::publish, 84f));
            row.addView(option(context, Glyph.Kind.CHECK, palette.primary, palette.onPrimary,
                    R.string.keep_draft, choice::draft, 84f));
            row.addView(option(context, Glyph.Kind.PENCIL, palette.mutedSurface, palette.ink,
                    R.string.keep_drawing, choice::keepDrawing, 84f));
            sheet.addView(row, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        } else {
            TextView title = Ui.text(context, context.getString(R.string.save_title), 22f,
                    Ui.display(), palette.ink);
            sheet.addView(title);
            TextView body = Ui.text(context, context.getString(R.string.save_body), 13.5f,
                    Ui.sans(), palette.inkMuted);
            LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            bodyParams.topMargin = Ui.dp(context, 3f);
            sheet.addView(body, bodyParams);

            View publish = textOption(context, R.string.publish, R.string.publish_hint,
                    palette.amber, palette.onAmber, true, choice::publish);
            LinearLayout.LayoutParams p1 = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            p1.topMargin = Ui.dp(context, 14f);
            sheet.addView(publish, p1);

            View draft = textOption(context, R.string.keep_draft, R.string.draft_hint,
                    palette.raised, palette.ink, false, choice::draft);
            LinearLayout.LayoutParams p2 = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            p2.topMargin = Ui.dp(context, 8f);
            sheet.addView(draft, p2);

            View keep = textOption(context, R.string.keep_drawing, R.string.continue_hint,
                    Color.TRANSPARENT, palette.inkMuted, false, choice::keepDrawing);
            LinearLayout.LayoutParams p3 = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            p3.topMargin = Ui.dp(context, 4f);
            sheet.addView(keep, p3);
        }

        LayoutParams params = new LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        params.gravity = Gravity.BOTTOM;
        addView(sheet, params);
        sheet.setOnClickListener(v -> {
            // Consome o toque dentro da folha.
        });
        // O corpo da folha não é alvo: consome o tap, não reage a ele.
        Ui.staticSurface(sheet);
    }

    private View option(Context context, Glyph.Kind kind, int fill, int tint, int labelRes,
                        Runnable action, float sizeDp) {
        FrameLayout button = new FrameLayout(context);
        button.setBackground(Ui.rippleRounded(context, fill, sizeDp / 2f, Color.TRANSPARENT,
                Ui.withAlpha(tint, 0.16f)));
        Glyph.View24 icon = new Glyph.View24(context, kind, tint, sizeDp * 0.42f);
        FrameLayout.LayoutParams iconParams = new FrameLayout.LayoutParams(
                Ui.dp(context, sizeDp * 0.44f), Ui.dp(context, sizeDp * 0.44f));
        iconParams.gravity = Gravity.CENTER;
        button.addView(icon, iconParams);
        button.setContentDescription(context.getString(labelRes));
        button.setClickable(true);
        button.setFocusable(true);
        Ui.pressable(button);
        button.setOnClickListener(v -> action.run());
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                Ui.dp(context, sizeDp), Ui.dp(context, sizeDp));
        params.leftMargin = Ui.dp(context, 7f);
        params.rightMargin = Ui.dp(context, 7f);
        button.setLayoutParams(params);
        return button;
    }

    private View textOption(Context context, int labelRes, int hintRes, int fill, int textColor,
                            boolean primary, Runnable action) {
        LinearLayout row = Ui.row(context);
        row.setBackground(Ui.rippleRounded(context, fill, 14f,
                primary ? Color.TRANSPARENT : palette.border, Ui.withAlpha(textColor, 0.14f)));
        Ui.padding(row, 16, 12, 16, 12);
        row.setClickable(true);
        row.setFocusable(true);
        Ui.pressable(row);
        row.setContentDescription(context.getString(labelRes));
        row.setOnClickListener(v -> action.run());
        LinearLayout labels = Ui.column(context);
        TextView title = Ui.text(context, context.getString(labelRes), 15.5f,
                Ui.sansBold(), textColor);
        labels.addView(title);
        TextView hint = Ui.text(context, context.getString(hintRes), 12f, Ui.sans(),
                primary ? Ui.withAlpha(textColor, 0.78f) : palette.inkMuted);
        labels.addView(hint);
        row.addView(labels, new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        Glyph.View24 arrow = new Glyph.View24(context, Glyph.Kind.BACK, textColor, 16f);
        arrow.setRotation(180f);
        row.addView(arrow, new LinearLayout.LayoutParams(Ui.dp(context, 16f), Ui.dp(context, 16f)));
        return row;
    }

    public void close() {
        Motion.exitSheet(this, getChildCount() > 0 ? getChildAt(0) : null, this::detach);
    }

    private void detach() {
        if (getParent() instanceof ViewGroup) {
            ((ViewGroup) getParent()).removeView(this);
        }
    }
}
