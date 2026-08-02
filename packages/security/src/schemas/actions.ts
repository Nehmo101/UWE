import { z } from "zod";
import {
  idSchema,
  nonEmptyString,
  optionalNullableIdSchema,
  optionalString,
  slugSchema,
} from "./common";

export const returnPathSchema = z.string().trim().max(500).optional();

export const redirectPathSchema = z.string().trim().min(1).max(500);

export const formCheckboxSchema = z
  .union([z.literal("on"), z.literal("true"), z.literal("1"), z.literal(""), z.undefined()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === "1");

const optionalIntFromForm = z.preprocess((val) => {
  const raw = String(val ?? "").trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}, z.number().int().nullable().optional());

export const optionalSlugSchema = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  slugSchema.optional(),
);

export const optionalIdSchema = z.preprocess(
  (val) => (val === "" || val === null || val === undefined ? undefined : val),
  idSchema.optional(),
);

export const studioPlayerNoteIdSchema = z.object({
  worldSlug: slugSchema,
  noteId: idSchema,
});

export const adoptPlayerNoteContentBlockSchema = studioPlayerNoteIdSchema.extend({
  targetPageId: optionalNullableIdSchema,
});

export const adoptPlayerNotePageSchema = studioPlayerNoteIdSchema.extend({
  title: optionalString,
});

export const brainCreateDocumentSchema = z.object({
  worldSlug: slugSchema,
  title: nonEmptyString.max(500),
  content: z.string().max(100_000).optional().default(""),
  documentType: z.string().max(64).optional().default("general"),
  campaignId: optionalNullableIdSchema,
});

export const brainCreateFactSchema = z.object({
  worldSlug: slugSchema,
  title: nonEmptyString.max(500),
  content: z.string().max(100_000).optional().default(""),
  factType: z.string().max(64).optional().default("custom"),
  campaignId: optionalNullableIdSchema,
});

export const brainUpdateDocumentSchema = z.object({
  worldSlug: slugSchema,
  documentId: idSchema,
  title: z.string().max(500).optional().default(""),
  content: z.string().max(100_000).optional().default(""),
  documentType: z.string().max(64).optional().default("general"),
  status: z.string().max(64).optional().default("draft"),
});

export const brainUpdateFactSchema = z.object({
  worldSlug: slugSchema,
  factId: idSchema,
  title: z.string().max(500).optional().default(""),
  content: z.string().max(100_000).optional().default(""),
  factType: z.string().max(64).optional().default("custom"),
  status: z.string().max(64).optional().default("draft"),
});

export const CAPTURE_TYPES = [
  "quick_note",
  "dnd_idea",
  "uwe_todo",
  "project_idea",
  "hardware",
  "contract_expense",
  "art_miniature_terrain",
  "link",
  "file_image",
] as const;

export const captureCreateSchema = z.object({
  title: z.string().max(500).optional().default(""),
  content: z.string().max(50_000).optional().default(""),
  captureType: z.enum(CAPTURE_TYPES).optional().default("quick_note"),
  captureIntent: z.string().trim().max(64).optional(),
  url: z.string().trim().max(2000).optional(),
  storageKey: z.string().trim().max(500).optional(),
  returnTo: z.string().trim().max(500).optional().default("/capture"),
});

export const CAPTURE_TRIAGE_ACTIONS = [
  "to_personal_project",
  "to_workshop_project",
  "to_dnd_page",
  "to_hardware_device",
  "to_contract",
  "to_life_brain",
  "archive",
  "delete",
] as const;

export const captureTriageSchema = z.object({
  id: idSchema,
  action: z.enum(CAPTURE_TRIAGE_ACTIONS),
  worldId: optionalNullableIdSchema,
  pageId: optionalNullableIdSchema,
  hardwareDeviceId: optionalNullableIdSchema,
  workshopProjectType: z
    .enum(["dnd_terrain", "miniature", "printing_3d", "diorama", "artwork", "other"])
    .optional(),
  projectCategory: z
    .enum(["uwe", "hardware_homelab", "dnd", "art_workshop", "printing_3d", "other"])
    .optional(),
  lifeBrainAsDocument: formCheckboxSchema,
  returnTo: z.string().trim().max(500).optional().default("/capture"),
});

