import type { BackupData } from "./types";

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
