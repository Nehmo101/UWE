export type BackupType = "full" | "world" | "campaign";

export interface BackupStats {
  worlds: number;
  campaigns: number;
  pages: number;
  contentBlocks: number;
  pageLinks: number;
  assets: number;
  gameSessions: number;
  labels: number;
  labelTemplates: number;
  printLists: number;
  soundboardButtons: number;
}

export interface BackupManifest {
  version: "1.0";
  uweVersion: string;
  schemaVersion: string;
  type: BackupType;
  createdAt: string;
  worldSlug?: string;
  campaignSlug?: string;
  includesUsers: boolean;
  includesAuthSessions: boolean;
  includesSettings: boolean;
  encrypted?: boolean;
  stats: BackupStats;
  assetFiles: string[];
}

export interface BackupUserRecord {
  id: string;
  displayName: string;
  email: string | null;
  role: string;
}

export interface BackupWorldRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  guestModeEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupCampaignRecord {
  id: string;
  worldId: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPageRecord {
  id: string;
  worldId: string;
  campaignId: string | null;
  parentPageId: string | null;
  title: string;
  slug: string;
  type: string;
  summary: string | null;
  visibility: string;
  publishStatus: string;
  canonicalStatus: string;
  prepStatus: string | null;
  tags: unknown;
  aliases: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupContentBlockRecord {
  id: string;
  pageId: string;
  assetId: string | null;
  type: string;
  sortOrder: number;
  content: string;
  visibility: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPageLinkRecord {
  id: string;
  sourcePageId: string;
  targetPageId: string;
  relationType: string;
  label: string | null;
  createdAt: string;
}

export interface BackupAssetRecord {
  id: string;
  worldId: string;
  campaignId: string | null;
  title: string;
  description: string | null;
  type: string;
  storageKey: string;
  mimeType: string | null;
  size: number;
  visibility: string;
  tags: unknown;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupAssetPageLinkRecord {
  id: string;
  assetId: string;
  pageId: string;
  createdAt: string;
}

export interface BackupGameSessionRecord {
  id: string;
  worldId: string;
  campaignId: string | null;
  title: string;
  sessionNumber: number;
  date: string | null;
  status: string;
  summaryDm: string | null;
  summaryPlayer: string | null;
  notes: string | null;
  openPlots: string | null;
  playerDecisions: string | null;
  recapPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupGameSessionPageLinkRecord {
  id: string;
  gameSessionId: string;
  pageId: string;
  createdAt: string;
}

export interface BackupLabelTemplateRecord {
  id: string;
  worldId: string | null;
  name: string;
  slug: string;
  description: string | null;
  layoutSettings: unknown;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupLabelRecord {
  id: string;
  worldId: string;
  campaignId: string | null;
  title: string;
  sourceType: string;
  sourceId: string | null;
  templateId: string;
  content: unknown;
  layoutSettings: unknown;
  printStatus?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPrintListRecord {
  id: string;
  worldId: string;
  campaignId: string | null;
  name: string;
  description: string | null;
  status: string;
  forNextSession: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPrintListItemRecord {
  id: string;
  printListId: string;
  labelId: string;
  copies: number;
  sortOrder: number;
}

export interface BackupSoundboardButtonRecord {
  id: string;
  worldId: string;
  campaignId: string | null;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  assetId: string | null;
  thumbnail: string | null;
  volume: number;
  loop: boolean;
  tags: unknown;
  visibility: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BackupSoundboardButtonPageLinkRecord {
  id: string;
  soundboardButtonId: string;
  pageId: string;
  createdAt: string;
}

export interface BackupWorldMembershipRecord {
  id: string;
  userId: string;
  worldId: string;
  role: string;
  characterName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPagePlayerAccessRecord {
  id: string;
  pageId: string;
  userId: string;
}

export interface BackupSessionUnlockRecord {
  id: string;
  pageId: string;
  userId: string;
  unlockedAt: string;
  sessionLabel: string | null;
}

export interface BackupSettingsRecord {
  app: Record<string, unknown>;
  worlds: Record<string, unknown>;
  campaigns: Record<string, unknown>;
  portal: Record<string, unknown>;
  ai: Record<string, unknown>;
  mail: Record<string, unknown>;
  storage: Record<string, unknown>;
  backup: Record<string, unknown>;
  privacy: Record<string, unknown>;
}

export interface BackupData {
  worlds: BackupWorldRecord[];
  campaigns: BackupCampaignRecord[];
  pages: BackupPageRecord[];
  contentBlocks: BackupContentBlockRecord[];
  pageLinks: BackupPageLinkRecord[];
  assets: BackupAssetRecord[];
  assetPageLinks: BackupAssetPageLinkRecord[];
  gameSessions: BackupGameSessionRecord[];
  gameSessionPageLinks: BackupGameSessionPageLinkRecord[];
  labelTemplates: BackupLabelTemplateRecord[];
  labels: BackupLabelRecord[];
  printLists: BackupPrintListRecord[];
  printListItems: BackupPrintListItemRecord[];
  soundboardButtons: BackupSoundboardButtonRecord[];
  soundboardButtonPageLinks: BackupSoundboardButtonPageLinkRecord[];
  worldMemberships: BackupWorldMembershipRecord[];
  pagePlayerAccess: BackupPagePlayerAccessRecord[];
  sessionUnlocks: BackupSessionUnlockRecord[];
  users: BackupUserRecord[];
}

export interface BackupBundle {
  manifest: BackupManifest;
  data: BackupData;
  settings?: BackupSettingsRecord;
}

export type RestorePreviewStatus = "new" | "conflict" | "duplicate" | "skipped" | "warning";

export interface RestorePreviewItem {
  entityType: string;
  identifier: string;
  status: RestorePreviewStatus;
  message?: string;
}

export interface RestorePreview {
  manifest: BackupManifest;
  items: RestorePreviewItem[];
  conflicts: RestorePreviewItem[];
  stats: {
    new: number;
    conflict: number;
    duplicate: number;
    skipped: number;
    warnings: number;
  };
  assetCount: number;
  missingAssets: string[];
  warnings: string[];
}

export interface RestoreExecuteOptions {
  confirmed: boolean;
  targetWorldSlug?: string;
  autoResolveSlugConflicts?: boolean;
  allowUpdates?: boolean;
  skipExisting?: boolean;
  restoreSettings?: boolean;
  encryptionPassword?: string;
}

export interface RestoreExecuteItemResult {
  entityType: string;
  identifier: string;
  status: "created" | "updated" | "skipped" | "failed";
  error?: string;
}

export interface RestoreExecuteResult {
  preview: RestorePreview;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  items: RestoreExecuteItemResult[];
  errors: string[];
}

export interface CreateBackupOptions {
  type: BackupType;
  worldSlug?: string;
  campaignSlug?: string;
  uploadsRoot?: string;
  outputDir?: string;
  format?: "zip" | "json";
  encrypt?: boolean;
  encryptionPassword?: string;
  retentionCount?: number;
}

export interface StoredBackupInfo {
  id: string;
  filename: string;
  path: string;
  manifest: BackupManifest;
  size: number;
  createdAt: string;
}
