// Wasserflaeche mit sanftem Wogen und ein kleiner Meeresboden-Teller.
// In der Distanz uebernimmt der (richtungsabhaengige) Nebel den Uebergang
// zum Himmel — die Kartenkante schneidet nicht mehr ins Bild.
import * as THREE from 'three';
import { KARTE } from '../core/store.js';
import { terraMat, tintedMats, terraUniforms } from '../render/materials.js';
import { TEX } from '../render/textures.js';
import { cam, camera } from '../editor/camera.js';
// Bruchmaske (H6). Zyklusfrei: generators/paths.js zieht rng/store/pools/
// terrain/objects/materials/geometry — keines davon importiert world/water.js
// (geprueft: water.js wird nur von main.js, editor/io.js und
// world/atmosphere.js importiert).
import { bruchMaskeUniforms } from '../generators/paths.js';
// Seeflaechen (Nachtrag Runde H): see.js exportiert Materialien, Uniforms und
// Anmeldeliste; water.js — der Besitzer der Wogenformel — patcht sie unten.
// Dieselbe Richtung wie bruchMaskeUniforms eine Zeile hoeher, und aus
// demselben Grund zyklusfrei: see.js zieht rng/store/pools/terrain/biomfeld/
// wegsuche/objects/zeichen/materials — keines davon importiert world/water.js.
// Die Gegenrichtung (see.js -> water.js) drehte die Modulreihenfolge von
// main.js um; Pruefung 19 haelt fest, dass sie nicht existiert.
import { seeWogen, seeWogenAufraeumen } from '../generators/see.js';

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

/* --- Die Wogen: EINE Quelle fuer CPU und Shader (C4) ---------------------
   updateWater() verschiebt die Stuetzpunkte, der Streifen-Patch unten wertet
   dieselbe Funktion pro Fragment aus. Beide Formeln muessen exakt gleich
   bleiben — driften sie auseinander, laegen die gemalten Lichtstreifen neben
   den Wellenkaemmen. Deshalb stehen die neun Konstanten hier und NUR hier;
   die GLSL-Fassung wird daraus erzeugt.
   Die Umschreibung ist wertidentisch zur frueheren Inline-Formel: der
   zweite Term hatte `- t * 0.55` und traegt jetzt w = -0.55 (Vorzeichen-
   wechsel und Subtraktion sind in IEEE-754 dieselbe Operation).            */
var WOGE = [
  { k: 0.045, w:  0.70, amp: 0.32 },   // ueber x
  { k: 0.031, w: -0.55, amp: 0.26 },   // ueber z
  { k: 0.018, w:  0.35, amp: 0.20 }    // diagonal
];

function glslZahl(n) {
  var s = String(n);
  return (s.indexOf('.') < 0 && s.indexOf('e') < 0) ? s + '.0' : s;
}

/** GLSL-Zwilling der Wogenformel aus updateWater(). */
function wogeGLSL() {
  return 'float terraWoge( vec2 p, float t ) {\n' +
    '  return sin( p.x * ' + glslZahl(WOGE[0].k) + ' + t * ' + glslZahl(WOGE[0].w) +
      ' ) * ' + glslZahl(WOGE[0].amp) + '\n' +
    '       + sin( p.y * ' + glslZahl(WOGE[1].k) + ' + t * ' + glslZahl(WOGE[1].w) +
      ' ) * ' + glslZahl(WOGE[1].amp) + '\n' +
    '       + sin( ( p.x + p.y ) * ' + glslZahl(WOGE[2].k) + ' + t * ' + glslZahl(WOGE[2].w) +
      ' ) * ' + glslZahl(WOGE[2].amp) + ';\n' +
    '}\n';
}

/* --- C4: gemalte Himmelsspiegelung ---------------------------------------
   Ghibli-Wasser ist Farbflaeche plus Akzente, keine Spiegelung. Statt eines
   zweiten Renderdurchgangs mit gespiegelter Kamera bekommt das Wasser wenige
   helle Striche, die mit der Woge wandern:

   1. Die Kaemme der Woge (terraWoge in WELTkoordinaten, exakt dieselbe
      Formel wie die CPU-Verschiebung) liefern breite Baender.
   2. Eine zweite, sehr niederfrequente Modulation bricht die Baender in
      einzelne Striche — eine durchgehende Linie ueber die halbe Karte waere
      genau das Streifenmuster, das der Look verbietet.
   3. Die Staerke haengt am Betrachtungswinkel: streifender Blick sieht viel
      Himmel im Wasser, der Blick von oben fast keinen.
   4. Die Farbe ist die Horizontfarbe des Himmels (terraUniforms.uHorizont,
      von setLook aus der Tageszeit gespeist) — die Striche sind morgens
      warm, nachts kuehl, ohne dass hier etwas nachgezogen werden muss.

   Der Beitrag geht additiv auf reflectedLight.indirectDiffuse (Anker
   #include <lights_fragment_end>, wie Rimlight und Arborlicht in
   materials.js): dort ist die Beleuchtung fertig, der Strich wird also NICHT
   noch einmal mit der Diffusfarbe des Wassers multipliziert.               */
