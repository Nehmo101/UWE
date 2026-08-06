// Render-Pipeline: Renderer, EffectComposer (Render → Bloom → Strahlen →
// Graduierung → Kante/Baender/Palette/weiche Papierkante →
// OutputPass) plus ein halbaufgeloester Depth-only-Prepass, der die
// Kantenandeutung, die Himmelsmaske der Godrays UND die Tiefenbaender speist.
// Der OutputPass steht zwingend am Ende — er erledigt Tone Mapping und
// Farbraumkonversion.
//
// Warum F1/F3 (Ideenwelle 2) im vorhandenen Kante-Pass sitzen und nicht in
// eigenen Passes:
//   (1) Sie brauchen genau das, was dieser Pass schon hat — die
//       halbaufgeloeste Tiefentextur, uNahFern und die Texelgroesse. Ein
//       eigener Pass muesste dieselben Uniforms noch einmal fuehren.
//   (2) Jeder zusaetzliche ShaderPass ist ein voller Ping-Pong-Durchgang ueber
//       ein HalfFloat-Target in Bildschirmgroesse. Drei davon kosten mehr
//       Bandbreite als die gesamte Rechnung, die sie tragen sollen.
//   (3) Die Reihenfolge im Pass bildet die Malerei ab:
//       Kante → Tiefenbaender (F3) → weich interpolierte Palettenbindung (F1)
//       → Papierkante. Es liegt bewusst keine bildschirmfeste Textur und kein
//       Dither ueber dem Pigment; die Aquarellstruktur bleibt materiallokal.
// Beide Zweige sind uniform-kohaerent mit Staerke 0 abgeschaltet; ohne
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
import { setzeTexturAnisotropie } from './textures.js';
import { berechneRenderMasse } from './render-masse.js';
import { erzeugeLeistungsRegler } from './leistungsregler.js';

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfe8f0, 200, 950);

let renderer = null, composer = null, bloomPass = null, gradePass = null,
    kantePass = null, outputPass = null, renderPass = null, strahlenPass = null,
    aaPass = null;
let depthRT = null;
let postAn = true;
/* Staerke der Kantenglaettung (0 = Pass ganz aus). Lebt als JS-Zustand, damit
   ein Aufruf VOR initPipeline nicht verloren geht — dieselbe Bauart wie beim
   Farbskript und der Papierkante. */
let aaStaerke = 1;
let infoCalls = 0, infoTris = 0;
/* Adaptive Renderskala: der Leistungsregler (reine Logik, eigener Test)
   beobachtet die Bildzeit; hier wird seine Skala auf Renderer, Composer und
   Tiefenziel angewandt. kameraRef braucht der Groessenwechsel ausserhalb des
   window-resize-Ereignisses. */
let leistung = erzeugeLeistungsRegler();
let renderSkala = 1;
let kameraRef = null;

/* Texelgroesse der Kantenglaettung. Sie arbeitet auf dem PHYSISCHEN Raster
   (logische Groesse mal Pixelverhaeltnis) — auf einem Retina-Schirm ist ein
   Bildpunkt des Composer-Ziels halb so gross wie ein CSS-Pixel, und ein
   Filter, der um einen CSS-Pixel abtastet, uebersaehe die Treppe genau dort,
   wo sie noch sichtbar ist. */
function setzeAaTexel(w, h, pixelRatio) {
  if (!aaPass) return;
  var pw = Math.max(1, Math.round(w * pixelRatio));
  var ph = Math.max(1, Math.round(h * pixelRatio));
  aaPass.uniforms.uTexelAA.value.set(1 / pw, 1 / ph);
}

/**
 * Staerke der Kantenglaettung, 0..1. 0 schaltet den Pass ganz ab (der
 * EffectComposer ueberspringt ihn dann vollstaendig und setzt renderToScreen
 * wieder auf den OutputPass) — das Bild ist damit exakt das vor dieser Runde.
 */
