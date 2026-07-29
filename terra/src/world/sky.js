// Himmel: Kuppel mit fuenf Stuetzstellen, Sonnenscheibe mit Halo, Gegengluehen,
// Zirrenschicht und Cumulus-Billboards in drei Tiefenlagen.
import * as THREE from 'three';
import { clamp, lerp, sstep, hashi, rngOf, rr } from '../core/rng.js';
// Bedienungsrunde: der Wolkenschalter lebt als S.wolken im Kartenzustand —
// eine Quelle fuer Billboards (hier), Bodenschatten (atmosphere.js) und
// Speicherformat (io.js).
import { S } from '../core/store.js';
import { TEX } from '../render/textures.js';
import { cam, camera } from '../editor/camera.js';

/* --- Kuppel ------------------------------------------------------------- */
var skyGeo = new THREE.SphereGeometry(1500, 32, 24);
skyGeo.setAttribute("color", new THREE.BufferAttribute(
  new Float32Array(skyGeo.attributes.position.count * 3), 3));
var skyDome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
  vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false
}));
skyDome.renderOrder = -10;
skyDome.frustumCulled = false;

/** Die ganze Himmelsgruppe folgt der Kamera. */
var skyGroup = new THREE.Group();
skyGroup.add(skyDome);

var _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(),
    _c4 = new THREE.Color(), _c5 = new THREE.Color(), _tmp = new THREE.Color();

/**
 * Fuenf Stuetzstellen: Zenit, oberer Uebergang, Mittelband, Horizontgluehen
 * und ein schmaler, noch hellerer Streifen direkt am Horizont.
 */
function paintSky(zenit, oben, mitte, glut, horizont) {
  _c1.set(zenit); _c2.set(oben); _c3.set(mitte); _c4.set(glut); _c5.set(horizont);
  var pos = skyGeo.attributes.position, col = skyGeo.attributes.color;
  for (var i = 0; i < pos.count; i++) {
    var y = pos.getY(i) / 1500;
    _tmp.copy(_c5).lerp(_c4, sstep(-0.005, 0.05, y));
    _tmp.lerp(_c3, sstep(0.045, 0.20, y));
    _tmp.lerp(_c2, sstep(0.18, 0.45, y));
    _tmp.lerp(_c1, sstep(0.42, 0.8, y));
    if (y < 0) _tmp.multiplyScalar(lerp(1, 0.86, sstep(0, -0.35, y)));
    col.setXYZ(i, _tmp.r, _tmp.g, _tmp.b);
  }
  col.needsUpdate = true;
}

/* --- Sonnenscheibe und Gegengluehen ------------------------------------- */
var sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: TEX.sunDisc, transparent: true, depthWrite: false, depthTest: false, fog: false
}));
sunSprite.renderOrder = -9;
skyGroup.add(sunSprite);

var gegenSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: TEX.glow, transparent: true, depthWrite: false, depthTest: false, fog: false,
  opacity: 0.16
}));
gegenSprite.renderOrder = -9;
skyGroup.add(gegenSprite);

/** Sonnenrichtung, Scheibenfarbe und -groesse aus dem Tageszeit-Preset. */
function setSonne(dir, farbeHex, groesse, gegenHex) {
  sunSprite.position.copy(dir).multiplyScalar(1350);
  sunSprite.material.color.set(farbeHex);
  sunSprite.scale.setScalar(groesse);
  gegenSprite.position.set(-dir.x, Math.max(0.04, -dir.y * 0.3), -dir.z).normalize()
    .multiplyScalar(1380);
  gegenSprite.material.color.set(gegenHex);
  gegenSprite.scale.set(900, 380, 1);
}

/* --- Sterne: deterministisches Punktfeld auf der Kuppel-Halbkugel --------
   ~300 Punkte, verteilt ueber rngOf(0x57e11a) — kein Math.random. Groesse
   und Helligkeit variieren pro Stern. Der Mond IST die vorhandene
   Sonnenscheibe (scheibe/scheibeGr kommen aus dem Tageszeit-Preset), es gibt
   KEIN eigenes Mond-Objekt. Sichtbarkeit steuert atmosphere.js aus der
   Tageszeit-Blende ueber setSterne(alpha).                                  */
