'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Save, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type JarvisSettings = {
  LIVEKIT_URL: string;
  LIVEKIT_API_KEY: string;
  LIVEKIT_API_SECRET: string;
  GOOGLE_API_KEY: string;
  MEM0_API_KEY: string;
  AGENT_NAME: string;
  JARVIS_USER_ID: string;
  JARVIS_VOICE: string;
  JARVIS_TEMPERATURE: string;
  JARVIS_VIDEO_ENABLED: string;
};

type SettingsResponse = {
  settings: JarvisSettings;
  missing: string[];
  error?: string;
};

const EMPTY_SETTINGS: JarvisSettings = {
  LIVEKIT_URL: '',
  LIVEKIT_API_KEY: '',
  LIVEKIT_API_SECRET: '',
  GOOGLE_API_KEY: '',
  MEM0_API_KEY: '',
  AGENT_NAME: '',
  JARVIS_USER_ID: 'Usuario',
  JARVIS_VOICE: 'Charon',
  JARVIS_TEMPERATURE: '0.6',
  JARVIS_VIDEO_ENABLED: 'true',
};

const REQUIRED_KEYS: Array<keyof JarvisSettings> = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'GOOGLE_API_KEY',
];

const FIELDS: Array<{
  key: keyof JarvisSettings;
  label: string;
  placeholder?: string;
  secret?: boolean;
}> = [
  { key: 'LIVEKIT_URL', label: 'LiveKit URL', placeholder: 'wss://...' },
  { key: 'LIVEKIT_API_KEY', label: 'LiveKit Key', secret: true },
  { key: 'LIVEKIT_API_SECRET', label: 'LiveKit Secret', secret: true },
  { key: 'GOOGLE_API_KEY', label: 'Gemini Key', secret: true },
  { key: 'MEM0_API_KEY', label: 'Mem0 Key', placeholder: 'opcional', secret: true },
  { key: 'AGENT_NAME', label: 'Agente', placeholder: 'opcional' },
  { key: 'JARVIS_USER_ID', label: 'Usuário' },
  { key: 'JARVIS_VOICE', label: 'Voz' },
];

interface SetupPanelProps {
  onReadyChange?: (ready: boolean) => void;
}

export function SetupPanel({ onReadyChange }: SetupPanelProps) {
  const [settings, setSettings] = useState<JarvisSettings>(EMPTY_SETTINGS);
  const [showSecrets, setShowSecrets] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const missing = useMemo(
    () => REQUIRED_KEYS.filter((key) => !settings[key]?.trim()),
    [settings]
  );
  const ready = missing.length === 0 && !dirty;

  useEffect(() => {
    let mounted = true;

    fetch('/api/settings', { cache: 'no-store' })
      .then(async (response) => {
        const data = (await response.json()) as SettingsResponse;
        if (!response.ok) throw new Error(data.error || 'Erro ao carregar configuracoes');
        return data;
      })
      .then((data) => {
        if (!mounted) return;
        setSettings({ ...EMPTY_SETTINGS, ...data.settings });
        setDirty(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    onReadyChange?.(ready);
  }, [onReadyChange, ready]);

  function updateSetting(key: keyof JarvisSettings, value: string) {
    setSettings((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setError('');
  }

  async function saveSettings() {
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const data = (await response.json()) as SettingsResponse;
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar configuracoes');
      setSettings({ ...EMPTY_SETTINGS, ...data.settings });
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="w-full max-w-3xl border border-white/10 bg-black/45 p-4 text-left text-white shadow-2xl backdrop-blur rounded-lg">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Settings2 className="size-4 shrink-0 text-cyan-300" />
          <h2 className="truncate text-sm font-bold uppercase tracking-wide">
            Configuração local
          </h2>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-1 text-xs font-bold ${
            ready ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200'
          }`}
        >
          {ready ? 'Pronto' : dirty ? 'Não salvo' : 'Pendente'}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {FIELDS.map((field) => (
          <label key={field.key} className="grid min-w-0 gap-1.5">
            <span className="text-xs font-semibold text-white/70">{field.label}</span>
            <input
              value={settings[field.key]}
              type={field.secret && !showSecrets ? 'password' : 'text'}
              placeholder={field.placeholder}
              spellCheck={false}
              onChange={(event) => updateSetting(field.key, event.currentTarget.value)}
              className="h-10 min-w-0 rounded-md border border-white/10 bg-white/[0.07] px-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
            />
          </label>
        ))}

        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-semibold text-white/70">Temperatura</span>
          <input
            value={settings.JARVIS_TEMPERATURE}
            type="number"
            min="0"
            max="2"
            step="0.1"
            onChange={(event) => updateSetting('JARVIS_TEMPERATURE', event.currentTarget.value)}
            className="h-10 min-w-0 rounded-md border border-white/10 bg-white/[0.07] px-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
          />
        </label>

        <label className="grid min-w-0 gap-1.5">
          <span className="text-xs font-semibold text-white/70">Vídeo</span>
          <select
            value={settings.JARVIS_VIDEO_ENABLED}
            onChange={(event) => updateSetting('JARVIS_VIDEO_ENABLED', event.currentTarget.value)}
            className="h-10 min-w-0 rounded-md border border-white/10 bg-white/[0.07] px-3 text-sm text-white outline-none transition focus:border-cyan-300/70"
          >
            <option value="true">Ligado</option>
            <option value="false">Desligado</option>
          </select>
        </label>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-300/25 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowSecrets((value) => !value)}
          className="border-white/10 bg-white/[0.06] text-white hover:bg-white/10 hover:text-white"
        >
          {showSecrets ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          {showSecrets ? 'Ocultar' : 'Mostrar'}
        </Button>
        <Button
          type="button"
          onClick={saveSettings}
          disabled={saving || loading || !dirty}
          className="bg-cyan-400 text-black hover:bg-cyan-300"
        >
          <Save className="size-4" />
          {saving ? 'Salvando' : 'Salvar'}
        </Button>
      </div>
    </section>
  );
}
