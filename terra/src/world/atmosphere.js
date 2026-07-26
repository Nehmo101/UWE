// Atmosphaere: Tageszeit-Presets (Licht, Nebel, Himmel, Look), weiche Blende,
// dazu die bewegten Kleinigkeiten (Voegel, Schornsteinrauch, Wolkenschatten-Drift).
import * as THREE from 'three';
import { clamp, lerp, sstep, hashi, rngOf, rr } from '../core/rng.js';
import { terraUniforms, tintedMats, vineMat } from '../render/materials.js';
import { TEX } from '../render/textures.js';
import { POOLS } from '../core/pools.js';
import { schattenMat } from '../core/pools.js';
import { waterMat } from './water.js';
import { paintSky, setSonne, setSonnenDir, setWolkenFarben, cirrusMat,
  CLOUD_DRIFT_MITTEL } from './sky.js';
import { setLook } from '../render/pipeline.js';
import { cam, camera } from '../editor/camera.js';

/* ==========================================================================
   Tageszeit-Presets. Jedes definiert die komplette Stimmung: Sonne,
   Hemisphaere, Gegenlicht, beide Nebelfarben samt Distanzen und Deckel,
   Himmelsverlauf mit fuenf Stuetzstellen, Wolkenfarben, Wolkenschatten,
   Kontaktschatten, Belichtung, Bloom und Farbgraduierung.
   ========================================================================== */
