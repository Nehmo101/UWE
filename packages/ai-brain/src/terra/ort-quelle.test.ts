import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pageTypesForNavCategory } from "@uwe/database/page-types";

import {
  TERRA_ORT_PROMPT_MAX,
  TERRA_ORT_SEITENTYPEN,
  TERRA_ORT_TYP_LABELS,
  baueTerraOrtPrompt,
  istTerraOrtSeitentyp,
  ortQuellenAusSeiten,
  promptNachOrtwechsel,
} from "./ort-quelle";
import type { TerraOrtQuelle } from "./ort-quelle";

/**
 * `ort-quelle.ts` importiert `@uwe/database` bewusst NICHT — es läuft im
 * Client-Bündel des Bedienfelds mit. Die Kopplung an das Schema wird
 * stattdessen hier geprüft, wo ein Import unbedenklich ist: die Liste der
 * bebaubaren Ort-Typen muss eine Teilmenge der Navigationskategorie `orte`
 * sein, und ihre Ergänzung muss genau die vier Inhalte sein, die absichtlich
 * draußen bleiben. Kommt ein neuer Ort-Typ ins Schema, fällt der zweite Test —
 * und jemand entscheidet, statt dass der Typ still fehlt.
 */
describe("TERRA_ORT_SEITENTYPEN gegen das Schema", () => {
  const orteKategorie = pageTypesForNavCategory("orte");

  it("ist eine Teilmenge der Navigationskategorie orte", () => {
    for (const typ of TERRA_ORT_SEITENTYPEN) {
      assert.ok(orteKategorie.includes(typ), `${typ} steht nicht in der Kategorie orte`);
    }
  });

  it("lässt genau die Inhalte ohne Ausdehnung draußen", () => {
    const draussen = orteKategorie
      .filter((typ) => !(TERRA_ORT_SEITENTYPEN as readonly string[]).includes(typ))
      .sort();
    assert.deepEqual(draussen, ["loot", "puzzle", "secret", "trap"]);
  });

  it("hat für jeden Typ ein Anzeigelabel", () => {
    for (const typ of TERRA_ORT_SEITENTYPEN) {
      assert.ok(TERRA_ORT_TYP_LABELS[typ]?.length > 0, `${typ} ohne Label`);
    }
  });

  it("erkennt Fremdtypen nicht als Ort", () => {
    assert.equal(istTerraOrtSeitentyp("location"), true);
    assert.equal(istTerraOrtSeitentyp("npc"), false);
    assert.equal(istTerraOrtSeitentyp("trap"), false);
  });
});

describe("ortQuellenAusSeiten", () => {
  it("filtert Nicht-Orte und Seiten ohne Titel", () => {
    const quellen = ortQuellenAusSeiten([
      { slug: "moewenfurt", title: "Möwenfurt", type: "location" },
      { slug: "gundrik", title: "Gundrik", type: "npc" },
      { slug: "namenlos", title: "   ", type: "region" },
      { slug: "", title: "Ohne Slug", type: "region" },
    ]);
    assert.deepEqual(
      quellen.map((q) => q.slug),
      ["moewenfurt"],
    );
  });

  it("sortiert von der Region zur Kammer, innerhalb der Stufe alphabetisch", () => {
    const quellen = ortQuellenAusSeiten([
      { slug: "kammer", title: "Kammer", type: "room" },
      { slug: "salzhafen", title: "Salzhafen", type: "location" },
      { slug: "kueste", title: "Die Graue Küste", type: "region" },
      { slug: "moewenfurt", title: "Möwenfurt", type: "location" },
    ]);
    assert.deepEqual(
      quellen.map((q) => q.slug),
      ["kueste", "moewenfurt", "salzhafen", "kammer"],
    );
  });

  it("normalisiert Schlagworte und kürzt lange Zusammenfassungen", () => {
    const [quelle] = ortQuellenAusSeiten([
      {
        slug: "moewenfurt",
        title: "  Möwenfurt  ",
        type: "location",
        summary: `  ${"Steilküste. ".repeat(200)}  `,
        tags: ["Hafen", "hafen", 7, "  Fischerei  ", null],
      },
    ]);
    assert.equal(quelle?.titel, "Möwenfurt");
    assert.deepEqual(quelle?.schlagworte, ["Hafen", "Fischerei"]);
    assert.ok((quelle?.titel.length ?? 0) <= 120);
    assert.ok((quelle?.zusammenfassung?.length ?? 0) <= 700);
    assert.ok(quelle?.zusammenfassung?.endsWith("…"));
  });

  it("verträgt fehlende und unbrauchbare Schlagwortfelder", () => {
    const [quelle] = ortQuellenAusSeiten([
      { slug: "kueste", title: "Die Graue Küste", type: "region", tags: "Hafen" },
    ]);
    assert.deepEqual(quelle?.schlagworte, []);
    assert.equal(quelle?.zusammenfassung, null);
  });
});

