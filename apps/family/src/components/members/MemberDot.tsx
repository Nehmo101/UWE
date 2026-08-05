/**
 * Farbpunkt einer Person — im Kalender und in Listen.
 *
 * Bewusst eine eigene Datei ohne Import aus `@uwe/family-core`: der Punkt wird
 * auch aus Client-Komponenten heraus gebraucht, und das Paket-Barrel zieht über
 * den Tagesstand `@uwe/database/server` und damit Server-only-Module herein
 * (CLAUDE.md: keine Server-only Module in Client Components).
 */
export function MemberDot({ colour, title }: { colour: string; title?: string }) {
  return (
    <span
      className="family-member-dot"
      style={{ backgroundColor: colour }}
      title={title}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      aria-label={title}
    />
  );
}
