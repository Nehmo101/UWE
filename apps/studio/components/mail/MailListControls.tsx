"use client";

import * as React from "react";
import { NavIcon } from "@/src/components/ui/icon";
import { IconButton } from "./mail-ui";
import type { MailBulkAction } from "./use-mail-actions";

/** Sort orders offered by the list filter menu. */
export type MailSort = "newest" | "oldest" | "unread" | "sender";

/** Boolean facets applied on top of the folder/tab filtering. */
export interface MailFacets {
  withAttachment: boolean;
  newsletter: boolean;
}

export const DEFAULT_SORT: MailSort = "newest";
export const DEFAULT_FACETS: MailFacets = { withAttachment: false, newsletter: false };

/**
 * Controlled search box with its own local text state so typing survives the
 * periodic `router.refresh()` the Mail Center fires during a sync (an
 * uncontrolled `defaultValue` input loses its text on those re-renders).
 * Searches as you type (debounced) and on Enter; Escape / the × button clears.
 */
export function MailSearchInput({
  initialValue,
  onSearch,
}: {
  initialValue: string;
  onSearch: (query: string) => void;
}) {
  const [text, setText] = React.useState(initialValue);
  const focusedRef = React.useRef(false);

  // Reflect external navigation (folder switch resets ?q=) — but never while the
  // user is actively typing, so their input is never yanked out from under them.
  React.useEffect(() => {
    if (!focusedRef.current) setText(initialValue);
  }, [initialValue]);

  React.useEffect(() => {
    if (text.trim() === initialValue.trim()) return;
    const timer = window.setTimeout(() => onSearch(text.trim()), 450);
    return () => window.clearTimeout(timer);
  }, [text, initialValue, onSearch]);

  const clear = () => {
    setText("");
    onSearch("");
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        type="search"
        data-mail-search
        className="h-9 rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm"
        placeholder="Betreff, Absender, Inhalt, from: has:attachment…"
        value={text}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
        }}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSearch(text.trim());
          if (event.key === "Escape" && text) clear();
        }}
        aria-label="Mail durchsuchen"
        style={{ paddingRight: text ? 32 : undefined }}
      />
      {text ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Suche leeren"
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            display: "inline-flex",
            border: "none",
            background: "transparent",
            color: "var(--uwe-fg-subtle)",
            cursor: "pointer",
            padding: 2,
          }}
        >
          <NavIcon name="x" width={14} height={14} />
        </button>
      ) : null}
    </div>
  );
}

function MenuRow({
  active,
  label,
  icon,
  onClick,
  kind,
}: {
  active: boolean;
  label: string;
  icon: string;
  onClick: () => void;
  kind: "radio" | "check";
}) {
  return (
    <button
      type="button"
      role={kind === "radio" ? "menuitemradio" : "menuitemcheckbox"}
      aria-checked={active}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        width: "100%",
        textAlign: "left",
        padding: "6px 8px",
        borderRadius: 8,
        border: "none",
        background: active ? "color-mix(in srgb, var(--uwe-accent) 12%, transparent)" : "transparent",
        color: "var(--uwe-fg)",
        fontSize: 12.5,
        cursor: "pointer",
      }}
    >
      <NavIcon
        name={icon}
        width={14}
        height={14}
        style={{ color: active ? "var(--uwe-accent)" : "var(--uwe-fg-subtle)", flex: "none" }}
      />
      <span style={{ flex: 1 }}>{label}</span>
      {active ? <NavIcon name="check" width={14} height={14} style={{ color: "var(--uwe-accent)" }} /> : null}
    </button>
  );
}