var STERNE_N = 300;
var sternGeo = new THREE.BufferGeometry();
(function () {
  var rng = rngOf(0x57e11a);
  var pos = new Float32Array(STERNE_N * 3);
  var col = new Float32Array(STERNE_N * 3);
  var gr = new Float32Array(STERNE_N);
  for (var i = 0; i < STERNE_N; i++) {
    // Gleichverteilung auf der Halbkugel (y uniform = flaechentreu), knapp
    // innerhalb der Kuppel (Radius 1430 < 1500), unterhalb des Horizonts nichts.
    var y = rr(rng, 0.07, 0.995);
    var w = rr(rng, 0, Math.PI * 2);
    var rxz = Math.sqrt(Math.max(0, 1 - y * y));
    pos[i * 3] = Math.cos(w) * rxz * 1430;
    pos[i * 3 + 1] = y * 1430;
    pos[i * 3 + 2] = Math.sin(w) * rxz * 1430;
    // Helligkeit variiert; Kalt-Warm auch hier: die meisten Sterne kuehl-
    // weiss, rund jeder sechste kippt leicht ins Warme.
    var hell = rr(rng, 0.35, 1.0);
    var warm = rng() < 0.18;
    col[i * 3]     = hell * (warm ? 1.0  : 0.82);
    col[i * 3 + 1] = hell * (warm ? 0.92 : 0.90);
    col[i * 3 + 2] = hell * (warm ? 0.78 : 1.0);
    gr[i] = rr(rng, 0.5, 1.6);
  }
  sternGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sternGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sternGeo.setAttribute('sternGr', new THREE.BufferAttribute(gr, 1));
})();
var sternMat = new THREE.PointsMaterial({
  size: 2.8, sizeAttenuation: false, vertexColors: true, transparent: true,
  opacity: 0, depthWrite: false, depthTest: false, fog: false
});
// Groessenvariation pro Stern: Shader-Patch mit Ankerpruefung (Konvention).
sternMat.onBeforeCompile = function (shader) {
  var anker = 'gl_PointSize = size;';
  if (shader.vertexShader.indexOf(anker) >= 0) {
    shader.vertexShader = 'attribute float sternGr;\n' +
      shader.vertexShader.replace(anker, 'gl_PointSize = size * sternGr;');
  } else {
    console.warn('terra: Shader-Patch "sterngroesse" fand seinen Anker nicht.');
  }
};
sternMat.customProgramCacheKey = function () { return 'terraSterne'; };
var sternPunkte = new THREE.Points(sternGeo, sternMat);
sternPunkte.renderOrder = -9.5;   // knapp ueber der Kuppel (-10), unter der Scheibe (-9)
sternPunkte.frustumCulled = false;
sternPunkte.visible = false;
skyGroup.add(sternPunkte);        // folgt wie die Kuppel der Kamera

/** Sternsichtbarkeit 0..1, aus der Tageszeit-Ueberblendung gespeist. */
function setSterne(alpha) {
  sternMat.opacity = alpha;
  sternPunkte.visible = alpha > 0.003;
}

