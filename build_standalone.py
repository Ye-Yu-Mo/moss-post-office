#!/usr/bin/env python3
"""Bundle the game into one self-contained HTML file that runs from file://."""

import base64
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "moss-post-office.html"


def data_uri(rel_path: str, mime: str) -> str:
    raw = (ROOT / rel_path).read_bytes()
    return f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")


def main() -> None:
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    game_js = (ROOT / "game.js").read_text(encoding="utf-8")
    pixi = (ROOT / "assets" / "pixi-7.4.2.min.js").read_text(encoding="utf-8")
    shim = (ROOT / "assets" / "pixi-unsafe-eval-7.4.2.min.js").read_text(
        encoding="utf-8"
    )

    scene = data_uri("assets/scene-dusk.webp", "image/webp")
    icons = data_uri("assets/ui-icons.webp", "image/webp")
    banner = data_uri("assets/moon-banner.webp", "image/webp")
    favicon = data_uri("assets/favicon.png", "image/png")

    # Image paths appear in the page and in markup built by game.js.
    replacements = {
        "assets/scene-dusk.webp": scene,
        "assets/ui-icons.webp": icons,
        "assets/moon-banner.webp": banner,
        "assets/favicon.png": favicon,
    }
    for needle, uri in replacements.items():
        html = html.replace(needle, uri)
        game_js = game_js.replace(needle, uri)

    # The preload is redundant once the image is inline, and would duplicate ~580 KB.
    html = re.sub(
        r'[ \t]*<link rel="preload" as="image"[^>]*>\s*\n', "", html, count=1
    )

    html = html.replace(
        '<script src="assets/pixi-7.4.2.min.js"></script>',
        "<script>\n" + pixi + "\n</script>",
    )
    html = html.replace(
        '<script src="assets/pixi-unsafe-eval-7.4.2.min.js"></script>',
        "<script>\n" + shim + "\n</script>",
    )
    html = html.replace(
        '<script src="game.js"></script>', "<script>\n" + game_js + "\n</script>"
    )

    leftovers = sorted(set(re.findall(r"assets/[A-Za-z0-9._-]+", html)))
    if leftovers:
        raise SystemExit(f"unbundled asset references: {leftovers}")
    if 'src="game.js"' in html or "pixi-7.4.2.min.js\"" in html:
        raise SystemExit("a script tag was not inlined")

    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    main()
