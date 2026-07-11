"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { useMailActions } from "./use-mail-actions";
import { useMailKeyboard } from "./use-mail-keyboard";
import { MailRail } from "./MailRail";
import { MailMessageList, type MailListFilter } from "./MailMessageList";
import { MailReader } from "./MailReader";
import { MailTriage } from "./MailTriage";
import { MailEmptyInbox } from "./MailEmptyInbox";
import { MailSettings } from "./MailSettings";
import { MailComposeModal, type ComposeContext } from "./MailComposeModal";
import { MailChatPanel } from "./MailChatPanel";
import { MailDraftsList } from "./MailDraftsList";
import { MailComposeFab, MobileMailBar } from "./MailMobileNav";
import {
  senderNameFromAddress,
  type MailCenterData,
  type MailFolderKey,
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
  isStarred?: boolean;
  hasAttachments: boolean;
  hasUnsubscribeTarget: boolean;
  bodyText: string | null;
  bodyHtml: string | null;
  bodySafeHtml: string | null;
  toAddresses?: string[] | null;
  ccAddresses?: string[] | null;
  priority: MailPriorityVM | null;
  attachments?: Array<{ id: string; filename: string; mimeType: string; sizeBytes: number }>;
  aiActions?: Array<{ kind: string; outputText: string | null; tone: string | null; createdAt: string }>;
  thread?: Array<{ id: string; subject: string; fromAddress: string; snippet: string | null; receivedAt: string; isRead: boolean; folderRole: string | null }>;
}

function toDetail(raw: RawDetail, thread?: RawDetail["thread"]): MailMessageDetailVM {
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
    isStarred: raw.isStarred ?? false,
    hasAttachments: raw.hasAttachments,
    hasUnsubscribeTarget: raw.hasUnsubscribeTarget,
    priority: raw.priority,
    bodyText: raw.bodyText,
    bodyHtml: raw.bodyHtml,
    bodySafeHtml: raw.bodySafeHtml,
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
    thread: (thread ?? raw.thread ?? []).map((entry) => ({
      id: entry.id,
      subject: entry.subject,
      fromAddress: entry.fromAddress,
      snippet: entry.snippet,
      receivedAt: entry.receivedAt,
      isRead: entry.isRead,
      folderRole: entry.folderRole,
    })),
  };
}

function folderTitle(folder: MailFolderKey): string {
  const titles: Record<MailFolderKey, string> = {
    inbox: "Posteingang",
    marked: "Markiert",
    drafts: "Entwürfe",
    sent: "Gesendet",
    archive: "Archiv",
    trash: "Papierkorb",
  };
  return titles[folder];
}

