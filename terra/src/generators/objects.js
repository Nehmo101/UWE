// Platzierungsregeln (Wasser, Hang, Korridor, Kollision), Kulturtabellen
// und das Objekt-Werkzeug.
import * as THREE from 'three';
import { clamp, hashi, rngOf, rr, ri, wpick } from '../core/rng.js';
import { S, HALF, WATER, COS40, groupOf } from '../core/store.js';
import { POOLS, emit, tintOf } from '../core/pools.js';
import { ARCHITEKTUR_STIL_TABELLEN } from '../assets/architektur-katalog.js';
import { heightAt, slopeAt, inCorridor } from '../world/terrain.js';
import { FENSTER_ANKER, LICHT_ANKER, islandGeo, leafSurface, leafHalfWidth } from './geometry.js';
import { genWeltschildkroete } from './weltschildkroete.js';
import { genLuftarchipelObjekt, genRiesenbambusObjekt } from './luftobjekte.js';
import { baueAssetSchauLayout, setzeAssetSchauInstanzen } from './asset-schau.js';
import { baueAssetSchauMeshes } from './asset-schau-meshes.js';
import { rockMat } from '../render/materials.js';
// I1: Kartenzeichen (siehe generators/zeichen.js). Die Richtung ist
// objects.js -> zeichen.js, nie zurueck.
import { alsKoerper, alsZeichen, kartenPlatz, punktZeichen, mitteVon,
  bandZeichen, gratPunkte, wasserlinie } from './zeichen.js';

function newOcc(cell) { return { cell: cell || 3.5, map: {} }; }

function occFree(occ, x, z, r) {
  var cx = Math.floor(x / occ.cell), cz = Math.floor(z / occ.cell);
  for (var a = -1; a <= 1; a++) {
    for (var b = -1; b <= 1; b++) {
      var arr = occ.map[(cx + a) + "|" + (cz + b)];
      if (!arr) continue;
      for (var k = 0; k < arr.length; k += 3) {
        var dx = arr[k] - x, dz = arr[k + 1] - z, rr2 = arr[k + 2] + r;
        if (dx * dx + dz * dz < rr2 * rr2) return false;
      }
    }
  }
  return true;
}

function occAdd(occ, x, z, r) {
  var key = Math.floor(x / occ.cell) + "|" + Math.floor(z / occ.cell);
  var arr = occ.map[key] || (occ.map[key] = []);
  arr.push(x, z, r);
}

/**
 * Prüft alle verbindlichen Regeln und liefert die Bodenhöhe zurück
 * (oder null, wenn hier nichts stehen darf).
 */
function tryPlace(occ, x, z, r, opts) {
  if (x < -HALF + 1 || x > HALF - 1 || z < -HALF + 1 || z > HALF - 1) return null;
  var h = heightAt(x, z);
  if (h < WATER + 0.35) return null;                       // nichts im Wasser
  if (slopeAt(x, z) < COS40) return null;                   // nichts an Steilhängen
  if (!(opts && opts.ignoreCorridor) && inCorridor(x, z)) return null;  // nichts auf Wegen
  if (occ && !occFree(occ, x, z, r)) return null;           // keine Überschneidung
  if (occ) occAdd(occ, x, z, r);
  return h;
}

/**
 * Gegenstueck zu tryPlace fuer die Wasserobjekte (Objektkatalog, Regel "W").
 * Liefert WATER als Setzhoehe zurueck — ein Rumpf schwimmt auf dem Spiegel,
 * nicht auf dem Grund. Kartenrand und Belegungsraster gelten unveraendert.
 */
function tryPlaceWasser(occ, x, z, r) {
  if (x < -HALF + 1 || x > HALF - 1 || z < -HALF + 1 || z > HALF - 1) return null;
  // WATER - 0.3 statt WATER: die Uferbank liegt zwar unter dem Spiegel, ist
  // aber so flach, dass ein Boot dort aufsaesse. Das ist genau die Gegenprobe
  // zu tryPlace, das umgekehrt alles unter WATER + 0.35 verwirft — zwischen
  // beiden Schwellen liegt das Uferband von tryPlaceUfer.
  if (heightAt(x, z) >= WATER - 0.3) return null;
  // Hangneigung und Korridor bleiben BEWUSST ungeprueft: unter Wasser
  // beschreibt slopeAt die Beckenwand statt einer Standflaeche, und ein
  // Wegkorridor, der durch den See laeuft, ist keiner.
  if (occ && !occFree(occ, x, z, r)) return null;
  if (occ) occAdd(occ, x, z, r);
  return WATER;
}

/**
 * Gegenstueck fuer das Uferband (Regel "U"): schmaler Streifen beiderseits der
 * Wasserlinie. Rueckgabe ist { h, yaw } statt einer blossen Hoehe — Kai, Kran,
 * Slipbahn und Bootshaus sind auf ihre Wasserseite gebaut und muessen sich
 * danach ausrichten. Formalisiert damit die heute in dorfUfer (areas.js)
 * hartkodierte Gradientenlogik; dort steht sie mit einem asymmetrischen
 * Fenster (h > 0.4 || h < -2.5), hier mit dem symmetrischen Band aus dem
 * Katalog. Steilhang und Korridor sind wie bei tryPlaceWasser kein Kriterium:
 * das Ufer IST die Boeschung, und ein Weg endet am Anleger.
 */
function tryPlaceUfer(occ, x, z, r) {
  if (x < -HALF + 1 || x > HALF - 1 || z < -HALF + 1 || z > HALF - 1) return null;
  var h = heightAt(x, z);
  if (Math.abs(h - WATER) >= 0.8) return null;
  if (occ && !occFree(occ, x, z, r)) return null;
  // Blickrichtung aufs Wasser = bergab. Zentraldifferenz ueber 4 m wie in
  // dorfUfer: ein kleinerer Stuetzabstand nimmt die Duenung des
  // Terrainrauschens mit, statt der Uferlinie zu folgen.
  var dx = heightAt(x + 2, z) - heightAt(x - 2, z);
  var dz = heightAt(x, z + 2) - heightAt(x, z - 2);
  // Auf einer exakt ebenen Stelle liefert atan2(0, 0) den Wert 0, das Objekt
  // blickt dann nach +z. Ohne Gefaelle gibt es keine bessere Antwort.
  var yaw = Math.atan2(-dx, -dz);
  if (occ) occAdd(occ, x, z, r);
  return { h: h, yaw: yaw };
}

/**
 * Dritte Regel des Objektkatalogs ("Fr" — keine Bodenregeln), Gegenstueck zu
 * tryPlace fuer alles, was schwebt oder an einer Ranke haengt: Moewe,
 * Schwebescholle, Sturzwurzel, Gleiter, Sporenlaterne. Begruendung wie bei
 * genInseln: Wasserverbot, Steilhangverbot und Korridorverbot gelten fuer
 * BODENSTAENDIGE Objekte — eine fliegende Moewe darf ueber allem haengen.
 * Rueckgabe ist die Bodenhoehe; die Flughoehe legt genObjekt darueber, damit
 * die Silhouette dem Gelaende folgt statt in einen Hang zu tauchen.
 */
