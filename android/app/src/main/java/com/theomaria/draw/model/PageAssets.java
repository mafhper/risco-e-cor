package com.theomaria.draw.model;

import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Log;

import com.theomaria.poc.fill.pure.FillEngine;
import com.theomaria.poc.fill.pure.RegionMap;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * Página para colorir: PNG (contorno) + mapa de regiões + sidecar. O mapa é
 * pré-computado no pipeline de conteúdo; o app só carrega.
 */
public final class PageAssets {

    private static final String TAG = "MeuDesenho";
    private static final Map<String, PageAssets> CACHE = new HashMap<>();

    public final String id;
    public final RegionMap map;
    /** Contorno com alfa (desenhado em MULTIPLY sobre os fills). */
    public final Bitmap inkMask;
    public final double maxAreaPct;
    /** Anel de snap em pixels da página (~12 dp na largura de 360 dp). */
    public final int snapInner = 2;
    public final int snapOuter = 36;

    private PageAssets(String id, RegionMap map, Bitmap inkMask, double maxAreaPct) {
        this.id = id;
        this.map = map;
        this.inkMask = inkMask;
        this.maxAreaPct = maxAreaPct;
    }

    public static synchronized PageAssets load(AssetManager assets, String pageId) throws IOException {
        PageAssets cached = CACHE.get(pageId);
        if (cached != null) {
            return cached;
        }
        long t0 = System.nanoTime();
        byte[] mapBytes = readAll(assets, pageId + ".map");
        double maxPct = readCap(assets, pageId + ".json");
        Bitmap art = BitmapFactory.decodeStream(assets.open(pageId + ".png"));
        if (art == null) {
            throw new IOException("PNG nao decodificou: " + pageId);
        }
        Bitmap mask = art.extractAlpha();
        art.recycle();
        RegionMap map = RegionMap.fromBytes(mapBytes, maxPct);
        PageAssets page = new PageAssets(pageId, map, mask, maxPct);
        CACHE.put(pageId, page);
        Log.i(TAG, "pagina carregada " + pageId + " " + map.width() + "x" + map.height()
                + " regioes=" + map.regions().size() + " em "
                + ((System.nanoTime() - t0) / 1_000_000) + "ms");
        return page;
    }

    public FillEngine engine() {
        return new FillEngine(map, maxAreaPct, snapInner, snapOuter);
    }

    private static double readCap(AssetManager assets, String name) throws IOException {
        String text = new String(readAll(assets, name), StandardCharsets.UTF_8);
        try {
            return new JSONObject(text).optDouble("fillableMaxAreaPct", 40.0);
        } catch (Exception e) {
            throw new IOException("sidecar invalido: " + name, e);
        }
    }

    private static byte[] readAll(AssetManager assets, String name) throws IOException {
        try (InputStream in = assets.open(name)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream(2 * 1024 * 1024);
            byte[] buffer = new byte[32 * 1024];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }
}
