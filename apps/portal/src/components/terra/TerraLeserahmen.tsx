"use client";

import { useEffect, useRef } from "react";
import "./terra.css";

/**
 * Die Portal-Seite der Brücke (J1) — EINSEITIG.
 *
 * Die Elternkomponente lädt die Karte hinein und nimmt danach **keine**
 * Änderungsnachricht mehr entgegen: `karte-geaendert` wird hier nicht einmal
 * gelesen. Das ist die robustere Absicherung als ein Flag im Frame — selbst
 * ein manipulierter Frame hätte kein Ziel, an das er schreiben könnte. Im
 * Portal existiert schlicht keine Server Action zum Schreiben.
 *
 * Der Frame wird zusätzlich mit `?modus=lesen` geöffnet; Terra blendet dort
 * Werkzeugleiste und Panel aus und lässt nur Navigation zu. Das ist Komfort,
 * nicht die Sicherung — die Sicherung ist das fehlende Gegenüber.
 *
 * Zugriff hängt wie bei Atlas allein an der Weltmitgliedschaft, nie an der
 * einzelnen Karte.
 */

export interface TerraLeserahmenProps {
  /** Kartenbaum im Format v5, oder null für eine noch leere Karte. */
  daten: unknown | null;
  /** Pfad zum gleich-origin ausgelieferten Terra (ohne Query). */
  quelle?: string;
}

const STANDARD_QUELLE = "/terra/index.html";

export function TerraLeserahmen({ daten, quelle }: TerraLeserahmenProps) {
  const rahmenRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    function empfange(ereignis: MessageEvent) {
      // Beide Prüfungen — Herkunft UND Absender.
      if (ereignis.origin !== window.location.origin) return;
      const rahmen = rahmenRef.current;
      if (!rahmen || ereignis.source !== rahmen.contentWindow) return;

      const nachricht = ereignis.data as { typ?: unknown } | null;
      if (!nachricht || typeof nachricht !== "object") return;
      // NUR der Bereitschaftsgruß wird beantwortet. `karte-geaendert` und
      // alles andere fällt hier durch — absichtlich ohne else-Zweig.
      if (nachricht.typ !== "terra-bereit") return;

      rahmen.contentWindow?.postMessage(
        { typ: "karte-laden", daten: daten ?? null, version: 0 },
        window.location.origin,
      );
    }

    window.addEventListener("message", empfange);
    return () => window.removeEventListener("message", empfange);
  }, [daten]);

  const basis = quelle ?? STANDARD_QUELLE;
  return (
    <div className="terra-leserahmen">
      <iframe
        ref={rahmenRef}
        src={`${basis}?modus=lesen`}
        title="Terra Kartenansicht"
        data-testid="terra-leserahmen"
        allow="fullscreen"
      />
    </div>
  );
}
