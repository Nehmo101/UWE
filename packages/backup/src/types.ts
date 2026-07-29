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
  pageTemplates: number;
  worldMemberships: number;
  playerNotes: number;
  /** Terra-Karten (J1) — optional, ältere Archive kennen das Feld nicht. */
  terraKarten?: number;
  /** Total Daily-Admin-OS records (optional — older backups do not have it). */
  dailyAdminEntities?: number;
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
  includesPlayerNotes?: boolean;
  encrypted?: boolean;
  stats: BackupStats;
  assetFiles: string[];
}

export interface BackupUserRecord {
  id: string;
  displayName: string;
  email: string | null;
  isOwner: boolean;
  portalAccess: boolean;
  studioAccess: boolean;
  brainAccess: boolean;
  familyAccess: boolean;
}

export interface BackupWorldRecord {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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
  characterName: string | null;
  createdAt: string;
  updatedAt: string;
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

/**
 * Terra-Karte (J1). Die Karte selbst steckt vollständig in `daten` — ein
 * Kartenbaum im Format v5, der alle Ebenen trägt.
 *
 * Diese Sektion existiert, weil der Vorgänger sie NIE hatte: `packages/backup`
 * kannte kein einziges seiner sechs Modelle, `backup:create` sicherte sie also
 * nie, und niemandem fiel es auf (siehe
 * docs/engineering/terra-runde-j-atlas-abbau.md, Vorabbefund 1). Sein Löschen
 * war dadurch unumkehrbar. Terra soll denselben Fehler nicht wiederholen.
 */
export interface BackupTerraKarteRecord {
  id: string;
  worldId: string;
  titel: string;
  /** Kartenbaum im Terra-Format v5: { format, version, wurzel, karten[] }. */
  daten: unknown;
  version: number;
  /**
   * Abnahmezustand (J5). Optional, weil Archive von vor J5 die Spalte nicht
   * kennen — beim Restore fällt das auf `freigegeben` zurück, was für damalige
   * Karten stimmt: vor J5 gab es nur abgenommene Karten.
   */
  status?: "entwurf" | "eingereicht" | "freigegeben";
  /** `null` = im Studio entstanden. */
  autorUserId?: string | null;
  autorName?: string | null;
  eingereichtAm?: string | null;
  entschiedenAm?: string | null;
  entschiedenVonUserId?: string | null;
  rueckmeldung?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPlayerNoteRecord {
  id: string;
  worldId: string;
  campaignId: string;
  pageId: string | null;
  gameSessionId: string | null;
  userId: string;
  content: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPageTemplateRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  pageType: string;
  titlePlaceholder: string;
  blocks: unknown;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupCaptureEntryRecord {
  id: string;
  title: string;
  content: string;
  captureType: string;
  status: string;
  url: string | null;
  storageKey: string | null;
  worldId: string | null;
  pageId: string | null;
  metadata: unknown;
  capturedAt: string;
  triagedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPersonalProjectRecord {
  id: string;
  name: string;
  description: string;
  status: string;
  category: string;
  nextAction: string | null;
  nextActionDate: string | null;
  notes: string;
  links: unknown;
  costCents: number | null;
  worldId: string | null;
  pageId: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupWorkshopProjectRecord {
  id: string;
  title: string;
  projectType: string;
  status: string;
  description: string;
  materialsNeeded: unknown;
  materialsUsed: unknown;
  colorsUsed: unknown;
  filamentsUsed: unknown;
  stlLinks: unknown;
  imageGallery: unknown;
  referenceImages: unknown;
  progressPhotos: unknown;
  resultPhotos: unknown;
  costCents: number | null;
  nextAction: string | null;
  nextActionDate: string | null;
  notes: string;
  worldId: string | null;
  pageId: string | null;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupWorkshopPaintRecipeRecord {
  id: string;
  name: string;
  targetType: string;
  primer: string;
  basecoat: string;
  wash: string;
  highlights: string;
  colorsUsed: unknown;
  resultPhotoUrl: string | null;
  rating: number | null;
  notes: string;
  workshopProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupWorkshopPrintProfileRecord {
  id: string;
  name: string;
  printer: string;
  nozzle: string;
  filament: string;
  layerHeight: string;
  supports: string;
  result: string;
  errors: string;
  improvements: string;
  notes: string;
  workshopProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupWorkshopTerrainRentalRecord {
  id: string;
  terrainSetName: string;
  boxLabel: string;
  replacementValueCents: number | null;
  rentalPriceCents: number | null;
  depositCents: number | null;
  status: string;
  damages: string;
  handoverChecklist: unknown;
  returnChecklist: unknown;
  notes: string;
  workshopProjectId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupContractExpenseRecord {
  id: string;
  name: string;
  vendor: string;
  status: string;
  expenseType: string;
  source: string;
  billingInterval: string;
  categoryLabel: string;
  amountCents: number | null;
  currency: string;
  billingDay: number | null;
  startDate: string | null;
  nextPaymentDate: string | null;
  renewalDate: string | null;
  cancelByDate: string | null;
  portalUrl: string | null;
  notes: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupHardwareDeviceRecord {
  id: string;
  name: string;
  role: string;
  status: string;
  hostname: string | null;
  ipAddress: string | null;
  localUrl: string | null;
  publicUrl: string | null;
  operatingSystem: string;
  specs: unknown;
  setupSteps: unknown;
  errorNotes: string | null;
  notes: string;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPersonalBrainDocumentRecord {
  id: string;
  title: string;
  content: string;
  category: string | null;
  tags: unknown;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPersonalBrainChunkRecord {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number | null;
  embedding: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPersonalBrainFactRecord {
  id: string;
  factType: string;
  title: string;
  content: string;
  tags: unknown;
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface BackupAdminEntityLinkRecord {
  id: string;
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relationType: string;
  label: string | null;
  createdAt: string;
}

/** Daily Admin OS data — only present in full backups created after this section was added. */
export interface BackupDailyAdminData {
  captureEntries: BackupCaptureEntryRecord[];
  personalProjects: BackupPersonalProjectRecord[];
  workshopProjects: BackupWorkshopProjectRecord[];
  workshopPaintRecipes: BackupWorkshopPaintRecipeRecord[];
  workshopPrintProfiles: BackupWorkshopPrintProfileRecord[];
  workshopTerrainRentals: BackupWorkshopTerrainRentalRecord[];
  contractExpenses: BackupContractExpenseRecord[];
  hardwareDevices: BackupHardwareDeviceRecord[];
  personalBrainDocuments: BackupPersonalBrainDocumentRecord[];
  personalBrainChunks: BackupPersonalBrainChunkRecord[];
  personalBrainFacts: BackupPersonalBrainFactRecord[];
  adminEntityLinks: BackupAdminEntityLinkRecord[];
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
  users: BackupUserRecord[];
  pageTemplates?: BackupPageTemplateRecord[];
  playerNotes?: BackupPlayerNoteRecord[];
  /** Optional — archives created before Terra (J1) omit this section. */
  terraKarten?: BackupTerraKarteRecord[];
  /** Optional — archives created before Daily Admin OS support omit this section. */
  dailyAdmin?: BackupDailyAdminData;
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
  sendPasswordSetupEmails?: boolean;
  passwordResetRequestUrl?: string;
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
  /** E-Mails of restored users without password — use /forgot-password or sendPasswordSetupEmails. */
  usersNeedingPassword: string[];
}

export interface CreateBackupOptions {
  type: BackupType;
  worldSlug?: string;
  campaignSlug?: string;
  uploadsRoot?: string;
  /** Explicit backups directory — used as-is (preferred in production). */
  backupsDir?: string;
  /** Base directory for env-based backups path resolution (tests/dev). */
  outputDir?: string;
  format?: "zip" | "json";
  encrypt?: boolean;
  encryptionPassword?: string;
  retentionCount?: number;
  includePlayerNotes?: boolean;
}

export interface StoredBackupInfo {
  id: string;
  filename: string;
  path: string;
  manifest: BackupManifest;
  size: number;
  createdAt: string;
}
