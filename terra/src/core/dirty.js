// Aenderungs-Orchestrierung: Elemente (neu) erzeugen, Terrain/Korridore
// nachziehen, geaenderte Pools packen.
import { S, HALF, VW, VINE_R, clearElement, dropElement } from './store.js';
import { lerp } from './rng.js';
import { setArborQuellen } from '../render/materials.js';
import { markDirty, flushPack } from './pools.js';
import { rivers, corridor, stampCorridor, stampWear, clearWear, baseHeightAt,
  refreshTerrainFull, recomputeHeights, computeAO, refreshGrid,
  rebuildBiomFeld } from '../world/terrain.js';
import { pathSamples, genStrasse, genMauer, genFluss, genHecke,
  genBruch, bruchDaten, bruchMasse, brueche,
  bruchMaskeLeeren, bruchMaskeStempeln, bruchMaskeFertig } from '../generators/paths.js';
import { genFlaeche, districtStreets, inPoly } from '../generators/areas.js';
// Runde H: die Korridorstempel des Binnensees.
import { seeKorridore } from '../generators/see.js';
import { strukturKorridore, istStruktur, KORRIDOR_R, KLOSTER_MAX_GROESSE,
  WERFT_QUERSUCHE } from '../generators/strukturen.js';
import { genObjekt } from '../generators/objects.js';
import { genRanke } from '../generators/vines.js';
import { defaultsFor } from '../editor/tools.js';

function genElement(el) {
  clearElement(el);
  // Fehlende Parameter aus dem Schema ergänzen — hält geladene Karten robust
  var def = defaultsFor(el.kind, el.variant);
  for (var dk in def) if (el.params[dk] === undefined) el.params[dk] = def[dk];
  if (el.kind === "pfad") {
    if (el.points.length < 2) return;
    if (el.variant === "strasse") genStrasse(el);
    else if (el.variant === "mauer") genMauer(el);
    else if (el.variant === "fluss") genFluss(el);
    else if (el.variant === "hecke") genHecke(el);
    // H6: neue Variante am ENDE der Kette — eine aeltere Fassung des Editors
    // faellt durch alle else-if hindurch und erzeugt schlicht nichts, statt
    // abzustuerzen. Das Speicherformat bleibt damit abwaertskompatibel.
    else if (el.variant === "bruch") genBruch(el);
    /* I2: „biompinsel" steht hier bewusst NICHT. Der Strich erzeugt keine
       einzige Instanz und kein Mesh — seine ganze Wirkung ist die abgeleitete
       Biommaske (siehe biomQuellen weiter unten), genau wie bei der
       Biomflaeche, die in genFlaeche ebenfalls durch alle Zweige faellt. */
  } else if (el.kind === "flaeche") genFlaeche(el);
  else if (el.kind === "objekt") genObjekt(el);
  else if (el.kind === "ranke") genRanke(el);
}

/** Erzeugt ein Element neu und merkt sich nur die betroffenen Pools. */
function regenElement(el) {
  var names = Object.keys(el.inst);
  genElement(el);
  var after = Object.keys(el.inst);
  for (var i = 0; i < after.length; i++) names.push(after[i]);
  markDirty(names);
}

/** Sammelt alle Flussverläufe (Basis für das Einschneiden des Terrains). */
function rebuildRivers() {
  rivers.length = 0;
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    if (el.kind !== "pfad" || el.variant !== "fluss" || el.points.length < 2) continue;
    var sm = pathSamples(el.points, 1.6);
    if (!sm.length) continue;
    var prof = [];
    for (var k = 0; k < sm.length; k++) prof.push(baseHeightAt(sm[k].x, sm[k].z));
    for (var pass = 0; pass < 8; pass++) {
      var cp = prof.slice();
      for (var m = 1; m < prof.length - 1; m++) prof[m] = (cp[m - 1] + cp[m] * 2 + cp[m + 1]) * 0.25;
    }
    var samples = [];
    for (var s = 0; s < sm.length; s++) samples.push({ x: sm[s].x, z: sm[s].z, y: prof[s] });
    rivers.push({ samples: samples, radius: el.params.breite * 0.62 + 2.2, depth: el.params.tiefe });
  }
  // Bruchkanten benutzen DIESELBE Stempelliste (siehe rebuildBrueche) und
  // muessen daher nach dem rivers.length = 0 oben laufen. Der Aufruf steht
  // bewusst hier statt an jeder Aufrufstelle: so ist jeder Weg, der die
  // Flussstempel erneuert (rebuildAll, commit), automatisch auch fuer die
  // Bruchstempel korrekt.
  rebuildBrueche();
}

