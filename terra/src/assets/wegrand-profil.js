/* ==========================================================================
   Wegrand-Querprofil

   Ein Weg braucht keinen zweiten Mesh fuer seinen Saum. Sieben Punkte quer
   zur Laufrichtung genuegen fuer dieselbe Einzelgeometrie:

     Boden | Erdkante | Fahrspur | Krone | Fahrspur | Erdkante | Boden

   Die aeusseren Punkte tragen bereits die lokale Terrainfarbe. Dazwischen
   interpoliert die vorhandene Vertexfarbe weich in den Weg, statt dass ein
   helles Band mit einer harten Scherenkante auf dem Gruen liegt.
   ========================================================================== */

export var WEG_PROFIL_PUNKTE = 7;

var ABSTAND = Object.freeze([1.12, 0.76, 0.34, 0, -0.34, -0.76, -1.12]);
var TON = Object.freeze([1, 0.68, 0.58, 0.74, 0.58, 0.68, 1]);
var ERDWAERME = Object.freeze([1.08, 1.0, 0.78]);
var BRUECKE_TON = Object.freeze([0.52, 0.70, 0.58, 0.82, 0.58, 0.70, 0.52]);
var HOLZ = Object.freeze([0.40, 0.29, 0.19]);

function farbeDrei(f, name) {
  if (!f || f.length < 3) throw new TypeError(name + ' braucht drei Farbwerte');
  var raus = [Number(f[0]), Number(f[1]), Number(f[2])];
  for (var i = 0; i < 3; i++) {
    if (!Number.isFinite(raus[i])) throw new TypeError(name + ' enthaelt keine endliche Farbe');
  }
  return raus;
}

function profilPunkt(opt, u, index) {
  var links = u >= 0;
  var anteil = opt.bruecke ? u / 1.12 : u;
  var breite = links ? opt.links : opt.rechts;
  var x = opt.x + opt.nx * breite * anteil;
  var z = opt.z + opt.nz * breite * anteil;
  var y;
  var farbe;
  if (opt.bruecke) {
    y = opt.deck;
    farbe = [
      HOLZ[0] * opt.variation * BRUECKE_TON[index],
      HOLZ[1] * opt.variation * BRUECKE_TON[index],
      HOLZ[2] * opt.variation * BRUECKE_TON[index]
    ];
  } else {
    var h = opt.hoeheAt(x, z);
    if (index === 0 || index === WEG_PROFIL_PUNKTE - 1) {
      y = h + 0.018;
      farbe = farbeDrei(opt.bodenFarbe(x, z, h), 'bodenFarbe');
    } else {
      var hub = index === 3 ? 0.145
        : (index === 2 || index === 4 ? 0.09 - opt.einsinken * 0.15
          : 0.09 - opt.einsinken);
      y = h + hub;
      farbe = [
        opt.farbe[0] * opt.variation * TON[index] * ERDWAERME[0],
        opt.farbe[1] * opt.variation * TON[index] * ERDWAERME[1],
        opt.farbe[2] * opt.variation * TON[index] * ERDWAERME[2]
      ];
    }
  }
  return { x: x, y: y, z: z, farbe: farbe, quer: u };
}

/**
 * Reines Querprofil. Hoehen- und Terrainfarbfunktion werden hereingereicht,
 * damit der Baustein ohne Weltzustand pruefbar bleibt.
 */
export function wegrandProfil(opt) {
  if (!opt || typeof opt.hoeheAt !== 'function' || typeof opt.bodenFarbe !== 'function') {
    throw new TypeError('wegrandProfil braucht hoeheAt und bodenFarbe');
  }
  var zahlen = ['x', 'z', 'nx', 'nz', 'links', 'rechts', 'deck', 'einsinken', 'variation'];
  for (var i = 0; i < zahlen.length; i++) {
    if (!Number.isFinite(opt[zahlen[i]])) throw new TypeError('wegrandProfil: ' + zahlen[i] + ' fehlt');
  }
  if (!(opt.links > 0) || !(opt.rechts > 0)) {
    throw new RangeError('wegrandProfil braucht positive Halbbreiten');
  }
  var daten = Object.assign({}, opt, { farbe: farbeDrei(opt.farbe, 'wegFarbe') });
  var raus = new Array(WEG_PROFIL_PUNKTE);
  for (i = 0; i < WEG_PROFIL_PUNKTE; i++) {
    raus[i] = profilPunkt(daten, ABSTAND[i], i);
  }
  return raus;
}
