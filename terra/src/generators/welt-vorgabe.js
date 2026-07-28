/* ==========================================================================
   welt-vorgabe.js — von der Beschreibung zur Weltvorgabe (J4)

   Der Weg einer beschriebenen Karte ist:

     Prompt  →  Brain-Aktion `terra_world_draft`  →  geprüfter Parametersatz
             →  über die Brücke in den Frame  →  DIESES MODUL
             →  erzeugeWelt(seed, opt)  →  Karte

   Die KI liefert das WAS, der Generator garantiert das WIE. Dieses Modul ist
   die Übersetzung dazwischen, und es ist ABSICHTLICH rein: es liest den
   Zustand nicht, ändert ihn nicht und zeichnet nichts. Es rechnet nur.
   Angewendet wird die Vorgabe in editor/io.js — dort, wo Kartengröße, Biom,
   Terrain, Historie und Bild ohnehin zusammenlaufen.

   VIER AUFGABEN:

   1. `pruefeVorgabe` — dieselbe Klemmung wie im Validator der Brain-Seite,
      noch einmal hier. Kein Misstrauen gegen die eigene Serverseite, sondern
      gegen den WEG: die Vorgabe kommt per postMessage herein. Die Brücke prüft
      Herkunft und Absender, aber der Inhalt einer Nachricht ist damit noch
      nicht geprüft. Ein Frame, der einer fremden Zahl glaubt, baut eine
      kaputte Karte — und das genau ist die Zusage, die J4 nicht brechen darf.

   2. `weltOptionen` — WÜNSCHE in FAKTOREN. Der Generator nimmt Dichtefaktoren
      (`WELT_STANDARD` in welt.js: `fluesse: 1` heißt "so viele wie üblich"),
      ein Mensch nennt Anzahlen ("drei Fischerdörfer"). Die Umrechnung braucht
      die Grundformeln des Generators und die Kartengröße; sie steht deshalb
      hier und nicht im Prompt.

   3. `sucheSeed` — "Gebirge im Norden". `genBase` kennt keinen Kippterm für
      eine Gebirgsachse, und welt.js/terrain.js gehören dieser Runde nicht.
      Also wird nicht das Gelände gebogen, sondern der Seed GESUCHT: mehrere
      Kandidaten deterministisch durchrechnen und den nehmen, der dem Wunsch
      am nächsten kommt. Kostet Rechenzeit, bricht aber nichts — und bleibt
      vollständig reproduzierbar (gleiche Vorgabe + gleicher Startseed ⇒
      gleicher gewählter Seed).

   4. `namenAnwenden` — freie Namen aus dem Modell dort einsetzen, wo es welche
      gibt; überall sonst behält der Namensgenerator (namen.js) das Wort. "Die
      Graue Küste" schlägt jeden Generator, "Ort17" nicht.

   BEWUSST NICHT HIER: der Prompt selbst. Er wird nicht in die Karte
   geschrieben (Begründung bei `herkunftBauen`).
   ========================================================================== */

import { clamp } from '../core/rng.js';
import { BIOME, KARTEN_GROESSEN } from '../core/store.js';
import { FAMILIEN_IDS } from './namen.js';
// Nur gelesen, nie verändert: genBaseIn rechnet ein Seed-Terrain in ein
// ÜBERGEBENES Feld. `base` bleibt dabei unangetastet — genau deshalb kann die
// Seed-Suche Kandidaten durchprobieren, ohne die Karte anzufassen.
import { genBaseIn } from '../world/terrain.js';

/** Fassung des Parametersatzes. Wächst nur, wenn ein älterer Leser eine neue
 *  Vorgabe missverstünde. */
export const VORGABE_FASSUNG = 1;
export const VORGABE_ART = "terra_world_draft";

/* Die Auswahllisten. Sie stehen als Wahrheit in core/store.js (BIOME,
   KARTEN_GROESSEN), generators/namen.js (FAMILIEN_IDS) und
   world/atmosphere.js (PRESETS, WETTER) — die ersten drei werden importiert,
   die letzten beiden aufgezählt: atmosphere.js zieht three.js herein und hat
   in einem Generator nichts zu suchen. 13-welt-vorgabe.test.mjs vergleicht
   beide Listen mit atmosphere.js und schlägt bei Abweichung fehl. */
