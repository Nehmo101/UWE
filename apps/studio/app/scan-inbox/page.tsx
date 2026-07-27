import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
import { Suspense } from "react";
import { prisma } from "@uwe/database/server";
import {
  createScanInboxService,
  type ScanDocumentRecord,
  type ScanDocumentStatus,
} from "@uwe/scan-inbox";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui";
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

  const docs = await createScanInboxService(brainPrisma, prisma).list();
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

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Dokument hochladen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Briefe, Rechnungen, Verträge, Belege oder handschriftliche Notizen — als Foto oder PDF.
            </p>
            <ScanUpload />
          </CardContent>
        </Card>

        <Suspense fallback={null}>
          <AdminListSearch placeholder="Scan nach Titel, OCR-Text oder Status filtern…" />
        </Suspense>

        {q?.trim() && filteredDocs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Scans für „{q.trim()}“.</p>
        ) : null}

        <ScanInboxBoard docs={filteredDocs} statusOrder={STATUS_ORDER} byStatus={byStatusRecord} />

        <p className="text-sm text-muted-foreground">
          <Link href="/worlds">← Zurück zu den Welten</Link>
        </p>
      </div>
    </StudioShell>
  );
}