var streifUniforms = {
  uWasserZeit: { value: 0 },
  uStreifStaerke: { value: 0.30 },
  uStreifSchwelle: { value: 0.34 }
};

var STREIF_FRAG =
  'float terraStreifH = terraWoge( vTerraW.xz, uWasserZeit );\n' +
  'float terraStreif = smoothstep( uStreifSchwelle, uStreifSchwelle + 0.16, terraStreifH );\n' +
  'float terraStreifL = 0.50 + 0.30 * sin( vTerraW.x * 0.0105 - vTerraW.z * 0.0082\n' +
  '  + uWasserZeit * 0.11 ) + 0.20 * sin( vTerraW.x * 0.021 - vTerraW.z * 0.017\n' +
  '  - uWasserZeit * 0.07 );\n' +
  'terraStreif *= smoothstep( 0.38, 0.82, terraStreifL );\n' +
  'float terraStreifB = 1.0 - abs( dot( normalize( vViewPosition ), normal ) );\n' +
  'terraStreif *= 0.15 + 0.85 * terraStreifB * terraStreifB;\n' +
  'float terraWasserLuft = smoothstep( 0.18, 0.92, terraStreifB );\n' +
  'reflectedLight.indirectDiffuse += uHorizont * uStreifStaerke\n' +
  '  * ( terraStreif + terraWasserLuft * 0.055 );\n';

/** Leitet die Normale direkt aus der bereits verformten Wasseroberflaeche ab.
 *  So reagieren Kammlicht und Fresnel auf dieselbe Woge, ohne Normalmap,
 *  zusaetzliche Textur oder CPU-Puffer-Upload. */
function patchWasserNormale(shader) {
  var anker = '#include <normal_fragment_maps>';
  if (shader.fragmentShader.indexOf(anker) < 0) {
    console.warn('terra: Shader-Patch "wassernormale" fand seinen Anker nicht.');
    return;
  }
  shader.fragmentShader = shader.fragmentShader.replace(anker, anker +
    '\nvec3 terraWasserN = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) );' +
    '\nif ( dot( terraWasserN, normal ) < 0.0 ) terraWasserN = -terraWasserN;' +
    '\nnormal = normalize( mix( normal, terraWasserN, 0.68 ) );');
}

function patchHimmelsStreifen(shader) {
  shader.uniforms.uHorizont = terraUniforms.uHorizont;
  shader.uniforms.uWasserZeit = streifUniforms.uWasserZeit;
  shader.uniforms.uStreifStaerke = streifUniforms.uStreifStaerke;
  shader.uniforms.uStreifSchwelle = streifUniforms.uStreifSchwelle;
  // vTerraW liefert Patch (3) von terraPatch (Weltposition als Varying).
  if (shader.fragmentShader.indexOf('varying vec3 vTerraW;') < 0) {
    console.warn('terra: Shader-Patch "himmelsstreifen" findet kein vTerraW — ' +
      'das Wasser bleibt ohne gemalte Himmelsspiegelung.');
    return;
  }
  var anker = '#include <lights_fragment_end>';
  if (shader.fragmentShader.indexOf(anker) < 0) {
    console.warn('terra: Shader-Patch "himmelsstreifen" fand seinen Anker nicht — ' +
      'das Wasser bleibt ohne gemalte Himmelsspiegelung.');
    return;
  }
  shader.fragmentShader = 'uniform vec3 uHorizont;\nuniform float uWasserZeit;\n' +
    'uniform float uStreifStaerke;\nuniform float uStreifSchwelle;\n' + wogeGLSL() +
    shader.fragmentShader.replace(anker, anker + '\n' + STREIF_FRAG);
}

