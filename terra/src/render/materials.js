// Weltmaterialien: Phong pro Fragment, per onBeforeCompile gepatcht.
// Kein eigenes ShaderMaterial — Instancing, Vertexfarben und Fog blieben sonst
// auf der Strecke. Jede Ersetzung prueft ihren Zielstring gegen die Chunks der
// gepinnten Three-Version; schlaegt sie fehl, bleibt der Shader unveraendert
// und eine console.warn nennt den betroffenen Patch.
import * as THREE from 'three';
import { TEX } from './textures.js';
import { windUniforms, WIND_GLSL } from '../world/wind.js';
/* I6 — Biom-LUT. world/biomfeld.js haengt nur an core/rng.js und
   core/store.js und importiert nichts aus render/ — der Graph bleibt also
   azyklisch, obwohl world/terrain.js beide Dateien importiert. */
import { biomLutDaten, biomLutFormat } from '../world/biomfeld.js';

/** Feste Laenge des Arbor-Lichtarrays. GLSL kennt keine variablen Arrays —
 *  ungenutzte Plaetze tragen staerke 0 und kosten nur eine Multiplikation. */
const ARBOR_MAX = 8;

function arborLeer() {
  var a = [];
  for (var i = 0; i < ARBOR_MAX; i++) a.push(new THREE.Vector4(0, 0, 1, 0));
  return a;
}

/** Gemeinsame Uniforms aller Weltmaterialien (Tageszeit schreibt hinein). */
const terraUniforms = {
  uRim: { value: new THREE.Color(0xdcefff) },
  uBounce: { value: new THREE.Color(0xe0d8c0) },
  // Kuehle Schattenfarbe (F1): tiefe Schatten kippen Richtung Blau, statt nur
  // dunkler zu werden (Anime-Hintergrund-Regel: Schatten kuehl UND aufgehellt).
  // Die Tageszeit schreibt pro Preset hinein (atmosphere.js, schattenKuehl).
  uSchattenKuehl: { value: new THREE.Color(0x8ea6c4) },
  // Richtungsabhaengiger Nebel: warm zur Sonne hin, kuehl von ihr weg.
  uFogWarm: { value: new THREE.Color(0xe8e2d2) },
  uFogCool: { value: new THREE.Color(0xd4e0e8) },
  uSunDir: { value: new THREE.Vector3(0.45, 0.72, 0.35).normalize() },
  // Obergrenze des Nebelfaktors: haelt im Nebel-Preset nahe Objekte lesbar.
  uFogCap: { value: 1.0 },
  // C4 — Horizontfarbe des Himmels. Kein Weltmaterial-Patch liest sie; sie
  // liegt hier, weil terraUniforms der einzige zyklusfreie Treffpunkt
  // zwischen der Tageszeit (schreibt ueber setLook in render/pipeline.js)
  // und world/water.js (liest sie fuer die gemalten Himmelsstreifen) ist.
  // world/water.js darf world/atmosphere.js NICHT importieren — atmosphere
  // importiert waterMat, das waere ein Zyklus.
  uHorizont: { value: new THREE.Color(0xdfe8f0) },
  // Wolkenschatten am Boden (nur Terrainmaterial wertet sie aus).
  uCloudTex: { value: TEX.cloudNoise },
  uCloudDrift: { value: new THREE.Vector2(0, 0) },
  uCloudAmt: { value: 0.25 },
  // H2a Schneeauflage: EIN globales Uniform-Objekt beschneit die ganze Szene.
  // 0 = aus (der ganze Fragmentzweig faellt uniform-kohaerent weg).
  uSchneeAuflage: { value: 0 },
  uSchneeKante: { value: new THREE.Vector2(0.20, 0.70) },   // Rampe auf normal.y
  uSchneeHoehe: { value: new THREE.Vector2(-99, -98) },     // Welthoehenband
  uSchneeFarbe: { value: new THREE.Color(0xeff4f8) },
  uSchneeKuehle: { value: 0.12 },
  uSchneeBruch: { value: 0.35 },
  // H3 Arbor als Lichtquelle: bis zu ARBOR_MAX Rankenfuesse als
  // vec4( x, z, radius, staerke ). Kein echtes Punktlicht — Phong mit vielen
  // Lichtern erzwaenge neue Programme.
  uArborPos: { value: arborLeer() },
  uArborAnzahl: { value: 0 },
  uArborFarbe: { value: new THREE.Color(0xdfe8f0) },
  uArborStaerke: { value: 0 },
  /* I6 — Biomflaechen im Shader. Solange uBiomAn 0 ist (keine Flaeche auf der
     Karte), wird der ganze Zweig uniform-kohaerent uebersprungen und das Bild
     ist byteidentisch zu einer Fassung ohne diesen Patch. Die beiden Texturen
     zeigen dann auf 1x1-Attrappen, damit kein Sampler unbelegt bleibt. */
  uBiomAn: { value: 0 },
  uBiomKarte: { value: null },
  uBiomLut: { value: null },
  uBiomAbb: { value: new THREE.Vector2(1 / 257, 128.5 / 257) },
  uBiomZeilen: { value: 1 }
};

/**
 * Materialfamilien: jede Familie bindet eine Aquarellvariante mit eigener
 * Weltskala und Staerke. Alle Assets greifen ueber definePool auf diese
 * Namen zu, damit die Karte materiell zusammenhaengt.
 */
const FAMILIEN = {
  putz:       { tex: 'aquarellFein',   skala: 0.35, staerke: 0.12 },
  holz:       { tex: 'aquarellMittel', skala: 0.55, staerke: 0.16 },
  dachziegel: { tex: 'aquarellFein',   skala: 0.9,  staerke: 0.15 },
  reet:       { tex: 'aquarellMittel', skala: 0.8,  staerke: 0.18 },
  stein:      { tex: 'aquarellGrob',   skala: 0.28, staerke: 0.16 },
  metall:     { tex: 'aquarellFein',   skala: 0.5,  staerke: 0.10 },
  laub:       { tex: 'aquarellMittel', skala: 0.45, staerke: 0.17 },
  rinde:      { tex: 'aquarellMittel', skala: 0.7,  staerke: 0.16 },
  stoff:      { tex: 'aquarellFein',   skala: 0.6,  staerke: 0.12 },
  erde:       { tex: 'aquarellGrob',   skala: 0.22, staerke: 0.15 }
};

/* ==========================================================================
   I6 — Die Biom-Nachschlagetabelle

   Bis hierher waren Schneeauflage, Kuehle, Bruch und Kante GLOBAL: ein
   Uniformsatz je Karte, gesetzt aus dem `schnee`-Block des Kartenbioms. Eine
   Karte mit einer Schneeflaeche im Norden und einer Wueste im Sueden hatte
   deshalb ueberall dieselbe Schneeauflage — die Biomflaechen aus Runde I2
   faerbten das Gelaende um, liessen den Schnee auf Daechern, Felsen und
   Baeumen aber unveraendert liegen.

   Der Weg dorthin steht seit I2 in world/biomfeld.js (Abschnitt 12) und wird
   hier eingehaengt. Zwei Texturen, beide winzig:

   * die LUT — 2 x BIOM_ANZAHL Texel, RGBA-Float. Zeile = Biomindex, Texel 0
     traegt (auflage, kuehle, bruch, partikelStaerke), Texel 1
     (kanteA, kanteB, hoeheA, hoeheB). Sie wird EINMAL gebaut; die
     BIOME-Registry aendert sich zur Laufzeit nicht.
   * die Biomkarte — VW x VW Texel, RG-Byte: r = Biomindex, g = Gewicht. Sie
     ist die GPU-Sicht auf genau die beiden Felder, die world/terrain.js schon
     fuer die Terrainfarbe fuehrt (biomFeld/biomGewicht), und wird von dort
     nach jedem rebuildBiomFeld nachgereicht.

   Die Weltabbildung ist wortgleich die der Bruchmaske (generators/paths.js):
   uBiomAbb = vec2( 1/VW, (HALF+0.5)/VW ), damit Texelmitte auf Gittervertex
   faellt. NearestFilter ist Pflicht und nicht Geschmack — ein interpolierter
   Biomindex waere der Mittelwert zweier Zeilennummern und zeigte damit auf
   ein drittes, unbeteiligtes Biom.

   Was NICHT in der LUT steht, steht schon in biomfeld.js begruendet:
   Schneefarbe und Partikelfarbe. Sie sind Farben, keine Staerken; die
   Flaechen bekommen also die Menge und die Kante ihres Bioms, den Farbton
   weiter von der Karte. Fuer den Schnee ist das unauffaellig (alle
   Schneetoene liegen zwischen 0xeff4f8 und 0xf6fbff), fuer Partikel waere es
   sichtbar — deshalb liest world/vfx.js die Spalte `partikelStaerke` bis auf
   Weiteres nicht ueber diesen Weg, siehe Bericht.
   ========================================================================== */
