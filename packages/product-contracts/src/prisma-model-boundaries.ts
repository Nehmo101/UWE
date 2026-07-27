// Prisma model -> product boundary mapping (148 models). Canonical spec: docs/engineering/domain-contracts.md §5.
// Kept in sync with schema.prisma by prisma-model-boundaries.sync.test.ts.

import type { DataDomain, PrivacyClass } from "./domain-boundaries";

export type TargetDatabase = "uwe.db" | "uwe-brain.db";
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

export const PRISMA_MODEL_BOUNDARIES = {
  User: U("platform_auth", "dm_only"),
  DashboardLayout: U("platform_auth", "dm_only"),
  AuthIdentity: U("platform_auth", "dm_only"),
  Session: U("platform_auth", "dm_only"),
  WorldMembership: U("platform_auth", "dm_only"),
  PagePlayerAccess: U("portal_player", "player_visible"),
  PlayerQuestFlag: U("portal_player", "player_visible"),
  SessionAvailability: U("portal_player", "player_visible"),
  SessionUnlock: U("portal_player", "player_visible"),
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
  ContentReview: U("dnd_world", "dm_only"),
  ReviewComment: U("dnd_world", "dm_only"),
  ShareLink: U("portal_player", "dm_only"),
  ShareAccessLog: U("portal_player", "dm_only"),
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
  ContractExpense: B("admin_life"),
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
  CalendarFeed: B("admin_life", "database_only", "G3"),
  CalendarEvent: B("admin_life", "database_only", "G3"),
  DevAgentJob: U("jobs", "dm_only"),
  DevIdea: U("platform_ops", "dm_only", "platform_dev_files", "G9"),
  BugReport: U("platform_ops", "dm_only", "platform_dev_files", "G9"),
  MiniatureCollectionItem: B("admin_life", "brain_workshop_files", "G9"),
  ImportJob: U("jobs", "dm_only", "database_only", "G5"),
  DocumentTemplate: B("admin_life"),
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
  Atlas3DWorld: U("dnd_world", "player_visible"),
  Atlas3DNode: U("dnd_world", "player_visible"),
  Atlas3DTerrain: U("dnd_world", "player_visible"),
  Atlas3DFeature: U("dnd_world", "player_visible"),
  Atlas3DObject: U("dnd_world", "player_visible"),
  Atlas3DCameraBookmark: U("dnd_world", "player_visible"),
  AiGatewayConfig: U("ai_control", "dm_only"),
  AiCloudProvider: U("ai_control", "dm_only"),
  AiUserGrant: U("ai_control", "dm_only"),
  AiUsageLog: U("ai_control", "dm_only"),
  Tag: U("platform_ops", "dm_only", "database_only", "G7"),
  EntityTag: U("platform_ops", "dm_only", "database_only", "G7"),
  SessionLiveEntry: U("dnd_world", "dm_only"),
  Recipe: B("admin_life", "brain_recipe_files", "G9"),
  RecipeIngredient: B("admin_life"),
  MealPlanWeek: B("admin_life"),
  MealPlanEntry: B("admin_life"),
  ShoppingList: B("admin_life"),
  ShoppingListItem: B("admin_life"),
  BringConnection: B("admin_life"),
  StructuredItem: U("dnd_world", "dm_only"),
  PlayerQuestion: U("portal_player", "player_visible"),
  ScanDocument: B("admin_life", "brain_scan_files", "G9"),
  PromptTemplate: U("ai_control", "dm_only"),
  MaintenanceTask: B("admin_life"),
  PantryItem: B("admin_life"),
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
export const BRAIN_MODEL_NAMES: readonly PrismaModelName[] = (
  Object.entries(PRISMA_MODEL_BOUNDARIES) as [PrismaModelName, PrismaModelBoundary][]
)
  .filter(([, boundary]) => boundary.targetDatabase === "uwe-brain.db")
  .map(([name]) => name);

export function isBrainModelName(value: unknown): value is PrismaModelName {
  return isPrismaModelName(value) && PRISMA_MODEL_BOUNDARIES[value].targetDatabase === "uwe-brain.db";
}