export function MailCenter({ data }: { data: MailCenterData }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = React.useState<MailView>(
    data.activeFolder === "drafts" ? "drafts" : data.activeFolder === "sent" ? "sent" : "inbox",
  );
  const [filter, setFilter] = React.useState<MailListFilter>("alle");
  const [activeCategory, setActiveCategory] = React.useState<MailPriorityCategory | null>(data.activeCategory);
  const [activeFolder, setActiveFolder] = React.useState<MailFolderKey>(data.activeFolder);
  const [selectedAccountId, setSelectedAccountId] = React.useState<string | null>(data.selectedAccountId);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<MailMessageDetailVM | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [compose, setCompose] = React.useState<ComposeContext | null>(null);
  const [chatOpen, setChatOpen] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [selectionMode, setSelectionMode] = React.useState(false);

  const clearSelection = React.useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);
  const toggleSelect = React.useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const selectVisible = React.useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const flash = React.useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast((current) => (current === message ? null : current)), 2600);
  }, []);

  const pushNav = React.useCallback(
    (next: { folder?: MailFolderKey; account?: string | null; q?: string | null }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.folder) params.set("folder", next.folder);
      if (next.account === null) params.delete("account");
      else if (next.account) params.set("account", next.account);
      if (next.q === null) params.delete("q");
      else if (next.q !== undefined) {
        if (next.q) params.set("q", next.q);
        else params.delete("q");
      }
      router.push(`/mail?${params.toString()}`);
    },
    [router, searchParams],
  );

  const visibleMessages = React.useMemo(() => {
    let list = data.messages;
    if (activeCategory) {
      list = list.filter((message) => message.priority?.category === activeCategory);
    }
    if (filter === "ungelesen") list = list.filter((message) => !message.isRead);
    if (filter === "markiert") list = list.filter((message) => (message.priority?.priority ?? 0) >= 70);
    return list;
  }, [data.messages, activeCategory, filter]);

  const loadDetail = React.useCallback(
    async (id: string) => {
      setLoadingDetail(true);
      try {
        const response = await fetch(studioApiUrl(`/api/admin/mail/messages/${id}`), {
          headers: { Accept: "application/json" },
        });
        const payload = (await response.json()) as { message?: RawDetail; thread?: RawDetail["thread"]; error?: string };
        if (!response.ok || !payload.message) {
          flash(payload.error ?? "Nachricht konnte nicht geladen werden.");
          return;
        }
        setDetail(toDetail(payload.message, payload.thread));
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

  const actions = useMailActions({
    data,
    router,
    flash,
    selectedAccountId,
    selectedId,
    detail,
    setDetail,
    setSelectedId,
    setCompose,
    setView,
    loadDetail,
  });
  const {
    busy,
    syncing,
    syncProgress,
    runSync,
    postJson,
    summarize,
    unsubscribe,
    archiveMessage,
    trashMessage,
    captureMessage,
    taskMessage,
    toggleStar,
    bulkAction,
    openDraft,
  } = actions;

  const runBulk = React.useCallback(
    (action: Parameters<typeof bulkAction>[0]) => {
      const ids = [...selectedIds];
      void bulkAction(action, ids).then(() => clearSelection());
    },
    [bulkAction, selectedIds, clearSelection],
  );

  function forwardMessage(message: MailMessageDetailVM) {
    const quoted = message.bodyText?.trim() || message.snippet?.trim() || "";
    setCompose({
      draftId: null,
      messageId: null,
      accountId: message.accountId,
      to: "",
      subject: message.subject.startsWith("Fwd:") ? message.subject : `Fwd: ${message.subject}`,
      body: [
        "",
        "---------- Weitergeleitete Nachricht ----------",
        `Von: ${message.fromAddress}`,
        `Betreff: ${message.subject}`,
        "",
        quoted,
      ].join("\n"),
    });
  }

  function replyTo(message: MailMessageDetailVM) {
    setCompose({
      draftId: null,
      messageId: message.id,
      accountId: message.accountId,
      to: message.fromAddress,
      subject: message.subject.startsWith("Re:") ? message.subject : `Re: ${message.subject}`,
      body: "",
    });
  }

  function openComposeNew() {
    setCompose({
      draftId: null,
      messageId: null,
      accountId: selectedAccountId ?? data.accounts[0]?.id ?? null,
      to: "",
      subject: "",
      body: "",
    });
  }

  function handleSelectFolder(folder: MailFolderKey) {
    setActiveFolder(folder);
    setView(folder === "drafts" ? "drafts" : folder === "sent" ? "sent" : "inbox");
    setSelectedId(null);
    setDetail(null);
    clearSelection();
    pushNav({ folder, account: selectedAccountId });
  }

  function handleSelectAccount(accountId: string | null) {
    setSelectedAccountId(accountId);
    clearSelection();
    pushNav({ folder: activeFolder, account: accountId });
  }

  useMailKeyboard({
    enabled: !compose && !chatOpen && view === "inbox",
    messageIds: visibleMessages.map((message) => message.id),
    selectedId,
    onSelect: selectMessage,
    onReply: () => detail && replyTo(detail),
    onArchive: () => void archiveMessage(),
    onTrash: () => void trashMessage(),
    onStar: () => detail && void toggleStar(detail),
    onFocusSearch: () => {
      const input = document.querySelector<HTMLInputElement>("input[data-mail-search]");
      input?.focus();
    },
  });

  const listTitle = activeCategory ? "Gefiltert" : folderTitle(activeFolder);

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
          onTask={(id) => void taskMessage(id)}
          onCapture={(id) => {
            void postJson("/api/admin/mail/actions", { action: "capture", messageId: id }).then((ok) => {
              if (ok) flash("In Capture übernommen.");
            });
          }}
          onUnsubscribe={(id) => void unsubscribe(id)}
        />
      );
    }
    if (view === "drafts") {
      return <MailDraftsList drafts={data.drafts} onCompose={openComposeNew} onEditDraft={(id) => void openDraft(id)} title="Entwürfe" />;
    }
    if (data.messages.length === 0 && activeFolder === "inbox") {
      return (
        <MailEmptyInbox
          hasAccounts={data.accounts.length > 0}
          syncing={syncing}
          autoSyncEnabled={data.autoSyncEnabled}
          syncProgress={syncProgress}
          onOpenTriage={() => setView("triage")}
          onCompose={openComposeNew}
          onSync={() => void runSync()}
        />
      );
    }
    return (
      <div style={{ flex: 1, display: "flex", minWidth: 0, flexDirection: "column" }}>
        {syncProgress ? (
          <div
            style={{
              padding: "8px 16px",
              background: "color-mix(in srgb, var(--uwe-accent) 10%, var(--uwe-panel))",
              borderBottom: "1px solid var(--uwe-border)",
              fontSize: 12,
              color: "var(--uwe-fg-muted)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1 }}>{syncProgress.label}</span>
              {syncProgress.total > 0 && syncProgress.processed > 0 ? (
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{syncProgress.processed}%</span>
              ) : null}
            </div>
            <div
              style={{
                marginTop: 6,
                height: 4,
                borderRadius: 999,
                background: "var(--uwe-border-muted)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width:
                    syncProgress.total > 0 && syncProgress.processed > 0
                      ? `${Math.min(100, syncProgress.processed)}%`
                      : "40%",
                  background: "var(--uwe-accent)",
                  transition: "width .3s ease",
                  animation:
                    syncProgress.total > 0 && syncProgress.processed > 0
                      ? undefined
                      : "pulse 1.2s ease-in-out infinite",
                }}
              />
            </div>
          </div>
        ) : null}
        <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
          {/* Mobil: Liste und Reader teilen sich den Platz nicht — bei geöffneter
              Nachricht wird der Reader vollflächig gezeigt, sonst die Liste. */}
          <div
            className={`${selectedId ? "hidden lg:flex" : "flex"} w-full flex-none lg:w-[400px]`}
            style={{ minHeight: 0 }}
          >
            <MailMessageList
              messages={visibleMessages}
              selectedId={selectedId}
              filter={filter}
              onFilter={setFilter}
              onSelect={selectMessage}
              onSync={() => void runSync()}
              syncing={syncing}
              title={listTitle}
              searchQuery={data.query}
              onSearch={(q) => pushNav({ folder: activeFolder, account: selectedAccountId, q: q || null })}
              selectedIds={selectedIds}
              selectionMode={selectionMode}
              busy={busy}
              onToggleSelectionMode={() => {
                setSelectionMode((value) => {
                  if (value) setSelectedIds(new Set());
                  return !value;
                });
              }}
              onToggleSelect={toggleSelect}
              onSelectVisible={selectVisible}
              onClearSelection={clearSelection}
              onBulkAction={runBulk}
            />
          </div>
          <div
            className={`${selectedId ? "flex" : "hidden lg:flex"}`}
            style={{ flex: 1, minWidth: 0 }}
          >
            <MailReader
              message={detail}
              loading={loadingDetail}
              rtxState={data.rtxState}
              busy={busy}
              onBack={() => {
                setSelectedId(null);
                setDetail(null);
              }}
              onReply={() => detail && replyTo(detail)}
              onForward={() => detail && forwardMessage(detail)}
              onSummarize={() => detail && void summarize(detail.id)}
              onCapture={() => detail && void captureMessage(detail)}
              onTask={() => detail && void taskMessage(detail.id)}
              onArchive={() => void archiveMessage()}
              onDelete={() => void trashMessage()}
              onUnsubscribe={() => detail && void unsubscribe(detail.id)}
              onToggleStar={() => detail && void toggleStar(detail)}
              onOpenChat={() => setChatOpen(true)}
            />
            {chatOpen && detail ? (
              <MailChatPanel
                message={detail}
                rtxState={data.rtxState}
                onClose={() => setChatOpen(false)}
                onActionComplete={() => {
                  router.refresh();
                  void loadDetail(detail.id);
                }}
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  })();

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: 0,
        background: "var(--uwe-bg)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div className="hidden lg:flex" style={{ height: "100%" }}>
        <MailRail
          accounts={data.accounts}
          folders={data.folders}
          categories={data.categories}
          activeCategory={activeCategory}
          activeFolder={activeFolder}
          selectedAccountId={selectedAccountId}
          view={view}
          triageCount={data.counts.triage}
          onCompose={openComposeNew}
          onOpenTriage={() => setView("triage")}
          onOpenSettings={() => setView("settings")}
          onSelectFolder={handleSelectFolder}
          onSelectAccount={handleSelectAccount}
          onSelectCategory={(category) => {
            setActiveCategory(category);
            setView("inbox");
            handleSelectFolder("inbox");
          }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <p className="text-xs text-muted-foreground" style={{ padding: "0.35rem 1rem", margin: 0, fontSize: "0.85rem" }}>
          Tastatur: j/k Navigation · Enter öffnen · e Archiv · # Papierkorb · r Antwort · s Stern · / Suche
        </p>
        {/* Mobile Navigation: die Rail ist < lg ausgeblendet — Ordner, Triage und
            Konto-Wechsel laufen hier über eine kompakte Chip-Leiste. */}
        <div className={selectedId && view === "inbox" ? "hidden" : "lg:hidden"}>
          <MobileMailBar
            accounts={data.accounts}
            folders={data.folders}
            view={view}
            activeFolder={activeFolder}
            triageCount={data.counts.triage}
            selectedAccountId={selectedAccountId}
            onSelectFolder={handleSelectFolder}
            onOpenTriage={() => setView("triage")}
            onOpenSettings={() => setView("settings")}
            onSelectAccount={handleSelectAccount}
          />
        </div>
        {mainArea}
      </div>

      {!compose && !selectedId ? <MailComposeFab onCompose={openComposeNew} /> : null}

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
