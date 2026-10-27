package com.theomaria.draw.view;

import android.content.Context;
import android.graphics.Bitmap;
import android.os.Handler;
import android.os.Looper;
import android.widget.ImageView;

import com.theomaria.draw.model.Artwork;
import com.theomaria.draw.model.ArtworkSession;
import com.theomaria.draw.model.ArtworkStore;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Miniaturas derivadas dos comandos. Renderizar é caro (uma página de 1024 px),
 * então roda em uma thread só, com cache curto por (peça, versão, lado).
 */
public final class Thumbnails {

    private static final int CACHE_LIMIT = 40;
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static final ExecutorService EXEC = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "thumbnails");
        thread.setDaemon(true);
        return thread;
    });
    private static final Map<String, Bitmap> CACHE =
            new LinkedHashMap<String, Bitmap>(16, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Bitmap> eldest) {
                    if (size() > CACHE_LIMIT) {
                        eldest.getValue().recycle();
                        return true;
                    }
                    return false;
                }
            };

    private Thumbnails() {
    }

    public static void into(Context context, ImageView target, Artwork artwork, ArtworkStore store,
                            int side) {
        String key = key(artwork, side);
        target.setTag(key);
        Bitmap cached;
        synchronized (CACHE) {
            cached = CACHE.get(key);
        }
        if (cached != null && !cached.isRecycled()) {
            target.setImageBitmap(cached);
            return;
        }
        target.setImageDrawable(null);
        Context app = context.getApplicationContext();
        EXEC.execute(() -> {
            Bitmap bitmap;
            synchronized (CACHE) {
                Bitmap hit = CACHE.get(key);
                if (hit != null && !hit.isRecycled()) {
                    bitmap = hit;
                } else {
                    bitmap = render(app, artwork, store, side);
                    if (bitmap != null) {
                        CACHE.put(key, bitmap);
                    }
                }
            }
            if (bitmap == null) {
                return;
            }
            Bitmap result = bitmap;
            MAIN.post(() -> {
                if (key.equals(target.getTag())) {
                    target.setImageBitmap(result);
                }
            });
        });
    }

    public static void invalidate(String artworkId) {
        synchronized (CACHE) {
            java.util.Iterator<Map.Entry<String, Bitmap>> iterator = CACHE.entrySet().iterator();
            while (iterator.hasNext()) {
                Map.Entry<String, Bitmap> entry = iterator.next();
                if (entry.getKey().startsWith(artworkId + ":")) {
                    entry.getValue().recycle();
                    iterator.remove();
                }
            }
        }
    }

    private static Bitmap render(Context context, Artwork artwork, ArtworkStore store, int side) {
        long t0 = System.nanoTime();
        try {
            ArtworkSession session = new ArtworkSession(context, artwork, store);
            Bitmap thumb = session.thumbnail(side);
            session.bitmap().recycle();
            android.util.Log.i("MeuDesenho", "miniatura " + artwork.id + " " + side + "px em "
                    + ((System.nanoTime() - t0) / 1_000_000) + "ms");
            return thumb;
        } catch (Exception e) {
            android.util.Log.w("MeuDesenho", "miniatura falhou " + artwork.id + ": " + e.getMessage());
            return null;
        }
    }

    private static String key(Artwork artwork, int side) {
        return artwork.id + ":" + artwork.updatedAt + ":" + side;
    }
}
