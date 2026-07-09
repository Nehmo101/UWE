import type {
  BrainDocumentType,
  BrainFactType,
  BrainLinkSourceType,
  BrainLinkTargetType,
  BrainSource,
  BrainStatus,
  BrainVisibility,
  Prisma,
} from "./generated/prisma/client";
import { createPrismaClient, type PrismaClient } from "./client";

export type {
  BrainDocument,
  BrainChunk,
  BrainFact,
  BrainLink,
  BrainDocumentType,
  BrainFactType,
  BrainLinkSourceType,
  BrainLinkTargetType,
  BrainSource,
  BrainStatus,
  BrainVisibility,
} from "./generated/prisma/client";

export {
  BrainDocumentType as BrainDocumentTypeEnum,
  BrainFactType as BrainFactTypeEnum,
  BrainLinkSourceType as BrainLinkSourceTypeEnum,
  BrainLinkTargetType as BrainLinkTargetTypeEnum,
  BrainSource as BrainSourceEnum,
  BrainStatus as BrainStatusEnum,
  BrainVisibility as BrainVisibilityEnum,
} from "./generated/prisma/client";

export const BRAIN_VISIBILITY_LABELS: Record<BrainVisibility, string> = {
  dm_only: "Nur GM",
  player_visible: "Spieler sichtbar",
  public: "Öffentlich",
};

export const BRAIN_STATUS_LABELS: Record<BrainStatus, string> = {
  draft: "Entwurf",
  reviewed: "Geprüft",
  canonical: "Kanon",
  deprecated: "Veraltet",
};

export const BRAIN_SOURCE_LABELS: Record<BrainSource, string> = {
  manual: "Manuell",
  ai_generated: "KI-generiert",
  import: "Importiert",
  session_summary: "Session-Zusammenfassung",
};

export const BRAIN_DOCUMENT_TYPE_LABELS: Record<BrainDocumentType, string> = {
  world_knowledge: "Weltwissen",
  campaign_knowledge: "Kampagnenwissen",
  session_summary: "Session-Zusammenfassung",
  npc_facts: "NPC-Fakten",
  location_facts: "Orts-Fakten",
  faction_facts: "Fraktions-Fakten",
  canon_facts: "Kanon-Fakten",
  general: "Allgemein",
  ai_summary: "KI-Zusammenfassung",
};

export const BRAIN_FACT_TYPE_LABELS: Record<BrainFactType, string> = {
  npc: "NPC",
  location: "Ort",
  faction: "Fraktion",
  canon: "Kanon",
  plot_thread: "Plot-Strang",
  decision: "Entscheidung",
  custom: "Sonstiges",
};

/** Visibilities exposed to player portal / preview context. */
export const PORTAL_BRAIN_VISIBILITIES: BrainVisibility[] = ["public", "player_visible"];

export type BrainAccessContext = "dm" | "portal" | "preview";

export function isPortalBrainVisibility(visibility: BrainVisibility): boolean {
  return PORTAL_BRAIN_VISIBILITIES.includes(visibility);
}

export function filterBrainByVisibility<T extends { visibility: BrainVisibility }>(
  items: T[],
  context: BrainAccessContext,
): T[] {
  if (context === "dm") {
    return items;
  }
  return items.filter((item) => isPortalBrainVisibility(item.visibility));
}

const ACTIVE_STATUSES: BrainStatus[] = ["draft", "reviewed", "canonical"];

function documentInclude() {
  return {
    campaign: { select: { id: true, name: true, slug: true } },
    gameSession: { select: { id: true, title: true, sessionNumber: true } },
    page: { select: { id: true, title: true, slug: true, type: true } },
    chunks: { orderBy: { chunkIndex: "asc" as const } },
  } as const;
}

function factInclude() {
  return {
    campaign: { select: { id: true, name: true, slug: true } },
    gameSession: { select: { id: true, title: true, sessionNumber: true } },
    page: { select: { id: true, title: true, slug: true, type: true } },
  } as const;
}

export type BrainDocumentWithRelations = Prisma.BrainDocumentGetPayload<{
  include: ReturnType<typeof documentInclude>;
}>;

export type BrainFactWithRelations = Prisma.BrainFactGetPayload<{
  include: ReturnType<typeof factInclude>;
}>;

