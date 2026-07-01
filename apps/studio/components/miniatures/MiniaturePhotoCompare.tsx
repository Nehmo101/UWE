"use client";

import { useState } from "react";
import { MiniaturePhotoUploadField } from "./MiniaturePhotoUploadField";

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

  const latestCompareId = compareIds.at(-1) ?? null;

  function addComparePhoto(assetId: string) {
    if (!assetId || compareIds.includes(assetId)) return;
    setCompareIds((current) => [...current, assetId]);
  }

  function removeComparePhoto(assetId: string) {
    setCompareIds((current) => current.filter((entry) => entry !== assetId));
  }

  return (
    <div className="uwe-miniature-photo-compare">
      <input type="hidden" name={referenceFieldName} value={referenceId} />
      <input type="hidden" name={compareFieldName} value={compareIds.join("\n")} />

      {referenceId && latestCompareId ? (
        <div className="uwe-miniature-photo-compare-side" aria-label="Referenz und Fortschritt">
          <figure className="uwe-miniature-photo-compare-side-item">
            <figcaption className="uwe-v2-section-title">Referenz</figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetPreviewUrl(referenceId)} alt="Referenzbild" />
          </figure>
          <figure className="uwe-miniature-photo-compare-side-item">
            <figcaption className="uwe-v2-section-title">Fortschritt</figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={assetPreviewUrl(latestCompareId)} alt="Aktueller Fortschritt" />
          </figure>
        </div>
      ) : null}

      <div className="uwe-miniature-photo-compare-grid">
        <section className="uwe-miniature-photo-compare-pane" aria-label="Referenzbild">
          <h3 className="uwe-v2-section-title">Referenz</h3>
          <MiniaturePhotoUploadField
            label="Referenzfoto für Vergleich"
            assetId={referenceId || null}
            onAssetChange={(assetId) => setReferenceId(assetId ?? "")}
            uploadTitle="Miniatur Referenz"
          />
        </section>

        <section className="uwe-miniature-photo-compare-pane" aria-label="Fortschrittsfotos">
          <h3 className="uwe-v2-section-title">Fortschritt ({compareIds.length})</h3>
          <div className="uwe-miniature-photo-compare-strip">
            {compareIds.length === 0 ? (
              <p className="uwe-dashboard-muted">Noch keine Fortschrittsfotos hinterlegt.</p>
            ) : (
              compareIds.map((assetId) => (
                <article key={assetId} className="uwe-miniature-photo-slot">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={assetPreviewUrl(assetId)} alt="" />
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
          <MiniaturePhotoUploadField
            label="Fortschrittsfoto hinzufügen"
            assetId={null}
            onAssetChange={(assetId) => {
              if (assetId) addComparePhoto(assetId);
            }}
            uploadTitle="Miniatur Fortschritt"
          />
        </section>
      </div>
    </div>
  );
}
