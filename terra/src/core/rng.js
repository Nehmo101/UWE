// Deterministische Zufalls- und Mathe-Grundlagen. Kein Math.random im Projekt.
var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
var lerp = function (a, b, t) { return a + (b - a) * t; };
/** Smoothstep zwischen zwei Kanten; e1 darf kleiner als e0 sein. */
function sstep(e0, e1, x) {
  var t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
var DEG = Math.PI / 180;

/** Integer-Hash → 0..1. Grundlage für alles Zufällige im Programm. */
function hashi(x, y, s) {
  var h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h ^= h >>> 15; h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Geglättetes 2D-Value-Noise (bilinear + Smoothstep). */
function vnoise(x, z, s) {
  var xi = Math.floor(x), zi = Math.floor(z);
  var fx = x - xi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  var a = hashi(xi, zi, s), b = hashi(xi + 1, zi, s);
  var c = hashi(xi, zi + 1, s), d = hashi(xi + 1, zi + 1, s);
  var ab = a + (b - a) * fx, cd = c + (d - c) * fx;
  return ab + (cd - ab) * fz;
}

/**
 * 4 Oktaven fraktales Rauschen, Rückgabe 0..1. Die Summe der Oktaven drängt
 * zur Mitte, deshalb wird sie zum Schluss über eine S-Kurve gespreizt —
 * sonst bliebe die Karte eine gleichförmige Ebene.
 */
function fractal(x, z, s, oct) {
  oct = oct || 4;
  var sum = 0, amp = 1, norm = 0, f = 1;
  for (var i = 0; i < oct; i++) {
    sum += vnoise(x * f, z * f, (s + i * 1013) | 0) * amp;
    norm += amp; amp *= 0.5; f *= 2;
  }
  var v = sum / norm;
  v = v * v * (3 - 2 * v);
  return clamp((v - 0.5) * 1.4 + 0.5, 0, 1);
}

/** Deterministischer Zufallsstrom (mulberry32) — ersetzt Math.random komplett. */
function rngOf(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rr(rng, a, b) { return a + (b - a) * rng(); }
function ri(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
/** Gewichtete Auswahl aus [[wert, gewicht], ...] */
function wpick(rng, table) {
  var total = 0, i;
  for (i = 0; i < table.length; i++) total += table[i][1];
  var r = rng() * total;
  for (i = 0; i < table.length; i++) { r -= table[i][1]; if (r <= 0) return table[i][0]; }
  return table[table.length - 1][0];
}

export { clamp, lerp, sstep, DEG, hashi, vnoise, fractal, rngOf, rr, ri, wpick };
