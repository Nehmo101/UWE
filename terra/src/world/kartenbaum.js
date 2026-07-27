/* ==========================================================================
   Kartenbaum (I1) — eine Karte bekommt Kindkarten.

   Bis hierher kennt Terra genau EINE Karte. Dieses Modul rechnet die
   Hierarchie: Kontinent -> Landschaft -> Stadt. Man zeichnet auf einer Karte
   einen Ausschnitt und oeffnet ihn als eigene, feinere Karte.

   Vier Rechenteile, die nichts voneinander wissen muessen:
     1. Massstab      Weltmeter je Gitterzelle, in beide Richtungen
     2. Baum          Kennung, Elternverweis, Pfad, Pruefungen
     3. Hoehen        das Kindgelaende WIRD AUS DEM ELTERNGELAENDE ABGELEITET
     4. Silhouette    weiche Maske des Ausschnitts auf der Kindkarte
     5. Vererbung     Feld fuer Feld, mit sichtbarer Herkunft

   Warum ein eigenes Modul und keine Erweiterung von terrain.js oder io.js:
   beide haengen an THREE, am DOM und am globalen Zustand — dort ist nichts
   einzeln pruefbar. Alles hier ist reine Rechnung auf typisierten Arrays.
   Hoehenfelder kommen als ARGUMENT herein, nie als Import.

   Modulgraph (bewusst flach, gleiche Begruendung wie im Kopf von
   world/biomfeld.js): erlaubt sind core/rng.js und core/store.js. NICHT
   importiert werden terrain.js, dirty.js, io.js, panels.js — io.js und
   panels.js werden dieses Modul importieren, jeder Rueckimport waere ein
   Zyklus. rng.js importiert nichts, store.js nur 'three'; der Graph bleibt
   damit azyklisch.

   Determinismus: kein Math.random. Aller Zufall kommt aus hashi/vnoise mit
   Seed und ORTSFESTER Koordinate. Gleiche Eingaben ergeben bitgleiche
   Ergebnisse — das ist die Bedingung dafuer, dass eine Kindkarte nach dem
   Laden dasselbe Gelaende zeigt wie vor dem Speichern, obwohl in der Datei
   nur die Handarbeit steht.
   ========================================================================== */
import { clamp, sstep, hashi, vnoise } from '../core/rng.js';
import { KARTEN_GROESSEN } from '../core/store.js';

export const FORMAT_VERSION = 5;

/* ==========================================================================
   1. Massstab — eine Zahl, kein Levelname

   `einheitMeter` = Weltmeter je Gitterzelle. Eine Karte mit 8 m/Zelle soll
   nicht in eine Schublade gezwungen werden; die vier Namen unten sind
   Ankerpunkte fuer die Bedienung, keine Faelle im Code (Quelle:
   docs/engineering/terra-signaturenkatalog.md, "Die Massstabsleiter").
   ========================================================================== */

/* Warum 1 und nicht 25: der gesamte Bestand ist auf ungefaehr ein Meter je
   Welteinheit gebaut — ein `haus` hat Radius 2.9, der Rankenradius VINE_R ist
   6, eine Person waere knapp 2 hoch. Jede Datei aus den Fassungen v1..v4 ist
   damit eine ORTSKARTE, und die Vorgabe `sichtbarAb: 0 / sichtbarBis: 60` der
   Signaturen trifft den Bestand ohne eine einzige Aenderung. */
export const EINHEIT_STANDARD = 1;

export const MASSSTAB_LEITER = [
  { name: 'ort',        ab: 0.5, bis: 4 },
  { name: 'landschaft', ab: 4,   bis: 60 },
  { name: 'region',     ab: 60,  bis: 600 },
  { name: 'kontinent',  ab: 600, bis: 4000 }
];

function einheitGeputzt(m) {
  return (typeof m === 'number' && isFinite(m) && m > 0) ? m : EINHEIT_STANDARD;
}

/**
 * Benennt einen Massstab. Unterhalb der Leiter gilt der unterste, oberhalb
 * der oberste Name — ein Nutzer, der 0.1 m/Zelle einstellt, bekommt eine
 * Ortskarte und keine Fehlermeldung.
 */
export function massstabName(einheitMeter) {
  var m = einheitGeputzt(einheitMeter);
  for (var i = 0; i < MASSSTAB_LEITER.length; i++) {
    if (m < MASSSTAB_LEITER[i].bis) return MASSSTAB_LEITER[i].name;
  }
  return MASSSTAB_LEITER[MASSSTAB_LEITER.length - 1].name;
}

/**
 * Name samt Lage IM Band. `t` ist die Position zwischen `ab` und `bis`,
 * LOGARITHMISCH gemessen — Massstaebe sind Groessenordnungen, und zwischen
 * 60 und 600 liegt die Mitte bei 190, nicht bei 330. Die Bedienung kann
 * daraus einen Regler oder eine Ueberblendung bauen.
 */
export function massstabInfo(einheitMeter) {
  var m = einheitGeputzt(einheitMeter);
  var name = massstabName(m), band = null;
  for (var i = 0; i < MASSSTAB_LEITER.length; i++) {
    if (MASSSTAB_LEITER[i].name === name) { band = MASSSTAB_LEITER[i]; break; }
  }
  var t = clamp(Math.log(m / band.ab) / Math.log(band.bis / band.ab), 0, 1);
  return { name: name, ab: band.ab, bis: band.bis, t: t, einheitMeter: m };
}

/** Kantenlaenge einer Karte in Metern. */
export function kanteInMetern(kartenGroesse, einheitMeter) {
  return (kartenGroesse | 0) * einheitGeputzt(einheitMeter);
}

/** Umkehrung: welcher Massstab ergibt eine Karte dieser Kantenlaenge? */
export function einheitFuerKante(kartenGroesse, kanteMeter) {
  var n = kartenGroesse | 0;
  if (n <= 0 || !isFinite(kanteMeter) || kanteMeter <= 0) return EINHEIT_STANDARD;
  return kanteMeter / n;
}

/** Welteinheiten -> Meter. */
export function weltZuMeter(welt, einheitMeter) { return welt * einheitGeputzt(einheitMeter); }
/** Meter -> Welteinheiten. */
export function meterZuWelt(meter, einheitMeter) { return meter / einheitGeputzt(einheitMeter); }

/* ==========================================================================
   2. Vererbung — Felderliste zuerst, weil der Baum sie beim Lesen braucht
   ========================================================================== */

/* Was ein Kind vom Elternteil erbt. Jedes Feld EINZELN ueberschreibbar; die
   Ueberschreibung liegt in `karte.eigen`, und allein die ANWESENHEIT des
   Schluessels entscheidet. Deshalb hasOwnProperty und nicht `!== undefined`:
   `farbskript: null` heisst "diese Karte hat bewusst kein Farbskript" und ist
   etwas anderes als "diese Karte erbt das Farbskript". */
export const ERBFELDER = ['biom', 'tageszeit', 'wetter', 'farbskript',
  'palette', 'stil', 'klima', 'sprachfamilie'];

/* Was NICHT vererbt wird. Kartengroesse und Massstab definieren das Kind,
   Elemente und Marker gehoeren genau einer Karte (siehe elternVorlage weiter
   unten), Seed und Hoehendaten sind ohnehin kartengebunden. Der Guard in
   setzeEigen faengt den Tippfehler ab, bevor er als stiller Zusatzschluessel
   in der Datei landet. */
export const NICHT_ERBFELDER = ['kartenGroesse', 'einheitMeter', 'elemente',
  'marker', 'seed', 'hoehenDelta', 'ausschnitt', 'rahmen'];

/* Vorgaben, wenn kein Vorfahr das Feld setzt. Sie decken sich mit den
   Vorgaben in editor/io.js (validiereKarte) — zwei Wahrheiten waeren eine
   Fehlerquelle, und io.js liest diese Liste kuenftig hier. */
export const ERB_STANDARD = {
  biom: 'wiese',
  tageszeit: 'mittag',
  wetter: 'klar',
  farbskript: null,
  palette: null,
  stil: null,
  klima: { richtung: 0, staerke: 0.5, grund: 0.5, hoeheKuehl: 0.012 },
  sprachfamilie: 'auto'
};

var _erbSatz = (function () {
  var m = Object.create(null);
  for (var i = 0; i < ERBFELDER.length; i++) m[ERBFELDER[i]] = 1;
  return m;
})();

function hatEigen(karte, feld) {
  return !!(karte && karte.eigen && Object.prototype.hasOwnProperty.call(karte.eigen, feld));
}

/* ==========================================================================
   3. Der Kartenbaum

   Ein Knoten ist { id, karte, elternId, kinder, tiefe, verwaist }. Der KNOTEN
   ist die Wahrheit ueber die Struktur, nicht `karte.elternId`: baueKartenbaum
   repariert kaputte Verweise, und der Eingabesatz bleibt dabei unangetastet
   (reine Funktion). Wer den reparierten Stand behalten will, schreibt ihn mit
   schreibeBaumDatei fest — dort wird `knoten.elternId` geschrieben.

   ENTSCHEIDUNG: verwaiste Karten scheitern NICHT.
   Eine Karte, deren Elternverweis ins Leere zeigt, wird als Kind der Wurzel
   eingehaengt, mit `verwaist: true` markiert, ihr `ausschnitt` verliert seine
   Bedeutung (er ist in Koordinaten einer Karte formuliert, die es nicht mehr
   gibt) und ihre Hoehenquelle faellt auf "eigen". Begruendung: der
   Elternverweis ist ein VERWEIS, kein Inhalt. Sein Verlust kostet die
   Einordnung, nicht die Arbeit — Elemente, Marker, Hoehen der Kindkarte sind
   vollstaendig da. Eine Datei komplett abzulehnen, weil ein Verweis fehlt,
   waere der teuerste denkbare Umgang mit dem billigsten denkbaren Schaden.

   Was dagegen ATOMAR scheitert: doppelte Kennungen, ein Zyklus, ein Kind
   groeber als sein Elternteil. Das sind WIDERSPRUECHE, keine Luecken — sie
   liessen sich nur durch Raten aufloesen, und geraten wuerde hier eine andere
   Welt als die gespeicherte.
   ========================================================================== */

