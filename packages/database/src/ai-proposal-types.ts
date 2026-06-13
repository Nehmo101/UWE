/**
 * Structured representation of AI-generated patches (P08A).
 * Proposals reference these shapes in `AiProposal.patch` JSON.
 */

export type AiProposalApplyMode = "idea" | "content_block" | "player_recap";

export type GeneratedPatchOperation =
  | "create_page"
  | "append_content_block"
  | "update_session_recap";

export interface GeneratedPatchPayload {
  content: string;
  title?: string;
  pageType?: string;
  metadata?: Record<string, unknown>;
}

export interface GeneratedPatch {
  operation: GeneratedPatchOperation;
  targetType: "page" | "game_session" | null;
  targetId: string | null;
  payload: GeneratedPatchPayload;
  allowedModes: AiProposalApplyMode[];
  label?: string;
}

export interface RecordAiRunInput {
  aiRunId: string;
  worldId: string;
  pageId: string;
  sessionId?: string;
  taskType: string;
  resultText: string;
  title?: string;
}

export interface RecordAiRunResult {
  runId: string;
  proposal: AiProposalView;
}

export interface ApplyAiProposalInput {
  mode: AiProposalApplyMode;
  title?: string;
  editedText?: string;
  sessionId?: string;
}

export interface AiProposalView {
  id: string;
  aiRunId: string;
  worldId: string;
  status: string;
  suggestedMode: AiProposalApplyMode;
  patch: GeneratedPatch;
  resultText: string;
  editedText: string | null;
  sourcePageId: string | null;
  sessionId: string | null;
  appliedTargetType: string | null;
  appliedTargetId: string | null;
  appliedAt: Date | null;
  discardedAt: Date | null;
  createdAt: Date;
  taskType: string;
  provider: string;
  model: string;
}

const IDEA_TASKS = new Set([
  "create_npc",
  "create_location",
  "create_encounter",
]);

export function suggestApplyMode(taskType: string): AiProposalApplyMode {
  if (taskType === "generate_player_recap") return "player_recap";
  if (IDEA_TASKS.has(taskType)) return "idea";
  return "content_block";
}

export function allowedApplyModes(taskType: string): AiProposalApplyMode[] {
  if (taskType === "generate_player_recap") {
    return ["player_recap", "content_block", "idea"];
  }
  if (IDEA_TASKS.has(taskType)) {
    return ["idea", "content_block"];
  }
  return ["content_block", "idea"];
}

export function buildGeneratedPatch(input: {
  taskType: string;
  sourcePageId: string;
  sessionId?: string;
  content: string;
  title?: string;
}): GeneratedPatch {
  const suggested = suggestApplyMode(input.taskType);
  const operation: GeneratedPatchOperation =
    suggested === "player_recap"
      ? "update_session_recap"
      : suggested === "idea"
        ? "create_page"
        : "append_content_block";

  return {
    operation,
    targetType:
      operation === "update_session_recap"
        ? "game_session"
        : operation === "append_content_block"
          ? "page"
          : null,
    targetId:
      operation === "update_session_recap"
        ? (input.sessionId ?? null)
        : operation === "append_content_block"
          ? input.sourcePageId
          : null,
    payload: {
      content: input.content,
      title: input.title,
      pageType: IDEA_TASKS.has(input.taskType)
        ? input.taskType.replace("create_", "")
        : "note",
      metadata: {
        source: "ai_brain",
        taskType: input.taskType,
        isProposal: true,
      },
    },
    allowedModes: allowedApplyModes(input.taskType),
    label: `KI-Vorschlag (${input.taskType})`,
  };
}
