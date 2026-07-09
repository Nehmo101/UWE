"use client";

import { useEffect, useState } from "react";

const STORAGE_PREFIX = "uwe:image-studio:prompts:";

export function ImageStudioPromptHistory({ projectId }: { projectId: string }) {
  const storageKey = `${STORAGE_PREFIX}${projectId}`;
  const [history, setHistory] = useState<string[]>([]);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setHistory(parsed.filter((entry): entry is string => typeof entry === "string"));
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }, [storageKey]);

  function persist(entries: string[]) {
    setHistory(entries);
    localStorage.setItem(storageKey, JSON.stringify(entries.slice(0, 20)));
  }

  function saveDraft() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    const next = [trimmed, ...history.filter((entry) => entry !== trimmed)].slice(0, 20);
    persist(next);
    setDraft("");
  }

  function removeEntry(entry: string) {
    persist(history.filter((item) => item !== entry));
  }

  if (history.length === 0) {
    return (
      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Prompt-Verlauf (lokal)</h2>
        <p className="uwe-dashboard-muted">Noch keine Prompts gespeichert — füge einen hinzu.</p>
        <div className="uwe-inline-actions">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Prompt merken…"
            style={{ flex: 1 }}
          />
          <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm" onClick={saveDraft}>
            Speichern
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
      <h2 className="uwe-v2-section-title">Prompt-Verlauf (lokal)</h2>
      <ul className="uwe-dashboard-list">
        {history.map((entry) => (
          <li key={entry} className="uwe-inline-actions">
            <code style={{ flex: 1, whiteSpace: "pre-wrap" }}>{entry}</code>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
              onClick={() => removeEntry(entry)}
            >
              Entfernen
            </button>
          </li>
        ))}
      </ul>
      <div className="uwe-inline-actions" style={{ marginTop: "0.5rem" }}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Prompt merken…"
          style={{ flex: 1 }}
        />
        <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm" onClick={saveDraft}>
          Speichern
        </button>
      </div>
    </section>
  );
}
