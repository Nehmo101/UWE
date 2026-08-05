// Prisma model -> product boundary mapping. Canonical spec: docs/engineering/domain-contracts.md §5.
// Kept in sync with schema.prisma + brain/ + family/ by prisma-model-boundaries.sync.test.ts.

import type { DataDomain, PrivacyClass } from "./domain-boundaries";

export type TargetDatabase = "uwe.db" | "uwe-brain.db" | "uwe-family.db";
export type StorageTarget =
  | "database_only"
  | "studio_world_files"
  | "brain_mail_files"
  | "brain_capture_files"
  | "brain_project_files"
  | "brain_workshop_files"
  | "brain_recipe_files"
  | "brain_scan_files"
  | "brain_chat_files"
  | "platform_dev_files";
export type DisputedBoundaryGroup =
  | "G1" | "G2" | "G3" | "G4" | "G5"
  | "G6" | "G7" | "G8" | "G9" | "G10";

export interface PrismaModelBoundary {
  readonly domain: DataDomain;
  readonly privacyClass: PrivacyClass;
  readonly targetDatabase: TargetDatabase;
  readonly storage: StorageTarget;
  readonly disputedGroup?: DisputedBoundaryGroup;
}

const boundary = <
  const D extends DataDomain,
  const P extends PrivacyClass,
  const DB extends TargetDatabase,
  const S extends StorageTarget,
>(domain: D, privacyClass: P, targetDatabase: DB, storage: S, disputedGroup?: DisputedBoundaryGroup) =>
  ({ domain, privacyClass, targetDatabase, storage, ...(disputedGroup ? { disputedGroup } : {}) } as const);

const U = <const D extends DataDomain, const P extends PrivacyClass>(
  domain: D, privacy: P, storage: StorageTarget = "database_only", group?: DisputedBoundaryGroup,
) => boundary(domain, privacy, "uwe.db", storage, group);
const B = <const D extends DataDomain>(
  domain: D, storage: StorageTarget = "database_only", group?: DisputedBoundaryGroup,
) => boundary(domain, "owner_private_local", "uwe-brain.db", storage, group);

/**
 * Family data (`uwe-family.db`) — shared with everyone who holds the `family`
 * checkbox, not owner-private (Notiz Lasse, Abschnitt G15). Same local-only
 * storage rules as Brain; the difference is who may read it.
 */
const F = <const D extends DataDomain>(
  domain: D, storage: StorageTarget = "database_only", group?: DisputedBoundaryGroup,
) => boundary(domain, "family_shared", "uwe-family.db", storage, group);

