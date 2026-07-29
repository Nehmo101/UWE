import type { RoutingMode } from "./types";

export const ROUTING_LABELS: Record<RoutingMode, string> = {
  LOCAL_ONLY: "Aktiv (RTX-Host)",
  // Legacy DB values from the cloud era — displayed, never offered.
  LOCAL_THEN_CLOUD: "Aktiv (RTX-Host)",
  CLOUD_ONLY: "Deaktiviert",
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
  { id: "models", label: "Modelle" },
  { id: "logs", label: "Verlauf" },
] as const;

export type AiGatewayTabId = (typeof AI_GATEWAY_TABS)[number]["id"];
