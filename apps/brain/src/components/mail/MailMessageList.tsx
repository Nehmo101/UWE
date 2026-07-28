"use client";

import * as React from "react";
import { Avatar, Dot, IconButton } from "./mail-ui";
import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  formatMailTime,
  type MailMessageVM,
} from "./mail-types";
import {
  MailSearchInput,
  MailFilterMenu,
  MailBulkBar,
  DEFAULT_SORT,
  DEFAULT_FACETS,
  type MailSort,
  type MailFacets,
} from "./MailListControls";
import type { MailBulkAction } from "./use-mail-actions";
import { NavIcon } from "@uwe/shared-ui";

export type MailListFilter = "alle" | "ungelesen" | "markiert";

interface MailMessageListProps {
  messages: MailMessageVM[];
  selectedId: string | null;
  filter: MailListFilter;
  onFilter: (filter: MailListFilter) => void;
  onSelect: (id: string) => void;
  onSync: () => void;
  syncing: boolean;
  title: string;
  searchQuery?: string;
  onSearch?: (query: string) => void;
  // Multi-select (owned by MailCenter so bulk actions can reach the action hook).
  selectedIds: Set<string>;
  selectionMode: boolean;
  busy: boolean;
  onToggleSelectionMode: () => void;
  onToggleSelect: (id: string) => void;
  onSelectVisible: (ids: string[]) => void;
  onClearSelection: () => void;
  onBulkAction: (action: MailBulkAction) => void;
}

function isMarked(message: MailMessageVM): boolean {
  return (message.priority?.priority ?? 0) >= 70;
}

function receivedTime(message: MailMessageVM): number {
  return new Date(message.receivedAt).getTime();
}

function sortMessages(list: MailMessageVM[], sort: MailSort): MailMessageVM[] {
  const copy = [...list];
  switch (sort) {
    case "oldest":
      return copy.sort((a, b) => receivedTime(a) - receivedTime(b));
    case "unread":
      return copy.sort(
        (a, b) => Number(a.isRead) - Number(b.isRead) || receivedTime(b) - receivedTime(a),
      );
    case "sender":
      return copy.sort(
        (a, b) =>
          a.senderName.localeCompare(b.senderName, "de", { sensitivity: "base" }) ||
          receivedTime(b) - receivedTime(a),
      );
    case "newest":
    default:
      return copy.sort((a, b) => receivedTime(b) - receivedTime(a));
  }
}

