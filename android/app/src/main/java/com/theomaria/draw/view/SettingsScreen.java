package com.theomaria.draw.view;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.theomaria.draw.AppActivity;
import com.theomaria.draw.Prefs;
import com.theomaria.draw.R;
import com.theomaria.draw.ui.Glyph;
import com.theomaria.draw.ui.Ui;

/**
 * Configurações globais — a única seção que o adulto alcança pela Home.
 * No MVP-0 só o tema tem efeito; o resto informa o estado real do app.
 */
public final class SettingsScreen extends Screen {

    public SettingsScreen(AppActivity host) {
        super(host);
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
        TextView title = Ui.text(context, context.getString(R.string.settings), 21f,
                Ui.display(), palette.ink);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleParams.leftMargin = Ui.dp(context, 8f);
        bar.addView(title, titleParams);
        root.addView(bar);

        ScrollView scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        LinearLayout column = Ui.column(context);
        Ui.padding(column, 20, 8, 20, 28);
        scroll.addView(column, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        column.addView(Ui.label(context, context.getString(R.string.theme), palette.inkMuted));
        LinearLayout themeCard = Ui.column(context);
        themeCard.setBackground(Ui.rounded(palette.card, Ui.dpf(context, 14f), palette.border,
                Ui.dpf(context, 1f)));
        LinearLayout.LayoutParams themeParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        themeParams.topMargin = Ui.dp(context, 8f);
        column.addView(themeCard, themeParams);
        int scheme = host.prefs().scheme();
        themeCard.addView(themeOption(R.string.theme_light, Prefs.LIGHT, scheme));
        themeCard.addView(themeOption(R.string.theme_dark, Prefs.DARK, scheme));
        themeCard.addView(themeOption(R.string.theme_system, Prefs.SYSTEM, scheme));

        column.addView(sectionLabel(R.string.profiles, 22));
        TextView profilesCount = Ui.text(context,
                context.getString(R.string.profiles_count, host.profiles().size(),
                        com.theomaria.draw.model.Profiles.MAX_PROFILES),
                15f, Ui.sans(), palette.ink);
        profilesCount.setBackground(Ui.rounded(palette.card, Ui.dpf(context, 14f),
                palette.border, Ui.dpf(context, 1f)));
        Ui.padding(profilesCount, 16, 14, 16, 14);
        LinearLayout.LayoutParams pcParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        pcParams.topMargin = Ui.dp(context, 8f);
        column.addView(profilesCount, pcParams);
        TextView capacityHint = Ui.text(context,
                context.getString(R.string.profiles_capacity_hint), 12.5f, Ui.sans(),
                palette.inkMuted);
        LinearLayout.LayoutParams chParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        chParams.topMargin = Ui.dp(context, 6f);
        column.addView(capacityHint, chParams);

        column.addView(sectionLabel(R.string.about, 22));
        LinearLayout about = Ui.column(context);
        about.setBackground(Ui.rounded(palette.card, Ui.dpf(context, 14f), palette.border,
                Ui.dpf(context, 1f)));
        Ui.padding(about, 16, 14, 16, 14);
        TextView name = Ui.text(context, context.getString(R.string.app_name), 18f,
                Ui.display(), palette.ink);
        about.addView(name);
        TextView version = Ui.text(context, context.getString(R.string.version_label, versionName()),
                12f, Ui.mono(), palette.inkMuted);
        LinearLayout.LayoutParams vParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        vParams.topMargin = Ui.dp(context, 4f);
        about.addView(version, vParams);
        TextView offline = Ui.text(context, context.getString(R.string.offline_note), 13f,
                Ui.sans(), palette.inkMuted);
        LinearLayout.LayoutParams oParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        oParams.topMargin = Ui.dp(context, 10f);
        about.addView(offline, oParams);
        LinearLayout.LayoutParams aboutParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        aboutParams.topMargin = Ui.dp(context, 8f);
        column.addView(about, aboutParams);

        addView(root);
    }

    private View sectionLabel(int textRes, float topDp) {
        TextView label = Ui.label(host, host.getString(textRes), palette.inkMuted);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = Ui.dp(host, topDp);
        label.setLayoutParams(params);
        return label;
    }

    private View themeOption(int labelRes, final int value, int current) {
        LinearLayout row = Ui.row(host);
        Ui.padding(row, 16, 14, 16, 14);
        row.setClickable(true);
        row.setFocusable(true);
        Ui.pressable(row);
        row.setContentDescription(host.getString(labelRes));
        row.setBackground(Ui.rippleRounded(host, Color.TRANSPARENT, 0, Color.TRANSPARENT,
                Ui.withAlpha(palette.ink, 0.05f)));
        TextView label = Ui.text(host, host.getString(labelRes), 15f, Ui.sans(), palette.ink);
        row.addView(label, new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        if (value == current) {
            Glyph.View24 check = new Glyph.View24(host, Glyph.Kind.CHECK, palette.primary, 18f);
            row.addView(check, new LinearLayout.LayoutParams(Ui.dp(host, 18f), Ui.dp(host, 18f)));
        }
        row.setOnClickListener(v -> {
            if (host.prefs().scheme() != value) {
                host.setScheme(value);
            }
        });
        return row;
    }

    private String versionName() {
        try {
            PackageInfo info = host.getPackageManager().getPackageInfo(host.getPackageName(), 0);
            return info.versionName == null ? "0.1.0" : info.versionName;
        } catch (Exception e) {
            return "0.1.0";
        }
    }
}
