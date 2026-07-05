import type { ConnectorRuntimeStatus } from "./tauri-types";

export function toMessage(error: unknown): string {
  if (typeof error === "string") {
    return error.trim() || "Unbekannter Fehler";
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Unbekannter Fehler";
}

export function toHealthBadgeStatus(
  runtimeStatus: ConnectorRuntimeStatus,
): "ok" | "degraded" | "error" {
  if (runtimeStatus.status === "error" || runtimeStatus.connectionStatus === "error") {
    return "error";
  }

  if (runtimeStatus.status === "running" && runtimeStatus.connectionStatus === "connected") {
    return "ok";
  }

  return "degraded";
}

export function humanizeConnectionStatus(status: ConnectorRuntimeStatus["connectionStatus"]): string {
  switch (status) {
    case "connected":
      return "Verbunden";
    case "connecting":
      return "Verbindet";
    case "ready":
      return "Bereit";
    case "degraded":
      return "Eingeschränkt";
    case "disconnected":
      return "Getrennt";
    case "error":
      return "Fehler";
    case "not_configured":
      return "Nicht eingerichtet";
    default:
      return status;
  }
}

export function humanizeProcessStatus(status: ConnectorRuntimeStatus["status"]): string {
  switch (status) {
    case "running":
      return "Läuft";
    case "starting":
      return "Startet";
    case "stopping":
      return "Stoppt";
    case "error":
      return "Fehler";
    case "stopped":
    default:
      return "Gestoppt";
  }
}
