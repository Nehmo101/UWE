import type { PrismaClient } from "./client";
import type { BrainPrismaClient } from "./brain-client";
import { SettingsService } from "./settings-service";
import { decryptSecret, resolveTokenEncryptionSecret } from "./token-crypto";
import { getSystemStatus } from "./system-status";
import {
  buildSecretsStatusWarnings,
  collectRotationDueSecretIds,
} from "./secrets-status-warnings";

export { collectRotationDueSecretIds } from "./secrets-status-warnings";
// Die Family-Modelle liegen seit Abschnitt G in uwe-family.db.
import { familyPrisma } from "./family-client";

export type SecretSource = "env" | "db-encrypted" | "db-hashed";

export type SecretItemStatus = "set" | "missing" | "decrypt_failed";

export interface SecretsStatusItem {
  id: string;
  label: string;
  description?: string;
  source: SecretSource;
  status: SecretItemStatus;
  /** Masked hint (e.g. ••••••abcd) — never full plaintext. Null for bootstrap ENV-only items. */
  maskedHint: string | null;
  envKey?: string;
  href?: string;
  bootstrap: boolean;
  updatedAt?: string;
}

export interface SecretsStatusSection {
  id: string;
  title: string;
  description: string;
  items: SecretsStatusItem[];
}

export type SecretsStatusWarningSeverity = "info" | "warning" | "critical";

export interface SecretsStatusWarning {
  id: string;
  severity: SecretsStatusWarningSeverity;
  title: string;
  description: string;
}

export interface SecretsStatusSnapshot {
  timestamp: string;
  ok: boolean;
  encryptionKeyConfigured: boolean;
  encryptionKeyEnvKey: string;
  sections: SecretsStatusSection[];
  warnings: SecretsStatusWarning[];
  /** Secret item ids that failed decryption — likely after AUTH_SECRET rotation. */
  affectedByAuthSecretRotation: string[];
  /** DB-encrypted secrets older than the rotation reminder threshold (days). */
  rotationDueSecretIds: string[];
}

export interface SecretsStatusOptions {
  env?: NodeJS.ProcessEnv;
  /** Days after which configured DB secrets trigger a rotation reminder. */
  rotationReminderDays?: number;
}

function resolveSessionSecretKey(env: NodeJS.ProcessEnv): string {
  return env.SESSION_SECRET?.trim() ? "SESSION_SECRET" : "AUTH_SECRET";
}

function resolveSessionSecretValue(env: NodeJS.ProcessEnv): string | undefined {
  return env.SESSION_SECRET?.trim() || env.AUTH_SECRET?.trim();
}

function maskSecretLastFour(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= 4) {
    return "••••••••";
  }
  return `••••••${trimmed.slice(-4)}`;
}

function assessEnvSecret(
  input: {
    id: string;
    label: string;
    envKey: string;
    env: NodeJS.ProcessEnv;
    bootstrap?: boolean;
    description?: string;
    href?: string;
    alternateEnvKey?: string;
  },
): SecretsStatusItem {
  const value =
    input.env[input.envKey]?.trim() ||
    (input.alternateEnvKey ? input.env[input.alternateEnvKey]?.trim() : undefined);
  const configured = Boolean(value);
  const bootstrap = input.bootstrap ?? false;

  return {
    id: input.id,
    label: input.label,
    description: input.description,
    source: "env",
    status: configured ? "set" : "missing",
    maskedHint: bootstrap || !configured || !value ? null : maskSecretLastFour(value),
    envKey: configured ? input.envKey : input.alternateEnvKey ?? input.envKey,
    href: input.href,
    bootstrap,
  };
}

