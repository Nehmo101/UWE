import Link from "next/link";
import { Suspense } from "react";
import { prisma } from "@uwe/database/server";
import {
  createScanInboxService,
  type ScanDocumentRecord,
  type ScanDocumentStatus,
} from "@uwe/scan-inbox";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { AdminListSearch } from "@/components/AdminListSearch";
import { matchesAdminListQuery } from "@/src/lib/admin-list-search";
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

export default async function ScanInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireStudioAccess();
  const { q } = await searchParams;

  const docs = await createScanInboxService(prisma).list();
  const filteredDocs = docs.filter((doc) =>
    matchesAdminListQuery(q, [doc.title, doc.ocrText, doc.detectedKind, doc.status]),
  );
  const byStatus = new Map<ScanDocumentStatus, ScanDocumentRecord[]>();
  for (const status of STATUS_ORDER) byStatus.set(status, []);
  for (const doc of filteredDocs) {
    byStatus.get(doc.status as ScanDocumentStatus)?.push(doc);
  }

  const byStatusRecord = Object.fromEntries(
    STATUS_ORDER.map((status) => [status, byStatus.get(status) ?? []]),
  ) as Record<ScanDocumentStatus, ScanDocumentRecord[]>;

  return (
    <StudioShell breadcrumb={<BreadcrumbTrail items={[{ label: "Scan Inbox" }]} />}>
      <PageHeader
        title="Scan Inbox"
        summary="Dokument hochladen oder fotografieren, per OCR analysieren und nach Bestätigung ablegen — nie automatisch."
      />

      <section className="uwe-v2-section">
        <h2 className="uwe-v2-section-title">Dokument hochladen</h2>
        <p className="uwe-hint">
          Briefe, Rechnungen, Verträge, Belege oder handschriftliche Notizen — als Foto oder PDF.
        </p>
        <ScanUpload />
      </section>

      <Suspense fallback={null}>
        <AdminListSearch placeholder="Scan nach Titel, OCR-Text oder Status filtern…" />
      </Suspense>

      {q?.trim() && filteredDocs.length === 0 ? (
        <p className="uwe-dashboard-muted">Keine Scans für „{q.trim()}“.</p>
      ) : null}

      <ScanInboxBoard docs={filteredDocs} statusOrder={STATUS_ORDER} byStatus={byStatusRecord} />

      <p className="uwe-dashboard-muted">
        <Link href="/today">← Zurück zu Heute</Link>
      </p>
    </StudioShell>
  );
}