/**
 * Sammelt die Bruchkanten-Stempel (H6). Ein Bruch ist ein Flussstempel mit
 * sehr grosser Tiefe und asymmetrischem Profil: die Kreiskette aus
 * bruchDaten() liegt ausschliesslich auf der Abgrundseite, an der
 * gezeichneten Linie selbst ist das Stempelgewicht exakt 0. Deshalb kommt der
 * Bruch OHNE jede Aenderung an terrain.js/recomputeHeights aus — er wird
 * einfach an `rivers` angehaengt und ueber dieselbe Minimum-Regel eingebrannt.
 * `brueche` behaelt die Eintraege zusaetzlich mit Kantenverlauf und Massen,
 * damit Werkzeuge sie ohne Neuberechnung lesen koennen.
 *
 * In DERSELBEN Schleife entsteht die Bruchmaske (paths.js): das Rasterbild der
 * Abgrundzonen, mit dem world/water.js Wasserebene und Meeresboden-Teller
 * aussparen. Sie haengt an genau denselben Stempeln wie die Hoehenwirkung und
 * kann deshalb nicht gegen die Klippe verrutschen. Gibt es keine Bruchkante,
 * bleibt die Maske leer und ihr Shaderzweig abgeschaltet.
 */
function rebuildBrueche() {
  brueche.length = 0;
  bruchMaskeLeeren();
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    if (el.kind !== "pfad" || el.variant !== "bruch" || el.points.length < 2) continue;
    var d = bruchDaten(el);
    if (!d) continue;
    brueche.push(d);
    rivers.push(d);          // {samples, radius, depth} — genau die rivers-Form
    bruchMaskeStempeln(d);
  }
  bruchMaskeFertig();
}

/** Baut die Sperrmaske für Straßen, Flüsse, Mauern und Viertel-Gassen neu auf. */
function rebuildCorridors() {
  corridor.fill(0);
  clearWear();
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i], k, sm;
    if (el.kind === "pfad" && el.points.length >= 2) {
      if (el.variant === "strasse") {
        sm = pathSamples(el.points, 1.4);
        for (k = 0; k < sm.length; k++) {
          stampCorridor(sm[k].x, sm[k].z, el.params.breite * 0.5 + 1.6);
          stampWear(sm[k].x, sm[k].z, el.params.breite * 0.5 + 2.1);
        }
      } else if (el.variant === "fluss") {
        sm = pathSamples(el.points, 1.4);
        for (k = 0; k < sm.length; k++) stampCorridor(sm[k].x, sm[k].z, el.params.breite * 0.6 + 2.2);
      } else if (el.variant === "mauer") {
        sm = pathSamples(el.points, 1.6);
        for (k = 0; k < sm.length; k++) stampCorridor(sm[k].x, sm[k].z, el.params.dicke * 0.6 + 1.2);
      }
    } else if (el.kind === "flaeche" && el.variant === "viertel" && el.points.length >= 3) {
      el.streets = districtStreets(el);
      for (var s = 0; s < el.streets.length; s++) {
        var ln = el.streets[s];
        for (k = 0; k < ln.length; k++) {
          if (inPoly(el.points, ln[k].x, ln[k].z)) stampCorridor(ln[k].x, ln[k].z, el.params.gasse * 0.5 + 1.2);
        }
      }
    } else if (el.kind === "flaeche" && el.variant === "see" && el.points.length >= 3) {
      /* Runde H: ein See sperrt seine Flaeche wie ein Flussbett. `tryPlace`
         kennt nur den MEERESspiegel (h < WATER + 0.35) — ein Bergsee auf
         Hoehe 20 besteht diese Pruefung anstandslos, und ohne diese Zeile
         stuenden Baeume im Wasser.

         Die Stempel kommen aus see.js, weil sie am GEZEICHNETEN Uferzug
         haengen (geschlossene Catmull-Rom-Kurve durch die Griffe) und nicht am
         Griffpolygon — dazwischen liegt bei wenigen Punkten viel Wasser. */
      var seeK = seeKorridore(el);
      for (k = 0; k < seeK.length; k++) stampCorridor(seeK[k].x, seeK[k].z, seeK[k].r);
    } else if (el.kind === "flaeche" && istStruktur(el.variant) && el.points.length >= 3) {
      /* Kompositstrukturen stempeln ihre TRAGENDEN Linien: Mauerring, Kai-
         flucht, Kreuzgangfluegel. Begruendung wie bei den Viertel-Gassen —
         dort steht harte Infrastruktur, in die nachtraeglich kein fremder Wald
         und keine fremde Streuung hineinwachsen soll. Die Punkte kommen aus
         strukturen.js, weil ihre Lage aus derselben Layout-Rechnung folgt wie
         die Bauteile selbst; zwei Rechnungen wuerden auseinanderdriften. */
      var kor = strukturKorridore(el);
      for (k = 0; k < kor.length; k++) stampCorridor(kor[k].x, kor[k].z, kor[k].r);
    }
  }
}