export const captureProposalReviewSchema = z.object({
  id: idSchema,
  status: z.enum(["accepted", "rejected"]),
  returnTo: z.string().trim().max(500).optional().default("/capture"),
});

export const captureStatusUpdateSchema = z.object({
  id: idSchema,
  status: z.enum(["inbox", "triaged", "linked", "archived"]),
});

export const captureIdSchema = z.object({
  id: idSchema,
});

export const INSPECTOR_FIX_ACTIONS = [
  "remove_broken_wiki_link",
  "assign_page_campaign",
] as const;

export const inspectorFixSchema = z.object({
  worldSlug: slugSchema,
  fixAction: z.enum(INSPECTOR_FIX_ACTIONS),
  pageId: optionalIdSchema,
  blockId: optionalIdSchema,
  linkTarget: z.string().max(500).optional(),
});

export const undoActivitySchema = z.object({
  undoEntryId: idSchema,
  redirectTo: redirectPathSchema.optional().default("/"),
});

export const imageStudioJobSchema = z.object({
  worldSlug: slugSchema,
  prompt: z.string().max(10_000),
  task: z
    .enum(["generate", "edit", "inpaint", "remove_background", "variant"])
    .optional()
    .default("generate"),
  title: optionalString,
  providerMode: optionalString,
});

export const calendarEventSchema = z.object({
  title: nonEmptyString.max(500),
  description: z.string().max(10_000).optional(),
  startAt: nonEmptyString.max(64),
  endAt: z.string().max(64).optional(),
  allDay: formCheckboxSchema,
  kind: z.enum(["session", "prep", "personal", "dnd"]).optional().default("personal"),
  worldId: optionalNullableIdSchema,
});

export const calendarFeedSchema = z.object({
  name: nonEmptyString.max(200),
  type: z.enum(["caldav", "ical_url", "familywall"]).optional().default("ical_url"),
  url: z.string().max(2000).optional(),
  caldavUrl: z.string().max(2000).optional(),
  username: z.string().max(320).optional(),
});

export const dndBeyondReferenceSchema = z.object({
  worldSlug: slugSchema,
  url: nonEmptyString.max(2000),
  title: z.string().max(500).optional().default(""),
  entityType: z.string().max(64).optional(),
  notes: z.string().max(10_000).optional(),
});

export const labelWorldSlugSchema = z.object({
  worldSlug: slugSchema,
});

export const labelIdSchema = labelWorldSlugSchema.extend({
  labelId: idSchema,
});

export const labelTemplateIdSchema = labelWorldSlugSchema.extend({
  templateId: idSchema,
});

export const labelCreateFromSourceSchema = labelWorldSlugSchema.extend({
  campaignSlug: optionalSlugSchema,
  sourceRef: nonEmptyString.max(200),
  templateId: idSchema,
  title: optionalString,
  includeDmOnly: formCheckboxSchema,
  layoutMode: z.enum(["text_only", "image_only", "image_text"]).optional(),
  truncateToPage: formCheckboxSchema,
  truncateLongWords: formCheckboxSchema,
});

export const labelCreateManualSchema = labelWorldSlugSchema.extend({
  templateId: idSchema,
  title: z.string().max(500).optional().default("Neues Label"),
  text: z.string().max(50_000).optional().default(""),
  layoutMode: z.enum(["text_only", "image_only", "image_text"]).optional(),
  truncateToPage: formCheckboxSchema,
  truncateLongWords: formCheckboxSchema,
});

