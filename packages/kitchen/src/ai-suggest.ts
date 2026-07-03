/**
 * KI-Wochenvorschlag der Küche (K3). Baut aus Rezepten, Vorrat und Wochenzielen
 * einen kompakten Kontext und ruft die **Connector-Queue direkt** (lokale RTX-
 * Inferenz via `llm_generate`-Job) — kein `routeAiRequest`, kein neuer
 * `AiContextMode`. Muster: `connectorQueueProvider.ts` aus `@uwe/ai-brain`.
 *
 * Der Kontext-Bau und der Parser sind reine, getestete Helfer. Der Connector-
 * Call selbst ist Best-Effort: ist kein `llm_local`-Connector online, liefern
 * wir einen sauberen „RTX offline"-Zustand statt zu crashen.
 */
import {
  createConnectorService,
  waitForConnectorJob,
  type PrismaClient,
} from "@uwe/database/server";
import type { MealPlanGoals, MealSlot } from "./kitchen-types";
import { MEAL_SLOTS } from "./kitchen-types";

const SUGGEST_TIMEOUT_MS = 120_000;
const SUGGEST_POLL_INTERVAL_MS = 500;
const LLM_LOCAL_CAPABILITY = "llm_local";

// ── Kontext-Eingaben (client-safe, reine Daten) ───────────────────────

export interface KitchenAiRecipe {
  id: string;
  title: string;
  tags?: string[];
  tasteRating?: number | null;
  effortRating?: number | null;
  durationMinutes?: number | null;
}

export interface KitchenAiPantryItem {
  name: string;
  location?: string;
  lowStock?: boolean;
}

export interface KitchenAiContext {
  /** Kompakter, LLM-tauglicher Kontext-Text (System-/User-Prompt-Baustein). */
  text: string;
  recipeCount: number;
  pantryCount: number;
}

// ── Draft-Ausgabe ─────────────────────────────────────────────────────

export interface WeekSuggestionDay {
  /** Wochentag als Freitext-Label (z. B. „Montag") — LLM-Ausgabe. */
  day: string;
  slot: MealSlot;
  title: string;
  /** Optionaler Verweis auf ein bestehendes Rezept (id aus dem Kontext-Index). */
  recipeId?: string;
  note?: string;
}

export interface WeekSuggestionDraft {
  summary: string;
  days: WeekSuggestionDay[];
}

export type WeekSuggestionResult =
  | { status: "ok"; draft: WeekSuggestionDraft }
  | { status: "parse_error"; error: string }
  | { status: "rtx_offline"; error: string };

const WEEKDAY_INDEX: Record<string, number> = {
  montag: 0,
  dienstag: 1,
  mittwoch: 2,
  donnerstag: 3,
  freitag: 4,
  samstag: 5,
  sonntag: 6,
};

/**
 * Ordnet ein Freitext-Wochentags-Label („Montag", „Fr", „mittwoch") einem
 * konkreten Datum der ISO-Woche zu. Reiner Helfer für die Draft-Übernahme.
 * Nicht auflösbare Labels fallen auf den ersten Wochentag (Montag) zurück.
 */
export function resolveDraftDate(dayLabel: string, weekDates: readonly Date[]): Date {
  const key = dayLabel.trim().toLowerCase();
  for (const [name, index] of Object.entries(WEEKDAY_INDEX)) {
    if (key === name || key === name.slice(0, 2)) {
      return weekDates[index] ?? weekDates[0];
    }
  }
  return weekDates[0];
}

// ── Reine Helfer (getestet) ───────────────────────────────────────────

function goalsToLines(goals: MealPlanGoals): string[] {
  const lines: string[] = [];
  if (goals.lowEffort) lines.push("- Möglichst wenig Aufwand");
  if (goals.cheap) lines.push("- Günstig kochen");
  if (goals.dinnersOnly) lines.push("- Nur Abendessen planen");
  if (goals.mealPrepCount && goals.mealPrepCount > 0) {
    lines.push(`- ${goals.mealPrepCount} Meal-Prep-Gerichte (größere Mengen)`);
  }
  return lines;
}

/**
 * Baut den kompakten Kitchen-Kontext: Rezept-Index (Titel, Tags, Bewertungen),
 * Vorrats-Snapshot und Wochenziele. Reiner String-Builder ohne Seiteneffekte.
 */
export function buildKitchenAiContext(
  recipes: readonly KitchenAiRecipe[],
  pantry: readonly KitchenAiPantryItem[],
  goals: MealPlanGoals = {},
): KitchenAiContext {
  const recipeLines = recipes.map((recipe) => {
    const meta: string[] = [];
    if (recipe.tags && recipe.tags.length > 0) meta.push(`Tags: ${recipe.tags.join(", ")}`);
    if (recipe.tasteRating != null) meta.push(`Geschmack ${recipe.tasteRating}/5`);
    if (recipe.effortRating != null) meta.push(`Aufwand ${recipe.effortRating}/5`);
    if (recipe.durationMinutes != null) meta.push(`${recipe.durationMinutes} Min.`);
    const suffix = meta.length > 0 ? ` (${meta.join(", ")})` : "";
    return `- [${recipe.id}] ${recipe.title}${suffix}`;
  });

  const pantryLines = pantry.map((item) => {
    const bits: string[] = [item.name];
    if (item.location) bits.push(`@${item.location}`);
    if (item.lowStock) bits.push("(knapp)");
    return `- ${bits.join(" ")}`;
  });

  const goalLines = goalsToLines(goals);

  const text = [
    "REZEPTE (Index):",
    recipeLines.length > 0 ? recipeLines.join("\n") : "- (keine Rezepte)",
    "",
    "VORRAT:",
    pantryLines.length > 0 ? pantryLines.join("\n") : "- (leer)",
    "",
    "WOCHENZIELE:",
    goalLines.length > 0 ? goalLines.join("\n") : "- (keine besonderen Ziele)",
  ].join("\n");

  return { text, recipeCount: recipes.length, pantryCount: pantry.length };
}

