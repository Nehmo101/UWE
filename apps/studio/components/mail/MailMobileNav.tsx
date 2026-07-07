"use client";

import * as React from "react";
import { NavIcon } from "@/src/components/ui/icon";
import type {
  MailAccountVM,
  MailFolderKey,
  MailFolderVM,
  MailView,
} from "./mail-types";

/**
 * Mobile Navigation fürs Mail Center (< lg): die MailRail ist dort ausgeblendet,
 * Ordner-/Konto-Wechsel laufen über die Chip-Leiste und „Verfassen" über einen
 * eindeutigen Mail-FAB (statt des globalen Capture-„+", das wie ein
 * Compose-Button wirkte).
 */

export interface MobileMailBarProps {
  accounts: MailAccountVM[];
  folders: MailFolderVM[];
  view: MailView;
  activeFolder: MailFolderKey;
  triageCount: number;
  selectedAccountId: string | null;
  onSelectFolder: (folder: MailFolderKey) => void;
  onOpenTriage: () => void;
  onOpenSettings: () => void;
  onSelectAccount: (accountId: string | null) => void;
}

/** Kompakte Ordner-/Konto-Navigation für Viewports ohne die MailRail (< lg). */
export function MobileMailBar({
  accounts,
  folders,
  view,
  activeFolder,
  triageCount,
  selectedAccountId,
  onSelectFolder,
  onOpenTriage,
  onOpenSettings,
  onSelectAccount,
}: MobileMailBarProps) {
  const chipStyle = (active: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    flex: "none",
    padding: "6px 12px",
    borderRadius: 999,
    fontSize: 12.5,
    fontWeight: active ? 700 : 400,
    color: active ? "var(--uwe-fg)" : "var(--uwe-fg-muted)",
    background: active ? "color-mix(in srgb, var(--uwe-accent) 14%, transparent)" : "var(--uwe-card-bg)",
    border: active
      ? "1px solid color-mix(in srgb, var(--uwe-accent) 45%, var(--uwe-border))"
      : "1px solid var(--uwe-border)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderBottom: "1px solid var(--uwe-border)",
        background: "var(--uwe-bg-elevated)",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {accounts.length > 1 ? (
        <select
          aria-label="Konto wählen"
          value={selectedAccountId ?? "all"}
          onChange={(event) =>
            onSelectAccount(event.target.value === "all" ? null : event.target.value)
          }
          style={{
            flex: "none",
            maxWidth: 130,
            fontSize: 12.5,
            padding: "5px 8px",
            borderRadius: 8,
            border: "1px solid var(--uwe-border)",
            background: "var(--uwe-card-bg)",
            color: "var(--uwe-fg)",
          }}
        >
          <option value="all">Alle Konten</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.email}
            </option>
          ))}
        </select>
      ) : null}
      {folders.map((folder) => (
        <button
          key={folder.key}
          type="button"
          onClick={() => onSelectFolder(folder.key)}
          style={chipStyle(view !== "triage" && view !== "settings" && activeFolder === folder.key)}
        >
          <NavIcon name={folder.icon} width={13} height={13} />
          {folder.name}
          {folder.count ? <span style={{ fontSize: 11, opacity: 0.75 }}>{folder.count}</span> : null}
        </button>
      ))}
      <button type="button" onClick={onOpenTriage} style={chipStyle(view === "triage")}>
        <NavIcon name="sparkles" width={13} height={13} style={{ color: "var(--uwe-accent)" }} />
        KI-Triage
        {triageCount > 0 ? <span style={{ fontSize: 11, opacity: 0.75 }}>{triageCount}</span> : null}
      </button>
      <button type="button" onClick={onOpenSettings} style={chipStyle(view === "settings")}>
        <NavIcon name="settings" width={13} height={13} />
        Einstellungen
      </button>
    </div>
  );
}

/** Mobiler „Verfassen"-FAB — sichtbar nur < lg, wenn weder Compose noch Reader offen sind. */
export function MailComposeFab({ onCompose }: { onCompose: () => void }) {
  return (
    <button
      type="button"
      className="lg:hidden"
      aria-label="Neue E-Mail verfassen"
      title="Neue E-Mail verfassen"
      onClick={onCompose}
      style={{
        position: "absolute",
        right: 16,
        bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
        zIndex: 38,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 18px",
        height: "3.25rem",
        borderRadius: 999,
        border: "1px solid color-mix(in srgb, var(--uwe-fg) 15%, transparent)",
        background: "linear-gradient(135deg, var(--uwe-accent), var(--uwe-accent-hover))",
        color: "#fff",
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer",
        boxShadow: "0 8px 24px color-mix(in srgb, var(--uwe-accent) 45%, transparent)",
      }}
    >
      <NavIcon name="pen-line" width={17} height={17} />
      Verfassen
    </button>
  );
}