function fehler(text) { throw new Error(text); }

function istKennung(v) { return typeof v === 'string' && v.length > 0; }

/**
 * Baut den Baum aus einer flachen Kartenliste.
 *
 * @param karten [{ id, elternId, einheitMeter, ... }]
 * @param opt    { wurzelId }
 * @returns { wurzelId, karten, index, ordnung, warnungen }
 *          `index`   id -> Knoten (prototypenfreies Objekt)
 *          `ordnung` Tiefensuche ab der Wurzel, Kinder in Eingabereihenfolge
 */
export function baueKartenbaum(karten, opt) {
  opt = opt || {};
  if (!Array.isArray(karten) || !karten.length) fehler('Kartenbaum ohne Karten');
  var index = Object.create(null), i, k, warnungen = [];
  for (i = 0; i < karten.length; i++) {
    k = karten[i];
    if (!k || typeof k !== 'object' || Array.isArray(k)) fehler('Karte ' + i + ': kein Objekt');
    if (!istKennung(k.id)) fehler('Karte ' + i + ': id fehlt');
    if (index[k.id]) fehler('Karte ' + i + ': Kennung „' + k.id + '“ doppelt vergeben');
    index[k.id] = {
      id: k.id, karte: k,
      elternId: istKennung(k.elternId) ? k.elternId : null,
      kinder: [], tiefe: 0, verwaist: false
    };
  }

  // --- Wurzel bestimmen ---------------------------------------------------
  var wurzelId = null;
  if (istKennung(opt.wurzelId) && index[opt.wurzelId]) wurzelId = opt.wurzelId;
  if (wurzelId === null) {
    for (i = 0; i < karten.length; i++) if (index[karten[i].id].elternId === null) { wurzelId = karten[i].id; break; }
  }
  if (wurzelId === null) {
    // Kein Knoten ohne Elternteil: entweder zeigt einer ins Leere (dann ist er
    // die naheliegende Wurzel) oder jeder Verweis loest auf — und ein endlicher
    // Graph, in dem jeder Knoten einen Vorgaenger hat, ENTHAELT einen Zyklus.
    for (i = 0; i < karten.length; i++) {
      var e = index[karten[i].id].elternId;
      if (e !== null && !index[e]) { wurzelId = karten[i].id; break; }
    }
    if (wurzelId === null) fehler('Kartenbaum ohne Wurzel — die Elternverweise bilden einen Zyklus');
  }
  var wurzel = index[wurzelId];
  if (wurzel.elternId !== null) {
    warnungen.push({ art: 'wurzel-geloest', id: wurzelId,
      text: 'Karte „' + wurzelId + '“ ist Wurzel und hat ihren Elternverweis verloren' });
    wurzel.elternId = null;
  }

  // --- Reparatur: verwaiste und zweite Wurzeln unter die Wurzel ------------
  for (i = 0; i < karten.length; i++) {
    var n = index[karten[i].id];
    if (n === wurzel) continue;
    if (n.elternId === null) {
      n.elternId = wurzelId;
      warnungen.push({ art: 'zweite-wurzel', id: n.id,
        text: 'Karte „' + n.id + '“ hatte keinen Elternverweis und haengt jetzt an der Wurzel' });
      n.verwaist = true;
    } else if (!index[n.elternId]) {
      warnungen.push({ art: 'verwaist', id: n.id, elternId: n.elternId,
        text: 'Karte „' + n.id + '“ verweist auf die unbekannte Elternkarte „' + n.elternId + '“' });
      n.elternId = wurzelId;
      n.verwaist = true;
    }
  }

  // --- Zyklen ------------------------------------------------------------
  /* O(n) statt O(n^2): jeder Knoten wird genau einmal auf den Weg gelegt.
     zustand 1 = liegt auf dem gerade verfolgten Weg, 2 = nachweislich zyklenfrei. */
  var zustand = Object.create(null);
  for (i = 0; i < karten.length; i++) {
    var start = karten[i].id;
    if (zustand[start]) continue;
    var pfad = [], cur = start;
    while (cur !== null && !zustand[cur]) { zustand[cur] = 1; pfad.push(cur); cur = index[cur].elternId; }
    if (cur !== null && zustand[cur] === 1) {
      fehler('Zyklus im Kartenbaum: „' + pfad.join('“ → „') + '“ → „' + cur + '“');
    }
    for (var p = 0; p < pfad.length; p++) zustand[pfad[p]] = 2;
  }

  // --- Kinder, Tiefe, Reihenfolge -----------------------------------------
  for (i = 0; i < karten.length; i++) {
    var kn = index[karten[i].id];
    if (kn.elternId !== null) index[kn.elternId].kinder.push(kn.id);
  }
  var ordnung = [], stapel = [wurzelId];
  wurzel.tiefe = 0;
  while (stapel.length) {
    var id = stapel.pop();
    ordnung.push(id);
    var kinder = index[id].kinder;
    for (var c = kinder.length - 1; c >= 0; c--) {
      index[kinder[c]].tiefe = index[id].tiefe + 1;
      stapel.push(kinder[c]);
    }
  }
  if (ordnung.length !== karten.length) {
    // Kann nach der Zyklenpruefung nicht mehr eintreten; bleibt als Netz
    // stehen, weil ein halb aufgebauter Baum schlimmer waere als ein Abbruch.
    fehler('Kartenbaum unvollstaendig: ' + ordnung.length + ' von ' + karten.length + ' Karten erreichbar');
  }

  // --- Massstabsordnung ---------------------------------------------------
  /* Ein Kind darf nie GROEBER sein als sein Elternteil: die Ableitung holt
     Feinheit aus dem Elterngelaende heraus, sie kann keine hinzuerfinden, die
     dort schon fehlt. Gleich fein ist erlaubt (ein Beiblatt desselben
     Massstabs). Verwaiste Karten sind ausgenommen — ihr Elternteil ist die
     Wurzel nur ersatzweise, ein Massstabsvergleich waere dort sinnlos. */
  for (i = 0; i < karten.length; i++) {
    var kk = index[karten[i].id];
    if (kk.elternId === null || kk.verwaist) continue;
    var me = einheitGeputzt(kk.karte.einheitMeter);
    var pe = einheitGeputzt(index[kk.elternId].karte.einheitMeter);
    if (me > pe * (1 + 1e-9)) {
      fehler('Karte „' + kk.id + '“ ist mit ' + me + ' m/Zelle groeber als ihre Elternkarte „'
        + kk.elternId + '“ mit ' + pe + ' m/Zelle');
    }
  }

  return { wurzelId: wurzelId, karten: karten.slice(), index: index,
    ordnung: ordnung, warnungen: warnungen };
}

/** Knoten zu einer Kennung oder null. */
export function knoten(baum, id) { return baum.index[id] || null; }

/** Karte zu einer Kennung oder null. */
export function karteVon(baum, id) { var n = baum.index[id]; return n ? n.karte : null; }

/** Kennungen der Kindkarten, in Eingabereihenfolge. */
export function kinderVon(baum, id) {
  var n = baum.index[id];
  return n ? n.kinder.slice() : [];
}

/**
 * Brotkrume: Kennungen von der Wurzel bis zu `id` einschliesslich.
 * Leer, wenn die Kennung unbekannt ist.
 */
export function pfadZurWurzel(baum, id) {
  var n = baum.index[id];
  if (!n) return [];
  var pfad = [];
  while (n) { pfad.push(n.id); n = n.elternId === null ? null : baum.index[n.elternId]; }
  pfad.reverse();
  return pfad;
}

/** Alle Nachfahren von `id` in Tiefensuchreihenfolge (ohne `id` selbst). */
export function nachfahren(baum, id) {
  var n = baum.index[id];
  if (!n) return [];
  var raus = [], stapel = n.kinder.slice().reverse();
  while (stapel.length) {
    var k = stapel.pop();
    raus.push(k);
    var kk = baum.index[k].kinder;
    for (var i = kk.length - 1; i >= 0; i--) stapel.push(kk[i]);
  }
  return raus;
}

/** Ist `a` ein Vorfahr von `b`? (Eine Karte ist NICHT ihr eigener Vorfahr.) */
export function istVorfahr(baum, a, b) {
  var n = baum.index[b];
  if (!n || !baum.index[a]) return false;
  n = n.elternId === null ? null : baum.index[n.elternId];
  while (n) {
    if (n.id === a) return true;
    n = n.elternId === null ? null : baum.index[n.elternId];
  }
  return false;
}

/**
 * Darf `id` unter `neuerElternId` haengen? Wirft mit Begruendung, sonst true.
 * Die Pruefung, die weh tut, wenn sie fehlt: ohne sie macht ein Ziehen im
 * Kartenbaum eine Karte zu ihrem eigenen Vorfahr, und der naechste Ladevorgang
 * findet keine Wurzel mehr.
 */
export function pruefeElternWechsel(baum, id, neuerElternId) {
  var n = baum.index[id];
  if (!n) fehler('Unbekannte Karte „' + id + '“');
  if (neuerElternId === null) {
    if (id !== baum.wurzelId) fehler('Nur die Wurzel darf ohne Elternkarte stehen');
    return true;
  }
  var e = baum.index[neuerElternId];
  if (!e) fehler('Unbekannte Elternkarte „' + neuerElternId + '“');
  if (id === neuerElternId) fehler('Eine Karte kann nicht ihr eigenes Elternteil sein');
  if (istVorfahr(baum, id, neuerElternId))
    fehler('„' + neuerElternId + '“ liegt unter „' + id + '“ — das ergaebe einen Zyklus');
  var me = einheitGeputzt(n.karte.einheitMeter), pe = einheitGeputzt(e.karte.einheitMeter);
  if (me > pe * (1 + 1e-9))
    fehler('„' + id + '“ waere mit ' + me + ' m/Zelle groeber als „' + neuerElternId + '“ mit ' + pe + ' m/Zelle');
  return true;
}

