import type { BrainPrismaClient as PrismaClient } from "../brain-client";
import {
  buildLifeBrainContentFromCapture,
  resolveBrainCategoryForCaptureType,
} from "../personal-brain-capture";
import {
  collectPersonalBrainTags,
  parsePersonalBrainTags,
  searchPersonalBrain,
  type PersonalBrainSearchOptions,
  type PersonalBrainSearchResult,
} from "../personal-brain-search";
import { toPrismaJsonValue } from "../json-utils";
import type { LifeAdminCaptureService } from "./life-admin-capture-service";
import type { LifeAdminLinksService } from "./life-admin-links-service";
import type {
  CreatePersonalBrainDocumentInput,
  CreatePersonalBrainFactInput,
  PersonalBrainDocumentDetail,
  PersonalBrainFactDetail,
  PromoteCaptureToLifeBrainInput,
} from "./life-admin-types";

export interface LifeAdminBrainDeps {
  links: LifeAdminLinksService;
  capture: LifeAdminCaptureService;
}

export class LifeAdminBrainService {
  constructor(
    private readonly db: PrismaClient,
    private readonly deps: LifeAdminBrainDeps,
  ) {}

  async listPersonalBrainDocuments(options: { category?: string; limit?: number } = {}) {
    return this.db.personalBrainDocument.findMany({
      where: { category: options.category },
      orderBy: [{ updatedAt: "desc" }],
      take: options.limit ?? 50,
    });
  }

