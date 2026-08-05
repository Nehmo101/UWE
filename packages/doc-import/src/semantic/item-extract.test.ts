import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractMagicItemData, splitDmRegions } from "./item-extract";

/** Aufbau wie in importierten Kampagnenbüchern: Kopfzeile, Tabelle, :::dm-Block. */
const ANKERSPLITTER = `<p><strong>Sehr selten · Plotgegenstand · rituell entnommen</strong></p>
<h2 id="auf-einen-blick">Auf einen Blick</h2>
<table><tbody><tr><td><strong>Was es ist</strong></td><td>Ein Stück Sternstahl</td></tr></tbody></table>
<h2 id="eigenschaften">Eigenschaften</h2>
<ul>
<li><strong>Widerstand gegen Blitzschaden</strong>, solange getragen</li>
<li>1×/Tag: <em>Ruhe gebieten</em></li>
</ul>
<p>:::dm Am Tisch</p>
<h2 id="am-tisch">Am Tisch</h2>
<ul><li>Der Splitter ist nie Beute, sondern Verantwortung.</li></ul>
<p>:::</p>
<h2 id="verbindungen">Verbindungen</h2>
<p>[[Die Vier Anker]]</p>`;

describe("extractMagicItemData", () => {
  it("liest Seltenheit, Typ, Beschreibung und Eigenschaften aus der Kopfzeile", () => {
    const data = extractMagicItemData("Ankersplitter", ANKERSPLITTER);
    assert.ok(data);
    assert.equal(data.rarity, "very_rare");
    assert.equal(data.itemType, "Plotgegenstand");
    assert.match(data.visibleDescription ?? "", /Ein Stück Sternstahl/);
    assert.deepEqual(data.properties, [
      "Widerstand gegen Blitzschaden, solange getragen",
      "1×/Tag: Ruhe gebieten",
    ]);
  });

  it("hält Spielleitungsmaterial aus den spielersichtbaren Feldern heraus", () => {
    const data = extractMagicItemData("Ankersplitter", ANKERSPLITTER);
    assert.ok(data);
    const playerFacing = [data.visibleDescription ?? "", ...(data.properties ?? [])].join("\n");
    assert.doesNotMatch(playerFacing, /nie Beute, sondern Verantwortung/);
    assert.match(data.dmSecret ?? "", /nie Beute, sondern Verantwortung/);
  });

  it("doppelt den Titel eines :::dm-Bereichs nicht in das DM-Feld", () => {
    const data = extractMagicItemData("Ankersplitter", ANKERSPLITTER);
    assert.ok(data);
    assert.equal((data.dmSecret ?? "").match(/Am Tisch/g)?.length, 1);
  });

  it("erfindet keine Seltenheit, wenn das Dokument keine nennt", () => {
    const data = extractMagicItemData(
      "Kugel der Wachruhe",
      `<p><em>Gegenstand</em></p><p>Sie schützt beim Schlafen.</p>`,
    );
    assert.ok(data);
    assert.equal(data.rarity, undefined);
    assert.equal(data.itemType, "Gegenstand");
  });

  it("nimmt Mechanik aus zweispaltigen Tabellen auf", () => {
    const data = extractMagicItemData(
      "Die Ritusglocke",
      `<p><strong>Selten · Handglocke</strong></p>
<h2 id="auf-einen-blick">Auf einen Blick</h2>
<table><tbody>
<tr><td><strong>Woher</strong></td><td>Vom Kantor</td></tr>
<tr><td><strong>Wirkung</strong></td><td><strong>1×/Tag:</strong> Läuten beendet einen Fluch</td></tr>
</tbody></table>`,
    );
    assert.ok(data);
    assert.equal(data.rarity, "rare");
    assert.deepEqual(data.properties, ["Wirkung: 1×/Tag: Läuten beendet einen Fluch"]);
  });

  it("hält „beendet einen Fluch\" für eine Eigenschaft, nicht für einen Fluch", () => {
    const data = extractMagicItemData(
      "Die Ritusglocke",
      `<p><strong>Selten</strong></p><p>Läuten beendet einen magischen Zustand oder Fluch.</p>`,
    );
    assert.ok(data);
    assert.equal(data.curse, undefined);
  });

  it("erkennt einen echten Fluch an seinem Abschnitt", () => {
    const data = extractMagicItemData(
      "Der graue Reif",
      `<p><strong>Selten · Ring</strong></p><p>Ein schlichter Reif.</p>
<h2 id="fluch">Fluch</h2><p>Wer ihn abnimmt, vergisst seinen eigenen Namen.</p>`,
    );
    assert.ok(data);
    assert.match(data.curse ?? "", /vergisst seinen eigenen Namen/);
  });

  it("verwechselt „Schiffsnamen\" nicht mit einem Fahrzeug", () => {
    const data = extractMagicItemData(
      "Die Jagdliste",
      `<p><strong>Sieben Schiffsnamen · zwei abgehakt</strong></p><p>Eine Liste.</p>`,
    );
    assert.ok(data);
    assert.equal(data.itemType, "Gegenstand");
  });

  it("bevorzugt die genauere Typangabe vor der allgemeinen", () => {
    const data = extractMagicItemData(
      "Tattoo des Krähenblick",
      `<p><em>Gegenstand · Tattoo</em></p><p>Das günstigste der fünf Tattoos.</p>`,
    );
    assert.ok(data);
    assert.equal(data.itemType, "Tattoo");
  });

  it("erkennt den Typ notfalls am Seitentitel", () => {
    const data = extractMagicItemData(
      "Tattoo der flinken Sehne",
      `<p><em>Gegenstand</em></p><p>Getragen von Veldrin.</p>`,
    );
    assert.ok(data);
    assert.equal(data.itemType, "Tattoo");
  });

  it("erkennt geforderte Einstimmung", () => {
    const data = extractMagicItemData(
      "Stab der Winde",
      `<p><strong>Selten · Waffe (erfordert Einstimmung)</strong></p><p>Ein Stab.</p>`,
    );
    assert.ok(data);
    assert.equal(data.requiresAttunement, true);
  });

  it("legt ohne belastbaren Inhalt keinen Datensatz an", () => {
    assert.equal(extractMagicItemData("Leer", ""), null);
    assert.equal(extractMagicItemData("Nur Überschrift", "<h2>Verbindungen</h2>"), null);
  });
});

describe("splitDmRegions", () => {
  it("trennt DM-Bereiche vom sichtbaren Text", () => {
    const { visible, dm } = splitDmRegions(
      `<p>Sichtbar</p><p>:::dm Werte</p><p>Geheim</p><p>:::</p><p>Auch sichtbar</p>`,
    );
    assert.match(visible, /Sichtbar/);
    assert.match(visible, /Auch sichtbar/);
    assert.doesNotMatch(visible, /Geheim/);
    assert.match(dm, /Geheim/);
  });

  it("behandelt einen nicht geschlossenen DM-Bereich bis zum Ende als geheim", () => {
    const { visible, dm } = splitDmRegions(`<p>Sichtbar</p><p>:::dm Werte</p><p>Geheim bis Ende</p>`);
    assert.doesNotMatch(visible, /Geheim bis Ende/);
    assert.match(dm, /Geheim bis Ende/);
  });
});
