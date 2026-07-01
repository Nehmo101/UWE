import type { BackupDailyAdminData, BackupData, BackupSettingsRecord } from "./types";

const SECRET_FIELD_NAMES = new Set([
  "passwordhash",
  "password_hash",
  "token",
  "auth_secret",
  "apikey",
  "api_key",
  "secret",
  "sessiontoken",
  "session_token",
  "openai_api_key",
  "anthropic_api_key",
  "access_token_encrypted",
  "refresh_token_encrypted",
  "accesstokenencrypted",
  "refreshtokenencrypted",
]);

const SECRET_VALUE_PATTERNS = [
  /^sk-[a-z0-9]{10,}$/i,
  /^Bearer\s+[a-z0-9._-]+$/i,
];

export function sanitizeRecord<T extends object>(record: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (SECRET_FIELD_NAMES.has(key.toLowerCase())) {
      continue;
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeRecord(value as Record<string, unknown>);
      continue;
    }

    if (typeof value === "string" && looksLikeSecretValue(value)) {
      continue;
    }

    result[key] = value;
  }

  return result as T;
}

export function sanitizeBackupData(data: BackupData): BackupData {
  return {
    worlds: data.worlds.map((world) => sanitizeRecord(world)),
    campaigns: data.campaigns.map((campaign) => sanitizeRecord(campaign)),
    pages: data.pages.map((page) => sanitizeRecord(page)),
    contentBlocks: data.contentBlocks.map((block) => sanitizeRecord(block)),
    pageLinks: data.pageLinks.map((link) => sanitizeRecord(link)),
    assets: data.assets.map((asset) => sanitizeRecord(asset)),
    assetPageLinks: data.assetPageLinks.map((link) => sanitizeRecord(link)),
    gameSessions: data.gameSessions.map((session) => sanitizeRecord(session)),
    gameSessionPageLinks: data.gameSessionPageLinks.map((link) => sanitizeRecord(link)),
    labelTemplates: data.labelTemplates.map((template) => sanitizeRecord(template)),
    labels: data.labels.map((label) => sanitizeRecord(label)),
    printLists: (data.printLists ?? []).map((list) => sanitizeRecord(list)),
    printListItems: (data.printListItems ?? []).map((item) => sanitizeRecord(item)),
    soundboardButtons: data.soundboardButtons.map((button) => sanitizeRecord(button)),
    soundboardButtonPageLinks: data.soundboardButtonPageLinks.map((link) =>
      sanitizeRecord(link),
    ),
    worldMemberships: data.worldMemberships.map((membership) => sanitizeRecord(membership)),
    pagePlayerAccess: data.pagePlayerAccess.map((access) => sanitizeRecord(access)),
    sessionUnlocks: data.sessionUnlocks.map((unlock) => sanitizeRecord(unlock)),
    users: data.users.map((user) => sanitizeRecord(user)),
    pageTemplates: (data.pageTemplates ?? []).map((template) => sanitizeRecord(template)),
    shareLinks: (data.shareLinks ?? []).map((link) => sanitizeRecord(link)),
    playerNotes: (data.playerNotes ?? []).map((note) => sanitizeRecord(note)),
    dailyAdmin: data.dailyAdmin ? sanitizeDailyAdminData(data.dailyAdmin) : undefined,
  };
}

function sanitizeDailyAdminData(dailyAdmin: BackupDailyAdminData): BackupDailyAdminData {
  return {
    captureEntries: dailyAdmin.captureEntries.map((entry) => sanitizeRecord(entry)),
    personalProjects: dailyAdmin.personalProjects.map((project) => sanitizeRecord(project)),
    workshopProjects: dailyAdmin.workshopProjects.map((project) => sanitizeRecord(project)),
    workshopPaintRecipes: dailyAdmin.workshopPaintRecipes.map((recipe) => sanitizeRecord(recipe)),
    workshopPrintProfiles: dailyAdmin.workshopPrintProfiles.map((profile) =>
      sanitizeRecord(profile),
    ),
    workshopTerrainRentals: dailyAdmin.workshopTerrainRentals.map((rental) =>
      sanitizeRecord(rental),
    ),
    contractExpenses: dailyAdmin.contractExpenses.map((expense) => sanitizeRecord(expense)),
    hardwareDevices: dailyAdmin.hardwareDevices.map((device) => sanitizeRecord(device)),
    personalBrainDocuments: dailyAdmin.personalBrainDocuments.map((document) =>
      sanitizeRecord(document),
    ),
    personalBrainChunks: dailyAdmin.personalBrainChunks.map((chunk) => sanitizeRecord(chunk)),
    personalBrainFacts: dailyAdmin.personalBrainFacts.map((fact) => sanitizeRecord(fact)),
    adminEntityLinks: dailyAdmin.adminEntityLinks.map((link) => sanitizeRecord(link)),
  };
}

export function findSecretIssuesInJson(json: string): string[] {
  const issues: string[] = [];
  const lowered = json.toLowerCase();

  for (const field of SECRET_FIELD_NAMES) {
    if (lowered.includes(`"${field}"`)) {
      issues.push(`Enthält verbotenes Feld: ${field}`);
    }
  }

  for (const pattern of SECRET_VALUE_PATTERNS) {
    if (pattern.test(json)) {
      issues.push(`Enthält verdächtigen Secret-Wert (${pattern.source})`);
    }
  }

  return issues;
}

function looksLikeSecretValue(value: string): boolean {
  return SECRET_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/** Strips secret-bearing fields from system settings before backup export. */
export function sanitizeSettingsForBackup(
  settings: Record<string, unknown>,
): BackupSettingsRecord {
  const sanitized = sanitizeRecord(settings) as unknown as BackupSettingsRecord;

  if (sanitized.mail && typeof sanitized.mail === "object") {
    const mail = sanitized.mail as Record<string, unknown>;
    if (mail.smtp && typeof mail.smtp === "object") {
      const smtp = mail.smtp as Record<string, unknown>;
      delete smtp.passwordConfigured;
      delete smtp.userConfigured;
      mail.smtp = smtp;
    }
    sanitized.mail = mail;
  }

  if (sanitized.ai && typeof sanitized.ai === "object") {
    const ai = sanitized.ai as Record<string, unknown>;
    if (Array.isArray(ai.providerKeyPlaceholders)) {
      ai.providerKeyPlaceholders = ai.providerKeyPlaceholders.map((entry) => {
        if (!entry || typeof entry !== "object") return entry;
        const placeholder = { ...(entry as Record<string, unknown>) };
        placeholder.configured = Boolean(placeholder.configured);
        return placeholder;
      });
    }
    sanitized.ai = ai;
  }

  return sanitized;
}
