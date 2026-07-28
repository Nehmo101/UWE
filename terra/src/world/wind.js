// Gemeinsame Windfunktion: eine Boee laeuft ueber die Karte. Alle bewegten
// Materialien (Bodenflor, Kronenkarten, Rankenblaetter) teilen dieselben
// Uniforms und schwingen damit im gleichen Takt. Die GLSL-Seite steckt in
// materials.js (Wind-Patch); hier leben Uniform, Takt und die Windfunktion.
//
// F5 — Bewegungsdisziplin: Frueher schwang die ganze Karte gleich stark. In
// den Vorlagen steht fast alles still und EINE Sache bewegt sich. Deshalb ist
// die globale Amplitude auf rund ein Drittel gesenkt und stattdessen eine
// oertliche Verstaerkung (terraNester) eingezogen: ein sehr niederfrequentes
// Rauschen ueber die Weltkoordinaten, das in wenigen Nestern deutlich ueber
// 1.0 geht. Dort wogt es sichtbar staerker als frueher, dazwischen steht es
// nahezu still.
// (kein three-Import noetig — dieses Modul haelt nur Uniform-Objekte, Zahlen
// und GLSL-Text; das macht es in Node ohne three-Stub pruefbar.)
import { sstep, fractal } from '../core/rng.js';

/** Von allen Wind-Materialien geteilte Uniforms. */
const windUniforms = {
  uWindZeit: { value: 0 },
  uWindStaerke: { value: 1.0 }
};

/* --- Nester: Parameter der oertlichen Verstaerkung -----------------------
   Frequenz 0.0055 heisst: eine Rauschzelle ist rund 182 Welteinheiten breit.
   Auf einer 512er-Karte (Spanne 1024) liegen damit rund 5-6 Zellen, auf einer
   256er rund 3 — also einige wenige Nester, nicht ein Flimmerteppich.
   Zwei Oktaven reichen; mehr kostet nur Vertex-ALU ohne sichtbaren Gewinn. */
const NEST_FREQ = 0.0055;
const NEST_SEED = 9;
const NEST_OKT = 2;
/* Verstaerkung = NEST_BASIS + NEST_RAMPE * n + NEST_SPITZE * nest^2
   mit nest = smoothstep(NEST_KANTE0, NEST_KANTE1, n).
   Ruhezone (n bis ~0.80):  0.28 .. 0.46  → fast still
   Nester   (n > ~0.89):    > 1.0, Spitze 2.70 bei n = 1
   Gemessen ueber die ganze Karte (Raster 4, siehe Bericht):
     HALF=256  Mittel 0.563, Nesterflaeche  9.1 %, Spitze 2.70
     HALF=512  Mittel 0.556, Nesterflaeche  9.2 %, Spitze 2.70
   Der Seed ist so gewaehlt, dass beide Kartengroessen denselben Nesteranteil
   sehen — bei einem beliebigen Seed kann das Kartenfenster in einem Hoch des
   Rauschens liegen und dann waere die halbe Karte ein Nest. */
const NEST_BASIS = 0.28, NEST_RAMPE = 0.22, NEST_SPITZE = 2.20;
const NEST_KANTE0 = 0.80, NEST_KANTE1 = 0.98;

/**
 * JS-Spiegel der Shader-Verstaerkung — bis auf float32-Rundung wertgleich mit
 * terraNester() im GLSL unten. Fuer Werkzeuge, Tests und Debug-Anzeigen; die
 * Darstellung selbst rechnet ausschliesslich im Shader.
 */
function windVerstaerkung(x, z) {
  var n = fractal(x * NEST_FREQ, z * NEST_FREQ, NEST_SEED, NEST_OKT);
  var nest = sstep(NEST_KANTE0, NEST_KANTE1, n);
  return NEST_BASIS + NEST_RAMPE * n + NEST_SPITZE * nest * nest;
}

/* --- Globale Amplituden -------------------------------------------------
   Vorher: 0.28 * grund + 0.85 * boee^2. Jetzt rund 43 % bzw. 40 % davon,
   dafuer mal terraNester(). Im Mittel (Verstaerkung ~0.56) bleibt damit rund
   ein Viertel der alten Bewegung uebrig, in der Ruhezone (0.28..0.46) sogar
   nur ein Sechstel; in den Nestern (bis 2.70) sind es rund 110 % — dort wogt
   es also eher etwas staerker als frueher.
   uWindStaerke (atmosphere.js: Sturm 2.6) multipliziert das Ergebnis in
   materials.js UNVERAENDERT weiter — die Wetterskala schlaegt voll durch,
   weil die Verstaerkung rein multiplikativ in derselben Funktion sitzt. */
