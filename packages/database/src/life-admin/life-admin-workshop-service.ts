import type { WorkshopProjectType, WorkshopRentalStatus, WorkshopStatus } from "../generated/prisma-brain/client";
import type { BrainPrismaClient as PrismaClient } from "../brain-client";
import { toPrismaJsonValue } from "../json-utils";
import type { LifeAdminCaptureService } from "./life-admin-capture-service";
import type { LifeAdminLinksService } from "./life-admin-links-service";
import {
  getNextWorkshopStatus,
  type CreateWorkshopPaintRecipeInput,
  type CreateWorkshopPrintProfileInput,
  type CreateWorkshopProjectInput,
  type CreateWorkshopTerrainRentalInput,
} from "./life-admin-types";

export interface LifeAdminWorkshopDeps {
  links: LifeAdminLinksService;
  capture: LifeAdminCaptureService;
}

export class LifeAdminWorkshopService {
  constructor(
    private readonly db: PrismaClient,
    private readonly deps: LifeAdminWorkshopDeps,
  ) {}

  async listWorkshopProjects(options: {
    status?: WorkshopStatus | WorkshopStatus[];
    projectType?: WorkshopProjectType;
    limit?: number;
    dueBefore?: Date;
  } = {}) {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    return this.db.workshopProject.findMany({
      where: {
        status: statusFilter,
        projectType: options.projectType,
        ...(options.dueBefore
          ? {
              nextActionDate: {
                not: null,
                lte: options.dueBefore,
              },
            }
          : {}),
      },
      orderBy: [{ nextActionDate: "asc" }, { updatedAt: "desc" }],
      take: options.limit ?? 50,
      include: {
        world: { select: { slug: true, name: true } },
      },
    });
  }

  async getWorkshopStatusCounts(): Promise<Record<WorkshopStatus, number>> {
    const rows = await this.db.workshopProject.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const counts: Record<WorkshopStatus, number> = {
      idea: 0,
      planned: 0,
      material_missing: 0,
      in_progress: 0,
      paused: 0,
      done: 0,
      archived: 0,
    };

    for (const row of rows) {
      counts[row.status] = row._count._all;
    }

    return counts;
  }

  async getWorkshopFilterCounts(): Promise<{
    all: number;
    active: number;
    material_missing: number;
    done: number;
    dnd: number;
  }> {
    const [all, active, materialMissing, done, dnd] = await Promise.all([
      this.db.workshopProject.count(),
      this.db.workshopProject.count({
        where: { status: { in: ["in_progress", "planned", "material_missing", "idea"] } },
      }),
      this.db.workshopProject.count({ where: { status: "material_missing" } }),
      this.db.workshopProject.count({ where: { status: "done" } }),
      this.db.workshopProject.count({ where: { worldId: { not: null } } }),
    ]);

    return {
      all,
      active,
      material_missing: materialMissing,
      done,
      dnd,
    };
  }

  async advanceWorkshopStatus(id: string) {
    const workshop = await this.getWorkshopProject(id);
    if (!workshop) {
      throw new Error("Workshop project not found");
    }

    const nextStatus = getNextWorkshopStatus(workshop.status);
    if (!nextStatus) {
      throw new Error("No next workshop status in workflow");
    }

    return this.updateWorkshopProject(id, { status: nextStatus });
  }

