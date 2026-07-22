import type { PrismaClient } from "./client";
import { getBackupFreshnessStatus } from "./production-safety";
import { getMigrationStatus } from "./migration-status";
import { getOwnerSetupSnapshot, type OwnerSetupSectionId } from "./owner-setup-service";
import { createConnectorService } from "./connector-service";
import { SettingsService } from "./settings-service";

export type ChecklistItemStatus = "done" | "open" | "optional" | "warning";

export interface AdminChecklistItem {
  id: string;
  category: string;
  title: string;
  description: string;
  status: ChecklistItemStatus;
  href?: string;
  /** True when status is derived from live system checks, not manual toggles. */
  autoDetected?: boolean;
}

export interface AdminOnboardingChecklist {
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  openCount: number;
  warningCount: number;
  items: AdminChecklistItem[];
  timestamp: string;
}

const SECTION_CATEGORY: Record<OwnerSetupSectionId, string> = {
  system: "System",
  access: "Zugriff",
  cloudflare: "Cloudflare & Domains",
  brain: "Brain (privat)",
  mail: "Mail",
  rtx: "RTX & Hardware",
  printer: "Drucker",
  diagnose: "Diagnose",
};

function sectionStatusToChecklist(level: string): ChecklistItemStatus {
  if (level === "ok" || level === "disabled") return "done";
  if (level === "degraded") return "optional";
  return "warning";
}

function countForProgress(status: ChecklistItemStatus): boolean {
  return status === "done" || status === "optional";
}

export async function getAdminOnboardingChecklist(
  db: PrismaClient,
  options: { env?: NodeJS.ProcessEnv; role?: string } = {},
): Promise<AdminOnboardingChecklist> {
  const env = options.env ?? process.env;

  const [setup, migration, worldCount, backup, mailSettings, connectorSummary, userCount] =
    await Promise.all([
    getOwnerSetupSnapshot(db, { env, role: options.role ?? "owner", canEdit: false }),
    getMigrationStatus(db),
    db.world.count(),
    Promise.resolve(getBackupFreshnessStatus()),
    new SettingsService(db).getSettings(),
    createConnectorService(db).summarize(),
    db.user.count(),
  ]);

  const items: AdminChecklistItem[] = [];

  for (const section of setup.sections) {
    const status = sectionStatusToChecklist(section.level);
    items.push({
      id: `setup-${section.id}`,
      category: SECTION_CATEGORY[section.id],
      title: section.title,
      description: section.nextSteps[0] ?? section.message,
      status,
      href: `/admin/setup?tab=${section.id}`,
    });
  }

  items.push({
    id: "migrations-current",
    category: "Betrieb",
    title: "Datenbank-Migrationen",
    description: migration.message,
    status: migration.ok ? "done" : migration.failedMigrations.length > 0 ? "warning" : "open",
    href: "/admin/migrations",
    autoDetected: true,
  });

  items.push({
    id: "smtp-configured",
    category: "Mail",
    title: "SMTP für Mail Center",
    description: mailSettings.mail.smtp.configured
      ? "SMTP ist konfiguriert."
      : "SMTP-Host und Zugangsdaten in den Einstellungen hinterlegen.",
    status: mailSettings.mail.smtp.configured ? "done" : "open",
    href: "/settings?tab=mail",
    autoDetected: true,
  });

  items.push({
    id: "rtx-connector-online",
    category: "RTX & Hardware",
    title: "RTX Connector erreichbar",
    description: connectorSummary.anyOnline
      ? `${connectorSummary.onlineCount} Connector online.`
      : "Optional — lokale KI/Druck-Funktionen benötigen den RTX Connector.",
    status: connectorSummary.anyOnline ? "done" : "optional",
    href: "/system/rtx-connector",
    autoDetected: true,
  });

  items.push({
    id: "world-created",
    category: "Welten",
    title: "Mindestens eine Kampagne/Welt",
    description:
      worldCount > 0
        ? `${worldCount} Welt(en) vorhanden.`
        : "Lege eine Welt an, um DnD-Inhalte und Portal zu nutzen.",
    status: worldCount > 0 ? "done" : "open",
    href: "/worlds",
    autoDetected: true,
  });

  const backupFresh =
    backup.backupCount > 0 &&
    backup.latestBackupAt &&
    Date.now() - backup.latestBackupAt.getTime() < 7 * 24 * 60 * 60 * 1000;

  items.push({
    id: "backup-recent",
    category: "Betrieb",
    title: "Aktuelles Backup (≤ 7 Tage)",
    description:
      backup.backupCount === 0
        ? "Noch kein Backup gefunden."
        : backup.latestBackupAt
          ? `Letztes Backup: ${backup.latestBackupAt.toLocaleString("de-DE")}`
          : "Backup-Verzeichnis nicht lesbar.",
    status: backupFresh ? "done" : backup.backupCount > 0 ? "optional" : "open",
    href: "/backup",
    autoDetected: true,
  });

  items.push({
    id: "admin-user-present",
    category: "Zugriff",
    title: "Mindestens ein Benutzerkonto",
    description:
      userCount > 0 ? `${userCount} Benutzer im System.` : "Lege einen Owner-Account an.",
    status: userCount > 0 ? "done" : "warning",
    href: "/admin/users",
    autoDetected: true,
  });

  const completedCount = items.filter((item) => countForProgress(item.status)).length;
  const totalCount = items.length;
  const progressPercent =
    totalCount === 0 ? 100 : Math.round((completedCount / totalCount) * 100);

  return {
    progressPercent,
    completedCount,
    totalCount,
    openCount: items.filter((item) => item.status === "open").length,
    warningCount: items.filter((item) => item.status === "warning").length,
    items,
    timestamp: new Date().toISOString(),
  };
}