function assessDbEncryptedSecret(
  input: {
    id: string;
    label: string;
    payload: string | null | undefined;
    encryptionSecret: string;
    description?: string;
    href?: string;
    updatedAt?: Date;
  },
): SecretsStatusItem {
  const configured = Boolean(input.payload?.trim());
  if (!configured) {
    return {
      id: input.id,
      label: input.label,
      description: input.description,
      source: "db-encrypted",
      status: "missing",
      maskedHint: null,
      href: input.href,
      bootstrap: false,
      updatedAt: input.updatedAt?.toISOString(),
    };
  }

  try {
    const decrypted = decryptSecret(input.payload!, input.encryptionSecret);
    return {
      id: input.id,
      label: input.label,
      description: input.description,
      source: "db-encrypted",
      status: "set",
      maskedHint: maskSecretLastFour(decrypted),
      href: input.href,
      bootstrap: false,
      updatedAt: input.updatedAt?.toISOString(),
    };
  } catch {
    return {
      id: input.id,
      label: input.label,
      description: input.description,
      source: "db-encrypted",
      status: "decrypt_failed",
      maskedHint: null,
      href: input.href,
      bootstrap: false,
      updatedAt: input.updatedAt?.toISOString(),
    };
  }
}

function buildBootstrapSection(env: NodeJS.ProcessEnv, system: Awaited<ReturnType<typeof getSystemStatus>>): SecretsStatusSection {
  const sessionKey = resolveSessionSecretKey(env);
  const sessionValue = resolveSessionSecretValue(env);
  const sessionConfigured = Boolean(sessionValue);
  const databaseUrl = env.DATABASE_URL?.trim();

  const items: SecretsStatusItem[] = [
    {
      id: "auth-secret",
      label: sessionKey,
      description: "Verschlüsselt DB-Secrets (Spotify, SMTP in DB, Provider-Keys). Rotation invalidiert verschlüsselte Felder.",
      source: "env",
      status: sessionConfigured ? "set" : "missing",
      maskedHint: sessionConfigured ? "nur ENV" : null,
      envKey: sessionKey,
      bootstrap: true,
      href: "/admin/setup?tab=access",
    },
    {
      id: "database-url",
      label: "DATABASE_URL",
      description: "Datenbankverbindung — muss vor App-Start gesetzt sein.",
      source: "env",
      status: databaseUrl ? "set" : "missing",
      maskedHint: "nur ENV",
      envKey: "DATABASE_URL",
      bootstrap: true,
      href: "/admin/setup?tab=system",
    },
    {
      id: "studio-api-token",
      label: "STUDIO_API_TOKEN",
      description: "Bearer für sensible Studio-APIs bei öffentlicher Erreichbarkeit.",
      source: "env",
      status: system.trust.studioApiTokenConfigured ? "set" : "missing",
      maskedHint: null,
      envKey: "STUDIO_API_TOKEN",
      bootstrap: true,
      href: "/admin/setup?tab=cloudflare",
    },
  ];

  return {
    id: "bootstrap",
    title: "Bootstrap (nur ENV)",
    description: "Host-Secrets, die vor DB-Zugriff benötigt werden — Status ohne Klartext oder Last-4.",
    items,
  };
}

/**
 * Übrig gebliebene Cloud-Anbieter-Schlüssel.
 *
 * Seit N.3 nutzt UWE keinen Cloud-Anbieter mehr — diese Variablen werden
 * nirgends gelesen. Wer sie noch auf dem Host stehen hat, soll das sehen und
 * sie löschen können: ein unbenutzter Schlüssel ist trotzdem ein Schlüssel.
 */
const REMOVED_CLOUD_KEY_ENVS = [
  "CLOUD_AI_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
] as const;

function buildStaleCloudKeyItems(env: NodeJS.ProcessEnv): SecretsStatusItem[] {
  return REMOVED_CLOUD_KEY_ENVS.filter((key) => env[key]?.trim()).map((key) => ({
    id: `stale-cloud-key:${key.toLowerCase().replace(/_/g, "-")}`,
    label: key,
    description:
      "Wird nicht mehr benutzt — UWE spricht ausschließlich den RTX-Host an. Aus der .env entfernen.",
    source: "env" as const,
    status: "set" as const,
    maskedHint: null,
    envKey: key,
    bootstrap: false,
  }));
}

