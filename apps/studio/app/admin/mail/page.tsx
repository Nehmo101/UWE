import { Suspense } from "react";
import { BreadcrumbTrail, PageHeader, SystemShell } from "@/src/components/shell";
import { MailPortalAccountForm, MailPortalAccountsPanel } from "@/components/mail-portal/MailPortalAccounts";
import { MailPortalInbox } from "@/components/mail-portal/MailPortalInbox";
import { createMailPortalService, getSystemSettings, prisma } from "@uwe/database/server";

interface Props {
  searchParams: Promise<{ message?: string; q?: string }>;
}

export default async function AdminMailPortalPage({ searchParams }: Props) {
  const { message: messageId, q } = await searchParams;
  const service = createMailPortalService(prisma);
  const settings = await getSystemSettings(prisma);

  const [accounts, messages, audit] = await Promise.all([
    service.listAccounts(),
    service.searchMessages({ q, limit: settings.mail.inboxLimit }),
    service.listAuditLog(20),
  ]);

  const selectedMessage = messageId ? await service.getMessage(messageId) : null;

  return (
    <SystemShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Admin", href: "/admin" }, { label: "Mail Portal" }]}
        />
      }
    >
      <PageHeader
        title="Mail Portal"
        summary="Admin-Postfächer: IMAP/SMTP, Smart Inbox, Priorisierung, KI-Entwürfe. Versand nur nach expliziter Bestätigung."
      />
      <div className="uwe-admin-mail-portal">
        <MailPortalAccountForm />
        <MailPortalAccountsPanel accounts={accounts} />

        <Suspense fallback={<p className="uwe-dashboard-muted">Inbox wird geladen…</p>}>
          <MailPortalInbox
            messages={messages.map((m) => ({
              ...m,
              receivedAt: m.receivedAt.toISOString(),
            }))}
            selectedId={messageId ?? null}
            selectedMessage={
              selectedMessage
                ? {
                    id: selectedMessage.id,
                    subject: selectedMessage.subject,
                    fromAddress: selectedMessage.fromAddress,
                    bodyText: selectedMessage.bodyText ?? null,
                    bodyHtml: selectedMessage.bodyHtml ?? null,
                    attachments: selectedMessage.attachments ?? [],
                    aiActions: (selectedMessage.aiActions ?? []).map((a) => ({
                      kind: a.kind,
                      outputText: a.outputText,
                      tone: a.tone,
                    })),
                    priority: selectedMessage.priority,
                  }
                : null
            }
          />
        </Suspense>

        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">Audit / Sync-Status</h2>
          <ul className="uwe-list-plain">
            {audit.map((entry) => (
              <li key={entry.id}>
                <time dateTime={entry.createdAt.toISOString()}>
                  {entry.createdAt.toLocaleString("de-DE")}
                </time>{" "}
                — {entry.action}
                {entry.detail ? `: ${entry.detail}` : ""}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </SystemShell>
  );
}
