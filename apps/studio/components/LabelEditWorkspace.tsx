"use client";

import { useCallback, useState } from "react";
import type { LabelElement } from "@uwe/database/server";
import { LabelEditor, type LabelEditorAsset } from "./LabelEditor";

export type LabelFitStatus = "fits" | "tight" | "overflow";

interface Props {
  initialElements: LabelElement[];
  imageAssets: LabelEditorAsset[];
  originalText: string;
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

const FIT_CLASS: Record<LabelFitStatus, string> = {
  fits: "uwe-badge-success",
  tight: "uwe-badge-warning",
  overflow: "uwe-badge-danger",
};

export function LabelEditWorkspace({
  initialElements,
  imageAssets,
  originalText,
  fitStatus = "fits",
  fitApplied = false,
  snapToGrid = true,
  gridSize = 0.1,
  showSafeArea = true,
  aiAvailable = false,
}: Props) {
  const [, setElements] = useState<LabelElement[]>(initialElements);

  const onChange = useCallback((elements: LabelElement[]) => {
    setElements(elements);
  }, []);

  return (
    <div className="uwe-label-edit-workspace">
      <div className="uwe-label-fit-bar">
        <span className={`uwe-badge ${FIT_CLASS[fitStatus]}`}>
          {FIT_LABELS[fitStatus]}
        </span>
        {fitApplied && <span className="uwe-table-sub">Auto-Fit angewendet</span>}
        <button type="submit" name="action" value="auto_fit" className="uwe-btn uwe-btn-sm">
          Automatisch passend machen
        </button>
        <button type="submit" name="action" value="restore_original" className="uwe-btn uwe-btn-sm">
          Original wiederherstellen
        </button>
        {aiAvailable ? (
          <button type="submit" name="action" value="ai_shorten" className="uwe-btn uwe-btn-sm">
            KI-kürzen
          </button>
        ) : (
          <button type="button" className="uwe-btn uwe-btn-sm" disabled title="AI Brain nicht konfiguriert">
            KI-kürzen (nicht verfügbar)
          </button>
        )}
      </div>

      <input type="hidden" name="originalText" value={originalText} />

      <LabelEditor
        initialElements={initialElements}
        imageAssets={imageAssets}
        snapToGrid={snapToGrid}
        gridSize={gridSize}
        showSafeArea={showSafeArea}
        onChange={onChange}
      />
    </div>
  );
}
