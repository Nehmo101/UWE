/**
 * Speech-to-text for the Brain assistant.
 *
 * The audio is handed to an online connector advertising `stt_local`, which runs
 * the owner's local speech engine (whisper.cpp, faster-whisper, …). Nothing
 * leaves the home network. The recording itself is never persisted — only the
 * transcript reaches the browser, and it lands in the composer for editing
 * rather than being sent straight to the model.
 */

import {
  isConnectorSttAvailable,
  runConnectorAudioTranscribe,
} from "@uwe/ai-brain/router";
import type { PrismaClient } from "@uwe/database/server";

/** Guard against a runaway recording turning into a huge base64 queue payload. */
export const ASSISTANT_MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export type TranscribeResult =
  | { kind: "completed"; text: string; model: string }
  | { kind: "unavailable"; message: string };

export interface TranscribeInput {
  buffer: Buffer;
  /** Browser-declared type, e.g. "audio/webm;codecs=opus". */
  mimeType: string;
  /** Model name from the hinterlegte KI; the engine picks its default when null. */
  model?: string | null;
  language?: string;
}

export async function transcribeAssistantAudio(
  db: PrismaClient,
  input: TranscribeInput,
): Promise<TranscribeResult> {
  if (input.buffer.length === 0) {
    return { kind: "unavailable", message: "Die Aufnahme ist leer." };
  }
  if (input.buffer.length > ASSISTANT_MAX_AUDIO_BYTES) {
    return { kind: "unavailable", message: "Die Aufnahme ist zu lang." };
  }

  if (!(await isConnectorSttAvailable(db))) {
    return {
      kind: "unavailable",
      message:
        "Keine lokale Spracherkennung verfügbar. Im Command Center ein STT-Kommando hinterlegen.",
    };
  }

  try {
    const result = await runConnectorAudioTranscribe(db, {
      audioBase64: input.buffer.toString("base64"),
      // Forward the *declared* type: audio/webm and video/webm share a magic
      // header, so the content-sniffed type would mislead the speech engine.
      mimeType: input.mimeType || "audio/webm",
      language: input.language ?? "de",
      ...(input.model ? { model: input.model } : {}),
    });

    if (!result.text.trim()) {
      return { kind: "unavailable", message: "Es wurde nichts erkannt." };
    }
    return { kind: "completed", text: result.text.trim(), model: result.model };
  } catch (error) {
    return {
      kind: "unavailable",
      message: error instanceof Error ? error.message : "Spracherkennung fehlgeschlagen.",
    };
  }
}
