/* ==========================================================================
   I4 — Kartenbeschriftung mit klickbarem Ziel

   Ablösung der HTML-Marker-Labels aus D1 (ui/panels.js). Die haben zwei
   Mängel, die sich nicht wegkonfigurieren lassen: sie liegen als Fremdkörper
   ÜBER dem Bild, und sie fehlen im PNG-Export, weil der Export nur das Canvas
   liest. Eine Beschriftung, die zur Karte gehört, muss IN der Karte stehen —
   also als Sprite mit Canvas-Textur in der Szene.

   Der Aufbau folgt der Trennung, die dieses Modul prüfbar macht:

     RECHNEN  — Klassentabelle, Priorität, Maßstabsfenster, Kollisionsauflösung
                im Bildraum, Glyphenverteilung auf einer Kurve, Zielprüfung.
                Kein DOM, kein three, keine Uhr. Direkt prüfbar.
     ZEICHNEN — Glyphenkette in einen 2D-Kontext, Textur, Sprite, Schicht.
                Der Kontext kommt IMMER als Parameter herein, nie aus einer
                globalen Suche. Im Test steht dort ein mitschreibender Ersatz.

   Nichts hier würfelt. Zwei Aufbauten derselben Beschriftung liefern dieselbe
   Glyphenkette und dieselbe Zeichenfolge — Math.random kommt in terra nicht
   vor, und auch keine Zeitabhängigkeit im Ergebnis (die Drosselung entscheidet
   nur, WANN neu bewertet wird, nicht WIE).
   ========================================================================== */
import * as THREE from 'three';
import { bildhoehe } from '../core/bild.js';
import { clamp, DEG } from '../core/rng.js';


/* ==========================================================================
   1 — Sicherheit: das Ziel

   Der wichtigste Teil der Datei. Karten sollen geteilt werden; eine fremde
   Kartendatei darf keinen Klick-Angriff mitbringen. Deshalb eine
   ERLAUBNISLISTE: es wird beschrieben, was durchgelassen wird, nicht was
   abgewiesen wird. Eine Verbotsliste verliert dieses Rennen immer — sie muss
   jede Schreibweise von `javascript:` kennen, die Erlaubnisliste muss nur
   `http://` und `https://` kennen.
   ========================================================================== */

/** Die drei erlaubten Zielarten. `wiki` ist der Platzhalter für Runde J. */
var ZIEL_ARTEN = ["keins", "wiki", "extern"];

/* Ein einziger, harter Anker: die Zeichenkette MUSS mit http:// oder https://
   beginnen. Damit fallen in einem Schritt weg: javascript:, data:, vbscript:,
   file:, blob:, about:, alles mit fremdem Schema — UND die protokollrelative
   Form //example.com, die kein Schema trägt und deshalb das Schema der
   umgebenden Seite erbt. */
var SCHEMA_OK = /^https?:\/\/[^/]/i;

/* Alles, was ein Schema zerschneiden oder eine Prüfung überspringen könnte:
   C0/C1-Steuerzeichen, jede Art Leerraum, Nullbyte, die unsichtbaren
   Richtungs- und Nullbreitenzeichen und die BOM. Ein Nullbyte mitten im
   Schemawort und ein führendes Leerzeichen scheitern beide hier, lange bevor
   überhaupt ein Schema gelesen wird. Bewusst KEIN Trimmen: eine Adresse mit
   führendem Leerzeichen ist keine, die man reparieren soll, sondern eine,
   der man misstraut. */
var UNZEICHEN = /[\u0000-\u0020\u007f-\u00a0\u1680\u2000-\u200f\u2028-\u202f\u205f-\u206f\u3000\ufeff\ufff9-\ufffb]/;

/* Wiki-Referenz: reine Kennung, keine Adresse. Buchstaben (samt Umlauten und
   Akzenten, weil terras Namensgenerator sie erzeugt), Ziffern, dazwischen
   genau ein Trenner. Kein Doppelpunkt (kein Schema), kein führender Schrägstrich
   (keine protokollrelative Form), kein Punkt (kein ../), kein Prozentzeichen
   (keine URL-Kodierung, die eine spätere Auflösung anders liest als wir hier). */
var LETTER = 'A-Za-z0-9\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u024f';
var WIKI_REF = new RegExp('^[' + LETTER + ']+(?:[-_/][' + LETTER + ']+)*$');

var ZIEL_MAX = 2000;      // Adressen darüber sind keine Adressen mehr
var WIKI_MAX = 200;

/**
 * Prüft ein `ziel`-Feld und liefert die normalisierte Fassung.
 * Rückgabe: `{ ok:true, ziel:{art, ref} }` oder `{ ok:false, grund }`.
 *
 * Bewusst OHNE throw, obwohl der Aufrufer in `validiereKarte` wirft: der
 * Klickpfad braucht dieselbe Prüfung als Frage, nicht als Abbruch, und zwei
 * getrennte Prüfungen driften auseinander (die Lehre aus `pruefeElemente`).
 * Der Aufrufer macht daraus eine Zeile:
 *     var z = zielPruefen(p.ziel); if (!z.ok) throw new Error("… " + z.grund);
 */
function zielPruefen(ziel) {
  if (ziel === undefined || ziel === null) return { ok: true, ziel: { art: "keins", ref: "" } };
  if (typeof ziel !== "object" || Array.isArray(ziel)) return { ok: false, grund: "ziel ist kein Objekt" };
  var art = ziel.art;
  if (art === undefined) art = "keins";
  if (typeof art !== "string" || ZIEL_ARTEN.indexOf(art) < 0) return { ok: false, grund: "unbekannte Zielart" };

  var ref = ziel.ref;
  if (ref === undefined || ref === null) ref = "";
  if (typeof ref !== "string") return { ok: false, grund: "ref ist keine Zeichenkette" };

  /* „keins" heißt kein Ziel — auch keines im Wartestand. Die Referenz wird
     geleert statt mitgeschleppt. Eine Datei, die unter `keins` eine
     javascript:-Zeile mitführt, hat nichts Gutes vor; und niemand soll sich
     darauf verlassen können, dass ein Umschalten im Panel eine ungeprüfte
     Zeichenkette scharf stellt. */
  if (art === "keins") return { ok: true, ziel: { art: "keins", ref: "" } };

  if (!ref) return { ok: false, grund: "ref fehlt" };
  if (UNZEICHEN.test(ref)) return { ok: false, grund: "ref enthält Steuer- oder Leerzeichen" };

  if (art === "wiki") {
    if (ref.length > WIKI_MAX) return { ok: false, grund: "ref zu lang" };
    if (!WIKI_REF.test(ref)) return { ok: false, grund: "ref ist keine Seitenkennung" };
    return { ok: true, ziel: { art: "wiki", ref: ref } };
  }

  // art === "extern"
  if (ref.length > ZIEL_MAX) return { ok: false, grund: "ref zu lang" };
  if (!SCHEMA_OK.test(ref)) return { ok: false, grund: "nur http:// und https:// sind erlaubt" };
  /* Zweite, unabhängige Instanz: der Parser des Wirts. Er kennt Formen, die
     ein regulärer Ausdruck nicht sieht (Rückwärtsschrägstriche im Autoritätsteil,
     kaputte Ports, IDN). Stimmen beide Instanzen nicht überein, wird abgelehnt —
     genau da sitzen die Umgehungen. */
  var u = null;
  try { u = new URL(ref); } catch (_e) { return { ok: false, grund: "ref ist keine gültige Adresse" }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, grund: "nur http: und https: sind erlaubt" };
  if (!u.hostname) return { ok: false, grund: "ref hat keinen Rechnernamen" };
  /* Zugangsdaten in der Adresse sind kein Skriptangriff, aber der klassische
     Trick, eine fremde Herkunft wie eine vertraute aussehen zu lassen
     (https://wiki.uwe@boese.example). Auf einer geteilten Karte hat das nichts
     zu suchen. */
  if (u.username || u.password) return { ok: false, grund: "ref enthält Zugangsdaten" };
  return { ok: true, ziel: { art: "extern", ref: ref } };
}

/* ==========================================================================
   1b — Sicherheit: die Verknüpfung `anPfad`

   Eine gebogene Beschriftung braucht eine Kurve, und die Kurve kommt aus einem
   ANDEREN Element. Verwiesen wird über dessen stabile `el.id` — Terra vergibt
   sie fortlaufend (`S.nextId` in core/store.js) und schreibt sie mit in die
   Datei, sie überlebt also Speichern und Laden.

   Die Zahl kommt damit aus einer fremden Datei und wird wie jedes andere Feld
   von dort behandelt: geprüft, bevor sie irgendwo landet. Sie ist harmloser
   als `ziel` (kein Klickziel, kein Schema), aber dieselbe Haltung — es wird
   beschrieben, was durchgelassen wird:

     fehlt / null / 0   →  keine Verknüpfung (die Beschriftung steht gerade)
     ganze Zahl 1..MAX  →  Verweis auf ein Element mit dieser id
     alles andere       →  abgelehnt

   MAX ist keine Willkür: `id` entsteht aus einem Zähler, der bei 1 beginnt.
   Number.MAX_SAFE_INTEGER wäre die formale Grenze; 2^31 ist die praktische
   und hält die Zahl in dem Bereich, in dem `| 0` noch dasselbe bedeutet.

   Was NICHT hier geprüft wird: ob es das Element gibt. Das kann diese Funktion
   gar nicht wissen (sie sieht ein Feld, keine Karte) — und es wäre auch falsch,
   daran eine Datei scheitern zu lassen: ein Verweis auf ein gelöschtes Element
   ist kein Angriff, sondern der Normalfall nach einem Entf. Er wird zur
   Laufzeit aufgelöst, und wenn nichts gefunden wird, steht die Beschriftung
   gerade da (editor/selection.js).
   ========================================================================== */
