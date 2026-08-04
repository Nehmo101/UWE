"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PAGE_TYPE_LABELS } from "@uwe/shared-ui";
import type { PageType } from "@uwe/database/enums";
import type { PageBulkOperation } from "@uwe/database/page-bulk";
import { bulkUpdatePagesAction } from "@/app/page-bulk-actions";
import { PageBatchConvertPanel } from "./PageBatchConvertPanel";
import { PageBatchTransferPanel } from "./PageBatchTransferPanel";

/** "convert" und KI-Aktionen sind keine deklarativen Feldänderungen — eigene Panels. */
type OpKind =
  | PageBulkOperation["kind"]
  | "convert"
  | "transfer"
  | "ki_format"
  | "ki_tags"
  | "ki_convert";

const OP_OPTIONS: { value: OpKind; label: string }[] = [
  { value: "type", label: "Seitentyp setzen" },
  { value: "portalRelease", label: "Portal-Freigabe setzen" },
  { value: "addTags", label: "Tags hinzufügen" },
  { value: "removeTags", label: "Tags entfernen" },
  { value: "campaign", label: "Kampagne zuweisen" },
  { value: "convert", label: "Konvertieren" },
  { value: "transfer", label: "In andere Welt übernehmen" },
  { value: "ki_format", label: "KI ausarbeiten / formatieren" },
  { value: "ki_tags", label: "KI Tags" },
  { value: "ki_convert", label: "KI Konvertierung" },
  { value: "delete", label: "Löschen" },
];

// Nur die sinnvoll per Massenaktion setzbaren Sichtbarkeiten (kein
// „bestimmte Spieler" o. Ä., die zusätzliche Konfiguration bräuchten).
const TYPE_OPTIONS = (Object.keys(PAGE_TYPE_LABELS) as PageType[]).map((value) => ({
  value,
  label: PAGE_TYPE_LABELS[value],
}));

const SELECT_CLASS = "rounded-md border border-border bg-background px-2 py-1 text-sm";

interface Props {
  worldSlug: string;
  campaigns: { id: string; name: string }[];
  selectedIds: string[];
  clearSelection: () => void;
}

export function PageBatchToolbar({ worldSlug, campaigns, selectedIds, clearSelection }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState<OpKind>("type");
  const [pageType, setPageType] = useState<PageType>("npc");
  const [released, setReleased] = useState<"release" | "lock">("release");
  const [tags, setTags] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildOperation = useCallback((): PageBulkOperation | null => {
    switch (kind) {
      case "type":
        return { kind, type: pageType };
      case "portalRelease":
        return { kind, released: released === "release" };
      case "addTags":
      case "removeTags": {
        const list = tags.split(",").map((tag) => tag.trim()).filter(Boolean);
        return list.length ? { kind, tags: list } : null;
      }
      case "campaign":
        return { kind, campaignId: campaignId || null };
      case "delete":
        return { kind };
      default:
        return null;
    }
  }, [kind, pageType, tags, campaignId, released]);

  const handleApply = useCallback(async () => {
    setError(null);
    setMessage(null);

    if ((kind === "addTags" || kind === "removeTags") && !tags.trim()) {
      setError("Bitte mindestens ein Tag angeben.");
      return;
    }
    if (kind === "delete") {
      const confirmed = window.confirm(
        `${selectedIds.length} Seite(n) wirklich löschen? Die Aktion ist über das Aktivitätsprotokoll rückgängig machbar.`,
      );
      if (!confirmed) return;
    }

    const operation = buildOperation();
    if (!operation) return;

    setLoading(true);
    try {
      const result = await bulkUpdatePagesAction(worldSlug, selectedIds, operation);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      clearSelection();
      router.refresh();
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Aktion fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }, [kind, tags, selectedIds, buildOperation, worldSlug, clearSelection, router]);

  const applyClass =
    kind === "delete"
      ? "inline-flex h-8 items-center rounded-md bg-destructive px-3 text-sm text-destructive-foreground hover:opacity-90 disabled:opacity-60"
      : "inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-60";

  const isPanelOp =
    kind === "convert" ||
    kind === "transfer" ||
    kind === "ki_format" ||
    kind === "ki_tags" ||
    kind === "ki_convert";

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex w-full flex-wrap items-center gap-2">
        <span className="font-medium">{selectedIds.length} ausgewählt</span>

        <select
          className={SELECT_CLASS}
          value={kind}
          onChange={(event) => setKind(event.target.value as OpKind)}
          aria-label="Massenaktion"
        >
          {OP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {kind === "type" && (
          <select
            className={SELECT_CLASS}
            value={pageType}
            onChange={(event) => setPageType(event.target.value as PageType)}
            aria-label="Seitentyp"
          >
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {kind === "portalRelease" && (
          <select
            className={SELECT_CLASS}
            value={released}
            onChange={(event) => setReleased(event.target.value as "release" | "lock")}
            aria-label="Portal-Freigabe"
          >
            <option value="release">Fürs Portal freigeben</option>
            <option value="lock">Portal-Freigabe entziehen</option>
          </select>
        )}

        {(kind === "addTags" || kind === "removeTags") && (
          <input
            className={SELECT_CLASS}
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="tag1, tag2"
            aria-label="Tags (kommagetrennt)"
          />
        )}

        {kind === "campaign" && (
          <select
            className={SELECT_CLASS}
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            aria-label="Kampagne"
          >
            <option value="">Keine Kampagne</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
        )}

        {kind !== "convert" && !isPanelOp && (
          <button type="button" className={applyClass} onClick={handleApply} disabled={loading}>
            {loading ? "Wird angewendet…" : "Anwenden"}
          </button>
        )}
        <button
          type="button"
          className="inline-flex h-8 items-center rounded-md border border-border px-3 text-sm hover:bg-muted"
          onClick={clearSelection}
          disabled={loading}
        >
          Auswahl aufheben
        </button>

        {kind !== "convert" && !isPanelOp && error && (
          <span className="text-sm text-destructive">{error}</span>
        )}
        {kind !== "convert" && !isPanelOp && message && !error && (
          <span className="text-sm text-muted-foreground">✓ {message}</span>
        )}
      </div>

      {kind === "convert" && (
        <PageBatchConvertPanel
          worldSlug={worldSlug}
          selectedIds={selectedIds}
          clearSelection={clearSelection}
        />
      )}

      {kind === "transfer" && (
        <PageBatchTransferPanel
          worldSlug={worldSlug}
          selectedIds={selectedIds}
          clearSelection={clearSelection}
        />
      )}

    </div>
  );
}