/** Umhuellt onBeforeCompile/customProgramCacheKey wie bruchAusschnitt und
 *  koexistiert mit ihm: beide Patches haengen an verschiedenen Ankern
 *  (lights_fragment_end bzw. alphatest_fragment) und schreiben jeweils HINTER
 *  ihren Anker, der dabei erhalten bleibt. Die Reihenfolge der Umhuellung ist
 *  deshalb egal. Der Cache-Schluessel muss wie dort mitwachsen. */
function himmelsStreifen(mat) {
  var vorher = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader) {
    if (vorher) vorher.call(this, shader);
    patchWasserNormale(shader);
    patchHimmelsStreifen(shader);
  };
  var schluessel = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () {
    return (schluessel ? schluessel.call(this) : '') + '|streif';
  };
  return mat;
}

/** Staerke der gemalten Himmelsstreifen (0 = aus, Default 0.30). */
function setStreifen(staerke) {
  streifUniforms.uStreifStaerke.value =
    (typeof staerke === 'number' && staerke > 0) ? staerke : 0;
}

/* --- C4b: die Seeflaeche lebt (Nachtrag Runde H) --------------------------
   Die Binnenseen (generators/see.js) standen bisher voellig still: keine
   Wogen, keine Himmelsstreifen. Beides kommt aus DIESEM Modul, denn hier
   stehen die neun Wogenkonstanten, und sie duerfen nur hier stehen (C4).

   Anders als beim Meer laeuft die Bewegung NICHT ueber die CPU: das Meer
   verschiebt je Bild ~1100 Stuetzpunkte und laedt den Puffer neu hoch — fuer
   eine kartenfuellende Ebene mit einem einzigen Mesh ist das der richtige
   Weg. Seen sind viele kleine Meshes (je bis ~320 Punkte), die mit Undo
   kommen und gehen; eine CPU-Schleife darueber muesste eine Liste pflegen
   UND je Bild Puffer hochladen. Stattdessen verschiebt der VERTEXSHADER mit
   exakt derselben Formel (wogeGLSL — die eine Quelle fuer alles, was wogt),
   gedaempft ueber uSeeWoge. Je Bild kostet das nur die Uhr: see.js schreibt
   uSeeZeit pro gerendertem Seemesh in onBeforeRender (siehe dort), ohne See
   laeuft nichts.

   Die Daempfung sitzt NUR in der Verschiebung, nicht in der Kammsuche der
   Streifen: eine gleichmaessig skalierte Woge hat ihre Kaemme an denselben
   Stellen, die Striche sitzen also auch gedaempft exakt auf den Kaemmen.

   Objektraum == Weltraum: see.js baut seine Flaechen in Weltkoordinaten und
   haengt sie in eine unverschobene Elementgruppe — `transformed.xz` IST die
   Weltlage, ohne modelMatrix-Umweg. Die Streifen im Fragment nutzen wie beim
   Meer das Varying vTerraW aus terraPatch (3).

   Der Saum bekommt nur die Verschiebung (gleiche Uhr, gleiche Formel — er
   klebt dadurch auf der Flaeche), die Streifen nur die Flaeche: eine
   Brandungsborte mit Himmelsstrichen darauf waere doppelt gemalt.          */
var SEE_WOGE_ANKER = '#include <begin_vertex>';

var SEE_STREIF_FRAG =
  'float terraSeeH = terraWoge( vTerraW.xz, uSeeZeit );\n' +
  'float terraSeeStreif = smoothstep( uStreifSchwelle, uStreifSchwelle + 0.16, terraSeeH );\n' +
  'float terraSeeL = 0.50 + 0.30 * sin( vTerraW.x * 0.0105 - vTerraW.z * 0.0082\n' +
  '  + uSeeZeit * 0.11 ) + 0.20 * sin( vTerraW.x * 0.021 - vTerraW.z * 0.017\n' +
  '  - uSeeZeit * 0.07 );\n' +
  'terraSeeStreif *= smoothstep( 0.38, 0.82, terraSeeL );\n' +
  'float terraSeeB = 1.0 - abs( dot( normalize( vViewPosition ), normal ) );\n' +
  'terraSeeStreif *= 0.15 + 0.85 * terraSeeB * terraSeeB;\n' +
  'float terraSeeLuft = smoothstep( 0.18, 0.92, terraSeeB );\n' +
  'reflectedLight.indirectDiffuse += uHorizont * uSeeStreif\n' +
  '  * ( terraSeeStreif + terraSeeLuft * 0.045 );\n';