var LEER_TEX = new THREE.DataTexture(new Uint8Array(2), 1, 1,
  THREE.RGFormat, THREE.UnsignedByteType);
LEER_TEX.needsUpdate = true;
terraUniforms.uBiomKarte.value = LEER_TEX;
terraUniforms.uBiomLut.value = LEER_TEX;

var biomLutTex = null;
/** Baut die LUT beim ersten Gebrauch. */
function holeBiomLut() {
  if (biomLutTex) return biomLutTex;
  var F = biomLutFormat({ spalten: 8 });
  var t = new THREE.DataTexture(biomLutDaten({ spalten: 8 }), F.breite, F.hoehe,
    THREE.RGBAFormat, THREE.FloatType);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.NoColorSpace;
  t.needsUpdate = true;
  biomLutTex = t;
  terraUniforms.uBiomZeilen.value = F.zeilen;
  return t;
}

var biomKarte = null;       // Uint8Array(VW*VW*2), verschraenkt: Index, Gewicht
var biomKarteTex = null;
var biomKarteVW = 0;

/**
 * I6 — Biomfeld und Biomgewicht an die GPU reichen. Wird von
 * world/terrain.js am Ende von rebuildBiomFeld gerufen; `feld` und `gewicht`
 * sind dieselben Uint8Array, die auch terrainColor liest.
 *
 * Liegt keine einzige Flaeche auf der Karte (alle Gewichte 0), wird uBiomAn
 * auf 0 gesetzt: der Shaderzweig faellt weg, und das Bild ist Fragment fuer
 * Fragment das bisherige. Genau dieselbe Zusage wie bei den Biomflaechen in
 * terrainColor — eine Karte ohne Biomflaechen sieht aus wie immer.
 */
function setzeBiomKarte(feld, gewicht, VW, MAP) {
  var n = VW * VW;
  if (!feld || !gewicht || !(n > 0) || feld.length < n || gewicht.length < n) {
    terraUniforms.uBiomAn.value = 0;
    return 0;
  }
  if (!biomKarte || biomKarteVW !== VW || biomKarte.length !== n * 2) {
    if (biomKarteTex) biomKarteTex.dispose();
    biomKarte = new Uint8Array(n * 2);
    biomKarteVW = VW;
    var t = new THREE.DataTexture(biomKarte, VW, VW, THREE.RGFormat, THREE.UnsignedByteType);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.colorSpace = THREE.NoColorSpace;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    biomKarteTex = t;
    terraUniforms.uBiomKarte.value = t;
  }
  var belegt = 0;
  for (var k = 0; k < n; k++) {
    var g = gewicht[k];
    biomKarte[k * 2] = feld[k];
    biomKarte[k * 2 + 1] = g;
    if (g > 0) belegt++;
  }
  biomKarteTex.needsUpdate = true;
  terraUniforms.uBiomAbb.value.set(1 / VW, ((MAP / 2) + 0.5) / VW);
  if (belegt > 0) holeBiomLut();
  terraUniforms.uBiomLut.value = biomLutTex || LEER_TEX;
  terraUniforms.uBiomAn.value = belegt > 0 ? 1 : 0;
  return belegt;
}

/** Diagnose: greift jeder Patch? Wird auf window exponiert.
 *  `vfx` gehoert zum Partikel-Shader in world/vfx.js und wird HIER nur
 *  vorgehalten, damit alle Shader-Patches des Projekts in EINEM Objekt
 *  stehen (das Abnahmemuster liest sonst zwei Stellen). Der Zaehler bleibt 0,
 *  solange vfx.js ihn nicht hochzaehlt — das ist der ehrlichere Zustand als
 *  ein fehlender Schluessel: 0 heisst „Patch nicht angekommen". */
const patchInfo = { wrap: 0, kuehl: 0, rim: 0, hoehe: 0, richtung: 0, wolke: 0, mal: 0, wind: 0, ranken: 0,
  normale: 0, arbor: 0, schnee: 0, drift: 0, vfx: 0, karte: 0, versuche: 0 };
if (typeof window !== 'undefined') window.terraPatchInfo = patchInfo;

/* --- B4: Zugang zur Bruchmaske ------------------------------------------
   Die Bruchmaske samt Uniform-Buendel lebt in generators/paths.js. Dieses
   Modul darf sie NICHT statisch importieren: paths.js importiert seinerseits
   materials.js und legt schon beim Modulstart Materialien an (terraMat, das
   FAMILIEN liest). Ein statischer Import der Bruchmasken-Uniforms aus
   generators/paths.js drehte den Auswertungszyklus um — paths.js liefe dann VOR dem
   Rumpf dieses Moduls und stiesse auf FAMILIEN in der temporalen Todeszone
   (nachgestellt in node: "ReferenceError: Cannot access 'FAMILIEN' before
   initialization", die ganze App startet nicht mehr).

   Stattdessen reicht generators/geometry.js — die Datei, die auch die
   driftenden Pools definiert — den MODULNAMENSRAUM von paths.js hier herein.
   Gelesen wird er ausschliesslich in onBeforeCompile, also lange nach jedem
   Modulstart; weil ein Namensraum lebende Bindungen traegt, ist die
   Auswertungsreihenfolge dabei egal (ein am Modulstart kopiertes
   bruchMaskeUniforms waere je nach Einstiegspunkt `undefined` gewesen). */
var bruchQuelle = null;
function setBruchQuelle(ns) { bruchQuelle = ns || null; }
function bruchUniforms() {
  return (bruchQuelle && bruchQuelle.bruchMaskeUniforms) || null;
}

/* --- Gemeinsame Vertexstufe fuer alle Weltversatz-Patches ----------------
   Wind (8) und Bruchdrift (9) verschieben BEIDE die Weltposition und muessen
   dafuer denselben Anker #include <project_vertex> ersetzen. Wuerde jeder das
   fuer sich tun, fraesse der zweite Patch den ersten (bzw. faende seinen
   Anker nicht mehr). Diese Stufe baut den Anker deshalb EINMAL um und laesst
   zwischen Weltposition und Projektion eine Marke stehen; jeder Versatz haengt
   seine Zeilen VOR die Marke. Erzeugte Reihenfolge: Weltposition → Wind →
   Drift → Projektion, beide Summanden kommen also an.

   USE_BATCHING wird hier bewusst nicht behandelt (wie schon im bisherigen
   Wind-Patch): das Projekt kennt nur InstancedMesh, keine BatchedMesh. */
var VERSATZ_MARKE = '// terraVersatz\n';
function versatzStufe(shader) {
  if (shader.vertexShader.indexOf(VERSATZ_MARKE) >= 0) return true;
  var pv = '#include <project_vertex>';
  if (shader.vertexShader.indexOf(pv) < 0) return false;
  shader.vertexShader = shader.vertexShader.replace(pv,
    'vec4 terraMV2 = vec4( transformed, 1.0 );\n' +
    '#ifdef USE_INSTANCING\n  terraMV2 = instanceMatrix * terraMV2;\n#endif\n' +
    'vec4 terraWelt2 = modelMatrix * terraMV2;\n' +
    VERSATZ_MARKE +
    'vec4 mvPosition = viewMatrix * terraWelt2;\n' +
    'gl_Position = projectionMatrix * mvPosition;');
  return true;
}

