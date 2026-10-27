package com.theomaria.draw;

import android.app.Activity;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsetsController;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.theomaria.draw.model.Artwork;
import com.theomaria.draw.model.ArtworkStore;
import com.theomaria.draw.model.Profile;
import com.theomaria.draw.model.Profiles;
import com.theomaria.draw.ui.Motion;
import com.theomaria.draw.ui.Palette;
import com.theomaria.draw.ui.Ui;
import com.theomaria.draw.view.CanvasScreen;
import com.theomaria.draw.view.GalleryScreen;
import com.theomaria.draw.view.HomeScreen;
import com.theomaria.draw.view.ProfileScreen;
import com.theomaria.draw.view.Screen;
import com.theomaria.draw.view.SettingsScreen;
import com.theomaria.draw.view.ViewerScreen;

import java.util.ArrayList;
import java.util.List;

/**
 * Activity única. A navegação é uma pilha de telas — sem fragmento, sem rota,
 * sem androidx. A Home é a entrada e a única dona da troca de perfil.
 */
public final class AppActivity extends Activity {

    public static final String TAG = "MeuDesenho";

    private final List<Screen> stack = new ArrayList<>();
    private final Handler handler = new Handler(Looper.getMainLooper());

    private Prefs prefs;
    private Palette palette;
    private Profiles profiles;
    private ArtworkStore store;
    private FrameLayout root;
    private View snackbar;
    private Runnable snackbarTimeout;
    /** Ultimo perfil aberto nesta sessao: e ele que a Home marca com o anel ambar. */
    private String lastProfileId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = new Prefs(this);
        boolean dark = darkNow();
        setTheme(dark ? R.style.Theme_MeuDesenho_Dark : R.style.Theme_MeuDesenho);
        palette = Palette.of(dark);
        Ui.loadFonts(this);
        profiles = new Profiles(getFilesDir());
        store = new ArtworkStore(getFilesDir());

