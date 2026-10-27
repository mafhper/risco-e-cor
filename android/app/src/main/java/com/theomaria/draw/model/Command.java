package com.theomaria.draw.model;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Um comando é a unidade do documento: cor de região, traço livre ou borracha.
 * O bitmap é sempre derivado da lista — desfazer é mover o cursor, não guardar
 * snapshot.
 */
public final class Command {

    public static final int TYPE_FILL = 1;
    public static final int TYPE_STROKE = 2;
    public static final int TYPE_ERASE = 3;

    public static final int TOOL_PENCIL = 0;
    public static final int TOOL_CRAYON = 1;

    public final int type;

    /** Fill: região do mapa. */
    public final int region;
    /** Fill e traço: cor ARGB. */
    public final int color;

    /** Traço: ferramenta, espessura em px da página e id estável. */
    public final int tool;
    public final int width;
    public final int strokeId;

    /** Traço: pontos x,y em coordenadas da página (pares). */
    public final float[] points;

    /** Borracha: ids de traço apagados por este comando. */
    public final int[] erased;

    private Command(int type, int region, int color, int tool, int width, int strokeId,
                    float[] points, int[] erased) {
        this.type = type;
        this.region = region;
        this.color = color;
        this.tool = tool;
        this.width = width;
        this.strokeId = strokeId;
        this.points = points;
        this.erased = erased;
    }

    public static Command fill(int region, int color) {
        return new Command(TYPE_FILL, region, color, 0, 0, 0, null, null);
    }

    public static Command stroke(int strokeId, int tool, int color, int width, float[] points) {
        return new Command(TYPE_STROKE, 0, color, tool, width, strokeId, points, null);
    }

    public static Command erase(int... strokeIds) {
        return new Command(TYPE_ERASE, 0, 0, 0, 0, 0, null, strokeIds);
    }

    public JSONObject toJson() throws JSONException {
        JSONObject json = new JSONObject();
        json.put("t", type);
        if (type == TYPE_FILL) {
            json.put("r", region);
            json.put("c", color);
        } else if (type == TYPE_STROKE) {
            json.put("id", strokeId);
            json.put("k", tool);
            json.put("w", width);
            json.put("c", color);
            JSONArray array = new JSONArray();
            for (float point : points) {
                array.put(Math.round(point));
            }
            json.put("p", array);
        } else {
            JSONArray array = new JSONArray();
            for (int id : erased) {
                array.put(id);
            }
            json.put("e", array);
        }
        return json;
    }

    public static Command fromJson(JSONObject json) throws JSONException {
        int type = json.getInt("t");
        if (type == TYPE_FILL) {
            return fill(json.getInt("r"), json.getInt("c"));
        }
        if (type == TYPE_STROKE) {
            JSONArray array = json.getJSONArray("p");
            float[] points = new float[array.length()];
            for (int i = 0; i < array.length(); i++) {
                points[i] = array.getInt(i);
            }
            return stroke(json.getInt("id"), json.optInt("k", TOOL_PENCIL),
                    json.getInt("c"), json.optInt("w", 8), points);
        }
        JSONArray array = json.getJSONArray("e");
        int[] ids = new int[array.length()];
        for (int i = 0; i < array.length(); i++) {
            ids[i] = array.getInt(i);
        }
        return erase(ids);
    }

    public boolean isFill() {
        return type == TYPE_FILL;
    }

    public boolean isStroke() {
        return type == TYPE_STROKE;
    }

    public boolean isErase() {
        return type == TYPE_ERASE;
    }
}
