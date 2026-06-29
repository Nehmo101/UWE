/**
 * Job executors. Each handler runs one claimed job locally and returns a result
 * object (or throws to signal failure). Latency-sensitive audio/spotify jobs are
 * acknowledged immediately; long GPU jobs (llm/image/embedding) run inline.
 *
 * Local AI uses Ollama when reachable. Audio uses an optional player command so
 * no platform-specific binary is hard-coded. Spotify and image generation are
 * only executable when their explicit local backends are configured.
 */

import { spawn } from "node:child_process";

import type { ConnectorJobType } from "@uwe/connector";

import type { ClaimedJob } from "./host-client";
import { log } from "./logging";
import { runLabelPrintJob, runPrinterDiscover } from "./label-printing";

export interface ExecutorContext {
  ollamaUrl?: string;
  audioCommand?: string;
  spotifyAccessToken?: string;
  spotifyDeviceId?: string;
  imageCommand?: string;
  printCommand?: string;
  hostUrl?: string;
  connectorToken?: string;
  requestTimeoutMs: number;
  /** Triggers a fresh local LLM discovery; resolved model count is returned. */
  refreshModels: () => Promise<number>;
}

export type JobResult = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

function splitCommand(command: string): [string, ...string[]] {
  const parts = command.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("Executor-Kommando ist leer.");
  }
  return parts as [string, ...string[]];
}

function playSound(audioCommand: string, payload: Record<string, unknown>): JobResult {
  const source = asString(payload.sourceUrl ?? payload.url ?? payload.path ?? payload.source);
  if (!source) {
    throw new Error("sound_play: keine Audioquelle im Payload.");
  }
  const [cmd, ...baseArgs] = splitCommand(audioCommand);
  const child = spawn(cmd, [...baseArgs, source], { stdio: "ignore", detached: true });
  child.unref();
  return { dispatched: true, via: cmd, source };
}

async function spotifyRequest(
  ctx: ExecutorContext,
  path: string,
  init: RequestInit,
): Promise<JobResult> {
  if (!ctx.spotifyAccessToken || !ctx.spotifyDeviceId) {
    throw new Error("Spotify Connect ist nicht konfiguriert (Token oder Device-ID fehlt).");
  }
  const response = await fetch(`https://api.spotify.com/v1/me/player${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ctx.spotifyAccessToken}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(ctx.requestTimeoutMs),
  });
  if (!response.ok && response.status !== 204) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Spotify Connect HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return { dispatched: true, provider: "spotify", deviceId: ctx.spotifyDeviceId };
}

async function runSpotifyJob(
  type: ConnectorJobType,
  payload: Record<string, unknown>,
  ctx: ExecutorContext,
): Promise<JobResult> {
  const rawDeviceId = asString(payload.deviceId, ctx.spotifyDeviceId ?? "");
  const deviceId = encodeURIComponent(rawDeviceId);
  if (!deviceId) {
    throw new Error("Spotify Connect: Device-ID fehlt.");
  }

  switch (type) {
    case "spotify_play": {
      const uris = Array.isArray(payload.uris)
        ? payload.uris.filter((uri): uri is string => typeof uri === "string")
        : undefined;
      const body: Record<string, unknown> = {};
      const uri = asString(payload.uri);
      const contextUri = asString(payload.contextUri ?? payload.context_uri);
      const positionMs = asNumber(payload.positionMs ?? payload.position_ms);
      if (uris?.length) body.uris = uris;
      if (uri) body.uris = [uri];
      if (contextUri) body.context_uri = contextUri;
      if (positionMs != null) body.position_ms = Math.max(0, Math.round(positionMs));
      const hasBody = Object.keys(body).length > 0;
      return {
        ...(await spotifyRequest(ctx, `/play?device_id=${deviceId}`, {
          method: "PUT",
          body: hasBody ? JSON.stringify(body) : undefined,
        })),
        action: "play",
      };
    }
    case "spotify_pause": {
      return {
        ...(await spotifyRequest(ctx, `/pause?device_id=${deviceId}`, { method: "PUT" })),
        action: "pause",
      };
    }
    case "spotify_volume": {
      const rawVolume = asNumber(payload.volume ?? payload.volumePercent ?? payload.volume_percent);
      if (rawVolume == null) throw new Error("spotify_volume: 'volume' fehlt im Payload.");
      const percent = rawVolume <= 1 ? rawVolume * 100 : rawVolume;
      const volumePercent = Math.max(0, Math.min(100, Math.round(percent)));
      return {
        ...(await spotifyRequest(ctx, `/volume?volume_percent=${volumePercent}&device_id=${deviceId}`, {
          method: "PUT",
        })),
        action: "volume",
        volumePercent,
      };
    }
    case "spotify_transfer_device": {
      return {
        ...(await spotifyRequest(ctx, "", {
          method: "PUT",
          body: JSON.stringify({ device_ids: [rawDeviceId], play: Boolean(payload.play) }),
        })),
        action: "transfer_device",
      };
    }
    default:
      throw new Error(`Unbekannter Spotify-Jobtyp: ${type}`);
  }
}

async function runCommandWithJson(
  command: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
): Promise<JobResult> {
  const [cmd, ...args] = splitCommand(command);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGTERM");
      reject(new Error("image_generate: lokaler Image-Executor hat das Timeout erreicht."));
    }, timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error(`image_generate: Executor Exit ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
        return;
      }
      const output = stdout.trim();
      if (!output) {
        resolve({ dispatched: true, via: cmd });
        return;
      }
      try {
        const parsed = JSON.parse(output) as JobResult;
        resolve({ dispatched: true, via: cmd, ...parsed });
      } catch {
        resolve({ dispatched: true, via: cmd, output });
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
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
      return runSpotifyJob(type, payload, ctx);
    }
    case "image_generate": {
      if (!ctx.imageCommand) {
        throw new Error("Bildgenerierung ist nicht konfiguriert (UWE_CONNECTOR_IMAGE_CMD fehlt).");
      }
      return runCommandWithJson(ctx.imageCommand, payload, ctx.requestTimeoutMs);
    }
    case "label_print": { if (!ctx.hostUrl||!ctx.connectorToken) throw new Error("label_print: missing host/token"); return runLabelPrintJob(payload,{hostUrl:ctx.hostUrl,connectorToken:ctx.connectorToken,printCommand:ctx.printCommand,requestTimeoutMs:ctx.requestTimeoutMs,jobId:job.id}); }
    case "printer_discover": return runPrinterDiscover();
    default: {
      throw new Error(`Unbekannter Jobtyp: ${type}`);
    }
  }
}