/** Baum mit einer zusaetzlichen Karte — der alte bleibt unangetastet. */
export function mitKarte(baum, karte) {
  return baueKartenbaum(baum.karten.concat([karte]), { wurzelId: baum.wurzelId });
}

/**
 * Baum ohne `id` und ohne deren Nachfahren. Die Wurzel laesst sich nicht
 * entfernen — eine Datei ohne Wurzelkarte gibt es nicht.
 */
export function ohneKarte(baum, id) {
  if (id === baum.wurzelId) fehler('Die Wurzelkarte kann nicht entfernt werden');
  var weg = Object.create(null);
  weg[id] = 1;
  var kinder = nachfahren(baum, id);
  for (var i = 0; i < kinder.length; i++) weg[kinder[i]] = 1;
  var rest = baum.karten.filter(function (k) { return !weg[k.id]; });
  return baueKartenbaum(rest, { wurzelId: baum.wurzelId });
}

/* ==========================================================================
   4. Ausschnitt und Rahmen

   Der `ausschnitt` ist ein beliebiges Polygon in ELTERNKOORDINATEN. Der
   `rahmen` ist das achsenparallele Quadrat, das die Kindkarte tatsaechlich
   abdeckt — {x0, z0, seite} in Elternkoordinaten.

   Warum BEIDE gespeichert werden: das Polygon ist die Silhouette und darf
   nachtraeglich bearbeitet werden. Wuerde der Rahmen jedesmal neu aus dem
   Polygon gerechnet, verschoebe das Verziehen einer einzigen Ecke das
   komplette Kindgelaende. Der Rahmen ist die REGISTRIERUNG, das Polygon die
   Form; sie werden getrennt gehalten, weil sie getrennt gebraucht werden.

   ENTSCHEIDUNG: der Zoom ist immer eine ZWEIERPOTENZ.
   Damit ist das Kindgitter ein Verfeinerungsgitter des Elterngitters — jeder
   Elternknoten liegt exakt auf einem Kindknoten. Das ist die Eigenschaft, auf
   der die Hoehenzusage steht: an einem gemeinsamen Punkt ist die Interpolation
   nicht ungefaehr, sondern exakt der Elternwert. Ausserdem sind
   `seite = kartenGroesse / zoom` und alle Abtastpositionen dyadische Brueche
   und damit in Gleitkomma EXAKT — die Ortsfestigkeit des Details laesst sich
   deshalb bitgenau pruefen statt nur mit einer Toleranz.
   ========================================================================== */

function polyBBox(pts) {
  var x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    if (p.x < x0) x0 = p.x; if (p.x > x1) x1 = p.x;
    if (p.z < z0) z0 = p.z; if (p.z > z1) z1 = p.z;
  }
  return { x0: x0, x1: x1, z0: z0, z1: z1 };
}

function pruefePolygon(pts, wo) {
  if (!Array.isArray(pts) || pts.length < 3) fehler(wo + ': mindestens drei Punkte noetig');
  for (var i = 0; i < pts.length; i++) {
    var p = pts[i];
    if (!p || !isFinite(p.x) || !isFinite(p.z)) fehler(wo + ': Punkt ' + i + ' ungueltig');
  }
}

/**
 * Rahmen zu einem Ausschnittspolygon.
 *
 * @param polygon [{x,z}] in Elternkoordinaten
 * @param opt { kartenGroesse (Kind), elternGroesse, rand, zoom }
 * @returns { x0, z0, seite, zoom }
 */
export function ausschnittRahmen(polygon, opt) {
  opt = opt || {};
  pruefePolygon(polygon, 'Ausschnitt');
  var kg = (opt.kartenGroesse | 0) || 512;
  var eg = (opt.elternGroesse | 0) || kg;
  var rand = isFinite(opt.rand) ? opt.rand : 2;
  var bb = polyBBox(polygon);
  var roh = Math.max(bb.x1 - bb.x0, bb.z1 - bb.z0) + 2 * rand;
  if (!(roh > 0)) roh = 1;
  var zoom;
  if (isFinite(opt.zoom) && opt.zoom >= 1) {
    zoom = Math.pow(2, Math.round(Math.log(opt.zoom) / Math.LN2));
  } else {
    // Groesster Zweierpotenz-Zoom, dessen Seite das Polygon noch fasst.
    zoom = Math.pow(2, Math.max(0, Math.floor(Math.log(kg / roh) / Math.LN2)));
  }
  var seite = kg / zoom;
  // Rahmen mittig ueber das Polygon, Ecke auf ganze Elternzellen gerastert:
  // ein ganzzahliger Ursprung haelt die Kindknoten auf Elternknoten.
  var mx = (bb.x0 + bb.x1) * 0.5, mz = (bb.z0 + bb.z1) * 0.5;
  var x0 = Math.round(mx - seite * 0.5), z0 = Math.round(mz - seite * 0.5);
  // Wo der Rahmen ueber die Elternkarte hinausragt, wird er hineingeschoben —
  // sonst waere ein Teil der Kindkarte aus geklemmten Randwerten interpoliert.
  var halbE = eg * 0.5;
  if (seite <= eg) {
    x0 = clamp(x0, -halbE, halbE - seite);
    z0 = clamp(z0, -halbE, halbE - seite);
  }
  return { x0: x0, z0: z0, seite: seite, zoom: zoom };
}

/** Rahmen einer Kindkarte, tolerant gegen fehlende Felder. */
export function rahmenVon(karte, elternKarte) {
  var r = karte && karte.rahmen;
  if (r && isFinite(r.x0) && isFinite(r.z0) && isFinite(r.seite) && r.seite > 0) {
    return { x0: r.x0, z0: r.z0, seite: r.seite,
      zoom: ((karte.kartenGroesse | 0) || 256) / r.seite };
  }
  if (karte && Array.isArray(karte.ausschnitt) && karte.ausschnitt.length >= 3) {
    return ausschnittRahmen(karte.ausschnitt, {
      kartenGroesse: (karte.kartenGroesse | 0) || 512,
      elternGroesse: (elternKarte && (elternKarte.kartenGroesse | 0)) || 256
    });
  }
  return null;
}

/**
 * Legt eine Kindkarte aus einem Polygon auf der Elternkarte an. Reine
 * Funktion: liefert den Karteneintrag, haengt ihn NICHT in den Baum (das tut
 * mitKarte, und der Aufrufer entscheidet, wann).
 *
 * @param opt { id, titel, kartenGroesse, zoom, rand, seed }
 */
export function legeKindkarteAn(baum, elternId, polygon, opt) {
  opt = opt || {};
  var e = baum.index[elternId];
  if (!e) fehler('Unbekannte Elternkarte „' + elternId + '“');
  pruefePolygon(polygon, 'Ausschnitt');
  var eg = (e.karte.kartenGroesse | 0) || 256;
  var kg = (opt.kartenGroesse | 0) || eg;
  if (KARTEN_GROESSEN.indexOf(kg) < 0) fehler('Unbekannte Kartengroesse ' + kg);
  var rahmen = ausschnittRahmen(polygon, {
    kartenGroesse: kg, elternGroesse: eg,
    rand: opt.rand, zoom: opt.zoom
  });
  if (rahmen.zoom < 1)
    fehler('Der Ausschnitt ist zu gross — die Kindkarte waere groeber als die Elternkarte');
  var einheit = einheitGeputzt(e.karte.einheitMeter) / rahmen.zoom;
  var id = istKennung(opt.id) ? opt.id : naechsteKennung(baum);
  if (baum.index[id]) fehler('Kennung „' + id + '“ ist bereits vergeben');
  /* Seed ORTSABHAENGIG aus Elternseed und Rahmen: zwei Ausschnitte derselben
     Elternkarte an verschiedenen Stellen bekommen verschiedene Seeds, und
     derselbe Ausschnitt bekommt bei jedem Anlegen denselben. Ein Zaehler waere
     hier der naheliegende Fehler — er haengt an der Reihenfolge der
     Bedienung, und die steht in keiner Datei. */
  var seed = isFinite(opt.seed) ? (opt.seed | 0)
    : (Math.floor(hashi(rahmen.x0 | 0, rahmen.z0 | 0, ((e.karte.seed | 0) ^ (rahmen.seite | 0)) | 0) * 0x7fffffff) | 0);
  var punkte = [];
  for (var i = 0; i < polygon.length; i++) punkte.push({ x: polygon[i].x, z: polygon[i].z });
  return {
    id: id,
    elternId: elternId,
    titel: typeof opt.titel === 'string' && opt.titel ? opt.titel : 'Ausschnitt',
    einheitMeter: einheit,
    kartenGroesse: kg,
    seed: seed,
    ausschnitt: punkte,
    rahmen: { x0: rahmen.x0, z0: rahmen.z0, seite: rahmen.seite },
    hoehenQuelle: 'abgeleitet',
    hoehenDelta: [],
    elemente: [],
    marker: [],
    eigen: {}
  };
}

/** Naechste freie Kennung der Form k0, k1, … — deterministisch, kein Zaehler im Zustand. */
export function naechsteKennung(baum, praefix) {
  praefix = praefix || 'k';
  var n = 0;
  for (var id in baum.index) {
    if (id.indexOf(praefix) !== 0) continue;
    var rest = id.slice(praefix.length);
    if (/^\d+$/.test(rest)) { var v = parseInt(rest, 10) + 1; if (v > n) n = v; }
  }
  while (baum.index[praefix + n]) n++;
  return praefix + n;
}

