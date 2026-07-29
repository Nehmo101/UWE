/* ==========================================================================
   Runde 28 — filmisches Weltleben ohne Partikelsturm

   Die Schicht soll bewohnte Orte lesbar machen, darf aber weder die Karte
   zufällig umdeuten noch mit der Zahl der Gebäude wachsen. Geprüft werden
   deshalb die reine Ankerableitung, harte Budgets und die vier konstanten
   Instanz-Meshes im echten Lauf.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ladeTerra, SRC } from './hilfen/laden.mjs';
import { testWelt } from './hilfen/karte.mjs';

const welt = await testWelt({ seed: 281337, biom: 'wiese' });
const leben = await ladeTerra('world/weltleben.js');
const THREE = await import('three');

function viertel(id, x, z, r) {
  return {
    id,
    seed: 7000 + id,
    kind: 'flaeche',
    variant: 'viertel',
    params: {},
    points: [
      { x: x - r, z: z - r },
      { x: x + r, z: z - r },
      { x: x + r, z: z + r },
      { x: x - r, z: z + r }
    ]
  };
}

test('28 — Anker sind reproduzierbar, semantisch und hart gedeckelt', () => {
  const elemente = [];
  for (let i = 0; i < 14; i++) elemente.push(viertel(i + 1, i * 20, -i * 7, 12 + i));
  elemente.splice(3, 0, {
    id: 99,
    seed: 98765,
    kind: 'objekt',
    variant: 'weltschildkroete',
    points: [{ x: 12, z: -8 }],
    params: { groesse: 1.4, drehung: 125 }
  });
  // Ein beliebiges Einzelhaus ist ausdrücklich kein weiterer Siedlungsanker.
  elemente.push({
    id: 100,
    seed: 123,
    kind: 'objekt',
    variant: 'haeuser',
    points: [{ x: 0, z: 0 }],
    params: {}
  });

  const a = leben.weltlebenAnker(elemente);
  const b = leben.weltlebenAnker(structuredClone(elemente));
  assert.deepEqual(a, b, 'gleiche Karte muss identische Anker liefern');
  assert.equal(a.length, leben.MAX_ANKER, 'Ankerdeckel wird nicht eingehalten');
  assert.ok(a.some((q) => q.typ === 'schildkroete'), 'Weltschildkröte fehlt');
  assert.ok(a.every((q) => Number.isFinite(q.x) && Number.isFinite(q.z) &&
    Number.isFinite(q.radius) && Number.isInteger(q.seed)));
  assert.equal(a.filter((q) => q.typ === 'siedlung').length +
    a.filter((q) => q.typ === 'schildkroete').length, a.length);
});

test('28 — vier Draw Calls tragen Bewohner, Falter und wehende Fahnen', () => {
  const { S } = welt.m.store;
  S.elements.length = 0;
  for (let i = 0; i < 4; i++) {
    S.elements.push(viertel(i + 20, -54 + i * 36, i % 2 ? 30 : -20, 18));
  }
  S.elements.push({
    id: 30,
    seed: 303030,
    kind: 'objekt',
    variant: 'weltschildkroete',
    points: [{ x: 18, z: 10 }],
    params: { groesse: 1.15, drehung: 145 }
  });

  const szene = new THREE.Scene();
  const vorher = szene.children.length;
  leben.initWeltleben(szene);
  assert.equal(szene.children.length - vorher, 4,
    'Weltleben darf nur vier konstante Meshes anmelden');

  leben.tickWeltleben(1 / 60, 12.5);
  assert.ok(leben.figurMesh.count > 0 && leben.figurMesh.count <= leben.MAX_BEWOHNER);
  assert.ok(leben.falterMesh.count > 0 && leben.falterMesh.count <= leben.MAX_FALTER);
  assert.ok(leben.fahnenMesh.count > 0 && leben.fahnenMesh.count <= leben.MAX_FAHNEN);
  assert.equal(leben.fahnenMesh.count, leben.mastMesh.count,
    'jede Stofffahne braucht genau einen Mast');
  const erstePose = Array.from(leben.figurMesh.instanceMatrix.array)
    .slice(0, leben.figurMesh.count * 16);
  leben.tickWeltleben(1 / 60, 14.5);
  const zweitePose = Array.from(leben.figurMesh.instanceMatrix.array)
    .slice(0, leben.figurMesh.count * 16);
  assert.notDeepEqual(zweitePose, erstePose, 'Bewohner bewegen sich nicht');

  for (const mesh of [leben.figurMesh, leben.falterMesh,
    leben.fahnenMesh, leben.mastMesh]) {
    assert.ok(Array.from(mesh.instanceMatrix.array).every(Number.isFinite),
      'Instanzmatrix enthält NaN/Infinity');
  }
});

test('28 — kein Laufzeitzufall und Init/Tick bleiben außerhalb von main.js', () => {
  const quelle = fs.readFileSync(path.join(SRC, 'world', 'weltleben.js'), 'utf8');
  const atmosphaere = fs.readFileSync(path.join(SRC, 'world', 'atmosphere.js'), 'utf8');
  const main = fs.readFileSync(path.join(SRC, 'main.js'), 'utf8');
  assert.doesNotMatch(quelle, /Math\.random|Date\.now|new Date/);
  assert.match(atmosphaere, /initWeltleben\(scene\)/);
  assert.match(atmosphaere, /tickWeltleben\(/);
  assert.doesNotMatch(main, /weltleben/i,
    'die Bildschleife soll nicht um eine weitere Sonderachse wachsen');
});
