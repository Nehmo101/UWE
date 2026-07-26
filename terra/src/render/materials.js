// Weltmaterialien: Phong pro Fragment, per onBeforeCompile gepatcht.
// Kein eigenes ShaderMaterial — Instancing, Vertexfarben und Fog blieben sonst
// auf der Strecke. Jede Ersetzung prueft ihren Zielstring gegen die Chunks der
// gepinnten Three-Version; schlaegt sie fehl, bleibt der Shader unveraendert
// und eine console.warn nennt den betroffenen Patch.
import * as THREE from 'three';
import { TEX } from './textures.js';
import { windUniforms, WIND_GLSL } from '../world/wind.js';

/** Gemeinsame Uniforms aller Weltmaterialien (Tageszeit schreibt hinein). */
const terraUniforms = {
  uRim: { value: new THREE.Color(0xdcefff) },
  uBounce: { value: new THREE.Color(0xe0d8c0) },
  // Richtungsabhaengiger Nebel: warm zur Sonne hin, kuehl von ihr weg.
  uFogWarm: { value: new THREE.Color(0xe8e2d2) },
  uFogCool: { value: new THREE.Color(0xd4e0e8) },
  uSunDir: { value: new THREE.Vector3(0.45, 0.72, 0.35).normalize() },
  // Obergrenze des Nebelfaktors: haelt im Nebel-Preset nahe Objekte lesbar.
  uFogCap: { value: 1.0 },
  // Wolkenschatten am Boden (nur Terrainmaterial wertet sie aus).
  uCloudTex: { value: TEX.cloudNoise },
  uCloudDrift: { value: new THREE.Vector2(0, 0) },
  uCloudAmt: { value: 0.25 },
  // Malschicht: Aquarelltextur, in Weltkoordinaten abgetastet
  uMalTex: { value: TEX.aquarellMittel }
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

/** Diagnose: greift jeder Patch? Wird auf window exponiert. */
const patchInfo = { wrap: 0, rim: 0, hoehe: 0, richtung: 0, wolke: 0, mal: 0, wind: 0, versuche: 0 };
if (typeof window !== 'undefined') window.terraPatchInfo = patchInfo;

function ersetze(shader, feld, alt, neu, patchName) {
  if (shader[feld].indexOf(alt) < 0) {
    console.warn('terra: Shader-Patch "' + patchName + '" fand seinen Anker nicht — Shader bleibt unveraendert.');
    return false;
  }
  shader[feld] = shader[feld].replace(alt, neu);
  return true;
}

function terraPatch(shader, opts) {
  patchInfo.versuche++;
  shader.uniforms.uRim = terraUniforms.uRim;
  shader.uniforms.uBounce = terraUniforms.uBounce;
  shader.uniforms.uFogWarm = terraUniforms.uFogWarm;
  shader.uniforms.uFogCool = terraUniforms.uFogCool;
  shader.uniforms.uSunDir = terraUniforms.uSunDir;
  shader.uniforms.uFogCap = terraUniforms.uFogCap;

  var kopfF = 'uniform vec3 uRim;\nuniform vec3 uBounce;\n';

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
        'vec3 irradiance = terraB * directLight.color * mix( uBounce, vec3(1.0), terraB );');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_phong_pars_fragment>', neu);
    patchInfo.wrap++;
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

  // (4) Nebel: Richtungsmischung (warm zur Sonne, kuehl davon weg), Hoehendichte
  //     in Senken, und eine Obergrenze fuer die Lesbarkeit im Nebel-Preset.
  //     Anker aus fog_fragment (0.185): gl_FragColor.rgb = mix( ..., fogColor, fogFactor );
  var fogKey = 'gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );';
  var fogChunk = THREE.ShaderChunk.fog_fragment;
  var fogInc = '#include <fog_fragment>';
  if (hatWelt && fogChunk && fogChunk.indexOf(fogKey) >= 0 &&
      shader.fragmentShader.indexOf(fogInc) >= 0) {
    var fogNeu = fogChunk.replace(fogKey,
      'float terraDicht = 1.0 + 1.0 * ( 1.0 - smoothstep( 0.5, 10.0, vTerraW.y ) );\n' +
      '\tfogFactor = 1.0 - pow( max( 1.0 - fogFactor, 0.0 ), terraDicht );\n' +
      '\tfogFactor = min( fogFactor, uFogCap );\n' +
      '\tfloat terraSonne = pow( max( dot( normalize( vTerraW - cameraPosition ), uSunDir ), 0.0 ), 2.0 );\n' +
      '\tvec3 terraFogCol = mix( uFogCool, uFogWarm, terraSonne );\n' +
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
    shader.uniforms.uCloudTex = terraUniforms.uCloudTex;
    shader.uniforms.uCloudDrift = terraUniforms.uCloudDrift;
    shader.uniforms.uCloudAmt = terraUniforms.uCloudAmt;
    kopfF += 'uniform sampler2D uCloudTex;\nuniform vec2 uCloudDrift;\nuniform float uCloudAmt;\n';
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
  if (hatWelt && opts && opts.mal) {
    shader.uniforms['uMalTex' + 0] = { value: opts.mal.texObj };
    kopfF += 'uniform sampler2D uMalTex0;\n';
    var mk = '#include <color_fragment>';
    var malCode = mk + '\n' +
      'vec3 terraMal = texture2D( uMalTex0, ( vTerraW.xz + vTerraW.yy * 0.7 ) * ' +
        opts.mal.skala.toFixed(4) + ' ).rgb;\n' +
      'diffuseColor.rgb *= mix( vec3(1.0), terraMal * 2.0, ' + opts.mal.staerke.toFixed(3) + ' );';
    if (ersetze(shader, 'fragmentShader', mk, malCode, 'malschicht')) patchInfo.mal++;
  }

  // (7) Ranken-Ausblenden: oben Richtung Dunst transparent werden.
  if (opts && opts.rankenFade) {
    var oa = '#include <opaque_fragment>';
    if (ersetze(shader, 'fragmentShader', oa,
        'diffuseColor.a *= mix( 1.0, 0.6, smoothstep( 140.0, 360.0, vTerraW.y ) );\n' + oa,
        'rankenfade')) { /* zaehlt nicht separat */ }
  }

  shader.fragmentShader = kopfF + shader.fragmentShader;

  // (8) Wind: ersetzt project_vertex, verschiebt die Weltposition mit der
  //     gemeinsamen Boee; Auslenkung mit uv.y gewichtet (Fuss bleibt stehen).
  if (opts && opts.wind) {
    shader.uniforms.uWindZeit = windUniforms.uWindZeit;
    shader.uniforms.uWindStaerke = windUniforms.uWindStaerke;
    var pv = '#include <project_vertex>';
    if (shader.vertexShader.indexOf(pv) >= 0 && shader.vertexShader.indexOf('#include <uv_vertex>') >= 0) {
      shader.vertexShader = 'uniform float uWindZeit;\nuniform float uWindStaerke;\n' +
        WIND_GLSL + '\n' + shader.vertexShader.replace(pv,
        'vec4 terraMV2 = vec4( transformed, 1.0 );\n' +
        '#ifdef USE_INSTANCING\n  terraMV2 = instanceMatrix * terraMV2;\n#endif\n' +
        'vec4 terraWelt2 = modelMatrix * terraMV2;\n' +
        'vec2 terraWehen = terraWind( terraWelt2.xyz, uWindZeit ) * uWindStaerke * ' +
          (opts.wind.amp || 0.35).toFixed(3) + ' * uv.y;\n' +
        'terraWelt2.xz += terraWehen;\n' +
        'vec4 mvPosition = viewMatrix * terraWelt2;\n' +
        'gl_Position = projectionMatrix * mvPosition;');
      patchInfo.wind++;
    } else {
      console.warn('terra: Shader-Patch "wind" fand seinen Anker nicht.');
    }
  }
}

/** Weltmaterial: Phong (pro Fragment) mit Wrap-Licht statt hartem Lambert. */
function terraMat(opts) {
  opts = opts || {};
  var cloudShadow = !!opts.cloudShadow;
  var familie = opts.familie || null;
  var wind = opts.wind || null;
  var rankenFade = !!opts.rankenFade;
  delete opts.cloudShadow; delete opts.familie; delete opts.wind; delete opts.rankenFade;
  opts.shininess = 0;
  opts.specular = new THREE.Color(0x000000);
  var m = new THREE.MeshPhongMaterial(opts);
  var mal = null;
  if (familie && FAMILIEN[familie]) {
    var F = FAMILIEN[familie];
    mal = { texObj: TEX[F.tex], skala: F.skala * 0.06, staerke: F.staerke };
  }
  var windOpts = wind ? { amp: wind.amp || 0.35 } : null;
  m.onBeforeCompile = function (shader) {
    terraPatch(shader, { cloudShadow: cloudShadow, mal: mal, wind: windOpts,
      rankenFade: rankenFade });
  };
  m.customProgramCacheKey = function () {
    return 'terraB|cs' + (cloudShadow ? 1 : 0) + '|f' + (familie || '-') +
      '|w' + (wind ? (wind.amp || 0.35) : '-') + '|rf' + (rankenFade ? 1 : 0);
  };
  return m;
}

/** Materialien, die der Tageszeit-Grundton einfaerbt. */
const tintedMats = [];

// Ranken-Materialien: die Ranke ist in jeder Stimmung der hellste Wert im Bild.
const vineMat = terraMat({
  color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.95,
  emissive: 0x4a463e, familie: 'rinde', rankenFade: true
});
const leafMat = terraMat({ vertexColors: true, side: THREE.DoubleSide, familie: 'laub' });
const rockMat = terraMat({ vertexColors: true, familie: 'stein' });

// Fensterglut: eigenes emissives Material, Staerke haengt an der Tageszeit.
const fensterMat = terraMat({ color: 0x3a3228, emissive: 0xffc878, familie: 'putz' });
fensterMat.emissiveIntensity = 0.0;
function setFensterGlut(i) { fensterMat.emissiveIntensity = i; }
tintedMats.push(vineMat, leafMat, rockMat);

export { terraUniforms, patchInfo, terraPatch, terraMat, tintedMats, FAMILIEN,
  vineMat, leafMat, rockMat, fensterMat, setFensterGlut };
