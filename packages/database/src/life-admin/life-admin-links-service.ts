import type { Prisma } from "../generated/prisma/client";
import type { AdminLinkSourceType, AdminLinkTargetType } from "../generated/prisma-brain/client";
import type { PrismaClient } from "../client";
import type { BrainPrismaClient } from "../brain-client";
import { DEFAULT_GENERATOR_PRESETS } from "../generator-service";
import { toPrismaJsonValue } from "../json-utils";
import type {
  CreateAdminLinkInput,
  CreateGeneratorOutputInput,
  CreateGeneratorPresetInput,
} from "./life-admin-types";

/**
 * Cross-DB resolver: admin-links and their capture rows are owner-private Brain
 * (`brainDb`, uwe-brain.db); the world-scoped generator presets/outputs are
 * D&D core (`coreDb`, uwe.db). Each method routes to exactly one store — the
 * link tables never join across the DB boundary (targets are opaque IDs).
 */
export class LifeAdminLinksService {
  constructor(
    private readonly brainDb: BrainPrismaClient,
    private readonly coreDb: PrismaClient,
  ) {}

  async listLinkedCapturesForTarget(
    targetType: AdminLinkTargetType,
    targetId: string,
  ) {
    const links = await this.brainDb.adminEntityLink.findMany({
      where: {
        targetType,
        targetId,
        sourceType: "capture",
      },
      orderBy: [{ createdAt: "desc" }],
    });

    if (links.length === 0) {
      return [];
    }

    return this.brainDb.captureEntry.findMany({
      where: { id: { in: links.map((link) => link.sourceId) } },
      orderBy: [{ capturedAt: "desc" }],
    });
  }

  async ensureDefaultGeneratorPresets() {
    const existing = await this.coreDb.generatorPreset.findMany({
      where: { isSystem: true },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((preset) => preset.name));
    const missing = DEFAULT_GENERATOR_PRESETS.map((preset, index) => ({ preset, index })).filter(
      ({ preset }) => !existingNames.has(preset.name),
    );

    if (missing.length === 0) {
      return existing.length;
    }

    await this.coreDb.generatorPreset.createMany({
      data: missing.map(({ preset, index }) => ({
        name: preset.name,
        description: preset.description,
        targetType: preset.targetType,
        template: preset.template as Prisma.InputJsonValue,
        isSystem: true,
        sortOrder: index,
      })),
    });

    return existing.length + missing.length;
  }

  async createAdminLink(input: CreateAdminLinkInput) {
    return this.brainDb.adminEntityLink.create({
      data: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        targetType: input.targetType,
        targetId: input.targetId,
        relationType: input.relationType ?? "related",
        label: input.label ?? undefined,
      },
    });
  }

  async listLinksForSource(sourceType: AdminLinkSourceType, sourceId: string) {
    return this.brainDb.adminEntityLink.findMany({
      where: { sourceType, sourceId },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async listLinksForTarget(targetType: AdminLinkTargetType, targetId: string) {
    return this.brainDb.adminEntityLink.findMany({
      where: { targetType, targetId },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async listGeneratorPresets(options: { worldId?: string | null; targetType?: string } = {}) {
    return this.coreDb.generatorPreset.findMany({
      where: {
        worldId: options.worldId === null ? null : options.worldId,
        targetType: options.targetType,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async getGeneratorPreset(id: string) {
    return this.coreDb.generatorPreset.findUnique({ where: { id } });
  }

  async createGeneratorPreset(input: CreateGeneratorPresetInput) {
    return this.coreDb.generatorPreset.create({
      data: {
        worldId: input.worldId ?? undefined,
        name: input.name,
        description: input.description ?? "",
        targetType: input.targetType,
        template: toPrismaJsonValue(input.template) ?? {},
        isSystem: input.isSystem ?? false,
        sortOrder: input.sortOrder ?? 0,
      },
    });
  }

  async listGeneratorOutputs(options: {
    worldId?: string;
    pageId?: string;
    contextType?: string;
    contextId?: string;
    limit?: number;
  } = {}) {
    return this.coreDb.generatorOutput.findMany({
      where: {
        worldId: options.worldId,
        pageId: options.pageId,
        contextType: options.contextType,
        contextId: options.contextId,
      },
      orderBy: [{ createdAt: "desc" }],
      take: options.limit ?? 50,
    });
  }

  async createGeneratorOutput(input: CreateGeneratorOutputInput) {
    return this.coreDb.generatorOutput.create({
      data: {
        worldId: input.worldId ?? undefined,
        pageId: input.pageId ?? undefined,
        presetId: input.presetId ?? undefined,
        contextType: input.contextType ?? undefined,
        contextId: input.contextId ?? undefined,
        generatorAction: input.generatorAction ?? undefined,
        promptSummary: input.promptSummary ?? undefined,
        output: toPrismaJsonValue(input.output) ?? {},
        isFavorite: input.isFavorite ?? false,
        variantOfId: input.variantOfId ?? undefined,
        aiRunId: input.aiRunId ?? undefined,
        tone: input.tone ?? undefined,
      },
    });
  }
}
