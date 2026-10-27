package com.theomaria.draw.model;

import android.util.Log;

import com.theomaria.draw.ui.Themes;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Perfis do aparelho. O MVP-0 acomoda até quatro; a criação de perfis é de uma
 * fase posterior, então a lista nasce com as duas seeds da família.
 *
 * <p>As seeds seguem a decisão de faixa do backlog: Theo é o mais novo (3–5,
 * pele kids) e Maria é a mais velha (9+, pele pro). Trocar isso é trocar dado,
 * não código.
 */
public final class Profiles {

    private static final String TAG = "MeuDesenho";
    public static final int MAX_PROFILES = 4;

    private static final String FILE = "profiles.json";

    private final File file;
    private final List<Profile> profiles = new ArrayList<>();

    public Profiles(File filesDir) {
        this.file = new File(filesDir, FILE);
        load();
    }

    public List<Profile> all() {
        return Collections.unmodifiableList(profiles);
    }

    public int size() {
        return profiles.size();
    }

    public Profile byId(String id) {
        for (Profile profile : profiles) {
            if (profile.id.equals(id)) {
                return profile;
            }
        }
        return profiles.isEmpty() ? null : profiles.get(0);
    }

    /** Busca exata: devolve null em vez de cair no primeiro perfil. */
    public Profile find(String id) {
        if (id == null) {
            return null;
        }
        for (Profile profile : profiles) {
            if (profile.id.equals(id)) {
                return profile;
            }
        }
        return null;
    }

    private void load() {
        profiles.clear();
        if (file.exists()) {
            try (InputStream in = new java.io.FileInputStream(file)) {
                byte[] buffer = new byte[(int) file.length()];
                int read = 0;
                while (read < buffer.length) {
                    int step = in.read(buffer, read, buffer.length - read);
                    if (step < 0) {
                        break;
                    }
                    read += step;
                }
                JSONObject root = new JSONObject(new String(buffer, 0, read, StandardCharsets.UTF_8));
                JSONArray array = root.optJSONArray("profiles");
                if (array != null) {
                    for (int i = 0; i < array.length() && profiles.size() < MAX_PROFILES; i++) {
                        profiles.add(Profile.fromJson(array.getJSONObject(i)));
                    }
                }
            } catch (IOException | JSONException e) {
                Log.w(TAG, "profiles.json ilegivel, usando seeds: " + e.getMessage());
                profiles.clear();
            }
        }
        if (profiles.isEmpty()) {
            seed();
        }
    }

    private void seed() {
        profiles.add(new Profile("p-theo", "Theo", "🦖", Themes.DINOS, Profile.BAND_3_5));
        profiles.add(new Profile("p-maria", "Maria", "🦸", Themes.HEROI, Profile.BAND_9_PLUS));
        save();
        Log.i(TAG, "perfis semeados: " + profiles.size());
    }

    public void save() {
        try {
            JSONObject root = new JSONObject();
            root.put("version", 1);
            JSONArray array = new JSONArray();
            for (Profile profile : profiles) {
                array.put(profile.toJson());
            }
            root.put("profiles", array);
            writeAtomically(file, root.toString());
        } catch (IOException | JSONException e) {
            Log.e(TAG, "falha ao gravar perfis: " + e.getMessage());
        }
    }

    static void writeAtomically(File target, String content) throws IOException {
        File parent = target.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("nao criou " + parent);
        }
        File temp = new File(target.getPath() + ".tmp");
        try (FileOutputStream out = new FileOutputStream(temp)) {
            out.write(content.getBytes(StandardCharsets.UTF_8));
            out.flush();
            out.getFD().sync();
        }
        try {
            java.nio.file.Files.move(temp.toPath(), target.toPath(),
                    java.nio.file.StandardCopyOption.REPLACE_EXISTING,
                    java.nio.file.StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException atomicFailed) {
            // Nem todo volume suporta ATOMIC_MOVE; o replace simples é o fallback.
            if (!temp.renameTo(target)) {
                throw new IOException("nao renomeou " + temp + " -> " + target);
            }
        }
    }
}
