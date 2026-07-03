/**
 * Optionale RTX-lokale LLM-Synthese für den Wissensassistenten. Setzt auf die
 * bereits abgerufenen Quellen (`KnowledgeAnswer.citations`) auf und formuliert
 * eine zusammenhängende Antwort — **erdet strikt auf den Quellen**, erfindet
 * nichts und ersetzt die Quellenanzeige nie. Läuft ausschließlich über die
 * Connector-Queue (lokale Inferenz, `llm_generate`); ist kein `llm_local`-
 * Connector online, degradiert die Funktion sauber („RTX offline"), die reine
 * Retrieval-Antwort bleibt unverändert nutzbar. Muster: `ai-suggest.ts`.
 */
import { createConnectorService, waitForConnectorJob } from "./connector-service";
import type { PrismaClient } from "./client";
import type { KnowledgeAnswer, KnowledgeCitation } from "./knowledge-assistant-service";

const SYNTHESIS_TIMEOUT_MS = 120_000;
const SYNTHESIS_POLL_INTERVAL_MS = 500;
const LLM_LOCAL_CAPABILITY = "llm_local";

const SYNTHESIS_SYSTEM_PROMPT = [
  "Du bist ein Wissensassistent mit strikter Quellenpflicht.",
  "Beantworte die Frage AUSSCHLIESSLICH aus den nummerierten Quellen.",
  "Belege jede Aussage mit der Quellennummer in eckigen Klammern, z. B. [1].",
  "Decken die Quellen die Frage nicht ab, sage klar, dass es aus dem Life-Brain",
  "nicht sicher hervorgeht. Erfinde nichts und nutze kein Wissen außerhalb der Quellen.",
].join(" ");

export type KnowledgeSynthesisResult =
  | { status: "ok"; text: string }
  | { status: "no_sources"; error: string }
  | { status: "rtx_offline"; error: string }
  | { status: "error"; error: string };

/**
 * Baut den geerdeten Prompt aus Frage + nummerierten Quellen. Reiner Helfer.
 */
export function buildSynthesisPrompt(query: string, citations: KnowledgeCitation[]): string {
  const sourceLines = citations.map((citation: KnowledgeCitation, index: number) => {
    const age = citation.ageNote ? ` (${citation.ageNote})` : "";
    return `[${index + 1}] ${citation.title}${age}: ${citation.snippet}`;
  });
  return [
    `FRAGE: ${query}`,
    "",
    "QUELLEN:",
    sourceLines.length > 0 ? sourceLines.join("\n") : "(keine)",
    "",
    "Antworte in wenigen Sätzen, mit Quellennummern belegt.",
  ].join("\n");
}

/**
 * Fordert eine geerdete Synthese über die Connector-Queue an. Ohne Quellen oder
 * ohne lokalen Connector wird ein sauberer Nicht-verfügbar-Zustand geliefert —
 * ohne Exception. Der Job-Timeout ist beschränkt (~120s).
 */
export async function synthesizeKnowledgeAnswer(
  db: PrismaClient,
  answer: KnowledgeAnswer,
  options: { model?: string; timeoutMs?: number } = {},
): Promise<KnowledgeSynthesisResult> {
  if (answer.citations.length === 0) {
    return {
      status: "no_sources",
      error: "Keine Quellen im Life-Brain — es gibt nichts zu formulieren.",
    };
  }

  const service = createConnectorService(db);
  const summary = await service.summarize();
  if (!summary.availableCapabilities.includes(LLM_LOCAL_CAPABILITY)) {
    return {
      status: "rtx_offline",
      error: "Kein lokaler KI-Connector (RTX) online — Synthese nicht verfügbar.",
    };
  }

  const payload: Record<string, unknown> = {
    prompt: buildSynthesisPrompt(answer.query, answer.citations),
    system: SYNTHESIS_SYSTEM_PROMPT,
  };
  if (options.model?.trim()) payload.model = options.model.trim();

  try {
    const job = await service.enqueueJob({ type: "llm_generate", payload });
    const completed = await waitForConnectorJob(db, job.id, {
      timeoutMs: options.timeoutMs ?? SYNTHESIS_TIMEOUT_MS,
      intervalMs: SYNTHESIS_POLL_INTERVAL_MS,
    });
    const result =
      completed.result && typeof completed.result === "object"
        ? (completed.result as Record<string, unknown>)
        : {};
    const text = typeof result.text === "string" ? result.text.trim() : "";
    if (!text) {
      return { status: "error", error: "Leere Antwort vom Connector." };
    }
    return { status: "ok", text };
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Synthese fehlgeschlagen.",
    };
  }
}
