/* @ds-bundle: {"format":3,"namespace":"UWEDesignSystem_f43eab","components":[{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"EmptyState","sourcePath":"components/core/EmptyState.jsx"},{"name":"StatCard","sourcePath":"components/core/StatCard.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"PAGE_TYPE_LABELS","sourcePath":"components/domain/PageTypeBadge.jsx"},{"name":"PageTypeBadge","sourcePath":"components/domain/PageTypeBadge.jsx"},{"name":"RTX_STATE_LABELS","sourcePath":"components/domain/RtxStatusBadge.jsx"},{"name":"RtxStatusBadge","sourcePath":"components/domain/RtxStatusBadge.jsx"},{"name":"SecretReveal","sourcePath":"components/domain/SecretReveal.jsx"},{"name":"VISIBILITY_LABELS","sourcePath":"components/domain/VisibilityBadge.jsx"},{"name":"VisibilityBadge","sourcePath":"components/domain/VisibilityBadge.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Textarea","sourcePath":"components/forms/Textarea.jsx"},{"name":"Brand","sourcePath":"components/navigation/Brand.jsx"},{"name":"Breadcrumb","sourcePath":"components/navigation/Breadcrumb.jsx"},{"name":"PageHeader","sourcePath":"components/navigation/PageHeader.jsx"},{"name":"SidebarNav","sourcePath":"components/navigation/SidebarNav.jsx"}],"sourceHashes":{"components/core/Badge.jsx":"6334a3bf6114","components/core/Button.jsx":"2d853cb3b4ee","components/core/Card.jsx":"ae80f0fb6204","components/core/EmptyState.jsx":"7e1fe61f2179","components/core/StatCard.jsx":"61db12f1fce0","components/core/Tag.jsx":"f97bff6cd24a","components/domain/PageTypeBadge.jsx":"f569fbbbaf96","components/domain/RtxStatusBadge.jsx":"695ba893a468","components/domain/SecretReveal.jsx":"8c4a5dd37fe3","components/domain/VisibilityBadge.jsx":"1d369f723da5","components/forms/Input.jsx":"a667743d0189","components/forms/Select.jsx":"d01b28388c83","components/forms/Textarea.jsx":"ac35f88cb2cd","components/navigation/Brand.jsx":"3bebbcb82334","components/navigation/Breadcrumb.jsx":"68b1f3222890","components/navigation/PageHeader.jsx":"08c7aeb78f6d","components/navigation/SidebarNav.jsx":"1e6cd2311b0d","ui_kits/portal/screens.jsx":"29a5e4be3af6","ui_kits/studio/screens.jsx":"6c082eac5e1f"},"inlinedExternals":[],"unexposedExports":[{"name":"uweFieldStyle","sourcePath":"components/forms/Input.jsx"}]} */

(() => {

const __ds_ns = (window.UWEDesignSystem_f43eab = window.UWEDesignSystem_f43eab || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE Badge — the design-v2 badge. Uppercase, small, tokenized. Tone maps to
 * semantic colors. Used for statuses (publish, canon) across Studio.
 */
function Badge({
  tone = "neutral",
  style = {},
  children,
  ...rest
}) {
  const tones = {
    neutral: {
      border: "1px solid var(--uwe-border-muted)",
      background: "color-mix(in srgb, var(--uwe-card-bg) 80%, var(--uwe-bg) 20%)",
      color: "var(--uwe-fg-muted)"
    },
    accent: {
      border: "1px solid color-mix(in srgb, var(--uwe-accent) 35%, transparent)",
      background: "var(--uwe-accent-muted)",
      color: "var(--uwe-accent)"
    },
    danger: {
      border: "1px solid color-mix(in srgb, var(--uwe-danger) 35%, transparent)",
      background: "color-mix(in srgb, var(--uwe-danger) 10%, transparent)",
      color: "var(--uwe-danger)"
    },
    success: {
      border: "1px solid color-mix(in srgb, var(--uwe-success) 35%, transparent)",
      background: "color-mix(in srgb, var(--uwe-success) 10%, transparent)",
      color: "var(--uwe-success)"
    },
    warning: {
      border: "1px solid color-mix(in srgb, var(--uwe-warning) 35%, transparent)",
      background: "color-mix(in srgb, var(--uwe-warning) 10%, transparent)",
      color: "var(--uwe-warning)"
    }
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    "data-tone": tone,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.25rem",
      padding: "0.15rem 0.5rem",
      borderRadius: "var(--uwe-radius-sm)",
      fontSize: "var(--uwe-text-xs)",
      fontWeight: 600,
      letterSpacing: "0.02em",
      lineHeight: 1.3,
      textTransform: "uppercase",
      ...tones[tone],
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE Button. Mirrors the product's design-v2 button (`uwe-v2-btn`):
 * - primary  → solid ink fill (--uwe-fg) with page-bg text (Parchment OS signature)
 * - accent   → terracotta fill with a 2px ink border
 * - secondary/subtle/ghost/danger variants
 * All colors read from --uwe-* tokens so the button re-skins with the theme.
 */
function Button({
  variant = "secondary",
  size = "md",
  as = "button",
  icon = null,
  iconAfter = null,
  disabled = false,
  fullWidth = false,
  style = {},
  children,
  ...rest
}) {
  const sizes = {
    sm: {
      minHeight: "1.85rem",
      padding: "0.3rem 0.65rem",
      fontSize: "0.8125rem"
    },
    md: {
      minHeight: "2.25rem",
      padding: "0.45rem 0.9rem",
      fontSize: "0.875rem"
    },
    lg: {
      minHeight: "2.75rem",
      padding: "0.6rem 1.15rem",
      fontSize: "0.95rem"
    }
  };
  const variants = {
    primary: {
      background: "var(--uwe-fg)",
      color: "var(--uwe-bg)",
      borderColor: "var(--uwe-fg)"
    },
    accent: {
      background: "var(--uwe-accent)",
      color: "var(--uwe-on-accent)",
      borderColor: "var(--uwe-fg)",
      borderWidth: "2px"
    },
    secondary: {
      background: "color-mix(in srgb, var(--uwe-card-bg) 70%, var(--uwe-bg) 30%)",
      color: "var(--uwe-fg)",
      borderColor: "var(--uwe-border-muted)"
    },
    subtle: {
      background: "color-mix(in srgb, var(--uwe-card-bg) 45%, transparent)",
      color: "var(--uwe-fg-muted)",
      borderColor: "var(--uwe-border-muted)"
    },
    ghost: {
      background: "transparent",
      color: "var(--uwe-fg)",
      borderColor: "transparent"
    },
    danger: {
      background: "color-mix(in srgb, var(--uwe-danger) 12%, var(--uwe-card-bg))",
      color: "var(--uwe-danger)",
      borderColor: "color-mix(in srgb, var(--uwe-danger) 45%, var(--uwe-border))"
    }
  };
  const Tag = as;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    disabled: Tag === "button" ? disabled : undefined,
    "data-variant": variant,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "0.4rem",
      width: fullWidth ? "100%" : undefined,
      border: "1px solid",
      borderRadius: "var(--uwe-v2-radius-btn)",
      fontFamily: "inherit",
      fontWeight: 500,
      lineHeight: 1.2,
      whiteSpace: "nowrap",
      textDecoration: "none",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.55 : 1,
      transition: "background var(--uwe-transition-fast), border-color var(--uwe-transition-fast), color var(--uwe-transition-fast)",
      ...sizes[size],
      ...variants[variant],
      ...style
    }
  }, rest), icon, children, iconAfter);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE Card — the design-v2 panel. 1.5px border, 14px radius, subtle shadow,
 * elevated paper background. Optional serif title + footer divider.
 */
function Card({
  title,
  footer,
  padded = true,
  style = {},
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      border: "1.5px solid var(--uwe-zone-card-border)",
      borderRadius: "var(--uwe-v2-radius-card)",
      background: "var(--uwe-zone-card-bg)",
      boxShadow: "var(--uwe-shadow-sm)",
      overflow: "hidden",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: padded ? "var(--uwe-content-gap)" : 0
    }
  }, title && /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 var(--uwe-spacing-sm)",
      fontFamily: "var(--uwe-font-serif)",
      fontSize: "var(--uwe-text-lg)",
      fontWeight: 600,
      color: "var(--uwe-zone-heading-fg)"
    }
  }, title), children, footer && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--uwe-spacing-md)",
      paddingTop: "var(--uwe-spacing-md)",
      borderTop: "1px solid var(--uwe-border-muted)"
    }
  }, footer)));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/EmptyState.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE EmptyState — centered placeholder for empty lists/panels. Common on
 * player Portal ("Keine Inhalte freigegeben") and empty Studio views.
 */
