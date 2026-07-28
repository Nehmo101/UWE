/**
 * Reading JSON out of a model answer — one place, one behaviour.
 *
 * Before this module every caller had its own attempt: `proposals.ts` cut from
 * the first `{` to the LAST `}` (a model that adds "Hope this helps!}" or a
 * second example block loses its data), `capture-triage` used a greedy
 * `/\{[\s\S]*\}/` with the same flaw, and `@uwe/theme-studio` had a correct
 * balanced scanner nobody else could reach. Three parsers, three failure modes,
 * one shared symptom: a perfectly good answer read as garbage.
 *
 * What this does, in order, and nothing more:
 *   1. Parse the trimmed text as-is. A well-behaved model ends here.
 *   2. Strip a Markdown fence (```json … ```), because that is what a model
 *      does when it was told "answer with JSON" and trained on chat.
 *   3. Scan from the first `{` to its BALANCED `}`, ignoring braces inside
 *      strings and escapes. Preamble ("Hier ist das JSON:") and postamble
 *      ("Viel Spaß damit!") both fall away.
 *
 * What it deliberately does NOT do: repair the JSON itself. No quote fixing,
 * no trailing-comma removal, no bracket balancing. A model that produces
 * broken JSON gets ONE more attempt with the error in the prompt
 * (`buildJsonRepairPrompt`, used by the router) — and if that fails too, the
 * clamping validators are the last instance. Guessing at what half an object
 * meant is how a silent wrong answer is manufactured.
 *
 * Top-level arrays are not accepted. Every JSON contract in UWE is an object
 * (`{"tags":[…]}`, `{"events":[…]}`, the Terra draft); accepting a bare array
 * would mean every consumer has to handle a shape none of them declare.
 */

export type ModelJsonFailureReason =
  /** Nothing but whitespace came back. */
  | "empty"
  /** No `{` anywhere — the model answered in prose. */
  | "no_object"
  /** A `{` opened but never closed — usually a token-limit cut-off. */
  | "unterminated"
  /** Balanced text, but `JSON.parse` rejected it. */
  | "invalid_json"
  /** Valid JSON that is not an object (array, string, number, null). */
  | "not_an_object";

export interface ModelJsonSuccess {
  ok: true;
  value: Record<string, unknown>;
  /** The exact text that was parsed — useful for logging what was cut away. */
  source: string;
  /** false when the raw answer already was the JSON object. */
  repaired: boolean;
}

export interface ModelJsonFailure {
  ok: false;
  reason: ModelJsonFailureReason;
  /** One sentence, safe to put into a repair prompt. */
  message: string;
}

export type ModelJsonResult = ModelJsonSuccess | ModelJsonFailure;

const FAILURE_TEXT: Record<ModelJsonFailureReason, string> = {
  empty: "Die Antwort war leer.",
  no_object: "Die Antwort enthielt kein JSON-Objekt — sie war Fließtext.",
  unterminated:
    "Das JSON-Objekt wurde nicht geschlossen (fehlende schließende Klammer) — vermutlich abgeschnitten.",
  invalid_json: "Der JSON-Text war syntaktisch fehlerhaft.",
  not_an_object: "Die Antwort war gültiges JSON, aber kein Objekt.",
};

function fail(reason: ModelJsonFailureReason): ModelJsonFailure {
  return { ok: false, reason, message: FAILURE_TEXT[reason] };
}

/**
 * Content of the first Markdown fence, or null. Both ```json and a bare ```
 * count; anything else on the info line (```JSON5, ```javascript) does not —
 * a fence that announces a different language is not a JSON answer.
 */
export function stripCodeFence(text: string): string | null {
  const match = /```[ \t]*(json)?[ \t]*\r?\n([\s\S]*?)```/i.exec(text);
  return match ? (match[2]?.trim() ?? null) : null;
}

/**
 * The first balanced `{…}` block, or null. Braces inside JSON strings and
 * backslash escapes do not count — `{"note":"a } b"}` survives.
 */
