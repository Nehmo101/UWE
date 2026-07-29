/* ==========================================================================
   Dezente 3D-Auswahlkontur

   Geprueft werden harte Meshkanten, gepackte Poolinstanzen, verschachtelte
   InstancedMeshes und der begrenzte Huelle-Fallback fuer komplexe Gruppen.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ladeTerra, SRC } from './hilfen/laden.mjs';

const THREE = await import('three');
const KONTUR = await ladeTerra('editor/selection-outline.js');
const POOL_MODUL = await ladeTerra('core/pools.js');

function leeresElement() {
  return { inst: {}, group: null };
}

function grenzen(position) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < position.count; i++) {
    for (let a = 0; a < 3; a++) {
      const wert = position.array[i * 3 + a];
      min[a] = Math.min(min[a], wert);
      max[a] = Math.max(max[a], wert);
    }
  }
  return { min, max };
}

function instanz(x, y, z, skala = 1) {
  return [x, y, z, 0, 0, 0, skala, skala, skala, 1, 1, 1];
}

test('Auswahlkontur - zeichnet duenne weisse Hartkanten und folgt Quellmeshes', () => {
  KONTUR.leereAuswahlKontur();
  assert.deepEqual(Object.keys(KONTUR).sort(), [
    'aktualisiereAuswahlKontur', 'auswahlKontur', 'leereAuswahlKontur'
  ]);
  const gruppe = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 3, 4),
    new THREE.MeshBasicMaterial({ color: 0x445566 })
  );
  mesh.position.set(3, 4, 5);
  gruppe.add(mesh);
  const el = { inst: {}, group: gruppe };

  assert.equal(KONTUR.aktualisiereAuswahlKontur(el, true), 1);
  const linie = KONTUR.auswahlKontur.children[0];
  assert.equal(linie.type, 'LineSegments');
  assert.equal(linie.geometry.attributes.position.count, 24,
    'Box braucht zwoelf harte Kanten statt Dreiecksdiagonalen');
  assert.equal(linie.material.type, 'LineBasicMaterial');
  assert.equal(linie.material.color.getHex(), 0xffffff);
  assert.equal(linie.material.opacity, 0.82);
  assert.equal(linie.material.depthTest, true);
  assert.equal(linie.material.depthWrite, false);
  assert.equal(linie.material.fog, false);
  assert.equal(linie.material.linewidth, 1);
  assert.equal(linie.matrix.elements[12], 3);

  mesh.position.x = 8;
  assert.equal(KONTUR.aktualisiereAuswahlKontur(el, true), 1);
  assert.strictEqual(KONTUR.auswahlKontur.children[0], linie,
    'reine Animation darf Geometrie nicht neu bauen');
  assert.equal(linie.matrix.elements[12], 8,
    'Kontur folgt der Weltmatrix ihres Quellmeshes');

  let entsorgt = 0;
  linie.geometry.dispose = () => { entsorgt++; };
  assert.equal(KONTUR.aktualisiereAuswahlKontur(el, false), 0);
  assert.equal(entsorgt, 1);
  assert.equal(KONTUR.auswahlKontur.children.length, 0);
  assert.equal(KONTUR.auswahlKontur.visible, false);
});

test('Auswahlkontur - verschmilzt nur die Poolinstanzen des selektierten Elements', () => {
  KONTUR.leereAuswahlKontur();
  const name = '__kontur_test_pool';
  POOL_MODUL.POOLS[name] = {
    geo: new THREE.BoxGeometry(1, 1, 1),
    radius: 1
  };
  try {
    const el = leeresElement();
    el.inst[name] = instanz(0, 1, 0).concat(instanz(6, 2, 0, 2));
    assert.equal(KONTUR.aktualisiereAuswahlKontur(el, true), 1);
    const erste = KONTUR.auswahlKontur.children[0];
    assert.equal(erste.userData.terraAuswahlKonturArt, 'pool-kanten');
    assert.equal(erste.userData.terraAuswahlKonturInstanzen, 2);
    assert.equal(erste.geometry.attributes.position.count, 48);
    const box = grenzen(erste.geometry.attributes.position);
    assert.ok(box.min[0] < -0.5 && box.max[0] > 7,
      'beide selektierten Instanzmatrizen fehlen in der Kontur');

    let entsorgt = 0;
    erste.geometry.dispose = () => { entsorgt++; };
    el.inst = { [name]: instanz(12, 3, -2) };
    assert.equal(KONTUR.aktualisiereAuswahlKontur(el, true), 1);
    assert.equal(entsorgt, 1, 'alte gepackte Kontur wurde nicht freigegeben');
    const zweite = KONTUR.auswahlKontur.children[0];
    assert.notStrictEqual(zweite, erste);
    assert.ok(grenzen(zweite.geometry.attributes.position).min[0] > 11,
      'neue Instanzdaten wurden nicht nachgezogen');
  } finally {
    KONTUR.leereAuswahlKontur();
    delete POOL_MODUL.POOLS[name];
  }
});

test('Auswahlkontur - behandelt verschachtelte InstancedMeshes und deckelt Komplexitaet', () => {
  KONTUR.leereAuswahlKontur();
  const gruppe = new THREE.Group();
  gruppe.position.set(10, 0, 0);
  const verschachtelt = new THREE.Group();
  const instanced = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshBasicMaterial(),
    2
  );
  instanced.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 0));
  instanced.setMatrixAt(1, new THREE.Matrix4().makeTranslation(3, 0, 0));
  verschachtelt.add(instanced);
  gruppe.add(verschachtelt);
  const el = { inst: {}, group: gruppe };

  assert.equal(KONTUR.aktualisiereAuswahlKontur(el, true), 1);
  const linie = KONTUR.auswahlKontur.children[0];
  assert.equal(linie.userData.terraAuswahlKonturArt, 'gruppen-instanzen');
  assert.equal(linie.geometry.attributes.position.count, 48);
  assert.equal(linie.matrix.elements[12], 10,
    'verschachtelte Gruppen-Weltmatrix fehlt');

  KONTUR.leereAuswahlKontur();
  const komplex = new THREE.Group();
  for (let i = 0; i < 25; i++) {
    const teil = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    teil.position.x = i * 1.5;
    komplex.add(teil);
  }
  const komplexEl = { inst: {}, group: komplex };
  assert.equal(KONTUR.aktualisiereAuswahlKontur(komplexEl, true), 1,
    'komplexe Gruppe darf nicht 25 Kontur-Draw-Calls erzeugen');
  const huelle = KONTUR.auswahlKontur.children[0];
  assert.equal(huelle.userData.terraAuswahlKonturArt, 'gruppen-huelle');
  assert.equal(huelle.userData.terraAuswahlKonturFallback, true);
  assert.equal(huelle.geometry.attributes.position.count, 24);
  KONTUR.leereAuswahlKontur();
});

test('Auswahlkontur - ist nur im Auswahlwerkzeug aktiv und bleibt export-sicher', () => {
  const modulQuelle = fs.readFileSync(
    path.join(SRC, 'editor', 'selection-outline.js'), 'utf8'
  );
  const integration = fs.readFileSync(
    path.join(SRC, 'editor', 'selection.js'), 'utf8'
  );
  assert.ok(modulQuelle.split(/\r?\n/).length <= 700);
  assert.match(integration,
    /aktualisiereAuswahlKontur\(ed\.selected,\s*ed\.tool\s*===\s*"auswahl"\)/);
  assert.match(integration, /auswahlRahmen\.add\(auswahlKontur\)/,
    'Kontur muss mit dem bereits im Export versteckten Auswahlrahmen verschwinden');
  assert.match(integration, /if\s*\(c\s*===\s*auswahlKontur\)\s*continue/);
  assert.doesNotMatch(modulQuelle, /\b(?:ShaderMaterial|MeshBasicMaterial|PointLight)\b/);
  assert.doesNotMatch(modulQuelle, /\b(?:glow|emissive|Math\.random|Date)\b/i);
});
