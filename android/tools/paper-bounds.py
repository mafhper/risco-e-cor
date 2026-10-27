#!/usr/bin/env python3
"""Encontra o retangulo do papel (branco puro) na captura do canvas.

Uso: python tools/paper-bounds.py <caminho.png>
Saida: "left top right bottom" em px, ou erro (exit 1).
"""

import sys

from PIL import Image, ImageChops


def main() -> int:
    if len(sys.argv) != 2:
        print("uso: paper-bounds.py <png>", file=sys.stderr)
        return 2
    image = Image.open(sys.argv[1]).convert("RGB")
    red = image.getchannel("R").point(lambda v: 255 if v >= 250 else 0)
    green = image.getchannel("G").point(lambda v: 255 if v >= 250 else 0)
    blue = image.getchannel("B").point(lambda v: 255 if v >= 250 else 0)
    mask = ImageChops.multiply(ImageChops.multiply(red, green), blue)
    box = mask.getbbox()
    if box is None:
        print("sem area branca", file=sys.stderr)
        return 1
    left, top, right, bottom = box
    if right - left < 400 or bottom - top < 400:
        print("area branca pequena demais: %s" % (box,), file=sys.stderr)
        return 1
    print("%d %d %d %d" % (left, top, right, bottom))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
