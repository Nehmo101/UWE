import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import { configWarnings, isLoopbackOrigin, loadConfig, normalizeBaseUrl } from "./config";
import { UweHttpClient } from "./http";

interface CapturedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  origin: string | undefined;
  body: string;
}

let server: Server;
let baseUrl = "";
const captured: CapturedRequest[] = [];

before(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => {
      captured.push({
        method: request.method ?? "",
        url: request.url ?? "",
        authorization: request.headers.authorization,
        origin: request.headers.origin,
        body,
      });

      const path = new URL(request.url ?? "/", "http://localhost").pathname;
      if (path === "/api/forbidden") {
        response.writeHead(403, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ error: "Kein Studio-Zugriff für diese Rolle." }));
        return;
      }
      if (path === "/api/broken") {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.end("boom");
        return;
      }
      if (path === "/api/text") {
        response.writeHead(200, { "Content-Type": "text/plain" });
        response.end("ok");
        return;
      }
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ ok: true, path }));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function client(token: string | null = null, timeoutMs = 5_000): UweHttpClient {
  return new UweHttpClient({ baseUrl, token, label: "UWE Test" }, timeoutMs);
}

test("loadConfig falls back to the documented default ports", () => {
  assert.equal(loadConfig("studio", {}).primary.baseUrl, "http://127.0.0.1:3000");
  assert.equal(loadConfig("portal", {}).primary.baseUrl, "http://127.0.0.1:3001");
  assert.equal(loadConfig("brain", {}).primary.baseUrl, "http://127.0.0.1:3002");
});

test("Brain serves its own content API, Portal reads Studio's", () => {
  const env = { UWE_STUDIO_URL: "http://studio.local:3000", UWE_BRAIN_URL: "http://brain.local:3002" };

  // Seit Abschnitt H2 liegt /api/life-brain/* in Brain, nicht mehr in Studio.
  const brain = loadConfig("brain", env);
  assert.equal(brain.primary.baseUrl, "http://brain.local:3002");
  assert.equal(brain.dataApi.baseUrl, "http://brain.local:3002");

  // Die Spielersicht liest weiterhin über Studio — dort liegen die Welt-Inhalte.
  const portal = loadConfig("portal", env);
  assert.equal(portal.dataApi.baseUrl, "http://studio.local:3000");
});

test("Studio token resolution prefers the specific key over the shared fallbacks", () => {
  assert.equal(
    loadConfig("studio", { UWE_STUDIO_TOKEN: "a", UWE_MCP_TOKEN: "b", STUDIO_API_TOKEN: "c" }).primary.token,
    "a",
  );
  assert.equal(loadConfig("studio", { UWE_MCP_TOKEN: "b", STUDIO_API_TOKEN: "c" }).primary.token, "b");
  assert.equal(loadConfig("studio", { STUDIO_API_TOKEN: "c" }).primary.token, "c");
  assert.equal(loadConfig("studio", { UWE_STUDIO_TOKEN: "   " }).primary.token, null);
});

test("write and brain-content gates default to off and need the literal string true", () => {
  assert.equal(loadConfig("studio", {}).allowWrites, false);
  assert.equal(loadConfig("brain", {}).brainAllowContent, false);
  assert.equal(loadConfig("studio", { UWE_MCP_ALLOW_WRITES: "1" }).allowWrites, false);
  assert.equal(loadConfig("studio", { UWE_MCP_ALLOW_WRITES: "yes" }).allowWrites, false);
  assert.equal(loadConfig("studio", { UWE_MCP_ALLOW_WRITES: "true" }).allowWrites, true);
  assert.equal(loadConfig("brain", { UWE_MCP_BRAIN_ALLOW_CONTENT: "TRUE" }).brainAllowContent, true);
});

