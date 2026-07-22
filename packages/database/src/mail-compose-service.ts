import {
import type { BrainPrismaClient } from "./brain-client";
  composeBackupWarningMail,
  composeContractReminderMail,
  composeHandoutMail,
  composeSessionRecapMail,
  composeSessionReminderMail,
  composeShareLinkMail,
  composeSystemWarningMail,
  composeTerrainRentalMail,
  type HandoutSource,
  type MailComposeKind,
  type MailDraft,
  type SessionRecapSource,
  type ShareLinkSource,
} from "@uwe/mail-core";
import type { PrismaClient } from "./client";
import { buildShareUrl } from "./share-link-service";
import { BACKUP_CHECK_INTERVAL_DAYS } from "./calendar-aggregation-service";
import { buildContractAlerts } from "./contract-expense-utils";
import { createMailTemplateService } from "./mail-template-service";
import { renderMailTemplate } from "./mail-utils";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export class MailComposeService {
  constructor(
    private readonly brainDb: BrainPrismaClient,
    private readonly db: PrismaClient,
  ) {}

  async composeSessionRecap(worldSlug: string, sessionId: string): Promise<MailDraft | null> {
    const session = await this.db.gameSession.findFirst({
      where: {
        id: sessionId,
        world: { slug: worldSlug },
      },
      select: {
        id: true,
        worldId: true,
        title: true,
        sessionNumber: true,
        summaryPlayer: true,
        summaryDm: true,
      },
    });

    if (!session) {
      return null;
    }

    const source: SessionRecapSource = {
      worldId: session.worldId,
      sessionId: session.id,
      sessionTitle: session.title,
      sessionNumber: session.sessionNumber,
      summaryPlayer: session.summaryPlayer,
      summaryDm: session.summaryDm,
    };

    return composeSessionRecapMail(source);
  }

  async composeSessionReminder(worldSlug: string, sessionId: string): Promise<MailDraft | null> {
    const session = await this.db.gameSession.findFirst({
      where: {
        id: sessionId,
        world: { slug: worldSlug },
      },
      select: {
        id: true,
        worldId: true,
        title: true,
        sessionNumber: true,
        date: true,
      },
    });

    if (!session || !session.date) {
      return null;
    }

    const draft = composeSessionReminderMail({
      worldId: session.worldId,
      sessionId: session.id,
      sessionTitle: session.title,
      sessionNumber: session.sessionNumber,
      sessionDate: DATE_FORMAT.format(session.date),
    });

    return this.applyTemplate("session-reminder", draft, {
      sessionTitle: session.title,
      sessionNumber: session.sessionNumber,
      sessionDate: DATE_FORMAT.format(session.date),
    });
  }

  async composeHandout(worldSlug: string, assetId: string, portalBaseUrl?: string): Promise<MailDraft | null> {
    const asset = await this.db.asset.findFirst({
      where: {
        id: assetId,
        world: { slug: worldSlug },
      },
      select: {
        id: true,
        worldId: true,
        title: true,
        description: true,
        visibility: true,
      },
    });

    if (!asset) {
      return null;
    }

    const source: HandoutSource = {
      worldId: asset.worldId,
      assetId: asset.id,
      title: asset.title,
      description: asset.description,
      visibility: asset.visibility,
      publicUrl:
        portalBaseUrl && asset.visibility !== "dm_only"
          ? `${portalBaseUrl.replace(/\/$/, "")}/worlds/${worldSlug}/assets/${asset.id}`
          : undefined,
    };

    return composeHandoutMail(source);
  }

  async composeShareLink(
    worldSlug: string,
    shareLinkId: string,
    portalBaseUrl?: string,
  ): Promise<MailDraft | null> {
    const link = await this.db.shareLink.findFirst({
      where: {
        id: shareLinkId,
        world: { slug: worldSlug },
      },
      select: {
        id: true,
        worldId: true,
        token: true,
        targetType: true,
        targetId: true,
      },
    });

    if (!link) {
      return null;
    }

    const targetLabel = await this.resolveShareTargetLabel(link.targetType, link.targetId);
    const publicUrl = buildShareUrl(link.token, portalBaseUrl);

    const source: ShareLinkSource = {
      worldId: link.worldId,
      shareLinkId: link.id,
      targetLabel,
      publicUrl,
    };

    return composeShareLinkMail(source);
  }

  async composeContractReminder(contractId: string): Promise<MailDraft | null> {
    const contract = await this.brainDb.contractExpense.findUnique({ where: { id: contractId } });
    if (!contract) {
      return null;
    }

    const alert = buildContractAlerts([contract]).find((entry) => entry.dueDate);
    const dueDate = alert?.dueDate ?? contract.nextPaymentDate ?? contract.cancelByDate;
    if (!dueDate) {
      return null;
    }

    const draft = composeContractReminderMail({
      contractId: contract.id,
      contractName: contract.name,
      reminderMessage: alert?.message ?? "Vertrag prüfen",
      dueDate: DATE_FORMAT.format(dueDate),
    });

    return this.applyTemplate("contract-reminder", draft, {
      contractName: contract.name,
      reminderMessage: alert?.message ?? "Vertrag prüfen",
      dueDate: DATE_FORMAT.format(dueDate),
    });
  }

  async composeBackupWarning(): Promise<MailDraft> {
    const lastBackup = await this.db.activityLog.findFirst({
      where: { action: "backup_created" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    const message = lastBackup
      ? `Das letzte Backup ist älter als ${BACKUP_CHECK_INTERVAL_DAYS} Tage.`
      : "Es wurde noch kein Backup erstellt.";

    const draft = composeBackupWarningMail({
      message,
      lastBackupAt: lastBackup ? DATE_FORMAT.format(lastBackup.createdAt) : "—",
    });

    return this.applyTemplate("backup-warning", draft, {
      message,
      lastBackupAt: lastBackup ? DATE_FORMAT.format(lastBackup.createdAt) : "—",
    });
  }

  async composeSystemWarning(title: string, message: string): Promise<MailDraft> {
    const draft = composeSystemWarningMail({ title, message });
    return this.applyTemplate("system-warning", draft, { title, message });
  }

  async composeTerrainRental(projectId: string, message?: string): Promise<MailDraft | null> {
    const project = await this.brainDb.workshopProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        status: true,
        worldId: true,
        notes: true,
      },
    });

    if (!project) {
      return null;
    }

    const bodyMessage = message?.trim() || project.notes.trim() || "Terrain-Verleih Anfrage/Antwort";
    const draft = composeTerrainRentalMail({
      worldId: project.worldId,
      projectId: project.id,
      projectTitle: project.title,
      message: bodyMessage,
      status: project.status,
    });

    return this.applyTemplate("terrain-rental", draft, {
      projectTitle: project.title,
      message: bodyMessage,
      status: project.status,
    });
  }

  async compose(
    kind: MailComposeKind,
    options: {
      worldSlug?: string;
      sourceId?: string;
      portalBaseUrl?: string;
      title?: string;
      message?: string;
    },
  ): Promise<MailDraft | null> {
    switch (kind) {
      case "session_recap":
        if (!options.worldSlug || !options.sourceId) return null;
        return this.composeSessionRecap(options.worldSlug, options.sourceId);
      case "session_reminder":
        if (!options.worldSlug || !options.sourceId) return null;
        return this.composeSessionReminder(options.worldSlug, options.sourceId);
      case "handout":
        if (!options.worldSlug || !options.sourceId) return null;
        return this.composeHandout(options.worldSlug, options.sourceId, options.portalBaseUrl);
      case "share_link":
        if (!options.worldSlug || !options.sourceId) return null;
        return this.composeShareLink(options.worldSlug, options.sourceId, options.portalBaseUrl);
      case "contract_reminder":
        if (!options.sourceId) return null;
        return this.composeContractReminder(options.sourceId);
      case "backup_warning":
        return this.composeBackupWarning();
      case "system_warning":
        return this.composeSystemWarning(
          options.title?.trim() || "Systemhinweis",
          options.message?.trim() || "Bitte Systemstatus prüfen.",
        );
      case "terrain_rental":
        if (!options.sourceId) return null;
        return this.composeTerrainRental(options.sourceId, options.message);
      default: {
        const _exhaustive: never = kind;
        throw new Error(`Unbekannter Compose-Typ: ${String(_exhaustive)}`);
      }
    }
  }

  private async applyTemplate(
    slug: string,
    draft: MailDraft,
    variables: Record<string, string | number | null | undefined>,
  ): Promise<MailDraft> {
    const template = await createMailTemplateService(this.db).getTemplate(slug);
    if (!template) {
      return draft;
    }

    return {
      ...draft,
      subject: renderMailTemplate(template.subject, variables),
      bodyHtml: renderMailTemplate(template.bodyHtml, variables),
      bodyText: renderMailTemplate(template.bodyText, variables),
    };
  }

  private async resolveShareTargetLabel(targetType: string, targetId: string): Promise<string> {
    if (targetType === "page") {
      const page = await this.db.page.findUnique({
        where: { id: targetId },
        select: { title: true },
      });
      return page?.title ?? "Seite";
    }

    if (targetType === "asset") {
      const asset = await this.db.asset.findUnique({
        where: { id: targetId },
        select: { title: true },
      });
      return asset?.title ?? "Handout";
    }

    return "Freigabe";
  }
}

export function createMailComposeService(brainDb: BrainPrismaClient, db: PrismaClient): MailComposeService {
  return new MailComposeService(brainDb, db);
}
