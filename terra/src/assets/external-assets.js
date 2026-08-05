// Kleiner, kontrollierter GLB-v2-Pfad fuer freigegebene Terra-Hero-Assets.
// Unterstuetzt die von tools/terra-art erzeugte statische Mesh-Teilmenge und
// faellt bei jedem Lade-/Schemafehler lautlos auf die prozedurale Runtime zurueck.
import * as THREE from 'three';
import { installiereExternenPool } from './external-pool-geometrie.js';

const externe = new Map();
const komponentTyp = Object.freeze({ 5120: Int8Array, 5121: Uint8Array,
  5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array });
const elementBreite = Object.freeze({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 });

function parseGlb(buffer) {
  var view = new DataView(buffer);
  if (view.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2) throw new Error('GLB-v2-Kopf fehlt');
  var offset = 12, json = null, bin = null;
  while (offset + 8 <= view.byteLength) {
    var laenge = view.getUint32(offset, true);
    var typ = view.getUint32(offset + 4, true);
    var start = offset + 8, ende = start + laenge;
    if (ende > view.byteLength) throw new Error('GLB-Chunk ragt ueber Dateiende');
    if (typ === 0x4e4f534a) {
      json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, start, laenge)));
    } else if (typ === 0x004e4942) bin = buffer.slice(start, ende);
    offset = ende;
  }
  if (!json || !bin) throw new Error('GLB braucht JSON- und BIN-Chunk');
  return { json: json, bin: bin };
}

function accessor(daten, index) {
  var spec = daten.json.accessors[index];
  var bufferView = daten.json.bufferViews[spec.bufferView];
  var Typ = komponentTyp[spec.componentType], breite = elementBreite[spec.type];
  if (!Typ || !breite) throw new Error('Nicht unterstuetzter GLB-Accessor');
  var elementBytes = Typ.BYTES_PER_ELEMENT * breite;
  if (bufferView.byteStride && bufferView.byteStride !== elementBytes) {
    throw new Error('Interleaved GLB-Accessors werden nicht unterstuetzt');
  }
  var start = (bufferView.byteOffset || 0) + (spec.byteOffset || 0);
  return { array: new Typ(daten.bin, start, spec.count * breite), breite: breite,
    normalisiert: !!spec.normalized };
}

function materialFuer(json, index) {
  var spec = index === undefined ? {} : (json.materials[index] || {});
  var pbr = spec.pbrMetallicRoughness || {};
  var faktor = pbr.baseColorFactor || [1, 1, 1, 1];
  var material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(faktor[0], faktor[1], faktor[2]),
    opacity: faktor[3], transparent: faktor[3] < 1,
    roughness: pbr.roughnessFactor === undefined ? 0.82 : pbr.roughnessFactor,
    metalness: pbr.metallicFactor || 0,
    side: spec.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors: false
  });
  material.name = spec.name || '';
  return material;
}

function meshFuer(daten, index) {
  var gruppe = new THREE.Group();
  var mesh = daten.json.meshes[index];
  for (var i = 0; i < mesh.primitives.length; i++) {
    var primitiv = mesh.primitives[i];
    if (primitiv.mode !== undefined && primitiv.mode !== 4) continue;
    var geo = new THREE.BufferGeometry();
    var map = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' };
    for (var semantik in map) {
      if (primitiv.attributes[semantik] === undefined) continue;
      var attr = accessor(daten, primitiv.attributes[semantik]);
      geo.setAttribute(map[semantik], new THREE.BufferAttribute(attr.array, attr.breite,
        attr.normalisiert));
    }
    if (!geo.attributes.position) throw new Error('GLB-Mesh ohne Positionen');
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (primitiv.indices !== undefined) {
      var indizes = accessor(daten, primitiv.indices);
      geo.setIndex(new THREE.BufferAttribute(indizes.array, 1));
    }
    var objekt = new THREE.Mesh(geo, materialFuer(daten.json, primitiv.material));
    objekt.castShadow = true; objekt.receiveShadow = true;
    gruppe.add(objekt);
  }
  return gruppe;
}

function knotenFuer(daten, index) {
  var spec = daten.json.nodes[index], objekt = spec.mesh === undefined
    ? new THREE.Group() : meshFuer(daten, spec.mesh);
  if (spec.matrix) objekt.matrix.fromArray(spec.matrix).decompose(
    objekt.position, objekt.quaternion, objekt.scale);
  else {
    if (spec.translation) objekt.position.fromArray(spec.translation);
    if (spec.rotation) objekt.quaternion.fromArray(spec.rotation);
    if (spec.scale) objekt.scale.fromArray(spec.scale);
  }
  for (var i = 0; i < (spec.children || []).length; i++) {
    objekt.add(knotenFuer(daten, spec.children[i]));
  }
  return objekt;
}

export function szeneFuer(buffer) {
  var daten = parseGlb(buffer), gruppe = new THREE.Group();
  var szene = daten.json.scenes[(daten.json.scene || 0)] || { nodes: [] };
  for (var i = 0; i < (szene.nodes || []).length; i++) gruppe.add(knotenFuer(daten, szene.nodes[i]));
  gruppe.userData.terraExtern = true;
  return gruppe;
}


function registriereExternesAsset(id, gruppe) {
  externe.set(id, gruppe);
  installiereExternenPool(id, gruppe);
}
export async function ladeExterneAssets() {
  // Nur fuer die lokale Art-Factory: ein Kandidat wird aus derselben Herkunft
  // in die festen Referenzszenen eingesetzt, ohne Manifest oder Baseline zu
  // veraendern. Produktionsseiten setzen diesen Parameter nie.
  var kandidat = new URLSearchParams(window.location.search).get('terraAsset');
  var kandidatTreffer = kandidat && kandidat.match(
    /^\/\.artifacts\/terra-art\/candidates\/([a-zA-Z0-9_-]+)\/[a-z]\/model-optimized\.glb$/
  );
  if (kandidatTreffer && !kandidat.includes('..') && !kandidat.includes('//')) {
    try {
      var kandidatAntwort = await fetch(kandidat, { cache: 'no-store' });
      if (!kandidatAntwort.ok) throw new Error('HTTP ' + kandidatAntwort.status);
      registriereExternesAsset(kandidatTreffer[1], szeneFuer(await kandidatAntwort.arrayBuffer()));
      return;
    } catch (fehler) {
      console.warn('[terra-assets] Kandidaten-Fallback: ' + fehler.message);
    }
  }
  try {
    var antwort = await fetch('./assets/models/manifest.json', { cache: 'no-cache' });
    if (!antwort.ok) return;
    var manifest = await antwort.json();
    for (var i = 0; i < (manifest.assets || []).length; i++) {
      var asset = manifest.assets[i];
      try {
        var datei = await fetch('./assets/models/' + asset.file);
        if (!datei.ok) throw new Error('HTTP ' + datei.status);
        registriereExternesAsset(asset.id, szeneFuer(await datei.arrayBuffer()));
      } catch (fehler) {
        console.warn('[terra-assets] Fallback fuer ' + asset.id + ': ' + fehler.message);
      }
    }
  } catch (fehler) {
    console.warn('[terra-assets] Manifest-Fallback: ' + fehler.message);
  }
}

export function externesAsset(id) {
  var vorlage = externe.get(id);
  return vorlage ? vorlage.clone(true) : null;
}