test("non-http origins fall back instead of being used", () => {
  assert.equal(normalizeBaseUrl("file:///etc/passwd", "http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  assert.equal(normalizeBaseUrl("not a url", "http://127.0.0.1:3000"), "http://127.0.0.1:3000");
  assert.equal(normalizeBaseUrl("https://uwe.example.org/", "http://x"), "https://uwe.example.org");
});

test("loopback detection drives the tokenless-access warning", () => {
  assert.equal(isLoopbackOrigin("http://127.0.0.1:3000"), true);
  assert.equal(isLoopbackOrigin("http://localhost:3000"), true);
  assert.equal(isLoopbackOrigin("https://uwe.example.org"), false);

  const remote = configWarnings(loadConfig("studio", { UWE_STUDIO_URL: "https://uwe.example.org" }));
  assert.equal(remote.length, 1);
  assert.match(remote[0]!, /nicht loopback/);
});

test("enabling writes or brain content is announced as a warning", () => {
  const warnings = configWarnings(
    loadConfig("brain", {
      UWE_MCP_TOKEN: "uwe_token",
      UWE_MCP_ALLOW_WRITES: "true",
      UWE_MCP_BRAIN_ALLOW_CONTENT: "true",
    }),
  );

  assert.equal(warnings.some((entry) => entry.includes("ALLOW_WRITES")), true);
  assert.equal(warnings.some((entry) => entry.includes("BRAIN_ALLOW_CONTENT")), true);
});

test("warnings never contain token material", () => {
  const warnings = configWarnings(
    loadConfig("studio", { UWE_STUDIO_URL: "https://uwe.example.org", UWE_STUDIO_TOKEN: "" }),
  );

  assert.equal(warnings.join(" ").includes("uwe_"), false);
});

test("requests send the bearer token and omit Origin so the CSRF guard treats them as non-browser", async () => {
  captured.length = 0;
  const result = await client("uwe_secret_token").request("/api/health");

  assert.equal(result.ok, true);
  assert.equal(captured[0]!.authorization, "Bearer uwe_secret_token");
  assert.equal(captured[0]!.origin, undefined);
});

test("no Authorization header is sent when no token is configured", async () => {
  captured.length = 0;
  await client(null).request("/api/health");

  assert.equal(captured[0]!.authorization, undefined);
});

test("query values are appended and empty values dropped", async () => {
  captured.length = 0;
  await client().request("/api/search", {
    query: { q: "drache", limit: 10, empty: "", missing: undefined, nothing: null, tags: ["a", "b"] },
  });

  const url = new URL(captured[0]!.url, "http://localhost");
  assert.equal(url.searchParams.get("q"), "drache");
  assert.equal(url.searchParams.get("limit"), "10");
  assert.equal(url.searchParams.has("empty"), false);
  assert.equal(url.searchParams.has("missing"), false);
  assert.equal(url.searchParams.has("nothing"), false);
  assert.deepEqual(url.searchParams.getAll("tags"), ["a", "b"]);
});

test("POST bodies are JSON-encoded", async () => {
  captured.length = 0;
  await client().request("/api/jobs", { method: "POST", body: { type: "export", title: "T" } });

  assert.equal(captured[0]!.method, "POST");
  assert.deepEqual(JSON.parse(captured[0]!.body), { type: "export", title: "T" });
});

test("UWE error envelopes surface as readable failures", async () => {
  const result = await client("uwe_secret_token").request("/api/forbidden");

  assert.equal(result.ok, false);
  assert.equal(result.ok === false && result.status, 403);
  assert.match(result.ok === false ? result.message : "", /403/);
  // The denial hint must never echo the token back to the model.
  assert.equal((result.ok === false ? result.message : "").includes("uwe_secret_token"), false);
});

test("non-JSON error bodies are truncated into the message", async () => {
  const result = await client().request("/api/broken");

  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /500.*boom/s);
});

test("plain-text success responses are passed through unparsed", async () => {
  const result = await client().request("/api/text");

  assert.equal(result.ok, true);
  assert.equal(result.ok === true && result.data, "ok");
});

test("an unreachable app produces a hint instead of a raw fetch error", async () => {
  const offline = new UweHttpClient(
    { baseUrl: "http://127.0.0.1:1", token: null, label: "UWE Studio" },
    500,
  );
  const result = await offline.request("/api/health");

  assert.equal(result.ok, false);
  assert.match(result.ok === false ? result.message : "", /nicht erreichbar/);
});
