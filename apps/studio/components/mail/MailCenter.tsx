"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { MailRail } from "./MailRail";
import { MailMessageList, type MailListFilter } from "./MailMessageList";
import { MailReader } from "./MailReader";
import { MailTriage } from "./MailTriage";
import { MailEmptyInbox } from "./MailEmptyInbox";
import { MailSettings } from "./MailSettings";
import { MailComposeModal, type ComposeContext } from "./MailComposeModal";
import {
  senderNameFromAddress,
  type MailCenterData,
  type MailMessageDetailVM,
  type MailPriorityVM,
  type MailView,
} from "./mail-types";
import type { MailPriorityCategory } from "@uwe/mail/portal-types";

interface RawDetail {
  id: string;
  accountId: string;
  accountLabel?: string | null;
  subject: string;
  fromAddress: string;
  snippet: string | null;
  receivedAt: string;
  isRead: boolean;
  hasAttachments: boolean;
  hasUnsubscribeTarget: boolean;
  bodyText: string | null;
  bodyHtml: string | null;
  toAddresses?: string[] | null;
  ccAddresses?: string[] | null;
  priority: MailPriorityVM | null;
  attachments?: Array<{ id: string; filename: string; mimeType: string; sizeBytes: number }>;
  aiActions?: Array<{ kind: string; outputText: string | null; tone: string | null; createdAt: string }>;
}

