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
      <button type="submit" form={formId} className="uwe-v2-btn uwe-v2-btn-primary">
        Speichern
      </button>
      <a href={previewHref} className="uwe-v2-btn uwe-v2-btn-secondary">
        Vorschau
      </a>
    </StickyActionBar>
  );
}