function EmptyState({
  icon = null,
  title,
  description,
  action = null,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      padding: "var(--uwe-spacing-2xl) var(--uwe-spacing-xl)",
      border: "1px solid var(--uwe-border-muted)",
      borderRadius: "var(--uwe-radius-lg)",
      textAlign: "center",
      background: "color-mix(in srgb, var(--uwe-card-bg) 55%, transparent)",
      ...style
    }
  }, rest), icon && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: "0.75rem",
      opacity: 0.65,
      display: "flex",
      justifyContent: "center"
    }
  }, icon), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 0.5rem",
      fontSize: "var(--uwe-text-lg)",
      color: "var(--uwe-fg)"
    }
  }, title), description && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 auto",
      maxWidth: "28rem",
      color: "var(--uwe-fg-muted)",
      lineHeight: 1.55,
      fontSize: "var(--uwe-text-base)"
    }
  }, description), action && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: "var(--uwe-spacing-sm)",
      marginTop: "var(--uwe-spacing-lg)"
    }
  }, action));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/core/StatCard.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE StatCard — compact metric tile used across dashboards
 * (Today, World overview). Big value, muted label, optional hint.
 */
function StatCard({
  value,
  label,
  hint,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      padding: "var(--uwe-spacing-md) var(--uwe-spacing-lg)",
      borderRadius: "var(--uwe-radius-lg)",
      border: "1px solid var(--uwe-zone-card-border)",
      background: "var(--uwe-zone-card-bg)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      fontSize: "1.35rem",
      fontWeight: 700,
      lineHeight: 1.2,
      color: "var(--uwe-zone-heading-fg)"
    }
  }, value), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      marginTop: "0.25rem",
      fontSize: "var(--uwe-text-sm)",
      color: "var(--uwe-fg-muted)"
    }
  }, label), hint && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      marginTop: "0.25rem",
      fontSize: "var(--uwe-text-xs)",
      color: "var(--uwe-fg-subtle)"
    }
  }, hint));
}
Object.assign(__ds_scope, { StatCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/StatCard.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE Tag — pill used for taxonomy/tags on wiki pages. Rounded, accent-tinted.
 */
function Tag({
  style = {},
  children,
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    style: {
      display: "inline-flex",
      alignItems: "center",
      fontSize: "var(--uwe-text-xs)",
      padding: "0.15rem 0.5rem",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--uwe-accent) 15%, transparent)",
      color: "color-mix(in srgb, var(--uwe-accent) 35%, var(--uwe-fg) 65%)",
      ...style
    }
  }, rest), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/domain/PageTypeBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** Page type vocabulary (subset of the product's PAGE_TYPE_LABELS). */
const PAGE_TYPE_LABELS = {
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
  note: "Notiz"
};

/**
 * UWE PageTypeBadge — neutral badge naming a wiki page's entity type. Uses the
 * base --uwe-border fill (type badges are deliberately quiet).
 */
function PageTypeBadge({
  type = "note",
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("span", _extends({
    "data-type": type,
    style: {
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
      ...style
    }
  }, rest), PAGE_TYPE_LABELS[type] ?? type);
}
Object.assign(__ds_scope, { PAGE_TYPE_LABELS, PageTypeBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/PageTypeBadge.jsx", error: String((e && e.message) || e) }); }

// components/domain/RtxStatusBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const RTX_STATE_LABELS = {
  online: "RTX online",
  offline: "RTX offline",
  disabled: "RTX deaktiviert",
  starting: "RTX startet",
  error: "RTX Fehler"
};

/**
 * UWE RtxStatusBadge — the local-AI connector status pill. A colored dot plus
 * label. Appears across Studio to show whether the optional RTX Host Connector
 * (local GPU worker) is reachable. Never uppercased (unlike other badges).
 */
function RtxStatusBadge({
  state = "offline",
  label,
  style = {},
  ...rest
}) {
  const map = {
    online: {
      c: "var(--uwe-success)"
    },
    starting: {
      c: "var(--uwe-warning)"
    },
    offline: {
      c: "var(--uwe-danger)"
    },
    error: {
      c: "var(--uwe-danger)"
    },
    disabled: {
      c: "var(--uwe-fg-muted)"
    }
  };
  const dot = map[state]?.c ?? "var(--uwe-fg-subtle)";
  return /*#__PURE__*/React.createElement("span", _extends({
    "data-rtx-state": state,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.4em",
      fontSize: "var(--uwe-text-xs)",
      fontWeight: 600,
      padding: "0.2rem 0.5rem",
      borderRadius: "var(--uwe-radius-sm)",
      border: "1px solid",
      borderColor: `color-mix(in srgb, ${dot} 30%, transparent)`,
      background: `color-mix(in srgb, ${dot} 14%, transparent)`,
      color: `color-mix(in srgb, ${dot} 72%, var(--uwe-fg) 28%)`,
      whiteSpace: "nowrap",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    style: {
      width: "0.5rem",
      height: "0.5rem",
      borderRadius: "999px",
      background: dot,
      flex: "none"
    }
  }), label ?? RTX_STATE_LABELS[state]);
}
Object.assign(__ds_scope, { RTX_STATE_LABELS, RtxStatusBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/RtxStatusBadge.jsx", error: String((e && e.message) || e) }); }

// components/domain/SecretReveal.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE SecretReveal — the spoiler / GM-secret toggle. Content marked as a
 * campaign secret stays blurred behind a "Enthüllen" (reveal) affordance until
 * the reader opts in. Mirrors the product's SecretReveal + secret badge.
 */
function SecretReveal({
  label = "GM-Geheimnis",
  revealHint = "Enthüllen",
  defaultRevealed = false,
  children,
  style = {},
  ...rest
}) {
  const [revealed, setRevealed] = React.useState(defaultRevealed);
  return /*#__PURE__*/React.createElement("div", _extends({
    style: {
      border: "1px solid color-mix(in srgb, var(--uwe-dm-only) 30%, var(--uwe-border))",
      borderRadius: "var(--uwe-radius-md)",
      background: "color-mix(in srgb, var(--uwe-dm-only) 6%, var(--uwe-card-bg))",
      overflow: "hidden",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setRevealed(r => !r),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "0.5rem",
      width: "100%",
      padding: "0.5rem 0.75rem",
      border: "none",
      background: "transparent",
      color: "color-mix(in srgb, var(--uwe-dm-only) 78%, var(--uwe-fg) 22%)",
      font: "inherit",
      fontSize: "var(--uwe-text-xs)",
      fontWeight: 700,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", null, label), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 500,
      textTransform: "none",
      letterSpacing: 0
    }
  }, revealed ? "Verbergen" : revealHint)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: revealed ? "0 0.75rem 0.75rem" : "0 0.75rem 0.75rem",
      filter: revealed ? "none" : "blur(6px)",
      userSelect: revealed ? "auto" : "none",
      pointerEvents: revealed ? "auto" : "none",
      transition: "filter var(--uwe-transition)",
      color: "var(--uwe-fg)",
      fontSize: "var(--uwe-text-base)",
      lineHeight: 1.6
    },
    "aria-hidden": !revealed
  }, children));
}
Object.assign(__ds_scope, { SecretReveal });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/SecretReveal.jsx", error: String((e && e.message) || e) }); }

// components/domain/VisibilityBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * VISIBILITY_LABELS — the German visibility vocabulary from the product.
 * These strings appear verbatim across Studio & Portal.
 */
const VISIBILITY_LABELS = {
  private: "Privat",
  dm_only: "Nur GM",
  player_visible: "Portal sichtbar",
  public: "Share-Link",
  specific_players: "Bestimmte Spieler",
  unlock_after_session: "Nach Session",
  archived: "Archiviert"
};

/**
 * UWE VisibilityBadge — signals whether content is DM-only, player-visible, or
 * shared. Central to UWE's player-safety model. `dm_only` = terracotta, and
 * `player_visible` = teal (the two brand semantics).
 */
function VisibilityBadge({
  visibility = "private",
  style = {},
  ...rest
}) {
  const tones = {
    dm_only: {
      background: "color-mix(in srgb, var(--uwe-dm-only) 15%, transparent)",
      color: "color-mix(in srgb, var(--uwe-dm-only) 78%, var(--uwe-fg) 22%)",
      borderColor: "color-mix(in srgb, var(--uwe-dm-only) 30%, transparent)"
    },
    player_visible: {
      background: "color-mix(in srgb, var(--uwe-player-visible) 14%, transparent)",
      color: "color-mix(in srgb, var(--uwe-player-visible) 82%, var(--uwe-fg) 18%)",
      borderColor: "color-mix(in srgb, var(--uwe-player-visible) 25%, transparent)"
    },
    public: {
      background: "color-mix(in srgb, var(--uwe-info) 12%, transparent)",
      color: "color-mix(in srgb, var(--uwe-info) 78%, var(--uwe-fg) 22%)",
      borderColor: "color-mix(in srgb, var(--uwe-info) 25%, transparent)"
    }
  };
  const tone = tones[visibility] ?? {
    background: "color-mix(in srgb, var(--uwe-card-bg) 80%, var(--uwe-bg) 20%)",
    color: "var(--uwe-fg-muted)",
    borderColor: "var(--uwe-border-muted)"
  };
  return /*#__PURE__*/React.createElement("span", _extends({
    "data-visibility": visibility,
    style: {
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
      ...style
    }
  }, rest), VISIBILITY_LABELS[visibility] ?? visibility);
}
Object.assign(__ds_scope, { VISIBILITY_LABELS, VisibilityBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/domain/VisibilityBadge.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const fieldStyle = {
  width: "100%",
  minHeight: "2.35rem",
  padding: "0.45rem 0.65rem",
  border: "1px solid var(--uwe-border)",
  borderRadius: "var(--uwe-radius-md)",
  background: "var(--uwe-input-bg)",
  color: "var(--uwe-fg)",
  font: "inherit",
  fontSize: "0.9rem",
  lineHeight: 1.4,
  transition: "border-color var(--uwe-transition-fast), box-shadow var(--uwe-transition-fast)"
};

/**
 * UWE Input — labelled text field (design-v2). Wrap-your-own-label variant:
 * pass `label` for a stacked label + hint, or use bare with your own <label>.
 */
function Input({
  label,
  hint,
  id,
  style = {},
  ...rest
}) {
  const input = /*#__PURE__*/React.createElement("input", _extends({
    id: id,
    style: {
      ...fieldStyle,
      ...style
    }
  }, rest));
  if (!label) return input;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.35rem",
      fontSize: "0.875rem",
      fontWeight: 500,
      color: "var(--uwe-fg)"
    }
  }, label, input, hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "0.78rem",
      fontWeight: 400,
      color: "var(--uwe-fg-muted)"
    }
  }, hint));
}
Object.assign(__ds_scope, { Input, uweFieldStyle: fieldStyle });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** UWE Select — native select styled to match the field system. */
function Select({
  label,
  hint,
  options = [],
  children,
  style = {},
  ...rest
}) {
  const sel = /*#__PURE__*/React.createElement("select", _extends({
    style: {
      ...__ds_scope.uweFieldStyle,
      ...style
    }
  }, rest), children ?? options.map(opt => {
    const value = typeof opt === "string" ? opt : opt.value;
    const text = typeof opt === "string" ? opt : opt.label;
    return /*#__PURE__*/React.createElement("option", {
      key: value,
      value: value
    }, text);
  }));
  if (!label) return sel;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.35rem",
      fontSize: "0.875rem",
      fontWeight: 500,
      color: "var(--uwe-fg)"
    }
  }, label, sel, hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "0.78rem",
      fontWeight: 400,
      color: "var(--uwe-fg-muted)"
    }
  }, hint));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Textarea.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** UWE Textarea — multiline field, vertically resizable. */
