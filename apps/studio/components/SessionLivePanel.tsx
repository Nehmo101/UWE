"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  appendSessionLiveNoteAction,
  endSessionLiveModeAction,
  updateSessionLiveNotesAction,
} from "@/app/session-live-actions";

interface LinkedPage {
  id: string;
  title: string;
  href: string;
}

interface Props {
  worldSlug: string;
  sessionId: string;
  sessionTitle: string;
  initialNotes: string;
  linkedPages: LinkedPage[];
}

const QUICK_LINES = [
  "Wichtiger Plot-Punkt",
  "NPC-Interaktion",
  "Spieler-Entscheidung",
  "Combat-Notiz",
  "Geheimnis enthüllt",
];

export function SessionLivePanel({
  worldSlug,
  sessionId,
  sessionTitle,
  initialNotes,
  linkedPages,
}: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
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

  const scheduleSave = useCallback(
    (nextNotes: string) => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
      }
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

  async function handleQuickLine(line: string) {
    setBusy(true);
    setStatus(null);
    try {
      const result = await appendSessionLiveNoteAction({ worldSlug, sessionId, line });
      setNotes(result.notes);
      setStatus(`Notiz hinzugefügt: ${line}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Notiz fehlgeschlagen.");
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
          <span className="uwe-stat-value">{linkedPages.length}</span>
          <span className="uwe-stat-label">Verknüpfte Seiten</span>
        </div>
      </div>

      <p className="uwe-dashboard-muted">
        Live-Modus für {sessionTitle} — Notizen werden in die Vorbereitungsnotizen der Session
        geschrieben (Auto-Save).
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
        {QUICK_LINES.map((line) => (
          <button
            key={line}
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            disabled={busy}
            onClick={() => void handleQuickLine(line)}
          >
            + {line}
          </button>
        ))}
      </div>

      <label>
        Live-Notizen
        <textarea
          rows={16}
          value={notes}
          onChange={(event) => handleNotesChange(event.target.value)}
          placeholder="Was passiert gerade am Tisch?"
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
            Live beenden → Gespielt
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
