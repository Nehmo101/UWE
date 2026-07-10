import type { PrismaClient } from "./client";
import type { PromptTemplateCategory } from "./generated/prisma/client";
import { toPrismaJsonValue } from "./json-utils";
import { extractVariables } from "./prompt-library-utils";

/**
 * Prompt-/Agenten-Bibliothek: Prompts als eigene Objekte mit Kategorie und
 * `{{Variablen}}`. Ersetzt die verstreute Ablage in Markdown/Cursor-Regeln durch
 * eine durchsuchbare In-App-Sammlung. Die Variablen-Logik ist pure & testbar.
 */

export type { PromptTemplateCategory };

export { extractVariables, PROMPT_CATEGORIES, PROMPT_CATEGORY_LABELS } from "./prompt-library-utils";

/** Ersetzt `{{name}}` durch die Werte; unbekannte Platzhalter bleiben leer. */
export function fillPrompt(body: string, values: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => {
    const value = values[name];
    return value != null ? value : "";
  });
}

export interface PromptTemplateRecord {
  id: string;
  title: string;
  category: PromptTemplateCategory;
  description: string;
  body: string;
  variables: string[];
  tags: string[];
  updatedAt: Date;
}

export interface PromptTemplateInput {
  title: string;
  category?: PromptTemplateCategory;
  description?: string;
  body: string;
  tags?: string[];
}

function toRecord(row: {
  id: string;
  title: string;
  category: PromptTemplateCategory;
  description: string;
  body: string;
  variables: unknown;
  tags: unknown;
  updatedAt: Date;
}): PromptTemplateRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    description: row.description,
    body: row.body,
    variables: Array.isArray(row.variables) ? (row.variables as string[]) : extractVariables(row.body),
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    updatedAt: row.updatedAt,
  };
}

export class PromptLibraryService {
  constructor(private readonly db: PrismaClient) {}

  async list(options?: {
    category?: PromptTemplateCategory;
    search?: string;
    tag?: string;
  }): Promise<PromptTemplateRecord[]> {
    const rows = await this.db.promptTemplate.findMany({
      where: {
        ...(options?.category ? { category: options.category } : {}),
        ...(options?.search
          ? {
              OR: [
                { title: { contains: options.search } },
                { description: { contains: options.search } },
                { body: { contains: options.search } },
              ],
            }
          : {}),
      },
      orderBy: [{ title: "asc" }, { updatedAt: "desc" }],
    });

    let records = rows.map(toRecord);
    if (options?.tag) {
      const needle = options.tag.trim().toLowerCase();
      records = records.filter((record) =>
        record.tags.some((tag) => tag.toLowerCase().includes(needle)),
      );
    }
    return records;
  }

  async get(id: string): Promise<PromptTemplateRecord | null> {
    const row = await this.db.promptTemplate.findUnique({ where: { id } });
    return row ? toRecord(row) : null;
  }

  async create(input: PromptTemplateInput): Promise<PromptTemplateRecord> {
    const row = await this.db.promptTemplate.create({
      data: {
        title: input.title.trim(),
        category: input.category ?? "other",
        description: input.description ?? "",
        body: input.body,
        variables: toPrismaJsonValue(extractVariables(input.body)),
        tags: toPrismaJsonValue(input.tags ?? []),
      },
    });
    return toRecord(row);
  }

  async update(id: string, patch: PromptTemplateInput): Promise<PromptTemplateRecord> {
    const row = await this.db.promptTemplate.update({
      where: { id },
      data: {
        title: patch.title.trim(),
        category: patch.category ?? "other",
        description: patch.description ?? "",
        body: patch.body,
        variables: toPrismaJsonValue(extractVariables(patch.body)),
        tags: toPrismaJsonValue(patch.tags ?? []),
      },
    });
    return toRecord(row);
  }

  async remove(id: string): Promise<void> {
    await this.db.promptTemplate.delete({ where: { id } });
  }
}

export function createPromptLibraryService(db: PrismaClient): PromptLibraryService {
  return new PromptLibraryService(db);
}
