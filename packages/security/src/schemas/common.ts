import { z } from "zod";

export const slugSchema = z.string().trim().min(1, "Slug ist erforderlich.").max(120);

export const idSchema = z.string().trim().min(1).max(64);

/** FormData sends "" for empty optional ids — normalize to null/omit. */
const formEmptyToNull = (val: unknown) =>
  val === "" || val === null || val === undefined ? null : val;

export const optionalNullableIdSchema = z.preprocess(
  formEmptyToNull,
  idSchema.nullable().optional(),
);

export const tokenSchema = z.string().trim().min(8).max(128);

export const emailSchema = z.string().trim().email("Ungültige E-Mail-Adresse.").max(320);

export const passwordSchema = z.string().min(1, "Passwort ist erforderlich.").max(512);

export const nonEmptyString = z.string().trim().min(1).max(10_000);

export const optionalString = z.string().trim().max(10_000).optional();

export const worldSlugParamSchema = z.object({
  worldSlug: slugSchema,
});

export const worldPageParamsSchema = z.object({
  worldSlug: slugSchema,
  pageSlug: slugSchema,
});

export const tokenParamSchema = z.object({
  token: tokenSchema,
});

export const assetIdParamSchema = z.object({
  assetId: idSchema,
});

export const captureIdParamSchema = z.object({
  captureId: idSchema,
});

export const searchQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const previewBodySchema = z.object({
  worldSlug: slugSchema,
  previewAsUserId: z.string().trim().min(1).max(64).nullable().optional(),
});

export const shareVerifyBodySchema = z.object({
  password: z.string().max(512).optional(),
});

/**
 * Die beiden lokalen Inferenz-Backends. Cloud-Anbieter sind mit N.3 entfallen —
 * eine Anfrage, die einen davon nennt, wird hier abgewiesen statt später still
 * auf den lokalen Weg umgebogen.
 */
export const AI_PROVIDER_IDS = ["ollama", "openai_compatible"] as const;

export const AI_TASK_TYPES = [
  "summarize_page",
  "summarize_session",
  "generate_player_recap",
  "suggest_links",
  "suggest_backlinks",
  "detect_contradictions",
  "find_open_threads",
  "create_npc",
  "create_location",
  "create_encounter",
  "create_knowledge_text",
  "improve_lore_text",
  "suggest_page_tags",
  "page_ai_convert",
  "prepare_canon_check",
  "prepare_next_session",
  "create_player_handout",
  "fill_dungeon_room",
  "prepare_mail_draft",
] as const;

export const aiProviderIdSchema = z.enum(AI_PROVIDER_IDS);
export const aiTaskTypeSchema = z.enum(AI_TASK_TYPES);

export const aiGenerateBodySchema = z.object({
  taskType: aiTaskTypeSchema,
  worldSlug: slugSchema,
  pageSlug: slugSchema,
  providerId: aiProviderIdSchema,
  model: nonEmptyString.max(200),
  userPrompt: optionalString,
  sessionId: idSchema.optional(),
  useMock: z.boolean().optional(),
  discardProposalId: idSchema.optional(),
});

export const aiContextBodySchema = z.object({
  taskType: aiTaskTypeSchema,
  worldSlug: slugSchema,
  pageSlug: slugSchema,
  sessionId: idSchema.optional(),
});

export const aiProviderModeSchema = z.enum(["auto", "local_engine", "cloud"]);

export const aiContextModeSchema = z.enum([
  "general_chat",
  "brain",
  "current_object",
  "current_object_plus_brain",
  "personal_brain",
]);

export const aiPromptBodySchema = z.object({
  prompt: nonEmptyString.max(32_000),
  providerMode: aiProviderModeSchema,
  contextMode: aiContextModeSchema,
  worldSlug: slugSchema.optional(),
  pageSlug: slugSchema.optional(),
  useMock: z.boolean().optional(),
  model: z.string().trim().min(1).max(200).optional(),
  maxTokens: z.number().int().positive().max(32_768).optional(),
});

export const lifeBrainChatBodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(16_000),
      }),
    )
    .min(1)
    .max(40),
  /** personal_brain ist lokal-only — Cloud wird serverseitig hart abgelehnt. */
  providerMode: z.enum(["auto", "local_engine"]).optional().default("auto"),
  useMock: z.boolean().optional(),
});