/* --- F5: Bewegungsdisziplin am Himmel -----------------------------------
   In den Vorlagen steht der Himmel praktisch. Beide Tempofaktoren wirken
   AUSSCHLIESSLICH an der Driftstelle (updateClouds/updateCirren); die
   Erzeugungsbloecke mit rngOf/rr bleiben Zeichen fuer Zeichen unveraendert,
   damit Positionen, Groessen, Blob-Versaetze und der Zufallsstrom identisch
   bleiben — es aendert sich nur, wie schnell ein bereits erzeugtes v
   abgefahren wird.

   WOLKEN_TEMPO 0.45: Cumulus liefen mit v = 0.22 .. 1.22 Welteinheiten/s
   (Mittel 0.62), jetzt mit 0.10 .. 0.55 (Mittel 0.279). Eine Wolke braucht
   fuer die 1560 Einheiten des Umlaufs damit rund 1.6 h statt 42 min.

   ZIRREN_TEMPO 0.12: Zirren liefen mit 0.25 .. 0.55 (Mittel 0.40) — nur
   knapp langsamer als die Cumulus, obwohl der Kommentar "sehr langsam"
   versprach. Jetzt 0.030 .. 0.066 (Mittel 0.048), also rund 5.8-mal
   langsamer als die mittlere Cumuluslage. Damit stehen sie fuer das Auge.

   Die Wetterskala bleibt erhalten: main.js ruft updateSky(dt * getWolkenTempo()),
   der Faktor greift also weiterhin voll auf beide Schichten.                */
var WOLKEN_TEMPO = 0.45;
var ZIRREN_TEMPO = 0.12;

/* --- Zirren: wenige langgezogene Streifen, sehr langsam ----------------- */
var CIRRUS_N = 7;
var cirrusMat = new THREE.MeshBasicMaterial({
  map: TEX.cirrus, transparent: true, depthWrite: false, fog: false, opacity: 0.2,
  side: THREE.DoubleSide
});
var cirrusMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  cirrusMat, CIRRUS_N);
cirrusMesh.frustumCulled = false;
cirrusMesh.renderOrder = -8;
var cirren = [];
(function () {
  var rng = rngOf(0xc1235);
  for (var i = 0; i < CIRRUS_N; i++) {
    cirren.push({ x: rr(rng, -900, 900), z: rr(rng, -900, 900), y: rr(rng, 380, 470),
      l: rr(rng, 420, 760), b: rr(rng, 60, 130), a: rr(rng, 0, Math.PI),
      v: rr(rng, 0.25, 0.55) });
  }
})();
var _cirObj = new THREE.Object3D();

/* --- Cumulus: Billboards mit vertikalem Farbverlauf --------------------- */
var CLOUD_N = 40, CLOUD_BLOBS = 4;
var LUFT_WOLKEN_ABSENKUNG = [145, 90, 25];
var cloudGeo = new THREE.PlaneGeometry(1, 1);
var cloudUniforms = {
  uWolkeOben: { value: new THREE.Color(0xffffff) },
  uWolkeUnten: { value: new THREE.Color(0xb9c6d4) }
};
var cloudMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, map: TEX.cloudPuff
});
// Vertikaler Verlauf pro Puff: Oberseite Lichtfarbe, Unterseite Schattenton.
cloudMat.onBeforeCompile = function (shader) {
  shader.uniforms.uWolkeOben = cloudUniforms.uWolkeOben;
  shader.uniforms.uWolkeUnten = cloudUniforms.uWolkeUnten;
  var anker = '#include <map_fragment>';
  if (shader.fragmentShader.indexOf(anker) >= 0 &&
      shader.fragmentShader.indexOf('#include <map_pars_fragment>') >= 0) {
    shader.fragmentShader = 'uniform vec3 uWolkeOben;\nuniform vec3 uWolkeUnten;\n' +
      shader.fragmentShader.replace(anker, anker +
        '\n#ifdef USE_MAP\nfloat terraWolkenHoehe = smoothstep( 0.08, 0.92, vMapUv.y );\n' +
        'float terraWolkenKern = 1.0 - abs( vMapUv.y * 2.0 - 1.0 );\n' +
        'vec3 terraWolkenFarbe = mix( uWolkeUnten, uWolkeOben, terraWolkenHoehe * terraWolkenHoehe );\n' +
        'diffuseColor.rgb *= terraWolkenFarbe * ( 0.91 + terraWolkenKern * 0.09 );\n' +
        'diffuseColor.a *= smoothstep( 0.035, 0.18, diffuseColor.a );\n#endif');
  } else {
    console.warn('terra: Shader-Patch "wolkenverlauf" fand seinen Anker nicht.');
  }
};
cloudMat.customProgramCacheKey = function () { return 'terraWolke'; };
var cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, CLOUD_N * CLOUD_BLOBS);
cloudMesh.frustumCulled = false;
cloudMesh.renderOrder = 3;
cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
cloudMesh.instanceColor = new THREE.InstancedBufferAttribute(
  new Float32Array(CLOUD_N * CLOUD_BLOBS * 3).fill(1), 3);
cloudMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

/** Drei Tiefenlagen: nah/mittel/fern mit eigener Hoehe, Drift und Praesenz. */
var clouds = [];
(function () {
  var rng = rngOf(0x51ee7);
  for (var i = 0; i < CLOUD_N; i++) {
    var lage = i % 3;
    var blobs = [];
    for (var b = 0; b < CLOUD_BLOBS; b++) {
      blobs.push({ ox: rr(rng, -1, 1), oz: rr(rng, -0.7, 0.7), oy: rr(rng, -0.25, 0.25),
        s: rr(rng, 0.45, 1) });
    }
    clouds.push({
      x: rr(rng, -760, 760), z: rr(rng, -760, 760),
      y: [rr(rng, 205, 250), rr(rng, 255, 305), rr(rng, 310, 365)][lage],
      s: rr(rng, 26, 62) * [1.0, 1.15, 1.35][lage],
      v: rr(rng, 0.35, 0.9) * [1.35, 1.0, 0.62][lage],
      lage: lage, blobs: blobs
    });
  }
})();

var _sonnenDir = new THREE.Vector3(0.45, 0.72, 0.35);
var _basisFarbe = new THREE.Color(0xffffff);
var _randFarbe = new THREE.Color(0xffffff);
var _fernFarbe = new THREE.Color(0xdfe8f0);
var _cCol = new THREE.Color();

/**
 * Wolkenfarben aus dem Preset: Grundton, Streulicht-Rand zur Sonne,
 * Fernton (naehert die hinterste Lage an den Himmel an).
 */
function setWolkenFarben(obenHex, untenHex, randHex, fernHex, deckkraft) {
  cloudUniforms.uWolkeOben.value.set(obenHex);
  cloudUniforms.uWolkeUnten.value.set(untenHex);
  _randFarbe.set(randHex);
  _fernFarbe.set(fernHex);
  cloudMat.opacity = deckkraft;
  recolorClouds();
}
function setSonnenDir(dir) { _sonnenDir.copy(dir); }

/** Instanzfarben: sonnenzugewandte Puffs bekommen den Streulicht-Rand. */
function recolorClouds() {
  for (var i = 0; i < CLOUD_N; i++) {
    var c = clouds[i];
    var f = 0.92 + hashi(i, 7, 3) * 0.16;
    // Ausrichtung der Wolke relativ zur Sonne (nur XZ, grob und billig)
    var dx = c.x - cam.focus.x, dz = c.z - cam.focus.z;
    var l = Math.sqrt(dx * dx + dz * dz) || 1;
    var zurSonne = clamp((dx / l) * _sonnenDir.x + (dz / l) * _sonnenDir.z, -1, 1);
    _cCol.copy(_basisFarbe).multiplyScalar(f);
    if (zurSonne < 0) _cCol.lerp(_randFarbe, -zurSonne * 0.55);   // Sonnenseite
    if (c.lage === 2) _cCol.lerp(_fernFarbe, 0.55);               // hinten: Richtung Himmel
    else if (c.lage === 1) _cCol.lerp(_fernFarbe, 0.22);
    for (var b = 0; b < CLOUD_BLOBS; b++) cloudMesh.setColorAt(i * CLOUD_BLOBS + b, _cCol);
  }
  if (cloudMesh.instanceColor) cloudMesh.instanceColor.needsUpdate = true;
}