/* ==========================================================================
   I2 — Der Biompinsel als Quelle des Biomfelds

   Der Pinselstrich ist ein ganz gewoehnliches Pfadelement
   ({kind:"pfad", variant:"biompinsel", points, params:{biom, radius, weich}}).
   Gezeichnet wird er wie der Terrainpinsel (ziehen), gespeichert wie die
   Bruchkante (als Element) und beim Laden nachgestempelt — dieselbe Logik,
   nur dass er nicht ins Hoehenfeld stempelt, sondern in die Biommaske.

   DAS VERFAHREN. world/biomfeld.js kennt genau eine Quelle: ein Polygon mit
   {points, params:{biom, weich}}. Es kennt keinen Pinsel und soll auch keinen
   kennen — dort steht die Rasterung, die Distanztransformation und die
   Ausfransung, und die sind fuer JEDE Flaeche dieselben. Deshalb wird der
   Strich HIER in Kreisflaechen uebersetzt: eine je Tupfer entlang der Kurve.
   Der Pinsel bekommt damit ohne eine einzige neue Zeile in biomfeld.js
   denselben weichen Rand, dieselbe gebrochene Grenze und dieselbe
   Ueberlagerungsregel wie eine gezeichnete Biomflaeche.

   Der Preis ist der Aufwand: `stempleFlaeche` laeuft je Tupfer einmal (zwei
   Chamfer-Durchgaenge ueber die Tupferbox, rund 40x40 Zellen bei Radius 12).
   Deshalb die beiden Deckel unten — der Tupferabstand ist ein halber Radius
   (die Ueberlappung laesst die Kette rund erscheinen, die Einbuchtung zwischen
   zwei Tupfern liegt bei 3 % des Radius), und ein einzelner Strich liefert nie
   mehr als BIOM_TUPFER_MAX Tupfer; ein sehr langer Strich wird gestreckt statt
   teuer.
   ========================================================================== */
var BIOM_TUPFER_MAX = 320;
var BIOM_KREIS_ECKEN = 16;

/** Kreispolygon um (x,z). Feste Eckenzahl: die Ausfransung in biomfeld.js
 *  bricht die Kante ohnehin staerker, als 16 Ecken sie eckig machen. */
function kreisPolygon(x, z, r) {
  var pts = [];
  for (var i = 0; i < BIOM_KREIS_ECKEN; i++) {
    var a = i / BIOM_KREIS_ECKEN * Math.PI * 2;
    pts.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r });
  }
  return pts;
}

/** Radius eines Pinselstrichs — geklemmt wie das Schema in editor/tools.js. */
function pinselRadiusVon(el) {
  var r = el.params && el.params.radius;
  return (typeof r === "number" && isFinite(r) && r > 0.5) ? r : 12;
}

/**
 * Die Quellen der Biomableitung in Zeichenreihenfolge: Biomflaechen gehen
 * unveraendert durch, Pinselstriche werden in Kreisflaechen aufgeloest.
 * Die Reihenfolge ist bedeutungstragend (spaeter gezeichnet gewinnt im Kern,
 * siehe Ueberlagerungsregel in world/biomfeld.js) und bleibt deshalb exakt
 * die der Elementliste.
 */
function biomQuellen() {
  var out = [], i, k;
  for (i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    if (el.kind === "flaeche" && el.variant === "biom") { out.push(el); continue; }
    if (el.kind !== "pfad" || el.variant !== "biompinsel") continue;
    if (!el.points || !el.points.length) continue;
    var p = el.params || {};
    var r = pinselRadiusVon(el);
    var mitten = pinselTupfer(el, r);
    for (k = 0; k < mitten.length; k++) {
      // Ohne kind/variant: biomfeldBauen laesst genau solche schlichten
      // Quellen durch (es prueft beide Felder nur, WENN sie da sind).
      out.push({ points: kreisPolygon(mitten[k].x, mitten[k].z, r),
        params: { biom: p.biom, weich: p.weich } });
    }
  }
  return out;
}

/** Tupfermitten eines Strichs: entlang DERSELBEN Kurve, die elementBox
 *  vermisst (pathSamples), damit die Einflussbox nie zu klein ausfaellt. */
function pinselTupfer(el, r) {
  var schritt = Math.max(1, r * 0.5);
  if (el.points.length < 2) return [{ x: el.points[0].x, z: el.points[0].z }];
  var sm = pathSamples(el.points, schritt);
  if (!sm.length) return [{ x: el.points[0].x, z: el.points[0].z }];
  // Deckel: bei einem sehr langen Strich wird der Abstand gestreckt statt die
  // Rechnung teuer. Sichtbar wird das erst, wenn die Tupfer sich nicht mehr
  // ueberlappen — bei 320 Tupfern und Radius 12 waere der Strich 1920
  // Einheiten lang, also fast acht Mal ueber eine 256er Karte.
  var jeder = Math.ceil(sm.length / BIOM_TUPFER_MAX);
  var out = [];
  for (var i = 0; i < sm.length; i += jeder) out.push({ x: sm[i].x, z: sm[i].z });
  var letzt = sm[sm.length - 1];
  var l = out[out.length - 1];
  if (l.x !== letzt.x || l.z !== letzt.z) out.push({ x: letzt.x, z: letzt.z });
  return out;
}

