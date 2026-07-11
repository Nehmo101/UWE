"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/src/components/ui";

interface PdfPreviewModalProps {
  fileUrl: string;
  title: string;
}

export function PdfPreviewModal({ fileUrl, title }: PdfPreviewModalProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  return (
    <>
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        PDF-Vorschau
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={close}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col gap-3 rounded-[var(--radius)] border border-border bg-card p-4 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3">
              <strong>{title}</strong>
              <Button type="button" variant="ghost" size="sm" onClick={close}>
                Schließen
              </Button>
            </header>
            <iframe src={fileUrl} title={title} className="h-[min(80vh,720px)] w-full border-0" />
          </div>
        </div>
      ) : null}
    </>
  );
}
