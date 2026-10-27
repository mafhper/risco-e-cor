package com.theomaria.draw.ui;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.AnimatorSet;
import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.animation.StateListAnimator;
import android.animation.ValueAnimator;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.animation.Interpolator;
import android.view.animation.PathInterpolator;
import android.widget.TextView;

import java.util.List;

/**
 * O movimento do atelie, com os numeros medidos no mockup (lente better-ui) em
 * vez de um valor por tela.
 *
 * <p>Tres regras valem em todo lugar: feedback tem teto de 150 ms; a saida de uma
 * folha termina quando a animacao termina (nunca por um timer paralelo, que em
 * reproducao lenta some com o painel no meio do movimento); e a troca de tema e
 * um commit — nada anima enquanto a paleta vira, senao a tela inteira pisca em
 * cascata.
 *
 * <p>Sem AndroidX: {@link StateListAnimator}, {@link AnimatorSet} e
 * {@link ValueAnimator} do proprio framework. Com "remover animacoes" ligado no
 * aparelho ({@link ValueAnimator#areAnimatorsEnabled()}), todo movimento aqui
 * aplica o estado final de uma vez.
 */
public final class Motion {

    /** Derivacao do mouse no mockup: nada acima de 150 ms e feedback. */
    public static final long EXIT_MS = 150L;
    /** Entrada de folha (`sheet-in`), mantida em 280 ms. */
    public static final long ENTER_MS = 280L;
    /** Pressionar: escala e volta no mesmo tempo. */
    public static final long PRESS_MS = 150L;
    /** Cross-fade de icone contextual (opacity + scale + blur). */
    public static final long CROSSFADE_MS = 300L;
    /** Intervalo entre blocos do stagger. */
    public static final long STAGGER_MS = 100L;
    /** Duracao de cada bloco do stagger. */
    public static final long STAGGER_BLOCK_MS = 400L;
    /** Entrada de tela (single-activity): o mesmo teto de 150 ms. */
    public static final long SCREEN_MS = 150L;

    public static final float PRESS_SCALE = 0.96f;
    public static final float EXIT_DY_DP = 12f;
    public static final float SCREEN_DY_DP = 10f;
    public static final float STAGGER_DY_DP = 8f;
    public static final float CROSSFADE_SCALE_FROM = 0.25f;
    public static final float CROSSFADE_BLUR_DP = 4f;

    /** `cubic-bezier(0.22, 1, 0.36, 1)` — a entrada de folha do mockup. */
    public static final Interpolator ENTER_EASE = new PathInterpolator(0.22f, 1f, 0.36f, 1f);
    /** `ease-out` do mockup para saida e feedback. */
    public static final Interpolator EXIT_EASE = new PathInterpolator(0f, 0f, 0.58f, 1f);
    /** `cubic-bezier(0.2, 0, 0, 1)` — cross-fade de icone. */
    public static final Interpolator CROSSFADE_EASE = new PathInterpolator(0.2f, 0f, 0f, 1f);

    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final Runnable RELEASE = Motion::endThemeSwitch;

    private static int suppressDepth;

    private Motion() {
    }

    /**
     * Commit de troca de tema: a partir daqui nada anima ate o proximo frame da
     * tela reconstruida. E o equivalente do `transition:none !important` com
     * reflow forcado do mockup — o conteudo assenta antes de voltar a se mover.
     */
    public static void beginThemeSwitch() {
        suppressDepth++;
        MAIN.removeCallbacks(RELEASE);
        // Rede de seguranca: se o frame seguinte nunca chegar, o app nao fica mudo.
        MAIN.postDelayed(RELEASE, 400L);
    }

    /** Solta a supressao (chamado no primeiro frame depois do commit). */
    public static void endThemeSwitch() {
        suppressDepth = 0;
        MAIN.removeCallbacks(RELEASE);
    }

    public static boolean suppressed() {
        return suppressDepth > 0;
    }