export function MailMessageList({
  messages,
  selectedId,
  filter,
  onFilter,
  onSelect,
  onSync,
  syncing,
  title,
  searchQuery = "",
  onSearch,
  selectedIds,
  selectionMode,
  busy,
  onToggleSelectionMode,
  onToggleSelect,
  onSelectVisible,
  onClearSelection,
  onBulkAction,
}: MailMessageListProps) {
  const [sort, setSort] = React.useState<MailSort>(DEFAULT_SORT);
  const [facets, setFacets] = React.useState<MailFacets>(DEFAULT_FACETS);

  const unreadCount = messages.filter((m) => !m.isRead).length;

  const filtered = React.useMemo(() => {
    let list = messages.filter((message) => {
      if (filter === "ungelesen") return !message.isRead;
      if (filter === "markiert") return isMarked(message);
      return true;
    });
    if (facets.withAttachment) list = list.filter((m) => m.hasAttachments);
    if (facets.newsletter) list = list.filter((m) => m.hasUnsubscribeTarget);
    return sortMessages(list, sort);
  }, [messages, filter, facets, sort]);

  const filteredIds = React.useMemo(() => filtered.map((m) => m.id), [filtered]);
  const selectionCount = selectedIds.size;
  const showChecks = selectionMode || selectionCount > 0;
  const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const hasNewsletterSelected = filtered.some((m) => selectedIds.has(m.id) && m.hasUnsubscribeTarget);

  const tabs: Array<{ key: MailListFilter; label: string }> = [
    { key: "alle", label: "Alle" },
    { key: "ungelesen", label: `Ungelesen · ${unreadCount}` },
    { key: "markiert", label: "Markiert" },
  ];

  return (
    <div
      style={{
        width: "100%",
        borderRight: "1px solid var(--uwe-border)",
        display: "flex",
        flexDirection: "column",
        background: "var(--uwe-bg)",
        minHeight: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "14px 16px 12px",
          borderBottom: "1px solid var(--uwe-border)",
        }}
      >
        <h2 style={{ margin: 0, fontFamily: "var(--uwe-font-serif)", fontSize: 17, color: "var(--uwe-fg)" }}>
          {title}
        </h2>
        <span
          style={{
            fontSize: 11,
            color: "var(--uwe-fg-subtle)",
            background: "color-mix(in srgb, var(--uwe-fg) 8%, transparent)",
            padding: "2px 7px",
            borderRadius: 999,
          }}
        >
          {messages.length}
        </span>
        <span style={{ flex: 1 }} />
        <IconButton
          icon="list-checks"
          size={15}
          title="Mehrfachauswahl"
          tone={showChecks ? "accent" : "muted"}
          onClick={onToggleSelectionMode}
          style={showChecks ? { background: "color-mix(in srgb, var(--uwe-accent) 14%, transparent)" } : undefined}
        />
        <IconButton
          icon="refresh-cw"
          size={15}
          title="IMAP synchronisieren"
          onClick={onSync}
          disabled={syncing}
          style={syncing ? { opacity: 0.5, cursor: "wait" } : undefined}
        />
        <MailFilterMenu sort={sort} onSort={setSort} facets={facets} onFacets={setFacets} />
      </div>

      {onSearch ? (
        <div style={{ padding: "0 12px 10px", borderBottom: "1px solid var(--uwe-border-muted)" }}>
          <MailSearchInput initialValue={searchQuery} onSearch={onSearch} />
        </div>
      ) : null}

      {showChecks && selectionCount > 0 ? (
        <MailBulkBar
          count={selectionCount}
          allSelected={allSelected}
          hasNewsletter={hasNewsletterSelected}
          busy={busy}
          onSelectAll={() => (allSelected ? onClearSelection() : onSelectVisible(filteredIds))}
          onClear={onClearSelection}
          onAction={onBulkAction}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "9px 14px",
            borderBottom: "1px solid var(--uwe-border-muted)",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              gap: 2,
              background: "color-mix(in srgb, var(--uwe-fg) 6%, transparent)",
              borderRadius: 8,
              padding: 2,
            }}
          >
            {tabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onFilter(tab.key)}
                  style={{
                    padding: "3px 11px",
                    borderRadius: 6,
                    fontSize: 11.5,
                    border: "none",
                    cursor: "pointer",
                    fontWeight: active ? 700 : 400,
                    background: active ? "var(--uwe-card-bg)" : "transparent",
                    color: active ? "var(--uwe-fg)" : "var(--uwe-fg-muted)",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "28px 20px", textAlign: "center", fontSize: 13, color: "var(--uwe-fg-subtle)" }}>
            {messages.length === 0
              ? "Noch keine Nachrichten — IMAP-Sync starten."
              : "Keine Nachrichten in dieser Ansicht."}
          </div>
        ) : (
          filtered.map((message) => {
            const selected = selectedId === message.id;
            const checked = selectedIds.has(message.id);
            const labelColor = message.priority ? CATEGORY_COLORS[message.priority.category] : "var(--uwe-fg-subtle)";
            const labelName = message.priority ? CATEGORY_LABELS[message.priority.category] : message.accountLabel;
            const highlighted = selected || checked;
            return (
              <div
                key={message.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(message.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(message.id);
                  }
                }}
                style={{
                  display: "flex",
                  width: "100%",
                  textAlign: "left",
                  gap: 11,
                  alignItems: "flex-start",
                  padding: "12px 15px",
                  borderBottom: "1px solid var(--uwe-border-muted)",
                  borderLeft: `3px solid ${selected ? "var(--uwe-accent)" : "transparent"}`,
                  cursor: "pointer",
                  background: highlighted
                    ? "color-mix(in srgb, var(--uwe-accent) 10%, var(--uwe-bg))"
                    : "transparent",
                }}
              >
                {showChecks ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleSelect(message.id);
                    }}
                    aria-label={checked ? "Auswahl entfernen" : "Auswählen"}
                    aria-pressed={checked}
                    style={{
                      flex: "none",
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "none",
                      background: "transparent",
                      color: checked ? "var(--uwe-accent)" : "var(--uwe-fg-subtle)",
                      cursor: "pointer",
                    }}
                  >
                    <NavIcon name={checked ? "square-check-big" : "square"} width={20} height={20} />
                  </button>
                ) : (
                  <Avatar initials={message.senderName.slice(0, 2).toUpperCase()} color={labelColor} size={34} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: 999,
                        background: "var(--uwe-accent)",
                        flex: "none",
                        visibility: message.isRead ? "hidden" : "visible",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: message.isRead ? 500 : 700,
                        color: message.isRead ? "var(--uwe-fg-muted)" : "var(--uwe-fg)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {message.senderName}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: 11, color: "var(--uwe-fg-subtle)", whiteSpace: "nowrap" }}>
                      {formatMailTime(message.receivedAt)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: message.isRead ? 400 : 600,
                      color: message.isRead ? "var(--uwe-fg-muted)" : "var(--uwe-fg)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      margin: "1px 0",
                    }}
                  >
                    {message.subject || "(Ohne Betreff)"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--uwe-fg-subtle)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {message.snippet ?? ""}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 3 }}>
                    {labelName ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 10.5,
                          color: "var(--uwe-fg-muted)",
                        }}
                      >
                        <Dot color={labelColor} size={6} square />
                        {labelName}
                      </span>
                    ) : null}
                    {message.hasAttachments ? (
                      <NavIcon name="paperclip" width={12} height={12} style={{ color: "var(--uwe-fg-subtle)" }} />
                    ) : null}
                    {message.priority ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10,
                          color: "var(--uwe-accent)",
                        }}
                      >
                        <NavIcon name="sparkles" width={11} height={11} />
                        Triage
                      </span>
                    ) : null}
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
