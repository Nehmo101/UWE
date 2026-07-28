"use client";

import * as React from "react";
import { MAIL_REPLY_TONES, MAIL_REPLY_TONE_LABELS, type MailReplyTone } from "@uwe/mail/portal-types";
import { MailButton, IconButton } from "./mail-ui";
import type { MailAccountVM } from "./mail-types";
import { NavIcon } from "@uwe/shared-ui";

export interface ComposeContext {
  draftId?: string | null;
  messageId: string | null;
  accountId: string | null;
  to: string;
  subject: string;
  body: string;
}

interface MailComposeModalProps {
  context: ComposeContext;
  accounts: MailAccountVM[];
  onClose: () => void;
  onSent: () => void;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

export function MailComposeModal({ context, accounts, onClose, onSent }: MailComposeModalProps) {
  const [to, setTo] = React.useState(context.to);
  const [cc, setCc] = React.useState("");
  const [bcc, setBcc] = React.useState("");
  const [showCcBcc, setShowCcBcc] = React.useState(false);
  const [subject, setSubject] = React.useState(context.subject);
  const [body, setBody] = React.useState(context.body);
  const [accountId, setAccountId] = React.useState(context.accountId ?? accounts[0]?.id ?? "");
  const [draftId, setDraftId] = React.useState(context.draftId ?? null);
  const [tone, setTone] = React.useState<MailReplyTone>("friendly");
  const [attachments, setAttachments] = React.useState<
    Array<{ key: string; filename: string; contentType: string; sizeBytes: number }>
  >([]);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setTo(context.to);
    setCc("");
    setBcc("");
    setShowCcBcc(false);
    setSubject(context.subject);
    setBody(context.body);
    setAccountId(context.accountId ?? accounts[0]?.id ?? "");
    setDraftId(context.draftId ?? null);
    setAttachments([]);
  }, [accounts, context]);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setStatus(null);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const response = await fetch("/api/mail/attachments/upload", {
          method: "POST",
          body: form,
        });
        const data = (await response.json().catch(() => ({}))) as {
          attachment?: { key: string; filename: string; contentType: string; sizeBytes: number };
          error?: string;
        };
        if (!response.ok || !data.attachment) {
          setStatus(data.error ?? `Upload von ${file.name} fehlgeschlagen.`);
          continue;
        }
        setAttachments((current) => [...current, data.attachment!]);
      }
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const fromEmail = accounts.find((account) => account.id === accountId)?.email ?? "—";

  function parseRecipients(value: string) {
    return (value.match(EMAIL_RE) ?? []).map((email) => email);
  }

  async function persistDraft() {
    const recipients = parseRecipients(to);
    const payload = {
      subject: subject.trim() || "(Ohne Betreff)",
      bodyText: body,
      accountId: accountId || null,
      toAddresses: recipients.length > 0 ? recipients : null,
    };

    if (draftId) {
      const response = await fetch(`/api/mail/drafts/${draftId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Entwurf konnte nicht gespeichert werden.");
      }
      return draftId;
    }

    const response = await fetch("/api/mail/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json()) as { draft?: { id: string }; error?: string };
    if (!response.ok || !data.draft?.id) {
      throw new Error(data.error ?? "Entwurf konnte nicht angelegt werden.");
    }
    setDraftId(data.draft.id);
    return data.draft.id;
  }

  async function regenerate(nextTone: MailReplyTone) {
    setTone(nextTone);
    if (!context.messageId) return;
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/mail/ai/reply-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: context.messageId, tone: nextTone }),
      });
      const payload = (await response.json()) as { draft?: { bodyText: string | null; subject: string }; error?: string };
      if (!response.ok || !payload.draft) {
        setStatus(payload.error ?? "Entwurf fehlgeschlagen.");
        return;
      }
      if (payload.draft.bodyText) setBody(payload.draft.bodyText);
      if (payload.draft.subject) setSubject(payload.draft.subject);
    } catch {
      setStatus("Netzwerkfehler beim Entwurf.");
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    setBusy(true);
    setStatus(null);
    try {
      await persistDraft();
      setStatus("Entwurf gespeichert.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const recipients = parseRecipients(to);
    if (recipients.length === 0) {
      setStatus("Gültige Empfängeradresse erforderlich.");
      return;
    }
    if (!subject.trim()) {
      setStatus("Betreff erforderlich.");
      return;
    }
    if (!body.trim()) {
      setStatus("Nachrichtentext erforderlich.");
      return;
    }
    const ccRecipients = parseRecipients(cc);
    const bccRecipients = parseRecipients(bcc);
    const hasExtras = ccRecipients.length > 0 || bccRecipients.length > 0 || attachments.length > 0;
    setBusy(true);
    setStatus(null);
    try {
      const activeDraftId = await persistDraft();
      // Cc/Bcc/attachments are not stored on the draft record, so a send that
      // uses them must go through the direct path (full payload) instead of draftId.
      const useDraftPath = Boolean(activeDraftId) && !hasExtras;
      const response = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          useDraftPath
            ? { draftId: activeDraftId, confirm: true }
            : {
                accountId: accountId || undefined,
                to: recipients,
                cc: ccRecipients.length > 0 ? ccRecipients : undefined,
                bcc: bccRecipients.length > 0 ? bccRecipients : undefined,
                subject: subject.trim(),
                bodyText: body,
                attachments: attachments.map((a) => ({ key: a.key, filename: a.filename, contentType: a.contentType })),
                confirm: true,
              },
        ),
      });
      const text = await response.text();
      let payload: { ok?: boolean; error?: string };
      try {
        payload = JSON.parse(text) as { ok?: boolean; error?: string };
      } catch {
        setStatus(text.slice(0, 200) || `Versand fehlgeschlagen (HTTP ${response.status}).`);
        return;
      }
      if (!response.ok || !payload.ok) {
        setStatus(payload.error ?? "Versand fehlgeschlagen.");
        return;
      }
      onSent();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Netzwerkfehler beim Versand.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Neue Nachricht"
      style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(18,13,7,.44)", border: "none", cursor: "default" }}
      />
      <div
        style={{
          position: "relative",
          width: 730,
          maxWidth: "92%",
          maxHeight: "90vh",
          background: "var(--uwe-bg-elevated)",
          border: "1px solid var(--uwe-border)",
          borderRadius: 14,
          boxShadow: "0 34px 80px rgba(0,0,0,.55)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            background: "var(--uwe-panel)",
            borderBottom: "1px solid var(--uwe-border)",
          }}
        >
          <NavIcon name="pen-line" width={15} height={15} style={{ color: "var(--uwe-accent)" }} />
          <span style={{ fontFamily: "var(--uwe-font-serif)", fontSize: 15, color: "var(--uwe-fg)" }}>
            {draftId ? "Entwurf bearbeiten" : context.messageId ? "Antwort verfassen" : "Neue Nachricht"}
          </span>
          <span style={{ flex: 1 }} />
          <IconButton icon="minus" size={15} title="Minimieren" onClick={onClose} />
          <IconButton icon="x" size={16} title="Schließen" onClick={onClose} />
        </div>

        <div style={{ padding: "2px 16px" }}>
          <ComposeField label="An">
            <input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="name@example.com"
              style={composeInputStyle}
            />
            <button
              type="button"
              onClick={() => setShowCcBcc((current) => !current)}
              style={{
                fontSize: 12,
                color: showCcBcc ? "var(--uwe-fg)" : "var(--uwe-fg-subtle)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              Cc · Bcc
            </button>
          </ComposeField>
          {showCcBcc ? (
            <>
              <ComposeField label="Cc">
                <input
                  value={cc}
                  onChange={(event) => setCc(event.target.value)}
                  placeholder="cc@example.com"
                  style={composeInputStyle}
                />
              </ComposeField>
              <ComposeField label="Bcc">
                <input
                  value={bcc}
                  onChange={(event) => setBcc(event.target.value)}
                  placeholder="bcc@example.com"
                  style={composeInputStyle}
                />
              </ComposeField>
            </>
          ) : null}
          <ComposeField label="Betreff">
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Betreff"
              style={composeInputStyle}
            />
          </ComposeField>
          <ComposeField label="Von" noBorder>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12.5,
                color: "var(--uwe-fg)",
                border: "1px solid var(--uwe-border)",
                borderRadius: 8,
                padding: "4px 9px",
                background: "var(--uwe-card-bg)",
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--uwe-accent)" }} />
              {accounts.length > 1 ? (
                <select
                  value={accountId}
                  onChange={(event) => setAccountId(event.target.value)}
                  style={{ border: "none", background: "transparent", color: "var(--uwe-fg)", font: "inherit", fontSize: 12.5 }}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.email}
                    </option>
                  ))}
                </select>
              ) : (
                <>{fromEmail}</>
              )}
            </span>
          </ComposeField>
        </div>

        <div
          style={{
            margin: "6px 16px",
            display: "flex",
            alignItems: "center",
            gap: 9,
            flexWrap: "wrap",
            padding: "9px 12px",
            border: "1px solid color-mix(in srgb, var(--uwe-accent) 28%, var(--uwe-border))",
            background: "color-mix(in srgb, var(--uwe-accent) 7%, transparent)",
            borderRadius: 10,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--uwe-fg)" }}>
            <NavIcon name="sparkles" width={14} height={14} style={{ color: "var(--uwe-accent)" }} />
            KI-Antwort
          </span>
          {MAIL_REPLY_TONES.map((toneKey) => {
            const active = tone === toneKey;
            return (
              <button
                key={toneKey}
                type="button"
                disabled={busy || !context.messageId}
                onClick={() => void regenerate(toneKey)}
                title={context.messageId ? undefined : "Nur bei Antworten verfügbar"}
                style={{
                  fontSize: 11.5,
                  color: active ? "var(--uwe-fg)" : "var(--uwe-fg-muted)",
                  border: active
                    ? "1px solid var(--uwe-border)"
                    : "1px solid var(--uwe-border-muted)",
                  borderRadius: 999,
                  padding: "3px 10px",
                  background: active ? "var(--uwe-card-bg)" : "transparent",
                  cursor: context.messageId ? "pointer" : "not-allowed",
                  opacity: context.messageId ? 1 : 0.55,
                }}
              >
                {MAIL_REPLY_TONE_LABELS[toneKey]}
              </button>
            );
          })}
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--uwe-fg-subtle)" }}>Lokal · RTX</span>
        </div>

        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Nachricht schreiben…"
          style={{
            margin: "2px 4px",
            padding: "8px 14px 6px",
            fontFamily: "var(--mail-reader-font, var(--uwe-font-serif))",
            fontSize: 14.5,
            lineHeight: 1.65,
            color: "var(--uwe-fg)",
            background: "transparent",
            border: "none",
            outline: "none",
            resize: "none",
            minHeight: 150,
            flex: 1,
          }}
        />

        {attachments.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "4px 16px 8px" }}>
            {attachments.map((attachment) => (
              <span
                key={attachment.key}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12,
                  color: "var(--uwe-fg)",
                  border: "1px solid var(--uwe-border)",
                  borderRadius: 999,
                  padding: "3px 6px 3px 10px",
                  background: "var(--uwe-card-bg)",
                }}
              >
                <NavIcon name="paperclip" width={12} height={12} style={{ color: "var(--uwe-fg-muted)" }} />
                {attachment.filename}
                <IconButton
                  icon="x"
                  size={12}
                  title="Entfernen"
                  onClick={() => setAttachments((current) => current.filter((entry) => entry.key !== attachment.key))}
                />
              </span>
            ))}
          </div>
        ) : null}

        {status ? (
          <div style={{ padding: "0 16px 8px", fontSize: 12, color: "var(--uwe-danger)" }}>{status}</div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 16px",
            borderTop: "1px solid var(--uwe-border)",
            background: "var(--uwe-panel)",
          }}
        >
          <MailButton variant="accent" icon="send" onClick={() => void send()} disabled={busy}>
            {busy ? "…" : "Senden"}
          </MailButton>
          <MailButton variant="subtle" onClick={() => void saveDraft()} disabled={busy}>
            Speichern
          </MailButton>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            hidden
            onChange={(event) => void uploadFiles(event.target.files)}
          />
          <IconButton
            icon="paperclip"
            size={16}
            bordered
            title="Anhang hinzufügen"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
          />
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: "var(--uwe-fg-subtle)", display: "flex", alignItems: "center", gap: 6 }}>
            <NavIcon name="shield-check" width={13} height={13} />
            Lokal entworfen · verlässt den Host nicht
          </span>
          <IconButton icon="trash-2" size={16} bordered tone="danger" title="Verwerfen" onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

const composeInputStyle: React.CSSProperties = {
  flex: 1,
  fontSize: 13.5,
  color: "var(--uwe-fg)",
  background: "transparent",
  border: "none",
  outline: "none",
  fontFamily: "inherit",
};

function ComposeField({ label, children, noBorder }: { label: string; children: React.ReactNode; noBorder?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 2px",
        borderBottom: noBorder ? "none" : "1px solid var(--uwe-border-muted)",
      }}
    >
      <span style={{ width: 58, fontSize: 12, color: "var(--uwe-fg-subtle)" }}>{label}</span>
      {children}
    </div>
  );
}
