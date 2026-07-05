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
  createConnectorService,
  createConnectorWorkflowService,
  waitForConnectorJob,
  type ConnectorWorkflowSlot,
  type PrismaClient,
} from "@uwe/database/server";

import type { AiProviderId, AiTaskType, GenerateTextResult } from "../../types";

const CONNECTOR_LLM_TIMEOUT_MS = 120_000;
const CONNECTOR_POLL_INTERVAL_MS = 500;

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
}

function resultRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** True when an online (or degraded) connector advertises local LLM inference. */
export async function isConnectorLlmAvailable(prisma: PrismaClient): Promise<boolean> {
  const summary = await createConnectorService(prisma).summarize();
  return summary.availableCapabilities.includes("llm_local");
}

/** True when an online (or degraded) connector advertises local embeddings. */
export async function isConnectorEmbeddingAvailable(prisma: PrismaClient): Promise<boolean> {
  const summary = await createConnectorService(prisma).summarize();
  return summary.availableCapabilities.includes("embedding_local");
}

/**
 * Enqueue an `llm_generate` job and wait for a connector to complete it.
 * Throws `ConnectorJobWaitError` on failure/expiry/timeout.
 */
export async function runConnectorLlmGenerate(
  prisma: PrismaClient,
  input: ConnectorLlmInput,
): Promise<ConnectorLlmResult> {
  const service = createConnectorService(prisma);
  const payload: Record<string, unknown> = { prompt: input.prompt };
  if (input.system?.trim()) payload.system = input.system;
  if (input.model?.trim()) payload.model = input.model.trim();
  if (input.maxTokens != null) payload.maxTokens = input.maxTokens;

  const job = await service.enqueueJob({
    type: "llm_generate",
    payload,
    worldId: input.worldId ?? null,
  });

  const completed = await waitForConnectorJob(prisma, job.id, {
    timeoutMs: input.timeoutMs ?? CONNECTOR_LLM_TIMEOUT_MS,
    intervalMs: CONNECTOR_POLL_INTERVAL_MS,
  });

  const result = resultRecord(completed.result);
  const text = typeof result.text === "string" ? result.text : "";
  const model =
    typeof result.model === "string" && result.model.trim()
      ? result.model
      : (input.model?.trim() ?? "");
  return { text, model, jobId: job.id };
}

/**
 * Enqueue an `embedding_generate` job and wait for a connector to complete it.
 * Throws `ConnectorJobWaitError` on failure/expiry/timeout.
 */
export async function runConnectorEmbeddingGenerate(
  prisma: PrismaClient,
  input: ConnectorEmbeddingInput,
): Promise<ConnectorEmbeddingResult> {
  const service = createConnectorService(prisma);
  const payload: Record<string, unknown> = { input: input.input };
  if (input.model?.trim()) payload.model = input.model.trim();

  const job = await service.enqueueJob({
    type: "embedding_generate",
    payload,
    worldId: input.worldId ?? null,
  });

  const completed = await waitForConnectorJob(prisma, job.id, {
    timeoutMs: input.timeoutMs ?? CONNECTOR_LLM_TIMEOUT_MS,
    intervalMs: CONNECTOR_POLL_INTERVAL_MS,
  });

  const result = resultRecord(completed.result);
  const embedding = Array.isArray(result.embedding)
    ? result.embedding.filter((value): value is number => typeof value === "number")
    : [];
  const model =
    typeof result.model === "string" && result.model.trim()
      ? result.model
      : (input.model?.trim() ?? "");
  return { embedding, model, jobId: job.id };
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
