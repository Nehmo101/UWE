import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DUNGEON_CONVERSION_TEMPLATE,
  DUNGEON_TEMPLATE_FILE_NAME,
} from "./dungeon-template";
import { buildDocImportPlan, type DocImportPlan } from "./plan";
import type { PageDraft } from "./types";

/**
 * Das Konvertierungstemplate ist ein Versprechen: Wer sein Material in diese
 * Form bringt, bekommt beim Import mit Profil „Dungeon" das komplette
 * Dungeon-Modul — Ebenen, Räume, Begegnungen, Fallen, Rätsel, Beute,
 * Geheimnisse, Werteblöcke, Handouts. Dieser Test hält das Versprechen fest:
 * Ändert eine Import-Regel das Verhalten, bricht er, bevor das Template still
 * zur Falschaussage wird.
 */
describe("Dungeon-Konvertierungstemplate", () => {
  const plan: DocImportPlan = buildDocImportPlan(
    [{ fileName: DUNGEON_TEMPLATE_FILE_NAME, content: DUNGEON_CONVERSION_TEMPLATE }],
    { mode: "document", profile: "dungeon", keepSource: false },
  );

  const byKey = new Map(plan.pages.map((page) => [page.key, page]));
  const parentOf = (page: PageDraft) => (page.parentKey ? byKey.get(page.parentKey) : undefined);
  const ofType = (type: PageDraft["type"]) => plan.pages.filter((page) => page.type === type);

  it("erzeugt jede Gegenstandssorte des Dungeon-Moduls", () => {
    const { byRole } = plan.structure;
    assert.equal(byRole.dungeon, 1);
    assert.ok((byRole.level ?? 0) >= 3, "Anfahrt + zwei Ebenen erwartet");
    assert.ok((byRole.room ?? 0) >= 3);
    assert.ok((byRole.encounter ?? 0) >= 2);
    assert.equal(byRole.trap, 1);
    assert.equal(byRole.puzzle, 1);
    assert.equal(byRole.loot, 1);
    assert.equal(byRole.secret, 1);
    assert.ok((byRole.statblock ?? 0) >= 2);
    assert.ok((byRole.handout ?? 0) >= 2);
  });

  it("hängt die Ebenen direkt unter den Dungeon (Cockpit-Invariante)", () => {
    const root = plan.pages[0];
    assert.equal(root?.type, "dungeon");
    for (const level of ofType("dungeon_level")) {
      assert.equal(parentOf(level)?.key, root?.key, `${level.title} hängt nicht am Dungeon`);
    }
  });

  it("hängt Räume unter Ebenen und Raum-Kinder unter Räumen", () => {
    const rooms = ofType("room");
    assert.ok(rooms.length >= 3);
    for (const room of rooms) {
      assert.equal(parentOf(room)?.type, "dungeon_level", `${room.title} hängt nicht an einer Ebene`);
    }

    for (const type of ["encounter", "trap", "puzzle", "loot", "secret"] as const) {
      for (const child of ofType(type)) {
        const parent = parentOf(child);
        assert.ok(
          parent?.type === "room" || parent?.type === "dungeon_level",
          `${child.title} (${type}) hängt weder an Raum noch an Ebene`,
        );
      }
    }
  });

  it("löst Werteblöcke und Handouts als eigene Seiten heraus", () => {
    const statblockValues = plan.pages.filter((page) => page.title.startsWith("Werteblock:"));
    assert.ok(statblockValues.length >= 2, "Werte-Unterseiten fehlen");
    for (const values of statblockValues) {
      assert.ok(values.html.includes(":::dm"), `${values.title} liegt nicht im DM-Bereich`);
    }
    assert.ok(ofType("handout").length >= 2);
  });

  it("meldet keine Warnungen — das Template ist der Goldpfad", () => {
    assert.deepEqual(plan.warnings, []);
  });
});