export const labelUpdateSchema = labelIdSchema.extend({
  action: z
    .enum(["save", "auto_fit", "restore_original", "ai_shorten"])
    .optional()
    .default("save"),
  title: z.string().max(500),
  templateId: optionalIdSchema,
  contentTitle: optionalString,
  text: z.string().max(50_000).optional().default(""),
  originalText: z.string().max(50_000).optional(),
  elementsJson: z.string().max(500_000).optional(),
  layoutMode: z.enum(["text_only", "image_only", "image_text"]).optional(),
  truncateToPage: formCheckboxSchema,
  truncateLongWords: formCheckboxSchema,
  snapToGrid: formCheckboxSchema,
  showSafeArea: formCheckboxSchema,
  showCropMarks: formCheckboxSchema,
  fitMode: z.enum(["conservative", "normal", "aggressive"]).optional(),
});

export const labelSaveAsTemplateSchema = labelIdSchema.extend({
  templateName: z.string().max(200).optional().default("Mein Template"),
});

export const labelRenameTemplateSchema = labelTemplateIdSchema.extend({
  name: nonEmptyString.max(200),
});

export const printListCreateSchema = labelWorldSlugSchema.extend({
  name: z.string().max(200).optional().default("Neue Druckliste"),
  description: z.string().max(5000).optional(),
  forNextSession: formCheckboxSchema,
});

export const printListFromSessionSchema = labelWorldSlugSchema.extend({
  sessionId: idSchema,
  name: z.string().max(200).optional(),
  forNextSession: formCheckboxSchema,
});

export const printListFromRoomSchema = labelWorldSlugSchema.extend({
  roomPageId: idSchema,
  childPageIds: z.string().max(10_000).optional().default(""),
  name: z.string().max(200).optional(),
  forNextSession: formCheckboxSchema,
});

export const printListFromPageSchema = labelWorldSlugSchema.extend({
  pageId: idSchema,
  name: z.string().max(200).optional(),
  forNextSession: formCheckboxSchema,
});

export const printListIdSchema = labelWorldSlugSchema.extend({
  printListId: idSchema,
});

export const printListAddLabelSchema = printListIdSchema.extend({
  labelId: idSchema,
  copies: z.coerce.number().int().min(1).max(999).optional().default(1),
});

export const printListUpdateSchema = printListIdSchema.extend({
  name: z.string().max(200).optional(),
  description: z.string().max(5000).optional(),
  labelOrder: z.string().max(10_000).optional(),
  copiesJson: z.string().max(100_000).optional(),
  forNextSession: formCheckboxSchema.optional(),
});

export const printListStatusSchema = printListIdSchema.extend({
  status: z.enum(["open", "exported", "printed", "archived"]),
});

export const labelPrintStatusSchema = labelIdSchema.extend({
  status: z.enum(["open", "exported", "printed", "archived"]),
});

export const lifeAdminIdSchema = z.object({
  id: idSchema,
});

export const lifeAdminProjectCreateSchema = z.object({
  name: nonEmptyString.max(500),
  description: z.string().max(10_000).optional().default(""),
  status: z.string().max(64).optional().default("idea"),
  category: z.string().max(64).optional().default("other"),
  nextAction: z.string().max(500).optional(),
  notes: z.string().max(10_000).optional().default(""),
  costCents: optionalIntFromForm,
  worldId: optionalNullableIdSchema,
});

export const lifeAdminProjectUpdateSchema = lifeAdminProjectCreateSchema.extend({
  id: idSchema,
});

export const lifeAdminWorkshopCreateSchema = z.object({
  title: nonEmptyString.max(500),
  projectType: z.string().max(64).optional().default("other"),
  status: z.string().max(64).optional().default("idea"),
  description: z.string().max(10_000).optional().default(""),
  nextAction: z.string().max(500).optional(),
  notes: z.string().max(10_000).optional().default(""),
  costCents: optionalIntFromForm,
  materialsNeeded: z.string().max(10_000).optional().default(""),
  worldId: optionalNullableIdSchema,
});

export const lifeAdminWorkshopUpdateSchema = lifeAdminWorkshopCreateSchema.extend({
  id: idSchema,
});

