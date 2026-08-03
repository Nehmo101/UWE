import {
  defaultConnectorClientConfig,
  parseConnectorClientConfig,
  type ConnectorClientConfig,
} from "@uwe/connector-client-config";
import {
  defaultModelProfileStore,
  parseModelProfileStore,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";

import { parsePrinterStore } from "./tauri-response-parsers";
import type { ConnectorPrinterStore } from "./tauri-types";

const MOCK_CONFIG_KEY = "uwe-engine-connector-client:mock-config";
const MOCK_RUNNING_KEY = "uwe-engine-connector-client:mock-running";
const MOCK_MODEL_STORE_KEY = "uwe-engine-connector-client:mock-model-store";
const MOCK_PRINTER_STORE_KEY = "uwe-engine-connector-client:mock-printer-store";
const MOCK_LOGS_KEY = "uwe-engine-connector-client:mock-logs";

export function nowTimestamp(): string {
  return new Date().toISOString();
}

export function readMockConfig(): ConnectorClientConfig {
  const raw = localStorage.getItem(MOCK_CONFIG_KEY);
  if (!raw) {
    return defaultConnectorClientConfig();
  }
  try {
    return parseConnectorClientConfig(JSON.parse(raw));
  } catch {
    return defaultConnectorClientConfig();
  }
}

export function writeMockConfig(config: ConnectorClientConfig): ConnectorClientConfig {
  const parsed = parseConnectorClientConfig(config);
  localStorage.setItem(MOCK_CONFIG_KEY, JSON.stringify(parsed));
  return parsed;
}

export function readMockRunning(): boolean {
  return localStorage.getItem(MOCK_RUNNING_KEY) === "true";
}

export function writeMockRunning(running: boolean): void {
  localStorage.setItem(MOCK_RUNNING_KEY, String(running));
}

export function readMockModelStore(): ConnectorModelProfileStore {
  const raw = localStorage.getItem(MOCK_MODEL_STORE_KEY);
  if (!raw) {
    return defaultModelProfileStore();
  }
  try {
    return parseModelProfileStore(JSON.parse(raw));
  } catch {
    return defaultModelProfileStore();
  }
}

export function writeMockModelStore(store: ConnectorModelProfileStore): ConnectorModelProfileStore {
  const parsed = parseModelProfileStore(store);
  localStorage.setItem(MOCK_MODEL_STORE_KEY, JSON.stringify(parsed));
  return parsed;
}

export function readMockPrinterStore(): ConnectorPrinterStore {
  const raw = localStorage.getItem(MOCK_PRINTER_STORE_KEY);
  if (!raw) {
    return { version: 1, printers: [] };
  }
  try {
    return parsePrinterStore(JSON.parse(raw));
  } catch {
    return { version: 1, printers: [] };
  }
}

export function writeMockPrinterStore(store: ConnectorPrinterStore): ConnectorPrinterStore {
  const parsed = parsePrinterStore(store);
  localStorage.setItem(MOCK_PRINTER_STORE_KEY, JSON.stringify(parsed));
  return parsed;
}

export function readMockLogs(): string[] {
  const raw = localStorage.getItem(MOCK_LOGS_KEY);
  if (!raw) {
    const fallback = [
      "[connection] Browser-Vorschau aktiv.",
      "[models] Keine echten lokalen Modelle ohne Tauri-Shell.",
      "[jobs] Job-Historie ist im Browser-Mock statisch.",
    ];
    localStorage.setItem(MOCK_LOGS_KEY, JSON.stringify(fallback));
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function appendMockLog(line: string): void {
  const next = [...readMockLogs(), line].slice(-200);
  localStorage.setItem(MOCK_LOGS_KEY, JSON.stringify(next));
}
