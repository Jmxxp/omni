import type { HealthResponse, Settings, TaskResponse } from "./types";

const API_URL = import.meta.env.VITE_OMNI_CORE_URL ?? "http://127.0.0.1:8765";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<HealthResponse>("/health"),
  settings: () => request<Settings>("/settings"),
  saveSettings: (settings: Settings) =>
    request<Settings>("/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    }),
  sendMessage: (message: string) =>
    request<TaskResponse>("/message", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};

