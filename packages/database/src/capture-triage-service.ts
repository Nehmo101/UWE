import { brainPrisma } from "./brain-client";
import type { CaptureEntry } from "./generated/prisma-brain/client";
import type {
  AdminLinkTargetType,
  PersonalProjectCategory,
  WorkshopProjectType,
} from "./generated/prisma/client";
import type { PrismaClient } from "./client";
import { createImageStudioService } from "./integrations-service";
import {
  CAPTURE_TYPE_LABELS,
  createLifeAdminService,
  PERSONAL_BRAIN_CATEGORY_LABELS,
  PROJECT_CATEGORY_LABELS,
  WORKSHOP_TYPE_LABELS,
  type LifeAdminService,
} from "./life-admin-service";
import {
  parseCaptureAiProposal,
  type CaptureAiProposal,
  type CaptureProposalStatus,
  type CaptureProposalTarget,
  type CaptureTriageAction,
} from "./capture-triage-ui";

export {
  CAPTURE_TRIAGE_ACTION_LABELS,
  parseCaptureAiProposal,
  PROJECT_CATEGORY_LABELS,
  WORKSHOP_TYPE_LABELS,
  type CaptureAiProposal,
  type CaptureProposalStatus,
  type CaptureProposalTarget,
  type CaptureTriageAction,
} from "./capture-triage-ui";

/** Namespace for capture inbox file uploads (not tied to a DnD world). */
export const CAPTURE_UPLOAD_NAMESPACE = "_capture";

export interface CaptureTriageResult {
  action: CaptureTriageAction;
  captureId: string;
  targetType?: AdminLinkTargetType;
  targetId?: string;
  redirectPath: string;
}

export interface CaptureTriageOptions {
  worldId?: string | null;
  pageId?: string | null;
  hardwareDeviceId?: string | null;
  workshopProjectType?: WorkshopProjectType;
  projectCategory?: PersonalProjectCategory;
  lifeBrainAsDocument?: boolean;
}

function readMetadata(capture: CaptureEntry): Record<string, unknown> {
  if (!capture.metadata || typeof capture.metadata !== "object" || Array.isArray(capture.metadata)) {
    return {};
  }
  return capture.metadata as Record<string, unknown>;
}

function readCaptureIntent(capture: CaptureEntry): string | null {
  const intent = readMetadata(capture).captureIntent;
  return typeof intent === "string" ? intent : null;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9äöüß]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3);
}

function hasKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword));
}

function defaultProjectCategory(capture: CaptureEntry): PersonalProjectCategory {
  switch (capture.captureType) {
    case "uwe_todo":
    case "project_idea":
      return "uwe";
    case "dnd_idea":
      return "dnd";
    case "hardware":
      return "hardware_homelab";
    case "art_miniature_terrain":
      return "art_workshop";
    default:
      return "other";
  }
}

function defaultWorkshopType(capture: CaptureEntry): WorkshopProjectType {
  const text = `${capture.title} ${capture.content}`.toLowerCase();
  if (hasKeyword(text, ["miniatur", "miniature", "figur"])) return "miniature";
  if (hasKeyword(text, ["3d", "druck", "filament", "stl"])) return "printing_3d";
  if (hasKeyword(text, ["terrain", "gelände", "tile", "battlemap"])) return "dnd_terrain";
  if (hasKeyword(text, ["diorama"])) return "diorama";
  return "other";
}

function defaultLifeBrainCategory(capture: CaptureEntry): string {
  switch (capture.captureType) {
    case "hardware":
      return "hardware_homelab";
    case "contract_expense":
      return "contracts_expenses";
    case "art_miniature_terrain":
      return "miniatures_terrain";
    case "uwe_todo":
    case "project_idea":
      return "uwe_coding";
    case "dnd_idea":
      return "personal_notes";
    default:
      return readCaptureIntent(capture) === "life_brain" ? "personal_notes" : "personal_notes";
  }
}