    /** @return false quando o aparelho pediu para remover animacoes ou ha commit em curso. */
    public static boolean animate() {
        return suppressDepth == 0 && ValueAnimator.areAnimatorsEnabled();
    }

    /** Deixa a view no estado final, cancelando o que estiver em curso. */
    public static void settle(View view) {
        if (view == null) {
            return;
        }
        view.animate().cancel();
        view.setAlpha(1f);
        view.setTranslationX(0f);
        view.setTranslationY(0f);
        view.setScaleX(1f);
        view.setScaleY(1f);
        if (view instanceof Glyph.View24) {
            ((Glyph.View24) view).setBlurDp(0f);
        }
    }

    /** Entrada de tela: fade + degrau curto, no teto de feedback. */
    public static void enterScreen(View screen) {
        if (screen == null) {
            return;
        }
        if (!animate()) {
            settle(screen);
            return;
        }
        screen.setAlpha(0f);
        screen.setTranslationY(Ui.dpf(screen.getContext(), SCREEN_DY_DP));
        screen.animate().alpha(1f).translationY(0f)
                .setDuration(SCREEN_MS).setInterpolator(EXIT_EASE).start();
    }

    /**
     * Entrada de folha: o scrim funde e o conteudo sobe do rodape. A folha ja
     * montada (skip on load) ou em commit de tema entra assentada.
     */
    public static void enterSheet(View overlay, View content) {
        if (overlay == null) {
            return;
        }
        if (!animate()) {
            settle(overlay);
            settle(content);
            return;
        }
        overlay.setAlpha(0f);
        overlay.animate().alpha(1f).setDuration(EXIT_MS).setInterpolator(EXIT_EASE).start();
        if (content != null) {
            content.setTranslationY(overlay.getResources().getDisplayMetrics().heightPixels);
            content.animate().translationY(0f)
                    .setDuration(ENTER_MS).setInterpolator(ENTER_EASE).start();
        }
    }

    /**
     * Saida de folha: deslocamento curto + fade em 150 ms. O {@code after} roda
     * no fim da animacao, nao num timer paralelo.
     */
    public static void exitSheet(final View overlay, View content, final Runnable after) {
        if (overlay == null || !animate()) {
            if (after != null) {
                after.run();
            }
            return;
        }
        if (content != null) {
            content.animate().translationY(Ui.dpf(content.getContext(), EXIT_DY_DP))
                    .setDuration(EXIT_MS).setInterpolator(EXIT_EASE).start();
        }
        overlay.animate().alpha(0f).setDuration(EXIT_MS).setInterpolator(EXIT_EASE)
                .withEndAction(after).start();
    }