function Textarea({
  label,
  hint,
  style = {},
  ...rest
}) {
  const ta = /*#__PURE__*/React.createElement("textarea", _extends({
    style: {
      ...__ds_scope.uweFieldStyle,
      minHeight: "5rem",
      resize: "vertical",
      ...style
    }
  }, rest));
  if (!label) return ta;
  return /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "0.35rem",
      fontSize: "0.875rem",
      fontWeight: 500,
      color: "var(--uwe-fg)"
    }
  }, label, ta, hint && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "0.78rem",
      fontWeight: 400,
      color: "var(--uwe-fg-muted)"
    }
  }, hint));
}
Object.assign(__ds_scope, { Textarea });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Textarea.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Brand.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE Brand — the wordmark lockup. A boxed "U" glyph + "WE", with optional
 * subtitle. Matches the auth-shell brand mark. Sizes via `size`.
 */
function Brand({
  appName = "UWE",
  subtitle,
  size = "md",
  href,
  style = {},
  ...rest
}) {
  const scale = {
    sm: 0.85,
    md: 1,
    lg: 1.5
  }[size] ?? 1;
  const [first, ...restName] = String(appName);
  const rest2 = restName.join("");
  const Wrapper = href ? "a" : "div";
  return /*#__PURE__*/React.createElement(Wrapper, _extends({
    href: href,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: "0.55rem",
      textDecoration: "none",
      color: "inherit",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("span", {
    "aria-hidden": true,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: `${2 * scale}rem`,
      height: `${2 * scale}rem`,
      borderRadius: "0.35em",
      background: "linear-gradient(135deg, var(--uwe-accent), color-mix(in srgb, var(--uwe-accent) 70%, var(--uwe-bg-elevated)))",
      color: "#fff",
      fontFamily: "var(--uwe-font-mono)",
      fontSize: `${1.05 * scale}rem`,
      fontWeight: 800,
      boxShadow: "0 4px 20px color-mix(in srgb, var(--uwe-accent) 35%, transparent)"
    }
  }, first), /*#__PURE__*/React.createElement("span", {
    style: {
      lineHeight: 1.05
    }
  }, /*#__PURE__*/React.createElement("strong", {
    style: {
      display: "block",
      fontSize: `${1.05 * scale}rem`,
      fontWeight: 700,
      letterSpacing: "-0.01em",
      color: "var(--uwe-fg)"
    }
  }, rest2 ? `${first}${rest2}` : first), subtitle && /*#__PURE__*/React.createElement("small", {
    style: {
      display: "block",
      fontSize: `${0.72 * scale}rem`,
      color: "var(--uwe-fg-subtle)"
    }
  }, subtitle)));
}
Object.assign(__ds_scope, { Brand });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Brand.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Breadcrumb.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/** UWE Breadcrumb — slash-separated trail. Muted, links to ancestors. */
function Breadcrumb({
  items = [],
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    "aria-label": "Brotkrumen",
    style: {
      fontSize: "0.82rem",
      color: "var(--uwe-fg-muted)",
      marginBottom: "1rem",
      ...style
    }
  }, rest), items.map((item, i) => /*#__PURE__*/React.createElement("span", {
    key: `${item.label}-${i}`
  }, item.href ? /*#__PURE__*/React.createElement("a", {
    href: item.href,
    style: {
      color: "var(--uwe-fg-muted)"
    }
  }, item.label) : item.label, i < items.length - 1 && /*#__PURE__*/React.createElement("span", {
    style: {
      margin: "0 0.35rem"
    }
  }, "/"))));
}
Object.assign(__ds_scope, { Breadcrumb });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Breadcrumb.jsx", error: String((e && e.message) || e) }); }

