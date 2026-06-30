export type AgentState =
  | "idle"
  | "listening"
  | "thinking"
  | "planning"
  | "waiting_confirmation"
  | "executing"
  | "observing"
  | "speaking"
  | "completed"
  | "error";

export type Provider = "openai" | "google" | "anthropic" | "ollama" | "custom";
export type PermissionMode = "always" | "ask" | "blocked";

export interface Settings {
  assistantName: string;
  language: "pt-BR" | "en-US";
  coreMode: "local" | "cloud";
  provider: Provider;
  model: string;
  apiKeyConfigured: boolean;
  voiceProvider: "windows" | "openai" | "elevenlabs" | "google";
  sttProvider: "browser" | "openai" | "deepgram" | "google" | "local";
  memoryEnabled: boolean;
  browserAutomation: boolean;
  visionEnabled: boolean;
  permissions: Record<string, PermissionMode>;
}

export interface TimelineEvent {
  id: string;
  level: "info" | "success" | "warning" | "error";
  title: string;
  detail: string;
  timestamp: string;
}

export interface HealthResponse {
  status: "ok";
  service: "omni-core";
  version: string;
}

export interface TaskResponse {
  id: string;
  state: AgentState;
  reply: string;
  events: TimelineEvent[];
}

