import type { ReactNode } from "react";

/**
 * Fehler, Skelett, Status — die Zustände, für die `design-v3/states.css` eine
 * Form mitbringt, die es im Bestand noch nicht als Komponente gab.
 *
 * `EmptyState` steht bewusst nicht hier: den gibt es seit Langem in
 * `AppShell.tsx` und er trägt jetzt dieselben v3-Klassen. Zwei Leerzustände
 * nebeneinander wären genau der Zustand, den dieses Fundament auflösen soll.
 *
 * Regel aus `states.css`, hier eingebaut statt optional: **keine Information
 * ausschließlich über Farbe.** `StatusPill` verlangt deshalb ein `glyph`, und
 * der Fehlerzustand trägt neben der Farbe eine kräftige linke Kante und ein
 * Zeichen im Titel (beides aus dem Stylesheet).
 */

export interface ErrorStateProps {
  title: ReactNode;
  description?: ReactNode;
  /**
   * Technische Einzelheiten. Stehen eingeklappt darunter, damit die Meldung
   * lesbar bleibt und die Diagnose trotzdem erreichbar ist.
   */
  detail?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Fehlerzustand. `role="alert"` meldet ihn der Vorlesesoftware, sobald er
 * erscheint — bei einem nachträglich eingeblendeten Fehler ist das der
 * Unterschied zwischen „wird bemerkt" und „steht unbemerkt da".
 */
export function ErrorState({ title, description, detail, action, className }: ErrorStateProps) {
  return (
    <div className={className ? `uwe-error-v3 ${className}` : "uwe-error-v3"} role="alert">
      <p className="uwe-error-v3__title">{title}</p>
      {description ? <p className="uwe-error-v3__body">{description}</p> : null}
      {detail ? (
        <details>
          <summary>Technische Einzelheiten</summary>
          <div className="uwe-error-v3__detail">{detail}</div>
        </details>
      ) : null}
      {action}
    </div>
  );
}

export interface SkeletonLinesProps {
  /**
   * Wie viele Zeilen das Skelett andeutet. Die erste ist breiter — sie steht
   * für die Überschrift.
   */
  lines?: number;
  /** Was geladen wird. Wird vorgelesen, nicht angezeigt. */
  label?: string;
  className?: string;
}

/**
 * Skelett statt Spinner: die Fläche behält ihre Größe, nichts springt, wenn
 * die Daten eintreffen. `aria-busy` plus ein vorlesbarer Text sagen der
 * Vorlesesoftware, was ein rotierender Kreis ihr nie gesagt hat.
 */
export function SkeletonLines({ lines = 3, label = "Lädt…", className }: SkeletonLinesProps) {
  return (
    <div className={className} role="status" aria-busy="true" aria-live="polite">
      <span className="uwe-visually-hidden">{label}</span>
      <span className="uwe-skeleton uwe-skeleton--block" data-lines="title" aria-hidden />
      {Array.from({ length: Math.max(0, lines - 1) }, (_, index) => (
        <span key={index} className="uwe-skeleton uwe-skeleton--block" data-lines="text" aria-hidden />
      ))}
    </div>
  );
}

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export interface StatusPillProps {
  /**
   * Pflicht, kein Zierrat: `states.css` setzt das Zeichen über
   * `content: attr(data-glyph)`. Wer nur die Farbe setzt, macht den Status für
   * jeden unlesbar, der Farben nicht unterscheiden kann.
   */
  glyph: string;
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

/** Statusanzeige mit Zeichen *und* Farbe. */
export function StatusPill({ glyph, tone = "neutral", children, className }: StatusPillProps) {
  return (
    <span
      className={className ? `uwe-status-v3 ${className}` : "uwe-status-v3"}
      data-glyph={glyph}
      data-tone={tone}
    >
      {children}
    </span>
  );
}
