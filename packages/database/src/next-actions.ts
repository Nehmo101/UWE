import type { PrismaClient } from "./client";
import { getProductionSafetyWarnings } from "./production-safety";
import { isPageAccessible, type PortalAccessOptions } from "./permissions";
import { SettingsService } from "./settings-service";
import { getSystemStatus } from "./system-status";
import { createWorldInspectorService, type InspectorSeverity } from "./world-inspector";

/**
 * "Next Actions" for the dashboard: what should the DM look at next?
 * Aggregates open inspector findings, backup age, unassigned content,
 * publicly visible player content and system/seed problems.
 */

export interface NextActionItem {
  id: string;
  severity: InspectorSeverity;
  title: string;
  description: string;
  href?: string;
}

const SEVERITY_ORDER: Record<InspectorSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

const BACKUP_REMINDER_DAYS = 7;

export async function buildNextActions(db: PrismaClient): Promise<NextActionItem[]> {
  const actions: NextActionItem[] = [];

  const productionWarnings = await getProductionSafetyWarnings(db);
  for (const warning of productionWarnings) {
    actions.push({
      id: warning.id,
      severity: warning.severity,
      title: warning.title,
      description: warning.description,
      href: warning.href,
    });
  }

  // System problems first: migrations, storage, missing template seed.
  const system = await getSystemStatus(db);
  if (!system.migrations.ok) {
    actions.push({
      id: "system:migrations",
      severity: "critical",
      title: "Migrationsproblem",
      description: system.migrations.message,
    });
  }
  if (!system.storage.ok) {
    actions.push({
      id: "system:storage",
      severity: "critical",
      title: "Storage nicht beschreibbar",
      description: system.storage.message,
    });
  }
  if (!system.seeds.pageTemplatesSeeded) {
    actions.push({
      id: "system:template-seed",
      severity: "warning",
      title: "Template-Migration ausstehend",
      description:
        "Die System-Templates wurden noch nicht in die Datenbank übernommen. Öffne die Template-Verwaltung, um den Seed auszuführen.",
      href: "/templates",
    });
  }

  // Backup age (based on the activity log).
  const lastBackup = await db.activityLog.findFirst({
    where: { action: "backup_created" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!lastBackup) {
    actions.push({
      id: "backup:none",
      severity: "warning",
      title: "Noch kein Backup erstellt",
      description: "Erstelle ein erstes Backup, bevor du größere Änderungen machst.",
      href: "/backup",
    });
  } else {
    const ageDays = (Date.now() - lastBackup.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays > BACKUP_REMINDER_DAYS) {
      actions.push({
        id: "backup:stale",
        severity: "info",
        title: `Letztes Backup vor ${Math.floor(ageDays)} Tagen`,
        description: "Ein frisches Backup schadet nie.",
        href: "/backup",
      });
    }
  }

  // Per-world content findings.
  const settings = await new SettingsService(db).getSettings();
  const portalOptions: PortalAccessOptions = {
    publicSharingEnabled: settings.portal.publicSharingEnabled,
  };
  const worlds = await db.world.findMany({ orderBy: { name: "asc" } });
  const inspector = createWorldInspectorService(db);

  for (const world of worlds) {
    const report = await inspector.inspectWorld(world.slug);
    if (!report) continue;

    const allFindings = [...report.safetyFindings, ...report.canonFindings];
    const critical = allFindings.filter((finding) => finding.severity === "critical").length;
    const warnings = allFindings.filter((finding) => finding.severity === "warning").length;

    if (critical + warnings > 0) {
      actions.push({
        id: `inspector:${world.slug}`,
        severity: critical > 0 ? "critical" : "warning",
        title: `${world.name}: ${critical + warnings} offene Inspector-Findings`,
        description:
          critical > 0
            ? `${critical} kritisch, ${warnings} Warnungen — kritische Findings zuerst prüfen.`
            : `${warnings} Warnungen im Inspector.`,
        href: `/worlds/${world.slug}/inspector`,
      });
    }

    const pages = await db.page.findMany({
      where: { worldId: world.id },
      select: { id: true, visibility: true, publishStatus: true, campaignId: true },
    });

    const campaignCount = await db.campaign.count({ where: { worldId: world.id } });
    if (campaignCount > 0) {
      const unassigned = pages.filter((page) => page.campaignId === null).length;
      if (unassigned > 0) {
        actions.push({
          id: `unassigned:${world.slug}`,
          severity: "info",
          title: `${world.name}: ${unassigned} Seiten ohne Kampagne`,
          description: "Nicht zugeordnete Inhalte tauchen in keiner Kampagnen-Sicht auf.",
          href: `/worlds/${world.slug}/inspector`,
        });
      }
    }

    const portalVisible = pages.filter((page) =>
      isPageAccessible(page, "portal", portalOptions),
    ).length;
    if (portalVisible > 0) {
      actions.push({
        id: `portal-visible:${world.slug}`,
        severity: "info",
        title: `${world.name}: ${portalVisible} Portal-sichtbare Seiten`,
        description:
          "Diese Seiten sind nach Login im Portal sichtbar — im Inspector auf Freigaben prüfen.",
        href: `/worlds/${world.slug}/inspector`,
      });
    }
  }

  return actions.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      a.title.localeCompare(b.title, "de"),
  );
}
