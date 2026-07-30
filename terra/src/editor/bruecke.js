/* ==========================================================================
   bruecke.js — die Terra-Seite der Einbettung (J1)

   Terra läuft im Studio und im Portal in einem gleich-origin <iframe>. Die
   Karte kommt NICHT über einen eigenen Netzweg herein und geht auch nicht so
   hinaus: der Frame ist ein reiner Renderer. Alles reist über `postMessage`,
   und jeder Schreibvorgang läuft anschließend durch die Server Actions der
   Elternseite — mit deren vollem Rechte-Trio (CSRF/Origin → Rolle → gehört
   die Karte zur Welt). Der Frame kann davon nichts umgehen: er besitzt keine
   Route, keine Sitzung und kein Schreibrecht, sondern nur ein Ziel, das ihm
   zuhört oder eben nicht.

   DREI ZUSAGEN, die dieses Modul einhält:

   1. AUSSERHALB EINES RAHMENS VOLLSTÄNDIG INAKTIV.
      Terra muss weiterhin per Doppelklick auf terra/index.html laufen, ohne
      dass sich irgendetwas anders verhält. Deshalb greift dieses Modul beim
      Laden auf GAR NICHTS zu — kein window, kein document, kein location.
      Alles passiert erst in setzeBrueckenWege(), und dort steht die Prüfung
      ganz vorne. In den Tests (node ohne window) ist das Modul damit ebenso
      still wie bei einem Doppelklick.

   2. DIE IMPORTRICHTUNG BLEIBT KALT.
      Dieses Modul importiert NICHTS aus terra. editor/io.js meldet seine Wege
      hier an — genau wie es seine Kartenwege bei ui/panels.js anmeldet
      (setzeKartenWege) und sein Ausschnitt-Polygon bei editor/tools.js
      (setzeAusschnittWeg). Ein Ring über bruecke.js ist damit ausgeschlossen,
      nicht nur unwahrscheinlich.

   3. HERKUNFT UND ABSENDER WERDEN BEIDE GEPRÜFT.
      `event.origin === location.origin` allein genügt nicht: jeder andere
      Frame derselben Herkunft könnte sonst Karten hereinschieben. Deshalb
      zusätzlich `event.source === window.parent`. Und beim Senden steht als
      Ziel immer `location.origin`, niemals "*".

   ------------------------------------------------------------------------
   DER NACHRICHTENVERTRAG (beide Richtungen, alle Felder)

   Eltern → Frame
     { typ: "karte-laden",       daten, version }
        `daten`   Kartenbaum im Format v5 (Objekt) ODER null für eine noch
                  leere Karte. Ein v1..v4-Objekt wird ebenfalls angenommen —
                  leseBaumDatei() in world/kartenbaum.js normiert es.
        `version` Zeilenversion der Datenbank (ganze Zahl). Terra rechnet
                  damit nicht, es reicht sie unverändert zurück.

     { typ: "stand-bestaetigt",  version }
        Nach jedem erfolgreichen Speichern. Erst dadurch meldet der Frame
        beim nächsten Mal die neue Version — ohne diese Nachricht liefe jede
        zweite Speicherung in die Konflikterkennung.

     { typ: "welt-vorgabe",      vorgabe, laufId, seed }                 (J4)
        Ein von der Brain-Aktion `terra_world_draft` geprüfter Parametersatz.
        Der Frame prüft ihn NOCH EINMAL (welt-vorgabe.js klemmt), fragt bei
        einer bestückten Karte zurück und baut dann die Welt.
        `laufId`  optionale Kennung des KI-Laufs. Sie wandert in den
                  Herkunftsvermerk der Karte — der Prompt selbst nicht,
                  Begründung in generators/welt-vorgabe.js.
        `seed`    optionaler Startseed. Fehlt er, bleibt es bei S.worldSeed.
        Es gibt bewusst KEINE zweite Nachricht "bauen jetzt wirklich": die
        Rückfrage stellt der Frame, weil nur er weiß, wieviel auf der Karte
        steht. Eine Elternseite, die sie überspringen wollte, könnte es nicht.

     { typ: "karte-stand-anfordern", anfrageId }
        Fordert den aktuellen, noch nicht zwingend entprellt gemeldeten Stand
        für einen sicheren Fensterwechsel an. `anfrageId` ist eine kurze,
        nichtleere Zeichenkette und wird unverändert zurückgegeben.

   Frame → Eltern
     { typ: "terra-bereit",      protokoll, modus }
        Einmal, sobald der Frame Karten annehmen kann. Die Elternseite wartet
        darauf und schickt DANN erst `karte-laden`; `iframe.onload` wäre zu
        früh, weil die ES-Module danach noch laufen.

     { typ: "karte-geaendert",   daten, version }
        Entprellt nach jeder Änderung, plus Flush bei `beforeunload`.
        `daten` ist der ganze Baum, `version` die zuletzt bestätigte.
        Im Lesemodus wird diese Nachricht NIE gesendet.

     { typ: "karte-stand",       anfrageId, daten, version }
        Direkte Antwort auf `karte-stand-anfordern`. Sie umgeht bewusst weder
        die Elternseite noch deren Server Action: der Elternteil speichert
        diesen Schnappschuss konfliktgeprüft, bevor er das Editorfenster
        öffnet. So geht auch der letzte, noch nicht entprellte Strich mit.

     { typ: "terra-fehler",      meldung }
        Wenn eine hereingereichte Karte nicht gelesen werden konnte. Der
        Editorzustand bleibt dabei unangetastet (io.js prüft atomar).

     { typ: "welt-vorgabe-ergebnis", ok, bericht, hinweise, meldung }    (J4)
        Antwort auf `welt-vorgabe`, immer genau eine je Anfrage.
        `ok`        wurde gebaut?
        `bericht`   { elemente, fluesse, siedlungen, region, namen, seed }
        `hinweise`  was die Prüfung im Frame geklemmt oder verworfen hat
        `meldung`   Grund, wenn nicht gebaut wurde ("abgebrochen" bei einem
                    Nein auf die Rückfrage — kein Fehler, nur ein Nein)
        Die geänderte Karte geht danach wie jede andere Änderung über
        `karte-geaendert` hinaus; diese Nachricht ist nur die Quittung.

   ------------------------------------------------------------------------
   WARUM ENTPRELLT UND NICHT BEI JEDEM MAUSZUCKEN

   Der Auslöser ist die Bedienung selbst (pointerup/keyup/wheel/change) — ein
   Dauerpolling wäre auf einer 1024er Karte teuer, weil der Dateitext das
   Seed-Terrain neu rechnet. Nach dem letzten Zucken wird einmal gewartet,
   dann der Text gebaut und mit dem zuletzt gesendeten verglichen. Ist er
   gleich, geht nichts hinaus. Ein Kameraschwenk erzeugt so höchstens eine
   Nachricht, kein Nachrichtengewitter.
   ========================================================================== */

