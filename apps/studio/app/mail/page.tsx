import {
  createConnectorService,
  createMailAccountService,
  createMailLogService,
  createMailPortalService,
  createMailService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import type { RtxConnectorState } from "@uwe/shared-ui";
import { MAIL_PRIORITY_CATEGORIES, MAIL_PRIORITY_LABELS } from "@uwe/mail/portal-types";
import { StudioShell, BreadcrumbTrail } from "@/src/components/shell";
import { MailCenter } from "@/components/mail/MailCenter";
import {
  senderNameFromAddress,
  type MailCategoryVM,
  type MailCenterData,
  type MailFolderVM,
  type MailMessageVM,
} from "@/components/mail/mail-types";

export const dynamic = "force-dynamic";

const HIGH_PRIORITY_THRESHOLD = 70;

export default async function MailCenterPage() {
  const portal = createMailPortalService(prisma);
  const accountService = createMailAccountService(prisma);
  const mailService = createMailService(prisma);
  const repo = getAppRepository();

  const systemSettings = await repo.getSystemSettings();

  const [portalAccounts, portalMessages, drafts, logs, worlds, config, connector] = await Promise.all([
    portal.listAccounts(),
    portal.searchMessages({ limit: systemSettings.mail.inboxLimit }),
    accountService.listDrafts(),
    createMailLogService(prisma).list({ limit: 10 }),
    repo.listWorlds(),
    mailService.getConfigStatus(),
    createConnectorService(prisma).summarize().catch(() => null),
  ]);

  const rtxState: RtxConnectorState = connector?.anyOnline ? "online" : "offline";

  const accounts = portalAccounts.map((account) => ({
    id: account.id,
    label: account.label,
    email: account.username,
    imapHost: account.imapHost,
    smtpHost: account.smtpHost,
    lastImapSyncAt: account.lastImapSyncAt ? account.lastImapSyncAt.toISOString() : null,
    imapSyncError: account.imapSyncError,
    syncEnabled: account.syncEnabled,
    ok: !account.imapSyncError,
  }));

  const messages: MailMessageVM[] = portalMessages.map((message) => ({
    id: message.id,
    accountId: message.accountId,
    accountLabel: message.accountLabel ?? null,
    fromAddress: message.fromAddress,
    senderName: senderNameFromAddress(message.fromAddress),
    subject: message.subject,
    snippet: message.snippet,
    receivedAt: message.receivedAt.toISOString(),
    isRead: message.isRead,
    hasAttachments: message.hasAttachments,
    priority: message.priority
      ? {
          category: message.priority.category,
          priority: message.priority.priority,
          explanation: message.priority.explanation,
        }
      : null,
  }));

  const unreadCount = messages.filter((message) => !message.isRead).length;
  const markedCount = messages.filter((message) => (message.priority?.priority ?? 0) >= HIGH_PRIORITY_THRESHOLD).length;
  const triageCount = messages.filter((message) => message.priority).length;

  const folders: MailFolderVM[] = [
    { key: "inbox", name: "Posteingang", icon: "inbox", count: messages.length, active: true },
    { key: "marked", name: "Markiert", icon: "star", count: markedCount || null, active: false },
    { key: "drafts", name: "Entwürfe", icon: "pencil-line", count: drafts.length || null, active: false },
    { key: "sent", name: "Gesendet", icon: "send", count: null, active: false },
    { key: "archive", name: "Archiv", icon: "archive", count: null, active: false },
    { key: "trash", name: "Papierkorb", icon: "trash-2", count: null, active: false },
  ];

  const categories: MailCategoryVM[] = MAIL_PRIORITY_CATEGORIES.map((key) => ({
    key,
    name: MAIL_PRIORITY_LABELS[key],
    count: messages.filter((message) => message.priority?.category === key).length,
  })).filter((category) => category.count > 0);

  const data: MailCenterData = {
    rtxState,
    accounts,
    messages,
    drafts: drafts.map((draft) => ({
      id: draft.id,
      subject: draft.subject,
      status: draft.status,
      updatedAt: draft.updatedAt.toISOString(),
    })),
    logs: logs.map((log) => ({
      id: log.id,
      createdAt: log.createdAt.toISOString(),
      status: log.status,
      subject: log.subject,
      recipients: log.toAddresses,
      errorMessage: log.errorMessage ?? null,
    })),
    worlds: worlds.map((world) => ({ id: world.id, name: world.name, slug: world.slug })),
    config: {
      enabled: config.enabled,
      configured: config.configured,
      host: config.host,
      port: config.port,
      fromAddress: config.fromAddress,
      useMock: config.useMock,
      message: config.message,
    },
    folders,
    categories,
    activeCategory: null,
    query: "",
    counts: { inbox: messages.length, unread: unreadCount, drafts: drafts.length, triage: triageCount },
  };

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Mail Center" }]} />}>
      <div className="-m-4 md:-m-6 h-[calc(100dvh-3.5rem)] overflow-hidden">
        <MailCenter data={data} />
      </div>
    </StudioShell>
  );
}
