"use client";

import * as React from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ComposeContext } from "./MailComposeModal";
import type { MailCenterData, MailMessageDetailVM, MailView } from "./mail-types";

interface MailActionsDeps {
  data: MailCenterData;
  router: AppRouterInstance;
  flash: (message: string) => void;
  selectedAccountId: string | null;
  selectedId: string | null;
  detail: MailMessageDetailVM | null;
  setDetail: (value: MailMessageDetailVM | null) => void;
  setSelectedId: (value: string | null) => void;
  setCompose: (value: ComposeContext | null) => void;
  setView: (value: MailView) => void;
  loadDetail: (id: string) => Promise<void>;
}

export type MailBulkAction = "read" | "unread" | "archive" | "trash" | "star" | "unstar" | "unsubscribe";

export interface MailActions {
  busy: boolean;
  syncing: boolean;
  syncProgress: { processed: number; total: number; label: string } | null;
  runSync: (options?: { silent?: boolean }) => Promise<void>;
  postJson: (path: string, body: Record<string, unknown>) => Promise<boolean>;
  summarize: (id: string) => Promise<void>;
  unsubscribe: (id: string) => Promise<void>;
  archiveMessage: () => Promise<void>;
  trashMessage: () => Promise<void>;
  captureMessage: (message: MailMessageDetailVM) => Promise<void>;
  taskMessage: (messageId: string) => Promise<void>;
  toggleStar: (message: MailMessageDetailVM) => Promise<void>;
  bulkAction: (action: MailBulkAction, ids: string[]) => Promise<void>;
  openDraft: (draftId: string) => Promise<void>;
}

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(text.slice(0, 200) || `HTTP ${response.status}`);
  }
}

/**
 * Alle Netz-Seiteneffekte des Mail-Centers: Sync, Nachrichten-Aktionen,
 * Entwürfe. Aus MailCenter herausgezogen, damit die Komponente im
 * Datei-Budget bleibt.
 *
 * Gegenüber der Studio-Fassung geändert: der Sync wartet nicht mehr auf
 * Job-IDs, sondern auf die Antwort der Route selbst (siehe `runSync`).
 */
