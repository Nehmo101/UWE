import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  measureOllamaTokensPerSecond,
  probeRunner,
  probeRunners,
  resolveRunnerConfig,
  startOllamaOnWindows,
} from "./runner-admin";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

function fetchRouter(routes: Record<string, () => Response | Promise<Response>>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [needle, handler] of Object.entries(routes)) {
      if (url.includes(needle)) {
        return handler();
      }
    }
    throw new Error(`ECONNREFUSED ${url}`);
  }) as unknown as typeof fetch;
}

describe("resolveRunnerConfig", () => {
  it("defaults to localhost ports per runner", () => {
    const config = resolveRunnerConfig({});
    assert.equal(config.ollamaUrl, "http://127.0.0.1:11434");
    assert.equal(config.lmStudioUrl, "http://127.0.0.1:1234");
    assert.equal(config.llamaCppUrl, "http://127.0.0.1:8080");
  });

  it("honours env overrides", () => {
    const config = resolveRunnerConfig({ OLLAMA_BASE_URL: "http://10.0.0.5:11434/" });
    assert.equal(config.ollamaUrl, "http://10.0.0.5:11434/");
  });
});

describe("probeRunners", () => {
  it("reports online status and model lists across runner types", async () => {
    const fetchImpl = fetchRouter({
      "/api/tags": () => jsonResponse({ models: [{ name: "llama3.2:latest" }, { name: "qwen2.5:7b" }] }),
      "/v1/models": () => jsonResponse({ data: [{ id: "lmstudio-model" }] }),
    });

    const results = await probeRunners(resolveRunnerConfig({}), fetchImpl);
    const byId = Object.fromEntries(results.map((r) => [r.id, r]));

    assert.equal(byId.ollama.status, "online");
    assert.deepEqual(byId.ollama.models, ["llama3.2:latest", "qwen2.5:7b"]);
    assert.equal(byId.ollama.modelCount, 2);

    assert.equal(byId.lm_studio.status, "online");
    assert.equal(byId.lm_studio.modelCount, 1);
    assert.equal(byId.llama_cpp.status, "online");
  });

  it("marks unreachable runners offline", async () => {
    const fetchImpl = fetchRouter({});
    const results = await probeRunners(resolveRunnerConfig({}), fetchImpl);
    for (const result of results) {
      assert.equal(result.status, "offline");
      assert.equal(result.modelCount, null);
      assert.deepEqual(result.models, []);
    }
  });

  it("classifies HTTP error responses as error", async () => {
    const fetchImpl = fetchRouter({ "/api/tags": () => jsonResponse({}, 500) });
    const result = await probeRunner("ollama", resolveRunnerConfig({}), fetchImpl);
    assert.equal(result.status, "offline");
  });
});

describe("startOllamaOnWindows", () => {
  it("short-circuits when Ollama already answers", async () => {
    const fetchImpl = fetchRouter({ "/api/tags": () => jsonResponse({ models: [] }) });
    const result = await startOllamaOnWindows({ platform: "win32", fetchImpl });
    assert.equal(result.alreadyRunning, true);
    assert.equal(result.started, false);
    assert.equal(result.ok, true);
  });

  it("returns a friendly no-op on non-Windows platforms", async () => {
    const fetchImpl = fetchRouter({});
    const result = await startOllamaOnWindows({ platform: "linux", fetchImpl });
    assert.equal(result.ok, false);
    assert.equal(result.started, false);
    assert.match(result.message, /Windows/);
  });

  it("spawns the first existing Windows executable", async () => {
    const fetchImpl = fetchRouter({});
    const spawned: Array<{ command: string; args: string[] }> = [];
    const result = await startOllamaOnWindows({
      platform: "win32",
      env: { ProgramFiles: "C:\\Program Files", LOCALAPPDATA: "C:\\Users\\x\\AppData\\Local" },
      fetchImpl,
      existsImpl: (path) => path === "C:\\Program Files\\Ollama\\ollama.exe",
      spawnImpl: (command, args) => {
        spawned.push({ command, args });
        return true;
      },
    });

    assert.equal(result.started, true);
    assert.equal(result.ok, true);
    assert.equal(spawned.length, 1);
    assert.equal(spawned[0].command, "C:\\Program Files\\Ollama\\ollama.exe");
    assert.deepEqual(spawned[0].args, ["serve"]);
  });

  it("reports a clear message when no executable is found", async () => {
    const fetchImpl = fetchRouter({});
    const result = await startOllamaOnWindows({
      platform: "win32",
      env: { ProgramFiles: "C:\\Program Files" },
      fetchImpl,
      existsImpl: () => false,
      spawnImpl: () => true,
    });

    assert.equal(result.ok, false);
    assert.equal(result.started, false);
    assert.match(result.message, /nicht gefunden/);
    assert.ok(result.triedPaths.length > 0);
  });
});

describe("measureOllamaTokensPerSecond", () => {
  it("computes tokens/s from eval_count and eval_duration", async () => {
    const fetchImpl = fetchRouter({
      "/api/generate": () => jsonResponse({ eval_count: 100, eval_duration: 2_000_000_000 }),
    });
    const result = await measureOllamaTokensPerSecond("llama3.2", "hi", {
      config: resolveRunnerConfig({}),
      fetchImpl,
    });
    assert.equal(result.ok, true);
    assert.equal(result.evalCount, 100);
    assert.equal(result.tokensPerSecond, 50);
  });

  it("returns null tokens/s on failure", async () => {
    const fetchImpl = fetchRouter({});
    const result = await measureOllamaTokensPerSecond("llama3.2", "hi", {
      config: resolveRunnerConfig({}),
      fetchImpl,
    });
    assert.equal(result.ok, false);
    assert.equal(result.tokensPerSecond, null);
  });

  it("rejects a blank model name without calling the network", async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return jsonResponse({});
    }) as unknown as typeof fetch;
    const result = await measureOllamaTokensPerSecond("   ", undefined, { fetchImpl });
    assert.equal(result.ok, false);
    assert.equal(called, false);
  });
});
