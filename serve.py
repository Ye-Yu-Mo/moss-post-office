#!/usr/bin/env python3
"""Serve the Vite build output (`dist/`) with a strict allowlist and CSP."""

import gzip
import hashlib
import http.client
import json
import mimetypes
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")
INDEX_PATH = os.path.join(DIST, "index.html")
API_HOST = os.environ.get("MOSS_API_HOST", "127.0.0.1")
API_PORT = int(os.environ.get("MOSS_API_PORT", "17322"))
API_PREFIX = "/api/"
MAX_PROXY_BODY = 1024 * 1024

COMPRESSIBLE = {
    ".html": True,
    ".js": True,
    ".css": True,
    ".json": True,
    ".svg": True,
    ".txt": True,
}
CSP = (
    "default-src 'self'; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' data: https://fonts.gstatic.com; "
    "script-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self' https: http://127.0.0.1:17322; "
    "object-src 'none'; "
    "base-uri 'none'; "
    "form-action 'none'; "
    "frame-ancestors 'none'"
)


def load_resource(path, route, index=False):
    with open(path, "rb") as handle:
        raw = handle.read()
    extension = os.path.splitext(path)[1].lower()
    compressible = COMPRESSIBLE.get(extension, False)
    content_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    if extension == ".js":
        content_type = "application/javascript; charset=utf-8"
    elif extension == ".css":
        content_type = "text/css; charset=utf-8"
    elif extension == ".html":
        content_type = "text/html; charset=utf-8"
    elif extension == ".webp":
        content_type = "image/webp"
    cache = "no-cache" if index else "public, max-age=31536000, immutable"
    return {
        "raw": raw,
        "gzip": gzip.compress(raw, compresslevel=9, mtime=0) if compressible else raw,
        "etag": '"' + hashlib.sha256(raw).hexdigest() + '"',
        "mtime": int(os.path.getmtime(path)),
        "content_type": content_type,
        "cache_control": cache,
        "compressible": compressible,
    }


def load_dist():
    if not os.path.isfile(INDEX_PATH):
        raise SystemExit("dist/index.html not found; run `npm run build` first")
    index = load_resource(INDEX_PATH, "/", index=True)
    resources = {}
    for base, _dirs, files in os.walk(DIST):
        for name in files:
            path = os.path.join(base, name)
            relative = os.path.relpath(path, DIST).replace(os.sep, "/")
            if relative == "index.html":
                continue
            resources["/" + relative] = load_resource(path, "/" + relative)
    return index, resources


class GameServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 128

    def __init__(self, address, handler):
        super().__init__(address, handler)
        self.index, self.resources = load_dist()


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
        return self.server.resources.get(path)

    def _is_api(self):
        return urlsplit(self.path).path.startswith(API_PREFIX)

    def _proxy(self, head_only=False):
        path = urlsplit(self.path).path
        target = path[len("/api"):] or "/"
        length = int(self.headers.get("Content-Length") or 0)
        if length > MAX_PROXY_BODY:
            self.send_error(413, "Payload too large")
            return
        body = self.rfile.read(length) if length else None
        headers = {}
        for name in ("Authorization", "Content-Type", "Accept"):
            value = self.headers.get(name)
            if value:
                headers[name] = value
        if body is not None:
            headers["Content-Length"] = str(len(body))

        try:
            connection = http.client.HTTPConnection(API_HOST, API_PORT, timeout=10)
            connection.request(self.command, target, body=body, headers=headers)
            response = connection.getresponse()
            data = response.read()
            status = response.status
            content_type = response.getheader("Content-Type", "application/json")
            connection.close()
        except OSError:
            data = json.dumps({"error": "cloud_offline", "message": "sync service unavailable"}).encode()
            status = 502
            content_type = "application/json; charset=utf-8"

        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self._security_headers()
        self.end_headers()
        self.close_connection = True
        if not head_only:
            self.wfile.write(data)

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

    def do_OPTIONS(self):
        if self._is_api():
            self._proxy()
            return
        self.send_response(204)
        self.send_header("Allow", "GET, HEAD, OPTIONS")
        self._security_headers()
        self.end_headers()

    def do_GET(self):
        if self._is_api():
            self._proxy()
            return
        self._serve_resource()

    def do_HEAD(self):
        if self._is_api():
            self._proxy(head_only=True)
            return
        self._serve_resource(head_only=True)

    def do_POST(self):
        if self._is_api():
            self._proxy()
            return
        self.send_error(405, "Method not allowed")

    def do_PUT(self):
        if self._is_api():
            self._proxy()
            return
        self.send_error(405, "Method not allowed")

    def do_DELETE(self):
        if self._is_api():
            self._proxy()
            return
        self.send_error(405, "Method not allowed")

    def log_message(self, format_string, *args):
        print(
            f"{self.address_string()} - - [{self.log_date_time_string()}] "
            f"{format_string % args}",
            flush=True,
        )


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 17321
    bind = sys.argv[2] if len(sys.argv) > 2 else "127.0.0.1"
    server = GameServer((bind, port), GameHandler)
    print(
        f"Moss Post Office listening on http://{bind}:{port} "
        f"({len(server.index['raw'])} bytes index, {len(server.resources)} assets)",
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