function ersetze(shader, feld, alt, neu, patchName) {
  if (shader[feld].indexOf(alt) < 0) {
    console.warn('terra: Shader-Patch "' + patchName + '" fand seinen Anker nicht — Shader bleibt unveraendert.');
    return false;
  }
  shader[feld] = shader[feld].replace(alt, neu);
  return true;
}

/* ==========================================================================
   I1 — Kartenpatch: die Verblassung der Signaturen

   Ein Kartenzeichen blendet ueber einen Maszstabsbereich ein und wieder aus.
   Der Faktor dafuer muss je INSTANZ ankommen — und unter den 12 Festwerten
   je Instanz (Matrix + Tint) ist keiner frei. Bis auf einen: `sy`. Ein
   Signaturquad liegt flach in der XZ-Ebene und hat in y keine Ausdehnung, die
   y-Skalierung ist also geometrisch wirkungslos.

   Genau die liest dieser Patch zurueck: `length(instanceMatrix[1].xyz)` ist
   der Betrag der zweiten Spalte der Instanzmatrix, und das IST sy.

   Kein Alphaslot, keine dreizehnte Zahl, keine Aenderung an der
   Instanzmechanik — der Preis ist diese Erklaerung.
   ========================================================================== */
function kartenPatch(shader) {
  patchInfo.versuche++;
  var vorher =
    "varying float vTerraSig;\n" +
    "void main() {";
  if (ersetze(shader, "vertexShader", "void main() {", vorher, "kartenSichtbarkeit")) {
    if (ersetze(shader, "vertexShader", "#include <begin_vertex>",
        "#include <begin_vertex>\n" +
        "  #ifdef USE_INSTANCING\n" +
        "    vTerraSig = length( instanceMatrix[1].xyz );\n" +
        "  #else\n" +
        "    vTerraSig = 1.0;\n" +
        "  #endif", "kartenSichtbarkeit")) {
      patchInfo.karte = (patchInfo.karte || 0) + 1;
    }
  }
  ersetze(shader, "fragmentShader", "void main() {",
    "varying float vTerraSig;\nvoid main() {", "kartenSichtbarkeit");
  // Ganz am Ende, nach allen eingebauten Fragmenten: der Faktor multipliziert
  // die fertige Deckung, statt irgendwo dazwischen zu wirken.
  ersetze(shader, "fragmentShader", "#include <dithering_fragment>",
    "#include <dithering_fragment>\n  gl_FragColor.a *= clamp( vTerraSig, 0.0, 1.0 );",
    "kartenSichtbarkeit");
}

