import type {
  DocumentTemplate,
  DocumentTemplateCategory,
  PrismaClient,
} from "./generated/prisma/client";
import { toPrismaJsonValue } from "./json-utils";

export type {
  DocumentTemplate,
  DocumentTemplateCategory,
} from "./generated/prisma/client";

export { DocumentTemplateCategory as DocumentTemplateCategoryEnum } from "./generated/prisma/client";

export const DOCUMENT_TEMPLATE_CATEGORY_LABELS: Record<DocumentTemplateCategory, string> = {
  contract: "Vertrag",
  guide: "Anleitung",
  checklist: "Checkliste",
  other: "Sonstiges",
};

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
  constructor(private readonly db: PrismaClient) {}

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

  /** Replace `{{variable}}` placeholders in template body. */
  renderTemplate(body: string, values: Record<string, string>): string {
    return body.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? "");
  }
}

export function createDocumentTemplateService(db: PrismaClient): DocumentTemplateService {
  return new DocumentTemplateService(db);
}
