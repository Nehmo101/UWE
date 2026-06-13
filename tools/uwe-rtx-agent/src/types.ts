export type AgentStatus = "ready" | "disabled" | "starting" | "error";

export interface HealthResponse {
  status: AgentStatus;
  enabled: boolean;
  backend?: string;
  model?: string;
  gpu?: string;
  message: string;
  agentUrl?: string;
  ollamaBaseUrl?: string;
  lastHealthCheckAt?: string;
  publicBindWarning?: string;
}

export interface TrayStatusResponse extends HealthResponse {
  autostart: boolean;
  defaultModel: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  options?: Record<string, unknown>;
}

export interface ChatResponse {
  model: string;
  message: ChatMessage;
  done: boolean;
}

export interface ErrorResponse {
  error: string;
  message: string;
}

export type BackendState = "unknown" | "starting" | "ready" | "offline";
