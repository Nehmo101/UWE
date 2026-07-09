import type { RoutingMode } from "./types";

export const ROUTING_LABELS: Record<RoutingMode, string> = {
  LOCAL_ONLY: "Nur lokal (RTX)",
  LOCAL_THEN_CLOUD: "Lokal, dann Cloud",
  CLOUD_ONLY: "Nur Cloud",
  DISABLED: "Deaktiviert",
};

export const PRIVACY_CATEGORY_LABELS: Record<string, string> = {
  general_chat: "Allgemeiner Chat",
  dnd_world: "DnD-Weltwissen (Brain, Objekte)",
  personal_brain: "Persönliches Life-Brain",
  private_notes: "Private Notizen",
  admin_diagnostics: "Admin-Systemdiagnose",
  image_generation: "Bildfunktionen",
};

export const FEATURE_MODEL_LABELS: Record<string, string> = {
  general_chat: "Allgemeiner Chat",
  dnd_world: "DnD Generator / Brain / Welt",
  personal_brain: "Life Brain (persönlich)",
  private_notes: "Zusammenfassungen / Notizen",
  admin_diagnostics: "Admin-Diagnose",
  image_generation: "Image Studio",
};

export const FEATURE_MODEL_KEYS = Object.keys(FEATURE_MODEL_LABELS);

export const AI_GATEWAY_TABS = [
  { id: "routing", label: "Routing" },
  { id: "privacy", label: "Privacy" },
  { id: "models", label: "Modelle" },
  { id: "budgets", label: "Budgets" },
  { id: "grants", label: "Freigaben" },
  { id: "logs", label: "Verlauf" },
] as const;

export type AiGatewayTabId = (typeof AI_GATEWAY_TABS)[number]["id"];

export const CLOUD_PROVIDER_PRESETS = [
  { providerId: "openai", label: "OpenAI", defaultModel: "gpt-4o-mini" },
  { providerId: "anthropic", label: "Anthropic", defaultModel: "claude-3-5-haiku-latest" },
  { providerId: "gemini", label: "Google Gemini", defaultModel: "gemini-2.0-flash" },
  { providerId: "openrouter", label: "OpenRouter", defaultModel: "mistralai/mistral-small" },
];

export const GRANT_PERMISSIONS = [
  "AI_CHAT_USE",
  "AI_DND_USE",
  "AI_IMAGE_USE",
  "AI_SUMMARY_USE",
  "AI_KNOWLEDGE_USE",
] as const;