// components/navigation/PageHeader.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE PageHeader — title + optional summary, meta row, and right-aligned
 * actions. Title renders in the serif reader face. Bottom hairline divider.
 */
function PageHeader({
  title,
  summary,
  meta,
  actions,
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("header", _extends({
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: "var(--uwe-content-gap)",
      marginBottom: "var(--uwe-section-gap)",
      paddingBottom: "var(--uwe-spacing-md)",
      borderBottom: "1px solid var(--uwe-border-muted)",
      ...style
    }
  }, rest), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: 0,
      fontFamily: "var(--uwe-font-serif)",
      fontSize: "clamp(1.35rem, 2.5vw, 1.75rem)",
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: "var(--uwe-tracking-tight)",
      color: "var(--uwe-zone-heading-fg)"
    }
  }, title), summary && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0.35rem 0 0",
      maxWidth: "42rem",
      color: "var(--uwe-fg-muted)",
      fontSize: "0.95rem",
      lineHeight: 1.5
    }
  }, summary), meta && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: "var(--uwe-spacing-sm)",
      display: "flex",
      flexWrap: "wrap",
      gap: "0.35rem",
      alignItems: "center"
    }
  }, meta)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: "var(--uwe-spacing-sm)"
    }
  }, actions));
}
Object.assign(__ds_scope, { PageHeader });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/PageHeader.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarNav.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * UWE SidebarNav — the dark-ink sidebar navigation (Parchment OS signature).
 * Renders sections (title + items); active item gets a terracotta left-border
 * and bold weight. Designed to sit on --uwe-sidebar-bg (dark ink).
 * Each item: { label, href, icon?, active?, badge? }.
 */