describe("baueTerraOrtPrompt", () => {
  const quelle: TerraOrtQuelle = {
    slug: "moewenfurt",
    titel: "Möwenfurt",
    typ: "location",
    zusammenfassung: "Ein Fischerdorf an der Steilküste, halb in den Fels gebaut.",
    schlagworte: ["Hafen", "Fischerei"],
  };

  it("nennt Titel, Typ, Schlagworte und Zusammenfassung", () => {
    const text = baueTerraOrtPrompt(quelle);
    assert.ok(text.includes("Möwenfurt"));
    assert.ok(text.includes("Ort"));
    assert.ok(text.includes("Hafen, Fischerei"));
    assert.ok(text.includes("halb in den Fels gebaut"));
  });

  it("stellt das Wiki über die Erfindung", () => {
    assert.ok(baueTerraOrtPrompt(quelle).includes("Was im Wiki steht, gilt"));
  });

  it("lässt weg, was die Seite nicht hat", () => {
    const text = baueTerraOrtPrompt({ ...quelle, zusammenfassung: null, schlagworte: [] });
    assert.ok(!text.includes("Schlagworte"));
    assert.ok(!text.includes("Aus dem Wiki:"));
    assert.ok(text.includes("Möwenfurt"));
  });

  it("bleibt unter der Vorlagengrenze, ohne den Anweisungssatz zu verlieren", () => {
    /* Der Satz steht zuletzt und wäre bei blindem Kürzen das erste Opfer.
       Deshalb sind Titel, Zusammenfassung und Schlagwortzahl einzeln gedeckelt:
       auch die schlimmste Seite passt in die Vorlage. */
    const text = baueTerraOrtPrompt({
      ...quelle,
      titel: "T".repeat(4000),
      zusammenfassung: "S".repeat(4000),
      schlagworte: Array.from({ length: 60 }, (_, i) => `Schlagwort-${i}`),
    });
    assert.ok(text.length <= TERRA_ORT_PROMPT_MAX);
    assert.ok(text.endsWith("ergänze nur, was dort fehlt."));
  });
});

describe("promptNachOrtwechsel", () => {
  it("füllt ein leeres Feld mit der Vorlage", () => {
    const wechsel = promptNachOrtwechsel({
      aktuell: "   ",
      letzteVorlage: "",
      neueVorlage: "Ort aus dem Wiki: Möwenfurt",
    });
    assert.deepEqual(wechsel, { prompt: "Ort aus dem Wiki: Möwenfurt", vorlageUebernommen: true });
  });

  it("ersetzt eine unveränderte frühere Vorlage", () => {
    const wechsel = promptNachOrtwechsel({
      aktuell: "Vorlage Möwenfurt",
      letzteVorlage: "Vorlage Möwenfurt",
      neueVorlage: "Vorlage Salzhafen",
    });
    assert.deepEqual(wechsel, { prompt: "Vorlage Salzhafen", vorlageUebernommen: true });
  });

  it("lässt getippten Text stehen", () => {
    const wechsel = promptNachOrtwechsel({
      aktuell: "Raue Küste, drei Fischerdörfer",
      letzteVorlage: "",
      neueVorlage: "Vorlage Möwenfurt",
    });
    assert.deepEqual(wechsel, {
      prompt: "Raue Küste, drei Fischerdörfer",
      vorlageUebernommen: false,
    });
  });

  it("lässt eine zurechtgeschriebene Vorlage stehen", () => {
    const wechsel = promptNachOrtwechsel({
      aktuell: "Vorlage Möwenfurt — aber im Winter",
      letzteVorlage: "Vorlage Möwenfurt",
      neueVorlage: "Vorlage Salzhafen",
    });
    assert.equal(wechsel.prompt, "Vorlage Möwenfurt — aber im Winter");
    assert.equal(wechsel.vorlageUebernommen, false);
  });

  it("räumt das Feld beim Abwählen nur, wenn die Vorlage darin steht", () => {
    assert.deepEqual(
      promptNachOrtwechsel({
        aktuell: "Vorlage Möwenfurt",
        letzteVorlage: "Vorlage Möwenfurt",
        neueVorlage: "",
      }),
      { prompt: "", vorlageUebernommen: true },
    );
    assert.deepEqual(
      promptNachOrtwechsel({
        aktuell: "Selbst getippt",
        letzteVorlage: "Vorlage Möwenfurt",
        neueVorlage: "",
      }),
      { prompt: "Selbst getippt", vorlageUebernommen: false },
    );
  });
});