function terraPatch(shader, opts) {
  patchInfo.versuche++;
  shader.uniforms.uRim = terraUniforms.uRim;
  shader.uniforms.uBounce = terraUniforms.uBounce;
  shader.uniforms.uFogWarm = terraUniforms.uFogWarm;
  shader.uniforms.uFogCool = terraUniforms.uFogCool;
  shader.uniforms.uSunDir = terraUniforms.uSunDir;
  shader.uniforms.uFogCap = terraUniforms.uFogCap;
  shader.uniforms.uSchattenKuehl = terraUniforms.uSchattenKuehl;
  // uCloudTex haengt jetzt UNBEDINGT am Shader: der Wolkenschatten (5) nutzt
  // sie fuer die Bodenschatten, die Schneeauflage (6b) als Bruch-Rauschen.
  // Deshalb steht die Deklaration im gemeinsamen Kopf und NICHT mehr im
  // cloudShadow-Zweig — sonst waere sie dort doppelt deklariert.
  shader.uniforms.uCloudTex = terraUniforms.uCloudTex;
  // H2a: Ausschluss ueber die BINDUNG, nicht ueber opts — der Fragmentblock
  // wird immer eingefuegt, damit customProgramCacheKey unveraendert bleibt
  // und die Programmzahl nicht steigt. Materialien mit ohneSchnee bekommen
  // eine eigene, tote {value:0}-Bindung (Terrain: sein Schnee kommt aus
  // terrainColor und wuerde sonst doppelt aufgetragen).
  shader.uniforms.uSchneeAuflage = (opts && opts.ohneSchnee)
    ? { value: 0 } : terraUniforms.uSchneeAuflage;
  shader.uniforms.uSchneeKante = terraUniforms.uSchneeKante;
  shader.uniforms.uSchneeHoehe = terraUniforms.uSchneeHoehe;
  shader.uniforms.uSchneeFarbe = terraUniforms.uSchneeFarbe;
  shader.uniforms.uSchneeKuehle = terraUniforms.uSchneeKuehle;
  shader.uniforms.uSchneeBruch = terraUniforms.uSchneeBruch;
  /* I6 — die Biom-LUT haengt an DERSELBEN Bindungsregel wie die Schneemenge:
     Materialien mit ohneSchnee (das Terrain) bekommen eine tote {value:0}-
     Bindung. Das Terrain faerbt seine Biomflaechen schon in terrainColor auf
     der CPU (mischPalette) — liesse man den Zweig hier zusaetzlich zu, laege
     die Schneeauflage der Flaeche ein zweites Mal darueber. */
  shader.uniforms.uBiomAn = (opts && opts.ohneSchnee)
    ? { value: 0 } : terraUniforms.uBiomAn;
  shader.uniforms.uBiomKarte = terraUniforms.uBiomKarte;
  shader.uniforms.uBiomLut = terraUniforms.uBiomLut;
  shader.uniforms.uBiomAbb = terraUniforms.uBiomAbb;
  shader.uniforms.uBiomZeilen = terraUniforms.uBiomZeilen;
  shader.uniforms.uArborPos = terraUniforms.uArborPos;
  shader.uniforms.uArborAnzahl = terraUniforms.uArborAnzahl;
  shader.uniforms.uArborFarbe = terraUniforms.uArborFarbe;
  shader.uniforms.uArborStaerke = terraUniforms.uArborStaerke;

  var kopfF = 'uniform vec3 uRim;\nuniform vec3 uBounce;\nuniform vec3 uSchattenKuehl;\n' +
    'uniform sampler2D uCloudTex;\n' +
    'uniform float uSchneeAuflage;\nuniform vec2 uSchneeKante;\nuniform vec2 uSchneeHoehe;\n' +
    'uniform vec3 uSchneeFarbe;\nuniform float uSchneeKuehle;\nuniform float uSchneeBruch;\n' +
    'uniform float uBiomAn;\nuniform sampler2D uBiomKarte;\nuniform sampler2D uBiomLut;\n' +
    'uniform vec2 uBiomAbb;\nuniform float uBiomZeilen;\n' +
    'uniform vec4 uArborPos[' + ARBOR_MAX + '];\nuniform int uArborAnzahl;\n' +
    'uniform vec3 uArborFarbe;\nuniform float uArborStaerke;\n';

  // (1) Wrap-Diffuse mit drei weich verschliffenen Stufen und warmem Bounce.
  //     Anker aus lights_phong_pars_fragment (three 0.185):
  //     RE_Direct_BlinnPhong { float dotNL = saturate( dot( geometryNormal, ... ) );
  //                            vec3 irradiance = dotNL * directLight.color; ... }
  var src = THREE.ShaderChunk.lights_phong_pars_fragment;
  var aAlt = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
  var bAlt = 'vec3 irradiance = dotNL * directLight.color;';
  if (src && src.indexOf(aAlt) >= 0 && src.indexOf(bAlt) >= 0 &&
      shader.fragmentShader.indexOf('#include <lights_phong_pars_fragment>') >= 0) {
    var neu = src
      .replace(aAlt, 'float dotNL = dot( geometryNormal, directLight.direction );')
      .replace(bAlt,
        'float terraW = dotNL * 0.5 + 0.5;\n' +
        'float terraB = smoothstep(0.26,0.32,terraW)*0.34\n' +
        '             + smoothstep(0.50,0.56,terraW)*0.33\n' +
        '             + smoothstep(0.74,0.80,terraW)*0.33;\n' +
        'terraB = 0.30 + 0.70 * terraB;\n' +
        // F1, kuehle Schatten: das Tint-Gewicht haengt am untersten Band
        // (terraW < 0.26 voll kuehl, ab dem Mittelband 0.56 keine Wirkung) —
        // Mitten kuehlen kaum, tiefe Schatten deutlich. Der 0.30-Sockel bleibt:
        // bei terraB = 0.30 hat der Tint mix(uSchattenKuehl, 1.0, 0.30) eine
        // Luminanz von ~0.39–0.54 (je Preset), der Sonnenbeitrag faellt also
        // nie unter ~0.12–0.16 seiner vollen Staerke; zusammen mit dem
        // Hemisphaerenlicht bleibt die Gesamthelligkeit ueber ~15 %.
        'float terraKuehl = 1.0 - smoothstep( 0.26, 0.56, terraW );\n' +
        'vec3 terraTint = mix( mix( uBounce, uSchattenKuehl, terraKuehl ), vec3(1.0), terraB );\n' +
        'vec3 irradiance = terraB * directLight.color * terraTint;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_phong_pars_fragment>', neu);
    patchInfo.wrap++;
    patchInfo.kuehl++;   // kuehler Schattenanteil sitzt im selben Patch
  } else {
    console.warn('terra: Shader-Patch "wrap" fand seinen Anker nicht — Shader bleibt unveraendert.');
  }

  // (2) Rimlight ueber Fresnel — nur an Silhouetten, flacher Boden gedaempft.
  var ende = '#include <lights_fragment_end>';
  if (ersetze(shader, 'fragmentShader', ende, ende + '\n' +
      'float terraRim = pow( 1.0 - max( dot( normal, normalize( vViewPosition ) ), 0.0 ), 3.0 );\n' +
      'terraRim *= 1.0 - abs( normal.y ) * 0.85;\n' +
      'reflectedLight.indirectDiffuse += terraRim * 0.3 * uRim;', 'rim')) {
    patchInfo.rim++;
  }

  // (3) Weltposition als Varying (Basis fuer Hoehennebel, Richtungsnebel,
  //     Wolkenschatten). Anker: #include <fog_vertex> am Ende von main().
  var fv = '#include <fog_vertex>';
  var hatWelt = false;
  if (shader.vertexShader.indexOf(fv) >= 0) {
    shader.vertexShader = 'varying vec3 vTerraW;\n' + shader.vertexShader.replace(fv,
      fv + '\nvec4 terraWP = vec4( transformed, 1.0 );\n' +
      '#ifdef USE_INSTANCING\n  terraWP = instanceMatrix * terraWP;\n#endif\n' +
      'vTerraW = ( modelMatrix * terraWP ).xyz;');
    kopfF += 'varying vec3 vTerraW;\nuniform vec3 uFogWarm;\nuniform vec3 uFogCool;\n' +
             'uniform vec3 uSunDir;\nuniform float uFogCap;\n';
    hatWelt = true;
  } else {
    console.warn('terra: Shader-Patch "weltposition" fand seinen Anker nicht.');
  }

  // (3b) Weltnormale als Varying — Zwilling zu (3), Basis fuer Schneeauflage
  //      und Arbor-Bodenlicht. Anker: #include <defaultnormal_vertex>. Dort
  //      ist objectNormal fertig (Morph/Skin eingerechnet) und noch in
  //      Objektkoordinaten; der Chunk selbst dreht nur seine eigene
  //      transformedNormal in den Blickraum. Instancing wird wie in (3) ueber
  //      #ifdef USE_INSTANCING abgefangen.
  //      Bekannte Ungenauigkeit: emit() skaliert Instanzen anisotrop, ohne
  //      Inverse-Transponierte kippt die Normale um wenige Grad — fuer eine
  //      Schneemaske und ein weiches Bodenlicht irrelevant.
  var dn = '#include <defaultnormal_vertex>';
  var hatNorm = false;
  if (shader.vertexShader.indexOf(dn) >= 0) {
    shader.vertexShader = 'varying vec3 vTerraN;\n' + shader.vertexShader.replace(dn,
      dn + '\nvec3 terraON = objectNormal;\n' +
      '#ifdef USE_INSTANCING\n  terraON = mat3( instanceMatrix ) * terraON;\n#endif\n' +
      'vTerraN = normalize( mat3( modelMatrix ) * terraON );');
    kopfF += 'varying vec3 vTerraN;\n';
    hatNorm = true;
    patchInfo.normale++;
  } else {
    console.warn('terra: Shader-Patch "weltnormale" fand seinen Anker nicht.');
  }

  // (3c) H3 — Arbor als Lichtquelle. Die weissen Ranken sind laut Kanon die
  //      Lichtquelle der Welt; hier addieren sie einen kuehl-weissen Beitrag,
  //      der mit dem WAAGERECHTEN Abstand zum naechsten Rankenfuss abfaellt,
  //      mit der Hoehe nachlaesst (Bodenlicht) und nach oben zeigende Flaechen
  //      staerker trifft. Unbedingt eingefuegt — die Abschaltung laeuft ueber
  //      uArborStaerke = 0 (uniform-kohaerenter Zweig), nicht ueber opts, damit
  //      customProgramCacheKey und die Programmzahl unveraendert bleiben.
  //      Anker: #include <lights_fragment_end> (wie das Rimlight, das seinen
  //      Code hinter demselben Include haengt — die Reihenfolge der beiden
  //      additiven Beitraege ist egal).
  //      Deckel 0.5: der Beitrag darf den Werteumfang (0.20–0.85) nicht
  //      sprengen; reines Weiss bleibt den Wolkenlichtern vorbehalten.
  var arborOk = false;
  if (hatWelt && hatNorm) {
    var le = '#include <lights_fragment_end>';
    if (ersetze(shader, 'fragmentShader', le, le + '\n' +
        'float terraArborN = 0.0;\n' +
        'if ( uArborStaerke > 0.0 ) {\n' +
        '  for ( int terraI = 0; terraI < ' + ARBOR_MAX + '; terraI ++ ) {\n' +
        '    if ( terraI >= uArborAnzahl ) break;\n' +
        '    vec4 terraQ = uArborPos[ terraI ];\n' +
        '    float terraD = length( vTerraW.xz - terraQ.xy );\n' +
        '    float terraFal = 1.0 - smoothstep( 0.0, max( terraQ.z, 1.0 ) * 8.0, terraD );\n' +
        '    terraArborN += terraQ.w * terraFal * terraFal;\n' +
        '  }\n' +
        '  terraArborN = min( terraArborN, 1.0 );\n' +
        // gl_FrontFacing: dieselbe Korrektur wie beim Schnee — vTerraN wird
        // im Gegensatz zu three's normal nicht automatisch geflippt.
        '  vec3 terraAN = normalize( vTerraN );\n' +
        '  float terraANy = gl_FrontFacing ? terraAN.y : -terraAN.y;\n' +
        '  float terraArborG = terraArborN\n' +
        '    * ( 0.30 + 0.70 * max( terraANy, 0.0 ) )\n' +
        '    * ( 1.0 - 0.75 * smoothstep( 4.0, 120.0, vTerraW.y ) );\n' +
        '  reflectedLight.indirectDiffuse += uArborFarbe\n' +
        '    * min( terraArborG * uArborStaerke * 0.55, 0.5 );\n' +
        '}', 'arbor')) {
      arborOk = true;
      patchInfo.arbor++;
    }
  }

  // (4) Nebel: Richtungsmischung (warm zur Sonne, kuehl davon weg), Hoehendichte
  //     in Senken, und eine Obergrenze fuer die Lesbarkeit im Nebel-Preset.
  //     Anker aus fog_fragment (0.185): gl_FragColor.rgb = mix( ..., fogColor, fogFactor );
  var fogKey = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
  var fogChunk = THREE.ShaderChunk.fog_fragment;
  var fogInc = '#include <fog_fragment>';
  if (hatWelt && fogChunk && fogChunk.indexOf(fogKey) >= 0 &&
      shader.fragmentShader.indexOf(fogInc) >= 0) {
    // H3, Punkt 4 („Lichtsaeule im Dunst"): in Rankennaehe zieht der Nebel
    // ein Stueck Richtung Rankenfarbe. Nutzt terraArborN aus (3c) — dieselbe
    // main()-Ebene, deshalb ohne neues Varying, ohne neues Uniform und ohne
    // neue Permutation. Nur wenn (3c) tatsaechlich gegriffen hat, sonst
    // waere die Variable nicht deklariert.
    var arborDunst = arborOk
      ? '\tterraFogCol = mix( terraFogCol, uArborFarbe,\n' +
        '\t\tmin( terraArborN * uArborStaerke, 1.0 ) * 0.45 );\n'
      : '';
    var fogNeu = fogChunk.replace(fogKey,
      'float terraTal = 1.0 - smoothstep( 0.5, 10.0, vTerraW.y );\n' +
      '\tfloat terraHoch = smoothstep( 42.0, 185.0, vTerraW.y );\n' +
      '\tfloat terraDicht = 1.0 + terraTal * 0.35 + terraHoch * 0.12;\n' +
      '\tfogFactor = 1.0 - pow( max( 1.0 - fogFactor, 0.0 ), terraDicht );\n' +
      '\tfogFactor = min( fogFactor, uFogCap );\n' +
      '\tfloat terraSonne = pow( max( dot( normalize( vTerraW - cameraPosition ), uSunDir ), 0.0 ), 2.0 );\n' +
      '\tvec3 terraFogCol = mix( uFogCool, uFogWarm, terraSonne );\n' +
      '\tfloat terraFern = smoothstep( 0.18, 0.78, fogFactor );\n' +
      '\tterraFogCol = mix( terraFogCol, uFogCool, terraFern * terraHoch * 0.18 );\n' +
      '\tfloat terraFogLum = dot( terraFogCol, vec3( 0.299, 0.587, 0.114 ) );\n' +
      '\tterraFogCol = mix( terraFogCol, vec3( terraFogLum ), terraFern * 0.055 );\n' +
      arborDunst +
      '\tgl_FragColor.rgb = mix( gl_FragColor.rgb, terraFogCol, fogFactor );');
    shader.fragmentShader = shader.fragmentShader.replace(fogInc, fogNeu);
    patchInfo.hoehe++;
    patchInfo.richtung++;
  } else if (hatWelt) {
    console.warn('terra: Shader-Patch "nebel" fand seinen Anker nicht — Standardnebel bleibt aktiv.');
  }

  // (5) Wolkenschatten: nur fuer Materialien mit cloudShadow-Flag (Terrain).
  //     Anker: #include <color_fragment> (Vertexfarben-Anwendung).
  if (opts && opts.cloudShadow && hatWelt) {
    shader.uniforms.uCloudDrift = terraUniforms.uCloudDrift;
    shader.uniforms.uCloudAmt = terraUniforms.uCloudAmt;
    // uCloudTex steht seit H2a im gemeinsamen Kopf (die Schneeauflage liest
    // sie ebenfalls) — hier nur noch Drift und Staerke.
    kopfF += 'uniform vec2 uCloudDrift;\nuniform float uCloudAmt;\n';
    var ck = '#include <color_fragment>';
    if (ersetze(shader, 'fragmentShader', ck, ck + '\n' +
        'float terraWolke = texture2D( uCloudTex, vTerraW.xz * 0.006 + uCloudDrift ).r;\n' +
        'diffuseColor.rgb *= 1.0 - uCloudAmt * smoothstep( 0.52, 0.78, terraWolke );', 'wolkenschatten')) {
      patchInfo.wolke++;
    }
  }

  // (6) Malschicht: Aquarelltextur in WELTkoordinaten — die Koernung bleibt
  //     damit bei grossen wie kleinen Objekten gleich gross. Subtil gehalten:
  //     Helligkeit +-Anteil und ein Hauch Farbtonversatz aus der Textur.
  //     Zweite, sehr grobe Abtastung DERSELBEN Textur (1/8 der Familienskala,
  //     halbe Staerke): grossraeumige Nass-in-nass-Drift (F2), damit auch
  //     Waende und Daecher die niederfrequente Modulation der Wiese tragen —
  //     keine neue Textur, kein neues Uniform noetig.
  if (hatWelt && opts && opts.mal) {
    shader.uniforms['uMalTex' + 0] = { value: opts.mal.texObj };
    kopfF += 'uniform sampler2D uMalTex0;\n';
    var mk = '#include <color_fragment>';
    var malCode = mk + '\n' +
      'vec3 terraMal = texture2D( uMalTex0, ( vTerraW.xz + vTerraW.yy * 0.7 ) * ' +
        opts.mal.skala.toFixed(4) + ' ).rgb;\n' +
      'diffuseColor.rgb *= mix( vec3(1.0), terraMal * 2.0, ' + opts.mal.staerke.toFixed(3) + ' );\n' +
      'vec3 terraMalGrob = texture2D( uMalTex0, ( vTerraW.xz + vTerraW.yy * 0.7 ) * ' +
        (opts.mal.skala * 0.125).toFixed(5) + ' ).rgb;\n' +
      'diffuseColor.rgb *= mix( vec3(1.0), terraMalGrob * 2.0, ' +
        (opts.mal.staerke * 0.5).toFixed(3) + ' );';
    if (ersetze(shader, 'fragmentShader', mk, malCode, 'malschicht')) patchInfo.mal++;
  }

  // (6b) H2a — Schneeauflage. Hellt nach oben zeigende Flaechen auf und kuehlt
  //      sie leicht; Daecher, Mauern, Felsen und Karren werden mitbeschneit,
  //      damit die Winterkarte als GANZES winterlich wird.
  //
  //      REIHENFOLGE — bewusst NACH (6) eingehaengt, obwohl der Schnee VOR der
  //      Malschicht WIRKEN soll: alle drei Bloecke schreiben sich direkt hinter
  //      denselben Anker #include <color_fragment>, der zuletzt eingefuegte
  //      landet also im Quelltext ganz vorn. Ergebnis im Shader:
  //        color_fragment → SCHNEE → MALSCHICHT → WOLKENSCHATTEN
  //      Genau so ist es gewollt: die Aquarellkoernung laeuft ueber den Schnee
  //      (Materialeinheit bleibt), der Wolkenschatten verdunkelt ihn zuletzt.
  //      (Der Biomkatalog nennt die Stelle "Patch 5b" — das waere durch die
  //      Umkehrung genau die falsche Wirkungsreihenfolge gewesen.)
  //
  //      Determinismus: nur vTerraN, vTerraW und eine statische Textur — kein
  //      Zeit-Uniform, kein Frame-Zustand, kein Math.random.
  if (hatWelt && hatNorm) {
    var sk = '#include <color_fragment>';
    if (ersetze(shader, 'fragmentShader', sk, sk + '\n' +
        /* I6 — die fuenf Schneewerte kommen ab hier aus einer lokalen Kopie
           statt direkt aus dem Uniform. Ohne Biomflaeche traegt die Kopie den
           Uniformwert unveraendert weiter (mix mit Gewicht 0 gibt es gar
           nicht — der Zweig wird uebersprungen), das Bild ist also dasselbe.
           Mit Flaeche wird JEDER der fuenf Werte mit dem Flaechengewicht
           gegen die LUT-Zeile des Flaechenbioms geblendet: dieselbe weiche
           Kante, die auch die Terrainfarbe benutzt (biomGewicht ist bereits
           ausgefranst und ausgelaufen, siehe world/biomfeld.js). */
        'float terraSAufl = uSchneeAuflage;\n' +
        'vec2 terraSKante = uSchneeKante;\n' +
        'vec2 terraSHoehe = uSchneeHoehe;\n' +
        'float terraSKuehl = uSchneeKuehle;\n' +
        'float terraSBruch = uSchneeBruch;\n' +
        'if ( uBiomAn > 0.0 ) {\n' +
        '  vec2 terraBUV = vTerraW.xz * uBiomAbb.x + uBiomAbb.y;\n' +
        // Ausserhalb der Karte klemmte ClampToEdge auf die Randtexel und
        // zoege das Randbiom ins Unendliche — dieselbe Vorsichtsmassnahme
        // wie bei der Bruchmaske in (9).
        '  vec2 terraBIn = step( vec2( 0.0 ), terraBUV ) * step( terraBUV, vec2( 1.0 ) );\n' +
        '  vec4 terraBK = texture2D( uBiomKarte, terraBUV );\n' +
        '  float terraBW = terraBK.g * terraBIn.x * terraBIn.y;\n' +
        '  if ( terraBW > 0.0 ) {\n' +
        // r ist der Biomindex als Byte; *255 macht daraus wieder die
        // Zeilennummer, +0.5 trifft die Texelmitte (NearestFilter).
        '    float terraBZ = ( terraBK.r * 255.0 + 0.5 ) / uBiomZeilen;\n' +
        '    vec4 terraL0 = texture2D( uBiomLut, vec2( 0.25, terraBZ ) );\n' +
        '    vec4 terraL1 = texture2D( uBiomLut, vec2( 0.75, terraBZ ) );\n' +
        '    terraSAufl = mix( terraSAufl, terraL0.r, terraBW );\n' +
        '    terraSKuehl = mix( terraSKuehl, terraL0.g, terraBW );\n' +
        '    terraSBruch = mix( terraSBruch, terraL0.b, terraBW );\n' +
        '    terraSKante = mix( terraSKante, terraL1.rg, terraBW );\n' +
        '    terraSHoehe = mix( terraSHoehe, terraL1.ba, terraBW );\n' +
        '  }\n' +
        '}\n' +
        'if ( terraSAufl > 0.0 ) {\n' +
        // gl_FrontFacing: Kronen, busch, gras, farn, moos und rankenblatt
        // laufen mit side: DoubleSide. Three flippt seine eigene normal, unser
        // Varying nicht — ohne die Korrektur bliebe jede zweite sichtbare
        // Blattflaeche schneefrei und das Laub wirkte zerfressen.
        '  vec3 terraSN = normalize( vTerraN );\n' +
        '  float terraNy = gl_FrontFacing ? terraSN.y : -terraSN.y;\n' +
        '  float terraOben = smoothstep( terraSKante.x, terraSKante.y, terraNy );\n' +
        // Bruch-Rauschen aus der vorhandenen Wolkentextur: die Decke reisst
        // auf, statt gleichmaessig zu ueberziehen. Keine neue Textur noetig.
        '  float terraBruch = texture2D( uCloudTex, vTerraW.xz * 0.11 ).r;\n' +
        '  terraOben *= mix( 1.0, smoothstep( 0.30, 0.72, terraBruch ), terraSBruch );\n' +
        '  terraOben *= smoothstep( terraSHoehe.x, terraSHoehe.y, vTerraW.y );\n' +
        '  float terraS = terraSAufl * terraOben;\n' +
        '  diffuseColor.rgb = mix( diffuseColor.rgb, uSchneeFarbe, terraS );\n' +
        // Leichte Kuehlung: Schnee im Schatten kippt ins Blaue, ohne die
        // Saettigung anzuheben (die Kalt-Warm-Logik bleibt der Kern).
        '  diffuseColor.rgb = mix( diffuseColor.rgb,\n' +
        '    diffuseColor.rgb * vec3( 0.94, 0.98, 1.06 ), terraS * terraSKuehl );\n' +
        '}', 'schneeauflage')) {
      patchInfo.schnee++;
    }
  }

  // (7) Ranken-Ausblenden: oben Richtung Dunst aufloesen — als geordnetes
  //     4x4-Bayer-Dither mit discard statt echtem Alpha. Das Material bleibt
  //     dadurch opak (keine Transparent-Queue, keine Selbstsortierung des
  //     grossen Ranken-Meshes); das Muster haengt nur an gl_FragCoord und ist
  //     damit deterministisch und zeitstabil.
  //     Konstanten: Fade setzt bei Welthoehe 140 ein und ist bei 360 voll
  //     (wie der bisherige Alpha-Fade). Restdeckung oben 0.25 statt frueher
  //     0.6 Alpha: gedithert braucht das Auslaufen eine niedrigere Enddeckung,
  //     um sichtbar zu wirken, und endet trotzdem nicht hart.
  if (opts && opts.rankenFade) {
    var oa = '#include <opaque_fragment>';
    if (ersetze(shader, 'fragmentShader', oa,
        'float terraFade = mix( 1.0, 0.25, smoothstep( 140.0, 360.0, vTerraW.y ) );\n' +
        'int terraDx = int( mod( gl_FragCoord.x, 4.0 ) );\n' +
        'int terraDy = int( mod( gl_FragCoord.y, 4.0 ) );\n' +
        'float terraBayer[16] = float[16](\n' +
        '   0.0,  8.0,  2.0, 10.0,\n' +
        '  12.0,  4.0, 14.0,  6.0,\n' +
        '   3.0, 11.0,  1.0,  9.0,\n' +
        '  15.0,  7.0, 13.0,  5.0 );\n' +
        // Schwellen (k+0.5)/16 liegen strikt in (0,1): Fade 1.0 discardet nie,
        // Fade 0.25 loescht drei Viertel der Fragmente.
        'if ( terraFade < ( terraBayer[ terraDy * 4 + terraDx ] + 0.5 ) / 16.0 ) discard;\n' + oa,
        'rankenfade')) { patchInfo.ranken++; }
  }

  shader.fragmentShader = kopfF + shader.fragmentShader;

  // Kopf des VERTEX-Shaders: wird von (8) und (9) gefuellt und ganz am Ende
  // EINMAL vorangestellt — so kann uWindZeit von beiden gebraucht und trotzdem
  // nur einmal deklariert werden.
  var kopfV = '';

  // (8) Wind: verschiebt die Weltposition mit der gemeinsamen Boee;
  //     Auslenkung mit uv.y gewichtet (Fuss bleibt stehen).
  if (opts && opts.wind) {
    shader.uniforms.uWindZeit = windUniforms.uWindZeit;
    shader.uniforms.uWindStaerke = windUniforms.uWindStaerke;
    if (shader.vertexShader.indexOf('#include <uv_vertex>') >= 0 && versatzStufe(shader)) {
      kopfV += 'uniform float uWindZeit;\nuniform float uWindStaerke;\n' + WIND_GLSL + '\n';
      if (ersetze(shader, 'vertexShader', VERSATZ_MARKE,
          'vec2 terraWehen = terraWind( terraWelt2.xyz, uWindZeit ) * uWindStaerke * ' +
            (opts.wind.amp || 0.35).toFixed(3) + ' * uv.y;\n' +
          'terraWelt2.xz += terraWehen;\n' + VERSATZ_MARKE, 'wind')) {
        patchInfo.wind++;
      }
    } else {
      console.warn('terra: Shader-Patch "wind" fand seinen Anker nicht.');
    }
  }

  // (9) B4 — Bruchdrift: Terra ist zerrissen; nahe einer Bruchkante hat die
  //     Schwerkraft keinen festen Griff mehr. Kleine, leichte Objekte taumeln
  //     dort langsam — waagerecht driftend, senkrecht leicht steigend und
  //     sinkend, dazu eine kleine Eigendrehung um den eigenen Fusspunkt.
  //
  //     Ankerpunkt der Instanz: modelMatrix * instanceMatrix * (0,0,0,1). Der
  //     ist je Instanz KONSTANT — deshalb wird die Maske genau einmal pro
  //     Instanz abgetastet, das Netz selbst nicht verzerrt, und der innere
  //     Zweig ( terraDriftM > 0 ) ist ueber alle Vertizes einer Instanz
  //     kohaerent (weit von der Kante entfernte Instanzen kosten nur einen
  //     Texturzugriff).
  //
  //     Abschaltung: uBruchStaerke ist ohne Bruchkanten-Element 0 (paths.js,
  //     bruchMaskeFertig) — der komplette Zweig faellt dann uniform-kohaerent
  //     weg und das Bild ist identisch zu einer Fassung ohne diesen Patch.
  //     Ausserhalb der Karte klemmt ClampToEdge auf die Randtexel; wie in
  //     world/water.js wird der Wert dort deshalb hart auf 0 gesetzt.
  //
  //     Bekannte Ungenauigkeit (wie beim Wind): vTerraW/vTerraN entstehen aus
  //     dem UNverschobenen `transformed`. Licht, Nebel und Schnee rechnen also
  //     mit der Ruhelage — bei Amplituden unter einer Welteinheit unsichtbar.
  if (opts && opts.drift) {
    var bu = bruchUniforms();
    if (!bu) {
      console.warn('terra: Shader-Patch "bruchdrift" findet die Bruchmaske nicht — ' +
        'Truemmer an Bruchkanten stehen still.');
    } else if (!versatzStufe(shader)) {
      console.warn('terra: Shader-Patch "bruchdrift" fand seinen Anker nicht — ' +
        'Truemmer an Bruchkanten stehen still.');
    } else {
      shader.uniforms.uBruchMaske = bu.uBruchMaske;
      shader.uniforms.uBruchAbb = bu.uBruchAbb;
      shader.uniforms.uBruchStaerke = bu.uBruchStaerke;
      shader.uniforms.uWindZeit = windUniforms.uWindZeit;
      // Zeitquelle ist bewusst die WINDzeit: eine zweite Uhr brauchte ein
      // zweites Uniform und einen zweiten Tick, ohne dass man den Unterschied
      // saehe. uWindStaerke bleibt draussen — die Kante taumelt auch bei
      // Windstille, das ist ihr Wesen und nicht das Wetter.
      if (kopfV.indexOf('uniform float uWindZeit;') < 0) kopfV += 'uniform float uWindZeit;\n';
      kopfV += 'uniform sampler2D uBruchMaske;\nuniform vec2 uBruchAbb;\n' +
        'uniform float uBruchStaerke;\n';
      var dAmp = opts.drift.amp;
      if (ersetze(shader, 'vertexShader', VERSATZ_MARKE,
          'if ( uBruchStaerke > 0.0 ) {\n' +
          'vec4 terraDriftO = vec4( 0.0, 0.0, 0.0, 1.0 );\n' +
          '#ifdef USE_INSTANCING\n  terraDriftO = instanceMatrix * terraDriftO;\n#endif\n' +
          '  vec3 terraDriftA = ( modelMatrix * terraDriftO ).xyz;\n' +
          '  vec2 terraDriftUV = terraDriftA.xz * uBruchAbb.x + uBruchAbb.y;\n' +
          '  vec2 terraDriftIn = step( vec2( 0.0 ), terraDriftUV ) * step( terraDriftUV, vec2( 1.0 ) );\n' +
          '  float terraDriftM = texture2D( uBruchMaske, terraDriftUV ).r\n' +
          '    * terraDriftIn.x * terraDriftIn.y * uBruchStaerke;\n' +
          '  if ( terraDriftM > 0.0 ) {\n' +
          // Ortsphase: benachbarte Truemmer taumeln aehnlich, aber nicht
          // gleich — ohne sie schwaenge das ganze Feld als ein Block.
          '    float terraDriftP = terraDriftA.x * 0.21 + terraDriftA.z * 0.17;\n' +
          '    float terraDriftT = uWindZeit * 0.55;\n' +
          // Quadratische Gewichtung: der Uebergang vom festen Land in den
          // Abgrund beginnt unmerklich und nimmt erst ueber der Kante zu.
          '    float terraDriftG = terraDriftM * terraDriftM * ' + dAmp.toFixed(3) + ';\n' +
          '    vec2 terraDriftH = vec2(\n' +
          '      sin( terraDriftT + terraDriftP ) + 0.45 * sin( terraDriftT * 0.63 - terraDriftP * 1.7 ),\n' +
          '      cos( terraDriftT * 0.87 + terraDriftP * 1.3 ) + 0.45 * sin( terraDriftT * 0.41 + terraDriftP ) );\n' +
          '    float terraDriftV = sin( terraDriftT * 0.71 + terraDriftP * 0.6 ) * 1.3;\n' +
          // Eigendrehung um die Hochachse durch den eigenen Fusspunkt. Der
          // Winkel waechst mit der Amplitude (schwere Brocken drehen weniger)
          // und mit dem Maskenwert; bei Maske 0 ist er exakt 0 und die Matrix
          // die Einheitsmatrix.
          '    float terraDriftR = sin( terraDriftT * 0.37 + terraDriftP * 0.8 ) * ' +
            (dAmp * 0.55).toFixed(4) + ' * terraDriftM;\n' +
          '    float terraDriftC = cos( terraDriftR ), terraDriftS = sin( terraDriftR );\n' +
          '    vec2 terraDriftL = terraWelt2.xz - terraDriftA.xz;\n' +
          '    terraWelt2.xz = terraDriftA.xz +\n' +
          '      mat2( terraDriftC, terraDriftS, -terraDriftS, terraDriftC ) * terraDriftL;\n' +
          '    terraWelt2.xz += terraDriftH * terraDriftG;\n' +
          '    terraWelt2.y += terraDriftV * terraDriftG;\n' +
          '  }\n' +
          '}\n' + VERSATZ_MARKE, 'bruchdrift')) {
        patchInfo.drift++;
      }
    }
  }

  if (kopfV) shader.vertexShader = kopfV + shader.vertexShader;
}

