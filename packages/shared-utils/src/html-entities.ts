/**
 * HTML-Entitäten in einem Wikilink-Ziel zurückübersetzen.
 *
 * **Warum das nötig ist.** Ein Kampagnenband wird beim Import einmal von
 * Markdown nach HTML übersetzt (`markdownToWikiHtml`). `[[…]]` ist keine
 * Markdown-Syntax und reist deshalb als Text durch — aber `marked` maskiert
 * jedes HTML-kritische Zeichen darin, auch innerhalb der Klammern:
 *
 *     [[A'Tuin]]                        →  [[A&#39;Tuin]]
 *     [[Schätze & Gegenstände]]         →  [[Schätze &amp; Gegenstände]]
 *     [[Ravenna „Dreifinger" Kol]]      →  [[Ravenna „Dreifinger&quot; Kol]]
 *
 * Danach sucht die Auflösung eine Seite namens `A&#39;Tuin` und findet keine.
 * Der Link ist tot, ohne dass irgendwo etwas gemeldet würde — und zwar für
 * **jede** Seite, deren Titel einen Apostroph, ein kaufmännisches Und oder ein
 * Anführungszeichen trägt. In Terra sind das unter anderem A'Tuin, K'avesh und
 * Vosh'kaar.
 *
 * **Warum hier und nicht beim Maskieren.** Das Ziel unmaskiert im HTML stehen zu
 * lassen wäre die andere Möglichkeit — aber ein rohes `&` oder `<` im
 * gespeicherten Inhalt ist kein wohlgeformtes HTML mehr und überlebt die
 * Sanitisierung nicht zuverlässig. Deshalb bleibt der Inhalt maskiert, und wer
 * ein Ziel **liest**, übersetzt es zurück. Das heilt zusätzlich alle Seiten, die
 * schon importiert sind: Es braucht keinen neuen Import und keine Migration.
 *
 * **Die Liste ist bewusst kurz.** Genau die fünf Ersetzungen, die ein
 * HTML-Maskierer vornimmt — nicht der ganze Entitätenkatalog. Wer beliebige
 * Entitäten auflöst, übersetzt irgendwann etwas zurück, das nie maskiert wurde.
 *
 * `&amp;` steht **zuletzt**, sonst würde aus dem einmal maskierten `&amp;lt;`
 * über zwei Schritte ein `<` statt des richtigen `&lt;`.
 */
export function decodeHtmlEntities(value: string): string {
  if (!value.includes("&")) return value;

  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&(?:apos|#0*39);/g, "'")
    .replace(/&amp;/g, "&");
}
