package com.theomaria.draw.view;

import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.HorizontalScrollView;
import android.widget.ImageView;
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
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * HOME DO PERFIL — a pessoa, nao o app.
 *
 * <p>Pro: persona grande (o rosto, a cor do tema, a linha escrita pelo adulto),
 * as duas portas de criacao e o mural com escopo "So meus / Todos". Kids (3-5):
 * a mesma tela em leitura zero — avatar, dois portais do tamanho de cartoes e as
 * pecas penduradas; nenhum texto funcional.
 *
 * <p>Trocar de perfil so acontece na Home do app; aqui nao existe chip.
 */
public final class ProfileScreen extends Screen {

    private final Profile profile;
    private final boolean kids;

    private LinearLayout contentColumn;
    private LinearLayout muralBox;
    private LinearLayout piecesRow;
    private boolean scopeAll;

    public ProfileScreen(AppActivity host, Profile profile) {
        super(host);
        this.profile = profile;
        this.kids = profile.kids();
        Context context = host;
        setBackgroundColor(palette.bg);

        LinearLayout root = Ui.column(context);
        root.setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        root.addView(buildTopBar());

        ScrollView scroll = new ScrollView(context);
        scroll.setFillViewport(true);
        scroll.setClipToPadding(false);
        // A folha rola como folha: barra de rolagem do sistema aqui e a unica
        // coisa que grita "Android padrao" numa tela que e toda material.
        scroll.setVerticalScrollBarEnabled(false);
        contentColumn = Ui.column(context);
        Ui.padding(contentColumn, 16, 0, 16, 28);
        scroll.addView(contentColumn, new FrameLayout.LayoutParams(
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

    // ------------------------------------------------------------ topo ---

    private View buildTopBar() {
        LinearLayout bar = Ui.row(host);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        Ui.padding(bar, kids ? 10 : 8, kids ? 8 : 6, kids ? 16 : 12, kids ? 4 : 6);
        float backSize = kids ? 56f : 48f;
        Ui.IconButton back = new Ui.IconButton(host, Glyph.Kind.BACK, palette.card,
                Color.TRANSPARENT, palette.ink, backSize);
        back.setContentDescription(host.getString(R.string.back));
        back.setOnClickListener(v -> host.pop());
        bar.addView(back);

        if (kids) {
            Ui.AvatarView avatar = new Ui.AvatarView(host, profile.theme(), profile.emoji, 52f,
                    palette.dark, Ui.withAlpha(palette.amber, 0.85f), 2f);
            LinearLayout.LayoutParams avatarParams = new LinearLayout.LayoutParams(
                    Ui.dp(host, 58f), Ui.dp(host, 58f));
            avatarParams.leftMargin = Ui.dp(host, 14f);
            bar.addView(avatar, avatarParams);
            TextView name = Ui.typed(host, profile.name, 28f, 32f, -0.01f, Ui.display(),
                    palette.ink);
            LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            nameParams.leftMargin = Ui.dp(host, 10f);
            bar.addView(name, nameParams);
            View spacer = new View(host);
            bar.addView(spacer, new LinearLayout.LayoutParams(0, 1, 1f));
            return bar;
        }

        TextView name = Ui.typed(host, profile.name, Type.TITLE_LG, Type.TITLE_LG_LH, 0f,
                Ui.displayMedium(), palette.ink);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        nameParams.leftMargin = Ui.dp(host, 6f);
        bar.addView(name, nameParams);

        LinearLayout chip = Ui.row(host);
        chip.setBackground(Ui.rippleRounded(host, palette.card, Ui.RADIUS_PILL,
                palette.blend(palette.ink, palette.card, 0.84f),
                Ui.withAlpha(palette.ink, 0.08f)));
        Ui.padding(chip, 12, 0, 12, 0);
        chip.setClickable(true);
        chip.setFocusable(true);
        Ui.pressable(chip);
        chip.setContentDescription(host.getString(R.string.profile_settings));
        chip.setOnClickListener(v -> host.openSettings());
        chip.addView(new Glyph.View24(host, Glyph.Kind.USER, palette.ink, 16f),
                new LinearLayout.LayoutParams(Ui.dp(host, 16f), Ui.dp(host, 16f)));
        TextView chipLabel = Ui.typed(host, host.getString(R.string.profile_settings), 11f,
                14f, 0.02f, Ui.sansBold(), palette.ink);
        LinearLayout.LayoutParams chipLabelParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        chipLabelParams.leftMargin = Ui.dp(host, 6f);
        chip.addView(chipLabel, chipLabelParams);
        bar.addView(chip, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                Ui.dp(host, 40f)));
        return bar;
    }

    // ---------------------------------------------------------- conteudo ---

    private void rebuild() {
        contentColumn.removeAllViews();
        if (kids) {
            buildKidsHome();
        } else {
            buildProHome();
        }
    }

    private void buildKidsHome() {
        LinearLayout.LayoutParams pad = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        pad.topMargin = Ui.dp(host, 12f);
        View colorPortal = portal(R.string.color_page, Glyph.Kind.BOOK,
                profile.theme().container(palette.dark), profile.theme().onContainer(palette.dark),
                this::createPage, 124);
        contentColumn.addView(colorPortal, pad);
        LinearLayout.LayoutParams gap = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        gap.topMargin = Ui.dp(host, 14f);
        View blankPortal = portal(R.string.blank_sheet, Glyph.Kind.SHEET,
                palette.paper, com.theomaria.draw.model.Inks.INK, this::createBlank, 124);
        contentColumn.addView(blankPortal, gap);
        // Escolha inicial da crianca: os dois portais entram em sequencia de 100 ms,
        // so na primeira vez que ela abre o perfil.
        Motion.stagger(Arrays.asList(colorPortal, blankPortal),
                host.prefs().firstRun("stagger:kids-portals"));

        piecesRow = Ui.row(host);
        HorizontalScrollView strip = new HorizontalScrollView(host);
        strip.setHorizontalScrollBarEnabled(false);
        strip.setClipToPadding(false);
        strip.addView(piecesRow, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout.LayoutParams stripParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        stripParams.topMargin = Ui.dp(host, 18f);
        contentColumn.addView(strip, stripParams);
        fillKidsPieces();
    }

    private View portal(int labelRes, Glyph.Kind kind, int fill, int tint, Runnable action,
                        float heightDp) {
        FrameLayout portal = new FrameLayout(host);
        portal.setBackground(Ui.rippleRounded(host, fill, Ui.RADIUS_KIDS, palette.border,
                Ui.withAlpha(tint, 0.10f)));
        portal.setClickable(true);
        portal.setFocusable(true);
        Ui.pressable(portal);
        portal.setContentDescription(host.getString(labelRes));
        portal.setOnClickListener(v -> action.run());
        portal.setLayoutParams(new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, heightDp)));
        Glyph.View24 icon = new Glyph.View24(host, kind, tint, 58f);
        FrameLayout.LayoutParams iconParams = new FrameLayout.LayoutParams(
                Ui.dp(host, 64f), Ui.dp(host, 64f));
        iconParams.gravity = Gravity.CENTER;
        portal.addView(icon, iconParams);
        return portal;
    }

    private void fillKidsPieces() {
        piecesRow.removeAllViews();
        List<Artwork> pieces = host.store().forProfile(profile.id);
        int size = Ui.dp(host, 128f);
        for (Artwork artwork : pieces) {
            ArtworkCard card = new ArtworkCard(host, palette, artwork, profile, false, true,
                    false, size, Ui.RADIUS_KIDS, Ui.RADIUS_KIDS_INSET,
                    () -> open(artwork), null);
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(size, size);
            params.rightMargin = Ui.dp(host, 14f);
            piecesRow.addView(card, params);
        }
        if (pieces.isEmpty()) {
            FrameLayout blank = new FrameLayout(host);
            blank.setBackground(Ui.rippleRounded(host, palette.card, Ui.RADIUS_KIDS, palette.border,
                    Ui.withAlpha(palette.ink, 0.06f)));
            blank.setClickable(true);
            blank.setFocusable(true);
            Ui.pressable(blank);
            blank.setContentDescription(host.getString(R.string.blank_sheet));
            blank.setOnClickListener(v -> createBlank());
            Glyph.View24 plus = new Glyph.View24(host, Glyph.Kind.PLUS, palette.onAmber, 30f);
            FrameLayout.LayoutParams plusParams = new FrameLayout.LayoutParams(
                    Ui.dp(host, 56f), Ui.dp(host, 56f));
            plusParams.gravity = Gravity.CENTER;
            FrameLayout circle = new FrameLayout(host);
            circle.setBackground(Ui.rounded(palette.amber, Ui.dpf(host, Ui.RADIUS_PILL), 0, 0));
            circle.addView(plus, new FrameLayout.LayoutParams(
                    Ui.dp(host, 30f), Ui.dp(host, 30f), Gravity.CENTER));
            blank.addView(circle, plusParams);
            piecesRow.addView(blank, new LinearLayout.LayoutParams(size, size));
        }
    }

    private void buildProHome() {
        contentColumn.addView(personaSection());

        // --- as duas portas de criacao ---
        LinearLayout create = Ui.row(host);
        create.setGravity(Gravity.CENTER);
        create.setBackground(Ui.rippleRounded(host, palette.amber, Ui.RADIUS, Color.TRANSPARENT,
                Ui.withAlpha(palette.onAmber, 0.16f)));
        create.setClickable(true);
        create.setFocusable(true);
        Ui.pressable(create);
        create.setContentDescription(host.getString(R.string.start_drawing));
        create.setOnClickListener(v -> showCreateSheet());
        create.addView(new Glyph.View24(host, Glyph.Kind.PLUS, palette.onAmber, 20f),
                new LinearLayout.LayoutParams(Ui.dp(host, 20f), Ui.dp(host, 20f)));
        TextView createLabel = Ui.typed(host, host.getString(R.string.start_drawing), 18f, 24f,
                0f, Ui.displayMedium(), palette.onAmber);
        LinearLayout.LayoutParams createLabelParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        createLabelParams.leftMargin = Ui.dp(host, 8f);
        create.addView(createLabel, createLabelParams);
        LinearLayout.LayoutParams createParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, 64f));
        createParams.topMargin = Ui.dp(host, 16f);
        contentColumn.addView(create, createParams);

