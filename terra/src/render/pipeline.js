// Render-Pipeline: Renderer, EffectComposer (Render → Bloom → Strahlen →
// Graduierung → Kante/Korn/Papierkante → OutputPass) plus ein halbaufgeloester
// Depth-only-Prepass, der die Kantenandeutung UND die Himmelsmaske der
// Godrays speist. Der OutputPass steht zwingend am Ende — er erledigt
// Tone Mapping und Farbraumkonversion.
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
    '    float himmel = smoothstep( 0.88, 0.995, strahlTiefe( uv ) );',
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

/* --- Kantenandeutung (Sobel ueber die Tiefe) und animiertes Korn -------- */
const KanteKornShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2(1 / 640, 1 / 400) },
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
    uPapierFarbe: { value: new THREE.Color(0xf6f0e2) }
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
    'uniform float uKorn; uniform float uZeit;',
    'uniform float uPapier; uniform vec3 uPapierFarbe;',
    'varying vec2 vUv;',
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
    '    c = mix( c, uPapierFarbe, rand * uPapier );',
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
  gradePass = new ShaderPass(GradeShader);
  kantePass = new ShaderPass(KanteKornShader);
  outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
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
}

/** Look-Parameter aus dem Tageszeit-Preset. */
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
  if (look.horizont) renderer.setClearColor(look.horizont, 1);
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

/** Ein Frame: Depth-only-Prepass (bei aktiver Post), dann Composer oder Direktbild. */
function renderFrame(camera, zeit) {
  renderer.info.reset();
  if (postAn) {
    kantePass.uniforms.uZeit.value = zeit % 61;
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
  getRenderInfo, exportPNG, getRenderer };
