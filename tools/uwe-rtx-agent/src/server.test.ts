import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { HealthResponse } from "./types.js";
import {
  createTestConfig,
  readJson,
  startMockOllama,
  startTestAgent,
} from "./test-helpers.js";

function authHeaders(token = "test-token"): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

describe("server", () => {
  it("returns ready health when Ollama mock is reachable", async () => {
    const mockOllama = await startMockOllama();
    const config = createTestConfig({ ollamaBaseUrl: mockOllama.baseUrl, port: 0 });
    const agent = await startTestAgent(config);

    try {
      const response = await fetch(`${agent.baseUrl}/health`, { headers: authHeaders() });
      assert.equal(response.status, 200);
      const payload = await readJson<HealthResponse>(response);
      assert.equal(payload.status, "ready");
      assert.equal(payload.enabled, true);
      assert.equal(payload.backend, "ollama");
      assert.equal(payload.gpu, "rtx");
    } finally {
      await agent.close();
      await mockOllama.close();
    }
  });

  it("returns error health when backend is offline", async () => {
    const config = createTestConfig({ ollamaBaseUrl: "http://127.0.0.1:1", port: 0 });
    const agent = await startTestAgent(config);

    try {
      const response = await fetch(`${agent.baseUrl}/health`, { headers: authHeaders() });
      assert.equal(response.status, 503);
      const payload = await readJson<HealthResponse>(response);
      assert.equal(payload.status, "error");
      assert.match(payload.message, /Ollama/i);
    } finally {
      await agent.close();
    }
  });

  it("returns disabled health and blocks chat when agent is disabled", async () => {
    const mockOllama = await startMockOllama();
    const config = createTestConfig({
      enabled: false,
      ollamaBaseUrl: mockOllama.baseUrl,
      port: 0,
    });
    const agent = await startTestAgent(config);

    try {
      const health = await fetch(`${agent.baseUrl}/health`, { headers: authHeaders() });
      const healthPayload = await readJson<HealthResponse>(health);
      assert.equal(healthPayload.status, "disabled");
      assert.equal(healthPayload.enabled, false);

      const chat = await fetch(`${agent.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-token",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "hello" }],
        }),
      });
      assert.equal(chat.status, 403);
    } finally {
      await agent.close();
      await mockOllama.close();
    }
  });

  it("blocks chat without token", async () => {
    const mockOllama = await startMockOllama();
    const config = createTestConfig({ ollamaBaseUrl: mockOllama.baseUrl, port: 0 });
    const agent = await startTestAgent(config);

    try {
      const response = await fetch(`${agent.baseUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "hello" }],
        }),
      });
      assert.equal(response.status, 401);
      const payload = await readJson<{ error: string }>(response);
      assert.equal(payload.error, "missing_token");
    } finally {
      await agent.close();
      await mockOllama.close();
    }
  });

  it("blocks chat with invalid token", async () => {
    const mockOllama = await startMockOllama();
    const config = createTestConfig({ ollamaBaseUrl: mockOllama.baseUrl, port: 0 });
    const agent = await startTestAgent(config);

    try {
      const response = await fetch(`${agent.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer wrong-token",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "hello" }],
        }),
      });
      assert.equal(response.status, 401);
      const payload = await readJson<{ error: string }>(response);
      assert.equal(payload.error, "invalid_token");
    } finally {
      await agent.close();
      await mockOllama.close();
    }
  });

  it("returns starting health while backend boot command is pending", async () => {
    const config = createTestConfig({
      ollamaBaseUrl: "http://127.0.0.1:1",
      startOllamaCommand: process.platform === "win32" ? "timeout /t 30 /nobreak" : "sleep 30",
      port: 0,
    });
    const agent = await startTestAgent(config);

    try {
      const response = await fetch(`${agent.baseUrl}/health`, { headers: authHeaders() });
      const payload = await readJson<HealthResponse>(response);
      assert.equal(payload.status, "starting");
      assert.match(payload.message, /starting/i);
    } finally {
      await agent.close();
    }
  });

  it("proxies chat to Ollama mock with valid token", async () => {
    const mockOllama = await startMockOllama();
    const config = createTestConfig({ ollamaBaseUrl: mockOllama.baseUrl, port: 0 });
    const agent = await startTestAgent(config);

    try {
      const response = await fetch(`${agent.baseUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Token": "test-token",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "ping" }],
          model: "llama3.2",
        }),
      });

      assert.equal(response.status, 200);
      const payload = await readJson<{ message: { content: string } }>(response);
      assert.equal(payload.message.content, "echo:ping");
    } finally {
      await agent.close();
      await mockOllama.close();
    }
  });
});
