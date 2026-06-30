/**
 * Pluggable async text provider via GitHub Agent Jobs.
 * Stub — wire in a future PR (see docs/engineering/atlas-follow-ups.md).
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
