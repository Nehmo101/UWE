import {
  isPlayerPortalVisibility,
} from "@uwe/auth";
import { VISIBILITY_LABELS } from "@uwe/shared-ui";
import type { Visibility } from "@uwe/database/enums";

interface PreviewGateFields {
  visibility: Visibility;
}

/**
 * Explains why the current page isn't visible in the player preview, mirroring
 * the same checks the real portal applies (see packages/database/src/permissions.ts).
 * Used only to render a helpful message — never to grant access.
 */
export function describePreviewVisibilityGate(page: PreviewGateFields): string {
  if (!isPlayerPortalVisibility(page.visibility)) {
    return `Sichtbarkeit ist auf "${VISIBILITY_LABELS[page.visibility]}" gesetzt — Spieler sehen diese Seite im Portal nicht.`;
  }

  if (!true) {
    return "Diese Seite ist als Geheimnis markiert und für Spieler noch nicht enthüllt.";
  }

  return "Diese Seite ist für Spieler aktuell nicht zugänglich.";
}