function buildHostEnvSection(env: NodeJS.ProcessEnv): SecretsStatusSection {
  const items: SecretsStatusItem[] = [
    assessEnvSecret({
      id: "uwe-setup-token",
      label: "UWE_SETUP_TOKEN",
      envKey: "UWE_SETUP_TOKEN",
      env,
      description: "Schützt Setup/Repair-Endpunkte — nach Ersteinrichtung entfernen.",
    }),
    assessEnvSecret({
      id: "smtp-password-env",
      label: "SMTP_PASSWORD (ENV)",
      envKey: "SMTP_PASSWORD",
      env,
      description: "Fallback, wenn SMTP nicht in der DB konfiguriert ist.",
      href: "/admin/setup?tab=mail",
    }),
    assessEnvSecret({
      id: "rtx-service-token",
      label: "RTX_SERVICE_TOKEN",
      envKey: "RTX_SERVICE_TOKEN",
      env,
      alternateEnvKey: "RTX_AGENT_TOKEN",
      description: "Bearer für direkten RTX-Worker (optional).",
      href: "/system/rtx-connector",
    }),
    ...buildStaleCloudKeyItems(env),
    assessEnvSecret({
      id: "spotify-client-id",
      label: "SPOTIFY_CLIENT_ID",
      envKey: "SPOTIFY_CLIENT_ID",
      env,
      description: "OAuth Client-ID (kein Secret, aber erforderlich für Soundboard).",
    }),
    assessEnvSecret({
      id: "spotify-client-secret",
      label: "SPOTIFY_CLIENT_SECRET",
      envKey: "SPOTIFY_CLIENT_SECRET",
      env,
      href: "/settings?tab=integrations",
    }),
    assessEnvSecret({
      id: "ai-inference-api-key",
      label: "AI_INFERENCE_API_KEY",
      envKey: "AI_INFERENCE_API_KEY",
      env,
      href: "/settings?tab=inference",
    }),
    assessEnvSecret({
      id: "restore-owner-token",
      label: "RESTORE_OWNER_TOKEN",
      envKey: "RESTORE_OWNER_TOKEN",
      env,
      description: "Einmal-Token für Owner-Wiederherstellung aus Backup.",
    }),
  ];

  return {
    id: "host-env",
    title: "Host-Umgebung",
    description: "Optionale Feature-Secrets aus ENV — maskiertes Last-4, nie Klartext.",
    items,
  };
}

