/* ==========================================================================
   Final-Art-Pass - filmische Tiefe ohne zusaetzliche Renderlast

   Die Veredelung bleibt absichtlich in vorhandenen Shadern und Instanzen:
   keine Vollbild-Koernung, keine neue Textur und kein weiterer Renderpass.
   ========================================================================== */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SRC } from './hilfen/laden.mjs';

const lesen = (...teile) => fs.readFileSync(path.join(SRC, ...teile), 'utf8');
const sky = lesen('world', 'sky.js');
const water = lesen('world', 'water.js');
const materials = lesen('render', 'materials.js');
const pipeline = lesen('render', 'pipeline.js');

test('Wolken gewinnen Volumen und im Luftarchipel echte Tiefenstaffelung', () => {
  assert.match(sky, /terraWolkenKern/);
  assert.match(sky, /diffuseColor\.a \*= smoothstep/);
  assert.match(sky, /LUFT_WOLKEN_ABSENKUNG = \[145, 90, 25\]/);
  assert.match(sky, /S\.biom === 'luftarchipel' \? LUFT_WOLKEN_ABSENKUNG\[c\.lage\] : 0/);
  assert.equal((sky.match(/new THREE\.InstancedMesh/g) || []).length, 2,
    'Wolken und Cirren muessen bei ihren zwei bestehenden Instanz-Draws bleiben');
});

test('Meer und Seen beleuchten die vorhandene Woge statt eine Normalmap zu laden', () => {
  /* Die Zusage dieser Runde ist unveraendert und wird hier weiter geprueft:
     KEINE Normalmap, KEINE geladene Textur, kein zweiter Renderdurchgang —
     alles aus Formeln, die ohnehin schon im Modul stehen.

     GEAENDERT hat sich, WOHER das Meer seine Normale nimmt. Die
     Wasserebene hat 62.5 Welteinheiten Segmentweite und traegt die Duenung
     (Wellenlaenge ~140) mit knapp zwei Abtastungen je Welle; was dFdx dort
     ablas, war die Facettennormale des Gitters, nicht die der Welle — und
     mit 0.8 Grad Maximalsteigung konnte darauf kein Glanz wandern. Das Meer
     leitet seine Normale deshalb analytisch aus dem Kraeuselfeld ab.
     Die SEEFLAECHEN bleiben beim Ableitungspaar: viele kleine, dicht
     unterteilte Netze, deren Flaechennormale die Woge wirklich traegt. */
  assert.match(water, /function patchWasserNormale/);
  assert.match(water, /cross\( dFdx\( vViewPosition \), dFdy\( vViewPosition \) \)/);
  assert.match(water, /terraSeeLuft/);
  assert.equal((water.match(/patchWasserNormale\(shader\);/g) || []).length, 1,
    'die abgeleitete Wogennormale gehoert nur noch an die Seeflaeche');
  // Und das Meer: Kraeuselfeld als EINE Quelle (Tabelle -> GLSL, wie WOGE),
  // daraus Hoehe und Steigung im selben sin/cos-Paar.
  assert.match(water, /function kraeuselGLSL/);
  assert.match(water, /terraKraeusel\( vTerraW\.xz, terraKZeit \)/);
  assert.match(water, /normal = normalize\( \( viewMatrix \* vec4\( terraNW, 0\.0 \) \)\.xyz \)/);
  assert.doesNotMatch(water, /new THREE\.TextureLoader/);
});

test('Kueste: Tiefenfarbe, Brandung und Spiegelung kommen aus EINEM Rasterfeld', () => {
  /* Der Bildbefund war "fast einfarbige Flaeche, harter Farbwechsel an der
     Uferlinie". Ursache war, dass die Wasserebene das Gelaende nicht kannte.
     Das Kuestenfeld ist die Abhilfe: ein RG-Rasterbild in Weltkoordinaten,
     R = Uferabstand (echte Distanztransformation vom Land ins Wasser),
     G = Wassertiefe. Beides wird im Fragment EINMAL abgetastet und traegt
     danach Farbe, Kaustik, Schaum und Deckung. */
  assert.match(water, /uKuesteFeld/);
  assert.match(water, /THREE\.RGFormat/);
  // Distanz statt Tiefe fuer den Schaum: Gischt steht auch am Steilufer.
  assert.match(water, /1\.4142135623730951/);
  // Die Tiefenfarbe ist ein FAKTOR auf material.color — sonst ueberschriebe
  // sie das Abendrot und die Nacht aus den Tageszeit-Presets.
  assert.match(water, /diffuse \* uWasserFlach/);
  assert.match(water, /diffuse \* uWasserTief/);
  // Spiegelung als Fresnel-MISCHUNG hinter opaque_fragment, nicht als
  // Addition: eine Addition macht das Meer bei streifendem Blick milchig.
  assert.match(water, /gl_FragColor\.rgb = mix\( gl_FragColor\.rgb, terraHimmelF, terraSpM \)/);
  // Keine neue Textur, kein neues Mesh, kein zusaetzlicher Zeichenaufruf.
  assert.equal((water.match(/new THREE\.Mesh/g) || []).length, 2,
    'Wasser und Meeresboden bleiben bei ihren zwei Meshes');
  // prefers-reduced-motion: die neuen Bewegungen haben einen eigenen Regler.
  assert.match(water, /uKuestenTempo/);
  assert.match(water, /prefers-reduced-motion/);
});

test('Fernharmonie und Kontaktkante nutzen bestehende Daten ohne neuen Pass', () => {
  assert.match(materials, /terraHoch/);
  assert.match(materials, /terraFern \* terraHoch \* 0\.18/);
  assert.match(materials, /terraFern \* 0\.055/);
  assert.match(pipeline, /float fussKante/);
  assert.match(pipeline, /max\( max\( bl, b \), br \)/);
  /* Drei Passes waren die Zusage des Final-Art-Passes: Strahlen, Grade,
     Kante — die "filmische Tiefe" durfte keine zusaetzliche Renderlast
     kosten, und daran hat sich nichts geaendert.

     Der vierte Pass gehoert einer anderen Runde und einem anderen Befund.
     Die Bildabnahme hat die Gelaendesilhouette als harte, VIER Bildpunkte
     breite Treppe beanstandet. Vier ist die Signatur des halbaufgeloesten
     Tiefen-Prepasses: der Sobel des Kante-Passes zeichnet seine Linie in
     2x2-Bloecken, und weil eine Tiefentextur in WebGL2 zwingend
     NearestFilter traegt, rastet sie darauf ein. Diese Linie entsteht ERST
     im Bildraum — die MSAA-Abtastungen des Composer-Ziels koennen sie
     prinzipbedingt nicht erwischen, und kein Pass vor dem OutputPass sieht
     das fertige, gammakodierte Bild.

     Deshalb steht hier jetzt 4 und nicht 3. Die Zahl bleibt eine harte
     Obergrenze: sie faellt, sobald jemand einen fuenften Vollbildpass
     hinzufuegt, ohne ihn hier zu begruenden. */
  assert.equal((pipeline.match(/new ShaderPass/g) || []).length, 4,
    'nur Strahlen, Grade, Kante und Kantenglaettung duerfen Vollbildpasses sein');
  assert.doesNotMatch(pipeline, /\buKorn\b|float\s+korn\s*\(|\bbayer4\s*\(/);
});