/** Weltmaterial: Phong (pro Fragment) mit Wrap-Licht statt hartem Lambert. */
function terraMat(opts) {
  opts = opts || {};
  var cloudShadow = !!opts.cloudShadow;
  var familie = opts.familie || null;
  var wind = opts.wind || null;
  // B4 — `drift: <amplitude>` (Zahl in Welteinheiten, wie in geometry.js
  // gesetzt). Ein Objekt { amp } wird zusaetzlich angenommen, damit die Option
  // sich genau wie `wind` schreiben laesst; 0/fehlend heisst: kein Patch,
  // kein zusaetzliches Programm.
  var driftAmp = (typeof opts.drift === 'number') ? opts.drift
    : (opts.drift && typeof opts.drift.amp === 'number') ? opts.drift.amp : 0;
  if (!(driftAmp > 0)) driftAmp = 0;
  var rankenFade = !!opts.rankenFade;
  // H2a: Das Terrainmaterial ist das einzige, das vom Shaderschnee ausgenommen
  // wird — sein Schnee kommt aus terrainColor (schneeA/B + Felsdurchbruch am
  // Steilhang) und laege sonst doppelt auf. Erkannt wird es an cloudShadow:
  // terrain.js:61 ist der EINZIGE Aufruf mit cloudShadow:true im ganzen
  // Projekt (geprueft: water.js, pools.js, paths.js setzen es nicht). Das
  // explizite Flag opts.ohneSchnee wird zusaetzlich akzeptiert, damit
  // terrain.js es spaeter ohne Aenderung hier sprechend setzen kann.
  var ohneSchnee = !!opts.ohneSchnee || cloudShadow;
  delete opts.cloudShadow; delete opts.familie; delete opts.wind; delete opts.rankenFade;
  delete opts.ohneSchnee; delete opts.drift;
  /* I1 — `flach`: unbeleuchtetes Kartenmaterial fuer die Signaturen. Ein
     Ortsring mit Lichtrichtung, Wolkenschatten und Malschicht saehe aus wie
     ein liegender Reifen; eine Signatur ist Tinte auf Papier.

     Der Zweig steigt VOR dem Phong-Material aus und bekommt deshalb auch
     keinen terraPatch — kein Wind, kein Schnee, keine Kuehlung, keine
     Hoehenfaerbung. Genau das ist der Zweck. Was er braucht, ist eine einzige
     Zutat: die Verblassung, die im Instanzwert `sy` steckt (es gibt keinen
     Alphaslot unter den 12 Festwerten je Instanz, und ein flaches Quad hat in
     y keine Ausdehnung — sy ist also der einzige freie Wert).

     depthWrite aus: Kartenzeichen liegen flach uebereinander (Flaechenton,
     Randmarke, Beschriftung) und wuerden sich sonst gegenseitig wegschneiden. */
  var flach = !!opts.flach;
  delete opts.flach;
  if (flach) {
    /* `emissive` gehoert zu Phong und Lambert, nicht zu Basic — three
       verwirft es zwar, meldet das aber je Material einmal auf der Konsole,
       und 49 gleichlautende Warnungen beim Start machen jede echte Meldung
       unauffindbar. Ein unbeleuchtetes Material kennt kein Eigenleuchten:
       Arbor leuchtet ueber den Tint (siehe ARBOR_FARBE in signaturen.js). */
    delete opts.emissive;
    opts.depthWrite = false;
    opts.transparent = true;
    var mb = new THREE.MeshBasicMaterial(opts);
    mb.customProgramCacheKey = function () { return "terraKarte"; };
    mb.onBeforeCompile = kartenPatch;
    return mb;
  }
  opts.shininess = 0;
  opts.specular = new THREE.Color(0x000000);
  var m = new THREE.MeshPhongMaterial(opts);
  var mal = null;
  if (familie && FAMILIEN[familie]) {
    var F = FAMILIEN[familie];
    mal = { texObj: TEX[F.tex], skala: F.skala * 0.06, staerke: F.staerke };
  }
  var windOpts = wind ? { amp: wind.amp || 0.35 } : null;
  var driftOpts = driftAmp > 0 ? { amp: driftAmp } : null;
  m.onBeforeCompile = function (shader) {
    terraPatch(shader, { cloudShadow: cloudShadow, mal: mal, wind: windOpts,
      rankenFade: rankenFade, ohneSchnee: ohneSchnee, drift: driftOpts });
  };
  // ohneSchnee taucht hier BEWUSST NICHT auf: der Schneeblock wird in jeden
  // Shader gleich eingesetzt, nur die Uniform-Bindung unterscheidet sich —
  // der Quelltext ist identisch, also darf der Schluessel nicht wachsen.
  // (ohneSchnee folgt ohnehin cloudShadow, das bereits im Schluessel steht.)
  // Die Drift MUSS in den Schluessel — sie aendert den Quelltext (eigener
  // Vertexblock, Amplitude einkompiliert), genau wie es der Wind-Anteil
  // '|w'+amp seit jeher vormacht. Gedeckelt bleibt die Permutation dadurch,
  // dass geometry.js nur zwei Amplituden vergibt: alle driftlosen Materialien
  // tragen einheitlich '|d-' und teilen sich ihre Programme weiter wie bisher.
  m.customProgramCacheKey = function () {
    return 'terraB|cs' + (cloudShadow ? 1 : 0) + '|f' + (familie || '-') +
      '|w' + (wind ? (wind.amp || 0.35) : '-') + '|rf' + (rankenFade ? 1 : 0) +
      '|d' + (driftAmp > 0 ? driftAmp : '-');
  };
  return m;
}