export function extractJsonObjectText(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (inString && ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function tryParseObject(candidate: string): Record<string, unknown> | "invalid" | "not_an_object" {
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    return "invalid";
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return "not_an_object";
  }
  return parsed as Record<string, unknown>;
}

/**
 * Read one JSON object out of a model answer. The three steps of the module
 * comment, in that order; the first that yields an object wins.
 */
export function parseModelJson(raw: string): ModelJsonResult {
  const trimmed = raw.trim();
  if (!trimmed) return fail("empty");

  const direct = tryParseObject(trimmed);
  if (typeof direct === "object") {
    return { ok: true, value: direct, source: trimmed, repaired: false };
  }

  /* The candidates in escalation order. The fence content is tried whole
     first (a fenced answer is usually exactly the object), then both bodies
     are scanned for a balanced block. */
  const fenced = stripCodeFence(trimmed);
  const candidates: string[] = [];
  if (fenced) {
    candidates.push(fenced);
    const inner = extractJsonObjectText(fenced);
    if (inner && inner !== fenced) candidates.push(inner);
  }
  const scanned = extractJsonObjectText(trimmed);
  if (scanned) candidates.push(scanned);

  let lastReason: ModelJsonFailureReason | null = null;

  for (const candidate of candidates) {
    const parsed = tryParseObject(candidate);
    if (typeof parsed === "object") {
      return { ok: true, value: parsed, source: candidate, repaired: true };
    }
    lastReason = parsed === "invalid" ? "invalid_json" : "not_an_object";
  }

  if (candidates.length === 0) {
    /* A `{` that never closes is a different diagnosis from prose: the model
       did the right thing and ran out of tokens. Saying so in the retry
       prompt is worth more than "kein JSON gefunden". */
    if (trimmed.includes("{")) return fail("unterminated");
    /* `direct` already told us whether the whole answer parsed as non-object
       JSON (a bare array, a quoted string). */
    if (direct === "not_an_object") return fail("not_an_object");
    return fail("no_object");
  }

  return fail(lastReason ?? "invalid_json");
}

/** Convenience for callers that only want the object or nothing. */
export function readModelJson(raw: string): Record<string, unknown> | null {
  const result = parseModelJson(raw);
  return result.ok ? result.value : null;
}

/**
 * The single retry prompt. Deliberately short and deliberately concrete: the
 * original task, what came back, and what was wrong with it. It does NOT
 * repeat the whole context — the model still has it from the first turn's
 * prompt, and a second full context is the fastest way to blow the budget.
 *
 * The bad answer is truncated: a model that produced 20 kB of prose instead of
 * JSON will not be helped by seeing all 20 kB of it again.
 */
const REPAIR_ECHO_MAX = 600;

export function buildJsonRepairPrompt(
  originalPrompt: string,
  badAnswer: string,
  failure: ModelJsonFailure,
): string {
  const echo = badAnswer.trim().slice(0, REPAIR_ECHO_MAX);
  return [
    originalPrompt,
    "",
    "---",
    "KORREKTUR: Deine vorherige Antwort war nicht verwertbar.",
    `Grund: ${failure.message}`,
    echo ? `Deine Antwort begann mit:\n${echo}` : "Deine Antwort war leer.",
    "",
    "Antworte jetzt ausschließlich mit dem JSON-Objekt selbst.",
    "Kein Fließtext davor oder danach, keine Markdown-Zäune, keine Kommentare.",
    "Das erste Zeichen deiner Antwort ist `{`, das letzte ist `}`.",
  ].join("\n");
}

export interface JsonRepairOutcome<T> {
  result: T;
  /** True when a second call was made. Never more than one. */
  repairAttempted: boolean;
  /** Whether the returned text parses as a JSON object. */
  ok: boolean;
}

/**
 * Generate, and if JSON was required but not delivered, ask exactly ONCE more
 * with the error in the prompt.
 *
 * The bound is the whole point and it lives here, in one place, so it cannot
 * quietly become a loop later: `generate` is called at most twice, full stop.
 * A model that cannot produce JSON will not learn to on the third try, and
 * every extra round makes a provider timeout likelier than a result — while
 * the user waits.
 *
 * When the second answer is no better, the FIRST one is kept: a failed repair
 * often returns an apology, whereas the original at least held the prose the
 * model meant. Downstream, the clamping validators
 * (`proposal-validators/terra-world-draft.ts`) turn either into a boring result
 * rather than a broken one — that is where the guarantee lives, not here.
 */
export async function generateWithJsonRepair<T extends { text: string }>(options: {
  wantsJson: boolean;
  prompt: string;
  generate: (prompt: string) => Promise<T>;
}): Promise<JsonRepairOutcome<T>> {
  const first = await options.generate(options.prompt);
  if (!options.wantsJson) {
    return { result: first, repairAttempted: false, ok: true };
  }

  const parsed = parseModelJson(first.text);
  if (parsed.ok) {
    return { result: first, repairAttempted: false, ok: true };
  }

  const second = await options.generate(
    buildJsonRepairPrompt(options.prompt, first.text, parsed),
  );
  const secondOk = parseModelJson(second.text).ok;
  return {
    result: secondOk ? second : first,
    repairAttempted: true,
    ok: secondOk,
  };
}
