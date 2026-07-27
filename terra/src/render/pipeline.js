// Render-Pipeline: Renderer, EffectComposer (Render → Bloom → Strahlen →
// Graduierung → Kante/Baender/Palette/Malschicht/Korn/Papierkante →
// OutputPass) plus ein halbaufgeloester Depth-only-Prepass, der die
// Kantenandeutung, die Himmelsmaske der Godrays UND die Tiefenbaender speist.
// Der OutputPass steht zwingend am Ende — er erledigt Tone Mapping und
// Farbraumkonversion.
//
// Warum F1/F2/F3 (Ideenwelle 2) im vorhandenen Kante-Pass sitzen und nicht in
// eigenen Passes:
//   (1) Sie brauchen genau das, was dieser Pass schon hat — die
//       halbaufgeloeste Tiefentextur, uNahFern und die Texelgroesse. Ein
//       eigener Pass muesste dieselben Uniforms noch einmal fuehren.
//   (2) Jeder zusaetzliche ShaderPass ist ein voller Ping-Pong-Durchgang ueber
//       ein HalfFloat-Target in Bildschirmgroesse. Drei davon kosten mehr
//       Bandbreite als die gesamte Rechnung, die sie tragen sollen.
//   (3) Die Reihenfolge im Pass bildet die Malerei ab:
//       Kante → Tiefenbaender (F3) → Palettenbindung (F1) → Malschicht (F2)
//       → Filmkorn → Papierkante. Die Palettenbindung ist damit der LETZTE
//       Farbschritt vor dem OutputPass; was danach kommt, ist kein Farbwert
//       mehr, sondern Bildtraeger (Papier, Pinsel) und Aufnahme (Korn) — auf
//       einem echten Bild liegen die auch UEBER dem Pigment. Laege die
//       Bindung hinter dem Korn, quantisierte sie ein animiertes Rauschen zu
//       flackernden Bloecken.
// Alle drei Zweige sind uniform-kohaerent mit Staerke 0 abgeschaltet; ohne
// Aufruf der Setter ist das Bild byteidentisch zum Stand vor dieser Runde.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
// Nur fuer die Horizontfarbe der gemalten Wasserstreifen (C4): setLook
// bekommt sie ohnehin als look.horizont und legt sie hier ins gemeinsame
// Uniform, damit water.js sie ohne Import aus atmosphere.js lesen kann.
// Zyklusfrei: render/materials.js zieht nur textures.js und world/wind.js,
// keines davon importiert render/pipeline.js.
import { terraUniforms } from './materials.js';
// F2: die bildraumfeste Malschicht-Textur. Zyklusfrei — textures.js zieht nur
// three und core/rng.js, und materials.js (oben) laedt es ohnehin schon.
import { TEX } from './textures.js';

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfe8f0, 200, 950);

let renderer = null, composer = null, bloomPass = null, gradePass = null,
    kantePass = null, outputPass = null, renderPass = null, strahlenPass = null;
let depthRT = null;
let postAn = true;
let infoCalls = 0, infoTris = 0;

/** Sanfte Stufe wie smoothstep — pipeline.js bleibt sonst importfrei. */
function sanft(a, b, x) {
  var t = (x - a) / (b - a);
  t = t < 0 ? 0 : (t > 1 ? 1 : t);
  return t * t * (3 - 2 * t);
}

/* --- Farbgraduierung: Lift/Gamma/Gain, Saettigung nach Luminanz,
       angehobener Schwarzpunkt, dezente Vignette -------------------------
   Befund Kalibrierpass (F4): die Saettigungsgewichtung ist tatsaechlich
   luminanzbasiert und nie global. l ist Rec.-709-Luma im gamma-Raum;
   "glocke" (smoothstep 0.06→0.35 auf, 0.6→0.95 wieder ab) hebt NUR die
   Mitten auf uSatMitte, "hoch" (smoothstep 0.6→0.95) senkt die Lichter auf
   uSatLicht (Presets halten uSatLicht < 1), und unter l ≈ 0.10 blendet die
   Wirkung komplett aus — tiefste Tiefen bleiben neutral. Die Regel "Mitten
   rauf, Lichter runter" ist damit strukturell erfuellt; keine
   Formelaenderung noetig. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new THREE.Vector3(0.016, 0.024, 0.042) },
    uGamma: { value: new THREE.Vector3(1, 1, 1) },
    uGain: { value: new THREE.Vector3(1.04, 1.02, 0.98) },
    uSatMitte: { value: 1.08 },
    uSatLicht: { value: 0.92 },
    uSchwarz: { value: 0.032 },
    uVignette: { value: 0.1 },
    // C2 Farbskript pro Karte: drei Farben, die Tiefen/Mitten/Lichter zu sich
    // ziehen. Startwerte neutral und uSkriptStaerke 0 — der ganze Zweig ist
    // uniform-kohaerent und faellt weg, solange keine Karte ein Skript traegt.
    // Vorhandene Karten bleiben dadurch byteidentisch.
    uSkriptLicht: { value: new THREE.Color(0xffffff) },
    uSkriptMitte: { value: new THREE.Color(0xffffff) },
    uSkriptSchatten: { value: new THREE.Color(0xffffff) },
    uSkriptStaerke: { value: 0 }
  },
  vertexShader: [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
    '}'
  ].join('\n'),
  fragmentShader: [
    'uniform sampler2D tDiffuse;',
    'uniform vec3 uLift; uniform vec3 uGamma; uniform vec3 uGain;',
    'uniform float uSatMitte; uniform float uSatLicht;',
    'uniform float uSchwarz; uniform float uVignette;',
    'uniform vec3 uSkriptLicht; uniform vec3 uSkriptMitte; uniform vec3 uSkriptSchatten;',
    'uniform float uSkriptStaerke;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 tex = texture2D( tDiffuse, vUv );',
    '  // Graduierung in einem wahrnehmungsnahen Raum, Ausgabe bleibt linear',
    '  vec3 c = pow( max( tex.rgb, 0.0 ), vec3( 1.0 / 2.2 ) );',
    '  c = pow( max( c * uGain + uLift, 0.0 ), 1.0 / uGamma );',
    '  float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );',
    '  float glocke = smoothstep( 0.06, 0.35, l ) * ( 1.0 - smoothstep( 0.6, 0.95, l ) );',
    '  float hoch = smoothstep( 0.6, 0.95, l );',
    '  float sat = mix( 1.0, uSatMitte, glocke );',
    '  sat = mix( sat, uSatLicht, hoch );',
    '  sat = mix( 1.0, sat, smoothstep( 0.02, 0.10, l ) );   // tiefste Tiefen fast neutral',
    '  c = mix( vec3( l ), c, sat );',
    '  // --- C2 Farbskript ---------------------------------------------------',
    '  // Der Filmlook UEBER der Biom- und Tageszeitpalette: drei Farben ziehen',
    '  // Tiefen, Mitten und Lichter zu sich. Die Saettigungsstufe darueber',
    '  // bleibt unangetastet — das Skript VERSCHIEBT Farbtoene, es saettigt',
    '  // nicht: (a) die Luminanz wird exakt zurueckgeholt, (b) der Farbanteil',
    '  // darf nur bis zum Ausgangsbetrag (plus einem kleinen Sockel, damit auch',
    '  // neutrale Flaechen den Ton annehmen) wachsen.',
    '  // Hinweis: mix( vec3(l), c, sat ) laesst l unveraendert (die Luma-',
    '  // gewichte summieren sich zu 1), l gilt hier also weiter.',
    '  if ( uSkriptStaerke > 0.0 ) {',
    '    float sSch = 1.0 - smoothstep( 0.02, 0.42, l );',
    '    float sLic = smoothstep( 0.58, 0.96, l );',
    '    float sMit = max( 1.0 - sSch - sLic, 0.0 );',
    '    vec3 ziel = uSkriptSchatten * sSch + uSkriptMitte * sMit + uSkriptLicht * sLic;',
    '    float zl = dot( ziel, vec3( 0.2126, 0.7152, 0.0722 ) );',
    '    vec3 getoent = c * ( ziel / max( zl, 0.0001 ) );',
    '    getoent *= l / max( dot( getoent, vec3( 0.2126, 0.7152, 0.0722 ) ), 0.0001 );',
    '    vec3 chrNeu = getoent - vec3( l ), chrAlt = c - vec3( l );',
    '    getoent = vec3( l ) + chrNeu *',
    '      min( 1.0, ( length( chrAlt ) + 0.05 ) / max( length( chrNeu ), 0.0001 ) );',
    '    c = mix( c, getoent, uSkriptStaerke );',
    '  }',
    '  // Schwarzpunkt anheben, leicht ins Kuehle',
    '  c = c * ( 1.0 - uSchwarz ) + vec3( uSchwarz * 0.9, uSchwarz * 0.96, uSchwarz * 1.08 );',
    '  float d = distance( vUv, vec2( 0.5 ) );',
    '  c *= 1.0 - uVignette * smoothstep( 0.42, 0.86, d );',
    '  gl_FragColor = vec4( pow( c, vec3( 2.2 ) ), tex.a );',
    '}'
  ].join('\n')
};

/* --- C1 Godrays: Lichtstrahlen durch die Wolkenluecken -------------------
   Screen-Space, VOR der Graduierung (die Strahlen sollen mitgraduiert und
   von der Papierkante gerahmt werden, nicht darueber liegen).

   Quelle ist die vorhandene Sonnen-/Mondscheibe: sie haengt als Sprite auf der
   Himmelskuppel bei Kameraposition + sonneDir * 1350 (world/sky.js, setSonne).
   renderFrame projiziert genau diesen Punkt ins Bild und legt ihn als
   uSonneUV ab — es gibt also KEINE zweite Kamera und keinen zweiten
   Renderdurchgang.

   Maske: die halbaufgeloeste Tiefentextur des Prepasses. Alles, was Tiefe
   schreibt, ist Geometrie; der Himmel (Kuppel, Scheibe, Wolken) laeuft mit
   depthWrite:false und wird im Prepass ausgeblendet, seine Texel behalten
   also den Clearwert 1.0 — "weit == Himmel" ist damit exakt und gratis.
   Zusaetzlich zaehlt nur, was HELL ist (uSchwelle): so tragen die Scheibe und
   ihr Horizontgluehen die Strahlen, nicht die ganze Himmelsflaeche.
   Bekannte Unschaerfe: Wasser und Rauch schreiben ebenfalls keine Tiefe und
   gelten der Maske als Himmel. Der Helligkeitsanteil und der Radialabfall um
   die Scheibe daempfen das so weit, dass es nicht auffaellt.

   Streifenregel (wie beim Sobel): Strahlen duerfen nur ANGEDEUTET werden. Der
   Startpunkt jedes Marschs wird deshalb aus gl_FragCoord gejittert —
   deterministisch, ohne Zeit, ohne Textur —, sonst legt das Verfahren
   sichtbare konzentrische Ringe ins Bild.

   Kosten: EIN zusaetzlicher Vollbildpass, je Fragment STRAHLEN_SAMPLES Taps
   auf das (halbfloat) Farbziel und ebenso viele auf die halbaufgeloeste
   Tiefe. Keine neuen Rendertargets — der Composer hat seine beiden
   Ping-Pong-Puffer schon. Bei Staerke 0 (nachts: dort strahlen die Ranken)
   wird der Pass ueber pass.enabled ganz uebersprungen, das Bild ist dann
   byteidentisch zu vorher. */
