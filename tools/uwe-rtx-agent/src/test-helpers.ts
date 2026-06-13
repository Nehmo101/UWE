import type { AddressInfo } from "node:net";

import type { AgentConfig } from "./config.js";
import { startAgentServer } from "./server.js";

export interface MockOllama {
  baseUrl: string;
  close: () => Promise<void>;
}

export function createTestConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    token: "test-token",
    enabled: true,
    ollamaBaseUrl: "http://127.0.0.1:11434",
    defaultModel: "llama3.2",
    logPrompts: false,
    allowedOrigins: ["http://localhost:3000"],
    requestTimeoutMs: 5_000,
    ...overrides,
  };
}

export async function startMockOllama(): Promise<MockOllama> {
  const http = await import("node:http");

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && url.pathname === "/api/tags") {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ models: [{ name: "llama3.2" }] }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/chat") {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        const parsed = JSON.parse(body) as {
          model?: string;
          messages?: Array<{ role: string; content: string }>;
        };
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(
          JSON.stringify({
            model: parsed.model ?? "llama3.2",
            message: {
              role: "assistant",
              content: `echo:${parsed.messages?.at(-1)?.content ?? ""}`,
            },
            done: true,
          }),
        );
      });
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export async function startTestAgent(config: AgentConfig): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const agent = await startAgentServer({ ...config, port: 0 });
  return agent;
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