var ANPFAD_MAX = 2147483647;

/**
 * Prüft ein `anPfad`-Feld. Rückgabe `{ ok:true, wert:Number }` (0 = keine
 * Verknüpfung) oder `{ ok:false, grund }`.
 */
function anPfadPruefen(v) {
  if (v === undefined || v === null || v === 0) return { ok: true, wert: 0 };
  if (typeof v !== "number") return { ok: false, grund: "anPfad ist keine Zahl" };
  if (!Number.isFinite(v)) return { ok: false, grund: "anPfad ist nicht endlich" };
  if (!Number.isInteger(v)) return { ok: false, grund: "anPfad ist keine ganze Zahl" };
  if (v < 0 || v > ANPFAD_MAX) return { ok: false, grund: "anPfad liegt außerhalb des Wertebereichs" };
  return { ok: true, wert: v | 0 };
}

/**
 * Die tatsächlich zu öffnende Adresse — oder null.
 * `opt.wikiBasis` ist die Adresse, unter der Wiki-Seiten liegen; solange terra
 * eigenständig läuft, gibt es sie nicht und `wiki`-Ziele bleiben stumm. Die
 * zusammengesetzte Adresse läuft durch DIESELBE Prüfung wie eine externe —
 * eine falsch gesetzte Basis darf die Erlaubnisliste nicht aushebeln.
 */
function zielUrl(ziel, opt) {
  var p = zielPruefen(ziel);
  if (!p.ok) return null;
  var z = p.ziel;
  if (z.art === "extern") return z.ref;
  if (z.art !== "wiki") return null;
  var basis = opt && opt.wikiBasis;
  if (typeof basis !== "string" || !basis) return null;
  var voll = basis + (basis.charAt(basis.length - 1) === "/" ? "" : "/") + z.ref;
  var q = zielPruefen({ art: "extern", ref: voll });
  return q.ok ? q.ziel.ref : null;
}

/**
 * Öffnet das Ziel in einem neuen Fenster. Liefert true, wenn geöffnet wurde.
 * `opt.aufnahme` schaltet den Klick ab: im Aufnahme-Modus und beim PNG-Export
 * ist die Beschriftung Bild, nicht Bedienelement.
 * `opt.fenster` ist der Ausweg für die Prüfung — im Betrieb ist es `window`.
 */
function zielOeffnen(ziel, opt) {
  opt = opt || {};
  if (opt.aufnahme) return false;
  var url = zielUrl(ziel, opt);
  if (!url) return false;
  var f = opt.fenster || (typeof window !== "undefined" ? window : null);
  if (!f || typeof f.open !== "function") return false;
  // noopener trennt window.opener (sonst könnte die Zielseite auf terra
  // zurückgreifen), noreferrer hält zusätzlich den Verweis zurück.
  f.open(url, "_blank", "noopener,noreferrer");
  return true;
}


/* ==========================================================================
   2 — Die Klassentabelle

   Der Teil, der über Erfolg entscheidet — nicht die Technik. Eine Karte wird
   nicht dadurch zur Karte, dass Text darauf steht, sondern dadurch, dass der
   Text nach den Regeln des Kartenstichs gesetzt ist.

   Zwei Schriftfamilien, nach der ältesten Konvention des Fachs:
   NATUR (Region, Gewässer, Gebirge, Arbor) in einer Antiqua, MENSCHENWERK
   (Ort) und Warnung (Gefahr) in einer Grotesk. Das trennt die Ebenen der
   Karte ohne einen einzigen zusätzlichen Farbwert.

   Warum genau diese Stapel: terra hat keinen Build-Schritt und lädt keine
   Webfont — es zählt nur, was auf dem Rechner liegt.
     Antiqua: „Palatino Linotype" liegt seit Windows 2000 in jeder Installation,
       „Book Antiqua" kommt mit Office, Georgia und Cambria sind Systemschriften.
       Alle vier haben ähnliche Laufweite und offene Punzen — der Rückfall
       verschiebt das Bild, er zerstört es nicht.
     Grotesk: derselbe Stapel wie die Labels in ui/panels.js, damit
       Ortsbeschriftung und Bedienoberfläche nicht auseinanderfallen.

   Alle Farbwerte stammen aus dem Bestand; erfunden ist keiner:
     #7d8a99  ui/panels.js MARKER_TON.ort      — gedämpftes Blaugrau
     #3d4753  ui/panels.js Labeltextfarbe
     #1f4750  core/store.js terrain.tiefe      — die Wasserfarbe jedes Bioms
     #4a4038  core/store.js sumpf.terrain.erde — der dunkelste Erdton der Registry
     #c1523c  ui/panels.js MARKER_TON.gefahr
     #2f9c8c  ui/panels.js MARKER_TON.arbor
     #f6f0e2  render/pipeline.js uPapierFarbe  — der Saum IST die Papierkante
     #f4f6f8  core/store.js terrain.schnee     — Arbors Weiß
   ========================================================================== */

var ANTIQUA = '"Palatino Linotype","Book Antiqua",Palatino,Georgia,Cambria,"Times New Roman",serif';
var GROTESK = '"Segoe UI",Roboto,system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif';

var PAPIER = "#f6f0e2";

/* Maßstab = sichtbare Weltbreite in terra-Einheiten. Klein heißt nah dran.
   Die Ebenen-Hierarchie aus I1 gibt es noch nicht; bis dahin reicht der
   Aufrufer eine Konstante herein (`sicht.massstab`). Die Lücke sitzt damit an
   der richtigen Stelle, ohne dass hier Code auf etwas zeigt, das es nicht gibt.
   Die Zahlen orientieren sich an KARTEN_GROESSEN (256/512/1024): eine 256er
   Karte ganz im Bild ist Maßstab ~360 (Diagonale), eine Stadtansicht ~60. */
var WEIT = Infinity;

var KLASSEN = {
  /* Region: die oberste Ebene der Karte. Groß, weit gesperrt, Versalien und
     bewusst GEDÄMPFT — eine Regionsbeschriftung soll den Raum benennen, nicht
     ihn zudecken. Sie folgt einem Pfad, wenn einer da ist (Landschaftsachse). */
  region: {
    id: "region", label: "Region", stapel: ANTIQUA,
    grad: 15, gewicht: 400, kursiv: false, versalien: true, sperrung: 0.30,
    farbe: "#7d8a99", saum: PAPIER, saumBreite: 0.18,
    signatur: false, folgtPfad: true,
    prioritaet: 90, massstabVon: 260, massstabBis: WEIT
  },
  /* Ort: die kleinste und häufigste Beschriftung, deshalb der niedrigste Rang —
     ein Ortsname darf wegfallen, ein Gebirgszug nicht. Punktsignatur davor:
     erst der Punkt sagt, wo der Ort LIEGT; die Schrift steht daneben. Halbfett,
     weil kleine Grotesk auf buntem Untergrund sonst wegsackt. */
  ort: {
    id: "ort", label: "Ort", stapel: GROTESK,
    grad: 11.5, gewicht: 600, kursiv: false, versalien: false, sperrung: 0.02,
    farbe: "#3d4753", saum: PAPIER, saumBreite: 0.22,
    signatur: true, folgtPfad: false,
    prioritaet: 45, massstabVon: 0, massstabBis: 700
  },
  /* Gewässer: kursiv und in der Wasserfarbe — die eine typografische Regel, die
     auf jeder gedruckten Karte seit dem 18. Jahrhundert gilt. Genommen wird die
     TIEFENfarbe, nicht die Oberflächenfarbe (#3f93ad): die liest bei 12 px auf
     hellem Papier nicht mehr. Folgt dem Pfad — ein Fluss trägt seinen Namen. */
  gewaesser: {
    id: "gewaesser", label: "Gewässer", stapel: ANTIQUA,
    grad: 12.5, gewicht: 400, kursiv: true, versalien: false, sperrung: 0.06,
    farbe: "#1f4750", saum: PAPIER, saumBreite: 0.20,
    signatur: false, folgtPfad: true,
    prioritaet: 65, massstabVon: 0, massstabBis: 1400
  },
  /* Gebirge: gesperrte Versalien dem Grat folgend. Die Sperrung ist hier kein
     Schmuck, sondern Information — sie zeigt die AUSDEHNUNG des Zuges, während
     ein Ortsname nur einen Punkt meint. Verschwindet im Nahbereich, wo der Grat
     als Geometrie selbst deutlicher ist als sein Name. */
  gebirge: {
    id: "gebirge", label: "Gebirge", stapel: ANTIQUA,
    grad: 13, gewicht: 400, kursiv: false, versalien: true, sperrung: 0.34,
    farbe: "#4a4038", saum: PAPIER, saumBreite: 0.20,
    signatur: false, folgtPfad: true,
    prioritaet: 70, massstabVon: 120, massstabBis: WEIT
  },
  /* Gefahr: warmes Rot, fett, Versalien, mit Signatur. Die einzige Klasse, die
     schreien darf. Verschwindet im ganz weiten Blick — eine Warnung, die man
     nicht mehr ansteuern kann, ist Dekoration. */
  gefahr: {
    id: "gefahr", label: "Gefahr", stapel: GROTESK,
    grad: 12, gewicht: 700, kursiv: false, versalien: true, sperrung: 0.10,
    farbe: "#c1523c", saum: PAPIER, saumBreite: 0.24,
    signatur: true, folgtPfad: false,
    prioritaet: 60, massstabVon: 0, massstabBis: 900
  },
  /* Arbor: die Hausklasse. Der weiße Riesenbaum hält den zerrissenen Planeten
     zusammen, seine Ranken leuchten AUS SICH HERAUS (docs/terra-bearbeitungsplan,
     „Kanon: Arbor und der zerbissene Apfel"). Genau das leitet die Typografie:
     die weiteste Sperrung der Tabelle (Ranken laufen zur Mitte zusammen, der
     Name spannt sich über die ganze Achse), und als einzige Klasse ein SAUM IN
     ARBORS WEISS statt in Papier — ein Halo, kein Kontur. Sichtbar in jedem
     Maßstab: Arbor ist der Bezugspunkt der Welt, nicht ein Detail darin. */
  arbor: {
    id: "arbor", label: "Arbor", stapel: ANTIQUA,
    grad: 14, gewicht: 400, kursiv: false, versalien: true, sperrung: 0.42,
    farbe: "#2f9c8c", saum: "#f4f6f8", saumBreite: 0.30,
    signatur: false, folgtPfad: true,
    prioritaet: 80, massstabVon: 0, massstabBis: WEIT
  }
};