async function buildDbEncryptedSection(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  settings: Awaited<ReturnType<SettingsService["getSettings"]>>,
  encryptionSecret: string,
): Promise<SecretsStatusSection> {
  const [
    inferenceEndpoints,
    webhooks,
    mailAccounts,
    calendarFeeds,
    spotifyConnections,
  ] = await Promise.all([
    db.inferenceEndpoint.findMany({
      select: { id: true, name: true, apiKeyEnc: true, updatedAt: true },
    }),
    db.webhookEndpoint.findMany({
      select: { id: true, name: true, secretEncrypted: true, updatedAt: true },
    }),
    brainDb.mailAccount.findMany({
      select: { id: true, label: true, passwordEnc: true, updatedAt: true },
    }),
    familyPrisma.calendarFeed.findMany({
      select: { id: true, name: true, credentialsEnc: true, updatedAt: true },
    }),
    db.spotifyConnection.findMany({
      select: {
        id: true,
        spotifyDisplayName: true,
        accessTokenEncrypted: true,
        refreshTokenEncrypted: true,
        updatedAt: true,
      },
    }),
  ]);

  const items: SecretsStatusItem[] = [];

  const smtpCreds = settings.mail.smtpCredentials;
  if (smtpCreds?.passwordEnc) {
    items.push(
      assessDbEncryptedSecret({
        id: "smtp-password-db",
        label: "SMTP-Passwort (Datenbank)",
        payload: smtpCreds.passwordEnc,
        encryptionSecret,
        href: "/admin/setup?tab=mail",
      }),
    );
  } else if (settings.mail.smtp.passwordConfigured && settings.mail.smtp.source === "portal") {
    items.push({
      id: "smtp-password-db",
      label: "SMTP-Passwort (Datenbank)",
      source: "db-encrypted",
      status: "missing",
      maskedHint: null,
      href: "/admin/setup?tab=mail",
      bootstrap: false,
    });
  }

  if (settings.auth.googleClientSecretEnc) {
    items.push(
      assessDbEncryptedSecret({
        id: "google-oauth-client-secret",
        label: "Google OAuth Client-Secret",
        payload: settings.auth.googleClientSecretEnc,
        encryptionSecret,
      }),
    );
  }
  for (const endpoint of inferenceEndpoints) {
    if (!endpoint.apiKeyEnc) {
      continue;
    }
    items.push(
      assessDbEncryptedSecret({
        id: `inference-endpoint:${endpoint.id}`,
        label: `Inference: ${endpoint.name}`,
        payload: endpoint.apiKeyEnc,
        encryptionSecret,
        href: "/settings?tab=inference",
        updatedAt: endpoint.updatedAt,
      }),
    );
  }

  for (const webhook of webhooks) {
    items.push(
      assessDbEncryptedSecret({
        id: `webhook:${webhook.id}`,
        label: `Webhook: ${webhook.name}`,
        payload: webhook.secretEncrypted,
        encryptionSecret,
        href: "/admin/webhooks",
        updatedAt: webhook.updatedAt,
      }),
    );
  }

  for (const account of mailAccounts) {
    items.push(
      assessDbEncryptedSecret({
        id: `mail-account:${account.id}`,
        label: `Mail-Konto: ${account.label}`,
        payload: account.passwordEnc,
        encryptionSecret,
        href: "/admin/mail",
        updatedAt: account.updatedAt,
      }),
    );
  }

  for (const feed of calendarFeeds) {
    if (!feed.credentialsEnc) {
      continue;
    }
    items.push(
      assessDbEncryptedSecret({
        id: `calendar-feed:${feed.id}`,
        label: `Kalender-Feed: ${feed.name}`,
        payload: feed.credentialsEnc,
        encryptionSecret,
        href: "/calendar",
        updatedAt: feed.updatedAt,
      }),
    );
  }

  for (const connection of spotifyConnections) {
    items.push(
      assessDbEncryptedSecret({
        id: `spotify-access:${connection.id}`,
        label: `Spotify Access (${connection.spotifyDisplayName ?? connection.id})`,
        payload: connection.accessTokenEncrypted,
        encryptionSecret,
        updatedAt: connection.updatedAt,
      }),
    );
    items.push(
      assessDbEncryptedSecret({
        id: `spotify-refresh:${connection.id}`,
        label: `Spotify Refresh (${connection.spotifyDisplayName ?? connection.id})`,
        payload: connection.refreshTokenEncrypted,
        encryptionSecret,
        updatedAt: connection.updatedAt,
      }),
    );
  }

  if (items.length === 0) {
    items.push({
      id: "db-encrypted-none",
      label: "Keine DB-verschlüsselten Secrets",
      description: "Provider-Keys, SMTP oder Tokens können in Einstellungen hinterlegt werden.",
      source: "db-encrypted",
      status: "missing",
      maskedHint: null,
      bootstrap: false,
    });
  }

  return {
    id: "db-encrypted",
    title: "Datenbank (verschlüsselt)",
    description: "Mit AUTH_SECRET/SESSION_SECRET verschlüsselt — Entschlüsselungsfehler deuten auf Rotation hin.",
    items,
  };
}