function patchSeeWoge(shader, streifen) {
  shader.uniforms.uSeeZeit = seeWogen.uniforms.uSeeZeit;
  shader.uniforms.uSeeWoge = seeWogen.uniforms.uSeeWoge;
  if (shader.vertexShader.indexOf(SEE_WOGE_ANKER) < 0) {
    console.warn('terra: Shader-Patch "seewoge" fand seinen Anker nicht — ' +
      'die Seeflaeche steht still.');
  } else {
    shader.vertexShader = 'uniform float uSeeZeit;\nuniform float uSeeWoge;\n' + wogeGLSL() +
      shader.vertexShader.replace(SEE_WOGE_ANKER, SEE_WOGE_ANKER +
        '\ntransformed.y += terraWoge( transformed.xz, uSeeZeit ) * uSeeWoge;');
  }
  if (!streifen) return;
  patchWasserNormale(shader);
  shader.uniforms.uHorizont = terraUniforms.uHorizont;
  shader.uniforms.uSeeStreif = seeWogen.uniforms.uSeeStreif;
  shader.uniforms.uStreifSchwelle = streifUniforms.uStreifSchwelle;
  // vTerraW liefert Patch (3) von terraPatch (Weltposition als Varying).
  if (shader.fragmentShader.indexOf('varying vec3 vTerraW;') < 0) {
    console.warn('terra: Shader-Patch "seestreifen" findet kein vTerraW — ' +
      'der See bleibt ohne gemalte Himmelsspiegelung.');
    return;
  }
  var anker = '#include <lights_fragment_end>';
  if (shader.fragmentShader.indexOf(anker) < 0) {
    console.warn('terra: Shader-Patch "seestreifen" fand seinen Anker nicht — ' +
      'der See bleibt ohne gemalte Himmelsspiegelung.');
    return;
  }
  shader.fragmentShader = 'uniform vec3 uHorizont;\nuniform float uSeeZeit;\n' +
    'uniform float uSeeStreif;\nuniform float uStreifSchwelle;\n' + wogeGLSL() +
    shader.fragmentShader.replace(anker, anker + '\n' + SEE_STREIF_FRAG);
}

/** Umhuellt onBeforeCompile/customProgramCacheKey wie himmelsStreifen oben;
 *  der Cache-Schluessel MUSS mitwachsen (Begruendung bei bruchAusschnitt). */
function seeWogenAnbinden(mat, streifen) {
  var vorher = mat.onBeforeCompile;
  mat.onBeforeCompile = function (shader) {
    if (vorher) vorher.call(this, shader);
    patchSeeWoge(shader, streifen);
  };
  var schluessel = mat.customProgramCacheKey;
  mat.customProgramCacheKey = function () {
    return (schluessel ? schluessel.call(this) : '') + '|seewoge' + (streifen ? 's' : '');
  };
  return mat;
}
seeWogenAnbinden(seeWogen.flaecheMat, true);
seeWogenAnbinden(seeWogen.saumMat, false);

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
var waterMat = himmelsStreifen(bruchAusschnitt(terraMat({
  color: 0x3f93ad, transparent: true, opacity: 0.68, depthWrite: false,
  map: TEX.foamEdge
}), false));
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
  // Dieselbe Zeit treibt die gemalten Himmelsstreifen im Shader (C4) — nur so
  // sitzen sie auf den Kaemmen, die hier verschoben werden.
  streifUniforms.uWasserZeit.value = t;
  // See-Anmeldeliste nachfuehren (geloeschte Seeflaechen austragen). Hinter
  // dem Groessen-Vergleich kostet der Zweig ohne Seen genau diesen Vergleich.
  if (seeWogen.aktive.size > 0) seeWogenAufraeumen();
  var p = waterGeo.attributes.position, arr = p.array;
  for (var i = 0; i < p.count; i++) {
    var x = waterBaseXZ[i * 2], z = waterBaseXZ[i * 2 + 1];
    arr[i * 3 + 1] = Math.sin(x * WOGE[0].k + t * WOGE[0].w) * WOGE[0].amp
      + Math.sin(z * WOGE[1].k + t * WOGE[1].w) * WOGE[1].amp
      + Math.sin((x + z) * WOGE[2].k + t * WOGE[2].w) * WOGE[2].amp;
  }
  p.needsUpdate = true;
}

export { water, waterMat, seabed, initWater, wasserSichtbar, updateWater,
  wasserNeuBauen, setStreifen };