/** The (previously dead) sliders button — now a popover for sort order + facets. */
export function MailFilterMenu({
  sort,
  onSort,
  facets,
  onFacets,
}: {
  sort: MailSort;
  onSort: (sort: MailSort) => void;
  facets: MailFacets;
  onFacets: (facets: MailFacets) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeCount =
    (sort !== DEFAULT_SORT ? 1 : 0) + (facets.withAttachment ? 1 : 0) + (facets.newsletter ? 1 : 0);

  const sortOptions: Array<{ key: MailSort; label: string; icon: string }> = [
    { key: "newest", label: "Neueste zuerst", icon: "arrow-down-wide-narrow" },
    { key: "oldest", label: "Älteste zuerst", icon: "arrow-up-wide-narrow" },
    { key: "unread", label: "Ungelesen zuerst", icon: "mail" },
    { key: "sender", label: "Absender (A–Z)", icon: "arrow-down-a-z" },
  ];

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      <IconButton
        icon="sliders-horizontal"
        size={15}
        title="Filter & Sortierung"
        tone={activeCount > 0 ? "accent" : "muted"}
        onClick={() => setOpen((value) => !value)}
        style={
          activeCount > 0
            ? { background: "color-mix(in srgb, var(--uwe-accent) 14%, transparent)" }
            : undefined
        }
      />
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 30,
            width: 236,
            background: "var(--uwe-card-bg)",
            border: "1px solid var(--uwe-border)",
            borderRadius: 12,
            boxShadow: "var(--uwe-shadow-md, 0 10px 30px rgba(0,0,0,.25))",
            padding: "9px 10px",
          }}
        >
          <div style={eyebrow}>Sortierung</div>
          {sortOptions.map((option) => (
            <MenuRow
              key={option.key}
              kind="radio"
              active={sort === option.key}
              label={option.label}
              icon={option.icon}
              onClick={() => onSort(option.key)}
            />
          ))}
          <div style={{ ...eyebrow, marginTop: 8 }}>Nur anzeigen</div>
          <MenuRow
            kind="check"
            active={facets.withAttachment}
            label="Mit Anhang"
            icon="paperclip"
            onClick={() => onFacets({ ...facets, withAttachment: !facets.withAttachment })}
          />
          <MenuRow
            kind="check"
            active={facets.newsletter}
            label="Newsletter (abmeldbar)"
            icon="mail-x"
            onClick={() => onFacets({ ...facets, newsletter: !facets.newsletter })}
          />
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => {
                onSort(DEFAULT_SORT);
                onFacets(DEFAULT_FACETS);
              }}
              style={{
                marginTop: 8,
                width: "100%",
                padding: "6px 8px",
                borderRadius: 8,
                border: "1px solid var(--uwe-border)",
                background: "transparent",
                color: "var(--uwe-fg-muted)",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Zurücksetzen
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const eyebrow: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: ".1em",
  textTransform: "uppercase",
  color: "var(--uwe-fg-subtle)",
  padding: "4px 6px 3px",
};

/** Bulk-action toolbar shown while one or more messages are selected. */
export function MailBulkBar({
  count,
  allSelected,
  hasNewsletter,
  busy,
  onSelectAll,
  onClear,
  onAction,
}: {
  count: number;
  allSelected: boolean;
  hasNewsletter: boolean;
  busy: boolean;
  onSelectAll: () => void;
  onClear: () => void;
  onAction: (action: MailBulkAction) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 12px",
        borderBottom: "1px solid var(--uwe-border-muted)",
        background: "color-mix(in srgb, var(--uwe-accent) 9%, var(--uwe-bg))",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={onSelectAll}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          border: "none",
          background: "transparent",
          color: "var(--uwe-fg)",
          fontSize: 12.5,
          fontWeight: 600,
          cursor: "pointer",
          padding: "2px 4px",
        }}
      >
        <NavIcon name={allSelected ? "square-check-big" : "square"} width={16} height={16} />
        {count} ausgewählt
      </button>
      <span style={{ flex: 1 }} />
      <IconButton icon="mail-open" size={15} title="Als gelesen" onClick={() => onAction("read")} disabled={busy} />
      <IconButton icon="mail" size={15} title="Als ungelesen" onClick={() => onAction("unread")} disabled={busy} />
      <IconButton icon="star" size={15} title="Markieren" onClick={() => onAction("star")} disabled={busy} />
      <IconButton icon="archive" size={15} title="Archivieren" onClick={() => onAction("archive")} disabled={busy} />
      {hasNewsletter ? (
        <IconButton
          icon="mail-x"
          size={15}
          tone="accent"
          title="Newsletter abmelden"
          onClick={() => onAction("unsubscribe")}
          disabled={busy}
        />
      ) : null}
      <IconButton
        icon="trash-2"
        size={15}
        tone="danger"
        title="In den Papierkorb"
        onClick={() => onAction("trash")}
        disabled={busy}
      />
      <IconButton icon="x" size={15} title="Auswahl aufheben" onClick={onClear} />
    </div>
  );
}
