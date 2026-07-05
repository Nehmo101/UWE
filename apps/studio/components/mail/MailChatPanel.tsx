"use client";

import * as React from "react";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { NavIcon } from "@/src/components/ui/icon";
import { RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";
import { MailButton, IconButton } from "./mail-ui";
import type { MailMessageDetailVM } from "./mail-types";
import type { MailChatMessage } from "@/src/lib/mail-chat-prompt";

interface MailChatPanelProps {
  message: MailMessageDetailVM;
  rtxState: RtxConnectorState;
  onClose: () => void;
  onActionComplete: () => void;
}

export function MailChatPanel({ message, rtxState, onClose, onActionComplete }: MailChatPanelProps) {
  const [messages, setMessages] = React.useState<MailChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<{
    action: "delete_by_sender" | "unsubscribe";
    label: string;
    senderPattern?: string;
    count?: number;
  } | null>(null);

  async function sendChat(nextMessages: MailChatMessage[]) {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch(studioApiUrl("/api/admin/mail/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          subject: message.subject,
          fromAddress: message.fromAddress,
          bodyText: message.bodyText,
          bodyHtml: message.bodyHtml,
          messages: nextMessages,
        }),
      });
      const payload = (await response.json()) as {
        text?: string;
        unavailable?: string;
        error?: string;
      };
      if (!response.ok) {
        setStatus(payload.error ?? payload.unavailable ?? "RTX-Anfrage fehlgeschlagen.");
        return;
      }
      if (payload.unavailable) {
        setStatus(payload.unavailable);
        return;
      }
      const assistantText = payload.text ?? "";
      setMessages([...nextMessages, { role: "assistant", content: assistantText }]);

      const lower = assistantText.toLowerCase();
      if (lower.includes("lösch") && lower.includes("mail")) {
        setPendingAction({
          action: "delete_by_sender",
          label: `Alle Mails von ${message.fromAddress} löschen?`,
          senderPattern: message.fromAddress,
        });
      } else if (lower.includes("abmelden") || lower.includes("newsletter")) {
        setPendingAction({
          action: "unsubscribe",
          label: "Von diesem Newsletter abmelden?",
        });
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Netzwerkfehler.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    await sendChat(next);
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setBusy(true);
    try {
      const body =
        pendingAction.action === "delete_by_sender"
          ? {
              action: "delete_by_sender",
              senderPattern: pendingAction.senderPattern ?? message.fromAddress,
              accountId: message.accountId,
              confirm: true,
            }
          : { action: "unsubscribe", messageId: message.id };
      const response = await fetch(studioApiUrl("/api/admin/mail/actions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string; deleted?: number };
      if (!response.ok) {
        setStatus(payload.error ?? "Aktion fehlgeschlagen.");
        return;
      }
      setPendingAction(null);
      setStatus(
        pendingAction.action === "delete_by_sender"
          ? `${payload.deleted ?? 0} Nachrichten gelöscht.`
          : "Abmeldung ausgeführt.",
      );
      onActionComplete();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        width: 320,
        borderLeft: "1px solid var(--uwe-border)",
        background: "var(--uwe-bg-elevated)",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderBottom: "1px solid var(--uwe-border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <NavIcon name="message-circle" width={16} height={16} style={{ color: "var(--uwe-accent)" }} />
        <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>RTX Mail-Assistent</span>
        <RtxStatusBadge state={rtxState} />
        <IconButton icon="x" size={16} title="Schließen" onClick={onClose} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {messages.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--uwe-fg-muted)", lineHeight: 1.55 }}>
            Frag RTX z. B.: „Lösche alle Mails von diesem Absender“ oder „Melde mich vom Newsletter ab“.
          </p>
        ) : null}
        {messages.map((entry, index) => (
          <div
            key={index}
            style={{
              alignSelf: entry.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "90%",
              padding: "8px 10px",
              borderRadius: 10,
              fontSize: 12.5,
              lineHeight: 1.5,
              background:
                entry.role === "user"
                  ? "color-mix(in srgb, var(--uwe-accent) 18%, transparent)"
                  : "var(--uwe-card-bg)",
              color: "var(--uwe-fg)",
            }}
          >
            {entry.content}
          </div>
        ))}
      </div>

      {pendingAction ? (
        <div style={{ padding: "0 12px 8px" }}>
          <div style={{ fontSize: 12, marginBottom: 8, color: "var(--uwe-fg)" }}>{pendingAction.label}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <MailButton variant="accent" size="sm" onClick={() => void confirmAction()} disabled={busy}>
              Bestätigen
            </MailButton>
            <MailButton variant="subtle" size="sm" onClick={() => setPendingAction(null)}>
              Abbrechen
            </MailButton>
          </div>
        </div>
      ) : null}

      {status ? (
        <div style={{ padding: "0 12px 8px", fontSize: 11.5, color: "var(--uwe-fg-muted)" }}>{status}</div>
      ) : null}

      <div style={{ padding: 12, borderTop: "1px solid var(--uwe-border)", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Aufgabe an RTX…"
          disabled={busy}
          style={{
            flex: 1,
            border: "1px solid var(--uwe-border)",
            borderRadius: 8,
            padding: "8px 10px",
            fontSize: 12.5,
            background: "var(--uwe-card-bg)",
            color: "var(--uwe-fg)",
          }}
        />
        <MailButton variant="accent" size="sm" onClick={() => void submit()} disabled={busy || !input.trim()}>
          Senden
        </MailButton>
      </div>
    </div>
  );
}
