/**
 * Behavior tests for the Tauri bridge (`src/lib/tauri.ts`).
 *
 * Two pure-logic layers are covered without a real Tauri shell:
 * 1. The response parsing layer — by installing a fake `window.__TAURI_INTERNALS__.invoke`
 *    (exactly what `@tauri-apps/api/core` delegates to) that returns malformed payloads.
 * 2. The browser-preview mock backend (localStorage persistence, host-connection
 *    validation, connector state machine) — by shimming `localStorage` in Node.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  getConnectorStatus,
  getCookbookDashboard,
  getHostLogs,
  checkHostUpdate,
  getHostStatus,
  listConnectorJobs,
  listConnectorLogs,
  startHost,
  updateHost,
  probeRunners,
  pullOllamaModel,
  readConfig,
  startConnector,
  startOllama,
  stopConnector,
  testHostConnection,
  testRunner,
  writeConfig,
} from "./tauri";
import { buildMockHostAction, buildMockHostStatus, buildMockHostUpdate } from "./tauri-mock-host";
import { defaultConnectorClientConfig } from "@uwe/connector-client-config";

type FakeInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

interface MutableGlobal {
  window?: { __TAURI_INTERNALS__: { invoke: FakeInvoke } };
  localStorage?: Storage;
}

const mutableGlobal = globalThis as unknown as MutableGlobal;

function createLocalStorageShim(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
  };
}

/** Route every `invoke` to a canned payload keyed by command name. */
function installFakeTauri(handlers: Record<string, unknown | FakeInvoke>): string[] {
  const calls: string[] = [];
  mutableGlobal.window = {
    __TAURI_INTERNALS__: {
      invoke: async (command, args) => {
        calls.push(command);
        const handler = handlers[command];
        if (handler === undefined) {
          throw new Error(`Unerwarteter Befehl im Test: ${command}`);
        }
        return typeof handler === "function" ? (handler as FakeInvoke)(command, args) : handler;
      },
    },
  };
  return calls;
}

const MOCK_CONFIG_KEY = "uwe-rtx-connector-client:mock-config";

beforeEach(() => {
  mutableGlobal.localStorage = createLocalStorageShim();
});

afterEach(() => {
  delete mutableGlobal.window;
  delete mutableGlobal.localStorage;
});

it("routes local host lifecycle commands through the desktop bridge", async () => {
  const status = buildMockHostStatus(true);
  const action = buildMockHostAction("UWE läuft.", true);
  const update = buildMockHostUpdate(true);
  const calls = installFakeTauri({
    get_host_status: status,
    start_host: action,
    get_host_logs: { target: "studio", lines: ["healthy"] },
    check_host_update: update,
    update_host: buildMockHostAction("UWE aktualisiert.", true),
  });

  const receivedStatus = await getHostStatus("C:\\git\\UWE");
  const receivedAction = await startHost("C:\\git\\UWE");
  const receivedLogs = await getHostLogs("C:\\git\\UWE", "studio");
  const receivedUpdateCheck = await checkHostUpdate("C:\\git\\UWE");
  const receivedUpdate = await updateHost("C:\\git\\UWE");

  assert.equal(receivedStatus.services.every((service) => service.healthy), true);
  assert.equal(receivedAction.message, "UWE läuft.");
  assert.deepEqual(receivedLogs, { target: "studio", lines: ["healthy"] });
  assert.equal(receivedUpdateCheck.updateAvailable, true);
  assert.equal(receivedUpdate.message, "UWE aktualisiert.");
  assert.deepEqual(calls, [
    "get_host_status",
    "start_host",
    "get_host_logs",
    "check_host_update",
    "update_host",
  ]);
});