function SidebarNav({
  sections = [],
  style = {},
  ...rest
}) {
  return /*#__PURE__*/React.createElement("nav", _extends({
    "aria-label": "Seitennavigation",
    style: {
      display: "flex",
      flexDirection: "column",
      gap: "1.25rem",
      padding: "1.25rem 0.75rem",
      background: "var(--uwe-sidebar-bg)",
      color: "var(--uwe-sidebar-fg)",
      ...style
    }
  }, rest), sections.map((section, si) => /*#__PURE__*/React.createElement("div", {
    key: si
  }, section.title && /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 0.5rem 0.65rem",
      fontSize: "var(--uwe-text-2xs)",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--uwe-sidebar-fg-muted)"
    }
  }, section.title), /*#__PURE__*/React.createElement("ul", {
    style: {
      listStyle: "none",
      margin: 0,
      padding: 0
    }
  }, section.items.map((item, ii) => /*#__PURE__*/React.createElement("li", {
    key: ii,
    style: {
      marginBottom: "0.15rem"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: item.href ?? "#",
    "aria-current": item.active ? "page" : undefined,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "0.55rem",
      padding: "0.5rem 0.65rem",
      minHeight: "2.35rem",
      borderLeft: "3px solid transparent",
      borderLeftColor: item.active ? "var(--uwe-accent)" : "transparent",
      background: item.active ? "color-mix(in srgb, var(--uwe-sidebar-bg) 86%, var(--uwe-sidebar-fg) 14%)" : "transparent",
      color: item.active ? "var(--uwe-sidebar-fg)" : "var(--uwe-sidebar-fg-muted)",
      fontWeight: item.active ? 700 : 400,
      fontSize: "0.9rem",
      textDecoration: "none"
    }
  }, item.icon && /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      flex: "none"
    }
  }, item.icon), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }, item.label), item.badge != null && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: "0.65rem",
      padding: "0.1rem 0.35rem",
      borderRadius: "999px",
      background: "color-mix(in srgb, var(--uwe-sidebar-bg) 74%, var(--uwe-sidebar-fg) 26%)",
      color: "var(--uwe-sidebar-fg-muted)"
    }
  }, item.badge))))))));
}
Object.assign(__ds_scope, { SidebarNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarNav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/portal/screens.jsx
try { (() => {
/* UWE Portal UI kit — player-facing wiki screens.
 * Login gate → world hub → article. Only player-visible content is shown; GM
 * secrets appear blurred behind a reveal. Exported to window for index.html.
 */
const {
  Button,
  Card,
  Badge,
  Tag,
  EmptyState,
  PageHeader,
  Breadcrumb,
  VisibilityBadge,
  PageTypeBadge,
  SecretReveal,
  Brand
} = window.UWEDesignSystem_f43eab;
const PIcon = ({
  n,
  s = 16
}) => React.createElement("i", {
  "data-lucide": n,
  style: {
    width: s,
    height: s,
    display: "inline-flex",
    flex: "none"
  }
});

/* ------------------------------------------------------------ Login ------- */
function LoginScreen({
  onLogin
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "1.05fr 0.95fr"
    }
  }, /*#__PURE__*/React.createElement("aside", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "3rem",
      background: "var(--uwe-sidebar-bg)",
      color: "var(--uwe-sidebar-fg)",
      borderRight: "2px solid var(--uwe-fg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "min(100%, 26rem)"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontSize: 12,
      letterSpacing: "0.14em",
      textTransform: "uppercase",
      color: "var(--uwe-accent)",
      fontFamily: "var(--uwe-font-mono)"
    }
  }, "Universeller Welten-Editor"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 56,
      height: 56,
      borderRadius: 14,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, var(--uwe-accent), color-mix(in srgb, var(--uwe-accent) 70%, var(--uwe-bg-elevated)))",
      color: "#fff",
      fontFamily: "var(--uwe-font-mono)",
      fontWeight: 800,
      fontSize: 30
    }
  }, "U"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--uwe-font-serif)",
      fontSize: 52,
      fontWeight: 700,
      letterSpacing: "-0.02em",
      lineHeight: 1
    }
  }, "Portal")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 20px",
      lineHeight: 1.65,
      color: "var(--uwe-sidebar-fg-muted)"
    }
  }, "Spieleransicht f\xFCr Welten, Handouts und Sessions. Nur freigegebene Inhalte \u2014 lokal gehostet."), /*#__PURE__*/React.createElement("p", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      margin: 0,
      fontSize: 13,
      color: "var(--uwe-sidebar-fg-muted)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      padding: "2px 9px",
      borderRadius: 999,
      border: "1px solid color-mix(in srgb, var(--uwe-accent) 50%, transparent)",
      color: "var(--uwe-accent)",
      fontFamily: "var(--uwe-font-mono)",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.04em"
    }
  }, "Portal"), "Lokal gehostet"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2.5rem 2rem"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: "min(100%, 28rem)"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 6px",
      fontFamily: "var(--uwe-font-serif)",
      fontSize: 28
    }
  }, "Anmelden"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 20px",
      color: "var(--uwe-fg-muted)"
    }
  }, "\xD6ffne deine freigegebenen Welten."), /*#__PURE__*/React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      onLogin();
    },
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      display: "grid",
      gap: 6,
      fontSize: 14,
      fontWeight: 500
    }
  }, "E-Mail", /*#__PURE__*/React.createElement("input", {
    defaultValue: "carina@uwe.local",
    style: fieldCss
  })), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "grid",
      gap: 6,
      fontSize: 14,
      fontWeight: 500
    }
  }, "Passwort", /*#__PURE__*/React.createElement("input", {
    type: "password",
    defaultValue: "\xB7\xB7\xB7\xB7\xB7\xB7\xB7\xB7",
    style: fieldCss
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "accent",
    as: "button",
    fullWidth: true,
    style: {
      marginTop: 4
    }
  }, "Anmelden")), /*#__PURE__*/React.createElement("p", {
    style: {
      marginTop: 16,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "var(--uwe-link)"
    }
  }, "Passwort vergessen?")))));
}
const fieldCss = {
  width: "100%",
  padding: "0.65rem 0.8rem",
  borderRadius: "0.55rem",
  border: "1px solid var(--uwe-border)",
  background: "var(--uwe-input-bg)",
  color: "var(--uwe-fg)",
  font: "inherit",
  fontSize: 15
};

