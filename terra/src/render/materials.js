// Weltmaterialien: Phong pro Fragment, per onBeforeCompile gepatcht.
// Kein eigenes ShaderMaterial — Instancing, Vertexfarben und Fog blieben sonst
// auf der Strecke. Jede Ersetzung prueft ihren Zielstring gegen die Chunks der
// gepinnten Three-Version; schlaegt sie fehl, bleibt der Shader unveraendert
// und eine console.warn nennt den betroffenen Patch.
import * as THREE from 'three';
import { TEX } from './textures.js';

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
  uCloudAmt: { value: 0.25 }
};

/** Diagnose: greift jeder Patch? Wird auf window exponiert. */
const patchInfo = { wrap: 0, rim: 0, hoehe: 0, richtung: 0, wolke: 0, versuche: 0 };
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

  shader.fragmentShader = kopfF + shader.fragmentShader;
}

/** Weltmaterial: Phong (pro Fragment) mit Wrap-Licht statt hartem Lambert. */
function terraMat(opts) {
  opts = opts || {};
  var cloudShadow = !!opts.cloudShadow;
  delete opts.cloudShadow;
  opts.shininess = 0;
  opts.specular = new THREE.Color(0x000000);
  var m = new THREE.MeshPhongMaterial(opts);
  m.onBeforeCompile = function (shader) { terraPatch(shader, { cloudShadow: cloudShadow }); };
  m.customProgramCacheKey = function () { return 'terraA|cs' + (cloudShadow ? 1 : 0); };
  return m;
}

/** Materialien, die der Tageszeit-Grundton einfaerbt. */
const tintedMats = [];

// Ranken-Materialien: die Ranke ist in jeder Stimmung der hellste Wert im Bild.
const vineMat = terraMat({
  color: 0xffffff, vertexColors: true, transparent: true, opacity: 0.95,
  emissive: 0x4a463e
});
const leafMat = terraMat({ vertexColors: true, side: THREE.DoubleSide });
const rockMat = terraMat({ vertexColors: true });
tintedMats.push(vineMat, leafMat, rockMat);

export { terraUniforms, patchInfo, terraPatch, terraMat, tintedMats,
  vineMat, leafMat, rockMat };
