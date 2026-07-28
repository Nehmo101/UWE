"use client";

import * as React from "react";
import { NavIcon, RtxStatusBadge, type RtxConnectorState } from "@uwe/shared-ui";
import { Avatar, Dot, ActionChip } from "./mail-ui";
import { CATEGORY_COLORS, CATEGORY_LABELS, type MailMessageVM } from "./mail-types";

interface MailTriageProps {
  messages: MailMessageVM[];
  rtxState: RtxConnectorState;
  onOpen: (id: string) => void;
  onReplyDraft: (id: string) => void;
  onTask: (id: string) => void;
  onCapture: (id: string) => void;
  onUnsubscribe: (id: string) => void;
}

export function MailTriage({ messages, rtxState, onOpen, onReplyDraft, onTask, onCapture, onUnsubscribe }: MailTriageProps) {
  const items = messages.filter((message) => message.priority);
  const degraded = rtxState !== "online";

  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: "var(--uwe-bg)" }}>
      <div style={{ padding: "20px 26px 16px", borderBottom: "1px solid var(--uwe-border-muted)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <NavIcon name="sparkles" width={20} height={20} style={{ color: "var(--uwe-accent)" }} />
          <h2 style={{ margin: 0, fontFamily: "var(--uwe-font-serif)", fontSize: 20, color: "var(--uwe-fg)" }}>
            KI-Triage
          </h2>
          <RtxStatusBadge state={rtxState} />
        </div>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--uwe-fg-muted)", lineHeight: 1.55, maxWidth: 640 }}>
          RTX fasst neue Nachrichten lokal zusammen und schlägt passende Aktionen vor. Nichts verlässt deinen Host —
          Läuft auf deinem RTX-Host — es gibt keinen Cloud-Anbieter mehr.
        </p>
        {degraded ? (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "9px 12px",
              border: "1px solid color-mix(in srgb, var(--uwe-warning) 45%, var(--uwe-border))",
              background: "color-mix(in srgb, var(--uwe-warning) 12%, transparent)",
              borderRadius: 10,
              fontSize: 12.5,
              color: "var(--uwe-fg)",
            }}
          >
            <NavIcon name="triangle-alert" width={15} height={15} style={{ color: "var(--uwe-warning)", flex: "none" }} />
            RTX nicht erreichbar — Triage pausiert. Neue Mails werden vorgemerkt.
          </div>
        ) : null}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--uwe-fg-subtle)" }}>
            <NavIcon name="sparkles" width={26} height={26} style={{ color: "var(--uwe-fg-subtle)" }} />
            <p style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.6 }}>
              Noch keine Nachrichten priorisiert. Öffne eine Nachricht im Posteingang und lasse sie von RTX
              zusammenfassen — die Ergebnisse erscheinen hier.
            </p>
          </div>
        ) : (
          items.map((message) => {
            const color = CATEGORY_COLORS[message.priority!.category];
            return (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "14px 16px",
                  border: "1px solid var(--uwe-border)",
                  borderRadius: 14,
                  background: "var(--uwe-card-bg)",
                  boxShadow: "var(--uwe-shadow-sm)",
                }}
              >
                <Avatar initials={message.senderName.slice(0, 2).toUpperCase()} color={color} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <button
                      type="button"
                      onClick={() => onOpen(message.id)}
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--uwe-fg)",
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer",
                      }}
                    >
                      {message.senderName}
                    </button>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        fontSize: 10.5,
                        color: "var(--uwe-fg-muted)",
                      }}
                    >
                      <Dot color={color} size={6} square />
                      {CATEGORY_LABELS[message.priority!.category]}
                    </span>
                  </div>
                  <div style={{ fontSize: 13.5, color: "var(--uwe-fg)", margin: "2px 0 5px", fontWeight: 500 }}>
                    {message.subject || "(Ohne Betreff)"}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "flex-start",
                      fontSize: 13,
                      color: "var(--uwe-fg-muted)",
                      lineHeight: 1.5,
                    }}
                  >
                    <NavIcon
                      name="sparkles"
                      width={13}
                      height={13}
                      style={{ color: "var(--uwe-accent)", marginTop: 3, flex: "none" }}
                    />
                    <span>{message.priority!.explanation || message.snippet || "Von RTX priorisiert."}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 11 }}>
                    {message.priority!.category === "newsletter" ? (
                      message.hasUnsubscribeTarget ? (
                        <ActionChip
                          icon="mail-x"
                          label="Newsletter abmelden"
                          primary
                          onClick={() => onUnsubscribe(message.id)}
                        />
                      ) : (
                        <ActionChip icon="list-todo" label="Als Aufgabe" onClick={() => onTask(message.id)} />
                      )
                    ) : (
                      <>
                        <ActionChip icon="sparkles" label="Antwort entwerfen" primary onClick={() => onReplyDraft(message.id)} />
                        <ActionChip icon="list-todo" label="Als Aufgabe" onClick={() => onTask(message.id)} />
                      </>
                    )}
                    <ActionChip icon="inbox" label="In Capture" onClick={() => onCapture(message.id)} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