function tryPlaceFrei(occ, x, z, r) {
  if (x < -HALF + 1 || x > HALF - 1 || z < -HALF + 1 || z > HALF - 1) return null;
  if (occ && !occFree(occ, x, z, r)) return null;
  if (occ) occAdd(occ, x, z, r);
  return heightAt(x, z);
}

/* ==========================================================================
   Objekte AUF Blattplateaus (Bedienungsrunde)

   genRanke legt seine Plateau-Rahmen ({ L, W, cup, full }) als Laufzeitfeld
   `el.plateaus` ab (generators/vines.js) — dieselben Matrizen, mit denen die
   Blattstadt baut. `plateauHoeheAt` beantwortet daraus die Frage „liegt ueber
   (x,z) eine Blattoberflaeche, und wie hoch?“ — das heightAt-Surrogat fuer
   von Hand gesetzte Objekte (params.aufPlateau, siehe genObjekt).

   WARUM DIE FUNKTION HIER LIEGT und nicht in vines.js, wo die Plateaus
   entstehen: vines.js importiert objects.js (occFree/occAdd/KULTUR) — die
   Gegenrichtung waere ein Zyklus. Gebraucht werden nur leafSurface/
   leafHalfWidth (geometry.js, laengst ein Import dieses Moduls) und die am
   Element hinterlegten Matrizen.

   Die Umkehrung Welt -> Blatt braucht eine Hoehe, die erst das Ergebnis ist
   (die Kippmatrix mischt x und y). Deshalb ein Fixpunkt: mit der Hoehe der
   Blattmitte starten, in Blattkoordinaten wandeln, die Oberflaechenhoehe
   ablesen, wiederholen. Der Kippwinkel ist klein (droop -0.1 rad), drei
   Runden genuegen; die Rueckprobe am Ende verwirft alles, was nicht wirklich
   senkrecht unter/ueber dem Blatt liegt.
   ========================================================================== */
var _plV = new THREE.Vector3();

/** Hoechste Blattoberflaeche ueber (x,z) in Welthoehe — oder null. */
function plateauHoeheAt(x, z) {
  var best = null;
  for (var i = 0; i < S.elements.length; i++) {
    var e = S.elements[i];
    if (e.kind !== "ranke" || !Array.isArray(e.plateaus)) continue;
    for (var k = 0; k < e.plateaus.length; k++) {
      var P = e.plateaus[k];
      if (!P || !P.full || !(P.L > 0)) continue;
      if (!P.inv) P.inv = new THREE.Matrix4().copy(P.full).invert();
      // Starthoehe: die Blattmitte in Welthoehe.
      _plV.set(0.5 * P.L, leafSurface(0.5, 0, P.L, P.cup), 0).applyMatrix4(P.full);
      var y = _plV.y, u = 0, v = 0, ok = false;
      for (var it = 0; it < 3; it++) {
        _plV.set(x, y, z).applyMatrix4(P.inv);
        u = _plV.x / P.L;
        if (!(u > 0.03 && u < 0.99)) { ok = false; break; }
        var hw = leafHalfWidth(u) * P.W;
        if (!(hw > 1e-6)) { ok = false; break; }
        v = _plV.z / hw;
        if (!(v > -1 && v < 1)) { ok = false; break; }
        _plV.set(u * P.L, leafSurface(u, v, P.L, P.cup), v * hw).applyMatrix4(P.full);
        y = _plV.y;
        ok = true;
      }
      if (!ok) continue;
      // Rueckprobe: der Fixpunkt muss wirklich ueber (x,z) gelandet sein.
      var dx = _plV.x - x, dz = _plV.z - z;
      if (dx * dx + dz * dz > 1.5 * 1.5) continue;
      if (best === null || _plV.y > best) best = _plV.y;
    }
  }
  return best;
}

/**
 * Platzierung auf der Blattoberflaeche — das tryPlace der Plateaus. Wasser-,
 * Hang- und Korridorregel entfallen (alles Terrainbegriffe); es bleiben
 * Blattkontur (in plateauHoeheAt) und Belegungsraster.
 */
function tryPlacePlateau(occ, x, z, r) {
  var h = plateauHoeheAt(x, z);
  if (h === null) return null;
  if (occ && !occFree(occ, x, z, r)) return null;
  if (occ) occAdd(occ, x, z, r);
  return h;
}

var KULTUR = {
  dorf:      [["haus", 6], ["hausA", 3], ["hausB", 3], ["hausC", 2], ["scheune", 2],
              ["windmuehle", 1], ["turm", 1], ["brunnen", 1], ["karren", 1],
              ["marktstand", 1], ["heuhaufen", 1], ["busch", 2]],
  klassisch: [["villa", 6], ["arkade", 4], ["kuppel", 3], ["tholos", 1], ["tempel", 1],
              ["bogen", 1], ["saeule", 2], ["laterne", 1], ["zypresse", 2]],
  zwergisch: [["zwergenhalle", 6], ["schmiedeturm", 4], ["zwergentor", 1], ["mauer", 2],
              ["turm", 2], ["fass", 2], ["kiste", 1], ["fels", 2]],
  elfisch:   [["elfenturm", 5], ["pavillon", 5], ["haus2", 2], ["kuppel", 1], ["baum2", 3]],
  werk:      [["industrie", 5], ["schmiedeturm", 3], ["haus", 3], ["kran", 2], ["turm", 1]],
  ruine:     [["saeule", 5], ["bogen", 2], ["mauer", 3], ["fels", 2], ["busch", 2]],
  gemischt:  [["haus", 3], ["hausA", 1], ["hausB", 1], ["haus2", 3], ["villa", 3], ["arkade", 2], ["kuppel", 2],
              ["elfenturm", 2], ["pavillon", 2], ["zwergenhalle", 2], ["schmiedeturm", 1],
              ["scheune", 2], ["windmuehle", 1], ["turm", 1], ["tholos", 1]]
};
/* Wehrbau (Objektkatalog, Bündel 1). NUR NEUE Einträge — die Tabellen oben
   bleiben unangetastet, weil jede Gewichtsänderung dort die Bestückung
   bestehender Karten umwürfelt (wpick zieht aus der Gesamtsumme). */
KULTUR.burg = [["burgpalas", 3], ["burgkapelle", 2], ["burgkueche", 2],
               ["wehrturm", 3], ["bergfried", 1], ["mauerstueck", 4],
               ["mauerecke", 2], ["mauerdurchlass", 1], ["mauertreppe", 1],
               ["zwingermauer", 2], ["schildmauer", 1], ["brunnen", 1],
               ["wehrbanner", 1], ["fass", 1], ["karren", 1]];