var _cloudObj = new THREE.Object3D();
function updateClouds(dt) {
  for (var i = 0; i < CLOUD_N; i++) {
    var c = clouds[i];
    c.x += c.v * WOLKEN_TEMPO * dt;
    if (c.x - cam.focus.x > 780) c.x -= 1560;
    if (c.x - cam.focus.x < -780) c.x += 1560;
    if (c.z - cam.focus.z > 780) c.z -= 1560;
    if (c.z - cam.focus.z < -780) c.z += 1560;
    for (var b = 0; b < CLOUD_BLOBS; b++) {
      var bl = c.blobs[b];
      var px = c.x + bl.ox * c.s, pz = c.z + bl.oz * c.s;
      // Im Luftarchipel ziehen die nahen Wolken deutlich unter den Inseln vorbei:
      // dieselben Instanzen, aber eine echte Vorder-/Mittel-/Fernstaffelung im Raum.
      var luftAbsenkung = S.biom === 'luftarchipel' ? LUFT_WOLKEN_ABSENKUNG[c.lage] : 0;
      _cloudObj.position.set(px, c.y - luftAbsenkung + bl.oy * c.s * 0.5, pz);
      // Billboard: bleibt aufrecht, dreht sich nur zur Kamera
      _cloudObj.rotation.set(0, Math.atan2(camera.position.x - px, camera.position.z - pz), 0);
      _cloudObj.scale.set(c.s * bl.s * 2.1, c.s * bl.s * 1.25, 1);
      _cloudObj.updateMatrix();
      cloudMesh.setMatrixAt(i * CLOUD_BLOBS + b, _cloudObj.matrix);
    }
  }
  cloudMesh.instanceMatrix.needsUpdate = true;
}

function updateCirren(dt) {
  for (var i = 0; i < CIRRUS_N; i++) {
    var c = cirren[i];
    // Zirren stehen praktisch: ~5.8-mal langsamer als die mittlere Cumuluslage
    c.x += c.v * ZIRREN_TEMPO * dt;
    if (c.x - cam.focus.x > 980) c.x -= 1960;
    if (c.x - cam.focus.x < -980) c.x += 1960;
    _cirObj.position.set(c.x, c.y, c.z);
    _cirObj.rotation.set(0, c.a, 0);
    _cirObj.scale.set(c.l, 1, c.b);
    _cirObj.updateMatrix();
    cirrusMesh.setMatrixAt(i, _cirObj.matrix);
  }
  cirrusMesh.instanceMatrix.needsUpdate = true;
}

function initSky(scene) {
  scene.add(skyGroup);
  scene.add(cloudMesh);
  scene.add(cirrusMesh);
}

/** Pro Frame: Kuppel folgt der Kamera, Wolken und Zirren driften.
 *
 *  Bedienungsrunde: `S.wolken === false` schaltet beide Wolkenschichten ab
 *  (Kartenfeld, tolerant gespeichert — editor/io.js). Die Sichtbarkeit wird
 *  hier je Bild nachgezogen statt in einem Setter: der Zustand hat genau
 *  EINE Quelle (S), und die Kuppel folgt der Kamera auch ohne Wolken. Der
 *  Bodenschatten der Wolken haengt an derselben Quelle (atmosphere.js,
 *  uCloudAmt). */
function updateSky(dt) {
  skyGroup.position.copy(camera.position);
  var an = S.wolken !== false;
  cloudMesh.visible = an;
  cirrusMesh.visible = an;
  if (!an) return;                 // stehende Wolken kosten dann auch nichts
  updateClouds(dt);
  updateCirren(dt);
}

/** Mittlere Driftgeschwindigkeit (fuer synchrone Wolkenschatten am Boden).
    MUSS WOLKEN_TEMPO enthalten: atmosphere.js schiebt uCloudDrift mit genau
    diesem Wert weiter, sonst laufen die Bodenschatten ihren Wolken davon. */
var CLOUD_DRIFT_MITTEL = 0.62 * WOLKEN_TEMPO;   // 0.279

export { initSky, updateSky, paintSky, setSonne, setSonnenDir, setWolkenFarben,
  setSterne, recolorClouds, cirrusMat, CLOUD_DRIFT_MITTEL,
  WOLKEN_TEMPO, ZIRREN_TEMPO };