/** Fassung des Nachrichtenvertrags. Wächst nur bei einer Änderung, die ein
 *  älterer Elternteil nicht mehr verstünde. */
export const BRUECKE_PROTOKOLL = 1;

/** Ruhezeit nach der letzten Bedienung, bevor gemeldet wird. 1200 ms ist der
 *  Wert, den der Vorgaenger-Editor an dieser Stelle benutzt hat — uebernommen,
 *  weil er sich im Betrieb bewaehrt hatte, aber MIT beforeunload-Flush. */
export const ENTPRELLUNG_MS = 1200;

var wege = null;          // { text(), uebernehmen(text), melde(text) }
var fenster = null;       // das window, in dem wir laufen (null = inaktiv)
var herkunft = null;      // location.origin, als Ziel jeder Nachricht
var lesemodus = false;
var version = null;       // zuletzt bestätigte Zeilenversion der Datenbank
var letzterText = null;   // zuletzt gesendeter (oder empfangener) Dateitext
var timer = null;

/* --- Hilfen ------------------------------------------------------------- */

/**
 * Läuft Terra in einem eingebetteten Rahmen, dessen Elternteil wir sicher
 * ansprechen können? Drei Bedingungen, alle nötig:
 *   - es gibt überhaupt ein window (nicht in den Node-Tests),
 *   - window.parent ist ein ANDERES Fenster (kein Doppelklick, kein Tab),
 *   - die Herkunft ist eine echte (bei file:// ist origin "null", und ein
 *     postMessage mit dem Ziel "null" würde werfen — dann lieber gar nichts).
 */
