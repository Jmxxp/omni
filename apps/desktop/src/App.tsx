import { useEffect, useMemo, useState } from "react";
import { ArrowUp, Loader2, ShieldAlert } from "lucide-react";
import { api } from "./lib/api";
import type { AgentState, Settings, TimelineEvent } from "./lib/types";
import { ConfigPanel } from "./components/ConfigPanel";
import { ControlBar } from "./components/ControlBar";
import { MediaTile } from "./components/MediaTile";
import { VantaOrb } from "./components/VantaOrb";

const defaultSettings: Settings = {
  assistantName: "Omni",
  language: "pt-BR",
  coreMode: "local",
  provider: "openai",
  model: "gpt-4.1",
  apiKeyConfigured: false,
  voiceProvider: "windows",
  sttProvider: "browser",
  memoryEnabled: true,
  browserAutomation: true,
  visionEnabled: true,
  permissions: {
    "filesystem.read": "always",
    "filesystem.write": "ask",
    "filesystem.delete": "ask",
    "terminal.run": "blocked",
    "browser.automate": "ask",
    "screen.capture": "ask",
    "system.power": "blocked",
  },
};

function makeEvent(title: string, detail: string, level: TimelineEvent["level"] = "info"): TimelineEvent {
  return {
    id: crypto.randomUUID(),
    title,
    detail,
    level,
    timestamp: new Date().toISOString(),
  };
}

function stopStream(stream?: MediaStream) {
  stream?.getTracks().forEach((track) => track.stop());
}

