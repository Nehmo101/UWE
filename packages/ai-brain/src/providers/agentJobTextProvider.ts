/**
 * Pluggable async text provider via GitHub Agent Jobs.
 *
 * **Scope note:** `agent_job` in UWE targets repo/dev automation (`dev_agent_job`),
 * not in-app campaign lore. Atlas lore text uses `runBrainAction` / RTX / Cloud LLM.
 * This module documents the future hook if a dedicated async lore worker is added.
 */

export interface AgentJobTextRequest {
  prompt: string;
  taskType: string;
  worldSlug?: string;
  pageSlug?: string;
}

export interface AgentJobTextEnqueueResult {
  jobId: string;
}

/**
 * Enqueue lore/text generation through the agent_job pipeline.
 * Returns a job id; completed jobs should surface as AiRun proposals (never auto-apply).
 */
export async function enqueueAgentJobTextDraft(
  _request: AgentJobTextRequest,
): Promise<AgentJobTextEnqueueResult> {
  throw new Error(
    "Agent-Job Text-Provider ist noch nicht angebunden. Siehe docs/engineering/atlas-follow-ups.md",
  );
}