/* --- Bereichsbeschraenkte Terrain-Updates (D3) --------------------------
   Ein schwerer Commit eines EINZELNEN Elements muss das Terrain nur dort
   neu berechnen, wo dieses Element es beeinflussen kann. Die Stempel-
   Formeln unten sind bewusst dieselben wie in rebuildRivers/
   rebuildCorridors — driftet dort eine Radiusformel, muss sie hier
   mitgezogen werden, sonst wird die Box zu klein. */

/** Groesster Stempelradius des Elements in Weltmetern. */
function stempelRadius(el) {
  var p = el.params;
  if (el.kind === "pfad") {
    // Fluss: der Einschnitt aus rebuildRivers (breite*0.62+2.2) reicht
    // weiter als der Korridorstempel (breite*0.6+2.2) — er bestimmt die Box.
    if (el.variant === "fluss") return p.breite * 0.62 + 2.2;
    // Strasse: der Wear-Stempel faerbt das Gras (breite*0.5+2.1) und reicht
    // weiter als der Korridor (breite*0.5+1.6).
    if (el.variant === "strasse") return p.breite * 0.5 + 2.1;
    if (el.variant === "mauer") return p.dicke * 0.6 + 1.2;
    // Bruch (H6): die Stempelkette reicht bis `reichweite` auf die
    // Abgrundseite. bruchMasse ist DIESELBE Rechnung, die bruchDaten benutzt —
    // hier darf nichts nachgerechnet werden, sonst wird die Box zu klein und
    // es bleiben Reste der alten Klippe stehen.
    if (el.variant === "bruch") return bruchMasse(p).reichweite;
    /* I2 — Biompinsel: Tupferradius plus die Ausfransung der Biomkante.
       Der Aufschlag ist wortgleich der der Biomflaeche weiter unten
       (randZugabe() in world/biomfeld.js) — wandert dort eine Zahl, muss sie
       an BEIDEN Stellen mitwandern. */
    if (el.variant === "biompinsel") return pinselRadiusVon(el) + (p.weich || 8) * 1.03 + 2;
  }
  // Viertel-Gassen stempeln mit gasse*0.5+1.2, per inPoly aufs Polygon geklippt.
  if (el.kind === "flaeche" && el.variant === "viertel") return (p.gasse || 0) * 0.5 + 1.2;
  /* Kompositstrukturen: DIESELBEN Radien, die strukturKorridore benutzt —
     wandert dort eine Zahl, muss sie hier mitwandern, sonst wird die Box zu
     klein und es bleiben Reste des alten Rings stehen (gleiche Warnung wie im
     Kopf dieses Abschnitts). Der Burg-Ring verdoppelt sich fast, wenn ein
     Zwinger davorsteht; das Kloster kann ueber `groesse` ueber die Punktbox
     hinauswachsen, deshalb dort der zusaetzliche Aufschlag. */
  if (el.kind === "flaeche" && istStruktur(el.variant)) {
    if (el.variant === "burg") return KORRIDOR_R.burg * (p.zwinger ? 1.9 : 1) + 1.8;
    if (el.variant === "werft") return KORRIDOR_R.werft + WERFT_QUERSUCHE;
    return KORRIDOR_R.kloster + elementSpanne(el) * 0.5 *
      Math.max(0, Math.min(KLOSTER_MAX_GROESSE, p.groesse || 1) - 1);
  }
  /* I2 — Biomflaeche: die Ausfransung greift ueber die Punktbox hinaus, und
     zwar um weich*(0.5 + 0.30*1.75). Das ist wortgleich die Rechnung aus
     randZugabe() in world/biomfeld.js — wandert dort eine Zahl, muss sie hier
     mitwandern, sonst bleibt beim Verschieben ein Streifen alter Faerbung
     stehen. Gleiche Warnung wie beim Bruch und beim Burgring. */
  if (el.kind === "flaeche" && el.variant === "biom") return (p.weich || 8) * 1.03 + 2;
  // Runde H: der See stempelt sein Korridorraster mit Radius 3 (see.js).
  if (el.kind === "flaeche" && el.variant === "see") return 3;
  return 3;   // erreicht isHeavy nie einen anderen Fall, bleibt aber definiert
}

/** Groesste Punktausdehnung eines Elements — Grundlage fuer den `groesse`-
 *  Aufschlag des Klosters (sein Rechteck skaliert um die Polygonmitte). */
function elementSpanne(el) {
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (var i = 0; i < el.points.length; i++) {
    var q = el.points[i];
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.z < minZ) minZ = q.z;
    if (q.z > maxZ) maxZ = q.z;
  }
  if (minX > maxX) return 0;
  return Math.max(maxX - minX, maxZ - minZ);
}

/** Einfluss-Box des Elements in Gitterindizes, inklusive Rand — oder null,
 *  wenn das Element (noch) keine stempelfaehigen Punkte hat. */
