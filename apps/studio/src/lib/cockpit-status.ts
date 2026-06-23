import type { PrismaClient } from "@uwe/database/server";
import { getAdminStatus } from "@uwe/database/server";
import { getInferenceStatus } from "@uwe/ai-brain/inference";
import type { CockpitStatusItem, CockpitStatusLevel } from "@uwe/shared-ui";

function levelFromOk(ok: boolean, enabled = true): CockpitStatusLevel {
  if (!enabled) return "off";
  return ok ? "ok" : "error";
}

/** Lightweight status snapshot for the Studio cockpit footer strip. */
export async function getCockpitStatusItems(
  db: PrismaClient,
  options: { useMockInference?: boolean } = {},
): Promise<CockpitStatusItem[]> {
  const useMock = options.useMockInference ?? process.env.AI_USE_MOCK === "true";
  const [admin, inference] = await Promise.all([
    getAdminStatus(db),
    getInferenceStatus({ useMock }),
  ]);

  const llmLevel: CockpitStatusLevel = !inference.enabled
    ? "off"
    : inference.online
      ? "ok"
      : "warn";

  return [
    {
      id: "llm",
      label: "LLM",
      value: !inference.enabled
        ? "aus"
        : inference.online
          ? inference.provider
          : "offline",
      level: llmLevel,
    },
    {
      id: "embeddings",
      label: "Embeddings",
      value: !admin.embeddings.enabled
        ? "aus"
        : admin.embeddings.ok
          ? admin.embeddings.model || "OK"
          : "Fehler",
      level: levelFromOk(admin.embeddings.ok, admin.embeddings.enabled),
    },
    {
      id: "vector-db",
      label: "Vector DB",
      value: admin.brain.ok ? admin.brain.storage || "OK" : "prüfen",
      level: levelFromOk(admin.brain.ok, admin.brain.enabled),
    },
    {
      id: "tokens",
      label: "Modell",
      value: inference.defaultModel || "—",
      level: inference.configured ? "ok" : "off",
    },
  ];
}
