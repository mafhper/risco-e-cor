package com.theomaria.draw.view;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.LayerDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.theomaria.draw.AppActivity;
import com.theomaria.draw.R;
import com.theomaria.draw.ui.Palette;
import com.theomaria.draw.ui.PaletteCatalog;
import com.theomaria.draw.ui.Type;
import com.theomaria.draw.ui.Ui;

/**
 * A bandeja de cores do painel expandido: barra de espectro, as 18 familias
 * com rotulo, os 11 degraus da familia aberta, os neutros e o nome falado da
 * cor atual.
 *
 * <p>E o catalogo de 200 amostras do mockup, com uma regra que mantem a
 * ferramenta honesta: o nome sai da propria cor (matiz + tom), nunca do rotulo
 * da semente. A crianca de 3-5 nao ve esta bandeja — ela tem seis circulos.
 */
public final class PaletteTray extends LinearLayout {

    public interface Pick {
        void onPick(int color);
    }

    private final AppActivity host;
    private final Palette palette;
    private final Pick pick;
    private String familyId = PaletteCatalog.FAMILIES[0].id;
    private int color;

    public PaletteTray(AppActivity host, Palette palette, int color, Pick pick) {
        super(host);
        this.host = host;
        this.palette = palette;
        this.pick = pick;
        this.color = color;
        setOrientation(VERTICAL);
        for (PaletteCatalog.Family family : PaletteCatalog.FAMILIES) {
            if (PaletteCatalog.stepOf(family, color) >= 0) {
                familyId = family.id;
            }
        }
        rebuild();
    }

    public void setColor(int color) {
        this.color = color;
        for (PaletteCatalog.Family family : PaletteCatalog.FAMILIES) {
            if (PaletteCatalog.stepOf(family, color) >= 0) {
                familyId = family.id;
            }
        }
        rebuild();
    }

    private void rebuild() {
        removeAllViews();
        addView(spectrumBar());
        addView(familyRail());
        addView(stepGrid());
        addView(neutralRail());
        addView(footer());
    }

    // ----------------------------------------------------------- espectro ---

