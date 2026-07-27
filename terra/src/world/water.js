// Wasserflaeche mit sanftem Wogen und ein kleiner Meeresboden-Teller.
// In der Distanz uebernimmt der (richtungsabhaengige) Nebel den Uebergang
// zum Himmel — die Kartenkante schneidet nicht mehr ins Bild.
import * as THREE from 'three';
import { KARTE } from '../core/store.js';
import { terraMat, tintedMats } from '../render/materials.js';
import { TEX } from '../render/textures.js';
import { cam, camera } from '../editor/camera.js';
// Bruchmaske (H6). Zyklusfrei: generators/paths.js zieht rng/store/pools/
// terrain/objects/materials/geometry — keines davon importiert world/water.js
// (geprueft: water.js wird nur von main.js und editor/io.js importiert).
import { bruchMaskeUniforms } from '../generators/paths.js';

/* --- Masse mit der Kartengroesse (H1b) ----------------------------------
   Beide Flaechen muessen die Karte plus Sichtweite ueberdecken, sonst
   schneidet ihre Kante ins Bild.

   Wasser: die Ebene ist auf den Ursprung zentriert, der Kamerafokus laeuft
   bis HALF+40 nach aussen, und ab dort traegt der Nebel (fogFern 860..1150
   in den Presets) den Uebergang. Der bisherige Wert 2000 entspricht genau
   872 Einheiten Rand jenseits der Kartenkante — dieser Rand bleibt
   konstant, denn er haengt am Nebel, nicht an der Karte. 256 -> 2000
   (unveraendert), 512 -> 2256, 1024 -> 2768.
   Die Segmentdichte bleibt ebenfalls konstant (62.5 Einheiten je Segment =
   2000/32), weil updateWater() die Wellen aus Weltkoordinaten rechnet:
   groebere Segmente wuerden die Wellenlaenge (~140 Einheiten) unterabtasten.

   Meeresboden: reiner Teller unter der Karte, der Nebel schluckt seinen
   Rand. Radius waechst proportional (360 deckt die halbe 256er-Diagonale
   von 181 doppelt ab); 256 -> 360 (unveraendert), 512 -> 720, 1024 -> 1440. */
var WASSER_RAND = 872;
function wasserGroesse() { return 2 * (KARTE.half + WASSER_RAND); }
function wasserSegmente() { return Math.round(wasserGroesse() / 62.5); }
function bodenRadius() { return 360 * (KARTE.map / 256); }

function baueWasserGeo() {
  var g = new THREE.PlaneGeometry(wasserGroesse(), wasserGroesse(), wasserSegmente(), wasserSegmente());
  g.rotateX(-Math.PI / 2);
  return g;
}

/* --- Bruchzonen aussparen (H6) -------------------------------------------
   Kanon: Terra ist auseinandergerissen. Eine Bruchkante (generators/paths.js)
   laesst das Terrain einseitig um 40..200 Einheiten ins Nichts fallen — die
   kartenfuellende Wasserebene bei y = 0 und der opake Meeresboden-Teller bei
   y = -24 wuerden daraus einen tiefen See mit Boden machen und alles darunter
   (Wurzelvorhaenge, schwebende Truemmer) verdecken.

   Beide Flaechen sampeln deshalb die Bruchmaske in WELTkoordinaten und
   verschwinden dort, wo sie hoch steht. Kein neues ShaderMaterial: die
   Materialien bleiben terraMat, ihr onBeforeCompile wird nur umhuellt
   (Projektkonvention: Ankerpruefung + console.warn, siehe terraPatch in
   render/materials.js).

   Zwei Spielarten:
     weich (Wasser)  — transparentes Material, also Alpha weich ausblenden und
                       erst bei voller Wirkung discarden. Die Kante treppt
                       dadurch nicht, obwohl discard binaer ist.
     hart (Teller)   — opakes Material, dort traegt kein Alpha. Der Schnitt
                       liegt bei Maske 0.5 und damit GENAU auf der Bruchkante,
                       wo das Terrain noch auf voller Hoehe steht: die harte
                       Kante des Tellers liegt unter unversehrtem Land und ist
                       von keinem Blickwinkel zu sehen. Zugleich ist das
                       Teller-Loch damit IMMER mindestens so gross wie das
                       Wasserloch (das erst bei 0.5 vollstaendig offen ist) —
                       es gibt keinen Streifen, in dem verblassendes Wasser
                       ueber fehlendem Boden schwebte, und keinen, in dem der
                       Teller durch die Abgrundwand schnitte.
   ------------------------------------------------------------------------- */
var BRUCH_FRAG =
  'if ( uBruchStaerke > 0.0 ) {\n' +
  '  vec2 terraBruchUV = vTerraW.xz * uBruchAbb.x + uBruchAbb.y;\n' +
  // Ausserhalb der Karte klemmt ClampToEdge auf die Randtexel — eine
  // Bruchkante am Kartenrand wuerde ihren Wert sonst ueber den kompletten
  // 872-Einheiten-Saum der Wasserebene schmieren. Deshalb hart auf 0 setzen.
  '  vec2 terraBruchIn = step( vec2( 0.0 ), terraBruchUV ) * step( terraBruchUV, vec2( 1.0 ) );\n' +
  '  float terraBruchM = texture2D( uBruchMaske, terraBruchUV ).r\n' +
  '    * terraBruchIn.x * terraBruchIn.y * uBruchStaerke;\n';

