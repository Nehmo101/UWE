import type { JobType } from "./generated/prisma/client";

/** Job types that require local Maschinenraum and must defer when Maschinenraum is offline. */
export const ENGINE_REQUIRED_JOB_TYPES = new Set<JobType>([
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

export interface EngineDeferCheckInput {
  type: JobType;
  payload?: Record<string, unknown> | null;
}

/**
 * Returns true when a job carries local brain/object/DnD context and must not
 * fall back to cloud when Maschinenraum is offline.
 */
export function jobRequiresLocalEngine(input: EngineDeferCheckInput): boolean {
  if (!ENGINE_REQUIRED_JOB_TYPES.has(input.type)) {
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

/**
 * Erkennt „der Maschinenraum ist gerade nicht da“ an einer Fehlermeldung.
 *
 * Die Meldungen kommen aus zwei Richtungen: aus der deutschen Oberfläche mit
 * dem Produktnamen („Maschinenraum offline“) und aus englischsprachigem Code
 * mit dem Bezeichner („engine not reachable“). Beide Schreibweisen zählen,
 * sonst laufen Jobs in einen harten Fehler statt in die Warteschlange.
 */
export function isEngineOfflineError(message: string): boolean {
  const normalized = message.toLowerCase();
  const mentionsEngine =
    normalized.includes("maschinenraum") || normalized.includes("engine");
  return (
    mentionsEngine &&
    (normalized.includes("offline") ||
      normalized.includes("nicht erreichbar") ||
      normalized.includes("not reachable"))
  );
}

export const DEFERRED_JOB_PROGRESS_LABEL = "Wartet auf den lokalen Maschinenraum";
