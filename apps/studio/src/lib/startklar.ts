import {
  buildNextActions,
  createSettingsService,
  getMigrationStatus,
  prisma,
  UWE_VERSION,
  type NextActionItem,
} from "@uwe/database/server";
import { validateUweEnvironment, type EnvValidationIssue } from "@uwe/auth";
import { getChangelogReleases, type ChangelogRelease } from "./changelog";

export interface StartklarData {
  currentVersion: string;
  seenVersion: string | null;
  isUpToDate: boolean;
  newReleases: ChangelogRelease[];
  envIssues: EnvValidationIssue[];
  migration: {
    ok: boolean;
    pending: string[];
    failed: string[];
    message: string;
  };
  backup: {
    recommended: boolean;
    actions: NextActionItem[];
  };
  otherActions: NextActionItem[];
}

/**
 * Wählt die Changelog-Einträge, die seit der zuletzt bestätigten Version neu sind.
 * Releases sind neueste-zuerst geordnet; alles VOR dem Eintrag mit `seenVersion`
 * ist neu. Ist `seenVersion` unbekannt/null, gelten die neuesten `fallbackCount`
 * Releases als „neu". Pure Funktion — testbar ohne IO.
 */
export function selectNewReleases(
  releases: ChangelogRelease[],
  seenVersion: string | null,
  fallbackCount = 3,
): ChangelogRelease[] {
  if (!seenVersion) {
    return releases.slice(0, fallbackCount);
  }
  const seenIndex = releases.findIndex((release) => release.version === seenVersion);
  if (seenIndex === -1) {
    return releases.slice(0, fallbackCount);
  }
  return releases.slice(0, seenIndex);
}

/** Nur Warnungen/Fehler sind für den Owner handlungsrelevant (Dev-Infos ausblenden). */
export function actionableEnvIssues(issues: EnvValidationIssue[]): EnvValidationIssue[] {
  return issues.filter((issue) => issue.severity !== "info");
}

export async function getStartklarData(): Promise<StartklarData> {
  const settings = await createSettingsService(prisma).getSettings();
  const seenVersion = settings.app.startklarSeenVersion ?? null;

  const [migration, nextActions] = await Promise.all([
    getMigrationStatus(prisma),
    buildNextActions(prisma),
  ]);

  const newReleases = selectNewReleases(getChangelogReleases(), seenVersion);
  const backupActions = nextActions.filter((action) => action.id.includes("backup"));
  const otherActions = nextActions.filter(
    (action) => !action.id.includes("backup") && !action.id.includes("migration"),
  );

  return {
    currentVersion: UWE_VERSION,
    seenVersion,
    isUpToDate: seenVersion === UWE_VERSION,
    newReleases,
    envIssues: actionableEnvIssues(validateUweEnvironment()),
    migration: {
      ok: migration.ok,
      pending: migration.pendingMigrations,
      failed: migration.failedMigrations,
      message: migration.message,
    },
    backup: {
      recommended: backupActions.length > 0,
      actions: backupActions,
    },
    otherActions,
  };
}

/** Bestätigt die aktuelle Version als „gesehen". */
export async function markStartklarSeen(): Promise<void> {
  await createSettingsService(prisma).updateSettings({
    app: { startklarSeenVersion: UWE_VERSION },
  });
}