const STRAHLEN_SAMPLES = 10;
const StrahlenShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uNahFern: { value: new THREE.Vector2(0.5, 3000) },
    uSonneUV: { value: new THREE.Vector2(0.5, 0.5) },
    uStrahlen: { value: 0 },
    // Weiss als Standard: die Faerbung kommt aus der abgetasteten Scheibe
    // selbst (morgens warm, nachts kuehl) — das Uniform ist nur Feinabgleich.
    uStrahlenFarbe: { value: new THREE.Color(0xffffff) },
    uDichte: { value: 0.62 },     // Laenge des Marschs in Bildschirmanteilen
    uDekay: { value: 0.93 },      // Abfall je Schritt
    uSchwelle: { value: new THREE.Vector2(0.62, 1.10) }
  },
  vertexShader: [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
    '}'
  ].join('\n'),
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform sampler2D tDepth;',
    'uniform vec2 uNahFern; uniform vec2 uSonneUV; uniform vec2 uSchwelle;',
    'uniform float uStrahlen; uniform float uDichte; uniform float uDekay;',
    'uniform vec3 uStrahlenFarbe;',
    'varying vec2 vUv;',
    'float strahlTiefe( vec2 uv ) {',
    '  float z = texture2D( tDepth, uv ).x;',
    '  float n = uNahFern.x, f = uNahFern.y;',
    '  return ( 2.0 * n ) / ( f + n - z * ( f - n ) );',
    '}',
    'void main() {',
    '  vec4 tex = texture2D( tDiffuse, vUv );',
    '  vec2 schritt = ( vUv - uSonneUV ) * ( uDichte / ' + STRAHLEN_SAMPLES + '.0 );',
    '  // Jitter des Startversatzes: bricht das Ringmuster des radialen Blurs',
    '  float jit = fract( sin( dot( gl_FragCoord.xy, vec2( 127.1, 311.7 ) ) ) * 43758.5453 );',
    '  vec2 uv = vUv - schritt * jit;',
    '  vec3 summe = vec3( 0.0 );',
    '  float gew = 1.0, norm = 0.0;',
    '  for ( int i = 0; i < ' + STRAHLEN_SAMPLES + '; i ++ ) {',
    '    uv -= schritt;',
    '    vec3 q = texture2D( tDiffuse, uv ).rgb;',
    '    // Schwelle nachgerechnet fuer near 0.5 / far 3000: strahlTiefe liefert',
    '    // 1.0 auf dem Clearwert (Himmel) und erst jenseits ~2600 Welteinheiten',
    '    // ueberhaupt 0.93 — jede Geometrie der Karte liegt sicher darunter.',
    '    float himmel = smoothstep( 0.93, 0.999, strahlTiefe( uv ) );',
    '    float hell = smoothstep( uSchwelle.x, uSchwelle.y,',
    '      dot( q, vec3( 0.2126, 0.7152, 0.0722 ) ) );',
    '    summe += q * himmel * hell * gew;',
    '    norm += gew;',
    '    gew *= uDekay;',
    '  }',
    '  // Radialabfall um die Scheibe: ohne ihn wuerde ein durchweg heller',
    '  // Himmel (Nebel-Preset) das ganze Bild gleichmaessig aufhellen, statt',
    '  // Strahlen zu zeichnen.',
    '  float nah = 1.0 - smoothstep( 0.10, 0.85, distance( vUv, uSonneUV ) );',
    '  gl_FragColor = vec4( tex.rgb + summe * uStrahlenFarbe',
    '    * ( uStrahlen * nah / max( norm, 0.0001 ) ), tex.a );',
    '}'
  ].join('\n')
};

/* --- Kantenandeutung (Sobel ueber die Tiefe), Tiefenbaender (F3),
       Palettenbindung (F1), bildraumfeste Malschicht (F2), animiertes Korn
       und Papierkante ------------------------------------------------------

   Tiefenmass: linDepth() liefert fuer eine Weltdistanz d bei near n, far f
   naeherungsweise t = 2d / (d + f), also t = 1 auf dem Clearwert (Himmel).
   Mit f = 3000 heisst das: t 0.14 ≈ 226 Einheiten, t 0.30 ≈ 529, t 0.58 ≈
   1225. Der Szenennebel laeuft von 200 bis 950 — die drei Standardgrenzen
   liegen damit am Nebelanfang, mitten im Nebel und jenseits seines Endes.
   Genau das ist die Vorgabe "Bandgrenzen im Nebel verstecken": ueber der
   ersten Grenze setzt der Nebel gerade ein, die zweite liegt in seinem
   Kern, die dritte dahinter, wo ohnehin alles Nebelfarbe ist. */
const KanteKornShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 640, 1 / 400) },
    // Ein GANZES Bildpixel in UV (uTexel ist ein Texel der HALBaufgeloesten
    // Tiefe, also zwei Bildpixel). Die Bandweichzeichnung braucht das feinere
    // Mass, sonst zieht sie 5 px statt der gewollten 2–3.
    uPixel: { value: new THREE.Vector2(1 / 1280, 1 / 800) },
    uNahFern: { value: new THREE.Vector2(0.5, 3000) },
    uKante: { value: 0.16 },
    uKanteFarbe: { value: new THREE.Color(0x2e2418) },
    uKorn: { value: 0.025 },
    uZeit: { value: 0 },
    // C3 Papierkante: unregelmaessig auslaufender Blattrand. Ergaenzt die
    // Vignette der Graduierung (die weiter aus den Presets kommt und weiter
    // abdunkelt) — hier wird zum Rand hin AUFgehellt, damit das Bild wie auf
    // Papier gemalt endet statt technisch abzublenden.
    uPapier: { value: 0.16 },
    uPapierFarbe: { value: new THREE.Color(0xf6f0e2) },
    // --- F3 Multiplane-Tiefenbaender ------------------------------------
    uMultiStaerke: { value: 0 },
    uMultiGrenzen: { value: new THREE.Vector3(0.14, 0.30, 0.58) },
    uMultiWeite: { value: 0.045 },   // halbe Breite des weichen Uebergangs
    uMultiWeich: { value: 1 },       // Weichzeichnung der hinteren Baender
    uBandSat: { value: new THREE.Vector4(1.10, 1.00, 0.86, 0.80) },
    uBandKon: { value: new THREE.Vector4(1.06, 1.00, 0.90, 0.86) },
    uBandHeb: { value: new THREE.Vector4(-0.010, 0.0, 0.030, 0.045) },
    // --- F1 Palettenbindung ---------------------------------------------
    // tRampe traegt die Palette als 1-Zeilen-DataTexture. Sie ist BEWUSST
    // ohne Farbraum deklariert: der Shader arbeitet an dieser Stelle im
    // Gammaraum, und die Bytes einer Palette (#3c485a …) sind genau die
    // gammakodierten Werte. Eine sRGB-Deklaration wuerde sie in Linear
    // dekodieren und der Gradient-Map die Mitten wegziehen.
    tRampe: { value: null },
    uPaletteStaerke: { value: 0 },
    // x = (n-1)/n, y = 0.5/n — bildet 0..1 auf die Texelmitten 0..n-1 ab,
    // damit LinearFilter + ClampToEdge exakt zwischen den Stuetzstellen
    // interpoliert und die Randfarben nicht halbiert werden.
    uPaletteSkala: { value: new THREE.Vector2(19 / 20, 0.5 / 20) },
    uPaletteStufen: { value: 14 },
    uPaletteQuant: { value: 0.6 },
    // --- F2 bildraumfeste Malschicht -------------------------------------
    tMal: { value: null },
    uMalStaerke: { value: 0 },
    uMalKachel: { value: new THREE.Vector2(4, 2.5) }   // Kacheln pro Bildbreite/-hoehe
  },
  vertexShader: [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',
    '}'
  ].join('\n'),
  fragmentShader: [
    'uniform sampler2D tDiffuse; uniform sampler2D tDepth;',
    'uniform vec2 uTexel; uniform vec2 uPixel; uniform vec2 uNahFern;',
    'uniform float uKante; uniform vec3 uKanteFarbe;',
    'uniform float uKorn; uniform float uZeit;',
    'uniform float uPapier; uniform vec3 uPapierFarbe;',
    'uniform float uMultiStaerke; uniform vec3 uMultiGrenzen;',
    'uniform float uMultiWeite; uniform float uMultiWeich;',
    'uniform vec4 uBandSat; uniform vec4 uBandKon; uniform vec4 uBandHeb;',
    'uniform sampler2D tRampe; uniform float uPaletteStaerke;',
    'uniform vec2 uPaletteSkala; uniform float uPaletteStufen;',
    'uniform float uPaletteQuant;',
    'uniform sampler2D tMal; uniform float uMalStaerke; uniform vec2 uMalKachel;',
    'varying vec2 vUv;',
    'const vec3 LUMA = vec3( 0.2126, 0.7152, 0.0722 );',
    'float linDepth( vec2 uv ) {',
    '  float z = texture2D( tDepth, uv ).x;',
    '  float n = uNahFern.x, f = uNahFern.y;',
    '  return ( 2.0 * n ) / ( f + n - z * ( f - n ) );',
    '}',
    'float korn( vec2 p ) {',
    '  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) + uZeit * 61.7 ) * 43758.5453 );',
    '}',
    '// Ortsfestes Rauschen OHNE uZeit: Papier flimmert nicht.',
    'float papierRauschen( vec2 p ) {',
    '  return fract( sin( dot( p, vec2( 269.5, 183.3 ) ) ) * 43758.5453 );',
    '}',
    '// Geordnetes 4x4-Bayer, geschlossene Form statt Konstantenfeld — dieselbe',
    '// Matrix wie der Ranken-Dither in materials.js:',
    '//    0  8  2 10 / 12  4 14  6 /  3 11  1  9 / 15  7 13  5   (Rueckgabe k/16)',
    '// Rein aus gl_FragCoord, ohne Zeit und ohne Textur, also deterministisch',
    '// und zeitstabil. Das mod(.,4) vorweg haelt das Argument von fract() klein;',
    '// bei Bildkoordinaten um 2000 verloere ein y*y direkt sonst die Aufloesung.',
    'float bayer4( vec2 p ) {',
    '  vec2 q = mod( floor( p ), 4.0 );',
    '  vec2 h = floor( q * 0.5 );',
    '  return fract( h.x * 0.5 + h.y * h.y * 0.75 ) * 0.25',
    '       + fract( q.x * 0.5 + q.y * q.y * 0.75 );',
    '}',
    'void main() {',
    '  vec4 tex = texture2D( tDiffuse, vUv );',
    '  vec3 c = tex.rgb;',
    '  // Sobel ueber die linearisierte Tiefe: Formkanten leicht abdunkeln,',
    '  // in einem warmen Dunkelton — als Linie erkennbar waere zu stark.',
    '  float tl = linDepth( vUv + uTexel * vec2( -1.0,  1.0 ) );',
    '  float  t = linDepth( vUv + uTexel * vec2(  0.0,  1.0 ) );',
    '  float tr = linDepth( vUv + uTexel * vec2(  1.0,  1.0 ) );',
    '  float  l = linDepth( vUv + uTexel * vec2( -1.0,  0.0 ) );',
    '  float  r = linDepth( vUv + uTexel * vec2(  1.0,  0.0 ) );',
    '  float bl = linDepth( vUv + uTexel * vec2( -1.0, -1.0 ) );',
    '  float  b = linDepth( vUv + uTexel * vec2(  0.0, -1.0 ) );',
    '  float br = linDepth( vUv + uTexel * vec2(  1.0, -1.0 ) );',
    '  float gx = ( tr + 2.0 * r + br ) - ( tl + 2.0 * l + bl );',
    '  float gy = ( tl + 2.0 * t + tr ) - ( bl + 2.0 * b + br );',
    '  float mitte = linDepth( vUv );',
    '  float kante = smoothstep( 0.012, 0.06, sqrt( gx * gx + gy * gy ) / max( mitte, 0.02 ) );',
    '  kante *= 1.0 - smoothstep( 0.35, 0.8, mitte );      // in der Ferne ausblenden',
    '  c = mix( c, uKanteFarbe * c, kante * uKante );',
    '  // --- F3 Multiplane: Tiefe in Baender quantisieren ---------------------',
    '  // Ghibli staffelt in Vordergrund / Mittelgrund / Ferne / Himmel, jede',
    '  // Ebene mit eigener Saettigung, eigenem Wertebereich und eigener',
    '  // Kantenschaerfe. Die vier Gewichte w sind ineinandergeschachtelte',
    '  // smoothsteps und summieren sich EXAKT zu 1 (Teleskopsumme), innerhalb',
    '  // eines Bandes bilden sie ein Plateau — genau das unterscheidet die',
    '  // Staffelung vom stufenlosen Nebel. Nur die schmalen Grenzstreifen',
    '  // (± uMultiWeite) blenden ueber; ohne sie saehe man Ringe.',
    '  float bSat = 1.0, bKon = 1.0, bHeb = 0.0;',
    '  if ( uMultiStaerke > 0.0 ) {',
    '    float td = linDepth( vUv );',
    '    float e0 = smoothstep( uMultiGrenzen.x - uMultiWeite, uMultiGrenzen.x + uMultiWeite, td );',
    '    float e1 = smoothstep( uMultiGrenzen.y - uMultiWeite, uMultiGrenzen.y + uMultiWeite, td );',
    '    float e2 = smoothstep( uMultiGrenzen.z - uMultiWeite, uMultiGrenzen.z + uMultiWeite, td );',
    '    vec4 w = vec4( 1.0 - e0, e0 * ( 1.0 - e1 ), e0 * e1 * ( 1.0 - e2 ), e0 * e1 * e2 );',
    '    bSat = mix( 1.0, dot( uBandSat, w ), uMultiStaerke );',
    '    bKon = mix( 1.0, dot( uBandKon, w ), uMultiStaerke );',
    '    bHeb = dot( uBandHeb, w ) * uMultiStaerke;',
    '    // Weichzeichnung der hinteren Baender: vier diagonale Taps ueber knapp',
    '    // 2.5 Bildpixel. Bewusst ein winziger, gleichmaessig gewichteter Kern —',
    '    // das liest sich als weicher Pinsel, nicht als Kamera-Bokeh. Die Taps',
    '    // holen tDiffuse OHNE die Sobel-Kante von oben; dadurch verliert die',
    '    // Ferne zugleich ihre Kantenschaerfe, was Teil der Vorlage ist.',
    '    // Die Abfrage darum ist NICHT uniform (weich haengt an der Tiefe), die',
    '    // Taps sind also formal "nicht-uniformer Kontrollfluss". Unbedenklich:',
    '    // das Composer-Ziel traegt keine Mipmaps, texture2D braucht hier also',
    '    // gar keine Ableitungen. Der Fruehausstieg spart im Vordergrund vier',
    '    // Vollbild-Taps und ist genau deshalb hier und nicht weiter oben.',
    '    float weich = ( w.z * 0.45 + w.w ) * uMultiWeich * uMultiStaerke;',
    '    if ( weich > 0.002 ) {',
    '      vec2 o = uPixel * 2.4;',
    '      vec3 verwischt = ( texture2D( tDiffuse, vUv + vec2(  o.x,  o.y ) ).rgb',
    '                       + texture2D( tDiffuse, vUv + vec2( -o.x,  o.y ) ).rgb',
    '                       + texture2D( tDiffuse, vUv + vec2(  o.x, -o.y ) ).rgb',
    '                       + texture2D( tDiffuse, vUv + vec2( -o.x, -o.y ) ).rgb ) * 0.25;',
    '      c = mix( c, verwischt, min( weich, 1.0 ) * 0.75 );',
    '    }',
    '  }',
    '  // --- F3 (tonal) und F1 Palettenbindung, beide im Gammaraum -----------',
    '  // Derselbe wahrnehmungsnahe Raum wie in der Graduierung. Kontrast um 0.5',
    '  // und eine Luminanzrampe sind nur dort sinnvoll: 0.5 linear ist bereits',
    '  // ein helles Grau, 0.5 im Gammaraum ist die Bildmitte.',
    '  if ( uMultiStaerke > 0.0 || uPaletteStaerke > 0.0 ) {',
    '    vec3 g = pow( max( c, 0.0 ), vec3( 1.0 / 2.2 ) );',
    '    if ( uMultiStaerke > 0.0 ) {',
    '      float lb = dot( g, LUMA );',
    '      // Dasselbe Tor wie in der Graduierung: unter l ≈ 0.10 bleibt alles',
    '      // neutral. Die Saettigungsregel "Mitten rauf, Lichter runter" wird',
    '      // hier NICHT angefasst — bSat ist ein rein tiefenabhaengiger,',
    '      // luminanzunabhaengiger Faktor. Ein gemeinsamer Faktor skaliert die',
    '      // Chroma aller Luminanzen gleich und laesst die vom Grade gesetzte',
    '      // Ordnung (Mitte > Licht) in jedem Band unveraendert bestehen.',
    '      float tor = smoothstep( 0.02, 0.10, lb );',
    '      g = mix( vec3( lb ), g, mix( 1.0, bSat, tor ) );',
    '      g = ( g - vec3( 0.5 ) ) * bKon + vec3( 0.5 + bHeb );',
    '      g = max( g, vec3( 0.0 ) );',
    '    }',
    '    if ( uPaletteStaerke > 0.0 ) {',
    '      float pl = clamp( dot( g, LUMA ), 0.0, 1.0 );',
    '      // Bindungsprofil: Mitten voll, tiefste Tiefen erst ab l ≈ 0.03',
    '      // einblendend und Lichter um bis zu 62 % zurueckgenommen. Ohne das',
    '      // kippen Wolkenraender (Lichter) und Nachtschatten (Tiefen) auf',
    '      // Palettenstufen und das Bild sieht postert.',
    '      float bind = uPaletteStaerke * smoothstep( 0.03, 0.20, pl )',
    '        * ( 1.0 - 0.62 * smoothstep( 0.60, 0.96, pl ) );',
    '      // (a) Gradient-Mapping gegen die Rampe. Die Rampe gibt vor allem den',
    '      //     FARBTON; der Wert kommt zu 55 % aus dem Bild zurueck, sonst',
    '      //     verliert die Form ihre Modellierung und alles wird Fahne.',
    '      vec3 rampe = texture2D( tRampe,',
    '        vec2( pl * uPaletteSkala.x + uPaletteSkala.y, 0.5 ) ).rgb;',
    '      float rl = max( dot( rampe, LUMA ), 0.0001 );',
    '      g = mix( g, rampe * ( mix( rl, pl, 0.55 ) / rl ), bind );',
    '      // (b) Milde Quantisierung mit geordnetem Dither. Der Dither macht',
    '      //     aus harten Stufen eine Mischung benachbarter Toene — genau',
    '      //     der Unterschied zwischen Palette und Poster.',
    '      if ( uPaletteQuant > 0.0 && uPaletteStufen > 1.5 ) {',
    '        float bs = bayer4( gl_FragCoord.xy ) + 1.0 / 32.0;',
    '        vec3 stufig = floor( g * uPaletteStufen + bs ) / uPaletteStufen;',
    '        g = mix( g, stufig, bind * uPaletteQuant );',
    '      }',
    '    }',
    '    c = pow( max( g, 0.0 ), vec3( 2.2 ) );',
    '  }',
    '  // --- F2 bildraumfeste Malschicht --------------------------------------',
    '  // In BILDkoordinaten abgetastet (vUv * Kachelzahl), also schrumpft die',
    '  // Koernung mit der Entfernung NICHT — im Gegensatz zur Aquarellschicht',
    '  // der Materialien, die in Welteinheiten laeuft und in der Ferne',
    '  // verschwindet. Beides existiert nebeneinander: die Welttextur traegt',
    '  // die Materialidentitaet, diese hier den Bildtraeger.',
    '  // Abgrenzung zum Filmkorn zwei Zeilen weiter unten: das Korn ist',
    '  // hochfrequent (ein Pixel) und laeuft mit uZeit, die Malschicht ist',
    '  // niederfrequent (Kachel ~340 px) und STEHT STILL. Nur so lesen sie',
    '  // sich als Papier unter der Farbe plus Filmschicht darueber statt als',
    '  // ein einziges, undefiniertes Rauschen.',
    '  if ( uMalStaerke > 0.0 ) {',
    '    vec3 mal = texture2D( tMal, vUv * uMalKachel ).rgb;',
    '    float traeger = mal.r * 0.50 + mal.g * 0.32 + mal.b * 0.18;   // Mittel ~0.5',
    '    float ml = dot( c, LUMA );',
    '    // Multiplikativ und weich: in den tiefsten Tiefen aus (dort ist keine',
    '    // Farbe, die das Papier tragen koennte), in den Lichtern halbiert',
    '    // (Papierweiss bleibt Papierweiss).',
    '    float tor = smoothstep( 0.015, 0.22, ml ) * ( 1.0 - 0.55 * smoothstep( 0.72, 1.0, ml ) );',
    '    c *= 1.0 + ( traeger - 0.5 ) * 1.8 * uMalStaerke * tor;',
    '    c = max( c, vec3( 0.0 ) );',
    '  }',
    '  // Korn: fein, animiert, in den Tiefen staerker als in den Lichtern',
    '  float lum = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );',
    '  float n = korn( gl_FragCoord.xy * 0.7 );',
    '  c += ( n - 0.5 ) * uKorn * ( 1.25 - min( lum, 1.0 ) );',
    '  // --- C3 Papierkante ---------------------------------------------------',
    '  // Radius wie bei der Vignette (vUv-Abstand, also elliptisch: Ecken frueh,',
    '  // Kantenmitten spaet), aber fransig gestoert. Drei teilerfremde',
    '  // Winkelperioden geben die grosse Unruhe des Blattrands, zwei Rausch-',
    '  // stufen aus gl_FragCoord die Fasern. Alles deterministisch und',
    '  // zeitstabil — keine Textur noetig.',
    '  if ( uPapier > 0.0 ) {',
    '    vec2 pp = vUv - vec2( 0.5 );',
    '    float pw = atan( pp.y, pp.x );',
    '    float wellig = sin( pw *  3.0 + 0.7 ) * 0.013',
    '                 + sin( pw *  7.0 - 1.9 ) * 0.008',
    '                 + sin( pw * 17.0 + 2.6 ) * 0.004;',
    '    float faser = ( papierRauschen( gl_FragCoord.xy * 0.31 ) - 0.5 ) * 0.011',
    '                + ( papierRauschen( gl_FragCoord.xy * 0.07 ) - 0.5 ) * 0.018;',
    '    float rand = smoothstep( 0.44, 0.68, length( pp ) + wellig + faser );',
    '    // Die Aufhellung folgt der oertlichen Helligkeit (lum von oben): auf',
    '    // Papier zeigt sich das Blatt dort, wo Licht darauf faellt. Ohne die',
    '    // Kopplung risse der Rand in der Nacht die dunklen Ecken auf — eine',
    '    // Ecke bei Luminanz 0.02 wuerde sonst um mehr als das Doppelte heller.',
    '    float papierG = rand * uPapier * ( 0.25 + 0.75 * smoothstep( 0.0, 0.35, lum ) );',
    '    c = mix( c, uPapierFarbe, papierG );',
    '    // Feine Koernung, die zum Rand hin zunimmt: die Malschicht laeuft aus.',
    '    c += ( papierRauschen( gl_FragCoord.xy * 1.63 + 11.0 ) - 0.5 )',
    '       * uPapier * 0.09 * rand;',
    '  }',
    '  gl_FragColor = vec4( c, tex.a );',
    '}'
  ].join('\n')
};

