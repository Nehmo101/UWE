import type { ReactNode } from "react";

/**
 * Eine Tabelle, die auf dem Telefon zur Kartenliste wird — ohne zweite
 * Datenquelle und ohne JavaScript.
 *
 * Das Problem: UWE ist voll von Datentabellen (Welten, Seiten, Etiketten, Jobs,
 * Mail, Verträge). Auf 390 px Breite wurden sie zusammengedrückt — winzige
 * Schrift, abgeschnittene Spalten, waagerechtes Scrollen mitten im Text.
 *
 * Die Umschaltung selbst steckt in `design-v3/data.css` und läuft rein über
 * `display`. Diese Komponente erzeugt nur das Markup, das die Regeln dort
 * lesen: `data-label` an jeder Zelle (daraus wird auf dem Telefon die
 * vorangestellte Beschriftung), `data-primary` für die Leitspalte, die die
 * Karte trägt, `data-numeric` für rechtsbündige Zahlen mit Tabellenziffern
 * und `data-priority="low"` für Spalten, die mobil ganz entfallen.
 *
 * Warum `display` und nicht zwei Layouts: es bleibt eine Wahrheit. Ein
 * zweites, karten-förmiges Markup würde beim nächsten Feldwechsel
 * auseinanderlaufen.
 *
 * Der Haken daran, und warum unten überall `role` steht: `display: flex` auf
 * `table`, `tbody`, `tr` und `td` **entfernt** in Chrome und Safari die
 * impliziten Tabellenrollen. Ein Screenreader liest die Karten dann als
 * zusammenhangloses Textblock-Gestapel; „Spalte 3 von 5" ist weg. Die Rollen
 * hier setzen sie ausdrücklich zurück, sodass die Semantik auf jeder Breite
 * dieselbe bleibt.
 */

export interface ResponsiveTableColumn<Row> {
  /** Stabiler Schlüssel — nur intern, erscheint nicht im Markup. */
  key: string;
  /** Spaltenüberschrift. Wird mobil zur Beschriftung vor dem Wert. */
  label: string;
  /** Zellinhalt für eine Zeile. */
  render: (row: Row) => ReactNode;
  /**
   * Die Leitspalte: mobil die Überschrift der Karte, ohne vorangestellte
   * Beschriftung. Genau eine Spalte sollte das sein.
   */
  primary?: boolean;
  /** Zahlenspalte — rechtsbündig, Tabellenziffern. */
  numeric?: boolean;
  /**
   * `low` blendet die Spalte auf dem Telefon aus. Für Nebensächliches, das
   * eine Karte nur voller macht — nie für etwas, das man zum Handeln braucht.
   */
  priority?: "normal" | "low";
}

export interface ResponsiveTableProps<Row> {
  columns: ResponsiveTableColumn<Row>[];
  rows: Row[];
  /** Stabiler Schlüssel je Zeile. */
  rowKey: (row: Row, index: number) => string;
  /**
   * Beschriftung der Tabelle für Screenreader. Pflicht: eine Tabelle ohne
   * Bezeichnung ist im Screenreader nur „Tabelle mit 8 Spalten".
   */
  caption: string;
  /** Sichtbare Überschrift statt versteckter Beschriftung. */
  captionVisible?: boolean;
  /**
   * Was steht da, wenn nichts da ist. Ohne diesen Text bliebe eine leere
   * Tabelle als kopfloser Rahmen stehen.
   */
  empty?: ReactNode;
  /**
   * `cards` ist die Vorgabe. `scroll` behält die Tabellenform und lässt sie
   * im eigenen Kasten seitlich scrollen — sinnvoll, wenn der Vergleich über
   * viele Spalten der eigentliche Zweck ist (Statistiken, Matrizen).
   */
  mobile?: "cards" | "scroll";
  className?: string;
}

export function ResponsiveTable<Row>({
  columns,
  rows,
  rowKey,
  caption,
  captionVisible = false,
  empty,
  mobile = "cards",
  className,
}: ResponsiveTableProps<Row>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  return (
    <div
      className={className ? `uwe-table-wrap ${className}` : "uwe-table-wrap"}
      data-mobile={mobile}
    >
      <table className="uwe-table-v3" role="table">
        <caption className={captionVisible ? "uwe-table-v3__caption" : "uwe-visually-hidden"}>
          {caption}
        </caption>
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((column) => (
              <th
                key={column.key}
                role="columnheader"
                scope="col"
                data-numeric={column.numeric ? "true" : undefined}
                data-priority={column.priority === "low" ? "low" : undefined}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row, index) => (
            <tr key={rowKey(row, index)} role="row">
              {columns.map((column) => {
                // Die Leitspalte trägt die Karte und ist deshalb `th` mit
                // `scope="row"` — so weiß ein Screenreader, worauf sich die
                // übrigen Zellen der Zeile beziehen.
                const Cell = column.primary ? "th" : "td";
                return (
                  <Cell
                    key={column.key}
                    role={column.primary ? "rowheader" : "cell"}
                    scope={column.primary ? "row" : undefined}
                    // Die Beschriftung wird mobil per ::before vor den Wert
                    // gesetzt. Die Leitspalte braucht keine — sie *ist* die
                    // Überschrift der Karte.
                    data-label={column.primary ? undefined : column.label}
                    data-primary={column.primary ? "true" : undefined}
                    data-numeric={column.numeric ? "true" : undefined}
                    data-priority={column.priority === "low" ? "low" : undefined}
                  >
                    {column.render(row)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