var PRESETS = {
  morgen: {
    sonneDir: [-0.80, 0.26, 0.50], sonne: 0xffd2a0, sonneStk: 2.4,
    hemiHimmel: 0xc6d9ec, hemiBoden: 0xbfae94, hemiStk: 0.85,
    gegen: 0x9db8d8, gegenStk: 0.28,
    fogWarm: 0xf8e2bc, fogCool: 0xc2d2e2, fogNah: 195, fogFern: 860, fogCap: 1.0,
    himmel: [0x6d9cc8, 0x93b9dc, 0xbcd3e6, 0xf0e3cd, 0xf9eeda],
    scheibe: 0xffe8c8, scheibeGr: 170, gegenGlow: 0xd8e2ee,
    wolkeOben: 0xfff4e4, wolkeUnten: 0xb9c2d2, wolkeRand: 0xffe2b8, wolkeFern: 0xdfe6ec,
    wolkeDeck: 0.82, wolkenschatten: 0.16, fenster: 1.1,
    schatten: 0.34, wasser: 0x4a95ab, welt: 0xf4f2ee, bounce: 0xd8cebc,
    // F1-Startwert (Feinkalibrierung: F4): aufgehelltes, kuehles Morgenblau —
    // Hue ~20° blauwaerts gegenueber bounce, hell genug fuer den 15-%-Sockel.
    schattenKuehl: 0x96a8c8,
    belichtung: 0.98,
    // Kalibrierkorridor (F4): Landschaftsmassen S 0.25–0.50, Werteumfang
    // 0.20–0.85, reines Weiss nur Wolkenlichtern vorbehalten. Bloomschwelle
    // >= 1.0: nur echte Lichter bluehen. satMitte 1.2 → 1.15: "Mitten rauf"
    // gilt, aber 1.2 trieb die Wiesen an den oberen S-Rand (~0.5);
    // satLicht < 1 (Lichter entsaettigen) bleibt unveraendert.
    bloom: { staerke: 0.22, radius: 0.7, schwelle: 1.0 },
    grade: { lift: [0.014, 0.022, 0.040], gamma: [1.0, 1.0, 1.0], gain: [1.06, 1.02, 0.95],
      satMitte: 1.15, satLicht: 0.94, schwarz: 0.028, vignette: 0.10 }
  },
  mittag: {
    sonneDir: [0.45, 0.75, 0.35], sonne: 0xfff2dc, sonneStk: 2.6,
    hemiHimmel: 0xbfd8ee, hemiBoden: 0xcbb896, hemiStk: 0.9,
    gegen: 0xa8c8e8, gegenStk: 0.32,
    fogWarm: 0xf2e8d4, fogCool: 0xc8d8e4, fogNah: 240, fogFern: 980, fogCap: 1.0,
    himmel: [0x4f92cf, 0x77aede, 0xa8cbe8, 0xe6ecdf, 0xf6f1e3],
    scheibe: 0xfff8ec, scheibeGr: 120, gegenGlow: 0xd2e0ea,
    wolkeOben: 0xffffff, wolkeUnten: 0xb6c4d4, wolkeRand: 0xfff2da, wolkeFern: 0xd8e4ee,
    wolkeDeck: 0.78, wolkenschatten: 0.25, fenster: 0.0,
    schatten: 0.45, wasser: 0x3f93ad, welt: 0xffffff, bounce: 0xe0d8c0,
    // F1-Startwert (Feinkalibrierung: F4): neutrales Himmelblau — mittags
    // kommt die Schattenfuellung vom blauen Himmel, nicht von warmem Bounce.
    schattenKuehl: 0x8ea6c4,
    belichtung: 0.98,
    // Kalibrierkorridor (F4): Landschaftsmassen S 0.25–0.50, Werteumfang
    // 0.20–0.85. Hoechste Bloomschwelle des Tages (1.05) — hartes Mittags-
    // licht soll zeichnen, nicht leuchten. satMitte 1.22 → 1.15: grenzwertig
    // hoch, die hellste Stimmung braucht die wenigste Nachsaettigung;
    // satLicht < 1 bleibt.
    bloom: { staerke: 0.18, radius: 0.7, schwelle: 1.05 },
    grade: { lift: [0.010, 0.016, 0.028], gamma: [1.0, 1.0, 1.0], gain: [1.05, 1.03, 0.97],
      satMitte: 1.15, satLicht: 0.95, schwarz: 0.024, vignette: 0.10 }
  },
  abend: {
    // Die staerkste Stimmung: dunkle Silhouetten gegen warmen Himmel, kuehle
    // Schatten gegen warmes Licht. Der Nebel staffelt, statt zu ueberdecken.
    sonneDir: [-0.95, 0.10, -0.26], sonne: 0xff9a4e, sonneStk: 2.5,
    hemiHimmel: 0x55639c, hemiBoden: 0x4c4238, hemiStk: 0.34,
    gegen: 0x7a86b8, gegenStk: 0.42,
    fogWarm: 0xf6b070, fogCool: 0x757ea6, fogNah: 260, fogFern: 1150, fogCap: 1.0,
    himmel: [0x252a55, 0x4a4a7c, 0x8d6a90, 0xf0a860, 0xffd9a0],
    scheibe: 0xffc078, scheibeGr: 260, gegenGlow: 0x8d94c2,
    wolkeOben: 0xf6c294, wolkeUnten: 0x6e6f96, wolkeRand: 0xffb060, wolkeFern: 0x9a8aa2,
    wolkeDeck: 0.85, wolkenschatten: 0.06, fenster: 2.6,
    schatten: 0.4, wasser: 0x46567c, welt: 0xe8d2c0, bounce: 0x9a8ca0,
    // F1-Startwert (Feinkalibrierung: F4): kaeltestes und dunkelstes Blau der
    // vier Stimmungen — der Abend lebt vom maximalen Kalt-Warm-Kontrast
    // zwischen orangem Licht und blauvioletten Schatten.
    schattenKuehl: 0x5a628e,
    belichtung: 0.94,
    // Kalibrierkorridor (F4): das Abendrot behaelt den groessten Tonwert-
    // umfang (dunkelste Silhouetten gegen den hellsten Himmel), deshalb
    // niedrigster lift-Sockel und die einzige Schwelle unter 1.0 (0.92 — ok,
    // bleibt ueber der ~0.9-Untergrenze). satMitte 1.05 bleibt: der Kontrast
    // kommt hier aus Kalt-Warm, nicht aus Saettigung; satLicht 0.9 bleibt.
    bloom: { staerke: 0.34, radius: 0.75, schwelle: 0.92 },
    grade: { lift: [0.012, 0.020, 0.050], gamma: [0.90, 0.90, 0.95], gain: [1.10, 1.0, 0.88],
      satMitte: 1.05, satLicht: 0.9, schwarz: 0.02, vignette: 0.12 }
  },
  nebel: {
    // Kontrast reduziert, aber das Motiv bleibt lesbar: halbe Dichte und ein
    // Deckel, unter den nahe Objekte nicht fallen.
    sonneDir: [0.20, 0.92, 0.22], sonne: 0xf2f2ea, sonneStk: 0.9,
    hemiHimmel: 0xe0e8ea, hemiBoden: 0xcfcabc, hemiStk: 1.1,
    gegen: 0xdfe4e4, gegenStk: 0.12,
    fogWarm: 0xeceada, fogCool: 0xdde4e2, fogNah: 110, fogFern: 880, fogCap: 0.86,
    himmel: [0xb9c6cc, 0xc9d4d6, 0xd9e0de, 0xe8ebe4, 0xf0f1ea],
    scheibe: 0xf6f4ea, scheibeGr: 90, gegenGlow: 0xe4e8e4,
    wolkeOben: 0xf2f4f0, wolkeUnten: 0xd4dad8, wolkeRand: 0xf0eee2, wolkeFern: 0xe2e7e2,
    wolkeDeck: 0.5, wolkenschatten: 0.0, fenster: 1.6,
    schatten: 0.15, wasser: 0xa6bcbb, welt: 0xf4f6f2, bounce: 0xdcd8cc,
    // F1-Startwert (Feinkalibrierung: F4): fast neutral, kaum blaeuer als das
    // Umgebungslicht — Nebel frisst Farbkontrast, kuehle Schatten wuerden
    // hier kuenstlich wirken.
    schattenKuehl: 0xaeb8bc,
    belichtung: 1.05,
    // Kalibrierkorridor (F4): bewusst engster Werteumfang, aber lesbar —
    // fogCap 0.86 deckelt den Nebelfaktor, nahe Objekte behalten Zeichnung.
    // satMitte/satLicht < 1 druecken die Saettigung insgesamt (einzige
    // Stimmung, in der das erlaubt ist); hoechste Bloomschwelle 1.1, damit
    // das flache Licht nirgends blueht. Werte bleiben.
    bloom: { staerke: 0.10, radius: 0.6, schwelle: 1.1 },
    grade: { lift: [0.030, 0.034, 0.040], gamma: [1.0, 1.0, 1.0], gain: [1.0, 1.0, 1.0],
      satMitte: 0.85, satLicht: 0.8, schwarz: 0.05, vignette: 0.08 }
  }
};

