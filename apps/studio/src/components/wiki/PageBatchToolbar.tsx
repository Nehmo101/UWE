"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { PAGE_TYPE_LABELS, PUBLISH_LABELS } from "@uwe/shared-ui";
import type { PageType, PublishStatus, Visibility } from "@uwe/database/enums";
import type { PageBulkOperation } from "@uwe/database/page-bulk";
import { bulkUpdatePagesAction } from "@/app/page-bulk-actions";
import { PageBatchConvertPanel } from "./PageBatchConvertPanel";

/** "convert" ist keine deklarative Feldänderung (PageBulkOperation), sondern
 * eine eigene Vorschau/Anwenden-Aktion — siehe PageBatchConvertPanel. */
type OpKind = PageBulkOperation["kind"] | "convert";

const OP_OPTIONS: { value: OpKind; label: string }[] = [
  { value: "visibility", label: "Sichtbarkeit setzen" },
  { value: "publishStatus", label: "Status setzen" },
  { value: "type", label: "Seitentyp setzen" },
  { value: "addTags", label: "Tags hinzufügen" },
  { value: "removeTags", label: "Tags entfernen" },
  { value: "campaign", label: "Kampagne zuweisen" },
  { value: "convert", label: "Konvertieren" },
  { value: "delete", label: "Löschen" },
];

// Nur die sinnvoll per Massenaktion setzbaren Sichtbarkeiten (kein
// „bestimmte Spieler" o. Ä., die zusätzliche Konfiguration bräuchten).
const VISIBILITY_OPTIONS: { value: Visibility; label: string }[] = [
  { value: "dm_only", label: "Nur GM" },
  { value: "player_visible", label: "Portal sichtbar" },
  { value: "public", label: "Share-Link" },
];

const PUBLISH_OPTIONS = (Object.keys(PUBLISH_LABELS) as PublishStatus[]).map((value) => ({
  value,
  label: PUBLISH_LABELS[value],
}));

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
  const [kind, setKind] = useState<OpKind>("visibility");
  const [visibility, setVisibility] = useState<Visibility>("dm_only");
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("published");
  const [pageType, setPageType] = useState<PageType>("npc");
  const [tags, setTags] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildOperation = useCallback((): PageBulkOperation | null => {
    switch (kind) {
      case "visibility":
        return { kind, visibility };
      case "publishStatus":
        return { kind, publishStatus };
      case "type":
        return { kind, type: pageType };
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
  }, [kind, visibility, publishStatus, pageType, tags, campaignId]);

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

        {kind === "visibility" && (
          <select
            className={SELECT_CLASS}
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as Visibility)}
            aria-label="Sichtbarkeit"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {kind === "publishStatus" && (
          <select
            className={SELECT_CLASS}
            value={publishStatus}
            onChange={(event) => setPublishStatus(event.target.value as PublishStatus)}
            aria-label="Status"
          >
            {PUBLISH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

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

        {kind !== "convert" && (
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

        {kind !== "convert" && error && <span className="text-sm text-destructive">{error}</span>}
        {kind !== "convert" && message && !error && (
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
    </div>
  );
}