function rahmenLage() {
  if (typeof window === "undefined" || !window) return null;
  if (!window.parent || window.parent === window) return null;
  var o = window.location && window.location.origin;
  if (!o || o === "null") return null;
  return { fenster: window, herkunft: o };
}

/** Ist `?modus=lesen` gesetzt? Bewusst ohne URL/URLSearchParams gelesen —
 *  eine einfache Zeichenkettenprüfung tut es und hängt an nichts. */
function lesemodusGewuenscht(suche) {
  return /(^|[?&])modus=lesen($|&)/.test(String(suche || ""));
}

function postiere(nachricht) {
  if (!fenster) return;
  try { fenster.parent.postMessage(nachricht, herkunft); }
  catch (_e) { /* Elternteil weg oder Herkunft gewechselt — nichts zu retten */ }
}

/** Blendet aus, was im Lesemodus nichts zu suchen hat. Das Portal ist
 *  read-only: es bleiben Kamera und Navigation, sonst nichts.
 *  Zusätzlich trägt <body> das Merkmal `data-terra-modus="lesen"`, damit die
 *  Gestaltung später ohne Codeänderung daran andocken kann. */
function lesemodusAnwenden(dok) {
  if (!dok) return;
  var weg = ["rail", "panel", "bar"];
  for (var i = 0; i < weg.length; i++) {
    var el = dok.getElementById(weg[i]);
    if (el && el.style) el.style.display = "none";
  }
  if (dok.body && dok.body.setAttribute) dok.body.setAttribute("data-terra-modus", "lesen");
}

/* --- Hinein: eine Karte annehmen ---------------------------------------- */

function karteLaden(nachricht) {
  version = Number.isFinite(nachricht.version) ? (nachricht.version | 0) : null;
  if (nachricht.daten === null || nachricht.daten === undefined) {
    // Frische Karte: der Editor behält, womit er gestartet ist. Der erste
    // Stand geht als ganz normale Änderung hinaus.
    letzterText = null;
    return;
  }
  var text;
  try {
    text = typeof nachricht.daten === "string"
      ? nachricht.daten : JSON.stringify(nachricht.daten);
  } catch (_e) {
    postiere({ typ: "terra-fehler", meldung: "Kartendaten ließen sich nicht lesen" });
    return;
  }
  try {
    wege.uebernehmen(text);
  } catch (e) {
    postiere({ typ: "terra-fehler", meldung: String((e && e.message) || e) });
    return;
  }
  /* Den zuletzt gesendeten Stand aus dem EDITOR holen, nicht aus der
     hereingereichten Zeichenkette: beim Übernehmen normiert Terra die Datei
     (Feldreihenfolge, weggelassene Vorgaben, v1..v4 → v5). Der rohe Text wäre
     nie wieder gleich, und die erste Probe meldete eine Änderung, die keine
     ist. */
  try { letzterText = wege.text(); }
  catch (_e) { letzterText = null; }
}

/**
 * Liefert einen atomaren Schnappschuss für den Wechsel in ein eigenes
 * Browserfenster. Die Anfragekennung wird begrenzt, damit ein fremdartiger
 * Elternteil nicht beliebig grosse Werte spiegeln kann. Herkunft und Absender
 * sind zu diesem Zeitpunkt bereits in `empfange()` streng geprüft.
 */
