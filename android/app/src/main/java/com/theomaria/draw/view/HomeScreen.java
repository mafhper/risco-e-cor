package com.theomaria.draw.view;

import android.content.Context;
import android.graphics.Color;
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
import com.theomaria.draw.model.Profile;
import com.theomaria.draw.ui.Glyph;
import com.theomaria.draw.ui.Motion;
import com.theomaria.draw.ui.Type;
import com.theomaria.draw.ui.Ui;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * HOME DO APP — a visao da familia, nao de uma crianca.
 *
 * <p>Aqui o material e o protagonista: parede de linho, as pecas da familia
 * pregadas com o angulo de cada uma e as pessoas no topo como pessoas (avatar +
 * nome em Fraunces), nunca como cartoes. Sem heroi cartoon, sem carrossel de
 * cards: a unica acao de criacao pergunta *com quem* antes de abrir o papel.
 *
 * <p>E a unica tela que troca de perfil e a unica porta para as configuracoes
 * globais do app.
 */
public final class HomeScreen extends Screen {

    private final LinearLayout profileRow;
    private final LinearLayout gridBox;
    private final TextView count;
    private final LinearLayout emptyBox;
    private final ScrollView scroller;
    private final FrameLayout sheetHost;

    public HomeScreen(AppActivity host) {
        super(host);
        Context context = host;
        setBackgroundColor(palette.bg);

        LinearLayout root = Ui.column(context);
        root.setBackgroundColor(palette.bg);
        root.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        // --- cabecalho: a marca e a unica porta das configuracoes ---
        LinearLayout header = Ui.row(context);
        Ui.padding(header, 20, 16, 12, 4);
        View dot = new View(context);
        dot.setBackground(Ui.rounded(palette.amber, Ui.dpf(context, Ui.RADIUS_PILL), 0, 0));
        LinearLayout.LayoutParams dotParams = new LinearLayout.LayoutParams(
                Ui.dp(context, 8f), Ui.dp(context, 8f));
        dotParams.rightMargin = Ui.dp(context, 6f);
        header.addView(dot, dotParams);

        TextView wordmark = Ui.typed(context, context.getString(R.string.home_wordmark),
                Type.TITLE_LG, 22f, -0.025f, Ui.displayMedium(), palette.ink);
        header.addView(wordmark);

        View spacer = new View(context);
        header.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));

        Ui.IconButton settings = new Ui.IconButton(context, Glyph.Kind.GEAR,
                Color.TRANSPARENT, Color.TRANSPARENT, palette.inkMuted, 48f);
        settings.setContentDescription(context.getString(R.string.settings));
        settings.setOnClickListener(v -> host.openSettings());
        header.addView(settings, new LinearLayout.LayoutParams(Ui.dp(context, 48f),
                Ui.dp(context, 48f)));
        root.addView(header);

        // --- as pessoas, nunca como cartoes ---
        profileRow = Ui.row(context);
        profileRow.setGravity(Gravity.TOP);
        Ui.padding(profileRow, 20, 12, 20, 8);
        HorizontalScrollView profileScroll = new HorizontalScrollView(context);
        profileScroll.setHorizontalScrollBarEnabled(false);
        profileScroll.setClipToPadding(false);
        profileScroll.addView(profileRow, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(profileScroll, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // --- mural ---
        scroller = new ScrollView(context);
        scroller.setFillViewport(true);
        scroller.setClipToPadding(false);
        scroller.setVerticalScrollBarEnabled(false);
        LinearLayout column = Ui.column(context);
        Ui.padding(column, 20, 0, 20, 96);

        View rule = Ui.divider(context, palette.border);
        LinearLayout.LayoutParams ruleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Math.max(1, Ui.dp(context, 1f)));
        ruleParams.topMargin = Ui.dp(context, 8f);
        column.addView(rule, ruleParams);

        LinearLayout muralHeader = Ui.row(context);
        LinearLayout.LayoutParams muralHeaderParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        muralHeaderParams.topMargin = Ui.dp(context, 12f);
        column.addView(muralHeader, muralHeaderParams);
        TextView title = Ui.sectionLabel(context, context.getString(R.string.mural_family),
                palette.inkMuted);
        muralHeader.addView(title, new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        count = Ui.typed(context, "", Type.LABEL_MD, Type.LABEL_MD_LH, 0f, Ui.mono(),
                palette.inkMuted);
        muralHeader.addView(count);

        gridBox = Ui.column(context);
        LinearLayout.LayoutParams gridParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        gridParams.topMargin = Ui.dp(context, 16f);
        column.addView(gridBox, gridParams);

        emptyBox = buildEmpty(context);
        LinearLayout.LayoutParams emptyParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        emptyParams.topMargin = Ui.dp(context, 24f);
        column.addView(emptyBox, emptyParams);

        scroller.addView(column, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(scroller, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        addView(root);

        // --- a unica acao de criacao: ambar, no canto do polegar ---
        FrameLayout fab = new FrameLayout(context);
        fab.setBackground(Ui.rippleRounded(context, palette.amber, 14f, Color.TRANSPARENT,
                Ui.withAlpha(palette.onAmber, 0.16f)));
        fab.setClickable(true);
        fab.setFocusable(true);
        Ui.pressable(fab);
        fab.setContentDescription(context.getString(R.string.new_piece));
        fab.setOnClickListener(v -> startCreating());
        Glyph.View24 plus = new Glyph.View24(context, Glyph.Kind.PLUS, palette.onAmber, 24f);
        FrameLayout.LayoutParams plusParams = new FrameLayout.LayoutParams(Ui.dp(context, 24f),
                Ui.dp(context, 24f));
        plusParams.gravity = Gravity.CENTER;
        fab.addView(plus, plusParams);
        FrameLayout.LayoutParams fabParams = new FrameLayout.LayoutParams(Ui.dp(context, 56f),
                Ui.dp(context, 56f));
        fabParams.gravity = Gravity.BOTTOM | Gravity.END;
        fabParams.setMargins(0, 0, Ui.dp(context, 20f), Ui.dp(context, 20f));
        addView(fab, fabParams);

        sheetHost = new FrameLayout(context);
        addView(sheetHost, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        refresh();
    }

    @Override
    public void onResumeScreen() {
        refresh();
    }

    private LinearLayout buildEmpty(Context context) {
        LinearLayout empty = Ui.column(context);
        Ui.padding(empty, 16, 40, 16, 40);
        empty.setGravity(Gravity.CENTER);
        empty.setBackground(Ui.rounded(palette.card, Ui.dpf(context, Ui.RADIUS_CARD),
                palette.border, Ui.dpf(context, 1f)));
        TextView emptyTitle = Ui.typed(context, context.getString(R.string.mural_empty_title),
                Type.HEADLINE_SM, Type.HEADLINE_SM_LH, -0.01f, Ui.display(), palette.ink);
        emptyTitle.setGravity(Gravity.CENTER);
        empty.addView(emptyTitle);
        TextView emptyBody = Ui.typed(context, context.getString(R.string.mural_empty_body),
                Type.BODY_MD, Type.BODY_MD_LH, Type.TRACK_BODY_MD, Ui.sans(), palette.inkMuted);
        emptyBody.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams bodyParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        bodyParams.topMargin = Ui.dp(context, 4f);
        empty.addView(emptyBody, bodyParams);
        return empty;
    }

    private void buildProfiles() {
        profileRow.removeAllViews();
        List<Profile> profiles = host.profiles().all();
        for (Profile profile : profiles) {
            boolean active = host.activeProfile() != null
                    && host.activeProfile().id.equals(profile.id);
            LinearLayout item = Ui.column(host);
            item.setGravity(Gravity.CENTER_HORIZONTAL);
            Ui.padding(item, 4, 2, 4, 2);
            item.setClickable(true);
            item.setFocusable(true);
            Ui.pressable(item);
            item.setContentDescription(host.getString(R.string.enter_profile, profile.name));
            item.setBackground(Ui.rippleRounded(host, 0, Ui.RADIUS, 0,
                    Ui.withAlpha(palette.ink, 0.06f)));
            item.setOnClickListener(v -> host.openProfile(profile));

            FrameLayout ring = new FrameLayout(host);
            ring.setBackground(Ui.rounded(0, Ui.dpf(host, Ui.RADIUS_PILL),
                    active ? palette.amber : palette.border, Ui.dpf(host, active ? 2f : 1f)));
            Ui.AvatarView avatar = new Ui.AvatarView(host, profile.theme(), profile.emoji, 44f,
                    palette.dark, 0, 0f);
            FrameLayout.LayoutParams avatarParams = new FrameLayout.LayoutParams(
                    Ui.dp(host, 44f), Ui.dp(host, 44f));
            avatarParams.gravity = Gravity.CENTER;
            ring.addView(avatar, avatarParams);
            item.addView(ring, new LinearLayout.LayoutParams(Ui.dp(host, 50f),
                    Ui.dp(host, 50f)));

            TextView name = Ui.typed(host, profile.name, 13f, 14f, 0.01f, Ui.hand(),
                    palette.ink);
            name.setMaxLines(1);
            name.setEllipsize(android.text.TextUtils.TruncateAt.END);
            name.setGravity(Gravity.CENTER);
            name.setMaxWidth(Ui.dp(host, 76f));
            LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            nameParams.topMargin = Ui.dp(host, 6f);
            item.addView(name, nameParams);

            LinearLayout.LayoutParams itemParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            itemParams.rightMargin = Ui.dp(host, 16f);
            profileRow.addView(item, itemParams);
        }
    }

    private void refresh() {
        buildProfiles();
        List<Artwork> published = host.store().published();
        int n = published.size();
        count.setText(n + " " + host.getString(n == 1 ? R.string.piece_singular
                : R.string.piece_plural));

        gridBox.removeAllViews();
        int gap = Ui.dp(host, 16f);
        int screen = host.getResources().getDisplayMetrics().widthPixels;
        int cell = (screen - Ui.dp(host, 40f) - gap) / 2;
        List<View> cards = new ArrayList<>();
        for (Artwork artwork : published) {
            Profile author = host.profiles().byId(artwork.profileId);
            cards.add(PieceCard.create(host, palette, artwork, author, cell, true, true,
                    () -> host.openViewer(artwork, author)));
        }
        if (!cards.isEmpty()) {
            gridBox.addView(Ui.masonry(host, cards, 2, gap));
        }
        boolean has = n > 0;
        gridBox.setVisibility(has ? View.VISIBLE : View.GONE);
        emptyBox.setVisibility(has ? View.GONE : View.VISIBLE);
        scroller.scrollTo(0, 0);
    }

    // ---------------------------------------------------------- criar ---

    /**
     * A unica porta de criacao: com um perfil so, ja se sabe com quem; com dois
     * ou mais, a folha pergunta. Autoria nunca e implicita.
     */
    private void startCreating() {
        List<Profile> profiles = host.profiles().all();
        if (profiles.isEmpty()) {
            return;
        }
        if (profiles.size() == 1) {
            start(profiles.get(0));
            return;
        }
        showWhoDraws(profiles);
    }

    private void start(Profile profile) {
        Artwork artwork = new Artwork(UUID.randomUUID().toString(), profile.id,
                Artwork.KIND_BLANK, null, Artwork.SHEET_W, Artwork.SHEET_H,
                System.currentTimeMillis());
        host.store().saveNow(artwork);
        sheetHost.removeAllViews();
        host.openCanvas(profile, artwork);
    }

    private void showWhoDraws(List<Profile> profiles) {
        sheetHost.removeAllViews();
        FrameLayout overlay = new FrameLayout(host);
        overlay.setBackgroundColor(Ui.withAlpha(palette.ink, 0.25f));
        overlay.setClickable(true);
        Ui.staticSurface(overlay);
        overlay.setOnClickListener(v -> dismissWhoDraws());
        LinearLayout sheet = Ui.column(host);
        sheet.setBackground(Ui.rounded(palette.card, Ui.dpf(host, Ui.RADIUS_SHEET), 0, 0f));
        Ui.padding(sheet, 16, 16, 16, 24);

        View handle = new View(host);
        handle.setBackground(Ui.rounded(palette.border, Ui.dpf(host, Ui.RADIUS_PILL), 0, 0));
        LinearLayout.LayoutParams handleParams = new LinearLayout.LayoutParams(Ui.dp(host, 32f),
                Ui.dp(host, 4f));
        handleParams.gravity = Gravity.CENTER_HORIZONTAL;
        handleParams.bottomMargin = Ui.dp(host, 12f);
        sheet.addView(handle, handleParams);

        sheet.addView(Ui.typed(host, host.getString(R.string.new_piece), Type.TITLE_LG,
                Type.TITLE_LG_LH, 0f, Ui.display(), palette.ink));
        TextView question = Ui.typed(host, host.getString(R.string.who_draws), Type.BODY_MD,
                Type.BODY_MD_LH, Type.TRACK_BODY_MD, Ui.sans(), palette.inkMuted);
        LinearLayout.LayoutParams questionParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        questionParams.topMargin = Ui.dp(host, 2f);
        sheet.addView(question, questionParams);

        for (Profile profile : profiles) {
            LinearLayout option = Ui.row(host);
            option.setBackground(Ui.rippleRounded(host, palette.bg, Ui.RADIUS, palette.border,
                    Ui.withAlpha(palette.ink, 0.06f)));
            Ui.padding(option, 12, 0, 12, 0);
            option.setClickable(true);
            option.setFocusable(true);
            Ui.pressable(option);
            option.setContentDescription(host.getString(R.string.create_with, profile.name));
            option.setOnClickListener(v -> start(profile));
            Ui.AvatarView avatar = new Ui.AvatarView(host, profile.theme(), profile.emoji, 34f,
                    palette.dark, 0, 0f);
            option.addView(avatar, new LinearLayout.LayoutParams(Ui.dp(host, 34f),
                    Ui.dp(host, 34f)));
            TextView name = Ui.typed(host, profile.name, Type.BODY_LG, Type.BODY_LG_LH, 0f,
                    Ui.display(), palette.ink);
            LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(0,
                    ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
            nameParams.leftMargin = Ui.dp(host, 12f);
            option.addView(name, nameParams);
            Glyph.View24 arrow = new Glyph.View24(host, Glyph.Kind.CHEVRON_UP, palette.inkMuted,
                    16f);
            arrow.setRotation(90f);
            option.addView(arrow, new LinearLayout.LayoutParams(Ui.dp(host, 16f),
                    Ui.dp(host, 16f)));
            LinearLayout.LayoutParams optionParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, 56f));
            optionParams.topMargin = Ui.dp(host, 6f);
            sheet.addView(option, optionParams);
        }

        FrameLayout.LayoutParams sheetParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        sheetParams.gravity = Gravity.BOTTOM;
        overlay.addView(sheet, sheetParams);
        sheetHost.addView(overlay, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        Motion.enterSheet(overlay, sheet);
    }

    /** Fecha a folha de "com quem": move 12 dp, apaga e sai no fim da animação. */
    private void dismissWhoDraws() {
        if (sheetHost.getChildCount() == 0) {
            return;
        }
        View overlay = sheetHost.getChildAt(0);
        View sheet = overlay instanceof ViewGroup && ((ViewGroup) overlay).getChildCount() > 0
                ? ((ViewGroup) overlay).getChildAt(0) : null;
        Motion.exitSheet(overlay, sheet, sheetHost::removeAllViews);
    }

    @Override
    public boolean onBack() {
        if (sheetHost.getChildCount() > 0) {
            dismissWhoDraws();
            return true;
        }
        return false;
    }
}