/** Materialien, die der Tageszeit-Grundton einfaerbt. */
const tintedMats = [];

// Ranken-Materialien: die Ranke ist in jeder Stimmung der hellste Wert im Bild.
// Opak: das Auslaufen nach oben uebernimmt der gedithertete Discard (Patch 7),
// damit das grosse Ranken-Mesh nicht in der Transparent-Queue sortiert wird.
const vineMat = terraMat({
  color: 0xffffff, vertexColors: true, transparent: false, opacity: 1,
  emissive: 0x4a463e, familie: 'rinde', rankenFade: true
});
const leafMat = terraMat({ vertexColors: true, side: THREE.DoubleSide, familie: 'laub' });
const rockMat = terraMat({ vertexColors: true, familie: 'stein' });
tintedMats.push(vineMat, leafMat, rockMat);

/* ==========================================================================
   Steuerung der beiden neuen globalen Zweige. Beide schreiben ausschliesslich
   in terraUniforms — kein Material wird angefasst, kein Pool neu gepackt.
   ========================================================================== */

/**
 * H2a — Schneeauflage setzen. Erwartet den `schnee`-Block eines Bioms:
 *   { auflage, kante:[a,b], hoehe:[a,b], farbe, kuehle, bruch }
 * Fehlt der Block (oder ist auflage <= 0), wird uSchneeAuflage = 0 gesetzt und
 * der komplette Fragmentzweig faellt weg — byteidentisch zu vorher.
 * Wird aus atmosphere.js am Ende von applyTod gerufen; io.js loest nach jedem
 * Biomwechsel ohnehin setTod(getTodName(), true) aus.
 */
