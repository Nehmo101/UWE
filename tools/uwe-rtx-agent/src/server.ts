import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";

import { disableAutostart, enableAutostart, getAutostartStatus } from "./autostart.js";
import { verifyToken } from "./auth.js";
import { BackendManager } from "./backend-manager.js";
import type { AgentConfig } from "./config.js";
import { setAgentEnabled } from "./config.js";
import { buildHealthResponse, buildTrayStatusResponse } from "./health.js";
import { appendAgentLog } from "./logging.js";
import { chatWithOllama, deleteOllamaModel, listOllamaModels, pullOllamaModel, summarizeMessages } from "./ollama.js";
import { generateDiffusionImage } from "./diffusion.js";
import { getEnvFilePath } from "./paths.js";
import { setPersistedEnabled } from "./state.js";
import type { ChatRequest, ErrorResponse } from "./types.js";

export interface AgentServer {
  baseUrl: string;
  close(): Promise<void>;
}

export async function startAgentServer(config: AgentConfig): Promise<AgentServer> {
  const backend = new BackendManager(config);

  return new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        await handleRequest(request, response, config, backend);
      } catch (error) {
        appendAgentLog(`Unhandled server error: ${String(error)}`);
        sendJson(response, 500, {
          error: "internal_error",
          message: "Unexpected server error",
        } satisfies ErrorResponse);
      }
    });

    server.on("error", reject);
    server.listen(config.port, config.host, () => {
      const address = server.address() as AddressInfo;
      const host = config.host === "0.0.0.0" ? "127.0.0.1" : config.host;
      appendAgentLog(`Agent listening on ${config.host}:${address.port}`);
      resolve({
        baseUrl: `http://${host}:${address.port}`,
        close: () => closeAgentServer(server, backend),
      });
    });
  });
}