function initPipeline(camera) {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,   // fuer den PNG-Export
    powerPreference: 'high-performance',
    alpha: false
  });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // weiches Ausrollen der Lichter
  renderer.toneMappingExposure = 1.12;
  renderer.info.autoReset = false;
  renderer.sortObjects = true;
  document.body.appendChild(renderer.domElement);

  var w = window.innerWidth, h = window.innerHeight;
  var pr = renderer.getPixelRatio();
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
    Math.round(w * pr), Math.round(h * pr), { type: THREE.HalfFloatType, samples: 4 }));
  renderPass = new RenderPass(scene, camera);
  // Bloom-Startwerte gelten nur bis zum ersten setLook — die Tageszeit-Presets
  // (atmosphere.js) ueberschreiben Staerke/Radius/Schwelle ab dem ersten
  // applyTod. Schwelle 0.9 statt frueher 0.88: der Bloom bleibt schwach mit
  // hoher Schwelle, auch im kurzen Fenster vor dem ersten Preset faellt sie
  // nicht unter die ~0.9-Untergrenze (Preset-Minimum ist abend mit 0.92).
  bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.7, 0.9);
  strahlenPass = new ShaderPass(StrahlenShader);
  // Aus, bis ein Preset `strahlen` liefert. Ein abgeschalteter Pass wird vom
  // EffectComposer vollstaendig uebersprungen (er setzt renderToScreen selbst
  // auf den letzten AKTIVEN Pass) — der Nachtzustand kostet damit nichts.
  strahlenPass.enabled = false;
  gradePass = new ShaderPass(GradeShader);
  kantePass = new ShaderPass(KanteKornShader);
  outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(strahlenPass);
  composer.addPass(gradePass);
  composer.addPass(kantePass);
  composer.addPass(outputPass);

  // Tiefen-Prepass in halber Aufloesung: fuer die nur angedeutete Kante reicht
  // das und viertelt die Fragmentarbeit. Die Szene laeuft dabei nicht mit
  // echtem Shading, sondern mit getauschten Depth-Materialien (s. prepassAn).
  depthRT = new THREE.WebGLRenderTarget(Math.round(w / 2), Math.round(h / 2), {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter
  });
  depthRT.depthTexture = new THREE.DepthTexture(Math.round(w / 2), Math.round(h / 2));
  kantePass.uniforms.tDepth.value = depthRT.depthTexture;
  kantePass.uniforms.uTexel.value.set(2 / w, 2 / h);
  kantePass.uniforms.uNahFern.value.set(camera.near, camera.far);
  // C1: dieselbe Tiefentextur traegt die Himmelsmaske der Strahlen.
  strahlenPass.uniforms.tDepth.value = depthRT.depthTexture;
  strahlenPass.uniforms.uNahFern.value.set(camera.near, camera.far);
  // C2/C3 leben in JS-Zustand (s. u.) und werden hier einmalig in die frisch
  // gebauten Passes geschrieben — so darf eine Karte ihr Farbskript auch vor
  // initPipeline setzen, ohne dass es verloren geht.
  bildmasse(w, h);
  wendeBildlookAn();
  return renderer;
}

