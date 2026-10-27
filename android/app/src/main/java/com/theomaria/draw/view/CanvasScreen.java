package com.theomaria.draw.view;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import com.theomaria.draw.AppActivity;
import com.theomaria.draw.R;
import com.theomaria.draw.model.Artwork;
import com.theomaria.draw.model.ArtworkSession;
import com.theomaria.draw.model.Command;
import com.theomaria.draw.model.Profile;
import com.theomaria.draw.ui.Glyph;
import com.theomaria.draw.ui.Motion;
import com.theomaria.draw.ui.Palette;
import com.theomaria.draw.ui.PaletteCatalog;
import com.theomaria.draw.ui.Type;
import com.theomaria.draw.ui.Ui;

/**
 * O estudio. O papel ocupa a tela inteira sobre a mesa; o topo e o dock sao
 * sobreposicoes, nao layout.
 *
 * <p>O dock tem TRES estados, e um toque no papel recolhe todos ao pilula:
 * MINI (tres alvos: material, cor, expandir), COMPACTO (duas fileiras: o ajuste
 * da ferramenta e a troca rapida) e EXPANDIDO (folha encostada na borda, com a
 * bandeja de cores completa). O HUD de zoom fica no canto oposto ao de guardar
 * e sempre ACIMA do dock, com folga medida — nada se sobrepoe.
 */
public final class CanvasScreen extends Screen {

    private static final int DOCK_MINI = 0;
    private static final int DOCK_COMPACT = 1;
    private static final int DOCK_EXPANDED = 2;

    private static final int[] PENCIL_WIDTHS = {4, 8, 14};
    private static final int[] CRAYON_WIDTHS = {14, 22, 34};

    /** Ferramenta que a pilula mostrou por ultimo: a troca de desenho vira cross-fade. */
    private int lastMiniTool = -1;
    /** Evita reabrir o cross-fade do readout enquanto o anterior nao termina. */
    private boolean faceSwapping;

    private final Profile profile;
    private final Artwork artwork;
    private final boolean kids;
    private final ArtworkSession session;
    private final DrawCanvas canvas;

    private final FrameLayout dockHost;
    private final Ui.IconButton undo;
    private final Ui.IconButton redo;
    private final LinearLayout hud;
    private final TextView zoomReadout;
    private final LinearLayout savePill;
    private final TextView pagePill;

    private int dock;
    private int tool = Command.TOOL_PENCIL;
    private int color = PaletteCatalog.FAMILIES[10].base();
    private int sizeIndex = 1;
    private SaveSheet saveSheet;

