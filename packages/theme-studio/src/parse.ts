import type { PaletteColors } from "./palette-tokens";

export interface ParsedPalette {
  colors: PaletteColors;
  label?: string;
  description?: string;
  scope?: string;
}

export interface PaletteParseResult {
  palette?: ParsedPalette;
  error?: string;
}

/** Extract the first balanced `{…}` block from arbitrary text (handles trailing prose). */
export function extractJsonObject(text: string): string | null {
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
    if (ch === "\\") {
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

function coerceColors(raw: unknown): PaletteColors {
  const out: PaletteColors = {};
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === "string" && value.trim()) out[key] = value.trim();
    }
  }
  return out;
}

const META_KEYS = new Set(["colors", "label", "description", "scope", "name", "defaults"]);

/**
 * Parse an LLM response into a palette. Accepts a fenced or inline JSON object
 * shaped either as `{ colors: {...}, label?, description?, scope? }` or as a bare
 * palette map (`{ bg, fg, accent, ... }`). Returns `{ error }` when no usable
 * JSON/colors are found — the caller then asks the model to retry.
 */
export function parsePaletteResponse(text: string): PaletteParseResult {
  if (!text || !text.trim()) return { error: "Leere Antwort vom Modell." };

  const jsonText = extractJsonObject(text);
  if (!jsonText) return { error: "Kein JSON-Objekt in der Antwort gefunden." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { error: "Antwort enthält kein gültiges JSON." };
  }
  if (!parsed || typeof parsed !== "object") {
    return { error: "JSON ist kein Objekt." };
  }

  const obj = parsed as Record<string, unknown>;
  // Nested `colors`, or the object itself is the palette map.
  const hasNestedColors = obj.colors && typeof obj.colors === "object";
  const colors = coerceColors(hasNestedColors ? obj.colors : stripMeta(obj));
  if (Object.keys(colors).length === 0) {
    return { error: "Keine Farbwerte im JSON gefunden." };
  }

  const label =
    typeof obj.label === "string"
      ? obj.label
      : typeof obj.name === "string"
        ? obj.name
        : undefined;
  const description = typeof obj.description === "string" ? obj.description : undefined;
  const scope = typeof obj.scope === "string" ? obj.scope : undefined;

  return { palette: { colors, label, description, scope } };
}

/** Drop meta keys so a bare-map response isn't polluted with label/scope strings. */
function stripMeta(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!META_KEYS.has(key)) out[key] = value;
  }
  return out;
}
