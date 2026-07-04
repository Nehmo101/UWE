"use client";

import * as React from "react";
import { NavIcon } from "@/src/components/ui/icon";
import { RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";
import { MailButton, IconButton, Avatar, ActionChip } from "./mail-ui";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatBytes,
  formatMailFull,
  initialsFromName,
  type MailMessageDetailVM,
} from "./mail-types";

interface MailReaderProps {
  message: MailMessageDetailVM | null;
  loading: boolean;
  rtxState: RtxConnectorState;
  busy: boolean;
  onReply: () => void;
  onForward: () => void;
  onSummarize: () => void;
  onCapture: () => void;
  onTask: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function MailReader({
  message,
  loading,
  rtxState,
  busy,
  onReply,
  onForward,
  onSummarize,
  onCapture,
  onTask,
  onArchive,
  onDelete,
}: MailReaderProps) {
  if (!message) {
    return (
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: "var(--uwe-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 320, color: "var(--uwe-fg-subtle)" }}>
          <NavIcon name="mail-open" width={30} height={30} style={{ color: "var(--uwe-fg-subtle)" }} />
          <p style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.6 }}>
            {loading ? "Nachricht wird geladen…" : "Wähle eine Nachricht zum Lesen."}
          </p>
        </div>
      </div>
    );
  }

  const label = message.priority ? CATEGORY_LABELS[message.priority.category] : "Posteingang";
  const labelColor = message.priority ? CATEGORY_COLORS[message.priority.category] : "var(--uwe-fg-subtle)";
  const when = formatMailFull(message.receivedAt);
  const summary = message.aiActions.find((action) => action.kind === "summarize")?.outputText ?? null;
  const summaryLines = summary
    ? summary.split(/\n+/).map((line) => line.replace(/^[-•·]\s*/, "").trim()).filter(Boolean)
    : [];
  const recipient = message.toAddresses[0] ?? null;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: "var(--uwe-bg)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        opacity: loading ? 0.6 : 1,
        transition: "opacity .12s ease",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px 26px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 10.5,
                color: "var(--uwe-fg-muted)",
                marginBottom: 7,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 2, background: labelColor }} />
              {label}
            </div>
            <h2
              style={{
                margin: 0,
                fontFamily: "var(--uwe-font-serif)",
                fontSize: 22,
                lineHeight: 1.25,
                color: "var(--uwe-fg)",
              }}
            >
              {message.subject || "(Ohne Betreff)"}
            </h2>
          </div>
          <IconButton icon="star" tone="warning" title="Markieren" />
          <IconButton icon="more-horizontal" title="Weitere Aktionen" />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "15px 0 16px" }}>
          <Avatar initials={initialsFromName(message.senderName)} color={labelColor} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, color: "var(--uwe-fg)" }}>
              <strong>{message.senderName}</strong>{" "}
              <span style={{ color: "var(--uwe-fg-subtle)", fontSize: 12.5 }}>&lt;{message.fromAddress}&gt;</span>
            </div>
            {recipient ? (
              <div style={{ fontSize: 12, color: "var(--uwe-fg-muted)", marginTop: 1 }}>an {recipient}</div>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: "var(--uwe-fg-muted)", textAlign: "right", lineHeight: 1.4 }}>
            {when.date}
            <br />
            {when.time}
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 16 }}>
          <MailButton variant="accent" size="sm" icon="reply" onClick={onReply} disabled={busy}>
            Antworten
          </MailButton>
          <MailButton variant="secondary" size="sm" icon="forward" onClick={onForward} disabled={busy}>
            Weiterleiten
          </MailButton>
          <MailButton variant="subtle" size="sm" icon="inbox" onClick={onCapture} disabled={busy}>
            In Capture
          </MailButton>
          <MailButton variant="subtle" size="sm" icon="list-todo" onClick={onTask} disabled={busy}>
            Als Aufgabe
          </MailButton>
          <span style={{ flex: 1 }} />
          <IconButton icon="archive" size={15} bordered title="Archivieren" onClick={onArchive} disabled={busy} />
          <IconButton icon="trash-2" size={15} bordered tone="danger" title="Löschen" onClick={onDelete} disabled={busy} />
        </div>

        <div
          style={{
            border: "1px solid color-mix(in srgb, var(--uwe-info) 32%, var(--uwe-border))",
            background: "color-mix(in srgb, var(--uwe-info) 8%, var(--uwe-card-bg))",
            borderRadius: 14,
            padding: "13px 15px",
            marginBottom: 18,
            maxWidth: 620,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <NavIcon name="sparkles" width={16} height={16} style={{ color: "var(--uwe-accent)" }} />
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: ".05em",
                textTransform: "uppercase",
                color: "var(--uwe-fg)",
              }}
            >
              Von RTX lokal zusammengefasst
            </span>
            <span style={{ flex: 1 }} />
            <RtxStatusBadge state={rtxState} />
          </div>
          {summaryLines.length > 0 ? (
            <ul
              style={{
                margin: "0 0 11px",
                paddingLeft: 18,
                display: "flex",
                flexDirection: "column",
                gap: 4,
                fontSize: 13.5,
                color: "var(--uwe-fg)",
                lineHeight: 1.5,
              }}
            >
              {summaryLines.map((line, index) => (
                <li key={index}>{line}</li>
              ))}
            </ul>
          ) : (
            <p style={{ margin: "0 0 11px", fontSize: 13, color: "var(--uwe-fg-muted)", lineHeight: 1.55 }}>
              Noch keine Zusammenfassung. RTX kann diese Nachricht lokal zusammenfassen — nichts verlässt deinen
              Host.
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 9 }}>
            {summaryLines.length > 0 ? (
              <>
                <ActionChip icon="list-todo" label="Als Aufgabe" primary onClick={onTask} />
                <ActionChip icon="calendar-plus" label="In Kalender" onClick={onTask} />
                <ActionChip icon="sparkles" label="Antwort entwerfen" onClick={onReply} />
              </>
            ) : (
              <ActionChip icon="sparkles" label="Zusammenfassen" primary onClick={onSummarize} />
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--uwe-fg-subtle)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <NavIcon name="shield-check" width={13} height={13} />
            Cloud-KI erhält keinen Zugriff auf lokales Brain &amp; Weltwissen.
          </div>
        </div>

        <div
          style={{
            fontFamily: "var(--mail-reader-font, var(--uwe-font-serif))",
            fontSize: 15,
            lineHeight: 1.75,
            color: "var(--uwe-fg)",
            maxWidth: 600,
            whiteSpace: "pre-wrap",
          }}
        >
          {message.bodyText?.trim() || message.bodyHtml?.trim() || "Kein Inhalt synchronisiert."}
        </div>

        {message.attachments.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
            {message.attachments.map((attachment) => (
              <div
                key={attachment.id}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 11,
                  padding: "9px 13px",
                  border: "1px solid var(--uwe-border)",
                  borderRadius: 10,
                  background: "var(--uwe-card-bg)",
                }}
              >
                <NavIcon name="file-text" width={21} height={21} style={{ color: "var(--uwe-accent)" }} />
                <div>
                  <div style={{ fontSize: 12.5, color: "var(--uwe-fg)" }}>{attachment.filename}</div>
                  <div style={{ fontSize: 11, color: "var(--uwe-fg-subtle)" }}>
                    {attachment.mimeType.split("/")[1]?.toUpperCase() ?? "Datei"} · {formatBytes(attachment.sizeBytes)}
                  </div>
                </div>
                <NavIcon
                  name="download"
                  width={16}
                  height={16}
                  style={{ color: "var(--uwe-fg-muted)", marginLeft: 10 }}
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