function resizePipeline(camera) {
  var w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.setSize(w, h);
  depthRT.setSize(Math.round(w / 2), Math.round(h / 2));
  kantePass.uniforms.uTexel.value.set(2 / w, 2 / h);
  kantePass.uniforms.uNahFern.value.set(camera.near, camera.far);
  strahlenPass.uniforms.uNahFern.value.set(camera.near, camera.far);
  bildmasse(w, h);
}

/* Bildgroesse in CSS-Pixeln merken und die davon abhaengigen Uniforms setzen.
   uPixel und die Kachelzahl der Malschicht muessen bei jedem Resize neu
   gerechnet werden, sonst waechst bzw. schrumpft die Malschicht mit dem
   Fenster — sie soll aber eine feste Groesse AUF DEM BILD haben. */
var bildW = 0, bildH = 0;
function bildmasse(w, h) {
  bildW = w; bildH = h;
  if (!kantePass) return;
  kantePass.uniforms.uPixel.value.set(1 / w, 1 / h);
  kantePass.uniforms.uMalKachel.value.set(w / malschicht.kachel, h / malschicht.kachel);
}

/* --- C1: Zustand der Strahlen zwischen setLook und renderFrame ------------
   sonneDir ist die vom Preset geblendete Sonnen-/Mondrichtung (dieselbe, die
   atmosphere.js an setSonnenDir/setSonne gibt). Fehlt sie im look-Objekt,
   bleibt der Startwert stehen — die Strahlen sind dann ohnehin aus, weil auch
   `strahlen` fehlt. */
var sonneDir = new THREE.Vector3(0.45, 0.72, 0.35).normalize();
var strahlenStaerke = 0;
var _sonnePkt = new THREE.Vector3(), _blick = new THREE.Vector3();

/** Look-Parameter aus dem Tageszeit-Preset. Alle in dieser Runde neuen Felder
 *  (`strahlen`, `sonneDir`, `strahlenFarbe`, `strahlenSchwelle`) werden
 *  TOLERANT gelesen: fehlen sie, bleibt alles beim Alten und die Strahlen
 *  sind aus. */
