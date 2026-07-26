/**
 * Connector queue provider — local AI inference via the outbound RTX Host
 * Connector queue instead of a direct HTTP call to a local inference server.
 *
 * The UWE host enqueues an `llm_generate` / `embedding_generate` job and waits
 * for an online connector to claim, run and complete it. This keeps inference
 * fully outbound (no inbound RTX Agent) while reusing the existing connector
 * registry, capability gating and job queue.
 *
 * Only used when an online connector advertises the required effective
 * capability (`llm_local` / `embedding_local`); otherwise the router falls back
 * to the direct local provider.
 */

import {
  ConnectorJobWaitError,
  createConnectorService,
  createConnectorWorkflowService,
  waitForConnectorJob,
  type ConnectorWorkflowSlot,
  type PrismaClient,
} from "@uwe/database/server";

import {
  capabilityForJobType,
  type ConnectorCapability,
  type ConnectorJobType,
} from "@uwe/connector";

import {
  DirectConnectorDispatchError,
  getDirectConnectorRegistry,
} from "@uwe/connector/direct";

import type { ImageStudioRequest, ImageStudioResult } from "@uwe/image-studio";

import type { AiProviderId, AiTaskType, GenerateTextResult } from "../../types";

const CONNECTOR_LLM_TIMEOUT_MS = 120_000;
const CONNECTOR_IMAGE_TIMEOUT_MS = 300_000;
// Dictation is short and a user is staring at the button — fail fast instead of
// letting a dead endpoint hold the request open for two minutes.
const CONNECTOR_STT_TIMEOUT_MS = 60_000;
const CONNECTOR_POLL_INTERVAL_MS = 500;

type ConnectorDelivery = "direct" | "queue";

interface ConnectorDispatchOutcome {
  operationId: string;
  result: unknown;
  delivery: ConnectorDelivery;
  connectorId?: string;
}

interface ConnectorDispatchInput {
  type: ConnectorJobType;
  payload: Record<string, unknown>;
  worldId?: string;
  timeoutMs: number;
}

function canFallBackToQueue(error: unknown): boolean {
  // Once accepted, execution may already have side effects and must never be queued.
  return error instanceof DirectConnectorDispatchError && !error.accepted;
}

async function isQueueCapabilityAvailable(
  prisma: PrismaClient,
  capability: ConnectorCapability,
): Promise<boolean> {
  const summary = await createConnectorService(prisma).summarize();
  return summary.connectors.some(
    (connector) =>
      connector.queueEnabled &&
      (connector.status === "online" || connector.status === "degraded") &&
      connector.capabilities.includes(capability),
  );
}

async function dispatchConnectorRequest(
  prisma: PrismaClient,
  input: ConnectorDispatchInput,
): Promise<ConnectorDispatchOutcome> {
  try {
    const direct = await getDirectConnectorRegistry().dispatch({
      type: input.type,
      payload: input.payload,
      worldId: input.worldId,
      timeoutMs: input.timeoutMs,
      idempotencyKey: crypto.randomUUID(),
    });
    return {
      operationId: direct.requestId,
      result: direct.result,
      delivery: "direct",
      connectorId: direct.connectorId,
    };
  } catch (error) {
    if (!canFallBackToQueue(error)) {
      throw error;
    }

    const capability = capabilityForJobType(input.type);
    if (!(await isQueueCapabilityAvailable(prisma, capability))) {
      // Direct-only connectors must fail fast instead of leaving an unclaimable
      // job behind. Preserve the direct error and its accepted/request metadata.
      throw error;
    }
  }

  const service = createConnectorService(prisma);
  const job = await service.enqueueJob({
    type: input.type,
    payload: input.payload,
    worldId: input.worldId ?? null,
  });
  const completed = await waitForConnectorJob(prisma, job.id, {
    timeoutMs: input.timeoutMs,
    intervalMs: CONNECTOR_POLL_INTERVAL_MS,
  });
  return { operationId: job.id, result: completed.result, delivery: "queue" };
}

export interface ConnectorLlmInput {
  prompt: string;
  system?: string;
  model?: string;
  worldId?: string;
  timeoutMs?: number;
  maxTokens?: number;
}

export interface ConnectorLlmResult {
  text: string;
  model: string;
  jobId: string;
  delivery: ConnectorDelivery;
}

export interface ConnectorEmbeddingInput {
  input: string;
  model?: string;
  worldId?: string;
  timeoutMs?: number;
}

export interface ConnectorEmbeddingResult {
  embedding: number[];
  model: string;
  jobId: string;
  delivery: ConnectorDelivery;
}

function resultRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** True when an online (or degraded) connector advertises local vision inference. */
export async function isConnectorVisionAvailable(prisma: PrismaClient): Promise<boolean> {
  return (
    getDirectConnectorRegistry().hasCapability("vision_local") ||
    (await isQueueCapabilityAvailable(prisma, "vision_local"))
  );
}

export interface ConnectorVisionInput {
  prompt: string;
  images: string[];
  model?: string;
  provider?: string;
  mimeType?: string;
  worldId?: string;
  timeoutMs?: number;
  maxTokens?: number;
}

export interface ConnectorVisionResult {
  text: string;
  model: string;
  jobId: string;
  delivery: ConnectorDelivery;
}

/**
 * Enqueue a `vision_extract` job and wait for a connector to complete it.
 * Host callers supply domain-specific payload fields (downscaled images, prompts).
 */
export async function runConnectorVisionExtract(
  prisma: PrismaClient,
  input: ConnectorVisionInput,
): Promise<ConnectorVisionResult> {
  const payload: Record<string, unknown> = {
    prompt: input.prompt,
    images: input.images,
  };
  if (input.model?.trim()) payload.model = input.model.trim();
  if (input.provider?.trim()) payload.provider = input.provider.trim();
  if (input.mimeType?.trim()) payload.mimeType = input.mimeType.trim();
  if (input.maxTokens != null) payload.maxTokens = input.maxTokens;

  const dispatched = await dispatchConnectorRequest(prisma, {
    type: "vision_extract",
    payload,
    worldId: input.worldId,
    timeoutMs: input.timeoutMs ?? CONNECTOR_LLM_TIMEOUT_MS,
  });

  const result = resultRecord(dispatched.result);
  const text = typeof result.text === "string" ? result.text : "";
  const model =
    typeof result.model === "string" && result.model.trim()
      ? result.model
      : (input.model?.trim() ?? "");
  return { text, model, jobId: dispatched.operationId, delivery: dispatched.delivery };
}

/** True when an online (or degraded) connector advertises local transcription. */
export async function isConnectorSttAvailable(prisma: PrismaClient): Promise<boolean> {
  return (
    getDirectConnectorRegistry().hasCapability("stt_local") ||
    (await isQueueCapabilityAvailable(prisma, "stt_local"))
  );
}

export interface ConnectorTranscribeInput {
  /** Base64-encoded audio payload (the browser records `audio/webm`). */
  audioBase64: string;
  mimeType: string;
  model?: string;
  /** BCP-47 hint for the recognizer, e.g. "de". */
  language?: string;
  timeoutMs?: number;
}

export interface ConnectorTranscribeResult {
  text: string;
  model: string;
  jobId: string;
  delivery: ConnectorDelivery;
}

/**
 * Enqueue an `audio_transcribe` job and wait for a connector to complete it.
 * The connector runs a local speech-to-text endpoint; no audio ever leaves the
 * home network.
 */
export async function runConnectorAudioTranscribe(
  prisma: PrismaClient,
  input: ConnectorTranscribeInput,
): Promise<ConnectorTranscribeResult> {
  const payload: Record<string, unknown> = {
    audio: input.audioBase64,
    mimeType: input.mimeType,
  };
  if (input.model?.trim()) payload.model = input.model.trim();
  if (input.language?.trim()) payload.language = input.language.trim();

  const dispatched = await dispatchConnectorRequest(prisma, {
    type: "audio_transcribe",
    payload,
    timeoutMs: input.timeoutMs ?? CONNECTOR_STT_TIMEOUT_MS,
  });

  const result = resultRecord(dispatched.result);
  const text = typeof result.text === "string" ? result.text : "";
  const model =
    typeof result.model === "string" && result.model.trim()
      ? result.model
      : (input.model?.trim() ?? "");
  return { text, model, jobId: dispatched.operationId, delivery: dispatched.delivery };
}

/** True when an online (or degraded) connector advertises local LLM inference. */
export async function isConnectorLlmAvailable(prisma: PrismaClient): Promise<boolean> {
  return (
    getDirectConnectorRegistry().hasCapability("llm_local") ||
    (await isQueueCapabilityAvailable(prisma, "llm_local"))
  );
}

/** True when an online (or degraded) connector advertises local embeddings. */
export async function isConnectorEmbeddingAvailable(prisma: PrismaClient): Promise<boolean> {
  return (
    getDirectConnectorRegistry().hasCapability("embedding_local") ||
    (await isQueueCapabilityAvailable(prisma, "embedding_local"))
  );
}

