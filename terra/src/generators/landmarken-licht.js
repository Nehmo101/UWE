// Feste Landmarken-Lichter: ein kleiner Pool vorab erzeugter PointLights.
//
// WARUM DIESER POOL. three.js kompiliert JEDES beleuchtete Material neu,
// sobald sich die ZAHL der Lichter in der Szene aendert. Weltschildkroete
// und Weltschloss legten ihren Schein bisher als neues PointLight in ihre
// Elementgruppe — Setzen, Verschieben, Neuaufbau und Loeschen einer
// Landmarke aenderten damit jedes Mal die Lichtzahl und zwangen den
// Renderer zu einem Komplett-Compile aller Programme (gemessen: rund acht
// Sekunden Stillstand beim Setzen einer zweiten Schildkroete, siehe
// Rundenbericht). Der Pool haelt die Lichtzahl von der ersten
// Bildkomposition an konstant: die Lichter haengen EINMAL beim Start in
// der Szene (Intensitaet 0, weit unter der Karte) und werden danach nur
// noch umpositioniert, umgefaerbt und gedimmt.
//
// Regeln fuer die Nutzer (weltschildkroete.js, weltschloss.js):
//   - genX(el) ruft zuerst landmarkenLichtFrei(el) — ein Neuaufbau beginnt
//     ohne Altlasten.
//   - je Punkt landmarkenLicht(el) anfordern; Rueckgabe null heisst Pool
//     erschoepft — die Landmarke steht dann ohne Schein da, statt die
//     Lichtzahl (und damit alle Programme) umzuwerfen.
//   - Farbe, Staerke, Reichweite und Position werden bei JEDER Zuteilung
//     gesetzt — ein Pool-Licht wechselt zwischen Schildkroete und Schloss.
import * as THREE from 'three';
import { S } from '../core/store.js';

var POOL_GROESSE = 4;
var lichter = [];

/** Einmalig beim Start (vor dem ersten gerenderten Bild) aufrufen. */
function initLandmarkenLichter(scene) {
  if (lichter.length) return;
  for (var i = 0; i < POOL_GROESSE; i++) {
    var l = new THREE.PointLight(0xffffff, 0, 1, 2);
    l.position.set(0, -10000, 0);
    l.userData.terraLandmarkenLicht = true;
    l.userData.belegt = null;
    lichter.push(l);
    scene.add(l);
  }
}

function frei(l) {
  l.userData.belegt = null;
  l.intensity = 0;
  l.position.set(0, -10000, 0);
}

/** Gibt Lichter frei, deren Element nicht mehr auf der Karte ist. */
function landmarkenLichtSweep() {
  for (var i = 0; i < lichter.length; i++) {
    var el = lichter[i].userData.belegt;
    if (el && S.elements.indexOf(el) < 0) frei(lichter[i]);
  }
}

/** Loesst die Zuteilung eines Elements (Aufruf zu Beginn des Neuaufbaus). */
function landmarkenLichtFrei(el) {
  for (var i = 0; i < lichter.length; i++) {
    if (lichter[i].userData.belegt === el) frei(lichter[i]);
  }
}

/**
 * Weist dem Element ein Pool-Licht zu (das schon zugeteilte kommt wieder).
 * Liefert null, wenn der Pool erschoepft ist.
 */
function landmarkenLicht(el) {
  landmarkenLichtSweep();
  var i;
  for (i = 0; i < lichter.length; i++) {
    if (lichter[i].userData.belegt === el) return lichter[i];
  }
  for (i = 0; i < lichter.length; i++) {
    if (!lichter[i].userData.belegt) {
      lichter[i].userData.belegt = el;
      return lichter[i];
    }
  }
  return null;
}

export { initLandmarkenLichter, landmarkenLicht, landmarkenLichtFrei,
  landmarkenLichtSweep };