function setLook(look) {
  renderer.toneMappingExposure = look.belichtung;
  bloomPass.strength = look.bloom.staerke;
  bloomPass.radius = look.bloom.radius;
  bloomPass.threshold = look.bloom.schwelle;
  var g = look.grade;
  gradePass.uniforms.uLift.value.set(g.lift[0], g.lift[1], g.lift[2]);
  gradePass.uniforms.uGamma.value.set(g.gamma[0], g.gamma[1], g.gamma[2]);
  gradePass.uniforms.uGain.value.set(g.gain[0], g.gain[1], g.gain[2]);
  gradePass.uniforms.uSatMitte.value = g.satMitte;
  gradePass.uniforms.uSatLicht.value = g.satLicht;
  gradePass.uniforms.uSchwarz.value = g.schwarz;
  gradePass.uniforms.uVignette.value = g.vignette;
  if (look.horizont) {
    renderer.setClearColor(look.horizont, 1);
    // C4: dieselbe Farbe speist die gemalten Himmelsstreifen im Wasser.
    // look.horizont ist bereits ein Farbobjekt im Arbeitsfarbraum (fogMittel),
    // .set() kopiert es ohne erneute Konversion.
    terraUniforms.uHorizont.value.set(look.horizont);
  }
  // C1 Godrays: Staerke je Tageszeit (Richtwerte morgen 0.35, mittag 0.12,
  // abend 0.5, nebel 0.25, nacht 0.0 — nachts strahlen die Ranken).
  strahlenStaerke = (typeof look.strahlen === 'number' && look.strahlen > 0)
    ? look.strahlen : 0;
  var sd = look.sonneDir;
  if (sd) {
    if (Array.isArray(sd)) sonneDir.set(sd[0], sd[1], sd[2]);
    else sonneDir.set(sd.x, sd.y, sd.z);
    if (sonneDir.lengthSq() > 1e-8) sonneDir.normalize();
  }
  if (look.strahlenFarbe !== undefined && look.strahlenFarbe !== null)
    strahlenPass.uniforms.uStrahlenFarbe.value.set(look.strahlenFarbe);
  var ss = look.strahlenSchwelle;
  if (Array.isArray(ss)) strahlenPass.uniforms.uSchwelle.value.set(ss[0], ss[1]);
  // Die Papierkante (C3) wird hier BEWUSST nicht gelesen: sie gehoert zur
  // Karte, nicht zur Tageszeit. Zwei Quellen fuer denselben Uniform-Wert
  // hiessen, dass jedes applyTod eine Kartenangabe ueberschriebe.
}

/* --- C2/C3: Bildlook der KARTE (nicht der Tageszeit) ---------------------
   Beide Werte gehoeren ins Kartenformat, nicht in die Presets. Sie leben
   deshalb als JS-Zustand und werden von wendeBildlookAn() in die Uniforms
   geschoben — dieselbe Funktion laeuft am Ende von initPipeline, damit ein
   frueh gesetztes Farbskript einen spaeteren Pipelinebau ueberlebt. */
var farbskript = { licht: new THREE.Color(0xffffff), mitte: new THREE.Color(0xffffff),
  schatten: new THREE.Color(0xffffff), staerke: 0 };
var papierStaerke = 0.16;

/* --- F1/F2/F3: Bildlook der KARTE, zweite Staffel -------------------------
   Gleiche Bauart wie C2/C3 darueber: JS-Zustand, den wendeBildlookAn() in die
   Uniforms schiebt. Alle drei Staerken stehen auf 0 — ohne Setteraufruf ist
   das Bild byteidentisch zum Stand vor dieser Runde.

   Zur F2-Vorgabe "Default dezent": der dezente Richtwert ist MAL_DEZENT
   (0.12); als DEFAULT steht trotzdem 0, weil Byteidentitaet ohne Aufruf die
   verbindlichere Zusage ist. Eine Karte oder ein Preset, das die Malschicht
   will, ruft setMalschicht(0.12). */
const MAL_DEZENT = 0.12;

/* Standardrampe (F1): 20 Stuetzstellen, entsaettigt, Kalt→Warm ueber die
   Luminanz — tiefe Toene blaeulich, Lichter cremig. Das ist dieselbe
   Kalt-Warm-Achse, die Lift (blaeulich) und Gain (waermer) der Graduierung
   schon aufspannen; die Rampe macht daraus eine BEGRENZTE Menge von Toenen.

   Wie eine spaetere Rampe "aus der Karte abgeleitet" aussaehe (bewusst NICHT
   gebaut, weil teuer):
     1. Nach einem Frame einmalig renderer.readRenderTargetPixels() auf ein
        auf ~64x40 herabskaliertes Ziel — ein GPU→CPU-Readback stallt die
        Pipeline, also genau einmal auf Knopfdruck, nie pro Frame.
     2. Median-Cut oder k-Means (k = 21..24) ueber die gelesenen Pixel.
     3. Cluster nach Luminanz sortieren und, weil das Ergebnis fleckig ist,
        ueber drei Nachbarn glaetten.
     4. setPalette(clusterHexArray, staerke).
   Biome und Tageszeiten koennten so je eine eigene Rampe mitbringen; der
   Setter ist genau dafuer zur Laufzeit offen. */
const PALETTE_STANDARD = [
  0x1a2130, 0x212a3a, 0x293345, 0x323d50, 0x3c485a,
  0x475364, 0x535f6c, 0x606b74, 0x6d777b, 0x7a8382,
  0x878e88, 0x94988d, 0xa1a292, 0xaeac97, 0xbab69d,
  0xc6c0a4, 0xd2caac, 0xdcd4b6, 0xe6dfc3, 0xf0ead4
];

var palette = { farben: PALETTE_STANDARD.slice(), n: PALETTE_STANDARD.length,
  staerke: 0, stufen: 14, quant: 0.6 };
var rampeTex = null;
var malschicht = { staerke: 0, kachel: 340 };   // kachel in Bildpixeln
var multiplane = {
  staerke: 0,
  grenzen: [0.14, 0.30, 0.58],   // s. Kopfkommentar des Kante-Passes
  weite: 0.045,
  weich: 1,
  // Vordergrund satter/kontrastreicher, Ferne flauer und leicht aufgehellt.
  baender: [
    { sat: 1.10, kontrast: 1.06, hebung: -0.010 },
    { sat: 1.00, kontrast: 1.00, hebung: 0.000 },
    { sat: 0.86, kontrast: 0.90, hebung: 0.030 },
    { sat: 0.80, kontrast: 0.86, hebung: 0.045 }
  ]
};

var _rampeFarbe = new THREE.Color();

/* Palettenfarbe → gammakodierte Bytes. Die Rampentextur wird OHNE Farbraum
   deklariert, der Shader liest also genau diese Bytes /255 und arbeitet damit
   im selben Gammaraum wie die Graduierung. Ein Hexwert, den jemand als Palette
   hinschreibt (#3c485a), IST bereits dieser gammakodierte Wert — deshalb der
   Rundlauf ueber THREE.Color mit explizitem SRGBColorSpace in beide
   Richtungen: er ist wertneutral, akzeptiert aber zusaetzlich CSS-Strings,
   [r,g,b]-Tripel und THREE.Color. */
function rampenBytes(wert, daten, k) {
  if (Array.isArray(wert)) _rampeFarbe.setRGB(wert[0], wert[1], wert[2], THREE.SRGBColorSpace);
  else _rampeFarbe.set(wert);
  var hex = _rampeFarbe.getHex(THREE.SRGBColorSpace);
  daten[k] = (hex >> 16) & 255;
  daten[k + 1] = (hex >> 8) & 255;
  daten[k + 2] = hex & 255;
  daten[k + 3] = 255;
  return hex;
}

/** Baut die 1-Zeilen-Rampentextur aus einem Farb-Array (2..64 Stuetzstellen).
 *  LinearFilter + ClampToEdge: zwischen den Stuetzstellen wird interpoliert,
 *  ausserhalb bleibt die Randfarbe stehen. */
