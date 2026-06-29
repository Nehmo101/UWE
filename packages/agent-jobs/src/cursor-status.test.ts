import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fetchCursorAgentStatus,
  mapCursorStatusToDevAgentStatus,
} from "./cursor-status";
import { resolveAgentJobsDispatchConfig } from "./index";

function configWithKey() {
  return resolveAgentJobsDispatchConfig({
    CURSOR_CLOUD_API_KEY: "key_test",
    CURSOR_CLOUD_API_URL: "https://api.cursor.com/v0/agents",
  } as NodeJS.ProcessEnv);
}

describe("mapCursorStatusToDevAgentStatus", () => {
  it("maps in-flight states to running", () => {
    for (const status of ["CREATING", "PENDING", "RUNNING", "running", "weird-unknown", ""]) {
      assert.equal(mapCursorStatusToDevAgentStatus(status), "running");
    }
    assert.equal(mapCursorStatusToDevAgentStatus(null), "running");
    assert.equal(mapCursorStatusToDevAgentStatus(undefined), "running");
  });

  it("maps finished states to completed", () => {
    for (const status of ["FINISHED", "completed", "Success"]) {
      assert.equal(mapCursorStatusToDevAgentStatus(status), "completed");
    }
  });

  it("maps error states to failed", () => {
    for (const status of ["ERROR", "EXPIRED", "cancelled", "FAILED"]) {
      assert.equal(mapCursorStatusToDevAgentStatus(status), "failed");
    }
  });
});

describe("fetchCursorAgentStatus", () => {
  it("requests GET /v0/agents/{id} and parses nested target fields", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      assert.equal(url, "https://api.cursor.com/v0/agents/bc_abc123");
      assert.equal(init?.method, "GET");
      return new Response(
        JSON.stringify({
          id: "bc_abc123",
          status: "RUNNING",
          summary: "Working on it",
          target: {
            branchName: "cursor/add-readme-1234",
            prUrl: "https://github.com/acme/repo/pull/7",
            url: "https://cursor.com/agents?id=bc_abc123",
          },
        }),
        { status: 200 },
      );
    };

    try {
      const result = await fetchCursorAgentStatus("bc_abc123", configWithKey());
      assert.equal(result.id, "bc_abc123");
      assert.equal(result.status, "RUNNING");
      assert.equal(result.branchName, "cursor/add-readme-1234");
      assert.equal(result.prUrl, "https://github.com/acme/repo/pull/7");
      assert.equal(result.url, "https://cursor.com/agents?id=bc_abc123");
      assert.equal(result.summary, "Working on it");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("falls back to top-level branch/PR fields when target is absent", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({ id: "bc_x", status: "FINISHED", branchName: "cursor/x", prUrl: "https://pr" }),
        { status: 200 },
      );
    try {
      const result = await fetchCursorAgentStatus("bc_x", configWithKey());
      assert.equal(result.branchName, "cursor/x");
      assert.equal(result.prUrl, "https://pr");
      assert.equal(mapCursorStatusToDevAgentStatus(result.status), "completed");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("throws when the API key is missing", async () => {
    const config = resolveAgentJobsDispatchConfig({} as NodeJS.ProcessEnv);
    await assert.rejects(() => fetchCursorAgentStatus("bc_abc123", config), /CURSOR_CLOUD_API_KEY/);
  });

  it("throws when the API returns an error", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("nope", { status: 404 });
    try {
      await assert.rejects(() => fetchCursorAgentStatus("missing", configWithKey()), /404/);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