    /**
     * Troca de icone contextual: os dois ficam na arvore; o que sai apaga, o que
     * entra aparece de 0.25 a 1 e desfoca 4 dp para 0 em 300 ms.
     */
    public static void crossFade(final View outgoing, final View incoming) {
        if (incoming == null) {
            return;
        }
        if (!animate()) {
            settle(incoming);
            detach(outgoing);
            return;
        }
        incoming.setAlpha(0f);
        incoming.setScaleX(CROSSFADE_SCALE_FROM);
        incoming.setScaleY(CROSSFADE_SCALE_FROM);
        ObjectAnimator enter = ObjectAnimator.ofPropertyValuesHolder(incoming,
                PropertyValuesHolder.ofFloat(View.ALPHA, 0f, 1f),
                PropertyValuesHolder.ofFloat(View.SCALE_X, CROSSFADE_SCALE_FROM, 1f),
                PropertyValuesHolder.ofFloat(View.SCALE_Y, CROSSFADE_SCALE_FROM, 1f));

        AnimatorSet set = new AnimatorSet();
        AnimatorSet.Builder builder = set.play(enter);
        if (outgoing != null) {
            builder.with(ObjectAnimator.ofFloat(outgoing, View.ALPHA, 1f, 0f));
        }
        if (incoming instanceof Glyph.View24) {
            final Glyph.View24 icon = (Glyph.View24) incoming;
            icon.setBlurDp(CROSSFADE_BLUR_DP);
            // Desfoque por ValueAnimator: nada de propriedade sintética por reflexão
            // (o lint não enxerga setter em View e a animação falharia calada).
            ValueAnimator blur = ValueAnimator.ofFloat(CROSSFADE_BLUR_DP, 0f);
            blur.addUpdateListener(animation ->
                    icon.setBlurDp((float) animation.getAnimatedValue()));
            builder.with(blur);
        }
        set.setDuration(CROSSFADE_MS);
        set.setInterpolator(CROSSFADE_EASE);
        set.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                settle(incoming);
                detach(outgoing);
            }
        });
        set.start();
    }

    /**
     * Troca de texto com outro tipo: apaga, troca, acende. So para o que muda —
     * um readout que muda de numero a cada gesto nao passa por aqui.
     */
    public static void swapText(final TextView target, final CharSequence text,
                                final android.graphics.Typeface face) {
        if (target == null) {
            return;
        }
        if (!animate()) {
            target.setText(text);
            target.setTypeface(face);
            settle(target);
            return;
        }
        ObjectAnimator out = ObjectAnimator.ofFloat(target, View.ALPHA, target.getAlpha(), 0f);
        out.setDuration(CROSSFADE_MS / 2L);
        out.setInterpolator(EXIT_EASE);
        out.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                target.setText(text);
                target.setTypeface(face);
                ObjectAnimator in = ObjectAnimator.ofFloat(target, View.ALPHA, 0f, 1f);
                in.setDuration(CROSSFADE_MS / 2L);
                in.setInterpolator(ENTER_EASE);
                in.start();
            }
        });
        out.start();
    }

    /**
     * Coreografia de primeira execucao: os blocos entram em sequencia de 100 ms.
     * Depois da primeira vez o chamador passa {@code play = false} e os blocos
     * simplesmente estao no lugar.
     */
    public static void stagger(List<View> blocks, boolean play) {
        if (blocks == null) {
            return;
        }
        for (int i = 0; i < blocks.size(); i++) {
            View block = blocks.get(i);
            if (block == null) {
                continue;
            }
            if (!play || !animate()) {
                settle(block);
                continue;
            }
            block.setAlpha(0f);
            block.setTranslationY(Ui.dpf(block.getContext(), STAGGER_DY_DP));
            block.animate().alpha(1f).translationY(0f)
                    .setStartDelay(i * STAGGER_MS)
                    .setDuration(STAGGER_BLOCK_MS)
                    .setInterpolator(ENTER_EASE).start();
        }
    }

    /**
     * Press scale de 0.96 em 150 ms como {@link StateListAnimator}: o estado
     * pressionado do framework dispara o movimento, entao o clique, o ripple e a
     * acessibilidade continuam intocados.
     */
    public static StateListAnimator pressAnimator(View target) {
        StateListAnimator animator = new StateListAnimator();
        animator.addState(new int[]{android.R.attr.state_pressed}, scaleTo(target, PRESS_SCALE));
        animator.addState(new int[0], scaleTo(target, 1f));
        return animator;
    }

    private static ObjectAnimator scaleTo(View target, float value) {
        ObjectAnimator animator = ObjectAnimator.ofPropertyValuesHolder(target,
                PropertyValuesHolder.ofFloat(View.SCALE_X, value),
                PropertyValuesHolder.ofFloat(View.SCALE_Y, value));
        animator.setDuration(animate() ? PRESS_MS : 0L);
        animator.setInterpolator(EXIT_EASE);
        return animator;
    }

    private static void detach(View view) {
        if (view == null || !(view.getParent() instanceof android.view.ViewGroup)) {
            return;
        }
        ((android.view.ViewGroup) view.getParent()).removeView(view);
    }
}