  async listAllPersonalBrainDocuments() {
    return this.db.personalBrainDocument.findMany({
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  async listAllPersonalBrainFacts() {
    return this.db.personalBrainFact.findMany({
      orderBy: [{ updatedAt: "desc" }],
    });
  }

  async searchPersonalBrain(options: PersonalBrainSearchOptions = {}): Promise<PersonalBrainSearchResult> {
    const [documents, facts] = await Promise.all([
      this.listAllPersonalBrainDocuments(),
      this.listAllPersonalBrainFacts(),
    ]);
    return searchPersonalBrain(documents, facts, options);
  }

  async listPersonalBrainTags(): Promise<string[]> {
    const [documents, facts] = await Promise.all([
      this.listAllPersonalBrainDocuments(),
      this.listAllPersonalBrainFacts(),
    ]);
    return collectPersonalBrainTags(documents, facts);
  }

  async searchPersonalBrainDocumentsForContext(query: string | undefined, limit = 12) {
    const result = await this.searchPersonalBrain({ query, limit });
    return result.documents.map((hit) => hit.item);
  }

  async searchPersonalBrainFactsForContext(query: string | undefined, limit = 12) {
    const result = await this.searchPersonalBrain({ query, limit });
    return result.facts.map((hit) => hit.item);
  }

  async getPersonalBrainDocumentDetail(id: string): Promise<PersonalBrainDocumentDetail | null> {
    const document = await this.getPersonalBrainDocument(id);
    if (!document) {
      return null;
    }

    const linkedCaptures = await this.deps.links.listLinkedCapturesForTarget(
      "personal_brain_document",
      id,
    );
    return {
      document,
      tags: parsePersonalBrainTags(document.tags),
      linkedCaptures,
    };
  }

  async getPersonalBrainFactDetail(id: string): Promise<PersonalBrainFactDetail | null> {
    const fact = await this.getPersonalBrainFact(id);
    if (!fact) {
      return null;
    }

    const linkedCaptures = await this.deps.links.listLinkedCapturesForTarget(
      "personal_brain_fact",
      id,
    );
    return {
      fact,
      tags: parsePersonalBrainTags(fact.tags),
      linkedCaptures,
    };
  }

  async promoteCaptureToLifeBrain(input: PromoteCaptureToLifeBrainInput) {
    const capture = await this.deps.capture.getCapture(input.captureId);
    if (!capture) {
      throw new Error(`Capture ${input.captureId} nicht gefunden.`);
    }

    const content = buildLifeBrainContentFromCapture({
      content: capture.content,
      url: capture.url,
    });
    const title = capture.title.trim() || content.slice(0, 80) || "Capture";
    const metadata = {
      promotedFromCaptureId: capture.id,
      captureType: capture.captureType,
      promotedAt: new Date().toISOString(),
    };

    if (input.asFact) {
      const fact = await this.createPersonalBrainFact({
        title,
        content,
        factType: input.factType ?? "capture",
        tags: input.tags,
        metadata,
      });

      await this.deps.links.createAdminLink({
        sourceType: "capture",
        sourceId: capture.id,
        targetType: "personal_brain_fact",
        targetId: fact.id,
        relationType: "promoted_to",
        label: "Ins Life Brain übernommen",
      });

      await this.deps.capture.updateCapture(capture.id, { status: "linked" });
      return { kind: "fact" as const, entry: fact };
    }

    const category = resolveBrainCategoryForCaptureType(capture.captureType, input.category);
    const document = await this.createPersonalBrainDocument({
      title,
      content,
      category,
      tags: input.tags,
      metadata,
    });

    await this.deps.links.createAdminLink({
      sourceType: "capture",
      sourceId: capture.id,
      targetType: "personal_brain_document",
      targetId: document.id,
      relationType: "promoted_to",
      label: "Ins Life Brain übernommen",
    });

    await this.deps.capture.updateCapture(capture.id, { status: "linked" });
    return { kind: "document" as const, entry: document };
  }

  async createPersonalBrainDocument(input: CreatePersonalBrainDocumentInput) {
    return this.db.personalBrainDocument.create({
      data: {
        title: input.title,
        content: input.content ?? "",
        category: input.category ?? undefined,
        tags: toPrismaJsonValue(input.tags),
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getPersonalBrainDocument(id: string) {
    return this.db.personalBrainDocument.findUnique({ where: { id } });
  }

  async updatePersonalBrainDocument(id: string, input: Partial<CreatePersonalBrainDocumentInput>) {
    return this.db.personalBrainDocument.update({
      where: { id },
      data: {
        title: input.title,
        content: input.content,
        category: input.category ?? undefined,
        tags: input.tags === undefined ? undefined : toPrismaJsonValue(input.tags),
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
      },
    });
  }

  async deletePersonalBrainDocument(id: string) {
    await this.db.adminEntityLink.deleteMany({
      where: {
        OR: [
          { sourceType: "personal_brain_document", sourceId: id },
          { targetType: "personal_brain_document", targetId: id },
        ],
      },
    });
    return this.db.personalBrainDocument.delete({ where: { id } });
  }

  async listPersonalBrainFacts(options: { factType?: string; limit?: number } = {}) {
    return this.db.personalBrainFact.findMany({
      where: { factType: options.factType },
      orderBy: [{ updatedAt: "desc" }],
      take: options.limit ?? 50,
    });
  }

  async createPersonalBrainFact(input: CreatePersonalBrainFactInput) {
    return this.db.personalBrainFact.create({
      data: {
        factType: input.factType ?? "custom",
        title: input.title,
        content: input.content ?? "",
        tags: toPrismaJsonValue(input.tags),
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getPersonalBrainFact(id: string) {
    return this.db.personalBrainFact.findUnique({ where: { id } });
  }

  async updatePersonalBrainFact(id: string, input: Partial<CreatePersonalBrainFactInput>) {
    return this.db.personalBrainFact.update({
      where: { id },
      data: {
        factType: input.factType,
        title: input.title,
        content: input.content,
        tags: input.tags === undefined ? undefined : toPrismaJsonValue(input.tags),
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
      },
    });
  }

  async deletePersonalBrainFact(id: string) {
    await this.db.adminEntityLink.deleteMany({
      where: {
        OR: [
          { sourceType: "personal_brain_fact", sourceId: id },
          { targetType: "personal_brain_fact", targetId: id },
        ],
      },
    });
    return this.db.personalBrainFact.delete({ where: { id } });
  }
}