function karteStand(nachricht) {
  if (!wege || typeof nachricht.anfrageId !== "string") return;
  var anfrageId = nachricht.anfrageId;
  if (!anfrageId || anfrageId.length > 160) return;
  var text;
  var daten;
  try {
    text = wege.text();
    daten = JSON.parse(text);
  } catch (e) {
    postiere({ typ: "terra-fehler", meldung: String((e && e.message) || e) });
    return;
  }
  if (!daten || typeof daten !== "object" || Array.isArray(daten)) {
    postiere({ typ: "terra-fehler", meldung: "Der Kartenstand ist kein Objekt" });
    return;
  }
  postiere({ typ: "karte-stand", anfrageId: anfrageId, daten: daten, version: version });
}

/* --- Hinein: eine Weltvorgabe (J4) -------------------------------------- */

/**
 * Im Lesemodus wird gar nicht erst gebaut: das Portal zeigt Karten, es macht
 * keine. Sonst geht die Nachricht an den angemeldeten Weg — io.js prüft,
 * fragt zurück und baut. Die Quittung geht in jedem Fall zurück, auch bei
 * einem Nein: eine Bedienung, die auf eine Antwort wartet, darf nicht hängen.
 */
function weltVorgabe(nachricht) {
  if (lesemodus || !wege || typeof wege.vorgabe !== "function") {
    postiere({ typ: "welt-vorgabe-ergebnis", ok: false, meldung: "In diesem Modus wird nicht gebaut" });
    return;
  }
  var antwort;
  try {
    antwort = wege.vorgabe(nachricht.vorgabe, {
      laufId: nachricht.laufId,
      seed: nachricht.seed
    });
  } catch (e) {
    postiere({ typ: "welt-vorgabe-ergebnis", ok: false, meldung: String((e && e.message) || e) });
    return;
  }
  antwort = antwort || {};
  postiere({
    typ: "welt-vorgabe-ergebnis",
    ok: !!antwort.ok,
    bericht: antwort.bericht || null,
    hinweise: antwort.hinweise || [],
    meldung: antwort.meldung || null
  });
  // Die neue Karte soll nicht erst nach der nächsten Mausbewegung ankommen.
  if (antwort.ok) angestossen();
}

/* --- Heraus: Änderungen melden ------------------------------------------ */

function angestossen() {
  if (!fenster || lesemodus || !wege || timer) return;
  timer = fenster.setTimeout(melden, ENTPRELLUNG_MS);
}

function melden() {
  timer = null;
  if (!fenster || lesemodus || !wege) return;
  var text;
  try { text = wege.text(); }
  catch (_e) { return; }              // ein halber Baum wird nicht gemeldet
  if (text === letzterText) return;   // nichts Neues — kein Verkehr
  letzterText = text;
  var daten;
  try { daten = JSON.parse(text); }
  catch (_e) { return; }
  postiere({ typ: "karte-geaendert", daten: daten, version: version });
}

/** Sofort melden, ohne die Ruhezeit abzuwarten (Seitenverlassen). */
function fluss() {
  if (timer && fenster) { fenster.clearTimeout(timer); timer = null; }
  melden();
}

/* --- Anmeldung ---------------------------------------------------------- */

/**
 * editor/io.js meldet hier seine Wege an. Erst dieser Aufruf weckt die
 * Brücke: vorher horcht sie auf nichts und verändert nichts.
 *
 * @param {{ text: function(): string,
 *           uebernehmen: function(string): void,
 *           vorgabe?: function(object, object): object }} w
 *   `text()`        — der ganze Kartenbaum als Dateitext (baumText)
 *   `uebernehmen(t)`— liest, prüft ALLE Karten und übernimmt atomar
 *                     (baumUebernehmen); wirft bei jedem Verstoß
 *   `vorgabe(v, o)` — OPTIONAL (J4): prüft eine Weltvorgabe, fragt bei einer
 *                     bestückten Karte zurück, baut und liefert
 *                     { ok, bericht, hinweise, meldung }. Fehlt der Weg,
 *                     antwortet die Brücke mit einer Absage statt zu bauen.
 */
