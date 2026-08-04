import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseReceiptText } from "./parse-receipt";

const REWE_BON = [
  "REWE Markt GmbH",
  "Musterstraße 1",
  "12345 Berlin",
  "WRAPS WEIZEN 1,99 A",
  "GURKE 0,49 A",
  "BIO JOGHURT 0,89 A",
  "  2 x 0,89",
  "HACKFL. GEM. 3,49 A",
  "  0,486 kg x 7,18 /kg",
  "PFAND 0,25 A",
  "RABATT COUPON -0,50",
  "SUMME 7,35",
  "Geg. BAR 10,00",
  "Rückgeld 2,65",
  "14.07.2026 18:32 Bon-Nr. 4711",
  "Vielen Dank für Ihren Einkauf",
].join("\n");

describe("parseReceiptText (pure)", () => {
  it("extracts item lines with prices and skips totals, deposit, discounts, payment", () => {
    const parsed = parseReceiptText(REWE_BON);
    assert.deepEqual(
      parsed.items.map((item) => item.name),
      ["WRAPS WEIZEN", "GURKE", "BIO JOGHURT", "HACKFL. GEM."],
    );
    assert.equal(parsed.items[0].priceCents, 199);
    assert.equal(parsed.items[1].priceCents, 49);
  });

  it("attaches quantity lines to the preceding item (piece and weight)", () => {
    const parsed = parseReceiptText(REWE_BON);
    assert.equal(parsed.items[2].quantity, 2);
    assert.equal(parsed.items[3].quantity, 0.486);
  });

  it("reads the total from the SUMME line", () => {
    assert.equal(parseReceiptText(REWE_BON).totalCents, 735);
  });

  it("returns an empty list for text without receipt structure (no false positives)", () => {
    const parsed = parseReceiptText("Lieber Max,\ndanke für deinen Brief.\nViele Grüße");
    assert.equal(parsed.items.length, 0);
    assert.equal(parsed.totalCents, null);
  });

  it("ignores negative (discount) prices and price-less lines", () => {
    const parsed = parseReceiptText("GUTSCHEIN -1,00\nÄPFEL 2,49\nirgendein Text");
    assert.deepEqual(parsed.items.map((item) => item.name), ["ÄPFEL"]);
  });
});
