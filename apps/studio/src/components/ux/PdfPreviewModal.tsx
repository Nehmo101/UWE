"use client";

import { useCallback, useEffect, useState } from "react";

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
      <button type="button" className="uwe-v2-btn uwe-v2-btn-secondary uwe-v2-btn-sm" onClick={() => setOpen(true)}>
        PDF-Vorschau
      </button>
      {open ? (
        <div
          className="uwe-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={close}
        >
          <div
            className="uwe-modal uwe-modal-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="uwe-modal-header">
              <strong>{title}</strong>
              <button type="button" className="uwe-v2-btn uwe-v2-btn-ghost uwe-v2-btn-sm" onClick={close}>
                Schließen
              </button>
            </header>
            <iframe
              src={fileUrl}
              title={title}
              style={{ width: "100%", height: "min(80vh, 720px)", border: "none" }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
