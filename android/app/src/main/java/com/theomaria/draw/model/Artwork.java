package com.theomaria.draw.model;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** Metadado + comandos aplicados de uma peça. */
public final class Artwork {

    public static final String KIND_BLANK = "blank";
    public static final String KIND_PAGE = "page";

    /**
     * A folha do estudio tem a proporcao de um telefone (300x650 no mockup):
     * papel cheio na tela, sem faixa de mesa sobrando em cima e embaixo. A
     * resolucao e nossa, so para o traco nao pixelar.
     */
    public static final int SHEET_W = 760;
    public static final int SHEET_H = 1647;

    public String id;
    public String profileId;
    public String kind;
    /** Nulo em folha em branco. */
    public String pageId;
    public int width;
    public int height;
    public long createdAt;
    public long updatedAt;
    public boolean published;
    public final List<Command> commands = new ArrayList<>();

    public Artwork(String id, String profileId, String kind, String pageId,
                   int width, int height, long now) {
        this.id = id;
        this.profileId = profileId;
        this.kind = kind;
        this.pageId = pageId;
        this.width = width;
        this.height = height;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public boolean isPage() {
        return KIND_PAGE.equals(kind) && pageId != null;
    }

    public boolean isEmpty() {
        return commands.isEmpty();
    }

    public JSONObject toJson() throws JSONException {
        JSONObject json = new JSONObject();
        json.put("version", 1);
        json.put("id", id);
        json.put("profileId", profileId);
        json.put("kind", kind);
        if (pageId != null) {
            json.put("pageId", pageId);
        }
        json.put("w", width);
        json.put("h", height);
        json.put("createdAt", createdAt);
        json.put("updatedAt", updatedAt);
        json.put("published", published);
        JSONArray array = new JSONArray();
        for (Command command : commands) {
            array.put(command.toJson());
        }
        json.put("commands", array);
        return json;
    }

    public static Artwork fromJson(JSONObject json) throws JSONException {
        Artwork artwork = new Artwork(
                json.getString("id"),
                json.getString("profileId"),
                json.getString("kind"),
                json.has("pageId") && !json.isNull("pageId") ? json.getString("pageId") : null,
                json.optInt("w", 1024),
                json.optInt("h", 1024),
                json.optLong("createdAt", 0L));
        artwork.updatedAt = json.optLong("updatedAt", artwork.createdAt);
        artwork.published = json.optBoolean("published", false);
        JSONArray array = json.optJSONArray("commands");
        if (array != null) {
            for (int i = 0; i < array.length(); i++) {
                artwork.commands.add(Command.fromJson(array.getJSONObject(i)));
            }
        }
        return artwork;
    }

    public Artwork copy(String newId, long now) {
        Artwork copy = new Artwork(newId, profileId, kind, pageId, width, height, now);
        copy.published = false;
        copy.commands.addAll(commands);
        return copy;
    }
}