function setKantenglaettung(staerke) {
  aaStaerke = (typeof staerke === 'number' && staerke > 0) ? Math.min(staerke, 1) : 0;
  if (!aaPass) return;
  aaPass.uniforms.uStaerke.value = aaStaerke;
  aaPass.enabled = aaStaerke > 0;
}
function getKantenglaettung() { return aaStaerke; }

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
    /* Tonwertumfang. Lift/Gamma/Gain koennen alles ausser dem einen, was
       hier gebraucht wird: eine Spreizung UM die Bildmitte. Gain hebt die
       Lichter und die Tiefen gemeinsam, Gamma verschiebt die ganze Kurve.
       Gemessen gegen die Referenzbilder (tools/terra-shots/bildwerte.mjs)
       lag terra bei p05 0.163 / p95 0.664, die Vorbilder bei 0.10-0.14 /
       0.65-0.77 — terra benutzte also nur die MITTE des Umfangs, in beide
       Richtungen zu wenig. Genau das ist der Befund "das Bild hat keine
       Tiefen".

       KEIN linearer Kontrast um einen Drehpunkt: der wurde ausprobiert und
       gemessen wieder verworfen. Er spreizt die Mitte richtig, schneidet
       aber beide Enden ab — die Schildkroete kam auf p05 0.003 (Tiefen
       zugelaufen), die Kueste auf 24.6 % ueber Luminanz 0.85 (Lichter
       ausgebrannt), beides ausserhalb JEDES Referenzbildes.
       Stattdessen eine Blende zwischen der Geraden und einer S-Kurve mit
       FESTEN Endpunkten (smoothstep): die Mitte bekommt ihre Steilheit, die
       Enden rollen aus statt zu klippen. uKontrast ist der Blendanteil,
       0 (Default) ist die Identitaet — ohne Preset-Wert bleibt das Bild
       byteidentisch. */
    uKontrast: { value: 0 },
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
    'uniform float uKontrast;',
    'uniform float uSchwarz; uniform float uVignette;',
    'uniform vec3 uSkriptLicht; uniform vec3 uSkriptMitte; uniform vec3 uSkriptSchatten;',
    'uniform float uSkriptStaerke;',
    'varying vec2 vUv;',
    'void main() {',
    '  vec4 tex = texture2D( tDiffuse, vUv );',
    '  // Graduierung in einem wahrnehmungsnahen Raum, Ausgabe bleibt linear',
    '  vec3 c = pow( max( tex.rgb, 0.0 ), vec3( 1.0 / 2.2 ) );',
    '  c = pow( max( c * uGain + uLift, 0.0 ), 1.0 / uGamma );',
    '  // Spreizung mit ausrollenden Enden — vor der Saettigung, damit die',
    '  // Luminanzglocke darunter auf den ENDGUELTIGEN Werten arbeitet.',
    '  // Die Klemmung ist Pflicht: tDiffuse ist HalfFloat und traegt Werte',
    '  // ueber 1 (Himmel, Bloom). smoothstep faellt dort wieder auf null ab —',
    '  // ungeklemmt wuerde der hellste Himmel schwarz. Ueber 1 bleibt die',
    '  // Kurve deshalb die Identitaet.',
    '  if ( uKontrast > 0.0 ) {',
    '    vec3 sk = clamp( c, 0.0, 1.0 );',
    '    c = mix( c, sk * sk * ( 3.0 - 2.0 * sk ) + max( c - 1.0, 0.0 ), uKontrast );',
    '  }',
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
/* 10 -> 8. Der Gegenwert fuer die sechs zusaetzlichen Tiefenabfragen der
   Kontaktverdunklung, und er wird genau dort faellig, wo er gebraucht wird:
   das Abendbild hat mit Abstand die staerksten Strahlen (0.5 gegen 0.12 am
   Mittag) und war die einzige Aufnahme, die ueber ihre alte Bildzeit stieg.
   Zwei Abtastungen weniger sind hier ohne Bildwirkung — der Marsch ist ein
   ANGEDEUTETER Strahl, sein Startversatz ist ohnehin gejittert (s. u.), und
   die Schrittweite waechst automatisch mit, weil sie durch die Zahl der
   Abtastungen geteilt wird. Die Laenge des Marschs bleibt dieselbe. */
const STRAHLEN_SAMPLES = 8;
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
       weich interpolierte Palettenbindung (F1) und Papierkante -------------

   Tiefenmass: linDepth() liefert fuer eine Weltdistanz d bei near n, far f
   naeherungsweise t = 2d / (d + f), also t = 1 auf dem Clearwert (Himmel).
   Mit f = 3000 heisst das: t 0.14 ≈ 226 Einheiten, t 0.30 ≈ 529, t 0.58 ≈
   1225. Der Szenennebel laeuft von 200 bis 950 — die drei Standardgrenzen
   liegen damit am Nebelanfang, mitten im Nebel und jenseits seines Endes.
   Genau das ist die Vorgabe "Bandgrenzen im Nebel verstecken": ueber der
   ersten Grenze setzt der Nebel gerade ein, die zweite liegt in seinem
   Kern, die dritte dahinter, wo ohnehin alles Nebelfarbe ist. */
const KanteBildShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 640, 1 / 400) },

    uNahFern: { value: new THREE.Vector2(0.5, 3000) },
    uKante: { value: 0.22 },
    uKanteFarbe: { value: new THREE.Color(0x2e2418) },
    /* --- Kontaktverdunklung (Tiefenhof) ---------------------------------
       Die Schattenkarte der Sonne setzt den WURF-Schatten; sie kann aber
       prinzipbedingt keinen Kontakt zeichnen: `normalBias` schiebt die
       Abfrage entlang der Normalen nach aussen, damit keine Streifen
       entstehen, und genau dieser Versatz laesst am Fusspunkt jedes Objekts
       einen hellen Spalt. Dazu kommt alles, was gar keinen Wurfschatten
       hat, weil die Sonne von der falschen Seite steht — eine Traufe, eine
       Mauerecke, die Fuge zwischen Wurzel und Huegel.
       Der Hof schliesst beide Luecken aus der Tiefe, die dieser Pass
       ohnehin gebunden hat: Fragmente, deren Umgebung deutlich NAEHER an
       der Kamera liegt, sitzen in einer Kehle oder direkt hinter einer
       Silhouette und werden abgedunkelt. Zwei Radien — der enge Kern nutzt
       die acht Sobel-Taps mit und kostet nichts, der weite Hof sechs
       zusaetzliche Abfragen auf die halbaufgeloeste Tiefe.
       Staerke 0 (Default) schaltet den ganzen Zweig uniform-kohaerent ab. */
    uKontakt: { value: 0 },
    uKontaktR: { value: 3.2 },                       // Radius des Hofs in Texeln
    uKontaktFarbe: { value: new THREE.Color(0x4c5568) },
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
    'uniform vec2 uTexel; uniform vec2 uNahFern;',
    'uniform float uKante; uniform vec3 uKanteFarbe;',
    'uniform float uKontakt; uniform float uKontaktR; uniform vec3 uKontaktFarbe;',
    'uniform float uPapier; uniform vec3 uPapierFarbe;',
    'uniform float uMultiStaerke; uniform vec3 uMultiGrenzen;',
    'uniform float uMultiWeite;',
    'uniform vec4 uBandSat; uniform vec4 uBandKon; uniform vec4 uBandHeb;',
    'uniform sampler2D tRampe; uniform float uPaletteStaerke;',
    'uniform vec2 uPaletteSkala;',
    'varying vec2 vUv;',
    'const vec3 LUMA = vec3( 0.2126, 0.7152, 0.0722 );',
    'float linDepth( vec2 uv ) {',
    '  float z = texture2D( tDepth, uv ).x;',
    '  float n = uNahFern.x, f = uNahFern.y;',
    '  return ( 2.0 * n ) / ( f + n - z * ( f - n ) );',
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
    '  float kante = smoothstep( 0.009, 0.048, sqrt( gx * gx + gy * gy ) / max( mitte, 0.02 ) );',
    '  kante *= 1.0 - smoothstep( 0.35, 0.8, mitte );      // in der Ferne ausblenden',
    '  c = mix( c, uKanteFarbe * c, kante * uKante );',
    '  // Asymmetrische Tiefenlippe: verdichtet nur die Unterkante eines',
    '  // Vordergrundobjekts. Verwendet die vorhandenen Sobel-Taps, kostet also',
    '  // weder weitere Texturzugriffe noch einen Pass und erdet Silhouetten.',
    '  float untenFern = max( max( bl, b ), br );',
    '  float fussTiefe = max( untenFern - mitte, 0.0 ) / max( mitte, 0.02 );',
    '  float fussKante = smoothstep( 0.008, 0.055, fussTiefe );',
    '  fussKante *= 1.0 - smoothstep( 0.30, 0.72, mitte );',
    '  c *= 1.0 - fussKante * uKante * 0.16;',
    '  // --- Kontaktverdunklung: der Tiefenhof (Begruendung am Uniform) ------',
    '  if ( uKontakt > 0.0 ) {',
    '    float nahMittel = ( tl + t + tr + l + r + bl + b + br ) * 0.125;',
    '    vec2 kr = uTexel * uKontaktR;',
    '    float w0 = linDepth( vUv + kr * vec2(  1.000,  0.000 ) );',
    '    float w1 = linDepth( vUv + kr * vec2(  0.500,  0.866 ) );',
    '    float w2 = linDepth( vUv + kr * vec2( -0.500,  0.866 ) );',
    '    float w3 = linDepth( vUv + kr * vec2( -1.000,  0.000 ) );',
    '    float w4 = linDepth( vUv + kr * vec2( -0.500, -0.866 ) );',
    '    float w5 = linDepth( vUv + kr * vec2(  0.500, -0.866 ) );',
    '    float weitMittel = ( w0 + w1 + w2 + w3 + w4 + w5 ) * ( 1.0 / 6.0 );',
    '    // Relativ zur eigenen Tiefe messen: derselbe Weltabstand ist in der',
    '    // Ferne ein winziger Tiefenunterschied. Ohne die Normierung waere der',
    '    // Hof im Vordergrund ein Balken und in der Mitte unsichtbar.',
    '    float inv = 1.0 / max( mitte, 0.02 );',
    '    float kern = smoothstep( 0.0015, 0.0180, ( mitte - nahMittel ) * inv );',
    '    float hof  = smoothstep( 0.0030, 0.0450, ( mitte - weitMittel ) * inv );',
    '    float ao = min( 1.0, kern * 0.62 + hof * 0.55 );',
    '    // Kein Hof am Himmel: dort liegt der Clearwert (1.0), jede Silhouette',
    '    // bekaeme sonst einen dunklen Saum in die Luft gezeichnet.',
    '    ao *= 1.0 - smoothstep( 0.86, 0.97, mitte );',
    '    // Und keiner in der Ferne: dort traegt die Luftperspektive, ein',
    '    // Kontaktschatten waere bei drei Bildpunkten Objektgroesse Dreck.',
    '    ao *= 1.0 - smoothstep( 0.26, 0.62, mitte );',
    '    ao *= uKontakt;',
    '    // Multiplikativ und KUEHL: ein Kontaktschatten ist Fuelllicht, das',
    '    // fehlt — also Himmelsfarbe, die fehlt, nicht schwarze Farbe, die',
    '    // dazukommt.',
    '    c *= mix( vec3( 1.0 ), uKontaktFarbe, ao );',
    '  }',
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
    '    // Die Tiefenstaffelung bleibt rein tonal. Raeumliches Weichzeichnen',
    '    // wuerde Silhouetten, Materialkanten und kleine Architekturdetails',
    '    // zerstoeren; Atmosphaere entsteht ueber Farbe, Wert und Nebel.',
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
    '    }',
    '    c = pow( max( g, 0.0 ), vec3( 2.2 ) );',
    '  }',
    '  float lum = dot( c, LUMA );',
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
    '    float rand = smoothstep( 0.44, 0.68, length( pp ) + wellig );',
    '    // Die Aufhellung folgt der oertlichen Helligkeit (lum von oben): auf',
    '    // Papier zeigt sich das Blatt dort, wo Licht darauf faellt. Ohne die',
    '    // Kopplung risse der Rand in der Nacht die dunklen Ecken auf — eine',
    '    // Ecke bei Luminanz 0.02 wuerde sonst um mehr als das Doppelte heller.',
    '    float papierG = rand * uPapier * ( 0.25 + 0.75 * smoothstep( 0.0, 0.35, lum ) );',
    '    c = mix( c, uPapierFarbe, papierG );',
    '  }',
    '  gl_FragColor = vec4( c, tex.a );',
    '}'
  ].join('\n')
};