        LinearLayout gallery = Ui.row(host);
        gallery.setGravity(Gravity.CENTER);
        gallery.setBackground(Ui.rippleRounded(host, palette.card, Ui.RADIUS, palette.border,
                Ui.withAlpha(palette.ink, 0.06f)));
        gallery.setClickable(true);
        gallery.setFocusable(true);
        Ui.pressable(gallery);
        gallery.setContentDescription(host.getString(R.string.my_drawings));
        gallery.setOnClickListener(v -> host.openGallery(profile));
        gallery.addView(new Glyph.View24(host, Glyph.Kind.IMAGES, palette.ink, 16f),
                new LinearLayout.LayoutParams(Ui.dp(host, 16f), Ui.dp(host, 16f)));
        TextView galleryLabel = Ui.typed(host, host.getString(R.string.my_drawings),
                Type.LABEL_LG, Type.LABEL_LG_LH, 0.007f, Ui.sansMedium(), palette.ink);
        LinearLayout.LayoutParams galleryLabelParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        galleryLabelParams.leftMargin = Ui.dp(host, 6f);
        gallery.addView(galleryLabel, galleryLabelParams);
        LinearLayout.LayoutParams galleryParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, Ui.dp(host, 44f));
        galleryParams.topMargin = Ui.dp(host, 8f);
        contentColumn.addView(gallery, galleryParams);

        addRecentStrip();

        // --- mural com escopo ---
        LinearLayout muralHeader = Ui.row(host);
        LinearLayout.LayoutParams headerParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        headerParams.topMargin = Ui.dp(host, 20f);
        contentColumn.addView(muralHeader, headerParams);
        TextView muralTitle = Ui.sectionLabel(host, host.getString(R.string.in_mural),
                palette.inkMuted);
        muralHeader.addView(muralTitle, new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        muralHeader.addView(scopeControl());

        muralBox = Ui.column(host);
        LinearLayout.LayoutParams gridParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        gridParams.topMargin = Ui.dp(host, 12f);
        contentColumn.addView(muralBox, gridParams);

        TextView hint = Ui.typed(host, host.getString(R.string.switch_profile_hint),
                Type.BODY_SM, Type.BODY_SM_LH, Type.TRACK_BODY_SM, Ui.sans(), palette.inkMuted);
        hint.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams hintParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        hintParams.topMargin = Ui.dp(host, 16f);
        contentColumn.addView(hint, hintParams);

        fillMural();
    }

    private void addRecentStrip() {
        List<Artwork> recent = new ArrayList<>();
        for (Artwork artwork : host.store().forProfile(profile.id)) {
            recent.add(artwork);
        }
        recent.sort((a, b) -> Long.compare(b.updatedAt, a.updatedAt));
        if (recent.size() > 4) {
            recent = recent.subList(0, 4);
        }
        if (recent.isEmpty()) {
            return;
        }

        LinearLayout header = Ui.row(host);
        LinearLayout.LayoutParams headerParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        headerParams.topMargin = Ui.dp(host, 24f);
        contentColumn.addView(header, headerParams);
        TextView title = Ui.sectionLabel(host,
                host.getString(R.string.recent_of, profile.name), palette.inkMuted);
        header.addView(title, new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        header.addView(Ui.typed(host, String.valueOf(recent.size()), Type.LABEL_SM,
                Type.LABEL_SM_LH, Type.TRACK_LABEL_SM, Ui.mono(), palette.inkMuted));

        LinearLayout stripRow = Ui.row(host);
        stripRow.setGravity(Gravity.TOP);
        HorizontalScrollView strip = new HorizontalScrollView(host);
        strip.setHorizontalScrollBarEnabled(false);
        strip.setClipToPadding(false);
        strip.addView(stripRow, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        LinearLayout.LayoutParams stripParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        stripParams.topMargin = Ui.dp(host, 8f);
        contentColumn.addView(strip, stripParams);

        int side = Ui.dp(host, 92f);
        for (Artwork artwork : recent) {
            FrameLayout cell = new FrameLayout(host);
            cell.setBackground(Ui.rippleRounded(host, palette.card, Ui.RADIUS_CARD,
                    palette.border, Ui.withAlpha(palette.ink, 0.06f)));
            cell.setClickable(true);
            cell.setFocusable(true);
            Ui.pressable(cell);
            cell.setContentDescription(host.getString(R.string.open_piece));
            cell.setOnClickListener(v -> open(artwork));
            ImageView image = new ImageView(host);
            image.setScaleType(ImageView.ScaleType.FIT_XY);
            FrameLayout.LayoutParams imageParams = new FrameLayout.LayoutParams(
                    side - Ui.dp(host, 8f), side - Ui.dp(host, 8f));
            imageParams.gravity = Gravity.CENTER;
            cell.addView(image, imageParams);
            Thumbnails.into(host, image, artwork, host.store(), Math.max(160, side));
            LinearLayout.LayoutParams cellParams = new LinearLayout.LayoutParams(side, side);
            cellParams.rightMargin = Ui.dp(host, 12f);
            stripRow.addView(cell, cellParams);
        }
    }

    private View personaSection() {
        LinearLayout row = Ui.row(host);
        row.setGravity(Gravity.TOP);

        int screen = host.getResources().getDisplayMetrics().widthPixels;
        int content = screen - Ui.dp(host, 32f);
        int gap = Ui.dp(host, 12f);
        int heroSide = Math.round((content - gap) * 0.425f);

        FrameLayout hero = new FrameLayout(host);
        GradientDrawable surface = new GradientDrawable(GradientDrawable.Orientation.TL_BR,
                new int[]{profile.theme().container(palette.dark),
                        palette.blend(profile.theme().primary(palette.dark),
                                profile.theme().container(palette.dark), 0.76f)});
        surface.setCornerRadius(Ui.dpf(host, Ui.RADIUS_CARD));
        hero.setBackground(surface);

        Ui.AvatarView avatar = new Ui.AvatarView(host, profile.theme(), profile.emoji, 92f,
                palette.dark, 0, 0f);
        FrameLayout.LayoutParams avatarParams = new FrameLayout.LayoutParams(
                Ui.dp(host, 92f), Ui.dp(host, 92f));
        avatarParams.gravity = Gravity.CENTER;
        hero.addView(avatar, avatarParams);

        LinearLayout activity = Ui.row(host);
        activity.setBackground(Ui.rounded(Ui.withAlpha(palette.card, 0.92f),
                Ui.dpf(host, Ui.RADIUS), 0, 0f));
        Ui.padding(activity, 4, 3, 6, 3);
        Ui.AvatarView mini = new Ui.AvatarView(host, profile.theme(), profile.emoji, 18f,
                palette.dark, 0, 0f);
        activity.addView(mini, new LinearLayout.LayoutParams(Ui.dp(host, 18f),
                Ui.dp(host, 18f)));
        TextView activityLabel = Ui.typed(host, host.getString(R.string.free_drawing),
                10f, 14f, 0.01f, Ui.mono(), palette.inkMuted);
        activityLabel.setMaxLines(1);
        activityLabel.setEllipsize(android.text.TextUtils.TruncateAt.END);
        LinearLayout.LayoutParams activityLabelParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        activityLabelParams.leftMargin = Ui.dp(host, 4f);
        activity.addView(activityLabel, activityLabelParams);
        FrameLayout.LayoutParams activityParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        activityParams.gravity = Gravity.BOTTOM | Gravity.START;
        activityParams.setMargins(Ui.dp(host, 8f), 0, Ui.dp(host, 8f), Ui.dp(host, 8f));
        hero.addView(activity, activityParams);
        row.addView(hero, new LinearLayout.LayoutParams(heroSide, heroSide));

        LinearLayout persona = Ui.column(host);
        persona.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams personaParams = new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f);
        personaParams.leftMargin = gap;
        row.addView(persona, personaParams);

        TextView line = Ui.typed(host, profile.personaLine(), Type.BODY_MD, Type.BODY_MD_LH,
                0.01f, Ui.hand(), palette.inkMuted);
        persona.addView(line);
        TextView repLabel = Ui.sectionLabel(host, host.getString(R.string.repertoire),
                palette.inkMuted);
        LinearLayout.LayoutParams repParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        repParams.topMargin = Ui.dp(host, 12f);
        persona.addView(repLabel, repParams);

        Ui.FlowRow chips = new Ui.FlowRow(host, 6f);
        LinearLayout.LayoutParams chipsParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        chipsParams.topMargin = Ui.dp(host, 6f);
        persona.addView(chips, chipsParams);
        for (String chip : profile.repertoire()) {
            TextView item = Ui.typed(host, chip, Type.LABEL_MD, 24f, Type.TRACK_LABEL_MD,
                    Ui.sansMedium(), palette.ink);
            item.setBackground(Ui.rounded(palette.card, Ui.dpf(host, Ui.RADIUS_PILL),
                    palette.border, Ui.dpf(host, 1f)));
            Ui.padding(item, 10, 0, 10, 0);
            chips.addView(item);
        }

        TextView colorsLabel = Ui.sectionLabel(host, host.getString(R.string.favorite_colors),
                palette.inkMuted);
        LinearLayout.LayoutParams colorsParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        colorsParams.topMargin = Ui.dp(host, 12f);
        persona.addView(colorsLabel, colorsParams);

        LinearLayout dots = Ui.row(host);
        LinearLayout.LayoutParams dotsParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dotsParams.topMargin = Ui.dp(host, 4f);
        persona.addView(dots, dotsParams);
        // As cores favoritas saem do tema: a persona e o tema, nao um dado inventado.
        int[] favorites = {
                profile.theme().primary(palette.dark),
                profile.theme().container(palette.dark),
                palette.amber
        };
        for (int favorite : favorites) {
            View dot = new View(host);
            dot.setBackground(Ui.rounded(favorite, Ui.dpf(host, Ui.RADIUS_PILL),
                    palette.border, Ui.dpf(host, 1f)));
            LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(
                    Ui.dp(host, 16f), Ui.dp(host, 16f));
            params.rightMargin = Ui.dp(host, 4f);
            dots.addView(dot, params);
        }
        return row;
    }

    private View scopeControl() {
        LinearLayout group = Ui.row(host);
        group.setBackground(Ui.rounded(palette.card, Ui.dpf(host, Ui.RADIUS_PILL),
                palette.border, Ui.dpf(host, 1f)));
        Ui.padding(group, 2, 2, 2, 2);
        group.addView(scopeButton(R.string.scope_mine, false));
        group.addView(scopeButton(R.string.scope_all, true));
        return group;
    }

    private View scopeButton(int labelRes, boolean all) {
        TextView button = Ui.typed(host, host.getString(labelRes), 11f, 24f, 0.02f,
                Ui.sansBold(), scopeAll == all ? palette.bg : palette.inkMuted);
        Ui.padding(button, 10, 0, 10, 0);
        button.setGravity(Gravity.CENTER);
        button.setBackground(Ui.rounded(scopeAll == all ? palette.ink : Color.TRANSPARENT,
                Ui.dpf(host, Ui.RADIUS_PILL), 0, 0));
        button.setClickable(true);
        button.setFocusable(true);
        Ui.pressable(button);
        button.setOnClickListener(v -> {
            if (scopeAll != all) {
                scopeAll = all;
                rebuild();
            }
        });
        return button;
    }

    private void fillMural() {
        muralBox.removeAllViews();
        List<Artwork> published = host.store().published();
        int gap = Ui.dp(host, 12f);
        int screen = host.getResources().getDisplayMetrics().widthPixels;
        int content = screen - Ui.dp(host, 32f);
        int cell = (content - gap * 2) / 3;
        List<View> cards = new ArrayList<>();
        for (Artwork artwork : published) {
            if (!scopeAll && !artwork.profileId.equals(profile.id)) {
                continue;
            }
            Profile author = host.profiles().byId(artwork.profileId);
            cards.add(PieceCard.create(host, palette, artwork, author, cell, false, scopeAll,
                    () -> host.openViewer(artwork, author)));
        }
        if (!cards.isEmpty()) {
            muralBox.addView(Ui.masonry(host, cards, 3, gap));
        } else {
            TextView empty = Ui.typed(host,
                    host.getString(scopeAll ? R.string.mural_all_empty : R.string.mural_mine_empty),
                    Type.BODY_SM, Type.BODY_SM_LH, Type.TRACK_BODY_SM, Ui.sans(), palette.inkMuted);
            empty.setGravity(Gravity.CENTER);
            empty.setBackground(Ui.rounded(palette.card, Ui.dpf(host, Ui.RADIUS_CARD),
                    palette.border, Ui.dpf(host, 1f)));
            Ui.padding(empty, 12, 20, 12, 20);
            muralBox.addView(empty, new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }
    }

    // ---------------------------------------------------------- acoes ---

    private void showCreateSheet() {
        CreateSheet sheet = new CreateSheet(host, palette, profile, new CreateSheet.Choice() {
            @Override
            public void onBlank() {
                createBlank();
            }

            @Override
            public void onPage() {
                createPage();
            }
        });
        CreateSheet.show(this, sheet);
    }

    private void createBlank() {
        create(Artwork.KIND_BLANK, null);
    }

    private void createPage() {
        create(Artwork.KIND_PAGE, "page_poc");
    }

    private void create(String kind, String pageId) {
        Artwork artwork = new Artwork(UUID.randomUUID().toString(), profile.id, kind, pageId,
                pageId == null ? Artwork.SHEET_W : 1024,
                pageId == null ? Artwork.SHEET_H : 1024,
                System.currentTimeMillis());
        host.store().saveNow(artwork);
        host.openCanvas(profile, artwork);
    }

    private void open(Artwork artwork) {
        if (artwork.published) {
            host.openViewer(artwork, profile);
        } else {
            host.openCanvas(profile, artwork);
        }
    }
}
