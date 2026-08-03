/**
 * Local speech-to-text executor for the `audio_transcribe` connector job.
 *
 * UWE deliberately ships no speech engine. Ollama has no audio endpoint, so —
 * exactly like `image_generate` — the owner points the connector at a command of
 * their choice (whisper.cpp, faster-whisper, …) via `UWE_CONNECTOR_STT_CMD`.
 * The command contract is JSON on stdin, JSON on stdout:
 *
 *   in : { "audioPath": "/tmp/uwe-stt-….webm", "mimeType": "audio/webm",
 *          "language": "de", "model": "large-v3-turbo" }
 *   out: { "text": "…", "model": "…" }
 *
 * The audio is handed over as a temp file rather than base64 on stdin because
 * every speech CLI expects a path, and a multi-megabyte stdin write is a common
 * source of pipe deadlocks. The file is always removed again.
 *
 * Audio never leaves the Maschinenraum host: the host enqueues the job, this runs locally,
 * only the transcript travels back.
 */

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface SpeechToTextContext {
  sttCommand: string;
  requestTimeoutMs: number;
}

export type SpeechToTextResult = Record<string, unknown>;

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Map a browser-declared audio MIME type to a container extension. */
export function audioExtensionForMimeType(mimeType: string): string {
  const base = mimeType.split(";")[0]?.trim().toLowerCase() ?? "";
  switch (base) {
    case "audio/webm":
    case "video/webm":
      return ".webm";
    case "audio/ogg":
      return ".ogg";
    case "audio/mp4":
    case "audio/m4a":
    case "audio/x-m4a":
      return ".m4a";
    case "audio/mpeg":
      return ".mp3";
    case "audio/wav":
    case "audio/x-wav":
      return ".wav";
    default:
      return ".webm";
  }
}

function splitCommand(command: string): [string, ...string[]] {
  const parts = command.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("audio_transcribe: STT-Kommando ist leer.");
  }
  return parts as [string, ...string[]];
}

function runSttCommand(
  command: string,
  input: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ text: string; model: string }> {
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
      reject(new Error("audio_transcribe: Spracherkennung hat das Timeout erreicht."));
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
        reject(
          new Error(`audio_transcribe: Executor Exit ${code}${stderr ? `: ${stderr.trim()}` : ""}`),
        );
        return;
      }
      const output = stdout.trim();
      if (!output) {
        reject(new Error("audio_transcribe: Executor lieferte keine Ausgabe."));
        return;
      }
      try {
        const parsed = JSON.parse(output) as { text?: unknown; model?: unknown };
        resolve({ text: asString(parsed.text), model: asString(parsed.model) });
      } catch {
        // Ein Executor, der reinen Text ausgibt, ist ebenfalls brauchbar.
        resolve({ text: output, model: "" });
      }
    });

    child.stdin.end(JSON.stringify(input));
  });
}

/** Execute one `audio_transcribe` job: temp file → STT command → transcript. */
export async function runAudioTranscribe(
  payload: Record<string, unknown>,
  ctx: SpeechToTextContext,
): Promise<SpeechToTextResult> {
  const audioBase64 = asString(payload.audio);
  if (!audioBase64) {
    throw new Error("audio_transcribe: 'audio' (Base64) fehlt im Payload.");
  }

  const mimeType = asString(payload.mimeType, "audio/webm");
  const requestedModel = asString(payload.model);
  const language = asString(payload.language, "de");

  const audioPath = path.join(
    os.tmpdir(),
    `uwe-stt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}${audioExtensionForMimeType(mimeType)}`,
  );

  await fs.writeFile(audioPath, Buffer.from(audioBase64, "base64"), { mode: 0o600 });
  try {
    const result = await runSttCommand(
      ctx.sttCommand,
      { audioPath, mimeType, language, ...(requestedModel ? { model: requestedModel } : {}) },
      ctx.requestTimeoutMs,
    );
    return {
      text: result.text,
      model: result.model || requestedModel,
      provider: "local_stt",
    };
  } finally {
    // Sprachaufnahmen sind privat — der Temp-File verschwindet auch im Fehlerfall.
    await fs.rm(audioPath, { force: true }).catch(() => undefined);
  }
}
