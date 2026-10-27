#!/usr/bin/env python3
"""Gera o icone launcher do app (adaptive v26 + PNGs legados).

Identidade: linho #F3EFE6, pincel com cabo ambar #C47A2B, virola lapis #5A5550 e
cerdas em pigmento #2F6E8A. Sem texto e sem personagem.

Requer Pillow, mas so para REGERAR o icone. O build do app nao depende deste
script nem do Python: os artefatos gerados (mipmaps, vectors, colors) ficam
versionados em app/src/main/res.

Rodar de android/:  python tools/make-launcher-icon.py
Saida: res/mipmap-*/ic_launcher.png, ic_launcher_round.png,
       res/mipmap-anydpi-v26/ic_launcher*.xml,
       res/drawable/ic_launcher_foreground.xml, ic_launcher_monochrome.xml,
       res/values/colors.xml (ic_launcher_background) e tools/preview/*.png.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "app" / "src" / "main" / "res"

LINEN = "#F3EFE6"
PIGMENT = "#2F6E8A"
AMBER = "#C47A2B"
LAPIS = "#5A5550"

# densidade -> lado em px (48dp base)
LEGACY = {
    "mdpi": 48,
    "hdpi": 72,
    "xhdpi": 96,
    "xxhdpi": 144,
    "xxxhdpi": 192,
}

# ---------------------------------------------------------------- geometria ---
# Unidades de 108x108 (canvas do adaptive icon), centro (54, 54).
# Zona segura: circulo de raio 33.

HANDLE = ((36.5, 78.5), (61.0, 54.0), 10.0, 7.2)
FERRULE = ((60.5, 55.0), (67.0, 48.5), 9.4)
BRISTLE_BASE = (67.0, 48.5)
BRISTLE_CTRL = (73.5, 40.0)
BRISTLE_TIP = (79.5, 36.0)
BRISTLE_W = 11.4
BRISTLE_BELLY = 14.2
BRISTLE_TIP_W = 2.4


def _add(a, b):
    return (a[0] + b[0], a[1] + b[1])


def _sub(a, b):
    return (a[0] - b[0], a[1] - b[1])


def _norm(a):
    n = math.hypot(a[0], a[1])
    return (a[0] / n, a[1] / n)


def _lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def stroke(spine, widths, cap_steps=14):
    """Contorno fechado de um traco com espessura variavel e pontas redondas."""
    left, right = [], []
    n = len(spine)
    for i, (point, width) in enumerate(zip(spine, widths)):
        tangent = _norm(_sub(spine[min(i + 1, n - 1)], spine[max(i - 1, 0)]))
        nrm = (-tangent[1], tangent[0])
        half = width / 2.0
        left.append((point[0] + nrm[0] * half, point[1] + nrm[1] * half))
        right.append((point[0] - nrm[0] * half, point[1] - nrm[1] * half))

    end_nrm = _norm(_sub(left[-1], right[-1]))
    ang_end = math.atan2(end_nrm[1], end_nrm[0])
    start_nrm = _norm(_sub(left[0], right[0]))
    ang_start = math.atan2(start_nrm[1], start_nrm[0])

    pts = list(left)
    for i in range(cap_steps + 1):
        a = ang_end - math.pi * i / cap_steps
        half = widths[-1] / 2.0
        pts.append((spine[-1][0] + half * math.cos(a), spine[-1][1] + half * math.sin(a)))
    pts += list(reversed(right))
    for i in range(cap_steps + 1):
        a = ang_start + math.pi - math.pi * i / cap_steps
        half = widths[0] / 2.0
        pts.append((spine[0][0] + half * math.cos(a), spine[0][1] + half * math.sin(a)))
    return pts


def bar(p0, p1, w0, w1, segments=20):
    spine = [_lerp(p0, p1, i / segments) for i in range(segments + 1)]
    widths = [w0 + (w1 - w0) * (i / segments) for i in range(segments + 1)]
    return stroke(spine, widths)


def bristles(segments=36):
    spine, widths = [], []
    peak = 0.45
    for i in range(segments + 1):
        t = i / segments
        spine.append(
            (
                (1 - t) ** 2 * BRISTLE_BASE[0]
                + 2 * (1 - t) * t * BRISTLE_CTRL[0]
                + t ** 2 * BRISTLE_TIP[0],
                (1 - t) ** 2 * BRISTLE_BASE[1]
                + 2 * (1 - t) * t * BRISTLE_CTRL[1]
                + t ** 2 * BRISTLE_TIP[1],
            )
        )
        # barriga de pincel redondo: estreita na virola, cheia no meio,
        # fecha numa ponta arredondada (smoothstep = derivada zero nas pontas)
        if t <= peak:
            u = 3 * (t / peak) ** 2 - 2 * (t / peak) ** 3
            widths.append(BRISTLE_W + (BRISTLE_BELLY - BRISTLE_W) * u)
        else:
            u = 3 * ((t - peak) / (1 - peak)) ** 2 - 2 * ((t - peak) / (1 - peak)) ** 3
            widths.append(BRISTLE_BELLY + (BRISTLE_TIP_W - BRISTLE_BELLY) * u)
    return stroke(spine, widths)


def trapezoid(p0, p1, w0, w1):
    """Banda sem pontas redondas: a virola de metal tem quina viva."""
    axis = _norm(_sub(p1, p0))
    nrm = (-axis[1], axis[0])
    return [
        (p0[0] + nrm[0] * w0 / 2, p0[1] + nrm[1] * w0 / 2),
        (p1[0] + nrm[0] * w1 / 2, p1[1] + nrm[1] * w1 / 2),
        (p1[0] - nrm[0] * w1 / 2, p1[1] - nrm[1] * w1 / 2),
        (p0[0] - nrm[0] * w0 / 2, p0[1] - nrm[1] * w0 / 2),
    ]


def handle():
    return bar(*HANDLE)


def ferrule():
    p0, p1, width = FERRULE
    return trapezoid(p0, p1, width, width + 1.2)


# ------------------------------------------------------------------ desenho ---
SUPERSAMPLE = 8


def _scaled(points, size, art=1.0):
    """108 unidades -> px, com escala de arte e centralizacao no canvas."""
    k = size * SUPERSAMPLE / 108.0 * art
    offset = (size * SUPERSAMPLE - 108.0 * k) / 2.0
    return [(p[0] * k + offset, p[1] * k + offset) for p in points]


def draw_foreground(size, art=1.0):
    px = size * SUPERSAMPLE
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # cerdas atras, cabo no meio, virola por cima: ela cobre as duas emendas
    d.polygon(_scaled(bristles(), size, art), fill=PIGMENT)
    d.polygon(_scaled(handle(), size, art), fill=AMBER)
    d.polygon(_scaled(ferrule(), size, art), fill=LAPIS)
    return img.resize((size, size), Image.LANCZOS)


def compose(size, round_mask=False, art=1.28):
    img = Image.new("RGBA", (size, size), LINEN)
    img.alpha_composite(draw_foreground(size, art=art))
    if round_mask:
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
        img.putalpha(mask)
    return img


def path_data(points):
    pts = [f"{p[0]:.2f},{p[1]:.2f}" for p in points]
    return "M" + " L".join(pts) + " Z"


# -------------------------------------------------------------------- saidas ---
def write_pngs():
    for density, side in LEGACY.items():
        out = RES / f"mipmap-{density}"
        out.mkdir(parents=True, exist_ok=True)
        compose(side).save(out / "ic_launcher.png")
        compose(side, round_mask=True, art=1.18).save(out / "ic_launcher_round.png")


def write_vectors():
    header = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<!-- Gerado por tools/make-launcher-icon.py. Nao editar a mao. -->\n"
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:width="108dp"\n'
        '    android:height="108dp"\n'
        '    android:viewportWidth="108"\n'
        '    android:viewportHeight="108">\n'
    )
    footer = "</vector>\n"

    def vector_paths(colors):
        bristle, shaft, ring = colors
        return (
            f'    <path\n        android:fillColor="{bristle}"\n'
            f'        android:pathData="{path_data(bristles())}" />\n'
            f'    <path\n        android:fillColor="{shaft}"\n'
            f'        android:pathData="{path_data(handle())}" />\n'
            f'    <path\n        android:fillColor="{ring}"\n'
            f'        android:pathData="{path_data(ferrule())}" />\n'
        )

    drawable = RES / "drawable"
    drawable.mkdir(parents=True, exist_ok=True)
    (drawable / "ic_launcher_foreground.xml").write_text(
        header + vector_paths((PIGMENT, AMBER, LAPIS)) + footer, encoding="utf-8", newline="\n"
    )
    # camada monocromatica (icones tematicos do Android 13+): a forma e o alfa
    (drawable / "ic_launcher_monochrome.xml").write_text(
        header + vector_paths(("#FF000000",) * 3) + footer, encoding="utf-8", newline="\n"
    )

    values = RES / "values"
    values.mkdir(parents=True, exist_ok=True)
    (values / "colors.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        f'    <color name="ic_launcher_background">{LINEN}</color>\n'
        "</resources>\n",
        encoding="utf-8",
        newline="\n",
    )


def write_adaptive_xml():
    body = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<!-- Gerado por tools/make-launcher-icon.py. Nao editar a mao. -->\n"
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background" />\n'
        '    <foreground android:drawable="@drawable/ic_launcher_foreground" />\n'
        '    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />\n'
        "</adaptive-icon>\n"
    )
    out = RES / "mipmap-anydpi-v26"
    out.mkdir(parents=True, exist_ok=True)
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        (out / name).write_text(body, encoding="utf-8", newline="\n")


def write_preview():
    out = ROOT / "tools" / "preview"
    out.mkdir(parents=True, exist_ok=True)
    compose(512).save(out / "ic_launcher_512.png")
    # simula a mascara adaptativa: o visivel e o miolo de 72/108
    art = draw_foreground(512)
    visible = art.crop((85, 85, 427, 427)).resize((342, 342), Image.LANCZOS)
    plate = Image.new("RGBA", (342, 342), LINEN)
    plate.alpha_composite(visible)
    mask = Image.new("L", (342, 342), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, 341, 341), fill=255)
    plate.putalpha(mask)
    plate.save(out / "ic_launcher_adaptive_512.png")
    # tira de legibilidade 48/72/96
    strip = Image.new("RGBA", (48 + 72 + 96 + 32, 96), (255, 255, 255, 255))
    x = 0
    for side in (48, 72, 96):
        strip.alpha_composite(compose(side), (x, (96 - side) // 2))
        x += side + 16
    strip.save(out / "ic_launcher_sizes.png")


if __name__ == "__main__":
    write_pngs()
    write_vectors()
    write_adaptive_xml()
    write_preview()
    print("icone gerado")
