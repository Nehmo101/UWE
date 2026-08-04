import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractAmountCents,
  extractContractFields,
  extractDates,
  extractIban,
  extractInvoiceFields,
  parseGermanAmountToCents,
} from "./field-extraction";
import { detectKind, extractFieldsForKind } from "./kind-detection";
import { buildFilingProposal, deriveReminder, missingContractFields } from "./proposal-builder";
import { analyzeScanText } from "./analyze";

describe("field extraction (pure)", () => {
  it("parses German amounts to cents", () => {
    assert.equal(parseGermanAmountToCents("84,99"), 8499);
    assert.equal(parseGermanAmountToCents("1.234,56"), 123456);
    assert.equal(parseGermanAmountToCents("1234.56"), 123456);
    assert.equal(parseGermanAmountToCents("abc"), null);
  });

  it("extracts a Euro amount", () => {
    assert.deepEqual(extractAmountCents("Rechnungsbetrag 84,99 €"), { amountCents: 8499, currency: "EUR" });
    assert.deepEqual(extractAmountCents("Summe: 1.299,00 EUR"), { amountCents: 129900, currency: "EUR" });
    assert.equal(extractAmountCents("kein Betrag"), null);
  });

  it("extracts full dates as ISO and ignores day-month fragments", () => {
    assert.deepEqual(extractDates("fällig am 15.07.2026, Vertrag ab 01.01.2026"), ["2026-07-15", "2026-01-01"]);
    assert.deepEqual(extractDates("zum 31.03. kündbar"), []);
    assert.deepEqual(extractDates("32.13.2026"), []);
  });

  it("extracts an IBAN", () => {
    assert.equal(extractIban("IBAN DE89 3704 0044 0532 0130 00"), "DE89370400440532013000");
    assert.equal(extractIban("keine iban hier"), null);
  });

  it("extracts invoice fields from a German invoice", () => {
    const text = "Stadtwerke Musterstadt\nRechnungsnummer: RG-2026-0815\nKundennummer 44231\nRechnungsbetrag 84,99 €\nzahlbar bis 15.07.2026";
    const fields = extractInvoiceFields(text);
    assert.equal(fields.amountCents, 8499);
    assert.equal(fields.dueDate, "2026-07-15");
    assert.equal(fields.invoiceNumber, "RG-2026-0815");
    assert.equal(fields.customerNumber, "44231");
    assert.equal(fields.vendor, "Stadtwerke Musterstadt");
  });

  it("extracts contract deadlines", () => {
    const fields = extractContractFields("Mobilfunkvertrag\nKündigungsfrist: 3 Monate vor Laufzeitende\nVertragsnummer VN-99");
    assert.equal(fields.contractNumber, "VN-99");
    assert.ok(fields.deadlines && fields.deadlines.some((d) => /Kündigungsfrist/.test(d)));
  });
});

describe("kind detection (pure)", () => {
  it("detects an invoice with high confidence", () => {
    const result = detectKind("Rechnung\nRechnungsnummer 5\nRechnungsbetrag 10 €\nzahlbar bis morgen");
    assert.equal(result.kind, "invoice");
    assert.equal(result.confidence, "high");
  });

  it("detects a contract", () => {
    assert.equal(detectKind("Vertrag mit Kündigungsfrist und Laufzeit").kind, "contract_doc");
  });

  it("returns unknown for empty text", () => {
    assert.equal(detectKind("   ").kind, "unknown");
  });

  it("routes field extraction by kind", () => {
    const fields = extractFieldsForKind("invoice", "Betrag 5,00 €");
    assert.equal(fields.amountCents, 500);
  });
});

describe("proposal builder (pure)", () => {
  it("proposes a contract target for invoices with a reminder", () => {
    const proposal = buildFilingProposal("invoice", { vendor: "Stadtwerke", amountCents: 8499, dueDate: "2026-07-15" });
    assert.equal(proposal.target, "contract");
    assert.equal(proposal.title, "Stadtwerke");
    assert.equal(proposal.reminder?.kind, "calendar_event");
  });

  it("prioritises cancellation date in reminders", () => {
    const reminder = deriveReminder({ cancelByDate: "2026-09-30", dueDate: "2026-07-15" });
    assert.equal(reminder?.kind, "contract_cancel_by");
    assert.equal(reminder?.date, "2026-09-30");
  });

  it("flags missing contract fields", () => {
    assert.deepEqual(missingContractFields({}), ["Betrag", "Anbieter"]);
    assert.deepEqual(missingContractFields({ amountCents: 1, vendor: "x" }), []);
  });
});

describe("analyzeScanText (pure composition)", () => {
  it("produces a ready proposal for a complete invoice", () => {
    const analysis = analyzeScanText("Stadtwerke\nRechnung\nRechnungsbetrag 84,99 €\nzahlbar bis 15.07.2026\nRechnungsnummer 7");
    assert.equal(analysis.detectedKind, "invoice");
    assert.equal(analysis.proposal.target, "contract");
    assert.equal(analysis.needsReview, false);
    assert.equal(analysis.uncertainties.length, 0);
  });

  it("marks review needed when the type is unknown", () => {
    const analysis = analyzeScanText("völlig unklarer text ohne signale hier");
    assert.equal(analysis.detectedKind, "unknown");
    assert.equal(analysis.needsReview, true);
    assert.ok(analysis.uncertainties.length > 0);
  });

  it("marks review needed for a contract missing amount/vendor", () => {
    const analysis = analyzeScanText("Vertrag\nKündigungsfrist 3 Monate\nLaufzeit 24 Monate");
    assert.equal(analysis.proposal.target, "contract");
    assert.ok(analysis.uncertainties.some((u) => /Betrag/.test(u)));
  });
});

describe("analyzeScanText (Kassenbon → Vorrat)", () => {
  const BON = [
    "REWE Markt GmbH",
    "Kassenbon",
    "WRAPS WEIZEN 1,99 A",
    "GURKE 0,49 A",
    "SUMME 2,48",
    "Vielen Dank für Ihren Einkauf",
  ].join("\n");

  it("routes a receipt with items to the pantry target", () => {
    const analysis = analyzeScanText(BON);
    assert.equal(analysis.detectedKind, "receipt");
    assert.equal(analysis.proposal.target, "pantry");
    assert.deepEqual(
      analysis.fields.receiptItems?.map((item) => item.name),
      ["WRAPS WEIZEN", "GURKE"],
    );
    // Bon-Summe schlägt den ersten Geldbetrag der Rechnungs-Heuristik.
    assert.equal(analysis.fields.amountCents, 248);
  });

  it("marks review needed when a receipt has no parseable items", () => {
    const analysis = analyzeScanText("Kassenbon Beleg Quittung Summe");
    assert.equal(analysis.proposal.target, "pantry");
    assert.ok(analysis.uncertainties.some((u) => /Bon-Positionen/.test(u)));
    assert.equal(analysis.needsReview, true);
  });
});
