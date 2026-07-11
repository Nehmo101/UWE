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
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/src/components/ui";
import {
  analyzeWithTextAction,
  archiveScanAction,
  autoAnalyzeAction,
  fileScanAction,
  finalizeScanAction,
  rejectScanAction,
  setScanDndWorldAction,
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

// Nativer Select, da hier ein echter Leerwert ("— Welt wählen —") nötig ist.
const NATIVE_SELECT_CLASS =
  "flex h-9 w-full rounded-[var(--radius)] border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

  const worlds = await prisma.world.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

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

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Original</CardTitle>
          </CardHeader>
          <CardContent>
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fileUrl} alt={scan.title || "Scan"} className="h-auto max-w-full rounded-[var(--radius)]" />
            ) : (
              <p className="text-sm text-muted-foreground">
                {isPdf ? "PDF-Dokument. " : "Vorschau nicht verfügbar. "}
                <a href={fileUrl} target="_blank" rel="noreferrer">
                  Original öffnen
                </a>
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>OCR-Text</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={analyzeWithTextAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={scan.id} />
              <Textarea
                name="ocrText"
                rows={10}
                defaultValue={scan.ocrText}
                placeholder="Erkannten oder korrigierten Text hier einfügen und analysieren."
              />
              <div className="flex flex-wrap gap-2">
                <Button type="submit">Text analysieren</Button>
              </div>
            </form>
            <form action={autoAnalyzeAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={scan.id} />
              <Button type="submit" variant="secondary">
                Automatisch analysieren (OCR)
              </Button>
            </form>
            <p className="text-sm text-muted-foreground">
              Auto-OCR nutzt den PDF-Textlayer oder einen lokalen RTX-Vision-Connector. Ohne Connector
              wird der Scan auf „Wartet auf RTX“ gesetzt.
            </p>
            {scan.status === "analyzing" ? (
              <form action={finalizeScanAction} className="flex flex-wrap gap-2">
                <input type="hidden" name="id" value={scan.id} />
                <Button type="submit" variant="secondary">
                  Vision-Ergebnis abholen
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        {entries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Erkannte Felder</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[minmax(9rem,13rem)_1fr] gap-x-4 gap-y-1.5 text-sm">
                {entries.map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-muted-foreground">
                      {FIELD_LABELS[key as keyof ExtractedFields] ?? key}
                    </dt>
                    <dd>{formatFieldValue(key, value)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        )}

        {scan.proposal && (
          <Card>
            <CardHeader>
              <CardTitle>Vorschlag</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1.5 text-sm">
              <p>
                <strong>{SCAN_FILING_TARGET_LABELS[scan.proposal.target]}</strong>
              </p>
              {scan.proposal.rationale && (
                <p className="text-muted-foreground">{scan.proposal.rationale}</p>
              )}
              {scan.proposal.reminder && (
                <p className="text-muted-foreground">
                  Erinnerung: {scan.proposal.reminder.label} ({scan.proposal.reminder.date})
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {scan.uncertainties.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Unsicherheiten</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {scan.uncertainties.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>DnD-Modus</CardTitle>
          </CardHeader>
          <CardContent>
            {scan.privacyLevel === "dnd" && scan.worldId ? (
              <p className="text-sm text-muted-foreground">
                DnD-Modus aktiv — Welt zugeordnet. DnD-Ziele (Sessionnotiz / Handout) legen
                eine Draft-Seite in der Welt an (kein Auto-Kanon).
              </p>
            ) : (
              <form action={setScanDndWorldAction} className="flex flex-col gap-3">
                <input type="hidden" name="id" value={scan.id} />
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="scan-dnd-world">Welt zuordnen (für DnD-Ablage)</Label>
                  {/* TODO(design-kit): Kit-Select verlangt einen definierten Wert; hier nativ, da ein echter Leerwert ("— Welt wählen —") benötigt wird. */}
                  <select
                    id="scan-dnd-world"
                    name="worldId"
                    defaultValue=""
                    className={NATIVE_SELECT_CLASS}
                  >
                    <option value="">— Welt wählen —</option>
                    {worlds.map((world) => (
                      <option key={world.id} value={world.id}>
                        {world.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="secondary" className="self-start">
                  DnD-Modus aktivieren
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aktionen</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <form action={fileScanAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={scan.id} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scan-filing-target">Ablage-Ziel</Label>
                <Select name="target" defaultValue={defaultTarget}>
                  <SelectTrigger id="scan-filing-target">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILING_TARGETS.map((target) => (
                      <SelectItem key={target} value={target}>
                        {SCAN_FILING_TARGET_LABELS[target]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="self-start">
                Bestätigen und ablegen
              </Button>
            </form>

            <div className="flex flex-wrap gap-2">
              <form action={rejectScanAction}>
                <input type="hidden" name="id" value={scan.id} />
                <Button type="submit" variant="secondary">
                  Ablehnen
                </Button>
              </form>
              <form action={archiveScanAction}>
                <input type="hidden" name="id" value={scan.id} />
                <Button type="submit" variant="secondary">
                  Archivieren
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground">
          <Link href="/scan-inbox">← Zurück zur Scan Inbox</Link>
        </p>
      </div>
    </StudioShell>
  );
}
