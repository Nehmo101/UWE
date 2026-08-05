import type { LocalHostStatus } from "../../lib/tauri";

export interface CommandCenterGuidance {
  tone: "ready" | "attention" | "error";
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: "setup" | "start" | "open" | "wait";
  primaryLabel: string;
}

const LONG_RUN_TITLES: Record<NonNullable<LocalHostStatus["longRun"]>["action"], string> = {
  setup: "UWE wird gerade eingerichtet",
  update: "UWE wird gerade aktualisiert",
  "bundle-install": "UWE wird gerade installiert",
  "bundle-update": "UWE wird gerade aktualisiert",
};

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

  /*
   * Ein laufender Einrichtungs- oder Update-Lauf schlägt jede andere Aussage.
   * Während er baut, fehlt zeitweise das Standalone-`server.js` der gerade
   * gebauten App — `buildReady` kippt dadurch auf false, und der Knopf darunter
   * würde „UWE jetzt einrichten" anbieten. Genau das ist am 2026-08-04 passiert:
   * ein Klick startete einen zweiten Lauf über den ersten. Der Host verweigert
   * das inzwischen per Sperre; hier wird gar nicht erst dazu eingeladen.
   */
  if (status.longRun) {
    return {
      tone: "attention",
      eyebrow: "Läuft gerade",
      title: LONG_RUN_TITLES[status.longRun.action],
      description:
        "Der Vorgang dauert einige Minuten und darf nicht doppelt laufen. " +
        "Die Bereiche starten, sobald er durch ist.",
      primaryAction: "wait",
      primaryLabel: "Bitte warten …",
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