/* ------------------------------------------------------------ Article ----- */
function ArticleScreen({
  onNav
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "52rem"
    }
  }, /*#__PURE__*/React.createElement(Breadcrumb, {
    items: [{
      label: "Terra",
      href: "#"
    }, {
      label: "Orte",
      href: "#"
    }, {
      label: "Validori"
    }]
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      fontFamily: "var(--uwe-font-serif)",
      fontSize: "clamp(2rem,4vw,2.5rem)",
      margin: "0 0 6px"
    }
  }, "Hafenstadt Validori"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(PageTypeBadge, {
    type: "location"
  }), /*#__PURE__*/React.createElement(VisibilityBadge, {
    visibility: "player_visible"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "1.05rem",
      lineHeight: 1.75,
      color: "var(--uwe-fg)"
    }
  }, /*#__PURE__*/React.createElement("p", null, "Validori liegt an der M\xFCndung des Arbor-Flusses, wo S\xFC\xDFwasser auf das Salz des S\xFCdmeers trifft. Die Stadt lebt vom Handel \u2014 Gew\xFCrze, Bernstein und Ger\xFCchte wechseln hier gleicherma\xDFen den Besitzer."), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--uwe-font-serif)",
      fontSize: "1.5rem",
      marginTop: 22
    }
  }, "Die Docks"), /*#__PURE__*/React.createElement("p", null, "Wer die Docks kontrolliert, kontrolliert Validori. Aktuell teilen sich die ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "var(--uwe-wiki-link)"
    }
  }, "Nepurga-Fraktion"), " und die H\xE4ndlergilde die Kaimauern.")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 18
    }
  }), /*#__PURE__*/React.createElement(SecretReveal, {
    label: "Spoiler \u2014 nach Session 12"
  }, "Ihr habt erfahren, dass Kapit\xE4n Serel Vance Zollmanifeste an die Nepurga weiterleitet."), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 18
    }
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    icon: /*#__PURE__*/React.createElement(PIcon, {
      n: "arrow-left"
    }),
    onClick: onNav
  }, "Zur\xFCck zur Welt"));
}

