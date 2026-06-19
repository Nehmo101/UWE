import type {
  AdminLinkSourceType,
  AdminLinkTargetType,
  CaptureStatus,
  CaptureType,
  ContractBillingInterval,
  ContractExpenseType,
  ContractStatus,
  HardwareStatus,
  PersonalProjectCategory,
  PersonalProjectStatus,
  Prisma,
  WorkshopProjectType,
  WorkshopStatus,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { toPrismaJsonValue } from "./json-utils";
import {
  buildContractAlerts,
  summarizeContractCosts,
  type ContractAlert,
  type ContractCostSummary,
} from "./contract-expense-utils";
import {
  countOpenSetupSteps,
  detectHardwareUrlWarnings,
  type HardwareUrlWarning,
} from "./hardware-utils";
import { DEFAULT_GENERATOR_PRESETS } from "./generator-service";

export type {
  CaptureEntry,
  CaptureStatus,
  CaptureType,
  PersonalProject,
  PersonalProjectCategory,
  PersonalProjectStatus,
  WorkshopProject,
  WorkshopProjectType,
  WorkshopStatus,
  ContractExpense,
  ContractExpenseType,
  ContractStatus,
  HardwareDevice,
  HardwareStatus,
  PersonalBrainDocument,
  PersonalBrainFact,
  AdminEntityLink,
  AdminLinkSourceType,
  AdminLinkTargetType,
  GeneratorPreset,
  GeneratorOutput,
} from "./generated/prisma/client";

export {
  CaptureStatus as CaptureStatusEnum,
  CaptureType as CaptureTypeEnum,
  PersonalProjectStatus as PersonalProjectStatusEnum,
  PersonalProjectCategory as PersonalProjectCategoryEnum,
  WorkshopStatus as WorkshopStatusEnum,
  WorkshopProjectType as WorkshopProjectTypeEnum,
  ContractStatus as ContractStatusEnum,
  ContractExpenseType as ContractExpenseTypeEnum,
  ContractBillingInterval as ContractBillingIntervalEnum,
  HardwareStatus as HardwareStatusEnum,
  AdminLinkSourceType as AdminLinkSourceTypeEnum,
  AdminLinkTargetType as AdminLinkTargetTypeEnum,
} from "./generated/prisma/client";

export const CAPTURE_STATUS_LABELS: Record<CaptureStatus, string> = {
  inbox: "Inbox",
  triaged: "Sortiert",
  linked: "Verknüpft",
  archived: "Archiviert",
};

export const CAPTURE_TYPE_LABELS: Record<CaptureType, string> = {
  quick_note: "Schnelle Notiz",
  dnd_idea: "DnD-Idee",
  uwe_todo: "UWE-To-do",
  project_idea: "Projektidee",
  hardware: "Hardware/Homelab",
  contract_expense: "Vertrag/Ausgabe",
  art_miniature_terrain: "Kunst/Miniatur/Terrain",
  link: "Link",
  file_image: "Datei/Bild",
};

export const PERSONAL_BRAIN_CATEGORIES = [
  "uwe_coding",
  "hardware_homelab",
  "contracts_expenses",
  "art_workshop",
  "miniatures_terrain",
  "printing_3d",
  "troubleshooting",
  "personal_notes",
] as const;

export const PERSONAL_BRAIN_CATEGORY_LABELS: Record<string, string> = {
  uwe_coding: "UWE/Coding",
  hardware_homelab: "Hardware/Homelab",
  contracts_expenses: "Verträge/Ausgaben",
  art_workshop: "Kunst/Werkstatt",
  miniatures_terrain: "Miniaturen/Terrain",
  printing_3d: "3D-Druck",
  troubleshooting: "Anleitungen/Troubleshooting",
  personal_notes: "Persönliche Notizen",
};

export const PROJECT_CATEGORY_LABELS: Record<PersonalProjectCategory, string> = {
  uwe: "UWE",
  hardware_homelab: "Hardware/Homelab",
  dnd: "DnD",
  art_workshop: "Kunst/Werkstatt",
  printing_3d: "3D-Druck",
  other: "Sonstiges",
};

export const WORKSHOP_TYPE_LABELS: Record<WorkshopProjectType, string> = {
  dnd_terrain: "DnD-Terrain",
  miniature: "Miniatur",
  printing_3d: "3D-Druck",
  diorama: "Diorama",
  artwork: "Kunstwerk",
  other: "Sonstiges",
};

export const PROJECT_STATUS_LABELS: Record<PersonalProjectStatus, string> = {
  idea: "Idee",
  planned: "Geplant",
  active: "Aktiv",
  blocked: "Blockiert",
  paused: "Pausiert",
  done: "Erledigt",
  archived: "Archiviert",
};

export const WORKSHOP_STATUS_LABELS: Record<WorkshopStatus, string> = {
  idea: "Idee",
  planned: "Geplant",
  material_missing: "Material fehlt",
  in_progress: "In Arbeit",
  paused: "Pausiert",
  done: "Fertig",
  archived: "Archiviert",
};

/** Primary happy-path workflow for quick status advancement in the Werkstatt UI. */
export const WORKSHOP_STATUS_FLOW: WorkshopStatus[] = [
  "idea",
  "planned",
  "material_missing",
  "in_progress",
  "done",
];

export function getNextWorkshopStatus(current: WorkshopStatus): WorkshopStatus | null {
  const index = WORKSHOP_STATUS_FLOW.indexOf(current);
  if (index === -1 || index >= WORKSHOP_STATUS_FLOW.length - 1) {
    return null;
  }
  return WORKSHOP_STATUS_FLOW[index + 1] ?? null;
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Aktiv",
  cancelled: "Gekündigt",
  review: "Prüfen",
  paused: "Pausiert",
  archived: "Archiviert",
};

export const HARDWARE_STATUS_LABELS: Record<HardwareStatus, string> = {
  planned: "Geplant",
  active: "Aktiv",
  offline: "Offline",
  broken: "Defekt",
  retired: "Ausgemustert",
  archived: "Archiviert",
};

export interface ListCapturesOptions {
  status?: CaptureStatus | CaptureStatus[];
  captureType?: CaptureType;
  limit?: number;
  offset?: number;
}

export interface CreateCaptureInput {
  title?: string;
  content?: string;
  captureType?: CaptureType;
  status?: CaptureStatus;
  url?: string | null;
  storageKey?: string | null;
  worldId?: string | null;
  pageId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreatePersonalProjectInput {
  name: string;
  description?: string;
  status?: PersonalProjectStatus;
  category?: PersonalProjectCategory;
  nextAction?: string | null;
  notes?: string;
  links?: Array<{ label: string; url: string }> | null;
  costCents?: number | null;
  worldId?: string | null;
  pageId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateWorkshopProjectInput {
  title: string;
  projectType: WorkshopProjectType;
  status?: WorkshopStatus;
  description?: string;
  materialsNeeded?: unknown;
  materialsUsed?: unknown;
  colorsUsed?: unknown;
  filamentsUsed?: unknown;
  stlLinks?: unknown;
  imageGallery?: unknown;
  referenceImages?: unknown;
  progressPhotos?: unknown;
  costCents?: number | null;
  nextAction?: string | null;
  notes?: string;
  worldId?: string | null;
  pageId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateContractExpenseInput {
  name: string;
  vendor?: string;
  status?: ContractStatus;
  expenseType?: ContractExpenseType;
  billingInterval?: ContractBillingInterval;
  categoryLabel?: string;
  amountCents?: number | null;
  currency?: string;
  billingDay?: number | null;
  startDate?: Date | null;
  nextPaymentDate?: Date | null;
  renewalDate?: Date | null;
  cancelByDate?: Date | null;
  portalUrl?: string | null;
  notes?: string;
  metadata?: Record<string, unknown> | null;
}

export interface CreateHardwareDeviceInput {
  name: string;
  role?: string;
  status?: HardwareStatus;
  hostname?: string | null;
  ipAddress?: string | null;
  localUrl?: string | null;
  publicUrl?: string | null;
  operatingSystem?: string;
  specs?: unknown;
  setupSteps?: unknown;
  errorNotes?: string | null;
  notes?: string;
  metadata?: Record<string, unknown> | null;
}

export interface CreatePersonalBrainDocumentInput {
  title: string;
  content?: string;
  category?: string | null;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreatePersonalBrainFactInput {
  factType?: string;
  title: string;
  content?: string;
  tags?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateAdminLinkInput {
  sourceType: AdminLinkSourceType;
  sourceId: string;
  targetType: AdminLinkTargetType;
  targetId: string;
  relationType?: string;
  label?: string | null;
}

export interface CreateGeneratorPresetInput {
  worldId?: string | null;
  name: string;
  description?: string;
  targetType: string;
  template: Record<string, unknown>;
  isSystem?: boolean;
  sortOrder?: number;
}

export interface CreateGeneratorOutputInput {
  worldId?: string | null;
  pageId?: string | null;
  presetId?: string | null;
  contextType?: string | null;
  contextId?: string | null;
  generatorAction?: string | null;
  promptSummary?: string | null;
  output: Record<string, unknown>;
  isFavorite?: boolean;
  variantOfId?: string | null;
  aiRunId?: string | null;
  tone?: string | null;
}

export interface TodayAdminSummary {
  inboxCaptureCount: number;
  activeProjectCount: number;
  activeWorkshopCount: number;
  contractsNeedingReview: number;
  contractAlerts: ContractAlert[];
  contractCosts: ContractCostSummary;
  hardwareIssues: number;
  hardwareUrlWarnings: HardwareUrlWarning[];
  openSetupSteps: number;
  recentCaptures: Awaited<ReturnType<LifeAdminService["listCaptures"]>>;
  activeProjects: Awaited<ReturnType<LifeAdminService["listPersonalProjects"]>>;
  activeWorkshops: Awaited<ReturnType<LifeAdminService["listWorkshopProjects"]>>;
}

export class LifeAdminService {
  constructor(private readonly db: PrismaClient) {}

  async listCaptures(options: ListCapturesOptions = {}) {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    return this.db.captureEntry.findMany({
      where: {
        status: statusFilter,
        captureType: options.captureType,
      },
      orderBy: [{ capturedAt: "desc" }],
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    });
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

    const project = await this.createPersonalProject({
      name: overrides.name ?? (capture.title || "Aus Capture"),
      description: overrides.description ?? capture.content,
      category: overrides.category ?? categoryByType[capture.captureType] ?? "other",
      status: overrides.status ?? "idea",
      notes: overrides.notes ?? `Erstellt aus Capture (${capture.id}).`,
      worldId: capture.worldId ?? overrides.worldId,
      pageId: capture.pageId ?? overrides.pageId,
      metadata: overrides.metadata,
    });

    await this.createAdminLink({
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

    const workshop = await this.createWorkshopProject({
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

    await this.createAdminLink({
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

  async listPersonalProjects(options: {
    status?: PersonalProjectStatus | PersonalProjectStatus[];
    category?: PersonalProjectCategory;
    limit?: number;
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
      },
      orderBy: [{ updatedAt: "desc" }],
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
    return this.db.personalProject.findUnique({ where: { id } });
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

  async listWorkshopProjects(options: {
    status?: WorkshopStatus | WorkshopStatus[];
    projectType?: WorkshopProjectType;
    limit?: number;
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
      },
      orderBy: [{ updatedAt: "desc" }],
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
        costCents: input.costCents ?? undefined,
        nextAction: input.nextAction ?? undefined,
        notes: input.notes ?? "",
        worldId: input.worldId ?? undefined,
        pageId: input.pageId ?? undefined,
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getWorkshopProject(id: string) {
    return this.db.workshopProject.findUnique({ where: { id } });
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
        costCents: input.costCents ?? undefined,
        nextAction: input.nextAction ?? undefined,
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

  async listContractExpenses(options: {
    status?: ContractStatus | ContractStatus[];
    limit?: number;
  } = {}) {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    return this.db.contractExpense.findMany({
      where: { status: statusFilter },
      orderBy: [{ renewalDate: "asc" }, { updatedAt: "desc" }],
      take: options.limit ?? 50,
    });
  }

  async createContractExpense(input: CreateContractExpenseInput) {
    return this.db.contractExpense.create({
      data: {
        name: input.name,
        vendor: input.vendor ?? "",
        status: input.status ?? "active",
        expenseType: input.expenseType ?? "other",
        billingInterval: input.billingInterval ?? "monthly",
        categoryLabel: input.categoryLabel ?? "",
        amountCents: input.amountCents ?? undefined,
        currency: input.currency ?? "EUR",
        billingDay: input.billingDay ?? undefined,
        startDate: input.startDate ?? undefined,
        nextPaymentDate: input.nextPaymentDate ?? undefined,
        renewalDate: input.renewalDate ?? undefined,
        cancelByDate: input.cancelByDate ?? undefined,
        portalUrl: input.portalUrl ?? undefined,
        notes: input.notes ?? "",
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getContractExpense(id: string) {
    return this.db.contractExpense.findUnique({ where: { id } });
  }

  async updateContractExpense(id: string, input: Partial<CreateContractExpenseInput>) {
    return this.db.contractExpense.update({
      where: { id },
      data: {
        name: input.name,
        vendor: input.vendor,
        status: input.status,
        expenseType: input.expenseType,
        billingInterval: input.billingInterval,
        categoryLabel: input.categoryLabel,
        amountCents: input.amountCents ?? undefined,
        currency: input.currency,
        billingDay: input.billingDay ?? undefined,
        startDate: input.startDate ?? undefined,
        nextPaymentDate: input.nextPaymentDate ?? undefined,
        renewalDate: input.renewalDate ?? undefined,
        cancelByDate: input.cancelByDate ?? undefined,
        portalUrl: input.portalUrl ?? undefined,
        notes: input.notes,
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
      },
    });
  }

  async deleteContractExpense(id: string) {
    await this.db.adminEntityLink.deleteMany({
      where: {
        OR: [
          { sourceType: "contract_expense", sourceId: id },
          { targetType: "contract_expense", targetId: id },
        ],
      },
    });
    return this.db.contractExpense.delete({ where: { id } });
  }

  async listHardwareDevices(options: {
    status?: HardwareStatus | HardwareStatus[];
    limit?: number;
  } = {}) {
    const statusFilter = options.status
      ? Array.isArray(options.status)
        ? { in: options.status }
        : options.status
      : undefined;

    return this.db.hardwareDevice.findMany({
      where: { status: statusFilter },
      orderBy: [{ updatedAt: "desc" }],
      take: options.limit ?? 50,
    });
  }

  async createHardwareDevice(input: CreateHardwareDeviceInput) {
    return this.db.hardwareDevice.create({
      data: {
        name: input.name,
        role: input.role ?? "",
        status: input.status ?? "planned",
        hostname: input.hostname ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        localUrl: input.localUrl ?? undefined,
        publicUrl: input.publicUrl ?? undefined,
        operatingSystem: input.operatingSystem ?? "",
        specs: toPrismaJsonValue(input.specs),
        setupSteps: toPrismaJsonValue(input.setupSteps),
        errorNotes: input.errorNotes ?? undefined,
        notes: input.notes ?? "",
        metadata: toPrismaJsonValue(input.metadata),
      },
    });
  }

  async getHardwareDevice(id: string) {
    return this.db.hardwareDevice.findUnique({ where: { id } });
  }

  async updateHardwareDevice(id: string, input: Partial<CreateHardwareDeviceInput>) {
    return this.db.hardwareDevice.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        status: input.status,
        hostname: input.hostname ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        localUrl: input.localUrl ?? undefined,
        publicUrl: input.publicUrl ?? undefined,
        operatingSystem: input.operatingSystem,
        specs: input.specs === undefined ? undefined : toPrismaJsonValue(input.specs),
        setupSteps: input.setupSteps === undefined ? undefined : toPrismaJsonValue(input.setupSteps),
        errorNotes: input.errorNotes ?? undefined,
        notes: input.notes,
        metadata: input.metadata === undefined ? undefined : toPrismaJsonValue(input.metadata),
      },
    });
  }

  async toggleHardwareSetupStep(deviceId: string, stepIndex: number) {
    const device = await this.getHardwareDevice(deviceId);
    if (!device) {
      throw new Error(`Hardware-Gerät ${deviceId} nicht gefunden.`);
    }

    const raw = device.setupSteps;
    if (!Array.isArray(raw)) {
      return device;
    }

    const steps = raw.map((step) => {
      if (typeof step === "string") {
        return { label: step, done: false };
      }
      const record = step as { label?: string; done?: boolean };
      return { label: record.label ?? "", done: Boolean(record.done) };
    });

    if (stepIndex < 0 || stepIndex >= steps.length) {
      return device;
    }

    const current = steps[stepIndex];
    if (!current) {
      return device;
    }

    steps[stepIndex] = { ...current, done: !current.done };
    return this.updateHardwareDevice(deviceId, { setupSteps: steps });
  }

  async deleteHardwareDevice(id: string) {
    await this.db.adminEntityLink.deleteMany({
      where: {
        OR: [
          { sourceType: "hardware_device", sourceId: id },
          { targetType: "hardware_device", targetId: id },
        ],
      },
    });
    return this.db.hardwareDevice.delete({ where: { id } });
  }

  async listPersonalBrainDocuments(options: { category?: string; limit?: number } = {}) {
    return this.db.personalBrainDocument.findMany({
      where: { category: options.category },
      orderBy: [{ updatedAt: "desc" }],
      take: options.limit ?? 50,
    });
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

  async ensureDefaultGeneratorPresets() {
    const existing = await this.db.generatorPreset.count({ where: { isSystem: true } });
    if (existing > 0) {
      return existing;
    }

    await this.db.generatorPreset.createMany({
      data: DEFAULT_GENERATOR_PRESETS.map((preset, index) => ({
        name: preset.name,
        description: preset.description,
        targetType: preset.targetType,
        template: preset.template as Prisma.InputJsonValue,
        isSystem: true,
        sortOrder: index,
      })),
    });

    return DEFAULT_GENERATOR_PRESETS.length;
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

  async listGeneratorPresets(options: { worldId?: string | null; targetType?: string } = {}) {
    return this.db.generatorPreset.findMany({
      where: {
        worldId: options.worldId === null ? null : options.worldId,
        targetType: options.targetType,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
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

  async getTodaySummary(): Promise<TodayAdminSummary> {
    const [contracts, hardwareDevices] = await Promise.all([
      this.listContractExpenses({ limit: 500 }),
      this.listHardwareDevices({ limit: 500 }),
    ]);

    const contractAlerts = buildContractAlerts(contracts);
    const contractCosts = summarizeContractCosts(contracts);
    const hardwareUrlWarnings = detectHardwareUrlWarnings(hardwareDevices);
    const openSetupSteps = hardwareDevices.reduce(
      (sum, device) => sum + countOpenSetupSteps(device.setupSteps),
      0,
    );

    const [
      inboxCaptureCount,
      activeProjectCount,
      activeWorkshopCount,
      contractsNeedingReview,
      hardwareIssues,
      recentCaptures,
      activeProjects,
      activeWorkshops,
    ] = await Promise.all([
      this.db.captureEntry.count({ where: { status: "inbox" } }),
      this.db.personalProject.count({
        where: { status: { in: ["active", "planned", "blocked"] } },
      }),
      this.db.workshopProject.count({
        where: { status: { in: ["in_progress", "material_missing", "planned"] } },
      }),
      this.db.contractExpense.count({ where: { status: "review" } }),
      this.db.hardwareDevice.count({
        where: { status: { in: ["offline", "broken"] } },
      }),
      this.listCaptures({ status: "inbox", limit: 5 }),
      this.listPersonalProjects({
        status: ["active", "planned", "blocked"],
        limit: 5,
      }),
      this.listWorkshopProjects({
        status: ["in_progress", "material_missing", "planned"],
        limit: 5,
      }),
    ]);

    return {
      inboxCaptureCount,
      activeProjectCount,
      activeWorkshopCount,
      contractsNeedingReview,
      contractAlerts,
      contractCosts,
      hardwareIssues,
      hardwareUrlWarnings,
      openSetupSteps,
      recentCaptures,
      activeProjects,
      activeWorkshops,
    };
  }
}

export function createLifeAdminService(db: PrismaClient): LifeAdminService {
  return new LifeAdminService(db);
}
