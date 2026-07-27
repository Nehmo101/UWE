// Gemeinsame Windfunktion: eine Boee laeuft ueber die Karte. Alle bewegten
// Materialien (Bodenflor, Kronenkarten, Rankenblaetter) teilen dieselben
// Uniforms und schwingen damit im gleichen Takt. Die GLSL-Seite steckt in
// materials.js (Wind-Patch); hier leben Uniform und Takt.
import * as THREE from 'three';

/** Von allen Wind-Materialien geteilte Uniforms. */
const windUniforms = {
  uWindZeit: { value: 0 },
  uWindStaerke: { value: 1.0 }
};

/**
 * GLSL-Ausdruck fuer die Auslenkung an einer Weltposition (vec3 wp):
 * Grundschwingung plus wandernde Boeenfront. Ergebnis ist ein vec2 (XZ).
 */
const WIND_GLSL = [
  'vec2 terraWind( vec3 wp, float t ) {',
  '  float grund = sin( wp.x * 0.045 + t * 1.15 ) * sin( wp.z * 0.05 + t * 0.85 );',
  '  float boee = sin( ( wp.x + wp.z ) * 0.02 - t * 1.9 );',
  '  boee = max( 0.0, boee ) * max( 0.0, sin( ( wp.x - wp.z ) * 0.013 - t * 0.53 ) );',
  '  float amp = 0.28 * grund + 0.85 * boee * boee;',
  '  return vec2( 0.8, 0.55 ) * amp;',
  '}'
].join('\n');

/** Pro Frame vom Hauptloop bedient. */
function tickWind(now) {
  windUniforms.uWindZeit.value = (now % 3600);
}

export { windUniforms, WIND_GLSL, tickWind };
