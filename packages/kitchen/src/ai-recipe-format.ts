/**
 * KI-Aufbereitung eines Rezepts für die 6×4-Zoll-Karte.
 *
 * Ein Rezept aus dem Netz oder vom Scan ist selten kartentauglich: Vorgeplauder,
 * Werbeblöcke, dreizeilige Sätze für „Zwiebeln würfeln". Diese Datei kürzt es
 * auf das, was beim Kochen zählt — ohne eine Zutat oder einen Arbeitsschritt zu
 * verlieren.
 *
 * Wie `ai-suggest.ts` läuft der Aufruf **direkt über die Connector-Queue**
 * (lokale Maschinenraum-Inferenz), nicht über `routeAiRequest`. Ist kein `llm_local`-
 * Connector online, kommt ein sauberer „Maschinenraum offline"-Zustand zurück statt einer
 * Exception — die Karte lässt sich dann eben unaufbereitet drucken.
 *
 * Kontext-Bau und Parser sind rein und getestet; nur der Connector-Call nicht.
 */
import {
  createConnectorService,
  waitForConnectorJob,
  type PrismaClient,
} from "@uwe/database/server";
import {
  DirectConnectorDispatchError,
  getDirectConnectorRegistry,
} from "@uwe/connector/direct";
import type { RecipeCardInput } from "./recipe-card-layout";

const FORMAT_TIMEOUT_MS = 120_000;
const FORMAT_POLL_INTERVAL_MS = 500;
const LLM_LOCAL_CAPABILITY = "llm_local";

export interface RecipeCardDraft {
  /** Gekürzte Arbeitsschritte, Reihenfolge unverändert. */
  steps: string[];
  /** Kurznotiz für die Karte, etwa „geht auch mit Dosentomaten". */
  note?: string;
}

export type RecipeFormatResult =
  | { status: "ok"; draft: RecipeCardDraft }
  | { status: "parse_error"; error: string }
  | { status: "engine_offline"; error: string };

const SYSTEM_PROMPT = [
  "Du bereitest Kochrezepte für eine kleine Rezeptkarte auf (6×4 Zoll).",
  "Kürze jeden Arbeitsschritt auf einen knappen Imperativsatz — höchstens 120 Zeichen.",
  "Verliere dabei keine Angabe, die man beim Kochen braucht: Temperaturen, Zeiten, Mengen bleiben.",
  "Fasse zwei Schritte nur zusammen, wenn sie unmittelbar zusammengehören.",
  "Antworte ausschließlich mit JSON: {\"steps\": [\"...\"], \"note\": \"...\"}.",
  "Die Notiz ist optional und höchstens 100 Zeichen lang. Antworte auf Deutsch.",
].join(" ");

/** Baut den Kontext für die Aufbereitung — rein, damit testbar. */
export function buildRecipeFormatContext(recipe: RecipeCardInput): string {
  const lines: string[] = [`Rezept: ${recipe.title}`];

  if (recipe.servingsBase) lines.push(`Portionen: ${recipe.servingsBase}`);
  if (recipe.durationMinutes) lines.push(`Dauer: ${recipe.durationMinutes} Minuten`);

  lines.push("", "Zutaten:");
  for (const ingredient of recipe.ingredients) {
    const amount = ingredient.amount ? `${ingredient.amount} ` : "";
    const unit = ingredient.unitLabel ? `${ingredient.unitLabel} ` : "";
    lines.push(`- ${amount}${unit}${ingredient.name}`);
  }

  lines.push("", "Arbeitsschritte:");
  recipe.steps.forEach((step, index) => lines.push(`${index + 1}. ${step}`));

  lines.push(
    "",
    `Kürze die ${recipe.steps.length} Schritte für die Karte. Gib genauso viele oder weniger Schritte zurück, niemals mehr.`,
  );

  return lines.join("\n");
}

/** Liest die JSON-Antwort des Modells; toleriert Text drumherum. */
export function parseRecipeFormat(raw: string): RecipeFormatResult {
  const text = raw.trim();
  if (text === "") {
    return { status: "parse_error", error: "Leere Antwort vom Modell." };
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { status: "parse_error", error: "Keine JSON-Struktur in der Antwort gefunden." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { status: "parse_error", error: "Antwort war kein gültiges JSON." };
  }

  if (typeof parsed !== "object" || parsed === null) {
    return { status: "parse_error", error: "Antwort war kein Objekt." };
  }

  const record = parsed as Record<string, unknown>;
  const steps = Array.isArray(record["steps"])
    ? record["steps"]
        .map((step) => (typeof step === "string" ? step.trim() : ""))
        .filter((step) => step !== "")
    : [];

  if (steps.length === 0) {
    return { status: "parse_error", error: "Die Antwort enthielt keine Schritte." };
  }

  const note = typeof record["note"] === "string" ? record["note"].trim() : "";

  return { status: "ok", draft: note === "" ? { steps } : { steps, note } };
}

export interface FormatRecipeInput {
  recipe: RecipeCardInput;
  model?: string;
  timeoutMs?: number;
}

/**
 * Lässt ein Rezept für die Karte kürzen. Ohne laufenden lokalen Connector
 * kommt `engine_offline` zurück — der Aufrufer druckt dann unaufbereitet.
 */
export async function formatRecipeForCard(
  db: PrismaClient,
  input: FormatRecipeInput,
): Promise<RecipeFormatResult> {
  const payload: Record<string, unknown> = {
    prompt: buildRecipeFormatContext(input.recipe),
    system: SYSTEM_PROMPT,
  };
  if (input.model?.trim()) payload["model"] = input.model.trim();

  const timeoutMs = input.timeoutMs ?? FORMAT_TIMEOUT_MS;

  try {
    const direct = await getDirectConnectorRegistry().dispatch({
      type: "llm_generate",
      payload,
      timeoutMs,
      idempotencyKey: crypto.randomUUID(),
    });
    const result =
      direct.result && typeof direct.result === "object"
        ? (direct.result as Record<string, unknown>)
        : {};
    return parseRecipeFormat(typeof result["text"] === "string" ? result["text"] : "");
  } catch (error) {
    if (!(error instanceof DirectConnectorDispatchError) || error.accepted) {
      throw error;
    }
  }

  const service = createConnectorService(db);
  const summary = await service.summarize();
  const queueAvailable = summary.connectors.some(
    (connector) =>
      connector.queueEnabled &&
      (connector.status === "online" || connector.status === "degraded") &&
      connector.capabilities.includes(LLM_LOCAL_CAPABILITY),
  );

  if (!queueAvailable) {
    return {
      status: "engine_offline",
      error: "Kein lokaler KI-Connector (Maschinenraum) online — Rezept wird unaufbereitet gedruckt.",
    };
  }

  const job = await service.enqueueJob({ type: "llm_generate", payload });
  const completed = await waitForConnectorJob(db, job.id, {
    timeoutMs,
    intervalMs: FORMAT_POLL_INTERVAL_MS,
  });

  const result =
    completed.result && typeof completed.result === "object"
      ? (completed.result as Record<string, unknown>)
      : {};

  return parseRecipeFormat(typeof result["text"] === "string" ? result["text"] : "");
}