    public CanvasScreen(AppActivity host, Profile profile, Artwork artwork) {
        super(host);
        this.profile = profile;
        this.artwork = artwork;
        this.kids = profile.kids();
        this.session = new ArtworkSession(host, artwork, host.store());
        this.tool = artwork.isPage() ? DrawCanvas.TOOL_FILL
                : (kids ? Command.TOOL_CRAYON : Command.TOOL_PENCIL);
        this.color = kids ? PaletteCatalog.KIDS[0] : PaletteCatalog.FAMILIES[10].base();
        // Pro abre no descanso (a pilula); 3-5 abre no painel, porque alvo grande
        // e o unico caminho de leitura.
        this.dock = kids ? DOCK_EXPANDED : DOCK_MINI;
        Context context = host;
        setBackgroundColor(palette.desk);

        canvas = new DrawCanvas(context, palette);
        canvas.setSession(session);
        canvas.setColor(color);
        canvas.setTool(tool);
        canvas.setWidthPx(widthFor(tool, sizeIndex));
        canvas.setListener(new DrawCanvas.Listener() {
            @Override
            public void onChanged() {
                updateHistoryButtons();
            }

            @Override
            public void onFill(ArtworkSession.FillReport report) {
                if (!report.painted()) {
                    android.util.Log.i(AppActivity.TAG, "toque sem pintura: " + report.decision);
                }
            }

            @Override
            public void onViewChanged() {
                updateZoom();
            }

            @Override
            public void onPaperTouch() {
                if (dock != DOCK_MINI) {
                    dock = DOCK_MINI;
                    rebuildDock();
                }
            }
        });
        addView(canvas, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        // --- topo: voltar, o que esta aberto, historico ---
        LinearLayout top = Ui.row(context);
        Ui.padding(top, 12, 12, 12, 0);
        FrameLayout.LayoutParams topParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        topParams.gravity = Gravity.TOP;
        addView(top, topParams);

        float topTarget = kids ? 56f : 48f;
        Ui.IconButton back = new Ui.IconButton(context, Glyph.Kind.BACK,
                Ui.withAlpha(palette.card, 0.92f), Color.TRANSPARENT, palette.ink, topTarget);
        back.setContentDescription(context.getString(R.string.back));
        back.setOnClickListener(v -> requestLeave());
        top.addView(back);

        LinearLayout pill = Ui.row(context);
        pill.setBackground(Ui.rounded(Ui.withAlpha(palette.card, 0.92f),
                Ui.dpf(context, Ui.RADIUS_PILL), 0, 0f));
        Ui.padding(pill, 16, 0, 16, 0);
        LinearLayout.LayoutParams pillParams = new LinearLayout.LayoutParams(0,
                Ui.dp(context, topTarget), 1f);
        pillParams.leftMargin = Ui.dp(context, 6f);
        pillParams.rightMargin = Ui.dp(context, 6f);
        top.addView(pill, pillParams);
        pagePill = Ui.typed(context, "", Type.LABEL_LG, Type.LABEL_LG_LH, 0f, Ui.sans(),
                palette.ink);
        pagePill.setMaxLines(1);
        pagePill.setEllipsize(android.text.TextUtils.TruncateAt.END);
        pagePill.setGravity(Gravity.CENTER_VERTICAL);
        pill.addView(pagePill, new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        undo = new Ui.IconButton(context, Glyph.Kind.UNDO, Ui.withAlpha(palette.card, 0.92f),
                Color.TRANSPARENT, palette.ink, topTarget);
        undo.setContentDescription(context.getString(R.string.undo));
        undo.setOnClickListener(v -> {
            session.undo();
            canvas.invalidate();
            updateHistoryButtons();
        });
        top.addView(undo);
        redo = new Ui.IconButton(context, Glyph.Kind.REDO, Ui.withAlpha(palette.card, 0.92f),
                Color.TRANSPARENT, palette.ink, topTarget);
        redo.setContentDescription(context.getString(R.string.redo));
        redo.setOnClickListener(v -> {
            session.redo();
            canvas.invalidate();
            updateHistoryButtons();
        });
        LinearLayout.LayoutParams redoParams = new LinearLayout.LayoutParams(
                Ui.dp(context, topTarget), Ui.dp(context, topTarget));
        redoParams.leftMargin = Ui.dp(context, 6f);
        top.addView(redo, redoParams);

        // --- HUD de zoom: canto inferior esquerdo, acima do dock ---
        hud = Ui.row(context);
        hud.setBackground(Ui.rounded(Ui.withAlpha(palette.card, 0.92f),
                Ui.dpf(context, Ui.RADIUS_PILL), 0, 0f));
        Ui.padding(hud, 4, 4, 4, 4);
        hud.setContentDescription(context.getString(R.string.zoom_readout));
        FrameLayout.LayoutParams hudParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, Ui.dp(context, 56f));
        hudParams.gravity = Gravity.BOTTOM | Gravity.START;
        hudParams.leftMargin = Ui.dp(context, 12f);
        hudParams.bottomMargin = Ui.dp(context, hudBottom());
        addView(hud, hudParams);

        View zoomOut = iconTarget(Glyph.Kind.MINUS, 40f);
        zoomOut.setContentDescription(context.getString(R.string.zoom_out));
        zoomOut.setOnClickListener(v -> {
            canvas.zoomBy(1f / 1.4f);
            updateZoom();
        });
        zoomOut.setTag("zoom-out");
        hud.addView(zoomOut, new LinearLayout.LayoutParams(Ui.dp(context, 40f),
                Ui.dp(context, 40f)));
        zoomReadout = Ui.typed(context, "100%", Type.LABEL_SM, 14f, 0f, Ui.mono(),
                palette.inkMuted);
        zoomReadout.setGravity(Gravity.CENTER);
        zoomReadout.setContentDescription(context.getString(R.string.zoom_fit));
        zoomReadout.setClickable(true);
        zoomReadout.setFocusable(true);
        Ui.staticSurface(zoomReadout);
        zoomReadout.setOnClickListener(v -> {
            canvas.resetView();
            updateZoom();
        });
        hud.addView(zoomReadout, new LinearLayout.LayoutParams(Ui.dp(context, 40f),
                Ui.dp(context, 40f)));
        View zoomIn = iconTarget(Glyph.Kind.PLUS, 40f);
        zoomIn.setContentDescription(context.getString(R.string.zoom_in));
        zoomIn.setOnClickListener(v -> {
            canvas.zoomBy(1.4f);
            updateZoom();
        });
        hud.addView(zoomIn, new LinearLayout.LayoutParams(Ui.dp(context, 40f),
                Ui.dp(context, 40f)));

        // --- guardar: canto oposto ao do zoom, na mesma linha ---
        savePill = Ui.row(context);
        savePill.setGravity(Gravity.CENTER);
        savePill.setBackground(Ui.rippleRounded(context, Ui.withAlpha(palette.card, 0.92f),
                Ui.RADIUS_PILL, 0, Ui.withAlpha(palette.ink, 0.10f)));
        Ui.padding(savePill, kids ? 0 : 16, 0, kids ? 0 : 16, 0);
        savePill.setClickable(true);
        savePill.setFocusable(true);
        Ui.pressable(savePill);
        savePill.setContentDescription(context.getString(R.string.save_action));
        savePill.setOnClickListener(v -> requestLeave());
        if (kids) {
            savePill.addView(new Glyph.View24(context, Glyph.Kind.CHECK, palette.ink, 26f),
                    new LinearLayout.LayoutParams(Ui.dp(context, 26f), Ui.dp(context, 26f)));
        } else {
            savePill.addView(new Glyph.View24(context, Glyph.Kind.CHECK, palette.primary, 16f),
                    new LinearLayout.LayoutParams(Ui.dp(context, 16f), Ui.dp(context, 16f)));
            TextView label = Ui.typed(context, context.getString(R.string.save), 14f, 20f, 0f,
                    Ui.display(), palette.ink);
            LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            labelParams.leftMargin = Ui.dp(context, 6f);
            savePill.addView(label, labelParams);
        }
        FrameLayout.LayoutParams saveParams = new FrameLayout.LayoutParams(
                kids ? Ui.dp(context, 56f) : ViewGroup.LayoutParams.WRAP_CONTENT,
                Ui.dp(context, 48f));
        saveParams.gravity = Gravity.BOTTOM | Gravity.END;
        saveParams.rightMargin = Ui.dp(context, 12f);
        saveParams.bottomMargin = Ui.dp(context, hudBottom());
        addView(savePill, saveParams);

        // --- dock ---
        dockHost = new FrameLayout(context);
        FrameLayout.LayoutParams dockParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dockParams.gravity = Gravity.BOTTOM;
        addView(dockHost, dockParams);

        rebuildDock();
        updateHistoryButtons();
        updateZoom();
        updateChrome();
    }

    private float hudBottom() {
        return Ui.DOCK_GAP + Ui.DOCK_PILL_H + Ui.DOCK_HUD_GAP;
    }

    public ArtworkSession session() {
        return session;
    }

    private View iconTarget(Glyph.Kind kind, float sizeDp) {
        FrameLayout button = new FrameLayout(host);
        button.setBackground(Ui.rippleRounded(host, Color.TRANSPARENT, sizeDp / 2f, 0,
                Ui.withAlpha(palette.ink, 0.08f)));
        button.setClickable(true);
        button.setFocusable(true);
        // O HUD de zoom fica estatico: escala de press aqui distrai do desenho.
        Ui.staticSurface(button);
        Glyph.View24 glyph = new Glyph.View24(host, kind, palette.ink, sizeDp * 0.40f);
        FrameLayout.LayoutParams glyphParams = new FrameLayout.LayoutParams(
                Ui.dp(host, sizeDp * 0.40f), Ui.dp(host, sizeDp * 0.40f));
        glyphParams.gravity = Gravity.CENTER;
        button.addView(glyph, glyphParams);
        button.setLayoutParams(new LinearLayout.LayoutParams(Ui.dp(host, sizeDp),
                Ui.dp(host, sizeDp)));
        return button;
    }

    private void updateZoom() {
        if (zoomReadout == null) {
            return;
        }
        zoomReadout.setText(Math.round(canvas.scale() * 100f) + "%");
        zoomReadout.setTextColor(canvas.zoomed() ? palette.ink : palette.inkMuted);
        View zoomOut = hud.findViewWithTag("zoom-out");
        if (zoomOut != null) {
            zoomOut.setAlpha(canvas.zoomed() ? 1f : 0.35f);
            zoomOut.setEnabled(canvas.zoomed());
        }
        updateChrome();
    }

    /** A pilula do topo conta o estado: nome da folha, ou quanto o papel foi ampliado. */
    private void updateChrome() {
        if (pagePill == null) {
            return;
        }
        boolean zoomed = canvas != null && canvas.zoomed();
        String text = zoomed ? Math.round(canvas.scale() * 100f) + "%"
                : host.getString(artwork.isPage() ? R.string.color_page : R.string.free_drawing);
        Typeface face = zoomed ? Ui.mono() : Ui.sans();
        if (face == pagePill.getTypeface()) {
            // So o numero muda: transicao nenhuma, o readout acompanha o gesto.
            pagePill.setText(text);
            return;
        }
        if (faceSwapping) {
            return;
        }
        // Troca de familia (sans <-> mono): cross-fade de 300 ms, nunca um pulo.
        faceSwapping = true;
        Motion.swapText(pagePill, text, face);
        pagePill.postDelayed(() -> faceSwapping = false, Motion.CROSSFADE_MS);
    }

    // ------------------------------------------------------------ dock ---

    private void rebuildDock() {
        dockHost.removeAllViews();
        View dockView;
        if (dock == DOCK_MINI) {
            dockView = miniDock();
        } else if (dock == DOCK_COMPACT) {
            dockView = compactDock();
        } else {
            dockView = expandedDock();
        }
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.gravity = Gravity.BOTTOM;
        // O compacto flutua com 12 dp de cada lado; a folha expandida encosta
        // nas bordas (uma folha de verdade, nunca um card com margem).
        int side = dock == DOCK_COMPACT ? Ui.dp(host, 12f) : 0;
        int bottom = dock == DOCK_EXPANDED ? 0 : Ui.dp(host, Ui.DOCK_GAP);
        params.setMargins(side, 0, side, bottom);
        dockHost.addView(dockView, params);
        boolean resting = dock == DOCK_MINI;
        hud.setVisibility(resting ? View.VISIBLE : View.GONE);
        savePill.setVisibility(resting ? View.VISIBLE : View.GONE);
        // Só a pilula lembra a ferramenta: é nela que o desenho troca de verdade.
        if (resting) {
            lastMiniTool = tool;
        }
    }

    /** A pilula: tres portas, nao uma copia encolhida do painel. */
    private View miniDock() {
        LinearLayout wrap = Ui.row(host);
        wrap.setGravity(Gravity.CENTER);
        LinearLayout pill = Ui.row(host);
        pill.setGravity(Gravity.CENTER);
        pill.setBackground(Ui.rounded(Ui.withAlpha(palette.card, 0.92f),
                Ui.dpf(host, Ui.RADIUS_PILL), palette.border, Ui.dpf(host, 1f)));
        pill.setContentDescription(host.getString(R.string.toolbar));
        Ui.padding(pill, 4, 0, 4, 0);
        float target = kids ? 56f : 44f;
        pill.addView(miniTargets(target));
        wrap.addView(pill, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                Ui.dp(host, kids ? 64f : Ui.DOCK_PILL_H)));
        return wrap;
    }

