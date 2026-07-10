/**
 * Client-safe Typen und Labels für die Scan Inbox (`@uwe/scan-inbox`).
 *
 * Keine Imports aus `@uwe/database`/generated — die String-Unions spiegeln die
 * Prisma-Enums im Schema und dürfen in Client Components genutzt werden.
 */

export type ScanDocumentStatus =
  | "unanalyzed"
  | "analyzing"
  | "waiting_for_rtx"
  | "proposal_ready"
  | "uncertain"
  | "filed"
  | "rejected"
  | "archived";

export type ScanDocumentKind =
  | "letter"
  | "invoice"
  | "contract_doc"
  | "warranty"
  | "receipt"
  | "handwritten_note"
  | "recipe"
  | "dnd_session_note"
  | "dnd_dungeon_note"
  | "dnd_handout"
  | "unknown";

export type ScanPrivacyLevel = "private" | "dnd";

/** Ablage-Ziele, die die Inbox vorschlagen/ausführen kann. */
export type ScanFilingTarget =
  | "contract"
  | "capture"
  | "life_brain"
  | "todo"
  | "calendar_event"
  | "recipe"
  | "dnd_session_note"
  | "dnd_handout"
  | "ignore";

export const SCAN_STATUS_LABELS: Record<ScanDocumentStatus, string> = {
  unanalyzed: "Unanalysiert",
  analyzing: "Wird analysiert",
  waiting_for_rtx: "Wartet auf RTX",
  proposal_ready: "Vorschlag bereit",
  uncertain: "Unsicher",
  filed: "Abgelegt",
  rejected: "Abgelehnt",
  archived: "Archiviert",
};

export const SCAN_KIND_LABELS: Record<ScanDocumentKind, string> = {
  letter: "Brief",
  invoice: "Rechnung",
  contract_doc: "Vertrag",
  warranty: "Garantie",
  receipt: "Beleg",
  handwritten_note: "Handschriftliche Notiz",
  recipe: "Rezept",
  dnd_session_note: "Sessionnotiz",
  dnd_dungeon_note: "Dungeon-Zettel",
  dnd_handout: "Handout",
  unknown: "Unbekannt",
};

export const SCAN_FILING_TARGET_LABELS: Record<ScanFilingTarget, string> = {
  contract: "Als Vertrag/Rechnung ablegen",
  capture: "In die Capture-Inbox",
  life_brain: "Als Life-Brain-Dokument",
  todo: "Als Todo",
  calendar_event: "Als Termin/Erinnerung",
  recipe: "Als Rezept",
  dnd_session_note: "Als Sessionnotiz (Review)",
  dnd_handout: "Als Handout",
  ignore: "Ignorieren",
};

/** Extrahierte Felder — kind-spezifisch, alle optional. */
export interface ExtractedFields {
  vendor?: string;
  amountCents?: number;
  currency?: string;
  dueDate?: string;
  invoiceNumber?: string;
  customerNumber?: string;
  iban?: string;
  contractNumber?: string;
  startDate?: string;
  cancelByDate?: string;
  renewalDate?: string;
  warrantyEndDate?: string;
  product?: string;
  deadlines?: string[];
  summary?: string;
}

/** Ein Reminder-Vorschlag aus einer erkannten Frist. */
export interface ScanReminderSuggestion {
  kind: "contract_cancel_by" | "calendar_event" | "todo_capture";
  date: string;
  label: string;
}

/** Der Ablage-Vorschlag, der dem Owner zur Bestätigung angezeigt wird. */
export interface ScanFilingProposal {
  target: ScanFilingTarget;
  title: string;
  fields: ExtractedFields;
  reminder?: ScanReminderSuggestion;
  /** Warum dieser Vorschlag — kurze Begründung für die UI. */
  rationale: string;
}

/** Persisted scan row shape passed to Studio UI (server-fetched, client-rendered). */
export interface ScanDocumentRecord {
  id: string;
  title: string;
  status: string;
  privacyLevel: ScanPrivacyLevel;
  mimeType: string;
  ocrText: string;
  ocrEngine: string | null;
  detectedKind: ScanDocumentKind;
  detectionConfidence: string | null;
  extractedFields: ExtractedFields | null;
  proposal: ScanFilingProposal | null;
  uncertainties: string[];
  worldId: string | null;
  filedTargetType: string | null;
  filedTargetId: string | null;
  createdAt: Date;
}

export const ACTIVE_SCAN_STATUSES: ScanDocumentStatus[] = [
  "unanalyzed",
  "analyzing",
  "waiting_for_rtx",
  "proposal_ready",
  "uncertain",
];
