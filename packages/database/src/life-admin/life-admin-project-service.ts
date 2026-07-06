import type { PersonalProjectCategory, PersonalProjectStatus } from "../generated/prisma/client";
import type { PrismaClient } from "../client";
import { toPrismaJsonValue } from "../json-utils";
import type { LifeAdminLinksService } from "./life-admin-links-service";
import {
  PROJECT_ACTIVE_STATUSES,
  PROJECT_CATEGORY_ORDER,
  PROJECT_OPEN_STATUSES,
  type CreatePersonalProjectInput,
  type PersonalProjectDashboardStats,
  type PersonalProjectCategorySummary,
} from "./life-admin-types";

export interface PersonalProjectDetail {
  project: NonNullable<Awaited<ReturnType<LifeAdminProjectService["getPersonalProject"]>>>;
  linkedCaptures: Awaited<ReturnType<LifeAdminLinksService["listLinkedCapturesForTarget"]>>;
  entityLinks: Awaited<ReturnType<LifeAdminLinksService["listLinksForSource"]>>;
}

export class LifeAdminProjectService {
  constructor(
    private readonly db: PrismaClient,
    private readonly links: LifeAdminLinksService,
  ) {}

  async listPersonalProjects(options: {
    status?: PersonalProjectStatus | PersonalProjectStatus[];
    category?: PersonalProjectCategory;
    limit?: number;
    dueBefore?: Date;
  } = {}) {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    return this.db.personalProject.findMany({
      where: {
        status: statusFilter,
        category: options.category,
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
    });
  }

  async createPersonalProject(input: CreatePersonalProjectInput) {
    return this.db.personalProject.create({
      data: {
        name: input.name,
        description: input.description ?? "",
        status: input.status ?? "idea",
        category: input.category ?? "other",
        nextAction: input.nextAction ?? undefined,
        nextActionDate: input.nextActionDate ?? undefined,
        notes: input.notes ?? "",
        links: toPrismaJsonValue(input.links),
        costCents: input.costCents ?? undefined,
        worldId: input.worldId ?? undefined,
        pageId: input.pageId ?? undefined,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getPersonalProject(id: string) {
    return this.db.personalProject.findUnique({
      where: { id },
      include: {
        world: { select: { id: true, name: true, slug: true } },
        page: {
          select: {
            id: true,
            title: true,
            slug: true,
            type: true,
            world: { select: { slug: true } },
          },
        },
      },
    });
  }

  async getPersonalProjectDetail(id: string): Promise<PersonalProjectDetail | null> {
    const project = await this.getPersonalProject(id);
    if (!project) {
      return null;
    }

    const [linkedCaptures, entityLinks] = await Promise.all([
      this.links.listLinkedCapturesForTarget("personal_project", id),
      this.links.listLinksForSource("personal_project", id),
    ]);

    return { project, linkedCaptures, entityLinks };
  }

  async updatePersonalProject(id: string, input: Partial<CreatePersonalProjectInput>) {
    return this.db.personalProject.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        category: input.category,
        nextAction: input.nextAction ?? undefined,
        nextActionDate: input.nextActionDate === undefined ? undefined : input.nextActionDate,
        notes: input.notes,
        links: input.links === undefined ? undefined : toPrismaJsonValue(input.links),
        costCents: input.costCents ?? undefined,
        worldId: input.worldId ?? undefined,
        pageId: input.pageId ?? undefined,
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
      },
    });
  }

  async deletePersonalProject(id: string) {
    await this.db.adminEntityLink.deleteMany({
      where: {
        OR: [
          { sourceType: "personal_project", sourceId: id },
          { targetType: "personal_project", targetId: id },
        ],
      },
    });
    return this.db.personalProject.delete({ where: { id } });
  }

  async getPersonalProjectDashboardStats(): Promise<PersonalProjectDashboardStats> {
    const [rows, recentByCategory] = await Promise.all([
      this.db.personalProject.groupBy({
        by: ["category", "status"],
        _count: { _all: true },
      }),
      Promise.all(
        PROJECT_CATEGORY_ORDER.map((category) =>
          this.db.personalProject.findMany({
            where: { category },
            orderBy: [{ updatedAt: "desc" }],
            take: 3,
            select: {
              id: true,
              name: true,
              status: true,
              nextAction: true,
              updatedAt: true,
            },
          }),
        ),
      ),
    ]);

    const byCategory: Record<PersonalProjectCategory, number> = {
      uwe: 0,
      hardware_homelab: 0,
      dnd: 0,
      art_workshop: 0,
      printing_3d: 0,
      other: 0,
    };

    const byStatus: Record<PersonalProjectStatus, number> = {
      idea: 0,
      planned: 0,
      active: 0,
      blocked: 0,
      paused: 0,
      done: 0,
      archived: 0,
    };

    let total = 0;
    for (const row of rows) {
      byCategory[row.category] += row._count._all;
      byStatus[row.status] += row._count._all;
      total += row._count._all;
    }

    const sumRows = (
      predicate: (row: (typeof rows)[number]) => boolean,
    ): number =>
      rows.reduce((sum, row) => (predicate(row) ? sum + row._count._all : sum), 0);

    const categories: PersonalProjectCategorySummary[] = PROJECT_CATEGORY_ORDER.map(
      (category, index) => {
        const categoryTotal = byCategory[category];
        const active = sumRows(
          (row) =>
            row.category === category && PROJECT_ACTIVE_STATUSES.includes(row.status),
        );
        const done = sumRows(
          (row) => row.category === category && row.status === "done",
        );
        return {
          category,
          total: categoryTotal,
          active,
          done,
          progressPercent:
            categoryTotal > 0 ? Math.round((done / categoryTotal) * 100) : 0,
          recentProjects: recentByCategory[index] ?? [],
        };
      },
    );

    const activeTotal = sumRows((row) => PROJECT_ACTIVE_STATUSES.includes(row.status));
    const openTotal = sumRows((row) => PROJECT_OPEN_STATUSES.includes(row.status));

    return { total, activeTotal, openTotal, byCategory, byStatus, categories };
  }
}