function elementBox(el) {
  // Pfade stempeln entlang der Catmull-Rom-Kurve (Tension 0.5), die zwischen
  // den Stuetzpunkten ueberschwingen kann — deshalb die tatsaechlichen
  // Kurven-Samples vermessen statt nur der Punkte. Viertel-Gassen werden per
  // inPoly aufs Polygon geklippt, dort genuegt die Punkt-Box. Fuer die
  // Kompositstrukturen gilt dasselbe: Mauerring, Kaiflucht und Klosterrechteck
  // entstehen AUS den Punkten (die Kaiflucht wird in werftAchse zusaetzlich auf
  // die Huellbox geklemmt), die Ausdehnung ueber `groesse` steckt im
  // Stempelradius.
  var pts = el.points;
  if (el.kind === "pfad" && el.points.length >= 2) {
    var sm = pathSamples(el.points, 2.5);
    if (sm.length) pts = sm;
  }
  var minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (var i = 0; i < pts.length; i++) {
    var q = pts[i];
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.z < minZ) minZ = q.z;
    if (q.z > maxZ) maxZ = q.z;
  }
  if (minX > maxX) return null;
  // Rand = Stempelradius + Glaettungsrand: computeAO glaettet ueber einen
  // Nachbarn und erweitert sich intern um 1, die Normalen in refreshGrid
  // lesen einen Nachbarn — +4 deckt das mit Sicherheitsreserve ab (gleiches
  // Muster wie der Pinsel in applyBrush: m = ceil(r)+2 plus AO-Rand).
  var rand = Math.ceil(stempelRadius(el)) + 4;
  return { i0: Math.floor(minX + HALF) - rand, i1: Math.ceil(maxX + HALF) + rand,
           j0: Math.floor(minZ + HALF) - rand, j1: Math.ceil(maxZ + HALF) + rand };
}

/** Terrain nur im Einflussbereich des Elements neu berechnen. Vereinigt die
 *  neue Box mit der beim letzten schweren Commit gemerkten (el._hgtBox):
 *  nach einem Griff-Drag oder einem Schrumpfen der Breite muss auch die ALTE
 *  Lage aufgefrischt werden, sonst bleiben Restloecher (altes Flussbett,
 *  alte Wegfaerbung) im Terrain stehen. Die gemerkte Box stammt aus dem
 *  Commit, der die alte Lage eingebrannt hat — sie deckt sie daher exakt ab. */
function refreshTerrainBereich(el) {
  var neu = elementBox(el);
  var alt = el._hgtBox;
  if (!neu && !alt) { refreshTerrainFull(); return; }   // nichts bekannt → konservativ
  var b = neu && alt
    ? { i0: Math.min(neu.i0, alt.i0), i1: Math.max(neu.i1, alt.i1),
        j0: Math.min(neu.j0, alt.j0), j1: Math.max(neu.j1, alt.j1) }
    : (neu || alt);
  el._hgtBox = neu || alt;   // nicht serialisiert (serializeElements whitelistet)
  // recomputeHeights setzt hgt=base im Bereich und wendet ALLE Flussstempel
  // geklippt an — idempotent, solange die Box alles abdeckt, was sich
  // geaendert hat. AO einen Ring weiter, wie beim Pinsel (applyBrush).
  recomputeHeights(b.i0, b.i1, b.j0, b.j1);
  computeAO(b.i0 - 1, b.i1 + 1, b.j0 - 1, b.j1 + 1);
  refreshGrid(b.i0, b.i1, b.j0, b.j1);
}

/** Vollständiger Neuaufbau (Laden, Undo, Seed-Wechsel). */
function rebuildAll() {
  rebuildRivers();
  // Reihenfolge ist Pflicht, nicht Geschmack: rebuildCorridors() ruft fuer
  // Viertel und Werften districtStreets()/werftAchse(), und die lesen
  // heightAt() — also `hgt`. Stand refreshTerrainFull() davor, arbeiteten die
  // beiden im ersten Durchlauf nach dem Laden auf dem Hoehenfeld der ZUVOR
  // geladenen Karte (ohne Flusseinschnitt), erst der zweite Neuaufbau war
  // richtig. Darum: Hoehen erst schreiben, dann stempeln, dann AO und Farben —
  // letztere brauchen den frischen Tritt aus rebuildCorridors(). Aufgeteilt
  // statt refreshTerrainFull(), damit das Gitter nur EINMAL laeuft.
  recomputeHeights(0, VW - 1, 0, VW - 1);
  rebuildCorridors();
  // I2: vor refreshGrid — die Terrainfarbe liest die Biommaske. Und vor der
  // Elementschleife weiter unten, denn genWald und genWiese fragen das Biom je
  // Kandidat ab. Steht sie zu spaet, sieht der erste Aufbau nach dem Laden
  // anders aus als der zweite; genau der Fehler, den diese Funktion in Runde
  // I5 schon einmal hatte.
  rebuildBiomFeld(biomQuellen());
  computeAO(0, VW - 1, 0, VW - 1);
  refreshGrid(0, VW - 1, 0, VW - 1);
  for (var i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    genElement(el);
    // Einfluss-Box vorbelegen: hydrate/Undo erzeugen frische Objekte ohne
    // _hgtBox — der erste Einzel-Commit danach (z. B. nach Griff-Drag) muss
    // die JETZIGE Lage kennen, um sie wieder auffrischen zu koennen.
    if (isHeavy(el)) el._hgtBox = elementBox(el);
  }
  markDirty();
  refreshArborQuellen();
}