/* --- Lichtaufbau: Sonne, Hemisphaere, schwaches kuehles Gegenlicht ------- */
var sun = new THREE.DirectionalLight(0xfff2dc, 2.6);
var hemi = new THREE.HemisphereLight(0xbfd8ee, 0xcbb896, 0.9);
var rimLight = new THREE.DirectionalLight(0xa8c8e8, 0.32);

var todName = "mittag";
var todFrom = null, todTo = PRESETS.mittag, todT = 1;
var fogMittel = new THREE.Color();          // Fallback-Nebelfarbe (Rauch, fog.color)
var sceneHook = null;

function getTodName() { return todName; }

var _a = new THREE.Color(), _b = new THREE.Color(), _m = new THREE.Color();
function mixHex(ka, kb, e, out) { _a.set(ka); _b.set(kb); out.copy(_a).lerp(_b, e); return out; }
function mixNum(a, b, e) { return lerp(a, b, e); }
function mixArr(a, b, e) { return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)]; }

var _dir = new THREE.Vector3();
var _col = new THREE.Color();

/** Blendet zwischen todFrom und todTo und schreibt alles in die Welt. */
function applyTod(t) {
  var a = todFrom || todTo, b = todTo;
  var e = t * t * (3 - 2 * t);

  _dir.set(lerp(a.sonneDir[0], b.sonneDir[0], e), lerp(a.sonneDir[1], b.sonneDir[1], e),
    lerp(a.sonneDir[2], b.sonneDir[2], e)).normalize();
  sun.position.copy(_dir).multiplyScalar(600);
  mixHex(a.sonne, b.sonne, e, sun.color);
  sun.intensity = mixNum(a.sonneStk, b.sonneStk, e);
  mixHex(a.hemiHimmel, b.hemiHimmel, e, hemi.color);
  mixHex(a.hemiBoden, b.hemiBoden, e, hemi.groundColor);
  hemi.intensity = mixNum(a.hemiStk, b.hemiStk, e);
  rimLight.position.copy(_dir).multiplyScalar(-600);
  rimLight.position.y = Math.abs(rimLight.position.y) * 0.5 + 120;
  mixHex(a.gegen, b.gegen, e, rimLight.color);
  rimLight.intensity = mixNum(a.gegenStk, b.gegenStk, e);

  // Nebel: zwei Farben in die Uniforms, Mittelwert als Fallback in scene.fog
  mixHex(a.fogWarm, b.fogWarm, e, terraUniforms.uFogWarm.value);
  mixHex(a.fogCool, b.fogCool, e, terraUniforms.uFogCool.value);
  terraUniforms.uSunDir.value.copy(_dir);
  terraUniforms.uFogCap.value = mixNum(a.fogCap, b.fogCap, e);
  mixHex(a.bounce, b.bounce, e, terraUniforms.uBounce.value);
  // F1: kuehle Schattenfarbe blendet wie alle Farbfelder weich mit
  mixHex(a.schattenKuehl, b.schattenKuehl, e, terraUniforms.uSchattenKuehl.value);
  fogMittel.copy(terraUniforms.uFogWarm.value).lerp(terraUniforms.uFogCool.value, 0.5);
  if (sceneHook && sceneHook.fog) {
    sceneHook.fog.color.copy(fogMittel);
    sceneHook.fog.near = mixNum(a.fogNah, b.fogNah, e);
    sceneHook.fog.far = mixNum(a.fogFern, b.fogFern, e);
  }
  terraUniforms.uCloudAmt.value = mixNum(a.wolkenschatten, b.wolkenschatten, e);
  // Fensterglut: warme Emission bei Abendrot, Morgen und Nebel
  var glut = mixNum(a.fenster === undefined ? 0 : a.fenster,
    b.fenster === undefined ? 0 : b.fenster, e);
  if (POOLS.fensterlicht && POOLS.fensterlicht.mat) POOLS.fensterlicht.mat.emissiveIntensity = glut;

  // Himmel mit fuenf Stuetzstellen
  var h = [];
  for (var i = 0; i < 5; i++) h.push(mixHex(a.himmel[i], b.himmel[i], e, _col).getHex());
  paintSky(h[0], h[1], h[2], h[3], h[4]);
  setSonnenDir(_dir);
  setSonne(_dir, mixHex(a.scheibe, b.scheibe, e, _col).getHex(),
    mixNum(a.scheibeGr, b.scheibeGr, e),
    mixHex(a.gegenGlow, b.gegenGlow, e, _m).getHex());
  setWolkenFarben(mixHex(a.wolkeOben, b.wolkeOben, e, _col).getHex(),
    mixHex(a.wolkeUnten, b.wolkeUnten, e, _m).getHex(),
    mixHex(a.wolkeRand, b.wolkeRand, e, _a).getHex(),
    mixHex(a.wolkeFern, b.wolkeFern, e, _b).getHex(),
    mixNum(a.wolkeDeck, b.wolkeDeck, e));
  cirrusMat.opacity = mixNum(a.wolkeDeck, b.wolkeDeck, e) * 0.24;

  schattenMat.opacity = mixNum(a.schatten, b.schatten, e);
  mixHex(a.wasser, b.wasser, e, waterMat.color);
  mixHex(a.welt, b.welt, e, _col);
  for (var m = 0; m < tintedMats.length; m++) tintedMats[m].color.copy(_col);
  vineMat.emissive.copy(_col).multiplyScalar(0.32);

  setLook({
    belichtung: mixNum(a.belichtung, b.belichtung, e),
    bloom: { staerke: mixNum(a.bloom.staerke, b.bloom.staerke, e),
      radius: mixNum(a.bloom.radius, b.bloom.radius, e),
      schwelle: mixNum(a.bloom.schwelle, b.bloom.schwelle, e) },
    grade: { lift: mixArr(a.grade.lift, b.grade.lift, e),
      gamma: mixArr(a.grade.gamma, b.grade.gamma, e),
      gain: mixArr(a.grade.gain, b.grade.gain, e),
      satMitte: mixNum(a.grade.satMitte, b.grade.satMitte, e),
      satLicht: mixNum(a.grade.satLicht, b.grade.satLicht, e),
      schwarz: mixNum(a.grade.schwarz, b.grade.schwarz, e),
      vignette: mixNum(a.grade.vignette, b.grade.vignette, e) },
    horizont: fogMittel
  });
}

