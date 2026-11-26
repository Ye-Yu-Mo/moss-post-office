#!/usr/bin/env python3
"""Minimal production server for the Moss Post Office static game."""

import gzip
import hashlib
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
INDEX_PATH = os.path.join(ROOT, "index.html")
ASSETS = {
    "/game.js": (
        os.path.join(ROOT, "game.js"),
        "application/javascript; charset=utf-8",
        "no-cache",
        True
    ),
    "/assets/pixi-7.4.2.min.js": (
        os.path.join(ROOT, "assets", "pixi-7.4.2.min.js"),
        "application/javascript; charset=utf-8",
        "public, max-age=31536000, immutable",
        True
    ),
    "/assets/pixi-unsafe-eval-7.4.2.min.js": (
        os.path.join(ROOT, "assets", "pixi-unsafe-eval-7.4.2.min.js"),
        "application/javascript; charset=utf-8",
        "public, max-age=31536000, immutable",
        True
    ),
    "/assets/scene-dusk.webp": (
        os.path.join(ROOT, "assets", "scene-dusk.webp"),
        "image/webp",
        "public, max-age=31536000, immutable",
        False
    ),
    "/assets/ui-icons.webp": (
        os.path.join(ROOT, "assets", "ui-icons.webp"),
        "image/webp",
        "public, max-age=31536000, immutable",
        False
    ),
    "/assets/moon-banner.webp": (
        os.path.join(ROOT, "assets", "moon-banner.webp"),
        "image/webp",
        "public, max-age=31536000, immutable",
        False
    ),
    "/assets/favicon.png": (
        os.path.join(ROOT, "assets", "favicon.png"),
        "image/png",
        "public, max-age=604800",
        False
    )
}
CSP = (
    "default-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' data: https://fonts.gstatic.com; "
    "script-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; "
    "object-src 'none'; "
    "base-uri 'none'; "
    "form-action 'none'; "
    "frame-ancestors 'none'"
)


class GameServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address, handler):
        super().__init__(address, handler)
        self.index = self._load_file(
            INDEX_PATH, "text/html; charset=utf-8", "no-cache"
        )
        self.assets = {
            route: self._load_file(path, content_type, cache_control, compressible)
            for route, (path, content_type, cache_control, compressible) in ASSETS.items()
        }

    @staticmethod
    def _load_file(path, content_type, cache_control, compressible=True):
        with open(path, "rb") as handle:
            raw = handle.read()
        return {
            "raw": raw,
            "gzip": gzip.compress(raw, compresslevel=9, mtime=0) if compressible else raw,
            "etag": '"' + hashlib.sha256(raw).hexdigest() + '"',
            "mtime": int(os.path.getmtime(path)),
            "content_type": content_type,
            "cache_control": cache_control,
            "compressible": compressible
        }


class GameHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "MossPostOffice"
    sys_version = ""
    timeout = 20

    def _security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Content-Security-Policy", CSP)

    def _resource(self):
        path = urlsplit(self.path).path
        if path in ("/", "/index.html"):
            return self.server.index
        return self.server.assets.get(path)

    def _serve_resource(self, head_only=False):
        resource = self._resource()
        if resource is None:
            self.send_error(404, "Not found")
            return

        if self.headers.get("If-None-Match") == resource["etag"]:
            self.send_response(304)
            self.send_header("ETag", resource["etag"])
            self.send_header("Cache-Control", resource["cache_control"])
            self._security_headers()
            self.end_headers()
            return

        use_gzip = resource["compressible"] and "gzip" in self.headers.get("Accept-Encoding", "")
        body = resource["gzip"] if use_gzip else resource["raw"]
        self.send_response(200)
        self.send_header("Content-Type", resource["content_type"])
        self.send_header("Content-Language", "zh-CN")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", resource["cache_control"])
        self.send_header("ETag", resource["etag"])
        self.send_header("Last-Modified", self.date_time_string(resource["mtime"]))
        if resource["compressible"]:
            self.send_header("Vary", "Accept-Encoding")
        if use_gzip:
            self.send_header("Content-Encoding", "gzip")
        self._security_headers()
        self.end_headers()
        if not head_only:
            self.wfile.write(body)

    def do_GET(self):
        self._serve_resource()

    def do_HEAD(self):
        self._serve_resource(head_only=True)

    def log_message(self, format_string, *args):
        print(
            f'{self.address_string()} - - [{self.log_date_time_string()}] '
            f'{format_string % args}',
            flush=True,
        )


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 17321
    bind = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
    server = GameServer((bind, port), GameHandler)
    print(
        f"Moss Post Office listening on http://{bind}:{port} "
        f"({len(server.index['raw'])} bytes, gzip {len(server.index['gzip'])})",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