export const TAGESZEITEN = ["morgen", "mittag", "abend", "nebel", "nacht"];
export const WETTERLAGEN = ["klar", "bewoelkt", "regen", "schneefall", "sturm"];
export const BAUSTILE = ["dorf", "klassisch", "zwergisch", "elfisch", "werk", "ruine"];

/** Obergrenzen der Wunschzahlen — die Deckel des Generators selbst
 *  (welt.js: clamp(..., 0, 12/14/26/20/5)). */
export const WUNSCH_MAX = { fluesse: 12, siedlungen: 14, waelder: 26, wiesen: 20, ranken: 5 };

/** Vollständige Vorgabe mit allen Vorgabewerten. Was das Modell weglässt,
 *  kommt von hier — eine halbe Vorgabe gibt es nicht. */
export const VORGABE_STANDARD = {
  fassung: VORGABE_FASSUNG,
  art: VORGABE_ART,
  biom: "wiese",
  kartenGroesse: 256,
  einheitMeter: 1,
  klima: { richtung: 0, staerke: 0.5, grund: 0.5, hoeheKuehl: 0.012 },
  relief: { richtung: 0, staerke: 0 },
  fluesse: 4,
  siedlungen: 4,
  waelder: 7,
  wiesen: 5,
  ranken: 3,
  strassen: true,
  stil: null,
  sprachfamilie: "auto",
  tageszeit: "mittag",
  wetter: "klar",
  namen: { region: null, orte: [], fluesse: [], waelder: [], ranken: [] },
  notizen: null
};

/* Erlaubte Zeichen eines freien Namens. Erlaubnisliste, keine Verbotsliste —
   die Haltung von zielPruefen (ui/beschriftung.js). Buchstaben samt Umlauten
   und Akzenten (der Namensgenerator erzeugt sie), Ziffern, und die drei
   Trenner, die ein Ortsname wirklich trägt. Kein Steuerzeichen, kein
   Nullbreitenzeichen, keine Auszeichnung. */
var NAME_BUCHSTABE = 'A-Za-z0-9\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u024f';
var NAME_MUSTER = new RegExp('^[' + NAME_BUCHSTABE + ']+(?:[ \\u2019\'-][' + NAME_BUCHSTABE + ']+)*$');
var NAME_MAX = 48;
var NAME_LISTE_MAX = 26;
var NOTIZ_MAX = 400;


/* ==========================================================================
   1. Prüfung — klemmen statt vertrauen
   ========================================================================== */

function istObjekt(v) { return v && typeof v === "object" && !Array.isArray(v); }

/**
 * Prüft einen freien Namen. Liefert die getrimmte Fassung oder null.
 * Null ist KEIN Fehler: dann benennt Terras eigener Generator das Element,
 * und das ist ein gutes Ergebnis.
 */
export function pruefeName(wert) {
  if (typeof wert !== "string") return null;
  var t = wert.trim();
  if (!t || t.length > NAME_MAX) return null;
  if (!NAME_MUSTER.test(t)) return null;
  return t;
}

function nameListe(roh, pfad, hinweise) {
  if (!Array.isArray(roh)) {
    if (roh !== undefined && roh !== null) hinweise.push(pfad + ": keine Liste — übergangen");
    return [];
  }
  var out = [], gesehen = {}, i, n, s;
  for (i = 0; i < roh.length && out.length < NAME_LISTE_MAX; i++) {
    n = pruefeName(roh[i]);
    if (!n) { hinweise.push(pfad + "[" + i + "]: Name abgelehnt"); continue; }
    s = n.toLowerCase();
    if (gesehen[s]) { hinweise.push(pfad + "[" + i + "]: Dublette „" + n + "“ verworfen"); continue; }
    gesehen[s] = 1;
    out.push(n);
  }
  if (roh.length > NAME_LISTE_MAX) hinweise.push(pfad + ": mehr als " + NAME_LISTE_MAX + " Namen — abgeschnitten");
  return out;
}

/** Pfadangabe fuer die Hinweise: "klima.staerke" bzw. schlicht "fluesse". */
function wo(pfad, feld) { return pfad ? pfad + "." + feld : feld; }

