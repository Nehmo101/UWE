import React from "react";

/**
 * VISIBILITY_LABELS — the German visibility vocabulary from the product.
 * These strings appear verbatim across Studio & Portal.
 */
export const VISIBILITY_LABELS = {
  private: "Privat",
  dm_only: "Nur GM",
  player_visible: "Portal sichtbar",
  public: "Share-Link",
  specific_players: "Bestimmte Spieler",
  unlock_after_session: "Nach Session",
  archived: "Archiviert",
};

/**
 * UWE VisibilityBadge — signals whether content is DM-only, player-visible, or
 * shared. Central to UWE's player-safety model. `dm_only` = terracotta, and
 * `player_visible` = teal (the two brand semantics).
 */
export function VisibilityBadge({ visibility = "private", style = {}, ...rest }) {
  const tones = {
    dm_only: {
      background: "color-mix(in srgb, var(--uwe-dm-only) 15%, transparent)",
      color: "color-mix(in srgb, var(--uwe-dm-only) 78%, var(--uwe-fg) 22%)",
      borderColor: "color-mix(in srgb, var(--uwe-dm-only) 30%, transparent)",
    },
    player_visible: {
      background: "color-mix(in srgb, var(--uwe-player-visible) 14%, transparent)",
      color: "color-mix(in srgb, var(--uwe-player-visible) 82%, var(--uwe-fg) 18%)",
      borderColor: "color-mix(in srgb, var(--uwe-player-visible) 25%, transparent)",
    },
    public: {
      background: "color-mix(in srgb, var(--uwe-info) 12%, transparent)",
      color: "color-mix(in srgb, var(--uwe-info) 78%, var(--uwe-fg) 22%)",
      borderColor: "color-mix(in srgb, var(--uwe-info) 25%, transparent)",
    },
  };
  const tone = tones[visibility] ?? {
    background: "color-mix(in srgb, var(--uwe-card-bg) 80%, var(--uwe-bg) 20%)",
    color: "var(--uwe-fg-muted)",
    borderColor: "var(--uwe-border-muted)",
  };
  return (
    <span
      data-visibility={visibility}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.2rem",
        fontSize: "var(--uwe-text-2xs)",
        fontWeight: 600,
        letterSpacing: "0.02em",
        padding: "0.2rem 0.5rem",
        borderRadius: "var(--uwe-radius-sm)",
        border: "1px solid",
        whiteSpace: "nowrap",
        ...tone,
        ...style,
      }}
      {...rest}
    >
      {VISIBILITY_LABELS[visibility] ?? visibility}
    </span>
  );
}
