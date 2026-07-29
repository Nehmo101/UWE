/* ==========================================================================
   Statische Renderform der vollstaendigen Asset-Schau

   Im Editor bleibt jeder Pool ein eigenes InstancedMesh, weil dort viele
   Instanzen derselben Geometrie vorkommen. Die Schau ist der Gegenfall:
   505 Pools mit jeweils genau EINER Instanz. Ein Draw Call je Pool waere dort
   reine Verwaltung. Deshalb werden ausschliesslich fuer `?schau=assets` alle
   transformierten Geometrien mit rendergleichen Materialien zusammengelegt.
   Pool-IDs, Katalogdaten und normale Karten bleiben davon unberuehrt.
   ========================================================================== */
import * as THREE from 'three';
import { POOLS } from '../core/pools.js';
import { groupOf } from '../core/store.js';
import { mergeGeos } from '../assets/geometrie-hilfen.js';

var TEXTUR_IDS = new WeakMap();
var naechsteTexturId = 1;
var position = new THREE.Vector3();
var skalierung = new THREE.Vector3();
var euler = new THREE.Euler(0, 0, 0, 'YXZ');
var quaternion = new THREE.Quaternion();
var matrix = new THREE.Matrix4();

function objektId(objekt) {
  if (!objekt || (typeof objekt !== 'object' && typeof objekt !== 'function')) return '-';
  var id = TEXTUR_IDS.get(objekt);
  if (!id) {
    id = naechsteTexturId++;
    TEXTUR_IDS.set(objekt, id);
  }
  return id;
}

function farbeHex(farbe) {
  return farbe && typeof farbe.getHex === 'function' ? farbe.getHex() : 0;
}

/** Renderzustaende und Shaderform, die ein gemeinsames Material erlauben. */
export function assetSchauMaterialSchluessel(poolOderMaterial) {
  var material = poolOderMaterial && poolOderMaterial.mat
    ? poolOderMaterial.mat : poolOderMaterial;
  if (!material) throw new Error('Asset-Schau-Material fehlt');
  var programm = typeof material.customProgramCacheKey === 'function'
    ? material.customProgramCacheKey() : material.type;
  return [
    programm,
    material.type,
    material.side,
    material.transparent ? 1 : 0,
    material.opacity,
    material.alphaTest,
    material.alphaHash ? 1 : 0,
    material.alphaToCoverage ? 1 : 0,
    material.depthWrite ? 1 : 0,
    material.depthTest ? 1 : 0,
    material.depthFunc,
    material.colorWrite ? 1 : 0,
    material.blending,
    material.blendSrc,
    material.blendDst,
    material.blendEquation,
    material.blendSrcAlpha,
    material.blendDstAlpha,
    material.blendEquationAlpha,
    material.premultipliedAlpha ? 1 : 0,
    material.vertexColors ? 1 : 0,
    material.flatShading ? 1 : 0,
    material.toneMapped ? 1 : 0,
    material.fog ? 1 : 0,
    material.dithering ? 1 : 0,
    material.polygonOffset ? 1 : 0,
    material.polygonOffsetFactor,
    material.polygonOffsetUnits,
    material.wireframe ? 1 : 0,
    material.visible ? 1 : 0,
    farbeHex(material.color),
    farbeHex(material.emissive),
    material.emissiveIntensity || 0,
    material.roughness,
    material.metalness,
    material.envMapIntensity,
    material.lightMapIntensity,
    material.aoMapIntensity,
    material.bumpScale,
    material.displacementScale,
    material.displacementBias,
    material.normalScale ? material.normalScale.x : 1,
    material.normalScale ? material.normalScale.y : 1,
    objektId(material.map),
    objektId(material.alphaMap),
    objektId(material.emissiveMap),
    objektId(material.normalMap),
    objektId(material.bumpMap),
    objektId(material.roughnessMap),
    objektId(material.metalnessMap),
    objektId(material.aoMap),
    objektId(material.lightMap),
    objektId(material.envMap),
    objektId(material.displacementMap),
    objektId(material.gradientMap)
  ].join('|');
}

function transformiere(pool, instanz) {
  position.set(instanz[0], instanz[1], instanz[2]);
  euler.set(instanz[3], instanz[4], instanz[5], 'YXZ');
  quaternion.setFromEuler(euler);
  skalierung.set(instanz[6], instanz[7], instanz[8]);
  matrix.compose(position, quaternion, skalierung);
  var geometrie = pool.geo.clone();
  geometrie.applyMatrix4(matrix);
  return geometrie;
}

