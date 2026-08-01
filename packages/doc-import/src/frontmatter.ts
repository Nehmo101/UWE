/**
 * Frontmatter-Zerlegung für den Dokument-Import.
 *
 * UWE hat bereits zwei handgeschriebene Frontmatter-Parser (`knoteforge-import`
 * und `import-central-service`), die beide nur `key: value` können. Für Lasses
 * Dateien reicht das nicht: dort stehen Listen (`kampagnen: [Turm, Himmelsrouten]`),
 * und Obsidian schreibt dieselben Listen gern mehrzeilig. Statt einen dritten
 * halben Parser zu bauen, macht dieser hier die drei Formen vollständig:
 *
 *     titel: Pellar Hopsenried          → "Pellar Hopsenried"
 *     kampagnen: [Turm, Himmelsrouten]  → ["Turm", "Himmelsrouten"]
 *     tags:                             → ["nsc", "ort/ferlor"]
 *       - nsc
 *       - ort/ferlor
 *
 * Bewusst **kein** YAML: keine Verschachtelung, keine Anker, keine Blockskalare.
 * Was hier nicht hineinpasst, gehört nicht in einen Wiki-Kopf.
 */

import { slugifyDe } from "@uwe/shared-utils/slug";

export type FrontmatterValue = string | string[];

export interface ParsedFrontmatter {
  /** Schlüssel normalisiert (klein, Umlaute aufgelöst, `_`/Leerzeichen → `-`). */
  values: Record<string, FrontmatterValue>;
  /** Der Rest des Dokuments, ohne Frontmatter-Block. */
  body: string;
  /** War überhaupt ein Frontmatter-Block da? */
  present: boolean;
}

const FRONTMATTER_FENCE = /^---[ \t]*$/;

/** Schlüssel vergleichbar machen: `Siehe_Auch`, `siehe auch`, `SIEHE-AUCH` → `siehe-auch`. */
export function normalizeFrontmatterKey(key: string): string {
  return slugifyDe(key);
}

function stripQuotes(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2) {
    const first = trimmed[0];
    const last = trimmed[trimmed.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
}

/** `[a, b, "c, d"]` → `["a", "b", "c, d"]`. Kommata in Anführungszeichen trennen nicht. */
function parseInlineList(raw: string): string[] {
  const inner = raw.trim().slice(1, -1);
  const items: string[] = [];
  let current = "";
  let quote: string | null = null;

  for (const char of inner) {
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ",") {
      items.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  items.push(current.trim());

  return items.filter(Boolean);
}

function parseScalarOrList(raw: string): FrontmatterValue {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return parseInlineList(trimmed);
  }
  return stripQuotes(trimmed);
}

/**
 * Trennt einen führenden Frontmatter-Block vom Rest.
 *
 * Der Block muss in Zeile 1 mit `---` beginnen — sonst ist ein `---` mitten im
 * Text eine waagerechte Linie und kein Kopf. Fehlt der schließende Zaun, gilt
 * das ganze Dokument als Text; lieber kein Frontmatter als ein halb gefressenes.
 */
export function splitFrontmatter(markdown: string): ParsedFrontmatter {
  const normalized = markdown.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");

  if (lines.length === 0 || !FRONTMATTER_FENCE.test(lines[0] ?? "")) {
    return { values: {}, body: normalized.trim(), present: false };
  }

  let closing = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (FRONTMATTER_FENCE.test(lines[i] ?? "")) {
      closing = i;
      break;
    }
  }

  if (closing === -1) {
    return { values: {}, body: normalized.trim(), present: false };
  }

  const values = parseFrontmatterLines(lines.slice(1, closing));
  const body = lines.slice(closing + 1).join("\n").trim();

  return { values, body, present: true };
}

/** Zerlegt die Zeilen zwischen den Zäunen. Exportiert, damit sie einzeln testbar sind. */
export function parseFrontmatterLines(lines: string[]): Record<string, FrontmatterValue> {
  const values: Record<string, FrontmatterValue> = {};
  let pendingKey: string | null = null;
  let pendingItems: string[] = [];

  const flushPending = () => {
    if (pendingKey) {
      values[pendingKey] = pendingItems;
    }
    pendingKey = null;
    pendingItems = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    // Fortsetzung einer mehrzeiligen Liste: `  - wert`
    if (trimmed.startsWith("- ") || trimmed === "-") {
      if (pendingKey) {
        const item = stripQuotes(trimmed.slice(1));
        if (item) pendingItems.push(item);
        continue;
      }
      // Ein Listenpunkt ohne Schlüssel davor ist kaputt — überspringen.
      continue;
    }

    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;

    flushPending();

    const key = normalizeFrontmatterKey(trimmed.slice(0, colon));
    if (!key) continue;

    const rest = trimmed.slice(colon + 1).trim();
    if (!rest) {
      // Schlüssel ohne Wert — entweder folgt eine Liste, oder er bleibt leer.
      pendingKey = key;
      pendingItems = [];
      continue;
    }

    values[key] = parseScalarOrList(rest);
  }

  flushPending();

  return values;
}

/** Liest einen Wert immer als Liste, egal ob er als Skalar oder Liste geschrieben wurde. */
export function asList(value: FrontmatterValue | undefined): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);

  const trimmed = value.trim();
  if (!trimmed) return [];

  // Ein Skalar mit Kommata ist in der Praxis fast immer als Liste gemeint.
  return trimmed
    .split(",")
    .map((item) => stripQuotes(item))
    .filter(Boolean);
}

/** Liest einen Wert immer als Skalar; eine Liste wird zu ihrem ersten Eintrag. */
export function asScalar(value: FrontmatterValue | undefined): string | undefined {
  if (value === undefined) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}
