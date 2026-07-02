"use client";

import { useState } from "react";
import { MiniatureCompareSlider } from "./MiniatureCompareSlider";
import { MiniaturePhotoUploadField } from "./MiniaturePhotoUploadField";

interface Props {
  referenceImageAssetId?: string | null;
  comparePhotoAssetIds?: string[];
  referenceFieldName?: string;
  compareFieldName?: string;
}

interface PhotoOption {
  assetId: string;
  label: string;
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
  const [beforeSelection, setBeforeSelection] = useState("");
  const [afterSelection, setAfterSelection] = useState("");

  const photoOptions: PhotoOption[] = [];
  if (referenceId) {
    photoOptions.push({ assetId: referenceId, label: "Referenzbild" });
  }
  compareIds.forEach((assetId, index) => {
    if (photoOptions.some((option) => option.assetId === assetId)) return;
    photoOptions.push({ assetId, label: `Fortschrittsfoto ${index + 1}` });
  });

  function resolveSelection(selection: string, fallback: string): string {
    if (selection && photoOptions.some((option) => option.assetId === selection)) {
      return selection;
    }
    return fallback;
  }

  const defaultBeforeId = referenceId || compareIds[0] || "";
  const beforeId = resolveSelection(beforeSelection, defaultBeforeId);
  const defaultAfterId =
    [...compareIds].reverse().find((assetId) => assetId !== beforeId) ??
    photoOptions.map((option) => option.assetId).find((assetId) => assetId !== beforeId) ??
    "";
  const afterId = resolveSelection(afterSelection, defaultAfterId);

  const beforeLabel = photoOptions.find((option) => option.assetId === beforeId)?.label ?? "Vorher";
  const afterLabel = photoOptions.find((option) => option.assetId === afterId)?.label ?? "Nachher";

  function addComparePhoto(assetId: string) {
    if (!assetId || compareIds.includes(assetId)) return;
    setCompareIds((current) => [...current, assetId]);
    setAfterSelection(assetId);
  }

  function removeComparePhoto(assetId: string) {
    setCompareIds((current) => current.filter((entry) => entry !== assetId));
  }

  return (
    <div className="uwe-miniature-photo-compare">
      <input type="hidden" name={referenceFieldName} value={referenceId} />
      <input type="hidden" name={compareFieldName} value={compareIds.join("\n")} />

      {photoOptions.length >= 2 ? (
        <section className="uwe-miniature-photo-compare-viewer" aria-label="Fotovergleich">
          <h3 className="uwe-v2-section-title">Vorher / Nachher</h3>
          <div className="uwe-miniature-photo-compare-picker">
            <label>
              Vorher
              <select value={beforeId} onChange={(event) => setBeforeSelection(event.target.value)}>
                {photoOptions.map((option) => (
                  <option key={option.assetId} value={option.assetId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Nachher
              <select value={afterId} onChange={(event) => setAfterSelection(event.target.value)}>
                {photoOptions.map((option) => (
                  <option key={option.assetId} value={option.assetId}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {beforeId && afterId && beforeId !== afterId ? (
            <MiniatureCompareSlider
              beforeSrc={assetPreviewUrl(beforeId)}
              afterSrc={assetPreviewUrl(afterId)}
              beforeLabel={beforeLabel}
              afterLabel={afterLabel}
            />
          ) : (
            <p className="uwe-dashboard-muted">
              Wähle zwei unterschiedliche Fotos, um den Vergleichs-Slider zu nutzen.
            </p>
          )}
        </section>
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