export function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [coreOnline, setCoreOnline] = useState(false);
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [micStream, setMicStream] = useState<MediaStream>();
  const [cameraStream, setCameraStream] = useState<MediaStream>();
  const [screenStream, setScreenStream] = useState<MediaStream>();
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [barLocked, setBarLocked] = useState(false);
  const [barVisible, setBarVisible] = useState(true);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [events, setEvents] = useState<TimelineEvent[]>([
    makeEvent("Interface pronta", "Visual Jarvis preservado, runtime Omni plug and play iniciado.", "success"),
  ]);

  const muted = !micStream;

  const stateLabel = useMemo(() => {
    const labels: Record<AgentState, string> = {
      idle: "Pronto",
      listening: "Ouvindo",
      thinking: "Pensando",
      planning: "Planejando",
      waiting_confirmation: "Aguardando confirmacao",
      executing: "Executando",
      observing: "Observando",
      speaking: "Falando",
      completed: "Concluido",
      error: "Erro",
    };
    return labels[agentState];
  }, [agentState]);

  useEffect(() => {
    let active = true;

    async function boot() {
      try {
        await api.health();
        const loaded = await api.settings();
        if (!active) return;
        setSettings(loaded);
        setCoreOnline(true);
        setEvents((current) => [makeEvent("Core conectado", "Omni Core local respondeu na porta 8765.", "success"), ...current]);
      } catch (error) {
        if (!active) return;
        setCoreOnline(false);
        setEvents((current) => [
          makeEvent("Core offline", error instanceof Error ? error.message : "Nao foi possivel conectar ao backend.", "warning"),
          ...current,
        ]);
      }
    }

    boot();

    return () => {
      active = false;
      stopStream(micStream);
      stopStream(cameraStream);
      stopStream(screenStream);
    };
    // Cleanup intentionally runs with initial streams only; toggles stop their own streams.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (barLocked || chatOpen || settingsOpen) {
      setBarVisible(true);
      return;
    }

    let timer = window.setTimeout(() => setBarVisible(false), 2600);

    const onMove = () => {
      setBarVisible(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setBarVisible(false), 2600);
    };

    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.clearTimeout(timer);
    };
  }, [barLocked, chatOpen, settingsOpen]);

  useEffect(() => {
    if (micStream) {
      setAgentState("listening");
    } else if (agentState === "listening") {
      setAgentState("idle");
    }
  }, [micStream, agentState]);

  async function toggleMic() {
    if (micStream) {
      stopStream(micStream);
      setMicStream(undefined);
      setEvents((current) => [makeEvent("Microfone mutado", "Captura local de audio encerrada.", "info"), ...current]);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicStream(stream);
      setEvents((current) => [makeEvent("Microfone ativo", "Permissao de audio concedida pelo sistema.", "success"), ...current]);
    } catch (error) {
      setAgentState("error");
      setEvents((current) => [
        makeEvent("Falha no microfone", error instanceof Error ? error.message : "Permissao negada.", "error"),
        ...current,
      ]);
    }
  }

  async function toggleCamera() {
    if (cameraStream) {
      stopStream(cameraStream);
      setCameraStream(undefined);
      setEvents((current) => [makeEvent("Camera desligada", "Captura de video encerrada.", "info"), ...current]);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setCameraStream(stream);
      setEvents((current) => [makeEvent("Camera ativa", "Preview local habilitado.", "success"), ...current]);
    } catch (error) {
      setEvents((current) => [makeEvent("Falha na camera", error instanceof Error ? error.message : "Permissao negada.", "error"), ...current]);
    }
  }

  async function toggleScreen() {
    if (screenStream) {
      stopStream(screenStream);
      setScreenStream(undefined);
      setEvents((current) => [makeEvent("Tela encerrada", "Compartilhamento local parado.", "info"), ...current]);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      stream.getVideoTracks()[0]?.addEventListener("ended", () => setScreenStream(undefined));
      setScreenStream(stream);
      setEvents((current) => [makeEvent("Tela compartilhada", "Observer podera usar esta fonte quando o Guard liberar.", "success"), ...current]);
    } catch (error) {
      setEvents((current) => [makeEvent("Falha ao compartilhar", error instanceof Error ? error.message : "Permissao negada.", "error"), ...current]);
    }
  }

  async function sendMessage() {
    const text = message.trim();
    if (!text) return;

    setMessage("");
    setAgentState("planning");
    setEvents((current) => [makeEvent("Mensagem enviada", text, "info"), ...current]);

    try {
      const result = await api.sendMessage(text);
      setAgentState(result.state);
      setEvents((current) => [...result.events, makeEvent("Omni", result.reply, "success"), ...current]);
    } catch (error) {
      setAgentState("error");
      setEvents((current) => [
        makeEvent("Erro no Core", error instanceof Error ? error.message : "Falha desconhecida.", "error"),
        ...current,
      ]);
    }
  }

  async function saveSettings(next: Settings) {
    setSaving(true);
    try {
      const saved = await api.saveSettings(next);
      setSettings(saved);
      setCoreOnline(true);
      setEvents((current) => [makeEvent("Configuracoes salvas", "Perfil local atualizado no Omni Core.", "success"), ...current]);
    } catch (error) {
      setSettings(next);
      setEvents((current) => [
        makeEvent("Config local aplicada", error instanceof Error ? `Core offline: ${error.message}` : "Core offline.", "warning"),
        ...current,
      ]);
    } finally {
      setSaving(false);
    }
  }

  function suspend() {
    stopStream(micStream);
    stopStream(cameraStream);
    stopStream(screenStream);
    setMicStream(undefined);
    setCameraStream(undefined);
    setScreenStream(undefined);
    setAgentState("idle");
    setEvents((current) => [makeEvent("Sessao suspensa", "Midias desligadas e Omni em espera.", "warning"), ...current]);
  }

  return (
    <main className="omni-shell">
      <header className="topline">
        <div className="brand">
          <span className="brand-dot" />
          <strong>{settings.assistantName}</strong>
        </div>
        <div className="runtime-state">
          <span className={coreOnline ? "online-dot" : "offline-dot"} />
          {coreOnline ? "Plug and play ativo" : "Core offline"}
        </div>
      </header>

      <section className="center-stage">
        <VantaOrb state={agentState} muted={muted} />
      </section>

      <section className="media-stack">
        {cameraStream && <MediaTile title="Camera" stream={cameraStream} />}
        {screenStream && <MediaTile title="Tela" stream={screenStream} />}
      </section>

      <aside className="timeline">
        <div className="timeline-head">
          <span>{stateLabel}</span>
          <strong>Eventos</strong>
        </div>
        {events.slice(0, 7).map((event) => (
          <article className={`timeline-card ${event.level}`} key={event.id}>
            <span>{new Date(event.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
            <strong>{event.title}</strong>
            <p>{event.detail}</p>
          </article>
        ))}
      </aside>

      {chatOpen && (
        <form
          className="composer"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage();
          }}
        >
          <div className="guard-pill">
            <ShieldAlert size={15} />
            <span>Guard</span>
          </div>
          <input value={message} placeholder="Digite uma meta para o Omni" autoFocus onChange={(event) => setMessage(event.target.value)} />
          <button type="submit" disabled={!message.trim() || agentState === "planning"}>
            {agentState === "planning" ? <Loader2 className="spin" /> : <ArrowUp />}
          </button>
        </form>
      )}

      <div className={`dock ${barVisible ? "visible" : "hidden"}`}>
        <ControlBar
          muted={muted}
          cameraOn={!!cameraStream}
          screenOn={!!screenStream}
          chatOpen={chatOpen}
          settingsOpen={settingsOpen}
          locked={barLocked}
          onToggleMuted={toggleMic}
          onToggleCamera={toggleCamera}
          onToggleScreen={toggleScreen}
          onToggleChat={() => setChatOpen((value) => !value)}
          onToggleSettings={() => setSettingsOpen((value) => !value)}
          onToggleLocked={() => setBarLocked((value) => !value)}
          onSuspend={suspend}
        />
      </div>

      <ConfigPanel
        open={settingsOpen}
        settings={settings}
        saving={saving}
        coreOnline={coreOnline}
        onClose={() => setSettingsOpen(false)}
        onSave={saveSettings}
      />
    </main>
  );
}