/* --- Kantenglaettung nach dem OutputPass ---------------------------------
   BEFUND, an dem dieser Pass haengt (Bildabnahme, 5-fach vergroesserter
   Ausschnitt der Gelaendesilhouette in weite-morgen): der Uebergang
   Himmel → Hang ist eine harte Treppe, und die Stufen sind VIER Bildpunkte
   breit. Vier ist die Zahl, die den Schuldigen nennt: der Tiefen-Prepass
   laeuft in halber Aufloesung, der Sobel des Kante-Passes zeichnet seine
   Linie also in 2x2-Bloecken, und weil die Tiefentextur zwingend
   NearestFilter traegt (DEPTH_COMPONENT ist in WebGL2 nicht filterbar),
   rastet sie auf genau diesen Bloecken ein. Die zwei MSAA-Abtastungen des
   Composer-Ziels loesen die GEOMETRIE-Kante darunter noch halbwegs auf —
   die dunkle Kantenlinie DARUEBER koennen sie prinzipbedingt nicht
   erwischen, sie entsteht erst danach im Bildraum.

   Daraus folgt der Ort: NACH dem OutputPass. Erst dort liegen alle
   bildraeumlichen Beitraege (Kante, Kontakthof, Tiefenbaender, Papierrand)
   fertig im Bild, und erst dort sind die Werte tonwertabgebildet und
   gammakodiert — genau der Raum, fuer den ein luminanzgesteuerter
   Kantenfilter gebaut ist. Vor dem OutputPass, auf halbfloatem HDR, wuerde
   die Luminanzschwelle in hellen Bereichen (Himmel ueber 1.0) nicht mehr
   greifen.

   VERFAHREN (FXAA-Konsolenfassung, unveraendert in seiner Logik):
   1. Luminanz der Mitte und der vier Diagonalnachbarn. Ist die Spanne
      kleiner als max(uMinKante, uKante * lMax), bleibt das Fragment
      unangetastet — Flaechen kosten damit exakt fuenf Abtastungen und
      werden NICHT weichgezeichnet. Das ist der Unterschied zu einem
      Weichzeichner: gemischt wird nur QUER zu einer erkannten Kante.
   2. Aus den vier Diagonalen ergibt sich die Kantenrichtung; entlang ihr
      werden vier weitere Abtastungen genommen und zwei Mittel gebildet.
   3. Faellt das breitere Mittel aus dem lokalen Luminanzband, gewinnt das
      schmalere — so franst keine Silhouette in den Himmel aus.

   KOSTEN: ein Vollbildpass, 5 Abtastungen auf Flaechen, 9 an Kanten, keine
   neuen Rendertargets (der Composer hat seine beiden Ping-Pong-Puffer
   ohnehin, und das Ziel ist LDR). uStaerke 0 schaltet den Pass ueber
   pass.enabled ganz ab; der EffectComposer setzt renderToScreen dann selbst
   wieder auf den OutputPass und das Bild ist byteidentisch zu vorher. */
const KantenglaettungShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTexelAA: { value: new THREE.Vector2(1 / 1600, 1 / 900) },
    // Relative Schwelle: unter 1/8 des lokalen Spitzenwerts gilt ein
    // Helligkeitssprung als Materialverlauf, nicht als Kante.
    uKante: { value: 0.125 },
    // Absolute Untergrenze: haelt den Filter aus den tiefen Werten heraus,
    // in denen jede Nuance Zeichnung ist (Nachtbild, Burgsockel).
    uMinKante: { value: 0.0312 },
    // Groesster Versatz in Bildpunkten. 8 ist die uebliche Wahl; darueber
    // beginnen fast waagerechte Kanten zu schmieren.
    uSpanne: { value: 8.0 },
    uStaerke: { value: 1.0 }
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
    'uniform vec2 uTexelAA;',
    'uniform float uKante; uniform float uMinKante; uniform float uSpanne;',
    'uniform float uStaerke;',
    'varying vec2 vUv;',
    // Gammakodierte Werte: hier wird nach dem OutputPass gefiltert, deshalb
    // die uebliche NTSC-Gewichtung und kein Rec.-709-Luma im Linearraum.
    'float aaLum( vec3 c ) { return dot( c, vec3( 0.299, 0.587, 0.114 ) ); }',
    'void main() {',
    '  vec2 t = uTexelAA;',
    '  vec3 mitteRGB = texture2D( tDiffuse, vUv ).rgb;',
    '  float lM  = aaLum( mitteRGB );',
    '  float lNW = aaLum( texture2D( tDiffuse, vUv + vec2( -t.x, -t.y ) ).rgb );',
    '  float lNO = aaLum( texture2D( tDiffuse, vUv + vec2(  t.x, -t.y ) ).rgb );',
    '  float lSW = aaLum( texture2D( tDiffuse, vUv + vec2( -t.x,  t.y ) ).rgb );',
    '  float lSO = aaLum( texture2D( tDiffuse, vUv + vec2(  t.x,  t.y ) ).rgb );',
    '  float lMin = min( lM, min( min( lNW, lNO ), min( lSW, lSO ) ) );',
    '  float lMax = max( lM, max( max( lNW, lNO ), max( lSW, lSO ) ) );',
    '  float spanne = lMax - lMin;',
    '  if ( spanne < max( uMinKante, lMax * uKante ) ) {',
    '    gl_FragColor = vec4( mitteRGB, 1.0 );',
    '    return;',
    '  }',
    '  vec2 richtung = vec2( -( ( lNW + lNO ) - ( lSW + lSO ) ),',
    '                          ( ( lNW + lSW ) - ( lNO + lSO ) ) );',
    // Daempfung: in dunklen Bildzonen ist die absolute Luminanzdifferenz
    // klein, die Richtung waere dort sonst reines Rauschen.
    '  float daempfung = max( ( lNW + lNO + lSW + lSO ) * 0.03125, 0.0078125 );',
    '  float kehr = 1.0 / ( min( abs( richtung.x ), abs( richtung.y ) ) + daempfung );',
    '  richtung = clamp( richtung * kehr, -uSpanne, uSpanne ) * t;',
    '  vec3 schmal = 0.5 * (',
    '    texture2D( tDiffuse, vUv + richtung * ( 1.0 / 3.0 - 0.5 ) ).rgb +',
    '    texture2D( tDiffuse, vUv + richtung * ( 2.0 / 3.0 - 0.5 ) ).rgb );',
    '  vec3 breit = schmal * 0.5 + 0.25 * (',
    '    texture2D( tDiffuse, vUv - richtung * 0.5 ).rgb +',
    '    texture2D( tDiffuse, vUv + richtung * 0.5 ).rgb );',
    '  float lBreit = aaLum( breit );',
    '  vec3 gemischt = ( lBreit < lMin || lBreit > lMax ) ? schmal : breit;',
    '  gl_FragColor = vec4( mix( mitteRGB, gemischt, uStaerke ), 1.0 );',
    '}'
  ].join('\n')
};