/* ------------------------------------------------------------ World hub --- */
function WorldHubScreen({
  onOpen
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      padding: "2rem 0 1.5rem"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 6px",
      fontSize: 12,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--uwe-accent)",
      fontFamily: "var(--uwe-font-mono)"
    }
  }, "Kampagne"), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 0 10px",
      fontFamily: "var(--uwe-font-serif)",
      fontSize: "clamp(2rem,5vw,3rem)"
    }
  }, "Terra"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: "38rem",
      lineHeight: 1.7,
      color: "var(--uwe-fg-muted)"
    }
  }, "Willkommen, Carina. Hier findest du alle f\xFCr dich freigegebenen Orte, NPCs, Handouts und Session-Zusammenfassungen.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 12
    }
  }, [{
    t: "Hafenstadt Validori",
    type: "location",
    d: "Handelsknoten am Südmeer.",
    open: true
  }, {
    t: "Arbor-Wälder",
    type: "location",
    d: "Uralter Grenzwald im Norden."
  }, {
    t: "Meister Aldric",
    type: "npc",
    d: "Euer Auftraggeber in Validori."
  }, {
    t: "Handout: Seekarte",
    type: "handout",
    d: "Die Küste des Südmeers."
  }, {
    t: "Session 12 — Zusammenfassung",
    type: "session",
    d: "Der Dock-Zwischenfall."
  }, {
    t: "Regeln: Hausregeln",
    type: "rule",
    d: "Abweichungen vom SRD."
  }].map((p, k) => /*#__PURE__*/React.createElement("a", {
    key: k,
    href: "#",
    onClick: e => {
      e.preventDefault();
      if (p.open) onOpen();
    },
    style: {
      display: "block",
      padding: 16,
      border: "1px solid var(--uwe-border)",
      borderRadius: 14,
      background: "var(--uwe-card-bg)",
      textDecoration: "none",
      color: "inherit"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(PageTypeBadge, {
    type: p.type
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--uwe-font-serif)",
      fontSize: "var(--uwe-text-lg)",
      fontWeight: 600,
      color: "var(--uwe-fg)"
    }
  }, p.t), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      fontSize: "var(--uwe-text-sm)",
      color: "var(--uwe-fg-muted)"
    }
  }, p.d)))));
}
window.UWEPortalScreens = {
  LoginScreen,
  ArticleScreen,
  WorldHubScreen,
  PIcon
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/portal/screens.jsx", error: String((e && e.message) || e) }); }

// ui_kits/studio/screens.jsx
try { (() => {
/* UWE Studio UI kit — screens.
 * Recreates the DM cockpit (Daily Admin OS + campaign editor) using the design
 * system components. Three switchable screens: Today, World overview, Wiki page.
 * Exported to window for index.html to mount.
 */
const {
  Button,
  Card,
  StatCard,
  Badge,
  Tag,
  EmptyState,
  PageHeader,
  Breadcrumb,
  VisibilityBadge,
  PageTypeBadge,
  RtxStatusBadge,
  SecretReveal
} = window.UWEDesignSystem_f43eab;
const Icon = ({
  n,
  s = 16
}) => React.createElement("i", {
  "data-lucide": n,
  style: {
    width: s,
    height: s,
    display: "inline-flex",
    flex: "none"
  }
});
function SectionTitle({
  children,
  action
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      margin: "0 0 12px"
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: "var(--uwe-font-serif)",
      fontSize: "var(--uwe-text-xl)",
      color: "var(--uwe-fg)"
    }
  }, children), action);
}

/* ---------------------------------------------------------------- Today --- */
function TodayScreen() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(PageHeader, {
    title: "Heute",
    summary: "Dein t\xE4gliches Admin-Cockpit \u2014 Capture, Projekte, Sessions und Systemstatus auf einen Blick.",
    meta: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral"
    }, "Dienstag, 1. Juli"), /*#__PURE__*/React.createElement(RtxStatusBadge, {
      state: "online"
    })),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: /*#__PURE__*/React.createElement(Icon, {
        n: "inbox"
      })
    }, "Capture"), /*#__PURE__*/React.createElement(Button, {
      variant: "accent",
      icon: /*#__PURE__*/React.createElement(Icon, {
        n: "plus"
      })
    }, "Notiz"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 12,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    value: 7,
    label: "Capture-Inbox",
    hint: "3 unsortiert"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: 4,
    label: "Offene Projekte"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: "Fr 19:00",
    label: "N\xE4chste Session",
    hint: "in 3 Tagen"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: 2,
    label: "Vertr\xE4ge f\xE4llig",
    hint: "diesen Monat"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.4fr 1fr",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, {
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm"
    }, "Alle")
  }, "Braucht Aufmerksamkeit"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, [{
    i: "shield-alert",
    t: "World Inspector: 1 GM-Notiz player-sichtbar",
    d: "Terra · Validori › Docks",
    tone: "warning"
  }, {
    i: "database-backup",
    t: "Letztes Backup vor 6 Tagen",
    d: "Auto-Backup-Scheduler prüfen",
    tone: "warning"
  }, {
    i: "link",
    t: "2 defekte Wikilinks",
    d: "Terra · Nepurga-Fraktion",
    tone: "neutral"
  }].map((r, k) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      padding: "12px 14px",
      border: "1px solid var(--uwe-border)",
      borderRadius: 12,
      background: "var(--uwe-card-bg)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: r.tone === "warning" ? "var(--uwe-warning)" : "var(--uwe-fg-muted)",
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(Icon, {
    n: r.i
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--uwe-text-base)",
      color: "var(--uwe-fg)",
      fontWeight: 500
    }
  }, r.t), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--uwe-text-sm)",
      color: "var(--uwe-fg-muted)",
      marginTop: 2
    }
  }, r.d)), /*#__PURE__*/React.createElement(Button, {
    variant: "subtle",
    size: "sm"
  }, "Beheben")))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 24
    }
  }), /*#__PURE__*/React.createElement(SectionTitle, null, "Schnellzugriff"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 8
    }
  }, ["Welt Terra", "KI-Generator", "Soundboard", "Label-Druck", "Kalender", "Mail Center"].map(c => /*#__PURE__*/React.createElement("a", {
    key: c,
    href: "#",
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid var(--uwe-border)",
      background: "var(--uwe-card-bg)",
      fontSize: "var(--uwe-text-sm)",
      color: "var(--uwe-fg)",
      textDecoration: "none"
    }
  }, c)))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionTitle, null, "Capture-Inbox"), /*#__PURE__*/React.createElement(Card, {
    padded: false
  }, [{
    t: "Idee: Schmugglertunnel unter den Docks",
    tag: "idee"
  }, {
    t: "Spielerfrage zu Nepurga-Vertrag",
    tag: "session"
  }, {
    t: "Homelab: SSD für UWE-Host bestellen",
    tag: "hardware"
  }].map((n, k) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      padding: "12px 14px",
      borderBottom: k < 2 ? "1px solid var(--uwe-border-muted)" : "none",
      display: "flex",
      flexDirection: "column",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--uwe-text-base)",
      color: "var(--uwe-fg)"
    }
  }, n.t), /*#__PURE__*/React.createElement(Tag, null, n.tag)))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 16
    }
  }), /*#__PURE__*/React.createElement(Card, {
    title: "KI & RTX"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      fontSize: "var(--uwe-text-sm)",
      color: "var(--uwe-fg-muted)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Lokale RTX"), /*#__PURE__*/React.createElement(RtxStatusBadge, {
    state: "online"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Cloud-Fallback"), /*#__PURE__*/React.createElement(Badge, {
    tone: "neutral"
  }, "Nur Allg. Chat")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      lineHeight: 1.5
    }
  }, "Brain & Weltwissen bleiben lokal \u2014 kein Cloud-Zugriff."))))));
}

/* ------------------------------------------------------------ World view --- */
function WorldScreen() {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Breadcrumb, {
    items: [{
      label: "Welten",
      href: "#"
    }, {
      label: "Terra"
    }]
  }), /*#__PURE__*/React.createElement(PageHeader, {
    title: "Terra",
    summary: "Kampagnenwelt \xB7 12 Sessions gespielt \xB7 n\xE4chste Session Freitag 19:00 Uhr.",
    meta: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Badge, {
      tone: "accent"
    }, "Aktiv"), /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral"
    }, "D&D 5e")),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: /*#__PURE__*/React.createElement(Icon, {
        n: "search"
      })
    }, "Suchen"), /*#__PURE__*/React.createElement(Button, {
      variant: "accent",
      icon: /*#__PURE__*/React.createElement(Icon, {
        n: "sparkles"
      })
    }, "KI-Generator"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      gap: 12,
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement(StatCard, {
    value: 128,
    label: "Seiten",
    hint: "+6 diese Woche"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: 14,
    label: "NPCs"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: 32,
    label: "Orte"
  }), /*#__PURE__*/React.createElement(StatCard, {
    value: 5,
    label: "Offene Plots"
  })), /*#__PURE__*/React.createElement(SectionTitle, {
    action: /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm"
    }, "Alle Seiten")
  }, "Zuletzt bearbeitet"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: 12
    }
  }, [{
    t: "Hafenstadt Validori",
    type: "location",
    vis: "player_visible",
    d: "Handelsknoten am Südmeer."
  }, {
    t: "Kapitän Serel Vance",
    type: "npc",
    vis: "dm_only",
    d: "Doppelagentin der Nepurga."
  }, {
    t: "Nepurga-Fraktion",
    type: "faction",
    vis: "player_visible",
    d: "Schmugglerkartell der Docks."
  }, {
    t: "Session 13 — Der Vertrag",
    type: "session",
    vis: "private",
    d: "Vorbereitung läuft."
  }].map((p, k) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      padding: 16,
      border: "1px solid var(--uwe-border)",
      borderRadius: 14,
      background: "var(--uwe-card-bg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(PageTypeBadge, {
    type: p.type
  }), /*#__PURE__*/React.createElement(VisibilityBadge, {
    visibility: p.vis
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--uwe-font-serif)",
      fontSize: "var(--uwe-text-lg)",
      fontWeight: 600,
      color: "var(--uwe-fg)"
    }
  }, p.t), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      fontSize: "var(--uwe-text-sm)",
      color: "var(--uwe-fg-muted)"
    }
  }, p.d)))));
}

