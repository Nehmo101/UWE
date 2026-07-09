import {
  isPlayerPortalVisibility,
  isPublishedContentStatus,
  isSecretVisibleToPlayer,
  mapPublishStatusToContentStatus,
} from "@uwe/auth";
import { PUBLISH_LABELS, VISIBILITY_LABELS } from "@uwe/shared-ui";
import type { PublishStatus, SecretLevel, RevealState, Visibility } from "@uwe/database/enums";

interface PreviewGateFields {
  visibility: Visibility;
  publishStatus: PublishStatus;
  secretLevel?: SecretLevel | null;
  revealState?: RevealState | null;
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

  if (!isPublishedContentStatus(mapPublishStatusToContentStatus(page.publishStatus))) {
    return `Status ist "${PUBLISH_LABELS[page.publishStatus]}" — nur veröffentlichte Seiten sind für Spieler sichtbar.`;
  }

  if (!isSecretVisibleToPlayer(page)) {
    return "Diese Seite ist als Geheimnis markiert und für Spieler noch nicht enthüllt.";
  }

  return "Diese Seite ist für Spieler aktuell nicht zugänglich.";
}
