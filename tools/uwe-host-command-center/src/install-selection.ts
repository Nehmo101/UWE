/**
 * Welche UWE-Apps diese Installation betreibt.
 *
 * Die Auswahl trifft der Ersteinrichtungs-Assistent im Command Center einmalig
 * („Was soll installiert werden?") und liegt anschließend als host-lesbare JSON
 * **neben** den Host-Daten — außerhalb des Git-Checkouts, damit Updates und
 * Rebuilds sie nicht anfassen. Einrichtung, Statusanzeige, Start und Stopp
 * lesen dieselbe Datei; damit gilt genau eine Wahrheit für „gehört dazu".
 *
 * Bewusst frei von Laufzeit-Logik außer Datei-I/O: `desktop-host.ts`, die CLI
 * und `setup-plan.ts` hängen alle an dieser Form.
 *
 * Abwärtskompatibilität: Fehlt die Datei (jede vor dem Assistenten angelegte
 * Installation), gilt die Vorgabe „alle Apps" — exakt das bisherige Verhalten.
 */
import fs from "node:fs";
import path from "node:path";

import { HOST_SERVICE_IDS, type HostServiceId } from "./desktop-host-types.ts";

export const INSTALL_SELECTION_FILENAME = "install-selection.json";
export const INSTALL_SELECTION_VERSION = 1;

export interface InstallSelection {
  version: number;
  /** Installierte Apps, immer in der Reihenfolge von `HOST_SERVICE_IDS`. */
  apps: HostServiceId[];
  /** Demo-Grundbestand (Beispielwelt, Beispieldaten) beim ersten Aufbau einspielen. */
  seedDemoContent: boolean;
  updatedAt: string | null;
}

export interface InstallSelectionState {
  selection: InstallSelection;
  /** `true`, sobald der Assistent eine Auswahl geschrieben hat. */
  persisted: boolean;
  file: string;
}

/** Vorgabe für Neuinstallationen und für Bestände ohne Auswahl-Datei: alles. */
export function defaultInstallSelection(): InstallSelection {
  return {
    version: INSTALL_SELECTION_VERSION,
    apps: [...HOST_SERVICE_IDS],
    seedDemoContent: true,
    updatedAt: null,
  };
}

function readAppList(value: unknown): HostServiceId[] | null {
  if (!Array.isArray(value)) return null;
  const wanted = new Set(value.filter((entry): entry is string => typeof entry === "string"));
  // Reihenfolge kommt aus HOST_SERVICE_IDS, nicht aus der Eingabe: Start- und
  // Anzeigereihenfolge bleiben dadurch stabil, egal wie die UI sortiert.
  const apps = HOST_SERVICE_IDS.filter((id) => wanted.has(id));
  return apps.length > 0 ? [...apps] : null;
}

/**
 * Bringt beliebige Eingaben (Datei, CLI-stdin, Frontend) auf eine gültige
 * Auswahl. Eine leere oder unbekannte App-Liste fällt auf „alles" zurück —
 * eine Installation ganz ohne App wäre ein Zustand, aus dem die Oberfläche
 * nicht mehr herausfindet.
 */
export function normalizeInstallSelection(input: unknown): InstallSelection {
  const defaults = defaultInstallSelection();
  if (!input || typeof input !== "object") return defaults;
  const record = input as Record<string, unknown>;
  const updatedAt = typeof record.updatedAt === "string" ? record.updatedAt : null;
  return {
    version: INSTALL_SELECTION_VERSION,
    apps: readAppList(record.apps) ?? defaults.apps,
    seedDemoContent:
      typeof record.seedDemoContent === "boolean" ? record.seedDemoContent : defaults.seedDemoContent,
    updatedAt,
  };
}

export function installSelectionFile(dataRoot: string): string {
  return path.join(dataRoot, INSTALL_SELECTION_FILENAME);
}

/** Liest die Auswahl; unlesbare oder kaputte Dateien fallen auf die Vorgabe zurück. */
export function readInstallSelectionState(dataRoot: string): InstallSelectionState {
  const file = installSelectionFile(dataRoot);
  if (!fs.existsSync(file)) {
    return { selection: defaultInstallSelection(), persisted: false, file };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return { selection: normalizeInstallSelection(parsed), persisted: true, file };
  } catch {
    // Eine beschädigte Datei darf die Einrichtung nicht blockieren.
    return { selection: defaultInstallSelection(), persisted: false, file };
  }
}

export function readInstallSelection(dataRoot: string): InstallSelection {
  return readInstallSelectionState(dataRoot).selection;
}

export function writeInstallSelection(dataRoot: string, input: unknown): InstallSelection {
  const selection: InstallSelection = {
    ...normalizeInstallSelection(input),
    updatedAt: new Date().toISOString(),
  };
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.writeFileSync(installSelectionFile(dataRoot), `${JSON.stringify(selection, null, 2)}\n`, "utf8");
  return selection;
}

export function isAppSelected(selection: InstallSelection, id: HostServiceId): boolean {
  return selection.apps.includes(id);
}