/** Merkt sich den Ist-Zustand als Blendquelle und startet die Ueberblendung. */
function schnappschuss() {
  var a = todFrom || todTo, b = todTo, e = todT * todT * (3 - 2 * todT);
  var s = {};
  for (var k in b) {
    var va = a[k], vb = b[k];
    if (typeof vb === 'number') s[k] = lerp(va, vb, e);
    else if (Array.isArray(vb) && typeof vb[0] === 'number' && vb.length === 3 && k !== 'himmel')
      s[k] = mixArr(va, vb, e);
    else if (k === 'himmel') {
      s[k] = [];
      for (var i = 0; i < 5; i++) s[k].push(mixHex(va[i], vb[i], e, _col).getHex());
    }
    else if (k === 'bloom' || k === 'grade') {
      s[k] = {};
      for (var kk in vb) {
        s[k][kk] = Array.isArray(vb[kk]) ? mixArr(va[kk], vb[kk], e) : lerp(va[kk], vb[kk], e);
      }
    }
    else s[k] = vb;   // Hex-Zahlen sind numbers und oben schon abgedeckt
  }
  // Hex-Farben sind numbers — lerp im Zahlenraum waere falsch. Farbfelder gezielt:
  ['sonne','hemiHimmel','hemiBoden','gegen','fogWarm','fogCool','scheibe','gegenGlow',
   'wolkeOben','wolkeUnten','wolkeRand','wolkeFern','wasser','welt','bounce',
   'schattenKuehl'].forEach(function (k) {
    s[k] = mixHex(a[k], b[k], e, _col).getHex();
  });
  return s;
}