function initPipeline(camera) {
  kameraRef = camera;
  renderer = new THREE.WebGLRenderer({
    /* antialias: false — BEWUSST. Bei aktivem Post landet im Standard-
       Framebuffer NUR der Vollbild-Quad des letzten Passes; ein Quad hat keine
       Innenkanten, ein MSAA-Ziel waere dort jedes Bild umsonst angelegt und
       aufgeloest. Die Kantenglaettung macht der eigene Pass am Ende der Kette.
       Preis: der Direktpfad (setPost(false), reine Fehlersuche) zeichnet ohne
       jede Kantenglaettung. */
    antialias: false,
    preserveDrawingBuffer: true,   // fuer den PNG-Export
    powerPreference: 'high-performance',
    alpha: false,
    // Bedienungsrunde: Stencil fuer die Fluss-Kreuzungen (flussMat in
    // generators/paths.js zeichnet je Pixel genau EINE Flussflaeche). Gilt
    // fuer den Direktpfad (Effekte aus); der Composer-Pfad bekommt seinen
    // Puffer am Render-Target unten.
    stencil: true
  });
  var w = window.innerWidth, h = window.innerHeight;
  var masse = berechneRenderMasse(w, h, window.devicePixelRatio, renderSkala);
  renderer.setPixelRatio(masse.pixelRatio);
  renderer.setSize(w, h);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;   // weiches Ausrollen der Lichter
  renderer.toneMappingExposure = 1.12;
  renderer.info.autoReset = false;
  renderer.sortObjects = true;
  /* --- Sonnenschatten -----------------------------------------------------
     Bis hierher warf in terra nichts einen Schatten: die vier vorhandenen
     castShadow-Setzungen (Schildkroete, Weltschloss, Flugrouten, externe
     Assets) liefen ins Leere, weil hier nie eine Schattenkarte eingeschaltet
     wurde. Damit stand jedes Haus, jeder Baum und jeder Rankenstamm als
     Aufkleber auf dem Boden.

     PCFShadowMap statt PCFSoftShadowMap: letzteres ist in der gepinnten
     three-Fassung als veraltet markiert und faellt zur Laufzeit mit einer
     Konsolenwarnung ohnehin auf PCF zurueck. PCF nutzt einen 5-Punkt-
     Vogel-Kreis auf einem sampler2DShadow — fuenf hardwaregefilterte Taps,
     die Kantenhaerte steuert `shadow.radius` je Tageszeit (Mittag hart,
     Nebel weich). Das ist genau der gezeichnete, harte Schattenrand der
     Vorbilder und nicht der matschige Halbschatten einer Blur-Kaskade.

     autoUpdate: false ist PFLICHT und keine Sparmassnahme. Die Karte wuerde
     sonst im Tiefen-Prepass gebaut — also in dem Moment, in dem renderFrame
     alle Materialien gegen MeshDepthMaterial getauscht und die
     depthWrite-losen Objekte unsichtbar gestellt hat. renderFrame schaltet
     needsUpdate deshalb selbst, und zwar erst nach prepassAus(). */
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  document.body.appendChild(renderer.domElement);
  setzeTexturAnisotropie(Math.min(8, renderer.capabilities.getMaxAnisotropy()));

  var pr = renderer.getPixelRatio();
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
    w, h,
    // stencilBuffer: siehe Renderer-Option oben — ohne ihn liefe der
    // Fluss-Stencil im Composer-Pfad ins Leere und Kreuzungen blendeten
    // wieder doppelt.
    /* samples 2 -> 0. DER GROESSTE EINZELPOSTEN DES GANZEN BILDES, gemessen,
       nicht geschaetzt: mit samples 2 lag stadt-nah bei 44 ms je Bild und
       weite-abend bei 50 ms, ohne MSAA liegen beide bei 17 ms. Rund 27 ms.

       Der Grund steckt in der Kombination MSAA + HalfFloat + ANGLE/D3D11.
       Die beiden Ping-Pong-Ziele des Composers sind RGBA16F, und ein
       mehrfach abgetastetes Float-Ziel hat auf D3D11 keinen festverdrahteten
       Aufloesepfad — es wird ueber einen Shader aufgeloest. Diese Aufloesung
       faellt nicht einmal an, sondern VOR JEDEM Pass, der das Ziel als Textur
       liest: Bloom, Strahlen, Grade, Kante, Output. Fuenf Aufloesungen eines
       11-MB-Ziels je Bild.

       Der Gegenwert war gering: MSAA glaettet ausschliesslich Geometriekanten
       im RenderPass. Die Treppe, an der die Bildabnahme haengengeblieben ist,
       entsteht dagegen erst DANACH im Bildraum (Sobel des Kante-Passes ueber
       die halbaufgeloeste Tiefe) — MSAA konnte sie prinzipbedingt nie
       erreichen. Der Kantenpass am Ende der Kette erwischt beides, kostet
       einen Bruchteil und macht das MSAA damit ueberfluessig.

       Bekannter Verlust: auf sehr duennen Objekten (Zaunlatten, Masten,
       Grashalme) ist FXAA schwaecher als echtes MSAA — es kann eine
       Teildeckung nicht rekonstruieren, die nie gerendert wurde. Bewusst in
       Kauf genommen: 27 ms je Bild sind der Preis dafuer, dass ein
       Zaunpfosten eine Spur harter steht. */
    { type: THREE.HalfFloatType, samples: 0, stencilBuffer: true }));
  // Das explizite Ziel beginnt in logischen Massen. Der Composer skaliert
  // Ziel und Passes genau einmal auf die physische Retina-Aufloesung.
  composer.setPixelRatio(pr);
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
  kantePass = new ShaderPass(KanteBildShader);
  outputPass = new OutputPass();
  // Kantenglaettung als LETZTER Pass (Begruendung am Shader): sie braucht das
  // fertige, gammakodierte Bild inklusive der bildraeumlichen Kantenlinie.
  aaPass = new ShaderPass(KantenglaettungShader);
  aaPass.uniforms.uStaerke.value = aaStaerke;
  aaPass.enabled = aaStaerke > 0;
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(strahlenPass);
  composer.addPass(gradePass);
  composer.addPass(kantePass);
  composer.addPass(outputPass);
  composer.addPass(aaPass);
  setzeAaTexel(w, h, pr);

  // Tiefen-Prepass in voller Renderaufloesung (Begruendung und Messung in
  // render/render-masse.js). Die Szene laeuft dabei nicht mit echtem Shading,
  // sondern mit getauschten Depth-Materialien (s. prepassAn).
  var dw = masse.tiefenBreite;
  var dh = masse.tiefenHoehe;
  depthRT = new THREE.WebGLRenderTarget(dw, dh, {
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter
  });
  depthRT.depthTexture = new THREE.DepthTexture(dw, dh);
  kantePass.uniforms.tDepth.value = depthRT.depthTexture;
  kantePass.uniforms.uTexel.value.set(1 / dw, 1 / dh);
  kantePass.uniforms.uNahFern.value.set(camera.near, camera.far);
  // C1: dieselbe Tiefentextur traegt die Himmelsmaske der Strahlen.
  strahlenPass.uniforms.tDepth.value = depthRT.depthTexture;
  strahlenPass.uniforms.uNahFern.value.set(camera.near, camera.far);
  // C2/C3 leben in JS-Zustand (s. u.) und werden hier einmalig in die frisch
  // gebauten Passes geschrieben — so darf eine Karte ihr Farbskript auch vor
  // initPipeline setzen, ohne dass es verloren geht.
  wendeBildlookAn();
  return renderer;
}