function rampeBauen(farben) {
  var n = Math.max(2, Math.min(64, farben.length));
  var daten = new Uint8Array(n * 4), hexe = [];
  for (var i = 0; i < n; i++) hexe.push(rampenBytes(farben[i], daten, i * 4));
  var t = new THREE.DataTexture(daten, n, 1, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  if (rampeTex) rampeTex.dispose();
  rampeTex = t;
  palette.farben = hexe;
  palette.n = n;
}
rampeBauen(PALETTE_STANDARD);

function wendeBildlookAn() {
  if (gradePass) {
    var u = gradePass.uniforms;
    u.uSkriptLicht.value.copy(farbskript.licht);
    u.uSkriptMitte.value.copy(farbskript.mitte);
    u.uSkriptSchatten.value.copy(farbskript.schatten);
    u.uSkriptStaerke.value = farbskript.staerke;
  }
  if (!kantePass) return;
  var k = kantePass.uniforms;
  k.uPapier.value = papierStaerke;
  // F1
  k.tRampe.value = rampeTex;
  k.uPaletteStaerke.value = palette.staerke;
  k.uPaletteSkala.value.set((palette.n - 1) / palette.n, 0.5 / palette.n);
  k.uPaletteStufen.value = palette.stufen;
  k.uPaletteQuant.value = palette.quant;
  // F2 — TEX.malschicht existiert seit dem Modulstart von textures.js.
  k.tMal.value = TEX.malschicht || null;
  k.uMalStaerke.value = malschicht.staerke;
  if (bildW > 0) k.uMalKachel.value.set(bildW / malschicht.kachel, bildH / malschicht.kachel);
  // F3
  var m = multiplane, b = m.baender;
  k.uMultiStaerke.value = m.staerke;
  k.uMultiGrenzen.value.set(m.grenzen[0], m.grenzen[1], m.grenzen[2]);
  k.uMultiWeite.value = m.weite;
  k.uMultiWeich.value = m.weich;
  k.uBandSat.value.set(b[0].sat, b[1].sat, b[2].sat, b[3].sat);
  k.uBandKon.value.set(b[0].kontrast, b[1].kontrast, b[2].kontrast, b[3].kontrast);
  k.uBandHeb.value.set(b[0].hebung, b[1].hebung, b[2].hebung, b[3].hebung);
}

function farbeIn(ziel, wert, standard) {
  if (wert === undefined || wert === null) { ziel.set(standard); return; }
  if (Array.isArray(wert)) ziel.setRGB(wert[0], wert[1], wert[2]);
  else ziel.set(wert);
}

/**
 * C2 — Farbskript der Karte: { licht, mitte, schatten, staerke }.
 * Farben als Hex-Zahl, CSS-String, [r,g,b] (0..1) oder THREE.Color; fehlende
 * Felder fallen auf Weiss zurueck. staerke 0 (Default, auch bei fehlendem
 * oder ungueltigem Wert) schaltet den Zweig komplett ab — ohne Aufruf ist
 * das Bild byteidentisch zum Stand vor dieser Runde.
 */
function setFarbskript(cfg) {
  if (!cfg) { farbskript.staerke = 0; wendeBildlookAn(); return; }
  farbeIn(farbskript.licht, cfg.licht, 0xffffff);
  farbeIn(farbskript.mitte, cfg.mitte, 0xffffff);
  farbeIn(farbskript.schatten, cfg.schatten, 0xffffff);
  var s = cfg.staerke;
  farbskript.staerke = (typeof s === 'number' && s > 0) ? Math.min(s, 1) : 0;
  wendeBildlookAn();
}

/** Gegenstueck fuer das Kartenformat (io.js schreibt das Ergebnis mit). */
function getFarbskript() {
  return {
    licht: farbskript.licht.getHex(),
    mitte: farbskript.mitte.getHex(),
    schatten: farbskript.schatten.getHex(),
    staerke: farbskript.staerke
  };
}

/** C3 — Staerke der Papierkante (0 = aus, Default 0.16). */
function setPapierkante(staerke) {
  papierStaerke = (typeof staerke === 'number' && staerke > 0) ? staerke : 0;
  wendeBildlookAn();
}
function getPapierkante() { return papierStaerke; }

/* --- F1/F2/F3: oeffentliche Regler --------------------------------------- */

/** Zahl lesen, klemmen; alles Nicht-Endliche faellt auf `standard` zurueck. */
function zahl(wert, min, max, standard) {
  if (typeof wert !== 'number' || !isFinite(wert)) return standard;
  return wert < min ? min : (wert > max ? max : wert);
}

/**
 * F1 — Palettenbindung.
 * @param farben  Array aus 2..64 Farben (Hex-Zahl, CSS-String, [r,g,b] 0..1
 *                oder THREE.Color), aufsteigend nach Helligkeit gemeint.
 *                Fehlt es oder ist es zu kurz, bleibt die bisherige Rampe.
 * @param staerke 0..1. 0 (Default, auch bei fehlendem Wert) schaltet den
 *                Zweig ganz ab — das Bild ist dann byteidentisch.
 * @param opt     optional { stufen, quant } zum Feinabgleich der milden
 *                Quantisierung: `stufen` = Helligkeitsstufen je Kanal
 *                (2..64, Default 14), `quant` = Anteil der Quantisierung an
 *                der Bindung (0..1, Default 0.6).
 * Sinnvoller Einsatz: 16–32 Stuetzstellen, staerke 0.25–0.45. Darueber wird
 * es Cel — die Lichter- und Tiefendaempfung im Shader haelt das lange auf,
 * aber nicht beliebig.
 */
function setPalette(farben, staerke, opt) {
  if (Array.isArray(farben) && farben.length >= 2) rampeBauen(farben);
  palette.staerke = zahl(staerke, 0, 1, 0);
  if (opt) {
    palette.stufen = Math.round(zahl(opt.stufen, 2, 64, palette.stufen));
    palette.quant = zahl(opt.quant, 0, 1, palette.quant);
  }
  wendeBildlookAn();
}

/** Gegenstueck fuer das Kartenformat: Farben immer als Hex-Zahlen. */
function getPalette() {
  return { farben: palette.farben.slice(), staerke: palette.staerke,
    stufen: palette.stufen, quant: palette.quant };
}

/**
 * F2 — bildraumfeste Malschicht. Argument: Zahl (= Staerke) oder
 * { staerke, kachel }. `kachel` ist die Kantenlaenge der Struktur in
 * Bildpixeln (64..2048, Default 340) — GROESSER heisst groebere Pinselzuege,
 * und weil sie in Bildkoordinaten liegt, bleibt sie in der Ferne genauso
 * grob wie im Vordergrund. Dezenter Richtwert: 0.12.
 */
function setMalschicht(cfg) {
  if (typeof cfg === 'number' || cfg === undefined || cfg === null) {
    malschicht.staerke = zahl(cfg, 0, 1, 0);
  } else {
    malschicht.staerke = zahl(cfg.staerke, 0, 1, 0);
    malschicht.kachel = zahl(cfg.kachel, 64, 2048, malschicht.kachel);
  }
  wendeBildlookAn();
}
function getMalschicht() {
  return { staerke: malschicht.staerke, kachel: malschicht.kachel };
}

/**
 * F3 — Multiplane-Tiefenbaender. Argument: Zahl (= Staerke) oder
 * { staerke, grenzen:[a,b,c], weite, weich, baender:[4x{sat,kontrast,hebung}] }.
 * grenzen sind normierte Tiefen (t = 2d/(d+far), s. Kopfkommentar des
 * Kante-Passes), muessen aufsteigen und werden hier sortiert und mit
 * Mindestabstand auseinandergehalten — sonst kaeme ein Band mit Gewicht 0
 * heraus und die Weichzeichnung spraenge. `weite` ist die halbe Breite des
 * weichen Uebergangs (0.005..0.2): gross genug, damit die Grenze im Nebel
 * verschwindet, klein genug, damit die Baender Plateaus bleiben.
 */
function setMultiplane(cfg) {
  if (typeof cfg === 'number' || cfg === undefined || cfg === null) {
    multiplane.staerke = zahl(cfg, 0, 1, 0);
    wendeBildlookAn();
    return;
  }
  multiplane.staerke = zahl(cfg.staerke, 0, 1, 0);
  multiplane.weite = zahl(cfg.weite, 0.005, 0.2, multiplane.weite);
  multiplane.weich = zahl(cfg.weich, 0, 1, multiplane.weich);
  if (Array.isArray(cfg.grenzen) && cfg.grenzen.length === 3) {
    var g = [zahl(cfg.grenzen[0], 0.01, 0.99, multiplane.grenzen[0]),
             zahl(cfg.grenzen[1], 0.01, 0.99, multiplane.grenzen[1]),
             zahl(cfg.grenzen[2], 0.01, 0.99, multiplane.grenzen[2])];
    g.sort(function (a, b) { return a - b; });
    if (g[1] < g[0] + 0.02) g[1] = g[0] + 0.02;
    if (g[2] < g[1] + 0.02) g[2] = g[1] + 0.02;
    multiplane.grenzen = g;
  }
  if (Array.isArray(cfg.baender) && cfg.baender.length === 4) {
    for (var i = 0; i < 4; i++) {
      var q = cfg.baender[i] || {}, z = multiplane.baender[i];
      z.sat = zahl(q.sat, 0, 2, z.sat);
      z.kontrast = zahl(q.kontrast, 0.25, 2, z.kontrast);
      z.hebung = zahl(q.hebung, -0.5, 0.5, z.hebung);
    }
  }
  wendeBildlookAn();
}
function getMultiplane() {
  var b = [];
  for (var i = 0; i < 4; i++)
    b.push({ sat: multiplane.baender[i].sat, kontrast: multiplane.baender[i].kontrast,
      hebung: multiplane.baender[i].hebung });
  return { staerke: multiplane.staerke, grenzen: multiplane.grenzen.slice(),
    weite: multiplane.weite, weich: multiplane.weich, baender: b };
}

function setPost(an) { postAn = !!an; }
function getPost() { return postAn; }

/* --- Depth-only-Prepass: Materialtausch statt zweitem Voll-Rendering -----
   Frueher lief hier die komplette Szene mit echten Materialien durch den
   Fragment-Shader (Phong, Nebel, Aquarell-Malschicht), obwohl niemand die
   Farbausgabe des depthRT liest — nur der Z-Buffer zaehlt. Der Tausch auf
   MeshDepthMaterial spart diesen kompletten Shading-Durchlauf. Objekte ohne
   depthWrite (Himmel, Sonne, Wolken, Wasser, Rauch, Kontaktschatten, Pfade)
   trugen schon bisher keine Tiefe bei; sie werden jetzt ganz ausgeblendet,
   was zusaetzlich ihre Draw Calls spart. Der Prepass kostet damit nur noch
   einen reinen Tiefen-Durchlauf der depth-schreibenden Meshes in halber
   Aufloesung statt eines vollen Shading-Durchlaufs der ganzen Szene.

   Warum kein scene.overrideMaterial: ein einzelnes Override kann keine
   per-Material-Alphakarten tragen — Gras, Kronenkarten und Blumen
   (map + alphaTest) schrieben dann volle Quads in die Tiefe, und der Sobel
   zeichnete Kanten um unsichtbare Quad-Raender. Der Tausch pro Objekt
   erlaubt fuer genau diese Materialien einmalig erzeugte Depth-Klone mit
   map/alphaTest, der Rest teilt sich ein Depth-Material pro side.

   Warum nicht die Tiefe des Composer-Targets wiederverwenden: das Target
   rendert mit samples:4, und eine MSAA-Tiefe muss vor dem Sampeln aufgeloest
   werden — ob die gepinnte CDN-Version von three das beim Blit zuverlaessig
   tut, ist ohne lokale Quelle nicht verifizierbar; zudem haengt von der
   needsSwap-Paritaet der Passkette ab, welcher Ping-Pong-Puffer den
   RenderPass empfaengt. Zu viele Annahmen — der explizite Prepass bleibt,
   wird aber billig.

   Bewusste Abweichungen (halbe Aufloesung, Fern-Ausblendung und die nur
   andeutende Kantenstaerke verzeihen beides):
   - Wind: die Depth-Klone kennen den Vertex-Wind-Patch der Originale nicht,
     die Silhouette im Tiefenbild ruht also, waehrend das Farbbild schwankt
     (Boeenspitze grob 0.4 Welteinheiten). Den Patch mitzuschleppen hiesse,
     die Amplitude aus dem Programm-Cache-Key des Originals zu parsen — zu
     fragil fuer den Gewinn.
   - Ranken: ihr Bayer-Discard fehlt im Tiefenbild, die Silhouette steht dort
     voll. Vorher lieferte der halbaufgeloeste Dither dem Sobel verrauschte
     Gradienten in der Fade-Zone — die ruhige volle Silhouette ist das
     kleinere Uebel. */
var prepassSolidMats = {};        // ein geteiltes Depth-Material je side: mit
                                  // stur FrontSide risse DoubleSide-Blattwerk
                                  // Tiefenloecher, wo Rueckseiten sichtbar sind
var prepassMaskMats = new Map();  // Original → Depth-Klon; Pool-Materialien
                                  // leben die ganze Sitzung, die Map bleibt klein
var prepassObj = [], prepassMatAlt = [], prepassVersteckt = [];

function prepassAn() {
  scene.traverse(function (o) {
    // Nur wirklich Sichtbares anfassen — sonst wuerde die Ruecknahme
    // urspruenglich Unsichtbares einschalten.
    if (o.visible !== true) return;
    var m = o.material;
    if (!m) return;
    // Mehrfachmaterialien kommen hier nicht vor; falls doch, rendern sie
    // unveraendert weiter — das entspricht exakt dem alten Prepass.
    if (Array.isArray(m)) return;
    if (m.depthWrite === false) {
      // Schrieb noch nie Tiefe → der Draw Call ist im Prepass reine Kost.
      o.visible = false; prepassVersteckt.push(o); return;
    }
    // Linien/Punkte/Sprites: MeshDepthMaterial passt nicht zu ihrem
    // Primitivtyp; ihr echtes Material kostet bei der Groesse kaum etwas.
    if (!o.isMesh) return;
    prepassObj.push(o); prepassMatAlt.push(m);
    if (m.alphaTest > 0 && (m.map || m.alphaMap)) {
      var d = prepassMaskMats.get(m);
      if (!d) {
        d = new THREE.MeshDepthMaterial({
          map: m.map || null, alphaMap: m.alphaMap || null,
          alphaTest: m.alphaTest, side: m.side
        });
        prepassMaskMats.set(m, d);
      }
      o.material = d;
    } else {
      o.material = prepassSolidMats[m.side] ||
        (prepassSolidMats[m.side] = new THREE.MeshDepthMaterial({ side: m.side }));
    }
  });
}

function prepassAus() {
  for (var i = 0; i < prepassObj.length; i++) prepassObj[i].material = prepassMatAlt[i];
  for (var h = 0; h < prepassVersteckt.length; h++) prepassVersteckt[h].visible = true;
  // Arrays leeren statt neu anlegen — laeuft jedes Frame, der GC dankt.
  prepassObj.length = 0; prepassMatAlt.length = 0; prepassVersteckt.length = 0;
}

/* --- C1: Bildort der Scheibe und Gesamtstaerke je Frame -------------------
   Die Himmelsgruppe folgt der Kamera, die Scheibe sitzt also immer bei
   Kameraposition + sonneDir * 1350 (sky.js). Projiziert ergibt das den
   Fluchtpunkt der Strahlen.

   Zwei Ausblendungen:
   - Sonne HINTER der Kamera: `vorn` (Blickrichtung · Sonnenrichtung) faellt
     unter null, die Projektion kippte dann auf die gegenueberliegende
     Bildseite und die Strahlen liefen falsch herum. Die Blende schliesst
     schon ab vorn < 0.30 vollstaendig, also lange bevor das passieren kann.
   - Sonne weit ausserhalb des Bildes: der Radialabfall traefe nur noch den
     Bildrand, uebrig bliebe ein einseitiger Schleier. */
function strahlenVorbereiten(camera) {
  var amt = strahlenStaerke;
  if (amt > 0) {
    camera.getWorldDirection(_blick);
    amt *= sanft(0.02, 0.30, _blick.dot(sonneDir));
  }
  if (amt > 0) {
    _sonnePkt.copy(camera.position).addScaledVector(sonneDir, 1350).project(camera);
    amt *= 1 - sanft(1.0, 2.2, Math.max(Math.abs(_sonnePkt.x), Math.abs(_sonnePkt.y)));
    strahlenPass.uniforms.uSonneUV.value.set(_sonnePkt.x * 0.5 + 0.5, _sonnePkt.y * 0.5 + 0.5);
    strahlenPass.uniforms.uStrahlen.value = amt;
  }
  strahlenPass.enabled = amt > 0.0005;
}

/** Ein Frame: Depth-only-Prepass (bei aktiver Post), dann Composer oder Direktbild. */
function renderFrame(camera, zeit) {
  renderer.info.reset();
  if (postAn) {
    kantePass.uniforms.uZeit.value = zeit % 61;
    strahlenVorbereiten(camera);
    prepassAn();
    renderer.setRenderTarget(depthRT);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    prepassAus();               // vor dem Composer: der braucht die echten Materialien
    composer.render();
  } else {
    renderer.render(scene, camera);
  }
  infoCalls = renderer.info.render.calls;
  infoTris = renderer.info.render.triangles;
}

function getRenderInfo() { return { calls: infoCalls, triangles: infoTris }; }

/** PNG-Export: liefert das fertig komponierte Bild (inkl. Bloom, Grade, Korn). */
function exportPNG(name) {
  var url = renderer.domElement.toDataURL('image/png');
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function getRenderer() { return renderer; }

export { initPipeline, resizePipeline, setLook, setPost, getPost, renderFrame,
  getRenderInfo, exportPNG, getRenderer,
  setFarbskript, getFarbskript, setPapierkante, getPapierkante,
  setPalette, getPalette, setMalschicht, getMalschicht,
  setMultiplane, getMultiplane, PALETTE_STANDARD, MAL_DEZENT };