export function useMailActions(deps: MailActionsDeps): MailActions {
  const { data, router, flash, selectedAccountId, selectedId, detail, setDetail, setSelectedId, setCompose, setView, loadDetail } = deps;
  const [busy, setBusy] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<{ processed: number; total: number; label: string } | null>(null);
  const syncingRef = React.useRef(false);
  const runSyncRef = React.useRef<(options?: { silent?: boolean }) => Promise<void>>(async () => undefined);

  const postJson = React.useCallback(
    async (path: string, body: Record<string, unknown>): Promise<boolean> => {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = await parseJsonResponse(response).catch(() => ({ error: "Aktion fehlgeschlagen." }));
        flash(String(payload.error ?? "Aktion fehlgeschlagen."));
        return false;
      }
      return true;
    },
    [flash],
  );

  const runSync = React.useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      if (syncingRef.current) return;
      if (!data.accounts.some((entry) => entry.imapHost)) {
        if (!silent) {
          flash("Kein IMAP-Konto verbunden — unter Einstellungen anlegen.");
          setView("settings");
        }
        return;
      }
      syncingRef.current = true;
      setSyncing(true);
      // total 0 heißt für die Anzeige: unbestimmt (pulsierender Balken). Brain
      // bekommt vom direkten Sync keine Zwischenstände, also wird auch keine
      // Prozentzahl vorgetäuscht.
      if (!silent) setSyncProgress({ processed: 0, total: 0, label: "Postfächer werden abgerufen…" });

      // Während der Sync läuft, den Posteingang im kurzen Takt neu laden: der
      // Server schreibt die Nachrichten stapelweise, so flattern sie einzeln
      // rein statt alle auf einmal am Ende.
      let refreshTimer: number | null = null;
      if (!silent) refreshTimer = window.setInterval(() => router.refresh(), 1600);

      try {
        const response = await fetch("/api/mail/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId: selectedAccountId ?? "all", fullSync: true }),
        });
        const payload = await parseJsonResponse(response);
        if (!response.ok) {
          if (!silent) flash(String(payload.error ?? "Sync fehlgeschlagen."));
          return;
        }
        // Brain synchronisiert im Request statt über die Job-Queue: die Antwort
        // kommt erst, wenn alles durch ist, und bringt die Zahl gleich mit.
        // Deshalb gibt es hier keine Prozentanzeige — der Balken oben bleibt
        // unbestimmt, und der Auffrisch-Timer lässt die Mails einzeln reinlaufen.
        const imported = typeof payload.imported === "number" ? payload.imported : null;
        const failed = Array.isArray(payload.accounts)
          ? (payload.accounts as Array<{ ok?: boolean; label?: string; error?: string }>).filter(
              (entry) => entry.ok === false,
            )
          : [];
        if (!silent) {
          if (failed.length > 0) {
            const first = failed[0];
            flash(`${first.label ?? "Konto"}: ${first.error ?? "Sync fehlgeschlagen."}`);
          } else {
            flash(imported === null ? "Synchronisation abgeschlossen." : `${imported} Nachrichten synchronisiert.`);
          }
        }
        router.refresh();
      } catch (error) {
        if (!silent) flash(error instanceof Error ? error.message : "Sync fehlgeschlagen.");
      } finally {
        if (refreshTimer !== null) window.clearInterval(refreshTimer);
        syncingRef.current = false;
        setSyncing(false);
        setSyncProgress(null);
      }
    },
    [data.accounts, flash, router, selectedAccountId, setView],
  );

  runSyncRef.current = runSync;

  // Background timer: while the Mail Center is open and the tab is visible, all
  // mailboxes are pulled on the configured interval — complements the host timer.
  const autoSyncMs = data.autoSyncEnabled && data.autoSyncIntervalMinutes > 0 ? data.autoSyncIntervalMinutes * 60_000 : 0;
  React.useEffect(() => {
    if (!autoSyncMs) return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void runSyncRef.current({ silent: true });
    }, autoSyncMs);
    return () => window.clearInterval(intervalId);
  }, [autoSyncMs]);

  const summarize = React.useCallback(
    async (id: string) => {
      setBusy(true);
      const ok = await postJson("/api/mail/ai/summarize", { messageId: id });
      setBusy(false);
      if (ok) {
        flash("Von Maschinenraum zusammengefasst.");
        if (selectedId === id) void loadDetail(id);
      }
    },
    [flash, loadDetail, postJson, selectedId],
  );

  const unsubscribe = React.useCallback(
    async (id: string) => {
      setBusy(true);
      const response = await fetch("/api/mail/unsubscribe", {
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
    },
    [flash, router],
  );

  const archiveMessage = React.useCallback(async () => {
    if (!detail) return;
    setBusy(true);
    const ok = await postJson("/api/mail/actions", { action: "archive", messageId: detail.id });
    setBusy(false);
    if (ok) {
      flash("Archiviert.");
      router.refresh();
    }
  }, [detail, flash, postJson, router]);

  const trashMessage = React.useCallback(async () => {
    if (!detail) return;
    setBusy(true);
    const ok = await postJson("/api/mail/actions", { action: "trash", messageId: detail.id });
    setBusy(false);
    if (ok) {
      flash("In den Papierkorb verschoben.");
      setDetail(null);
      setSelectedId(null);
      router.refresh();
    }
  }, [detail, flash, postJson, router, setDetail, setSelectedId]);

  const captureMessage = React.useCallback(
    async (message: MailMessageDetailVM) => {
      setBusy(true);
      const ok = await postJson("/api/mail/actions", { action: "capture", messageId: message.id });
      setBusy(false);
      if (ok) flash("In Capture übernommen.");
    },
    [flash, postJson],
  );

  const taskMessage = React.useCallback(
    async (messageId: string) => {
      setBusy(true);
      const ok = await postJson("/api/mail/actions", { action: "task", messageId });
      setBusy(false);
      if (ok) flash("Als Projekt-Aufgabe angelegt.");
    },
    [flash, postJson],
  );

  const toggleStar = React.useCallback(
    async (message: MailMessageDetailVM) => {
      const next = !message.isStarred;
      const ok = await postJson("/api/mail/actions", {
        action: next ? "star" : "unstar",
        messageId: message.id,
      });
      if (ok) {
        if (detail && detail.id === message.id) setDetail({ ...detail, isStarred: next });
        flash(next ? "Markiert." : "Markierung entfernt.");
        router.refresh();
      }
    },
    [detail, flash, postJson, router, setDetail],
  );

  const bulkAction = React.useCallback(
    async (action: MailBulkAction, ids: string[]) => {
      if (ids.length === 0) return;
      setBusy(true);
      let ok = 0;
      for (const id of ids) {
        const done = await postJson("/api/mail/actions", { action, messageId: id });
        if (done) ok += 1;
      }
      setBusy(false);
      const labels: Record<MailBulkAction, string> = {
        read: "als gelesen markiert",
        unread: "als ungelesen markiert",
        archive: "archiviert",
        trash: "in den Papierkorb verschoben",
        star: "markiert",
        unstar: "entmarkiert",
        unsubscribe: "abgemeldet",
      };
      flash(`${ok}/${ids.length} Nachricht(en) ${labels[action]}.`);
      // A trashed/archived message might be the one open in the reader.
      if (action === "trash" || action === "archive") {
        if (detail && ids.includes(detail.id)) {
          setDetail(null);
          setSelectedId(null);
        }
      }
      router.refresh();
    },
    [detail, flash, postJson, router, setDetail, setSelectedId],
  );

  const openDraft = React.useCallback(
    async (draftId: string) => {
      setBusy(true);
      try {
        const response = await fetch(`/api/mail/drafts/${draftId}`);
        const payload = (await response.json()) as {
          draft?: {
            id: string;
            accountId: string | null;
            replyToMessageId: string | null;
            subject: string;
            bodyText: string | null;
            toAddresses: string[];
          };
          error?: string;
        };
        if (!response.ok || !payload.draft) {
          flash(payload.error ?? "Entwurf konnte nicht geladen werden.");
          return;
        }
        const draft = payload.draft;
        setCompose({
          draftId: draft.id,
          messageId: draft.replyToMessageId,
          accountId: draft.accountId,
          to: draft.toAddresses.join(", "),
          subject: draft.subject,
          body: draft.bodyText ?? "",
        });
      } catch {
        flash("Netzwerkfehler beim Laden des Entwurfs.");
      } finally {
        setBusy(false);
      }
    },
    [flash, setCompose],
  );

  return {
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
  };
}