export const aiSaveBodySchema = z.object({
  proposalId: idSchema,
  mode: z.enum(["idea", "content_block", "player_recap", "replace_content"]),
  title: optionalString,
  content: optionalString,
  sessionId: idSchema.optional(),
});

export const brainRunBodySchema = z.object({
  actionId: idSchema,
  worldSlug: slugSchema,
  /* Optional since J4: not every Brain action hangs on a wiki page. Terra's
     map draft has none, and `runBrainAction` already resolves an anchor page
     itself (`resolveAnchorPageSlug`) when the field is missing. Required, it
     turned the region-description action (then `atlas_describe_region`, today
     `terra_describe_region`) into a permanent 400. */
  pageSlug: slugSchema.optional(),
  providerId: aiProviderIdSchema,
  model: nonEmptyString.max(200),
  userPrompt: optionalString,
  sessionId: idSchema.optional(),
  useMock: z.boolean().optional(),
});

export const inferenceTestPromptBodySchema = z.object({
  prompt: z.string().max(32_000).optional(),
  model: z.string().max(200).optional(),
  mock: z.boolean().optional(),
});

export const inferenceHealthQuerySchema = z.object({
  mock: z.enum(["true", "false"]).optional(),
  test: z.enum(["true", "false"]).optional(),
});

export const aiModelsQuerySchema = z.object({
  provider: aiProviderIdSchema,
  mock: z.enum(["true", "false"]).optional(),
});

export const aiSessionsQuerySchema = z.object({
  worldSlug: slugSchema,
  pageSlug: slugSchema.optional(),
});

export const IMPORT_FORMATS = ["json", "markdown", "html"] as const;
export const importFormatSchema = z.enum(IMPORT_FORMATS);

export const importPreviewBodySchema = z.object({
  format: importFormatSchema,
  content: z.string().max(50_000_000),
  worldSlug: slugSchema,
});

export const importExecuteBodySchema = z.object({
  format: importFormatSchema,
  content: z.string().max(50_000_000),
  worldSlug: slugSchema,
  confirmed: z.boolean().optional(),
  itemIds: z.array(idSchema).optional(),
  autoResolveSlugConflicts: z.boolean().optional(),
  allowUpdates: z.boolean().optional(),
});

export const GENERATOR_ACTION_IDS = [
  "fill_missing_fields",
  "generate_dm_notes",
  "generate_player_text",
  "generate_handout",
  "check_canon",
  "prepare_next_session",
  "generate_encounter",
  "generate_read_aloud",
  "remove_spoilers",
  "simulate_faction",
  "generate_npc",
  "generate_quest",
  "generate_item",
] as const;

export const generatorActionIdSchema = z.enum(GENERATOR_ACTION_IDS);

export const aiGeneratorBodySchema = z.object({
  actionId: generatorActionIdSchema,
  worldSlug: slugSchema,
  pageSlug: slugSchema,
  structuredInput: z.record(z.string(), z.string()).optional(),
  presetId: idSchema.optional(),
  useMock: z.boolean().optional(),
  sync: z.boolean().optional(),
});

export const WORLD_TEMPLATE_IDS = [
  "blank",
  "dnd",
  "wiki",
  "roman",
  "wargame",
] as const;

export const worldTemplateIdSchema = z.enum(WORLD_TEMPLATE_IDS);

export const createWorldBodySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: slugSchema.optional(),
  description: z.string().trim().max(500).optional(),
  isSandbox: z.boolean().optional(),
  templateId: worldTemplateIdSchema.optional(),
});

/** Accepts any object — pair with domain validators (e.g. validateSettingsUpdate). */
export const passthroughBodySchema = z.object({}).passthrough();

export const uploadMetadataSchema = z.object({
  title: z.string().trim().max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  pageId: idSchema.optional().nullable(),
  type: z
    .enum(["image", "audio", "video", "document", "map", "token", "other"])
    .optional(),
});

