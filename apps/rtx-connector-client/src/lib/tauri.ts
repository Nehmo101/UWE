import { invoke } from "@tauri-apps/api/core";
import { parseModelProfileStore } from "@uwe/connector-model-profile";

import { invokeBrowserMock } from "./tauri-browser-mock";
import {
  parseAuthUrl,
  parseCommandTest,
  parseCookbookDashboard,
  parseJobs,
  parseLogs,
  parsePrinterStore,
  parsePullResult,
  parseRunnerTest,
  parseRunners,
  parseSpotifyDevices,
  parseSpotifyStatus,
  parseStartOllama,
} from "./tauri-response-parsers";

export type * from "./tauri-types";

import type { ConnectorClientConfig } from "@uwe/connector-client-config";
import type { ConnectorModelProfileStore } from "@uwe/connector-model-profile";

function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauriRuntime()) {
    return invoke<T>(command, args);
  }
  return invokeBrowserMock<T>(command, args);
}

export async function readConfig(): Promise<ConnectorClientConfig> {
  return invokeCommand<ConnectorClientConfig>("read_config");
}

export async function writeConfig(config: ConnectorClientConfig): Promise<ConnectorClientConfig> {
  return invokeCommand<ConnectorClientConfig>("write_config", { config });
}

export async function getConnectorStatus() {
  return invokeCommand<import("./tauri-types").ConnectorRuntimeStatus>("get_connector_status");
}

export async function startConnector() {
  return invokeCommand<import("./tauri-types").ConnectorRuntimeStatus>("start_connector");
}

export async function stopConnector() {
  return invokeCommand<import("./tauri-types").ConnectorRuntimeStatus>("stop_connector");
}

export async function testHostConnection(hostUrl: string, token?: string) {
  return invokeCommand<import("./tauri-types").HostConnectionTestResult>("test_host_connection", {
    hostUrl,
    token,
  });
}

export async function getModelStore(): Promise<ConnectorModelProfileStore> {
  return parseModelProfileStore(await invokeCommand<unknown>("get_model_store"));
}

export async function saveModelStore(
  store: ConnectorModelProfileStore,
): Promise<ConnectorModelProfileStore> {
  return parseModelProfileStore(await invokeCommand<unknown>("save_model_store", { store }));
}

export async function scanModels(): Promise<ConnectorModelProfileStore> {
  return parseModelProfileStore(await invokeCommand<unknown>("scan_models"));
}

export async function getPrinterStore() {
  return parsePrinterStore(await invokeCommand<unknown>("get_printer_store"));
}

export async function savePrinterStore(store: import("./tauri-types").ConnectorPrinterStore) {
  return parsePrinterStore(await invokeCommand<unknown>("save_printer_store", { store }));
}

export async function scanPrinters() {
  return parsePrinterStore(await invokeCommand<unknown>("scan_printers"));
}

export async function pullOllamaModel(name: string) {
  return parsePullResult(await invokeCommand<unknown>("pull_ollama_model", { name }));
}

export async function deleteOllamaModel(name: string): Promise<ConnectorModelProfileStore> {
  return parseModelProfileStore(await invokeCommand<unknown>("delete_ollama_model", { name }));
}

export async function listConnectorJobs() {
  return parseJobs(await invokeCommand<unknown>("list_connector_jobs"));
}

export async function listConnectorLogs(category?: string): Promise<string[]> {
  return parseLogs(await invokeCommand<unknown>("list_connector_logs", { category }));
}

export async function getCookbookDashboard() {
  return parseCookbookDashboard(await invokeCommand<unknown>("cookbook_dashboard"));
}

export async function probeRunners() {
  return parseRunners(await invokeCommand<unknown>("probe_runners"));
}

export async function startOllama() {
  return parseStartOllama(await invokeCommand<unknown>("start_ollama"));
}

export async function testRunner(runner?: import("./tauri-types").RunnerId) {
  return parseRunnerTest(await invokeCommand<unknown>("test_runner", { runner }));
}

export async function spotifyAuthUrl() {
  return parseAuthUrl(await invokeCommand<unknown>("spotify_auth_url"));
}

export async function spotifyExchangeCode(code: string) {
  return parseSpotifyStatus(await invokeCommand<unknown>("spotify_exchange_code", { code }));
}

export async function spotifyDevices() {
  return parseSpotifyDevices(await invokeCommand<unknown>("spotify_devices"));
}

export async function spotifySetDevice(deviceId: string | null) {
  return parseSpotifyStatus(await invokeCommand<unknown>("spotify_set_device", { deviceId }));
}

