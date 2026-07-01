from __future__ import annotations

import os
import shutil
import subprocess
import webbrowser
import zipfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote_plus


@dataclass
class ToolResult:
    tool: str
    ok: bool
    message: str


class JarvisTools:
    def __init__(self, allow_destructive: bool = False, allow_terminal: bool = False) -> None:
        self.allow_destructive = allow_destructive
        self.allow_terminal = allow_terminal
        self.home = Path.home()
        self.desktop = self.home / "Desktop"
        self.documents = self.home / "Documents"
        self.downloads = self.home / "Downloads"
        self.aliases = {
            "desktop": self.desktop,
            "area de trabalho": self.desktop,
            "área de trabalho": self.desktop,
            "documentos": self.documents,
            "documents": self.documents,
            "downloads": self.downloads,
        }
        self.ignored_dirs = {"node_modules", ".git", ".venv", "venv", "__pycache__", ".next"}

    def run(self, tool: str, args: dict) -> ToolResult:
        try:
            method = getattr(self, f"tool_{tool}", None)
            if not method:
                return ToolResult(tool, False, f"Ferramenta desconhecida: {tool}")
            return method(**args)
        except TypeError as exc:
            return ToolResult(tool, False, f"Argumentos inválidos para {tool}: {exc}")
        except Exception as exc:
            return ToolResult(tool, False, f"Erro em {tool}: {exc}")

    def _resolve_path(self, raw: str | None) -> Path:
        value = (raw or "").strip().strip("\"'").replace("\\", "/")
        if not value:
            return self.desktop
        lower = value.lower()
        for alias, target in self.aliases.items():
            if lower == alias:
                return target
            if lower.startswith(alias + "/"):
                return (target / value[len(alias) + 1 :]).resolve()
        path = Path(value).expanduser()
        if not path.is_absolute():
            path = self.desktop / path
        return path.resolve()

    def _safe_walk(self, base: Path):
        for root, dirs, files in os.walk(base):
            dirs[:] = [d for d in dirs if d not in self.ignored_dirs and not d.startswith(".")]
            yield Path(root), dirs, files

    def _block_destructive(self, tool: str) -> ToolResult | None:
        if self.allow_destructive:
            return None
        return ToolResult(
            tool,
            False,
            "Bloqueado: ative 'ferramentas destrutivas' nas configurações para apagar, mover, renomear, fechar programas ou mexer em energia.",
        )

    def tool_search_web(self, query: str) -> ToolResult:
        url = f"https://www.google.com/search?q={quote_plus(query)}"
        webbrowser.open(url)
        return ToolResult("search_web", True, f"Pesquisa aberta: {query}")

    def tool_youtube_search(self, query: str) -> ToolResult:
        url = f"https://www.youtube.com/results?search_query={quote_plus(query)}"
        webbrowser.open(url)
        return ToolResult("youtube_search", True, f"Busca do YouTube aberta: {query}")

    def tool_open_url(self, url: str) -> ToolResult:
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        webbrowser.open(url)
        return ToolResult("open_url", True, f"URL aberta: {url}")

    def tool_open_app(self, name: str) -> ToolResult:
        apps = {
            "calculadora": "calc.exe",
            "calculator": "calc.exe",
            "bloco de notas": "notepad.exe",
            "notepad": "notepad.exe",
            "paint": "mspaint.exe",
            "explorador": "explorer.exe",
            "explorador de arquivos": "explorer.exe",
            "cmd": "cmd.exe",
        }
        command = apps.get(name.lower().strip(), name)
        subprocess.Popen(command, shell=True)
        return ToolResult("open_app", True, f"Abrindo: {name}")

    def tool_close_app(self, process: str) -> ToolResult:
        blocked = self._block_destructive("close_app")
        if blocked:
            return blocked
        exe = process if process.lower().endswith(".exe") else f"{process}.exe"
        result = subprocess.run(["taskkill", "/f", "/im", exe], capture_output=True, text=True)
        return ToolResult("close_app", result.returncode == 0, result.stdout.strip() or result.stderr.strip())

    def tool_create_folder(self, path: str) -> ToolResult:
        resolved = self._resolve_path(path)
        resolved.mkdir(parents=True, exist_ok=True)
        return ToolResult("create_folder", True, f"Pasta criada: {resolved}")

    def tool_open_folder(self, path: str) -> ToolResult:
        resolved = self._resolve_path(path)
        if not resolved.exists():
            return ToolResult("open_folder", False, f"Pasta não encontrada: {resolved}")
        os.startfile(resolved)
        return ToolResult("open_folder", True, f"Pasta aberta: {resolved}")

    def tool_list_folder(self, path: str = "desktop") -> ToolResult:
        resolved = self._resolve_path(path)
        if not resolved.exists():
            return ToolResult("list_folder", False, f"Pasta não encontrada: {resolved}")
        items = [p.name for p in sorted(resolved.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))[:80]]
        return ToolResult("list_folder", True, "\n".join(items) or "Pasta vazia.")

    def tool_find_and_open_file(self, name: str) -> ToolResult:
        needle = name.lower().strip()
        for base in [self.desktop, self.documents, self.downloads]:
            if not base.exists():
                continue
            for root, _, files in self._safe_walk(base):
                for filename in files:
                    if needle in filename.lower():
                        full_path = root / filename
                        os.startfile(full_path)
                        return ToolResult("find_and_open_file", True, f"Arquivo aberto: {full_path}")
        return ToolResult("find_and_open_file", False, f"Arquivo não encontrado: {name}")

    def tool_delete_item(self, path: str) -> ToolResult:
        blocked = self._block_destructive("delete_item")
        if blocked:
            return blocked
        resolved = self._resolve_path(path)
        if not resolved.exists():
            return ToolResult("delete_item", False, f"Não encontrado: {resolved}")
        if resolved.is_dir():
            shutil.rmtree(resolved)
        else:
            resolved.unlink()
        return ToolResult("delete_item", True, f"Removido: {resolved}")

    def tool_copy_item(self, source: str, destination: str) -> ToolResult:
        source_path = self._resolve_path(source)
        destination_path = self._resolve_path(destination)
        if source_path.is_dir():
            shutil.copytree(source_path, destination_path, dirs_exist_ok=True)
        else:
            destination_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source_path, destination_path)
        return ToolResult("copy_item", True, f"Copiado para: {destination_path}")

    def tool_move_item(self, source: str, destination: str) -> ToolResult:
        blocked = self._block_destructive("move_item")
        if blocked:
            return blocked
        source_path = self._resolve_path(source)
        destination_path = self._resolve_path(destination)
        destination_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source_path), str(destination_path))
        return ToolResult("move_item", True, f"Movido para: {destination_path}")

    def tool_rename_item(self, path: str, new_name: str) -> ToolResult:
        blocked = self._block_destructive("rename_item")
        if blocked:
            return blocked
        resolved = self._resolve_path(path)
        target = resolved.with_name(new_name)
        resolved.rename(target)
        return ToolResult("rename_item", True, f"Renomeado para: {target}")

    def tool_zip_folder(self, path: str) -> ToolResult:
        resolved = self._resolve_path(path)
        if not resolved.is_dir():
            return ToolResult("zip_folder", False, f"Pasta não encontrada: {resolved}")
        zip_path = resolved.with_suffix(".zip")
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for item in resolved.rglob("*"):
                if item.is_file():
                    zip_file.write(item, item.relative_to(resolved))
        return ToolResult("zip_folder", True, f"ZIP criado: {zip_path}")

    def tool_set_volume(self, level: int) -> ToolResult:
        try:
            from ctypes import POINTER, cast
            from comtypes import CLSCTX_ALL
            from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume

            level = max(0, min(100, int(level)))
            devices = AudioUtilities.GetSpeakers()
            interface = devices.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
            volume = cast(interface, POINTER(IAudioEndpointVolume))
            volume.SetMasterVolumeLevelScalar(level / 100, None)
            return ToolResult("set_volume", True, f"Volume ajustado para {level}%.")
        except Exception as exc:
            return ToolResult("set_volume", False, f"Não consegui ajustar volume: {exc}")

    def tool_set_brightness(self, level: int) -> ToolResult:
        try:
            import screen_brightness_control as sbc

            level = max(0, min(100, int(level)))
            sbc.set_brightness(level)
            return ToolResult("set_brightness", True, f"Brilho ajustado para {level}%.")
        except Exception as exc:
            return ToolResult("set_brightness", False, f"Não consegui ajustar brilho: {exc}")

    def tool_lock_pc(self) -> ToolResult:
        blocked = self._block_destructive("lock_pc")
        if blocked:
            return blocked
        subprocess.run(["rundll32.exe", "user32.dll,LockWorkStation"], check=False)
        return ToolResult("lock_pc", True, "Computador bloqueado.")

    def tool_run_terminal(self, command: str) -> ToolResult:
        if not self.allow_terminal:
            return ToolResult("run_terminal", False, "Terminal bloqueado. Ative nas configurações.")
        result = subprocess.run(command, shell=True, capture_output=True, text=True, timeout=20)
        output = (result.stdout + "\n" + result.stderr).strip()
        return ToolResult("run_terminal", result.returncode == 0, output[-4000:] or "Sem saída.")
