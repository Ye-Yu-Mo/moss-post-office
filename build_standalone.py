#!/usr/bin/env python3
"""Bundle the Vite build into one self-contained HTML file that runs from file://."""

import base64
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
OUT = ROOT / "moss-post-office.html"


def data_uri(path: Path, mime: str) -> str:
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def main() -> None:
    subprocess.run(["npm", "run", "build"], cwd=ROOT, check=True)
    html = (DIST / "index.html").read_text(encoding="utf-8")

    scene = data_uri(DIST / "assets" / "scene-dusk.webp", "image/webp")
    icons = data_uri(DIST / "assets" / "ui-icons.webp", "image/webp")
    banner = data_uri(DIST / "assets" / "moon-banner.webp", "image/webp")
    favicon = data_uri(DIST / "assets" / "favicon.png", "image/png")

    # The preload is redundant once the image is inline, and would duplicate ~580 KB.
    html = re.sub(r'[ \t]*<link rel="preload" as="image"[^>]*>\s*\n', "", html, count=1)

    css_match = re.search(
        r'<link rel="stylesheet"[^>]*href="(/assets/[^"]+\.css)"[^>]*>', html
    )
    if not css_match:
        raise SystemExit("built stylesheet not found")
    css_path = DIST / css_match.group(1).lstrip("/")
    css = css_path.read_text(encoding="utf-8")
    for needle, uri in (
        ("/assets/scene-dusk.webp", scene),
        ("/assets/ui-icons.webp", icons),
        ("/assets/moon-banner.webp", banner),
        ("/assets/favicon.png", favicon),
    ):
        css = css.replace(needle, uri)
    html = html[: css_match.start()] + f"<style>\n{css}\n</style>" + html[css_match.end():]

    js_match = re.search(
        r'<script type="module"[^>]*src="(/assets/[^"]+\.js)"[^>]*></script>', html
    )
    if not js_match:
        raise SystemExit("built module script not found")
    js_path = DIST / js_match.group(1).lstrip("/")
    js = js_path.read_text(encoding="utf-8")
    for needle, uri in (
        ("/assets/scene-dusk.webp", scene),
        ("/assets/ui-icons.webp", icons),
        ("/assets/moon-banner.webp", banner),
        ("/assets/favicon.png", favicon),
    ):
        js = js.replace(needle, uri)
    html = html[: js_match.start()] + f"<script type=\"module\">\n{js}\n</script>" + html[js_match.end():]

    for vendor in ("pixi-7.4.2.min.js", "pixi-unsafe-eval-7.4.2.min.js"):
        source = (DIST / "assets" / vendor).read_text(encoding="utf-8")
        html = html.replace(
            f'<script src="/assets/{vendor}"></script>',
            f"<script>\n{source}\n</script>",
        )

    for needle, uri in (
        ("/assets/scene-dusk.webp", scene),
        ("/assets/ui-icons.webp", icons),
        ("/assets/moon-banner.webp", banner),
        ("/assets/favicon.png", favicon),
    ):
        html = html.replace(needle, uri)

    leftovers = sorted(set(re.findall(r"/assets/[A-Za-z0-9._-]+", html)))
    leftovers = [item for item in leftovers if item not in ("/assets/",)]
    if leftovers:
        raise SystemExit(f"unbundled asset references: {leftovers}")

    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MiB)")


if __name__ == "__main__":
    main()