KULTUR.schloss = [["schlossfluegel", 5], ["schlossturmhaube", 2], ["schlossportal", 1],
                  ["burgpalas", 2], ["haus2", 2], ["villa", 2], ["arkade", 2],
                  ["laterne", 2], ["zypresse", 2], ["pavillon", 1]];
KULTUR.holzburg = [["palisade", 6], ["palisadentor", 1], ["wachturm", 3],
                   ["haus", 3], ["hausC", 2], ["scheune", 2], ["heuhaufen", 1],
                   ["karren", 1], ["fass", 1]];
KULTUR.wohn = KULTUR.dorf;          // Rückwärtskompatibilität für alte Karten

/* Katalogbündel 4–15 (Landwirtschaft, Handwerk, Sakral, Wohnbau, Biome,
   Requisiten, Tiere). Auch hier gilt: NUR NEUE Schlüssel. Die neun Tabellen
   oben behalten Wort für Wort ihre Gewichte, sonst würfelt wpick jede
   bestehende Karte neu aus. */
KULTUR.bauern = [["viehstall", 3], ["kornspeicher", 3], ["heuschober", 3],
                 ["scheune", 3], ["hausC", 3], ["haus", 2], ["pferch", 2],
                 ["ackerscholle", 3], ["dreschtenne", 1], ["taubenschlag", 1],
                 ["bienenstand", 1], ["vogelscheuche", 2], ["garbe", 2],
                 ["holzstapel", 2], ["schubkarre", 1], ["rind", 2], ["schaf", 2]];
KULTUR.handwerk = [["schmiede", 3], ["ziegelofen", 2], ["glashuette", 2],
                   ["gerbergruben", 2], ["faerbergestell", 2], ["steinmetzhof", 2],
                   ["lagerhaus", 2], ["koehlermeiler", 2], ["hochschlot", 1],
                   ["saegewerk", 1], ["seilerbahn", 1], ["holzstapel", 3],
                   ["fass", 2], ["kiste", 2], ["karren", 1]];
KULTUR.kloster = [["kapelle", 4], ["glockenturm", 2], ["kathedralenschiff", 1],
                  ["arkade", 3], ["bildstock", 2], ["gartenbeet", 3],
                  ["brunnen", 1], ["zypresse", 3], ["obstbaum", 2], ["bank", 2]];
KULTUR.stadt = [["turmhaus", 4], ["giebelhaus", 4], ["haus2", 3], ["laubenhaus", 3],
                ["hofdurchfahrt", 2], ["wohnblock", 2], ["villa", 1],
                ["laterne", 2], ["marktstand", 1], ["brunnen", 1], ["tisch", 1]];
KULTUR.nordisch = [["langhaus", 4], ["grubenhaus", 3], ["hausC", 2], ["scheune", 2],
                   ["palisade", 2], ["holzstapel", 2], ["heuhaufen", 1],
                   ["feuerstelle", 1], ["nadelbaum", 2]];
KULTUR.eis = [["iglu", 4], ["pelzzelt", 4], ["eisfischerhuette", 2], ["schneewall", 3],
              ["eisfels", 3], ["schlitten", 2], ["geweihgestell", 2],
              ["thermalquelle", 1], ["gletschertor", 1]];
KULTUR.wueste = [["lehmkuppelhaus", 4], ["wuestenzelt", 3], ["kleinzelt", 3],
                 ["lehmspeicher", 3], ["windfaenger", 2], ["zisterne", 1],
                 ["oasenbecken", 1], ["traenke", 2], ["palme", 3], ["obelisk", 1],
                 ["tontoepfe", 2], ["marktkorb", 1]];
KULTUR.moor = [["moorhuette", 4], ["torfstich", 2], ["torfstapel", 3],
               ["pfahlgoetze", 2], ["moorsteg", 2], ["wollgras", 3],
               ["sumpfbaum", 2], ["irrlicht", 1], ["stumpf", 2]];
KULTUR.arbor = [["rankenhaus", 3], ["samenkapsel", 3], ["huetersaeule", 2],
                ["arborschrein", 2], ["rankenaltar", 2], ["rankentor", 1],
                ["lichtsammler", 2], ["samenreliquiar", 1], ["blattkanzel", 1],
                ["rankenleiter", 2], ["lichtbluete", 3], ["sporenlaterne", 3],
                ["saftzapfer", 2], ["leuchtpilz", 2]];

