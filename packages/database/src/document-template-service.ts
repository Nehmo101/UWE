import type {
  DocumentTemplate,
  DocumentTemplateCategory,
} from "./generated/prisma-family/client";
import type { FamilyPrismaClient } from "./family-client";
import { toPrismaJsonValue } from "./json-utils";

export type {
  DocumentTemplate,
  DocumentTemplateCategory,
} from "./generated/prisma-family/client";

export { DocumentTemplateCategory as DocumentTemplateCategoryEnum } from "./generated/prisma-family/client";

export const DOCUMENT_TEMPLATE_CATEGORY_LABELS: Record<DocumentTemplateCategory, string> = {
  contract: "Vertrag",
  guide: "Anleitung",
  checklist: "Checkliste",
  other: "Sonstiges",
};

/** `{{variable}}`-Platzhalter, analog zu packages/agent-jobs presets.ts. */
const TEMPLATE_PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** Alle im Template-Body referenzierten Platzhalter-Keys (sortiert, eindeutig). */
export function extractDocumentTemplateVariables(body: string): string[] {
  const keys = new Set<string>();
  for (const match of body.matchAll(TEMPLATE_PLACEHOLDER_PATTERN)) {
    keys.add(match[1]!);
  }
  return [...keys].sort();
}

/** Normalisiert das `variables`-Json-Feld (Array oder Objekt) zu einer Key-Liste. */
export function normalizeDocumentTemplateVariables(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .sort();
  }
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort();
  }
  return [];
}

export interface CreateDocumentTemplateInput {
  name: string;
  category?: DocumentTemplateCategory;
  body?: string;
  variables?: string[] | Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateDocumentTemplateInput {
  name?: string;
  category?: DocumentTemplateCategory;
  body?: string;
  variables?: string[] | Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}

export interface ListDocumentTemplatesOptions {
  category?: DocumentTemplateCategory;
  limit?: number;
}

export class DocumentTemplateService {
  constructor(private readonly db: FamilyPrismaClient) {}

  async listTemplates(
    options: ListDocumentTemplatesOptions = {},
  ): Promise<DocumentTemplate[]> {
    return this.db.documentTemplate.findMany({
      where: options.category ? { category: options.category } : undefined,
      orderBy: { updatedAt: "desc" },
      take: options.limit ?? 200,
    });
  }

  async getTemplate(id: string): Promise<DocumentTemplate | null> {
    return this.db.documentTemplate.findUnique({ where: { id } });
  }

  async createTemplate(input: CreateDocumentTemplateInput): Promise<DocumentTemplate> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Name ist erforderlich.");
    }
    return this.db.documentTemplate.create({
      data: {
        name,
        category: input.category ?? "other",
        body: input.body ?? "",
        variables: toPrismaJsonValue(input.variables),
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async updateTemplate(
    id: string,
    input: UpdateDocumentTemplateInput,
  ): Promise<DocumentTemplate> {
    return this.db.documentTemplate.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.body !== undefined ? { body: input.body } : {}),
        ...(input.variables !== undefined
          ? { variables: toPrismaJsonValue(input.variables) }
          : {}),
        ...(input.metadata !== undefined
          ? { metadata: toPrismaJsonValue(input.metadata) }
          : {}),
      },
    });
  }

  async deleteTemplate(id: string): Promise<DocumentTemplate> {
    return this.db.documentTemplate.delete({ where: { id } });
  }

  /** Replace `{{variable}}` placeholders in template body (Vorschau, ohne Pflichtfeld-Validierung). */
  renderTemplate(body: string, values: Record<string, string>): string {
    return body.replace(
      TEMPLATE_PLACEHOLDER_PATTERN,
      (_match, key: string) => values[key] ?? "",
    );
  }
}

export function createDocumentTemplateService(
  db: FamilyPrismaClient,
): DocumentTemplateService {
  return new DocumentTemplateService(db);
}