export const PRISMA_MODEL_BOUNDARIES = {
  User: U("platform_auth", "dm_only"),
  DashboardLayout: U("platform_auth", "dm_only"),
  AuthIdentity: U("platform_auth", "dm_only"),
  Session: U("platform_auth", "dm_only"),
  WorldMembership: U("platform_auth", "dm_only"),
  PlayerQuestFlag: U("portal_player", "player_visible"),
  SessionAvailability: U("portal_player", "player_visible"),
  World: U("dnd_world", "dm_only"),
  Campaign: U("dnd_world", "dm_only"),
  Page: U("dnd_world", "dm_only"),
  WorldCalendar: U("dnd_world", "dm_only"),
  WorldEvent: U("dnd_world", "dm_only"),
  WorldEventEntityLink: U("dnd_world", "dm_only"),
  FactionState: U("dnd_world", "dm_only"),
  Character: U("portal_player", "player_visible", "database_only", "G1"),
  CharacterSpell: U("portal_player", "player_visible", "database_only", "G1"),
  PartyTreasury: U("portal_player", "player_visible", "database_only", "G1"),
  InventoryItem: U("portal_player", "player_visible", "database_only", "G1"),
  StructuredStatblock: U("dnd_world", "dm_only"),
  GameSession: U("dnd_world", "dm_only"),
  GameSessionPageLink: U("dnd_world", "dm_only"),
  ContentBlock: U("dnd_world", "dm_only"),
  Asset: U("assets", "dm_only", "studio_world_files", "G9"),
  AssetAlbum: U("assets", "dm_only", "database_only", "G9"),
  AssetAlbumItem: U("assets", "dm_only", "database_only", "G9"),
  AssetPageLink: U("assets", "dm_only", "database_only", "G9"),
  PageLink: U("dnd_world", "dm_only"),
  LabelTemplate: U("dnd_world", "dm_only"),
  Label: U("dnd_world", "dm_only"),
  PrintList: U("dnd_world", "dm_only"),
  PrintListItem: U("dnd_world", "dm_only"),
  SoundboardButton: U("dnd_world", "dm_only"),
  SoundboardButtonPageLink: U("dnd_world", "dm_only"),
  PlayerNote: U("portal_player", "player_visible"),
  SpotifyConnection: U("integrations", "dm_only"),
  SystemSettings: U("platform_ops", "dm_only"),
  ActivityLog: U("dnd_world", "dm_only", "database_only", "G10"),
  AuditLog: U("platform_ops", "dm_only"),
  UndoEntry: U("dnd_world", "dm_only"),
  PageTemplate: U("dnd_world", "dm_only"),
  SeedHistory: U("platform_ops", "dm_only"),
  AiRun: U("dnd_brain", "dm_only"),
  AiProposal: U("dnd_brain", "dm_only"),
  AiApplyLog: U("dnd_brain", "dm_only"),
  BrainDocument: U("dnd_brain", "dm_only"),
  BrainChunk: U("dnd_brain", "dm_only"),
  BrainFact: U("dnd_brain", "dm_only"),
  BrainLink: U("dnd_brain", "dm_only"),
  Job: U("jobs", "dm_only"),
  JobLog: U("jobs", "dm_only"),
  Connector: U("integrations", "dm_only"),
  ConnectorWorkflowDefault: U("integrations", "dm_only"),
  ConnectorJob: U("jobs", "dm_only"),
  MailTemplate: B("admin_life", "database_only", "G2"),
  MailRecipientGroup: B("admin_life", "database_only", "G2"),
  MailRecipient: B("admin_life", "database_only", "G2"),
  MailMessageLog: B("admin_life", "database_only", "G2"),
  MailAccount: B("admin_life", "database_only", "G2"),
  MailFolder: B("admin_life", "database_only", "G2"),
  MailInboxMessage: B("admin_life", "database_only", "G2"),
  MailAttachment: B("admin_life", "brain_mail_files", "G2"),
  MailPriorityScore: B("admin_life", "database_only", "G2"),
  MailAiAction: B("admin_life", "database_only", "G2"),
  MailUnsubscribeRequest: B("admin_life", "database_only", "G2"),
  MailAuditLog: B("admin_life", "database_only", "G2"),
  MailDraft: B("admin_life", "database_only", "G2"),
  MailRule: B("admin_life", "database_only", "G2"),
  MailVipSender: B("admin_life", "database_only", "G2"),
  CaptureEntry: B("admin_life", "brain_capture_files", "G9"),
  PersonalProject: B("admin_life"),
  ProjectStep: B("admin_life"),
  ProjectImage: B("admin_life", "brain_project_files", "G9"),
  WorkshopProject: B("admin_life", "brain_workshop_files", "G9"),
  WorkshopPaintRecipe: B("admin_life"),
  WorkshopPrintProfile: B("admin_life"),
  WorkshopTerrainRental: B("admin_life"),
  ContractExpense: F("family"),
  HardwareDevice: B("admin_life"),
  PersonalBrainDocument: B("personal_brain"),
  PersonalBrainChunk: B("personal_brain"),
  PersonalBrainFact: B("personal_brain"),
  BrainAssistantProfile: B("personal_brain"),
  BrainChatConversation: B("personal_brain"),
  BrainChatMessage: B("personal_brain"),
  BrainChatAttachment: B("personal_brain", "brain_chat_files"),
  AdminEntityLink: B("admin_life"),
  GeneratorPreset: U("dnd_brain", "dm_only"),
  GeneratorOutput: U("dnd_brain", "dm_only"),
  ImageStudioProject: U("assets", "dm_only", "studio_world_files", "G4"),
  ImageStudioVersion: U("assets", "dm_only", "studio_world_files", "G4"),
  ImageStudioLink: U("assets", "dm_only", "database_only", "G4"),
  CalendarFeed: F("family", "database_only", "G3"),
  CalendarEvent: F("family", "database_only", "G3"),
  DevIdea: U("platform_ops", "dm_only", "platform_dev_files", "G9"),
  BugReport: U("platform_ops", "dm_only", "platform_dev_files", "G9"),
  MiniatureCollectionItem: B("admin_life", "brain_workshop_files", "G9"),
  ImportJob: U("jobs", "dm_only", "database_only", "G5"),
  DocumentTemplate: F("family"),
  DndBeyondReference: U("integrations", "dm_only"),
  DndApiCacheEntry: U("shared_reference", "public"),
  ApiToken: U("platform_auth", "dm_only"),
  ApiTokenScope: U("platform_auth", "dm_only"),
  ApiTokenUsageLog: U("platform_auth", "dm_only"),
  WebhookEndpoint: U("integrations", "dm_only"),
  WebhookDelivery: U("integrations", "dm_only"),
  SecurityWarning: U("platform_ops", "dm_only"),
  TwoFactorSecret: U("platform_auth", "dm_only"),
  TwoFactorChallenge: U("platform_auth", "dm_only"),
  WebAuthnCredential: U("platform_auth", "dm_only"),
  WebAuthnChallenge: U("platform_auth", "dm_only"),
  InferenceEndpoint: U("integrations", "dm_only", "database_only", "G8"),
  PageVersion: U("dnd_world", "dm_only"),
  RollTable: U("dnd_world", "dm_only"),
  ResearchSession: B("personal_brain", "database_only", "G6"),
  ResearchSource: B("personal_brain", "database_only", "G6"),
  // Abgenommene Karten sind vollständig spielersichtbar; der Zugriff hängt
  // allein an der Weltmitgliedschaft, nie am Inhalt der einzelnen Karte.
  // Seit J5 gibt es einen zweiten, engeren Fall: einen Entwurf, den ein
  // Spieler im Portal gebaut hat, sieht bis zur Abnahme nur sein Autor. Das
  // ist keine dm_only-Klasse — es ist dieselbe Spielersicht, nur auf eine
  // Person zugeschnitten (`autorUserId`).
  TerraKarte: U("dnd_world", "player_visible"),
  AiGatewayConfig: U("ai_control", "dm_only"),
  AiUsageLog: U("ai_control", "dm_only"),
  Tag: U("platform_ops", "dm_only", "database_only", "G7"),
  EntityTag: U("platform_ops", "dm_only", "database_only", "G7"),
  SessionLiveEntry: U("dnd_world", "dm_only"),
  Recipe: F("family", "brain_recipe_files", "G9"),
  RecipeIngredient: F("family"),
  MealPlanWeek: F("family"),
  MealPlanEntry: F("family"),
  ShoppingList: F("family"),
  ShoppingListItem: F("family"),
  BringConnection: F("family"),
  StructuredItem: U("dnd_world", "dm_only"),
  PlayerQuestion: U("portal_player", "player_visible"),
  ScanDocument: F("family", "brain_scan_files", "G9"),
  PromptTemplate: U("ai_control", "dm_only"),
  MaintenanceTask: F("family"),
  PantryItem: F("family"),

  // Family (uwe-family.db) — geteilt mit allen, die das Häkchen `Family` haben.
  FamilyChatConversation: F("family"),
  FamilyChatMessage: F("family"),
  FamilyBrainFact: F("family"),
  FamilyMemberProfile: F("family"),
  CalendarEventMember: F("family"),
  FamilyHealthRecord: F("family"),
  FamilyHealthRecordMember: F("family"),
  FamilyCalendarSubscription: F("family"),
  FamilyCalendarSubscriptionMember: F("family"),
  FamilyCalDavAccount: F("family"),
} as const satisfies Record<string, PrismaModelBoundary>;

