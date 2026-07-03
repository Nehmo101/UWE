import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@uwe/database/server";
import {
  createScanInboxService,
  SCAN_FILING_TARGET_LABELS,
  SCAN_KIND_LABELS,
  SCAN_STATUS_LABELS,
  type ExtractedFields,
  type ScanFilingTarget,
} from "@uwe/scan-inbox";
import { StudioShell, PageHeader, BreadcrumbTrail } from "@/src/components/shell";
import { requireStudioAccess } from "@/src/lib/auth";
import { studioApiUrl } from "@/src/lib/studio-api-url";
import {
  analyzeWithTextAction,
  archiveScanAction,
  autoAnalyzeAction,
  fileScanAction,
  finalizeScanAction,
  rejectScanAction,
} from "../../scan-inbox-actions";

const FIELD_LABELS: Record<keyof ExtractedFields, string> = {
  vendor: "Anbieter",
  amountCents: "Betrag",
  currency: "Währung",
  dueDate: "Fällig am",
  invoiceNumber: "Rechnungsnummer",
  customerNumber: "Kundennummer",
  iban: "IBAN",
  contractNumber: "Vertragsnummer",
  startDate: "Beginn",
  cancelByDate: "Kündigen bis",
  renewalDate: "Verlängerung",
  warrantyEndDate: "Garantie bis",
  product: "Produkt",
  deadlines: "Fristen",
  summary: "Zusammenfassung",
};

const FILING_TARGETS: ScanFilingTarget[] = [
  "contract",
  "capture",
  "todo",
  "life_brain",
  "calendar_event",
  "recipe",
  "dnd_session_note",
  "dnd_handout",
];

function formatFieldValue(key: string, value: unknown): string {
  if (key === "amountCents" && typeof value === "number") {
    return (value / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  }
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
}

function fieldEntries(fields: ExtractedFields): Array<[string, unknown]> {
  return Object.entries(fields).filter(
    ([, value]) => value != null && !(Array.isArray(value) && value.length === 0),
  );
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ScanDetailPage({ params }: Props) {
  await requireStudioAccess();
  const { id } = await params;

  const scan = await createScanInboxService(prisma).get(id);
  if (!scan) notFound();

  const isImage = scan.mimeType.startsWith("image/");
  const isPdf = scan.mimeType === "application/pdf";
  const fileUrl = studioApiUrl(`/api/scan/${scan.id}/file`);
  const fields = scan.extractedFields ?? {};
  const entries = fieldEntries(fields);
  const defaultTarget = scan.proposal?.target ?? "capture";

  return (
    <StudioShell
      breadcrumb={
        <BreadcrumbTrail
          items={[{ label: "Scan Inbox", href: "/scan-inbox" }, { label: scan.title || "Scan" }]}
        />
      }
    >
      <PageHeader
        title={scan.title || "Scan"}
        summary={`${SCAN_STATUS_LABELS[scan.status as keyof typeof SCAN_STATUS_LABELS] ?? scan.status} · ${SCAN_KIND_LABELS[scan.detectedKind]}${scan.detectionConfidence ? ` · Konfidenz: ${scan.detectionConfidence}` : ""}`}
      />

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Original</h2>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fileUrl} alt={scan.title || "Scan"} style={{ maxWidth: "100%", height: "auto" }} />
        ) : (
          <p className="uwe-hint">
            {isPdf ? "PDF-Dokument. " : "Vorschau nicht verfügbar. "}
            <a href={fileUrl} target="_blank" rel="noreferrer">
              Original öffnen
            </a>
          </p>
        )}
      </section>

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">OCR-Text</h2>
        <form action={analyzeWithTextAction} className="uwe-brain-create-form">
          <input type="hidden" name="id" value={scan.id} />
          <textarea
            name="ocrText"
            rows={10}
            defaultValue={scan.ocrText}
            placeholder="Erkannten oder korrigierten Text hier einfügen und analysieren."
          />
          <div className="uwe-inline-actions">
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
              Text analysieren
            </button>
          </div>
        </form>
        <form action={autoAnalyzeAction} className="uwe-inline-actions" style={{ marginTop: "0.5rem" }}>
          <input type="hidden" name="id" value={scan.id} />
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
            Automatisch analysieren (OCR)
          </button>
        </form>
        <p className="uwe-hint">
          Auto-OCR nutzt den PDF-Textlayer oder einen lokalen RTX-Vision-Connector. Ohne Connector
          wird der Scan auf „Wartet auf RTX“ gesetzt.
        </p>
        {scan.status === "analyzing" ? (
          <form action={finalizeScanAction} className="uwe-inline-actions" style={{ marginTop: "0.5rem" }}>
            <input type="hidden" name="id" value={scan.id} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
              Vision-Ergebnis abholen
            </button>
          </form>
        ) : null}
      </section>

      {entries.length > 0 && (
        <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
          <h2 className="uwe-v2-section-title">Erkannte Felder</h2>
          <dl className="uwe-detail-list">
            {entries.map(([key, value]) => (
              <div key={key}>
                <dt>{FIELD_LABELS[key as keyof ExtractedFields] ?? key}</dt>
                <dd>{formatFieldValue(key, value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {scan.proposal && (
        <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
          <h2 className="uwe-v2-section-title">Vorschlag</h2>
          <p>
            <strong>{SCAN_FILING_TARGET_LABELS[scan.proposal.target]}</strong>
          </p>
          {scan.proposal.rationale && <p className="uwe-dashboard-muted">{scan.proposal.rationale}</p>}
          {scan.proposal.reminder && (
            <p className="uwe-hint">
              Erinnerung: {scan.proposal.reminder.label} ({scan.proposal.reminder.date})
            </p>
          )}
        </section>
      )}

      {scan.uncertainties.length > 0 && (
        <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
          <h2 className="uwe-v2-section-title">Unsicherheiten</h2>
          <ul>
            {scan.uncertainties.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="uwe-v2-card uwe-v2-card-padded uwe-v2-section">
        <h2 className="uwe-v2-section-title">Aktionen</h2>
        <form action={fileScanAction} className="uwe-brain-create-form">
          <input type="hidden" name="id" value={scan.id} />
          <label className="uwe-capture-field">
            Ablage-Ziel
            <select name="target" defaultValue={defaultTarget}>
              {FILING_TARGETS.map((target) => (
                <option key={target} value={target}>
                  {SCAN_FILING_TARGET_LABELS[target]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="uwe-v2-btn uwe-v2-btn-primary">
            Bestätigen und ablegen
          </button>
        </form>

        <div className="uwe-inline-actions" style={{ marginTop: "0.75rem" }}>
          <form action={rejectScanAction}>
            <input type="hidden" name="id" value={scan.id} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
              Ablehnen
            </button>
          </form>
          <form action={archiveScanAction}>
            <input type="hidden" name="id" value={scan.id} />
            <button type="submit" className="uwe-v2-btn uwe-v2-btn-secondary">
              Archivieren
            </button>
          </form>
        </div>
      </section>

      <p className="uwe-dashboard-muted">
        <Link href="/scan-inbox">← Zurück zur Scan Inbox</Link>
      </p>
    </StudioShell>
  );
}
