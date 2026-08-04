/**
 * Studio-API-Body-/Query-Schemata (D3): die Routen, die früher
 * `passthroughBodySchema` + `as never` nutzten. Enum-Werte sind aus
 * prisma/schema.prisma bzw. den Fachpaketen gespiegelt — @uwe/security darf
 * nicht von @uwe/database abhängen (gleiches Muster wie AI_TASK_TYPES).
 */
import { z } from "zod";
import { emailSchema, idSchema, nonEmptyString, slugSchema } from "./common";

/**
 * Brain-Store-Enums, gespiegelt aus packages/database/prisma/schema.prisma
 * (BrainDocumentType, BrainFactType, BrainSource, BrainStatus). Als
 * const-Arrays dupliziert, weil @uwe/security nicht von @uwe/database abhängen
 * darf — dasselbe Muster wie AI_TASK_TYPES oben. Zweck: ein unbekannter Wert
 * endet schon hier als 400 statt später als Prisma-Fehler (500) im Handler.
 */
export const BRAIN_DOCUMENT_TYPES = [
  "world_knowledge",
  "campaign_knowledge",
  "session_summary",
  "npc_facts",
  "location_facts",
  "faction_facts",
  "canon_facts",
  "general",
  "ai_summary",
] as const;

export const BRAIN_FACT_TYPES = [
  "npc",
  "location",
  "faction",
  "canon",
  "plot_thread",
  "decision",
  "custom",
] as const;

export const BRAIN_SOURCES = ["manual", "ai_generated", "import", "session_summary"] as const;

export const BRAIN_STATUSES = ["draft", "reviewed", "canonical", "deprecated"] as const;

export const brainDocumentTypeSchema = z.enum(BRAIN_DOCUMENT_TYPES);
export const brainFactTypeSchema = z.enum(BRAIN_FACT_TYPES);
export const brainSourceSchema = z.enum(BRAIN_SOURCES);
export const brainStatusSchema = z.enum(BRAIN_STATUSES);

/** Studio-API: POST /api/worlds/[worldSlug]/brain — legt Dokument oder Fakt an. */
export const brainEntryCreateBodySchema = z.object({
  kind: z.enum(["document", "fact"]),
  title: nonEmptyString.max(500),
  content: z.string().max(100_000).optional().default(""),
  documentType: brainDocumentTypeSchema.optional().default("general"),
  factType: brainFactTypeSchema.optional().default("custom"),
  source: brainSourceSchema.optional().default("manual"),
  status: brainStatusSchema.optional().default("draft"),
  campaignId: idSchema.nullish(),
  pageId: idSchema.nullish(),
  gameSessionId: idSchema.nullish(),
});

/** Studio-API: PATCH /api/worlds/[worldSlug]/brain/[entryId] — Teil-Update, alle Felder optional. */
export const brainEntryUpdateBodySchema = z.object({
  title: z.string().max(500).optional(),
  content: z.string().max(100_000).optional(),
  documentType: brainDocumentTypeSchema.optional(),
  factType: brainFactTypeSchema.optional(),
  source: brainSourceSchema.optional(),
  status: brainStatusSchema.optional(),
  campaignId: idSchema.nullish(),
  pageId: idSchema.nullish(),
  gameSessionId: idSchema.nullish(),
});

/**
 * Job-Typen, gespiegelt aus prisma/schema.prisma (enum JobType) — wie bei den
 * Brain-Enums dupliziert, weil @uwe/security nicht von @uwe/database abhängt.
 */
export const JOB_TYPES = [
  "mail_send",
  "mail_sync",
  "ai_run",
  "embedding",
  "reindex",
  "import",
  "backup",
  "backup_restore",
  "canon_check",
  "image_studio",
  "calendar_sync",
  "research",
  "briefing",
] as const;

/** Studio-API: POST /api/jobs — Job einreihen. */
export const jobEnqueueBodySchema = z.object({
  type: z.enum(JOB_TYPES),
  title: nonEmptyString.max(500),
  worldSlug: slugSchema.optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  sync: z.boolean().optional(),
});

/** Spiegelt BackupType aus @uwe/backup. */
export const BACKUP_TYPES = ["full", "world", "campaign"] as const;

/**
 * Studio-API: POST /api/backup. Welche Slug-Felder je type Pflicht sind,
 * prüft weiterhin der Backup-Handler — hier nur Form und Wertebereiche.
 */
