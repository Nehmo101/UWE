import type { BrainPrismaClient } from "@uwe/database/brain-client";
import { BRAIN_MODEL_NAMES } from "@uwe/product-contracts";

/**
 * Non-destructive export of the owner-private Brain data (the models mapped to
 * `uwe-brain.db` in @uwe/product-contracts). It NEVER writes to or deletes the
 * source (see docs/engineering/brain-migration-runbook.md).
 *
 * The key set is pinned to BRAIN_MODEL_NAMES at compile time (explicit Record)
 * and cross-checked at test time, so a new Brain model cannot silently escape
 * the export.
 *
 * Die geteilten Family-Modelle liegen seit Abschnitt G in `uwe-family.db` und
 * haben ihren eigenen Export (`family-export.ts`) — sie gehören nicht mehr
 * hierher.
 */
export const BRAIN_EXPORT_MODEL_KEYS = [
  "MailTemplate", "MailRecipientGroup", "MailRecipient", "MailMessageLog", "MailAccount",
  "MailFolder", "MailInboxMessage", "MailAttachment", "MailPriorityScore", "MailAiAction",
  "MailUnsubscribeRequest", "MailAuditLog", "MailDraft", "MailRule", "MailVipSender",
  "CaptureEntry", "PersonalProject", "ProjectStep", "ProjectImage", "WorkshopProject",
  "WorkshopPaintRecipe", "WorkshopPrintProfile", "WorkshopTerrainRental",
  "HardwareDevice", "PersonalBrainDocument", "PersonalBrainChunk", "PersonalBrainFact",
  "AdminEntityLink", "MiniatureCollectionItem", "ResearchSession", "ResearchSource",
  "BrainAssistantProfile", "BrainChatConversation", "BrainChatMessage", "BrainChatAttachment",
] as const;

export type BrainExportModelKey = (typeof BRAIN_EXPORT_MODEL_KEYS)[number];

type BrainModelReaders = Record<BrainExportModelKey, () => Promise<unknown[]>>;

function brainModelReaders(db: BrainPrismaClient): BrainModelReaders {
  return {
    MailTemplate: () => db.mailTemplate.findMany(),
    MailRecipientGroup: () => db.mailRecipientGroup.findMany(),
    MailRecipient: () => db.mailRecipient.findMany(),
    MailMessageLog: () => db.mailMessageLog.findMany(),
    MailAccount: () => db.mailAccount.findMany(),
    MailFolder: () => db.mailFolder.findMany(),
    MailInboxMessage: () => db.mailInboxMessage.findMany(),
    MailAttachment: () => db.mailAttachment.findMany(),
    MailPriorityScore: () => db.mailPriorityScore.findMany(),
    MailAiAction: () => db.mailAiAction.findMany(),
    MailUnsubscribeRequest: () => db.mailUnsubscribeRequest.findMany(),
    MailAuditLog: () => db.mailAuditLog.findMany(),
    MailDraft: () => db.mailDraft.findMany(),
    MailRule: () => db.mailRule.findMany(),
    MailVipSender: () => db.mailVipSender.findMany(),
    CaptureEntry: () => db.captureEntry.findMany(),
    PersonalProject: () => db.personalProject.findMany(),
    ProjectStep: () => db.projectStep.findMany(),
    ProjectImage: () => db.projectImage.findMany(),
    WorkshopProject: () => db.workshopProject.findMany(),
    WorkshopPaintRecipe: () => db.workshopPaintRecipe.findMany(),
    WorkshopPrintProfile: () => db.workshopPrintProfile.findMany(),
    WorkshopTerrainRental: () => db.workshopTerrainRental.findMany(),
    HardwareDevice: () => db.hardwareDevice.findMany(),
    PersonalBrainDocument: () => db.personalBrainDocument.findMany(),
    PersonalBrainChunk: () => db.personalBrainChunk.findMany(),
    PersonalBrainFact: () => db.personalBrainFact.findMany(),
    AdminEntityLink: () => db.adminEntityLink.findMany(),
    MiniatureCollectionItem: () => db.miniatureCollectionItem.findMany(),
    ResearchSession: () => db.researchSession.findMany(),
    ResearchSource: () => db.researchSource.findMany(),
    BrainAssistantProfile: () => db.brainAssistantProfile.findMany(),
    BrainChatConversation: () => db.brainChatConversation.findMany(),
    BrainChatMessage: () => db.brainChatMessage.findMany(),
    BrainChatAttachment: () => db.brainChatAttachment.findMany(),
  };
}

export interface BrainExportBundle {
  formatVersion: 1;
  exportedAt: string;
  models: Record<BrainExportModelKey, unknown[]>;
  counts: Record<BrainExportModelKey, number>;
}

/** Reads every Brain model into a portable bundle. Read-only on the source. */
export async function collectBrainExport(db: BrainPrismaClient): Promise<BrainExportBundle> {
  const readers = brainModelReaders(db);
  const models = {} as Record<BrainExportModelKey, unknown[]>;
  const counts = {} as Record<BrainExportModelKey, number>;
  for (const key of BRAIN_EXPORT_MODEL_KEYS) {
    const rows = await readers[key]();
    models[key] = rows;
    counts[key] = rows.length;
  }
  return {
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    models,
    counts,
  };
}

/** True when the export covers exactly the contract's Brain model set. */
export function brainExportCoversContract(): boolean {
  const exported = [...BRAIN_EXPORT_MODEL_KEYS].sort();
  const contract = [...BRAIN_MODEL_NAMES].map(String).sort();
  return exported.length === contract.length && exported.every((name, i) => name === contract[i]);
}
