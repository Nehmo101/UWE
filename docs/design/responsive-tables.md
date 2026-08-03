# Tabellen auf schmalen Screens

UWE ist voll von Datentabellen: Welten, Seiten, Etiketten, Jobs, Import-Läufe,
Backups, Druckwarteschlangen, Verträge. Auf 390 px Breite wurden sie bisher
zusammengedrückt — winzige Schrift, abgeschnittene Spalten, waagerechtes
Scrollen mitten im Text.

Die Lösung braucht weder JavaScript noch ein zweites Markup: **dieselbe
`<table>` rendert auf dem Telefon als Kartenliste.** Umgeschaltet wird
ausschließlich `display`; die Regeln stehen in
`packages/shared-ui/src/design-v3/data.css`.

## Die drei Wege in dieselbe Form

| Weg | Wann | Wo |
|---|---|---|
| `ResponsiveTable` | Der Normalfall — eine Liste, Spalten stehen fest | `@uwe/shared-ui` |
| `DataTable` | Sortieren, Filtern, Blättern, Mehrfachauswahl nötig | `apps/{studio,portal}/src/components/ui/data-table.tsx` |
| Klassen von Hand | Nur, wenn keins von beiden passt | `.uwe-table-wrap` + `.uwe-table-v3` |

Bei allen dreien ist der Vertrag mit dem Stylesheet derselbe — er hängt an
Attributen, nicht an Klassen:

| Attribut | Wirkung auf dem Telefon |
|---|---|
| `data-mobile="cards"` am Rahmen | Jede Zeile wird zur Karte. `"scroll"` behält die Tabelle im eigenen Kasten. |
| `data-label="…"` an der Zelle | Steht als Beschriftung vor dem Wert (`content: attr(data-label)`). |
| `data-primary="true"` | Die Leitspalte trägt die Karte und bekommt keine Beschriftung — sie *ist* die Überschrift. |
| `data-numeric="true"` | Rechtsbündig, Tabellenziffern. |
| `data-priority="low"` | Fällt auf dem Telefon ganz weg. |

## Die Falle: `display: flex` nimmt die Tabellenrollen

Chrome und Safari entfernen die impliziten Tabellenrollen, sobald `table`,
`tbody`, `tr` oder `td` per `display` umgestellt werden. Ein Screenreader liest
die Karten dann als zusammenhanglosen Textstapel — „Spalte 3 von 5" ist weg.

Deshalb setzen `ResponsiveTable` und beide `DataTable` die Rollen ausdrücklich
zurück (`role="table" | "rowgroup" | "row" | "columnheader" | "rowheader" |
"cell"`). **Wer die Klassen von Hand verwendet, muss das ebenfalls tun.**

Die Leitspalte ist dabei `<th scope="row" role="rowheader">`, kein `<td>`: so
weiß der Screenreader, worauf sich die übrigen Zellen der Zeile beziehen.

`e2e/studio-a11y.spec.ts` hält das fest — die Label-Bibliothek wird auf jeder
Breite und in beiden Themes darauf geprüft, dass die Rolle `table` erhalten
bleibt.

## `ResponsiveTable` — drei Erweiterungen und wofür sie da sind

```tsx
<ResponsiveTable
  caption="Sessions"                    // Pflicht: sonst „Tabelle mit 5 Spalten"
  rowKey={(session) => session.id}
  rows={sessions}
  columns={[
    { key: "title", label: "Titel", primary: true, render: (s) => s.title },
    { key: "number", label: "#", numeric: true, render: (s) => s.sessionNumber },
    { key: "date", label: "Datum", priority: "low", render: (s) => s.date },
  ]}
  empty={<EmptyState title="Noch keine Sessions" />}
/>
```

- **`header`** — eine sichtbare Überschrift, die mehr ist als Text, etwa ein
  „alles auswählen"-Kästchen. `label` bleibt daneben bestehen und trägt die
  mobile Beschriftung; ohne das stünde vor der Zelle ein leeres Etikett.
- **`rowProps`** — Zusatz-Attribute je Zeile, für Zeilen, die selbst etwas
  können (Ziehen zum Sortieren in `PrintListEditor`). Bewusst schmal: alles,
  was eine Zeile *anzeigt*, gehört in eine Spalte.
- **`empty`** — ohne Zeilen wird ausschließlich dieser Knoten gerendert.
  `undefined` heißt „dann eben gar nichts", nie „ein Rahmen mit Kopfzeile und
  leerem Körper".

Bei `DataTable` stehen dieselben Angaben in `meta` der Spaltendefinition
(`{ label, primary, numeric, priority }`) — dort ist der von TanStack
vorgesehene Platz für anwendungseigene Spalteninformationen.

## `cards` oder `scroll`?

`cards` ist die Vorgabe. `scroll` ist richtig, wenn der **Vergleich über
Spalten** der eigentliche Zweck ist und die Werte kurz sind: Attributwerte,
Rettungswürfe, Fertigkeiten im Charakterbogen. Achtzehn Fertigkeiten als
achtzehn Karten wären mehr Weg, nicht weniger.

## Was nicht migriert ist — und warum

| Ort | Grund |
|---|---|
| `apps/engine-connector-client` | Desktop-Fenster mit eigenem Stylesheet, ohne design-v3. Kein responsives Ziel. |
| `packages/database/src/character-sheet-export.ts` | HTML-Export für Druck, keine Bildschirmansicht. |
| `packages/mail/src/sanitize/mail-html.test.ts` | Testvorlage. |

## Was beim Migrieren aufgefallen ist

Vier Tabellen kündigten im Kopf mehr Spalten an, als der Körper lieferte — ab
der Lücke stand jeder Wert unter der falschen Überschrift:

- `app/templates/page.tsx` — 6 Überschriften, 5 Zellen („Standard-Sichtbarkeit")
- `app/brain/page.tsx` — 4 zu 3 („Sichtbarkeit")
- `app/worlds/[worldSlug]/brain/page.tsx` — „Sichtbarkeit" mit immer leerer Zelle
- `dashboard/WorldDashboardClient.tsx` — „Sichtbarkeit" und „Publish", beide leer

Eine Spaltendefinition kann das nicht mehr auseinanderlaufen lassen: Kopf und
Zelle stammen aus derselben Zeile. Das ist der eigentliche Gewinn der
Komponente, unabhängig vom Telefon.
EOF