function inferProposalTarget(capture: CaptureEntry): CaptureProposalTarget {
  const intent = readCaptureIntent(capture);
  if (intent === "life_brain") return "life_brain";

  switch (capture.captureType) {
    case "dnd_idea":
      return "dnd_page";
    case "uwe_todo":
    case "project_idea":
      return "personal_project";
    case "hardware":
      return "hardware_device";
    case "contract_expense":
      return "contract_expense";
    case "art_miniature_terrain":
      return "workshop_project";
    case "link":
      return capture.url ? "life_brain" : "inbox";
    case "file_image":
      return "workshop_project";
    case "voice_memo":
      return "life_brain";
    default:
      break;
  }

  const text = `${capture.title} ${capture.content} ${capture.url ?? ""}`;
  if (hasKeyword(text, ["vertrag", "rechnung", "abo", "subscription", "kündig"])) {
    return "contract_expense";
  }
  if (hasKeyword(text, ["server", "nas", "router", "homelab", "gpu", "engine"])) {
    return "hardware_device";
  }
  if (hasKeyword(text, ["npc", "session", "kampagne", "quest", "dnd", "welt"])) {
    return "dnd_page";
  }
  if (hasKeyword(text, ["miniatur", "terrain", "druck", "werkstatt", "bemal"])) {
    return "workshop_project";
  }
  if (hasKeyword(text, ["todo", "bug", "feature", "uwe", "refactor"])) {
    return "personal_project";
  }

  return "inbox";
}

function inferTags(capture: CaptureEntry, target: CaptureProposalTarget): string[] {
  const tags = new Set<string>();
  tags.add(capture.captureType);

  if (capture.url) tags.add("link");
  if (capture.storageKey) tags.add("attachment");

  const tokens = tokenize(`${capture.title} ${capture.content}`);
  for (const token of tokens.slice(0, 6)) {
    tags.add(token);
  }

  if (target === "dnd_page") tags.add("dnd");
  if (capture.captureType === "uwe_todo") tags.add("uwe");

  return [...tags].slice(0, 8);
}

function inferNextAction(capture: CaptureEntry, target: CaptureProposalTarget): string {
  switch (target) {
    case "personal_project":
      return capture.captureType === "uwe_todo"
        ? "Als UWE-To-do in Projekte übernehmen und nächsten Schritt festlegen"
        : "Projekt anlegen und ersten Meilenstein definieren";
    case "workshop_project":
      return "Werkstatt-Projekt anlegen und Materialliste prüfen";
    case "dnd_page":
      return "Als DnD-Wiki-Entwurf oder Brain-Notiz verknüpfen";
    case "hardware_device":
      return "An betroffenes Gerät hängen oder neues Gerät anlegen";
    case "contract_expense":
      return "Vertrag/Ausgabe mit Betrag und Fälligkeit erfassen";
    case "life_brain":
      return "Als Life-Brain-Fakt speichern und taggen";
    default:
      return "Manuell sortieren oder archivieren";
  }
}

function inferCategoryLabel(capture: CaptureEntry, target: CaptureProposalTarget): string {
  if (target === "workshop_project") {
    return WORKSHOP_TYPE_LABELS[defaultWorkshopType(capture)];
  }
  if (target === "personal_project") {
    return PROJECT_CATEGORY_LABELS[defaultProjectCategory(capture)];
  }
  if (target === "life_brain") {
    return PERSONAL_BRAIN_CATEGORY_LABELS[defaultLifeBrainCategory(capture)] ?? "Persönliche Notizen";
  }
  if (target === "dnd_page") return "DnD";
  if (target === "hardware_device") return "Hardware/Homelab";
  if (target === "contract_expense") return "Verträge/Ausgaben";
  return CAPTURE_TYPE_LABELS[capture.captureType];
}

export function buildCaptureAiProposal(capture: CaptureEntry): CaptureAiProposal {
  const suggestedTarget = inferProposalTarget(capture);
  const confidence: CaptureAiProposal["confidence"] =
    capture.captureType === "quick_note" && suggestedTarget === "inbox"
      ? "low"
      : capture.captureType === "quick_note"
        ? "medium"
        : "high";

  return {
    status: "draft",
    generatedAt: new Date().toISOString(),
    source: "heuristic",
    suggestedCategory: inferCategoryLabel(capture, suggestedTarget),
    suggestedTags: inferTags(capture, suggestedTarget),
    suggestedTarget,
    suggestedNextAction: inferNextAction(capture, suggestedTarget),
    confidence,
  };
}

export function mergeCaptureMetadata(
  capture: CaptureEntry,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return { ...readMetadata(capture), ...patch };
}

export class CaptureTriageService {
  constructor(
    private readonly db: PrismaClient,
    private readonly lifeAdmin: LifeAdminService = createLifeAdminService(brainPrisma, db),
  ) {}

