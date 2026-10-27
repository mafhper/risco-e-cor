package com.theomaria.draw.model;

import com.theomaria.draw.ui.Themes;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * Um perfil é uma pessoa, não um modo do app. A faixa etária decide a pele
 * (kids × pro) e o tema decide o destaque da persona.
 */
public final class Profile {

    /** Faixas suportadas pelo MVP-0 (a idade é do adulto, nunca exibida à criança). */
    public static final int BAND_3_5 = 3;
    public static final int BAND_6_8 = 6;
    public static final int BAND_9_PLUS = 9;

    public final String id;
    public final String name;
    public final String emoji;
    public final String themeId;
    public final int ageBand;

    public Profile(String id, String name, String emoji, String themeId, int ageBand) {
        this.id = id;
        this.name = name;
        this.emoji = emoji;
        this.themeId = themeId;
        this.ageBand = ageBand;
    }

    public boolean kids() {
        return ageBand <= BAND_3_5;
    }

    public Themes theme() {
        return Themes.byId(themeId);
    }

    public String bandLabel() {
        if (ageBand <= BAND_3_5) {
            return "3 a 5 anos";
        }
        if (ageBand <= BAND_6_8) {
            return "6 a 8 anos";
        }
        return "9 anos ou mais";
    }

    /** A linha da persona é do adulto e nunca carrega a idade. */
    public String personaLine() {
        if (ageBand <= BAND_3_5) {
            return "Gosta de carimbos, tintas grossas e de ver a cor encher o papel.";
        }
        if (ageBand <= BAND_6_8) {
            return "Mistura lápis e aquarela e já pede contorno para pintar.";
        }
        return "Traço atento, paleta fria, trabalho com calma e capricho.";
    }

    public String[] repertoire() {
        if (ageBand <= BAND_3_5) {
            return new String[]{"Cor", "Balde", "Dedo"};
        }
        if (ageBand <= BAND_6_8) {
            return new String[]{"Lápis", "Ceras", "Contorno"};
        }
        return new String[]{"Ceras", "Camadas", "Contorno"};
    }

    public JSONObject toJson() throws JSONException {
        JSONObject json = new JSONObject();
        json.put("id", id);
        json.put("name", name);
        json.put("emoji", emoji);
        json.put("theme", themeId);
        json.put("age", ageBand);
        return json;
    }

    public static Profile fromJson(JSONObject json) throws JSONException {
        return new Profile(
                json.getString("id"),
                json.getString("name"),
                json.optString("emoji", "🖍"),
                json.optString("theme", Themes.NEUTRO),
                json.optInt("age", BAND_9_PLUS));
    }
}
