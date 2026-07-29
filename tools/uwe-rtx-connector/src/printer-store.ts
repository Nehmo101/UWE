/**
 * Persisted printer selection store for the UWE Command Center.
 *
 * The connector discovers printers installed on the RTX host (Windows spooler
 * via `Get-Printer`, or CUPS via `lpstat`) but — mirroring the model store —
 * only advertises the ones the user explicitly enables for UWE. A
 * `ConnectorPrinterProfile` is the curated record for one printer: the local
 * printer metadata plus the `enabledForUwe` flag.
 *
 * The store lives at `<dataDir>/printer-store.json`. Reads are offline-safe: a
 * missing or corrupt file yields the empty default rather than throwing, so the
 * connector always starts. The store only holds printer metadata and the enable
 * flag — never tokens, world, brain, or personal data.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { normalizeLocalPrinters, type LocalPrinterInfo } from "@uwe/connector";

export const PRINTER_STORE_FILENAME = "printer-store.json";
export const PRINTER_STORE_VERSION = 1;

/**
 * A curated printer entry: the discovered printer plus the user's enable flag.
 * New printers are disabled by default — the user opts a printer in, exactly
 * like the model picker.
 */
export interface ConnectorPrinterProfile extends LocalPrinterInfo {
  /** Whether this printer is shared with the UWE Host on heartbeat. */
  enabledForUwe: boolean;
}

export interface ConnectorPrinterStore {
  version: number;
  printers: ConnectorPrinterProfile[];
}

/** Default empty store for a fresh connector install. */
export function defaultPrinterStore(): ConnectorPrinterStore {
  return { version: PRINTER_STORE_VERSION, printers: [] };
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Parse a persisted printer store JSON value. Unknown keys are ignored, missing
 * keys receive defaults, and malformed entries are dropped rather than throwing,
 * so a partially corrupt file never breaks the connector. Throws only when the
 * top-level value is present but not a JSON object.
 */
export function parsePrinterStore(json: unknown): ConnectorPrinterStore {
  if (json === null || json === undefined) {
    return defaultPrinterStore();
  }
  if (typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Drucker-Store muss ein JSON-Objekt sein.");
  }

  const input = json as Record<string, unknown>;
  const rawPrinters = Array.isArray(input.printers) ? input.printers : [];

  // `normalizeLocalPrinters` handles id/name trimming and de-duplication; we then
  // re-attach the enable flag (and any preserved state metadata) per id.
  const enabledById = new Map<string, boolean>();
  for (const entry of rawPrinters) {
    if (typeof entry !== "object" || entry === null) continue;
    const raw = entry as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    if (!id) continue;
    enabledById.set(id, asBoolean(raw.enabledForUwe, false));
  }

  const printers: ConnectorPrinterProfile[] = normalizeLocalPrinters(rawPrinters).map(
    (printer) => ({
      ...printer,
      enabledForUwe: enabledById.get(printer.id) ?? false,
    }),
  );

  return {
    version: typeof input.version === "number" ? input.version : PRINTER_STORE_VERSION,
    printers,
  };
}

/**
 * Merge freshly discovered printers into an existing store:
 *   • existing entries keep their `enabledForUwe` flag and refresh their live
 *     metadata (name, description, default flag, state) from discovery,
 *   • printers seen for the first time are added disabled (opt-in),
 *   • printers already in the store but no longer discovered are kept, so the
 *     user's selection survives a printer being temporarily offline.
 */
export function mergeDiscoveredPrinters(
  store: ConnectorPrinterStore,
  discovered: readonly LocalPrinterInfo[],
): ConnectorPrinterStore {
  const normalizedDiscovered = normalizeLocalPrinters([...discovered]);
  const discoveredById = new Map(normalizedDiscovered.map((printer) => [printer.id, printer]));

  const byId = new Map<string, ConnectorPrinterProfile>();
  for (const profile of store.printers) {
    byId.set(profile.id, profile);
  }

  // Refresh metadata for known printers, preserving the enable flag.
  for (const [id, profile] of byId) {
    const fresh = discoveredById.get(id);
    if (fresh) {
      byId.set(id, { ...fresh, enabledForUwe: profile.enabledForUwe });
    }
  }

  // Add newly discovered printers, disabled by default.
  for (const printer of normalizedDiscovered) {
    if (!byId.has(printer.id)) {
      byId.set(printer.id, { ...printer, enabledForUwe: false });
    }
  }

  return { ...store, printers: [...byId.values()] };
}

/** Printers the user has enabled for UWE, in stable order. */
export function enabledPrinters(store: ConnectorPrinterStore): ConnectorPrinterProfile[] {
  return store.printers.filter((printer) => printer.enabledForUwe);
}

/** Project a stored profile down to the plain `LocalPrinterInfo` sent on heartbeat. */
export function toLocalPrinterInfo(profile: ConnectorPrinterProfile): LocalPrinterInfo {
  const info: LocalPrinterInfo = { id: profile.id, name: profile.name };
  if (profile.description != null) info.description = profile.description;
  if (profile.isDefault != null) info.isDefault = profile.isDefault;
  if (profile.state != null) info.state = profile.state;
  return info;
}

export function printerStorePath(dataDir: string): string {
  return join(dataDir, PRINTER_STORE_FILENAME);
}

/**
 * Load and validate the printer store from disk. Returns the empty default when
 * the file is missing, unreadable, or corrupt so the connector always starts.
 */
export function loadPrinterStore(dataDir: string): ConnectorPrinterStore {
  let contents: string;
  try {
    contents = readFileSync(printerStorePath(dataDir), "utf8");
  } catch {
    return defaultPrinterStore();
  }

  let json: unknown;
  try {
    json = JSON.parse(contents);
  } catch {
    return defaultPrinterStore();
  }

  try {
    return parsePrinterStore(json);
  } catch {
    return defaultPrinterStore();
  }
}

/** Persist the printer store to disk, creating the data directory if needed. */
export function savePrinterStore(dataDir: string, store: ConnectorPrinterStore): void {
  const path = printerStorePath(dataDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}
