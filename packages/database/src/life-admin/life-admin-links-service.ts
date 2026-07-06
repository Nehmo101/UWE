import type { AdminLinkSourceType, AdminLinkTargetType, Prisma } from "../generated/prisma/client";
import type { PrismaClient } from "../client";
import { DEFAULT_GENERATOR_PRESETS } from "../generator-service";
import { toPrismaJsonValue } from "../json-utils";
import type {
  CreateAdminLinkInput,
  CreateGeneratorOutputInput,
  CreateGeneratorPresetInput,
} from "./life-admin-types";

export class LifeAdminLinksService {
  constructor(private readonly db: PrismaClient) {}

  async listLinkedCapturesForTarget(
    targetType: AdminLinkTargetType,
    targetId: string,
  ) {
    const links = await this.db.adminEntityLink.findMany({
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

    return this.db.captureEntry.findMany({
      where: { id: { in: links.map((link) => link.sourceId) } },
      orderBy: [{ capturedAt: "desc" }],
    });
  }

  async ensureDefaultGeneratorPresets() {
    const existing = await this.db.generatorPreset.findMany({
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

    await this.db.generatorPreset.createMany({
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
    return this.db.adminEntityLink.create({
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
    return this.db.adminEntityLink.findMany({
      where: { sourceType, sourceId },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async listLinksForTarget(targetType: AdminLinkTargetType, targetId: string) {
    return this.db.adminEntityLink.findMany({
      where: { targetType, targetId },
      orderBy: [{ createdAt: "desc" }],
    });
  }

  async listGeneratorPresets(options: { worldId?: string | null; targetType?: string } = {}) {
    return this.db.generatorPreset.findMany({
      where: {
        worldId: options.worldId === null ? null : options.worldId,
        targetType: options.targetType,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async getGeneratorPreset(id: string) {
    return this.db.generatorPreset.findUnique({ where: { id } });
  }

  async createGeneratorPreset(input: CreateGeneratorPresetInput) {
    return this.db.generatorPreset.create({
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
    return this.db.generatorOutput.findMany({
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
    return this.db.generatorOutput.create({
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
