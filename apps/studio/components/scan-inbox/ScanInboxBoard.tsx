"use client";

import Link from "next/link";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import { PdfPreviewModal } from "@/src/components/ux/PdfPreviewModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";
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
    <section className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        {statusOrder.map((status) => {
          const list = byStatus[status] ?? [];
          return (
            <Card key={status}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {SCAN_STATUS_LABELS[status]} ({list.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 pt-0">
                {list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">—</p>
                ) : (
                  list.map((doc) => {
                    const isPdf = doc.mimeType === "application/pdf";
                    const fileUrl = studioApiUrl(`/api/scan/${doc.id}/file`);
                    return (
                      <Card key={doc.id} className="flex flex-col gap-1 p-4">
                        <strong>{doc.title || "Ohne Titel"}</strong>
                        <span className="text-sm text-muted-foreground">
                          {SCAN_KIND_LABELS[doc.detectedKind]} · {DATE_FORMAT.format(doc.createdAt)}
                        </span>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <Link href={`/scan-inbox/${doc.id}`}>Öffnen</Link>
                          {isPdf ? (
                            <PdfPreviewModal fileUrl={fileUrl} title={doc.title || "PDF-Scan"} />
                          ) : null}
                        </div>
                      </Card>
                    );
                  })
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{docs.length} Dokumente gesamt</p>
    </section>
  );
}
