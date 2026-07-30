"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import type { TerraWorldDraft } from "@uwe/ai-brain/proposal-validators";
import { speichereTerraKarteAction } from "@/app/terra-actions";
import { TerraEntwurfPanel, type TerraEntwurfErgebnis } from "./TerraEntwurfPanel";
import { TerraTextPanel } from "./TerraTextPanel";
import "./terra.css";

/**
 * Die Studio-Seite der gleich-origin Terra-Brücke. Jeder Empfang prüft sowohl
 * Herkunft als auch den konkreten Frame; jedes postMessage hat ein festes
 * Ziel. Auch der Wechsel ins eigene Fenster läuft zuerst durch dieselbe
 * konfliktgeprüfte Server Action wie das normale Autosave.
 */
export interface TerraRahmenProps {
  worldSlug: string;
  karteId: string;
  version: number;
  daten: unknown | null;
  quelle?: string;
  /** Schlanke, geschützte Pop-out-Route ohne WorldShell und KI-Panels. */
  fensterModus?: boolean;
}

const ENTPRELLUNG_MS = 1200;
const STAND_TIMEOUT_MS = 8000;
const STANDARD_QUELLE = "/terra/index.html";
const FENSTER_NAME_PREFIX = "uwe-terra-karteneditor-";

type Zustand = "bereit" | "geladen" | "ungespeichert" | "speichert" | "gespeichert" | "fehler" | "konflikt";
type SpeicherErgebnis = "ok" | "fehler" | "konflikt";
type KartenStand = { anfrageId: string; daten: unknown; version: number | null };
type StandWarter = {
  anfrageId: string;
  timer: number;
  resolve: (stand: KartenStand) => void;
  reject: (grund: Error) => void;
};

const ZUSTAND_TEXT: Record<Zustand, string> = {
  bereit: "Editor lädt …",
  geladen: "Karte geladen",
  ungespeichert: "ungespeicherte Änderungen",
  speichert: "speichert …",
  gespeichert: "gespeichert",
  fehler: "Fehler beim Speichern",
  konflikt: "Konflikt — bitte neu laden",
};

