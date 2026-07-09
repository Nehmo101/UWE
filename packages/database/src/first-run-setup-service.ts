import { getUweRuntimeConfig } from "@uwe/auth";
import type { PrismaClient } from "./client";
import { getMigrationStatus } from "./migration-status";
import { getBackupFreshnessStatus, isRunDbSeedUnsafe, isWeakAuthSecret } from "./production-safety";
import type {
  FirstRunPrerequisiteItem,
  FirstRunPrerequisites,
  FirstRunProductionHint,
  FirstRunProductionHints,
  FirstRunSetupStatus,
} from "./first-run-setup-types";

export type {
  FirstRunCheckStatus,
  FirstRunPrerequisiteItem,
  FirstRunPrerequisites,
  FirstRunProductionHint,
  FirstRunProductionHints,
  FirstRunSetupStatus,
} from "./first-run-setup-types";

function authSecretValue(env: NodeJS.ProcessEnv): string | undefined {
  return env.SESSION_SECRET?.trim() || env.AUTH_SECRET?.trim();
}

export function buildFirstRunPrerequisites(
  env: NodeJS.ProcessEnv,
  migrationMessage: string,
  migrationOk: boolean,
  migrationFailed: boolean,
): FirstRunPrerequisites {
  const items: FirstRunPrerequisiteItem[] = [];

  const setupToken = env.UWE_SETUP_TOKEN?.trim();
  if (!setupToken) {
    items.push({
      id: "setup-token",
      label: "UWE_SETUP_TOKEN",
      status: "error",
      message: "Setup-Token fehlt in der Umgebung.",
      hint: "Generiere z. B. `openssl rand -hex 32`, trage es in `.env` ein und starte den Server neu.",
    });
  } else {
    items.push({
      id: "setup-token",
      label: "UWE_SETUP_TOKEN",
      status: "ok",
      message: "Setup-Token ist gesetzt.",
    });
  }

  const sessionSecret = authSecretValue(env);
  if (!sessionSecret) {
    items.push({
      id: "auth-secret",
      label: "AUTH_SECRET",
      status: "error",
      message: "SESSION_SECRET / AUTH_SECRET fehlt.",
      hint: "Setze ein starkes Zufallssecret (z. B. `openssl rand -base64 32`) in `.env`.",
    });
  } else if (isWeakAuthSecret(sessionSecret)) {
    items.push({
      id: "auth-secret",
      label: "AUTH_SECRET",
      status: "warning",
      message: "Secret ist gesetzt, wirkt aber schwach oder wie ein Platzhalter.",
      hint: "Ersetze kurze oder bekannte Werte durch ein langes Zufallssecret.",
    });
  } else {
    items.push({
      id: "auth-secret",
      label: "AUTH_SECRET",
      status: "ok",
      message: "Session-Secret ist gesetzt.",
    });
  }

  if (migrationFailed) {
    items.push({
      id: "migrations",
      label: "DB-Migrationen",
      status: "error",
      message: migrationMessage,
      hint: "Führe `pnpm --filter @uwe/database db:deploy` auf dem Host aus und prüfe fehlgeschlagene Migrationen.",
    });
  } else if (!migrationOk) {
    items.push({
      id: "migrations",
      label: "DB-Migrationen",
      status: "error",
      message: migrationMessage,
      hint: "Führe `pnpm --filter @uwe/database db:deploy` aus, bevor du den Owner anlegst.",
    });
  } else {
    items.push({
      id: "migrations",
      label: "DB-Migrationen",
      status: "ok",
      message: migrationMessage,
    });
  }

  const hasBlockingError = items.some((item) => item.status === "error");
  const ok = items.every((item) => item.status === "ok");

  return {
    ok,
    canProceed: !hasBlockingError,
    items,
  };
}

export function buildFirstRunProductionHints(env: NodeJS.ProcessEnv = process.env): FirstRunProductionHints {
  const runtime = getUweRuntimeConfig(env);
  const backup = getBackupFreshnessStatus();
  const items: FirstRunProductionHint[] = [];

  items.push({
    id: "run-db-seed",
    title: "Demo-Seed deaktivieren",
    description:
      "In Produktion `RUN_DB_SEED=false` setzen, damit keine Demo-Welten und -Benutzer automatisch angelegt werden.",
    status: isRunDbSeedUnsafe() ? "warning" : "ok",
    envKey: "RUN_DB_SEED",
  });

  items.push({
    id: "auth-required",
    title: "Portal-Login erzwingen",
    description:
      "Für öffentliche Deployments `AUTH_REQUIRED=true` setzen, damit das Portal nicht ohne Anmeldung erreichbar ist.",
    status: runtime.authRequired ? "ok" : "warning",
    envKey: "AUTH_REQUIRED",
  });

  items.push({
    id: "backup",
    title: "Backup einrichten",
    description: backup.readable && backup.backupCount > 0
      ? `Letztes Backup gefunden (${backup.latestBackupFilename ?? "unbekannt"}). Automatische Backups unter Einrichtung (Admin) konfigurierbar.`
      : "Erstelle ein Vollbackup und aktiviere optional automatische Backups, bevor du Updates oder Migrationen ausführst.",
    status: backup.readable && backup.backupCount > 0 ? "ok" : "warning",
  });

  return { items };
}

export async function getFirstRunSetupStatus(
  db: PrismaClient,
  options: { env?: NodeJS.ProcessEnv } = {},
): Promise<FirstRunSetupStatus> {
  const env = options.env ?? process.env;
  const migration = await getMigrationStatus(db);

  return {
    prerequisites: buildFirstRunPrerequisites(
      env,
      migration.message,
      migration.ok,
      migration.failedMigrations.length > 0,
    ),
    productionHints: buildFirstRunProductionHints(env),
  };
}