  async createWorkshopProject(input: CreateWorkshopProjectInput) {
    return this.db.workshopProject.create({
      data: {
        title: input.title,
        projectType: input.projectType,
        status: input.status ?? "idea",
        description: input.description ?? "",
        materialsNeeded: toPrismaJsonValue(input.materialsNeeded),
        materialsUsed: toPrismaJsonValue(input.materialsUsed),
        colorsUsed: toPrismaJsonValue(input.colorsUsed),
        filamentsUsed: toPrismaJsonValue(input.filamentsUsed),
        stlLinks: toPrismaJsonValue(input.stlLinks),
        imageGallery: toPrismaJsonValue(input.imageGallery),
        referenceImages: toPrismaJsonValue(input.referenceImages),
        progressPhotos: toPrismaJsonValue(input.progressPhotos),
        resultPhotos: toPrismaJsonValue(input.resultPhotos),
        costCents: input.costCents ?? undefined,
        nextAction: input.nextAction ?? undefined,
        nextActionDate: input.nextActionDate ?? undefined,
        notes: input.notes ?? "",
        worldId: input.worldId ?? undefined,
        pageId: input.pageId ?? undefined,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getWorkshopProject(id: string) {
    return this.db.workshopProject.findUnique({
      where: { id },
      include: {
        paintRecipes: { orderBy: { updatedAt: "desc" } },
        printProfiles: { orderBy: { updatedAt: "desc" } },
        terrainRentals: { orderBy: { updatedAt: "desc" } },
      },
    });
  }

  async updateWorkshopProject(id: string, input: Partial<CreateWorkshopProjectInput>) {
    return this.db.workshopProject.update({
      where: { id },
      data: {
        title: input.title,
        projectType: input.projectType,
        status: input.status,
        description: input.description,
        materialsNeeded: input.materialsNeeded === undefined ? undefined : toPrismaJsonValue(input.materialsNeeded),
        materialsUsed: input.materialsUsed === undefined ? undefined : toPrismaJsonValue(input.materialsUsed),
        colorsUsed: input.colorsUsed === undefined ? undefined : toPrismaJsonValue(input.colorsUsed),
        filamentsUsed: input.filamentsUsed === undefined ? undefined : toPrismaJsonValue(input.filamentsUsed),
        stlLinks: input.stlLinks === undefined ? undefined : toPrismaJsonValue(input.stlLinks),
        imageGallery: input.imageGallery === undefined ? undefined : toPrismaJsonValue(input.imageGallery),
        referenceImages: input.referenceImages === undefined ? undefined : toPrismaJsonValue(input.referenceImages),
        progressPhotos: input.progressPhotos === undefined ? undefined : toPrismaJsonValue(input.progressPhotos),
        resultPhotos: input.resultPhotos === undefined ? undefined : toPrismaJsonValue(input.resultPhotos),
        costCents: input.costCents ?? undefined,
        nextAction: input.nextAction ?? undefined,
        nextActionDate: input.nextActionDate === undefined ? undefined : input.nextActionDate,
        notes: input.notes,
        worldId: input.worldId ?? undefined,
        pageId: input.pageId ?? undefined,
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
      },
    });
  }

  async deleteWorkshopProject(id: string) {
    await this.db.adminEntityLink.deleteMany({
      where: {
        OR: [
          { sourceType: "workshop_project", sourceId: id },
          { targetType: "workshop_project", targetId: id },
        ],
      },
    });
    return this.db.workshopProject.delete({ where: { id } });
  }

  async listWorkshopOpenTasks(limit = 10) {
    const workshops = await this.listWorkshopProjects({
      status: ["in_progress", "material_missing", "planned"],
      limit: 200,
    });

    return workshops
      .filter((workshop) => Boolean(workshop.nextAction?.trim()))
      .slice(0, limit)
      .map((workshop) => ({
        id: workshop.id,
        title: workshop.title,
        projectType: workshop.projectType,
        status: workshop.status,
        nextAction: workshop.nextAction!.trim(),
        href: `/workshop/${workshop.id}`,
      }));
  }

  async promoteCaptureToWorkshop(captureId: string, overrides: Partial<CreateWorkshopProjectInput> = {}) {
    const capture = await this.db.captureEntry.findUnique({ where: { id: captureId } });
    if (!capture) throw new Error("Capture not found");

    const projectType =
      capture.captureType === "art_miniature_terrain"
        ? "miniature"
        : capture.captureType === "file_image"
          ? "artwork"
          : "other";

    const referenceImages = capture.url ? [{ url: capture.url, caption: capture.title || undefined }] : undefined;

    const workshop = await this.createWorkshopProject({
      title: overrides.title ?? (capture.title || "Werkstatt aus Capture"),
      projectType: overrides.projectType ?? projectType,
      status: overrides.status ?? "planned",
      description: overrides.description ?? capture.content,
      nextAction: overrides.nextAction ?? "Projekt planen und Material prüfen",
      referenceImages: overrides.referenceImages ?? referenceImages,
      worldId: overrides.worldId ?? capture.worldId,
      pageId: overrides.pageId ?? capture.pageId,
    });

    await this.deps.links.createAdminLink({
      sourceType: "capture",
      sourceId: captureId,
      targetType: "workshop_project",
      targetId: workshop.id,
      relationType: "promoted_to",
      label: "Werkstatt-Projekt",
    });

    await this.deps.capture.updateCapture(captureId, { status: "linked" });

    return workshop;
  }

  async listWorkshopPaintRecipes(options: { workshopProjectId?: string; limit?: number } = {}) {
    return this.db.workshopPaintRecipe.findMany({
      where: { workshopProjectId: options.workshopProjectId },
      orderBy: [{ updatedAt: "desc" }],
      take: options.limit ?? 100,
      include: { workshopProject: { select: { id: true, title: true } } },
    });
  }

  async createWorkshopPaintRecipe(input: CreateWorkshopPaintRecipeInput) {
    return this.db.workshopPaintRecipe.create({
      data: {
        name: input.name,
        targetType: input.targetType ?? "other",
        primer: input.primer ?? "",
        basecoat: input.basecoat ?? "",
        wash: input.wash ?? "",
        highlights: input.highlights ?? "",
        colorsUsed: toPrismaJsonValue(input.colorsUsed),
        resultPhotoUrl: input.resultPhotoUrl ?? undefined,
        rating: input.rating ?? undefined,
        notes: input.notes ?? "",
        workshopProjectId: input.workshopProjectId ?? undefined,
      },
    });
  }

  async updateWorkshopPaintRecipe(id: string, input: Partial<CreateWorkshopPaintRecipeInput>) {
    return this.db.workshopPaintRecipe.update({
      where: { id },
      data: {
        name: input.name,
        targetType: input.targetType,
        primer: input.primer,
        basecoat: input.basecoat,
        wash: input.wash,
        highlights: input.highlights,
        colorsUsed: input.colorsUsed === undefined ? undefined : toPrismaJsonValue(input.colorsUsed),
        resultPhotoUrl: input.resultPhotoUrl ?? undefined,
        rating: input.rating ?? undefined,
        notes: input.notes,
        workshopProjectId: input.workshopProjectId ?? undefined,
      },
    });
  }

  async deleteWorkshopPaintRecipe(id: string) {
    return this.db.workshopPaintRecipe.delete({ where: { id } });
  }

  async listWorkshopPrintProfiles(options: { workshopProjectId?: string; limit?: number } = {}) {
    return this.db.workshopPrintProfile.findMany({
      where: { workshopProjectId: options.workshopProjectId },
      orderBy: [{ updatedAt: "desc" }],
      take: options.limit ?? 100,
      include: { workshopProject: { select: { id: true, title: true } } },
    });
  }

  async createWorkshopPrintProfile(input: CreateWorkshopPrintProfileInput) {
    return this.db.workshopPrintProfile.create({
      data: {
        name: input.name ?? "",
        printer: input.printer ?? "",
        nozzle: input.nozzle ?? "",
        filament: input.filament ?? "",
        layerHeight: input.layerHeight ?? "",
        supports: input.supports ?? "",
        result: input.result ?? "",
        errors: input.errors ?? "",
        improvements: input.improvements ?? "",
        notes: input.notes ?? "",
        workshopProjectId: input.workshopProjectId ?? undefined,
      },
    });
  }

  async updateWorkshopPrintProfile(id: string, input: Partial<CreateWorkshopPrintProfileInput>) {
    return this.db.workshopPrintProfile.update({
      where: { id },
      data: {
        name: input.name,
        printer: input.printer,
        nozzle: input.nozzle,
        filament: input.filament,
        layerHeight: input.layerHeight,
        supports: input.supports,
        result: input.result,
        errors: input.errors,
        improvements: input.improvements,
        notes: input.notes,
        workshopProjectId: input.workshopProjectId ?? undefined,
      },
    });
  }

  async deleteWorkshopPrintProfile(id: string) {
    return this.db.workshopPrintProfile.delete({ where: { id } });
  }

  async listWorkshopTerrainRentals(options: { status?: WorkshopRentalStatus; limit?: number } = {}) {
    return this.db.workshopTerrainRental.findMany({
      where: { status: options.status },
      orderBy: [{ updatedAt: "desc" }],
      take: options.limit ?? 100,
      include: { workshopProject: { select: { id: true, title: true } } },
    });
  }

  async createWorkshopTerrainRental(input: CreateWorkshopTerrainRentalInput) {
    return this.db.workshopTerrainRental.create({
      data: {
        terrainSetName: input.terrainSetName,
        boxLabel: input.boxLabel ?? "",
        replacementValueCents: input.replacementValueCents ?? undefined,
        rentalPriceCents: input.rentalPriceCents ?? undefined,
        depositCents: input.depositCents ?? undefined,
        status: input.status ?? "available",
        damages: input.damages ?? "",
        handoverChecklist: toPrismaJsonValue(input.handoverChecklist),
        returnChecklist: toPrismaJsonValue(input.returnChecklist),
        notes: input.notes ?? "",
        workshopProjectId: input.workshopProjectId ?? undefined,
      },
    });
  }

  async updateWorkshopTerrainRental(id: string, input: Partial<CreateWorkshopTerrainRentalInput>) {
    return this.db.workshopTerrainRental.update({
      where: { id },
      data: {
        terrainSetName: input.terrainSetName,
        boxLabel: input.boxLabel,
        replacementValueCents: input.replacementValueCents ?? undefined,
        rentalPriceCents: input.rentalPriceCents ?? undefined,
        depositCents: input.depositCents ?? undefined,
        status: input.status,
        damages: input.damages,
        handoverChecklist:
          input.handoverChecklist === undefined ? undefined : toPrismaJsonValue(input.handoverChecklist),
        returnChecklist:
          input.returnChecklist === undefined ? undefined : toPrismaJsonValue(input.returnChecklist),
        notes: input.notes,
        workshopProjectId: input.workshopProjectId ?? undefined,
      },
    });
  }

  async deleteWorkshopTerrainRental(id: string) {
    return this.db.workshopTerrainRental.delete({ where: { id } });
  }
}
