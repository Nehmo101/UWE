"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TerraWorldDraft } from "@uwe/ai-brain/proposal-validators";
import { speichereTerraKarteAction } from "@/app/terra-actions";
import { TerraEntwurfPanel, type TerraEntwurfErgebnis } from "./TerraEntwurfPanel";
import "./terra.css";

/**
 * Die Studio-Seite der Brücke (J1).
 *
 * Dünn mit Absicht: die Komponente hält den Frame und die Nachrichten,
 * sonst nichts. Die Rechteprüfung liegt VOR ihr (Server-Komponente +
 * WorldShell + Middleware) und HINTER ihr (Server Action mit dem vollen
 * Trio). Der Frame selbst besitzt weder Route noch Sitzung.
 *
 * Zwei Prüfungen bei jeder eingehenden Nachricht, nicht eine:
 *   - `event.origin === window.location.origin` (gleich-origin ausgeliefert)
 *   - `event.source === iframe.contentWindow`   (wirklich UNSER Frame)
 * Und beim Senden immer `window.location.origin` als Ziel, nie "*".
 *
 * Speichern läuft entprellt (1200 ms) — aber MIT Flush beim Verlassen der
 * Seite. Dem Vorgänger fehlte genau dieser Flush: der Timer wurde beim
 * Verlassen abgebrochen, und damit gingen die letzten Sekunden Arbeit
 * verloren.
 */

export interface TerraRahmenProps {
  worldSlug: string;
  karteId: string;
  /** Zeilenversion beim Laden der Seite — Grundlage der Konflikterkennung. */
  version: number;
  /** Kartenbaum im Format v5, oder null für eine noch leere Karte. */
  daten: unknown | null;
  /** Pfad zum gleich-origin ausgelieferten Terra. */
  quelle?: string;
}

const ENTPRELLUNG_MS = 1200;
const STANDARD_QUELLE = "/terra/index.html";

type Zustand = "bereit" | "geladen" | "ungespeichert" | "speichert" | "gespeichert" | "fehler" | "konflikt";

const ZUSTAND_TEXT: Record<Zustand, string> = {
  bereit: "Editor lädt …",
  geladen: "Karte geladen",
  ungespeichert: "ungespeicherte Änderungen",
  speichert: "speichert …",
  gespeichert: "gespeichert",
  fehler: "Fehler beim Speichern",
  konflikt: "Konflikt — bitte neu laden",
};

export function TerraRahmen({ worldSlug, karteId, version, daten, quelle }: TerraRahmenProps) {
  const rahmenRef = useRef<HTMLIFrameElement | null>(null);
  const versionRef = useRef(version);
  const offenRef = useRef<string | null>(null); // zuletzt gemeldeter Baum, noch nicht geschrieben
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laeuftRef = useRef(false);
  const gesperrtRef = useRef(false); // nach einem Konflikt wird nicht weitergeschrieben
  const [zustand, setZustand] = useState<Zustand>("bereit");
  /* J4: das Ergebnis der letzten Erzeugung. Es kommt aus dem Frame zurück und
     gehört ins Bedienfeld — der Rahmen reicht es nur durch. */
  const [entwurfErgebnis, setEntwurfErgebnis] = useState<TerraEntwurfErgebnis | null>(null);

  /** Schickt eine geprüfte Weltvorgabe in den Frame. Ziel ist wie überall
   *  `window.location.origin`, nie "*". Die Rückfrage vor dem Überschreiben
   *  stellt der Frame — nur er kennt den Inhalt der Karte. */
  const sendeVorgabe = useCallback(
    (vorgabe: TerraWorldDraft, opt: { laufId: string | null; seed: number | null }) => {
      const fenster = rahmenRef.current?.contentWindow;
      if (!fenster) return false;
      setEntwurfErgebnis(null);
      fenster.postMessage(
        {
          typ: "welt-vorgabe",
          vorgabe,
          laufId: opt.laufId ?? undefined,
          seed: opt.seed ?? undefined,
        },
        window.location.origin,
      );
      return true;
    },
    [],
  );

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
      const antwort = await speichereTerraKarteAction(form);
      if (antwort.ok && typeof antwort.version === "number") {
        versionRef.current = antwort.version;
        setZustand("gespeichert");
        // Die neue Version zurück in den Frame — sonst liefe die nächste
        // Speicherung mit der alten Zahl in die Konflikterkennung.
        rahmenRef.current?.contentWindow?.postMessage(
          { typ: "stand-bestaetigt", version: antwort.version },
          window.location.origin,
        );
      } else if (antwort.konflikt) {
        gesperrtRef.current = true;
        setZustand("konflikt");
      } else {
        // Der Stand geht nicht verloren: er wandert zurück in die Warte.
        offenRef.current = text;
        setZustand("fehler");
      }
    } catch {
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
      // Beide Prüfungen — Herkunft UND Absender.
      if (ereignis.origin !== window.location.origin) return;
      const rahmen = rahmenRef.current;
      if (!rahmen || ereignis.source !== rahmen.contentWindow) return;

      const nachricht = ereignis.data as { typ?: unknown; daten?: unknown; meldung?: unknown } | null;
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
        return;
      }
      /* J4: die Quittung der Weltvorgabe. Die geänderte Karte kommt getrennt
         über `karte-geaendert` und wird wie jede andere Änderung gespeichert
         — diese Nachricht ist nur die Auskunft für das Bedienfeld. */
      if (nachricht.typ === "welt-vorgabe-ergebnis") {
        setEntwurfErgebnis(nachricht as unknown as TerraEntwurfErgebnis);
      }
    }

    /* Flush beim Verlassen: der offene Stand wird sofort losgeschickt, statt
       die Ruhezeit abzuwarten. Mehr geht an dieser Stelle nicht — eine Server
       Action lässt sich nicht synchron abwarten. Das Fenster, in dem Arbeit
       verloren gehen kann, schrumpft damit von 1,2 s auf die Laufzeit einer
       Anfrage. */
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
        <span>Terra — Karteneditor</span>
        <span
          className="terra-rahmen-zustand"
          data-art={zustand === "konflikt" || zustand === "fehler" ? zustand : undefined}
          data-testid="terra-zustand"
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
          data-testid="terra-rahmen"
          // Kein sandbox-Attribut: der Frame ist gleich-origin und braucht
          // localStorage (Terras Autosave-Ring). Ein `sandbox` ohne
          // allow-same-origin nähme ihm genau das — und ein `sandbox` MIT
          // allow-same-origin plus allow-scripts hebt sich selbst auf.
          allow="fullscreen"
        />
      </div>
      <TerraEntwurfPanel worldSlug={worldSlug} sende={sendeVorgabe} ergebnis={entwurfErgebnis} />
    </div>
  );
}
