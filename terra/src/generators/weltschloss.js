// Eigenstaendige Hero-Landmarke fuer Herrschaftsbereiche. Anders als ein
// gestreuter Schloss-Pool waechst sie semantisch: Ort, Region und Nation
// veraendern Ausbau, Silhouette und Beleuchtung, nicht nur den Zahlenmassstab.
import * as THREE from 'three';
import { DEG, hashi } from '../core/rng.js';
import { groupOf } from '../core/store.js';
import { heightAt } from '../world/terrain.js';
import { terraMat, tintedMats } from '../render/materials.js';
import { M, mergeGeos, part, prismGeo } from '../assets/geometrie-hilfen.js';
import { landmarkenBereich, landmarkenSkala } from './landmarken-bereich.js';

const BX = THREE.BoxGeometry;
const CY = THREE.CylinderGeometry;
const CO = THREE.ConeGeometry;
const PL = THREE.PlaneGeometry;
const STEIN = 0x676863, STEIN_DUNKEL = 0x3b4140, DACH = 0x354b50;
const KUPFER = 0x55786f, HOLZ = 0x4a3529, LICHT = 0xffc76f;
const TUCH = 0x9e623f, TUCH_HELL = 0xd0a45d;

const schlossMat = terraMat({ vertexColors: true, familie: 'stein' });
const lichtMat = terraMat({ vertexColors: true, familie: 'putz', emissive: LICHT });
const akzentMat = terraMat({ vertexColors: true, familie: 'stoff', side: THREE.DoubleSide });
lichtMat.emissiveIntensity = 2.6;
tintedMats.push(schlossMat, lichtMat, akzentMat);

function box(p, x, y, z, w, h, d, farbe, ry) {
  p.push(part(new BX(w, h, d), M(x, y, z, 0, ry || 0, 0), farbe));
}
function turm(p, x, z, r, h, nation) {
  p.push(part(new CY(r * 1.08, r, h, 10), M(x, h * 0.5, z), STEIN));
  p.push(part(new CY(r * 1.18, r * 1.18, 0.32, 10), M(x, h, z), STEIN_DUNKEL));
  p.push(part(new CO(r * 1.36, r * 2.05, nation ? 8 : 6),
    M(x, h + r * 1.04, z), nation ? KUPFER : DACH));
  for (var i = 0; i < 3; i++) {
    var y = 1.35 + i * 1.5;
    if (y < h - 0.4) box(p, x, y, z + r * 0.995, r * 0.32, 0.58, 0.08, LICHT);
  }
}
function baueGeometrie(ausbau) {
  var p = [], nation = ausbau === 3;
  // Felsfundament und zentraler Palas bilden auf jeder Stufe dieselbe klare
  // Lesbarkeit; weitere Ringe kommen nur bei groesseren Herrschaftsbereichen.
  p.push(part(new CY(7.2, 8.1, 1.2, 10), M(0, 0.6, 0), STEIN_DUNKEL));
  box(p, 0, 4.2, 0, 7.4, 6.2, 5.4, STEIN);
  p.push(part(prismGeo(8.2, 2.4, 6.1), M(0, 7.35, 0), DACH));
  turm(p, -4.5, 3.7, 1.45, 7.4, nation);
  turm(p, 4.5, 3.7, 1.45, 7.4, nation);
  if (ausbau >= 2) {
    turm(p, -5.5, -4.7, 1.62, 8.3, nation);
    turm(p, 5.5, -4.7, 1.62, 8.3, nation);
    box(p, 0, 2.55, -4.7, 10.8, 4.2, 1.05, STEIN);
    box(p, -5.5, 2.1, -0.5, 1.05, 3.3, 7.5, STEIN_DUNKEL);
    box(p, 5.5, 2.1, -0.5, 1.05, 3.3, 7.5, STEIN_DUNKEL);
  }
  if (nation) {
    turm(p, -7.2, 0, 1.25, 6.4, true);
    turm(p, 7.2, 0, 1.25, 6.4, true);
    box(p, 0, 1.8, 5.4, 12.4, 2.8, 0.95, STEIN_DUNKEL);
    // Nationales Torhaus mit gestaffeltem Bergfried statt bloss groesserer Kopie.
    box(p, 0, 4.15, 5.15, 4.4, 6.2, 2.5, STEIN);
    box(p, 0, 7.75, 5.15, 3.1, 1.15, 2.9, KUPFER);
  }
  var geo = mergeGeos(p);
  geo.userData.terraWeltschloss = true;
  geo.userData.terraBereichAusbau = ausbau;
  geo.userData.terraSilhouette = ausbau === 3 ? 'nationalburg-drei-ringe' :
    (ausbau === 2 ? 'regionsschloss-zwei-ringe' : 'ortsschloss-kernburg');
  return geo;
}
function baueLicht(ausbau) {
  var p = [], n = ausbau === 3 ? 9 : (ausbau === 2 ? 6 : 3);
  for (var i = 0; i < n; i++) {
    var a = i / n * Math.PI * 2;
    p.push(part(new PL(0.42, 0.72), M(Math.sin(a) * 4.1, 4.2,
      Math.cos(a) * 3.15, 0, a, 0), LICHT));
  }
  return mergeGeos(p);
}
function baueBanner(ausbau) {
  var p = [], n = ausbau === 3 ? 5 : (ausbau === 2 ? 3 : 1);
  for (var i = 0; i < n; i++) {
    var x = (i - (n - 1) / 2) * 2.6;
    p.push(part(new CY(0.045, 0.045, 3.4, 5), M(x, 10.2, 0), HOLZ));
    p.push(part(new PL(1.05, 1.8), M(x + 0.53, 10.85, 0, 0, 0, 0),
      i % 2 ? TUCH_HELL : TUCH));
  }
  return mergeGeos(p);
}

