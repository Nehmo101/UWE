/**
 * Was der Umbau getan hat.
 *
 * Die Zähler wandern durch alle Durchgänge und landen am Ende in der Vorschau.
 * Sie sind kein Protokoll für Entwickler, sondern die Antwort auf die einzige
 * Frage, die vor dem Übernehmen zählt: **Hat der Import den Text verstanden
 * oder nur zerschnitten?** „21 aus Fließtext herausgelöst, 40 Abschnitte
 * eingefaltet" beantwortet das; „56 Seiten" nicht.
 *
 * Eigenes Modul, weil jeder Durchgang sie fortschreibt und keiner von ihnen
 * der Eigentümer ist.
 */
export interface Counters {
  /** Abschnitte, die zu Rumpftext der Seite darüber wurden. */
  folded: number;
  /** Gliederungsklammern und leere Hüllen, die verschwunden sind. */
  dissolved: number;
  /** Gegenstände, die aus Fließtext herausgelöst wurden. */
  extracted: number;
  /** Doppelt beschriebene Gegenstände, die zu einer Seite wurden. */
  merged: number;
}

export function emptyCounters(): Counters {
  return { folded: 0, dissolved: 0, extracted: 0, merged: 0 };
}
