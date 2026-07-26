import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dedupeNavSearchEntries,
  navSearchTokens,
  normalizeSearchText,
  searchNavEntries,
  type NavSearchEntry,
} from "./nav-search";

/** Ausschnitt der echten Studio-IA — die Rangfolge muss auf realen Labels stimmen. */
const studio: NavSearchEntry[] = [
  { id: "start-today", label: "Heute", href: "/today", group: "Start", keywords: ["heute", "today", "cockpit"] },
  { id: "start-search", label: "Suche", href: "/search", group: "Start", keywords: ["suche", "search"] },
  { id: "ai-hub", label: "KI & Generatoren", href: "/ai", group: "AI & Generatoren", keywords: ["ki", "ai", "generator"] },
  { id: "ai-gateway", label: "AI Gateway", href: "/admin/ai-gateway", group: "AI & Generatoren", keywords: ["gateway", "provider"] },
  { id: "tools-kitchen", label: "Küche", href: "/kitchen", group: "Werkzeuge / Alltag", keywords: ["kitchen", "rezepte", "kochen"] },
  { id: "tools-jobs", label: "Hintergrund-Jobs", href: "/jobs", group: "Werkzeuge / Automatisierung", keywords: ["jobs", "queue"] },
  { id: "knowledge-brain", label: "Brain Store", href: "/brain", group: "Knowledge & Brain", keywords: ["wissen", "canon"] },
];

function labels(query: string, limit = 8): string[] {
  return searchNavEntries(studio, query, { limit }).map((hit) => hit.label);
}

describe("normalizeSearchText", () => {
  it("schreibt Umlaute aus und entfernt Diakritika", () => {
    assert.equal(normalizeSearchText("Küche"), "kueche");
    assert.equal(normalizeSearchText("Straße"), "strasse");
    assert.equal(normalizeSearchText("Café"), "cafe");
  });

  it("reduziert Sonderzeichen auf Wortgrenzen", () => {
    assert.equal(normalizeSearchText("KI & Generatoren"), "ki generatoren");
    assert.equal(normalizeSearchText("/admin/ai-gateway"), "admin ai gateway");
  });

  it("liefert für reine Sonderzeichen einen leeren String", () => {
    assert.equal(normalizeSearchText("  ///  "), "");
  });
});

describe("navSearchTokens", () => {
  it("zerlegt die Abfrage in Wörter", () => {
    assert.deepEqual(navSearchTokens("  Brain   Store "), ["brain", "store"]);
  });

  it("ist bei leerer Abfrage leer", () => {
    assert.deepEqual(navSearchTokens("   "), []);
  });
});

describe("searchNavEntries", () => {
  it("schlägt zu „Ki“ die Seite „KI & Generatoren“ zuerst vor", () => {
    assert.equal(labels("Ki")[0], "KI & Generatoren");
  });

  it("lässt kurze Suchwörter nicht mitten im Wort treffen („ki“ ≠ „Wiki“)", () => {
    const entries: NavSearchEntry[] = [
      { id: "wiki", label: "Wiki / Seiten", href: "/wiki" },
      { id: "ai", label: "KI & Generatoren", href: "/ai" },
    ];
    assert.deepEqual(
      searchNavEntries(entries, "ki").map((hit) => hit.id),
      ["ai"],
    );
    // Ab drei Zeichen bleiben Treffer im Wortinneren erlaubt.
    assert.deepEqual(
      searchNavEntries(entries, "eite").map((hit) => hit.id),
      ["wiki"],
    );
  });

  it("liefert ohne Abfrage keine Treffer", () => {
    assert.deepEqual(searchNavEntries(studio, ""), []);
    assert.deepEqual(searchNavEntries(studio, "   "), []);
  });

  it("findet Umlaut-Labels auch ohne Umlaut-Eingabe", () => {
    assert.equal(labels("kuche")[0], "Küche");
    assert.equal(labels("küche")[0], "Küche");
  });

  it("gewichtet den Label-Präfix höher als einen Keyword-Treffer", () => {
    const hits = labels("ai");
    assert.equal(hits[0], "AI Gateway");
    assert.ok(hits.includes("KI & Generatoren"));
  });

  it("findet Einträge über Keywords, die nicht im Label stehen", () => {
    assert.equal(labels("rezepte")[0], "Küche");
    assert.equal(labels("canon")[0], "Brain Store");
  });

  it("findet Einträge über den Routen-Pfad", () => {
    assert.ok(labels("kitchen").includes("Küche"));
  });

  it("verlangt, dass jedes Suchwort trifft", () => {
    assert.deepEqual(labels("brain store"), ["Brain Store"]);
    assert.deepEqual(labels("brain zzz"), []);
  });

  it("findet Teilwörter innerhalb zusammengesetzter Labels", () => {
    assert.ok(labels("jobs").includes("Hintergrund-Jobs"));
  });

  it("begrenzt die Trefferzahl", () => {
    assert.ok(searchNavEntries(studio, "ai").length > 1);
    assert.equal(searchNavEntries(studio, "ai", { limit: 1 }).length, 1);
  });

  it("sortiert stabil: gleiche Punkte → kürzeres Label zuerst", () => {
    const entries: NavSearchEntry[] = [
      { id: "long", label: "Alpha Beta Gamma", href: "/long" },
      { id: "short", label: "Alpha Beta", href: "/short" },
    ];
    assert.deepEqual(
      searchNavEntries(entries, "alpha").map((hit) => hit.id),
      ["short", "long"],
    );
  });

  it("liefert den Punktwert für die Anzeige-Sortierung mit", () => {
    const [best] = searchNavEntries(studio, "heute");
    assert.ok(best && best.score > 0);
    assert.equal(best?.href, "/today");
  });
});

describe("dedupeNavSearchEntries", () => {
  it("behält den ersten Eintrag je Ziel", () => {
    const deduped = dedupeNavSearchEntries([
      { id: "world-brain", label: "Brain (Welt)", href: "/brain" },
      { id: "knowledge-brain", label: "Brain Store", href: "/brain/" },
      { id: "today", label: "Heute", href: "/today" },
    ]);
    assert.deepEqual(
      deduped.map((entry) => entry.id),
      ["world-brain", "today"],
    );
  });
});