/** True when an online (or degraded) connector advertises local image generation. */
export async function isConnectorImageAvailable(prisma: PrismaClient): Promise<boolean> {
  return (
    getDirectConnectorRegistry().hasCapability("image_generation") ||
    (await isQueueCapabilityAvailable(prisma, "image_generation"))
  );
}

/**
 * Enqueue an `llm_generate` job and wait for a connector to complete it.
 * Throws `ConnectorJobWaitError` on failure/expiry/timeout.
 */
export async function runConnectorLlmGenerate(
  prisma: PrismaClient,
  input: ConnectorLlmInput,
): Promise<ConnectorLlmResult> {
  const payload: Record<string, unknown> = { prompt: input.prompt };
  if (input.system?.trim()) payload.system = input.system;
  if (input.model?.trim()) payload.model = input.model.trim();
  if (input.maxTokens != null) payload.maxTokens = input.maxTokens;

  const dispatched = await dispatchConnectorRequest(prisma, {
    type: "llm_generate",
    payload,
    worldId: input.worldId,
    timeoutMs: input.timeoutMs ?? CONNECTOR_LLM_TIMEOUT_MS,
  });

  const result = resultRecord(dispatched.result);
  const text = typeof result.text === "string" ? result.text : "";
  const model =
    typeof result.model === "string" && result.model.trim()
      ? result.model
      : (input.model?.trim() ?? "");
  return { text, model, jobId: dispatched.operationId, delivery: dispatched.delivery };
}

/**
 * Enqueue an `embedding_generate` job and wait for a connector to complete it.
 * Throws `ConnectorJobWaitError` on failure/expiry/timeout.
 */
export async function runConnectorEmbeddingGenerate(
  prisma: PrismaClient,
  input: ConnectorEmbeddingInput,
): Promise<ConnectorEmbeddingResult> {
  const payload: Record<string, unknown> = { input: input.input };
  if (input.model?.trim()) payload.model = input.model.trim();

  const dispatched = await dispatchConnectorRequest(prisma, {
    type: "embedding_generate",
    payload,
    worldId: input.worldId,
    timeoutMs: input.timeoutMs ?? CONNECTOR_LLM_TIMEOUT_MS,
  });

  const result = resultRecord(dispatched.result);
  const embedding = Array.isArray(result.embedding)
    ? result.embedding.filter((value): value is number => typeof value === "number")
    : [];
  const model =
    typeof result.model === "string" && result.model.trim()
      ? result.model
      : (input.model?.trim() ?? "");
  return {
    embedding,
    model,
    jobId: dispatched.operationId,
    delivery: dispatched.delivery,
  };
}

function parseConnectorImageResult(result: Record<string, unknown>): {
  imageBase64?: string;
  mimeType: string;
} {
  const imageBase64 =
    typeof result.image === "string"
      ? result.image
      : typeof result.imageBase64 === "string"
        ? result.imageBase64
        : typeof result.b64_json === "string"
          ? result.b64_json
          : undefined;
  const mimeType =
    typeof result.mime_type === "string"
      ? result.mime_type
      : typeof result.mimeType === "string"
        ? result.mimeType
        : "image/png";
  return { imageBase64, mimeType };
}

/**
 * Enqueue an `image_generate` job and wait for a connector to complete it.
 * Maps the connector JSON result into {@link ImageStudioResult}.
 */
export async function runConnectorImageGenerate(
  prisma: PrismaClient,
  request: ImageStudioRequest,
): Promise<ImageStudioResult> {
  const payload: Record<string, unknown> = {
    task: request.task,
    prompt: request.prompt,
    width: request.width ?? 1024,
    height: request.height ?? 1024,
  };
  if (request.sourceImageBase64) payload.source_image = request.sourceImageBase64;
  if (request.maskBase64) payload.mask = request.maskBase64;

  try {
    const dispatched = await dispatchConnectorRequest(prisma, {
      type: "image_generate",
      payload,
      timeoutMs: CONNECTOR_IMAGE_TIMEOUT_MS,
    });
    const { imageBase64, mimeType } = parseConnectorImageResult(resultRecord(dispatched.result));
    const metadata = {
      jobId: dispatched.operationId,
      operationId: dispatched.operationId,
      via: dispatched.delivery === "direct" ? "direct" : "connector",
      delivery: dispatched.delivery,
      ...(dispatched.connectorId ? { connectorId: dispatched.connectorId } : {}),
    };
    if (!imageBase64) {
      return {
        success: false,
        providerUsed: "local_rtx",
        error: "Connector lieferte kein Bild (image_generate ohne image/imageBase64).",
        metadata,
      };
    }
    return {
      success: true,
      providerUsed: "local_rtx",
      imageBase64,
      mimeType,
      metadata,
    };
  } catch (error) {
    const metadata =
      error instanceof DirectConnectorDispatchError && error.requestId
        ? {
            jobId: error.requestId,
            operationId: error.requestId,
            via: "direct",
            delivery: "direct",
          }
        : error instanceof ConnectorJobWaitError
          ? {
              jobId: error.jobId,
              operationId: error.jobId,
              via: "connector",
              delivery: "queue",
            }
          : undefined;
    return {
      success: false,
      providerUsed: "local_rtx",
      error:
        error instanceof Error
          ? error.message
          : "Bildgenerierung über RTX Host Connector fehlgeschlagen.",
      metadata,
    };
  }
}

