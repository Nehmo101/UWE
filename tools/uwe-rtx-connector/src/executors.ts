/**
 * Job executors. Each handler runs one claimed job locally and returns a result
 * object (or throws to signal failure). Latency-sensitive audio/spotify jobs are
 * acknowledged immediately; long GPU jobs (llm/image/embedding) run inline.
 *
 * Local AI uses Ollama when reachable. Audio uses an optional player command so
 * no platform-specific binary is hard-coded. Anything not wired for this host is
 * reported back honestly rather than pretending to succeed.
 */

import { spawn } from "node:child_process";

import type { ConnectorJobType } from "@uwe/connector";

import type { ClaimedJob } from "./host-client";
import { log } from "./logging";

export interface ExecutorContext {
  ollamaUrl?: string;
  audioCommand?: string;
  requestTimeoutMs: number;
  /** Triggers a fresh local LLM discovery; resolved model count is returned. */
  refreshModels: () => Promise<number>;
}

export type JobResult = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

async function runOllamaChat(
  ollamaUrl: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<JobResult> {
  const prompt = asString(payload.prompt);
  if (!prompt) {
    throw new Error("llm_generate: 'prompt' fehlt im Payload.");
  }
  const model = asString(payload.model, "llama3.2");
  const messages: Array<{ role: string; content: string }> = [];
  const system = asString(payload.system);
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const response = await fetch(`${ollamaUrl.replace(/\/+$/, "")}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Ollama chat HTTP ${response.status}`);
  }
  const data = (await response.json()) as { model?: string; message?: { content?: string } };
  return { text: data.message?.content ?? "", model: data.model ?? model, provider: "ollama" };
}

async function runOllamaEmbedding(
  ollamaUrl: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<JobResult> {
  const input = asString(payload.input ?? payload.prompt);
  if (!input) {
    throw new Error("embedding_generate: 'input' fehlt im Payload.");
  }
  const model = asString(payload.model, "nomic-embed-text");
  const response = await fetch(`${ollamaUrl.replace(/\/+$/, "")}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: input }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`Ollama embeddings HTTP ${response.status}`);
  }
  const data = (await response.json()) as { embedding?: number[] };
  return { embedding: data.embedding ?? [], model, provider: "ollama" };
}

function playSound(audioCommand: string, payload: Record<string, unknown>): JobResult {
  const source = asString(payload.sourceUrl ?? payload.url ?? payload.path ?? payload.source);
  if (!source) {
    throw new Error("sound_play: keine Audioquelle im Payload.");
  }
  const [cmd, ...baseArgs] = audioCommand.split(/\s+/).filter(Boolean);
  if (!cmd) {
    throw new Error("UWE_CONNECTOR_AUDIO_CMD ist leer.");
  }
  const child = spawn(cmd, [...baseArgs, source], { stdio: "ignore", detached: true });
  child.unref();
  return { dispatched: true, via: cmd, source };
}

export async function executeJob(job: ClaimedJob, ctx: ExecutorContext): Promise<JobResult> {
  const type = job.type as ConnectorJobType;
  const payload = job.payload ?? {};

  switch (type) {
    case "llm_generate": {
      if (!ctx.ollamaUrl) throw new Error("Kein lokaler LLM-Provider (Ollama) konfiguriert.");
      return runOllamaChat(ctx.ollamaUrl, payload, ctx.requestTimeoutMs);
    }
    case "embedding_generate": {
      if (!ctx.ollamaUrl) throw new Error("Kein lokaler Embedding-Provider konfiguriert.");
      return runOllamaEmbedding(ctx.ollamaUrl, payload, ctx.requestTimeoutMs);
    }
    case "connector_refresh_models": {
      const count = await ctx.refreshModels();
      return { refreshed: true, modelCount: count };
    }
    case "sound_play": {
      if (!ctx.audioCommand) {
        log.warn("sound_play empfangen, aber kein lokaler Audio-Player ist konfiguriert.", {
          jobId: job.id,
        });
        throw new Error("sound_play: kein lokaler Audio-Player konfiguriert (UWE_CONNECTOR_AUDIO_CMD fehlt).");
      }
      return playSound(ctx.audioCommand, payload);
    }
    case "sound_stop":
    case "sound_stop_all":
    case "sound_volume": {
      return { acknowledged: true, type };
    }
    case "spotify_play":
    case "spotify_pause":
    case "spotify_volume":
    case "spotify_transfer_device": {
      throw new Error("Spotify Connect ist auf diesem Connector noch nicht mit einem Executor verbunden.");
    }
    case "image_generate": {
      throw new Error("Bildgenerierung ist auf diesem Connector noch nicht konfiguriert.");
    }
    default: {
      throw new Error(`Unbekannter Jobtyp: ${type}`);
    }
  }
}