var OBJGRUPPEN = {
  baeume: [["baum", 4], ["baum2", 3], ["nadelbaum", 3], ["sumpfbaum", 1],
           ["bluetenbaum", 1], ["zypresse", 2], ["busch", 3]],
  haeuser: [["haus", 5], ["haus2", 4], ["turm", 2], ["kuppel", 2], ["arkade", 1],
            ["scheune", 2], ["windmuehle", 1]],
  klassisch: [["villa", 3], ["tholos", 2], ["tempel", 1], ["bogen", 2], ["saeule", 4], ["arkade", 2]],
  zwergisch: [["zwergenhalle", 3], ["schmiedeturm", 3], ["zwergentor", 2], ["mauer", 2]],
  elfisch: [["elfenturm", 3], ["pavillon", 3], ["baum2", 2]],
  ruinen: [["saeule", 5], ["mauer", 3], ["fels", 2]],
  felsen: [["fels", 7], ["busch", 2]],
  werk: [["industrie", 3], ["kran", 2], ["haus", 2]],
  natur: [["busch", 4], ["blume", 5], ["gras", 6], ["fels", 1]],
  /* Neue Gruppe, kein Eingriff in die bestehenden: die Wehrbau-Pools sollen
     streubar sein, bevor genBurg (Bündel 2) sie zu einer Anlage ordnet. Die
     Einzelstücke (bergfried, torhaus, barbakane, bastion) sind bewusst
     schwach gewichtet — sie sind teuer und wirken vervielfacht wie Kulisse. */
  wehrbau: [["mauerstueck", 6], ["mauerecke", 3], ["mauerdurchlass", 2],
            ["mauerbogen", 2], ["zwingermauer", 3], ["mauertreppe", 2],
            ["schildmauer", 2], ["wehrturm", 4], ["geschuetzturm", 2],
            ["bergfried", 1], ["torhaus", 1], ["barbakane", 1], ["bastion", 1],
            ["kettenturm", 1], ["wappenstein", 1], ["wehrbanner", 2]],
  palisaden: [["palisade", 7], ["palisadentor", 1], ["wachturm", 2], ["pfosten", 2]],
  /* Maritim (Buendel 3). Diese Gruppe wird von genObjekt ueber tryPlaceWasser
     gesetzt — sie enthaelt AUSSCHLIESSLICH Objekte, die auf dem Wasser stehen
     duerfen. Die teuren Einzelstuecke (kogge, dreimaster, ruderschiff, wrack)
     bleiben schwach gewichtet: vervielfacht wirkt eine Flotte wie Kulisse,
     einzeln wie ein Ereignis. Die Bruecken sind mit dabei, weil ihr Feld
     definitionsgemaess ueber dem Wasser liegt. */
  maritim: [["fischerboot", 6], ["kutter", 3], ["floss", 3], ["boje", 4],
            ["bake", 3], ["kogge", 1], ["dreimaster", 1], ["ruderschiff", 1],
            ["wrack", 1], ["holzbruecke", 1], ["steinbruecke", 1]],
  /* Hafen (Buendel 3): das Uferband. genObjekt setzt sie ueber tryPlaceUfer und
     dreht sie mit dem Hoehengradienten aufs Wasser zu. Kleinkram vor Bauwerk —
     ein Kai lebt von Tauhaufen und Reusen, nicht von drei Kraenen. */
  hafen: [["kaimauer", 5], ["anleger", 4], ["tauhaufen", 4], ["reusenstapel", 3],
          ["netzgestell", 3], ["kaitreppe", 3], ["fischtrockner", 2],
          ["hafenlaterne", 3], ["bootshaus", 2], ["uferdamm", 2], ["kaikran", 2],
          ["leuchtfeuer", 2], ["slipbahn", 1], ["salzgarten", 1],
          ["werfthalle", 1], ["helling", 1], ["leuchtturm", 1], ["kanalschleuse", 1]],

  /* --- Katalogbündel 4–15. Ausschliesslich NEUE Gruppen: die neun oben
     behalten ihre Einträge und Gewichte unverändert, damit bestehende Karten
     exakt dieselbe Bestückung behalten. Durchgehendes Gewichtsprinzip:
     Streuware hoch, Einzelstücke auf 1 — vervielfacht wirkt ein Einzelstück
     wie Kulisse, einzeln wie ein Ereignis. */

  /* Fels- und Pilzformationen. Trägt die neuen Biome (Vulkan, Pilzwald,
     Bambus, Geysirfeld) und ergänzt die bestehende, magere "felsen"-Gruppe,
     ohne sie anzufassen. */
  natur2: [["findling", 5], ["geroell", 6], ["felsnadel", 4], ["basaltsaeulen", 3],
           ["dornbusch", 4], ["bambus", 4], ["blumenteppich", 4], ["riesenpilz", 2],
           ["leuchtpilz", 3], ["pilzhut", 2], ["schlammtopf", 2], ["geysir", 1],
           ["felsbogen", 1], ["lavaspalte", 1]],
  /* Ruinen aus bruchkante(). Bewusst getrennt von der Bestandsgruppe "ruinen"
     (saeule/mauer/fels), die als grobe Kulisse weiterlebt. */
  ruinen2: [["mauerruine", 5], ["truemmerhaufen", 4], ["saeulenstumpf", 4],
            ["statuentorso", 2], ["ruinenturm", 2], ["giebelruine", 2],
            ["treppenruine", 2], ["gewoelbekeller", 1], ["rissspalt", 1],
            ["tempelruine", 1], ["bruchkante", 1], ["rosette", 1]],
  /* Arbor: die weisse, leuchtende Seite des Settings. Die kleinen Leuchten
     sind hoch gewichtet — sie tragen die Stimmung, die Bauten sind der Anlass. */
  arbor: [["lichtbluete", 5], ["sporenlaterne", 5], ["huetersaeule", 3],
          ["rankenaltar", 3], ["arborschrein", 3], ["saftzapfer", 3],
          ["rankenleiter", 2], ["wurzelanker", 2], ["wurzelbogen", 2],
          ["samenkapsel", 2], ["lichtsammler", 2], ["rankentor", 2],
          ["rankenknoten", 1], ["rankenstamm", 1], ["samenreliquiar", 1],
          ["blattkanzel", 1], ["blattsteg", 1], ["rankenkai", 1], ["rankentreppe", 1]],
  eis: [["eisfels", 5], ["schneewall", 4], ["pelzzelt", 3], ["iglu", 3],
        ["schlitten", 3], ["geweihgestell", 2], ["eisfischerhuette", 2],
        ["thermalquelle", 2], ["gletschertor", 1]],
  wueste: [["palme", 5], ["sandwehe", 4], ["kleinzelt", 3], ["lehmspeicher", 3],
           ["traenke", 3], ["gebein", 3], ["wuestenzelt", 2], ["windfaenger", 2],
           ["lehmkuppelhaus", 2], ["obelisk", 2], ["oasenbecken", 1], ["zisterne", 1]],
  moor: [["wollgras", 6], ["torfstapel", 4], ["pfahlgoetze", 3], ["irrlicht", 3],
         ["torfstich", 2], ["moorhuette", 2], ["dornbusch", 2], ["stumpf", 2]],
  /* Landwirtschaft: der bewirtschaftete Gürtel ums Dorf. */
  hof: [["ackerscholle", 5], ["garbe", 4], ["rebenreihe", 4], ["vogelscheuche", 3],
        ["heuschober", 3], ["obstbaum", 3], ["pferch", 2], ["bienenstand", 2],
        ["taubenschlag", 2], ["kornspeicher", 2], ["viehstall", 2],
        ["hopfengeruest", 2], ["dreschtenne", 1], ["terrassenfeld", 1],
        ["wassermuehle", 1]],
  handwerk: [["holzstapel", 4], ["koehlermeiler", 3], ["schmiede", 3],
             ["steinmetzhof", 3], ["faerbergestell", 2], ["gerbergruben", 2],
             ["ziegelofen", 2], ["kalkofen", 2], ["glashuette", 2],
             ["windpumpe", 2], ["lagerhaus", 2], ["hochschlot", 1],
             ["saegewerk", 1], ["seilerbahn", 1], ["wasserrad", 1]],
  sakral: [["bildstock", 5], ["menhir", 4], ["opferstein", 3], ["feuerschale", 3],
           ["gebetsband", 3], ["kapelle", 2], ["glockenturm", 2], ["grabhuegel", 2],
           ["steinkreis", 1], ["kathedralenschiff", 1]],
  wohnbau: [["turmhaus", 4], ["giebelhaus", 4], ["grubenhaus", 3], ["langhaus", 3],
            ["laubenhaus", 2], ["hofdurchfahrt", 2], ["baumhaus", 2],
            ["stollenhaus", 2], ["elfenlaube", 2], ["wohnblock", 1],
            ["gaube", 1], ["kamin", 1]],
  requisiten: [["holzstapel", 4], ["bank", 4], ["tontoepfe", 4], ["sackstapel", 3],
               ["wagenrad", 3], ["leiter", 3], ["wasserbottich", 3], ["tisch", 3],
               ["lattenzaun", 3], ["gartenbeet", 3], ["marktkorb", 3],
               ["schubkarre", 2], ["waescheleine", 2], ["feuerstelle", 2],
               ["kochkessel", 2], ["brunnentrog", 2], ["blumenkasten", 1]],
  tiere: [["schaf", 5], ["rind", 4], ["ziege", 3], ["pferd", 3], ["kutsche", 1],
          ["ochsengespann", 1]],
  /* Wasserflora: dieselbe invertierte Regel wie "maritim" (siehe genObjekt) —
     diese Gruppe steht AUF dem Wasser, nicht daneben. */
  wasserflora: [["seerose", 5], ["schilf", 5], ["seetang", 4], ["koralle", 3],
                ["aalreuse", 2], ["moorkahn", 2], ["moorsteg", 2], ["eisscholle", 2]],
  /* Uferband wie "hafen", aber die Naturseite davon. */
  ufer2: [["muschelbank", 5], ["treibholz", 4], ["schilf", 4], ["wollgras", 3],
          ["wurzelstelze", 2], ["kaskadenstufe", 2], ["pfahlhaus", 2],
          ["wasserrad", 1], ["eisfischerhuette", 1]],
  /* Schwebendes (Regel "Fr", siehe tryPlaceFrei): ueber tryPlace waere davon
     kein Stueck platzierbar, und ohne Gruppe waere es nur ueber nurTyp
     erreichbar. Die Flughoehe kommt in genObjekt dazu. */
  schwebend: [["moewe", 6], ["sporenlaterne", 4], ["lichtbluete", 3],
              ["schwebefels", 2], ["sturzwurzel", 2], ["rankengleiter", 1]]
};