export const playerNoteCreateSchema = z.object({
  worldSlug: slugSchema,
  campaignId: idSchema,
  content: nonEmptyString.max(20_000),
  pageId: optionalNullableIdSchema,
  gameSessionId: optionalNullableIdSchema,
  returnPath: z.string().trim().max(500).optional(),
});

export const playerNoteIdSchema = z.object({
  worldSlug: slugSchema,
  noteId: idSchema,
  returnPath: z.string().trim().max(500).optional(),
});

export const playerNoteUpdateSchema = playerNoteIdSchema.extend({
  content: nonEmptyString.max(20_000),
});

/**
 * Nachtrag aus dem Tischmodus: was offline entstanden ist, kommt gebündelt
 * zurück. `clientRef` ist die vom Gerät vergebene Kennung, an der der Server
 * einen Wiederholungsversuch erkennt; `baseUpdatedAt` der Stand, auf dem ein
 * Offline-Edit aufsetzt — fehlt er oder ist der Server weiter, gilt der
 * Eintrag als Konflikt statt als Überschreiben.
 */
const playerNoteSyncOperationSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("create"),
    clientRef: idSchema,
    campaignId: idSchema,
    content: nonEmptyString.max(20_000),
    // JSON statt FormData: fehlende Bezüge kommen als `null` oder gar nicht —
    // beides wird hier zu `null`, damit der Typ eindeutig bleibt.
    pageId: idSchema.nullish().transform((value) => value ?? null),
    gameSessionId: idSchema.nullish().transform((value) => value ?? null),
    clientUpdatedAt: z.string().trim().min(1).max(40),
  }),
  z.object({
    op: z.literal("update"),
    clientRef: idSchema,
    campaignId: idSchema,
    noteId: idSchema,
    content: nonEmptyString.max(20_000),
    baseUpdatedAt: z.string().trim().max(40).nullable(),
    clientUpdatedAt: z.string().trim().min(1).max(40),
  }),
]);

/** Höchstzahl Einträge je Abgleich — eine Warteschlange ist kein Massenimport. */
export const PLAYER_NOTE_SYNC_MAX_OPERATIONS = 50;

export const playerNoteSyncSchema = z.object({
  operations: z.array(playerNoteSyncOperationSchema).min(1).max(PLAYER_NOTE_SYNC_MAX_OPERATIONS),
});

export const playerCharacterBlockSchema = z.object({
  worldSlug: slugSchema,
  pageSlug: slugSchema,
  blockId: idSchema,
  content: nonEmptyString.max(50_000),
  returnPath: z.string().trim().max(500).optional(),
});

const abilityScoreField = z.coerce.number().int().min(1).max(30);

const savingThrowChoiceField = z.enum(["none", "proficient"]).optional();
const skillChoiceField = z.enum(["none", "proficient", "expertise"]).optional();

export const characterSheetUpdateSchema = z.object({
  worldSlug: slugSchema,
  characterId: idSchema,
  pageSlug: slugSchema.optional(),
  returnPath: z.string().trim().max(500).optional(),
  displayName: z.string().trim().min(1).max(200).optional(),
  level: z.coerce.number().int().min(1).max(30).optional(),
  strength: abilityScoreField.optional(),
  dexterity: abilityScoreField.optional(),
  constitution: abilityScoreField.optional(),
  intelligence: abilityScoreField.optional(),
  wisdom: abilityScoreField.optional(),
  charisma: abilityScoreField.optional(),
  armorClass: z.coerce.number().int().min(1).max(99).optional(),
  initiativeBonus: z.coerce.number().int().min(-10).max(20).optional(),
  spellcastingAbility: z
    .enum(["auto", "none", "strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"])
    .optional(),
  save_strength: savingThrowChoiceField,
  save_dexterity: savingThrowChoiceField,
  save_constitution: savingThrowChoiceField,
  save_intelligence: savingThrowChoiceField,
  save_wisdom: savingThrowChoiceField,
  save_charisma: savingThrowChoiceField,
  skill_acrobatics: skillChoiceField,
  skill_animal_handling: skillChoiceField,
  skill_arcana: skillChoiceField,
  skill_athletics: skillChoiceField,
  skill_deception: skillChoiceField,
  skill_history: skillChoiceField,
  skill_insight: skillChoiceField,
  skill_intimidation: skillChoiceField,
  skill_investigation: skillChoiceField,
  skill_medicine: skillChoiceField,
  skill_nature: skillChoiceField,
  skill_perception: skillChoiceField,
  skill_performance: skillChoiceField,
  skill_persuasion: skillChoiceField,
  skill_religion: skillChoiceField,
  skill_sleight_of_hand: skillChoiceField,
  skill_stealth: skillChoiceField,
  skill_survival: skillChoiceField,
  notes: z.string().trim().max(10_000).optional(),
});

