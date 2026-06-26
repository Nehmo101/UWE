import { invoke } from "@tauri-apps/api/core";
import {
  defaultConnectorClientConfig,
  parseConnectorClientConfig,
  validateHostUrl,
  type ConnectorClientConfig,
  type ConnectorConnectionStatus,
  type ConnectorProcessStatus,
} from "@uwe/connector-client-config";

export interface ConnectorRuntimeStatus extends ConnectorProcessStatus {
  connectionStatus: ConnectorConnectionStatus;
  lastHeartbeatAt?: string | null;
}

export interface HostConnectionTestResult {
  ok: boolean;
  status: ConnectorConnectionStatus;
  message: string;
  checkedAt: string;
}

const MOCK_CONFIG_KEY = "uwe-rtx-connector-client:mock-config";
const MOCK_RUNNING_KEY = "uwe-rtx-connector-client:mock-running";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function nowTimestamp(): string {
  return new Date().toISOString();
}

function readMockConfig(): ConnectorClientConfig {
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

function writeMockConfig(config: ConnectorClientConfig): ConnectorClientConfig {
  const parsed = parseConnectorClientConfig(config);
  localStorage.setItem(MOCK_CONFIG_KEY, JSON.stringify(parsed));
  return parsed;
}

function readMockRunning(): boolean {
  return localStorage.getItem(MOCK_RUNNING_KEY) === "true";
}

function writeMockRunning(running: boolean): void {
  localStorage.setItem(MOCK_RUNNING_KEY, String(running));
}

function deriveConnectionStatus(
  config: ConnectorClientConfig,
  running: boolean,
): ConnectorConnectionStatus {
  if (!config.hostUrl || !config.token) {
    return "not_configured";
  }

  return running ? "connected" : "ready";
}

function buildMockRuntimeStatus(): ConnectorRuntimeStatus {
  const config = readMockConfig();
  const running = readMockRunning();

  return {
    status: running ? "running" : "stopped",
    message: running
      ? "Browser-Vorschau: Connector-Stub laeuft lokal im UI-Modus."
      : "Browser-Vorschau: Connector-Stub ist gestoppt.",
    connectionStatus: deriveConnectionStatus(config, running),
    lastHeartbeatAt: running ? nowTimestamp() : null,
  };
}

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriRuntime()) {
    return invoke<T>(command, args);
  }

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
      const validation = validateHostUrl(hostUrl);

      const result: HostConnectionTestResult = validation.ok
        ? {
            ok: true,
            status: "ready",
            message: `Browser-Vorschau: Host ${validation.normalized} sieht gueltig aus.`,
            checkedAt: nowTimestamp(),
          }
        : {
            ok: false,
            status: "error",
            message: validation.reason,
            checkedAt: nowTimestamp(),
          };

      return result as T;
    }
    default:
      throw new Error(`Unbekannter Mock-Befehl: ${command}`);
  }
}

export async function readConfig(): Promise<ConnectorClientConfig> {
  return invokeCommand<ConnectorClientConfig>("read_config");
}

export async function writeConfig(config: ConnectorClientConfig): Promise<ConnectorClientConfig> {
  return invokeCommand<ConnectorClientConfig>("write_config", { config });
}

export async function getConnectorStatus(): Promise<ConnectorRuntimeStatus> {
  return invokeCommand<ConnectorRuntimeStatus>("get_connector_status");
}

export async function startConnector(): Promise<ConnectorRuntimeStatus> {
  return invokeCommand<ConnectorRuntimeStatus>("start_connector");
}

export async function stopConnector(): Promise<ConnectorRuntimeStatus> {
  return invokeCommand<ConnectorRuntimeStatus>("stop_connector");
}

export async function testHostConnection(hostUrl: string): Promise<HostConnectionTestResult> {
  return invokeCommand<HostConnectionTestResult>("test_host_connection", { hostUrl });
}
