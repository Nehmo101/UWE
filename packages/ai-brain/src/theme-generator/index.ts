/**
 * Theme generator — the conversational (questionnaire) LLM turn for the UWE
 * design creator. The AI plumbing is injected as a `ThemeGenerateFn` (the caller
 * wires it to `executeAiGatewayRequest` with contextMode `general_chat` and
 * taskType `generate_theme_palette`; tests inject a mock), keeping this module
 * pure and free of gateway/DB dependencies. The model returns a strict JSON
 * envelope which we parse and validate via `@uwe/theme-studio`.
 */
import {
  extractJsonObject,
  validatePalette,
  type PaletteColors,
} from "@uwe/theme-studio";
import { buildThemeSystemPrompt, buildThemeUserPrompt } from "./prompts";
import type {
  GeneratedPalette,
  ThemeGenerateFn,
  ThemeGeneratorTurnInput,
  ThemeGeneratorTurnResult,
} from "./types";

export * from "./types";
export { buildThemeSystemPrompt, buildThemeUserPrompt } from "./prompts";

function coerceColors(raw: unknown): PaletteColors {
  const out: PaletteColors = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) out[key] = value.trim();
    }
  }
  return out;
}

interface ParsedEnvelope {
  message: string;
  palettes: GeneratedPalette[];
  error?: string;
}

/** Parse the `{ message, palettes[] }` envelope; validates each palette. */
export function parseThemeEnvelope(raw: string): ParsedEnvelope {
  const json = extractJsonObject(raw);
  if (!json) {
    return { message: raw.trim(), palettes: [], error: "Kein JSON-Objekt in der Antwort gefunden." };
  }
  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    return { message: "", palettes: [], error: "Antwort enthält kein gültiges JSON." };
  }
  if (!obj || typeof obj !== "object") {
    return { message: "", palettes: [], error: "JSON ist kein Objekt." };
  }
  const record = obj as Record<string, unknown>;
  const message = typeof record.message === "string" ? record.message : "";
  const rawPalettes = Array.isArray(record.palettes) ? record.palettes : [];

  const palettes: GeneratedPalette[] = [];
  for (const entry of rawPalettes) {
    if (!entry || typeof entry !== "object") continue;
    const p = entry as Record<string, unknown>;
    const colors = coerceColors(p.colors);
    if (Object.keys(colors).length === 0) continue;
    palettes.push({
      label: typeof p.label === "string" && p.label.trim() ? p.label.trim() : "Design",
      description: typeof p.description === "string" ? p.description.trim() : "",
      colors,
      validation: validatePalette(colors),
    });
  }
  return { message, palettes };
}

/**
 * Run one turn of the design conversation. Returns the model's message plus any
 * validated palette candidates. When `palettes` is empty the model asked a
 * follow-up question (`needsInput = true`).
 */
export async function runThemeGeneratorTurn(
  input: ThemeGeneratorTurnInput,
  generate: ThemeGenerateFn,
): Promise<ThemeGeneratorTurnResult> {
  const variantCount = input.variantCount ?? 3;
  const system = buildThemeSystemPrompt(input.scope, variantCount);
  const user = buildThemeUserPrompt(input.history ?? [], input.userMessage, input.repairHint);

  const raw = await generate({ system, user });
  const envelope = parseThemeEnvelope(raw);
  const assistantMessage =
    envelope.message ||
    (envelope.error
      ? "Ich konnte gerade keine gültige Antwort erzeugen. Magst du es anders formulieren?"
      : "");

  return {
    assistantMessage,
    palettes: envelope.palettes,
    needsInput: envelope.palettes.length === 0,
    parseError: envelope.error,
    raw,
  };
}