function isMealSlot(value: unknown): value is MealSlot {
  return typeof value === "string" && (MEAL_SLOTS as string[]).includes(value);
}

/**
 * Parst und validiert die LLM-Antwort zu einem Wochenvorschlag. Kaputtes JSON
 * oder eine strukturell ungültige Antwort liefern einen sauberen Fehler —
 * niemals ein partieller Draft.
 */
export function parseWeekSuggestion(jsonText: string): WeekSuggestionResult {
  const trimmed = extractJsonObject(jsonText);
  if (!trimmed) {
    return { status: "parse_error", error: "Leere oder nicht-JSON-Antwort." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { status: "parse_error", error: "Antwort ist kein gültiges JSON." };
  }

  if (!parsed || typeof parsed !== "object") {
    return { status: "parse_error", error: "Antwort ist kein Objekt." };
  }
  const record = parsed as Record<string, unknown>;
  const rawDays = record.days;
  if (!Array.isArray(rawDays) || rawDays.length === 0) {
    return { status: "parse_error", error: "Feld „days“ fehlt oder ist leer." };
  }

  const days: WeekSuggestionDay[] = [];
  for (const entry of rawDays) {
    if (!entry || typeof entry !== "object") {
      return { status: "parse_error", error: "Ungültiger Tages-Eintrag." };
    }
    const day = entry as Record<string, unknown>;
    if (typeof day.title !== "string" || !day.title.trim()) {
      return { status: "parse_error", error: "Tages-Eintrag ohne Titel." };
    }
    if (!isMealSlot(day.slot)) {
      return { status: "parse_error", error: `Ungültiger Slot: ${String(day.slot)}` };
    }
    days.push({
      day: typeof day.day === "string" ? day.day : "",
      slot: day.slot,
      title: day.title.trim(),
      recipeId: typeof day.recipeId === "string" && day.recipeId ? day.recipeId : undefined,
      note: typeof day.note === "string" && day.note ? day.note : undefined,
    });
  }

  return {
    status: "ok",
    draft: {
      summary: typeof record.summary === "string" ? record.summary : "",
      days,
    },
  };
}

/** Extrahiert den ersten `{...}`-Block (LLMs rahmen JSON gern mit Prosa/Fences). */
function extractJsonObject(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return text.slice(start, end + 1);
}

// ── Connector-Call (Best-Effort, kein Live-Test) ──────────────────────

const SUGGEST_SYSTEM_PROMPT = [
  "Du bist ein Küchen-Assistent für eine Familie. Erstelle aus dem gegebenen",
  "Kontext einen Wochenvorschlag. Nutze bevorzugt vorhandene Rezepte (verweise",
  "über die id im Feld recipeId) und den vorhandenen Vorrat. Antworte AUSSCHLIESSLICH",
  "mit einem JSON-Objekt der Form:",
  '{"summary": string, "days": [{"day": string, "slot": "breakfast"|"lunch"|"dinner"|"snack", "title": string, "recipeId"?: string, "note"?: string}]}',
  "Kein Markdown, kein Text außerhalb des JSON.",
].join(" ");

export interface SuggestWeekInput {
  recipes: readonly KitchenAiRecipe[];
  pantry: readonly KitchenAiPantryItem[];
  goals?: MealPlanGoals;
  model?: string;
  timeoutMs?: number;
}

/**
 * Fordert einen KI-Wochenvorschlag über die Connector-Queue an. Ist kein
 * `llm_local`-Connector online, wird ein „RTX offline"-Zustand zurückgegeben —
 * ohne Exception. Bei kaputter Antwort kommt ein sauberer Parse-Fehler zurück.
 */
export async function suggestWeek(
  db: PrismaClient,
  input: SuggestWeekInput,
): Promise<WeekSuggestionResult> {
  const service = createConnectorService(db);
  const summary = await service.summarize();
  if (!summary.availableCapabilities.includes(LLM_LOCAL_CAPABILITY)) {
    return {
      status: "rtx_offline",
      error: "Kein lokaler KI-Connector (RTX) online — Wochenvorschlag nicht verfügbar.",
    };
  }

  const context = buildKitchenAiContext(input.recipes, input.pantry, input.goals ?? {});
  const payload: Record<string, unknown> = {
    prompt: context.text,
    system: SUGGEST_SYSTEM_PROMPT,
  };
  if (input.model?.trim()) payload.model = input.model.trim();

  const job = await service.enqueueJob({ type: "llm_generate", payload });

  const completed = await waitForConnectorJob(db, job.id, {
    timeoutMs: input.timeoutMs ?? SUGGEST_TIMEOUT_MS,
    intervalMs: SUGGEST_POLL_INTERVAL_MS,
  });

  const result =
    completed.result && typeof completed.result === "object"
      ? (completed.result as Record<string, unknown>)
      : {};
  const text = typeof result.text === "string" ? result.text : "";
  return parseWeekSuggestion(text);
}