function setSchnee(cfg) {
  var u = terraUniforms;
  if (!cfg) { u.uSchneeAuflage.value = 0; return; }
  var a = cfg.auflage;
  if (a === undefined || a === null) a = cfg.menge;
  a = (typeof a === 'number' && a > 0) ? a : 0;
  u.uSchneeAuflage.value = a;
  if (a <= 0) return;
  var k = cfg.kante;
  u.uSchneeKante.value.set(k ? k[0] : 0.20, k ? k[1] : 0.70);
  var h = cfg.hoehe;
  u.uSchneeHoehe.value.set(h ? h[0] : -99, h ? h[1] : -98);
  if (cfg.farbe !== undefined && cfg.farbe !== null) u.uSchneeFarbe.value.set(cfg.farbe);
  else u.uSchneeFarbe.value.set(0xeff4f8);
  u.uSchneeKuehle.value = (typeof cfg.kuehle === 'number') ? cfg.kuehle : 0.12;
  u.uSchneeBruch.value = (typeof cfg.bruch === 'number') ? cfg.bruch : 0.35;
}

/**
 * H3 — Arbor-Lichtquellen setzen. `liste` sind die Rankenfuesse:
 *   [{ x, z, radius, staerke }, ...]   (alternativ [x, z, radius, staerke])
 * radius ist der effektive Fussradius (VINE_R * dicke), staerke ein Faktor
 * 0..1 aus der Rankenhoehe. Mehr als ARBOR_MAX Eintraege werden auf die
 * staerksten (staerke * radius) reduziert — deterministisch, ohne Zufall.
 * Eine leere/fehlende Liste schaltet das Bodenlicht ab (uArborAnzahl = 0).
 */
