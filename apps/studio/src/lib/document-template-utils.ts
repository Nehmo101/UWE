/**
 * Client-safe helpers mirroring packages/database document-template-service
 * (extractDocumentTemplateVariables / renderTemplate). Die autoritative
 * Substitution mit Pflichtfeld-Validierung läuft server-seitig über
 * fillDocumentTemplate; hier nur Live-Vorschau.
 */

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export const DOCUMENT_TEMPLATE_CATEGORY_LABELS = {
  contract: "Vertrag",
  guide: "Anleitung",
  checklist: "Checkliste",
  other: "Sonstiges",
} as const;

export type DocumentTemplateCategoryKey = keyof typeof DOCUMENT_TEMPLATE_CATEGORY_LABELS;

export function extractTemplateVariables(body: string): string[] {
  const keys = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER_PATTERN)) {
    keys.add(match[1]);
  }
  return Array.from(keys).sort();
}

export function renderDocumentTemplate(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER_PATTERN, (_match, key: string) => values[key] ?? "");
}

/** Ergebnis von generateDocumentFromTemplateAction (Server Action). */
export type GenerateDocumentActionResult =
  | { ok: true; documentId: string; title: string }
  | { ok: false; error: string };

export function normalizeTemplateVariables(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort();
  }
  return [];
}
