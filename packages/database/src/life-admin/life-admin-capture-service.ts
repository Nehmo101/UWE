import type { CaptureStatus, CaptureType, PersonalProjectCategory, WorkshopProjectType } from "../generated/prisma-brain/client";
import type { BrainPrismaClient as PrismaClient } from "../brain-client";
import { toPrismaJsonValue } from "../json-utils";
import type { LifeAdminLinksService } from "./life-admin-links-service";
import type { LifeAdminProjectService } from "./life-admin-project-service";
import type { LifeAdminWorkshopService } from "./life-admin-workshop-service";
import type {
  CaptureSourceGroup,
  CreateCaptureInput,
  CreatePersonalProjectInput,
  CreateWorkshopProjectInput,
  ListCapturesOptions,
} from "./life-admin-types";
import type { CaptureEntry } from "../generated/prisma-brain/client";

function readMetadataSource(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const source = (metadata as Record<string, unknown>).source;
  return typeof source === "string" ? source : null;
}

export function matchesCaptureSourceGroup(
  capture: Pick<CaptureEntry, "captureType" | "metadata" | "storageKey">,
  group: CaptureSourceGroup,
): boolean {
  const metaSource = readMetadataSource(capture.metadata);
  if (group === "mail") {
    return metaSource === "mail";
  }
  if (group === "scan") {
    return (
      capture.captureType === "file_image" ||
      capture.captureType === "voice_memo" ||
      metaSource === "scan" ||
      Boolean(capture.storageKey)
    );
  }
  return metaSource !== "mail" && capture.captureType !== "file_image" && capture.captureType !== "voice_memo";
}

export interface LifeAdminCaptureDeps {
  links: LifeAdminLinksService;
  project: LifeAdminProjectService;
  workshop: LifeAdminWorkshopService;
}

export class LifeAdminCaptureService {
  constructor(
    private readonly db: PrismaClient,
    private readonly deps: LifeAdminCaptureDeps,
  ) {}

  async listCaptures(options: ListCapturesOptions = {}) {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    const rows = await this.db.captureEntry.findMany({
      where: {
        status: statusFilter,
        captureType: options.captureType,
      },
      orderBy: [{ capturedAt: "desc" }],
      take: options.sourceGroup ? (options.limit ?? 100) * 3 : (options.limit ?? 50),
      skip: options.offset ?? 0,
    });

    if (!options.sourceGroup) {
      return rows.slice(0, options.limit ?? 50);
    }

    const filtered = rows.filter((row) => matchesCaptureSourceGroup(row, options.sourceGroup!));
    return filtered.slice(0, options.limit ?? 100);
  }

  async archiveCaptures(ids: string[]) {
    if (ids.length === 0) return 0;
    const result = await this.db.captureEntry.updateMany({
      where: { id: { in: ids } },
      data: { status: "archived" },
    });
    return result.count;
  }

  async getCapture(id: string) {
    return this.db.captureEntry.findUnique({ where: { id } });
  }

  async createCapture(input: CreateCaptureInput) {
    return this.db.captureEntry.create({
      data: {
        title: input.title ?? "",
        content: input.content ?? "",
        captureType: input.captureType ?? "quick_note",
        status: input.status ?? "inbox",
        url: input.url ?? undefined,
        storageKey: input.storageKey ?? undefined,
        worldId: input.worldId ?? undefined,
        pageId: input.pageId ?? undefined,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async updateCapture(id: string, input: Partial<CreateCaptureInput>) {
    return this.db.captureEntry.update({
      where: { id },
      data: {
        title: input.title,
        content: input.content,
        captureType: input.captureType,
        status: input.status,
        url: input.url ?? undefined,
        storageKey: input.storageKey ?? undefined,
        worldId: input.worldId ?? undefined,
        pageId: input.pageId ?? undefined,
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
        triagedAt:
          input.status === "triaged" || input.status === "linked"
            ? new Date()
            : undefined,
      },
    });
  }

  async deleteCapture(id: string) {
    await this.db.adminEntityLink.deleteMany({
      where: {
        OR: [
          { sourceType: "capture", sourceId: id },
          { targetType: "capture", targetId: id },
        ],
      },
    });
    return this.db.captureEntry.delete({ where: { id } });
  }

  async getCaptureStatusCounts(): Promise<Record<CaptureStatus, number>> {
    const rows = await this.db.captureEntry.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const counts: Record<CaptureStatus, number> = {
      inbox: 0,
      triaged: 0,
      linked: 0,
      archived: 0,
    };

    for (const row of rows) {
      counts[row.status] = row._count._all;
    }

    return counts;
  }

  async convertCaptureToProject(
    captureId: string,
    overrides: Partial<CreatePersonalProjectInput> = {},
  ) {
    const capture = await this.getCapture(captureId);
    if (!capture) {
      throw new Error("Capture not found");
    }

    const categoryByType: Partial<Record<CaptureType, PersonalProjectCategory>> = {
      uwe_todo: "uwe",
      project_idea: "uwe",
      hardware: "hardware_homelab",
      dnd_idea: "dnd",
      art_miniature_terrain: "art_workshop",
      contract_expense: "other",
    };

    const project = await this.deps.project.createPersonalProject({
      name: overrides.name ?? (capture.title || "Aus Capture"),
      description: overrides.description ?? capture.content,
      category: overrides.category ?? categoryByType[capture.captureType] ?? "other",
      status: overrides.status ?? "idea",
      notes: overrides.notes ?? `Erstellt aus Capture (${capture.id}).`,
      worldId: capture.worldId ?? overrides.worldId,
      pageId: capture.pageId ?? overrides.pageId,
      metadata: overrides.metadata,
    });

    await this.deps.links.createAdminLink({
      sourceType: "capture",
      sourceId: captureId,
      targetType: "personal_project",
      targetId: project.id,
      relationType: "converted",
      label: "Aus Capture",
    });

    await this.updateCapture(captureId, { status: "linked" });

    return { capture: await this.getCapture(captureId), project };
  }

  async convertCaptureToWorkshop(
    captureId: string,
    overrides: Partial<CreateWorkshopProjectInput> = {},
  ) {
    const capture = await this.getCapture(captureId);
    if (!capture) {
      throw new Error("Capture not found");
    }

    const typeByCapture: Partial<Record<CaptureType, WorkshopProjectType>> = {
      art_miniature_terrain: "miniature",
      dnd_idea: "dnd_terrain",
      file_image: "miniature",
    };

    const workshop = await this.deps.workshop.createWorkshopProject({
      title: overrides.title ?? (capture.title || "Aus Capture"),
      projectType: overrides.projectType ?? typeByCapture[capture.captureType] ?? "other",
      description: overrides.description ?? capture.content,
      status: overrides.status ?? "planned",
      notes: overrides.notes ?? `Erstellt aus Capture (${capture.id}).`,
      referenceImages: capture.storageKey
        ? [{ storageKey: capture.storageKey, label: capture.title }]
        : overrides.referenceImages,
      worldId: capture.worldId ?? overrides.worldId,
      pageId: capture.pageId ?? overrides.pageId,
      metadata: overrides.metadata,
    });

    await this.deps.links.createAdminLink({
      sourceType: "capture",
      sourceId: captureId,
      targetType: "workshop_project",
      targetId: workshop.id,
      relationType: "converted",
      label: "Aus Capture",
    });

    await this.updateCapture(captureId, { status: "linked" });

    return { capture: await this.getCapture(captureId), workshop };
  }
}
