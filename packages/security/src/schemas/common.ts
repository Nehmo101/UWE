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

export const worldGraphParamsSchema = z.object({
  worldSlug: slugSchema,
});

export const shareAssetParamsSchema = tokenParamSchema.merge(assetIdParamSchema);