function zahl(roh, feld, pfad, vorgabe, min, max, ganz, hinweise) {
  var v = roh[feld];
  if (v === undefined || v === null) return vorgabe;
  if (typeof v !== "number" || !isFinite(v)) {
    hinweise.push(wo(pfad, feld) + ": keine Zahl — Vorgabe " + vorgabe);
    return vorgabe;
  }
  if (ganz) v = Math.round(v);
  var g = clamp(v, min, max);
  if (g !== v) hinweise.push(wo(pfad, feld) + ": " + v + " außerhalb " + min + ".." + max + " — auf " + g + " geklemmt");
  return g;
}

/** Winkel wickeln, nicht klemmen: 370 Grad ist kein Fehler, sondern 10. */
function winkel(roh, feld, pfad, vorgabe, hinweise) {
  var v = roh[feld];
  if (v === undefined || v === null) return vorgabe;
  if (typeof v !== "number" || !isFinite(v)) {
    hinweise.push(wo(pfad, feld) + ": keine Zahl — Vorgabe " + vorgabe);
    return vorgabe;
  }
  return ((v % 360) + 360) % 360;
}

function ausListe(roh, feld, pfad, erlaubt, vorgabe, wort, hinweise) {
  var v = roh[feld];
  if (v === undefined || v === null) return vorgabe;
  if (typeof v === "string" && erlaubt.indexOf(v) >= 0) return v;
  hinweise.push(wo(pfad, feld) + ": „" + String(v) + "“ " + wort + " — es gilt „" + vorgabe + "“");
  return vorgabe;
}

/**
 * Nimmt einen rohen Parametersatz entgegen und liefert IMMER eine benutzbare
 * Vorgabe. Es gibt keinen Rückgabeweg "unbrauchbar": ein Modell, das Unsinn
 * liefert, soll eine langweilige Karte erzeugen, keine kaputte und keine gar
 * keine. Was verworfen wurde, steht in `hinweise` und ist damit sichtbar.
 *
 * @returns { vorgabe, hinweise: string[] }
 */
