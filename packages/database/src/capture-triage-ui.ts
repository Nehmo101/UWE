/** Client-safe capture triage labels, types, and parsers (no Prisma runtime). */

import type { CaptureStatus, CaptureType } from "./capture-constants";

export type { CaptureStatus, CaptureType } from "./capture-constants";

export type PersonalProjectCategory =
  | "uwe"
  | "hardware_homelab"
  | "dnd"
  | "art_workshop"
  | "printing_3d"
  | "other";

export type WorkshopProjectType =
  | "dnd_terrain"
  | "miniature"
  | "printing_3d"
  | "diorama"
  | "artwork"
  | "other";

export type CaptureTriageAction =
  | "to_personal_project"
  | "to_workshop_project"
  | "to_dnd_page"
  | "to_hardware_device"
  | "to_contract"
  | "to_life_brain"
  | "to_image_studio"
  | "archive"
  | "delete";

export type CaptureProposalTarget =
  | "personal_project"
  | "workshop_project"
  | "dnd_page"
  | "hardware_device"
  | "contract_expense"
  | "life_brain"
  | "inbox";

export type CaptureProposalStatus = "draft" | "accepted" | "rejected";

export interface CaptureAiProposal {
  status: CaptureProposalStatus;
  generatedAt: string;
  source: "heuristic" | "engine";
  suggestedCategory: string;
  suggestedTags: string[];
  suggestedTarget: CaptureProposalTarget;
  suggestedNextAction: string;
  confidence: "low" | "medium" | "high";
}

/** Minimal capture shape for triage UI — server pages pass full Prisma rows. */
export interface CaptureEntry {
  id: string;
  title: string | null;
  content: string;
  url: string | null;
  storageKey: string | null;
  captureType: CaptureType;
  status: CaptureStatus;
  capturedAt: Date;
  metadata: unknown;
}

export interface HardwareDevice {
  id: string;
  name: string;
  status: string;
}

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

export const CAPTURE_TRIAGE_ACTION_LABELS: Record<CaptureTriageAction, string> = {
  to_personal_project: "Zu Projekt machen",
  to_workshop_project: "Zu Werkstatt-Projekt machen",
  to_dnd_page: "Zu DnD-Seite machen",
  to_hardware_device: "Zu Hardware-Gerät hängen",
  to_contract: "Zu Vertrag machen",
  to_life_brain: "Ins Life Brain übernehmen",
  to_image_studio: "In Image Studio öffnen",
  archive: "Archivieren",
  delete: "Löschen",
};

function readMetadata(capture: CaptureEntry): Record<string, unknown> {
  if (!capture.metadata || typeof capture.metadata !== "object" || Array.isArray(capture.metadata)) {
    return {};
  }
  return capture.metadata as Record<string, unknown>;
}

function isProposalTarget(value: unknown): value is CaptureProposalTarget {
  return (
    value === "personal_project" ||
    value === "workshop_project" ||
    value === "dnd_page" ||
    value === "hardware_device" ||
    value === "contract_expense" ||
    value === "life_brain" ||
    value === "inbox"
  );
}

export function parseCaptureAiProposal(capture: CaptureEntry): CaptureAiProposal | null {
  const raw = readMetadata(capture).aiProposal;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  const proposal = raw as Partial<CaptureAiProposal>;
  if (
    proposal.status !== "draft" &&
    proposal.status !== "accepted" &&
    proposal.status !== "rejected"
  ) {
    return null;
  }
  if (typeof proposal.generatedAt !== "string") {
    return null;
  }
  return {
    status: proposal.status,
    generatedAt: proposal.generatedAt,
    source: "heuristic",
    suggestedCategory: String(proposal.suggestedCategory ?? ""),
    suggestedTags: Array.isArray(proposal.suggestedTags)
      ? proposal.suggestedTags.filter((tag): tag is string => typeof tag === "string")
      : [],
    suggestedTarget: isProposalTarget(proposal.suggestedTarget)
      ? proposal.suggestedTarget
      : "inbox",
    suggestedNextAction: String(proposal.suggestedNextAction ?? ""),
    confidence:
      proposal.confidence === "low" || proposal.confidence === "high"
        ? proposal.confidence
        : "medium",
  };
}
