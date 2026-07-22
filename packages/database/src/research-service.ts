import type { ResearchContextMode, ResearchSessionStatus } from "./generated/prisma-brain/client";
import type { BrainPrismaClient as PrismaClient } from "./brain-client";

const DM_ONLY_MARKERS = [/dm_only/i, /dm-only/i, /geheim/i, /secret level/i];

export interface StartResearchInput {
  query: string;
  worldId?: string | null;
  contextMode?: ResearchContextMode;
  ownerId?: string | null;
}

export function assertResearchQuerySafe(query: string, contextMode: ResearchContextMode): void {
  if (contextMode === "open_web") {
    return;
  }
  for (const marker of DM_ONLY_MARKERS) {
    if (marker.test(query)) {
      throw new Error("Research-Query enthält DM-only Marker — nicht für Web-Recherche erlaubt.");
    }
  }
}

export class ResearchService {
  constructor(private readonly db: PrismaClient) {}

  async start(input: StartResearchInput) {
    const contextMode = input.contextMode ?? "dnd_brain";
    assertResearchQuerySafe(input.query, contextMode);

    return this.db.researchSession.create({
      data: {
        query: input.query.trim(),
        worldId: input.worldId ?? null,
        contextMode,
        ownerId: input.ownerId ?? null,
        status: "pending",
      },
    });
  }

  async list(worldId?: string) {
    return this.db.researchSession.findMany({
      where: worldId ? { worldId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { sources: true },
    });
  }

  async get(id: string) {
    return this.db.researchSession.findUnique({
      where: { id },
      include: { sources: true },
    });
  }

  async markRunning(id: string) {
    return this.db.researchSession.update({
      where: { id },
      data: { status: "running" as ResearchSessionStatus },
    });
  }

  async complete(id: string, reportMd: string, sources: Array<{ url: string; title?: string; snippet?: string }>) {
    await this.db.researchSource.deleteMany({ where: { sessionId: id } });
    await this.db.researchSource.createMany({
      data: sources.map((source) => ({
        sessionId: id,
        url: source.url,
        title: source.title ?? null,
        snippet: source.snippet ?? null,
        fetchedAt: new Date(),
      })),
    });
    return this.db.researchSession.update({
      where: { id },
      data: {
        status: "completed",
        reportMd,
      },
    });
  }

  async cancel(id: string) {
    return this.db.researchSession.update({
      where: { id },
      data: { status: "cancelled" },
    });
  }

  async fail(id: string, errorMessage: string) {
    return this.db.researchSession.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: errorMessage.slice(0, 500),
      },
    });
  }
}

export function createResearchService(db: PrismaClient): ResearchService {
  return new ResearchService(db);
}
