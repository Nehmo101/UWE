/**
 * Attachment intake and analysis for the Brain assistant.
 *
 * Two stages, deliberately separated:
 *   1. `storeAssistantAttachment` — validate + write the file, at upload time.
 *   2. `extractAttachmentText`    — turn it into text, when the turn is sent.
 *
 * Stage 2 exists because no `AiProvider` in UWE accepts images: `GenerateTextOptions`
 * is `{model, prompt, systemPrompt, …}` and the connector's `llm_generate` payload
 * carries a plain prompt string. An image therefore has to be described by a
 * vision model first, and the description is injected as text. That is also why
 * the hinterlegte KI has a separate vision slot — a chat model is usually not
 * vision-capable.
 *
 * A failing attachment never aborts the turn: it degrades to an error note in
 * the prompt so the question still gets answered.
 */

import fs from "node:fs/promises";

import { runConnectorVisionExtract } from "@uwe/ai-brain/router";
import {
  buildSecureStorageKey,
  detectFileKind,
  downscaleImageForVision,
  ensureUploadDirectory,
  resolveAssetFilePath,
  resolveUploadPolicyConfig,
  UploadValidationError,
  validateUploadInput,
  type DetectedFileKind,
  type UploadPolicyConfig,
} from "@uwe/assets";
import { extractPdfText, type PrismaClient } from "@uwe/database/server";

import {
  ASSISTANT_UPLOAD_NAMESPACE,
  type AssistantAttachmentKind,
} from "./assistant-types";
import { ASSISTANT_VISION_DESCRIBE_PROMPT } from "./chat-prompt";

/** Images the assistant can hand to a vision model, plus readable documents. */
const ASSISTANT_UPLOAD_KINDS: ReadonlySet<DetectedFileKind> = new Set([
  "png",
  "jpeg",
  "webp",
  "gif",
  "pdf",
  "text",
]);

const IMAGE_KINDS: ReadonlySet<DetectedFileKind> = new Set(["png", "jpeg", "webp", "gif"]);

/** Vision jobs block the request — stay well under the tunnel's ~100 s edge timeout. */
const VISION_TIMEOUT_MS = 60_000;

export function assistantUploadPolicy(): UploadPolicyConfig {
  return {
    ...resolveUploadPolicyConfig(),
    allowedKinds: ASSISTANT_UPLOAD_KINDS,
    allowDocuments: true,
  };
}

export function attachmentKindForFileKind(kind: DetectedFileKind): AssistantAttachmentKind {
  return IMAGE_KINDS.has(kind) ? "image" : "document";
}

export interface StoredAssistantAttachment {
  kind: AssistantAttachmentKind;
  storageKey: string;
  mimeType: string;
  originalFilename: string;
  sizeBytes: number;
}

/**
 * Validate an uploaded file by content (not by its claimed type) and write it
 * under the assistant's own namespace in the uploads root.
 */
export async function storeAssistantAttachment(input: {
  buffer: Buffer;
  originalFilename: string | null;
  declaredMimeType: string | null;
  uploadsRoot?: string;
}): Promise<StoredAssistantAttachment> {
  const validated = validateUploadInput({
    buffer: input.buffer,
    originalFilename: input.originalFilename,
    declaredMimeType: input.declaredMimeType,
    worldId: ASSISTANT_UPLOAD_NAMESPACE,
    config: assistantUploadPolicy(),
  });

  ensureUploadDirectory(ASSISTANT_UPLOAD_NAMESPACE, undefined, input.uploadsRoot);
  const filePath = resolveAssetFilePath(validated.storageKey, undefined, input.uploadsRoot);
  await fs.writeFile(filePath, validated.buffer);

  return {
    kind: attachmentKindForFileKind(validated.kind),
    storageKey: validated.storageKey,
    mimeType: validated.mimeType,
    originalFilename: validated.originalFilename ?? `anhang${validated.extension}`,
    sizeBytes: validated.size,
  };
}

export interface ExtractAttachmentTextResult {
  text: string;
  /** Connector job id when a vision model produced the text. */
  jobId: string | null;
  /** Set when extraction failed — stored and shown, never thrown. */
  error: string | null;
}

export interface ExtractAttachmentTextInput {
  storageKey: string;
  mimeType: string;
  kind: AssistantAttachmentKind;
  /** Vision model name resolved from the hinterlegte KI; null uses the connector default. */
  visionModel: string | null;
  /** Free-text question, used as the vision prompt so the answer is on-topic. */
  prompt?: string;
  uploadsRoot?: string;
}

/**
 * Turn one stored attachment into prompt-ready text. Images go through the
 * connector's `vision_extract` job; PDFs through the text layer; anything else
 * is decoded as UTF-8.
 */
export async function extractAttachmentText(
  db: PrismaClient,
  input: ExtractAttachmentTextInput,
): Promise<ExtractAttachmentTextResult> {
  let buffer: Buffer;
  try {
    buffer = await fs.readFile(resolveAssetFilePath(input.storageKey, undefined, input.uploadsRoot));
  } catch {
    return { text: "", jobId: null, error: "Datei konnte nicht gelesen werden." };
  }

  if (input.kind === "image") {
    try {
      // Downscale first — the payload travels as base64 JSON through the queue.
      const vision = await downscaleImageForVision({ buffer, mimeType: input.mimeType });
      const job = await runConnectorVisionExtract(db, {
        prompt: input.prompt?.trim() || ASSISTANT_VISION_DESCRIBE_PROMPT,
        images: [vision.buffer.toString("base64")],
        mimeType: vision.mimeType,
        ...(input.visionModel ? { model: input.visionModel } : {}),
        timeoutMs: VISION_TIMEOUT_MS,
      });
      if (!job.text.trim()) {
        return { text: "", jobId: job.jobId, error: "Das Vision-Modell lieferte keinen Text." };
      }
      return { text: job.text, jobId: job.jobId, error: null };
    } catch (error) {
      return {
        text: "",
        jobId: null,
        error: error instanceof Error ? error.message : "Bildanalyse fehlgeschlagen.",
      };
    }
  }

  const detected = detectFileKind(buffer).kind;
  if (detected === "pdf") {
    try {
      const text = await extractPdfText(buffer);
      return text.trim()
        ? { text, jobId: null, error: null }
        : { text: "", jobId: null, error: "Das PDF enthält keine Textebene." };
    } catch (error) {
      return {
        text: "",
        jobId: null,
        error: error instanceof Error ? error.message : "PDF konnte nicht gelesen werden.",
      };
    }
  }

  const text = buffer.toString("utf8");
  return text.trim()
    ? { text, jobId: null, error: null }
    : { text: "", jobId: null, error: "Die Datei enthält keinen lesbaren Text." };
}

export { UploadValidationError, buildSecureStorageKey };