async function buildDbHashedSection(db: PrismaClient): Promise<SecretsStatusSection> {
  const [apiTokenCount, connectorCount] = await Promise.all([
    db.apiToken.count({ where: { isActive: true } }),
    db.connector.count(),
  ]);

  const items: SecretsStatusItem[] = [
    {
      id: "api-tokens",
      label: "API-Tokens (gehasht)",
      description: "Nur Hash + Prefix gespeichert — Klartext nur bei Erstellung sichtbar.",
      source: "db-hashed",
      status: apiTokenCount > 0 ? "set" : "missing",
      maskedHint: apiTokenCount > 0 ? `${apiTokenCount} aktiv` : null,
      href: "/admin/api-tokens",
      bootstrap: false,
    },
    {
      id: "connector-tokens",
      label: "Maschinenraum-Tokens (gehasht)",
      description: "Connector authentifiziert sich mit Token — nur Hash in der DB.",
      source: "db-hashed",
      status: connectorCount > 0 ? "set" : "missing",
      maskedHint: connectorCount > 0 ? `${connectorCount} registriert` : null,
      href: "/system/rtx-connector",
      bootstrap: false,
    },
  ];

  return {
    id: "db-hashed",
    title: "Datenbank (gehasht)",
    description: "Tokens, die nicht entschlüsselt werden — nur Existenz und Anzahl.",
    items,
  };
}

export async function getSecretsStatusSnapshot(
  db: PrismaClient,
  brainDb: BrainPrismaClient,
  options: SecretsStatusOptions = {},
): Promise<SecretsStatusSnapshot> {
  const env = options.env ?? process.env;
  const rotationReminderDays = options.rotationReminderDays ?? 90;
  const encryptionKeyEnvKey = resolveSessionSecretKey(env);
  const encryptionSecret = resolveTokenEncryptionSecret();
  const encryptionKeyConfigured = Boolean(resolveSessionSecretValue(env));

  const [system, settings] = await Promise.all([
    getSystemStatus(db, { env }),
    new SettingsService(db).getSettings(),
  ]);

  const sections = await Promise.all([
    Promise.resolve(buildBootstrapSection(env, system)),
    Promise.resolve(buildHostEnvSection(env)),
    buildDbEncryptedSection(db, brainDb, settings, encryptionSecret),
    buildDbHashedSection(db),
  ]);

  const affectedByAuthSecretRotation = sections
    .flatMap((section) => section.items)
    .filter((item) => item.status === "decrypt_failed")
    .map((item) => item.id);

  const rotationDueSecretIds = collectRotationDueSecretIds(sections, rotationReminderDays);

  const warnings = buildSecretsStatusWarnings(
    env,
    sections,
    affectedByAuthSecretRotation,
    rotationDueSecretIds,
    rotationReminderDays,
  );

  const criticalCount = warnings.filter((warning) => warning.severity === "critical").length;
  const ok = criticalCount === 0 && affectedByAuthSecretRotation.length === 0;

  return {
    timestamp: new Date().toISOString(),
    ok,
    encryptionKeyConfigured,
    encryptionKeyEnvKey,
    sections,
    warnings,
    affectedByAuthSecretRotation,
    rotationDueSecretIds,
  };
}

/** Ensures serialized secrets status never contains plaintext env secret values. */
export function assertSecretsStatusHasNoSecrets(
  snapshot: SecretsStatusSnapshot,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const serialized = JSON.stringify(snapshot);
  const secretKeys = [
    "SESSION_SECRET",
    "AUTH_SECRET",
    "UWE_SETUP_TOKEN",
    "RTX_SERVICE_TOKEN",
    "RTX_AGENT_TOKEN",
    "STUDIO_API_TOKEN",
    "AI_INFERENCE_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "OPENROUTER_API_KEY",
    "CLOUD_AI_API_KEY",
    "SMTP_PASSWORD",
    "SPOTIFY_CLIENT_SECRET",
    "RESTORE_OWNER_TOKEN",
    "DATABASE_URL",
  ] as const;

  for (const key of secretKeys) {
    const value = env[key]?.trim();
    if (value && value.length >= 8 && serialized.includes(value)) {
      throw new Error(`Secrets status snapshot leaked env secret: ${key}`);
    }
  }

  if (/passwordEnc|keyEnc|tokenEnc|secretEncrypted|credentialsEnc/i.test(serialized)) {
    throw new Error("Secrets status snapshot contains raw encrypted field payloads");
  }
}
