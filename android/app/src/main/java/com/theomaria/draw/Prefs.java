package com.theomaria.draw;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * Preferência única do MVP-0: claro, escuro ou seguir o aparelho — mais duas
 * chaves que o movimento e a troca de tema precisam (ver better-ui): uma marca
 * de "já aconteceu uma vez" por coreografia, e a tela que deve voltar depois do
 * recreate do tema.
 */
public final class Prefs {

    public static final int LIGHT = 0;
    public static final int DARK = 1;
    public static final int SYSTEM = 2;

    /** A única tela que precisa sobreviver ao commit do tema. */
    public static final String ROUTE_SETTINGS = "settings";

    private static final String FILE = "meu-desenho";
    private static final String KEY_SCHEME = "colorScheme";
    private static final String KEY_ROUTE = "pendingRoute";
    private static final String PREFIX_ONCE = "once.";

    private final SharedPreferences prefs;

    public Prefs(Context context) {
        prefs = context.getSharedPreferences(FILE, Context.MODE_PRIVATE);
    }

    public int scheme() {
        return prefs.getInt(KEY_SCHEME, SYSTEM);
    }

    public void setScheme(int scheme) {
        prefs.edit().putInt(KEY_SCHEME, scheme).apply();
    }

    /**
     * @return true só na primeira vez que a chave é consultada, para sempre
     *         (stagger roda uma vez na vida do app, não a cada visita).
     */
    public boolean firstRun(String key) {
        String stored = PREFIX_ONCE + key;
        if (prefs.contains(stored)) {
            return false;
        }
        prefs.edit().putBoolean(stored, true).apply();
        return true;
    }

    /** A tela que deve ser reaberta depois do recreate (null = Home). */
    public void setRoute(String route) {
        if (route == null) {
            prefs.edit().remove(KEY_ROUTE).apply();
            return;
        }
        prefs.edit().putString(KEY_ROUTE, route).apply();
    }

    /** Lê e consome: uma rota vale para o recreate que a pediu, não para sempre. */
    public String takeRoute() {
        String route = prefs.getString(KEY_ROUTE, null);
        if (route != null) {
            prefs.edit().remove(KEY_ROUTE).apply();
        }
        return route;
    }
}
