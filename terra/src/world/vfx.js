// Gemeinsames Partikelsystem (VFX): Regen, Schnee, Blueten, Sporen, Staub,
// Funken — und der Arbor-Lichtflug um die Ranken.
//
// GRUNDGEDANKE — die Bewegung liegt vollstaendig im Vertex-Shader.
// Jede Instanz traegt ihre Startwerte (Position, Phase, Tempo, Groesse, Farb-
// mischung, Alpha) als InstancedBufferAttribute; die Instanzmatrix bleibt die
// Einheitsmatrix und wird nie wieder angefasst. Pro Frame schreibt tickVfx()
// genau zwei Uniforms (Zeit und Kamerafokus) plus acht Bodenhoehen fuer den
// Arbor-Flug — also KEINE CPU-Arbeit pro Partikel. Zum Vergleich: rauchMesh
// und birdMesh in atmosphere.js rechnen jede Instanzmatrix je Bild neu; das
// traegt bei 360 bzw. 35 Instanzen, bei 3000 Regenstreifen traegt es nicht.
//
// DETERMINISMUS. Erzeugung ist streng deterministisch: alle Startwerte kommen
// aus rngOf()/hashi(), kein Math.random. Die Darstellung darf zeitabhaengig
// animieren — genau wie Wind (wind.js) und Wolkendrift (sky.js).
//
// VOLUMEN UND WRAPPING. Alle Partikel leben in einem Quader um den Kamerafokus
// und werden toroidal umgeschlagen (mod), genau wie die Wolken in sky.js ihre
// +-780-Kachel umschlagen. Dadurch bedient eine FESTE Instanzzahl jede Karten-
// groesse: was hinten hinauslaeuft, kommt vorn wieder herein.
//
// SHADER-PATCH. Wie ueberall im Projekt per onBeforeCompile mit Ankerpruefung
// und console.warn (Konvention aus render/materials.js). Die Zaehler liegen
// hier in vfxPatchInfo statt in patchInfo, weil materials.js in dieser Runde
// nicht angefasst werden darf — window.terraVfxInfo neben window.terraPatchInfo.
import * as THREE from 'three';
import { clamp, sstep, rngOf, rr } from '../core/rng.js';
import { texPaint } from '../render/textures.js';
import { windUniforms } from './wind.js';
import { terraUniforms, ARBOR_MAX, patchInfo } from '../render/materials.js';
import { heightAt } from './terrain.js';

/* ==========================================================================
   Diagnose — zwei Ebenen, bewusst: `patchInfo.vfx` (materials.js) ist die eine
   Ja/Nein-Zeile fuers Abnahmemuster, window.terraVfxInfo die Feinaufloesung
   (welcher der vier Teilpatches griff). `versuche` bleibt hier, weil es in
   patchInfo die terraPatch()-Aufrufe zaehlt, nicht die des VFX-Shaders.
   ========================================================================== */
const vfxPatchInfo = { versuche: 0, billboard: 0, farbe: 0, form: 0, arbor: 0 };
if (typeof window !== 'undefined') window.terraVfxInfo = vfxPatchInfo;

/* ==========================================================================
   Texturatlas: zwei 128er-Zellen nebeneinander in einer 256x128-Textur.
     Zelle 0 (u 0.0 .. 0.5) "Korn"  — weiches Rundkorn mit festem Kern.
       Traegt Regen (in die Laenge gezogen), Schnee, Sporen, Staub, Funken.
     Zelle 1 (u 0.5 .. 1.0) "Blatt" — schmales Bluetenblatt mit Mittelrippe.
   EIN Atlas statt zweier Texturen: der Typwechsel verschiebt dann nur ein
   Uniform (uForm) und muss weder material.map noch needsUpdate anfassen.
   Beide Zellen laufen weit vor ihrem Rand auf Alpha 0 aus, damit die bilineare
   Filterung nicht aus der Nachbarzelle blutet; Mipmaps sind aus demselben
   Grund abgeschaltet (Partikelquads sind ohnehin klein).
   Gezeichnet mit texPaint() aus render/textures.js — dieselbe Fabrik, aber
   OHNE texFinish(), damit die Registry TEX nicht von aussen beschrieben wird.
   ========================================================================== */
function malKorn(u, v, o) {
  var dx = (u - 0.5) * 2, dy = (v - 0.5) * 2;
  var r = Math.sqrt(dx * dx + dy * dy);
  var kern = 1 - sstep(0.0, 0.44, r);              // dichte Mitte
  var hof = Math.pow(Math.max(0, 1 - r), 2.4);     // weiter, weicher Saum
  var a = clamp(kern * 0.72 + hof * 0.58, 0, 1);
  o[3] = a * (1 - sstep(0.80, 0.99, r));           // Zellrand sicher auf 0
  o[0] = o[1] = o[2] = 1;                          // Farbe kommt aus dem Shader
}