export const backupCreateBodySchema = z.object({
  type: z.enum(BACKUP_TYPES),
  worldSlug: slugSchema.optional(),
  campaignSlug: slugSchema.optional(),
  format: z.enum(["zip", "json"]).optional(),
  sync: z.boolean().optional(),
});

/**
 * Studio-API: POST /api/backup/restore/preview|execute. contentBase64 trägt
 * ein hochgeladenes Backup — bewusst großzügiges Limit, ein Voll-Export kann
 * groß werden.
 */
export const backupRestoreBodySchema = z.object({
  backupId: z.string().trim().min(1).max(500).optional(),
  contentBase64: z.string().max(200_000_000).optional(),
  filename: z.string().trim().max(500).optional(),
  confirmed: z.boolean().optional(),
  targetWorldSlug: slugSchema.optional(),
  autoResolveSlugConflicts: z.boolean().optional(),
  allowUpdates: z.boolean().optional(),
  skipExisting: z.boolean().optional(),
  sync: z.boolean().optional(),
  sendPasswordSetupEmails: z.boolean().optional(),
});

/** Spiegelt AiRunStatus aus prisma/schema.prisma. */
export const AI_RUN_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "applied",
  "discarded",
] as const;

/** Studio-API: GET /api/ai/runs — Filter-Query. */
export const aiRunsQuerySchema = z.object({
  worldSlug: slugSchema.optional(),
  pageId: idSchema.optional(),
  gameSessionId: idSchema.optional(),
  status: z.enum(AI_RUN_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

/** Studio-API: GET /api/brain/runs — Filter-Query. */
export const brainRunsQuerySchema = z.object({
  worldSlug: slugSchema.optional(),
  pageSlug: slugSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

/** Studio-API: POST /api/brain/runs/[runId] — apply braucht proposalId, discard nicht. */
export const brainRunActionBodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("discard") }),
  z.object({
    action: z.literal("apply"),
    proposalId: idSchema,
    editedContent: z.string().max(100_000).optional(),
    ideaTitle: z.string().trim().max(500).optional(),
  }),
]);

/**
 * Studio-API: POST /api/mail/recipients. Fehlt `action`, gilt der historische
 * Default sync_players — der Preprocess trägt ihn nach, damit die
 * discriminatedUnion je Aktion die richtigen Pflichtfelder erzwingen kann.
 */
export const mailRecipientsBodySchema = z.preprocess(
  (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value) && !("action" in value)
      ? { ...(value as Record<string, unknown>), action: "sync_players" }
      : value,
  z.discriminatedUnion("action", [
    z.object({
      action: z.literal("sync_players"),
      worldSlug: slugSchema,
    }),
    z.object({
      action: z.literal("create_group"),
      worldSlug: slugSchema,
      name: nonEmptyString.max(200),
      description: z.string().max(5000).optional().default(""),
      slug: slugSchema.optional(),
    }),
    z.object({
      action: z.literal("add_recipient"),
      worldSlug: slugSchema,
      groupSlug: slugSchema,
      email: emailSchema,
      name: z.string().trim().max(200).optional().default(""),
      userId: idSchema.optional(),
    }),
  ]),
);

/**
 * Studio-API: PUT /api/settings. Die Detailprüfung je Sektion macht weiterhin
 * validateSettingsUpdate (@uwe/database) — hier wird nur die äußere Form
 * erzwungen: ein Objekt mit bekannten Sektions-Schlüsseln, Werte je Sektion
 * wieder Objekte. strictObject, damit ein vertippter Sektionsname wie bisher
 * als 400 endet statt still verworfen zu werden.
 */
const settingsSectionSchema = z.record(z.string(), z.unknown());

export const systemSettingsUpdateBodySchema = z.strictObject({
  app: settingsSectionSchema.optional(),
  worlds: settingsSectionSchema.optional(),
  campaigns: settingsSectionSchema.optional(),
  portal: settingsSectionSchema.optional(),
  ai: settingsSectionSchema.optional(),
  mail: settingsSectionSchema.optional(),
  imageStudio: settingsSectionSchema.optional(),
  storage: settingsSectionSchema.optional(),
  backup: settingsSectionSchema.optional(),
  briefing: settingsSectionSchema.optional(),
  privacy: settingsSectionSchema.optional(),
  auth: settingsSectionSchema.optional(),
  maintenance: settingsSectionSchema.optional(),
});
