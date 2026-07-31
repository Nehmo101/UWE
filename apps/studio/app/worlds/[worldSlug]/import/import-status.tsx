import type { ImportItemPreview, ImportStatus } from "@uwe/knoteforge-import";
import { Badge, type BadgeProps } from "@/src/components/ui";

/**
 * Der Import-Status an einer Stelle: Beschriftung, Farbe, und ob ein Eintrag
 * überhaupt auswählbar ist. Herausgezogen aus `ImportWorkspace.tsx`, das mit
 * den ausgeschriebenen Tabellenspalten über das 700-Zeilen-Budget lief.
 */

export const IMPORT_STATUS_LABELS: Record<ImportStatus, string> = {
  new: "Neu",
  update: "Update",
  duplicate: "Duplikat",
  conflict: "Konflikt",
  skipped: "Übersprungen",
  error: "Fehler",
};

export function statusVariant(status: ImportStatus): BadgeProps["variant"] {
  switch (status) {
    case "new":
      return "success";
    case "update":
      return "info";
    case "duplicate":
    case "skipped":
      return "warning";
    case "error":
      return "danger";
    default:
      return "default";
  }
}

/** Statusanzeige mit Beschriftung — eine Stelle, damit sie überall gleich aussieht. */
export function ImportStatusBadge({ status }: { status: ImportStatus }) {
  return <Badge variant={statusVariant(status)}>{IMPORT_STATUS_LABELS[status]}</Badge>;
}

/** Duplikate, Übersprungenes und Fehler lassen sich nicht importieren. */
export function isSelectable(status: ImportStatus): boolean {
  return status === "new" || status === "update" || status === "conflict";
}

export function defaultSelectedIds(items: ImportItemPreview[]): Set<string> {
  return new Set(items.filter((item) => isSelectable(item.status)).map((item) => item.itemId));
}
