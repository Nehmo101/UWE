import Link from "next/link";
import { prisma } from "@uwe/database/server";
import {
  createScanInboxService,
  SCAN_KIND_LABELS,
  SCAN_STATUS_LABELS,
  type ScanDocumentRecord,
  type ScanDocumentStatus,
} from "@uwe/scan-inbox";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { ScanUpload } from "./ScanUpload";

const STATUS_ORDER: ScanDocumentStatus[] = [
  "unanalyzed",
  "analyzing",
  "waiting_for_rtx",
  "proposal_ready",
  "uncertain",
  "filed",
  "rejected",
  "archived",
];

const DATE_FORMAT = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function ScanInboxPage() {
  await requireStudioAccess();

  const docs = await createScanInboxService(prisma).list();
  const byStatus = new Map<ScanDocumentStatus, ScanDocumentRecord[]>();
  for (const status of STATUS_ORDER) byStatus.set(status, []);
  for (const doc of docs) {
    byStatus.get(doc.status as ScanDocumentStatus)?.push(doc);
  }

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Scan Inbox" }]} />}>
      <PageHeader
        title="Scan Inbox"
        summary="Dokument hochladen oder fotografieren, per OCR analysieren und nach Bestätigung ablegen — nie automatisch."
      />

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Dokument hochladen</h2>
        <p className="uwe-hint">
          Briefe, Rechnungen, Verträge, Belege oder handschriftliche Notizen — als Foto oder PDF.
        </p>
        <ScanUpload />
      </section>

      <section className="uwe-v2-section">
        <div className="uwe-dashboard-grid">
          {STATUS_ORDER.map((status) => {
            const list = byStatus.get(status) ?? [];
            return (
              <article key={status} className="uwe-v2-card uwe-v2-card-padded">
                <h3 className="uwe-v2-section-title">
                  {SCAN_STATUS_LABELS[status]} ({list.length})
                </h3>
                {list.length === 0 ? (
                  <p className="uwe-dashboard-muted">—</p>
                ) : (
                  <div className="uwe-today-card-list">
                    {list.map((doc) => (
                      <Link
                        key={doc.id}
                        href={`/scan-inbox/${doc.id}`}
                        className="uwe-v2-card uwe-v2-card-padded uwe-capture-inbox-link"
                      >
                        <strong>{doc.title || "Ohne Titel"}</strong>
                        <span className="uwe-dashboard-muted">
                          {SCAN_KIND_LABELS[doc.detectedKind]} · {DATE_FORMAT.format(doc.createdAt)}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <p className="uwe-dashboard-muted">
        <Link href="/today">← Zurück zu Heute</Link>
      </p>
    </StudioShell>
  );
}