/*
 * Die 12 neuen Architekturwelten sind gleichzeitig Kultur (fuer Viertel,
 * Strassen und Blattstaedte) und Objektgruppe (fuer freie Streuung). Beide
 * Registry-Zweige verweisen auf dieselben unveraenderlichen Tabellen.
 */
for (var architekturStil in ARCHITEKTUR_STIL_TABELLEN) {
  KULTUR[architekturStil] = ARCHITEKTUR_STIL_TABELLEN[architekturStil];
  OBJGRUPPEN[architekturStil] = ARCHITEKTUR_STIL_TABELLEN[architekturStil];
}

/* ==========================================================================
   I1 — Was aus einer Objektstreuung wird, wenn man herauszoomt

   Der Katalog nennt Zeichen; die schwierigere Haelfte ist die Zuordnung. Eine
   Objektstreuung ist die vielfaeltigste Sache in Terra — dieselbe Mechanik
   traegt Baeume, Schiffe, Ruinen, Marktkoerbe und Moewen —, und genau deshalb
   steht die Zuordnung hier als TABELLE und nicht als Kette von else-if.

   Drei Arten von Eintrag:

     { sache, art }   die Gruppe bekommt EIN Zeichen an ihrem Schwerpunkt.
                      `art` waehlt daraus das konkrete Zeichen; `sache`
                      entscheidet ueber Band und Rueckfall.
     { relief: 1 }    das Zeichen folgt dem KAMM, nicht dem Klickpunkt
                      (Fels- und Gebirgsgruppen, siehe reliefZeichen).
     { kueste: 1 }    das Zeichen folgt der WASSERLINIE (Naturufer).
     { auf: '…' }     bewusst weggelassen, mit Begruendung.

   Der letzte Fall ist der wichtigste: er macht das Weglassen zu einer
   EINTRAGUNG statt zu einer Luecke. Eine Luecke sieht im Betrieb genauso aus
   wie ein Fehler — und ist einer, wenn sie niemand entschieden hat.

   Ein Zeichen je GRUPPE, nicht je Objekt: neun Findlinge sind auf einer
   Regionskarte kein Neunfaches von irgendetwas, sie sind eine Felsgruppe.
   ========================================================================== */
var OBJEKT_ZEICHEN = {
  baeume:      { sache: 'wald' },
  // Bauten: welches Ortszeichen es wird, entscheidet die Kennzahl weiter
  // unten — acht Haeuser sind ein Weiler, neun ein Dorf.
  haeuser:     { sache: 'ort' },
  wohnbau:     { sache: 'ort' },
  klassisch:   { sache: 'ort' },
  zwergisch:   { sache: 'ort' },
  elfisch:     { sache: 'ort' },
  ruinen:      { sache: 'ruine', art: 'sig_ruine' },
  ruinen2:     { sache: 'ruine', art: 'sig_ruine' },
  felsen:      { relief: 1 },
  natur2:      { relief: 1 },
  natur:       { sache: 'acker', art: 'sig_weide' },
  tiere:       { sache: 'acker', art: 'sig_weide' },
  hof:         { sache: 'acker', art: 'sig_obstgarten' },
  werk:        { sache: 'werk', art: 'sig_mine' },
  handwerk:    { sache: 'werk', art: 'sig_muehle' },
  wehrbau:     { sache: 'wehrbau', art: 'sig_burg' },
  palisaden:   { sache: 'wehrbau', art: 'sig_burg' },
  sakral:      { sache: 'wehrbau', art: 'sig_kloster' },
  hafen:       { sache: 'hafen', art: 'sig_hafen' },
  // Der Anker ist auf jeder Seekarte das Zeichen fuer den ANKERPLATZ, nicht
  // fuer das einzelne Schiff. Eine Schiffsgruppe ist genau das.
  maritim:     { sache: 'hafen', art: 'sig_hafen' },
  ufer2:       { kueste: 1 },
  wasserflora: { sache: 'nass', art: 'sig_sumpf' },
  moor:        { sache: 'nass', art: 'sig_moor' },
  eis:         { sache: 'kalt', art: 'sig_eis' },
  wueste:      { sache: 'trocken', art: 'sig_wueste' },
  arbor:       { sache: 'arbor', art: 'sig_rankenfuss' },
  inseln:      { sache: 'arbor', art: 'sig_lichtbruecke' },
  requisiten:  { auf: 'Hausrat geht in der Ortssignatur auf' },
  schwebend:   { auf: 'Fliegendes traegt keine Karte — eine Moewe ist kein Ort' }
};
for (var architekturZeichen in ARCHITEKTUR_STIL_TABELLEN) {
  OBJEKT_ZEICHEN[architekturZeichen] = { sache: 'ort' };
}
OBJEKT_ZEICHEN.weltschildkroete = { sache: 'wehrbau', art: 'sig_burg' };
/* Unbekannte Varianten alter Karten streuen Baeume und erhalten das Waldzeichen. */
var OBJEKT_ZEICHEN_VORGABE = OBJEKT_ZEICHEN.baeume;

