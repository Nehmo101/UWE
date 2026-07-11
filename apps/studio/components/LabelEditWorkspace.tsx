"use client";

import { useCallback, useState } from "react";
import type { LabelElement } from "@uwe/database/label-elements";
import { LabelEditor, type LabelEditorAsset } from "./LabelEditor";
import { Badge, type BadgeProps, Button, Label, Textarea } from "@/src/components/ui";

export type LabelFitStatus = "fits" | "tight" | "overflow";

interface Props {
  initialElements: LabelElement[];
  imageAssets: LabelEditorAsset[];
  worldSlug: string;
  originalText: string;
  currentText: string;
  fitStatus?: LabelFitStatus;
  fitApplied?: boolean;
  snapToGrid?: boolean;
  gridSize?: number;
  showSafeArea?: boolean;
  aiAvailable?: boolean;
}

const FIT_LABELS: Record<LabelFitStatus, string> = {
  fits: "Passt",
  tight: "Knapp",
  overflow: "Zu lang",
};

const FIT_VARIANT: Record<LabelFitStatus, BadgeProps["variant"]> = {
  fits: "success",
  tight: "warning",
  overflow: "danger",
};

export function LabelEditWorkspace({
  initialElements,
  imageAssets,
  worldSlug,
  originalText,
  currentText,
  fitStatus = "fits",
  fitApplied = false,
  snapToGrid = true,
  gridSize = 0.1,
  showSafeArea = true,
  aiAvailable = false,
}: Props) {
  const [, setElements] = useState<LabelElement[]>(initialElements);
  const [showCompare, setShowCompare] = useState(false);

  const onChange = useCallback((elements: LabelElement[]) => {
    setElements(elements);
  }, []);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant={FIT_VARIANT[fitStatus]}>{FIT_LABELS[fitStatus]}</Badge>
        {fitApplied && (
          <span className="text-xs text-muted-foreground">Auto-Fit / Kürzung angewendet</span>
        )}
        <Button type="submit" name="action" value="auto_fit" variant="outline" size="sm">
          Automatisch passend machen
        </Button>
        <Button type="submit" name="action" value="restore_original" variant="outline" size="sm">
          Original wiederherstellen
        </Button>
        {fitApplied && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowCompare((value) => !value)}
          >
            {showCompare ? "Vergleich ausblenden" : "Vorher/Nachher"}
          </Button>
        )}
        {aiAvailable ? (
          <Button type="submit" name="action" value="ai_shorten" variant="outline" size="sm">
            KI-kürzen
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" disabled title="AI Brain nicht konfiguriert">
            KI-kürzen (nicht verfügbar)
          </Button>
        )}
      </div>

      {showCompare && fitApplied && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label-compare-original">Original</Label>
            <Textarea id="label-compare-original" rows={4} readOnly value={originalText} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="label-compare-current">Aktuell (editierbar beim Speichern)</Label>
            <Textarea id="label-compare-current" rows={4} readOnly value={currentText} />
          </div>
        </div>
      )}

      <input type="hidden" name="originalText" value={originalText} />

      <LabelEditor
        initialElements={initialElements}
        imageAssets={imageAssets}
        worldSlug={worldSlug}
        snapToGrid={snapToGrid}
        gridSize={gridSize}
        showSafeArea={showSafeArea}
        onChange={onChange}
      />
    </div>
  );
}