  async getCaptureOrThrow(id: string) {
    const capture = await this.lifeAdmin.getCapture(id);
    if (!capture) {
      throw new Error(`Capture ${id} nicht gefunden.`);
    }
    return capture;
  }

  async applyAiProposal(captureId: string, proposal: CaptureAiProposal): Promise<void> {
    const capture = await this.getCaptureOrThrow(captureId);
    await this.lifeAdmin.updateCapture(captureId, {
      metadata: mergeCaptureMetadata(capture, { aiProposal: proposal }),
    });
  }

  async ensureAiProposal(captureId: string): Promise<CaptureAiProposal> {
    const capture = await this.getCaptureOrThrow(captureId);
    const existing = parseCaptureAiProposal(capture);
    if (existing && existing.status === "draft") {
      return existing;
    }

    const proposal = buildCaptureAiProposal(capture);
    await this.lifeAdmin.updateCapture(captureId, {
      metadata: mergeCaptureMetadata(capture, { aiProposal: proposal }),
    });
    return proposal;
  }

  async updateAiProposalStatus(
    captureId: string,
    status: CaptureProposalStatus,
  ): Promise<CaptureAiProposal> {
    const capture = await this.getCaptureOrThrow(captureId);
    const proposal = parseCaptureAiProposal(capture) ?? buildCaptureAiProposal(capture);
    const updated: CaptureAiProposal = { ...proposal, status };
    await this.lifeAdmin.updateCapture(captureId, {
      metadata: mergeCaptureMetadata(capture, { aiProposal: updated }),
    });
    return updated;
  }

  async executeTriage(
    captureId: string,
    action: CaptureTriageAction,
    options: CaptureTriageOptions = {},
  ): Promise<CaptureTriageResult> {
    const capture = await this.getCaptureOrThrow(captureId);

    switch (action) {
      case "archive": {
        await this.lifeAdmin.updateCapture(captureId, { status: "archived" });
        return { action, captureId, redirectPath: "/capture" };
      }
      case "delete": {
        await this.lifeAdmin.deleteCapture(captureId);
        return { action, captureId, redirectPath: "/capture" };
      }
      case "to_personal_project":
        return this.promoteToPersonalProject(capture, options);
      case "to_workshop_project":
        return this.promoteToWorkshopProject(capture, options);
      case "to_dnd_page":
        return this.promoteToDndPage(capture, options);
      case "to_hardware_device":
        return this.promoteToHardware(capture, options);
      case "to_contract":
        return this.promoteToContract(capture);
      case "to_life_brain":
        return this.promoteToLifeBrain(capture, options);
      case "to_image_studio":
        return this.promoteToImageStudio(capture);
      default: {
        const _exhaustive: never = action;
        throw new Error(`Unbekannte Triage-Aktion: ${String(_exhaustive)}`);
      }
    }
  }

  private async linkCapture(
    captureId: string,
    targetType: AdminLinkTargetType,
    targetId: string,
    label?: string,
  ) {
    await this.lifeAdmin.createAdminLink({
      sourceType: "capture",
      sourceId: captureId,
      targetType,
      targetId,
      relationType: "promoted_to",
      label: label ?? null,
    });
    await this.lifeAdmin.updateCapture(captureId, { status: "linked" });
  }

  private buildNotesFromCapture(capture: CaptureEntry): string {
    const parts = [capture.content];
    if (capture.url) parts.push(`Link: ${capture.url}`);
    if (capture.storageKey) parts.push(`Anhang: ${capture.storageKey}`);
    return parts.filter(Boolean).join("\n\n");
  }

  private async promoteToPersonalProject(
    capture: CaptureEntry,
    options: CaptureTriageOptions,
  ): Promise<CaptureTriageResult> {
    const category = options.projectCategory ?? defaultProjectCategory(capture);
    const project = await this.lifeAdmin.createPersonalProject({
      name: capture.title || "Neues Projekt",
      description: capture.content,
      category,
      status: capture.captureType === "uwe_todo" ? "active" : "idea",
      nextAction: capture.captureType === "uwe_todo" ? capture.content.slice(0, 200) : null,
      notes: this.buildNotesFromCapture(capture),
      links: capture.url ? [{ label: "Capture-Link", url: capture.url }] : null,
      worldId: options.worldId ?? capture.worldId,
      pageId: options.pageId ?? capture.pageId,
      metadata: { sourceCaptureId: capture.id },
    });

    await this.linkCapture(capture.id, "personal_project", project.id);
    return {
      action: "to_personal_project",
      captureId: capture.id,
      targetType: "personal_project",
      targetId: project.id,
      redirectPath: `/projects/${project.id}`,
    };
  }