/* ==========================================================================
   5. Der Kern — abgeleitete Hoehen statt neu gewuerfelter

   Eine Kindkarte darf ihr Gelaende nicht neu wuerfeln. Sonst passt es nicht zu
   dem, was auf der Elternkarte an dieser Stelle zu sehen war, und die
   Hierarchie ist eine Luege. Das Kindgelaende entsteht deshalb aus dem
   Elterngelaende:

       kind(x,z) = grobform(elternHoehen, x, z)      Ausschnitt, hochgerechnet
                 + detail(x, z, seed)                Feinheit unter der
                                                     Elternaufloesung

   GROBFORM: Catmull-Rom, nicht bilinear.
   Bilineare Interpolation ist C0 — ihre zweite Ableitung ist ein Deltakamm auf
   den Stuetzstellen. Im Bild sind das genau die Terrassen und Rautenmuster,
   nach denen man eine hochskalierte Karte sofort erkennt: die Flaechen sind
   flach, die Knicke liegen auf einem Raster, und das Raster ist das Gitter der
   Elternkarte. Catmull-Rom ist C1, seine Kruemmung ist stetig, und es bleibt
   INTERPOLIEREND: bei t = 0 liefert die Basis exakt [0,1,0,0], der Elternwert
   kommt also unveraendert heraus. Das ist die Bedingung fuer die Hoehenzusage.
   Der Preis sind 16 statt 4 Stuetzstellen je Punkt.

   DETAIL: ortsfest, weil es an der ELTERNKOORDINATE haengt.
   Das Rauschen wird an (px, pz) ausgewertet — der Position im
   Elternkoordinatensystem —, nicht am Kindgitterindex. Verschiebt man den
   Ausschnitt um eine Zelle, liegt dieselbe Weltposition auf einem anderen
   Kindindex, bekommt aber denselben Rauschwert: das Detail wandert mit. Das
   ist die Eigenschaft, die naive Umsetzungen verfehlen (sie wuerfeln ueber
   i/j), und sie ist bitgenau pruefbar, weil der Zoom eine Zweierpotenz ist.

   AMPLITUDE: aus der oertlichen Rauheit des ELTERNFELDES.
   Eine feste Amplitude liesse auf der Ebene Huegel wachsen und auf der Wand
   nichts erkennen. Deshalb wird je Elternknoten der Betrag des Hoehengefaelles
   gemessen, einmal geglaettet und beim Abtasten bilinear gelesen. Weil dieses
   Feld ebenfalls an der Elternkoordinate haengt, bleibt die Ortsfestigkeit
   erhalten — eine Amplitude aus einer Kennzahl DES AUSSCHNITTS (etwa dessen
   Rauheits-Mittelwert) haette sie zerstoert, weil ein verschobener Ausschnitt
   eine andere Kennzahl hat.

   DECKEL: |detail| <= DETAIL_DECKEL, hart.
   Damit ist die Hoehenzusage eine ZAHL und keine Erzaehlung: ein Punkt, den
   beide Karten zeigen, weicht um hoechstens DETAIL_DECKEL Welteinheiten ab.
   Auf einer Wand kostet das Feinheit — dort dominiert ohnehin die Grobform.

   HOEHENMASSSTAB: Hoehen wandern 1:1, sie werden NICHT mitskaliert.
   Das ist eine bewusste Entscheidung und ein bekannter Bruch mit der Metrik:
   waeren Hoehen echte Meter, muesste ein Kind mit Zoom 8 seine Hoehen
   verachtfachen, um dieselbe Landschaft zu zeigen. Terra haengt aber jede
   Farbschwelle, den Wasserspiegel (WATER = 0), die Schneegrenze und die
   Hangdeckel an ABSOLUTE Welthoehen; eine Skalierung schoebe eine Kindkarte
   geschlossen ueber die Schneegrenze. Die Ueberhoehung waechst dadurch mit dem
   Zoom — genau das tut jede handgezeichnete Karte auch. Wer es anders will,
   setzt `hoehenFaktor`; die Vorgabe 1 heisst "der Ausschnitt sieht auf dem
   Kind aus wie auf dem Elternteil, nur groesser und feiner".
   ========================================================================== */

export const DETAIL_STAERKE = 0.35;      // Anteil des oertlichen Gefaelles
export const DETAIL_PERSISTENZ = 0.5;    // Amplitudenabfall je Oktave
export const DETAIL_SOCKEL = 0.05;       // damit auch die Ebene nicht spiegelt
export const DETAIL_DECKEL = 0.75;       // harte Schranke in Welteinheiten

/* Grundfrequenz der ersten Detailoktave, in Schwingungen je ELTERNzelle.
   Bewusst KEINE 1, obwohl eine Wellenlaenge von genau einer Elternzelle die
   naheliegende Wahl waere: `vnoise` ist an seinen eigenen Gitterpunkten nur
   C1: die zweite Ableitung des Smoothstep springt dort. Bei Frequenz 1 laege
   dieses Gitter exakt auf dem Elterngitter, und die Kruemmungsspruenge
   zeichneten genau das Rautenmuster nach, das die kubische Interpolation
   gerade vermieden hat. Gemessen: das Kruemmungsverhaeltnis auf den
   Elternknotenlinien fiel dadurch von 1.55 auf 1.05.
   0.7 = 7/10 ist mit keiner Zweierpotenz multipliziert ganzzahlig, keine
   Oktave rastet also je wieder auf dem Elterngitter ein. */
var DETAIL_BASISFREQUENZ = 0.7;
/** Die zugesagte Hoehengleichheit: gemeinsamer Punkt, hoechstens diese Abweichung. */
export const HOEHEN_TOLERANZ = DETAIL_DECKEL;

/* Seedversatz des Details. Bewusst weit weg von den Versaetzen, die
   genBaseIn benutzt (seed, +77, +211, +311, dazu fractal-intern +1013 je
   Oktave): das Detail einer Kindkarte darf mit der Grundform ihrer
   Elternkarte nicht korrelieren, sonst legt sich das Feinrelief sichtbar in
   die Taeler der Grobform. */
var DETAIL_SEED = 5077, DETAIL_SCHRITT = 2657;

/** Catmull-Rom; bei t = 0 exakt p1 — darauf steht die Hoehenzusage. */
function cr(p0, p1, p2, p3, t) {
  var t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (p2 - p0) * t
    + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
    + (3 * p1 - 3 * p2 + p3 - p0) * t3);
}

function klemme(v, hoch) { return v < 0 ? 0 : (v > hoch ? hoch : v); }

/** Bikubische Abfrage im Elterngitter; Indizes klemmen am Kartenrand. */
function kubischAn(h, VW, gi, gj) {
  var i1 = Math.floor(gi), j1 = Math.floor(gj);
  var fx = gi - i1, fz = gj - j1;
  var im1 = klemme(i1 - 1, VW - 1), i0 = klemme(i1, VW - 1),
      ip1 = klemme(i1 + 1, VW - 1), ip2 = klemme(i1 + 2, VW - 1);
  var jm1 = klemme(j1 - 1, VW - 1) * VW, j0 = klemme(j1, VW - 1) * VW,
      jp1 = klemme(j1 + 1, VW - 1) * VW, jp2 = klemme(j1 + 2, VW - 1) * VW;
  var a = cr(h[jm1 + im1], h[jm1 + i0], h[jm1 + ip1], h[jm1 + ip2], fx);
  var b = cr(h[j0 + im1], h[j0 + i0], h[j0 + ip1], h[j0 + ip2], fx);
  var c = cr(h[jp1 + im1], h[jp1 + i0], h[jp1 + ip1], h[jp1 + ip2], fx);
  var d = cr(h[jp2 + im1], h[jp2 + i0], h[jp2 + ip1], h[jp2 + ip2], fx);
  return cr(a, b, c, d, fz);
}

/** Bilineare Abfrage im Elterngitter — Vergleichsweg und Sparvariante. */
function bilinearAn(h, VW, gi, gj) {
  var i1 = Math.floor(gi), j1 = Math.floor(gj);
  var fx = gi - i1, fz = gj - j1;
  var i0 = klemme(i1, VW - 1), ip1 = klemme(i1 + 1, VW - 1);
  var j0 = klemme(j1, VW - 1) * VW, jp1 = klemme(j1 + 1, VW - 1) * VW;
  var ab = h[j0 + i0] + (h[j0 + ip1] - h[j0 + i0]) * fx;
  var cd = h[jp1 + i0] + (h[jp1 + ip1] - h[jp1 + i0]) * fx;
  return ab + (cd - ab) * fz;
}

/**
 * Hoehe der ELTERNKARTE an einer Elternkoordinate (x, z). Dieselbe Rechnung,
 * die die Ableitung benutzt — der Vergleichspunkt der Hoehenzusage kommt
 * deshalb aus genau dieser Funktion und nicht aus einer zweiten Formel.
 */
export function hoeheAusEltern(elternHoehen, elternVW, elternMAP, x, z, art) {
  var halb = elternMAP * 0.5;
  var gi = clamp(x + halb, 0, elternVW - 1), gj = clamp(z + halb, 0, elternVW - 1);
  return art === 'bilinear' ? bilinearAn(elternHoehen, elternVW, gi, gj)
                            : kubischAn(elternHoehen, elternVW, gi, gj);
}

/* Rauheitsfeld des Ausschnitts: Betrag des zentralen Gefaelles je Elternknoten,
   einmal 3x3 geglaettet. Die Glaettung ist kein Schoenheitsschritt — ohne sie
   traegt die Amplitude das Gitterrauschen des Elternfeldes, und das Detail
   zeichnet das Elterngitter nach. Der Streifen wird nur ueber dem gebrauchten
   Bereich gerechnet (plus Rand), nicht ueber die ganze Elternkarte. */
