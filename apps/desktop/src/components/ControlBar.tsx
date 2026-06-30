import {
  Camera,
  CameraOff,
  MessageSquareText,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  Pin,
  Power,
  Settings,
} from "lucide-react";

interface ControlBarProps {
  muted: boolean;
  cameraOn: boolean;
  screenOn: boolean;
  chatOpen: boolean;
  settingsOpen: boolean;
  locked: boolean;
  onToggleMuted: () => void;
  onToggleCamera: () => void;
  onToggleScreen: () => void;
  onToggleChat: () => void;
  onToggleSettings: () => void;
  onToggleLocked: () => void;
  onSuspend: () => void;
}

export function ControlBar({
  muted,
  cameraOn,
  screenOn,
  chatOpen,
  settingsOpen,
  locked,
  onToggleMuted,
  onToggleCamera,
  onToggleScreen,
  onToggleChat,
  onToggleSettings,
  onToggleLocked,
  onSuspend,
}: ControlBarProps) {
  return (
    <div className="control-bar" aria-label="Controles do Omni">
      <button className={`pin-button ${locked ? "is-active" : ""}`} title="Fixar barra" type="button" onClick={onToggleLocked}>
        <Pin size={16} />
      </button>

      <button className={`orb-button ${!muted ? "is-active" : ""}`} title={muted ? "Desmutar" : "Mutar"} type="button" onClick={onToggleMuted}>
        {muted ? <MicOff /> : <Mic />}
      </button>

      <button className={`orb-button ${cameraOn ? "is-active" : ""}`} title="Camera" type="button" onClick={onToggleCamera}>
        {cameraOn ? <Camera /> : <CameraOff />}
      </button>

      <button className={`orb-button ${screenOn ? "is-active" : ""}`} title="Compartilhar tela" type="button" onClick={onToggleScreen}>
        {screenOn ? <MonitorUp /> : <MonitorX />}
      </button>

      <button className={`orb-button ${chatOpen ? "is-active" : ""}`} title="Mensagem" type="button" onClick={onToggleChat}>
        <MessageSquareText />
      </button>

      <span className="bar-line" />

      <button className={`orb-button ${settingsOpen ? "is-active" : ""}`} title="Configuracoes" type="button" onClick={onToggleSettings}>
        <Settings />
      </button>

      <button className="orb-button is-danger" title="Suspender" type="button" onClick={onSuspend}>
        <Power />
      </button>
    </div>
  );
}