export function setzeBrueckenWege(w) {
  wege = w;
  var lage = rahmenLage();
  if (!lage) return;                 // Doppelklick, eigener Tab, Node — Ende.
  fenster = lage.fenster;
  herkunft = lage.herkunft;
  lesemodus = lesemodusGewuenscht(fenster.location.search);
  if (lesemodus) lesemodusAnwenden(typeof document === "undefined" ? null : document);

  fenster.addEventListener("message", empfange);

  /* Auslöser der Änderungsmeldung. Bewusst in der Einfangphase am Fenster:
     so entgeht uns nichts, was ein Werkzeug unterwegs abfängt. Im Lesemodus
     wird gar nicht erst zugehört — dort gibt es nichts zu melden. */
  if (!lesemodus) {
    var reize = ["pointerup", "pointercancel", "keyup", "wheel", "change", "drop"];
    for (var i = 0; i < reize.length; i++) {
      fenster.addEventListener(reize[i], angestossen, true);
    }
    fenster.addEventListener("beforeunload", fluss);
  }

  postiere({ typ: "terra-bereit", protokoll: BRUECKE_PROTOKOLL, modus: lesemodus ? "lesen" : "bearbeiten" });
}

function empfange(ereignis) {
  // Beide Prüfungen, nicht eine: gleiche Herkunft UND wirklich das
  // Elternfenster. Ein Geschwisterframe derselben Herkunft käme sonst durch.
  if (!fenster || ereignis.origin !== herkunft) return;
  if (ereignis.source !== fenster.parent) return;
  var n = ereignis.data;
  if (!n || typeof n !== "object" || typeof n.typ !== "string") return;
  if (n.typ === "karte-laden") {
    if (!wege) return;
    karteLaden(n);
  } else if (n.typ === "stand-bestaetigt") {
    if (Number.isFinite(n.version)) version = n.version | 0;
  } else if (n.typ === "karte-stand-anfordern") {
    karteStand(n);
  } else if (n.typ === "welt-vorgabe") {
    weltVorgabe(n);
  }
}

/**
 * Bedienungsrunde: Sofortmeldung von außen — der Speichern-Knopf (io.js)
 * schickt den offenen Stand ohne die Ruhezeit an die Elternseite, die ihn in
 * die Datenbank schreibt. Außerhalb eines Rahmens (Doppelklick, Tests) tut
 * der Aufruf nichts; im Lesemodus ebenso.
 */
export function brueckeSofort() { fluss(); }

/**
 * Läuft Terra eingebettet? Einzige Auskunft, die dieses Modul nach außen gibt.
 * editor/io.js fragt sie, um das Autosave-Angebot zu unterdrücken: im Rahmen
 * ist die Wahrheit die Karte aus der Datenbank, nicht der Ringpuffer im
 * localStorage dieser Herkunft. Eine Rückfrage „letzten Stand wiederherstellen?"
 * würde dort die gerade geladene Karte gegen eine fremde eintauschen.
 */
export function brueckeAktiv() {
  return !!fenster;
}

/* --- Nur für Tests ------------------------------------------------------ */

/** Setzt die Brücke in den Zustand vor der Anmeldung zurück. Kein
 *  Produktivweg — Terra baut die Seite pro Sitzung genau einmal auf. */
export function brueckeZuruecksetzen() {
  if (timer && fenster) fenster.clearTimeout(timer);
  wege = null; fenster = null; herkunft = null;
  lesemodus = false; version = null; letzterText = null; timer = null;
}

/** Innenansicht für Tests: läuft die Brücke, und in welchem Modus? */
export function brueckeZustand() {
  return { aktiv: !!fenster, lesemodus: lesemodus, version: version, offen: !!timer };
}
