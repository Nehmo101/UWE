"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { speichereSpielerKarteAction } from "@/app/terra-actions";
import "./terra.css";

/**
 * Die Portal-Seite der Brücke im SCHREIBMODUS (J5).
 *
 * Bis zu dieser Runde war die Portal-Seite ausdrücklich einseitig, und die
 * Begründung war gut: ein Frame ohne Gegenüber kann nichts schreiben. Diese
 * Komponente gibt ihm ein Gegenüber — aber nur für einen einzigen Fall: den
 * eigenen, noch nicht abgenommenen Entwurf.
 *
 * Was dadurch NICHT wackelt, und warum:
 *
 *   Abgenommene Karten bleiben beim `TerraLeserahmen`. Die Seite entscheidet
 *   anhand des Zustands, welchen Rahmen sie einsetzt — es gibt keinen Schalter
 *   in dieser Komponente, der aus einem Leserahmen einen Schreibrahmen macht.
 *
 *   Fremde Entwürfe erreichen diese Komponente nicht. Die Seite bekommt sie
 *   gar nicht erst geladen (`holeFuerSpieler` liefert `null` → `notFound()`).
 *
 *   Und selbst wenn beides fiele: die Server Action prüft Autor und Zustand
 *   im `where` ihres Schreibvorgangs. Diese Komponente ist Bedienung, nicht
 *   Absicherung — sie ist genau so vertrauenswürdig wie der Browser, in dem
 *   sie läuft, nämlich gar nicht.
 *
 * Der Frame wird OHNE `?modus=lesen` geöffnet: der Spieler bekommt Terra
 * vollständig, mit allen Werkzeugen. Das ist der Punkt der Runde — die
 * Abnahme steht am Ende, nicht als Fessel am Werkzeug.
 *
 * Zwei Prüfungen bei jeder eingehenden Nachricht, wie überall:
 *   - `event.origin === window.location.origin`
 *   - `event.source === iframe.contentWindow`
 * Und beim Senden immer `window.location.origin` als Ziel, nie "*".
 */

export interface TerraSpielerRahmenProps {
  worldSlug: string;
  karteId: string;
  /** Zeilenversion beim Laden der Seite — Grundlage der Konflikterkennung. */
  version: number;
  /** Kartenbaum im Format v5, oder null für eine noch leere Karte. */
  daten: unknown | null;
  /** Pfad zum gleich-origin ausgelieferten Terra (ohne Query). */
  quelle?: string;
}

const ENTPRELLUNG_MS = 1200;
const STANDARD_QUELLE = "/terra/index.html";

type Zustand = "bereit" | "geladen" | "ungespeichert" | "speichert" | "gespeichert" | "fehler" | "gesperrt";

const ZUSTAND_TEXT: Record<Zustand, string> = {
  bereit: "Editor lädt …",
  geladen: "Entwurf geladen",
  ungespeichert: "ungespeicherte Änderungen",
  speichert: "speichert …",
  gespeichert: "gespeichert",
  fehler: "Fehler beim Speichern",
  gesperrt: "nicht mehr bearbeitbar — bitte neu laden",
};