async function closeAgentServer(server: Server, backend: BackendManager): Promise<void> {
  backend.stop();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  config: AgentConfig,
  backend: BackendManager,
): Promise<void> {
  const method = request.method ?? "GET";
  const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

  if (method === "OPTIONS") {
    sendCors(response, config);
    response.writeHead(204);
    response.end();
    return;
  }

  if (pathname === "/health" && method === "GET") {
    const health = await buildHealthResponse(config, backend);
    const statusCode = health.status === "error" ? 503 : 200;
    sendJson(response, statusCode, health);
    return;
  }

  if (pathname === "/api/status" && method === "GET") {
    if (!authorizeLocalControl(request, config)) {
      const auth = verifyToken(request, config.token);
      sendJson(response, 401, {
        error: auth.ok ? "unauthorized" : auth.reason === "missing" ? "missing_token" : "invalid_token",
        message: "Invalid agent token",
      } satisfies ErrorResponse);
      return;
    }

    const status = await buildTrayStatusResponse(config, backend);
    sendJson(response, 200, status);
    return;
  }

  if (pathname.startsWith("/api/control/")) {
    if (!authorizeLocalControl(request, config)) {
      const auth = verifyToken(request, config.token);
      sendJson(response, 401, {
        error: auth.ok ? "unauthorized" : auth.reason === "missing" ? "missing_token" : "invalid_token",
        message: "Invalid agent token",
      } satisfies ErrorResponse);
      return;
    }

    if (pathname === "/api/control/enable" && method === "POST") {
      setPersistedEnabled(true);
      setAgentEnabled(config, true);
      appendAgentLog("Agent enabled via control API.");
      sendJson(response, 200, { ok: true, enabled: true });
      return;
    }

    if (pathname === "/api/control/disable" && method === "POST") {
      setPersistedEnabled(false);
      setAgentEnabled(config, false);
      appendAgentLog("Agent disabled via control API.");
      sendJson(response, 200, { ok: true, enabled: false });
      return;
    }

    if (pathname === "/api/control/restart-backend" && method === "POST") {
      appendAgentLog("Restarting local AI backend.");
      await backend.restartBackend();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (pathname === "/api/control/autostart" && method === "GET") {
      sendJson(response, 200, getAutostartStatus());
      return;
    }

    if (pathname === "/api/control/autostart" && method === "POST") {
      const body = await readJsonBody<{ enabled?: boolean }>(request);
      const status = body.enabled ? enableAutostart() : disableAutostart();
      sendJson(response, 200, status);
      return;
    }

    if (pathname === "/api/control/open-config" && method === "POST") {
      sendJson(response, 200, { path: getEnvFilePath() });
      return;
    }
  }

  if (pathname === "/chat" && method === "POST") {
    const auth = verifyToken(request, config.token);
    if (!auth.ok) {
      sendJson(response, 401, {
        error: auth.reason === "missing" ? "missing_token" : "invalid_token",
        message: auth.reason === "missing" ? "Missing agent token" : "Invalid agent token",
      } satisfies ErrorResponse);
      return;
    }

    if (!config.enabled) {
      sendJson(response, 403, {
        error: "disabled",
        message: "RTX Agent disabled by user",
      } satisfies ErrorResponse);
      return;
    }

    const backendState = await backend.refresh();
    if (backendState !== "ready") {
      sendJson(response, 503, {
        error: "backend_unavailable",
        message: backendState === "starting" ? "Local AI backend is starting" : "Ollama not reachable",
      } satisfies ErrorResponse);
      return;
    }

    const chatRequest = await readJsonBody<ChatRequest>(request);
    if (!chatRequest.messages?.length) {
      sendJson(response, 400, {
        error: "invalid_request",
        message: "messages are required",
      } satisfies ErrorResponse);
      return;
    }

    if (config.logPrompts) {
      appendAgentLog(`Chat request summary: ${summarizeMessages(chatRequest.messages)}`);
    }

    const chatResponse = await chatWithOllama(config, chatRequest);
    sendJson(response, 200, chatResponse);
    return;
  }

  if (pathname === "/api/models" && method === "GET") {
    const auth = verifyToken(request, config.token);
    if (!auth.ok) {
      sendJson(response, 401, {
        error: "invalid_token",
        message: "Invalid agent token",
      } satisfies ErrorResponse);
      return;
    }
    const models = await listOllamaModels(config.ollamaBaseUrl, config.requestTimeoutMs);
    sendJson(response, 200, { models });
    return;
  }

  if (pathname === "/api/models/pull" && method === "POST") {
    const auth = verifyToken(request, config.token);
    if (!auth.ok) {
      sendJson(response, 401, { error: "invalid_token", message: "Invalid agent token" } satisfies ErrorResponse);
      return;
    }
    const body = await readJsonBody<{ model?: string }>(request);
    if (!body.model?.trim()) {
      sendJson(response, 400, { error: "invalid_request", message: "model is required" } satisfies ErrorResponse);
      return;
    }
    await pullOllamaModel(config.ollamaBaseUrl, body.model.trim(), config.requestTimeoutMs);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname.startsWith("/api/models/") && method === "DELETE") {
    const auth = verifyToken(request, config.token);
    if (!auth.ok) {
      sendJson(response, 401, { error: "invalid_token", message: "Invalid agent token" } satisfies ErrorResponse);
      return;
    }
    const model = decodeURIComponent(pathname.slice("/api/models/".length));
    if (!model) {
      sendJson(response, 400, { error: "invalid_request", message: "model is required" } satisfies ErrorResponse);
      return;
    }
    await deleteOllamaModel(config.ollamaBaseUrl, model, config.requestTimeoutMs);
    sendJson(response, 200, { ok: true });
    return;
  }

  if (pathname === "/api/hardware" && method === "GET") {
    const auth = verifyToken(request, config.token);
    if (!auth.ok) {
      sendJson(response, 401, { error: "invalid_token", message: "Invalid agent token" } satisfies ErrorResponse);
      return;
    }
    sendJson(response, 200, {
      totalRamGb: Math.round(os.totalmem() / 1024 ** 3),
      freeRamGb: Math.round(os.freemem() / 1024 ** 3),
      cpus: os.cpus().length,
      platform: os.platform(),
      gpu: "rtx",
    });
    return;
  }

  if (pathname === "/v1/images" && method === "POST") {
    const auth = verifyToken(request, config.token);
    if (!auth.ok) {
      sendJson(response, 401, {
        error: "invalid_token",
        message: "Invalid agent token",
      } satisfies ErrorResponse);
      return;
    }

    const body = await readJsonBody<{
      task?: string;
      prompt?: string;
      source_image?: string;
      mask?: string;
    }>(request);

    if (!body.prompt?.trim() && body.task !== "remove_background") {
      sendJson(response, 400, {
        error: "invalid_request",
        message: "prompt is required",
      } satisfies ErrorResponse);
      return;
    }

    const result = await generateDiffusionImage(
      {
        prompt: body.prompt?.trim() ?? "",
        task: body.task,
        sourceImageBase64: body.source_image,
        maskBase64: body.mask,
      },
      {
        diffusionApiUrl: process.env.DIFFUSION_API_URL?.trim(),
        ollamaBaseUrl: config.ollamaBaseUrl,
        ollamaImageModel: process.env.OLLAMA_IMAGE_MODEL?.trim(),
        timeoutMs: config.requestTimeoutMs,
      },
    );

    sendJson(response, 200, {
      image: result.imageBase64,
      mime_type: result.mimeType,
      task: body.task ?? "generate",
      provider: result.provider,
      note: result.note,
    });
    return;
  }

  sendJson(response, 404, {
    error: "not_found",
    message: "Route not found",
  } satisfies ErrorResponse);
}

function authorizeLocalControl(request: IncomingMessage, config: AgentConfig): boolean {
  const auth = verifyToken(request, config.token);
  return auth.ok;
}

function sendCors(response: ServerResponse, config: AgentConfig): void {
  const origin = config.allowedOrigins.join(", ");
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Agent-Token");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(body);
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return {} as T;
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}