function resizePipeline(camera) {
  var w = window.innerWidth, h = window.innerHeight;
  var masse = berechneRenderMasse(w, h, window.devicePixelRatio, renderSkala);
  var pr = masse.pixelRatio;
  if (renderer.getPixelRatio() !== pr) {
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
  }
  renderer.setSize(w, h);
  composer.setSize(w, h);
  var dw = masse.tiefenBreite;
  var dh = masse.tiefenHoehe;
  depthRT.setSize(dw, dh);
  kantePass.uniforms.uTexel.value.set(1 / dw, 1 / dh);
  kantePass.uniforms.uNahFern.value.set(camera.near, camera.far);
  strahlenPass.uniforms.uNahFern.value.set(camera.near, camera.far);
  setzeAaTexel(w, h, pr);
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
  // Tonwertumfang: fehlt das Feld (altes Kartenformat, Wetter-/Biomtabellen),
  // bleibt die Identitaet stehen.
  gradePass.uniforms.uKontrast.value =
    (typeof g.kontrast === 'number' && g.kontrast > 0) ? Math.min(g.kontrast, 1) : 0;
  gradePass.uniforms.uSchwarz.value = g.schwarz;
  gradePass.uniforms.uVignette.value = g.vignette;
  /* Kontaktverdunklung: gehoert zur TAGESZEIT, nicht zur Karte. Diffuses
     Licht (Nebel) hat kaum Kontaktschatten, hartes Mittagslicht die
     schaerfsten. Fehlt das Feld, bleibt der Zweig aus — eine alte Karte
     oder ein Preset ohne Angabe rendert byteidentisch zu vorher. */
  kantePass.uniforms.uKontakt.value =
    (typeof look.kontakt === 'number' && look.kontakt > 0) ? Math.min(look.kontakt, 1) : 0;
  if (typeof look.kontaktRadius === 'number' && look.kontaktRadius > 0)
    kantePass.uniforms.uKontaktR.value = look.kontaktRadius;
  if (look.kontaktFarbe !== undefined && look.kontaktFarbe !== null)
    kantePass.uniforms.uKontaktFarbe.value.set(look.kontaktFarbe);
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
  /* Split-Toning der TAGESZEIT (warme Lichter, kuehle Schatten).
     Der Zweig im GradeShader kann das seit C2, wurde bis hierher aber
     ausschliesslich aus dem Kartenformat gespeist (io.js) und stand deshalb
     in der Praxis immer auf Staerke 0. Gemessen war die Folge, dass terra in
     offenem Sonnenlicht KUEHLERE Lichter als Schatten hatte — genau das
     Gegenteil dessen, was der Stilvertrag fordert.
     Die Karte behaelt das letzte Wort: `todSkript` ist die Vorgabe der
     Tageszeit, `farbskript` der Wunsch der Karte, und wendeBildlookAn()
     bevorzugt die Karte, sobald sie eine Staerke > 0 mitbringt. Eine alte
     Karte ohne Farbskript bekommt damit das Preset-Toning, eine Karte mit
     eigenem Skript behaelt exakt ihr eigenes. */
  var fs = look.farbskript;
  if (fs) {
    farbeIn(todSkript.licht, fs.licht, 0xffffff);
    farbeIn(todSkript.mitte, fs.mitte, 0xffffff);
    farbeIn(todSkript.schatten, fs.schatten, 0xffffff);
    todSkript.staerke = (typeof fs.staerke === 'number' && fs.staerke > 0)
      ? Math.min(fs.staerke, 1) : 0;
  } else {
    todSkript.staerke = 0;
  }
  wendeBildlookAn();
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
/* Zwilling des Kartenskripts, gespeist aus dem Tageszeit-Preset (setLook).
   Getrennter Zustand statt eines gemeinsamen: schriebe applyTod in dasselbe
   Objekt, ueberschriebe jeder Tageszeitwechsel den Wunsch der Karte. */
var todSkript = { licht: new THREE.Color(0xffffff), mitte: new THREE.Color(0xffffff),
  schatten: new THREE.Color(0xffffff), staerke: 0 };
/* 0.16 -> 0.06: die Papierkante hellt genau die Bildraender auf, in denen ein
   fotografisches wie ein gemaltes Bild seine dunkelsten Werte hat. Bei 0.16
   war sie einer der beiden Gruende, warum kein Tagesbild unter Luminanz 0.20
   kam. Sie bleibt als Blattrand erkennbar, hebt den Rand aber nicht mehr aus
   dem Tonwertumfang heraus. */
var papierStaerke = 0.06;

/* --- F1/F3: Bildlook der KARTE, zweite Staffel ----------------------------
   Gleiche Bauart wie C2/C3 darueber: JS-Zustand, den wendeBildlookAn() in die
   Uniforms schiebt. Beide Staerken stehen auf 0 — ohne Setteraufruf ist
   das Bild byteidentisch zum Stand vor dieser Runde. */
const MAL_DEZENT = 0; // Kartenformat-Kompatibilitaet; Vollbildstruktur bleibt aus.

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
  staerke: 0, stufen: 14, quant: 0 };