/** Map an AI task type to the connector workflow slot that supplies its default model. */
const TASK_TYPE_TO_WORKFLOW_SLOT: Record<AiTaskType, ConnectorWorkflowSlot> = {
  summarize_page: "analysis",
  summarize_session: "analysis",
  generate_player_recap: "analysis",
  suggest_links: "analysis",
  suggest_backlinks: "analysis",
  detect_contradictions: "analysis",
  find_open_threads: "analysis",
  create_npc: "dnd",
  create_location: "dnd",
  create_encounter: "dnd",
  create_knowledge_text: "dnd",
  improve_lore_text: "dnd",
  suggest_page_tags: "dnd",
  page_ai_convert: "dnd",
  prepare_canon_check: "analysis",
  prepare_next_session: "dnd",
  create_player_handout: "dnd",
  fill_dungeon_room: "dnd",
  prepare_mail_draft: "chat",
  atlas_name_region: "dnd",
  atlas_describe_region: "dnd",
  atlas_fill_area: "dnd",
  atlas_generate_asset_proposal: "dnd",
  simulate_faction: "dnd",
  generate_structured_npc: "dnd",
  generate_structured_quest: "dnd",
  generate_structured_item: "dnd",
  answer_life_question: "chat",
  synthesize_research: "analysis",
  summarize_mail: "analysis",
  prioritize_mail: "analysis",
  answer_mail_question: "chat",
  generate_briefing: "analysis",
  generate_theme_palette: "chat",
};

export function workflowSlotForTask(taskType: AiTaskType): ConnectorWorkflowSlot {
  return TASK_TYPE_TO_WORKFLOW_SLOT[taskType] ?? "chat";
}

/**
 * Resolve the connector model name configured as the workflow default for a
 * task's slot, when an online connector still reports it. Returns null when no
 * default is set or the model is no longer advertised.
 */
export async function resolveConnectorWorkflowModel(
  prisma: PrismaClient,
  taskType: AiTaskType,
): Promise<string | null> {
  const slot = workflowSlotForTask(taskType);
  const def = await createConnectorWorkflowService(prisma).getDefault(slot);
  return def?.model?.name ?? null;
}

export interface ConnectorLlmRouteInput {
  taskType: AiTaskType;
  /** Explicit model from the request, if any. Always wins over workflow defaults. */
  explicitModel?: string;
  /** Fallback model when no explicit/workflow model applies. */
  resolvedModel: string;
  systemPrompt: string;
  userPrompt: string;
  providerId: AiProviderId;
  worldId?: string;
  timeoutMs?: number;
  maxTokens?: number;
}

/**
 * Prefer the connector queue for `local_rtx` generate requests. Returns null
 * when no connector advertises `llm_local` so the caller can fall back to the
 * direct local provider. When a connector is available, resolves the model
 * (explicit request model → workflow slot default → resolved fallback), runs
 * the job and returns a `GenerateTextResult`-shaped payload.
 */
export async function tryConnectorLlmGenerate(
  prisma: PrismaClient,
  input: ConnectorLlmRouteInput,
): Promise<{ result: GenerateTextResult; model: string } | null> {
  if (!(await isConnectorLlmAvailable(prisma))) {
    return null;
  }

  const explicit = input.explicitModel?.trim();
  const model = explicit
    ? explicit
    : ((await resolveConnectorWorkflowModel(prisma, input.taskType)) ?? input.resolvedModel);

  const llm = await runConnectorLlmGenerate(prisma, {
    prompt: input.userPrompt,
    system: input.systemPrompt,
    model,
    worldId: input.worldId,
    timeoutMs: input.timeoutMs,
    maxTokens: input.maxTokens,
  });

  const finalModel = llm.model || model;
  return {
    result: {
      text: llm.text,
      model: finalModel,
      provider: input.providerId,
    },
    model: finalModel,
  };
}
