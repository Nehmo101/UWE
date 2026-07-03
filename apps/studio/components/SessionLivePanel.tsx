"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendSessionLiveEntryAction,
  deleteSessionLiveEntryAction,
  endSessionLiveModeAction,
  updateSessionLiveNotesAction,
} from "@/app/session-live-actions";

interface LinkedPage {
  id: string;
  title: string;
  href: string;
}

type LiveEntryKind = "note" | "loot" | "quest_update" | "npc_update" | "initiative" | "bookmark";

interface LiveEntryView {
  id: string;
  kind: LiveEntryKind;
  kindLabel: string;
  content: string;
  time: string;
  refHref: string | null;
  refTitle: string | null;
}

interface Props {
  worldSlug: string;
  sessionId: string;
  sessionTitle: string;
  initialNotes: string;
  linkedPages: LinkedPage[];
  entries: LiveEntryView[];
}

const ENTRY_KINDS: { value: LiveEntryKind; label: string; needsRef: boolean }[] = [
  { value: "note", label: "Notiz", needsRef: false },
  { value: "loot", label: "Beute", needsRef: true },
  { value: "quest_update", label: "Quest-Update", needsRef: true },
  { value: "npc_update", label: "NPC-Update", needsRef: true },
  { value: "initiative", label: "Initiative", needsRef: false },
  { value: "bookmark", label: "Lesezeichen", needsRef: false },
];

export function SessionLivePanel({
  worldSlug,
  sessionId,
  sessionTitle,
  initialNotes,
  linkedPages,
  entries,
}: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<LiveEntryKind>("note");
  const [content, setContent] = useState("");
  const [refPageId, setRefPageId] = useState("");
  const [startedAt] = useState(() => Date.now());
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedMinutes(Math.floor((Date.now() - startedAt) / 60_000));
    }, 30_000);
    return () => clearInterval(timer);
  }, [startedAt]);

  const elapsedLabel = useMemo(() => {
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}min` : `${minutes} min`;
  }, [elapsedMinutes]);

  const activeKind = useMemo(() => ENTRY_KINDS.find((k) => k.value === kind), [kind]);

  const scheduleSave = useCallback(
    (nextNotes: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateSessionLiveNotesAction({ worldSlug, sessionId, notes: nextNotes }).then(() => {
          setStatus("Automatisch gespeichert.");
        });
      }, 1200);
    },
    [sessionId, worldSlug],
  );

  const handleNotesChange = useCallback(
    (value: string) => {
      setNotes(value);
      scheduleSave(value);
    },
    [scheduleSave],
  );

  async function handleAddEntry() {
    const text = content.trim();
    if (!text) return;
    setBusy(true);
    setStatus(null);
    try {
      await appendSessionLiveEntryAction({
        worldSlug,
        sessionId,
        kind,
        content: text,
        refPageId: activeKind?.needsRef && refPageId ? refPageId : null,
      });
      setContent("");
      setRefPageId("");
      setStatus("Eintrag vorgemerkt.");
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Eintrag fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteEntry(entryId: string) {
    setBusy(true);
    try {
      await deleteSessionLiveEntryAction({ worldSlug, sessionId, entryId });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="uwe-session-live">
      <div className="uwe-stat-grid" style={{ marginBottom: "1rem" }}>
        <div className="uwe-stat-card">
          <span className="uwe-stat-value">{elapsedLabel}</span>
          <span className="uwe-stat-label">Live-Dauer</span>
        </div>
        <div className="uwe-stat-card">
          <span className="uwe-stat-value">{entries.length}</span>
          <span className="uwe-stat-label">Vorgemerkte Einträge</span>
        </div>
        <div className="uwe-stat-card">
          <span className="uwe-stat-value">{linkedPages.length}</span>
          <span className="uwe-stat-label">Verknüpfte Seiten</span>
        </div>
      </div>

      <p className="uwe-dashboard-muted">
        Live-Modus für {sessionTitle} — Einträge werden nur vorgemerkt. Am Ende
        („Live beenden“) prüfst du sie und übernimmst sie bewusst in den Kanon.
      </p>

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Ereignis vormerken</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
          <label>
            Typ
            <select value={kind} onChange={(event) => setKind(event.target.value as LiveEntryKind)}>
              {ENTRY_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {activeKind?.needsRef && linkedPages.length > 0 ? (
            <label>
              Seite
              <select value={refPageId} onChange={(event) => setRefPageId(event.target.value)}>
                <option value="">— keine —</option>
                {linkedPages.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label style={{ flex: "1 1 16rem" }}>
            Inhalt
            <input
              type="text"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleAddEntry();
                }
              }}
              placeholder="Was ist passiert?"
            />
          </label>
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-primary"
            disabled={busy || !content.trim()}
            onClick={() => void handleAddEntry()}
          >
            + Vormerken
          </button>
        </div>

        {entries.length > 0 ? (
          <ul className="uwe-linked-list" style={{ marginTop: "1rem" }}>
            {entries.map((entry) => (
              <li key={entry.id} style={{ display: "flex", gap: "0.5rem", alignItems: "baseline" }}>
                <span className="uwe-dashboard-muted">{entry.time}</span>
                <span className="uwe-badge">{entry.kindLabel}</span>
                <span style={{ flex: 1 }}>
                  {entry.content}
                  {entry.refHref ? (
                    <>
                      {" "}
                      <Link href={entry.refHref}>({entry.refTitle})</Link>
                    </>
                  ) : null}
                </span>
                <button
                  type="button"
                  className="uwe-v2-btn uwe-v2-btn-small"
                  disabled={busy}
                  onClick={() => void handleDeleteEntry(entry.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="uwe-dashboard-muted" style={{ marginTop: "0.75rem" }}>
            Noch keine Einträge vorgemerkt.
          </p>
        )}
      </section>

      <label>
        Freie Live-Notizen
        <textarea
          rows={10}
          value={notes}
          onChange={(event) => handleNotesChange(event.target.value)}
          placeholder="Fließtext, der nicht in einen Eintrag passt …"
        />
      </label>

      {status ? (
        <p className="uwe-notice" role="status">
          {status}
        </p>
      ) : null}

      <div className="uwe-form-actions">
        <Link href={`/worlds/${worldSlug}/sessions/${sessionId}`} className="uwe-v2-btn">
          Session-Detail
        </Link>
        <form action={endSessionLiveModeAction}>
          <input type="hidden" name="worldSlug" value={worldSlug} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Live beenden → Review
          </button>
        </form>
      </div>

      {linkedPages.length > 0 ? (
        <section className="uwe-v2-section">
          <h2 className="uwe-v2-section-title">Schnellzugriff</h2>
          <ul className="uwe-linked-list">
            {linkedPages.map((page) => (
              <li key={page.id}>
                <Link href={page.href}>{page.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
