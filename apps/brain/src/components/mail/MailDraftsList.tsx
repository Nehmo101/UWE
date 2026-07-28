"use client";

import { MailButton } from "./mail-ui";
import { formatMailTime, type MailDraftVM } from "./mail-types";

interface MailDraftsListProps {
  drafts: MailDraftVM[];
  onCompose: () => void;
  onEditDraft: (draftId: string) => void;
  title: string;
}

export function MailDraftsList({ drafts, onCompose, onEditDraft, title }: MailDraftsListProps) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--uwe-border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 16, fontFamily: "var(--uwe-font-serif)" }}>{title}</h2>
        <span style={{ flex: 1 }} />
        <MailButton variant="accent" size="sm" icon="pen-line" onClick={onCompose}>
          Neuer Entwurf
        </MailButton>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {drafts.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--uwe-fg-subtle)", fontSize: 13 }}>
            Keine Entwürfe vorhanden.
          </div>
        ) : (
          drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => onEditDraft(draft.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "12px 18px",
                border: "none",
                borderBottom: "1px solid var(--uwe-border-muted)",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 14, color: "var(--uwe-fg)" }}>{draft.subject || "(Ohne Betreff)"}</div>
              <div style={{ fontSize: 11, color: "var(--uwe-fg-subtle)", marginTop: 4 }}>
                {draft.status} · {formatMailTime(draft.updatedAt)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
