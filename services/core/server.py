from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOST = "127.0.0.1"
PORT = int(os.environ.get("OMNI_CORE_PORT", "8765"))
DATA_DIR = Path(os.environ.get("OMNI_DATA_DIR", "services/core/.data"))
SETTINGS_FILE = DATA_DIR / "settings.json"
LOG_FILE = DATA_DIR / "events.json"

DEFAULT_SETTINGS: dict[str, Any] = {
    "assistantName": "Omni",
    "language": "pt-BR",
    "coreMode": "local",
    "provider": "openai",
    "model": "gpt-4.1",
    "apiKeyConfigured": False,
    "voiceProvider": "windows",
    "sttProvider": "browser",
    "memoryEnabled": True,
    "browserAutomation": True,
    "visionEnabled": True,
    "permissions": {
        "filesystem.read": "always",
        "filesystem.write": "ask",
        "filesystem.delete": "ask",
        "terminal.run": "blocked",
        "browser.automate": "ask",
        "screen.capture": "ask",
        "system.power": "blocked",
    },
}


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def read_json(path: Path, fallback: Any) -> Any:
    ensure_data_dir()
    if not path.exists():
        return fallback
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return fallback


def write_json(path: Path, payload: Any) -> None:
    ensure_data_dir()
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")


def event(title: str, detail: str, level: str = "info") -> dict[str, str]:
    return {
        "id": str(uuid.uuid4()),
        "level": level,
        "title": title,
        "detail": detail,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def append_events(items: list[dict[str, str]]) -> None:
    current = read_json(LOG_FILE, [])
    write_json(LOG_FILE, [*items, *current][:300])


def classify_message(message: str) -> tuple[str, str]:
    lower = message.lower()
    destructive_words = ["delet", "apaga", "exclu", "limpa", "shutdown", "desliga", "format"]
    browser_words = ["site", "youtube", "google", "pesquisa", "navegador", "abre"]

    if any(word in lower for word in destructive_words):
        return "waiting_confirmation", "Detectei uma acao sensivel. O Guard precisa confirmar antes de qualquer execucao."
    if any(word in lower for word in browser_words):
        return "waiting_confirmation", "Posso preparar uma acao de navegador, mas a ferramenta real ainda passara pelo Guard."
    return "completed", "Objetivo recebido. Nesta fase eu valido fluxo, estado e configuracao local."


class Handler(BaseHTTPRequestHandler):
    server_version = "OmniCore/0.1"

    def _headers(self, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _json(self, payload: Any, status: int = 200) -> None:
        self._headers(status)
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    def _body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0"))
        if length == 0:
            return {}
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_OPTIONS(self) -> None:
        self._headers(204)

    def do_GET(self) -> None:
        if self.path == "/health":
            self._json({"status": "ok", "service": "omni-core", "version": "0.1.0"})
            return
        if self.path == "/settings":
            self._json(read_json(SETTINGS_FILE, DEFAULT_SETTINGS))
            return
        if self.path == "/events":
            self._json(read_json(LOG_FILE, []))
            return
        self._json({"error": "not found"}, 404)

    def do_POST(self) -> None:
        try:
            if self.path == "/settings":
                settings = self._body()
                merged = {**DEFAULT_SETTINGS, **settings}
                write_json(SETTINGS_FILE, merged)
                items = [event("Configuracoes salvas", "Perfil plug and play atualizado no Omni Core.", "success")]
                append_events(items)
                self._json(merged)
                return

            if self.path == "/message":
                body = self._body()
                message = str(body.get("message", "")).strip()
                if not message:
                    self._json({"error": "message is required"}, 400)
                    return

                state, reply = classify_message(message)
                items = [
                    event("Objetivo analisado", message, "info"),
                    event("Guard ativo", "Nenhuma ferramenta de sistema foi executada sem permissao.", "success"),
                ]
                append_events(items)
                self._json(
                    {
                        "id": str(uuid.uuid4()),
                        "state": state,
                        "reply": reply,
                        "events": items,
                    }
                )
                return

            self._json({"error": "not found"}, 404)
        except json.JSONDecodeError:
            self._json({"error": "invalid json"}, 400)
        except Exception as exc:
            self._json({"error": str(exc)}, 500)

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"[omni-core] {self.address_string()} - {fmt % args}")


def main() -> None:
    ensure_data_dir()
    if not SETTINGS_FILE.exists():
        write_json(SETTINGS_FILE, DEFAULT_SETTINGS)

    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"[omni-core] running at http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[omni-core] stopping")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

