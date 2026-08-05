/**
 * Pure Analyse-Komposition: aus OCR-Text → Typ, Felder, Ablage-Vorschlag,
 * Unsicherheiten. Das ist das Herz der „Analyse" und komplett testbar; die
 * Beschaffung des Textes (PDF-Layer oder Connector-Vision) passiert außerhalb.
 */
import { detectKind, extractFieldsForKind } from "./kind-detection";
import { buildFilingProposal, missingContractFields } from "./proposal-builder";
import type { ExtractedFields, ScanDocumentKind, ScanFilingProposal } from "./scan-types";

export interface ScanAnalysis {
  detectedKind: ScanDocumentKind;
  confidence: "low" | "medium" | "high";
  fields: ExtractedFields;
  proposal: ScanFilingProposal;
  uncertainties: string[];
  /** true → Status sollte „uncertain" statt „proposal_ready" werden. */
  needsReview: boolean;
}

export function analyzeScanText(text: string): ScanAnalysis {
  const detection = detectKind(text);
  const fields = extractFieldsForKind(detection.kind, text);
  const proposal = buildFilingProposal(detection.kind, fields);

  const uncertainties: string[] = [];
  if (detection.kind === "unknown") {
    uncertainties.push("Dokumenttyp nicht erkannt.");
  }
  if (detection.confidence === "low" && detection.kind !== "unknown") {
    uncertainties.push("Typ-Erkennung unsicher (wenige Treffer).");
  }
  if (proposal.target === "contract") {
    for (const missing of missingContractFields(fields)) {
      uncertainties.push(`Feld fehlt: ${missing}.`);
    }
  }
  if (proposal.target === "pantry" && !(fields.receiptItems?.length)) {
    uncertainties.push("Keine Bon-Positionen erkannt — Vorrats-Ablage wäre leer.");
  }
  if (!text.trim()) {
    uncertainties.push("Kein Text erkannt — evtl. Bildqualität zu gering.");
  }

  return {
    detectedKind: detection.kind,
    confidence: detection.confidence,
    fields,
    proposal,
    uncertainties,
    needsReview: uncertainties.length > 0,
  };
}