function patchBruchAusschnitt(shader, hart) {
  shader.uniforms.uBruchMaske = bruchMaskeUniforms.uBruchMaske;
  shader.uniforms.uBruchAbb = bruchMaskeUniforms.uBruchAbb;
  shader.uniforms.uBruchStaerke = bruchMaskeUniforms.uBruchStaerke;
  // vTerraW liefert Patch (3) von terraPatch (Weltposition als Varying).
  if (shader.fragmentShader.indexOf('varying vec3 vTerraW;') < 0) {
    console.warn('terra: Shader-Patch "bruchausschnitt" findet kein vTerraW — ' +
      'Wasser und Meeresboden werden an Bruchkanten nicht ausgespart.');
    return;
  }
  var anker = '#include <alphatest_fragment>';
  if (shader.fragmentShader.indexOf(anker) < 0) {
    console.warn('terra: Shader-Patch "bruchausschnitt" fand seinen Anker nicht — ' +
      'Wasser und Meeresboden werden an Bruchkanten nicht ausgespart.');
    return;
  }
  var kern = BRUCH_FRAG + (hart
    ? '  if ( terraBruchM > 0.5 ) discard;\n'
    : '  float terraBruchA = smoothstep( 0.12, 0.50, terraBruchM );\n' +
      '  diffuseColor.a *= 1.0 - terraBruchA;\n' +
      '  if ( terraBruchA >= 1.0 ) discard;\n') + '}\n';
  shader.fragmentShader = 'uniform sampler2D uBruchMaske;\nuniform vec2 uBruchAbb;\n' +
    'uniform float uBruchStaerke;\n' +
    shader.fragmentShader.replace(anker, anker + '\n' + kern);
}

/** Umhuellt onBeforeCompile/customProgramCacheKey eines terraMat-Materials.
 *  Der Cache-Schluessel MUSS mitwachsen: waterMat, das Teller-Material und
 *  z. B. flussMat (paths.js) liefern sonst denselben terraMat-Schluessel und
 *  koennten sich ein Programm teilen — der Ausschnitt landete dann im
 *  falschen Material oder fehlte im richtigen. */
function bruchAusschnitt(mat, hart) {
  var vorher = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader) {
    if (vorher) vorher.call(this, shader);
    patchBruchAusschnitt(shader, hart);
  };
  var schluessel = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () {
    return (schluessel ? schluessel.call(this) : '') + '|bruch' + (hart ? 'h' : 'w');
  };
  return mat;
}

var waterGeo = baueWasserGeo();
var waterMat = bruchAusschnitt(terraMat({
  color: 0x3f93ad, transparent: true, opacity: 0.68, depthWrite: false,
  map: TEX.foamEdge
}), false);
waterMat.map.repeat.set(26, 26);
var water = new THREE.Mesh(waterGeo, waterMat);
water.position.y = 0;
water.renderOrder = 4;
water.frustumCulled = false;

// Meeresboden nur als Teller unter der Karte, nicht als bildfuellende Lage.
function baueBodenGeo() {
  var g = new THREE.CircleGeometry(bodenRadius(), 48).rotateX(-Math.PI / 2);
  var n = g.attributes.position.count, arr = new Float32Array(n * 3);
  var c = new THREE.Color(0x1f4750);
  for (var i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return g;
}
var seabedGeo = baueBodenGeo();
var seabed = new THREE.Mesh(seabedGeo, bruchAusschnitt(terraMat({ vertexColors: true }), true));
seabed.position.y = -24;
seabed.frustumCulled = false;
// Grundfarbe liegt in den Vertexfarben, material.color bleibt weiss und ist
// frei fuer den Tageszeit-Grundton — sonst bliebe der Boden bei Abendrot neutral.
tintedMats.push(seabed.material);

function initWater(scene) {
  scene.add(water);
  scene.add(seabed);
}

var waterBaseXZ = [];
function merkeWasserXZ() {
  waterBaseXZ.length = 0;
  var p = waterGeo.attributes.position;
  for (var i = 0; i < p.count; i++) waterBaseXZ.push(p.getX(i), p.getZ(i));
}
merkeWasserXZ();

/** Kartengroesse hat sich geaendert: beide Geometrien neu bauen. Die MESHES
 *  bleiben dieselben Objekte (main.js haelt eine Referenz auf `water` und
 *  schaltet dessen visible), nur ihre Geometrie wird getauscht. */
function wasserNeuBauen() {
  water.geometry.dispose();
  waterGeo = baueWasserGeo();
  water.geometry = waterGeo;
  merkeWasserXZ();
  seabed.geometry.dispose();
  seabedGeo = baueBodenGeo();
  seabed.geometry = seabedGeo;
}

/** Wogen nur berechnen, wenn die Wasserfläche überhaupt im Bild liegt. */
var _wasserFrustum = new THREE.Frustum(), _wasserM = new THREE.Matrix4();
var _wasserBox = new THREE.Box3();
/** Wogen nur berechnen, wenn die Wasserflaeche ueberhaupt im Bild liegt. */
function wasserSichtbar(fogFar) {
  _wasserM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _wasserFrustum.setFromProjectionMatrix(_wasserM);
  var r = fogFar;
  _wasserBox.min.set(cam.focus.x - r, -1.5, cam.focus.z - r);
  _wasserBox.max.set(cam.focus.x + r, 1.5, cam.focus.z + r);
  return _wasserFrustum.intersectsBox(_wasserBox);
}

function updateWater(t) {
  var p = waterGeo.attributes.position, arr = p.array;
  for (var i = 0; i < p.count; i++) {
    var x = waterBaseXZ[i * 2], z = waterBaseXZ[i * 2 + 1];
    arr[i * 3 + 1] = Math.sin(x * 0.045 + t * 0.7) * 0.32 + Math.sin(z * 0.031 - t * 0.55) * 0.26
      + Math.sin((x + z) * 0.018 + t * 0.35) * 0.2;
  }
  p.needsUpdate = true;
}

export { water, waterMat, seabed, initWater, wasserSichtbar, updateWater, wasserNeuBauen };
