/**
 * Formatierung und Beschriftungen für die Command-Center-Startseite.
 *
 * Aus `CommandCenterPanel.tsx` herausgezogen, damit die Panel-Datei wieder
 * unter dem Zeilenbudget liegt und diese reinen Funktionen ohne React testbar
 * bleiben.
 */
import type { LocalHostStatus } from "../../lib/tauri";

export type HostAction = "setup" | "start" | "stop" | "restart" | "backup";

export type BusyState = HostAction | "refresh" | "settings" | "all" | "check-update" | "update";

export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toLocaleString("de-DE", { maximumFractionDigits: 1 })} ${units[index]}`;
}

export function formatDuration(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return days ? `${days} Tage, ${hours} Std.` : `${hours} Std., ${minutes} Min.`;
}

export function stateLabel(status: LocalHostStatus | null): string {
  if (!status) return "Status wird geladen";
  if (status.overall === "ready") return "Alles bereit";
  if (status.overall === "error") return "Eingriff erforderlich";
  if (
    !status.installation.buildReady ||
    !status.installation.databaseReady ||
    !status.installation.envReady
  ) {
    return "Einrichtung erforderlich";
  }
  return "Bereit zum Start";
}

/** Überschrift des Fortschrittsbalkens, solange eine Aktion läuft. */
export function busyLabel(busy: BusyState, status: LocalHostStatus | null): string {
  switch (busy) {
    case "setup":
      return status?.installation.buildReady ? "UWE wird repariert und neu gebaut" : "UWE wird eingerichtet";
    case "update":
      return "Update wird installiert";
    case "check-update":
      return "Suche nach UWE-Updates";
    case "all":
      return "UWE-Dienste werden umgeschaltet";
    case "start":
      return "Dienst wird gestartet";
    case "stop":
      return "Dienst wird gestoppt";
    case "restart":
      return "Dienste werden neu gestartet";
    case "backup":
      return "Backup wird erstellt";
    case "settings":
      return "Einstellungen werden gespeichert";
    case "refresh":
      return "Status wird geladen";
    default:
      return "Aktion läuft";
  }
}