export const lifeAdminContractCreateSchema = z.object({
  name: nonEmptyString.max(500),
  vendor: z.string().max(500).optional().default(""),
  status: z.string().max(64).optional().default("active"),
  billingInterval: z.string().max(64).optional().default("monthly"),
  categoryLabel: z.string().max(200).optional().default(""),
  amountCents: optionalIntFromForm,
  billingDay: optionalIntFromForm,
  startDate: z.string().max(64).optional(),
  nextPaymentDate: z.string().max(64).optional(),
  cancelByDate: z.string().max(64).optional(),
  portalUrl: z.string().max(2000).optional(),
  notes: z.string().max(10_000).optional().default(""),
});

export const lifeAdminContractUpdateSchema = lifeAdminContractCreateSchema.extend({
  id: idSchema,
});

export const lifeAdminHardwareCreateSchema = z.object({
  name: nonEmptyString.max(500),
  role: z.string().max(200).optional().default(""),
  status: z.string().max(64).optional().default("planned"),
  hostname: z.string().max(253).optional(),
  ipAddress: z.string().max(64).optional(),
  localUrl: z.string().max(2000).optional(),
  publicUrl: z.string().max(2000).optional(),
  operatingSystem: z.string().max(200).optional().default(""),
  errorNotes: z.string().max(5000).optional(),
  notes: z.string().max(10_000).optional().default(""),
  setupSteps: z.string().max(50_000).optional().default(""),
});

export const lifeAdminHardwareUpdateSchema = lifeAdminHardwareCreateSchema.extend({
  id: idSchema,
});

export const lifeAdminHardwareToggleStepSchema = z.object({
  deviceId: idSchema,
  stepIndex: z.coerce.number().int().min(0).max(999),
});

export const lifeAdminBrainDocumentCreateSchema = z.object({
  title: nonEmptyString.max(500),
  content: z.string().max(100_000).optional().default(""),
  category: z.string().max(200).optional(),
});

export const lifeAdminBrainFactCreateSchema = z.object({
  title: nonEmptyString.max(500),
  content: z.string().max(100_000).optional().default(""),
  factType: z.string().max(64).optional().default("custom"),
});

export const favoriteWorldSchema = z.object({
  favoriteWorldSlug: optionalSlugSchema,
});

export const SETTINGS_TABS = [
  "general",
  "worlds",
  "portal",
  "privacy",
  "storage",
  "ai",
  "mail",
  "backup",
] as const;

export const settingsUpdateSchema = z.object({
  tab: z.enum(SETTINGS_TABS).optional().default("general"),
  theme: z.string().max(64).optional(),
  defaultCanonicalStatus: z.string().max(64).optional(),
  favoriteWorldSlug: optionalSlugSchema,
  portalEnabled: formCheckboxSchema.optional(),
  restrictPublicExport: formCheckboxSchema.optional(),
  uploadsPath: z.string().max(1000).optional(),
  exportsPath: z.string().max(1000).optional(),
  aiEnabled: formCheckboxSchema.optional(),
  localOnlyMode: formCheckboxSchema.optional(),
  mailEnabled: formCheckboxSchema.optional(),
  fromDisplayName: z.string().max(200).optional(),
  mailLogBody: formCheckboxSchema.optional(),
  backupsPath: z.string().max(1000).optional(),
  autoBackupEnabled: formCheckboxSchema.optional(),
});

export const shareLinkCreateSchema = z.object({
  worldId: idSchema,
  worldSlug: slugSchema,
  targetType: z.string().max(64),
  targetId: idSchema,
  returnPath: redirectPathSchema,
  expiresAt: z.string().max(64).optional(),
  password: z.string().max(512).optional(),
  readOnly: z.union([z.literal("on"), z.literal("off"), z.undefined()]).optional(),
  logAccess: formCheckboxSchema,
});

