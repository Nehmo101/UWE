/**
 * Pure Ableitung eines Ablage-Vorschlags aus erkanntem Typ + Feldern.
 * Der Owner bestätigt (oder ändert) den Vorschlag — hier wird nichts abgelegt.
 */
import type {
  ExtractedFields,
  ScanDocumentKind,
  ScanFilingProposal,
  ScanFilingTarget,
  ScanReminderSuggestion,
} from "./scan-types";

const KIND_TARGET: Record<ScanDocumentKind, ScanFilingTarget> = {
  invoice: "contract",
  contract_doc: "contract",
  warranty: "life_brain",
  receipt: "pantry",
  recipe: "recipe",
  letter: "capture",
  handwritten_note: "capture",
  dnd_session_note: "dnd_session_note",
  dnd_dungeon_note: "dnd_session_note",
  dnd_handout: "dnd_handout",
  unknown: "capture",
};

const RATIONALE: Record<ScanFilingTarget, string> = {
  contract: "Rechnung/Vertrag erkannt — als Vertragsposten mit Frist ablegen.",
  capture: "Kein eindeutiges Ziel — in die Capture-Inbox zum Triagieren.",
  life_brain: "Dokument mit Referenzwert — ins Life-Brain.",
  todo: "Frist erkannt — als Todo festhalten.",
  calendar_event: "Termin erkannt — in den Kalender.",
  recipe: "Rezept erkannt — als Rezept-Entwurf.",
  pantry: "Kassenbon erkannt — Positionen nach Bestätigung in den Vorrat.",
  dnd_session_note: "Sessionnotiz — als Review-Vorschlag (kein Auto-Kanon).",
  dnd_handout: "Handout — mit getrennten DM-Geheimnissen ablegen.",
  ignore: "Nichts zu tun.",
};

/** Leitet einen Reminder-Vorschlag aus den Feldern ab (Priorität: Kündigung > Fälligkeit > Frist). */
export function deriveReminder(fields: ExtractedFields): ScanReminderSuggestion | undefined {
  if (fields.cancelByDate) {
    return { kind: "contract_cancel_by", date: fields.cancelByDate, label: "Kündigungsfrist" };
  }
  if (fields.renewalDate) {
    return { kind: "contract_cancel_by", date: fields.renewalDate, label: "Verlängerung" };
  }
  if (fields.warrantyEndDate) {
    return { kind: "calendar_event", date: fields.warrantyEndDate, label: "Garantie-Ende" };
  }
  if (fields.dueDate) {
    return { kind: "calendar_event", date: fields.dueDate, label: "Zahlung fällig" };
  }
  if (fields.deadlines && fields.deadlines.length > 0) {
    return { kind: "todo_capture", date: "", label: fields.deadlines[0] };
  }
  return undefined;
}

function proposalTitle(kind: ScanDocumentKind, fields: ExtractedFields): string {
  return (
    fields.vendor?.trim() ||
    fields.product?.trim() ||
    fields.summary?.trim() ||
    "Unbenanntes Dokument"
  ).slice(0, 120);
}

export function buildFilingProposal(
  kind: ScanDocumentKind,
  fields: ExtractedFields,
): ScanFilingProposal {
  const target = KIND_TARGET[kind] ?? "capture";
  const reminder = target === "contract" || target === "life_brain" ? deriveReminder(fields) : deriveReminder(fields);
  return {
    target,
    title: proposalTitle(kind, fields),
    fields,
    reminder,
    rationale: RATIONALE[target],
  };
}

/** Felder, die für einen belastbaren Contract-Vorschlag fehlen (→ Status „uncertain"). */
export function missingContractFields(fields: ExtractedFields): string[] {
  const missing: string[] = [];
  if (fields.amountCents == null) missing.push("Betrag");
  if (!fields.vendor) missing.push("Anbieter");
  return missing;
}
