"use client";

import { StickyActionBar } from "@uwe/shared-ui";

export function EditPageStickyBar({
  previewHref,
  formId = "uwe-edit-page-form",
}: {
  previewHref: string;
  formId?: string;
}) {
  return (
    <StickyActionBar>
      <button type="submit" form={formId} className="uwe-btn uwe-btn-primary">
        Speichern
      </button>
      <a href={previewHref} className="uwe-btn uwe-btn-secondary">
        Vorschau
      </a>
    </StickyActionBar>
  );
}
