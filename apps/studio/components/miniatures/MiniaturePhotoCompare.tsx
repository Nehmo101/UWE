"use client";

import { useState } from "react";
import { MiniatureCompareSlider } from "./MiniatureCompareSlider";
import { MiniaturePhotoUploadField } from "./MiniaturePhotoUploadField";
import { Button, Card, CardContent, CardHeader, CardTitle, Label } from "@/src/components/ui";

/** Kontrollierte Vorher/Nachher-Auswahl — Kit-Select (Radix) unterstützt kein
 * einfaches controlled `value`/`onChange`-Pattern wie das native <select>.
 * TODO(design-kit): natives Select bleibt. */
const NATIVE_SELECT_CLASS =
  "h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

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
    <div className="flex flex-col gap-4">
      <input type="hidden" name={referenceFieldName} value={referenceId} />
      <input type="hidden" name={compareFieldName} value={compareIds.join("\n")} />

      {photoOptions.length >= 2 ? (
        <Card aria-label="Fotovergleich">
          <CardHeader>
            <CardTitle>Vorher / Nachher</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${referenceFieldName}-compare-before`}>Vorher</Label>
                <select
                  id={`${referenceFieldName}-compare-before`}
                  value={beforeId}
                  onChange={(event) => setBeforeSelection(event.target.value)}
                  className={NATIVE_SELECT_CLASS}
                >
                  {photoOptions.map((option) => (
                    <option key={option.assetId} value={option.assetId}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${compareFieldName}-compare-after`}>Nachher</Label>
                <select
                  id={`${compareFieldName}-compare-after`}
                  value={afterId}
                  onChange={(event) => setAfterSelection(event.target.value)}
                  className={NATIVE_SELECT_CLASS}
                >
                  {photoOptions.map((option) => (
                    <option key={option.assetId} value={option.assetId}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {beforeId && afterId && beforeId !== afterId ? (
              <MiniatureCompareSlider
                beforeSrc={assetPreviewUrl(beforeId)}
                afterSrc={assetPreviewUrl(afterId)}
                beforeLabel={beforeLabel}
                afterLabel={afterLabel}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Wähle zwei unterschiedliche Fotos, um den Vergleichs-Slider zu nutzen.
              </p>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card aria-label="Referenzbild">
          <CardHeader>
            <CardTitle>Referenz</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniaturePhotoUploadField
              label="Referenzfoto für Vergleich"
              assetId={referenceId || null}
              onAssetChange={(assetId) => setReferenceId(assetId ?? "")}
              uploadTitle="Miniatur Referenz"
            />
          </CardContent>
        </Card>

        <Card aria-label="Fortschrittsfotos">
          <CardHeader>
            <CardTitle>Fortschritt ({compareIds.length})</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-3">
              {compareIds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Fortschrittsfotos hinterlegt.</p>
              ) : (
                compareIds.map((assetId) => (
                  <article key={assetId} className="grid gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={assetPreviewUrl(assetId)}
                      alt=""
                      className="max-h-40 w-full rounded-[var(--radius)] bg-muted object-cover"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => removeComparePhoto(assetId)}
                    >
                      Entfernen
                    </Button>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
