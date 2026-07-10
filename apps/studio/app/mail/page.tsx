import {
  createMailAccountService,
  createMailLogService,
  createMailService,
  getAppRepository,
  prisma,
} from "@uwe/database/server";
import { createMailPortalService } from "@uwe/mail/portal";
import type { RtxConnectorState } from "@uwe/shared-ui";
import { loadStudioRtxDisplayState } from "@/src/lib/rtx-display-state";
import { MAIL_PRIORITY_CATEGORIES, MAIL_PRIORITY_LABELS } from "@uwe/mail/portal-types";
import { StudioShell, BreadcrumbTrail } from "@/src/components/shell";
import { MailCenter } from "@/components/mail/MailCenter";
import {
  senderNameFromAddress,
  type MailCategoryVM,
  type MailCenterData,
  type MailFolderKey,
  type MailFolderVM,
  type MailMessageVM,
} from "@/components/mail/mail-types";

export const dynamic = "force-dynamic";

const HIGH_PRIORITY_THRESHOLD = 70;
const VALID_FOLDERS: MailFolderKey[] = ["inbox", "marked", "drafts", "sent", "archive", "trash"];

function parseFolder(value: string | undefined): MailFolderKey {
  if (value && VALID_FOLDERS.includes(value as MailFolderKey)) {
    return value as MailFolderKey;
  }
  return "inbox";
}

export default async function MailCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string; account?: string; q?: string }>;
}) {
  const params = await searchParams;
  const activeFolder = parseFolder(params.folder);
  const selectedAccountId = params.account && params.account !== "all" ? params.account : null;
  const query = params.q?.trim() ?? "";

  const portal = createMailPortalService(prisma);
  const accountService = createMailAccountService(prisma);
  const mailService = createMailService(prisma);
  const repo = getAppRepository();

  const systemSettings = await repo.getSystemSettings();
  const inboxLimit = systemSettings.mail.inboxLimit;

  const searchQuery = {
    accountId: selectedAccountId ?? undefined,
    q: query || undefined,
    limit: inboxLimit,
    folder: activeFolder === "marked" ? ("marked" as const) : activeFolder,
    markedOnly: activeFolder === "marked",
  };

  const [portalAccounts, portalResult, sentMessages, drafts, logs, worlds, config, rtxDisplay] =
    await Promise.all([
      portal.listAccounts(),
      activeFolder === "sent"
        ? Promise.resolve({ items: [], nextCursor: null })
        : activeFolder === "drafts"
          ? Promise.resolve({ items: [], nextCursor: null })
          : portal.searchMessages(searchQuery),
      activeFolder === "sent" || activeFolder === "inbox"
        ? portal.listSentMessages({ accountId: selectedAccountId ?? undefined, limit: inboxLimit })
        : Promise.resolve([]),
      accountService.listDrafts(),
      createMailLogService(prisma).list({ limit: 10 }),
      repo.listWorlds(),
      mailService.getConfigStatus(),
      loadStudioRtxDisplayState(prisma).catch(() => null),
    ]);

  const portalMessages = portalResult.items;

  const rtxState: RtxConnectorState = rtxDisplay?.connectorState ?? "offline";

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

  const mapMessage = (message: {
    id: string;
    accountId: string;
    accountLabel?: string | null;
    fromAddress: string;
    subject: string;
    snippet: string | null;
    receivedAt: Date;
    isRead: boolean;
    hasAttachments: boolean;
    hasUnsubscribeTarget: boolean;
    priority: {
      priority: number;
      category: import("@uwe/mail/portal-types").MailPriorityCategory;
      explanation: string;
    } | null;
  }): MailMessageVM => ({
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
    hasUnsubscribeTarget: message.hasUnsubscribeTarget,
    priority: message.priority
      ? {
          category: message.priority.category,
          priority: message.priority.priority,
          explanation: message.priority.explanation,
        }
      : null,
  });

  const messages: MailMessageVM[] =
    activeFolder === "sent"
      ? sentMessages.map((entry) =>
          mapMessage({
            ...entry,
            accountLabel: null,
            hasUnsubscribeTarget: false,
            priority: null,
          }),
        )
      : portalMessages.map(mapMessage);

  const unreadCount = messages.filter((message) => !message.isRead).length;
  const markedCount = portalMessages.filter(
    (message) => (message.priority?.priority ?? 0) >= HIGH_PRIORITY_THRESHOLD,
  ).length;
  const triageCount = portalMessages.filter((message) => message.priority).length;

  const folders: MailFolderVM[] = [
    {
      key: "inbox",
      name: "Posteingang",
      icon: "inbox",
      count: activeFolder === "inbox" ? messages.length : null,
      active: activeFolder === "inbox",
    },
    {
      key: "marked",
      name: "Markiert",
      icon: "star",
      count: markedCount || null,
      active: activeFolder === "marked",
    },
    {
      key: "drafts",
      name: "Entwürfe",
      icon: "pencil-line",
      count: drafts.length || null,
      active: activeFolder === "drafts",
    },
    {
      key: "sent",
      name: "Gesendet",
      icon: "send",
      count: sentMessages.length || null,
      active: activeFolder === "sent",
    },
    { key: "archive", name: "Archiv", icon: "archive", count: null, active: activeFolder === "archive" },
    { key: "trash", name: "Papierkorb", icon: "trash-2", count: null, active: activeFolder === "trash" },
  ];

  const categories: MailCategoryVM[] = MAIL_PRIORITY_CATEGORIES.map((key) => ({
    key,
    name: MAIL_PRIORITY_LABELS[key],
    count: portalMessages.filter((message) => message.priority?.category === key).length,
  })).filter((category) => category.count > 0);

  const data: MailCenterData = {
    rtxState,
    accounts,
    messages,
    sentMessages: sentMessages.map((entry) =>
      mapMessage({ ...entry, accountLabel: null, hasUnsubscribeTarget: false, priority: null }),
    ),
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
    activeFolder,
    selectedAccountId,
    query,
    autoSyncEnabled: systemSettings.mail.autoSyncEnabled,
    autoSyncIntervalMinutes: systemSettings.mail.autoSyncIntervalMinutes,
    counts: {
      inbox: portalMessages.length,
      unread: unreadCount,
      drafts: drafts.length,
      triage: triageCount,
      sent: sentMessages.length,
    },
  };

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Mail Center" }]} />}>
      <div className="-m-4 md:-m-6 h-[calc(100dvh-3.5rem-var(--uwe-safe-top))] overflow-hidden">
        <MailCenter data={data} />
      </div>
    </StudioShell>
  );
}
