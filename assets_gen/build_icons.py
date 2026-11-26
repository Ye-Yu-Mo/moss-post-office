#!/usr/bin/env python3
"""Slice the generated icon sheet into a clean sprite sheet and build web assets."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "assets_gen", "ui")
OUT = os.path.join(ROOT, "assets")

COLS, ROWS, CELL = 4, 6, 256
NAMES = [
    "snail", "mushroom", "plane", "van",
    "cloud", "star", "seal", "glue",
    "handle", "bell", "tea", "pouch",
    "ladder", "fern", "boat", "sun",
    "wind", "rain", "mist", "mailbox",
    "letter", "tote", "sound-on", "sound-off",
]

sheet = Image.open(os.path.join(SRC, "icon_sheet.png")).convert("RGBA")
sw, sh = sheet.size
cw, ch = sw / COLS, sh / ROWS
canvas = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))

INSET = 12
ALPHA_FLOOR = 64

for index, name in enumerate(NAMES):
    col, row = index % COLS, index // COLS
    cell = sheet.crop((
        round(col * cw) + INSET, round(row * ch) + INSET,
        round((col + 1) * cw) - INSET, round((row + 1) * ch) - INSET,
    ))
    # drop faint glow haze and neighbour bleed so each icon sits on clean alpha
    alpha = cell.getchannel("A").point(
        lambda a: 0 if a < ALPHA_FLOOR else round((a - ALPHA_FLOOR) * 255 / (255 - ALPHA_FLOOR))
    )
    cell.putalpha(alpha)
    bbox = cell.getbbox()
    if bbox:
        cell = cell.crop(bbox)
    # fit into 220px with a little breathing room, keep aspect
    limit = 220
    scale = min(limit / cell.width, limit / cell.height, 1.0)
    cell = cell.resize(
        (max(1, round(cell.width * scale)), max(1, round(cell.height * scale))),
        Image.LANCZOS,
    )
    canvas.alpha_composite(
        cell,
        (col * CELL + (CELL - cell.width) // 2, row * CELL + (CELL - cell.height) // 2),
    )
    print(f"{index:2d} {name:10s} cell={cw:.0f}x{ch:.0f} bbox={bbox}")

os.makedirs(OUT, exist_ok=True)
canvas.save(os.path.join(OUT, "ui-icons.webp"), "WEBP", quality=82, method=6)
print("sheet", canvas.size, os.path.getsize(os.path.join(OUT, "ui-icons.webp")), "bytes")

# favicon from the heart-letter icon
fav_src = canvas.crop(((20 % COLS) * CELL, (20 // COLS) * CELL,
                       (20 % COLS + 1) * CELL, (20 // COLS + 1) * CELL))
fav = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
fav.alpha_composite(fav_src.resize((56, 56), Image.LANCZOS), (4, 4))
fav.save(os.path.join(OUT, "favicon.png"), optimize=True)
print("favicon", os.path.getsize(os.path.join(OUT, "favicon.png")), "bytes")

# moon banner: crop the central 2.5:1 band, then 1200x480
banner = Image.open(os.path.join(SRC, "moon_banner.png")).convert("RGB")
bw, bh = banner.size
target_w = round(bh * 2.5)
if target_w > bw:
    target_h = round(bw / 2.5)
    left, top = 0, max(0, (bh - target_h) // 2)
    banner = banner.crop((left, top, bw, top + target_h))
else:
    left = (bw - target_w) // 2
    banner = banner.crop((left, 0, left + target_w, bh))
banner = banner.resize((1200, 480), Image.LANCZOS)
banner.save(os.path.join(OUT, "moon-banner.webp"), "WEBP", quality=82, method=6)
print("banner", banner.size, os.path.getsize(os.path.join(OUT, "moon-banner.webp")), "bytes")