const AMP_GRUND = 0.12;   // vorher 0.28
const AMP_BOEE = 0.34;    // vorher 0.85

/**
 * GLSL-Ausdruck fuer die Auslenkung an einer Weltposition (vec3 wp):
 * Grundschwingung plus wandernde Boeenfront, oertlich verstaerkt. Ergebnis
 * ist ein vec2 (XZ).
 *
 * terraHashi/terraVnoise/terraFraktal sind exakte Portierungen von hashi/
 * vnoise/fractal aus core/rng.js (GLSL ES 3.00, uint-Arithmetik wrappt wie
 * Math.imul). Damit ist das Nestfeld deterministisch UND identisch mit dem,
 * was windVerstaerkung() auf der CPU liefert.
 */
const WIND_GLSL = [
  'uint terraHashU( int x, int z, int s ) {',
  '  uint h = uint( x ) * 0x27d4eb2du ^ uint( z ) * 0x165667b1u ^ uint( s ) * 0x9e3779b1u;',
  '  h ^= h >> 15u; h *= 0x85ebca6bu;',
  '  h ^= h >> 13u; h *= 0xc2b2ae35u;',
  '  h ^= h >> 16u;',
  '  return h;',
  '}',
  'float terraHashi( int x, int z, int s ) {',
  '  return float( terraHashU( x, z, s ) ) / 4294967296.0;',
  '}',
  'float terraVnoise( float x, float z, int s ) {',
  '  float xf = floor( x ), zf = floor( z );',
  '  int xi = int( xf ), zi = int( zf );',
  '  float fx = x - xf, fz = z - zf;',
  '  fx = fx * fx * ( 3.0 - 2.0 * fx ); fz = fz * fz * ( 3.0 - 2.0 * fz );',
  '  float a = terraHashi( xi, zi, s ),         b = terraHashi( xi + 1, zi, s );',
  '  float c = terraHashi( xi, zi + 1, s ),     d = terraHashi( xi + 1, zi + 1, s );',
  '  float ab = a + ( b - a ) * fx, cd = c + ( d - c ) * fx;',
  '  return ab + ( cd - ab ) * fz;',
  '}',
  // fractal(x, z, s, 2): zwei Oktaven, Normierung 1.5, dann S-Kurve + Spreizung
  'float terraFraktal( float x, float z, int s ) {',
  '  float sum = terraVnoise( x, z, s ) + 0.5 * terraVnoise( x * 2.0, z * 2.0, s + 1013 );',
  '  float v = sum / 1.5;',
  '  v = v * v * ( 3.0 - 2.0 * v );',
  '  return clamp( ( v - 0.5 ) * 1.4 + 0.5, 0.0, 1.0 );',
  '}',
  // Oertliche Verstaerkung: fast ueberall < 0.6, in wenigen Nestern > 1.
  'float terraNester( vec3 wp ) {',
  '  float n = terraFraktal( wp.x * ' + NEST_FREQ.toFixed(5) + ', wp.z * ' +
    NEST_FREQ.toFixed(5) + ', ' + (NEST_SEED | 0) + ' );',
  '  float nest = smoothstep( ' + NEST_KANTE0.toFixed(3) + ', ' + NEST_KANTE1.toFixed(3) + ', n );',
  '  return ' + NEST_BASIS.toFixed(3) + ' + ' + NEST_RAMPE.toFixed(3) + ' * n + ' +
    NEST_SPITZE.toFixed(3) + ' * nest * nest;',
  '}',
  'vec2 terraWind( vec3 wp, float t ) {',
  '  float grund = sin( wp.x * 0.045 + t * 1.15 ) * sin( wp.z * 0.05 + t * 0.85 );',
  '  float boee = sin( ( wp.x + wp.z ) * 0.02 - t * 1.9 );',
  '  boee = max( 0.0, boee ) * max( 0.0, sin( ( wp.x - wp.z ) * 0.013 - t * 0.53 ) );',
  '  float amp = ( ' + AMP_GRUND.toFixed(3) + ' * grund + ' + AMP_BOEE.toFixed(3) +
    ' * boee * boee ) * terraNester( wp );',
  '  return vec2( 0.8, 0.55 ) * amp;',
  '}'
].join('\n');

/** Pro Frame vom Hauptloop bedient. */
function tickWind(now) {
  windUniforms.uWindZeit.value = (now % 3600);
}

export { windUniforms, WIND_GLSL, tickWind, windVerstaerkung,
  NEST_FREQ, NEST_SEED, NEST_OKT };