const GEOMETRIEN = Object.freeze([null, baueGeometrie(1), baueGeometrie(2), baueGeometrie(3)]);
const LICHTER = Object.freeze([null, baueLicht(1), baueLicht(2), baueLicht(3)]);
const BANNER = Object.freeze([null, baueBanner(1), baueBanner(2), baueBanner(3)]);
const belebt = [];

export function genWeltschloss(el) {
  var p = el.params || {}, bereich = landmarkenBereich(p);
  var skala = landmarkenSkala(p, 0.55, 2.2);
  var yaw = (Number(p.drehung) || 0) * DEG;
  var gruppe = groupOf(el);
  for (var i = 0; i < el.points.length; i++) {
    var pt = el.points[i], boden = heightAt(pt.x, pt.z);
    var haupt = new THREE.Mesh(GEOMETRIEN[bereich.ausbau].clone(), schlossMat);
    haupt.position.set(pt.x, boden, pt.z); haupt.rotation.y = yaw;
    haupt.scale.setScalar(skala); haupt.castShadow = haupt.receiveShadow = true;
    haupt.userData.el = el; haupt.userData.terraBereich = bereich.id; gruppe.add(haupt);
    var licht = new THREE.Mesh(LICHTER[bereich.ausbau].clone(), lichtMat);
    licht.position.copy(haupt.position); licht.rotation.y = yaw; licht.scale.setScalar(skala);
    licht.userData.el = el; gruppe.add(licht);
    var banner = new THREE.Mesh(BANNER[bereich.ausbau].clone(), akzentMat);
    banner.position.copy(haupt.position); banner.rotation.y = yaw; banner.scale.setScalar(skala);
    banner.userData.el = el; gruppe.add(banner);
    var schein = new THREE.PointLight(LICHT, 6 * skala, 26 * skala, 2);
    schein.position.set(pt.x, boden + 8 * skala, pt.z); schein.userData.el = el; gruppe.add(schein);
    banner.userData.terraAnimation = { yaw: yaw, skala: skala,
      phase: hashi(el.seed, i, 9917) * Math.PI * 2, schein: schein };
    belebt.push(banner);
  }
}

export function tickWeltschloesser(zeit) {
  for (var i = belebt.length - 1; i >= 0; i--) {
    var banner = belebt[i];
    if (!banner.parent) { belebt.splice(i, 1); continue; }
    var a = banner.userData.terraAnimation;
    var wind = Math.sin(zeit * 0.75 + a.phase) * 0.012;
    banner.rotation.y = a.yaw + wind;
    banner.rotation.z = wind * 0.7;
    a.schein.intensity = 6 * a.skala * (1 + Math.sin(zeit * 1.4 + a.phase) * 0.04);
  }
}

export { GEOMETRIEN as WELTSCHLOSS_GEOMETRIEN };
