// Muss der erste Import bleiben: lädt die .env, bevor @uwe/database seine
// Client-Singletons anlegt (siehe cli-env-preload.ts).
import "./cli-env-preload";

import { createPrismaClient } from "@uwe/database/server";

import { readStdinJson } from "./cli-env";
import { auditLog, migrationStatus, secretsStatus, securityStatus } from "./ops/status-ops";
import { createApiToken, listApiTokens, revokeApiToken } from "./ops/token-ops";
import { createWebhook, deleteWebhook, listWebhooks } from "./ops/webhook-ops";
import { getSettings, updateSettings } from "./ops/settings-ops";
import {
  applyManagedChallengeNow,
  getManagedChallengeStatus,
  setManagedChallenge,
} from "./ops/cloudflare-challenge-ops";
import { applyTunnelIngressNow, getTunnelIngressStatus } from "./ops/cloudflare-tunnel-ops";
import { getTurnstileStatus, setTurnstile } from "./ops/turnstile-ops";
import { clearSmtp, setGoogleLogin, setSmtp, setupStatus, smtpStatus } from "./ops/setup-ops";
import {
  executeDocImport,
  listDocImportTargets,
  previewDocImport,
} from "./ops/doc-import-ops";

/**
 * Operations CLI for the UWE Command Center — the surfaces that moved out of
 * Studio in Abschnitt D: security, secrets, migrations, audit log, API tokens,
 * webhooks and settings. Backups are not here — `desktop-host-cli.ts` already
 * owns them (`backup` / `list-backups` / `restore-backup`).
 *
 * One CLI with a whitelisted action instead of one CLI per surface, so the Rust
 * bridge stays a single `run_ops` (see command_center.rs) rather than eight
 * near-identical copies. Speaks stdout JSON; input arrives on stdin, never as
 * process arguments, because some of it is secret.
 *
 * There is no auth layer here on purpose: the Command Center runs on the host,
 * and physical access to the host *is* the authorization. That is the same
 * contract `user-admin-cli.ts` and `control.ts` already work under.
 */

const ACTIONS = [
  "security-status",
  "secrets-status",
  "migration-status",
  "audit-log",
  "api-tokens-list",
  "api-tokens-create",
  "api-tokens-revoke",
  "webhooks-list",
  "webhooks-create",
  "webhooks-delete",
  "settings-get",
  "settings-update",
  "setup-status",
  "smtp-status",
  "smtp-set",
  "smtp-clear",
  "cloudflare-challenge-status",
  "cloudflare-challenge-set",
  "cloudflare-challenge-apply",
  "cloudflare-tunnel-status",
  "cloudflare-tunnel-apply",
  "turnstile-status",
  "turnstile-set",
  "google-login-set",
  "doc-import-targets",
  "doc-import-preview",
  "doc-import-execute",
] as const;

type OpsAction = (typeof ACTIONS)[number];

function isOpsAction(value: string): value is OpsAction {
  return (ACTIONS as readonly string[]).includes(value);
}

async function run(action: OpsAction, db: ReturnType<typeof createPrismaClient>): Promise<unknown> {
  switch (action) {
    case "security-status":
      return securityStatus(db);
    case "secrets-status":
      return secretsStatus(db);
    case "migration-status":
      return migrationStatus(db);
    case "audit-log":
      return auditLog(db, await readStdinJson());
    case "api-tokens-list":
      return listApiTokens(db, (await readStdinJson<{ userId: string }>()).userId);
    case "api-tokens-create":
      return createApiToken(db, await readStdinJson());
    case "api-tokens-revoke":
      return revokeApiToken(db, await readStdinJson());
    case "webhooks-list":
      return listWebhooks(db);
    case "webhooks-create":
      return createWebhook(db, await readStdinJson());
    case "webhooks-delete":
      return deleteWebhook(db, await readStdinJson());
    case "settings-get":
      return getSettings(db);
    case "settings-update":
      return updateSettings(db, await readStdinJson());
    case "setup-status":
      return setupStatus(db);
    case "smtp-status":
      return smtpStatus(db);
    case "smtp-set":
      return setSmtp(db, await readStdinJson());
    case "smtp-clear":
      return clearSmtp(db);
    case "cloudflare-challenge-status":
      return getManagedChallengeStatus(db);
    case "cloudflare-challenge-set":
      return setManagedChallenge(db, await readStdinJson());
    case "cloudflare-challenge-apply":
      return applyManagedChallengeNow(db);
    case "cloudflare-tunnel-status":
      return getTunnelIngressStatus(db);
    case "cloudflare-tunnel-apply":
      return applyTunnelIngressNow(db);
    case "turnstile-status":
      return getTurnstileStatus(db);
    case "turnstile-set":
      return setTurnstile(db, await readStdinJson());
    case "google-login-set":
      return setGoogleLogin(db, await readStdinJson());
    case "doc-import-targets":
      return listDocImportTargets(db);
    case "doc-import-preview":
      return previewDocImport(db, await readStdinJson());
    case "doc-import-execute":
      return executeDocImport(db, await readStdinJson());
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}

async function main(): Promise<void> {
  const action = process.argv[2] ?? "";
  const db = createPrismaClient();
  let result: unknown;

  try {
    if (!isOpsAction(action)) {
      throw new Error(`Unbekannte Aktion: ${action || "(keine)"}`);
    }
    result = { ok: true, action, data: await run(action, db) };
  } catch (error) {
    result = { ok: false, message: error instanceof Error ? error.message : String(error) };
  } finally {
    await db.$disconnect();
  }

  process.stdout.write(`${JSON.stringify(result)}\n`);
}

void main();