export function pruefeVorgabe(roh) {
  var h = [];
  if (!istObjekt(roh)) {
    return { vorgabe: kopie(VORGABE_STANDARD), hinweise: ["Vorgabe ist kein Objekt — Standardwerte"] };
  }
  var std = VORGABE_STANDARD;
  var v = kopie(std);

  if (roh.art !== undefined && roh.art !== VORGABE_ART) h.push("art: „" + String(roh.art) + "“ unbekannt — als " + VORGABE_ART + " gelesen");
  if (roh.fassung !== undefined && roh.fassung !== VORGABE_FASSUNG) h.push("fassung: " + String(roh.fassung) + " unbekannt — als " + VORGABE_FASSUNG + " gelesen");

  v.biom = (typeof roh.biom === "string" && BIOME[roh.biom]) ? roh.biom : std.biom;
  if (roh.biom !== undefined && v.biom !== roh.biom) h.push("biom: „" + String(roh.biom) + "“ unbekannt — es gilt „" + std.biom + "“");

  /* Kartengröße ist eine Auswahl, keine Spanne: 700 ist nicht "ungefähr 512".
     Eine stillschweigend verschobene Größe brächte ein Höhen-Delta mit, das
     nicht mehr passt (siehe kartenGroesse in editor/io.js). */
  v.kartenGroesse = std.kartenGroesse;
  if (roh.kartenGroesse !== undefined && roh.kartenGroesse !== null) {
    var kg = Number.isFinite(roh.kartenGroesse) ? Math.round(roh.kartenGroesse) : NaN;
    if (KARTEN_GROESSEN.indexOf(kg) >= 0) v.kartenGroesse = kg;
    else h.push("kartenGroesse: „" + String(roh.kartenGroesse) + "“ gibt es nicht — es gilt " + std.kartenGroesse);
  }

  v.einheitMeter = zahl(roh, "einheitMeter", "", std.einheitMeter, 0.01, 5000, false, h);

  var kr = istObjekt(roh.klima) ? roh.klima : {};
  if (roh.klima !== undefined && !istObjekt(roh.klima)) h.push("klima: kein Objekt — Vorgabewerte");
  v.klima = {
    richtung: winkel(kr, "richtung", "klima", std.klima.richtung, h),
    staerke: zahl(kr, "staerke", "klima", std.klima.staerke, 0, 1, false, h),
    grund: zahl(kr, "grund", "klima", std.klima.grund, 0, 1, false, h),
    hoeheKuehl: zahl(kr, "hoeheKuehl", "klima", std.klima.hoeheKuehl, 0, 0.1, false, h)
  };

  var rr2 = istObjekt(roh.relief) ? roh.relief : {};
  if (roh.relief !== undefined && !istObjekt(roh.relief)) h.push("relief: kein Objekt — Vorgabewerte");
  v.relief = {
    richtung: winkel(rr2, "richtung", "relief", std.relief.richtung, h),
    staerke: zahl(rr2, "staerke", "relief", std.relief.staerke, 0, 1, false, h)
  };

  v.fluesse = zahl(roh, "fluesse", "", std.fluesse, 0, WUNSCH_MAX.fluesse, true, h);
  v.siedlungen = zahl(roh, "siedlungen", "", std.siedlungen, 0, WUNSCH_MAX.siedlungen, true, h);
  v.waelder = zahl(roh, "waelder", "", std.waelder, 0, WUNSCH_MAX.waelder, true, h);
  v.wiesen = zahl(roh, "wiesen", "", std.wiesen, 0, WUNSCH_MAX.wiesen, true, h);
  v.ranken = zahl(roh, "ranken", "", std.ranken, 0, WUNSCH_MAX.ranken, true, h);

  v.strassen = std.strassen;
  if (roh.strassen !== undefined && roh.strassen !== null) {
    if (typeof roh.strassen === "boolean") v.strassen = roh.strassen;
    else h.push("strassen: kein Wahrheitswert — Vorgabe " + std.strassen);
  }

  /* Ein erfundener Baustil wird ABGELEHNT, nicht auf etwas Ähnliches
     abgebildet: null heißt "aus dem Biom ableiten" (BIOM_STIL in welt.js),
     und das ist die ehrlichere Antwort. */
  v.stil = null;
  if (roh.stil !== undefined && roh.stil !== null) {
    if (typeof roh.stil === "string" && BAUSTILE.indexOf(roh.stil) >= 0) v.stil = roh.stil;
    else h.push("stil: „" + String(roh.stil) + "“ gibt es nicht — das Biom entscheidet");
  }

  /* Eine erfundene Sprachfamilie wird ebenfalls abgelehnt. Die sechs Familien
     tragen ganze Wortlisten; so zu tun, als wäre „nordisch“ eine davon,
     erzeugte Namen, die eine Sprache versprechen, die Terra nicht spricht. */
  var familien = ["auto"].concat(FAMILIEN_IDS);
  v.sprachfamilie = ausListe(roh, "sprachfamilie", "", familien, std.sprachfamilie, "gibt es nicht", h);
  v.tageszeit = ausListe(roh, "tageszeit", "", TAGESZEITEN, std.tageszeit, "unbekannt", h);
  v.wetter = ausListe(roh, "wetter", "", WETTERLAGEN, std.wetter, "unbekannt", h);

  var nr = istObjekt(roh.namen) ? roh.namen : {};
  if (roh.namen !== undefined && !istObjekt(roh.namen)) h.push("namen: kein Objekt — übergangen");
  var region = (nr.region === undefined || nr.region === null) ? null : pruefeName(nr.region);
  if (nr.region !== undefined && nr.region !== null && !region) h.push("namen.region: Name abgelehnt");
  v.namen = {
    region: region,
    orte: nameListe(nr.orte, "namen.orte", h),
    fluesse: nameListe(nr.fluesse, "namen.fluesse", h),
    waelder: nameListe(nr.waelder, "namen.waelder", h),
    ranken: nameListe(nr.ranken, "namen.ranken", h)
  };

  v.notizen = null;
  if (typeof roh.notizen === "string") {
    var nz = roh.notizen.trim().replace(/\s+/g, " ").slice(0, NOTIZ_MAX);
    if (nz) v.notizen = nz;
  } else if (roh.notizen !== undefined && roh.notizen !== null) {
    h.push("notizen: keine Zeichenkette — übergangen");
  }

  /* Der Seed reist NICHT im Modellvorschlag: er ist die Zahl, die zusammen mit
     dieser Vorgabe die Karte reproduzierbar macht, und der Bearbeiter setzt
     ihn. Ein Modell, das ihn trotzdem nennt, wird hier still übergangen. */
  return { vorgabe: v, hinweise: h };
}

