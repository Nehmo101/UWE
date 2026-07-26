// Render-Pipeline: Renderer, EffectComposer (Render → Bloom → Graduierung →
// Kante/Korn → OutputPass) plus ein halbaufgeloester Tiefen-Prepass fuer die
// Kantenandeutung. Der OutputPass steht zwingend am Ende — er erledigt
// Tone Mapping und Farbraumkonversion.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xdfe8f0, 200, 950);

let renderer = null, composer = null, bloomPass = null, gradePass = null,
    kantePass = null, outputPass = null, renderPass = null;
let depthRT = null, depthCam = null, depthScene = null;
let postAn = true;
let infoCalls = 0, infoTris = 0;

/* --- Farbgraduierung: Lift/Gamma/Gain, Saettigung nach Luminanz,
       angehobener Schwarzpunkt, dezente Vignette ------------------------- */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new THREE.Vector3(0.016, 0.024, 0.042) },
    uGamma: { value: new THREE.Vector3(1, 1, 1) },
    uGain: { value: new THREE.Vector3(1.04, 1.02, 0.98) },
    uSatMitte: { value: 1.08 },
    uSatLicht: { value: 0.92 },
    uSchwarz: { value: 0.032 },
    uVignette: { value: 0.1 }
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
    '  // Schwarzpunkt anheben, leicht ins Kuehle',
    '  c = c * ( 1.0 - uSchwarz ) + vec3( uSchwarz * 0.9, uSchwarz * 0.96, uSchwarz * 1.08 );',
    '  float d = distance( vUv, vec2( 0.5 ) );',
    '  c *= 1.0 - uVignette * smoothstep( 0.42, 0.86, d );',
    '  gl_FragColor = vec4( pow( c, vec3( 2.2 ) ), tex.a );',
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
    uZeit: { value: 0 }
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
    'varying vec2 vUv;',
    'float linDepth( vec2 uv ) {',
    '  float z = texture2D( tDepth, uv ).x;',
    '  float n = uNahFern.x, f = uNahFern.y;',
    '  return ( 2.0 * n ) / ( f + n - z * ( f - n ) );',
    '}',
    'float korn( vec2 p ) {',
    '  return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) + uZeit * 61.7 ) * 43758.5453 );',
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
  bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.22, 0.7, 0.88);
  gradePass = new ShaderPass(GradeShader);
  kantePass = new ShaderPass(KanteKornShader);
  outputPass = new OutputPass();
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(gradePass);
  composer.addPass(kantePass);
  composer.addPass(outputPass);

  // Tiefen-Prepass in halber Aufloesung: echte Materialien (Alphatest bleibt
  // korrekt), Farbausgabe wird verworfen, nur die Tiefe zaehlt.
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

/** Ein Frame: Tiefen-Prepass (bei aktiver Post), dann Composer oder Direktbild. */
function renderFrame(camera, zeit) {
  renderer.info.reset();
  if (postAn) {
    kantePass.uniforms.uZeit.value = zeit % 61;
    renderer.setRenderTarget(depthRT);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
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
