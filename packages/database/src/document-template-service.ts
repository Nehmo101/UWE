import type {
  DocumentTemplate,
  DocumentTemplateCategory,
} from "./generated/prisma-family/client";
// Vorlagen sind Family, das erzeugte Dokument landet im Owner-Brain — der
// Generator schreibt also über die DB-Grenze hinweg.
import type { PersonalBrainDocument } from "./generated/prisma-brain/client";
import type { BrainPrismaClient } from "./brain-client";
import type { FamilyPrismaClient } from "./family-client";
import { toPrismaJsonValue } from "./json-utils";
import { PERSONAL_BRAIN_CATEGORIES } from "./personal-brain-constants";

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

/** Life-Brain-Kategorie, unter der generierte Dokumente abgelegt werden. */
export const DOCUMENT_TEMPLATE_BRAIN_CATEGORY: Record<
  DocumentTemplateCategory,
  (typeof PERSONAL_BRAIN_CATEGORIES)[number]
> = {
  contract: "contracts_expenses",
  guide: "troubleshooting",
  checklist: "personal_notes",
  other: "personal_notes",
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

export class MissingTemplateVariablesError extends Error {
  constructor(readonly missing: string[]) {
    super(
      `Pflichtfelder fehlen: ${missing.map((key) => `{{${key}}}`).join(", ")}`,
    );
    this.name = "MissingTemplateVariablesError";
  }
}

export interface FillDocumentTemplateInput {
  name: string;
  body: string;
  variables?: unknown;
}

export interface FillDocumentTemplateOptions {
  /** Titel des generierten Dokuments; Default: "<Vorlagenname> — <Datum>". */
  title?: string;
  /** Zeitstempel für den Default-Titel (deterministische Tests). */
  now?: Date;
}

export interface FilledDocumentTemplate {
  title: string;
  content: string;
  /** Tatsächlich ausgefüllte Platzhalter-Keys. */
  variables: string[];
}

/**
 * Füllt einen Template-Body mit Werten (Repo-Konvention wie
 * `fillAgentJobPreset` in packages/agent-jobs): alle Platzhalter sind
 * Pflichtfelder — wirft `MissingTemplateVariablesError`, wenn ein im Body
 * oder in `variables` deklarierter Platzhalter leer bleibt. So landet kein
 * halb ausgefülltes Dokument im Life Brain.
 */
export function fillDocumentTemplate(
  template: FillDocumentTemplateInput,
  values: Record<string, string>,
  options: FillDocumentTemplateOptions = {},
): FilledDocumentTemplate {
  const required = new Set([
    ...normalizeDocumentTemplateVariables(template.variables),
    ...extractDocumentTemplateVariables(template.body),
  ]);
  const missing = [...required]
    .filter((key) => !(values[key] ?? "").trim())
    .sort();
  if (missing.length > 0) {
    throw new MissingTemplateVariablesError(missing);
  }

  const content = template.body.replace(
    TEMPLATE_PLACEHOLDER_PATTERN,
    (_match, key: string) => (values[key] ?? "").trim(),
  );

  const explicitTitle = options.title?.trim();
  const date = (options.now ?? new Date()).toISOString().slice(0, 10);
  const title = explicitTitle || `${template.name.trim()} — ${date}`;

  return { title, content, variables: [...required].sort() };
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
  constructor(
    private readonly db: FamilyPrismaClient,
    /** Ziel des Generators: das erzeugte Dokument gehört ins Owner-Brain. */
    private readonly brainDb: BrainPrismaClient,
  ) {}

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

  /**
   * Generier-Workflow: Template laden, Platzhalter füllen (alle Pflicht) und
   * das fertige Dokument über den bestehenden Speicher-Pfad als
   * Life-Brain-Dokument (`PersonalBrainDocument`) ablegen.
   */
  async generateDocument(
    templateId: string,
    values: Record<string, string>,
    options: FillDocumentTemplateOptions = {},
  ): Promise<PersonalBrainDocument> {
    const template = await this.getTemplate(templateId);
    if (!template) {
      throw new Error("Vorlage nicht gefunden.");
    }

    const filled = fillDocumentTemplate(template, values, options);
    const generatedAt = (options.now ?? new Date()).toISOString();

    return this.brainDb.personalBrainDocument.create({
      data: {
        title: filled.title,
        content: filled.content,
        category: DOCUMENT_TEMPLATE_BRAIN_CATEGORY[template.category],
        metadata: toPrismaJsonValue({
          generatedFromTemplateId: template.id,
          generatedFromTemplateName: template.name,
          templateCategory: template.category,
          generatedAt,
          variables: Object.fromEntries(
            filled.variables.map((key) => [key, (values[key] ?? "").trim()]),
          ),
        }),
      },
    });
  }
}

export function createDocumentTemplateService(
  db: FamilyPrismaClient,
  brainDb: BrainPrismaClient,
): DocumentTemplateService {
  return new DocumentTemplateService(db, brainDb);
}