function fensterName(karteId: string): string {
  return `${FENSTER_NAME_PREFIX}${karteId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function fensterMerkmale(): string {
  const verfuegbarBreite = window.screen?.availWidth || window.innerWidth || 1440;
  const verfuegbarHoehe = window.screen?.availHeight || window.innerHeight || 900;
  const breite = Math.max(960, Math.min(verfuegbarBreite - 32, 1720));
  const hoehe = Math.max(700, Math.min(verfuegbarHoehe - 32, 1100));
  const links = Math.max(0, Math.round((verfuegbarBreite - breite) / 2));
  const oben = Math.max(0, Math.round((verfuegbarHoehe - hoehe) / 2));
  return [
    "popup=yes",
    "resizable=yes",
    "scrollbars=yes",
    `width=${breite}`,
    `height=${hoehe}`,
    `left=${links}`,
    `top=${oben}`,
  ].join(",");
}

function bereiteWartefensterVor(popup: Window): void {
  try {
    const doc = popup.document;
    doc.title = "Terra — Karte wird gesichert";
    doc.documentElement.lang = "de";
    doc.body.replaceChildren();
    Object.assign(doc.body.style, {
      margin: "0",
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0b0d10",
      color: "#eee8da",
      fontFamily: "system-ui, sans-serif",
    });
    const hinweis = doc.createElement("p");
    hinweis.textContent = "Der aktuelle Kartenstand wird sicher gespeichert …";
    hinweis.style.padding = "2rem";
    doc.body.append(hinweis);
  } catch {
    // Ein Browser darf den Zugriff auf about:blank einschränken. Die spätere
    // Navigation über den gehaltenen Window-Verweis funktioniert trotzdem.
  }
}

export function TerraRahmen({
  worldSlug,
  karteId,
  version,
  daten,
  quelle,
  fensterModus = false,
}: TerraRahmenProps) {
  const rahmenRef = useRef<HTMLIFrameElement | null>(null);
  const versionRef = useRef(version);
  const offenRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aktiverSpeicherRef = useRef<Promise<SpeicherErgebnis> | null>(null);
  const gesperrtRef = useRef(false);
  const fensterwechselRef = useRef(false);
  const standWarterRef = useRef<StandWarter | null>(null);
  const popupPrueferRef = useRef<number | null>(null);
  const [zustand, setZustand] = useState<Zustand>("bereit");
  const [frameBereit, setFrameBereit] = useState(false);
  const [fensterGesperrt, setFensterGesperrt] = useState(false);
  const [fensterMeldung, setFensterMeldung] = useState<string | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [vollbildAktiv, setVollbildAktiv] = useState(false);
  const [entwurfErgebnis, setEntwurfErgebnis] = useState<TerraEntwurfErgebnis | null>(null);

  const sendeVorgabe = useCallback(
    (vorgabe: TerraWorldDraft, opt: { laufId: string | null; seed: number | null }) => {
      const frame = rahmenRef.current?.contentWindow;
      if (!frame || fensterwechselRef.current) return false;
      setEntwurfErgebnis(null);
      frame.postMessage(
        { typ: "welt-vorgabe", vorgabe, laufId: opt.laufId ?? undefined, seed: opt.seed ?? undefined },
        window.location.origin,
      );
      return true;
    },
    [],
  );

  /** Ein einzelner konfliktgeprüfter Schreibvorgang. Die Version wird erst in
   *  dem Moment gelesen, in dem die Action wirklich startet. */
  const speichereText = useCallback(
    async (text: string): Promise<SpeicherErgebnis> => {
      if (gesperrtRef.current) return "konflikt";
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
          rahmenRef.current?.contentWindow?.postMessage(
            { typ: "stand-bestaetigt", version: antwort.version },
            window.location.origin,
          );
          return "ok";
        }
        if (antwort.konflikt) {
          gesperrtRef.current = true;
          setZustand("konflikt");
          return "konflikt";
        }
        setZustand("fehler");
        return "fehler";
      } catch {
        setZustand("fehler");
        return "fehler";
      }
    },
    [karteId, worldSlug],
  );

  /** Serialisiert Autosave und Fensterwechsel. So wartet der Schnappschuss auf
   *  einen eventuell laufenden Save und verwendet danach dessen neue Version. */
  const speichereSerialisiert = useCallback(
    async (text: string): Promise<SpeicherErgebnis> => {
      while (aktiverSpeicherRef.current) await aktiverSpeicherRef.current;
      if (gesperrtRef.current) return "konflikt";
      const lauf = speichereText(text);
      aktiverSpeicherRef.current = lauf;
      try {
        return await lauf;
      } finally {
        if (aktiverSpeicherRef.current === lauf) aktiverSpeicherRef.current = null;
      }
    },
    [speichereText],
  );

  const schreiben = useCallback(async () => {
    const text = offenRef.current;
    if (text === null || gesperrtRef.current || fensterwechselRef.current) return;
    offenRef.current = null;
    const ergebnis = await speichereSerialisiert(text);
    // Kam während des Schreibens kein neuerer Stand herein, bleibt der
    // fehlgeschlagene Text in der Warteschlange. Nichts wird still verworfen.
    if (ergebnis === "fehler" && offenRef.current === null) offenRef.current = text;
  }, [speichereSerialisiert]);

  const fordereKartenStand = useCallback((): Promise<KartenStand> => {
    const frame = rahmenRef.current?.contentWindow;
    if (!frame) return Promise.reject(new Error("Der Terra-Frame ist noch nicht bereit."));
    const zufall = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const anfrageId = `fenster-${zufall}`;
    return new Promise<KartenStand>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        if (standWarterRef.current?.anfrageId === anfrageId) standWarterRef.current = null;
        reject(new Error("Terra hat den aktuellen Kartenstand nicht rechtzeitig geliefert."));
      }, STAND_TIMEOUT_MS);
      standWarterRef.current = { anfrageId, timer, resolve, reject };
      frame.postMessage({ typ: "karte-stand-anfordern", anfrageId }, window.location.origin);
    });
  }, []);

  const startePopupPruefer = useCallback((popup: Window) => {
    if (popupPrueferRef.current !== null) window.clearInterval(popupPrueferRef.current);
    popupPrueferRef.current = window.setInterval(() => {
      if (!popup.closed) return;
      if (popupPrueferRef.current !== null) window.clearInterval(popupPrueferRef.current);
      popupPrueferRef.current = null;
      // Das Pop-out hat seine eigene Version weitergeschrieben. Nur ein voller
      // Reload garantiert, dass der ursprüngliche Frame exakt diesen Stand lädt.
      window.location.reload();
    }, 600);
  }, []);

  const oeffneEigenesFenster = useCallback(async () => {
    if (fensterModus || fensterwechselRef.current || gesperrtRef.current || !frameBereit) return;

    const ziel = new URL(window.location.href);
    ziel.searchParams.set("terraFenster", "1");
    ziel.hash = "";
    const name = fensterName(karteId);

    // Muss synchron im Klick-Handler geschehen; erst danach dürfen Snapshot und
    // Server Action awaited werden, sonst werten Browser das Fenster als Popup.
    let popup: Window | null = null;
    try {
      popup = window.open("about:blank", name, fensterMerkmale());
    } catch {
      popup = null;
    }
    if (popup) bereiteWartefensterVor(popup);

    fensterwechselRef.current = true;
    setFensterGesperrt(true);
    setFallbackUrl(null);
    setFensterMeldung(popup ? "Karte wird gesichert …" : "Pop-up blockiert — Karte wird für den Ersatzlink gesichert …");
    rahmenRef.current?.blur();
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    try {
      const stand = await fordereKartenStand();
      const text = JSON.stringify(stand.daten);
      offenRef.current = null;
      const ergebnis = await speichereSerialisiert(text);
      if (ergebnis !== "ok") {
        throw new Error(ergebnis === "konflikt" ? "Die Karte wurde inzwischen an anderer Stelle geändert." : "Die Karte konnte nicht gespeichert werden.");
      }

      if (popup?.closed) {
        window.location.reload();
        return;
      }
      if (!popup) {
        setFallbackUrl(ziel.toString());
        setFensterMeldung("Das Pop-up wurde blockiert. Der Kartenstand ist sicher gespeichert.");
        return;
      }
      popup.location.replace(ziel.toString());
      popup.focus();
      setFensterMeldung("Der Editor läuft im eigenen Fenster. Nach dem Schließen wird diese Seite neu geladen.");
      startePopupPruefer(popup);
    } catch (fehler) {
      fensterwechselRef.current = false;
      setFensterGesperrt(false);
      setFallbackUrl(null);
      setFensterMeldung(fehler instanceof Error ? fehler.message : "Der Fensterwechsel ist fehlgeschlagen.");
      if (popup && !popup.closed) {
        try { popup.close(); } catch { /* nichts */ }
      }
    }
  }, [fensterModus, fordereKartenStand, frameBereit, karteId, speichereSerialisiert, startePopupPruefer]);

  const fuelleBildschirm = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFensterMeldung("Der Browser hat den Vollbildmodus nicht freigegeben.");
    }
  }, []);

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
      const nachricht = ereignis.data as {
        typ?: unknown;
        daten?: unknown;
        version?: unknown;
        anfrageId?: unknown;
        meldung?: unknown;
      } | null;
      if (!nachricht || typeof nachricht !== "object" || typeof nachricht.typ !== "string") return;

      if (nachricht.typ === "terra-bereit") {
        rahmen.contentWindow?.postMessage(
          { typ: "karte-laden", daten: daten ?? null, version: versionRef.current },
          window.location.origin,
        );
        setFrameBereit(true);
        setZustand("geladen");
        return;
      }
      if (nachricht.typ === "karte-stand") {
        const warter = standWarterRef.current;
        if (!warter || nachricht.anfrageId !== warter.anfrageId) return;
        if (!nachricht.daten || typeof nachricht.daten !== "object" || Array.isArray(nachricht.daten)) return;
        if (nachricht.version !== null && !Number.isFinite(nachricht.version)) return;
        window.clearTimeout(warter.timer);
        standWarterRef.current = null;
        warter.resolve({
          anfrageId: warter.anfrageId,
          daten: nachricht.daten,
          version: nachricht.version === null ? null : Number(nachricht.version),
        });
        return;
      }
      if (nachricht.typ === "karte-geaendert") {
        if (gesperrtRef.current || fensterwechselRef.current) return;
        try { offenRef.current = JSON.stringify(nachricht.daten); }
        catch { return; }
        setZustand("ungespeichert");
        plane();
        return;
      }
      if (nachricht.typ === "terra-fehler") {
        setZustand("fehler");
        const warter = standWarterRef.current;
        if (warter) {
          window.clearTimeout(warter.timer);
          standWarterRef.current = null;
          warter.reject(new Error(typeof nachricht.meldung === "string" ? nachricht.meldung : "Terra konnte den Kartenstand nicht liefern."));
        }
        return;
      }
      if (nachricht.typ === "welt-vorgabe-ergebnis") {
        setEntwurfErgebnis(nachricht as unknown as TerraEntwurfErgebnis);
      }
    }

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
      if (popupPrueferRef.current !== null) clearInterval(popupPrueferRef.current);
      const warter = standWarterRef.current;
      if (warter) {
        clearTimeout(warter.timer);
        warter.reject(new Error("Die Editor-Seite wurde verlassen."));
        standWarterRef.current = null;
      }
      void schreiben();
    };
  }, [daten, schreiben]);

  useEffect(() => {
    if (!fensterModus) return;
    const aktualisiere = () => setVollbildAktiv(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", aktualisiere);
    return () => document.removeEventListener("fullscreenchange", aktualisiere);
  }, [fensterModus]);

  function fallbackGeoeffnet(ereignis: ReactMouseEvent<HTMLAnchorElement>) {
    if (!fallbackUrl) return;
    // Ein zweiter, ausdrücklicher Klick wird von Popup-Blockern meist erlaubt.
    // Gibt der Browser einen Handle zurück, gilt dieselbe Close-Überwachung wie
    // im Normalweg. Sonst darf der echte Link weiter in einen neuen Tab führen;
    // die Ursprungsansicht bleibt bis „Hier weiterarbeiten“ sicher gesperrt.
    const popup = window.open(fallbackUrl, fensterName(karteId), fensterMerkmale());
    if (popup) {
      ereignis.preventDefault();
      popup.focus();
      startePopupPruefer(popup);
    }
    setFensterMeldung("Der gesicherte Editor wurde in einem neuen Tab geöffnet. Diese Ansicht bleibt gesperrt.");
  }

  return (
    <div className={`terra-rahmen${fensterModus ? " terra-rahmen--fenster" : ""}`}>
      <div className="terra-rahmen-kopf">
        <span className="terra-rahmen-titel">Terra — Karteneditor</span>
        <div className="terra-rahmen-kopfaktionen">
          <span
            className="terra-rahmen-zustand"
            data-art={zustand === "konflikt" || zustand === "fehler" ? zustand : undefined}
            data-testid="terra-zustand"
            role="status"
          >
            {ZUSTAND_TEXT[zustand]}
          </span>
          {fensterModus ? (
            <button className="terra-rahmen-aktion" type="button" onClick={() => void fuelleBildschirm()}>
              {vollbildAktiv ? "Vollbild verlassen" : "Bildschirm füllen"}
            </button>
          ) : (
            <button
              className="terra-rahmen-aktion"
              type="button"
              disabled={!frameBereit || fensterGesperrt || zustand === "konflikt"}
              onClick={() => void oeffneEigenesFenster()}
            >
              In eigenem Fenster öffnen
            </button>
          )}
        </div>
      </div>
      <div className="terra-rahmen-flaeche" data-fenster-gesperrt={fensterGesperrt || undefined}>
        <iframe
          ref={rahmenRef}
          src={quelle ?? STANDARD_QUELLE}
          title="Terra Karteneditor"
          data-testid="terra-rahmen"
          allow="fullscreen"
          tabIndex={fensterGesperrt ? -1 : 0}
        />
        {fensterGesperrt ? (
          <div className="terra-rahmen-sperre" role="status" aria-live="polite">
            <p>{fensterMeldung}</p>
            {fallbackUrl ? (
              <div className="terra-rahmen-sperre-aktionen">
                <a href={fallbackUrl} target={fensterName(karteId)} onClick={fallbackGeoeffnet}>
                  Gesicherten Editor in neuem Tab öffnen
                </a>
                <button type="button" onClick={() => window.location.reload()}>Hier weiterarbeiten</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {!fensterModus ? (
        <>
          <TerraEntwurfPanel worldSlug={worldSlug} sende={sendeVorgabe} ergebnis={entwurfErgebnis} />
          <TerraTextPanel worldSlug={worldSlug} />
        </>
      ) : null}
      {!fensterGesperrt && fensterMeldung ? (
        <p className="terra-rahmen-meldung" role="alert">{fensterMeldung}</p>
      ) : null}
    </div>
  );
}