export async function spotifyTest(action?: "play" | "pause") {
  return parseSpotifyStatus(await invokeCommand<unknown>("spotify_test", { action }));
}

export async function spotifyDisconnect() {
  return parseSpotifyStatus(await invokeCommand<unknown>("spotify_disconnect"));
}

export async function testAudio(source?: string) {
  return parseCommandTest(await invokeCommand<unknown>("test_audio", { source }));
}

export async function testImage(prompt?: string) {
  return parseCommandTest(await invokeCommand<unknown>("test_image", { prompt }));
}

export async function testPrint(printerId?: string) {
  return parseCommandTest(await invokeCommand<unknown>("test_print", { printerId }));
}

export async function getHostStatus(root?: string) {
  return invokeCommand<import("./tauri-types").LocalHostStatus>("get_host_status", { root });
}

export async function setupHost(root?: string) {
  return invokeCommand<import("./tauri-types").LocalHostActionResult>("setup_host", { root });
}

export async function startHost(root?: string) {
  return invokeCommand<import("./tauri-types").LocalHostActionResult>("start_host", { root });
}

export async function stopHost(root?: string) {
  return invokeCommand<import("./tauri-types").LocalHostActionResult>("stop_host", { root });
}

export async function restartHost(root?: string) {
  return invokeCommand<import("./tauri-types").LocalHostActionResult>("restart_host", { root });
}

export async function backupHost(root?: string) {
  return invokeCommand<import("./tauri-types").LocalHostActionResult>("backup_host", { root });
}

export async function getHostLogs(
  root?: string,
  target: "studio" | "portal" | "brain" | "command-center" = "command-center",
) {
  return invokeCommand<import("./tauri-types").LocalHostLogsResult>("get_host_logs", {
    root,
    target,
  });
}

export async function openHostTarget(root: string | undefined, target: "studio" | "portal" | "brain") {
  return invokeCommand<{ ok: boolean; message: string }>("open_host_target", { root, target });
}

export async function checkHostUpdate(root?: string) {
  return invokeCommand<import("./tauri-types").LocalHostUpdateInfo>("check_host_update", { root });
}

export async function updateHost(root?: string) {
  return invokeCommand<import("./tauri-types").LocalHostActionResult>("update_host", { root });
}

/**
 * Fully quit the Command Center. Only meaningful inside the Tauri runtime — in
 * the browser dev mock there is no process to exit, so this is a no-op there.
 */
export async function exitApp(): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke("exit_app");
}

// ── User / owner administration ────────────────────────────────────────────
export type CommandCenterUserRole = "owner" | "admin" | "dm" | "player" | "readonly" | "guest";

export interface CommandCenterUser {
  id: string;
  displayName: string;
  email: string | null;
  role: CommandCenterUserRole;
  status: string;
  hasPassword: boolean;
  createdAt: string;
}

export async function listUsers() {
  return invokeCommand<{ ok: boolean; users: CommandCenterUser[]; message?: string }>("list_users");
}

export async function createUser(user: {
  displayName: string;
  email: string;
  password: string;
  role: CommandCenterUserRole;
}) {
  return invokeCommand<{ ok: boolean; user?: CommandCenterUser; message?: string }>("create_user", {
    user,
  });
}

export async function setUserPassword(id: string, password: string) {
  return invokeCommand<{ ok: boolean; message?: string }>("set_user_password", {
    payload: { id, password },
  });
}

export async function deleteUser(id: string) {
  return invokeCommand<{ ok: boolean; deletedId?: string; message?: string }>("delete_user", { id });
}

// ── Cloudflare tunnel control ──────────────────────────────────────────────
export interface CloudflareTunnelStatus {
  ok: boolean;
  hasToken: boolean;
  running: boolean;
  pid: number | null;
  bin: string;
  message?: string;
}

export async function cloudflareStatus() {
  return invokeCommand<CloudflareTunnelStatus>("cloudflare_status");
}

export async function cloudflareSetToken(token: string) {
  return invokeCommand<{ ok: boolean; hasToken: boolean; message?: string }>("cloudflare_set_token", {
    token,
  });
}

export async function cloudflareClearToken() {
  return invokeCommand<{ ok: boolean; message?: string }>("cloudflare_clear_token");
}

export async function cloudflareStart() {
  return invokeCommand<{ ok: boolean; pid?: number; message?: string }>("cloudflare_start");
}

export async function cloudflareStop() {
  return invokeCommand<{ ok: boolean; message?: string }>("cloudflare_stop");
}