    private View miniTargets(float target) {
        LinearLayout row = Ui.row(host);
        row.setGravity(Gravity.CENTER);

        FrameLayout toolButton = new FrameLayout(host);
        toolButton.setBackground(Ui.rippleRounded(host, Color.TRANSPARENT, target / 2f, 0,
                Ui.withAlpha(palette.ink, 0.08f)));
        toolButton.setClickable(true);
        toolButton.setFocusable(true);
        Ui.pressable(toolButton);
        toolButton.setContentDescription(host.getString(R.string.switch_tool));
        toolButton.setOnClickListener(v -> {
            dock = DOCK_COMPACT;
            rebuildDock();
        });
        int toolColor = tool == DrawCanvas.TOOL_ERASER ? palette.inkMuted : palette.ink;
        // O desenho da ferramenta muda no lugar: entra por cross-fade quando havia
        // uma ferramenta anterior (na primeira montagem a pilula ja nasce assentada).
        Glyph.Swap glyph = new Glyph.Swap(host,
                toolGlyph(lastMiniTool < 0 ? tool : lastMiniTool), toolColor, 22f);
        if (lastMiniTool >= 0 && lastMiniTool != tool) {
            glyph.show(toolGlyph(tool), toolColor);
        }
        FrameLayout.LayoutParams glyphParams = new FrameLayout.LayoutParams(Ui.dp(host, 22f),
                Ui.dp(host, 22f));
        glyphParams.gravity = Gravity.CENTER;
        toolButton.addView(glyph, glyphParams);
        row.addView(toolButton, new LinearLayout.LayoutParams(Ui.dp(host, target),
                Ui.dp(host, target)));

        FrameLayout colorButton = new FrameLayout(host);
        colorButton.setBackground(Ui.rippleRounded(host, Color.TRANSPARENT, target / 2f, 0,
                Ui.withAlpha(palette.ink, 0.08f)));
        colorButton.setClickable(true);
        colorButton.setFocusable(true);
        Ui.pressable(colorButton);
        colorButton.setContentDescription(host.getString(R.string.change_color));
        colorButton.setOnClickListener(v -> {
            dock = DOCK_COMPACT;
            rebuildDock();
        });
        FrameLayout swatchRing = new FrameLayout(host);
        swatchRing.setBackground(Ui.rounded(palette.card, Ui.dpf(host, Ui.RADIUS_PILL),
                palette.border, Ui.dpf(host, 1f)));
        View dot = new View(host);
        dot.setBackground(Ui.rounded(color, Ui.dpf(host, Ui.RADIUS_PILL), 0, 0f));
        FrameLayout.LayoutParams dotParams = new FrameLayout.LayoutParams(Ui.dp(host, 24f),
                Ui.dp(host, 24f));
        dotParams.gravity = Gravity.CENTER;
        swatchRing.addView(dot, dotParams);
        FrameLayout.LayoutParams ringParams = new FrameLayout.LayoutParams(Ui.dp(host, 30f),
                Ui.dp(host, 30f));
        ringParams.gravity = Gravity.CENTER;
        colorButton.addView(swatchRing, ringParams);
        LinearLayout.LayoutParams colorParams = new LinearLayout.LayoutParams(Ui.dp(host, target),
                Ui.dp(host, target));
        colorParams.leftMargin = Ui.dp(host, 2f);
        row.addView(colorButton, colorParams);

        FrameLayout expand = new FrameLayout(host);
        expand.setBackground(Ui.rippleRounded(host, Color.TRANSPARENT, target / 2f, 0,
                Ui.withAlpha(palette.ink, 0.08f)));
        expand.setClickable(true);
        expand.setFocusable(true);
        Ui.pressable(expand);
        expand.setContentDescription(host.getString(R.string.expand));
        expand.setOnClickListener(v -> {
            dock = DOCK_COMPACT;
            rebuildDock();
        });
        Glyph.View24 chevron = new Glyph.View24(host, Glyph.Kind.CHEVRON_UP, palette.ink, 20f);
        FrameLayout.LayoutParams chevronParams = new FrameLayout.LayoutParams(Ui.dp(host, 20f),
                Ui.dp(host, 20f));
        chevronParams.gravity = Gravity.CENTER;
        expand.addView(chevron, chevronParams);
        LinearLayout.LayoutParams expandParams = new LinearLayout.LayoutParams(Ui.dp(host, target),
                Ui.dp(host, target));
        expandParams.leftMargin = Ui.dp(host, 2f);
        row.addView(expand, expandParams);
        return row;
    }