/* Zwingt der Nutzer ueber `nurTyp` genau EINE Poolsorte, dann ist DAS die
   Sache — nicht die Gruppe, aus der der Pool zufaellig stammt. Ein Element
   aus zehn Wachtuermen ist keine Palisade und schon gar kein Wald.
   Aufgefuehrt sind nur Pools, die auf einer Karte wirklich ein eigenes
   Zeichen verdienen; alle uebrigen fallen auf ihre Gruppe zurueck. Erst
   ueber diesen Weg werden `sig_turm` und `sig_muehle` ueberhaupt
   erreichbar — es gibt keine Objektgruppe, die nur aus Tuermen bestuende. */
var POOL_ZEICHEN = {
  turm:        { sache: 'wehrbau', art: 'sig_turm' },
  wachturm:    { sache: 'wehrbau', art: 'sig_turm' },
  wehrturm:    { sache: 'wehrbau', art: 'sig_turm' },
  bergfried:   { sache: 'wehrbau', art: 'sig_turm' },
  elfenturm:   { sache: 'wehrbau', art: 'sig_turm' },
  schmiedeturm: { sache: 'werk', art: 'sig_mine' },
  windmuehle:  { sache: 'werk', art: 'sig_muehle' },
  wassermuehle: { sache: 'werk', art: 'sig_muehle' },
  saegewerk:   { sache: 'werk', art: 'sig_muehle' },
  leuchtturm:  { sache: 'hafen', art: 'sig_hafen' },
  leuchtfeuer: { sache: 'hafen', art: 'sig_hafen' },
  kapelle:     { sache: 'wehrbau', art: 'sig_kloster' },
  glockenturm: { sache: 'wehrbau', art: 'sig_kloster' },
  kathedralenschiff: { sache: 'wehrbau', art: 'sig_kloster' },
  ruinenturm:  { sache: 'ruine', art: 'sig_ruine' },
  mauerruine:  { sache: 'ruine', art: 'sig_ruine' },
  tempelruine: { sache: 'ruine', art: 'sig_ruine' }
};

/** Huellrechteck der Klickpunkte, um `saum` erweitert. */
function punkteBox(punkte, saum) {
  var x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (var i = 0; i < punkte.length; i++) {
    if (punkte[i].x < x0) x0 = punkte[i].x;
    if (punkte[i].x > x1) x1 = punkte[i].x;
    if (punkte[i].z < z0) z0 = punkte[i].z;
    if (punkte[i].z > z1) z1 = punkte[i].z;
  }
  return { x0: x0 - saum, z0: z0 - saum, x1: x1 + saum, z1: z1 + saum };
}

/** Reichweite einer Streuung: so weit, wie ihre Objekte tatsaechlich liegen
 *  (Klickpunkte plus Streuradius). Sie bestimmt, wie weit Kamm und Kueste
 *  gesucht werden — ein Zeichen soll erklaeren, was der Nutzer gesetzt hat,
 *  und nicht die halbe Karte kommentieren. */
function streuWeite(el) {
  var p = el.params || {};
  return clamp((p.streuung || 4) * 1.5 + 8, 10, 90);
}

/**
 * I1 — Gebirgszeichen: dem Kamm folgen, nicht die Flaeche fuellen.
 *
 * Eine Felsstreuung sagt „hier ist Gebirge"; WO genau der Grat laeuft, sagt
 * das Hoehenfeld. Deshalb wird nicht am Klickpunkt gezeichnet, sondern auf
 * den Kammpunkten, die gratPunkte in der Umgebung findet — mit der
 * Kammrichtung als Gierwinkel, damit die Schraffur laengs des Kamms liegt
 * und nicht quer darueber.
 *
 * Findet sich kein Kamm (flaches Gelaende, Findlinge in der Ebene), bleibt
 * es bei EINEM Huegellandzeichen am Schwerpunkt. Das ist kein Notausgang,
 * sondern die richtige Aussage: ohne Kamm gibt es keinen Grat.
 */
function reliefZeichen(el) {
  var pl = kartenPlatz('sig_grat');
  if (!pl) return 0;
  var weite = streuWeite(el);
  var bb = punkteBox(el.points, weite);
  var sp = Math.max(pl.marke * 0.8, 1.2);
  var kamm = gratPunkte({ x0: bb.x0, z0: bb.z0, x1: bb.x1, z1: bb.z1,
    sp: sp, d: sp, maxN: 96 });
  var m = mitteVon(el.points);
  if (!kamm.length) {
    return punktZeichen(el, 'gebirge', null, m.x, m.z, { art: 'sig_huegelland' });
  }
  var n = 0;
  for (var i = 0; i < kamm.length; i++) {
    var g = kamm[i];
    n += punktZeichen(el, 'gebirge', null, g.x, g.z, {
      art: g.gipfel ? 'sig_gipfel' : 'sig_grat',
      dreh: Math.atan2(-g.dz, g.dx)
    });
  }
  return n;
}

/**
 * I1 — Kuestenzeichen: die Linie zwischen Land und Wasser.
 *
 * Ein Uferelement bekommt kein Zeichen an seinem Klickpunkt, sondern ein
 * Band auf der Wasserlinie — eine Kueste, die zehn Meter neben dem Wasser
 * laeuft, ist eine falsche Karte. Liegt an dieser Stelle gar keine
 * Wasserlinie (das Element steht im Binnenland), bleibt das Nass-Zeichen:
 * Schilf und Treibholz ohne Ufer sind Feuchtgebiet.
 */
function kuestenZeichen(el) {
  var pl = kartenPlatz('sig_kueste');
  var m = mitteVon(el.points);
  if (pl) {
    var linie = wasserlinie({ x: m.x, z: m.z,
      schritt: Math.max(1.5, pl.marke * 1.2), reichweite: streuWeite(el) * 2.5 });
    if (linie.length > 1 && bandZeichen(el, 'sig_kueste', linie, null)) return 1;
  }
  return punktZeichen(el, 'nass', null, m.x, m.z, { art: 'sig_sumpf' });
}

/**
 * I1 — das Kartenzeichen EINER Objektstreuung.
 * Rueckgabe: Zahl der gesetzten Zeichen (0 heisst „auf diesem Massstab
 * weggelassen", siehe Tabelle oben).
 */
function objektZeichen(el) {
  if (!el.points.length) return 0;
  var nur = el.params && el.params.nurTyp;
  var Z = (nur && POOL_ZEICHEN[nur]) || OBJEKT_ZEICHEN[el.variant] || OBJEKT_ZEICHEN_VORGABE;
  if (Z.auf) return 0;
  if (Z.relief) return reliefZeichen(el);
  if (Z.kueste) return kuestenZeichen(el);
  var m = mitteVon(el.points);
  return punktZeichen(el, Z.sache, el.kennzahl, m.x, m.z, { art: Z.art });
}

