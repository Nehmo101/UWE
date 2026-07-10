/** Client-safe prompt library helpers (no Prisma / server imports). */

export type PromptTemplateCategory =
  | "repo_audit"
  | "ui_fix"
  | "dnd_generator"
  | "import"
  | "refactor"
  | "other";

export const PROMPT_CATEGORIES: PromptTemplateCategory[] = [
  "repo_audit",
  "ui_fix",
  "dnd_generator",
  "import",
  "refactor",
  "other",
];

export const PROMPT_CATEGORY_LABELS: Record<PromptTemplateCategory, string> = {
  repo_audit: "Repo-Audit",
  ui_fix: "UI-Fix",
  dnd_generator: "DnD-Generator",
  import: "Import",
  refactor: "Refactor",
  other: "Sonstiges",
};

/** Alle eindeutigen `{{variable}}`-Platzhalter im Body (Reihenfolge des Auftretens). */
export function extractVariables(body: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    const name = match[1];
    if (!seen.has(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}