var rampeTex = null;
var malschicht = { staerke: 0, kachel: 340 };   // kachel in Bildpixeln
var multiplane = {
  staerke: 0,
  grenzen: [0.14, 0.30, 0.58],   // s. Kopfkommentar des Kante-Passes
  weite: 0.045,
  weich: 0,
  /* Vordergrund satter/kontrastreicher, Ferne flauer und leicht aufgehellt.
     Die Spreizung ist in dieser Runde deutlich groesser geworden. Grund:
     die Staffelung laeuft mit Staerke 0.42 (main.js), aus einer
     Fernsaettigung von 0.80 wurde damit effektiv 0.916 — messbar, aber im
     Bild nicht als STAFFELUNG lesbar, sondern hoechstens als leichter
     Schleier. Die Vorbilder trennen ihre Ebenen hart: bei anno-05 liegt
     zwischen besonnter Vordergrundwiese und der Stadt dahinter ein
     vollstaendiger Bruch in Saettigung UND Wert, kein Verlauf.
     Effektiv (Staerke 0.42) ergibt die neue Tabelle 1.06 / 1.00 / 0.91 /
     0.86 an Saettigung — das ist eine Staffel, die man sieht, und sie bleibt
     weit unter dem Punkt, an dem die Ferne farblos wuerde. */
  baender: [
    { sat: 1.14, kontrast: 1.10, hebung: -0.016 },
    { sat: 1.00, kontrast: 1.00, hebung: 0.000 },
    { sat: 0.78, kontrast: 0.86, hebung: 0.038 },
    { sat: 0.66, kontrast: 0.78, hebung: 0.062 }
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
    // Karte schlaegt Tageszeit: nur wenn die Karte KEIN eigenes Skript
    // mitbringt, faellt das Toning auf die Vorgabe des Presets zurueck.
    var f = farbskript.staerke > 0 ? farbskript : todSkript;
    var u = gradePass.uniforms;
    u.uSkriptLicht.value.copy(f.licht);
    u.uSkriptMitte.value.copy(f.mitte);
    u.uSkriptSchatten.value.copy(f.schatten);
    u.uSkriptStaerke.value = f.staerke;
  }
  if (!kantePass) return;
  var k = kantePass.uniforms;
  k.uPapier.value = papierStaerke;
  // F1
  k.tRampe.value = rampeTex;
  k.uPaletteStaerke.value = palette.staerke;
  k.uPaletteSkala.value.set((palette.n - 1) / palette.n, 0.5 / palette.n);
  // F3
  var m = multiplane, b = m.baender;
  k.uMultiStaerke.value = m.staerke;
  k.uMultiGrenzen.value.set(m.grenzen[0], m.grenzen[1], m.grenzen[2]);
  k.uMultiWeite.value = m.weite;
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

/* --- F1/F3: oeffentliche Regler --------------------------------------- */

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
 * @param opt     optionales altes Kartenformat-Feld. `stufen` wird weiterhin
 *                mitgefuehrt; `quant` bleibt aus, damit kein Dither entsteht.
 * Sinnvoller Einsatz: 16–32 Stuetzstellen, staerke 0.25–0.45. Darueber wird
 * es Cel — die Lichter- und Tiefendaempfung im Shader haelt das lange auf,
 * aber nicht beliebig.
 */
function setPalette(farben, staerke, opt) {
  if (Array.isArray(farben) && farben.length >= 2) rampeBauen(farben);
  palette.staerke = zahl(staerke, 0, 1, 0);
  if (opt) palette.stufen = Math.round(zahl(opt.stufen, 2, 64, palette.stufen));
  // quant bleibt im Kartenformat lesbar, wirkt aber nicht mehr als Pixel-Dither.
  palette.quant = 0;
  wendeBildlookAn();
}

/** Gegenstueck fuer das Kartenformat: Farben immer als Hex-Zahlen. */
function getPalette() {
  return { farben: palette.farben.slice(), staerke: palette.staerke,
    stufen: palette.stufen, quant: palette.quant };
}

/**
 * Alte Karten koennen weiterhin ein `malschicht`-Feld enthalten. Es wird
 * bewusst nur gelesen und mit Staerke 0 zurueckgegeben: bildraumfeste
 * Vollbildstruktur ist kein Bestandteil des Looks mehr.
 */
function setMalschicht(cfg) {
  // Kompatibilitaet fuer alte Kartendateien: Strukturstaerke bleibt aus.
  malschicht.staerke = 0;
  if (cfg && typeof cfg === 'object')
    malschicht.kachel = zahl(cfg.kachel, 64, 2048, malschicht.kachel);
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
 * heraus. Das alte Feld `weich` wird nur noch kompatibel gelesen und immer
 * auf 0 gesetzt: die Staffelung veraendert keine raeumliche Bildschaerfe.
 * `weite` ist die halbe Breite des weichen Uebergangs (0.005..0.2): gross genug, damit die Grenze im Nebel
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
  multiplane.weich = 0;
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
   Fragment-Shader (Phong, Nebel, materiallokale Aquarellstruktur), obwohl niemand die
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
    if (o.userData && o.userData.terraDepthDetail === false) {
      // Mikrodetails bleiben im Farbbild voll erhalten. Im halbaufgeloesten
      // Tiefenbild waeren sie hoechstens ein verrauschter Einzelpixel und
      // verdoppeln sonst Draw Call und Dreieckslast ohne lesbare Kontur.
      o.visible = false; prepassVersteckt.push(o); return;
    }
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
function renderFrame(camera) {
  renderer.info.reset();
  if (postAn) {
    strahlenVorbereiten(camera);
    prepassAn();
    // Der Prepass darf die Schattenkarte NICHT bauen: hier haengen gerade
    // Depth-Attrappen an den Objekten und alles ohne depthWrite ist
    // unsichtbar gestellt. Erst nach prepassAus() stehen die echten
    // Materialien (samt ihrer Alphakarten fuer Kronen und Gras) wieder da.
    renderer.shadowMap.needsUpdate = false;
    renderer.setRenderTarget(depthRT);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    prepassAus();               // vor dem Composer: der braucht die echten Materialien
    renderer.shadowMap.needsUpdate = true;
    composer.render();          // RenderPass -> renderer.render -> Schattenkarte
  } else {
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  }
  infoCalls = renderer.info.render.calls;
  infoTris = renderer.info.render.triangles;
}

function getRenderInfo() {
  return { calls: infoCalls, triangles: infoTris, skala: renderSkala };
}

/**
 * Adaptive Aufloesung: einmal je Bild mit der ECHTEN (ungeklammerten)
 * Bildzeit aufrufen. Faellt die Rate anhaltend, sinkt die Renderskala in
 * Stufen (Renderer, Composer und Tiefenziel werden gemeinsam kleiner);
 * traegt sie wieder, steigt die Skala zurueck bis zur vollen Schaerfe.
 * Die Traegheit in beide Richtungen liegt im Regler (leistungsregler.js).
 */
function tickLeistung(dt) {
  if (!renderer) return;
  var neu = leistung.tick(dt);
  if (neu === null) return;
  renderSkala = neu;
  resizePipeline(kameraRef);
}

/** PNG-Export: liefert das fertig komponierte Bild (inkl. Bloom und Grade). */
function exportPNG(name) {
  var url = renderer.domElement.toDataURL('image/png');
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

function getRenderer() { return renderer; }

export { initPipeline, resizePipeline, setLook, setPost, getPost, renderFrame,
  getRenderInfo, tickLeistung, exportPNG, getRenderer,
  setFarbskript, getFarbskript, setPapierkante, getPapierkante,
  setPalette, getPalette, setMalschicht, getMalschicht,
  setMultiplane, getMultiplane, setKantenglaettung, getKantenglaettung,
  PALETTE_STANDARD, MAL_DEZENT };
