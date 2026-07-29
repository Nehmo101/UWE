/* Deterministischer, seiteneffektfreier Demoplan fuer `?schau=luft`. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const SCHAU = await ladeTerra('generators/luftschau.js');
const FRAKTIONEN = new Set([
  'menschenbund', 'mondelfen', 'tiefenzwerge', 'goblinzunft', 'orklegion'
]);
const FAHRZEUGE = new Set(['schiff', 'zug', 'gemischt']);

function tiefGefroren(wert) {
  if (!wert || typeof wert !== 'object') return true;
  if (!Object.isFrozen(wert)) return false;
  return Object.values(wert).every(tiefGefroren);
}

function pruefeElementSpec(el, index) {
  assert.deepEqual(Object.keys(el).sort(), ['kind', 'params', 'points', 'variant'],
    'Element ' + index + ': unerlaubte Spezifikationsfelder');
  assert.ok(el.kind === 'objekt' || el.kind === 'pfad');
  assert.equal(typeof el.variant, 'string');
  assert.ok(Array.isArray(el.points) && el.points.length > 0);
  assert.equal(Object.getPrototypeOf(el.params), Object.prototype);
  for (const p of el.points) {
    assert.deepEqual(Object.keys(p).sort(), ['x', 'z']);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z));
    assert.ok(Math.abs(p.x) <= 128 && Math.abs(p.z) <= 128,
      'Element ' + index + ': Punkt ausserhalb der 256er-Demokarte');
  }
}

test('Luftschau - liefert frische, deterministische reine Spezifikationen', () => {
  assert.deepEqual(Object.keys(SCHAU).sort(),
    ['LUFTSCHAU_ELEMENTE', 'LUFTSCHAU_KAMERA', 'erstelleLuftschauPlan']);
  assert.ok(tiefGefroren(SCHAU.LUFTSCHAU_KAMERA));
  assert.ok(tiefGefroren(SCHAU.LUFTSCHAU_ELEMENTE));
  const a = SCHAU.erstelleLuftschauPlan();
  const b = SCHAU.erstelleLuftschauPlan();
  assert.deepEqual(a, b);
  assert.notStrictEqual(a, b);
  assert.notStrictEqual(a.kamera, b.kamera);
  assert.notStrictEqual(a.elements, b.elements);
  for (let i = 0; i < a.elements.length; i++) {
    assert.notStrictEqual(a.elements[i], b.elements[i]);
    assert.notStrictEqual(a.elements[i].points, b.elements[i].points);
    assert.notStrictEqual(a.elements[i].params, b.elements[i].params);
    pruefeElementSpec(a.elements[i], i);
  }
  a.elements[0].points[0].x = 999;
  assert.notDeepEqual(a, b, 'Planaufrufe teilen mutierbaren Zustand');
});

test('Luftschau - komponiert fuenf deutlich verteilte Luftinsel-Cluster', () => {
  const plan = SCHAU.erstelleLuftschauPlan();
  const inseln = plan.elements.filter((el) =>
    el.kind === 'objekt' && el.variant === 'luftinseln');
  assert.equal(inseln.length, 1, 'Cluster sollen Draw Calls poolweise teilen');
  const archipel = inseln[0];
  assert.equal(archipel.points.length, 5);
  const quadranten = new Set(archipel.points.map((p) =>
    (p.x < 0 ? 'W' : 'O') + (p.z < 0 ? 'N' : 'S')));
  assert.equal(quadranten.size, 4, 'Archipele fuellen nicht alle Bildquadranten');
  assert.ok(archipel.params.anzahl >= 30);
  assert.ok(archipel.params.streuung >= 24);
  assert.ok(archipel.params.groesse >= 1.7);
  assert.ok(archipel.params.hoehe >= 60 && archipel.params.hoehe <= 140);
});

test('Luftschau - zeigt fuenf Fraktionsrouten und alle Verkehrstypen', () => {
  const plan = SCHAU.erstelleLuftschauPlan();
  const routen = plan.elements.filter((el) =>
    el.kind === 'pfad' && el.variant === 'flugroute');
  assert.equal(routen.length, 5);
  assert.deepEqual(new Set(routen.map((el) => el.params.fraktion)), FRAKTIONEN);
  assert.deepEqual(new Set(routen.map((el) => el.params.fahrzeug)), FAHRZEUGE);
  for (const route of routen) {
    assert.ok(route.points.length >= 5);
    assert.ok(FRAKTIONEN.has(route.params.fraktion));
    assert.ok(FAHRZEUGE.has(route.params.fahrzeug));
    assert.ok(route.params.hoehe >= 18 && route.params.hoehe <= 180);
    assert.ok(route.params.verkehr >= 3 && route.params.verkehr <= 8);
    assert.ok(route.params.geschwindigkeit >= 0.15 &&
      route.params.geschwindigkeit <= 2.5);
    assert.equal(route.params.routeSichtbar, true);
    assert.equal(typeof route.params.stationen, 'boolean');
  }
});

test('Luftschau - besitzt einen monumentalen Riesenbambushain', () => {
  const plan = SCHAU.erstelleLuftschauPlan();
  const haine = plan.elements.filter((el) =>
    el.kind === 'objekt' && el.variant === 'bambushain');
  assert.equal(haine.length, 1);
  const hain = haine[0];
  assert.ok(hain.points.length >= 1);
  assert.ok(hain.params.anzahl >= 12);
  assert.ok(hain.params.streuung >= 10);
  assert.ok(hain.params.hoehe >= 100);
  assert.ok(hain.params.dicke >= 0.8);
  assert.ok(hain.params.dichte >= 0.7);
  assert.ok(hain.params.junganteil <= 0.2);
  assert.ok(hain.points.every((p) => p.z <= 35),
    'Riesenhain darf die Abnahmekamera nicht als angeschnittene Vordergrundwand verdecken');
});

test('Luftschau - Kamera fasst hohe Inseln, Hain und Routen zusammen', () => {
  const k = SCHAU.erstelleLuftschauPlan().kamera;
  assert.deepEqual(Object.keys(k).sort(), ['dist', 'fov', 'hebung', 'pitch', 'x', 'yaw', 'z']);
  for (const wert of Object.values(k)) assert.ok(Number.isFinite(wert));
  assert.ok(k.dist >= 300 && k.dist <= 450);
  assert.ok(k.pitch >= 0.5 && k.pitch <= 1.05);
  assert.ok(k.fov >= 32 && k.fov <= 45);
  assert.ok(k.hebung >= 40 && k.hebung <= 100);
  assert.ok(Math.abs(k.x) <= 20 && Math.abs(k.z) <= 20);
});

test('Luftschau - Quelle bleibt rein und ohne globale Seiteneffekte', () => {
  const datei = path.join(SRC, 'generators', 'luftschau.js');
  const quelle = fs.readFileSync(datei, 'utf8');
  const ohneKommentare = quelle
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(ohneKommentare, /\bimport\s/);
  assert.doesNotMatch(ohneKommentare, /\bMath\s*\.\s*random\b/);
  assert.doesNotMatch(ohneKommentare, /\bDate\s*(?:\.|\()/);
  assert.doesNotMatch(ohneKommentare, /\b(?:document|window|POOLS|definePool|S)\b/);
  assert.ok(quelle.split(/\r?\n/).length < 700);
  assert.ok(fs.readFileSync(new URL(import.meta.url), 'utf8').split(/\r?\n/).length < 700);
});
