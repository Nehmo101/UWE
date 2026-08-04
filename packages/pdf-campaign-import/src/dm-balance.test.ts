import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { balanceEntityDmSections } from "./dm-balance";

describe("balanceEntityDmSections", () => {
  it("lässt Entities ohne Marken unangetastet (Identität)", () => {
    const entities = [
      { title: "Ort", body: "Ein Marktplatz." },
      { title: "NPC", body: "Eine Händlerin." },
    ];
    const result = balanceEntityDmSections(entities);
    assert.equal(result.balanced, 0);
    assert.equal(result.entities[0], entities[0]);
    assert.equal(result.entities[1], entities[1]);
  });

  it("schließt einen aufgerissenen Bereich und führt ihn drüben weiter", () => {
    // Der Chunker hat einen :::dm-Bereich über zwei Entities zerrissen: ohne
    // Ausgleich stünde der zweite Teil OFFEN im Spieler-Wiki.
    const entities = [
      { title: "Kapitel 1", body: "Vorlesetext.\n:::dm Dossier\nGeheimnis Teil 1." },
      { title: "Kapitel 2", body: "Geheimnis Teil 2.\n:::" },
      { title: "Kapitel 3", body: "Wieder offen." },
    ];
    const result = balanceEntityDmSections(entities);

    assert.equal(result.balanced, 2);
    // Teil 1: geschlossen.
    assert.match(result.entities[0]!.body, /:::\s*$/);
    // Teil 2: neu geöffnet, Titel wandert mit.
    assert.match(result.entities[1]!.body, /^:::dm Dossier\n/);
    // Teil 3: unangetastet.
    assert.equal(result.entities[2]!.body, "Wieder offen.");
  });

  it("balancierte Marken bleiben, wie sie sind", () => {
    const entities = [
      { title: "Seite", body: ":::dm\nGeheim.\n:::\nOffen." },
    ];
    const result = balanceEntityDmSections(entities);
    assert.equal(result.balanced, 0);
    assert.equal(result.entities[0]!.body, entities[0]!.body);
  });
});