export interface CreateBrainDocumentInput {
  worldId: string;
  title: string;
  content?: string;
  documentType?: BrainDocumentType;
  visibility?: BrainVisibility;
  source?: BrainSource;
  status?: BrainStatus;
  trustLevel?: number | null;
  campaignId?: string | null;
  gameSessionId?: string | null;
  pageId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateBrainDocumentInput {
  title?: string;
  content?: string;
  documentType?: BrainDocumentType;
  visibility?: BrainVisibility;
  source?: BrainSource;
  status?: BrainStatus;
  trustLevel?: number | null;
  campaignId?: string | null;
  gameSessionId?: string | null;
  pageId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateBrainFactInput {
  worldId: string;
  title: string;
  content?: string;
  factType?: BrainFactType;
  visibility?: BrainVisibility;
  source?: BrainSource;
  status?: BrainStatus;
  confidence?: number | null;
  campaignId?: string | null;
  gameSessionId?: string | null;
  pageId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface UpdateBrainFactInput {
  title?: string;
  content?: string;
  factType?: BrainFactType;
  visibility?: BrainVisibility;
  source?: BrainSource;
  status?: BrainStatus;
  confidence?: number | null;
  campaignId?: string | null;
  gameSessionId?: string | null;
  pageId?: string | null;
  metadata?: Prisma.InputJsonValue;
}

export interface CreateBrainChunkInput {
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount?: number | null;
  embedding?: Prisma.InputJsonValue;
}

export interface CreateBrainLinkInput {
  worldId: string;
  sourceType: BrainLinkSourceType;
  sourceId: string;
  targetType: BrainLinkTargetType;
  targetId: string;
  relationType?: string;
  label?: string | null;
}

export interface ListBrainDocumentsOptions {
  campaignId?: string | null;
  pageId?: string | null;
  gameSessionId?: string | null;
  documentType?: BrainDocumentType;
  status?: BrainStatus | BrainStatus[];
  visibility?: BrainVisibility;
  includeArchived?: boolean;
  accessContext?: BrainAccessContext;
}

export interface SearchableBrainChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  embedding: number[] | null;
  document: {
    id: string;
    title: string;
    visibility: BrainVisibility;
    documentType: BrainDocumentType;
    status: BrainStatus;
    campaignId: string | null;
  };
}

export interface ListBrainFactsOptions {
  campaignId?: string | null;
  pageId?: string | null;
  gameSessionId?: string | null;
  factType?: BrainFactType;
  status?: BrainStatus | BrainStatus[];
  visibility?: BrainVisibility;
  includeArchived?: boolean;
  accessContext?: BrainAccessContext;
}

export class BrainStoreService {
  constructor(private readonly db: PrismaClient) {}

  async getDocumentById(documentId: string): Promise<BrainDocumentWithRelations | null> {
    return this.db.brainDocument.findUnique({
      where: { id: documentId },
      include: documentInclude(),
    });
  }

  async getDocumentByIdForWorld(
    worldSlug: string,
    documentId: string,
  ): Promise<BrainDocumentWithRelations | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    return this.db.brainDocument.findFirst({
      where: { id: documentId, worldId: world.id },
      include: documentInclude(),
    });
  }

  async listDocuments(
    worldSlug: string,
    options?: ListBrainDocumentsOptions,
  ): Promise<BrainDocumentWithRelations[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    const statuses = resolveStatuses(options?.status, options?.includeArchived);

    const documents = await this.db.brainDocument.findMany({
      where: {
        worldId: world.id,
        status: { in: statuses },
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
        ...(options?.pageId ? { pageId: options.pageId } : {}),
        ...(options?.gameSessionId ? { gameSessionId: options.gameSessionId } : {}),
        ...(options?.documentType ? { documentType: options.documentType } : {}),
        ...(options?.visibility ? { visibility: options.visibility } : {}),
      },
      include: documentInclude(),
      orderBy: [{ updatedAt: "desc" }],
    });

    return filterBrainByVisibility(documents, options?.accessContext ?? "dm");
  }

  async createDocument(input: CreateBrainDocumentInput): Promise<BrainDocumentWithRelations> {
    await this.validateScope(input.worldId, input.campaignId, input.pageId, input.gameSessionId);

    return this.db.brainDocument.create({
      data: {
        worldId: input.worldId,
        title: input.title,
        content: input.content ?? "",
        documentType: input.documentType ?? "general",
        visibility: input.visibility ?? "dm_only",
        source: input.source ?? "manual",
        status: input.status ?? "draft",
        trustLevel: input.trustLevel ?? null,
        campaignId: input.campaignId ?? null,
        gameSessionId: input.gameSessionId ?? null,
        pageId: input.pageId ?? null,
        metadata: input.metadata,
      },
      include: documentInclude(),
    });
  }

  async updateDocument(
    documentId: string,
    input: UpdateBrainDocumentInput,
  ): Promise<BrainDocumentWithRelations> {
    const existing = await this.db.brainDocument.findUnique({ where: { id: documentId } });
    if (!existing) {
      throw new Error("Brain document not found");
    }

    if (
      input.campaignId !== undefined ||
      input.pageId !== undefined ||
      input.gameSessionId !== undefined
    ) {
      await this.validateScope(
        existing.worldId,
        input.campaignId ?? existing.campaignId,
        input.pageId ?? existing.pageId,
        input.gameSessionId ?? existing.gameSessionId,
      );
    }

    return this.db.brainDocument.update({
      where: { id: documentId },
      data: {
        title: input.title,
        content: input.content,
        documentType: input.documentType,
        visibility: input.visibility,
        source: input.source,
        status: input.status,
        trustLevel: input.trustLevel,
        campaignId: input.campaignId,
        gameSessionId: input.gameSessionId,
        pageId: input.pageId,
        metadata: input.metadata,
      },
      include: documentInclude(),
    });
  }

  async getFactById(factId: string): Promise<BrainFactWithRelations | null> {
    return this.db.brainFact.findUnique({
      where: { id: factId },
      include: factInclude(),
    });
  }

  async getFactByIdForWorld(
    worldSlug: string,
    factId: string,
  ): Promise<BrainFactWithRelations | null> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    return this.db.brainFact.findFirst({
      where: { id: factId, worldId: world.id },
      include: factInclude(),
    });
  }

