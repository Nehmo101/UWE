import Link from "next/link";
import { brainPrisma } from "@uwe/database/brain-client";
import { prisma } from "@uwe/database/server";
import {
  createScanInboxService,
  SCAN_KIND_LABELS,
  SCAN_STATUS_LABELS,
  type ScanDocumentRecord,
  type ScanDocumentStatus,
} from "@uwe/scan-inbox";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import { ScanUpload } from "./ScanUpload";

/**
 * Scan-Eingang — fotografieren oder hochladen, per OCR analysieren, nach
 * Bestätigung ablegen.
 *
 * Nichts wird automatisch abgelegt: die Analyse macht einen Vorschlag, den
 * jemand annimmt oder verwirft. Genau deshalb gibt es die Statusspalten.
 */

export const dynamic = "force-dynamic";

const STATUS_ORDER: ScanDocumentStatus[] = [
  "unanalyzed",
  "analyzing",
  "waiting_for_engine",
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

export default async function FamilyScanInboxPage() {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/scan-inbox" title="Scan-Eingang">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const docs = await createScanInboxService(brainPrisma, prisma).list();
  const byStatus = new Map<ScanDocumentStatus, ScanDocumentRecord[]>();
  for (const status of STATUS_ORDER) byStatus.set(status, []);
  for (const doc of docs) {
    byStatus.get(doc.status as ScanDocumentStatus)?.push(doc);
  }
  const open = docs.filter(
    (doc) => doc.status === "proposal_ready" || doc.status === "uncertain",
  ).length;

  return (
    <FamilyShell
      active="/scan-inbox"
      title="Scan-Eingang"
      eyebrow="Gemeinsamer Bereich"
      lede={`${docs.length} Dokument(e), davon ${open} zur Prüfung. Abgelegt wird nur, was jemand bestätigt.`}
    >
      <section className="family-section">
        <h2>Dokument hochladen</h2>
        <p className="family-muted">
          Briefe, Rechnungen, Verträge, Belege oder handschriftliche Notizen — als Foto oder PDF.
        </p>
        <ScanUpload />
      </section>

      {STATUS_ORDER.map((status) => {
        const list = byStatus.get(status) ?? [];
        if (list.length === 0) return null;
        return (
          <section className="family-section" key={status}>
            <h2>
              {SCAN_STATUS_LABELS[status]} · {list.length}
            </h2>
            <ul className="family-list">
              {list.map((doc) => (
                <li key={doc.id} className="family-row">
                  <div className="family-row-head">
                    <strong>
                      <Link href={`/scan-inbox/${doc.id}`}>{doc.title || "Ohne Titel"}</Link>
                    </strong>
                    <span className="family-tag">{SCAN_KIND_LABELS[doc.detectedKind]}</span>
                    <span className="family-muted">{DATE_FORMAT.format(doc.createdAt)}</span>
                    {doc.mimeType === "application/pdf" ? (
                      <a
                        href={`/api/scan/${doc.id}/file`}
                        className="family-muted"
                        style={{ marginLeft: "auto" }}
                        target="_blank"
                        rel="noreferrer"
                      >
                        PDF öffnen
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {docs.length === 0 ? (
        <p className="family-muted">Noch nichts eingescannt.</p>
      ) : null}
    </FamilyShell>
  );
}