function malBlatt(u, v, o) {
  // Diagonal liegendes Blatt: Stiel unten links, Spitze oben rechts. Die
  // Diagonale nutzt die quadratische Zelle besser aus als ein waagerechtes
  // Blatt und laesst mehr Rand fuer den sicheren Alpha-Auslauf.
  var x = u - 0.5, y = v - 0.5;
  var c = Math.cos(0.62), s = Math.sin(0.62);
  var px = x * c - y * s, py = x * s + y * c;
  if (px < -0.38 || px > 0.38) { o[3] = 0; return; }
  var t = clamp(px / 0.76 + 0.5, 0, 1);            // 0 Stiel .. 1 Spitze
  var hw = Math.sin(Math.PI * Math.pow(t, 0.72)) * 0.19 * (1 - t * 0.22);
  var d = Math.abs(py);
  if (d > hw) { o[3] = 0; return; }
  var a = 1 - sstep(hw * 0.52, hw, d);
  a *= sstep(0.0, 0.06, t);                        // Stielansatz auslaufen
  var rippe = 1 - Math.min(1, d / 0.013);
  var hell = 0.84 + rippe * 0.18 + (1 - t) * 0.12;
  o[3] = clamp(a, 0, 1);
  o[0] = hell; o[1] = hell * 0.96; o[2] = hell * 0.97;
}