describe("parsing layer (fake Tauri runtime)", () => {
  it("normalizes malformed job history entries", async () => {
    installFakeTauri({
      list_connector_jobs: [
        null,
        "not-an-object",
        { id: 42, status: "failed" },
        {
          id: "job-1",
          type: "llm.generate",
          lane: "gpu",
          status: "completed",
          durationMs: 1200,
          finishedAt: "2026-07-01T10:00:00.000Z",
        },
        { id: "job-2", status: "weird", durationMs: "fast" },
      ],
    });

    const jobs = await listConnectorJobs();

    assert.equal(jobs.length, 3, "non-object entries are dropped");
    assert.equal(jobs[0]?.id, "unknown", "non-string id falls back to 'unknown'");
    assert.equal(jobs[0]?.status, "failed");
    assert.deepEqual(jobs[1], {
      id: "job-1",
      type: "llm.generate",
      lane: "gpu",
      status: "completed",
      durationMs: 1200,
      reason: undefined,
      finishedAt: "2026-07-01T10:00:00.000Z",
    });
    assert.equal(jobs[2]?.status, "completed", "unknown status maps to completed");
    assert.equal(jobs[2]?.durationMs, 0, "non-numeric duration maps to 0");
    assert.equal(jobs[2]?.lane, "default");
  });

  it("accepts runner lists both as bare array and as { runners } envelope", async () => {
    installFakeTauri({
      probe_runners: [
        { id: "lm_studio", label: "LM Studio", status: "online", models: ["m1", 7], modelCount: 1 },
        { id: "unknown-runner", status: "sideways" },
      ],
    });

    const bare = await probeRunners();
    assert.equal(bare.length, 2);
    assert.equal(bare[0]?.id, "lm_studio");
    assert.equal(bare[0]?.status, "online");
    assert.deepEqual(bare[0]?.models, ["m1"], "non-string model names are dropped");
    assert.equal(bare[1]?.id, "ollama", "unknown runner id falls back to ollama");
    assert.equal(bare[1]?.status, "error", "unknown status falls back to error");
    assert.equal(bare[1]?.modelCount, null);

    installFakeTauri({
      probe_runners: { runners: [{ id: "llama_cpp", status: "offline" }] },
    });
    const wrapped = await probeRunners();
    assert.equal(wrapped.length, 1);
    assert.equal(wrapped[0]?.id, "llama_cpp");
    assert.equal(wrapped[0]?.status, "offline");
  });

  it("attaches speed results to runner tests only when present", async () => {
    installFakeTauri({
      test_runner: {
        id: "ollama",
        status: "online",
        speed: { ok: true, model: "llama3.1:8b", tokensPerSecond: 42.5, evalCount: 128 },
      },
    });
    const withSpeed = await testRunner("ollama");
    assert.equal(withSpeed.speed?.ok, true);
    assert.equal(withSpeed.speed?.tokensPerSecond, 42.5);

    installFakeTauri({ test_runner: { id: "ollama", status: "offline" } });
    const withoutSpeed = await testRunner("ollama");
    assert.equal("speed" in withoutSpeed, false);
  });

  it("filters malformed ollama pull events and parses the returned store", async () => {
    installFakeTauri({
      pull_ollama_model: {
        events: [
          { type: "progress", status: "pulling manifest", fraction: 0.1 },
          { type: "progress", status: 99, digest: 123 },
          { type: "done" },
          { type: "done", name: "llama3.1:8b" },
          "garbage",
        ],
        store: {
          version: 1,
          profiles: [{ provider: "ollama", name: "llama3.1:8b" }, { broken: true }],
          scanPaths: [],
        },
      },
    });

    const result = await pullOllamaModel("llama3.1:8b");

    assert.equal(result.events.length, 3, "done-without-name and non-objects are dropped");
    assert.deepEqual(result.events[0], {
      type: "progress",
      status: "pulling manifest",
      digest: undefined,
      total: undefined,
      completed: undefined,
      fraction: 0.1,
    });
    assert.equal(result.events[1]?.type, "progress");
    assert.equal((result.events[1] as { status: string }).status, "", "non-string status maps to empty");
    assert.deepEqual(result.events[2], { type: "done", name: "llama3.1:8b" });
    assert.equal(result.store.profiles.length, 1, "invalid profiles are dropped by the store parser");
    assert.equal(result.store.profiles[0]?.name, "llama3.1:8b");
  });

  it("returns a safe cookbook dashboard for an empty payload", async () => {
    installFakeTauri({ cookbook_dashboard: {} });

    const dashboard = await getCookbookDashboard();

    assert.equal(dashboard.hardware.platform, "unknown");
    assert.equal(dashboard.hardware.backend, "cpu");
    assert.equal(dashboard.hardware.gpuName, null);
    assert.deepEqual(dashboard.installedModels, []);
    assert.deepEqual(dashboard.recommendations, []);
    assert.deepEqual(dashboard.models, []);
  });
});

