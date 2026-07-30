/**
 * Katalog des Ersteinrichtungs-Assistenten: welche UWE-Apps es gibt, was sie
 * mitbringen und welche Datenbank sie brauchen.
 *
 * Reine Daten ohne React — dadurch sind Vorlagen und die abgeleitete
 * Datenbank-Liste testbar, und die Wizard-Komponente bleibt Darstellung.
 * Die App-IDs spiegeln `HOST_SERVICE_IDS`
 * (tools/uwe-host-command-center/src/desktop-host-types.ts).
 */
import type { LocalHostServiceId } from "../../lib/tauri";

export interface InstallAppEntry {
  id: LocalHostServiceId;
  label: string;
  tagline: string;
  description: string;
  defaultPort: number;
  /** Datei der Datenbank, die dieser Bereich braucht. */
  database: "uwe.db" | "uwe-brain.db" | "uwe-family.db";
  /** Zugangs-Häkchen, das diese App gewährt. Die Startseite ist öffentlich. */
  accessArea: "portal" | "studio" | "brain" | "family" | null;
}

export const INSTALL_APPS: readonly InstallAppEntry[] = [
  {
    id: "studio",
    label: "Studio",
    tagline: "DM-Arbeitsplatz & Verwaltung",
    description:
      "Welten bearbeiten, KI nutzen, Daily Admin OS, Benutzer und Tokens verwalten. Ohne Studio gibt es keinen Ort, an dem Inhalte entstehen.",
    defaultPort: 3000,
    database: "uwe.db",
    accessArea: "studio",
  },
  {
    id: "portal",
    label: "Portal",
    tagline: "Spieler-Wiki",
    description:
      "Zeigt Mitspielern nur freigegebene Inhalte der Welten, denen sie zugeordnet sind. DM-Notizen bleiben außen vor.",
    defaultPort: 3001,
    database: "uwe.db",
    accessArea: "portal",
  },
  {
    id: "brain",
    label: "Brain",
    tagline: "Privater Wissensbereich",
    description:
      "Owner-privat: Notizen, Life Brain, Daily Admin. Eigene Datenbank, KI-Kontext bleibt garantiert lokal.",
    defaultPort: 3102,
    database: "uwe-brain.db",
    accessArea: "brain",
  },
  {
    id: "family",
    label: "Family",
    tagline: "Gemeinsamer Haushalt",
    description:
      "Küche, Einkauf, Scan-Eingang und Haushaltsplanung für alle mit dem Häkchen „Family“. Eigene Datenbank.",
    defaultPort: 3004,
    database: "uwe-family.db",
    accessArea: "family",
  },
  {
    id: "landing",
    label: "Startseite",
    tagline: "Öffentliche Eingangsseite",
    description:
      "Schlanke öffentliche Seite auf der Hauptdomain, damit dort kein Studio-Code ausgeliefert wird. Nur nötig, wenn UWE öffentlich erreichbar sein soll.",
    defaultPort: 3103,
    database: "uwe.db",
    accessArea: null,
  },
];

/**
 * Portgrenzen — Spiegel von `MIN_SERVICE_PORT`/`MAX_SERVICE_PORT`
 * (tools/uwe-host-command-center/src/install-selection.ts). Unter 1024 liegen
 * die privilegierten Ports; die Einrichtung würde daran scheitern, statt es
 * hier zu sagen.
 */
export const MIN_SERVICE_PORT = 1024;
export const MAX_SERVICE_PORT = 65535;

/** Porteingaben des Assistenten — als Text, damit Tippen nicht bevormundet wird. */
export type InstallPortValues = Partial<Record<LocalHostServiceId, string>>;

/** Die Vorschlagswerte des Katalogs als Startbelegung der Eingabefelder. */
export function defaultPortValues(): InstallPortValues {
  return Object.fromEntries(
    INSTALL_APPS.map((entry) => [entry.id, String(entry.defaultPort)]),
  ) as InstallPortValues;
}

export function isValidPort(value: string): boolean {
  if (!/^\d+$/.test(value.trim())) return false;
  const port = Number(value.trim());
  return port >= MIN_SERVICE_PORT && port <= MAX_SERVICE_PORT;
}

