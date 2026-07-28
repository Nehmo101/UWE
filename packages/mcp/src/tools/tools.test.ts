import assert from "node:assert/strict";
import { createServer as createHttpServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import { createServer } from "../servers";
import type { McpServerDefinition, ToolResult } from "../protocol/types";

let server: Server;
let origin = "";

/** DM view: two dm_only entries plus one player_visible entry. */
const DM_BRAIN = {
  documents: [
    { id: "d1", title: "Geheimplan des Kults", visibility: "dm_only", category: "lore" },
    { id: "d2", title: "Stadtchronik", visibility: "player_visible", category: "lore" },
  ],
  facts: [{ id: "f1", title: "Der Verräter", visibility: "dm_only", factType: "npc" }],
  summary: { pages: 12 },
};

/** Player view as UWE's permission filter should produce it. */
const PLAYER_BRAIN = {
  documents: [{ id: "d2", title: "Stadtchronik", visibility: "player_visible", category: "lore" }],
  facts: [],
  summary: { pages: 12 },
};

/** Leaky player view — a dm_only entry survived filtering. */
const LEAKY_BRAIN = {
  documents: [
    { id: "d2", title: "Stadtchronik", visibility: "player_visible", category: "lore" },
    { id: "d1", title: "Geheimplan des Kults", visibility: "dm_only", category: "lore" },
  ],
  facts: [],
};

let leakMode = false;

before(async () => {
  server = createHttpServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const send = (payload: unknown) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify(payload));
    };

    if (url.pathname.endsWith("/brain")) {
      if (url.searchParams.get("accessContext") === "portal") {
        send(leakMode ? LEAKY_BRAIN : PLAYER_BRAIN);
        return;
      }
      send(DM_BRAIN);
      return;
    }

    if (url.pathname === "/api/life-brain/search") {
      send({
        documents: [
          {
            id: "p1",
            title: "Steuererklärung 2025",
            content: "Sehr private Notizen über Geld.",
            category: "finanzen",
            updatedAt: "2026-07-01T10:00:00.000Z",
          },
          {
            id: "p2",
            title: "Arzttermin",
            content: "Diagnose und Medikamente.",
            category: "gesundheit",
            updatedAt: "2026-07-20T10:00:00.000Z",
          },
        ],
        facts: [
          {
            id: "p3",
            title: "Blutgruppe",
            content: "0 negativ",
            factType: "gesundheit",
            updatedAt: "2026-06-01T10:00:00.000Z",
          },
        ],
      });
      return;
    }

    send({ ok: true, path: url.pathname });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  origin = typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function build(
  surface: "studio" | "portal" | "brain",
  env: NodeJS.ProcessEnv = {},
): McpServerDefinition {
  return createServer(surface, {
    UWE_STUDIO_URL: origin,
    UWE_PORTAL_URL: origin,
    UWE_BRAIN_URL: origin,
    UWE_MCP_TOKEN: "uwe_test_token",
    ...env,
  });
}

function toolNames(definition: McpServerDefinition): string[] {
  return definition.tools.map((tool) => tool.name);
}

async function call(
  definition: McpServerDefinition,
  name: string,
  args: Record<string, unknown> = {},
): Promise<ToolResult> {
  const tool = definition.tools.find((candidate) => candidate.name === name);
  assert.ok(tool, `Tool ${name} fehlt`);
  return tool.handler(args);
}

test("each server exposes its own namespaced tools and nothing from the others", () => {
  assert.equal(toolNames(build("studio")).every((name) => name.startsWith("studio_")), true);
  assert.equal(toolNames(build("portal")).every((name) => name.startsWith("portal_")), true);
  assert.equal(toolNames(build("brain")).every((name) => name.startsWith("brain_")), true);
});

test("every tool carries a description and an object schema", () => {
  for (const surface of ["studio", "portal", "brain"] as const) {
    for (const tool of build(surface).tools) {
      assert.ok(tool.description.length > 20, `${tool.name} braucht eine Beschreibung`);
      assert.equal(tool.inputSchema.type, "object");
    }
  }
});

test("Studio write tools are absent unless UWE_MCP_ALLOW_WRITES=true", () => {
  assert.equal(toolNames(build("studio")).includes("studio_create_brain_entry"), false);
  assert.equal(toolNames(build("studio")).includes("studio_enqueue_job"), false);

  const writable = toolNames(build("studio", { UWE_MCP_ALLOW_WRITES: "true" }));
  assert.equal(writable.includes("studio_create_brain_entry"), true);
  assert.equal(writable.includes("studio_enqueue_job"), true);
});

test("the Portal server registers no mutating tool at all", () => {
  const portal = build("portal", { UWE_MCP_ALLOW_WRITES: "true" });
  for (const tool of portal.tools) {
    assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name} müsste read-only sein`);
  }
});

test("Brain content tools stay locked until the owner opts in", () => {
  const locked = toolNames(build("brain"));
  assert.deepEqual(locked, ["brain_health", "brain_stats", "brain_privacy_status"]);
  assert.equal(locked.includes("brain_search"), false);
  assert.equal(locked.includes("brain_context"), false);

  const unlocked = toolNames(build("brain", { UWE_MCP_BRAIN_ALLOW_CONTENT: "true" }));
  assert.equal(unlocked.includes("brain_search"), true);
  assert.equal(unlocked.includes("brain_context"), true);
  assert.equal(unlocked.includes("brain_calendar"), true);
});

test("UWE_MCP_ALLOW_WRITES does not unlock Brain content", () => {
  assert.equal(toolNames(build("brain", { UWE_MCP_ALLOW_WRITES: "true" })).includes("brain_search"), false);
});

test("brain_stats reports counts without leaking titles or content", async () => {
  const result = await call(build("brain"), "brain_stats");
  const text = result.content[0]!.text;

  assert.equal(text.includes("Steuererklärung"), false);
  assert.equal(text.includes("Sehr private Notizen"), false);
  assert.equal(text.includes("Blutgruppe"), false);

  const stats = JSON.parse(text) as Record<string, unknown>;
  assert.equal(stats.documents, 2);
  assert.equal(stats.facts, 1);
  assert.deepEqual(stats.documentsByCategory, { finanzen: 1, gesundheit: 1 });
  assert.deepEqual(stats.factsByType, { gesundheit: 1 });
  assert.equal(stats.lastUpdated, "2026-07-20T10:00:00.000Z");
  assert.equal(stats.contentUnlocked, false);
});

test("brain_privacy_status states the lock and never prints the token", async () => {
  const locked = await call(build("brain"), "brain_privacy_status");
  assert.match(locked.content[0]!.text, /gesperrt — nur Metadaten/);
  assert.equal(locked.content[0]!.text.includes("uwe_test_token"), false);

  const unlocked = await call(
    build("brain", { UWE_MCP_BRAIN_ALLOW_CONTENT: "true" }),
    "brain_privacy_status",
  );
  assert.match(unlocked.content[0]!.text, /FREIGEGEBEN/);
});

test("portal_leak_check passes when the player view is properly filtered", async () => {
  leakMode = false;
  const result = await call(build("portal"), "portal_leak_check", { worldSlug: "aventurien" });

  assert.notEqual(result.isError, true);
  const report = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
  assert.equal(report.dmEntries, 3);
  assert.equal(report.playerEntries, 1);
  assert.equal(report.filteredOut, 2);
  assert.deepEqual(report.leakedTitles, []);
  assert.match(String(report.verdict), /^OK/);
});

test("portal_leak_check fails loudly when a dm_only entry reaches the player view", async () => {
  leakMode = true;
  const result = await call(build("portal"), "portal_leak_check", { worldSlug: "aventurien" });
  leakMode = false;

  assert.equal(result.isError, true);
  const report = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
  assert.deepEqual(report.leakedTitles, ["Geheimplan des Kults"]);
  assert.match(String(report.verdict), /^LEAK/);
});

test("player-view tools force the portal access context", async () => {
  const requested: string[] = [];
  const probe = createHttpServer((request, response) => {
    requested.push(request.url ?? "");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const address = probe.address();
  const probeOrigin = typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";

  const portal = createServer("portal", { UWE_STUDIO_URL: probeOrigin, UWE_PORTAL_URL: probeOrigin });
  await call(portal, "portal_player_view_brain", { worldSlug: "aventurien" });
  await call(portal, "portal_player_view_graph", { worldSlug: "aventurien" });

  await new Promise<void>((resolve) => probe.close(() => resolve()));

  assert.match(requested[0]!, /accessContext=portal/);
  assert.match(requested[1]!, /preview=player/);
});

test("missing required arguments produce an actionable error", async () => {
  const studio = build("studio");
  await assert.rejects(
    () => call(studio, "studio_world_brain", {}),
    /Argument "worldSlug" ist erforderlich/,
  );
});

test("world slugs are URL-encoded into the path", async () => {
  const requested: string[] = [];
  const probe = createHttpServer((request, response) => {
    requested.push(request.url ?? "");
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const address = probe.address();
  const probeOrigin = typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";

  const studio = createServer("studio", { UWE_STUDIO_URL: probeOrigin });
  await call(studio, "studio_world_brain", { worldSlug: "welt/../admin" });

  await new Promise<void>((resolve) => probe.close(() => resolve()));

  assert.match(requested[0]!, /welt%2F\.\.%2Fadmin/);
});

test("oversized payloads are truncated with a visible marker", async () => {
  const big = createHttpServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ blob: "x".repeat(5_000) }));
  });
  await new Promise<void>((resolve) => big.listen(0, "127.0.0.1", resolve));
  const address = big.address();
  const bigOrigin = typeof address === "object" && address ? `http://127.0.0.1:${address.port}` : "";

  const studio = createServer("studio", {
    UWE_STUDIO_URL: bigOrigin,
    UWE_MCP_MAX_RESPONSE_CHARS: "500",
  });
  const result = await call(studio, "studio_settings");

  await new Promise<void>((resolve) => big.close(() => resolve()));

  assert.match(result.content[0]!.text, /gekürzt/);
  assert.ok(result.content[0]!.text.length < 1_000);
});