    /**
     * O compacto: tres faixas — o ajuste da ferramenta, as ferramentas, as
     * seis cores. O handoff pedia duas fileiras, mas em 390 dp sobram 350 dp
     * para 4 ferramentas + 6 cores + expandir = 11 alvos; dar 44 dp a todos
     * exigiria 484 dp. Tres faixas (as mesmas do mockup) sao a unica forma de
     * manter alvo de 44 dp e as seis cores visiveis sem rolagem.
     */
    private View compactDock() {
        LinearLayout card = Ui.column(host);
        card.setBackground(Ui.rounded(Ui.withAlpha(palette.card, 0.95f),
                Ui.dpf(host, Ui.RADIUS_SHEET), palette.border, Ui.dpf(host, 1f)));
        Ui.padding(card, 8, 6, 8, 6);
        float target = kids ? 52f : 44f;

        LinearLayout row1 = Ui.row(host);
        card.addView(row1, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, target)));
        row1.addView(parameterPreview(), new LinearLayout.LayoutParams(Ui.dp(host, 34f),
                Ui.dp(host, 34f)));

        boolean hasSize = tool == Command.TOOL_PENCIL || tool == Command.TOOL_CRAYON;
        if (hasSize) {
            row1.addView(sizeStep(Glyph.Kind.MINUS, false), new LinearLayout.LayoutParams(
                    Ui.dp(host, target), Ui.dp(host, target)));
            LinearLayout.LayoutParams plusParams = new LinearLayout.LayoutParams(
                    Ui.dp(host, target), Ui.dp(host, target));
            plusParams.leftMargin = Ui.dp(host, 2f);
            row1.addView(sizeStep(Glyph.Kind.PLUS, true), plusParams);
        } else {
            TextView name = Ui.typed(host, host.getString(toolLabel(tool)), Type.LABEL_LG,
                    Type.LABEL_LG_LH, 0f, Ui.sansMedium(), palette.ink);
            LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            nameParams.leftMargin = Ui.dp(host, 10f);
            row1.addView(name, nameParams);
        }

        View spacer = new View(host);
        row1.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));
        Ui.IconButton collapse = new Ui.IconButton(host, Glyph.Kind.CHEVRON_DOWN,
                palette.mutedSurface, Color.TRANSPARENT, palette.ink, target);
        collapse.setContentDescription(host.getString(R.string.collapse));
        collapse.setOnClickListener(v -> {
            dock = DOCK_MINI;
            rebuildDock();
        });
        row1.addView(collapse, new LinearLayout.LayoutParams(Ui.dp(host, target),
                Ui.dp(host, target)));

        // Fileira 2: as ferramentas, icone apenas, e a porta da folha.
        LinearLayout row2 = Ui.row(host);
        LinearLayout.LayoutParams row2Params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, target));
        row2Params.topMargin = Ui.dp(host, 4f);
        card.addView(row2, row2Params);
        for (int i = 0; i < 4; i++) {
            row2.addView(toolButton(DrawCanvas.toolAt(kids, i), target, false),
                    new LinearLayout.LayoutParams(Ui.dp(host, target), Ui.dp(host, target)));
        }
        View spacer2 = new View(host);
        row2.addView(spacer2, new LinearLayout.LayoutParams(0, 1, 1f));
        Ui.IconButton expand = new Ui.IconButton(host, Glyph.Kind.CHEVRON_UP,
                palette.ink, Color.TRANSPARENT, palette.bg, target);
        expand.setContentDescription(host.getString(R.string.expand));
        expand.setOnClickListener(v -> {
            dock = DOCK_EXPANDED;
            rebuildDock();
        });
        row2.addView(expand, new LinearLayout.LayoutParams(Ui.dp(host, target),
                Ui.dp(host, target)));

        // Fileira 3: as seis cores rapidas, todas visiveis (sem rolagem escondida).
        LinearLayout row3 = Ui.row(host);
        LinearLayout.LayoutParams row3Params = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, target));
        row3Params.topMargin = Ui.dp(host, 4f);
        card.addView(row3, row3Params);
        int[] quick = kids ? PaletteCatalog.KIDS : PaletteCatalog.QUICK;
        for (int swatch : quick) {
            row3.addView(colorButton(swatch, target), new LinearLayout.LayoutParams(
                    Ui.dp(host, target), Ui.dp(host, target)));
        }
        return card;
    }

    private View parameterPreview() {
        FrameLayout holder = new FrameLayout(host);
        View dot = new View(host);
        int side = Math.max(Ui.dp(host, 16f), Math.min(Ui.dp(host, 26f),
                Math.round(Ui.dpf(host, widthFor(tool, sizeIndex) * 0.9f))));
        dot.setBackground(Ui.rounded(tool == DrawCanvas.TOOL_ERASER ? palette.mutedSurface : color,
                Ui.dpf(host, Ui.RADIUS_PILL), palette.border, Ui.dpf(host, 1f)));
        FrameLayout.LayoutParams dotParams = new FrameLayout.LayoutParams(side, side);
        dotParams.gravity = Gravity.CENTER;
        holder.addView(dot, dotParams);
        holder.setContentDescription(host.getString(R.string.tool_preview));
        return holder;
    }

    private View sizeStep(Glyph.Kind kind, boolean up) {
        Ui.IconButton button = new Ui.IconButton(host, kind,
                Ui.withAlpha(palette.mutedSurface, 0.8f), Color.TRANSPARENT, palette.ink, 44f);
        button.setContentDescription(host.getString(R.string.size));
        button.setOnClickListener(v -> {
            int next = sizeIndex + (up ? 1 : -1);
            sizeIndex = Math.max(0, Math.min(2, next));
            canvas.setWidthPx(widthFor(tool, sizeIndex));
            rebuildDock();
        });
        button.setEnabledLook(up ? sizeIndex < 2 : sizeIndex > 0);
        return button;
    }

    /** A folha encostada na borda: 28 dp so em cima, sem margem embaixo. */
    private View expandedDock() {
        LinearLayout card = Ui.column(host);
        GradientDrawable surface = new GradientDrawable();
        surface.setColor(palette.card);
        surface.setCornerRadii(new float[]{Ui.dpf(host, Ui.RADIUS_SHEET),
                Ui.dpf(host, Ui.RADIUS_SHEET), Ui.dpf(host, Ui.RADIUS_SHEET),
                Ui.dpf(host, Ui.RADIUS_SHEET), 0f, 0f, 0f, 0f});
        card.setBackground(surface);
        Ui.padding(card, 16, 8, 16, 0);

        View handle = new View(host);
        handle.setBackground(Ui.rounded(palette.border, Ui.dpf(host, Ui.RADIUS_PILL), 0, 0f));
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(Ui.dp(host, 32f),
                Ui.dp(host, 4f));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        handleParams.bottomMargin = Ui.dp(host, 8f);
        card.addView(handle, handleParams);

        // Cabecalho: a previa da materia, o nome e a medida em mono. A crianca
        // de 3-5 nao le nome nem "8px": para ela o desenho e a informacao.
        LinearLayout header = Ui.row(host);
        card.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                Ui.dp(host, 56f)));
        header.addView(parameterPreview(), new LinearLayout.LayoutParams(Ui.dp(host, 40f),
                Ui.dp(host, 40f)));
        if (!kids) {
            LinearLayout names = Ui.column(host);
            LinearLayout.LayoutParams namesParams = new LinearLayout.LayoutParams(0,
                    ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            namesParams.leftMargin = Ui.dp(host, 12f);
            header.addView(names, namesParams);
            names.addView(Ui.typed(host, host.getString(toolLabel(tool)), Type.TITLE_LG,
                    Type.TITLE_LG_LH, 0f, Ui.display(), palette.ink));
            String measure = widthFor(tool, sizeIndex) + "px";
            names.addView(Ui.typed(host, measure, Type.LABEL_SM, Type.LABEL_SM_LH,
                    Type.TRACK_LABEL_SM, Ui.mono(), palette.inkMuted));
        } else {
            View spacer = new View(host);
            header.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));
        }
        Ui.IconButton collapse = new Ui.IconButton(host, Glyph.Kind.CHEVRON_DOWN,
                palette.mutedSurface, Color.TRANSPARENT, palette.ink, 40f);
        collapse.setContentDescription(host.getString(R.string.collapse));
        collapse.setOnClickListener(v -> {
            dock = DOCK_COMPACT;
            rebuildDock();
        });
        header.addView(collapse, new LinearLayout.LayoutParams(Ui.dp(host, 40f),
                Ui.dp(host, 40f)));

        // A prateleira de materiais, com rotulo (o pro le; a crianca vai por cor).
        LinearLayout tools = Ui.row(host);
        LinearLayout.LayoutParams toolsParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, kids ? 76f : 80f));
        toolsParams.topMargin = Ui.dp(host, 4f);
        card.addView(tools, toolsParams);
        for (int i = 0; i < 4; i++) {
            tools.addView(toolButton(DrawCanvas.toolAt(kids, i), kids ? 60f : 56f, !kids),
                    new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        }

        if (tool == Command.TOOL_PENCIL || tool == Command.TOOL_CRAYON) {
            LinearLayout sizes = Ui.row(host);
            LinearLayout.LayoutParams sizesParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, 44f));
            sizesParams.topMargin = Ui.dp(host, 8f);
            card.addView(sizes, sizesParams);
            sizes.setGravity(Gravity.CENTER);
            for (int i = 0; i < 3; i++) {
                sizes.addView(sizeDot(i), new LinearLayout.LayoutParams(Ui.dp(host, 44f),
                        Ui.dp(host, 44f)));
            }
        }

        View rule = Ui.divider(host, palette.border);
        LinearLayout.LayoutParams ruleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Math.max(1, Ui.dp(host, 1f)));
        ruleParams.topMargin = Ui.dp(host, 10f);
        card.addView(rule, ruleParams);

        LinearLayout trayHolder = Ui.column(host);
        Ui.padding(trayHolder, 0, 10, 0, 0);
        if (kids) {
            // 3-5: seis circulos grandes, sem rotulo e sem barra de espectro.
            LinearLayout circles = Ui.row(host);
            circles.setGravity(Gravity.CENTER);
            for (int swatch : PaletteCatalog.KIDS) {
                circles.addView(kidSwatch(swatch), new LinearLayout.LayoutParams(
                        Ui.dp(host, 52f), Ui.dp(host, 52f)));
            }
            trayHolder.addView(circles, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        } else {
            PaletteTray tray = new PaletteTray(host, palette, color, picked -> {
                color = picked;
                canvas.setColor(color);
                rebuildDock();
            });
            trayHolder.addView(tray, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
        // A bandeja mede o que precisa: a folha e alta, nao um card com rolagem
        // interna (rolagem dentro de folha esconde a ultima linha de cores).
        card.addView(trayHolder, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));

        // A barra de acao fica parada: "feito" nunca cai abaixo da dobra.
        LinearLayout actions = Ui.row(host);
        LinearLayout.LayoutParams actionsParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, 44f));
        actionsParams.topMargin = Ui.dp(host, 8f);
        Ui.padding(actions, 0, 0, 0, 16);
        card.addView(actions, actionsParams);
        Ui.IconButton undoLocal = new Ui.IconButton(host, Glyph.Kind.UNDO, palette.mutedSurface,
                Color.TRANSPARENT, palette.ink, 44f);
        undoLocal.setContentDescription(host.getString(R.string.undo));
        undoLocal.setEnabledLook(session.canUndo());
        undoLocal.setOnClickListener(v -> {
            session.undo();
            canvas.invalidate();
            updateHistoryButtons();
            rebuildDock();
        });
        actions.addView(undoLocal, new LinearLayout.LayoutParams(Ui.dp(host, 44f),
                Ui.dp(host, 44f)));
        Ui.IconButton redoLocal = new Ui.IconButton(host, Glyph.Kind.REDO, palette.mutedSurface,
                Color.TRANSPARENT, palette.ink, 44f);
        redoLocal.setContentDescription(host.getString(R.string.redo));
        redoLocal.setEnabledLook(session.canRedo());
        redoLocal.setOnClickListener(v -> {
            session.redo();
            canvas.invalidate();
            updateHistoryButtons();
            rebuildDock();
        });
        LinearLayout.LayoutParams redoLocalParams = new LinearLayout.LayoutParams(
                Ui.dp(host, 44f), Ui.dp(host, 44f));
        redoLocalParams.leftMargin = Ui.dp(host, 8f);
        actions.addView(redoLocal, redoLocalParams);

        View spacer = new View(host);
        actions.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));

        if (kids) {
            Ui.IconButton done = new Ui.IconButton(host, Glyph.Kind.CHECK, palette.ink,
                    Color.TRANSPARENT, palette.bg, 56f);
            done.setContentDescription(host.getString(R.string.done));
            done.setOnClickListener(v -> {
                dock = DOCK_COMPACT;
                rebuildDock();
            });
            actions.addView(done, new LinearLayout.LayoutParams(Ui.dp(host, 56f),
                    Ui.dp(host, 56f)));
            return card;
        }
        TextView done = Ui.typed(host, host.getString(R.string.done), 12f, 40f, 0.02f,
                Ui.sansBold(), palette.bg);
        done.setGravity(Gravity.CENTER);
        done.setBackground(Ui.rippleRounded(host, palette.ink, Ui.RADIUS_PILL, 0,
                Ui.withAlpha(palette.bg, 0.14f)));
        Ui.padding(done, 16, 0, 16, 0);
        done.setClickable(true);
        done.setFocusable(true);
        Ui.pressable(done);
        done.setContentDescription(host.getString(R.string.done));
        done.setOnClickListener(v -> {
            dock = DOCK_COMPACT;
            rebuildDock();
        });
        actions.addView(done, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                Ui.dp(host, 40f)));
        return card;
    }

    private View toolButton(final int value, float target, boolean labeled) {
        LinearLayout item = Ui.column(host);
        item.setGravity(Gravity.CENTER_HORIZONTAL);
        FrameLayout disc = new FrameLayout(host);
        boolean selected = value == tool;
        disc.setBackground(Ui.rippleRounded(host,
                selected ? Ui.withAlpha(palette.primary, 0.10f) : palette.mutedSurface,
                target / 2f, selected ? Ui.withAlpha(palette.primary, 0.40f) : Color.TRANSPARENT,
                Ui.withAlpha(palette.ink, 0.08f)));
        disc.setClickable(true);
        disc.setFocusable(true);
        Ui.pressable(disc);
        disc.setContentDescription(host.getString(toolLabel(value)));
        disc.setOnClickListener(v -> selectTool(value));
        float size = labeled ? target : Math.min(36f, target);
        Glyph.View24 icon = new Glyph.View24(host, toolGlyph(value),
                selected ? palette.primary : (value == DrawCanvas.TOOL_ERASER
                        ? palette.inkMuted : palette.ink), labeled ? 24f : 22f);
        FrameLayout.LayoutParams iconParams = new FrameLayout.LayoutParams(
                Ui.dp(host, labeled ? 24f : 22f), Ui.dp(host, labeled ? 24f : 22f));
        iconParams.gravity = Gravity.CENTER;
        disc.addView(icon, iconParams);
        item.addView(disc, new LinearLayout.LayoutParams(Ui.dp(host, size),
                Ui.dp(host, Math.min(size, target))));
        if (labeled) {
            TextView label = Ui.typed(host, host.getString(toolLabel(value)), 10.5f, 14f, 0.02f,
                    Ui.sans(), selected ? palette.primary : palette.inkMuted);
            LinearLayout.LayoutParams labelParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            labelParams.topMargin = Ui.dp(host, 4f);
            item.addView(label, labelParams);
        }
        return item;
    }

    private View colorButton(final int swatch, float target) {
        FrameLayout button = new FrameLayout(host);
        boolean selected = swatch == color;
        button.setBackground(Ui.rippleRounded(host, Color.TRANSPARENT, target / 2f, 0,
                Ui.withAlpha(palette.ink, 0.08f)));
        button.setClickable(true);
        button.setFocusable(true);
        Ui.pressable(button);
        button.setContentDescription(PaletteCatalog.nameOf(swatch));
        View dot = new View(host);
        // O anel de selecao abraca a amostra, nao o alvo: um circulo do tamanho
        // do alvo leria como botao, e a cor e que esta escolhida.
        dot.setBackground(Ui.rounded(swatch, Ui.dpf(host, Ui.RADIUS_PILL),
                selected ? palette.ink : palette.border,
                Ui.dpf(host, selected ? 2f : 1f)));
        float dotSize = target * 0.68f;
        FrameLayout.LayoutParams dotParams = new FrameLayout.LayoutParams(
                Math.round(dotSize), Math.round(dotSize));
        dotParams.gravity = Gravity.CENTER;
        button.addView(dot, dotParams);
        button.setOnClickListener(v -> {
            color = swatch;
            canvas.setColor(color);
            rebuildDock();
        });
        return button;
    }

    /** Uma cor da faixa 3-5: circulo grande, alvo de 52 dp, nenhum rotulo. */
    private View kidSwatch(final int swatch) {
        FrameLayout cell = new FrameLayout(host);
        boolean selected = swatch == color;
        cell.setBackground(Ui.rippleRounded(host, Color.TRANSPARENT, Ui.RADIUS_KIDS, 0,
                Ui.withAlpha(palette.ink, 0.10f)));
        cell.setClickable(true);
        cell.setFocusable(true);
        Ui.pressable(cell);
        cell.setContentDescription(PaletteCatalog.nameOf(swatch));
        View dot = new View(host);
        dot.setBackground(Ui.rounded(swatch, Ui.dpf(host, Ui.RADIUS_PILL),
                selected ? palette.ink : Color.TRANSPARENT, Ui.dpf(host, selected ? 3f : 0f)));
        FrameLayout.LayoutParams dotParams = new FrameLayout.LayoutParams(Ui.dp(host, 44f),
                Ui.dp(host, 44f));
        dotParams.gravity = Gravity.CENTER;
        cell.addView(dot, dotParams);
        cell.setOnClickListener(v -> {
            color = swatch;
            canvas.setColor(color);
            rebuildDock();
        });
        return cell;
    }

    private View sizeDot(final int index) {
        FrameLayout button = new FrameLayout(host);
        boolean selected = index == sizeIndex;
        button.setBackground(Ui.rippleRounded(host,
                selected ? Ui.withAlpha(palette.primary, 0.10f) : palette.mutedSurface,
                22f, selected ? Ui.withAlpha(palette.primary, 0.40f) : Color.TRANSPARENT,
                Ui.withAlpha(palette.ink, 0.08f)));
        button.setClickable(true);
        button.setFocusable(true);
        Ui.pressable(button);
        String[] labels = {host.getString(R.string.size_small),
                host.getString(R.string.size_medium), host.getString(R.string.size_large)};
        button.setContentDescription(labels[index]);
        View dot = new View(host);
        dot.setBackground(Ui.rounded(tool == DrawCanvas.TOOL_ERASER ? palette.inkMuted : color,
                Ui.dpf(host, Ui.RADIUS_PILL), palette.border, Ui.dpf(host, 1f)));
        int side = Ui.dp(host, 8f + index * 6f);
        FrameLayout.LayoutParams dotParams = new FrameLayout.LayoutParams(side, side);
        dotParams.gravity = Gravity.CENTER;
        button.addView(dot, dotParams);
        button.setOnClickListener(v -> {
            sizeIndex = index;
            canvas.setWidthPx(widthFor(tool, sizeIndex));
            rebuildDock();
        });
        return button;
    }

    // ----------------------------------------------------------- acoes ---

    private void selectTool(int value) {
        tool = value;
        canvas.setTool(value);
        canvas.setWidthPx(widthFor(tool, sizeIndex));
        rebuildDock();
    }

    private void updateHistoryButtons() {
        undo.setEnabledLook(session.canUndo());
        redo.setEnabledLook(session.canRedo());
    }

    private int widthFor(int toolValue, int index) {
        if (toolValue == Command.TOOL_CRAYON) {
            return CRAYON_WIDTHS[Math.max(0, Math.min(2, index))];
        }
        if (toolValue == Command.TOOL_PENCIL) {
            return PENCIL_WIDTHS[Math.max(0, Math.min(2, index))];
        }
        if (toolValue == DrawCanvas.TOOL_ERASER) {
            return 24 + index * 10;
        }
        return 8;
    }

    private static Glyph.Kind toolGlyph(int value) {
        if (value == Command.TOOL_PENCIL) {
            return Glyph.Kind.PENCIL;
        }
        if (value == Command.TOOL_CRAYON) {
            return Glyph.Kind.CRAYON;
        }
        if (value == DrawCanvas.TOOL_FILL) {
            return Glyph.Kind.BUCKET;
        }
        return Glyph.Kind.ERASER;
    }

    private static int toolLabel(int value) {
        if (value == Command.TOOL_PENCIL) {
            return R.string.tool_pencil;
        }
        if (value == Command.TOOL_CRAYON) {
            return R.string.tool_crayon;
        }
        if (value == DrawCanvas.TOOL_FILL) {
            return R.string.tool_fill;
        }
        return R.string.tool_eraser;
    }

    /** Voltar pede decisao quando ha marcas no papel. */
    private void requestLeave() {
        if (session.commandCount() == 0) {
            host.store().delete(artwork);
            Thumbnails.invalidate(artwork.id);
            host.pop();
            host.message(host.getString(R.string.empty_sheet_discarded));
            return;
        }
        showSaveSheet();
    }

    @Override
    public boolean onBack() {
        if (saveSheet != null) {
            saveSheet.close();
            saveSheet = null;
            return true;
        }
        requestLeave();
        return true;
    }

    private void showSaveSheet() {
        if (saveSheet != null) {
            return;
        }
        saveSheet = new SaveSheet(host, palette, kids, new SaveSheet.Choice() {
            @Override
            public void publish() {
                finish(true);
            }

            @Override
            public void draft() {
                finish(false);
            }

            @Override
            public void keepDrawing() {
                if (saveSheet != null) {
                    saveSheet.close();
                    saveSheet = null;
                }
            }
        });
        addView(saveSheet, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        Motion.enterSheet(saveSheet, saveSheet.getChildAt(0));
    }

    private void finish(boolean publish) {
        artwork.published = publish;
        session.sync();
        host.store().saveNow(artwork);
        Thumbnails.invalidate(artwork.id);
        android.util.Log.i(AppActivity.TAG, "peca guardada id=" + artwork.id
                + " publicada=" + publish + " " + session.debugState());
        if (saveSheet != null) {
            saveSheet.close();
            saveSheet = null;
        }
        host.pop();
    }
}
