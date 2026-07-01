import React from "react";

/** Page type vocabulary (subset of the product's PAGE_TYPE_LABELS). */
export const PAGE_TYPE_LABELS = {
  lore: "Lore",
  location: "Ort",
  region: "Region",
  npc: "NPC",
  faction: "Fraktion",
  item: "Gegenstand",
  dungeon: "Dungeon",
  room: "Raum",
  encounter: "Begegnung",
  quest: "Quest",
  session: "Session",
  handout: "Handout",
  rule: "Regel",
  monster: "Monster",
  map: "Karte",
  note: "Notiz",
};

/**
 * UWE PageTypeBadge — neutral badge naming a wiki page's entity type. Uses the
 * base --uwe-border fill (type badges are deliberately quiet).
 */
export function PageTypeBadge({ type = "note", style = {}, ...rest }) {
  return (
    <span
      data-type={type}
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: "var(--uwe-text-2xs)",
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "0.2rem 0.5rem",
        borderRadius: "var(--uwe-radius-sm)",
        background: "var(--uwe-border)",
        color: "var(--uwe-fg)",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...rest}
    >
      {PAGE_TYPE_LABELS[type] ?? type}
    </span>
  );
}
