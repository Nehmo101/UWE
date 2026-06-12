import type { LabelPrintStatus, Prisma } from "./generated/prisma/client";
import { createPrismaClient, prisma, type PrismaClient } from "./client";
import type { LabelWithRelations } from "./label-service";
import { normalizeLabel } from "./label-service";

export type { LabelPrintStatus } from "./generated/prisma/client";

export const LABEL_PRINT_STATUS_LABELS: Record<LabelPrintStatus, string> = {
  open: "Offen",
  exported: "Exportiert",
  printed: "Gedruckt",
  archived: "Archiviert",
};

export interface CreatePrintListInput {
  worldId: string;
  campaignId?: string | null;
  name: string;
  description?: string | null;
  forNextSession?: boolean;
  labelIds?: { labelId: string; copies?: number }[];
}

export interface UpdatePrintListInput {
  name?: string;
  description?: string | null;
  status?: LabelPrintStatus;
  forNextSession?: boolean;
}

export interface PrintListItemInput {
  labelId: string;
  copies?: number;
  sortOrder?: number;
}

export type PrintListWithItems = Prisma.PrintListGetPayload<{
  include: {
    items: {
      include: {
        label: { include: { template: true; campaign: true } };
      };
    };
    campaign: true;
  };
}>;

export class PrintListService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listByWorld(worldSlug: string): Promise<PrintListWithItems[]> {
    const world = await this.db.world.findUnique({ where: { slug: worldSlug } });
    if (!world) return [];

    return this.db.printList.findMany({
      where: { worldId: world.id },
      include: {
        items: {
          include: { label: { include: { template: true, campaign: true } } },
          orderBy: { sortOrder: "asc" },
        },
        campaign: true,
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getById(printListId: string): Promise<PrintListWithItems | null> {
    return this.db.printList.findUnique({
      where: { id: printListId },
      include: {
        items: {
          include: { label: { include: { template: true, campaign: true } } },
          orderBy: { sortOrder: "asc" },
        },
        campaign: true,
      },
    });
  }

  async create(input: CreatePrintListInput): Promise<PrintListWithItems> {
    const list = await this.db.printList.create({
      data: {
        worldId: input.worldId,
        campaignId: input.campaignId ?? null,
        name: input.name,
        description: input.description ?? null,
        forNextSession: input.forNextSession ?? false,
      },
      include: {
        items: {
          include: { label: { include: { template: true, campaign: true } } },
          orderBy: { sortOrder: "asc" },
        },
        campaign: true,
      },
    });

    if (input.labelIds?.length) {
      for (let i = 0; i < input.labelIds.length; i++) {
        const entry = input.labelIds[i]!;
        await this.addLabel(list.id, entry.labelId, entry.copies ?? 1, i);
      }
      return (await this.getById(list.id))!;
    }

    return list;
  }

  async update(printListId: string, input: UpdatePrintListInput): Promise<PrintListWithItems> {
    await this.db.printList.update({
      where: { id: printListId },
      data: {
        name: input.name,
        description: input.description,
        status: input.status,
        forNextSession: input.forNextSession,
      },
    });

    return (await this.getById(printListId))!;
  }

  async delete(printListId: string): Promise<void> {
    await this.db.printList.delete({ where: { id: printListId } });
  }

  async addLabel(
    printListId: string,
    labelId: string,
    copies = 1,
    sortOrder?: number,
  ): Promise<void> {
    const existing = await this.db.printListItem.findUnique({
      where: { printListId_labelId: { printListId, labelId } },
    });

    if (existing) {
      await this.db.printListItem.update({
        where: { id: existing.id },
        data: { copies: existing.copies + copies },
      });
      return;
    }

    const maxOrder = await this.db.printListItem.aggregate({
      where: { printListId },
      _max: { sortOrder: true },
    });

    await this.db.printListItem.create({
      data: {
        printListId,
        labelId,
        copies,
        sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
      },
    });
  }

  async removeLabel(printListId: string, labelId: string): Promise<void> {
    await this.db.printListItem.deleteMany({
      where: { printListId, labelId },
    });
  }

  async setItemCopies(printListId: string, labelId: string, copies: number): Promise<void> {
    await this.db.printListItem.updateMany({
      where: { printListId, labelId },
      data: { copies: Math.max(1, copies) },
    });
  }

  async reorderItems(printListId: string, labelIds: string[]): Promise<void> {
    for (let i = 0; i < labelIds.length; i++) {
      await this.db.printListItem.updateMany({
        where: { printListId, labelId: labelIds[i] },
        data: { sortOrder: i },
      });
    }
  }

  async markStatus(printListId: string, status: LabelPrintStatus): Promise<void> {
    await this.db.printList.update({
      where: { id: printListId },
      data: { status },
    });
  }

  async createFromPageIds(
    worldId: string,
    name: string,
    pageIds: string[],
    options: { forNextSession?: boolean; campaignId?: string | null } = {},
  ): Promise<PrintListWithItems> {
    const { createLabelService } = await import("./label-service");
    const labelService = createLabelService();
    const template = await labelService.getDefaultTemplate();

    const labelIds: { labelId: string; copies: number }[] = [];

    for (const pageId of pageIds) {
      const label = await labelService.createFromSource({
        worldId,
        campaignId: options.campaignId ?? null,
        sourceType: "page",
        sourceId: pageId,
        templateId: template.id,
      });
      labelIds.push({ labelId: label.id, copies: 1 });
    }

    return this.create({
      worldId,
      campaignId: options.campaignId ?? null,
      name,
      forNextSession: options.forNextSession,
      labelIds,
    });
  }

  expandItemsForExport(list: PrintListWithItems): LabelWithRelations[] {
    const result: LabelWithRelations[] = [];
    for (const item of list.items) {
      for (let i = 0; i < item.copies; i++) {
        result.push(item.label);
      }
    }
    return result;
  }
}

export function createPrintListService(databaseUrl?: string): PrintListService {
  if (databaseUrl) {
    return new PrintListService(createPrismaClient(databaseUrl));
  }
  return new PrintListService();
}

export function summarizePrintList(list: PrintListWithItems): {
  labelCount: number;
  totalCopies: number;
  hasDmOnly: boolean;
} {
  let totalCopies = 0;
  let hasDmOnly = false;

  for (const item of list.items) {
    totalCopies += item.copies;
    const parsed = normalizeLabel(item.label);
    if (parsed.content.containsDmOnly) {
      hasDmOnly = true;
    }
  }

  return {
    labelCount: list.items.length,
    totalCopies,
    hasDmOnly,
  };
}