function setArborQuellen(liste) {
  var arr = terraUniforms.uArborPos.value;
  var roh = [];
  var i, q;
  if (liste && liste.length) {
    for (i = 0; i < liste.length; i++) {
      q = liste[i];
      if (!q) continue;
      var x, z, r, s;
      // Array.isArray statt einer .length-Pruefung: THREE.Vector4 traegt
      // length als METHODE — eine Ententest-Pruefung liefe dort ins Leere.
      if (Array.isArray(q)) { x = q[0]; z = q[1]; r = q[2]; s = q[3]; }
      else { x = q.x; z = q.z; r = q.radius; s = q.staerke; }
      x = (typeof x === 'number') ? x : 0;
      z = (typeof z === 'number') ? z : 0;
      r = (typeof r === 'number' && r > 0) ? r : 6;
      s = (typeof s === 'number') ? s : 1;
      if (!(s > 0)) continue;
      roh.push([x, z, r, s]);
    }
  }
  if (roh.length > ARBOR_MAX) {
    // Stabile Ordnung: staerkste zuerst, bei Gleichstand die urspruengliche
    // Reihenfolge (Index als Tiebreaker) — gleiche Karte, gleiches Ergebnis.
    for (i = 0; i < roh.length; i++) roh[i].push(i);
    roh.sort(function (m, n) {
      var dm = n[3] * n[2] - m[3] * m[2];
      return dm !== 0 ? dm : m[4] - n[4];
    });
    roh.length = ARBOR_MAX;
  }
  for (i = 0; i < roh.length; i++) arr[i].set(roh[i][0], roh[i][1], roh[i][2], roh[i][3]);
  for (i = roh.length; i < ARBOR_MAX; i++) arr[i].set(0, 0, 1, 0);
  terraUniforms.uArborAnzahl.value = roh.length;
}

export { terraUniforms, patchInfo, terraPatch, terraMat, tintedMats, FAMILIEN,
  vineMat, leafMat, rockMat, ARBOR_MAX, setSchnee, setArborQuellen, setBruchQuelle,
  setzeBiomKarte, holeBiomLut };
