/**
 * Unique strings embedded in security test fixtures.
 * The public leak scanner fails if any PRIVATE marker appears in anonymous output.
 */
export const SECURITY_MARKERS = {
  /** dm_only page / block content */
  DM_ONLY: "__DM_ONLY_SECRET_SHOULD_NOT_LEAK__",
  /** unlock_after_session page not yet unlocked */
  HIDDEN_SECRET: "__HIDDEN_SECRET_SHOULD_NOT_LEAK__",
  /** dm_only asset file bytes */
  PRIVATE_MEDIA: "__PRIVATE_MEDIA_SHOULD_NOT_LEAK__",
  /** Allowed on public portal */
  PUBLIC: "__PUBLIC_MARKER_OK__",
  /** Allowed for logged-in players */
  PLAYER_VISIBLE: "__PLAYER_VISIBLE_MARKER_OK__",
  /** unlock_after_session page after unlock */
  REVEALED_SECRET: "__REVEALED_SECRET_MARKER__",
} as const;

/** Markers that must never appear in anonymous / public portal responses. */
export const PRIVATE_LEAK_MARKERS = [
  SECURITY_MARKERS.DM_ONLY,
  SECURITY_MARKERS.HIDDEN_SECRET,
  SECURITY_MARKERS.PRIVATE_MEDIA,
] as const;

/** Markers allowed in specific authenticated contexts (not scanned on anonymous paths). */
export const ALLOWED_MARKERS = [
  SECURITY_MARKERS.PUBLIC,
  SECURITY_MARKERS.PLAYER_VISIBLE,
  SECURITY_MARKERS.REVEALED_SECRET,
] as const;

export type SecurityTestRole = "anonymous" | "player" | "dm" | "admin" | "owner";