/** Tiefe Kopie der flachen Vorgabestruktur — sie enthält nur Zahlen,
 *  Zeichenketten, Wahrheitswerte, Listen davon und zwei feste Unterobjekte. */
function kopie(v) {
  return {
    fassung: v.fassung, art: v.art,
    biom: v.biom, kartenGroesse: v.kartenGroesse, einheitMeter: v.einheitMeter,
    klima: { richtung: v.klima.richtung, staerke: v.klima.staerke,
             grund: v.klima.grund, hoeheKuehl: v.klima.hoeheKuehl },
    relief: { richtung: v.relief.richtung, staerke: v.relief.staerke },
    fluesse: v.fluesse, siedlungen: v.siedlungen, waelder: v.waelder,
    wiesen: v.wiesen, ranken: v.ranken,
    strassen: v.strassen, stil: v.stil, sprachfamilie: v.sprachfamilie,
    tageszeit: v.tageszeit, wetter: v.wetter,
    namen: {
      region: v.namen.region,
      orte: v.namen.orte.slice(), fluesse: v.namen.fluesse.slice(),
      waelder: v.namen.waelder.slice(), ranken: v.namen.ranken.slice()
    },
    notizen: v.notizen
  };
}
export { kopie as vorgabeKopie };


/* ==========================================================================
   2. Wünsche → Faktoren

   welt.js rechnet aus dem Faktor eine Anzahl:
       fluesse     wunsch = round((2 + 2.4 * skala) * o.fluesse)
       siedlungen  wunsch = round((2 + 2.2 * skala) * o.siedlungen)
       waldanteil  nWald  = round((3 + 4 * flaeche) * o.waldanteil)
       wiesen      nWiese = round((2 + 3 * flaeche) * o.wiesen)
   mit skala = kartengroesse/256 und flaeche = skala². Hier läuft dieselbe
   Rechnung rückwärts. `ranken` ist im Generator bereits eine Anzahl.

   WICHTIG und im Bericht vermerkt: die Anzahl ist ein WUNSCH. Der Generator
   setzt nur, wofür er Platz findet — auf einer Karte ohne Küste entstehen
   keine drei Häfen, egal welcher Faktor hereinkommt.
   ========================================================================== */

function basisZahlen(kartenGroesse) {
  var skala = kartenGroesse / 256;
  var flaeche = skala * skala;
  return {
    fluesse: 2 + 2.4 * skala,
    siedlungen: 2 + 2.2 * skala,
    waelder: 3 + 4 * flaeche,
    wiesen: 2 + 3 * flaeche
  };
}

/** Wieviele Elemente jeder Art auf einer Karte dieser Größe bei Faktor 1
 *  entstünden — die Zahl, gegen die die Bedienung den Wunsch anzeigt. */
export function grundmengen(kartenGroesse) {
  var b = basisZahlen(kartenGroesse);
  return {
    fluesse: Math.round(b.fluesse), siedlungen: Math.round(b.siedlungen),
    waelder: Math.round(b.waelder), wiesen: Math.round(b.wiesen),
    ranken: VORGABE_STANDARD.ranken
  };
}

/**
 * Übersetzt eine geprüfte Vorgabe in das Optionsobjekt von
 * `erzeugeWelt(seed, opt)`. Rein — kein Zugriff auf S oder KARTE, die
 * Kartengröße kommt aus der Vorgabe (sie darf ja gerade wechseln).
 */
export function weltOptionen(vorgabe) {
  var b = basisZahlen(vorgabe.kartenGroesse);
  return {
    fluesse: vorgabe.fluesse / b.fluesse,
    siedlungen: vorgabe.siedlungen / b.siedlungen,
    waldanteil: vorgabe.waelder / b.waelder,
    wiesen: vorgabe.wiesen / b.wiesen,
    ranken: vorgabe.ranken,
    strassen: vorgabe.strassen,
    stil: vorgabe.stil,
    namen: true,
    /* "auto" heißt für den Generator "die Familie der Karte" — er nimmt dann
       S.sprachfamilie bzw. das Biom. Genau dafür ist null die Vorgabe. */
    sprachfamilie: vorgabe.sprachfamilie === "auto" ? null : vorgabe.sprachfamilie
  };
}