/**
 * Die Apps, die sich einen Port teilen. Zwei Dienste auf demselben Port heißt:
 * einer startet, der andere bleibt liegen — und zwar erst am Ende der
 * Installation, wenn niemand mehr damit rechnet.
 */
export function portConflicts(
  apps: readonly LocalHostServiceId[],
  ports: InstallPortValues,
): Set<LocalHostServiceId> {
  const seen = new Map<string, LocalHostServiceId>();
  const conflicts = new Set<LocalHostServiceId>();
  for (const id of apps) {
    const value = (ports[id] ?? "").trim();
    if (!isValidPort(value)) continue;
    const previous = seen.get(value);
    if (previous) {
      conflicts.add(previous);
      conflicts.add(id);
    } else {
      seen.set(value, id);
    }
  }
  return conflicts;
}

/** Ist die Portwahl vollständig und widerspruchsfrei? */
export function portsAreValid(
  apps: readonly LocalHostServiceId[],
  ports: InstallPortValues,
): boolean {
  return (
    apps.every((id) => isValidPort(ports[id] ?? "")) && portConflicts(apps, ports).size === 0
  );
}

/**
 * Die Portwahl für die Auswahl-Datei: nur gewählte Apps, nur gültige Werte, als
 * Zahl. Was hier fehlt, bleibt beim Standard des Dienstes.
 */
export function portsForSelection(
  apps: readonly LocalHostServiceId[],
  ports: InstallPortValues,
): Partial<Record<LocalHostServiceId, number>> {
  const result: Partial<Record<LocalHostServiceId, number>> = {};
  for (const id of apps) {
    const value = (ports[id] ?? "").trim();
    if (isValidPort(value)) result[id] = Number(value);
  }
  return result;
}

export interface InstallPreset {
  id: string;
  label: string;
  description: string;
  apps: LocalHostServiceId[];
}

/** Vorlagen für den ersten Schritt — ein Klick statt fünf Häkchen. */
export const INSTALL_PRESETS: readonly InstallPreset[] = [
  {
    id: "complete",
    label: "Komplett",
    description: "Alles: Studio, Portal, Brain, Family und die öffentliche Startseite.",
    apps: ["studio", "portal", "brain", "family", "landing"],
  },
  {
    id: "dnd",
    label: "Nur D&D",
    description: "Studio und Portal — Weltenbau und Spielersicht, ohne Haushalt und Privatbereich.",
    apps: ["studio", "portal"],
  },
  {
    id: "personal",
    label: "Nur privat",
    description: "Studio und Brain — Wissens- und Alltagsverwaltung ohne Spielerzugang.",
    apps: ["studio", "brain"],
  },
  {
    id: "household",
    label: "Haushalt",
    description: "Studio und Family — gemeinsamer Haushalt, ohne Portal und Privatbereich.",
    apps: ["studio", "family"],
  },
];

export function findAppEntry(id: LocalHostServiceId): InstallAppEntry | undefined {
  return INSTALL_APPS.find((entry) => entry.id === id);
}

/** Die Datenbanken, die für diese Auswahl angelegt/migriert werden. */
export function databasesFor(apps: readonly LocalHostServiceId[]): string[] {
  const databases = new Set<string>(["uwe.db"]); // Konten und Einstellungen: immer.
  for (const app of apps) {
    const entry = findAppEntry(app);
    if (entry) databases.add(entry.database);
  }
  return [...databases];
}

/** Zugangs-Häkchen, die ein Owner-Konto für diese Auswahl bekommen soll. */
export function accessFor(apps: readonly LocalHostServiceId[]): {
  portal: boolean;
  studio: boolean;
  brain: boolean;
  family: boolean;
} {
  const areas = new Set(
    apps
      .map((app) => findAppEntry(app)?.accessArea)
      .filter((area): area is NonNullable<InstallAppEntry["accessArea"]> => Boolean(area)),
  );
  return {
    portal: areas.has("portal"),
    studio: areas.has("studio"),
    brain: areas.has("brain"),
    family: areas.has("family"),
  };
}

/** Der Vorlagen-Name, der exakt zu dieser Auswahl passt (sonst „Eigene Auswahl“). */
export function presetIdFor(apps: readonly LocalHostServiceId[]): string | null {
  const key = [...apps].sort().join(",");
  return INSTALL_PRESETS.find((preset) => [...preset.apps].sort().join(",") === key)?.id ?? null;
}
