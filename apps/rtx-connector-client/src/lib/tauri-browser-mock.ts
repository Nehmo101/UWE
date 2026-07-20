import {
  createModelProfile,
  type ConnectorModelProfileStore,
} from "@uwe/connector-model-profile";
import { validateHostUrl, type ConnectorClientConfig } from "@uwe/connector-client-config";

import { buildMockCookbookDashboard, buildMockRunners, buildMockRuntimeStatus } from "./tauri-mock-fixtures";
import { buildMockHostAction, buildMockHostStatus, buildMockHostUpdate } from "./tauri-mock-host";
import {
  appendMockLog,
  nowTimestamp,
  readMockConfig,
  readMockLogs,
  readMockModelStore,
  readMockPrinterStore,
  writeMockConfig,
  writeMockModelStore,
  writeMockPrinterStore,
  writeMockRunning,
} from "./tauri-mock-storage";
import type { ConnectorPrinterStore, PullOllamaModelResult } from "./tauri-types";

export async function invokeBrowserMock<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  switch (command) {
    case "read_config":
      return readMockConfig() as T;
    case "write_config": {
      const config = writeMockConfig(args?.config as ConnectorClientConfig);
      return config as T;
    }
    case "get_connector_status":
      return buildMockRuntimeStatus() as T;
    case "start_connector": {
      writeMockRunning(true);
      return buildMockRuntimeStatus() as T;
    }
    case "stop_connector": {
      writeMockRunning(false);
      return buildMockRuntimeStatus() as T;
    }
    case "test_host_connection": {
      const hostUrl = typeof args?.hostUrl === "string" ? args.hostUrl : "";
      const token = typeof args?.token === "string" ? args.token : "";
      const validation = validateHostUrl(hostUrl);
      if (!validation.ok) {
        return {
          ok: false,
          status: "error",
          message: validation.reason,
          checkedAt: nowTimestamp(),
        } as T;
      }
      if (!token.trim()) {
        return {
          ok: false,
          status: "not_configured",
          message: "Connector-Token fehlt für den Verbindungstest.",
          checkedAt: nowTimestamp(),
        } as T;
      }
      return {
        ok: true,
        status: "ready",
        message: `Browser-Vorschau: Host ${validation.normalized} und Token-Format sehen gültig aus.`,
        checkedAt: nowTimestamp(),
      } as T;
    }
    case "get_model_store":
      return readMockModelStore() as T;
    case "save_model_store": {
      const store = writeMockModelStore(args?.store as ConnectorModelProfileStore);
      appendMockLog(`[models] Model-Store gespeichert (${store.profiles.length} Profile).`);
      return store as T;
    }
    case "scan_models": {
      const current = readMockModelStore();
      const profiles =
        current.profiles.length > 0
          ? current.profiles
          : [
              createModelProfile({
                provider: "ollama",
                source: "discovery",
                name: "llama3.1:8b",
                displayName: "llama3.1:8b",
                description: "Browser-Vorschauprofil für P1.",
                modelType: "chat",
              }),
            ];
      const store = writeMockModelStore({ ...current, profiles });
      appendMockLog(`[models] Scan ausgeführt (${store.profiles.length} Profile).`);
      return store as T;
    }
    case "get_printer_store":
      return readMockPrinterStore() as T;
    case "save_printer_store": {
      const store = writeMockPrinterStore(args?.store as ConnectorPrinterStore);
      appendMockLog(`[printers] Drucker-Store gespeichert (${store.printers.length} Drucker).`);
      return store as T;
    }
    case "scan_printers": {
      const current = readMockPrinterStore();
      const printers =
        current.printers.length > 0
          ? current.printers
          : [
              { id: "zebra-lp2844", name: "Zebra LP 2844 Label", state: "idle", enabledForUwe: false },
              { id: "hp-laserjet", name: "HP LaserJet", isDefault: true, state: "idle", enabledForUwe: false },
            ];
      const store = writeMockPrinterStore({ ...current, printers });
      appendMockLog(`[printers] Drucker-Scan simuliert (${store.printers.length} Drucker).`);
      return store as T;
    }
    case "pull_ollama_model": {
      const current = readMockModelStore();
      const name = typeof args?.name === "string" ? args.name.trim() : "";
      if (!name) {
        throw new Error("Mock pull: Modellname fehlt.");
      }
      const existing = current.profiles.find(
        (profile) => profile.provider === "ollama" && profile.name === name,
      );
      const store = writeMockModelStore({
        ...current,
        profiles: existing
          ? current.profiles
          : [
              ...current.profiles,
              createModelProfile({
                provider: "ollama",
                source: "discovery",
                name,
                displayName: name,
                description: "Per Browser-Mock hinzugefügt.",
                modelType: "chat",
              }),
            ],
      });
      const result: PullOllamaModelResult = {
        events: [
          { type: "progress", status: "pulling manifest", fraction: 0.15 },
          { type: "progress", status: "downloading layers", fraction: 0.72 },
          { type: "done", name },
        ],
        store,
      };
      appendMockLog(`[downloads] Ollama pull simuliert: ${name}`);
      return result as T;
    }
    case "list_connector_jobs":
      return [
        {
          id: "mock-job-1",
          type: "llm.generate",
          lane: "gpu",
          status: "completed",
          durationMs: 1820,
          finishedAt: nowTimestamp(),
        },
      ] as T;
    case "list_connector_logs": {
      const category = typeof args?.category === "string" ? args.category.trim() : "";
      const lines = readMockLogs();
      return (category ? lines.filter((line) => line.includes(`[${category}]`)) : lines) as T;
    }
    case "cookbook_dashboard":
      return buildMockCookbookDashboard() as T;
    case "probe_runners":
      return { runners: buildMockRunners() } as T;
    case "start_ollama":
      return {
        ok: false,
        started: false,
        alreadyRunning: false,
        message: "Browser-Vorschau: Ollama-Start ist nur in der Tauri-App auf dem RTX-PC verfügbar.",
        triedPaths: [],
      } as T;
    case "test_runner": {
      const id = typeof args?.runner === "string" ? args.runner.trim() : "ollama";
      const runner = buildMockRunners().find((entry) => entry.id === id) ?? buildMockRunners()[0];
      return runner as T;
    }
    case "spotify_auth_url": {
      const config = readMockConfig();
      if (!config.spotifyClientId) {
        throw new Error("Spotify-Client-ID fehlt — zuerst speichern.");
      }
      const params = new URLSearchParams({
        response_type: "code",
        client_id: config.spotifyClientId,
        redirect_uri: config.spotifyRedirectUri,
        scope: "user-modify-playback-state user-read-playback-state",
        state: "browser-preview",
        show_dialog: "false",
      });
      return {
        url: `https://accounts.spotify.com/authorize?${params.toString()}`,
        state: "browser-preview",
      } as T;
    }
    case "spotify_exchange_code":
      return {
        ok: false,
        message: "Browser-Vorschau: Spotify-Login funktioniert nur in der Tauri-App.",
      } as T;
    case "spotify_devices":
      return {
        ok: false,
        connected: false,
        devices: [],
        deviceId: null,
        message: "Browser-Vorschau: keine echten Spotify-Geräte ohne Tauri-Shell.",
      } as T;
    case "spotify_set_device":
      return { ok: false, message: "Browser-Vorschau: Spotify nicht verbunden." } as T;
    case "spotify_test":
      return { ok: false, message: "Browser-Vorschau: Spotify nicht verbunden." } as T;
    case "spotify_disconnect":
      return { ok: true, message: "Spotify getrennt (Browser-Vorschau)." } as T;
    case "test_audio": {
      const config = readMockConfig();
      return {
        ok: false,
        message: config.audioCommand
          ? "Browser-Vorschau: Audio-Test läuft nur in der Tauri-App auf dem RTX-PC."
          : "Kein Audio-Kommando konfiguriert.",
      } as T;
    }
    case "test_image": {
      const config = readMockConfig();
      return {
        ok: false,
        message: config.imageCommand
          ? "Browser-Vorschau: Image-Test läuft nur in der Tauri-App auf dem RTX-PC."
          : "Kein Image-Kommando konfiguriert.",
      } as T;
    }
    case "test_print": {
      const config = readMockConfig();
      return {
        ok: false,
        message: config.printCommand
          ? "Browser-Vorschau: Print-Test läuft nur in der Tauri-App auf dem RTX-PC."
          : "Kein Print-Kommando konfiguriert.",
      } as T;
    }
    case "get_host_status":
      return buildMockHostStatus(false) as T;
    case "setup_host":
      return buildMockHostAction("Browser-Vorschau: Einrichtung simuliert.") as T;
    case "start_host":
      return buildMockHostAction("Browser-Vorschau: UWE gestartet.", true) as T;
    case "stop_host":
      return buildMockHostAction("Browser-Vorschau: UWE gestoppt.") as T;
    case "restart_host":
      return buildMockHostAction("Browser-Vorschau: UWE neu gestartet.", true) as T;
    case "backup_host":
      return buildMockHostAction("Browser-Vorschau: Backup erstellt.") as T;
    case "check_host_update":
      return buildMockHostUpdate(false) as T;
    case "update_host":
      return buildMockHostAction("Browser-Vorschau: Update simuliert — UWE neu gebaut.") as T;
    case "get_host_logs":
      return {
        target: typeof args?.target === "string" ? args.target : "command-center",
        lines: ["[preview] UWE Command Center Browser-Vorschau."],
      } as T;
    case "open_host_target":
      return {
        ok: true,
        message: `Browser-Vorschau: ${args?.target === "portal" ? "Portal" : "Studio"} geöffnet.`,
      } as T;
    default:
      throw new Error(`Unbekannter Mock-Befehl: ${command}`);
  }
}