function toDetail(raw: RawDetail): MailMessageDetailVM {
  return {
    id: raw.id,
    accountId: raw.accountId,
    accountLabel: raw.accountLabel ?? null,
    fromAddress: raw.fromAddress,
    senderName: senderNameFromAddress(raw.fromAddress),
    subject: raw.subject,
    snippet: raw.snippet,
    receivedAt: raw.receivedAt,
    isRead: raw.isRead,
    hasAttachments: raw.hasAttachments,
    hasUnsubscribeTarget: raw.hasUnsubscribeTarget,
    priority: raw.priority,
    bodyText: raw.bodyText,
    bodyHtml: raw.bodyHtml,
    toAddresses: raw.toAddresses ?? [],
    ccAddresses: raw.ccAddresses ?? [],
    attachments: (raw.attachments ?? []).map((a) => ({
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
    aiActions: (raw.aiActions ?? []).map((a) => ({
      kind: a.kind,
      outputText: a.outputText,
      tone: a.tone,
      createdAt: a.createdAt,
    })),
  };
}

export function MailCenter({ data }: { data: MailCenterData }) {
  const router = useRouter();
  const [view, setView] = React.useState<MailView>("inbox");
  const [filter, setFilter] = React.useState<MailListFilter>("alle");
  const [activeCategory, setActiveCategory] = React.useState<MailPriorityCategory | null>(data.activeCategory);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<MailMessageDetailVM | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [compose, setCompose] = React.useState<ComposeContext | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const flash = React.useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }, []);

  const visibleMessages = React.useMemo(
    () =>
      activeCategory
        ? data.messages.filter((message) => message.priority?.category === activeCategory)
        : data.messages,
    [data.messages, activeCategory],
  );

  const loadDetail = React.useCallback(
    async (id: string) => {
      setLoadingDetail(true);
      try {
        const response = await fetch(studioApiUrl(`/api/admin/mail/messages/${id}`), {
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json()) as { message?: RawDetail; error?: string };
        if (!response.ok || !payload.message) {
          flash(payload.error ?? "Nachricht konnte nicht geladen werden.");
          return;
        }
        setDetail(toDetail(payload.message));
        router.refresh();
      } catch {
        flash("Netzwerkfehler beim Laden.");
      } finally {
        setLoadingDetail(false);
      }
    },
    [flash, router],
  );

  const selectMessage = React.useCallback(
    (id: string) => {
      setView("inbox");
      setSelectedId(id);
      void loadDetail(id);
    },
    [loadDetail],
  );

  async function postJson(path: string, body: Record<string, unknown>): Promise<boolean> {
    const response = await fetch(studioApiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      flash(payload.error ?? "Aktion fehlgeschlagen.");
      return false;
    }
    return true;
  }

  async function runSync() {
    const account = data.accounts.find((entry) => entry.imapHost) ?? data.accounts[0];
    if (!account) {
      flash("Kein IMAP-Konto verbunden — unter Einstellungen anlegen.");
      setView("settings");
      return;
    }
    setSyncing(true);
    const ok = await postJson("/api/admin/mail/sync", { accountId: account.id, limit: 50 });
    setSyncing(false);
    if (ok) {
      flash("Sync gestartet.");
      router.refresh();
    }
  }

  async function summarize(id: string) {
    setBusy(true);
    const ok = await postJson("/api/admin/mail/ai/summarize", { messageId: id });
    setBusy(false);
    if (ok) {
      flash("Von RTX zusammengefasst.");
      if (selectedId === id) void loadDetail(id);
    }
  }

  async function unsubscribe(id: string) {
    setBusy(true);
    const response = await fetch(studioApiUrl("/api/admin/mail/unsubscribe"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: id }),
    });
    setBusy(false);
    const payload = (await response.json().catch(() => ({}))) as {
      outcome?: { cleanedUpCount: number };
      error?: string;
    };
    if (!response.ok || !payload.outcome) {
      flash(payload.error ?? "Abmeldung fehlgeschlagen.");
      return;
    }
    flash(`Abmeldung gesendet — ${payload.outcome.cleanedUpCount} Nachricht(en) aufgeräumt.`);
    router.refresh();
  }

  function replyTo(message: MailMessageDetailVM) {
    setCompose({
      messageId: message.id,
      to: message.fromAddress,
      subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
      body: "",
    });
  }

  function openComposeNew() {
    setCompose({ messageId: null, to: "", subject: "", body: "" });
  }

  const mainArea = (() => {
    if (view === "settings") {
      return (
        <MailSettings
          accounts={data.accounts}
          config={data.config}
          logs={data.logs}
          worlds={data.worlds}
          rtxState={data.rtxState}
        />
      );
    }
    if (view === "triage") {
      return (
        <MailTriage
          messages={data.messages}
          rtxState={data.rtxState}
          onOpen={selectMessage}
          onReplyDraft={(id) => selectMessage(id)}
          onTask={() => flash("Als Aufgabe vorgemerkt.")}
          onCapture={() => flash("In Capture übernommen.")}
          onUnsubscribe={(id) => void unsubscribe(id)}
        />
      );
    }
    if (data.messages.length === 0) {
      return (
        <MailEmptyInbox
          hasAccounts={data.accounts.length > 0}
          syncing={syncing}
          onOpenTriage={() => setView("triage")}
          onCompose={openComposeNew}
          onSync={() => void runSync()}
        />
      );
    }
    return (
      <div style={{ flex: 1, display: "flex", minWidth: 0 }}>
        <MailMessageList
          messages={visibleMessages}
          selectedId={selectedId}
          filter={filter}
          onFilter={setFilter}
          onSelect={selectMessage}
          onSync={() => void runSync()}
          syncing={syncing}
          title={activeCategory ? "Gefiltert" : "Posteingang"}
        />
        <MailReader
          message={detail}
          loading={loadingDetail}
          rtxState={data.rtxState}
          busy={busy}
          onReply={() => detail && replyTo(detail)}
          onForward={() => flash("Weiterleiten geöffnet.")}
          onSummarize={() => detail && void summarize(detail.id)}
          onCapture={() => flash("In Capture übernommen.")}
          onTask={() => flash("Als Aufgabe vorgemerkt.")}
          onArchive={() => flash("Archiviert.")}
          onDelete={() => flash("In den Papierkorb verschoben.")}
        />
      </div>
    );
  })();

  return (
    <div style={{ display: "flex", height: "100%", minHeight: 0, background: "var(--uwe-bg)", overflow: "hidden", position: "relative" }}>
      <div className="hidden lg:flex" style={{ height: "100%" }}>
        <MailRail
          accounts={data.accounts}
          folders={data.folders}
          categories={data.categories}
          activeCategory={activeCategory}
          view={view}
          triageCount={data.counts.triage}
          onCompose={openComposeNew}
          onOpenTriage={() => setView("triage")}
          onSelectCategory={(category) => {
            setActiveCategory(category);
            setView("inbox");
          }}
        />
      </div>

      {mainArea}

      {toast ? (
        <div
          role="status"
          style={{
            position: "absolute",
            top: 14,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 40,
            background: "var(--uwe-fg)",
            color: "var(--uwe-bg)",
            fontSize: 12.5,
            padding: "8px 14px",
            borderRadius: 999,
            boxShadow: "0 8px 24px rgba(0,0,0,.3)",
          }}
        >
          {toast}
        </div>
      ) : null}

      {compose ? (
        <MailComposeModal
          context={compose}
          accounts={data.accounts}
          onClose={() => setCompose(null)}
          onSent={() => {
            setCompose(null);
            flash("Nachricht gesendet.");
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