function rauheitsFeld(h, VW, i0, j0, w, hh) {
  var roh = new Float32Array(w * hh), aus = new Float32Array(w * hh), i, j;
  for (j = 0; j < hh; j++) {
    var gj = klemme(j0 + j, VW - 1);
    var rz = gj * VW, rzm = klemme(gj - 1, VW - 1) * VW, rzp = klemme(gj + 1, VW - 1) * VW;
    for (i = 0; i < w; i++) {
      var gi = klemme(i0 + i, VW - 1);
      var im = klemme(gi - 1, VW - 1), ip = klemme(gi + 1, VW - 1);
      var dx = (h[rz + ip] - h[rz + im]) * 0.5;
      var dz = (h[rzp + gi] - h[rzm + gi]) * 0.5;
      roh[j * w + i] = Math.sqrt(dx * dx + dz * dz);
    }
  }
  for (j = 0; j < hh; j++) {
    for (i = 0; i < w; i++) {
      var s = 0, n = 0;
      for (var b = -1; b <= 1; b++) {
        var jj = j + b; if (jj < 0 || jj >= hh) continue;
        for (var a = -1; a <= 1; a++) {
          var ii = i + a; if (ii < 0 || ii >= w) continue;
          s += roh[jj * w + ii]; n++;
        }
      }
      aus[j * w + i] = s / n;
    }
  }
  return aus;
}

/**
 * Leitet das Hoehenfeld einer Kindkarte aus dem Elternfeld ab.
 *
 * @param elternHoehen Float32Array, mindestens elternVW*elternVW lang
 * @param opt {
 *   elternVW, elternMAP,          Gitter der Elternkarte
 *   rahmen {x0,z0,seite},         Ausschnitt in Elternkoordinaten
 *   VW, MAP,                      Gitter der Kindkarte
 *   seed,                         Seed der Kindkarte (nur fuers Detail)
 *   interpolation 'kubisch'|'bilinear',
 *   detailStaerke, persistenz, detailDeckel, oktaven, hoehenFaktor,
 *   ziel                          Float32Array zum Wiederverwenden
 * }
 * @returns { hoehen, zoom, oktaven, detailMax, detailDeckel, grobMin, grobMax }
 */
export function leiteHoehenAb(elternHoehen, opt) {
  opt = opt || {};
  var eVW = opt.elternVW | 0, eMAP = opt.elternMAP | 0;
  if (eVW < 2 || eMAP < 1) fehler('leiteHoehenAb: Elterngitter fehlt');
  if (!elternHoehen || elternHoehen.length < eVW * eVW)
    fehler('leiteHoehenAb: Elternhoehenfeld zu kurz');
  var VW = opt.VW | 0, MAP = opt.MAP | 0;
  if (VW < 2 || MAP < 1) fehler('leiteHoehenAb: Kindgitter fehlt');
  var r = opt.rahmen;
  if (!r || !isFinite(r.x0) || !isFinite(r.z0) || !isFinite(r.seite) || r.seite <= 0)
    fehler('leiteHoehenAb: Rahmen fehlt oder ist ungueltig');

  var n = VW * VW;
  var ziel = (opt.ziel && opt.ziel.length >= n) ? opt.ziel : new Float32Array(n);
  var seed = opt.seed | 0;
  var kubisch = opt.interpolation !== 'bilinear';
  var faktor = isFinite(opt.hoehenFaktor) ? opt.hoehenFaktor : 1;
  var staerke = isFinite(opt.detailStaerke) ? opt.detailStaerke : DETAIL_STAERKE;
  var pers = isFinite(opt.persistenz) ? opt.persistenz : DETAIL_PERSISTENZ;
  var deckel = isFinite(opt.detailDeckel) ? opt.detailDeckel : DETAIL_DECKEL;

  var schritt = r.seite / MAP;                 // Elterneinheiten je Kindzelle
  var zoom = MAP / r.seite;                    // Kindzellen je Elternzelle
  /* Oktavzahl aus dem Zoom: die feinste sinnvolle Wellenlaenge sind zwei
     KINDzellen, die groebste neue eine ELTERNzelle (alles darueber steht schon
     im Elternfeld). Zwischen beiden liegen ld(zoom) Oktaven. Bei Zoom 1 sind
     es null — ohne Vergroesserung gibt es keine neue Information, und eine
     dazuerfundene waere genau die Luege, die dieses Modul verhindern soll. */
  var okt = isFinite(opt.oktaven) ? (opt.oktaven | 0)
    : Math.max(0, Math.floor(Math.log(zoom) / Math.LN2));
  if (okt > 10) okt = 10;
  if (staerke <= 0) okt = 0;

  // Summe der normierten Oktavamplituden — daraus der harte Deckel je Punkt.
  var summe = 0, amp = 1, o;
  for (o = 0; o < okt; o++) { summe += amp; amp *= pers; }
  var a0Deckel = summe > 0 ? deckel / summe : 0;

  // Rauheitsstreifen ueber dem gebrauchten Elternbereich (plus 2 Rand).
  var halbE = eMAP * 0.5;
  var ri0 = Math.floor(r.x0 + halbE) - 2, rj0 = Math.floor(r.z0 + halbE) - 2;
  var rw = Math.ceil(r.seite) + 5, rh = Math.ceil(r.seite) + 5;
  var rau = okt > 0 ? rauheitsFeld(elternHoehen, eVW, ri0, rj0, rw, rh) : null;

  var grobMin = Infinity, grobMax = -Infinity, detailMax = 0;
  var i, j;
  for (j = 0; j < VW; j++) {
    var pz = r.z0 + j * schritt;
    var gj = clamp(pz + halbE, 0, eVW - 1);
    var zeile = j * VW;
    for (i = 0; i < VW; i++) {
      var px = r.x0 + i * schritt;
      var gi = clamp(px + halbE, 0, eVW - 1);
      var g = kubisch ? kubischAn(elternHoehen, eVW, gi, gj)
                      : bilinearAn(elternHoehen, eVW, gi, gj);
      if (g < grobMin) grobMin = g;
      if (g > grobMax) grobMax = g;
      var d = 0;
      if (okt > 0) {
        // Rauheit bilinear aus dem Streifen — dieselbe Ortsfestigkeit wie das
        // Rauschen selbst, deshalb ueber (gi,gj) und nicht ueber (i,j).
        var lx = clamp(gi - ri0, 0, rw - 1), lz = clamp(gj - rj0, 0, rh - 1);
        var lxi = lx | 0, lzi = lz | 0;
        var lxf = lx - lxi, lzf = lz - lzi;
        var lxp = lxi + 1 < rw ? lxi + 1 : lxi, lzp = lzi + 1 < rh ? lzi + 1 : lzi;
        var q0 = rau[lzi * rw + lxi], q1 = rau[lzi * rw + lxp];
        var q2 = rau[lzp * rw + lxi], q3 = rau[lzp * rw + lxp];
        var qa = q0 + (q1 - q0) * lxf, qb = q2 + (q3 - q2) * lxf;
        var a = staerke * (DETAIL_SOCKEL + qa + (qb - qa) * lzf);
        if (a > a0Deckel) a = a0Deckel;
        var f = DETAIL_BASISFREQUENZ;
        for (o = 0; o < okt; o++) {
          d += (vnoise(px * f, pz * f, (seed + DETAIL_SEED + o * DETAIL_SCHRITT) | 0) - 0.5) * 2 * a;
          a *= pers; f *= 2;
        }
        var ad = d < 0 ? -d : d;
        if (ad > detailMax) detailMax = ad;
      }
      ziel[zeile + i] = g * faktor + d;
    }
  }
  return { hoehen: ziel, zoom: zoom, oktaven: okt, detailMax: detailMax,
    detailDeckel: okt > 0 ? deckel : 0, grobMin: grobMin, grobMax: grobMax };
}

/** Bequemer Weg ueber den Baum: Ableitung fuer die Kindkarte `id`. */
export function leiteKindHoehenAb(baum, id, elternHoehen, opt) {
  var n = baum.index[id];
  if (!n) fehler('Unbekannte Karte „' + id + '“');
  if (n.elternId === null) fehler('Die Wurzelkarte hat keine Elternkarte, aus der abzuleiten waere');
  var e = baum.index[n.elternId];
  var rahmen = rahmenVon(n.karte, e.karte);
  if (!rahmen) fehler('Karte „' + id + '“ hat keinen Ausschnitt');
  var eMAP = (e.karte.kartenGroesse | 0) || 256;
  var MAP = (n.karte.kartenGroesse | 0) || 256;
  var o = {};
  for (var f in (opt || {})) o[f] = opt[f];
  o.elternVW = eMAP + 1; o.elternMAP = eMAP;
  o.VW = MAP + 1; o.MAP = MAP;
  o.rahmen = rahmen;
  if (o.seed === undefined) o.seed = n.karte.seed | 0;
  return leiteHoehenAb(elternHoehen, o);
}

/* ==========================================================================
   6. Handarbeit — „Nachziehen" und „Neu ableiten"

   Die Kindkarte speichert ihre Handarbeit als DIFFERENZ gegen die Ableitung,
   nicht als Absolutwert. Das ist der Unterschied zum `hoehenDelta` der
   Wurzelkarte (editor/io.js speichert dort absolute Hoehen gegen das
   Seed-Terrain) und er ist notwendig:

   Hebt der Nutzer auf der Elternkarte einen Berg an, muss die Kindkarte
   mitkommen. Stuenden dort absolute Hoehen, naegelte jede von Hand
   angefasste Zelle die alte Hoehe fest — die Handarbeit risse Loecher in den
   neuen Berg. Als Differenz gespeichert wandert sie mit: der Graben bleibt ein
   Graben, egal wie hoch der Berg darunter liegt.

     Neu ableiten  hoehen = ableitung,           Delta verworfen
     Nachziehen    hoehen = ableitung + delta,   Delta unveraendert
   ========================================================================== */

/**
 * Handarbeit als flaches Paar-Array [i, d, i, d, …] — `d` ist die DIFFERENZ.
 * Rundung und Schwelle wie berechneHoehenDelta in editor/io.js, damit beide
 * Formate dieselbe Koernung haben.
 */
export function handarbeitErmitteln(hoehen, ableitung, anzahl, schwelle) {
  var s = isFinite(schwelle) ? schwelle : 0.005;
  var delta = [];
  for (var i = 0; i < anzahl; i++) {
    var d = hoehen[i] - ableitung[i];
    if (d > s || d < -s) delta.push(i, Math.round(d * 100) / 100);
  }
  return delta;
}

