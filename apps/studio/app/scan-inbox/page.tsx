import Link from "next/link";
import { prisma } from "@uwe/database/server";
import {
  createScanInboxService,
  type ScanDocumentRecord,
  type ScanDocumentStatus,
} from "@uwe/scan-inbox";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { ScanUpload } from "./ScanUpload";
import { ScanInboxBoard } from "@/components/scan-inbox/ScanInboxBoard";

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

      <ScanInboxBoard
        docs={docs}
        statusOrder={STATUS_ORDER}
        byStatus={Object.fromEntries(STATUS_ORDER.map((status) => [status, byStatus.get(status) ?? []])) as Record<ScanDocumentStatus, ScanDocumentRecord[]>}
      />

      <p className="uwe-dashboard-muted">
        <Link href="/today">← Zurück zu Heute</Link>
      </p>
    </StudioShell>
  );
}
