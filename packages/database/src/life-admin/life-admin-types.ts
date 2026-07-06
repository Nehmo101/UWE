import type {
  AdminLinkSourceType,
  AdminLinkTargetType,
  CaptureEntry,
  CaptureStatus,
  CaptureType,
  ContractBillingInterval,
  ContractExpenseSource,
  ContractExpenseType,
  ContractStatus,
  HardwareStatus,
  PersonalBrainDocument,
  PersonalBrainFact,
  PersonalProjectCategory,
  PersonalProjectStatus,
  WorkshopPaintTarget,
  WorkshopProjectType,
  WorkshopRentalStatus,
  WorkshopStatus,
} from "../generated/prisma/client";
import type {
  PersonalBrainSearchOptions,
  PersonalBrainSearchResult,
} from "../personal-brain-search";

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
  ContractExpenseSource,
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
  WorkshopPaintRecipe,
  WorkshopPrintProfile,
  WorkshopTerrainRental,
  WorkshopPaintTarget,
  WorkshopRentalStatus,
} from "../generated/prisma/client";

export {
  CaptureStatus as CaptureStatusEnum,
  CaptureType as CaptureTypeEnum,
  PersonalProjectStatus as PersonalProjectStatusEnum,
  PersonalProjectCategory as PersonalProjectCategoryEnum,
  WorkshopStatus as WorkshopStatusEnum,
  WorkshopProjectType as WorkshopProjectTypeEnum,
  ContractStatus as ContractStatusEnum,
  ContractExpenseType as ContractExpenseTypeEnum,
  ContractExpenseSource as ContractExpenseSourceEnum,
  ContractBillingInterval as ContractBillingIntervalEnum,
  HardwareStatus as HardwareStatusEnum,
  AdminLinkSourceType as AdminLinkSourceTypeEnum,
  AdminLinkTargetType as AdminLinkTargetTypeEnum,
  WorkshopPaintTarget as WorkshopPaintTargetEnum,
  WorkshopRentalStatus as WorkshopRentalStatusEnum,
} from "../generated/prisma/client";
export { CAPTURE_TYPE_LABELS } from "../capture-constants";

export const CAPTURE_STATUS_LABELS: Record<CaptureStatus, string> = {
  inbox: "Inbox",
  triaged: "Sortiert",
  linked: "Verknüpft",
  archived: "Archiviert",
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

/** Display order for project domain dashboards (tiles on /projects, /today). */
export const PROJECT_CATEGORY_ORDER = Object.keys(
  PROJECT_CATEGORY_LABELS,
) as PersonalProjectCategory[];

/** Statuses counted as "aktiv" — shared between /projects domain tiles and /today. */
export const PROJECT_ACTIVE_STATUSES: PersonalProjectStatus[] = [
  "active",
  "planned",
  "blocked",
];

/** Statuses counted as "offen" (everything not done/archived). */
export const PROJECT_OPEN_STATUSES: PersonalProjectStatus[] = [
  "idea",
  "planned",
  "active",
  "blocked",
  "paused",
];

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

export {
  WORKSHOP_PAINT_TARGET_LABELS,
  WORKSHOP_RENTAL_STATUS_LABELS,
  type WorkshopOpenTask,
} from "../workshop-types";

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
  nextActionDate?: Date | null;
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
  resultPhotos?: unknown;
  costCents?: number | null;
  nextAction?: string | null;
  nextActionDate?: Date | null;
  notes?: string;
  worldId?: string | null;
  pageId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CreateWorkshopPaintRecipeInput {
  name: string;
  targetType?: WorkshopPaintTarget;
  primer?: string;
  basecoat?: string;
  wash?: string;
  highlights?: string;
  colorsUsed?: unknown;
  resultPhotoUrl?: string | null;
  rating?: number | null;
  notes?: string;
  workshopProjectId?: string | null;
}

export interface CreateWorkshopPrintProfileInput {
  name?: string;
  printer?: string;
  nozzle?: string;
  filament?: string;
  layerHeight?: string;
  supports?: string;
  result?: string;
  errors?: string;
  improvements?: string;
  notes?: string;
  workshopProjectId?: string | null;
}

export interface CreateWorkshopTerrainRentalInput {
  terrainSetName: string;
  boxLabel?: string;
  replacementValueCents?: number | null;
  rentalPriceCents?: number | null;
  depositCents?: number | null;
  status?: WorkshopRentalStatus;
  damages?: string;
  handoverChecklist?: unknown;
  returnChecklist?: unknown;
  notes?: string;
  workshopProjectId?: string | null;
}

export interface CreateContractExpenseInput {
  name: string;
  vendor?: string;
  status?: ContractStatus;
  expenseType?: ContractExpenseType;
  source?: ContractExpenseSource;
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

export interface PromoteCaptureToLifeBrainInput {
  captureId: string;
  asFact?: boolean;
  category?: string | null;
  factType?: string;
  tags?: string[] | null;
}

export interface PersonalBrainDocumentDetail {
  document: PersonalBrainDocument;
  tags: string[];
  linkedCaptures: CaptureEntry[];
}

export interface PersonalBrainFactDetail {
  fact: PersonalBrainFact;
  tags: string[];
  linkedCaptures: CaptureEntry[];
}

export type { PersonalBrainSearchOptions, PersonalBrainSearchResult };

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

export interface PersonalProjectCategorySummary {
  category: PersonalProjectCategory;
  total: number;
  /** Projects in PROJECT_ACTIVE_STATUSES. */
  active: number;
  done: number;
  /** done / total, rounded percent (0 for empty categories). */
  progressPercent: number;
  recentProjects: Array<{
    id: string;
    name: string;
    status: PersonalProjectStatus;
    nextAction: string | null;
    updatedAt: Date;
  }>;
}

export interface PersonalProjectDashboardStats {
  total: number;
  /** Projects in PROJECT_ACTIVE_STATUSES — same counting logic as /today. */
  activeTotal: number;
  /** Projects in PROJECT_OPEN_STATUSES (not done/archived). */
  openTotal: number;
  byCategory: Record<PersonalProjectCategory, number>;
  byStatus: Record<PersonalProjectStatus, number>;
  categories: PersonalProjectCategorySummary[];
}