/** Gegenstueck: Differenzen auf ein Feld addieren. */
export function handarbeitAnwenden(ziel, delta) {
  for (var k = 0; k < delta.length; k += 2) ziel[delta[k]] += delta[k + 1];
}

/**
 * Nachziehen: die neue Elternform uebernehmen, die Handarbeit behalten.
 * `ableitung` wird dabei NICHT veraendert (der Aufrufer haelt sie oft noch
 * als Vergleichsfeld) — geschrieben wird in `ziel` oder eine frische Kopie.
 */
export function hoehenNachziehen(ableitung, delta, ziel) {
  var n = ableitung.length;
  var aus = (ziel && ziel.length >= n) ? ziel : new Float32Array(n);
  if (aus !== ableitung) aus.set(ableitung.subarray ? ableitung.subarray(0, n) : ableitung);
  if (delta && delta.length) handarbeitAnwenden(aus, delta);
  return aus;
}

/** Neu ableiten: Handarbeit verwerfen. Liefert das Feld und das leere Delta. */
export function hoehenNeuAbleiten(ableitung, ziel) {
  var n = ableitung.length;
  var aus = (ziel && ziel.length >= n) ? ziel : new Float32Array(n);
  if (aus !== ableitung) aus.set(ableitung.subarray ? ableitung.subarray(0, n) : ableitung);
  return { hoehen: aus, delta: [] };
}

/* ==========================================================================
   7. Silhouette

   Die Kindkarte ist rechteckig, ihr Ausschnitt auf der Elternkarte ist ein
   beliebiges Polygon. Was ausserhalb liegt, muss erkennbar "nicht Teil dieser
   Karte" sein: die Maske ist 1 im Inneren, 0 weit draussen und geht ueber die
   Breite `weich` (in KINDzellen) ineinander ueber.

   Verfahren: Scanline-Rasterung + Chamfer-Distanztransformation, wortgleich
   zu world/biomfeld.js. Bewusst KOPIERT statt importiert — biomfeld.js
   exportiert die Distanzrechnung nicht, und dieses Modul soll ohne die
   Biomregistry pruefbar bleiben. Der Fehler gegenueber der echten euklidischen
   Distanz liegt unter 4 %; hinter einem weichen Rand ist davon nichts zu sehen.

   Bewusst OHNE die Ausfransung, die biomfeld.js auf seine Biomgrenzen legt:
   eine Biomgrenze soll aussehen, als waere sie gewachsen, eine Kartengrenze
   soll aussehen, als waere sie gezogen. Der Nutzer hat dieses Polygon selbst
   gezeichnet und muss seine Form wiedererkennen.
   ========================================================================== */

var DIAG = 1.4142135623730951;

function chamfer(maske, ziel, w, h, out) {
  var i, j, k, d, gross = w + h + 1;
  for (k = 0; k < w * h; k++) out[k] = maske[k] === ziel ? 0 : gross;
  for (j = 0; j < h; j++) {
    for (i = 0; i < w; i++) {
      k = j * w + i; d = out[k];
      if (d === 0) continue;
      if (i > 0 && out[k - 1] + 1 < d) d = out[k - 1] + 1;
      if (j > 0) {
        if (out[k - w] + 1 < d) d = out[k - w] + 1;
        if (i > 0 && out[k - w - 1] + DIAG < d) d = out[k - w - 1] + DIAG;
        if (i < w - 1 && out[k - w + 1] + DIAG < d) d = out[k - w + 1] + DIAG;
      }
      out[k] = d;
    }
  }
  for (j = h - 1; j >= 0; j--) {
    for (i = w - 1; i >= 0; i--) {
      k = j * w + i; d = out[k];
      if (d === 0) continue;
      if (i < w - 1 && out[k + 1] + 1 < d) d = out[k + 1] + 1;
      if (j < h - 1) {
        if (out[k + w] + 1 < d) d = out[k + w] + 1;
        if (i > 0 && out[k + w - 1] + DIAG < d) d = out[k + w - 1] + DIAG;
        if (i < w - 1 && out[k + w + 1] + DIAG < d) d = out[k + w + 1] + DIAG;
      }
      out[k] = d;
    }
  }
  return out;
}

/** Elternkoordinate -> Kindgitterindex (als Gleitkommazahl). */
export function elternZuKind(rahmen, MAP, x, z) {
  var s = MAP / rahmen.seite;
  return { i: (x - rahmen.x0) * s, j: (z - rahmen.z0) * s };
}

/** Kindgitterindex -> Elternkoordinate. */
export function kindZuEltern(rahmen, MAP, i, j) {
  var s = rahmen.seite / MAP;
  return { x: rahmen.x0 + i * s, z: rahmen.z0 + j * s };
}

/**
 * Silhouettenmaske der Kindkarte.
 *
 * @param polygon [{x,z}] in ELTERNkoordinaten
 * @param rahmen  {x0,z0,seite} in Elternkoordinaten
 * @param VW, MAP Gitter der Kindkarte
 * @param opt { weich (Kindzellen), aus (Float32Array zum Wiederverwenden) }
 * @returns Float32Array, 1 innen, 0 weit aussen
 */
export function silhouetteMaske(polygon, rahmen, VW, MAP, opt) {
  opt = opt || {};
  pruefePolygon(polygon, 'Ausschnitt');
  var n = VW * VW;
  var aus = (opt.aus && opt.aus.length >= n) ? opt.aus : new Float32Array(n);
  var weich = isFinite(opt.weich) && opt.weich > 0 ? opt.weich : Math.max(4, MAP / 32);
  var hw = weich * 0.5;
  var s = MAP / rahmen.seite;
  // Polygon einmal in Kindgitterkoordinaten umrechnen — die Scanline unten
  // laeuft dann in derselben Einheit wie die Distanztransformation.
  var pts = [], i, j;
  for (i = 0; i < polygon.length; i++) {
    pts.push({ x: (polygon[i].x - rahmen.x0) * s, z: (polygon[i].z - rahmen.z0) * s });
  }

  var maske = new Uint8Array(n);
  var m = pts.length, kreuz = new Float64Array(m), e, c;
  for (j = 0; j < VW; j++) {
    c = 0;
    for (e = 0; e < m; e++) {
      var a = pts[e], b = pts[(e + m - 1) % m];
      if ((a.z > j) !== (b.z > j)) kreuz[c++] = (b.x - a.x) * (j - a.z) / (b.z - a.z) + a.x;
    }
    if (c < 2) continue;
    for (e = 1; e < c; e++) {
      var v = kreuz[e], q = e - 1;
      while (q >= 0 && kreuz[q] > v) { kreuz[q + 1] = kreuz[q]; q--; }
      kreuz[q + 1] = v;
    }
    var zeile = j * VW;
    for (e = 0; e + 1 < c; e += 2) {
      var iA = Math.ceil(kreuz[e]), iB = Math.ceil(kreuz[e + 1]) - 1;
      if (iA < 0) iA = 0;
      if (iB > VW - 1) iB = VW - 1;
      for (i = iA; i <= iB; i++) maske[zeile + i] = 1;
    }
  }

  var dIn = new Float32Array(n), dOut = new Float32Array(n);
  chamfer(maske, 0, VW, VW, dIn);     // Abstand zur naechsten Aussenzelle
  chamfer(maske, 1, VW, VW, dOut);    // Abstand zur naechsten Innenzelle
  for (var k = 0; k < n; k++) {
    var d = maske[k] ? dIn[k] : -dOut[k];
    // Die harten Enden bleiben HART: "innen ist 1" und "draussen ist 0" sind
    // Zusagen, keine Naeherungen — sstep allein laege dort bei 0.999…
    aus[k] = d >= hw ? 1 : (d <= -hw ? 0 : sstep(-hw, hw, d));
  }
  return aus;
}

/* ==========================================================================
   8. Vererbung aufloesen
   ========================================================================== */

/**
 * Loest ein Erbfeld auf und sagt, WOHER der Wert kommt — die Bedienung baut
 * daraus „⤓ von *Nordmark*".
 *
 * @returns { wert, quelleId, quelleTitel, geerbt, stufen }
 *          `quelleId` null = niemand setzt das Feld, es gilt ERB_STANDARD.
 *          `stufen`   wie viele Ebenen nach oben (0 = eigen).
 */
export function loeseFeld(baum, id, feld) {
  if (!_erbSatz[feld]) fehler('„' + feld + '“ ist kein Erbfeld');
  var n = baum.index[id];
  if (!n) fehler('Unbekannte Karte „' + id + '“');
  var stufen = 0;
  while (n) {
    if (hatEigen(n.karte, feld)) {
      return { wert: n.karte.eigen[feld], quelleId: n.id,
        quelleTitel: n.karte.titel || n.id, geerbt: stufen > 0, stufen: stufen };
    }
    n = n.elternId === null ? null : baum.index[n.elternId];
    stufen++;
  }
  return { wert: ERB_STANDARD[feld], quelleId: null, quelleTitel: null,
    geerbt: true, stufen: -1 };
}

/** Alle Erbfelder auf einmal: { feld: {wert, quelleId, …} }. */
export function loeseFelder(baum, id) {
  var raus = {};
  for (var i = 0; i < ERBFELDER.length; i++) raus[ERBFELDER[i]] = loeseFeld(baum, id, ERBFELDER[i]);
  return raus;
}

/** Nur die Werte — fuer den Aufbau einer Karte, wo die Herkunft nicht zaehlt. */
export function erbWerte(baum, id) {
  var raus = {};
  for (var i = 0; i < ERBFELDER.length; i++) raus[ERBFELDER[i]] = loeseFeld(baum, id, ERBFELDER[i]).wert;
  return raus;
}

/**
 * Setzt ein Feld eigen (statt geerbt). Aendert `karte.eigen` an Ort und
 * Stelle — Terra haelt seinen Zustand veraenderlich, und eine Kopie hier
 * waere die einzige Stelle im Programm, die es anders macht.
 */