  async listFacts(
    worldSlug: string,
    options?: ListBrainFactsOptions,
  ): Promise<BrainFactWithRelations[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    const statuses = resolveStatuses(options?.status, options?.includeArchived);

    const facts = await this.db.brainFact.findMany({
      where: {
        worldId: world.id,
        status: { in: statuses },
        ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
        ...(options?.pageId ? { pageId: options.pageId } : {}),
        ...(options?.gameSessionId ? { gameSessionId: options.gameSessionId } : {}),
        ...(options?.factType ? { factType: options.factType } : {}),
        ...(options?.visibility ? { visibility: options.visibility } : {}),
      },
      include: factInclude(),
      orderBy: [{ updatedAt: "desc" }],
    });

    return filterBrainByVisibility(facts, options?.accessContext ?? "dm");
  }

  async createFact(input: CreateBrainFactInput): Promise<BrainFactWithRelations> {
    await this.validateScope(input.worldId, input.campaignId, input.pageId, input.gameSessionId);

    return this.db.brainFact.create({
      data: {
        worldId: input.worldId,
        title: input.title,
        content: input.content ?? "",
        factType: input.factType ?? "custom",
        visibility: input.visibility ?? "dm_only",
        source: input.source ?? "manual",
        status: input.status ?? "draft",
        confidence: input.confidence ?? null,
        campaignId: input.campaignId ?? null,
        gameSessionId: input.gameSessionId ?? null,
        pageId: input.pageId ?? null,
        metadata: input.metadata,
      },
      include: factInclude(),
    });
  }

  async updateFact(factId: string, input: UpdateBrainFactInput): Promise<BrainFactWithRelations> {
    const existing = await this.db.brainFact.findUnique({ where: { id: factId } });
    if (!existing) {
      throw new Error("Brain fact not found");
    }

    if (
      input.campaignId !== undefined ||
      input.pageId !== undefined ||
      input.gameSessionId !== undefined
    ) {
      await this.validateScope(
        existing.worldId,
        input.campaignId ?? existing.campaignId,
        input.pageId ?? existing.pageId,
        input.gameSessionId ?? existing.gameSessionId,
      );
    }

    return this.db.brainFact.update({
      where: { id: factId },
      data: {
        title: input.title,
        content: input.content,
        factType: input.factType,
        visibility: input.visibility,
        source: input.source,
        status: input.status,
        confidence: input.confidence,
        campaignId: input.campaignId,
        gameSessionId: input.gameSessionId,
        pageId: input.pageId,
        metadata: input.metadata,
      },
      include: factInclude(),
    });
  }

