#!/usr/bin/env python3
"""NovaReader dev/release server.

Serves static files and provides a minimal workspace cloud API:
- PUT /api/workspace  (JSON workspace payload)
- GET /api/workspace  (last saved JSON payload)
- GET /api/health     (release/runtime health info)

Root path `/` redirects to `/app/` for one-click startup UX.
"""

from __future__ import annotations

import json
import os
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = os.environ.get("NOVAREADER_HOST", "0.0.0.0")
PORT = int(os.environ.get("NOVAREADER_PORT", "4173"))
ROOT = Path(__file__).resolve().parent
CLOUD_DIR = ROOT / ".novareader-cloud"
CLOUD_FILE = CLOUD_DIR / "workspace.json"
MAX_WORKSPACE_BYTES = int(os.environ.get("NOVAREADER_MAX_WORKSPACE_BYTES", str(5 * 1024 * 1024)))


class NovaReaderHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def _path(self) -> str:
        return urlparse(self.path).path

    def _is_workspace_api(self) -> bool:
        return self._path() == "/api/workspace"

    def _is_health_api(self) -> bool:
        return self._path() == "/api/health"

    def _json_response(self, payload: dict, status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        if self._is_workspace_api() or self._is_health_api():
            self.send_response(HTTPStatus.NO_CONTENT)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, PUT, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()
            return
        super().do_OPTIONS()

    def do_GET(self):
        if self._path() == "/":
            self.send_response(HTTPStatus.FOUND)
            self.send_header("Location", "/app/")
            self.end_headers()
            return

        if self._is_health_api():
            self._json_response({
                "ok": True,
                "app_url": "/app/",
                "workspace_api": "/api/workspace",
                "workspace_exists": CLOUD_FILE.exists(),
                "max_workspace_bytes": MAX_WORKSPACE_BYTES,
            }, status=200)
            return

        if self._is_workspace_api():
            if not CLOUD_FILE.exists():
                self._json_response({"error": "workspace not found"}, status=404)
                return
            try:
                payload = json.loads(CLOUD_FILE.read_text(encoding="utf-8"))
            except Exception:
                self._json_response({"error": "workspace is corrupted"}, status=500)
                return
            self._json_response(payload, status=200)
            return
        super().do_GET()

    def do_PUT(self):
        if not self._is_workspace_api():
            self._json_response({"error": "unknown endpoint"}, status=404)
            return

        length_raw = self.headers.get("Content-Length")
        try:
            length = int(length_raw or "0")
        except ValueError:
            self._json_response({"error": "invalid content length"}, status=400)
            return

        if length <= 0:
            self._json_response({"error": "empty body"}, status=400)
            return

        if length > MAX_WORKSPACE_BYTES:
            self._json_response({"error": "payload too large", "max_bytes": MAX_WORKSPACE_BYTES}, status=413)
            return

        try:
            raw = self.rfile.read(length)
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            self._json_response({"error": "invalid json"}, status=400)
            return

        if not isinstance(payload, dict):
            self._json_response({"error": "payload must be object"}, status=400)
            return

        CLOUD_DIR.mkdir(parents=True, exist_ok=True)
        CLOUD_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        self._json_response({"ok": True, "saved": str(CLOUD_FILE.relative_to(ROOT))}, status=200)


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), NovaReaderHandler)
    print(f"NovaReader server running on http://{HOST}:{PORT}/app/")
    print("Workspace cloud endpoint: /api/workspace (PUT/GET)")
    print("Health endpoint: /api/health")
    server.serve_forever()


if __name__ == "__main__":
    main()