export const shareLinkUpdateSchema = z.object({
  linkId: idSchema,
  returnPath: redirectPathSchema,
  expiresAt: z.string().max(64).optional(),
  password: z.string().max(512).optional(),
  clearPassword: formCheckboxSchema,
  readOnly: z.union([z.literal("on"), z.literal("off"), z.undefined()]).optional(),
  logAccess: formCheckboxSchema,
});

export const shareLinkDisableSchema = z.object({
  linkId: idSchema,
  returnPath: redirectPathSchema,
});

export const soundboardButtonInputSchema = z.object({
  worldSlug: slugSchema,
  campaignSlug: optionalSlugSchema,
  title: z.string().max(500),
  sourceType: z.string().max(32),
  sourceUrl: z.string().max(2000).optional(),
  assetId: optionalNullableIdSchema,
  thumbnail: z.string().max(2000).optional(),
  volume: z.coerce.number().min(0).max(1).optional().default(1),
  loop: formCheckboxSchema,
  tags: z.string().max(2000).optional().default(""),
  linkedPageIds: z.union([z.string(), z.array(z.string())]).optional(),
});

export const soundboardButtonUpdateSchema = soundboardButtonInputSchema.extend({
  buttonId: idSchema,
});

export const soundboardButtonDeleteSchema = z.object({
  worldSlug: slugSchema,
  buttonId: idSchema,
});

export const soundboardLinkPageSchema = z.object({
  worldSlug: slugSchema,
  buttonId: idSchema,
  pageId: idSchema,
});

export const pageTemplateCreateSchema = z.object({
  name: nonEmptyString.max(200),
  description: z.string().max(5000).optional().default(""),
  pageType: z.string().max(64),
  titlePlaceholder: z.string().max(500).optional().default(""),
});

export const pageTemplateUpdateSchema = pageTemplateCreateSchema.extend({
  templateId: idSchema,
});

export const pageTemplateIdSchema = z.object({
  templateId: idSchema,
});

export const pageTemplateActiveSchema = pageTemplateIdSchema.extend({
  isActive: z.union([z.literal("true"), z.literal("false")]),
});

export const pageUpdateSchema = z.object({
  pageId: idSchema,
  worldSlug: slugSchema,
  pageSlug: slugSchema,
  title: nonEmptyString.max(500),
  slug: slugSchema,
  type: z.string().max(64),
  summary: z.string().max(5000).optional(),
  canonicalStatus: z.string().max(64),
  tags: z.string().max(2000).optional().default(""),
  aliases: z.string().max(2000).optional().default(""),
});

export const pageCreateSchema = z.object({
  worldSlug: slugSchema,
  type: z.string().max(64),
  title: nonEmptyString.max(500),
  campaignId: optionalNullableIdSchema,
  template: optionalIdSchema,
  slug: z.string().max(120).optional().default(""),
  initialContent: z.string().max(100_000).optional().default(""),
  summary: z.string().max(5000).optional(),
  canonicalStatus: z.string().max(64).optional(),
  tags: z.string().max(2000).optional().default(""),
});

export const contentBlockUpdateSchema = z.object({
  blockId: idSchema,
  worldSlug: slugSchema,
  pageSlug: slugSchema,
  category: z.string().max(64),
  type: z.string().max(64),
  sortOrder: z.coerce.number().int().min(0).max(9999),
  content: z.string().max(100_000).optional().default(""),
});

export const contentBlockCreateSchema = z.object({
  pageId: idSchema,
  worldSlug: slugSchema,
  pageSlug: slugSchema,
  category: z.string().max(64),
  type: z.string().max(64).optional(),
  content: z.string().max(100_000).optional().default(""),
});

export const contentBlockDeleteSchema = z.object({
  blockId: idSchema,
  worldSlug: slugSchema,
  pageSlug: slugSchema,
  category: z.string().max(64),
});

export const assetLinkPageSchema = z.object({
  worldSlug: slugSchema,
  assetId: idSchema,
  pageId: idSchema,
});

