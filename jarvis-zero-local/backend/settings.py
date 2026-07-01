from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT_DIR / "data"
SETTINGS_PATH = DATA_DIR / "settings.json"
HISTORY_PATH = DATA_DIR / "history.json"

DEFAULT_SETTINGS: dict[str, Any] = {
    "gemini_api_key": "",
    "model": "gemini-2.5-flash",
    "user_name": "Chefe",
    "temperature": 0.6,
    "voice_enabled": True,
    "voice_lang": "pt-BR",
    "voice_rate": 1.0,
    "allow_destructive_tools": False,
    "allow_terminal": False,
}


def _read_json(path: Path, fallback: Any) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception:
        return fallback


def _write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def load_settings() -> dict[str, Any]:
    saved = _read_json(SETTINGS_PATH, {})
    settings = {**DEFAULT_SETTINGS, **saved}
    try:
        settings["temperature"] = max(0, min(2, float(settings["temperature"])))
    except Exception:
        settings["temperature"] = DEFAULT_SETTINGS["temperature"]
    try:
        settings["voice_rate"] = max(0.6, min(1.6, float(settings["voice_rate"])))
    except Exception:
        settings["voice_rate"] = DEFAULT_SETTINGS["voice_rate"]
    return settings


def public_settings() -> dict[str, Any]:
    settings = load_settings()
    has_key = bool(str(settings.get("gemini_api_key", "")).strip())
    settings["gemini_api_key"] = ""
    settings["gemini_api_key_set"] = has_key
    return settings


def save_settings(incoming: dict[str, Any]) -> dict[str, Any]:
    current = load_settings()
    next_settings = {**current}

    for key in DEFAULT_SETTINGS:
        if key not in incoming:
            continue
        value = incoming[key]
        if key == "gemini_api_key" and not str(value or "").strip():
            continue
        next_settings[key] = value

    _write_json(SETTINGS_PATH, next_settings)
    return public_settings()


def load_history() -> list[dict[str, str]]:
    history = _read_json(HISTORY_PATH, [])
    if not isinstance(history, list):
        return []
    clean: list[dict[str, str]] = []
    for item in history[-40:]:
        if isinstance(item, dict) and item.get("role") in {"user", "assistant"}:
            clean.append({"role": str(item["role"]), "content": str(item.get("content", ""))})
    return clean


def append_history(user_message: str, assistant_message: str) -> None:
    history = load_history()
    history.append({"role": "user", "content": user_message})
    history.append({"role": "assistant", "content": assistant_message})
    _write_json(HISTORY_PATH, history[-40:])