/** Regeneriert alle Elemente auf dem aktuellen Terrain — einmalig nach einem
 *  Pinselstrich (pointerup), damit Bäume/Häuser samt Kontaktschatten auf der
 *  neuen Höhe sitzen. Der Terrain-Pinsel ist die begründete Ausnahme vom
 *  Ein-Element-Dirty-Tracking, weil er die Grundlage ALLER Elemente ändert.
 *  Bewusst OHNE refreshTerrainFull: applyBrush hat das Gitter bereits
 *  bereichsweise aktualisiert. Ebenso OHNE rebuildRivers/rebuildCorridors:
 *  der Pinsel ändert nur `base` (nie die Sperrmaske), und applyBrush ruft
 *  recomputeHeights auf, das die vorhandenen Flussstempel idempotent erneut
 *  einschneidet — Flusseinschnitte gehen beim Pinseln also nicht verloren. */
function regenAlleElemente() {
  for (var i = 0; i < S.elements.length; i++) genElement(S.elements[i]);
  markDirty();
}

/** Änderung an einem Element übernehmen. heavy = Terrain/Korridore betroffen. */
function commit(el, heavy) {
  if (heavy) {
    // rebuildRivers/rebuildCorridors bleiben bewusst GLOBAL: rivers[] und die
    // corridor-/wear-Masken sind globale Datenstrukturen, die von allen
    // Elementen gemeinsam beschrieben werden — nur ein kompletter Neuaufbau
    // haelt sie konsistent (ein geloeschter Stempel laesst sich nicht lokal
    // zuruecknehmen). Sie sind gegenueber dem 257²-Terrain billig: reine
    // Array-Stempel entlang der Pfade; keiner von beiden ruft
    // refreshTerrainFull oder refreshGrid auf (geprueft: rebuildRivers liest
    // nur baseHeightAt, rebuildCorridors schreibt nur corridor/wear).
    rebuildRivers();
    rebuildCorridors();
    // I2: dieselbe Begruendung wie oben — die Biommaske wird von mehreren
    // Elementen gemeinsam beschrieben und muss deshalb global neu.
    rebuildBiomFeld(biomQuellen());
    // Nur beim Commit EINES Elements reicht dessen Einflussbereich; ohne
    // Element (Loeschen — die alte Lage ist hier nicht mehr greifbar) weiter
    // der volle Neuaufbau.
    if (el) refreshTerrainBereich(el);
    else refreshTerrainFull();
    for (var i = 0; i < S.elements.length; i++) genElement(S.elements[i]);
    markDirty();
  } else if (el) {
    regenElement(el);
  }
  // Auch ein leichtes Commit kann das Licht verschieben (Fuss bewegt, dicke
  // oder hoehe geaendert) — deshalb in beiden Zweigen nachziehen.
  refreshArborQuellen();
}

/** Ändert ein Element das Terrain oder die Sperrflächen? */
function isHeavy(el) {
  // "bruch" schneidet ueber die Stempelkette tief ins Hoehenfeld — schwer.
  // Burg, Werft und Kloster sperren mit ihrem Mauerring, ihrer Kaiflucht und
  // ihren Kreuzgangfluegeln Korridore — genau das Kriterium, mit dem auch das
  // Viertel hier steht. Zusaetzlich haengen ihre Layouts (Torkante, Kaiflucht)
  // am Hoehenfeld: eine Terrainaenderung darunter muss sie neu rechnen.
  // I2: der Biompinsel faerbt das Terrain und entscheidet ueber die
  // Bepflanzung — genau wie die Biomflaeche unten und aus demselben Grund.
  return (el.kind === "pfad" && (el.variant === "strasse" || el.variant === "fluss" ||
          el.variant === "mauer" || el.variant === "bruch" ||
          el.variant === "biompinsel")) ||
         // I2: die Biomflaeche faerbt das Terrain und entscheidet ueber die
         // Bepflanzung — sie muss dieselbe Kette ausloesen wie ein Viertel.
         (el.kind === "flaeche" && (el.variant === "viertel" || el.variant === "biom" ||
          istStruktur(el.variant)));
}