export type PrismaModelName = keyof typeof PRISMA_MODEL_BOUNDARIES;

export function isPrismaModelName(value: unknown): value is PrismaModelName {
  return typeof value === "string" && value in PRISMA_MODEL_BOUNDARIES;
}

/**
 * The Prisma models that belong to the owner-private Brain database
 * (`uwe-brain.db`). This is the authoritative set the Brain data export and the
 * physical migration must cover — derived from the mapping so it never drifts.
 */
export const FAMILY_MODEL_NAMES: readonly PrismaModelName[] = (
  Object.entries(PRISMA_MODEL_BOUNDARIES) as [PrismaModelName, PrismaModelBoundary][]
)
  .filter(([, boundary]) => boundary.targetDatabase === "uwe-family.db")
  .map(([name]) => name);

export function isFamilyModelName(value: unknown): value is PrismaModelName {
  return isPrismaModelName(value) && PRISMA_MODEL_BOUNDARIES[value].targetDatabase === "uwe-family.db";
}

export const BRAIN_MODEL_NAMES: readonly PrismaModelName[] = (
  Object.entries(PRISMA_MODEL_BOUNDARIES) as [PrismaModelName, PrismaModelBoundary][]
)
  .filter(([, boundary]) => boundary.targetDatabase === "uwe-brain.db")
  .map(([name]) => name);

export function isBrainModelName(value: unknown): value is PrismaModelName {
  return isPrismaModelName(value) && PRISMA_MODEL_BOUNDARIES[value].targetDatabase === "uwe-brain.db";
}