function setTod(name, instant) {
  if (!PRESETS[name]) return;
  todFrom = schnappschuss();
  todTo = PRESETS[name];
  todName = name;
  todT = instant ? 1 : 0;
  applyTod(todT);
  var btns = document.querySelectorAll("#bar .tod");
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("on", btns[i].dataset.t === name);
}

/** Blende und Wolkenschatten-Drift, von der Renderschleife bedient. */
function tickAtmosphere(raw) {
  if (todT < 1) { todT = Math.min(1, todT + Math.min(0.3, raw) / 1.1); applyTod(todT); }
  // Wolkenschatten wandern synchron zur mittleren Wolkenlage
  terraUniforms.uCloudDrift.value.x += CLOUD_DRIFT_MITTEL * raw * 0.006;
}

function initAtmosphere(scene) {
  sceneHook = scene;
  scene.add(sun);
  scene.add(hemi);
  scene.add(rimLight);
  scene.add(birdMesh);
  scene.add(rauchMesh);
}

/* ==========================================================================
   Voegel und Schornsteinrauch (unveraendert aus der Einzeldatei portiert)
   ========================================================================== */
var BIRD_FLOCKS = 5, BIRD_PER = 7, BIRD_N = BIRD_FLOCKS * BIRD_PER;
var birdGeo = (function () {
  var v = [0, 0, 0, -1, 0.4, -0.6, -0.7, 0.02, -0.16,
           0, 0, 0, -0.7, 0.02, 0.16, -1, 0.4, 0.6];
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(18).fill(0.26), 3));
  g.computeVertexNormals();
  return g;
})();
var birdMesh = new THREE.InstancedMesh(birdGeo,
  new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), BIRD_N);
