from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from settings import ROOT_DIR, append_history, load_history, load_settings, public_settings, save_settings
from tools import JarvisTools

WEB_DIR = ROOT_DIR / "web"

app = FastAPI(title="Jarvis Zero Local")
app.mount("/static", StaticFiles(directory=WEB_DIR), name="static")


class SettingsPayload(BaseModel):
    gemini_api_key: str | None = None
    model: str | None = None
    user_name: str | None = None
    temperature: float | None = None
    voice_enabled: bool | None = None
    voice_lang: str | None = None
    voice_rate: float | None = None
    allow_destructive_tools: bool | None = None
    allow_terminal: bool | None = None


class ChatPayload(BaseModel):
    message: str


SYSTEM_PROMPT = """
Você é Jarvis, uma assistente pessoal em português do Brasil.
Você é direta, confiante, útil e opera ferramentas locais quando isso ajuda.

Responda sempre e somente em JSON válido neste formato:
{
  "reply": "texto que o usuário deve ouvir",
  "actions": [
    {"tool": "nome_da_ferramenta", "args": {"campo": "valor"}}
  ]
}

Ferramentas disponíveis:
- search_web(query)
- youtube_search(query)
- open_url(url)
- open_app(name)
- close_app(process)
- create_folder(path)
- open_folder(path)
- list_folder(path)
- find_and_open_file(name)
- delete_item(path)
- copy_item(source, destination)
- move_item(source, destination)
- rename_item(path, new_name)
- zip_folder(path)
- set_volume(level)
- set_brightness(level)
- lock_pc()
- run_terminal(command)

Regras:
- Use actions quando o usuário pedir uma ação real.
- Para perguntas comuns, use actions vazio.
- Não invente resultado de ferramenta. Se usar action, diga que vai executar.
- Prefira paths simples como "desktop/Projetos" ou "downloads".
- Não use markdown fora do JSON.
"""


@app.get("/")
async def index():
    return FileResponse(WEB_DIR / "index.html")


@app.get("/api/health")
async def health():
    return {"ok": True, "time": datetime.now().isoformat(timespec="seconds")}


@app.get("/api/settings")
async def get_settings():
    return public_settings()


@app.post("/api/settings")
async def post_settings(payload: SettingsPayload):
    return save_settings(payload.model_dump(exclude_none=True))


@app.post("/api/chat")
async def chat(payload: ChatPayload):
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Mensagem vazia.")

    settings = load_settings()
    api_key = str(settings.get("gemini_api_key", "")).strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="Configure a chave GEMINI_API_KEY primeiro.")

    model_response = await ask_gemini(settings, message)
    reply = str(model_response.get("reply") or "Entendido.")
    actions = model_response.get("actions") or []
    if not isinstance(actions, list):
        actions = []

    tools = JarvisTools(
        allow_destructive=bool(settings.get("allow_destructive_tools")),
        allow_terminal=bool(settings.get("allow_terminal")),
    )
    tool_results = []
    for action in actions[:5]:
        if not isinstance(action, dict):
            continue
        tool_name = str(action.get("tool") or "").strip()
        args = action.get("args") or {}
        if not isinstance(args, dict):
            args = {}
        result = tools.run(tool_name, args)
        tool_results.append(result.__dict__)

    if tool_results:
        summary = "; ".join(result["message"] for result in tool_results)
        reply = f"{reply}\n\nResultado: {summary}"

    append_history(message, reply)
    return {"reply": reply, "actions": actions, "tool_results": tool_results}


async def ask_gemini(settings: dict[str, Any], message: str) -> dict[str, Any]:
    try:
        from google import genai
        from google.genai import types
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"SDK do Gemini não instalado: {exc}") from exc

    history = load_history()
    context = "\n".join(
        f"{item['role']}: {item['content']}" for item in history[-12:] if item.get("content")
    )
    now = datetime.now().strftime("%d/%m/%Y %H:%M")
    user_name = settings.get("user_name") or "Chefe"
    prompt = (
        f"Data/hora local: {now}\n"
        f"Usuário: {user_name}\n"
        f"Histórico recente:\n{context or '(sem histórico)'}\n\n"
        f"Pedido atual: {message}"
    )

    client = genai.Client(api_key=str(settings["gemini_api_key"]).strip())
    response = client.models.generate_content(
        model=str(settings.get("model") or "gemini-2.5-flash"),
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            temperature=float(settings.get("temperature") or 0.6),
            response_mime_type="application/json",
        ),
    )

    text = getattr(response, "text", None) or ""
    return parse_json_response(text)


def parse_json_response(text: str) -> dict[str, Any]:
    text = text.strip()
    if not text:
        return {"reply": "Não recebi resposta do modelo.", "actions": []}
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if not match:
            return {"reply": text, "actions": []}
        data = json.loads(match.group(0))

    if not isinstance(data, dict):
        return {"reply": str(data), "actions": []}
    data.setdefault("reply", "Entendido.")
    data.setdefault("actions", [])
    return data
