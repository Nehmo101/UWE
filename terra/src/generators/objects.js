// Platzierungsregeln (Wasser, Hang, Korridor, Kollision), Kulturtabellen
// und das Objekt-Werkzeug.
import * as THREE from 'three';
import { clamp, hashi, rngOf, rr, ri, wpick } from '../core/rng.js';
import { HALF, WATER, COS40, groupOf } from '../core/store.js';
import { POOLS, emit, tintOf } from '../core/pools.js';
import { heightAt, slopeAt, inCorridor } from '../world/terrain.js';
import { FENSTER_ANKER, islandGeo } from './geometry.js';
import { rockMat } from '../render/materials.js';

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
KULTUR.wohn = KULTUR.dorf;          // Rückwärtskompatibilität für alte Karten

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
  natur: [["busch", 4], ["blume", 5], ["gras", 6], ["fels", 1]]
};
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
    }
  }
}

function genObjekt(el) {
  // Schwebeinseln VOR der normalen Poolstreuung: eigener Zweig ohne
  // Bodenregeln, ohne OBJGRUPPEN-Tabelle (der Fallback auf "baeume" darf
  // fuer diese Variante nie greifen).
  if (el.variant === "inseln") { genInseln(el); return; }
  var p = el.params, occ = newOcc(3.5);
  var table = OBJGRUPPEN[el.variant] || OBJGRUPPEN.baeume;
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
      var h = tryPlace(occ, x, z, POOLS[kind].radius * 0.85, { ignoreCorridor: p.frei });
      if (h === null) continue;
      var sc = rr(rng, 0.8, 1.2) * p.groesse;
      emit(el, kind, x, h - 0.1, z, rng() * 6.28, sc, sc * rr(rng, 0.88, 1.2), sc, tintOf(rng));
    }
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

export { newOcc, occFree, occAdd, tryPlace, KULTUR, OBJGRUPPEN, genObjekt,
  genInseln, emitFensterlicht };