export const assetUpdateSchema = z.object({
  worldSlug: slugSchema,
  assetId: idSchema,
  title: nonEmptyString.max(500),
  description: z.string().max(5000).optional(),
  type: z.string().max(64),
  tags: z.string().max(2000).optional(),
});

export const dungeonCreateSchema = z.object({
  worldSlug: slugSchema,
  campaignId: optionalNullableIdSchema,
  title: nonEmptyString.max(500),
  summary: z.string().max(5000).optional(),
  description: z.string().max(100_000).optional().default(""),
});

export const dungeonLevelCreateSchema = z.object({
  worldSlug: slugSchema,
  dungeonSlug: slugSchema,
  title: nonEmptyString.max(500),
  prepStatus: z.string().max(64).optional(),
});

export const dungeonRoomCreateSchema = z.object({
  worldSlug: slugSchema,
  dungeonSlug: slugSchema,
  levelSlug: slugSchema,
  title: nonEmptyString.max(500),
  prepStatus: z.string().max(64).optional(),
  readAloud: z.string().max(100_000).optional().default(""),
  playerDescription: z.string().max(100_000).optional().default(""),
  dmNotes: z.string().max(100_000).optional().default(""),
});

export const roomChildCreateSchema = z.object({
  worldSlug: slugSchema,
  dungeonSlug: slugSchema,
  levelSlug: slugSchema,
  roomSlug: slugSchema,
  childType: z.string().max(64),
  title: nonEmptyString.max(500),
  summary: z.string().max(5000).optional(),
  prepStatus: z.string().max(64).optional(),
  content: z.string().max(100_000).optional().default(""),
});

export const dungeonEntityUpdateSchema = z.object({
  pageId: idSchema,
  redirectTo: redirectPathSchema,
  title: nonEmptyString.max(500),
  prepStatus: z.string().max(64),
  summary: z.string().max(5000).optional(),
});

export const dungeonAssetLinkSchema = z.object({
  pageId: idSchema,
  assetId: idSchema,
  redirectTo: redirectPathSchema,
});

export const roomContentUpdateSchema = z.object({
  worldSlug: slugSchema,
  dungeonSlug: slugSchema,
  levelSlug: slugSchema,
  roomSlug: slugSchema,
  roomId: idSchema,
  title: nonEmptyString.max(500),
  prepStatus: z.string().max(64),
  readAloud: z.string().max(100_000).optional().default(""),
  playerDescription: z.string().max(100_000).optional().default(""),
  dmNotes: z.string().max(100_000).optional().default(""),
});

export const sessionCreateSchema = z.object({
  worldSlug: slugSchema,
  campaignSlug: optionalSlugSchema,
  title: nonEmptyString.max(500),
  date: z.string().max(64).optional(),
  status: z.string().max(64).optional(),
  summaryDm: z.string().max(50_000).optional(),
  summaryPlayer: z.string().max(50_000).optional(),
  notes: z.string().max(50_000).optional(),
  openPlots: z.string().max(50_000).optional(),
  playerDecisions: z.string().max(50_000).optional(),
});

export const sessionUpdateSchema = z.object({
  worldSlug: slugSchema,
  sessionId: idSchema,
  title: nonEmptyString.max(500),
  sessionNumber: z.coerce.number().int().min(1).max(9999),
  date: z.string().max(64).optional(),
  status: z.string().max(64),
  summaryDm: z.string().max(50_000).optional(),
  summaryPlayer: z.string().max(50_000).optional(),
  notes: z.string().max(50_000).optional(),
  openPlots: z.string().max(50_000).optional(),
  playerDecisions: z.string().max(50_000).optional(),
  linkedPageIds: z.string().max(10_000).optional(),
});

export const sessionIdActionSchema = z.object({
  worldSlug: slugSchema,
  sessionId: idSchema,
});

export const sessionLinkPageSchema = sessionIdActionSchema.extend({
  pageId: idSchema,
});
