"use client";

import { useMemo, useState } from "react";
import {
  addAssetsToAlbumAction,
  applyAssetTagProposalAction,
  proposeAssetTagsBatchAction,
} from "@/app/asset-actions";

interface AssetAlbumOption {
  id: string;
  title: string;
  count: number;
}

interface AssetBatchToolbarProps {
  worldSlug: string;
  albums: AssetAlbumOption[];
  assetIds: string[];
}

export function AssetBatchToolbar({ worldSlug, albums, assetIds }: AssetBatchToolbarProps) {
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

  if (assetIds.length === 0) {
    return null;
  }

  return (
    <section className="uwe-panel">
      <h2>Batch-Aktionen</h2>
      <div className="uwe-form-grid">
        {assetIds.map((assetId) => (
          <label key={assetId} className="uwe-checkbox-row">
            <input
              type="checkbox"
              checked={selected.includes(assetId)}
              onChange={(event) => toggleAsset(assetId, event.target.checked)}
            />
            Asset {assetId.slice(0, 8)}…
          </label>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="uwe-form-grid" style={{ marginTop: "1rem" }}>
          <form action={proposeAssetTagsBatchAction}>
            <input type="hidden" name="worldSlug" value={worldSlug} />
            <input type="hidden" name="assetIds" value={selectedCsv} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
              Tags vorschlagen ({selected.length})
            </button>
          </form>
          {albums.length > 0 && (
            <form action={addAssetsToAlbumAction} className="uwe-form-grid">
              <input type="hidden" name="worldSlug" value={worldSlug} />
              <input type="hidden" name="assetIds" value={selectedCsv} />
              <label>
                Album
                <select name="albumId" value={albumId} onChange={(event) => setAlbumId(event.target.value)}>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.title} ({album.count})
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
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
    <form action={applyAssetTagProposalAction} className="uwe-notice" style={{ marginTop: "0.5rem" }}>
      <input type="hidden" name="worldSlug" value={worldSlug} />
      <input type="hidden" name="assetId" value={assetId} />
      <p>
        Tag-Vorschläge: <strong>{proposedTags.join(", ")}</strong>
      </p>
      <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
        Vorschläge übernehmen
      </button>
    </form>
  );
}