function baueAtlas() {
  if (typeof document === 'undefined') return null;   // headless: kein Atlas
  var c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  var ctx = c.getContext('2d');
  ctx.drawImage(texPaint(128, malKorn), 0, 0);
  ctx.drawImage(texPaint(128, malBlatt), 128, 0);
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const VFX_ATLAS = baueAtlas();

/* ==========================================================================
   Typenkatalog. Jeder Typ ist eine reine Uniform-Belegung — ein Typwechsel
   kostet keine Neuberechnung, keinen Buffer-Upload und keine Neukompilierung.

     basis        Instanzzahl bei dichte 1 (Deckel: VFX_MAX)
     form         0 = Korn, 1 = Blatt (Atlaszelle)
     halb         halbe Kantenlaenge des Volumens in XZ (Wrapping-Kachel)
     boxY         [Untergrenze relativ zum Fokus, Hoehe des Bandes]
     fall         Vertikaltempo in Einheiten/s (negativ = fallend)
     drift        waagerechte Grundstroemung [x, z] in Einheiten/s
     taumel       [Frequenz, Amplitude XZ, Amplitude Y] — das Trudeln
     groesse      [Breite, Laenge] des Billboardquads in Welteinheiten
     ausricht     1 = Quad laeuft entlang der Bewegungsrichtung (Streifen),
                  0 = bildschirmparallel mit Eigendrehung
     dreh         Eigendrehung in rad/s (nur bei ausricht 0)
     deck         Grunddeckkraft
     flacker      0..1 Anteil sinusfoermiger Helligkeitsschwankung
     wind         0..1 Kopplung der Drift an windUniforms.uWindStaerke
     additiv      true = AdditiveBlending (emissiv)
     farbA/farbB  die beiden Enden der Farbstreuung je Instanz
   ========================================================================== */
const VFX_MAX = 3000;

const VFX_TYPEN = {
  aus: { basis: 0, form: 0, halb: 100, boxY: [0, 1], fall: 0, drift: [0, 0],
    taumel: [0, 0, 0], groesse: [1, 1], ausricht: 0, dreh: 0, deck: 0,
    flacker: 0, wind: 0, additiv: false, farbA: 0xffffff, farbB: 0xffffff },

  // Regen: schnelle, duenne Streifen. ausricht 1 legt das Quad auf die
  // Bewegungsrichtung — zusammen mit der windgekoppelten Drift ergibt das die
  // Schraege, die im Sturm sichtbar steiler wird.
  regen: { basis: 2200, form: 0, halb: 150, boxY: [-14, 132],
    fall: -46, drift: [4.5, 1.6], taumel: [0, 0, 0], groesse: [0.16, 3.4],
    ausricht: 1, dreh: 0, deck: 0.40, flacker: 0, wind: 1.0, additiv: false,
    farbA: 0xa4b8cc, farbB: 0xdeeaf4 },

  // Schnee: langsam, taumelnd, mit leichter Eigendrehung und Y-Wippen.
  schnee: { basis: 1400, form: 0, halb: 140, boxY: [-12, 112],
    fall: -3.6, drift: [1.6, 0.7], taumel: [0.9, 1.7, 0.35], groesse: [0.85, 0.85],
    ausricht: 0, dreh: 0.5, deck: 0.62, flacker: 0, wind: 0.6, additiv: false,
    farbA: 0xeaf2fa, farbB: 0xffffff },

  // Blueten: seitlich driftend, deutlich rotierend, kaum fallend.
  blueten: { basis: 700, form: 1, halb: 110, boxY: [-8, 62],
    fall: -2.4, drift: [4.2, 2.6], taumel: [0.75, 2.6, 0.9], groesse: [0.95, 0.95],
    ausricht: 0, dreh: 1.7, deck: 0.78, flacker: 0, wind: 0.85, additiv: false,
    farbA: 0xf2bed0, farbB: 0xfff0f4 },

  // Sporen/Irrlichter: langsam AUFsteigend (fall positiv), emissiv, pulsend.
  sporen: { basis: 520, form: 0, halb: 120, boxY: [-4, 56],
    fall: 1.5, drift: [0.9, 0.6], taumel: [0.45, 1.9, 0.7], groesse: [0.62, 0.62],
    ausricht: 0, dreh: 0, deck: 0.55, flacker: 0.75, wind: 0.25, additiv: true,
    farbA: 0x8ce0b8, farbB: 0xdaffe8 },

  // Staub/Asche: waagerecht treibend, praktisch schwerelos, flaches Band.
  staub: { basis: 900, form: 0, halb: 160, boxY: [-6, 46],
    fall: -0.4, drift: [11.0, 4.5], taumel: [0.4, 1.8, 0.5], groesse: [0.75, 0.75],
    ausricht: 0, dreh: 0.35, deck: 0.28, flacker: 0.15, wind: 0.9, additiv: false,
    farbA: 0xc6ae88, farbB: 0xeaddc6 },

  // Funken: schnell aufsteigend, kurz (flaches Band = kurze Lebensdauer),
  // warm und emissiv. Fuer Schmieden und Feuerstellen.
  funken: { basis: 260, form: 0, halb: 90, boxY: [-2, 26],
    fall: 7.5, drift: [1.2, 0.8], taumel: [0.9, 0.8, 0.2], groesse: [0.30, 0.58],
    ausricht: 1, dreh: 0, deck: 0.85, flacker: 0.9, wind: 0.35, additiv: true,
    farbA: 0xff9a3c, farbB: 0xffe2a8 }
};

/* ==========================================================================
   Shader. Ein gemeinsamer Patch fuer beide Meshes; `istArbor` schaltet den
   Bewegungsteil um (Volumen-Wrapping <-> Umlauf um die Rankenfuesse).
   Anker im Vertexshader: #include <project_vertex>. Der Ersatz MUSS die
   Variable `mvPosition` deklarieren — #include <fog_vertex> liest sie.
   Anker im Fragmentshader: #include <color_fragment>.
   Anker fuer die Atlaszelle: #include <uv_vertex> (nur Nicht-Arbor).
   ========================================================================== */

/** Startwerte-Attribute, gemeinsame Kopfzeilen beider Vertexshader. */
const KOPF_GEMEINSAM = [
  'attribute vec4 vfxStart;',   // Nicht-Arbor: xyz Startpunkt normiert, w Phase
  'attribute vec4 vfxVar;',     // x Tempo, y Groessenfaktor, z Farbmischung, w Alpha
  'uniform float uZeit;',
  'uniform vec2  uGroesse;',
  'uniform float uDeckkraft;',
  'uniform float uFlacker;',
  'varying vec4  vVfxCol;'
].join('\n');

const KOPF_WETTER = [
  'uniform vec3  uFokus;',
  'uniform float uHalb;',
  'uniform vec2  uBoxY;',
  'uniform float uFall;',
  'uniform vec2  uDrift;',
  'uniform vec3  uTaumel;',
  'uniform float uAusricht;',
  'uniform float uDreh;',
  'uniform vec3  uFarbA;',
  'uniform vec3  uFarbB;',
  'uniform float uWindKopplung;',
  'uniform float uWindStaerke;',
  'uniform vec2  uForm;',
  /* Biomflaechen werden im Wetterkern an der Partikel-Weltposition gelesen.
     Die Uniforms muessen deshalb nicht nur im Three-Uniformobjekt, sondern
     auch im GLSL-Kopf des MeshBasicMaterial-Vertexshaders deklariert sein. */
  'uniform float uBiomAn;',
  'uniform sampler2D uBiomKarte;',
  'uniform sampler2D uBiomLut;',
  'uniform vec2 uBiomAbb;',
  'uniform float uBiomZeilen;'
].join('\n');

const KOPF_ARBOR = [
  'attribute float vfxQuelle;',
  'uniform vec4  uArborPos[' + ARBOR_MAX + '];',
  'uniform float uArborBoden[' + ARBOR_MAX + '];',
  'uniform int   uArborAnzahl;',
  'uniform vec3  uArborFarbe;',
  'uniform float uArborStaerke;',
  'uniform float uArborHoehe;'
].join('\n');

/* Bewegung + Alpha des Wetter-/Umgebungs-VFX. Ergebnis: vec3 p (Weltpunkt),
   float vfxA (Deckkraft), vec3 vfxC (Farbe), vec2 achseY (Bildschirmachse). */
const KERN_WETTER = [
  'float tempo = vfxVar.x;',
  'float ph    = vfxStart.w;',
  'float t     = uZeit * tempo;',
  'float wind  = mix( 1.0, uWindStaerke, uWindKopplung );',
  'vec2  drift = uDrift * wind;',
  // Startpunkt: normierte Attribute auf das aktuelle Volumen abgebildet.
  'vec3 p = vec3( vfxStart.x * uHalb, uBoxY.x + vfxStart.y * uBoxY.y, vfxStart.z * uHalb );',
  'p.y  += uFall * t;',
  'p.xz += drift * t;',
  // Taumeln: drei entkoppelte Frequenzen, damit keine Reihe entsteht.
  'p.x  += sin( uZeit * uTaumel.x + ph * 6.2831 ) * uTaumel.y;',
  'p.z  += cos( uZeit * uTaumel.x * 0.83 + ph * 4.7 ) * uTaumel.y;',
  'p.y  += sin( uZeit * uTaumel.x * 0.61 + ph * 3.1 ) * uTaumel.z;',
  // Toroidales Wrapping in XZ um den Fokus (Muster: Wolken in sky.js).
  'vec2 rel = p.xz - uFokus.xz;',
  'rel = mod( rel + uHalb, 2.0 * uHalb ) - uHalb;',
  'p.xz = uFokus.xz + rel;',
  // Wrapping in Y; `leben` ist die normierte Bandposition 0..1.
  'float relY  = mod( p.y - uFokus.y - uBoxY.x, uBoxY.y );',
  'float leben = relY / uBoxY.y;',
  'p.y = uFokus.y + uBoxY.x + relY;',
  // Alphaverlauf: zum Kachelrand hin ausblenden (kein Aufpoppen beim
  // Umschlagen) und an beiden Bandenden weich ein-/austreten.
  'float kante = max( abs( rel.x ), abs( rel.y ) ) / uHalb;',
  'float vfxA = 1.0 - smoothstep( 0.70, 1.0, kante );',
  'vfxA *= smoothstep( 0.0, 0.10, leben ) * ( 1.0 - smoothstep( 0.86, 1.0, leben ) );',
  'vfxA *= uDeckkraft * vfxVar.w;',
  'vfxA *= mix( 1.0, 0.5 + 0.5 * sin( uZeit * 2.7 * tempo + ph * 6.2831 ), uFlacker );',
  /* I6 — Partikelstaerke aus der Biom-LUT. Bis hierher gilt das Wetter der
     ganzen Karte; ab hier auch die Flaeche darunter. Ein Schneefall ueber
     einer Wuestenflaeche soll dort duenner werden, statt gleichmaessig ueber
     die Karte zu liegen.

     Nachgeschlagen wird an der WELTPOSITION des Partikels (`p.xz`), die der
     Kern oben ohnehin schon gerechnet hat — dieselbe Abbildung wie beim
     Terrain (uBiomAbb) und bei der Bruchmaske. Zwei Texturzugriffe je
     Instanz, und nur solange uBiomAn ueber 0 steht: ohne eine einzige
     Biomflaeche auf der Karte faellt der ganze Block uniform-kohaerent weg
     und das Bild ist Zeichen fuer Zeichen das bisherige.

     Auf die DECKKRAFT und nicht auf die Groesse: ein halb so grosses
     Schneekorn liest sich als weiter entfernt, ein blasseres als weniger.
     Der Deckel bei 0.05 laesst die Instanz stehen statt sie verschwinden zu
     lassen — ein Partikel, das mitten im Flug erlischt, blinkt. */
  'if ( uBiomAn > 0.5 ) {',
  '  vec2 bUv = p.xz * uBiomAbb.x + vec2( uBiomAbb.y );',
  '  vec2 bKa = texture2D( uBiomKarte, bUv ).rg;',
  '  float bZeile = ( bKa.r * 255.0 + 0.5 ) / uBiomZeilen;',
  '  float bStaerke = texture2D( uBiomLut, vec2( 0.25, bZeile ) ).a;',
  '  vfxA *= mix( 1.0, max( bStaerke, 0.05 ), bKa.g );',
  '}',
  'vec3 vfxC = mix( uFarbA, uFarbB, vfxVar.z );',
  // Bildschirmachse des Quads: entweder die Bewegungsrichtung (Streifen) oder
  // die Senkrechte mit Eigendrehung (taumelnde Flocken und Blaetter).
  'vec2 achseY = vec2( 0.0, 1.0 );',
  'if ( uAusricht > 0.5 ) {',
  '  vec3 bewV = ( viewMatrix * vec4( drift.x, uFall, drift.y, 0.0 ) ).xyz;',
  '  float bl = length( bewV.xy );',
  '  if ( bl > 0.0001 ) achseY = bewV.xy / bl;',
  '} else if ( uDreh != 0.0 ) {',
  '  float w = uZeit * uDreh * tempo + ph * 6.2831;',
  '  achseY = vec2( -sin( w ), cos( w ) );',
  '}'
].join('\n');

/* Bewegung + Alpha des Arbor-Lichtflugs: Umlauf um den Rankenfuss, dabei
   aufsteigend. Die Quellen kommen unveraendert aus terraUniforms.uArborPos —
   dasselbe Array, das auch das Arbor-Bodenlicht speist (materials.js, H3);
   setArborQuellen() aus dem Commit-Nachlauf (dirty.js) haelt es aktuell. Es
   gibt deshalb KEINE eigene Rankenliste und keinen zweiten Update-Pfad. */
const KERN_ARBOR = [
  // clamp als Sicherung: uArborPos hat feste Laenge, ein Index daneben waere
  // in GLSL undefiniert. vfxQuelle liegt bauartbedingt in 0..ARBOR_MAX-1.
  'int qi = clamp( int( vfxQuelle + 0.5 ), 0, ' + (ARBOR_MAX - 1) + ' );',
  'vec4 Q  = uArborPos[ qi ];',
  'float boden = uArborBoden[ qi ];',
  'float aktiv = ( qi < uArborAnzahl && Q.w > 0.0001 ) ? 1.0 : 0.0;',
  // Sichtbarkeitskurve: nachts voll, abends spuerbar, morgens/im Nebel aus.
  // uArborStaerke traegt bereits die weiche Tageszeit-Blende (nacht 1.0,
  // abend 0.35, morgen/nebel 0.15, mittag 0.0).
  'float sicht = smoothstep( 0.15, 0.60, uArborStaerke ) * Q.w * aktiv;',
  'float tempo = vfxVar.x;',
  'float t = uZeit * tempo;',
  'float leben = fract( vfxStart.w + t * 0.055 );',
  'float ri = vfxStart.y > 0.5 ? 1.0 : -1.0;',
  'float w  = vfxStart.x * 6.2831 + t * 0.42 * ri;',
  'float radius = max( Q.z, 1.0 ) * ( 1.15 + vfxStart.z * 1.9 ) * ( 0.75 + leben * 0.55 );',
  'vec3 p = vec3( Q.x + cos( w ) * radius,',
  '               boden + 1.2 + leben * uArborHoehe + sin( t * 0.9 + vfxStart.w * 6.2831 ) * 1.4,',
  '               Q.y + sin( w ) * radius );',
  'float vfxA = smoothstep( 0.0, 0.12, leben ) * ( 1.0 - smoothstep( 0.70, 1.0, leben ) );',
  'vfxA *= sicht * uDeckkraft * vfxVar.w;',
  'vfxA *= mix( 1.0, 0.5 + 0.5 * sin( uZeit * 2.3 * tempo + vfxStart.w * 6.2831 ), uFlacker );',
  'vec3 vfxC = mix( uArborFarbe, vec3( 1.0 ), vfxVar.z * 0.5 );',
  'vec2 achseY = vec2( 0.0, 1.0 );'
].join('\n');

/**
 * Gemeinsamer Abschluss: Billboard in Sichtkoordinaten aufspannen.
 * `p` ist bereits eine WELTposition (uFokus und uArborPos sind Weltkoordinaten),
 * deshalb steht hier viewMatrix und NICHT modelViewMatrix — beide Meshes
 * haengen ohne eigene Transformation direkt an der Szene, und die
 * Instanzmatrix bleibt die Einheitsmatrix.
 * Der Versatz wird in Sichtkoordinaten addiert: das Quad steht damit immer
 * senkrecht zur Blickachse (echtes Bildschirm-Billboard) und behaelt seine
 * WELTgroesse, laeuft also korrekt perspektivisch mit der Entfernung.
 */
const BILLBOARD = [
  'vec4 mvPosition = viewMatrix * vec4( p, 1.0 );',
  'vec2 achseX = vec2( achseY.y, -achseY.x );',
  'mvPosition.xy += ( achseX * position.x * uGroesse.x',
  '                 + achseY * position.y * uGroesse.y ) * vfxVar.y;',
  'gl_Position = projectionMatrix * mvPosition;'
].join('\n');

/**
 * Haengt den VFX-Patch in ein MeshBasicMaterial. Ankerpruefung und
 * console.warn nach der Projektkonvention (render/materials.js).
 */
function vfxPatch(shader, istArbor) {
  vfxPatchInfo.versuche++;
  var pv = '#include <project_vertex>';
  if (shader.vertexShader.indexOf(pv) >= 0) {
    var kern = istArbor ? KERN_ARBOR : KERN_WETTER;
    var kopf = KOPF_GEMEINSAM + '\n' + (istArbor ? KOPF_ARBOR : KOPF_WETTER) + '\n';
    var rumpf = kern + '\n' + BILLBOARD + '\nvVfxCol = vec4( vfxC, max( vfxA, 0.0 ) );';
    shader.vertexShader = kopf + shader.vertexShader.replace(pv, rumpf);
    vfxPatchInfo.billboard++;
    patchInfo.vfx++;   // eine Zeile fuers Abnahmemuster (materials.js)
    if (istArbor) vfxPatchInfo.arbor++;
  } else {
    console.warn('terra: Shader-Patch "vfx-billboard" fand seinen Anker nicht — Partikel bleiben unbewegt.');
    return;
  }

  // Atlaszelle waehlen (nur Wetter-VFX; der Arbor-Flug nutzt immer das Korn
  // und bekommt seine Zelle fest ueber die Geometrie-UV).
  if (!istArbor) {
    var uvv = '#include <uv_vertex>';
    if (shader.vertexShader.indexOf(uvv) >= 0) {
      shader.vertexShader = shader.vertexShader.replace(uvv, uvv +
        '\n#ifdef USE_MAP\n' +
        '  vMapUv = vMapUv * vec2( uForm.y, 1.0 ) + vec2( uForm.x, 0.0 );\n' +
        '#endif');
      vfxPatchInfo.form++;
    } else {
      console.warn('terra: Shader-Patch "vfx-form" fand seinen Anker nicht — Atlaszelle bleibt fest.');
    }
  }

  var cf = '#include <color_fragment>';
  if (shader.fragmentShader.indexOf(cf) >= 0) {
    shader.fragmentShader = 'varying vec4 vVfxCol;\n' +
      shader.fragmentShader.replace(cf, cf +
        '\ndiffuseColor.rgb *= vVfxCol.rgb;\ndiffuseColor.a *= vVfxCol.a;');
    vfxPatchInfo.farbe++;
  } else {
    console.warn('terra: Shader-Patch "vfx-farbe" fand seinen Anker nicht — Partikel bleiben weiss.');
  }
}

/* ==========================================================================
   Uniforms und Material des Wetter-/Umgebungs-VFX
   ========================================================================== */
const vfxUniforms = {
  uZeit: { value: 0 },
  uFokus: { value: new THREE.Vector3(0, 0, 0) },
  uHalb: { value: 140 },
  uBoxY: { value: new THREE.Vector2(-10, 110) },
  uFall: { value: -10 },
  uDrift: { value: new THREE.Vector2(0, 0) },
  uTaumel: { value: new THREE.Vector3(0, 0, 0) },
  uGroesse: { value: new THREE.Vector2(0.5, 0.5) },
  uAusricht: { value: 0 },
  uDreh: { value: 0 },
  uFarbA: { value: new THREE.Color(0xffffff) },
  uFarbB: { value: new THREE.Color(0xffffff) },
  uDeckkraft: { value: 0.5 },
  uFlacker: { value: 0 },
  uWindKopplung: { value: 0 },
  uForm: { value: new THREE.Vector2(0, 0.5) }
};

const vfxMat = new THREE.MeshBasicMaterial({
  map: VFX_ATLAS, transparent: true, depthWrite: false, depthTest: true,
  side: THREE.DoubleSide, fog: true
});
vfxMat.onBeforeCompile = function (shader) {
  for (var k in vfxUniforms) shader.uniforms[k] = vfxUniforms[k];
  shader.uniforms.uWindStaerke = windUniforms.uWindStaerke;
  shader.uniforms.uBiomAn = terraUniforms.uBiomAn;
  shader.uniforms.uBiomKarte = terraUniforms.uBiomKarte;
  shader.uniforms.uBiomLut = terraUniforms.uBiomLut;
  shader.uniforms.uBiomAbb = terraUniforms.uBiomAbb;
  shader.uniforms.uBiomZeilen = terraUniforms.uBiomZeilen;
  vfxPatch(shader, false);
};
vfxMat.customProgramCacheKey = function () { return 'terraVfx'; };

/* --- Arbor-Lichtflug: eigenes Material, immer additiv, ohne Nebel --------- */
const arborUniforms = {
  uZeit: { value: 0 },
  uGroesse: { value: new THREE.Vector2(0.55, 0.55) },
  uDeckkraft: { value: 0.9 },
  uFlacker: { value: 0.65 },
  uArborBoden: { value: new Float32Array(ARBOR_MAX) },
  uArborHoehe: { value: 74 }
};

const arborMat = new THREE.MeshBasicMaterial({
  map: VFX_ATLAS, transparent: true, depthWrite: false, depthTest: true,
  side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending
});
arborMat.onBeforeCompile = function (shader) {
  for (var k in arborUniforms) shader.uniforms[k] = arborUniforms[k];
  shader.uniforms.uArborPos = terraUniforms.uArborPos;
  shader.uniforms.uArborAnzahl = terraUniforms.uArborAnzahl;
  shader.uniforms.uArborFarbe = terraUniforms.uArborFarbe;
  shader.uniforms.uArborStaerke = terraUniforms.uArborStaerke;
  vfxPatch(shader, true);
};
arborMat.customProgramCacheKey = function () { return 'terraVfxArbor'; };

/* ==========================================================================
   Geometrien und Meshes. Die Instanzmatrix wird EINMAL auf die Einheitsmatrix
   gesetzt und danach nie wieder angefasst — die Position kommt komplett aus
   dem Vertexshader. frustumCulled bleibt aus (three kennt die wahren
   Positionen nicht), renderOrder 4 legt die Partikel hinter die Wolken (3).
   ========================================================================== */
function einheitsMatrizen(mesh, n) {
  var m = new THREE.Matrix4();
  for (var i = 0; i < n; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
}

/** Halbe Zellenbreite im Atlas: die Basis-UV zeigt auf Zelle 0. */
function quadGeo() {
  var g = new THREE.PlaneGeometry(1, 1);
  var uv = g.attributes.uv;
  for (var i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5);
  uv.needsUpdate = true;
  return g;
}

/* --- Wetter-/Umgebungsmesh ---------------------------------------------- */
var vfxGeo = quadGeo();
(function () {
  var rng = rngOf(0x7f2c19);
  var start = new Float32Array(VFX_MAX * 4);
  var vari = new Float32Array(VFX_MAX * 4);
  for (var i = 0; i < VFX_MAX; i++) {
    start[i * 4] = rr(rng, -1, 1);          // X normiert
    start[i * 4 + 1] = rng();               // Y normiert (0..1 im Band)
    start[i * 4 + 2] = rr(rng, -1, 1);      // Z normiert
    start[i * 4 + 3] = rng();               // Phase 0..1
    vari[i * 4] = rr(rng, 0.78, 1.28);      // Tempo
    vari[i * 4 + 1] = rr(rng, 0.62, 1.45);  // Groessenfaktor
    vari[i * 4 + 2] = rng();                // Farbmischung
    vari[i * 4 + 3] = rr(rng, 0.55, 1.0);   // Alphafaktor
  }
  vfxGeo.setAttribute('vfxStart', new THREE.InstancedBufferAttribute(start, 4));
  vfxGeo.setAttribute('vfxVar', new THREE.InstancedBufferAttribute(vari, 4));
})();
const vfxMesh = new THREE.InstancedMesh(vfxGeo, vfxMat, VFX_MAX);
vfxMesh.frustumCulled = false;
vfxMesh.renderOrder = 4;
vfxMesh.count = 0;
vfxMesh.visible = false;
einheitsMatrizen(vfxMesh, VFX_MAX);

/* --- Arbor-Lichtflug ----------------------------------------------------- */
const ARBOR_PRO_QUELLE = 56;
const ARBOR_N = ARBOR_MAX * ARBOR_PRO_QUELLE;      // 8 * 56 = 448
var arborGeo = quadGeo();
(function () {
  var rng = rngOf(0x3ab5e1);
  var start = new Float32Array(ARBOR_N * 4);
  var vari = new Float32Array(ARBOR_N * 4);
  var quelle = new Float32Array(ARBOR_N);
  for (var i = 0; i < ARBOR_N; i++) {
    start[i * 4] = rng();                     // Startwinkel 0..1
    start[i * 4 + 1] = rng();                 // Umlaufrichtung (>0.5 = links)
    start[i * 4 + 2] = rng();                 // Radiusmischung
    start[i * 4 + 3] = rng();                 // Phase im Aufstieg
    vari[i * 4] = rr(rng, 0.7, 1.35);
    vari[i * 4 + 1] = rr(rng, 0.5, 1.5);
    vari[i * 4 + 2] = rng();
    vari[i * 4 + 3] = rr(rng, 0.45, 1.0);
    quelle[i] = Math.floor(i / ARBOR_PRO_QUELLE);
  }
  arborGeo.setAttribute('vfxStart', new THREE.InstancedBufferAttribute(start, 4));
  arborGeo.setAttribute('vfxVar', new THREE.InstancedBufferAttribute(vari, 4));
  arborGeo.setAttribute('vfxQuelle', new THREE.InstancedBufferAttribute(quelle, 1));
})();
const arborMesh = new THREE.InstancedMesh(arborGeo, arborMat, ARBOR_N);
arborMesh.frustumCulled = false;
arborMesh.renderOrder = 4;
arborMesh.count = ARBOR_N;
einheitsMatrizen(arborMesh, ARBOR_N);

/* ==========================================================================
   API
   ========================================================================== */
var aktiverTyp = 'aus';
var aktiveDichte = 0;
var _farbe = new THREE.Color();

/** Haengt beide Partikel-Meshes in die Szene. Aus main.js, einmal beim Start. */
function initVfx(scene) {
  scene.add(vfxMesh);
  scene.add(arborMesh);
}

/**
 * Setzt Typ, Dichte und (optional) Farbe des Umgebungs-VFX.
 *   cfg = { typ: "regen"|"schnee"|"blueten"|"sporen"|"staub"|"funken"|"aus",
 *           dichte: 0..~1.6, farbe: hex|THREE.Color (optional) }
 * Ein Aufruf schreibt nur Uniforms und mesh.count — er ist billig genug, um
 * waehrend der Wetterblende in jedem Bild zu laufen. Unbekannte Typen fallen
 * tolerant auf "aus" zurueck (Muster: setTod mit unbekannter Tageszeit).
 */
function setVfx(cfg) {
  cfg = cfg || {};
  var name = cfg.typ;
  if (!VFX_TYPEN[name]) name = 'aus';
  var T = VFX_TYPEN[name];
  var d = (typeof cfg.dichte === 'number') ? clamp(cfg.dichte, 0, 4) : 1;
  aktiverTyp = name;
  aktiveDichte = d;

  var u = vfxUniforms;
  u.uHalb.value = T.halb;
  u.uBoxY.value.set(T.boxY[0], T.boxY[1]);
  u.uFall.value = T.fall;
  u.uDrift.value.set(T.drift[0], T.drift[1]);
  u.uTaumel.value.set(T.taumel[0], T.taumel[1], T.taumel[2]);
  u.uGroesse.value.set(T.groesse[0], T.groesse[1]);
  u.uAusricht.value = T.ausricht;
  u.uDreh.value = T.dreh;
  u.uDeckkraft.value = T.deck;
  u.uFlacker.value = T.flacker;
  u.uWindKopplung.value = T.wind;
  u.uForm.value.set(T.form * 0.5, 0.5);

  if (cfg.farbe !== undefined && cfg.farbe !== null) {
    // Vorgegebene Farbe: sie besetzt das dunkle Ende, das helle Ende wird
    // Richtung Weiss aufgehellt — so bleibt die Streuung je Instanz erhalten.
    u.uFarbA.value.set(cfg.farbe);
    u.uFarbB.value.copy(u.uFarbA.value).lerp(_farbe.setRGB(1, 1, 1), 0.45);
  } else {
    u.uFarbA.value.set(T.farbA);
    u.uFarbB.value.set(T.farbB);
  }

  var blend = T.additiv ? THREE.AdditiveBlending : THREE.NormalBlending;
  // material.blending wird von WebGLState je Zeichenaufruf gelesen — der
  // Wechsel braucht KEIN needsUpdate und loest keine Neukompilierung aus.
  if (vfxMat.blending !== blend) vfxMat.blending = blend;

  var n = Math.min(VFX_MAX, Math.round(T.basis * d));
  vfxMesh.count = n;
  vfxMesh.visible = n > 0;
}

/** Aktueller Typ — fuer Statuszeile und Diagnose. */
function getVfx() { return { typ: aktiverTyp, dichte: aktiveDichte, instanzen: vfxMesh.count }; }

/**
 * Pro Frame aus der Renderschleife. `zeit` sind Sekunden (now * 0.001),
 * `fokus` ein Punkt mit x/z und optional y (Kamerafokus, cam.focus + focusY).
 * Kosten: zwei Uniformschreibvorgaenge plus bis zu ARBOR_MAX Hoehenabfragen —
 * unabhaengig von der Partikelzahl.
 */
function tickVfx(zeit, fokus) {
  // Zeit beschneiden wie in wind.js (tickWind: now % 3600). Ohne das waechst
  // das Produkt drift*zeit in Bereiche, in denen float32 sichtbar quantisiert.
  var t = zeit % 3600;
  vfxUniforms.uZeit.value = t;
  arborUniforms.uZeit.value = t;

  if (fokus) {
    vfxUniforms.uFokus.value.set(
      fokus.x || 0,
      (typeof fokus.y === 'number') ? fokus.y : 0,
      fokus.z || 0);
  }

  // Bodenhoehe je Rankenfuss: der Lichtflug soll am Boden beginnen, nicht auf
  // Meereshoehe. Die Quellen selbst kommen aus terraUniforms.uArborPos.
  var n = terraUniforms.uArborAnzahl.value;
  if (n > 0 && terraUniforms.uArborStaerke.value > 0.15) {
    var pos = terraUniforms.uArborPos.value;
    var boden = arborUniforms.uArborBoden.value;
    for (var i = 0; i < n && i < ARBOR_MAX; i++) boden[i] = heightAt(pos[i].x, pos[i].y);
    arborMesh.visible = true;
  } else {
    arborMesh.visible = false;
  }
}

export { initVfx, setVfx, getVfx, tickVfx, VFX_TYPEN, VFX_MAX, vfxPatchInfo,
  vfxMesh, arborMesh, vfxUniforms, arborUniforms };