birdMesh.frustumCulled = false;
birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
var flocks = [];
(function () {
  var rng = rngOf(0xb17d5);
  for (var f = 0; f < BIRD_FLOCKS; f++) {
    var mitglieder = [];
    for (var b = 0; b < BIRD_PER; b++) {
      var reihe = Math.floor(b / 2) + 1, seite = (b % 2) ? 1 : -1;
      mitglieder.push({ dx: -reihe * rr(rng, 2.4, 3.4), dz: seite * reihe * rr(rng, 2.2, 3.2),
        dy: rr(rng, -1.5, 1.5), phase: rng() * 6.28, s: rr(rng, 1.1, 1.9) });
    }
    flocks.push({ x: rr(rng, -400, 400), z: rr(rng, -400, 400), y: rr(rng, 55, 150),
      kurs: rng() * 6.28, v: rr(rng, 5, 9), voegel: mitglieder });
  }
})();
var _birdObj = new THREE.Object3D();
_birdObj.rotation.order = "YXZ";
function updateBirds(dt, t) {
  var i = 0;
  for (var f = 0; f < flocks.length; f++) {
    var fl = flocks[f];
    fl.kurs += Math.sin(t * 0.13 + f) * 0.09 * dt;
    fl.x += Math.cos(fl.kurs) * fl.v * dt;
    fl.z += Math.sin(fl.kurs) * fl.v * dt;
    if (fl.x - cam.focus.x > 560) fl.x -= 1120;
    if (fl.x - cam.focus.x < -560) fl.x += 1120;
    if (fl.z - cam.focus.z > 560) fl.z -= 1120;
    if (fl.z - cam.focus.z < -560) fl.z += 1120;
    var ck = Math.cos(fl.kurs), sk = Math.sin(fl.kurs);
    for (var b = 0; b < fl.voegel.length; b++, i++) {
      var v = fl.voegel[b];
      var flap = Math.sin(t * 5.5 + v.phase);
      _birdObj.position.set(
        fl.x + v.dx * ck - v.dz * sk,
        fl.y + v.dy + flap * 0.5,
        fl.z + v.dx * sk + v.dz * ck);
      _birdObj.rotation.set(0, -fl.kurs, flap * 0.35, "YXZ");
      _birdObj.scale.setScalar(v.s);
      _birdObj.updateMatrix();
      birdMesh.setMatrixAt(i, _birdObj.matrix);
    }
  }
  birdMesh.instanceMatrix.needsUpdate = true;
}


var RAUCH_MAX = 90, RAUCH_PUFF = 4;
var rauchGeo = new THREE.PlaneGeometry(2, 2);
rauchGeo.setAttribute("color", new THREE.BufferAttribute(
  new Float32Array(rauchGeo.attributes.position.count * 3).fill(1), 3));
var rauchMesh = new THREE.InstancedMesh(rauchGeo,
  new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3,
    depthWrite: false, map: TEX.rauchPuff }), RAUCH_MAX * RAUCH_PUFF);
rauchMesh.frustumCulled = false;
rauchMesh.renderOrder = 3;
rauchMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
rauchMesh.instanceColor = new THREE.InstancedBufferAttribute(
  new Float32Array(RAUCH_MAX * RAUCH_PUFF * 3).fill(1), 3);
rauchMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
rauchMesh.count = 0;
var rauchPunkte = [];
var _rauchObj = new THREE.Object3D(), _rauchCol = new THREE.Color();
var C_RAUCH = new THREE.Color(0xf2eee6);
function updateRauch(t) {
  var n = Math.min(RAUCH_MAX, rauchPunkte.length / 3), k = 0;
  for (var i = 0; i < n; i++) {
    var x = rauchPunkte[i * 3], y = rauchPunkte[i * 3 + 1], z = rauchPunkte[i * 3 + 2];
    for (var q = 0; q < RAUCH_PUFF; q++) {
      var ph = ((t * 0.16 + q / RAUCH_PUFF + i * 0.37) % 1);
      var drift = ph * ph * 5;
      _rauchObj.position.set(x + drift * 0.9 + Math.sin(t * 0.5 + i) * 0.5,
        y + ph * 11, z + drift * 0.45);
      // oben breiter und durchsichtiger; Billboard zur Kamera gedreht
      var sc = (0.3 + ph * 2.3);
      _rauchObj.scale.set(sc, sc * 0.85, sc);
      _rauchObj.rotation.set(0, Math.atan2(camera.position.x - _rauchObj.position.x,
        camera.position.z - _rauchObj.position.z), 0);
      _rauchObj.updateMatrix();
      rauchMesh.setMatrixAt(k, _rauchObj.matrix);
      _rauchCol.copy(C_RAUCH).lerp(fogMittel, 0.15 + ph * 0.85);
      rauchMesh.setColorAt(k, _rauchCol);
      k++;
    }
  }
  rauchMesh.count = k;
  rauchMesh.instanceMatrix.needsUpdate = true;
  if (rauchMesh.instanceColor) rauchMesh.instanceColor.needsUpdate = true;
}


/** Rauchquellen kommen aus dem Dirty-Flush der Pools. */
function setRauchQuellen(punkte) {
  rauchPunkte.length = 0;
  for (var i = 0; i < punkte.length; i++) rauchPunkte.push(punkte[i]);
}

export { PRESETS, setTod, getTodName, applyTod, tickAtmosphere, initAtmosphere,
  updateBirds, updateRauch, setRauchQuellen, sun, hemi, rimLight, fogMittel };
