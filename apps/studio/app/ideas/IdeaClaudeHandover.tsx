"use client";

import { useMemo, useState } from "react";
import {
  ideaAttachmentAbsoluteUrl,
  ideaAttachmentUrl,
  type IdeaAttachment,
} from "./IdeaAttachments";

const CLAUDE_URL = "https://claude.ai/new";

interface IdeaClaudeHandoverProps {
  title: string;
  body: string;
  prompt: string;
  attachments: IdeaAttachment[];
}

/** Assemble the Claude-ready handover text (task + absolute image URLs). */
export function buildClaudeHandover(
  title: string,
  body: string,
  prompt: string,
  attachments: IdeaAttachment[],
): string {
  const task = prompt.trim() || body.trim() || title.trim();
  const lines = ["# Aufgabe für Claude", "", task];
  if (attachments.length > 0) {
    lines.push("", "## Angehängte Bilder", "Diese Bilder gehören zur Aufgabe:");
    attachments.forEach((attachment, index) => {
      const label = attachment.title?.trim() || `Bild ${index + 1}`;
      lines.push(`- ${label}: ${ideaAttachmentAbsoluteUrl(attachment.assetId)}`);
    });
  }
  return lines.join("\n");
}

/**
 * "Übergabe an Claude" — packages the finished prompt plus attached images into a
 * Claude-ready handover: copy to clipboard, open claude.ai, and offer the images
 * for download so they can be dropped into the conversation. No API key required.
 */
export function IdeaClaudeHandover({ title, body, prompt, attachments }: IdeaClaudeHandoverProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handover = useMemo(
    () => buildClaudeHandover(title, body, prompt, attachments),
    [title, body, prompt, attachments],
  );

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(handover);
      setCopied(true);
      setError(null);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Kopieren nicht möglich — Text manuell markieren.");
    }
  }

  const disabled = handover.trim().length === 0;

  return (
    <div className="uwe-idea-claude-handover">
      <button
        type="button"
        className="uwe-v2-btn uwe-v2-btn-primary"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void copy();
        }}
        disabled={disabled}
        title="Prompt + Bilder Claude-fertig aufbereiten"
      >
        {open ? "Handover schließen" : "An Claude übergeben"}
      </button>

      {open ? (
        <div className="uwe-idea-claude-panel">
          <p className="uwe-dashboard-muted">
            Prompt {copied ? "in Zwischenablage kopiert" : "unten"} — in Claude einfügen. Bilder per
            Download in die Unterhaltung ziehen.
          </p>
          <textarea
            className="uwe-idea-prompt-text"
            value={handover}
            readOnly
            rows={10}
            aria-label="Claude-Handover-Text"
          />
          <div className="uwe-idea-prompt-actions">
            <button type="button" className="uwe-v2-btn uwe-v2-btn-ghost" onClick={() => void copy()}>
              {copied ? "Kopiert!" : "Prompt kopieren"}
            </button>
            <a
              className="uwe-v2-btn uwe-v2-btn-primary"
              href={CLAUDE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              In Claude öffnen ↗
            </a>
          </div>
          {error ? <p className="uwe-notice-warn">{error}</p> : null}
          {attachments.length > 0 ? (
            <ul className="uwe-idea-attachment-grid">
              {attachments.map((attachment, index) => (
                <li key={attachment.assetId} className="uwe-idea-attachment">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ideaAttachmentUrl(attachment.assetId)}
                    alt={attachment.title ?? `Anhang ${index + 1}`}
                    className="uwe-idea-attachment-image"
                  />
                  <a
                    className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm"
                    href={ideaAttachmentUrl(attachment.assetId)}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Bild herunterladen
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