/* ===== B1 — Arbor-Netzwerk ===============================================
   Ranken generieren isoliert (Architektur-Invariante: ein Element rechnet
   aus seinen eigenen Daten). Welche Ranken MITEINANDER verwachsen sind, ist
   dagegen eine Aussage ueber die ganze Karte und gehoert deshalb hierher —
   in die Orchestrierung, die ohnehin ueber alle Elemente laeuft.

   Die Analyse liest ausschliesslich `el._netz`, das genRanke veroeffentlicht
   (Fusspunkte mit Radius, Plateaumitten mit halber Blattlaenge). Sie schreibt
   nichts zurueck, was die GEOMETRIE beeinflusst — nur `el._netzGrad`, und der
   wirkt einzig auf die Lichtstaerke (siehe refreshArborQuellen).

   Warum der Netzgrad NICHT in genRanke gelesen wird (die als optional
   ausgewiesene Kopplung): genRanke muesste dann bei jeder Aenderung eines
   NACHBARN neu laufen. Das Ein-Element-Dirty-Tracking (regenElement),
   history.js/restore und die Ladereihenfolge in rebuildAll kennen aber keine
   Komponenten — ein Element, das ein anderes betritt, wuerde still veralten.
   Der Netzgrad bleibt darum, wo er nichts kaputtmachen kann: im globalen
   Lichtpass, der bei jedem Commit ohnehin komplett neu gerechnet wird und
   ausschliesslich Uniforms schreibt. Der erzaehlerische Effekt aus B1
   (isolierte Triebe leuchten schwaecher, das vernetzte Zentrum staerker) ist
   damit vollstaendig da; nur das Ranken-Mesh selbst bleibt unabhaengig. */

/* Kopplungsschwelle am Fuss: Vielfaches der Fussradien. 4.6 ist NICHT
   gegriffen, sondern genau die Reichweite des Wurzeltellers in vines.js —
   dort laufen die Wurzeln bis `R * rr(rW, 1.6, 4.6)` und der Erdhuegel ist
   `moundGeo(R * 4.6, ...)`. Zwei Ranken, deren Wurzelteller einander
   beruehren, sind also im Bild WIRKLICH zusammengewachsen. */
var NETZ_WURZEL = 4.6;
/* Kopplungsschwelle oben: Plateaus gelten als verbunden, wenn sich ihre
   Blaetter ueberlappen (Summe der halben Blattlaengen) ODER wenn zwischen
   ihnen eine Haengebruecke moeglich waere. 55 ist dieselbe Spannweite, ab
   der genRanke innerhalb EINES Elements keine Bruecke mehr baut — die
   Netzanalyse benutzt damit exakt das Kriterium, das die Geometrie selbst
   schon kennt, statt eine zweite Zahl zu erfinden. */
var NETZ_SPANN = 55;
/* Lichtdaempfung des am schwaechsten vernetzten Triebes. */
var NETZ_LICHT_MIN = 0.55;

/** Netzgeometrie eines Ranken-Elements. genRanke setzt `_netz`; fehlt es
 *  (Element noch nie erzeugt), genuegen die Fusspunkte aus el.points. */
function netzDatenVon(el) {
  if (el._netz && el._netz.fuesse && el._netz.fuesse.length) return el._netz;
  var pr = el.params || {}, f = [];
  for (var i = 0; i < el.points.length; i++) {
    f.push({ x: el.points[i].x, z: el.points[i].z, r: VINE_R * (pr.dicke || 1) });
  }
  return { fuesse: f, plateaus: [] };
}

/** Sind zwei Rankennetze verbunden? Reine Geometrie, kein Zufall. */
function netzeVerbunden(a, b) {
  var i, j, dx, dy, dz, s;
  var fa = a.fuesse, fb = b.fuesse;
  for (i = 0; i < fa.length; i++) {
    for (j = 0; j < fb.length; j++) {
      dx = fa[i].x - fb[j].x; dz = fa[i].z - fb[j].z;
      s = NETZ_WURZEL * (fa[i].r + fb[j].r);
      if (dx * dx + dz * dz < s * s) return true;
    }
  }
  var pa = a.plateaus, pb = b.plateaus;
  for (i = 0; i < pa.length; i++) {
    for (j = 0; j < pb.length; j++) {
      dx = pa[i].x - pb[j].x; dy = pa[i].y - pb[j].y; dz = pa[i].z - pb[j].z;
      // pa.r/pb.r sind bereits HALBE Blattlaengen — ihre Summe ist der
      // Beruehrungsabstand der beiden Blaetter.
      s = Math.max(pa[i].r + pb[j].r, NETZ_SPANN);
      if (dx * dx + dy * dy + dz * dz < s * s) return true;
    }
  }
  return false;
}

/**
 * B1 — Zusammenhangskomponenten aller Ranken der Karte.
 *
 * Verfahren: Union-Find ueber alle Paare. Aufwand O(n² · (f² + p²)) mit n =
 * Ranken, f = Fuesse je Ranke (1..wenige), p = Plateaus (0..6) — bei den
 * realistischen Kartengroessen sind das ein paar hundert Abstandsquadrate
 * und damit billiger als ein einziges emit(). Deterministisch: keine
 * Zufallsquelle, und beim Vereinigen gewinnt immer der kleinere Index, die
 * Komponentenwurzeln haengen also nicht an der Vergleichsreihenfolge.
 *
 * `netzGrad` = Komponentengroesse / groesste Komponentengroesse, also 0..1
 * mit 1 fuer das Zentrum. Diese Normierung ist bewusst RELATIV gewaehlt:
 * gibt es keine einzige Verwachsung, sind alle Komponenten gleich gross,
 * jeder Netzgrad ist exakt 1 und die Lichtrechnung bleibt Zahl fuer Zahl die
 * bisherige. Erst wenn wirklich ein Buendel entsteht, faellt die Peripherie
 * ab — genau die Aussage von B1 und keine einzige Aenderung darueber hinaus.
 *
 * Rueckgabe: [{ el, komponente, groesse, netzGrad }] in Elementreihenfolge.
 * Nebenwirkung: setzt `el._netzGrad` (nicht serialisiert, siehe
 * serializeElements-Whitelist in store.js).
 */
