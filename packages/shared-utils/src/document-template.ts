/**
 * Platzhalter-Helfer für Dokumentvorlagen — client-sicher.
 *
 * Die autoritative Substitution mit Pflichtfeld-Prüfung liegt server-seitig in
 * `fillDocumentTemplate` (@uwe/database). Hier steht nur, was auch im Browser
 * laufen muss: Platzhalter finden und eine Live-Vorschau rendern. Beide Seiten
 * benutzen dasselbe Muster — sonst driften Vorschau und Ergebnis auseinander.
 */

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const DOCUMENT_TEMPLATE_CATEGORY_LABELS = {
  contract: "Vertrag",
  guide: "Anleitung",
  checklist: "Checkliste",
  other: "Sonstiges",
} as const;

export type DocumentTemplateCategoryKey = keyof typeof DOCUMENT_TEMPLATE_CATEGORY_LABELS;

/** Alle `{{platzhalter}}` im Text, eindeutig und alphabetisch. */
export function extractTemplateVariables(body: string): string[] {
  const keys = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    keys.add(match[1]);
  }
  return Array.from(keys).sort();
}

/** Vorschau: setzt ein, was da ist, und lässt Fehlendes leer. */
export function renderDocumentTemplate(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER_PATTERN, (_match, key: string) => values[key] ?? "");
}

/**
 * Das `variables`-Json-Feld einer Vorlage kann eine Liste oder ein Objekt sein
 * (historisch beides geschrieben) — hier wird daraus immer eine sortierte Liste.
 */
export function normalizeTemplateVariables(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort();
  }
  return [];
}