  async listSearchableChunks(
    worldSlug: string,
    options?: {
      accessContext?: BrainAccessContext;
      campaignId?: string | null;
      documentIds?: string[];
    },
  ): Promise<SearchableBrainChunk[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    const chunks = await this.db.brainChunk.findMany({
      where: {
        document: {
          worldId: world.id,
          status: { in: ACTIVE_STATUSES },
          ...(options?.campaignId ? { campaignId: options.campaignId } : {}),
          ...(options?.documentIds?.length ? { id: { in: options.documentIds } } : {}),
        },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            visibility: true,
            documentType: true,
            status: true,
            campaignId: true,
          },
        },
      },
      orderBy: [{ documentId: "asc" }, { chunkIndex: "asc" }],
    });

    const accessContext = options?.accessContext ?? "dm";
    const visibleDocuments = filterBrainByVisibility(
      chunks.map((chunk) => chunk.document),
      accessContext,
    );
    const visibleDocumentIds = new Set(visibleDocuments.map((document) => document.id));

    return chunks
      .filter((chunk) => visibleDocumentIds.has(chunk.documentId))
      .map((chunk) => ({
        id: chunk.id,
        documentId: chunk.documentId,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embedding: parseEmbeddingVector(chunk.embedding),
        document: chunk.document,
      }));
  }

  async replaceDocumentChunks(
    documentId: string,
    chunks: Omit<CreateBrainChunkInput, "documentId">[],
  ) {
    const document = await this.db.brainDocument.findUnique({ where: { id: documentId } });
    if (!document) {
      throw new Error("Brain document not found");
    }

    await this.db.$transaction([
      this.db.brainChunk.deleteMany({ where: { documentId } }),
      ...chunks.map((chunk) =>
        this.db.brainChunk.create({
          data: {
            documentId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            tokenCount: chunk.tokenCount ?? null,
            embedding: chunk.embedding,
          },
        }),
      ),
    ]);

    return this.getDocumentById(documentId);
  }

  async createLink(input: CreateBrainLinkInput) {
    return this.db.brainLink.create({
      data: {
        worldId: input.worldId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        relationType: input.relationType ?? "related",
        label: input.label ?? null,
      },
    });
  }

  async listLinksForSource(
    worldSlug: string,
    sourceType: BrainLinkSourceType,
    sourceId: string,
  ) {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.brainLink.findMany({
      where: { worldId: world.id, sourceType, sourceId },
      orderBy: [{ createdAt: "asc" }],
    });
  }

  async listLinksForTarget(
    worldSlug: string,
    targetType: BrainLinkTargetType,
    targetId: string,
  ) {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.brainLink.findMany({
      where: { worldId: world.id, targetType, targetId },
      orderBy: [{ createdAt: "asc" }],
    });
  }

  async deleteLink(linkId: string) {
    return this.db.brainLink.delete({ where: { id: linkId } });
  }

  async getWorldSummary(worldSlug: string) {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return null;

    const [documentCount, factCount, chunkCount, linkCount] = await Promise.all([
      this.db.brainDocument.count({
        where: { worldId: world.id, status: { in: ACTIVE_STATUSES } },
      }),
      this.db.brainFact.count({
        where: { worldId: world.id, status: { in: ACTIVE_STATUSES } },
      }),
      this.db.brainChunk.count({
        where: { document: { worldId: world.id } },
      }),
      this.db.brainLink.count({ where: { worldId: world.id } }),
    ]);

    return {
      worldId: world.id,
      documentCount,
      factCount,
      chunkCount,
      linkCount,
    };
  }

  private async validateScope(
    worldId: string,
    campaignId?: string | null,
    pageId?: string | null,
    gameSessionId?: string | null,
  ) {
    if (campaignId) {
      const campaign = await this.db.campaign.findFirst({
        where: { id: campaignId, worldId },
      });
      if (!campaign) {
        throw new Error("Campaign does not belong to world");
      }
    }

    if (pageId) {
      const page = await this.db.page.findFirst({
        where: { id: pageId, worldId },
      });
      if (!page) {
        throw new Error("Page does not belong to world");
      }
      if (page.campaignId && campaignId && page.campaignId !== campaignId) {
        throw new Error("Page campaign mismatch");
      }
    }

    if (gameSessionId) {
      const session = await this.db.gameSession.findFirst({
        where: { id: gameSessionId, worldId },
      });
      if (!session) {
        throw new Error("Game session does not belong to world");
      }
      if (session.campaignId && campaignId && session.campaignId !== campaignId) {
        throw new Error("Game session campaign mismatch");
      }
    }
  }
}

function parseEmbeddingVector(value: unknown): number[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const vector = value.filter((entry): entry is number => typeof entry === "number");
  return vector.length > 0 ? vector : null;
}

function resolveStatuses(
  status: BrainStatus | BrainStatus[] | undefined,
  includeArchived?: boolean,
): BrainStatus[] {
  if (status) {
    return Array.isArray(status) ? status : [status];
  }
  return includeArchived ? [...ACTIVE_STATUSES, "deprecated"] : ACTIVE_STATUSES;
}

export function createBrainStoreService(databaseUrl?: string): BrainStoreService {
  return new BrainStoreService(createPrismaClient(databaseUrl));
}
