"use client";

import { Button } from "../components/Button";
import { useLayoutEditor } from "./LayoutEditorProvider";

export interface LayoutEditToolbarProps {
  onApply: (widgets: ReturnType<typeof useLayoutEditor>["draftWidgets"]) => Promise<void> | void;
  saving?: boolean;
  error?: string | null;
}

export function LayoutEditToolbar({ onApply, saving = false, error = null }: LayoutEditToolbarProps) {
  const { isEditing, startEditing, cancelEditing, applyDraft, draftWidgets } = useLayoutEditor();

  if (!isEditing) {
    return (
      <div className="uwe-layout-edit-toolbar">
        <Button type="button" variant="secondary" onClick={startEditing}>
          Layout bearbeiten
        </Button>
      </div>
    );
  }

  return (
    <div className="uwe-layout-edit-toolbar">
      <p className="uwe-layout-edit-hint">Widgets per Drag-and-drop anordnen. Unsichtbare Widgets ausblenden.</p>
      {error && (
        <p className="uwe-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="uwe-layout-edit-actions">
        <Button
          type="button"
          variant="primary"
          disabled={saving}
          onClick={() => {
            const next = applyDraft();
            void onApply(next);
          }}
        >
          {saving ? "Speichern…" : "Anwenden"}
        </Button>
        <Button type="button" variant="ghost" disabled={saving} onClick={cancelEditing}>
          Abbrechen
        </Button>
      </div>
      <p className="uwe-dashboard-muted">{draftWidgets.filter((widget) => widget.visible).length} sichtbare Widgets</p>
    </div>
  );
}