var KLASSEN_IDS = ["region", "ort", "gewaesser", "gebirge", "gefahr", "arbor"];

/** Klasse nach Namen; unbekannte Namen fallen auf „ort" — dieselbe tolerante
 *  Regel, die mkMarker in core/store.js für die Markerart anwendet. */
function klasseVon(name) {
  return (typeof name === "string" && KLASSEN[name]) ? KLASSEN[name] : KLASSEN.ort;
}

/** Rang einer Beschriftung. Klasse gibt den Grundwert, Größe verschiebt ihn —
 *  aber nur um ±15. Die Schranke ist gerechnet, nicht geraten: der höchste
 *  erreichbare Ortsrang (45 + 2·15 = 75) liegt unter dem niedrigsten
 *  Regionsrang (90 − 0,6·15 = 81). Eine hochgedrehte Ortsbeschriftung kann
 *  damit keine Region verdrängen, egal wie klein die gesetzt ist.
 *  Ganzzahlig, damit gleiche Eingaben gleich vergleichen. */
var RANG_SPANNE = 15;
function prioritaetVon(klasse, groesse) {
  var K = klasseVon(klasse);
  var g = Number.isFinite(groesse) ? clamp(groesse, 0.4, 3) : 1;
  return Math.round(K.prioritaet + (g - 1) * RANG_SPANNE);
}

/** Liegt der Maßstab im Fenster der Klasse? Fehlt der Maßstab, gilt alles
 *  sichtbar — so verhält sich das Modul, bis I1 die Hierarchie nachliefert. */
function imMassstab(klasse, massstab) {
  var K = klasseVon(typeof klasse === "string" ? klasse : (klasse && klasse.id));
  if (!Number.isFinite(massstab)) return true;
  return massstab >= K.massstabVon && massstab <= K.massstabBis;
}


/* ==========================================================================
   3 — Schriftmaße ohne Canvas

   Im Test gibt es kein Canvas, und `measureText` liefert dort 0. Die
   Glyphenverteilung braucht aber Breiten. Deshalb eine Schätztabelle, die
   IMMER da ist, und ein Messweg, der den echten Kontext benutzt, sobald einer
   brauchbare Werte liefert. Die Schätzung ist keine Notlösung für den Browser:
   sie ist die Grundlage, gegen die geprüft wird.
   ========================================================================== */

var SCHMAL = "iljItf.,;:'\"!|[]()`´-";
var BREIT = "mwMW@%";
var MITTEL_GROSS = "ABCDEFGHKNOPQRSUVXYZÄÖÜ";

/** Breite eines Zeichens in Vielfachen des Schriftgrads (grobe Antiqua-Metrik). */
function zeichenBreite(zeichen) {
  if (zeichen === " ") return 0.27;
  if (SCHMAL.indexOf(zeichen) >= 0) return 0.30;
  if (BREIT.indexOf(zeichen) >= 0) return 0.88;
  if (MITTEL_GROSS.indexOf(zeichen) >= 0) return 0.68;
  if (zeichen >= "0" && zeichen <= "9") return 0.55;
  return 0.52;
}

/**
 * Breiten aller Zeichen eines Textes in Pixeln.
 * `ctx` ist optional; nur wenn er echte Werte liefert (`measureText("M") > 0`),
 * wird er benutzt. Damit läuft derselbe Code im Browser exakt und im Test
 * geschätzt, ohne zwei Pfade zu pflegen.
 */
function glyphBreiten(zeichen, grad, ctx) {
  var echt = false;
  if (ctx && typeof ctx.measureText === "function") {
    var probe = ctx.measureText("M");
    echt = !!(probe && Number.isFinite(probe.width) && probe.width > 0);
  }
  var out = [];
  for (var i = 0; i < zeichen.length; i++) {
    var b = echt ? ctx.measureText(zeichen[i]).width : zeichenBreite(zeichen[i]) * grad;
    out.push(Number.isFinite(b) && b > 0 ? b : zeichenBreite(zeichen[i]) * grad);
  }
  return out;
}

/**
 * Setzt die Schrift der Klasse in einen MESSkontext.
 *
 * Muss vor jedem `glyphBreiten` mit echtem Kontext laufen: `measureText` misst
 * mit der zuletzt gesetzten Schrift, und die ist auf einem frischen Canvas
 * „10px sans-serif". Ohne diese Zeile wurden die Buchstaben mit rund einem
 * Drittel ihrer wirklichen Breite verplant — `zeichneKette` setzt die richtige
 * Schrift ja doch, und dann lief die Zeile ineinander. Im Bild sah das aus wie
 * ein Schriftfehler; es war ein Messfehler.
 *
 * Der Kontext gehört dem Aufrufer, deshalb defensiv: ein mitschreibender
 * Ersatz (Test) oder ein Kontext ohne `font` darf daran nicht scheitern.
 */
function schriftMessen(ctx, klasse, groesse) {
  if (!ctx) return;
  try { ctx.font = schriftAngabe(klasse, groesse); } catch (_e) { /* kein Canvas */ }
}

/** Der CSS-Wert für ctx.font. */
function schriftAngabe(klasse, groesse) {
  var K = klasseVon(typeof klasse === "string" ? klasse : (klasse && klasse.id));
  var g = Number.isFinite(groesse) ? clamp(groesse, 0.4, 3) : 1;
  return (K.kursiv ? "italic " : "") + K.gewicht + " " +
    (K.grad * g).toFixed(2) + "px " + K.stapel;
}

/** Der anzuzeigende Text: Versalien nach Klassenregel, Leerraum vereinheitlicht. */
function textFuerKlasse(text, klasse) {
  var K = klasseVon(typeof klasse === "string" ? klasse : (klasse && klasse.id));
  var t = String(text === undefined || text === null ? "" : text).replace(/\s+/g, " ").trim();
  return K.versalien ? t.toUpperCase() : t;
}


/* ==========================================================================
   4 — Glyphen entlang einer Kurve

   Eine Kette von Einzelglyphen, jede mit eigener Drehung. Drei Dinge machen
   das in der Praxis hässlich, und gegen jedes steht hier eine Maßnahme:

   LAUFWEITE. Die Basislinie liegt um `versatz` neben dem Pfad. Auf einer
     gekrümmten Bahn ist die versetzte Linie länger (außen) oder kürzer (innen)
     als der Pfad selbst: ds' = ds·(1 − versatz·k) mit der vorzeichenbehafteten
     Krümmung k. Damit die Glyphen auf der BASISLINIE gleichmäßig stehen, wird
     jeder Schritt auf dem Pfad durch diesen Faktor geteilt. Ohne das zieht
     Schrift in Außenkurven auseinander und staut sich in Innenkurven.

   KOPFSTAND. Läuft der Pfad nach links, stünde jede Glyphe auf dem Kopf.
     Deshalb entscheidet die SEHNE (erster zu letztem Punkt) einmal global über
     die Laufrichtung; zeigt sie nach links, wird der Pfad umgekehrt gelesen.
     Danach wird jede einzelne Drehung nachgeprüft — bleibt eine über 90°,
     gilt die Kurve als untauglich statt dass eine Glyphe kippt.

   ENGE BIEGUNG. An einem scharfen Knick klappen benachbarte Glyphen
     übereinander. Zwei Bremsen: die Drehung darf sich von Glyphe zu Glyphe nur
     um `maxWinkelSchritt` ändern (die Kette bleibt lesbar statt der Kurve
     sklavisch zu folgen), und wo der Krümmungsradius kleiner ist als die halbe
     Glyphenhöhe plus Versatz, faltet sich die Zeile durch ihren eigenen
     Mittelpunkt — dann wird `tauglich:false` gemeldet.

   `tauglich:false` ist kein Fehler, sondern die kartografisch richtige
   Antwort: eine Beschriftung, die auf diesen Pfad nicht passt, wird gerade
   gesetzt oder weggelassen. Genau wie bei der Kollisionsauflösung.
   ========================================================================== */

