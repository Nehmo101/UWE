import Link from "next/link";
import { notFound } from "next/navigation";
import { brainPrisma } from "@uwe/database/brain-client";
import { prisma } from "@uwe/database/server";
import {
  createScanInboxService,
  SCAN_FILING_TARGET_LABELS,
  SCAN_KIND_LABELS,
  SCAN_STATUS_LABELS,
  type ExtractedFields,
  type ScanFilingTarget,
} from "@uwe/scan-inbox";
import { getFamilyUser } from "@/src/lib/page-family";
import { FamilyShell, FamilyDenied } from "@/src/components/FamilyShell";
import {
  analyzeWithTextAction,
  archiveScanAction,
  autoAnalyzeAction,
  fileScanAction,
  finalizeScanAction,
  rejectScanAction,
  setScanDndWorldAction,
} from "../../scan-inbox-actions";

/**
 * Ein Scan: Original ansehen, Text prüfen, Ziel bestätigen.
 *
 * Die Reihenfolge auf der Seite ist die Reihenfolge der Arbeit — Bild, Text,
 * erkannte Felder, Vorschlag, Ablage. Der letzte Schritt ist immer eine
 * bewusste Bestätigung; automatisch wird nichts abgelegt.
 */

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

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

export default async function FamilyScanDetailPage({ params }: Props) {
  const user = await getFamilyUser();
  if (!user) {
    return (
      <FamilyShell active="/scan-inbox" title="Scan">
        <FamilyDenied />
      </FamilyShell>
    );
  }

  const { id } = await params;
  const scan = await createScanInboxService(brainPrisma, prisma).get(id);
  if (!scan) notFound();

  const worlds = await prisma.world.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const isImage = scan.mimeType.startsWith("image/");
  const isPdf = scan.mimeType === "application/pdf";
  const fileUrl = `/api/scan/${scan.id}/file`;
  const entries = fieldEntries(scan.extractedFields ?? {});
  const defaultTarget = scan.proposal?.target ?? "capture";

  return (
    <FamilyShell
      active="/scan-inbox"
      title={scan.title || "Scan"}
      eyebrow="Scan-Eingang"
      lede={`${SCAN_STATUS_LABELS[scan.status as keyof typeof SCAN_STATUS_LABELS] ?? scan.status} · ${SCAN_KIND_LABELS[scan.detectedKind]}${scan.detectionConfidence ? ` · Konfidenz ${scan.detectionConfidence}` : ""}`}
      actions={
        <Link href="/scan-inbox" className="family-btn family-btn-ghost family-btn-sm">
          ← Scan-Eingang
        </Link>
      }
    >
      <section className="family-section">
        <h2>Original</h2>
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl}
            alt={scan.title || "Scan"}
            style={{ maxWidth: "100%", height: "auto", borderRadius: "0.75rem" }}
          />
        ) : (
          <p className="family-muted">
            {isPdf ? "PDF-Dokument. " : "Keine Vorschau. "}
            <a href={fileUrl} target="_blank" rel="noreferrer">
              Original öffnen
            </a>
          </p>
        )}
      </section>

      <section className="family-section">
        <h2>Text</h2>
        <form action={analyzeWithTextAction} className="family-form family-card">
          <input type="hidden" name="id" value={scan.id} />
          <label>
            Erkannter Text
            <textarea
              name="ocrText"
              rows={10}
              defaultValue={scan.ocrText}
              placeholder="Text einfügen oder korrigieren und analysieren."
            />
          </label>
          <div>
            <button type="submit" className="family-btn">
              Text analysieren
            </button>
          </div>
        </form>
        <div className="family-head-actions">
          <form action={autoAnalyzeAction}>
            <input type="hidden" name="id" value={scan.id} />
            <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
              Automatisch analysieren (OCR)
            </button>
          </form>
          {scan.status === "analyzing" ? (
            <form action={finalizeScanAction}>
              <input type="hidden" name="id" value={scan.id} />
              <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
                Vision-Ergebnis abholen
              </button>
            </form>
          ) : null}
        </div>
        <p className="family-muted">
          Auto-OCR nutzt den PDF-Textlayer oder den lokalen Maschinenraum-Vision-Connector. Ohne Connector
          bleibt der Scan auf &bdquo;Wartet auf Maschinenraum&ldquo;.
        </p>
      </section>

      {entries.length > 0 ? (
        <section className="family-section">
          <h2>Erkannte Felder</h2>
          <ul className="family-list">
            {entries.map(([key, value]) => (
              <li key={key} className="family-row">
                <div className="family-row-head">
                  <strong>{FIELD_LABELS[key as keyof ExtractedFields] ?? key}</strong>
                  <span className="family-muted">{formatFieldValue(key, value)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {scan.proposal ? (
        <section className="family-section">
          <h2>Vorschlag</h2>
          <p className="family-callout">
            <strong>{SCAN_FILING_TARGET_LABELS[scan.proposal.target]}</strong>
            {scan.proposal.rationale ? ` — ${scan.proposal.rationale}` : ""}
            {scan.proposal.reminder
              ? ` · Erinnerung: ${scan.proposal.reminder.label} (${scan.proposal.reminder.date})`
              : ""}
          </p>
        </section>
      ) : null}

      {scan.uncertainties.length > 0 ? (
        <section className="family-section">
          <h2>Unsicherheiten</h2>
          <ul className="family-list">
            {scan.uncertainties.map((item, index) => (
              <li key={index} className="family-callout family-callout-warn">
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="family-section">
        <h2>Ablegen</h2>
        <form action={fileScanAction} className="family-form family-card">
          <input type="hidden" name="id" value={scan.id} />
          <label>
            Ziel
            <select name="target" defaultValue={defaultTarget}>
              {FILING_TARGETS.map((target) => (
                <option key={target} value={target}>
                  {SCAN_FILING_TARGET_LABELS[target]}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button type="submit" className="family-btn">
              Bestätigen und ablegen
            </button>
          </div>
        </form>
        <div className="family-head-actions">
          <form action={rejectScanAction}>
            <input type="hidden" name="id" value={scan.id} />
            <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
              Ablehnen
            </button>
          </form>
          <form action={archiveScanAction}>
            <input type="hidden" name="id" value={scan.id} />
            <button type="submit" className="family-btn family-btn-ghost family-btn-sm">
              Archivieren
            </button>
          </form>
        </div>
      </section>

      <section className="family-section">
        <h2>D&amp;D-Modus</h2>
        {scan.privacyLevel === "dnd" && scan.worldId ? (
          <p className="family-muted">
            Aktiv, Welt zugeordnet. Die D&amp;D-Ziele legen eine Entwurfsseite in der Welt an —
            nichts wird automatisch Kanon.
          </p>
        ) : (
          <form action={setScanDndWorldAction} className="family-form family-card">
            <input type="hidden" name="id" value={scan.id} />
            <label>
              Welt zuordnen
              <select name="worldId" defaultValue="">
                <option value="">— Welt wählen —</option>
                {worlds.map((world) => (
                  <option key={world.id} value={world.id}>
                    {world.name}
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button type="submit" className="family-btn family-btn-sm">
                D&amp;D-Modus aktivieren
              </button>
            </div>
          </form>
        )}
      </section>
    </FamilyShell>
  );
}