/* Ortsstabiler Zufallsstrom je (Klickpunkt i, Inselindex k) — Muster ortsRng
   aus vines.js: der Strom haengt am stabilen Indexpaar statt an der
   Zugriffsreihenfolge, eine geaenderte anzahl oder zusaetzliche Klickpunkte
   wuerfeln die uebrigen Inseln also nicht um. Der Offset +531 setzt die
   Schluesselserie der Ranken-Teilsysteme (+501..+529 in vines.js) fort und
   kollidiert nicht mit dem genObjekt-Strom (el.seed + i * 7919). */
function inselRng(i, k, s) { return rngOf((hashi(i, k, s) * 4294967296) | 0); }

/**
 * Freie Schwebeinseln (Variante "inseln"): kleine Felsbrocken mit Grasdeckel
 * und optionalen Baeumchen, die unabhaengig von den Ranken in der Luft treiben.
 * BEWUSST ohne tryPlace: dessen Regeln (kein Wasser, kein Steilhang, kein
 * Korridor, Belegungsraster) gelten fuer BODENSTAENDIGE Objekte — eine
 * schwebende Insel darf problemlos ueber Wasser, Wegen oder Steilhaengen
 * haengen. Nur der Kartenrand wird geklemmt.
 */
function genInseln(el) {
  var p = el.params;
  // I1: Schwebeinseln sind Bruchstuecke, die Arbor traegt — auf
  // Kartenmassstab also Infrastruktur und kein Bewuchs. Die Kennzahl steht
  // unten, wo die Inseln wirklich entstehen.
  var mSig = S.einheitMeter;
  if (alsZeichen(mSig)) objektZeichen(el);
  if (!alsKoerper(mSig)) return;
  var gesetzt = 0;
  for (var i = 0; i < el.points.length; i++) {
    var pt = el.points[i];
    var n = clamp(Math.round(p.anzahl), 1, 6);
    for (var k = 0; k < n; k++) {
      var rng = inselRng(i, k, el.seed + 531);
      var ang = rng() * 6.28, rad = k === 0 ? 0 : Math.sqrt(rng()) * p.streuung;
      var x = clamp(pt.x + Math.cos(ang) * rad, -HALF + 1, HALF - 1);
      var z = clamp(pt.z + Math.sin(ang) * rad, -HALF + 1, HALF - 1);
      var y = heightAt(x, z) + p.hoehe * rr(rng, 0.8, 1.25);
      var r = rr(rng, 4, 7) * p.groesse;
      var mesh = new THREE.Mesh(islandGeo(r, (el.seed + i * 967 + k * 77) | 0), rockMat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = rr(rng, 0, 6.283);
      // rockMat ist das GETEILTE Modul-Material aus materials.js — deshalb
      // KEIN userData.eigenesMaterial: clearElement (store.js) disposed dann
      // nur die Geometrie und laesst das Material fuer alle anderen Elemente
      // am Leben. userData.el macht die Insel wie die Ranken-Meshes per
      // Raycast auswaehlbar (selection.js/pickElement sammelt alle
      // group-Kinder und liest hits[0].object.userData.el).
      mesh.userData.el = el;
      groupOf(el).add(mesh);
      // Baeumchen obendrauf — Muster der Ranken-Inseln (vines.js):
      // Baum-Pools per emit, Aufsetzhoehe ~ r * 0.28 als Naeherung der
      // islandGeo-Oberflaeche, Streuung bis r * 0.5 um die Mitte.
      // Kontaktschatten: emit (pools.js) legt Schatten nur bei
      // |y - Bodenhoehe| <= 2.2 ab — hier ist y >= Bodenhoehe + 10 * 0.8 = +8
      // (hoehe-Minimum 10, Faktor >= 0.8), die Baeumchen bekommen also
      // automatisch KEINEN Bodenschatten. Die Insel selbst ruft schattenAn
      // gar nicht erst auf.
      if (p.baeumchen) {
        var nT = ri(rng, 0, 3);
        for (var b = 0; b < nT; b++) {
          var ta = rng() * 6.283, tq = Math.sqrt(rng()) * r * 0.5;
          var sc = rr(rng, 0.3, 0.6);
          emit(el, rng() < 0.6 ? "baum" : "zypresse",
            x + Math.cos(ta) * tq, y + r * 0.28, z + Math.sin(ta) * tq,
            rng() * 6.28, sc, sc, sc, tintOf(rng, 0.08));
        }
      }
      gesetzt++;
    }
  }
  // I1: Kennzahl auf ORTSMASSSTAB, mit dem Element gespeichert. Sie hier zu
  // ermitteln und nicht oben zu schaetzen, ist der ganze Punkt: sonst haenge
  // das Zeichen davon ab, mit welchem Massstab man die Karte zuletzt
  // geoeffnet hat.
  el.kennzahl = gesetzt;
}

function genObjekt(el) {
  // Vollstaendiger Katalogmodus: keine Streuung und keine Biomeinschraenkung,
  // sondern genau eine Instanz jedes physischen Pools im stabilen Schauraster.
  if (el.variant === "asset-schau") {
    var layout = el.assetSchauLayout || baueAssetSchauLayout();
    el.assetSchauLayout = layout;
    setzeAssetSchauInstanzen(el, layout, { hoeheAn: heightAt });
    baueAssetSchauMeshes(el, layout);
    el.kennzahl = layout.counts.physical;
    return;
  }
  // Animierte Hero-Landmarke: ein eigenes Mesh-Ensemble statt Poolstreuung.
  if (el.variant === "weltschildkroete") {
    el.kennzahl = Math.max(1, el.points.length);
    if (alsZeichen(S.einheitMeter)) objektZeichen(el);
    if (alsKoerper(S.einheitMeter)) genWeltschildkroete(el);
    return;
  }
  // Schwebeinseln VOR der normalen Poolstreuung: eigener Zweig ohne
  // Bodenregeln, ohne OBJGRUPPEN-Tabelle (der Fallback auf "baeume" darf
  // fuer diese Variante nie greifen).
  if (el.variant === "inseln") { genInseln(el); return; }
  if (el.variant === "luftinseln") { genLuftarchipelObjekt(el); return; }
  if (el.variant === "bambushain") { genRiesenbambusObjekt(el); return; }
  /* I1 — ueber der Uebergabe wird aus der Streuung EIN Kartenzeichen (bzw.
     eine Kammfolge oder ein Kuestenband, siehe OBJEKT_ZEICHEN). Im
     Ueberblendbereich laeuft beides; darunter aendert sich nichts, und zwar
     buchstaeblich nichts: der gesamte Rumpf unten ist unveraendert, es kommt
     nur die Zaehlung fuer die Kennzahl dazu. */
  var mSig = S.einheitMeter;
  if (alsZeichen(mSig)) objektZeichen(el);
  if (!alsKoerper(mSig)) return;
  var p = el.params, occ = newOcc(3.5), gesetzt = 0;
  var table = OBJGRUPPEN[el.variant] || OBJGRUPPEN.baeume;
  // Platzierungsregel je Variante (Objektkatalog, "Zusammenfassung der
  // Sonderfaelle"): maritim setzt AUF das Wasser, hafen ins Uferband und
  // richtet dort zusaetzlich aus. Alle uebrigen Varianten laufen unveraendert
  // ueber tryPlace — die Fallunterscheidung haengt bewusst an der Variante und
  // nicht am Pool, damit nurTyp weiterhin jeden Pool in jede Regel setzen kann.
  // "wasserflora" und "ufer2" (Katalogbuendel 4-15) haengen sich an dieselben
  // beiden Regeln — rein additiv: die Zuordnung der Bestandsvarianten aendert
  // sich nicht, es kommt je eine zweite Variante pro Regel dazu.
  var aufWasser = el.variant === "maritim" || el.variant === "wasserflora";
  var amUfer = el.variant === "hafen" || el.variant === "ufer2";
  var schwebt = el.variant === "schwebend";
  // Vom Zeiger auf einem Blattplateau gesetzt (editor/pointer.js): die ganze
  // Streuung landet auf der Blattoberflaeche statt auf dem Terrain darunter.
  // Bestandskarten tragen das Feld nicht und laufen unveraendert.
  var aufPlateau = !!p.aufPlateau;
  for (var i = 0; i < el.points.length; i++) {
    var pt = el.points[i];
    var rng = rngOf((el.seed + i * 7919) | 0);
    var n = Math.max(1, p.anzahl);
    for (var k = 0; k < n; k++) {
      var ang = rng() * 6.28, rad = k === 0 ? 0 : Math.sqrt(rng()) * p.streuung;
      var x = pt.x + Math.cos(ang) * rad, z = pt.z + Math.sin(ang) * rad;
      // nurTyp erzwingt einen konkreten Pool; leer/undefined oder ein
      // unbekannter Poolname (alte Karte, Pool entfernt) fällt still auf
      // die gewichtete Gruppen-Auswahl zurück — kein Crash.
      var kind = (p.nurTyp && POOLS[p.nurTyp]) ? p.nurTyp : wpick(rng, table);
      var r = POOLS[kind].radius * 0.85, h = null, ufer = null;
      if (aufPlateau) h = tryPlacePlateau(occ, x, z, r);
      else if (aufWasser) h = tryPlaceWasser(occ, x, z, r);
      else if (amUfer) { ufer = tryPlaceUfer(occ, x, z, r); if (ufer) h = ufer.h; }
      else if (schwebt) {
        h = tryPlaceFrei(occ, x, z, r);
        // Flughoehe ueber dem Gelaende. Sie folgt dem Boden, damit die
        // Silhouette am Hang nicht im Fels verschwindet; emit legt bei dieser
        // Distanz zum Boden automatisch KEINEN Kontaktschatten mehr ab.
        if (h !== null) h += 4.5 + rng() * 8;
      } else h = tryPlace(occ, x, z, r, { ignoreCorridor: p.frei });
      if (h === null) continue;
      // Zufallsreihenfolge unveraendert: erst groesse, dann Drehung, dann
      // Hoehenfaktor, dann Tint. Die Drehung steht nur deshalb in einer
      // eigenen Variablen, weil das Ufer sie ueberschreibt — gezogen wird sie
      // an derselben Stelle wie bisher, sonst wuerfelte jede Bestandskarte neu.
      var sc = rr(rng, 0.8, 1.2) * p.groesse;
      var yaw = rng() * 6.28;
      // Uferbauten sind mit ihrer Wasserseite auf +z gebaut; eine Zufallsdrehung
      // stellte sie mit dem Ruecken zum Hafenbecken.
      if (ufer) yaw = ufer.yaw;
      emit(el, kind, x, h - 0.1, z, yaw, sc, sc * rr(rng, 0.88, 1.2), sc, tintOf(rng));
      emitLicht(el, kind, x, h - 0.1, z, sc);
      gesetzt++;
    }
  }
  // I1: siehe genInseln — die Kennzahl entsteht dort, wo wirklich gesetzt
  // wird, und wandert mit dem Element in die Datei.
  el.kennzahl = gesetzt;
}

/**
 * Dauerlicht der Seezeichen (Leuchtturmlaterne, Feuerkorb, Kailaterne).
 * Nutzt bewusst den BESTEHENDEN Pool "fensterlicht": dessen emissiveIntensity
 * fuehrt atmosphere.js bereits ueber die Tageszeit (tags 0, nachts am
 * hellsten), ein eigener Leucht-Pool braeuchte dort eine zusaetzliche Zeile.
 * Anders als emitFensterlicht wird hier NICHT gewuerfelt — ein Leuchtfeuer,
 * das in 60 % der Faelle aus ist, waere kein Seezeichen.
 */
function emitLicht(el, kind, x, y, z, sc) {
  var a = LICHT_ANKER[kind];
  if (!a) return;
  // Zwei gekreuzte Quads: der Schein soll aus jeder Blickrichtung stehen.
  // fensterlicht hat radius 0, emit legt dafuer keinen Kontaktschatten ab.
  for (var q = 0; q < 2; q++) {
    emit(el, "fensterlicht", x + a[0] * sc, y + a[1] * sc, z + a[2] * sc,
      q * Math.PI / 2, a[3] * sc, a[3] * sc, a[3] * sc, [1, 1, 1]);
  }
}


/**
 * Fensterglut: pro Fensteranker entscheidet die Seed, ob dahinter Licht
 * brennt. Die Quads sitzen knapp vor der Glasflaeche des platzierten Hauses.
 */
function emitFensterlicht(el, rng, kind, x, y, z, yaw, sc) {
  var anker = FENSTER_ANKER[kind];
  if (!anker) return;
  var cy = Math.cos(yaw), sy = Math.sin(yaw);
  for (var i = 0; i < anker.length; i++) {
    if (rng() > 0.4) continue;
    var a = anker[i];
    var lx = a[0] * sc, ly = a[1] * sc, lz = a[2] * sc;
    var wx = x + lx * cy + lz * sy;
    var wz = z - lx * sy + lz * cy;
    // Quad blickt in dieselbe Richtung wie die Wand (grob: nach aussen)
    var ry = yaw + (Math.abs(a[0]) > Math.abs(a[2]) ? -Math.PI / 2 * Math.sign(a[0]) : (a[2] < 0 ? Math.PI : 0));
    emit(el, "fensterlicht", wx, y + ly, wz, ry, sc, sc, sc, [1, 1, 1]);
  }
}

export { newOcc, occFree, occAdd, tryPlace, tryPlaceWasser, tryPlaceUfer, tryPlaceFrei,
  plateauHoeheAt, tryPlacePlateau,
  KULTUR, OBJGRUPPEN, genObjekt, genInseln, emitFensterlicht, emitLicht,
  OBJEKT_ZEICHEN, POOL_ZEICHEN, punkteBox, streuWeite,
  reliefZeichen, kuestenZeichen, objektZeichen };
