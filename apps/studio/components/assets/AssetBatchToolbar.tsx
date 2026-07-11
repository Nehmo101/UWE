"use client";

import { useMemo, useState } from "react";
import {
  addAssetsToAlbumAction,
  applyAssetTagProposalAction,
  proposeAssetTagsBatchAction,
} from "@/app/asset-actions";
import { buttonVariants } from "@/src/components/ui";

interface AssetAlbumOption {
  id: string;
  title: string;
  count: number;
}

interface AssetOption {
  id: string;
  title: string;
}

interface AssetBatchToolbarProps {
  worldSlug: string;
  albums: AssetAlbumOption[];
  assets: AssetOption[];
}

/** TODO(design-kit): kein Checkbox-Kit-Component vorhanden — natives input[type=checkbox] + Tailwind verwendet. */
const CHECKBOX_ROW_CLASS = "flex items-center gap-2 text-sm";
const CHECKBOX_CLASS = "size-4 rounded border-input";

/** TODO(design-kit): natives select bleibt — controlled Auswahl mit name-Attribut fürs
    Server-Action-Formular (kein form-Feld-Support im Radix-Select-Kit), siehe gleiches
    Muster in AuditLogWorkspace.tsx. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function AssetBatchToolbar({ worldSlug, albums, assets }: AssetBatchToolbarProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [albumId, setAlbumId] = useState(albums[0]?.id ?? "");

  const selectedCsv = useMemo(() => selected.join(","), [selected]);

  function toggleAsset(assetId: string, checked: boolean) {
    setSelected((current) => {
      if (checked) {
        return current.includes(assetId) ? current : [...current, assetId];
      }
      return current.filter((entry) => entry !== assetId);
    });
  }

  if (assets.length === 0) {
    return null;
  }

  return (
    <section className="rounded-[var(--radius)] border border-border bg-card p-6 text-card-foreground shadow-sm">
      <h2 className="font-semibold leading-none tracking-tight">Batch-Aktionen</h2>
      <div className="mb-2 mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
          onClick={() => setSelected(assets.map((asset) => asset.id))}
        >
          Alle auswählen
        </button>
        <button
          type="button"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
          onClick={() => setSelected([])}
        >
          Auswahl aufheben
        </button>
      </div>
      <div className="grid max-h-64 gap-2 overflow-y-auto">
        {assets.map((asset) => (
          <label key={asset.id} className={CHECKBOX_ROW_CLASS}>
            <input
              type="checkbox"
              checked={selected.includes(asset.id)}
              onChange={(event) => toggleAsset(asset.id, event.target.checked)}
              className={CHECKBOX_CLASS}
            />
            {asset.title}
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="mt-4 grid gap-3">
          <form action={proposeAssetTagsBatchAction}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="assetIds" value={selectedCsv} />
            <button type="submit" className={buttonVariants({ variant: "secondary" })}>
              Tags vorschlagen ({selected.length})
            </button>
          </form>
          {albums.length > 0 && (
            <form action={addAssetsToAlbumAction} className="grid gap-3">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="assetIds" value={selectedCsv} />
              <label className="flex flex-col gap-1.5 text-sm">
                Album
                <select
                  name="albumId"
                  value={albumId}
                  onChange={(event) => setAlbumId(event.target.value)}
                  className={NATIVE_SELECT_CLASS}
                >
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.title} ({album.count})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className={buttonVariants({ variant: "secondary" })}>
                Zu Album hinzufügen
              </button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}

interface AssetTagProposalPanelProps {
  worldSlug: string;
  assetId: string;
  proposedTags: string[];
}

export function AssetTagProposalPanel({ worldSlug, assetId, proposedTags }: AssetTagProposalPanelProps) {
  if (proposedTags.length === 0) {
    return null;
  }

  return (
    <form
      action={applyAssetTagProposalAction}
      className="mt-2 flex flex-col gap-2 rounded-[var(--radius)] border border-success/30 bg-success/10 p-4 text-sm text-success"
    >
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="assetId" value={assetId} />
      <p>
        Tag-Vorschläge: <strong>{proposedTags.join(", ")}</strong>
      </p>
      <button type="submit" className={buttonVariants({ variant: "secondary" })}>
        Vorschläge übernehmen
      </button>
    </form>
  );
}