  private async resolveCaptureSourceAssetId(capture: CaptureEntry): Promise<string | null> {
    if (!capture.worldId) {
      return null;
    }

    const recentAssets = await this.db.asset.findMany({
      where: { worldId: capture.worldId },
      select: { id: true, metadata: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    for (const asset of recentAssets) {
      if (!asset.metadata || typeof asset.metadata !== "object" || Array.isArray(asset.metadata)) {
        continue;
      }
      const metadata = asset.metadata as Record<string, unknown>;
      if (metadata.captureId === capture.id) {
        return asset.id;
      }
    }

    return null;
  }

  private async promoteToImageStudio(capture: CaptureEntry): Promise<CaptureTriageResult> {
    const imageStudio = createImageStudioService(this.db);
    const sourceAssetId = await this.resolveCaptureSourceAssetId(capture);
    const project = await imageStudio.createProject({
      worldId: capture.worldId ?? null,
      title: capture.title || "Capture-Bild",
      prompt: capture.content || null,
      metadata: {
        sourceCaptureId: capture.id,
        storageKey: capture.storageKey,
        captureType: capture.captureType,
        sourceAssetId,
      },
    });

    if (sourceAssetId) {
      await imageStudio.addVersion({
        projectId: project.id,
        operation: "edit",
        prompt: capture.content || null,
        assetId: sourceAssetId,
        providerMode: "manual",
        metadata: { source: "capture_promote" },
      });
    }

    await imageStudio.linkProject(project.id, "capture", capture.id);

    await this.lifeAdmin.updateCapture(capture.id, {
      status: "linked",
      metadata: mergeCaptureMetadata(capture, {
        imageStudioProjectId: project.id,
      }),
    });

    return {
      action: "to_image_studio",
      captureId: capture.id,
      redirectPath: `/image-studio?project=${project.id}`,
    };
  }

  private async promoteToWorkshopProject(
    capture: CaptureEntry,
    options: CaptureTriageOptions,
  ): Promise<CaptureTriageResult> {
    const projectType = options.workshopProjectType ?? defaultWorkshopType(capture);
    const workshop = await this.lifeAdmin.createWorkshopProject({
      title: capture.title || "Werkstatt-Idee",
      projectType,
      status: "idea",
      description: capture.content,
      notes: this.buildNotesFromCapture(capture),
      referenceImages: capture.storageKey ? [capture.storageKey] : undefined,
      stlLinks: capture.url ? [capture.url] : undefined,
      worldId: options.worldId ?? capture.worldId,
      pageId: options.pageId ?? capture.pageId,
      metadata: { sourceCaptureId: capture.id },
    });

    await this.linkCapture(capture.id, "workshop_project", workshop.id);
    return {
      action: "to_workshop_project",
      captureId: capture.id,
      targetType: "workshop_project",
      targetId: workshop.id,
      redirectPath: `/workshop/${workshop.id}`,
    };
  }

  private async promoteToDndPage(
    capture: CaptureEntry,
    options: CaptureTriageOptions,
  ): Promise<CaptureTriageResult> {
    const worldId = options.worldId ?? capture.worldId;
    const pageId = options.pageId ?? capture.pageId;

    await this.lifeAdmin.updateCapture(capture.id, {
      worldId,
      pageId,
      status: "linked",
      metadata: mergeCaptureMetadata(capture, {
        dndPromotion: {
          worldId,
          pageId,
          promotedAt: new Date().toISOString(),
          note: pageId
            ? "Mit Wiki-Seite verknüpft"
            : "Als DnD-Idee markiert — Seite manuell anlegen oder verknüpfen",
        },
      }),
    });

    if (worldId && pageId) {
      await this.lifeAdmin.createAdminLink({
        sourceType: "capture",
        sourceId: capture.id,
        targetType: "page",
        targetId: pageId,
        relationType: "promoted_to",
        label: capture.title,
      });
      return {
        action: "to_dnd_page",
        captureId: capture.id,
        targetType: "page",
        targetId: pageId,
        redirectPath: `/worlds`,
      };
    }

    if (worldId) {
      await this.lifeAdmin.createAdminLink({
        sourceType: "capture",
        sourceId: capture.id,
        targetType: "world",
        targetId: worldId,
        relationType: "promoted_to",
        label: capture.title,
      });
    }

    return {
      action: "to_dnd_page",
      captureId: capture.id,
      targetType: worldId ? "world" : undefined,
      targetId: worldId ?? undefined,
      redirectPath: worldId ? "/worlds" : "/capture",
    };
  }

  private async promoteToHardware(
    capture: CaptureEntry,
    options: CaptureTriageOptions,
  ): Promise<CaptureTriageResult> {
    if (options.hardwareDeviceId) {
      const device = await this.lifeAdmin.getHardwareDevice(options.hardwareDeviceId);
      if (!device) {
        throw new Error(`Hardware-Gerät ${options.hardwareDeviceId} nicht gefunden.`);
      }
      const noteBlock = `[Capture ${capture.capturedAt.toISOString()}]\n${this.buildNotesFromCapture(capture)}`;
      await this.lifeAdmin.updateHardwareDevice(device.id, {
        errorNotes: device.errorNotes ? `${device.errorNotes}\n\n${noteBlock}` : noteBlock,
        status: capture.captureType === "hardware" ? "broken" : device.status,
      });
      await this.linkCapture(capture.id, "hardware_device", device.id);
      return {
        action: "to_hardware_device",
        captureId: capture.id,
        targetType: "hardware_device",
        targetId: device.id,
        redirectPath: "/hardware",
      };
    }

    const device = await this.lifeAdmin.createHardwareDevice({
      name: capture.title || "Hardware-Problem",
      role: "homelab",
      status: "broken",
      errorNotes: this.buildNotesFromCapture(capture),
      notes: capture.content,
      metadata: { sourceCaptureId: capture.id },
    });

    await this.linkCapture(capture.id, "hardware_device", device.id);
    return {
      action: "to_hardware_device",
      captureId: capture.id,
      targetType: "hardware_device",
      targetId: device.id,
      redirectPath: "/hardware",
    };
  }

  private async promoteToContract(capture: CaptureEntry): Promise<CaptureTriageResult> {
    const contract = await this.lifeAdmin.createContractExpense({
      name: capture.title || "Vertrag/Ausgabe",
      notes: this.buildNotesFromCapture(capture),
      portalUrl: capture.url,
      status: "review",
      metadata: { sourceCaptureId: capture.id },
    });

    await this.linkCapture(capture.id, "contract_expense", contract.id);
    return {
      action: "to_contract",
      captureId: capture.id,
      targetType: "contract_expense",
      targetId: contract.id,
      redirectPath: "/contracts",
    };
  }

  private async promoteToLifeBrain(
    capture: CaptureEntry,
    options: CaptureTriageOptions,
  ): Promise<CaptureTriageResult> {
    const category = defaultLifeBrainCategory(capture);
    const tags = inferTags(capture, "life_brain");
    const useDocument =
      options.lifeBrainAsDocument ?? (capture.content.length > 280 || Boolean(capture.url));

    if (useDocument) {
      const doc = await this.lifeAdmin.createPersonalBrainDocument({
        title: capture.title || "Life-Brain-Notiz",
        content: this.buildNotesFromCapture(capture),
        category,
        tags,
        metadata: { sourceCaptureId: capture.id },
      });
      await this.linkCapture(capture.id, "personal_brain_document", doc.id);
      return {
        action: "to_life_brain",
        captureId: capture.id,
        targetType: "personal_brain_document",
        targetId: doc.id,
        redirectPath: "/life-brain",
      };
    }

    const fact = await this.lifeAdmin.createPersonalBrainFact({
      title: capture.title || capture.content.slice(0, 80) || "Fakt",
      content: capture.content,
      factType: category,
      tags,
      metadata: { sourceCaptureId: capture.id, url: capture.url },
    });
    await this.linkCapture(capture.id, "personal_brain_fact", fact.id);
    return {
      action: "to_life_brain",
      captureId: capture.id,
      targetType: "personal_brain_fact",
      targetId: fact.id,
      redirectPath: "/life-brain",
    };
  }
}

export function createCaptureTriageService(db: PrismaClient): CaptureTriageService {
  return new CaptureTriageService(db);
}

export { QUICK_CAPTURE_TYPE_OPTIONS } from "./capture-constants";
