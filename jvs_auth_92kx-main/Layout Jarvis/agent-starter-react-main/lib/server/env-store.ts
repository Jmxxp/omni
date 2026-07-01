import 'server-only';

import { promises as fs } from 'node:fs';
import path from 'node:path';

export const SETTINGS_KEYS = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'GOOGLE_API_KEY',
  'MEM0_API_KEY',
  'AGENT_NAME',
  'JARVIS_USER_ID',
  'JARVIS_VOICE',
  'JARVIS_TEMPERATURE',
  'JARVIS_VIDEO_ENABLED',
] as const;

export type SettingsKey = (typeof SETTINGS_KEYS)[number];
export type JarvisSettings = Record<SettingsKey, string>;

export const REQUIRED_SETTINGS: SettingsKey[] = [
  'LIVEKIT_URL',
  'LIVEKIT_API_KEY',
  'LIVEKIT_API_SECRET',
  'GOOGLE_API_KEY',
];

const ENV_PATH = path.join(process.cwd(), '.env.local');

const DEFAULT_SETTINGS: JarvisSettings = {
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

export function parseEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const normalized = line.startsWith('export ') ? line.slice(7).trim() : line;
    const equalsIndex = normalized.indexOf('=');
    if (equalsIndex === -1) continue;

    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    parsed[key] = value;
  }

  return parsed;
}

function stringifyValue(value: string) {
  if (!value) return '';
  if (/[\s#"'`]/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

async function readEnvContent() {
  try {
    return await fs.readFile(ENV_PATH, 'utf8');
  } catch {
    return '';
  }
}

export async function readRuntimeEnv() {
  return {
    ...process.env,
    ...parseEnvFile(await readEnvContent()),
  };
}

export async function readSettings(): Promise<JarvisSettings> {
  const env = await readRuntimeEnv();
  const settings = { ...DEFAULT_SETTINGS };

  for (const key of SETTINGS_KEYS) {
    settings[key] = String(env[key] ?? settings[key] ?? '');
  }

  return settings;
}

export function getMissingSettings(settings: JarvisSettings) {
  return REQUIRED_SETTINGS.filter((key) => !settings[key]?.trim());
}

export async function writeSettings(incoming: Partial<JarvisSettings>) {
  const existingContent = await readEnvContent();
  const existing = parseEnvFile(existingContent);
  const next = { ...DEFAULT_SETTINGS, ...existing };

  for (const key of SETTINGS_KEYS) {
    const value = incoming[key];
    if (typeof value === 'string') {
      next[key] = value.trim();
    }
  }

  const seen = new Set<string>();
  const outputLines = existingContent
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const normalized = line.trim().startsWith('export ')
        ? line.trim().slice(7).trim()
        : line.trim();
      const key = normalized.split('=')[0]?.trim();

      const settingsKey = key as SettingsKey;
      if (SETTINGS_KEYS.includes(settingsKey)) {
        seen.add(settingsKey);
        return `${settingsKey}=${stringifyValue(next[settingsKey])}`;
      }

      return line;
    });

  for (const key of SETTINGS_KEYS) {
    if (!seen.has(key)) {
      outputLines.push(`${key}=${stringifyValue(next[key])}`);
    }
  }

  await fs.writeFile(ENV_PATH, `${outputLines.join('\n')}\n`, 'utf8');

  return readSettings();
}
