"use client";

import { StickyActionBar } from "@uwe/shared-ui";
import { Button, buttonVariants } from "@/src/components/ui";

export function EditPageStickyBar({
  previewHref,
  formId = "world-page-edit-form",
}: {
  previewHref: string;
  formId?: string;
}) {
  return (
    <StickyActionBar>
      <Button type="submit" form={formId}>
        Speichern
      </Button>
      <Button type="submit" form={formId} variant="secondary" name="returnTo" value="view">
        Speichern & Ansicht
      </Button>
      <a href={previewHref} className={buttonVariants({ variant: "secondary" })}>
        Vorschau
      </a>
    </StickyActionBar>
  );
}