function normWinkel(w) {
  while (w > Math.PI) w -= 2 * Math.PI;
  while (w < -Math.PI) w += 2 * Math.PI;
  return w;
}

/** Bereinigte Punktfolge: nur endliche Werte, keine Doppelpunkte. */
function pfadSaeubern(punkte) {
  var P = [];
  if (!punkte) return P;
  for (var i = 0; i < punkte.length; i++) {
    var p = punkte[i];
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    var l = P[P.length - 1];
    if (l && Math.abs(l.x - p.x) < 1e-9 && Math.abs(l.y - p.y) < 1e-9) continue;
    P.push({ x: p.x, y: p.y });
  }
  return P;
}

function bogenLaengen(P) {
  var L = [0];
  for (var i = 1; i < P.length; i++) {
    var dx = P[i].x - P[i - 1].x, dy = P[i].y - P[i - 1].y;
    L.push(L[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return L;
}

/** Punkt bei Bogenlänge s (linear zwischen den Stützstellen). */
function punktBei(P, L, s) {
  var ganz = L[L.length - 1];
  if (s <= 0) return { x: P[0].x, y: P[0].y };
  if (s >= ganz) return { x: P[P.length - 1].x, y: P[P.length - 1].y };
  var i = 1;
  while (i < L.length - 1 && L[i] < s) i++;
  var t = (s - L[i - 1]) / (L[i] - L[i - 1] || 1);
  return { x: P[i - 1].x + (P[i].x - P[i - 1].x) * t,
           y: P[i - 1].y + (P[i].y - P[i - 1].y) * t };
}

/** Richtung bei s, gemittelt über ein Fenster ±h. Die Mittelung ist wichtig:
 *  ohne sie wäre die Richtung stückweise konstant und die Krümmung eine Folge
 *  von Sprüngen — die Laufweitenkorrektur würde daran zappeln. */
function winkelBei(P, L, s, h) {
  var ganz = L[L.length - 1];
  var a = punktBei(P, L, clamp(s - h, 0, ganz));
  var b = punktBei(P, L, clamp(s + h, 0, ganz));
  var dx = b.x - a.x, dy = b.y - a.y;
  if (Math.abs(dx) < 1e-12 && Math.abs(dy) < 1e-12) return 0;
  return Math.atan2(dy, dx);
}

/** Vorzeichenbehaftete Krümmung dθ/ds bei s. */
function kruemmungBei(P, L, s, h) {
  var ganz = L[L.length - 1];
  var s0 = clamp(s - h, 0, ganz), s1 = clamp(s + h, 0, ganz);
  var d = s1 - s0;
  if (d < 1e-9) return 0;
  return normWinkel(winkelBei(P, L, s1, h) - winkelBei(P, L, s0, h)) / d;
}

/**
 * Verteilt die Glyphen eines Textes auf einer Polylinie.
 *
 * punkte : [{x,y}] in EINEM gemeinsamen 2D-System. Die Drehung wird als
 *          atan2(dy,dx) gemeldet; „kein Kopfstand" heißt |winkel| ≤ 90°.
 *          Der Aufrufer entscheidet, ob y nach oben oder unten zeigt — er
 *          bekommt zurück, was er hineingibt.
 * opt    : { grad, sperrung (Anteil vom Grad), versatz (Basislinie neben dem
 *            Pfad), lage (0..1, wo die Zeile auf dem Pfad sitzt, 0.5 = mittig),
 *            breiten ([px] je Zeichen), maxWinkelSchritt (Grad, Vorgabe 26),
 *            faltGrenze (0..1, Vorgabe 0.85) }
 *
 * Rückgabe: { tauglich, grund, glyphen:[{zeichen,x,y,winkel,breite}],
 *             textLaenge, pfadLaenge }
 */
function glyphenAufKurve(text, punkte, opt) {
  opt = opt || {};
  var zeichen = String(text === undefined || text === null ? "" : text);
  var grad = Number.isFinite(opt.grad) ? opt.grad : 14;
  var sperr = (Number.isFinite(opt.sperrung) ? opt.sperrung : 0) * grad;
  var versatz = Number.isFinite(opt.versatz) ? opt.versatz : 0;
  var maxSchritt = (Number.isFinite(opt.maxWinkelSchritt) ? opt.maxWinkelSchritt : 26) * DEG;
  var faltGrenze = Number.isFinite(opt.faltGrenze) ? opt.faltGrenze : 0.85;
  var leer = { tauglich: false, grund: "", glyphen: [], textLaenge: 0, pfadLaenge: 0 };

  if (!zeichen.length) { leer.grund = "kein Text"; return leer; }
  var P = pfadSaeubern(punkte);
  if (P.length < 2) { leer.grund = "Pfad hat keine zwei Punkte"; return leer; }

  /* Kopfstand, Teil 1: eine globale Entscheidung über die Leserichtung. Bei
     senkrechtem Verlauf (dx = 0) liest die Zeile nach oben — die übliche
     Konvention für Beschriftungen an senkrechten Küsten und Flüssen. */
  var dxSehne = P[P.length - 1].x - P[0].x;
  var dySehne = P[P.length - 1].y - P[0].y;
  if (dxSehne < 0 || (dxSehne === 0 && dySehne < 0)) { P = P.slice().reverse(); versatz = -versatz; }

  var L = bogenLaengen(P);
  var ganz = L[L.length - 1];
  var h = Math.max(grad * 0.5, ganz * 0.01);       // Messfenster für Richtung/Krümmung

  var breiten = Array.isArray(opt.breiten) && opt.breiten.length === zeichen.length
    ? opt.breiten
    : glyphBreiten(zeichen, grad, opt.ctx);

  var textLaenge = 0, i;
  for (i = 0; i < zeichen.length; i++) textLaenge += breiten[i];
  textLaenge += sperr * (zeichen.length - 1);

  if (textLaenge > ganz) {
    leer.grund = "Pfad zu kurz";
    leer.textLaenge = textLaenge; leer.pfadLaenge = ganz;
    return leer;
  }

  var lage = Number.isFinite(opt.lage) ? clamp(opt.lage, 0, 1) : 0.5;
  var s = (ganz - textLaenge) * lage;

  var glyphen = [], rohWinkel = [];
  var halbHoch = grad * 0.5;
  for (i = 0; i < zeichen.length; i++) {
    var k = kruemmungBei(P, L, s + breiten[i] * 0.5, h);
    // Laufweite: der Pfadschritt wird um den Streckungsfaktor der versetzten
    // Basislinie korrigiert. Geklammert, weil 1 − versatz·k an einem scharfen
    // Knick durch null geht — dort greift ohnehin die Faltprüfung.
    var f = clamp(1 - versatz * k, 0.30, 3.0);
    var halb = (breiten[i] * 0.5) / f;
    var mitte = clamp(s + halb, 0, ganz);
    var p = punktBei(P, L, mitte);
    var w = winkelBei(P, L, mitte, h);
    // Enge Biegung: der Krümmungsradius muss größer sein als das, was die Zeile
    // quer beansprucht — sonst faltet sie sich durch den Krümmungsmittelpunkt.
    if (Math.abs(k) * (Math.abs(versatz) + halbHoch) > faltGrenze) {
      leer.grund = "Biegung zu eng";
      leer.textLaenge = textLaenge; leer.pfadLaenge = ganz;
      return leer;
    }
    var nx = -Math.sin(w), ny = Math.cos(w);
    glyphen.push({
      zeichen: zeichen[i],
      x: p.x + nx * versatz,
      y: p.y + ny * versatz,
      winkel: 0,                       // wird gleich geglättet gesetzt
      breite: breiten[i]
    });
    rohWinkel.push(w);
    s = mitte + halb + sperr / f;
  }

  /* Drehung glätten: die Kette darf von Glyphe zu Glyphe nur begrenzt
     abknicken. Das ist der Unterschied zwischen „folgt der Kurve" und „folgt
     jedem Zittern der Kurve". */
  var w0 = rohWinkel[0];
  glyphen[0].winkel = w0;
  for (i = 1; i < glyphen.length; i++) {
    var d = normWinkel(rohWinkel[i] - glyphen[i - 1].winkel);
    glyphen[i].winkel = glyphen[i - 1].winkel + clamp(d, -maxSchritt, maxSchritt);
  }

  /* Kopfstand, Teil 2: nach Sehnenwahl und Glättung darf keine Drehung mehr
     über den rechten Winkel hinausgehen. Passiert das trotzdem (S-Schlagen,
     Schleife), ist der Pfad für diesen Text nicht geeignet. */
  for (i = 0; i < glyphen.length; i++) {
    var abs = Math.abs(normWinkel(glyphen[i].winkel));
    if (!Number.isFinite(glyphen[i].x) || !Number.isFinite(glyphen[i].y) || !Number.isFinite(abs)) {
      leer.grund = "Pfad liefert keine Zahlen";
      return leer;
    }
    if (abs > Math.PI * 0.5 + 1e-9) {
      leer.grund = "Kopfstand";
      leer.textLaenge = textLaenge; leer.pfadLaenge = ganz;
      return leer;
    }
  }

  return { tauglich: true, grund: "", glyphen: glyphen, textLaenge: textLaenge, pfadLaenge: ganz };
}

/**
 * Dieselbe Glyphenkette, aber gerade — der Normalfall (Orte, Gefahr).
 * Liefert Koordinaten im Canvas-System: x läuft nach rechts, y ist die
 * Grundlinie, Ursprung links davon.
 */
function glyphenGerade(text, opt) {
  opt = opt || {};
  var zeichen = String(text === undefined || text === null ? "" : text);
  var grad = Number.isFinite(opt.grad) ? opt.grad : 14;
  var sperr = (Number.isFinite(opt.sperrung) ? opt.sperrung : 0) * grad;
  var x0 = Number.isFinite(opt.x) ? opt.x : 0;
  var y0 = Number.isFinite(opt.y) ? opt.y : 0;
  var breiten = Array.isArray(opt.breiten) && opt.breiten.length === zeichen.length
    ? opt.breiten : glyphBreiten(zeichen, grad, opt.ctx);
  var glyphen = [], x = x0, laenge = 0;
  for (var i = 0; i < zeichen.length; i++) {
    glyphen.push({ zeichen: zeichen[i], x: x + breiten[i] * 0.5, y: y0, winkel: 0, breite: breiten[i] });
    x += breiten[i] + (i < zeichen.length - 1 ? sperr : 0);
    laenge = x - x0;
  }
  return { tauglich: true, grund: "", glyphen: glyphen, textLaenge: laenge, pfadLaenge: laenge };
}


/* ==========================================================================
   5 — Kollisionsvermeidung im Bildraum

   Echte Karten lassen Beschriftungen WEG, statt sie überlappen zu lassen.
   Gierig nach Rang: die stärkste zuerst, jede weitere nur, wenn sie frei steht.

   Zwei Zusagen, die das Verfahren halten muss:

   REIHENFOLGEUNABHÄNGIG. Sortiert wird nach (Rang absteigend, Schlüssel
     aufsteigend, id aufsteigend). Das ist eine TOTALE Ordnung, solange
     (Schlüssel, id) eindeutig ist — die Eingabereihenfolge kann das Ergebnis
     also nicht beeinflussen, und bei gleichem Rang entscheidet der Name, nicht
     der Zufall und nicht die Ladereihenfolge.

   KEIN FLACKERN. Bei minimaler Kamerabewegung darf eine Beschriftung nicht
     zwischen an und aus springen. Deshalb Hysterese: wer sichtbar WAR, wird
     mit einem um `hysterese` geschrumpften Kasten geprüft, wer verborgen war,
     mit einem gewachsenen. Die Schwelle zum Ausblenden liegt damit um 2·hysterese
     Pixel neben der Schwelle zum Einblenden; im Band dazwischen bleibt alles,
     wie es ist. Ohne das reicht ein Pixel Kamerabewegung für einen Wechsel.
   ========================================================================== */

var HYSTERESE_PX = 5;       // halbe Bandbreite der Schaltschwelle
var TAKT_MS = 160;          // ~6 Neubewertungen je Sekunde, nicht 60

/**
 * Entscheidet, welche Kästen sichtbar bleiben.
 * kaesten : [{ id, schluessel, x, y, w, h, prioritaet }] — x/y ist die MITTE,
 *           w/h die volle Ausdehnung in Bildpixeln.
 * opt     : { vorher (Set der zuletzt sichtbaren ids), hysterese }
 * Rückgabe: Set der sichtbaren ids.
 */
function loeseKollisionen(kaesten, opt) {
  opt = opt || {};
  var hyst = Number.isFinite(opt.hysterese) ? opt.hysterese : HYSTERESE_PX;
  var vorher = opt.vorher || null;
  var liste = [], i;
  for (i = 0; i < (kaesten ? kaesten.length : 0); i++) {
    var k = kaesten[i];
    if (!k || !Number.isFinite(k.x) || !Number.isFinite(k.y) ||
        !Number.isFinite(k.w) || !Number.isFinite(k.h)) continue;
    var war = vorher ? (typeof vorher.has === "function" ? vorher.has(k.id)
                                                        : vorher.indexOf(k.id) >= 0) : false;
    var p = war ? -hyst : hyst;
    var hw = Math.max(0.5, k.w * 0.5 + p), hh = Math.max(0.5, k.h * 0.5 + p);
    liste.push({
      id: k.id,
      schluessel: String(k.schluessel === undefined ? k.id : k.schluessel),
      prio: Number.isFinite(k.prioritaet) ? k.prioritaet : 0,
      x0: k.x - hw, x1: k.x + hw, y0: k.y - hh, y1: k.y + hh
    });
  }
  liste.sort(function (a, b) {
    if (b.prio !== a.prio) return b.prio - a.prio;
    if (a.schluessel !== b.schluessel) return a.schluessel < b.schluessel ? -1 : 1;
    return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
  });

  var frei = [], sichtbar = new Set();
  for (i = 0; i < liste.length; i++) {
    var e = liste[i], stoert = false;
    for (var j = 0; j < frei.length; j++) {
      var f = frei[j];
      if (e.x0 < f.x1 && e.x1 > f.x0 && e.y0 < f.y1 && e.y1 > f.y0) { stoert = true; break; }
    }
    if (stoert) continue;
    frei.push(e);
    sichtbar.add(e.id);
  }
  return sichtbar;
}

/**
 * Bildkästen aus Welteinträgen — der Schritt zwischen Szene und Kollision.
 * Rein: die Projektion kommt als Funktion herein, nicht aus three.
 *
 * eintraege : [{ id, schluessel, klasse, groesse, x, y, z, breitePx, hoehePx }]
 * sicht     : { projiziere(x,y,z) -> {x,y,z} in NDC, breite, hoehe, massstab }
 */
function bildKaesten(eintraege, sicht) {
  var out = [];
  var bw = sicht.breite, bh = sicht.hoehe;
  for (var i = 0; i < (eintraege ? eintraege.length : 0); i++) {
    var e = eintraege[i];
    if (!e) continue;
    if (!imMassstab(e.klasse, sicht.massstab)) continue;
    var n = sicht.projiziere(e.x, e.y, e.z);
    if (!n || !Number.isFinite(n.x) || !Number.isFinite(n.y)) continue;
    /* Hinter der Kamera ausblenden — dieselbe Regel wie im Marker-Overlay
       (ui/panels.js, D1): dort ist w negativ, project() spiegelt x/y am
       Ursprung und liefert z > 1. Der großzügige Randbereich ±1.4 lässt
       Beschriftungen bis knapp außerhalb stehen, statt sie am Bildrand
       aufblitzen zu lassen. */
    if (n.z > 1 || n.x < -1.4 || n.x > 1.4 || n.y < -1.4 || n.y > 1.4) continue;
    out.push({
      id: e.id,
      schluessel: e.schluessel === undefined ? String(e.id) : String(e.schluessel),
      prioritaet: prioritaetVon(e.klasse, e.groesse),
      x: (n.x * 0.5 + 0.5) * bw,
      y: (-n.y * 0.5 + 0.5) * bh,
      w: Number.isFinite(e.breitePx) ? e.breitePx : 1,
      h: Number.isFinite(e.hoehePx) ? e.hoehePx : 1
    });
  }
  return out;
}

/* I1: die Formel steht jetzt EINMAL in core/bild.js — render/signaturen.js
   rechnet dasselbe, und zwei Fassungen davon laufen auseinander. Der Name
   bleibt hier erhalten, damit kein Aufrufer angefasst werden muss. */
var spriteBildhoehe = bildhoehe;


/* ==========================================================================
   6 — Zeichnen

   Ab hier wird gemalt. Der Kontext ist immer ein Parameter — kein
   `document.getElementById`, kein Modulglobal. Genau das macht den Zeichenweg
   ohne Browser prüfbar: der Test reicht einen mitschreibenden Kontext herein
   und liest die Aufrufliste.

   Reihenfolge je Glyphe: erst der Saum (strokeText mit runden Verbindungen),
   dann die Füllung. Umgekehrt fräße der Saum die Hälfte der Buchstabenform.
   ========================================================================== */

/** Zeichnet eine fertige Glyphenkette. Koordinaten im Canvas-System. */
function zeichneKette(ctx, glyphen, klasse, groesse) {
  var K = klasseVon(typeof klasse === "string" ? klasse : (klasse && klasse.id));
  var g = Number.isFinite(groesse) ? clamp(groesse, 0.4, 3) : 1;
  ctx.save();
  ctx.font = schriftAngabe(K, g);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = K.saum;
  ctx.lineWidth = K.saumBreite * K.grad * g;
  ctx.fillStyle = K.farbe;
  for (var i = 0; i < glyphen.length; i++) {
    var gl = glyphen[i];
    if (gl.zeichen === " ") continue;                 // nichts zu malen, spart zwei Aufrufe
    ctx.save();
    ctx.translate(gl.x, gl.y);
    if (gl.winkel) ctx.rotate(gl.winkel);
    ctx.strokeText(gl.zeichen, -gl.breite * 0.5, 0);
    ctx.fillText(gl.zeichen, -gl.breite * 0.5, 0);
    ctx.restore();
  }
  ctx.restore();
}

/** Punktsignatur vor dem Text (Orte, Gefahr): erst der Punkt sagt, WO. */
function zeichneSignatur(ctx, x, y, klasse, groesse) {
  var K = klasseVon(typeof klasse === "string" ? klasse : (klasse && klasse.id));
  var g = Number.isFinite(groesse) ? clamp(groesse, 0.4, 3) : 1;
  var r = K.grad * g * 0.22;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r + K.saumBreite * K.grad * g * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = K.saum;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = K.farbe;
  ctx.fill();
  ctx.restore();
}

/**
 * Maße einer geraden Beschriftung samt Signatur — die Grundlage für die
 * Texturgröße und für den Kollisionskasten.
 * Rückgabe: { text, breiten, textBreite, breite, hoehe, grundlinie, textX }
 */
function messeBeschriftung(text, klasse, opt) {
  opt = opt || {};
  var K = klasseVon(typeof klasse === "string" ? klasse : (klasse && klasse.id));
  var g = Number.isFinite(opt.groesse) ? clamp(opt.groesse, 0.4, 3) : 1;
  var grad = K.grad * g;
  var t = textFuerKlasse(text, K);
  schriftMessen(opt.ctx, K, g);            // sonst misst measureText 10px-Standard
  var breiten = glyphBreiten(t, grad, opt.ctx);
  var textBreite = 0;
  for (var i = 0; i < breiten.length; i++) textBreite += breiten[i];
  if (breiten.length > 1) textBreite += K.sperrung * grad * (breiten.length - 1);
  var saum = K.saumBreite * grad;
  var sig = K.signatur ? grad * 0.44 + grad * 0.30 : 0;   // Punkt + Abstand
  var rand = saum + grad * 0.25;
  return {
    text: t,
    breiten: breiten,
    grad: grad,
    textBreite: textBreite,
    breite: Math.ceil(textBreite + sig + rand * 2),
    hoehe: Math.ceil(grad * 1.42 + rand * 2),
    grundlinie: Math.round(rand + grad * 1.05),
    textX: rand + sig,
    signaturX: K.signatur ? rand + grad * 0.22 : -1
  };
}

/**
 * Malt eine gerade Beschriftung in einen vorbereiteten Kontext.
 * Der Aufrufer hat das Canvas bereits auf `masse.breite × masse.hoehe`
 * gebracht — die Größe MUSS vor dem Setzen von ctx.font stehen, weil ein
 * Größenwechsel den Kontext zurücksetzt.
 */
function zeichneBeschriftung(ctx, text, klasse, opt) {
  opt = opt || {};
  var K = klasseVon(typeof klasse === "string" ? klasse : (klasse && klasse.id));
  var g = Number.isFinite(opt.groesse) ? clamp(opt.groesse, 0.4, 3) : 1;
  var masse = opt.masse || messeBeschriftung(text, K, { groesse: g, ctx: ctx });
  if (ctx.clearRect) ctx.clearRect(0, 0, masse.breite, masse.hoehe);
  if (K.signatur && masse.signaturX >= 0) {
    zeichneSignatur(ctx, masse.signaturX, masse.grundlinie - masse.grad * 0.32, K, g);
  }
  var kette = glyphenGerade(masse.text, {
    grad: masse.grad, sperrung: K.sperrung, breiten: masse.breiten,
    x: masse.textX, y: masse.grundlinie
  });
  zeichneKette(ctx, kette.glyphen, K, g);
  return masse;
}

/**
 * Baut das Texturbild einer Beschriftung. Braucht `document` — im Test wird
 * stattdessen `zeichneBeschriftung` mit einem eigenen Kontext gerufen.
 * `opt.canvasFabrik()` erlaubt einen anderen Träger (Offscreen, Prüfung).
 */
function beschriftungsBild(text, klasse, opt) {
  opt = opt || {};
  var mach = opt.canvasFabrik || function () { return document.createElement("canvas"); };
  var c = mach();
  var vor = c.getContext("2d");
  var masse = messeBeschriftung(text, klasse, { groesse: opt.groesse, ctx: vor });
  c.width = masse.breite;
  c.height = masse.hoehe;
  var ctx = c.getContext("2d");           // nach dem Größenwechsel neu holen
  zeichneBeschriftung(ctx, text, klasse, { groesse: opt.groesse, masse: masse });
  return { canvas: c, masse: masse };
}


/* ==========================================================================
   6b — Die gebogene Beschriftung (I4, eingehängt in dieser Runde)

   `glyphenAufKurve` gab es seit I4, aber nichts rief es auf. Der Grund war
   eine offene Frage, keine offene Rechnung: eine gebogene Beschriftung ist
   kein Sprite mehr. Sie kann es auch nicht sein — ein Sprite dreht sich zur
   Kamera, eine Kurve liegt in der Karte.

   DIE ENTSCHEIDUNG. Sie wird zu EINEM Quad, das flach auf der Karte liegt
   (Drehung −90° um X), und die Krümmung steckt in seiner Textur. Nicht eine
   Kette von Quads, eines je Glyphe: das wären zwanzig Meshes, zwanzig
   Materialien und zwanzig Zeichenaufrufe je Beschriftung — für ein Bild, das
   sich nur ändert, wenn sich der Pfad ändert. Ein gebackenes Quad ist ein
   Zeichenaufruf und dieselbe Sache, die eine gedruckte Karte tut.

   Das Bild wird deshalb im KARTENSYSTEM gemalt:
       Bild-x  =  Welt-x / einheitJePixel
       Bild-y  =  Welt-z / einheitJePixel
   Bild-y läuft im Canvas nach unten, die Ebene bildet ihre obere Zeile auf
   −z ab (Norden) — die Zuordnung stimmt also in beide Richtungen, und die
   Schrift steht in der Aufsicht richtig herum. `einheitJePixel` ist dieselbe
   Zahl, mit der ein Sprite skaliert wird: eine gerade und eine gebogene
   Beschriftung derselben Klasse sind damit gleich groß.

   Was `glyphenAufKurve` schon kann und hier gebraucht wird: Laufweite auf der
   versetzten Basislinie, geglättete Drehung, Kopfstandprüfung, Abbruch bei zu
   enger Biegung. Alle vier Fälle enden in `tauglich:false` — und das heißt
   hier: die Beschriftung wird gerade gesetzt, wie zuvor. Ein Pfad, der einen
   Text nicht trägt, ist kein Fehler.
   ========================================================================== */

/* Basislinie über der Kurve statt auf ihr: der Pfad ist in aller Regel ein
   sichtbares Ding (Fluss, Küste, Grat), und Schrift gehört daneben, nicht
   darüber. 0.30 Schriftgrade sind der Abstand, bei dem die Unterlängen die
   Linie gerade nicht mehr berühren. Negativ, weil die Normale in einem
   y-nach-unten-System nach Süden zeigt. */
var KURVE_VERSATZ = -0.30;

/* Deckel für die Texturkante. Über 2048 px wird eine Beschriftung nicht mehr
   schöner, nur teurer — und ein Text, der so viel Fläche braucht, sitzt fast
   immer auf einem Pfad, der ihn ohnehin nicht trägt. */
var KURVE_MAX_PX = 2048;

/**
 * Rechnet eine gebogene Beschriftung durch — ohne zu zeichnen.
 *
 * opt: { groesse, pfad:[{x,z}] (Weltkoordinaten), lage (0..1),
 *        einheitJePixel, ctx }
 * Rückgabe bei Erfolg:
 *   { tauglich:true, text, glyphen (Canvas-Koordinaten), breite, hoehe,
 *     mitte:{x,z} (Weltmitte des Quads), grad }
 * sonst { tauglich:false, grund }.
 */
function kurvenBeschriftung(text, klasse, opt) {
  opt = opt || {};
  var K = klasseVon(typeof klasse === "string" ? klasse : (klasse && klasse.id));
  var g = Number.isFinite(opt.groesse) ? clamp(opt.groesse, 0.4, 3) : 1;
  var grad = K.grad * g;
  var E = Number.isFinite(opt.einheitJePixel) && opt.einheitJePixel > 0
    ? opt.einheitJePixel : EINHEIT_JE_PIXEL;
  var t = textFuerKlasse(text, K);
  if (!t) return { tauglich: false, grund: "kein Text" };
  var welt = opt.pfad;
  if (!Array.isArray(welt) || welt.length < 2) return { tauglich: false, grund: "kein Pfad" };

  // Welt -> Bildpixel. Kein Ursprungsversatz: die Glyphen werden unten anhand
  // ihrer eigenen Hüllbox verschoben, und bis dahin ist jede Verschiebung eine
  // zusätzliche Fehlerquelle.
  var P = [], i;
  for (i = 0; i < welt.length; i++) {
    var w = welt[i];
    if (!w || !Number.isFinite(w.x) || !Number.isFinite(w.z)) continue;
    P.push({ x: w.x / E, y: w.z / E });
  }
  if (P.length < 2) return { tauglich: false, grund: "kein Pfad" };

  schriftMessen(opt.ctx, K, g);            // siehe schriftMessen: sonst 10px-Standard
  var breiten = glyphBreiten(t, grad, opt.ctx);
  var res = glyphenAufKurve(t, P, {
    grad: grad, sperrung: K.sperrung, breiten: breiten,
    versatz: KURVE_VERSATZ * grad,
    lage: Number.isFinite(opt.lage) ? opt.lage : 0.5,
    ctx: opt.ctx
  });
  if (!res.tauglich) return { tauglich: false, grund: res.grund };

  /* Hüllbox der gedrehten Glyphen. Konservativ über einen Umkreis je Glyphe
     statt über vier gedrehte Ecken: der Umkreis ist um höchstens einen halben
     Saum zu groß, kostet dafür keine Winkelfunktion und kann bei keiner
     Drehung zu klein werden. */
  var saum = K.saumBreite * grad;
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (i = 0; i < res.glyphen.length; i++) {
    var gl = res.glyphen[i];
    var r = Math.max(gl.breite, grad * 1.42) * 0.5 + saum;
    if (gl.x - r < minX) minX = gl.x - r;
    if (gl.x + r > maxX) maxX = gl.x + r;
    if (gl.y - r < minY) minY = gl.y - r;
    if (gl.y + r > maxY) maxY = gl.y + r;
  }
  if (!(minX <= maxX)) return { tauglich: false, grund: "Pfad liefert keine Zahlen" };

  var rand = grad * 0.25;
  var breite = Math.ceil(maxX - minX + rand * 2);
  var hoehe = Math.ceil(maxY - minY + rand * 2);
  if (breite > KURVE_MAX_PX || hoehe > KURVE_MAX_PX)
    return { tauglich: false, grund: "Beschriftung zu groß für eine Textur" };

  var dx = rand - minX, dy = rand - minY;
  var glyphen = [];
  for (i = 0; i < res.glyphen.length; i++) {
    var q = res.glyphen[i];
    glyphen.push({ zeichen: q.zeichen, x: q.x + dx, y: q.y + dy,
      winkel: q.winkel, breite: q.breite });
  }
  return {
    tauglich: true, grund: "", text: t, glyphen: glyphen,
    breite: breite, hoehe: hoehe, grad: grad,
    // Bildmitte zurück in die Welt: die Verschiebung dx/dy rückgängig, dann
    // mal einheitJePixel. Das ist die Position des Quads.
    mitte: { x: (breite * 0.5 - dx) * E, z: (hoehe * 0.5 - dy) * E }
  };
}

/**
 * Das Texturbild einer gebogenen Beschriftung. Braucht `document` (oder eine
 * `canvasFabrik` wie beschriftungsBild). Liefert null, wenn der Pfad den Text
 * nicht trägt — der Aufrufer setzt dann gerade.
 */
function kurvenBild(text, klasse, opt) {
  opt = opt || {};
  var mach = opt.canvasFabrik || function () { return document.createElement("canvas"); };
  var c = mach();
  var vor = c.getContext("2d");
  var masse = kurvenBeschriftung(text, klasse, {
    groesse: opt.groesse, pfad: opt.pfad, lage: opt.lage,
    einheitJePixel: opt.einheitJePixel, ctx: vor
  });
  if (!masse.tauglich) return null;
  c.width = masse.breite;
  c.height = masse.hoehe;
  var ctx = c.getContext("2d");           // nach dem Größenwechsel neu holen
  if (ctx.clearRect) ctx.clearRect(0, 0, masse.breite, masse.hoehe);
  // Keine Punktsignatur: sie sagt „hier", und eine gebogene Beschriftung sagt
  // „entlang" — der Punkt gehört zur geraden Fassung.
  zeichneKette(ctx, masse.glyphen, klasse, opt.groesse);
  return { canvas: c, masse: masse };
}


/* ==========================================================================
   7 — Die Schicht in der Szene

   Der einzige Teil, der three braucht. Er hält je Beschriftung ein Sprite,
   zieht die Sichtbarkeit gedrosselt nach und beantwortet den Klick.

   Warum Sprite und nicht Mesh: eine Beschriftung soll die Kamera anschauen,
   nicht die Karte. Ein Mesh läge schräg im Raum, sobald man die Kamera neigt —
   und terra neigt sie (autoPitch). Sprites sind außerdem das, was der
   PNG-Export ohne Zutun mitnimmt, weil sie im selben Renderdurchgang liegen.
   ========================================================================== */

/** Weltbreite eines Sprites: Textur in Pixeln mal Einheiten-je-Pixel. */
var EINHEIT_JE_PIXEL = 0.055;

function neueSchicht(opt) {
  opt = opt || {};
  var gruppe = new THREE.Group();
  gruppe.name = "beschriftungen";
  gruppe.renderOrder = 12;               // über dem Gelände, unter den Griffen

  var eintraege = [];                    // parallel zu den Quellen, nach id
  var nachId = new Map();
  var sichtbar = new Set();              // Ergebnis der letzten Bewertung
  var letzterTakt = -1e9;
  var einheitJePixel = Number.isFinite(opt.einheitJePixel) ? opt.einheitJePixel : EINHEIT_JE_PIXEL;
  var _v = new THREE.Vector3();

  /** Textur aus einem fertigen Canvas — für beide Bauarten dieselbe. */
  function textur(canvas) {
    var tex = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace !== undefined) tex.colorSpace = THREE.SRGBColorSpace;
    tex.generateMipmaps = true;
    if (THREE.LinearMipmapLinearFilter !== undefined) tex.minFilter = THREE.LinearMipmapLinearFilter;
    if (THREE.LinearFilter !== undefined) tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    return tex;
  }

  function baueSprite(q) {
    var bild = beschriftungsBild(q.text, q.klasse, { groesse: q.groesse, canvasFabrik: opt.canvasFabrik });
    var mat = new THREE.SpriteMaterial({ map: textur(bild.canvas), transparent: true,
      depthTest: false, depthWrite: false });
    var s = new THREE.Sprite(mat);
    s.scale.set(bild.masse.breite * einheitJePixel, bild.masse.hoehe * einheitJePixel, 1);
    s.renderOrder = 12;
    s.userData.beschriftung = q;
    return { sprite: s, masse: bild.masse };
  }

  /* Ein Quad, flach auf der Karte. Die Geometrie wird EINMAL angelegt und von
     allen gebogenen Beschriftungen geteilt (skaliert wird am Mesh); träge,
     weil dieses Modul auch im Test geladen wird, wo niemand eine Szene will —
     dieselbe Begründung wie bei `holeBeschriftungsschicht` unten. */
  var kurvenGeo = null;
  function baueKurve(q) {
    var bild = kurvenBild(q.text, q.klasse, {
      groesse: q.groesse, pfad: q.pfad, lage: q.lage,
      einheitJePixel: einheitJePixel, canvasFabrik: opt.canvasFabrik
    });
    if (!bild) return null;                       // Pfad trägt den Text nicht
    if (!kurvenGeo) kurvenGeo = new THREE.PlaneGeometry(1, 1);
    var werte = { map: textur(bild.canvas), transparent: true,
      depthTest: false, depthWrite: false };
    // Beidseitig, wo three es kennt: die Karte wird auch von unten betrachtet
    // (Kamerafahrt unter eine Schwebeinsel), und eine dann unsichtbare
    // Beschriftung sähe aus wie ein Fehler.
    if (THREE.DoubleSide !== undefined) werte.side = THREE.DoubleSide;
    var m = new THREE.Mesh(kurvenGeo, new THREE.MeshBasicMaterial(werte));
    m.rotation.x = -Math.PI * 0.5;
    m.scale.set(bild.masse.breite * einheitJePixel, bild.masse.hoehe * einheitJePixel, 1);
    m.renderOrder = 12;
    m.frustumCulled = false;      // die geteilte 1x1-Geometrie hat die falsche Hülle
    m.userData.beschriftung = q;
    return { sprite: m, masse: bild.masse, mitte: bild.masse.mitte };
  }

  /**
   * Gleicht die Sprites gegen die Quellenliste ab.
   * quellen: [{ id, text, klasse, groesse, ziel, x, y, z, pfad? }]
   * Der Vergleichsschlüssel enthält alles, was das Bild bestimmt — ändert sich
   * nur die Position, bleibt die Textur stehen (Textur bauen ist teuer).
   */
  /* Wo das Ding wirklich steht. Für ein Sprite ist das der Ankerpunkt der
     Beschriftung; für ein gebogenes Quad die Mitte seiner Textur, denn die
     Kurve bestimmt die Lage, nicht der Anker. Eine Funktion statt zweier
     Zweige an vier Stellen (Setzen, Nachziehen, Kollision). */
  function ortVon(e, q) {
    if (e && e.mitte) return { x: e.mitte.x, y: q.y, z: e.mitte.z };
    return { x: q.x, y: q.y, z: q.z };
  }

  function abgleichen(quellen) {
    var gesehen = new Set(), i;
    for (i = 0; i < (quellen ? quellen.length : 0); i++) {
      var q = quellen[i];
      if (!q || q.id === undefined) continue;
      var text = textFuerKlasse(q.text, q.klasse);
      if (!text) continue;                                   // ohne Text keine Beschriftung
      gesehen.add(q.id);
      /* Der Vergleichsschlüssel enthält alles, was das BILD bestimmt. Bei
         einer gebogenen Beschriftung gehört der Verlauf dazu (`pfadStempel`,
         eine kurze Signatur aus den Stützpunkten des verknüpften Elements)
         und die Lage darauf — sonst bliebe die Textur stehen, wenn der Fluss
         verschoben wird. Ohne Verknüpfung ändert sich am Schlüssel nichts,
         und eine Bestandskarte baut exakt dieselben Sprites wie zuvor. */
      var stempel = q.klasse + "|" + (q.groesse || 1) + "|" + text;
      if (q.pfad) stempel += "|" + (q.pfadStempel || "") + "|" + Math.round((q.lage || 0) * 1000);
      var alt = nachId.get(q.id);
      if (alt && alt.stempel === stempel) {
        alt.quelle = q;
        var o = ortVon(alt, q);
        alt.sprite.position.set(o.x, o.y, o.z);
        alt.sprite.userData.beschriftung = q;
        continue;
      }
      if (alt) entferne(alt);
      // Gebogen, wenn ein Pfad da ist UND er den Text trägt; sonst gerade.
      // Diese eine Zeile ist der ganze Rückfall: „nicht tauglich" ist kein
      // Fehler, sondern die kartografisch richtige Antwort (siehe 6b).
      var neu = (q.pfad ? baueKurve(q) : null) || baueSprite(q);
      var e = { id: q.id, quelle: q, sprite: neu.sprite, masse: neu.masse,
        mitte: neu.mitte || null, stempel: stempel };
      var o2 = ortVon(e, q);
      neu.sprite.position.set(o2.x, o2.y, o2.z);
      nachId.set(q.id, e);
      eintraege.push(e);
      gruppe.add(neu.sprite);
    }
    for (i = eintraege.length - 1; i >= 0; i--) {
      if (!gesehen.has(eintraege[i].id)) entferne(eintraege[i]);
    }
    return eintraege.length;
  }

  function entferne(e) {
    var i = eintraege.indexOf(e);
    if (i >= 0) eintraege.splice(i, 1);
    nachId.delete(e.id);
    gruppe.remove(e.sprite);
    sichtbar.delete(e.id);
    if (e.sprite.material) {
      if (e.sprite.material.map && e.sprite.material.map.dispose) e.sprite.material.map.dispose();
      if (e.sprite.material.dispose) e.sprite.material.dispose();
    }
  }

  /**
   * Bewertet Maßstab und Überdeckung neu und schaltet die Sprites.
   * Gedrosselt auf TAKT_MS — die Bewertung kostet eine Projektion und einen
   * quadratischen Vergleich je Beschriftung, das gehört nicht in jedes Bild.
   * `jetzt` in Millisekunden; `sicht.erzwinge` überspringt die Drosselung
   * (nach dem Laden, nach einer Textänderung).
   */
  function nachziehen(sicht, jetzt) {
    if (!eintraege.length) return sichtbar;
    if (!sicht || !sicht.erzwinge) {
      if (Number.isFinite(jetzt) && jetzt - letzterTakt < TAKT_MS) return sichtbar;
    }
    if (Number.isFinite(jetzt)) letzterTakt = jetzt;

    var kamera = sicht.camera;
    var liste = [], i;
    for (i = 0; i < eintraege.length; i++) {
      var e = eintraege[i], q = e.quelle;
      var abstand = kamera ? e.sprite.position.distanceTo(kamera.position) : 1;
      var ort = ortVon(e, q);
      liste.push({
        id: e.id,
        schluessel: e.stempel,
        klasse: q.klasse,
        groesse: q.groesse,
        x: ort.x, y: ort.y, z: ort.z,
        breitePx: spriteBildhoehe(e.sprite.scale.x, abstand, sicht.fov || 30, sicht.hoehe),
        hoehePx: spriteBildhoehe(e.sprite.scale.y, abstand, sicht.fov || 30, sicht.hoehe)
      });
    }
    var kaesten = bildKaesten(liste, {
      projiziere: sicht.projiziere || function (x, y, z) {
        _v.set(x, y, z); _v.project(kamera); return _v;
      },
      breite: sicht.breite, hoehe: sicht.hoehe, massstab: sicht.massstab
    });
    sichtbar = loeseKollisionen(kaesten, { vorher: sichtbar, hysterese: sicht.hysterese });
    for (i = 0; i < eintraege.length; i++) {
      eintraege[i].sprite.visible = sichtbar.has(eintraege[i].id);
    }
    return sichtbar;
  }

  /**
   * Welche Beschriftung liegt unter dem Zeiger? Raycast auf die Sprites, nicht
   * auf ein HTML-Overlay: das funktioniert im Vollbild, bei Kamerafahrten und
   * ohne DOM-Abgleich. Im Aufnahme-Modus liefert die Funktion IMMER null —
   * dort gibt es keinen Treffer, keinen Zeigerwechsel, keinen Klick.
   */
  function treffer(raycaster, aufnahme) {
    if (aufnahme || !raycaster || !eintraege.length) return null;
    var kandidaten = [];
    for (var i = 0; i < eintraege.length; i++) {
      if (eintraege[i].sprite.visible) kandidaten.push(eintraege[i].sprite);
    }
    if (!kandidaten.length) return null;
    var treffe = raycaster.intersectObjects(kandidaten, false);
    if (!treffe || !treffe.length) return null;
    var obj = treffe[0].object;
    return (obj && obj.userData && obj.userData.beschriftung) || null;
  }

  /** Klick auf eine Beschriftung: Ziel öffnen, wenn eines erlaubt ist. */
  function klick(raycaster, opt2) {
    opt2 = opt2 || {};
    var q = treffer(raycaster, opt2.aufnahme);
    if (!q) return false;
    return zielOeffnen(q.ziel, opt2);
  }

  /** Zeigerform für die Überfahrt — leer heißt „nichts ändern". */
  function zeigerFuer(raycaster, opt2) {
    opt2 = opt2 || {};
    if (opt2.aufnahme) return "";
    var q = treffer(raycaster, false);
    if (!q) return "";
    return zielUrl(q.ziel, opt2) ? "pointer" : "";
  }

  function entsorgen() {
    for (var i = eintraege.length - 1; i >= 0; i--) entferne(eintraege[i]);
    letzterTakt = -1e9;
  }

  return {
    gruppe: gruppe,
    abgleichen: abgleichen,
    nachziehen: nachziehen,
    treffer: treffer,
    klick: klick,
    zeigerFuer: zeigerFuer,
    entsorgen: entsorgen,
    get anzahl() { return eintraege.length; },
    get sichtbare() { return sichtbar; }
  };
}


/* --- Die eine Schicht der laufenden Karte -------------------------------
   Drei Stellen brauchen dieselbe Schicht: main.js haengt sie in die Szene und
   zieht sie je Bild nach, pointer.js fragt Klick und Zeiger ab, panels.js
   meldet Aenderungen an. Sie in main.js zu erzeugen und herumzureichen hiesse,
   dass pointer.js aus main.js importiert — und main.js importiert pointer.js.
   Ein Zyklus, und zwar einer der Sorte, die in Runde H schon einmal den
   Modulstart zerlegt hat.

   Deshalb liegt sie hier, wo ohnehin alle drei hinschauen. Traege erzeugt,
   weil `neueSchicht` ein THREE.Group anlegt und dieses Modul auch im Test
   geladen wird, wo niemand eine Szene will. */
var schicht = null;
function holeBeschriftungsschicht() {
  if (!schicht) schicht = neueSchicht();
  return schicht;
}

export {
  holeBeschriftungsschicht,
  // Sicherheit
  zielPruefen, zielUrl, zielOeffnen, ZIEL_ARTEN, anPfadPruefen,
  // Klassen
  KLASSEN, KLASSEN_IDS, klasseVon, prioritaetVon, imMassstab, schriftAngabe, textFuerKlasse,
  // Maße
  zeichenBreite, glyphBreiten, messeBeschriftung, spriteBildhoehe,
  // Kurve
  glyphenAufKurve, glyphenGerade,
  // Kollision
  loeseKollisionen, bildKaesten, HYSTERESE_PX, TAKT_MS,
  // Zeichnen
  zeichneKette, zeichneSignatur, zeichneBeschriftung, beschriftungsBild,
  kurvenBeschriftung, kurvenBild, KURVE_VERSATZ, KURVE_MAX_PX,
  // Szene
  neueSchicht, EINHEIT_JE_PIXEL
};
