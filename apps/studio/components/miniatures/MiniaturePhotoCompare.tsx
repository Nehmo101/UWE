"use client";

import { useState } from "react";

interface Props {
  referenceImageAssetId?: string | null;
  comparePhotoAssetIds?: string[];
  referenceFieldName?: string;
  compareFieldName?: string;
}

function assetPreviewUrl(assetId: string): string {
  return `/api/assets/${assetId}/file`;
}

export function MiniaturePhotoCompare({
  referenceImageAssetId,
  comparePhotoAssetIds = [],
  referenceFieldName = "referenceImageAssetId",
  compareFieldName = "comparePhotoAssetIds",
}: Props) {
  const [referenceId, setReferenceId] = useState(referenceImageAssetId ?? "");
  const [compareIds, setCompareIds] = useState<string[]>(comparePhotoAssetIds);
  const [draftCompareId, setDraftCompareId] = useState("");

  function addComparePhoto() {
    const next = draftCompareId.trim();
    if (!next || compareIds.includes(next)) return;
    setCompareIds((current) => [...current, next]);
    setDraftCompareId("");
  }

  function removeComparePhoto(assetId: string) {
    setCompareIds((current) => current.filter((entry) => entry !== assetId));
  }

  return (
    <div className="uwe-miniature-photo-compare">
      <input type="hidden" name={referenceFieldName} value={referenceId} />
      <input type="hidden" name={compareFieldName} value={compareIds.join("\n")} />

      <div className="uwe-miniature-photo-compare-grid">
        <section className="uwe-miniature-photo-compare-pane" aria-label="Referenzbild">
          <h3 className="uwe-v2-section-title">Referenz</h3>
          <div className="uwe-miniature-photo-slot">
            {referenceId ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assetPreviewUrl(referenceId)} alt="" />
                <p className="uwe-dashboard-muted">
                  Asset: <code>{referenceId}</code>
                </p>
              </>
            ) : (
              <p className="uwe-dashboard-muted">Noch kein Referenz-Asset gesetzt.</p>
            )}
          </div>
          <label>
            Referenz-Asset-ID
            <input
              value={referenceId}
              onChange={(event) => setReferenceId(event.target.value.trim())}
              placeholder="Asset-ID einfügen"
            />
          </label>
          {referenceId ? (
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
              onClick={() => setReferenceId("")}
            >
              Referenz entfernen
            </button>
          ) : null}
        </section>

        <section className="uwe-miniature-photo-compare-pane" aria-label="Vergleichsfotos">
          <h3 className="uwe-v2-section-title">Vergleichsfotos ({compareIds.length})</h3>
          <div className="uwe-miniature-photo-compare-strip">
            {compareIds.length === 0 ? (
              <p className="uwe-dashboard-muted">Noch keine Vergleichsfotos hinterlegt.</p>
            ) : (
              compareIds.map((assetId) => (
                <article key={assetId} className="uwe-miniature-photo-slot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetPreviewUrl(assetId)} alt="" />
                  <p className="uwe-dashboard-muted">
                    <code>{assetId}</code>
                  </p>
                  <button
                    type="button"
                    className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm"
                    onClick={() => removeComparePhoto(assetId)}
                  >
                    Entfernen
                  </button>
                </article>
              ))
            )}
          </div>
          <div className="uwe-inline-actions">
            <label>
              Vergleichs-Asset-ID
              <input
                value={draftCompareId}
                onChange={(event) => setDraftCompareId(event.target.value)}
                placeholder="Asset-ID hinzufügen"
              />
            </label>
            <button
              type="button"
              className="uwe-v2-btn uwe-v2-btn-primary uwe-v2-btn-sm"
              onClick={addComparePhoto}
            >
              Foto hinzufügen
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