export function setzeEigen(karte, feld, wert) {
  if (NICHT_ERBFELDER.indexOf(feld) >= 0) fehler('„' + feld + '“ wird nicht vererbt');
  if (!_erbSatz[feld]) fehler('„' + feld + '“ ist kein Erbfeld');
  if (!karte.eigen || typeof karte.eigen !== 'object') karte.eigen = {};
  karte.eigen[feld] = wert;
  return karte;
}

/** Nimmt die Ueberschreibung zurueck — das Feld erbt wieder. */
export function erbeWieder(karte, feld) {
  if (!_erbSatz[feld]) fehler('„' + feld + '“ ist kein Erbfeld');
  if (karte.eigen) delete karte.eigen[feld];
  return karte;
}

/* ==========================================================================
   9. Was auf welcher Karte liegt

   ENTSCHEIDUNG: Elternelemente erscheinen auf der Kindkarte als VORLAGE,
   nicht als Kopie. Ein Element gehoert genau einer Karte; elternVorlage
   liefert die im Ausschnitt liegenden Elternelemente in Kindkoordinaten
   umgerechnet und als solche markiert. Sie stehen NICHT in der Elementliste
   der Kindkarte und NICHT in der Datei.

   Die Kosten, ehrlich:

   1. Die Vorlage ist ein UMRISS, kein Gelaende. Ein Wald mit 4000 Baeumen ist
      bei achtfacher Vergroesserung als Instanzwolke wertlos — die Baeume
      stuenden achtmal zu weit auseinander und in einem Raster, das nur fuer
      den Elternmassstab gedacht war. Geliefert werden Punkte und Parameter,
      es laeuft KEIN Generator. Wer die Vorlage sehen will, zeichnet Linien.
   2. Nichts davon ist auf der Kindkarte bearbeitbar. Ein Klick muss zur
      Elternkarte springen. Das ist eine Regel, die die Bedienung durchhalten
      muss, und sie wird sich wie eine Einschraenkung anfuehlen.
   3. Die Vorlage haengt live an der Elternkarte: aendert sie sich, aendert
      sich das Bild der Kindkarte. Das ist gewollt (kein Auseinanderdriften),
      heisst aber, dass ein Kind ohne seinen Elternteil unvollstaendig ist —
      ein Grund mehr fuer EINE Datei (siehe Abschnitt 10).
   4. Am Rand ist die Zugehoerigkeit unscharf: ein Weg, der halb im Ausschnitt
      liegt, gehoert der Elternkarte, ist aber auf dem Kind sichtbar. `anteil`
      sagt, wie viel davon drin liegt, damit die Bedienung „gehoert hierher"
      von „streift nur" unterscheiden kann.

   Verworfen wurde die naheliegende Alternative — beim Anlegen kopieren. Sie
   erzeugt zwei Fassungen derselben Sache, die ab dem ersten Klick
   auseinanderlaufen, verdoppelt den Speicher und macht aus jeder Aenderung an
   der Elternkarte eine Frage („auch im Kind nachziehen?"), die kein Nutzer
   dreimal beantworten will.
   ========================================================================== */

function inPoly(pts, x, z) {
  var inside = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var a = pts[i], b = pts[j];
    if (((a.z > z) !== (b.z > z)) && (x < (b.x - a.x) * (z - a.z) / (b.z - a.z) + a.x)) inside = !inside;
  }
  return inside;
}

/**
 * Elternelemente, die im Ausschnitt der Karte `id` liegen — in
 * KINDkoordinaten, als Vorlage markiert.
 *
 * @returns [{ kind, variant, points, params, quelleId, quellElementId, anteil }]
 */
export function elternVorlage(baum, id, opt) {
  opt = opt || {};
  var n = baum.index[id];
  if (!n || n.elternId === null) return [];
  var e = baum.index[n.elternId];
  var rahmen = rahmenVon(n.karte, e.karte);
  if (!rahmen) return [];
  var liste = e.karte.elemente;
  if (!Array.isArray(liste) || !liste.length) return [];
  var MAP = (n.karte.kartenGroesse | 0) || 256, halb = MAP * 0.5;
  var s = MAP / rahmen.seite;
  var poly = Array.isArray(n.karte.ausschnitt) && n.karte.ausschnitt.length >= 3
    ? n.karte.ausschnitt : null;
  var x1 = rahmen.x0 + rahmen.seite, z1 = rahmen.z0 + rahmen.seite;
  var raus = [];
  for (var k = 0; k < liste.length; k++) {
    var el = liste[k];
    if (!el || !Array.isArray(el.points) || !el.points.length) continue;
    var bb = polyBBox(el.points);
    if (bb.x1 < rahmen.x0 || bb.x0 > x1 || bb.z1 < rahmen.z0 || bb.z0 > z1) continue;
    var punkte = [], drin = 0;
    for (var p = 0; p < el.points.length; p++) {
      var q = el.points[p];
      punkte.push({ x: (q.x - rahmen.x0) * s - halb, z: (q.z - rahmen.z0) * s - halb });
      if (poly ? inPoly(poly, q.x, q.z)
               : (q.x >= rahmen.x0 && q.x <= x1 && q.z >= rahmen.z0 && q.z <= z1)) drin++;
    }
    raus.push({
      kind: el.kind, variant: el.variant, points: punkte,
      // params wird DURCHGEREICHT, nicht kopiert: die Vorlage ist ein Blick auf
      // das Original, und ein tiefes Kopieren je Bild waere Arbeit fuer nichts.
      // Wer sie veraendert, veraendert die Elternkarte — deshalb: nur lesen.
      params: el.params, quelleId: e.id, quellElementId: el.id,
      anteil: drin / el.points.length
    });
  }
  return raus;
}

/* ==========================================================================
   10. Speicherformat v5

   ENTSCHEIDUNG: EINE Datei fuer den ganzen Baum.

   1. Terras gesamte Ein-/Ausgabe ist EIN JSON-Text — Speichern-Knopf,
      Autosave im localStorage, Datei-Dialog. Mehrere Dateien braeuchten einen
      Behaelter (ZIP) oder den Verzeichniszugriff des Browsers. Beides ist eine
      neue Abhaengigkeit bzw. eine Programmierschnittstelle, die aus einer
      `file://`-Seite nicht funktioniert — und die Projektregel lautet: keine
      neue Abhaengigkeit, kein Bauschritt.
   2. Atomares Laden ist nur so haltbar. Bei mehreren Dateien kann der Nutzer
      die Haelfte kopieren, und wir koennen es beim Schreiben nicht verhindern
      und beim Lesen nicht von "es gibt eben nur diese eine Karte"
      unterscheiden. In einer Datei ist der Baum entweder ganz da oder gar nicht.
   3. Eine Kindkarte ist ohne ihren Elternteil unvollstaendig: ihr Gelaende ist
      ABGELEITET, in der Datei steht nur die Handarbeit. Sie einzeln zu
      speichern hiesse, eine Datei zu erzeugen, die sich allein nicht oeffnen
      laesst.
   4. Eine Karte ist etwas, das man verschickt. Eine Datei.

   Der Preis, ehrlich: die Datei traegt alle Karten, auch die gerade nicht
   geoeffneten — samt Elementlisten. Das ist bei zwanzig Karten ein paar
   hundert Kilobyte und damit egal. Es ist NICHT egal nach einem
   Hoehenkarten-Import: dessen Delta ist ein Vollarray (auf 1024^2 ueber zwei
   Millionen Zahlen). Der Autosave-Deckel AUTOSAVE_MAX in editor/io.js muss
   deshalb kuenftig gegen den GANZEN Baum pruefen, nicht gegen die aktive Karte.

   Abwaertskompatibilitaet in beide Richtungen:
   - v1..v4 laden weiter, als einzelne Wurzelkarte ohne Kinder.
   - Eine v5-Datei traegt zusaetzlich einen SPIEGEL der Wurzelkarte auf oberster
     Ebene. Ein aelterer Leser prueft `d.elemente` und `d.hoehen|d.hoehenDelta`,
     ignoriert `karten` als unbekanntes Feld und `version` verzweigt er
     nirgends — er oeffnet die Datei also als Wurzelkarte, statt abzustuerzen.
     Der Preis ist die doppelte Wurzelkarte in der Datei; `opt.spiegel = false`
     schaltet ihn ab, wenn Groesse wichtiger ist als Rueckwaertsvertraeglichkeit.
   ========================================================================== */

/* Felder, die zur BAUMSTRUKTUR gehoeren. Alles andere an einem Karteneintrag
   ist Karteninhalt (Elemente, Hoehen, Seed, Kamera …) und wird unveraendert
   durchgereicht — dieses Modul kennt und prueft ihn NICHT, das tut
   editor/io.js. */
export const BAUM_FELDER = ['id', 'elternId', 'titel', 'einheitMeter',
  'ausschnitt', 'rahmen', 'hoehenQuelle', 'eigen'];

/* ==========================================================================
   Wo die Erbfelder in der DATEI stehen

   `eigen` ist die Wahrheit: was dort steht, gehoert der Karte; was fehlt, wird
   geerbt. Zusaetzlich schreibt schreibeBaumDatei jedes EIGENE Erbfeld noch
   einmal flach neben den Karteneintrag — genau dort, wo `validiereKarte` in
   editor/io.js es seit jeher sucht. Der Preis sind acht doppelte Felder je
   Karte; der Gewinn ist, dass io.js seine Kartenpruefung nicht anfassen muss
   und dass der v4-Spiegel automatisch stimmt.

   Umgekehrt HEBT leseBaumDatei ein flach stehendes Erbfeld nach `eigen`, wenn
   es dort fehlt. Nur so wird aus einer v1..v4-Datei — die gar kein `eigen`
   kennt — eine Wurzelkarte, die ihre Einstellungen wirklich besitzt und sie an
   spaeter angelegte Kinder weitergibt.

   Ein GEERBTES Feld wird flach NICHT geschrieben. Sonst schriebe der naechste
   Speichervorgang den geerbten Wert fest, das Anheben beim Lesen machte ihn zu
   einem eigenen, und ein Klick auf „wieder erben" haette nach dem Neuladen
   keine Wirkung mehr.
   ========================================================================== */

