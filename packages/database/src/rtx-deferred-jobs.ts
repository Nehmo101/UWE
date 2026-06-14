import type { JobType } from "./generated/prisma/client";

/** Job types that require local RTX and must defer when RTX is offline. */
export const RTX_REQUIRED_JOB_TYPES = new Set<JobType>([
  "ai_run",
  "embedding",
  "reindex",
]);

const LOCAL_CONTEXT_PAYLOAD_KEYS = [
  "actionId",
  "taskType",
  "worldSlug",
  "pageSlug",
  "sessionId",
  "contextMode",
] as const;

export interface RtxDeferCheckInput {
  type: JobType;
  payload?: Record<string, unknown> | null;
}

/**
 * Returns true when a job carries local brain/object/DnD context and must not
 * fall back to cloud when RTX is offline.
 */
export function jobRequiresLocalRtx(input: RtxDeferCheckInput): boolean {
  if (!RTX_REQUIRED_JOB_TYPES.has(input.type)) {
    return false;
  }

  const payload = input.payload ?? {};

  if (input.type === "embedding" || input.type === "reindex") {
    return true;
  }

  if (input.type === "ai_run") {
    if (payload.actionId || payload.taskType) {
      return true;
    }
    for (const key of LOCAL_CONTEXT_PAYLOAD_KEYS) {
      if (payload[key]) {
        return true;
      }
    }
  }

  return false;
}

export function isRtxOfflineError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("rtx") &&
    (normalized.includes("offline") ||
      normalized.includes("nicht erreichbar") ||
      normalized.includes("nicht erreichbar") ||
      normalized.includes("not reachable"))
  );
}

export const DEFERRED_JOB_PROGRESS_LABEL = "Wartet auf lokale RTX";