export const studioCharacterSheetUpdateSchema = characterSheetUpdateSchema.extend({
  pageId: idSchema,
  pageSlug: slugSchema,
  category: slugSchema,
});

export const studioCharacterSheetCreateSchema = z.object({
  worldSlug: slugSchema,
  pageId: idSchema,
  pageSlug: slugSchema,
  category: slugSchema,
  displayName: z.string().trim().min(1).max(200),
  ownerUserId: idSchema,
  level: z.coerce.number().int().min(1).max(30).optional(),
});

const spellLevelField = z.coerce.number().int().min(0).max(9);

export const characterSpellAddSchema = z.object({
  worldSlug: slugSchema,
  characterId: idSchema,
  spellKey: z.string().trim().min(1).max(200),
  spellLevel: spellLevelField.optional(),
  prepared: z
    .union([z.literal("true"), z.literal("false"), z.literal("on"), z.literal("off"), z.boolean()])
    .optional(),
  source: z.string().trim().max(50).optional(),
  displayName: z.string().trim().max(200).optional(),
  school: z.string().trim().max(100).optional(),
  description: z.string().trim().max(5000).optional(),
  notes: z.string().trim().max(500).optional(),
  pageSlug: slugSchema.optional(),
  returnPath: z.string().trim().max(500).optional(),
});

export const characterSpellRemoveSchema = z.object({
  worldSlug: slugSchema,
  characterId: idSchema,
  spellKey: z.string().trim().min(1).max(200),
  pageSlug: slugSchema.optional(),
  returnPath: z.string().trim().max(500).optional(),
});

export const characterSpellTogglePreparedSchema = z.object({
  worldSlug: slugSchema,
  characterId: idSchema,
  spellKey: z.string().trim().min(1).max(200),
  prepared: z
    .union([z.literal("true"), z.literal("false"), z.literal("on"), z.literal("off"), z.boolean()])
    .optional(),
  pageSlug: slugSchema.optional(),
  returnPath: z.string().trim().max(500).optional(),
});

export const characterSpellHomebrewAddSchema = z.object({
  worldSlug: slugSchema,
  characterId: idSchema,
  name: z.string().trim().min(1).max(200),
  spellLevel: spellLevelField.optional(),
  prepared: z
    .union([z.literal("true"), z.literal("false"), z.literal("on"), z.literal("off"), z.boolean()])
    .optional(),
  school: z.string().trim().max(100).optional(),
  description: z.string().trim().max(5000).optional(),
  pageSlug: slugSchema.optional(),
  returnPath: z.string().trim().max(500).optional(),
});

export const studioCharacterSpellAddSchema = characterSpellAddSchema.extend({
  pageId: idSchema,
  pageSlug: slugSchema,
  category: slugSchema,
});

export const studioCharacterSpellRemoveSchema = characterSpellRemoveSchema.extend({
  pageId: idSchema,
  pageSlug: slugSchema,
  category: slugSchema,
});

export const studioCharacterSpellTogglePreparedSchema =
  characterSpellTogglePreparedSchema.extend({
    pageId: idSchema,
    pageSlug: slugSchema,
    category: slugSchema,
  });

export const studioCharacterSpellHomebrewAddSchema = characterSpellHomebrewAddSchema.extend({
  pageId: idSchema,
  pageSlug: slugSchema,
  category: slugSchema,
});

export const studioCharacterSpellImportLevelSchema = z.object({
  worldSlug: slugSchema,
  characterId: idSchema,
  pageId: idSchema,
  pageSlug: slugSchema,
  category: slugSchema,
  spellLevel: spellLevelField,
  prepared: z
    .union([z.literal("true"), z.literal("false"), z.literal("on"), z.literal("off"), z.boolean()])
    .optional(),
});