describe("browser-preview mock backend (no Tauri runtime)", () => {
  it("returns default config when nothing is persisted", async () => {
    assert.deepEqual(await readConfig(), defaultConnectorClientConfig());
  });

  it("falls back to defaults when persisted config JSON is corrupt", async () => {
    mutableGlobal.localStorage?.setItem(MOCK_CONFIG_KEY, "{not json");
    assert.deepEqual(await readConfig(), defaultConnectorClientConfig());
  });

  it("normalizes and persists config on write", async () => {
    const written = await writeConfig({
      ...defaultConnectorClientConfig(),
      hostUrl: "https://uwe.example.org/",
      token: "  uwec_secret  ",
    });

    assert.equal(written.hostUrl, "https://uwe.example.org", "trailing slash is stripped");
    assert.equal(written.token, "uwec_secret", "token is trimmed");
    assert.deepEqual(await readConfig(), written, "round-trips through storage");
  });

  it("walks the connector state machine: not_configured → ready → connected → ready", async () => {
    const unconfigured = await getConnectorStatus();
    assert.equal(unconfigured.status, "stopped");
    assert.equal(unconfigured.connectionStatus, "not_configured");
    assert.equal(unconfigured.lastHeartbeatAt, null);

    await writeConfig({
      ...defaultConnectorClientConfig(),
      hostUrl: "https://uwe.example.org",
      token: "uwec_secret",
    });
    const configured = await getConnectorStatus();
    assert.equal(configured.status, "stopped");
    assert.equal(configured.connectionStatus, "ready");

    const started = await startConnector();
    assert.equal(started.status, "running");
    assert.equal(started.connectionStatus, "connected");
    assert.ok(started.lastHeartbeatAt, "running connector reports a heartbeat");

    const stopped = await stopConnector();
    assert.equal(stopped.status, "stopped");
    assert.equal(stopped.connectionStatus, "ready");
    assert.equal(stopped.lastHeartbeatAt, null);
  });

  it("probeRunners returns runner probe rows from invoke", async () => {
    installFakeTauri({
      probe_runners: [
        { id: "ollama", label: "Ollama", online: true, endpoint: "http://127.0.0.1:11434" },
      ],
    });
    const rows = await probeRunners();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.id, "ollama");
  });

  it("validates host url and token in test_host_connection", async () => {
    const empty = await testHostConnection("");
    assert.equal(empty.ok, false);
    assert.equal(empty.status, "error");

    const badProtocol = await testHostConnection("ftp://uwe.example.org", "uwec_secret");
    assert.equal(badProtocol.ok, false);
    assert.equal(badProtocol.status, "error");

    const missingToken = await testHostConnection("https://uwe.example.org");
    assert.equal(missingToken.ok, false);
    assert.equal(missingToken.status, "not_configured");

    const valid = await testHostConnection("https://uwe.example.org/", "uwec_secret");
    assert.equal(valid.ok, true);
    assert.equal(valid.status, "ready");
    assert.ok(
      valid.message.includes("https://uwe.example.org"),
      "message reports the normalized host",
    );
  });

  it("adds a pulled ollama model to the store exactly once", async () => {
    const first = await pullOllamaModel("llama3.1:8b");
    assert.equal(first.store.profiles.length, 1);
    assert.equal(first.store.profiles[0]?.provider, "ollama");
    assert.equal(first.store.profiles[0]?.name, "llama3.1:8b");
    assert.deepEqual(first.events.at(-1), { type: "done", name: "llama3.1:8b" });

    const second = await pullOllamaModel("llama3.1:8b");
    assert.equal(second.store.profiles.length, 1, "pulling the same model does not duplicate it");

    await assert.rejects(pullOllamaModel("   "), /Modellname fehlt/);
  });

  it("filters connector logs by category", async () => {
    const all = await listConnectorLogs();
    assert.ok(all.length >= 3, "browser preview seeds fallback log lines");

    const models = await listConnectorLogs("models");
    assert.ok(models.length > 0);
    assert.ok(models.every((line) => line.includes("[models]")));

    const none = await listConnectorLogs("does-not-exist");
    assert.deepEqual(none, []);
  });

  it("reports ollama start as unavailable in the browser preview", async () => {
    const result = await startOllama();
    assert.equal(result.ok, false);
    assert.equal(result.started, false);
    assert.deepEqual(result.triedPaths, []);
  });
});
