import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ResponsiveTable, type ResponsiveTableColumn } from "./ResponsiveTable";

/**
 * Der Vertrag zwischen dieser Komponente und `design-v3/data.css` ist rein
 * über Attribute geschlossen: das CSS liest `data-label`, `data-primary`,
 * `data-numeric` und `data-priority`. Wird eines davon umbenannt, bricht die
 * Mobilansicht still — die Tabelle sieht dann auf dem Telefon aus wie vorher,
 * nur ohne Beschriftungen. Diese Tests halten beide Seiten zusammen.
 */

interface World {
  slug: string;
  name: string;
  pages: number;
  owner: string;
}

const WORLDS: World[] = [
  { slug: "terra", name: "Terra", pages: 42, owner: "DM User" },
  { slug: "arbor", name: "Arbor", pages: 7, owner: "DM User" },
];

const COLUMNS: ResponsiveTableColumn<World>[] = [
  { key: "name", label: "Welt", primary: true, render: (w) => w.name },
  { key: "pages", label: "Seiten", numeric: true, render: (w) => w.pages },
  { key: "owner", label: "Besitzer", priority: "low", render: (w) => w.owner },
];

function render(overrides: Partial<Parameters<typeof ResponsiveTable<World>>[0]> = {}) {
  return renderToStaticMarkup(
    <ResponsiveTable
      columns={COLUMNS}
      rows={WORLDS}
      rowKey={(world) => world.slug}
      caption="Welten"
      {...overrides}
    />,
  );
}

describe("ResponsiveTable", () => {
  it("beschriftet jede Nicht-Leitzelle mit ihrer Spaltenüberschrift", () => {
    const html = render();
    // Aus data-label wird auf dem Telefon der Text vor dem Wert.
    assert.match(html, /data-label="Seiten"/);
    assert.match(html, /data-label="Besitzer"/);
  });

  it("lässt die Leitspalte ohne Beschriftung — sie ist die Überschrift", () => {
    const html = render();
    assert.doesNotMatch(html, /data-label="Welt"/);
    assert.match(html, /data-primary="true"/);
  });

  it("macht die Leitspalte zum Zeilenkopf", () => {
    const html = render();
    // `th scope="row"` sagt dem Screenreader, worauf sich die übrigen Zellen
    // der Zeile beziehen.
    assert.match(html, /<th[^>]*role="rowheader"[^>]*scope="row"/);
  });

  it("stellt die Tabellenrollen ausdrücklich her", () => {
    const html = render();
    // `display: flex` in der Mobilansicht entfernt die impliziten Rollen —
    // ohne diese Attribute liest ein Screenreader dort keine Tabelle mehr.
    for (const role of ["table", "rowgroup", "row", "columnheader", "cell"]) {
      assert.match(html, new RegExp(`role="${role}"`), `role="${role}" fehlt`);
    }
  });

  it("markiert Zahlen- und Nebenspalten in Kopf und Körper", () => {
    const html = render();
    // Beide Seiten brauchen die Markierung: der Kopf für die Ausrichtung,
    // der Körper zusätzlich fürs Ausblenden auf schmalen Screens.
    assert.equal((html.match(/data-numeric="true"/g) ?? []).length, 3);
    assert.equal((html.match(/data-priority="low"/g) ?? []).length, 3);
  });

  it("versteckt die Beschriftung visuell, behält sie aber vorlesbar", () => {
    const html = render();
    assert.match(html, /<caption class="uwe-visually-hidden">Welten<\/caption>/);
    assert.match(render({ captionVisible: true }), /class="uwe-table-v3__caption"/);
  });

  it("zeigt den Leerzustand statt eines kopflosen Rahmens", () => {
    const html = renderToStaticMarkup(
      <ResponsiveTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(world: World) => world.slug}
        caption="Welten"
        empty={<p>Noch keine Welten.</p>}
      />,
    );
    assert.equal(html, "<p>Noch keine Welten.</p>");
  });

  it("rendert ohne Zeilen und ohne Leertext gar nichts", () => {
    // Ein Rahmen mit Kopfzeile und leerem Körper ist kein Zustand, den ein
    // Nutzer je sehen soll — er sieht aus wie eine kaputte Tabelle.
    const html = renderToStaticMarkup(
      <ResponsiveTable
        columns={COLUMNS}
        rows={[]}
        rowKey={(world: World) => world.slug}
        caption="Welten"
      />,
    );
    assert.equal(html, "");
  });

  it("nutzt die Attribute, die design-v3/data.css tatsächlich liest", () => {
    // Die eigentliche Kopplung: das Stylesheet ist die andere Vertragsseite.
    const css = readFileSync(
      path.join(__dirname, "design-v3", "data.css"),
      "utf8",
    );
    for (const selector of [
      "data-mobile=\"cards\"",
      "data-primary=\"true\"",
      "data-numeric=\"true\"",
      "data-priority=\"low\"",
      "attr(data-label)",
      ".uwe-visually-hidden",
      ".uwe-table-v3__caption",
    ]) {
      assert.ok(css.includes(selector), `data.css kennt ${selector} nicht mehr`);
    }
  });
});