        root = new FrameLayout(this);
        root.setBackgroundColor(palette.bg);
        setContentView(root);
        applySystemBars();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            try {
                getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                        android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
            } catch (RuntimeException e) {
                // Sem dispatcher, onBackPressed continua sendo a porta (API 32 e anteriores).
                Log.w(TAG, "back dispatcher indisponivel: " + e.getMessage());
            }
        }

        push(new HomeScreen(this), false);
        // A troca de tema recria a Activity: a tela em que o adulto estava volta
        // assentada, com a paleta nova, em vez de pular para a Home.
        if (Prefs.ROUTE_SETTINGS.equals(prefs.takeRoute())) {
            push(new SettingsScreen(this), false);
        }
        // Fim do commit do tema: o proximo frame ja pode animar de novo (o
        // equivalente de remover a regra de supressao do mockup depois do reflow).
        root.postOnAnimation(Motion::endThemeSwitch);
        Log.i(TAG, "app aberto escuro=" + dark + " perfis=" + profiles.size()
                + " pecas=" + store.all().size());
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (store != null) {
            store.flush();
        }
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (prefs.scheme() == Prefs.SYSTEM && darkNow() != palette.dark) {
            prefs.setRoute(currentRoute());
            Motion.beginThemeSwitch();
            recreate();
        }
    }

    // ------------------------------------------------------------ deps ---

    public Palette palette() {
        return palette;
    }

    public Profiles profiles() {
        return profiles;
    }

    public ArtworkStore store() {
        return store;
    }

    public Prefs prefs() {
        return prefs;
    }

    public boolean dark() {
        return palette.dark;
    }

    /** A tela do topo da pilha (a rota atual, para o commit do tema). */
    public Screen top() {
        return stack.isEmpty() ? null : stack.get(stack.size() - 1);
    }

    /**
     * Troca de tema: nada anima enquanto a paleta vira. O commit recria a
     * Activity e a tela atual volta pela rota pendente, assentada.
     */
    public void setScheme(int scheme) {
        prefs.setScheme(scheme);
        prefs.setRoute(currentRoute());
        Motion.beginThemeSwitch();
        recreate();
    }

    private String currentRoute() {
        return top() instanceof SettingsScreen ? Prefs.ROUTE_SETTINGS : null;
    }

    private boolean darkNow() {
        int scheme = prefs.scheme();
        if (scheme == Prefs.DARK) {
            return true;
        }
        if (scheme == Prefs.LIGHT) {
            return false;
        }
        int mode = getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }

    private void applySystemBars() {
        getWindow().setStatusBarColor(palette.bg);
        getWindow().setNavigationBarColor(palette.bg);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int mask = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS
                        | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(palette.dark ? 0 : mask, mask);
            }
        } else {
            int flags = palette.dark ? 0
                    : View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            getWindow().getDecorView().setSystemUiVisibility(flags);
        }
    }

    // ------------------------------------------------------- navegacao ---

    public void push(Screen screen) {
        push(screen, true);
    }

    public void push(Screen screen, boolean animate) {
        stack.add(screen);
        attach(screen, animate);
        Log.i(TAG, "tela aberta " + screen.getClass().getSimpleName() + " pilha=" + stack.size());
    }

    public void pop() {
        if (stack.size() <= 1) {
            return;
        }
        Screen top = stack.remove(stack.size() - 1);
        root.removeView(top);
        Screen revealed = stack.get(stack.size() - 1);
        // A troca de tela nao tem par (single-activity): a revelada aparece
        // assentada, em vez de reentrar e piscar.
        attach(revealed, false);
        Log.i(TAG, "tela fechada " + top.getClass().getSimpleName() + " pilha=" + stack.size());
    }

    /** Volta até a Home (troca de perfil e saída de fluxo sempre passam por aqui). */
    public void popToHome() {
        while (stack.size() > 1) {
            Screen top = stack.remove(stack.size() - 1);
            root.removeView(top);
        }
        attach(stack.get(0), true);
    }

    private void attach(Screen screen, boolean animate) {
        if (snackbar != null) {
            root.removeView(snackbar);
        }
        root.removeAllViews();
        root.addView(screen);
        if (snackbar != null) {
            root.addView(snackbar);
        }
        screen.onResumeScreen();
        if (animate) {
            Motion.enterScreen(screen);
        }
    }

    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override
    public void onBackPressed() {
        handleBack();
    }

    /**
     * O voltar tem uma porta só. No 33+ ela é o callback de back (predictive
     * back); abaixo disso, o método clássico. Sem androidx.
     */
    private void handleBack() {
        if (snackbar != null) {
            dismissSnackbar();
            return;
        }
        Screen top = stack.get(stack.size() - 1);
        if (top.onBack()) {
            return;
        }
        if (stack.size() > 1) {
            pop();
            return;
        }
        finish();
    }

    // -------------------------------------------------------- fluxos ---

    public void openProfile(Profile profile) {
        lastProfileId = profile.id;
        push(new ProfileScreen(this, profile));
    }

    public void openGallery(Profile profile) {
        lastProfileId = profile.id;
        push(new GalleryScreen(this, profile));
    }

    public void openCanvas(Profile profile, Artwork artwork) {
        lastProfileId = profile.id;
        push(new CanvasScreen(this, profile, artwork));
    }

    public void openViewer(Artwork artwork, Profile profile) {
        if (profile != null) {
            lastProfileId = profile.id;
        }
        push(new ViewerScreen(this, artwork, profile));
    }

    /** O perfil em foco, ou null enquanto ninguem entrou. Nunca cai no primeiro. */
    public Profile activeProfile() {
        return profiles == null ? null : profiles.find(lastProfileId);
    }

    public void openSettings() {
        push(new SettingsScreen(this));
    }

    // -------------------------------------------------------- snackbar ---

    public void message(String text) {
        showSnackbar(text, null, null);
    }

    public void undoable(String text, String actionLabel, Runnable action) {
        showSnackbar(text, actionLabel, action);
    }

    private void showSnackbar(String text, String actionLabel, Runnable action) {
        dismissSnackbar();
        int surface = palette.dark ? palette.card : palette.ink;
        int foreground = palette.dark ? palette.ink : palette.paper;
        LinearLayout bar = Ui.row(this);
        bar.setBackground(Ui.rippleRounded(this, surface, 14f, palette.border,
                Ui.withAlpha(foreground, 0.14f)));
        Ui.padding(bar, 16, 12, 12, 12);
        TextView message = Ui.text(this, text, 14f, Ui.sans(), foreground);
        message.setMaxLines(2);
        bar.addView(message, new LinearLayout.LayoutParams(0,
                ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        if (actionLabel != null) {
            TextView actionView = Ui.text(this, actionLabel, 14f, Ui.sansBold(), palette.amber);
            Ui.pressable(actionView);
            actionView.setPadding(Ui.dp(this, 12), Ui.dp(this, 4), Ui.dp(this, 4), Ui.dp(this, 4));
            actionView.setOnClickListener(v -> {
                dismissSnackbar();
                if (action != null) {
                    action.run();
                }
            });
            bar.addView(actionView);
        }
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        params.gravity = Gravity.BOTTOM;
        params.setMargins(Ui.dp(this, 16), 0, Ui.dp(this, 16), Ui.dp(this, 20));
        snackbar = bar;
        root.addView(bar, params);
        bar.setAlpha(0f);
        bar.setTranslationY(Ui.dpf(this, 16f));
        bar.animate().alpha(1f).translationY(0f).setDuration(Motion.EXIT_MS)
                .setInterpolator(Motion.ENTER_EASE).start();
        snackbarTimeout = this::dismissSnackbar;
        handler.postDelayed(snackbarTimeout, 10000L);
    }

    private void dismissSnackbar() {
        if (snackbarTimeout != null) {
            handler.removeCallbacks(snackbarTimeout);
            snackbarTimeout = null;
        }
        View current = snackbar;
        snackbar = null;
        if (current != null && current.getParent() == root) {
            current.animate().alpha(0f).setDuration(Motion.EXIT_MS)
                    .setInterpolator(Motion.EXIT_EASE)
                    .withEndAction(() -> root.removeView(current)).start();
        }
    }
}