export const dndSpellSearchQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
});

export const dndSpellLevelQuerySchema = z.object({
  level: z.coerce.number().int().min(0).max(9),
});

export const dndEquipmentSearchQuerySchema = dndSpellSearchQuerySchema;

const levelUpBooleanField = z
  .union([z.literal("true"), z.literal("false"), z.literal("on"), z.literal("off"), z.boolean()])
  .optional();

export const characterLevelUpApplySchema = z.object({
  worldSlug: slugSchema,
  characterId: idSchema,
  pickedClass: z.string().trim().min(1).max(100).optional(),
  hpIncrease: z.coerce.number().int().min(0).max(50).optional(),
  applyLevel: levelUpBooleanField,
  applyMaxHp: levelUpBooleanField,
  applyCurrentHp: levelUpBooleanField,
  applyClasses: levelUpBooleanField,
  pageSlug: slugSchema.optional(),
  returnPath: z.string().trim().max(500).optional(),
});

export const studioCharacterLevelUpApplySchema = characterLevelUpApplySchema.extend({
  pageId: idSchema,
  pageSlug: slugSchema,
  category: slugSchema,
});

export const studioApplySrdEquipmentSchema = z.object({
  worldSlug: slugSchema,
  pageId: idSchema,
  pageSlug: slugSchema,
  category: slugSchema,
  provider: z.enum(["open5e", "dnd5e_srd"]),
  equipmentId: z.string().trim().min(1).max(200),
  name: nonEmptyString.max(500),
  sourceUrl: z.string().trim().max(2000).optional(),
});

export const characterSheetPrintQuerySchema = z.object({
  characterId: idSchema,
  format: z.enum(["html", "markdown"]).optional(),
  layout: z.enum(["full", "compact"]).optional(),
});

/** Portal: Treasury-Item einem eigenen Charakter zuweisen. */
export const treasuryItemAssignSchema = z.object({
  worldSlug: slugSchema,
  itemId: idSchema,
  characterId: idSchema,
  returnPath: z.string().trim().max(500).optional(),
});

/** Portal: Item aus dem eigenen Charakter-Inventar zurück in die Schatzkammer. */
export const treasuryItemReturnSchema = z.object({
  worldSlug: slugSchema,
  itemId: idSchema,
  returnPath: z.string().trim().max(500).optional(),
});

export const assetFileQuerySchema = z.object({
  world: slugSchema,
});

/**
 * Audit-Log-Abfrage (Admin-Routen). `limit`/`offset` werden hart geklemmt:
 * `Number(searchParams.get(...))` ohne Klemme machte aus `?limit=abc` NaN —
 * Prisma ignoriert `take: NaN` und liefert die gesamte Tabelle (Vollscan).
 * Unsinnige Werte fallen auf die Defaults zurück statt die Anfrage scheitern
 * zu lassen; nur echte Bereichsverstöße werden auf die Grenzen gezogen.
 */
export const auditLogQuerySchema = z.object({
  action: z.string().trim().max(2000).optional(),
  actorUserId: idSchema.optional(),
  worldId: idSchema.optional(),
  // "" kommt von leeren Formularfeldern und hieß bisher „kein Filter" —
  // ohne das Preprocess würde daraus ein Invalid Date und damit ein 400.
  from: z.preprocess(formEmptyToNull, z.coerce.date().nullable().optional()),
  to: z.preprocess(formEmptyToNull, z.coerce.date().nullable().optional()),
  limit: z.coerce
    .number()
    .catch(50)
    .transform((value) => Math.min(Math.max(Math.trunc(value), 1), 200)),
  offset: z.coerce
    .number()
    .catch(0)
    .transform((value) => Math.max(Math.trunc(value), 0)),
});

export const worldGraphParamsSchema = z.object({
  worldSlug: slugSchema,
});

export const shareAssetParamsSchema = tokenParamSchema.merge(assetIdParamSchema);

export const forgotPasswordBodySchema = z.object({
  email: emailSchema,
});

export const resetPasswordBodySchema = z.object({
  email: emailSchema,
  resetToken: z.string().trim().min(1).max(256),
  newPassword: passwordSchema,
});

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
