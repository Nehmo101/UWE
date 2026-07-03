import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatAmount,
  formatGermanNumber,
  normalizeIngredientName,
  parseGermanNumber,
  parseIngredientLine,
  parseIngredientLines,
  serializeIngredientLine,
  unitGroup,
} from "./units";

describe("normalizeIngredientName", () => {
  it("lowercases, trims and collapses whitespace", () => {
    assert.equal(normalizeIngredientName("  Rote   Zwiebeln  "), "rote zwiebel");
  });

  it("maps plural and singular to the same merge key", () => {
    assert.equal(normalizeIngredientName("Tomaten"), normalizeIngredientName("Tomate"));
    assert.equal(normalizeIngredientName("Zwiebeln"), normalizeIngredientName("Zwiebel"));
  });

  it("only singularizes the last word", () => {
    assert.equal(normalizeIngredientName("Rote Zwiebeln"), "rote zwiebel");
  });

  it("is idempotent (normalize of normalized value is stable)", () => {
    const once = normalizeIngredientName("Tomaten");
    assert.equal(normalizeIngredientName(once), once);
  });

  it("returns empty string for blank input", () => {
    assert.equal(normalizeIngredientName("   "), "");
  });
});

describe("unitGroup", () => {
  it("classifies base units by measurement kind", () => {
    assert.equal(unitGroup("gram"), "mass");
    assert.equal(unitGroup("milliliter"), "volume");
    assert.equal(unitGroup("piece"), "count");
    assert.equal(unitGroup("tbsp"), "other");
    assert.equal(unitGroup("freeform"), "other");
  });
});

describe("formatGermanNumber", () => {
  it("uses a comma decimal separator without trailing zeros", () => {
    assert.equal(formatGermanNumber(1.2), "1,2");
    assert.equal(formatGermanNumber(1), "1");
    assert.equal(formatGermanNumber(0.5), "0,5");
    assert.equal(formatGermanNumber(800), "800");
  });
});

describe("formatAmount", () => {
  it("scales mass between g and kg", () => {
    assert.equal(formatAmount(800, "gram"), "800 g");
    assert.equal(formatAmount(1200, "gram"), "1,2 kg");
  });

  it("scales volume between ml and l", () => {
    assert.equal(formatAmount(250, "milliliter"), "250 ml");
    assert.equal(formatAmount(1500, "milliliter"), "1,5 l");
  });

  it("formats count and spoon-style units with short labels", () => {
    assert.equal(formatAmount(2, "piece"), "2 Stück");
    assert.equal(formatAmount(1, "tbsp"), "1 EL");
    assert.equal(formatAmount(2, "bunch", "Petersilie"), "2 Bund Petersilie");
  });

  it("handles freeform units and missing amounts", () => {
    assert.equal(formatAmount(3, "freeform", "Dosen"), "3 Dosen");
    assert.equal(formatAmount(null, "freeform", "nach Geschmack"), "nach Geschmack");
    assert.equal(formatAmount(null, "gram"), "g");
  });
});

describe("parseGermanNumber", () => {
  it("parses comma and dot decimals, rejects non-numbers", () => {
    assert.equal(parseGermanNumber("1,5"), 1.5);
    assert.equal(parseGermanNumber("800"), 800);
    assert.equal(parseGermanNumber("Salz"), null);
  });
});

describe("parseIngredientLine", () => {
  it("parses amount + unit + name", () => {
    assert.deepEqual(parseIngredientLine("800 g Tomaten"), {
      name: "Tomaten",
      amount: 800,
      unit: "gram",
    });
  });

  it("converts kg and l to base units", () => {
    assert.deepEqual(parseIngredientLine("1 kg Mehl"), {
      name: "Mehl",
      amount: 1000,
      unit: "gram",
    });
    assert.deepEqual(parseIngredientLine("1,5 l Wasser"), {
      name: "Wasser",
      amount: 1500,
      unit: "milliliter",
    });
  });

  it("parses piece amounts and bare names", () => {
    assert.deepEqual(parseIngredientLine("2 Stück Zwiebeln"), {
      name: "Zwiebeln",
      amount: 2,
      unit: "piece",
    });
    assert.deepEqual(parseIngredientLine("Salz"), {
      name: "Salz",
      amount: null,
      unit: "freeform",
    });
  });

  it("returns null for blank lines", () => {
    assert.equal(parseIngredientLine("   "), null);
  });
});

describe("serializeIngredientLine round-trips through the parser", () => {
  for (const line of ["800 g Tomaten", "2 Stück Zwiebeln", "1 EL Öl", "Salz"]) {
    it(`round-trips "${line}"`, () => {
      const parsed = parseIngredientLine(line);
      assert.ok(parsed);
      const reparsed = parseIngredientLine(serializeIngredientLine(parsed));
      assert.ok(reparsed);
      assert.equal(reparsed.name, parsed.name);
      assert.equal(reparsed.amount, parsed.amount);
      assert.equal(reparsed.unit, parsed.unit);
    });
  }
});

describe("parseIngredientLines", () => {
  it("parses multiple lines and assigns sort indexes", () => {
    const result = parseIngredientLines("800 g Tomaten\n\n2 Stück Zwiebeln\nSalz");
    assert.equal(result.length, 3);
    assert.deepEqual(
      result.map((item) => item.sortIndex),
      [0, 1, 2],
    );
    assert.equal(result[0]?.name, "Tomaten");
    assert.equal(result[2]?.name, "Salz");
  });
});