/* ==========================================================================
   3. Seed-Suche — "Gebirge im Norden"

   genBase erzeugt sein Höhenfeld aus zwei Rauschoktaven, ohne Wunsch nach
   einer Gebirgsachse; ein Kippterm dort wäre ein Eingriff in den Kern und
   berührte die Byteidentität bestehender Karten. Stattdessen werden N Seeds
   deterministisch durchgerechnet und der genommen, dessen Masse am weitesten
   in die gewünschte Richtung liegt.

   Gemessen wird auf einem GROBEN Gitter über das frisch gerechnete Feld: die
   Frage "liegt das Hohe im Norden" braucht keine Zentimeter. Das Feld selbst
   muss trotzdem in voller Kartengröße gerechnet werden — die Rauschfrequenz
   ist fest, eine kleinere Karte wäre ein anderer Ausschnitt und keine
   Verkleinerung.
   ========================================================================== */

/** Kandidaten je Kartengröße. Der Wert ist eine Zeitgrenze, keine Qualität:
 *  eine 1024er kostet je Kandidat rund das Sechzehnfache einer 256er. */
export function kandidatenZahl(kartenGroesse) {
  if (kartenGroesse >= 1024) return 6;
  if (kartenGroesse >= 512) return 12;
  return 24;
}

/** k-ter Kandidat zu einem Startseed. k = 0 ist IMMER der Startseed selbst —
 *  ohne Reliefwunsch ändert die Suche damit nichts. */
export function kandidatSeed(startSeed, k) {
  return k === 0 ? (startSeed | 0) : ((startSeed + Math.imul(k, 0x9e3779b9)) | 0);
}

/**
 * Wie gut liegt die Masse eines Höhenfelds in Richtung `grad`?
 * Terras Kompass: 0 = Norden (-z), 90 = Osten (+x) — dieselbe Konvention wie
 * `S.klima.richtung` (siehe KLIMA_STANDARD in world/biomfeld.js).
 *
 * Der Wert ist ein Mittel aus Höhe mal Projektion auf die Wunschrichtung,
 * normiert auf die halbe Kantenlänge. Größer ist besser; das Vorzeichen
 * unterscheidet "Gebirge im Norden" von "Gebirge im Süden".
 */
export function reliefWert(feld, kartenGroesse, grad) {
  var vw = kartenGroesse + 1, half = kartenGroesse / 2;
  var a = grad * Math.PI / 180;
  var ax = Math.sin(a), az = -Math.cos(a);
  // Grobes Gitter: rund 64 Stützstellen je Kante reichen für eine Richtung.
  var schritt = Math.max(1, Math.floor(kartenGroesse / 64));
  var summe = 0, n = 0, i, j, h;
  for (j = 0; j < vw; j += schritt) {
    for (i = 0; i < vw; i += schritt) {
      h = feld[j * vw + i];
      if (!(h > 0)) continue;                 // Meeresgrund trägt kein Gebirge
      summe += h * ((i - half) * ax + (j - half) * az) / half;
      n++;
    }
  }
  return n ? summe / n : 0;
}

/**
 * Sucht den Seed, der dem Reliefwunsch am nächsten kommt.
 * Ohne Wunsch (relief.staerke = 0) wird nichts gerechnet und der Startseed
 * zurückgegeben — der Normalfall bleibt kostenlos.
 *
 * Deterministisch: gleiche Vorgabe + gleicher Startseed ⇒ gleicher Seed. Bei
 * Gleichstand gewinnt der kleinere Index, damit auch das reproduzierbar ist.
 *
 * @param vorgabe   geprüfte Vorgabe
 * @param startSeed Ausgangsseed (üblicherweise S.worldSeed)
 * @param opt       { kandidaten } — Vorgabe siehe kandidatenZahl
 * @returns { seed, geprueft, wert, bester }
 */