var HOEHEN_QUELLEN = { abgeleitet: 1, eigen: 1 };

function lesePunkte(v, wo) {
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v)) fehler(wo + ': kein Array');
  if (v.length < 3) fehler(wo + ': mindestens drei Punkte noetig');
  var raus = [];
  for (var i = 0; i < v.length; i++) {
    var p = v[i];
    if (!p || !isFinite(p.x) || !isFinite(p.z)) fehler(wo + ': Punkt ' + i + ' ungueltig');
    raus.push({ x: p.x, z: p.z });
  }
  return raus;
}

function leseRahmen(v, wo) {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) fehler(wo + ': kein Objekt');
  if (!isFinite(v.x0) || !isFinite(v.z0) || !isFinite(v.seite) || v.seite <= 0)
    fehler(wo + ': x0/z0/seite ungueltig');
  return { x0: v.x0, z0: v.z0, seite: v.seite };
}

/**
 * Liest den Kartenbaum aus einem geparsten Dateiobjekt. Prueft AUSSCHLIESSLICH
 * die Baumfelder — Elemente, Hoehen und Kamera bleiben unangetastet und gehen
 * anschliessend durch validiereKarte in editor/io.js.
 *
 * Scheitert ATOMAR: es wird nichts veraendert und nichts zurueckgegeben, bevor
 * der ganze Baum steht. Eine halb geladene Hierarchie waere schlimmer als eine
 * abgelehnte Datei — sie saehe aus wie eine Karte, waere aber eine andere.
 *
 * @returns { version, baum, warnungen }
 */
export function leseBaumDatei(daten) {
  if (!daten || typeof daten !== 'object' || Array.isArray(daten))
    fehler('Kartendatei: kein Objekt');
  var version = Number.isFinite(daten.version) ? (daten.version | 0) : 1;

  if (!Array.isArray(daten.karten)) {
    /* v1..v4: eine einzelne Wurzelkarte. Der komplette Dateiinhalt WIRD zum
       Karteneintrag — die Baumfelder kommen als Vorgaben dazu. So bekommt
       editor/io.js in beiden Faellen dasselbe Objekt zu sehen. */
    if (!Array.isArray(daten.elemente)) fehler('Unbekanntes Format');
    var einzel = {};
    for (var f in daten) if (f !== 'karten' && f !== 'wurzel') einzel[f] = daten[f];
    einzel.id = istKennung(daten.id) ? daten.id : 'k0';
    einzel.elternId = null;
    einzel.titel = typeof daten.titel === 'string' && daten.titel ? daten.titel : 'Karte';
    einzel.einheitMeter = einheitGeputzt(daten.einheitMeter);
    einzel.hoehenQuelle = 'eigen';
    einzel.eigen = hebeErbfelder(daten, leseEigen(daten, [], 'Karte'));
    return { version: version, baum: baueKartenbaum([einzel]), warnungen: [] };
  }

  if (!daten.karten.length) fehler('karten: leere Liste');
  var karten = [], warnungen = [], i;
  for (i = 0; i < daten.karten.length; i++) {
    var k = daten.karten[i], wo = 'Karte ' + i;
    if (!k || typeof k !== 'object' || Array.isArray(k)) fehler(wo + ': kein Objekt');
    if (!istKennung(k.id)) fehler(wo + ': id fehlt');
    wo = 'Karte „' + k.id + '“';
    if (k.elternId !== undefined && k.elternId !== null && !istKennung(k.elternId))
      fehler(wo + ': elternId ungueltig');
    if (k.einheitMeter !== undefined &&
        (!Number.isFinite(k.einheitMeter) || k.einheitMeter <= 0))
      fehler(wo + ': einheitMeter ungueltig');
    if (k.hoehenQuelle !== undefined && !HOEHEN_QUELLEN[k.hoehenQuelle])
      fehler(wo + ': hoehenQuelle „' + k.hoehenQuelle + '“ unbekannt');
    var eintrag = {};
    for (var g in k) if (BAUM_FELDER.indexOf(g) < 0) eintrag[g] = k[g];
    eintrag.id = k.id;
    eintrag.elternId = istKennung(k.elternId) ? k.elternId : null;
    eintrag.titel = typeof k.titel === 'string' && k.titel ? k.titel : k.id;
    eintrag.einheitMeter = einheitGeputzt(k.einheitMeter);
    var aus = lesePunkte(k.ausschnitt, wo + ' · ausschnitt');
    if (aus) eintrag.ausschnitt = aus;
    var rah = leseRahmen(k.rahmen, wo + ' · rahmen');
    if (rah) eintrag.rahmen = rah;
    eintrag.hoehenQuelle = HOEHEN_QUELLEN[k.hoehenQuelle] ? k.hoehenQuelle
      : (eintrag.elternId ? 'abgeleitet' : 'eigen');
    eintrag.eigen = hebeErbfelder(k, leseEigen(k, warnungen, wo));
    karten.push(eintrag);
  }
  var baum = baueKartenbaum(karten, { wurzelId: istKennung(daten.wurzel) ? daten.wurzel : null });
  return { version: version, baum: baum, warnungen: warnungen.concat(baum.warnungen) };
}

/* `eigen` streng bei der Form, tolerant bei den Schluesseln: ein unbekanntes
   Feld stammt aus einer NEUEREN Fassung, die ein weiteres Erbfeld kennt. Es
   fallen zu lassen kostet diese eine Einstellung; die Datei abzulehnen kostet
   die ganze Karte. Dieselbe Abwaegung wie bei `biom` und `wetter` in io.js. */
function leseEigen(k, warnungen, wo) {
  var raus = {};
  if (k.eigen === undefined || k.eigen === null) return raus;
  if (typeof k.eigen !== 'object' || Array.isArray(k.eigen)) fehler(wo + ': eigen ist kein Objekt');
  for (var f in k.eigen) {
    if (!_erbSatz[f]) {
      warnungen.push({ art: 'unbekanntes-erbfeld', id: k.id, feld: f,
        text: wo + ': unbekanntes Erbfeld „' + f + '“ uebergangen' });
      continue;
    }
    raus[f] = k.eigen[f];
  }
  return raus;
}

/* Flach stehende Erbfelder nach `eigen` heben — nur, wo `eigen` schweigt. */
function hebeErbfelder(k, eigen) {
  for (var i = 0; i < ERBFELDER.length; i++) {
    var f = ERBFELDER[i];
    if (Object.prototype.hasOwnProperty.call(eigen, f)) continue;
    if (Object.prototype.hasOwnProperty.call(k, f)) eigen[f] = k[f];
  }
  return eigen;
}

/**
 * Schreibt den Baum als v5-Dateiobjekt (reines JSON-taugliches Objekt).
 * `knoten.elternId` gewinnt gegen `karte.elternId` — damit werden Reparaturen
 * aus baueKartenbaum beim naechsten Speichern festgeschrieben und die Warnung
 * wiederholt sich nicht bei jedem Laden.
 *
 * @param opt { spiegel (Vorgabe true) }
 */
export function schreibeBaumDatei(baum, opt) {
  opt = opt || {};
  var karten = [], i;
  for (i = 0; i < baum.ordnung.length; i++) {
    var n = baum.index[baum.ordnung[i]], k = n.karte, e = {};
    // Erbfelder kommen unten aus `eigen`, nicht von hier — sonst schriebe ein
    // Karteneintrag einen Wert flach mit, den er in Wahrheit nur erbt.
    for (var f in k) if (BAUM_FELDER.indexOf(f) < 0 && !_erbSatz[f]) e[f] = k[f];
    e.id = n.id;
    e.elternId = n.elternId;
    e.titel = k.titel || n.id;
    e.einheitMeter = einheitGeputzt(k.einheitMeter);
    /* Eine verwaiste Karte haengt nur ERSATZWEISE an der Wurzel. Ihr
       Ausschnitt ist in Koordinaten einer Karte formuliert, die es nicht mehr
       gibt, und ihre Ableitung haette keine Grundlage — beides wird beim
       Festschreiben fallen gelassen, statt eine falsche Zugehoerigkeit zu
       konservieren. Die Hoehen der Karte selbst bleiben unangetastet. */
    if (!n.verwaist) {
      if (k.ausschnitt) e.ausschnitt = k.ausschnitt;
      if (k.rahmen) e.rahmen = k.rahmen;
      e.hoehenQuelle = k.hoehenQuelle || (n.elternId ? 'abgeleitet' : 'eigen');
    } else {
      e.hoehenQuelle = 'eigen';
    }
    if (k.eigen) {
      var ee = {}, leer = true;
      for (var g in k.eigen) {
        if (!_erbSatz[g]) continue;
        ee[g] = k.eigen[g];
        e[g] = k.eigen[g];      // flache Zweitschrift fuer validiereKarte
        leer = false;
      }
      if (!leer) e.eigen = ee;
    }
    karten.push(e);
  }
  var datei = { format: 'terra', version: FORMAT_VERSION, wurzel: baum.wurzelId, karten: karten };
  if (opt.spiegel !== false) {
    // Der Spiegel entsteht aus dem fertigen WURZELEINTRAG, nicht aus der
    // Rohkarte: nur dort stehen die Erbfelder bereits an ihrem flachen Platz.
    var w = karten[0];
    for (var s in w) {
      if (BAUM_FELDER.indexOf(s) >= 0) continue;
      if (s === 'format' || s === 'version' || s === 'karten' || s === 'wurzel') continue;
      datei[s] = w[s];
    }
    // Ohne diese beiden Felder wirft der v4-Leser "Unbekanntes Format" —
    // der Spiegel muss den Mindestbestand tragen, auch wenn die Wurzelkarte
    // (frisch angelegt) noch gar nichts enthaelt.
    if (!Array.isArray(datei.elemente)) datei.elemente = [];
    if (!Array.isArray(datei.hoehen) && !Array.isArray(datei.hoehenDelta)) datei.hoehenDelta = [];
  }
  return datei;
}