function brauchtTiefendetail(pool, instanz) {
  var groessteSkala = Math.max(
    Math.abs(instanz[6]), Math.abs(instanz[7]), Math.abs(instanz[8])
  );
  return pool.radius * groessteSkala >= 1.0;
}

function entsorgeQuellgeometrien(gruppen) {
  gruppen.forEach(function (gruppe) {
    for (var i = 0; i < gruppe.geometrien.length; i++) {
      gruppe.geometrien[i].dispose();
    }
    gruppe.geometrien.length = 0;
  });
}

function entsorgeMeshes(meshes) {
  for (var i = 0; i < meshes.length; i++) meshes[i].geometry.dispose();
}

/**
 * Ersetzt nur die Renderkopie der 505 Einzelinstanzen durch Materialgruppen.
 * `assetSchauInstanzen` behaelt den vollstaendigen Poolvertrag fuer Diagnose,
 * Auswahl und Tests; `el.inst` wird geleert, damit repack nichts doppelt malt.
 */
export function baueAssetSchauMeshes(el, layout) {
  if (!el || !el.inst) throw new Error('Asset-Schau-Meshes brauchen Instanzdaten');
  if (!layout || !Array.isArray(layout.placements)) {
    throw new Error('Asset-Schau-Meshes brauchen ein Layout');
  }
  var instanzen = el.inst;
  var gruppen = new Map();
  var meshes = [];
  var namen = new Set();
  try {
    for (var i = 0; i < layout.placements.length; i++) {
      var platzierung = layout.placements[i];
      var pool = POOLS[platzierung.name];
      var instanz = instanzen[platzierung.name];
      if (!pool || !instanz || instanz.length !== 12) {
        throw new Error('Unvollstaendige Schauinstanz: ' + platzierung.name);
      }
      if (namen.has(platzierung.name)) {
        throw new Error('Doppelte Schauinstanz: ' + platzierung.name);
      }
      namen.add(platzierung.name);
      var depthDetail = brauchtTiefendetail(pool, instanz);
      var key = assetSchauMaterialSchluessel(pool) +
        '|td' + (depthDetail ? '1' : '0');
      var gruppe = gruppen.get(key);
      if (!gruppe) {
        gruppe = {
          material: pool.mat,
          depthDetail: depthDetail,
          geometrien: [],
          namen: []
        };
        gruppen.set(key, gruppe);
      }
      gruppe.geometrien.push(transformiere(pool, instanz));
      gruppe.namen.push(platzierung.name);
    }

    gruppen.forEach(function (gruppe, key) {
      var geometrie = mergeGeos(gruppe.geometrien);
      var mesh;
      try {
        mesh = new THREE.Mesh(geometrie, gruppe.material);
        mesh.name = 'asset-schau-' + key.slice(0, 24);
        mesh.userData.el = el;
        mesh.userData.terraAssetSchau = true;
        mesh.userData.terraDepthDetail = gruppe.depthDetail;
        mesh.userData.terraAssetNamen = gruppe.namen.slice();
        meshes.push(mesh);
      } catch (fehler) {
        geometrie.dispose();
        throw fehler;
      }
    });
  } catch (fehler) {
    entsorgeQuellgeometrien(gruppen);
    entsorgeMeshes(meshes);
    console.warn('Asset-Schau-Merging fehlgeschlagen; Einzelpools bleiben aktiv.',
      fehler);
    el.assetSchauInstanzen = instanzen;
    el.assetSchauMeshGruppen = 0;
    return {
      pools: layout.placements.length,
      groups: 0,
      drawCallReduction: 0,
      fallback: true
    };
  }
  entsorgeQuellgeometrien(gruppen);

  var ziel;
  try {
    ziel = groupOf(el);
    for (i = 0; i < meshes.length; i++) ziel.add(meshes[i]);
  } catch (fehler) {
    if (ziel) {
      for (i = 0; i < meshes.length; i++) ziel.remove(meshes[i]);
    }
    entsorgeMeshes(meshes);
    el.assetSchauInstanzen = instanzen;
    el.assetSchauMeshGruppen = 0;
    console.warn('Asset-Schau-Gruppen konnten nicht aktiviert werden; ' +
      'Einzelpools bleiben aktiv.', fehler);
    return {
      pools: layout.placements.length,
      groups: 0,
      drawCallReduction: 0,
      fallback: true
    };
  }

  el.assetSchauInstanzen = instanzen;
  el.assetSchauMeshGruppen = gruppen.size;
  el.inst = {};
  return {
    pools: layout.placements.length,
    groups: gruppen.size,
    drawCallReduction: layout.placements.length - gruppen.size,
    fallback: false
  };
}
