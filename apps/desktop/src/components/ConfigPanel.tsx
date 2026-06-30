import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import type { PermissionMode, Provider, Settings } from "../lib/types";
import { Bot, Database, Eye, Globe2, KeyRound, Mic2, Save, ShieldCheck, SlidersHorizontal, X } from "lucide-react";

interface ConfigPanelProps {
  open: boolean;
  settings: Settings;
  saving: boolean;
  coreOnline: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => Promise<void>;
}

type Tab = "general" | "ai" | "voice" | "memory" | "tools" | "permissions";

const tabs: Array<{ id: Tab; label: string; icon: ComponentType<{ size?: number }> }> = [
  { id: "general", label: "Geral", icon: SlidersHorizontal },
  { id: "ai", label: "IA", icon: Bot },
  { id: "voice", label: "Voz", icon: Mic2 },
  { id: "memory", label: "Memoria", icon: Database },
  { id: "tools", label: "Ferramentas", icon: Globe2 },
  { id: "permissions", label: "Permissoes", icon: ShieldCheck },
];

const permissionLabels: Record<PermissionMode, string> = {
  always: "Permitir",
  ask: "Perguntar",
  blocked: "Bloquear",
};

export function ConfigPanel({ open, settings, saving, coreOnline, onClose, onSave }: ConfigPanelProps) {
  const [tab, setTab] = useState<Tab>("general");
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    setDraft(settings);
  }, [settings, open]);

  if (!open) return null;

  const updatePermission = (key: string, value: PermissionMode) => {
    setDraft((current) => ({
      ...current,
      permissions: {
        ...current.permissions,
        [key]: value,
      },
    }));
  };

  return (
    <aside className="settings-panel">
      <div className="settings-card">
        <header className="settings-head">
          <div>
            <span>Omni plug and play</span>
            <h2>Configuracoes</h2>
          </div>
          <div className="settings-head-actions">
            <span className={`core-state ${coreOnline ? "online" : "offline"}`}>{coreOnline ? "Core online" : "Core offline"}</span>
            <button className="panel-icon" type="button" title="Fechar" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="settings-body">
          <nav className="settings-tabs">
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} className={tab === item.id ? "active" : ""} type="button" onClick={() => setTab(item.id)}>
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <section className="settings-content">
            {tab === "general" && (
              <div className="form-grid">
                <label>
                  <span>Nome</span>
                  <input value={draft.assistantName} onChange={(event) => setDraft({ ...draft, assistantName: event.target.value })} />
                </label>
                <label>
                  <span>Idioma</span>
                  <select value={draft.language} onChange={(event) => setDraft({ ...draft, language: event.target.value as Settings["language"] })}>
                    <option value="pt-BR">Portugues Brasil</option>
                    <option value="en-US">English US</option>
                  </select>
                </label>
                <label>
                  <span>Modo</span>
                  <select value={draft.coreMode} onChange={(event) => setDraft({ ...draft, coreMode: event.target.value as Settings["coreMode"] })}>
                    <option value="local">Local plug and play</option>
                    <option value="cloud">Cloud opcional</option>
                  </select>
                </label>
              </div>
            )}

            {tab === "ai" && (
              <div className="form-grid">
                <label>
                  <span>Provedor</span>
                  <select value={draft.provider} onChange={(event) => setDraft({ ...draft, provider: event.target.value as Provider })}>
                    <option value="openai">OpenAI</option>
                    <option value="google">Google Gemini</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="ollama">Ollama local</option>
                    <option value="custom">Custom</option>
                  </select>
                </label>
                <label>
                  <span>Modelo</span>
                  <input value={draft.model} onChange={(event) => setDraft({ ...draft, model: event.target.value })} />
                </label>
                <div className="secret-status">
                  <KeyRound size={18} />
                  <div>
                    <strong>{draft.apiKeyConfigured ? "API configurada" : "API pendente"}</strong>
                    <span>Na fase nativa, chaves ficam no Windows Credential Manager.</span>
                  </div>
                </div>
              </div>
            )}

            {tab === "voice" && (
              <div className="form-grid">
                <label>
                  <span>Transcricao</span>
                  <select value={draft.sttProvider} onChange={(event) => setDraft({ ...draft, sttProvider: event.target.value as Settings["sttProvider"] })}>
                    <option value="browser">Browser local</option>
                    <option value="openai">OpenAI Whisper</option>
                    <option value="deepgram">Deepgram</option>
                    <option value="google">Google</option>
                    <option value="local">Whisper local</option>
                  </select>
                </label>
                <label>
                  <span>Voz</span>
                  <select value={draft.voiceProvider} onChange={(event) => setDraft({ ...draft, voiceProvider: event.target.value as Settings["voiceProvider"] })}>
                    <option value="windows">Windows</option>
                    <option value="openai">OpenAI TTS</option>
                    <option value="elevenlabs">ElevenLabs</option>
                    <option value="google">Google</option>
                  </select>
                </label>
              </div>
            )}

            {tab === "memory" && (
              <div className="form-grid">
                <label className="toggle-field">
                  <span>Memoria local</span>
                  <input type="checkbox" checked={draft.memoryEnabled} onChange={(event) => setDraft({ ...draft, memoryEnabled: event.target.checked })} />
                </label>
                <div className="info-box">
                  <Database size={18} />
                  <span>SQLite local primeiro. Mem0 e vetores entram como opcao depois.</span>
                </div>
              </div>
            )}

            {tab === "tools" && (
              <div className="form-grid">
                <label className="toggle-field">
                  <span>Navegador automatizado</span>
                  <input type="checkbox" checked={draft.browserAutomation} onChange={(event) => setDraft({ ...draft, browserAutomation: event.target.checked })} />
                </label>
                <label className="toggle-field">
                  <span>Observador de tela</span>
                  <input type="checkbox" checked={draft.visionEnabled} onChange={(event) => setDraft({ ...draft, visionEnabled: event.target.checked })} />
                </label>
                <div className="info-box">
                  <Eye size={18} />
                  <span>As ferramentas reais so executam depois do Omni Guard validar risco.</span>
                </div>
              </div>
            )}

            {tab === "permissions" && (
              <div className="permission-grid">
                {Object.entries(draft.permissions).map(([key, value]) => (
                  <label key={key}>
                    <span>{key}</span>
                    <select value={value} onChange={(event) => updatePermission(key, event.target.value as PermissionMode)}>
                      {Object.entries(permissionLabels).map(([mode, label]) => (
                        <option key={mode} value={mode}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="settings-footer">
          <button className="save-button" type="button" disabled={saving} onClick={() => onSave(draft)}>
            <Save size={16} />
            {saving ? "Salvando" : "Salvar"}
          </button>
        </footer>
      </div>
    </aside>
  );
}
