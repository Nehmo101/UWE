"use client";

import { useMemo, useState } from "react";
import { Alert, Button, buttonVariants, cn, Textarea } from "@/src/components/ui";
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
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) void copy();
        }}
        disabled={disabled}
        title="Prompt + Bilder Claude-fertig aufbereiten"
      >
        {open ? "Handover schließen" : "An Claude übergeben"}
      </Button>

      {open ? (
        <div className="flex flex-col gap-3 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">
            Prompt {copied ? "in Zwischenablage kopiert" : "unten"} — in Claude einfügen. Bilder per
            Download in die Unterhaltung ziehen.
          </p>
          <Textarea
            className="font-mono text-sm"
            value={handover}
            readOnly
            rows={10}
            aria-label="Claude-Handover-Text"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => void copy()}>
              {copied ? "Kopiert!" : "Prompt kopieren"}
            </Button>
            <a
              className={cn(buttonVariants())}
              href={CLAUDE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              In Claude öffnen ↗
            </a>
          </div>
          {error ? <Alert tone="danger">{error}</Alert> : null}
          {attachments.length > 0 ? (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-2">
              {attachments.map((attachment, index) => (
                <li key={attachment.assetId} className="flex flex-col items-start gap-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ideaAttachmentUrl(attachment.assetId)}
                    alt={attachment.title ?? `Anhang ${index + 1}`}
                    className="block max-h-40 w-full rounded-[var(--radius)] border border-border object-cover"
                  />
                  <a
                    className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
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
