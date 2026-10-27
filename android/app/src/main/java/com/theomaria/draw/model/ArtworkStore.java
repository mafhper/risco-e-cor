package com.theomaria.draw.model;

import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Peças no armazenamento privado do app ({@code filesDir/artworks}). A gravação
 * é atômica (tmp + rename) e serializada em um executor de thread única, então
 * um autosave nunca pisa no próximo.
 */
public final class ArtworkStore {

    private static final String TAG = "MeuDesenho";
    private static final String DIR = "artworks";

    private final File dir;
    private final ExecutorService writer = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "artwork-writer");
        thread.setDaemon(true);
        return thread;
    });

    public ArtworkStore(File filesDir) {
        this.dir = new File(filesDir, DIR);
        if (!dir.exists() && !dir.mkdirs()) {
            Log.e(TAG, "nao criou " + dir);
        }
    }

    public File dir() {
        return dir;
    }

    /** Todas as peças, mais recentes primeiro. */
    public synchronized List<Artwork> all() {
        List<Artwork> artworks = new ArrayList<>();
        File[] files = dir.listFiles((parent, name) -> name.endsWith(".json"));
        if (files == null) {
            return artworks;
        }
        for (File file : files) {
            try {
                artworks.add(read(file));
            } catch (IOException | JSONException e) {
                Log.w(TAG, "peca ilegivel " + file.getName() + ": " + e.getMessage());
            }
        }
        artworks.sort(Comparator.comparingLong((Artwork a) -> a.updatedAt).reversed());
        return artworks;
    }

    public synchronized List<Artwork> forProfile(String profileId) {
        List<Artwork> mine = new ArrayList<>();
        for (Artwork artwork : all()) {
            if (artwork.profileId.equals(profileId)) {
                mine.add(artwork);
            }
        }
        return mine;
    }

    public synchronized List<Artwork> published() {
        List<Artwork> mural = new ArrayList<>();
        for (Artwork artwork : all()) {
            if (artwork.published) {
                mural.add(artwork);
            }
        }
        return mural;
    }

    public synchronized Artwork byId(String id) {
        File file = fileFor(id);
        if (!file.exists()) {
            return null;
        }
        try {
            return read(file);
        } catch (IOException | JSONException e) {
            Log.w(TAG, "peca ilegivel " + id + ": " + e.getMessage());
            return null;
        }
    }

    /**
     * Grava agora, na mesma fila do autosave e esperando a vez: um autosave
     * pendente nunca pode sobrescrever o estado publicado depois desta chamada.
     */
    public void saveNow(Artwork artwork) {
        try {
            writer.submit(() -> writeNow(artwork)).get(5, java.util.concurrent.TimeUnit.SECONDS);
        } catch (Exception e) {
            Log.e(TAG, "fila de gravacao falhou, gravando na thread chamadora: " + e.getMessage());
            writeNow(artwork);
        }
    }

    /** Autosave assíncrono: o cofre recebe o estado aplicado, não o cursor. */
    public void autosave(Artwork artwork) {
        Artwork snapshot = new Artwork(artwork.id, artwork.profileId, artwork.kind, artwork.pageId,
                artwork.width, artwork.height, artwork.createdAt);
        snapshot.published = artwork.published;
        snapshot.commands.addAll(artwork.commands);
        writer.execute(() -> writeNow(snapshot));
    }

    private void writeNow(Artwork artwork) {
        artwork.updatedAt = System.currentTimeMillis();
        try {
            Profiles.writeAtomically(fileFor(artwork.id), artwork.toJson().toString());
        } catch (IOException | JSONException e) {
            Log.e(TAG, "falha ao gravar " + artwork.id + ": " + e.getMessage());
        }
    }

    public boolean delete(Artwork artwork) {
        boolean deleted = false;
        try {
            deleted = writer.submit(() -> removeNow(artwork)).get(5,
                    java.util.concurrent.TimeUnit.SECONDS);
        } catch (Exception e) {
            Log.e(TAG, "fila de remocao falhou: " + e.getMessage());
            deleted = removeNow(artwork);
        }
        Log.i(TAG, "peca apagada " + artwork.id + " ok=" + deleted);
        return deleted;
    }

    private boolean removeNow(Artwork artwork) {
        File file = fileFor(artwork.id);
        return !file.exists() || file.delete();
    }

    public void flush() {
        try {
            writer.submit(() -> {
            }).get(2, java.util.concurrent.TimeUnit.SECONDS);
        } catch (Exception ignored) {
            // O executor é daemon; um flush interrompido não desfaz o que já foi gravado.
        }
    }

    private File fileFor(String id) {
        return new File(dir, id + ".json");
    }

    private static Artwork read(File file) throws IOException, JSONException {
        try (InputStream in = new FileInputStream(file)) {
            byte[] buffer = new byte[(int) file.length()];
            int read = 0;
            while (read < buffer.length) {
                int step = in.read(buffer, read, buffer.length - read);
                if (step < 0) {
                    break;
                }
                read += step;
            }
            JSONObject json = new JSONObject(new String(buffer, 0, read, StandardCharsets.UTF_8));
            return Artwork.fromJson(json);
        }
    }

    public static List<Artwork> immutable(List<Artwork> list) {
        return Collections.unmodifiableList(list);
    }
}
