"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { activateAiGeneralPromptAction } from "../ai-prompt-actions";

const DRAFT_STORAGE_KEY = "uwe-ai-general-chat-prompt-draft";

interface Props {
  activePrompt: string;
  activated?: boolean;
  legacyAiHref: string;
}

export function AiPromptEditorClient({ activePrompt, activated, legacyAiHref }: Props) {
  const [draft, setDraft] = useState(activePrompt);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (stored != null) setDraft(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(DRAFT_STORAGE_KEY, draft);
    } catch {
      // ignore
    }
  }, [draft]);

  const hasUnsavedDraft = draft.trim() !== activePrompt.trim();

  return (
    <div className="uwe-v2-section">
      {activated ? (
        <p className="uwe-inspector-ok" role="status">
          ✓ System-Prompt aktiviert.
        </p>
      ) : null}

      <p className="uwe-hint">
        Entwurf wird lokal zwischengespeichert. Erst <strong>Als aktiv setzen</strong> übernimmt den
        Prompt für den allgemeinen KI-Chat.{" "}
        <Link href={legacyAiHref}>KI-Chat testen →</Link>
      </p>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Aktiver System-Prompt</h2>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            padding: "0.75rem",
            borderRadius: "6px",
            background: "var(--uwe-code-bg, rgba(0,0,0,0.05))",
            minHeight: "4rem",
          }}
        >
          {activePrompt.trim() || "— Standard-Prompt (eingebaut) —"}
        </pre>
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Entwurf bearbeiten</h2>
        <label>
          System-Prompt (general chat)
          <textarea
            rows={12}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Anweisungen für den allgemeinen KI-Chat…"
            style={{ width: "100%", fontFamily: "monospace" }}
          />
        </label>
        <div className="uwe-form-actions">
          <button
            type="button"
            className="uwe-v2-btn uwe-v2-btn-secondary"
            onClick={() => setDraft(activePrompt)}
          >
            Entwurf zurücksetzen
          </button>
          <form action={activateAiGeneralPromptAction}>
            <input type="hidden" name="prompt" value={draft} />
            <button
              type="submit"
              className="uwe-v2-btn uwe-v2-btn-primary"
              disabled={!hasUnsavedDraft && !draft.trim()}
            >
              Als aktiv setzen
            </button>
          </form>
        </div>
        {hasUnsavedDraft ? (
          <p className="uwe-notice-warn" role="status">
            Entwurf weicht vom aktiven Prompt ab — noch nicht live.
          </p>
        ) : null}
      </section>
    </div>
  );
}