export function TerraSpielerRahmen({ worldSlug, karteId, version, daten, quelle }: TerraSpielerRahmenProps) {
  const rahmenRef = useRef<HTMLIFrameElement | null>(null);
  const versionRef = useRef(version);
  const offenRef = useRef<string | null>(null); // zuletzt gemeldeter Baum, noch nicht geschrieben
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laeuftRef = useRef(false);
  const gesperrtRef = useRef(false); // nach Konflikt oder Abnahme wird nicht weitergeschrieben
  const [zustand, setZustand] = useState<Zustand>("bereit");
  const [meldung, setMeldung] = useState<string | null>(null);

  const schreiben = useCallback(async () => {
    const text = offenRef.current;
    if (text === null || gesperrtRef.current) return;
    if (laeuftRef.current) return; // eine Runde läuft; der Timer greift danach erneut
    offenRef.current = null;
    laeuftRef.current = true;
    setZustand("speichert");

    const form = new FormData();
    form.set("worldSlug", worldSlug);
    form.set("karteId", karteId);
    form.set("daten", text);
    form.set("version", String(versionRef.current));

    try {
      const antwort = await speichereSpielerKarteAction(form);
      if (antwort.ok && typeof antwort.version === "number") {
        versionRef.current = antwort.version;
        setZustand("gespeichert");
        setMeldung(null);
        // Die neue Version zurück in den Frame — sonst liefe die nächste
        // Speicherung mit der alten Zahl in die Konflikterkennung.
        rahmenRef.current?.contentWindow?.postMessage(
          { typ: "stand-bestaetigt", version: antwort.version },
          window.location.origin,
        );
      } else if (antwort.konflikt) {
        gesperrtRef.current = true;
        setZustand("gesperrt");
        setMeldung(antwort.error ?? null);
      } else {
        /* Kein Konflikt und kein Erfolg: entweder ist der Entwurf inzwischen
           eingereicht/abgenommen (dann ist Weiterschreiben falsch), oder es
           war ein Aussetzer. Beides sperrt hier — der Stand geht nicht
           verloren, er steht weiter im Frame und in Terras eigenem Autosave.
           Lieber einmal neu laden als leise gegen eine Wand schreiben. */
        gesperrtRef.current = true;
        setZustand("gesperrt");
        setMeldung(antwort.error ?? "Speichern fehlgeschlagen");
      }
    } catch {
      // Netzaussetzer: der Stand wandert zurück in die Warte und wird beim
      // nächsten Anlauf erneut versucht.
      offenRef.current = text;
      setZustand("fehler");
    } finally {
      laeuftRef.current = false;
    }
  }, [karteId, worldSlug]);

  useEffect(() => {
    function plane() {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void schreiben();
      }, ENTPRELLUNG_MS);
    }

    function empfange(ereignis: MessageEvent) {
      if (ereignis.origin !== window.location.origin) return;
      const rahmen = rahmenRef.current;
      if (!rahmen || ereignis.source !== rahmen.contentWindow) return;

      const nachricht = ereignis.data as { typ?: unknown; daten?: unknown } | null;
      if (!nachricht || typeof nachricht !== "object" || typeof nachricht.typ !== "string") return;

      if (nachricht.typ === "terra-bereit") {
        rahmen.contentWindow?.postMessage(
          { typ: "karte-laden", daten: daten ?? null, version: versionRef.current },
          window.location.origin,
        );
        setZustand("geladen");
        return;
      }
      if (nachricht.typ === "karte-geaendert") {
        if (gesperrtRef.current) return;
        try {
          offenRef.current = JSON.stringify(nachricht.daten);
        } catch {
          return;
        }
        setZustand("ungespeichert");
        plane();
        return;
      }
      if (nachricht.typ === "terra-fehler") {
        setZustand("fehler");
      }
      /* `welt-vorgabe-ergebnis` fällt hier durch: die KI-Weltvorgabe ist eine
         Studio-Sache (sie läuft über den Maschinenraum-Host und die Brain-Aktionen des
         Spielleiters). Das Werkzeug im Frame ist davon unberührt — der
         Spieler baut von Hand, ohne Einschränkung. */
    }

    /* Flush beim Verlassen: der offene Stand geht sofort los, statt die
       Ruhezeit abzuwarten. Mehr ist an dieser Stelle nicht möglich — eine
       Server Action lässt sich nicht synchron abwarten. */
    function beimVerlassen() {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void schreiben();
    }

    window.addEventListener("message", empfange);
    window.addEventListener("beforeunload", beimVerlassen);
    return () => {
      window.removeEventListener("message", empfange);
      window.removeEventListener("beforeunload", beimVerlassen);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      // Beim Verlassen der Route (Client-Navigation) feuert kein beforeunload.
      void schreiben();
    };
  }, [daten, schreiben]);

  return (
    <div className="terra-rahmen">
      <div className="terra-rahmen-kopf">
        <span>Terra — dein Entwurf</span>
        <span
          className="terra-rahmen-zustand"
          data-art={zustand === "gesperrt" || zustand === "fehler" ? zustand : undefined}
          data-testid="terra-spieler-zustand"
          role="status"
        >
          {ZUSTAND_TEXT[zustand]}
        </span>
      </div>
      <div className="terra-rahmen-flaeche">
        <iframe
          ref={rahmenRef}
          src={quelle ?? STANDARD_QUELLE}
          title="Terra Karteneditor"
          data-testid="terra-spieler-rahmen"
          // Kein sandbox-Attribut: der Frame ist gleich-origin und braucht
          // localStorage (Terras Autosave-Ring). Gleiche Begründung wie im
          // Studio — ein `sandbox` MIT allow-same-origin plus allow-scripts
          // hebt sich ohnehin selbst auf.
          allow="fullscreen"
        />
      </div>
      {meldung ? (
        <p className="terra-rahmen-meldung" data-testid="terra-spieler-meldung">
          {meldung}
        </p>
      ) : null}
    </div>
  );
}
