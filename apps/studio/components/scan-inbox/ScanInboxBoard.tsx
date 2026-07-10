"use client";

import Link from "next/link";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { PdfPreviewModal } from "@/src/components/ux/PdfPreviewModal";
import {
  SCAN_KIND_LABELS,
  SCAN_STATUS_LABELS,
  type ScanDocumentRecord,
  type ScanDocumentStatus,
} from "@uwe/scan-inbox/scan-types";

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

interface Props {
  docs: ScanDocumentRecord[];
  byStatus: Record<ScanDocumentStatus, ScanDocumentRecord[]>;
  statusOrder: ScanDocumentStatus[];
}

export function ScanInboxBoard({ docs, byStatus, statusOrder }: Props) {
  return (
    <section className="uwe-v2-section">
      <div className="uwe-dashboard-grid">
        {statusOrder.map((status) => {
          const list = byStatus[status] ?? [];
          return (
            <article key={status} className="uwe-v2-card uwe-v2-card-padded">
              <h3 className="uwe-v2-section-title">
                {SCAN_STATUS_LABELS[status]} ({list.length})
              </h3>
              {list.length === 0 ? (
                <p className="uwe-dashboard-muted">—</p>
              ) : (
                <div className="uwe-today-card-list">
                  {list.map((doc) => {
                    const isPdf = doc.mimeType === "application/pdf";
                    const fileUrl = studioApiUrl(`/api/scan/${doc.id}/file`);
                    return (
                      <div key={doc.id} className="uwe-v2-card uwe-v2-card-padded uwe-capture-inbox-link">
                        <strong>{doc.title || "Ohne Titel"}</strong>
                        <span className="uwe-dashboard-muted">
                          {SCAN_KIND_LABELS[doc.detectedKind]} · {DATE_FORMAT.format(doc.createdAt)}
                        </span>
                        <div className="uwe-inline-actions" style={{ marginTop: "0.35rem" }}>
                          <Link href={`/scan-inbox/${doc.id}`}>Öffnen</Link>
                          {isPdf ? (
                            <PdfPreviewModal fileUrl={fileUrl} title={doc.title || "PDF-Scan"} />
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
      <p className="uwe-dashboard-muted" style={{ marginTop: "0.5rem" }}>
        {docs.length} Dokumente gesamt
      </p>
    </section>
  );
}