export function sucheSeed(vorgabe, startSeed, opt) {
  startSeed = startSeed | 0;
  if (!vorgabe.relief || !(vorgabe.relief.staerke > 0)) {
    return { seed: startSeed, geprueft: 0, wert: 0, bester: 0 };
  }
  var anzahl = (opt && opt.kandidaten) ? (opt.kandidaten | 0) : kandidatenZahl(vorgabe.kartenGroesse);
  anzahl = clamp(anzahl, 1, 64);
  var vw = vorgabe.kartenGroesse + 1;
  var feld = new Float32Array(vw * vw);
  var besterSeed = startSeed, besterWert = -Infinity, besterIndex = 0, k, s, w;
  for (k = 0; k < anzahl; k++) {
    s = kandidatSeed(startSeed, k);
    genBaseIn(feld, s, vorgabe.kartenGroesse, vorgabe.biom);
    w = reliefWert(feld, vorgabe.kartenGroesse, vorgabe.relief.richtung);
    if (w > besterWert) { besterWert = w; besterSeed = s; besterIndex = k; }
  }
  return { seed: besterSeed, geprueft: anzahl, wert: besterWert, bester: besterIndex };
}


/* ==========================================================================
   4. Namen — KI wo vorhanden, Generator wo nicht

   Der Weltgenerator hat schon benannt, als diese Funktion läuft: jedes
   Element trägt `params.name` aus namen.js. Hier werden nur die überschrieben,
   für die das Modell einen Namen mitgeliefert hat — in der Reihenfolge, in der
   der Generator sie gesetzt hat (Siedlung 0 zuerst, dann 1 ...). Alles andere
   bleibt beim Generator, und das ist der Normalfall.

   Ein Sonderfall, der sonst auffiele: welt.js benennt die Äcker einer Siedlung
   NACH ihr („Nordäcker von Möwenfurt“). Wird der Ort umbenannt, wandern die
   Äcker mit — sonst stünde auf der Karte ein Dorf, dessen Felder einem
   anderen gehören.
   ========================================================================== */

/** Welche Namensliste zu welchem Element gehört. Dieselbe Zuordnung wie
 *  NAME_ART in ui/panels.js, hier auf die vier Listen der Vorgabe verkürzt. */
var LISTE_FUER = {
  "pfad:fluss": "fluesse",
  "flaeche:wald": "waelder",
  "flaeche:viertel": "orte",
  "ranke:ranke": "ranken"
};

/**
 * Setzt die freien Namen in eine frisch erzeugte Elementliste ein.
 * Verändert die Elemente an Ort und Stelle (sie sind zu diesem Zeitpunkt noch
 * nicht in S.elements) und liefert die Zahl der gesetzten Namen.
 */
export function namenAnwenden(liste, namen) {
  if (!liste || !liste.length || !namen) return 0;
  var zaehler = { fluesse: 0, waelder: 0, orte: 0, ranken: 0 };
  var umbenannt = [];        // [alterOrtsname, neuerOrtsname]
  var gesetzt = 0, i, el, art, feld, neu;

  for (i = 0; i < liste.length; i++) {
    el = liste[i];
    if (!el || !el.params) continue;
    art = LISTE_FUER[el.kind + ":" + el.variant];
    if (!art) continue;
    feld = namen[art];
    if (!Array.isArray(feld) || zaehler[art] >= feld.length) { zaehler[art]++; continue; }
    neu = pruefeName(feld[zaehler[art]]);
    zaehler[art]++;
    if (!neu) continue;
    if (art === "orte" && el.params.name && el.params.name !== neu) {
      umbenannt.push([el.params.name, neu]);
    }
    el.params.name = neu;
    gesetzt++;
  }

  /* Abgeleitete Namen nachziehen. Nur das Muster „<irgendwas> von <Ort>“ —
     eine Ersetzung mitten im Wort wäre geraten, dieses Muster erzeugt welt.js
     selbst und ist damit belegt. */
  if (umbenannt.length) {
    for (i = 0; i < liste.length; i++) {
      el = liste[i];
      if (!el || !el.params || typeof el.params.name !== "string") continue;
      for (var u = 0; u < umbenannt.length; u++) {
        var endung = " von " + umbenannt[u][0];
        if (el.params.name.length > endung.length &&
            el.params.name.slice(-endung.length) === endung) {
          el.params.name = el.params.name.slice(0, -endung.length) + " von " + umbenannt[u][1];
          break;
        }
      }
    }
  }
  return gesetzt;
}


