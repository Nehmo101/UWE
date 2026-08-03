import type { LocalHostStatus } from "../../lib/tauri";

export interface CommandCenterGuidance {
  tone: "ready" | "attention" | "error";
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: "setup" | "start" | "open";
  primaryLabel: string;
}

export function commandCenterGuidance(
  status: LocalHostStatus | null,
): CommandCenterGuidance {
  if (!status) {
    return {
      tone: "attention",
      eyebrow: "Systemstatus",
      title: "Command Center wird verbunden",
      description: "Der Zustand dieses Rechners wird gerade ermittelt.",
      primaryAction: "start",
      primaryLabel: "Status wird geladen",
    };
  }

  if (!status.installation.buildReady) {
    return {
      tone: status.overall === "error" ? "error" : "attention",
      eyebrow: "Einrichtung erforderlich",
      title: "UWE ist noch nicht startklar",
      description: "Schließe die lokale Einrichtung ab. Deine bestehenden Daten bleiben dabei erhalten.",
      primaryAction: "setup",
      primaryLabel: "UWE jetzt einrichten",
    };
  }

  const healthyCount = status.services.filter((service) => service.healthy).length;
  if (healthyCount === status.services.length && status.services.length > 0) {
    const launchService = status.services.find((service) => service.id === "studio") ?? status.services[0];
    const launchLabel = launchService?.label.replace(/^UWE\s+/, "") ?? "Bereich";
    return {
      tone: "ready",
      eyebrow: "Alles im grünen Bereich",
      title: "UWE läuft",
      description: `${healthyCount} von ${status.services.length} Bereichen sind erreichbar. Du kannst direkt zu ${launchLabel} wechseln.`,
      primaryAction: "open",
      primaryLabel: `${launchLabel} öffnen`,
    };
  }

  if (healthyCount > 0) {
    return {
      tone: "attention",
      eyebrow: "Eingriff empfohlen",
      title: "UWE läuft nur teilweise",
      description: `${healthyCount} von ${status.services.length} Bereichen sind erreichbar. Starte alle Bereiche, um den vollständigen Betrieb wiederherzustellen.`,
      primaryAction: "start",
      primaryLabel: "Alle Bereiche starten",
    };
  }

  return {
    tone: status.overall === "error" ? "error" : "attention",
    eyebrow: "Bereit, wenn du es bist",
    title: "UWE ist derzeit offline",
    description: `${status.services.length} installierte Bereiche warten auf den Start. Daten und Einstellungen sind sicher.`,
    primaryAction: "start",
    primaryLabel: "UWE starten",
  };
}