function rankenNetz() {
  var ranken = [], daten = [], i, j;
  for (i = 0; i < S.elements.length; i++) {
    var el = S.elements[i];
    if (el.kind !== "ranke" || !el.points.length) continue;
    ranken.push(el);
    daten.push(netzDatenVon(el));
  }
  var n = ranken.length, vater = [];
  for (i = 0; i < n; i++) vater.push(i);
  function wurzel(x) {
    while (vater[x] !== x) { vater[x] = vater[vater[x]]; x = vater[x]; }
    return x;
  }
  for (i = 0; i < n; i++) {
    for (j = i + 1; j < n; j++) {
      if (!netzeVerbunden(daten[i], daten[j])) continue;
      var wi = wurzel(i), wj = wurzel(j);
      if (wi !== wj) vater[wi < wj ? wj : wi] = wi < wj ? wi : wj;
    }
  }
  var groesse = [], maxG = 1;
  for (i = 0; i < n; i++) groesse.push(0);
  for (i = 0; i < n; i++) groesse[wurzel(i)]++;
  for (i = 0; i < n; i++) if (groesse[i] > maxG) maxG = groesse[i];
  var out = [];
  for (i = 0; i < n; i++) {
    var w = wurzel(i), g = groesse[w], grad = g / maxG;
    ranken[i]._netzGrad = grad;
    out.push({ el: ranken[i], komponente: w, groesse: g, netzGrad: grad });
  }
  return out;
}

/** Lichtfaktor aus dem Netzgrad. Bei Netzgrad 1 EXAKT 1 (nicht ueber lerp
 *  gerechnet — 0.55 ist binaer nicht darstellbar, und der Regelfall soll
 *  bitgenau die Eins sein). */
function netzGewicht(grad) {
  if (!(grad < 1)) return 1;
  return lerp(NETZ_LICHT_MIN, 1, grad < 0 ? 0 : grad);
}

/**
 * Meldet die Rankenfuesse als Arbor-Lichtquellen an den Shader (H3).
 * Kanon: Arbor haelt den zerrissenen Planeten zusammen und spendet der Welt
 * Licht — die Ranken muessen ihre Umgebung also wirklich aufhellen, nicht nur
 * selbst hell sein. genRanke setzt `el._arbor` (mehrere Fuesse, eigene Radien
 * und die Alterung aus B2); fehlt das Feld — das Element wurde noch nie
 * erzeugt —, wird dieselbe Formel ersatzweise aus points/params gerechnet.
 *
 * B1: Die Staerke jeder Quelle wird mit dem Netzgrad ihres Elements
 * gewichtet. Die Eintraege werden dabei KOPIERT, nicht in `_arbor`
 * multipliziert — sonst wuerde sich der Faktor ueber die vielen Aufrufe
 * dieser Funktion aufmultiplizieren.
 */
function refreshArborQuellen() {
  var netz = rankenNetz();
  var q = [], i, k;
  for (i = 0; i < netz.length; i++) {
    var el = netz[i].el, g = netzGewicht(netz[i].netzGrad);
    if (el._arbor && el._arbor.length) {
      for (k = 0; k < el._arbor.length; k++) {
        var a = el._arbor[k];
        q.push({ x: a.x, z: a.z, radius: a.radius, staerke: a.staerke * g });
      }
      continue;
    }
    var pr = el.params || {};
    for (k = 0; k < el.points.length; k++) {
      q.push({
        x: el.points[k].x, z: el.points[k].z,
        radius: VINE_R * (pr.dicke || 1),
        // Hohe Ranken tragen weiter: 220 Einheiten sind die volle Staerke.
        staerke: Math.min(1, (pr.hoehe || 0) / 220) * g
      });
    }
  }
  setArborQuellen(q);
}

/** Loeschen mit Dirty-Meldung der betroffenen Pools. */
function deleteElement(el) {
  markDirty(Object.keys(el.inst));
  dropElement(el);
  refreshArborQuellen();
}

export { genElement, regenElement, regenAlleElemente, rebuildRivers, rebuildBrueche, rebuildCorridors,
  rebuildAll, commit, isHeavy, deleteElement, refreshArborQuellen,
  rankenNetz, netzGewicht,
  // I2 — die Uebersetzung des Biompinsels in Flaechenquellen. Exportiert, weil
  // sie ohne Bild pruefbar ist: sie ist reine Geometrie.
  biomQuellen, pinselTupfer, kreisPolygon,
  markDirty, flushPack };