/* ==========================================================================
   5. Herkunft — was in der Karte stehen bleibt

   Gespeichert wird am Ende die FERTIGE Karte (Elemente, Höhen, Format v5).
   Ohne einen Vermerk wüsste danach niemand mehr, woraus sie entstanden ist —
   und die Zusage „gleiche Vorgabe + gleicher Seed ⇒ gleiche Karte“ wäre nicht
   nachprüfbar. Deshalb reist der Parametersatz als tolerantes Zusatzfeld
   `herkunft` mit (dasselbe Mittel wie `biom`, `wetter`, `klima`, `marker`:
   ein älterer Leser überliest es, das Format bleibt v4/v5).

   DER PROMPT SELBST WIRD NICHT MITGESPEICHERT. Drei Gründe, in dieser
   Reihenfolge:

   1. Er ist Freitext eines Menschen und kann Personenbezogenes enthalten —
      Spielernamen, echte Orte, private Notizen.
   2. Terra-Inhalte sind vollständig spielersichtbar (Eigentümer-Entscheid
      2026-07-21, siehe apps/studio/app/terra-actions.ts). Ein Prompt in der
      Karte wäre für jeden Spieler der Welt lesbar — der Spielleiter hätte ihn
      an eine Öffentlichkeit gegeben, die er nicht gemeint hat.
   3. Er ist nicht verloren: die Brain-Aktion legt für jeden Lauf eine Zeile
      an (`AiRun`, mit `userPrompt`), die unter den vorhandenen Rechten steht.
      In der Karte steht mit `laufId` der Zeiger darauf. Wer den Prompt sehen
      darf, findet ihn; wer nicht, sieht ihn nicht.

   Was mitgespeichert wird, ist damit: der geprüfte Parametersatz, der
   benutzte Seed, die Kurznotiz des Modells (Modellausgabe, kein Nutzertext)
   und die Lauf-Kennung.
   ========================================================================== */

/** Kennungen aus der Datenbank sind Zeichenketten ohne Überraschungen —
 *  hier reicht eine knappe Erlaubnisliste. */
var LAUF_ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Baut den Herkunftsvermerk. `zeit` wird übergeben statt hier gelesen: eine
 * Funktion, die Date.now() aufruft, wäre in Tests nicht vergleichbar.
 *
 * @param vorgabe geprüfte Vorgabe
 * @param opt { seed, laufId, zeit }
 */
export function herkunftBauen(vorgabe, opt) {
  opt = opt || {};
  var h = {
    art: VORGABE_ART,
    fassung: VORGABE_FASSUNG,
    seed: opt.seed | 0,
    vorgabe: kopie(vorgabe)
  };
  if (typeof opt.zeit === "string" && opt.zeit) h.zeit = opt.zeit.slice(0, 40);
  if (typeof opt.laufId === "string" && LAUF_ID.test(opt.laufId)) h.laufId = opt.laufId;
  return h;
}

/**
 * Liest einen Herkunftsvermerk aus einer Datei. Tolerant wie `biom` und
 * `wetter`: was nicht stimmt, wird zu null — eine Karte scheitert NIE an ihrem
 * Beiwerk. Die enthaltene Vorgabe läuft durch dieselbe Prüfung wie eine
 * frische, damit eine von Hand veränderte Datei nichts durchreicht.
 */
export function herkunftGelesen(roh) {
  if (!istObjekt(roh)) return null;
  if (roh.art !== VORGABE_ART) return null;
  var g = pruefeVorgabe(roh.vorgabe);
  var h = {
    art: VORGABE_ART,
    fassung: VORGABE_FASSUNG,
    seed: Number.isFinite(roh.seed) ? (roh.seed | 0) : 0,
    vorgabe: g.vorgabe
  };
  if (typeof roh.zeit === "string" && roh.zeit) h.zeit = roh.zeit.slice(0, 40);
  if (typeof roh.laufId === "string" && LAUF_ID.test(roh.laufId)) h.laufId = roh.laufId;
  return h;
}