/* -------------------------------------------------------------- Wiki page --- */
function WikiPageScreen() {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 260px",
      gap: 24
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "52rem"
    }
  }, /*#__PURE__*/React.createElement(Breadcrumb, {
    items: [{
      label: "Terra",
      href: "#"
    }, {
      label: "Orte",
      href: "#"
    }, {
      label: "Validori"
    }]
  }), /*#__PURE__*/React.createElement(PageHeader, {
    title: "Hafenstadt Validori",
    summary: "Handelsknoten am S\xFCdmeer. Drei Fraktionen ringen um die Kontrolle der Docks.",
    meta: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(PageTypeBadge, {
      type: "location"
    }), /*#__PURE__*/React.createElement(VisibilityBadge, {
      visibility: "player_visible"
    }), /*#__PURE__*/React.createElement(Badge, {
      tone: "success"
    }, "Kanon")),
    actions: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      icon: /*#__PURE__*/React.createElement(Icon, {
        n: "eye"
      })
    }, "Vorschau"), /*#__PURE__*/React.createElement(Button, {
      variant: "accent",
      icon: /*#__PURE__*/React.createElement(Icon, {
        n: "pencil"
      })
    }, "Bearbeiten"))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: "var(--uwe-text-md)",
      lineHeight: 1.7,
      color: "var(--uwe-fg)"
    }
  }, /*#__PURE__*/React.createElement("p", null, "Validori liegt an der M\xFCndung des Arbor-Flusses, wo S\xFC\xDFwasser auf das Salz des S\xFCdmeers trifft. Die Stadt lebt vom Handel \u2014 Gew\xFCrze, Bernstein und Ger\xFCchte wechseln hier gleicherma\xDFen den Besitzer."), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontFamily: "var(--uwe-font-serif)",
      fontSize: "var(--uwe-text-xl)",
      marginTop: 20
    }
  }, "Die Docks"), /*#__PURE__*/React.createElement("p", null, "Wer die Docks kontrolliert, kontrolliert Validori. Aktuell teilen sich die ", /*#__PURE__*/React.createElement("a", {
    href: "#",
    style: {
      color: "var(--uwe-wiki-link)"
    }
  }, "Nepurga-Fraktion"), " und die H\xE4ndlergilde die Kaimauern \u2014 ein br\xFCchiger Frieden.")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 16
    }
  }), /*#__PURE__*/React.createElement(SecretReveal, {
    label: "GM-Geheimnis"
  }, "Kapit\xE4n Serel Vance meldet der Nepurga jeden Zoll\xADmanifest weiter. Wird sie enttarnt, kippt der Dock-Frieden binnen einer Session.")), /*#__PURE__*/React.createElement("aside", null, /*#__PURE__*/React.createElement(Card, {
    title: "Metadaten"
  }, /*#__PURE__*/React.createElement("dl", {
    style: {
      margin: 0,
      display: "grid",
      gap: 10
    }
  }, [["Typ", /*#__PURE__*/React.createElement(PageTypeBadge, {
    type: "location"
  })], ["Sichtbarkeit", /*#__PURE__*/React.createElement(VisibilityBadge, {
    visibility: "player_visible"
  })], ["Publish", /*#__PURE__*/React.createElement(Badge, {
    tone: "accent"
  }, "Ver\xF6ffentlicht")], ["Kanon", /*#__PURE__*/React.createElement(Badge, {
    tone: "success"
  }, "Kanon")]].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k
  }, /*#__PURE__*/React.createElement("dt", {
    style: {
      fontSize: "var(--uwe-text-2xs)",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "var(--uwe-fg-muted)",
      marginBottom: 4
    }
  }, k), /*#__PURE__*/React.createElement("dd", {
    style: {
      margin: 0
    }
  }, v))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", {
    style: {
      fontSize: "var(--uwe-text-2xs)",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
      color: "var(--uwe-fg-muted)",
      marginBottom: 4
    }
  }, "Tags"), /*#__PURE__*/React.createElement("dd", {
    style: {
      margin: 0,
      display: "flex",
      flexWrap: "wrap",
      gap: 4
    }
  }, /*#__PURE__*/React.createElement(Tag, null, "hafen"), /*#__PURE__*/React.createElement(Tag, null, "handel"), /*#__PURE__*/React.createElement(Tag, null, "intrige")))))));
}
window.UWEStudioScreens = {
  TodayScreen,
  WorldScreen,
  WikiPageScreen,
  Icon
};
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/studio/screens.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.StatCard = __ds_scope.StatCard;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.PAGE_TYPE_LABELS = __ds_scope.PAGE_TYPE_LABELS;

__ds_ns.PageTypeBadge = __ds_scope.PageTypeBadge;

__ds_ns.RTX_STATE_LABELS = __ds_scope.RTX_STATE_LABELS;

__ds_ns.RtxStatusBadge = __ds_scope.RtxStatusBadge;

__ds_ns.SecretReveal = __ds_scope.SecretReveal;

__ds_ns.VISIBILITY_LABELS = __ds_scope.VISIBILITY_LABELS;

__ds_ns.VisibilityBadge = __ds_scope.VisibilityBadge;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Textarea = __ds_scope.Textarea;

__ds_ns.Brand = __ds_scope.Brand;

__ds_ns.Breadcrumb = __ds_scope.Breadcrumb;

__ds_ns.PageHeader = __ds_scope.PageHeader;

__ds_ns.SidebarNav = __ds_scope.SidebarNav;

})();