    private View spectrumBar() {
        View bar = new View(host);
        GradientDrawable gradient = new GradientDrawable(
                GradientDrawable.Orientation.LEFT_RIGHT, PaletteCatalog.SPECTRUM);
        gradient.setCornerRadius(Ui.dpf(host, Ui.RADIUS_PILL));
        GradientDrawable edge = new GradientDrawable();
        edge.setColor(Color.TRANSPARENT);
        edge.setCornerRadius(Ui.dpf(host, Ui.RADIUS_PILL));
        edge.setStroke(Math.max(1, Ui.dp(host, 1f)), palette.border);
        bar.setBackground(new LayerDrawable(new GradientDrawable[]{gradient, edge}));
        bar.setContentDescription(host.getString(R.string.palette_spectrum));
        // Espectro é scrubber, não botão: encolher a faixa inteira no toque leria
        // como um controle que muda de tamanho.
        Ui.staticSurface(bar);
        bar.setOnClickListener(v -> {
            int index = (int) (v.getX() / Math.max(1, v.getWidth())
                    * PaletteCatalog.SPECTRUM.length);
            index = Math.max(0, Math.min(PaletteCatalog.SPECTRUM.length - 1, index));
            familyId = chromaticFamilyAt(index);
            rebuild();
        });
        bar.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                Ui.dp(host, 24f)));
        return bar;
    }

    /** O espectro mostra 15 matizes; a lista tem 18 (as 3 neutras ficam fora). */
    private String chromaticFamilyAt(int index) {
        int seen = 0;
        for (PaletteCatalog.Family family : PaletteCatalog.FAMILIES) {
            if (family.id.equals("ardosia") || family.id.equals("cinza")
                    || family.id.equals("pedra")) {
                continue;
            }
            if (seen == index) {
                return family.id;
            }
            seen++;
        }
        return PaletteCatalog.FAMILIES[0].id;
    }

    // ---------------------------------------------------------- familias ---

    private View familyRail() {
        LinearLayout rail = Ui.row(host);
        HorizontalScrollView scroll = new HorizontalScrollView(host);
        scroll.setHorizontalScrollBarEnabled(false);
        scroll.setClipToPadding(false);
        scroll.addView(rail, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
        Ui.padding(rail, 0, 6, 0, 6);
        for (PaletteCatalog.Family family : PaletteCatalog.FAMILIES) {
            boolean active = family.id.equals(familyId);
            LinearLayout chip = Ui.row(host);
            chip.setGravity(Gravity.CENTER);
            chip.setBackground(Ui.rippleRounded(host, active ? palette.ink : palette.mutedSurface,
                    Ui.RADIUS_PILL, Color.TRANSPARENT,
                    Ui.withAlpha(active ? palette.bg : palette.ink, 0.10f)));
            Ui.padding(chip, 8, 0, 8, 0);
            chip.setClickable(true);
            chip.setFocusable(true);
            Ui.pressable(chip);
            chip.setContentDescription(family.label);
            chip.setOnClickListener(v -> {
                familyId = family.id;
                rebuild();
            });
            View dot = new View(host);
            dot.setBackground(Ui.rounded(family.base(), Ui.dpf(host, Ui.RADIUS_PILL),
                    Ui.withAlpha(palette.ink, 0.12f), Ui.dpf(host, 1f)));
            chip.addView(dot, new LinearLayout.LayoutParams(Ui.dp(host, 12f),
                    Ui.dp(host, 12f)));
            TextView label = Ui.typed(host, family.label, 10f, 12f, 0.02f, Ui.sansBold(),
                    active ? palette.bg : palette.inkMuted);
            LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            labelParams.leftMargin = Ui.dp(host, 6f);
            chip.addView(label, labelParams);
            LinearLayout.LayoutParams chipParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(host, 26f));
            chipParams.rightMargin = Ui.dp(host, 4f);
            rail.addView(chip, chipParams);
        }
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        scroll.setLayoutParams(params);
        return scroll;
    }

    private View stepGrid() {
        PaletteCatalog.Family family = PaletteCatalog.byId(familyId);
        LinearLayout row = Ui.row(host);
        for (int i = 0; i < family.steps.length; i++) {
            int step = family.steps[i];
            boolean selected = step == color;
            View swatch = new View(host);
            swatch.setBackground(Ui.rounded(step, Ui.dpf(host, 4f),
                    selected ? palette.ink : palette.border,
                    Ui.dpf(host, selected ? 2f : 1f)));
            swatch.setContentDescription(family.names[i]);
            swatch.setClickable(true);
            swatch.setFocusable(true);
            Ui.pressable(swatch);
            swatch.setOnClickListener(v -> choose(step));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0,
                    Ui.dp(host, 26f), 1f);
            if (i < family.steps.length - 1) {
                params.rightMargin = Ui.dp(host, 3f);
            }
            row.addView(swatch, params);
        }
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = Ui.dp(host, 2f);
        row.setLayoutParams(params);
        return row;
    }

    private View neutralRail() {
        LinearLayout row = Ui.row(host);
        for (int i = 0; i < PaletteCatalog.NEUTRALS.length; i++) {
            int step = PaletteCatalog.NEUTRALS[i];
            boolean selected = step == color;
            View swatch = new View(host);
            swatch.setBackground(Ui.rounded(step, Ui.dpf(host, 4f),
                    selected ? palette.ink : palette.border,
                    Ui.dpf(host, selected ? 2f : 1f)));
            swatch.setContentDescription(PaletteCatalog.NEUTRAL_NAMES[i]);
            swatch.setClickable(true);
            swatch.setFocusable(true);
            Ui.pressable(swatch);
            swatch.setOnClickListener(v -> choose(step));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(0,
                    Ui.dp(host, 22f), 1f);
            if (i < PaletteCatalog.NEUTRALS.length - 1) {
                params.rightMargin = Ui.dp(host, 4f);
            }
            row.addView(swatch, params);
        }
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = Ui.dp(host, 4f);
        row.setLayoutParams(params);
        return row;
    }

    private View footer() {
        LinearLayout row = Ui.row(host);
        TextView hex = Ui.typed(host, String.format("#%06X", 0xFFFFFF & color), 11f, 20f, 0.02f,
                Ui.monoMedium(), palette.inkOn(color));
        hex.setGravity(Gravity.CENTER);
        hex.setBackground(Ui.rounded(color, Ui.dpf(host, 3f), 0, 0f));
        Ui.padding(hex, 6, 0, 6, 0);
        row.addView(hex, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                Ui.dp(host, 20f)));
        TextView name = Ui.typed(host, PaletteCatalog.nameOf(color), 11f, 20f, 0.02f,
                Ui.sans(), palette.inkMuted);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        nameParams.leftMargin = Ui.dp(host, 8f);
        row.addView(name, nameParams);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.topMargin = Ui.dp(host, 6f);
        row.setLayoutParams(params);
        return row;
    }

    private void choose(int step) {
        color = step;
        rebuild();
        if (pick != null) {
            pick.onPick(step);
        }
    }
}
