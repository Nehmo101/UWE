// Texturfabrik: alles im Canvas gezeichnet, deterministisch ueber die
// Seed-Hashfunktion. Farbtragende Texturen laufen als sRGB, Daten bleiben linear.
import * as THREE from 'three';
import { clamp, lerp, sstep, hashi, vnoise, fractal } from '../core/rng.js';

var TEX = {};
function texCanvas(size) {
  var c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}
function texFinish(canvas, name, wrap) {
  var t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  TEX[name] = t;
  return t;
}
/** Schreibt ein per-Pixel erzeugtes Bild; fn(u, v, out[4]) liefert RGBA 0..1. */
function texPaint(size, fn) {
  var c = texCanvas(size), ctx = c.getContext("2d");
  var img = ctx.createImageData(size, size), d = img.data, out = [1, 1, 1, 1];
  for (var j = 0; j < size; j++) {
    for (var i = 0; i < size; i++) {
      out[0] = out[1] = out[2] = 1; out[3] = 0;
      fn((i + 0.5) / size, (j + 0.5) / size, out);
      var k = (j * size + i) * 4;
      d[k] = clamp(out[0], 0, 1) * 255;
      d[k + 1] = clamp(out[1], 0, 1) * 255;
      d[k + 2] = clamp(out[2], 0, 1) * 255;
      d[k + 3] = clamp(out[3], 0, 1) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}


(function bauTexturen() {
  // --- Kontaktschatten: radialer Alphaverlauf, Mitte 55 %, Rand 0, unrund ---
  texFinish(texPaint(128, function (u, v, o) {
    var dx = (u - 0.5) * 2, dy = (v - 0.5) * 2;
    var r = Math.sqrt(dx * dx + dy * dy), a = Math.atan2(dy, dx);
    var wob = 1 + (vnoise(Math.cos(a) * 2.3 + 5, Math.sin(a) * 2.3 + 5, 9911) - 0.5) * 0.3;
    o[3] = Math.pow(1 - clamp(r / wob, 0, 1), 1.7) * 0.55;
  }), "shadowBlob", false);

  /* --- Wolkenballen: klare, harte Oberkante, weich ausfransende Unterkante.
     Die Kantenhaerte laeuft ueber die Bildhoehe: oben schmale Schwelle,
     unten breite — das Erkennungsmerkmal gemalter Cumulus. -------------- */
  var lobes = [];
  for (var k = 0; k < 7; k++) {
    lobes.push({
      x: 0.5 + (hashi(k, 1, 771) - 0.5) * 0.56,
      y: 0.46 + (hashi(k, 2, 771) - 0.5) * 0.16 + hashi(k, 5, 771) * 0.10,
      r: 0.15 + hashi(k, 3, 771) * 0.20
    });
  }
  texFinish(texPaint(256, function (u, v, o) {
    var a = 0;
    for (var l = 0; l < lobes.length; l++) {
      var L = lobes[l], dx = u - L.x, dy = (v - L.y) * 1.35;
      a = Math.max(a, 1 - clamp(Math.sqrt(dx * dx + dy * dy) / L.r, 0, 1));
    }
    a *= 0.62 + fractal(u * 6.5, v * 6.5, 3131) * 0.7;
    var hart = 1 - sstep(0.30, 0.78, v);             // oben 1 (hart), unten 0 (weich)
    var w = lerp(0.34, 0.035, hart);
    var alpha = sstep(0.44 - w, 0.44 + w, clamp(a, 0, 1));
    // Unterkante zusaetzlich ausduennen — sie soll ausfransen, nicht abschneiden
    alpha *= 1 - sstep(0.82, 1.0, v) * 0.85;
    o[3] = alpha;
    o[0] = 1; o[1] = 1; o[2] = 1;                     // Farbe kommt aus dem Verlauf im Shader
  }), "cloudPuff", false);

  /* --- Zirren: langgezogene, duenne Streifen fuer die hohe Schicht ------- */
  texFinish(texPaint(256, function (u, v, o) {
    var band = fractal(u * 2.2, v * 14, 6161);
    var faser = fractal(u * 9, v * 44, 6262);
    var mitte = Math.abs(v - 0.5 + (band - 0.5) * 0.35);
    var a = (1 - sstep(0.05, 0.34, mitte)) * (0.35 + faser * 0.65);
    a *= sstep(0.0, 0.14, u) * sstep(1.0, 0.86, u);   // Enden auslaufen lassen
    o[3] = clamp(a, 0, 1) * 0.8;
    o[0] = o[1] = o[2] = 1;
  }), "cirrus", false);

  /* --- Sonnenscheibe mit weitem, sehr schwachem Halo -------------------- */
  texFinish(texPaint(256, function (u, v, o) {
    var dx = (u - 0.5) * 2, dy = (v - 0.5) * 2;
    var r = Math.sqrt(dx * dx + dy * dy);
    var kern = 1 - sstep(0.055, 0.085, r);
    var halo = Math.pow(Math.max(0, 1 - r), 2.6) * 0.30;
    o[3] = clamp(kern + halo, 0, 1);
    o[0] = 1; o[1] = 0.98; o[2] = 0.94;
  }), "sunDisc", false);

  /* --- Weiches radiales Gluehen (Gegenglühen am Horizont) --------------- */
  texFinish(texPaint(128, function (u, v, o) {
    var dx = (u - 0.5) * 2, dy = (v - 0.5) * 2;
    var r = Math.sqrt(dx * dx + dy * dy);
    o[3] = Math.pow(Math.max(0, 1 - r), 2.2);
    o[0] = o[1] = o[2] = 1;
  }), "glow", false);

  /* --- Wolkenschatten-Rauschen: kachelbar, weiche grosse Flecken -------- */
  texFinish(texPaint(256, function (u, v, o) {
    // kachelbar: zwei um halbe Periode versetzte Abtastungen ueberblenden
    var n1 = fractal(u * 4, v * 4, 7431);
    var n2 = fractal(((u + 0.5) % 1) * 4, ((v + 0.5) % 1) * 4, 7431);
    var wx = Math.abs(u - 0.5) * 2, wy = Math.abs(v - 0.5) * 2;
    var g = Math.max(wx, wy);
    var n = lerp(n1, n2, sstep(0.62, 0.98, g));
    o[0] = o[1] = o[2] = n; o[3] = 1;
  }), "cloudNoise", true);

  // --- Grasbüschel: 5–9 schmale, oben spitze Halme, reines Alpha ---
  var halme = 5 + Math.floor(hashi(7, 7, 5150) * 5);
  var halm = [];
  for (var h = 0; h < halme; h++) {
    halm.push({
      x: 0.12 + hashi(h, 11, 5150) * 0.76,
      b: 0.02 + hashi(h, 12, 5150) * 0.035,
      hoehe: 0.55 + hashi(h, 13, 5150) * 0.42,
      neig: (hashi(h, 14, 5150) - 0.5) * 0.34
    });
  }
  texFinish(texPaint(128, function (u, v, o) {
    var y = 1 - v;                                   // 0 unten
    var a = 0;
    for (var i = 0; i < halm.length; i++) {
      var H = halm[i];
      if (y > H.hoehe) continue;
      var t = y / H.hoehe;
      var mitte = H.x + H.neig * t * t;
      var br = H.b * (1 - t) + 0.004;
      var d = Math.abs(u - mitte);
      if (d < br) a = Math.max(a, 1 - sstep(br * 0.45, br, d));
    }
    o[3] = a;
    var g = 0.72 + y * 0.3;
    o[0] = g * 0.86; o[1] = g; o[2] = g * 0.62;
  }), "grassTuft", false);

  // --- Blatt: Oval mit Mittelrippe und Spitze ---
  texFinish(texPaint(128, function (u, v, o) {
    var t = u;                                       // 0 Stiel, 1 Spitze
    var hw = Math.sin(Math.PI * Math.pow(t, 0.7)) * 0.42 * (1 - t * 0.12);
    var d = Math.abs(v - 0.5);
    if (d > hw || t > 0.995) { o[3] = 0; return; }
    o[3] = 1 - sstep(hw * 0.82, hw, d);
    var rippe = 1 - Math.min(1, d / 0.035);
    var ader = 1 - Math.min(1, Math.abs(((t * 5 + d * 3) % 1) - 0.5) * 7);
    var hell = 0.82 + rippe * 0.35 + ader * 0.12 * t;
    o[0] = 0.30 * hell; o[1] = 0.44 * hell; o[2] = 0.24 * hell;
  }), "leafBlade", false);

  // --- Uferschaum: unregelmäßiger weicher weißer Streifen, kachelbar ---
  texFinish(texPaint(128, function (u, v, o) {
    var band = fractal(u * 5.5, v * 5.5, 4242);
    var streifen = 1 - Math.min(1, Math.abs(v - 0.5 + (band - 0.5) * 0.4) * 4.2);
    var a = Math.pow(clamp(streifen, 0, 1), 1.5) * (0.5 + band * 0.7);
    o[3] = clamp(a, 0, 1) * 0.85;
    o[0] = o[1] = o[2] = 1;
  }), "foamEdge", true);

  /* --- Malerische Flaechentexturen: Aquarell in drei Koernungen ----------
     Mehrere Rauschoktaven, weiche Ton-/Helligkeitsverschiebung, vereinzelte
     dunklere Raender wie auslaufende Farbe. Kachelbar; wird im Shader in
     Weltkoordinaten abgetastet, damit die Koernung nie mitskaliert. ------ */
  function aquarell(name, grund, kontrast, seed) {
    texFinish(texPaint(256, function (u, v, o) {
      function tile(f, sd) {
        var n1 = fractal(u * f, v * f, sd);
        var n2 = fractal(((u + 0.5) % 1) * f, ((v + 0.5) % 1) * f, sd);
        var g = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2;
        return lerp(n1, n2, sstep(0.66, 0.98, g));
      }
      var a = tile(grund, seed);
      var b = tile(grund * 3.1, seed + 7);
      var c = tile(grund * 8.3, seed + 13);
      var wert = 0.5 + (a - 0.5) * 0.9 + (b - 0.5) * 0.5 + (c - 0.5) * 0.25;
      // auslaufende Farbraender: schmale dunklere Kanten an Rauschschwellen
      var rand = 1 - (1 - sstep(0.008, 0.045, Math.abs(a - 0.52))) * 0.16;
      var hell = clamp(0.5 + (wert - 0.5) * kontrast, 0, 1) * rand;
      // leichter Farbtonversatz: warm/kuehl gegenlaeufig zu zwei Oktaven
      var warm = (b - 0.5) * 0.10, kuehl = (c - 0.5) * 0.07;
      o[0] = clamp(0.5 + (hell - 0.5) + warm, 0, 1);
      o[1] = clamp(0.5 + (hell - 0.5) + warm * 0.35 + kuehl * 0.3, 0, 1);
      o[2] = clamp(0.5 + (hell - 0.5) - warm * 0.6 + kuehl, 0, 1);
      o[3] = 1;
    }), name, true);
  }
  aquarell("aquarellGrob", 3.2, 1.05, 2201);
  aquarell("aquarellMittel", 5.6, 0.85, 2207);
  aquarell("aquarellFein", 11.0, 0.65, 2213);

  /* --- F2 Malschicht: bildraumfeste Papier- und Pinselstruktur -----------
     Gegenstueck zu den drei Aquarelltexturen darueber, mit dem GENAU
     UMGEKEHRTEN Bezugssystem: die Aquarellschicht wird im Shader in
     WELTkoordinaten abgetastet (Materialidentitaet — der Fels behaelt seine
     Koernung, egal wie nah man herangeht), diese hier wird im Post-Pass in
     BILDkoordinaten abgetastet. Auf einem Gemaelde ist der Strich am fernen
     Berg so breit wie der im Vordergrund; wuerde die Malschicht mitskalieren,
     verschwaende sie in der Ferne genau dort, wo unser Bild am digitalsten
     wirkt (Ideenwelle 2, F2).

     Deshalb ist die Textur bewusst NIEDERfrequent: sie beschreibt den
     Bildtraeger (Papierfaser, Pinselzug, Pigmentgranulation), nicht das
     Filmkorn. Das Korn im Post-Pass ist hochfrequent und laeuft mit uZeit
     mit; diese Textur steht still. Beides nebeneinander liest sich als
     "gemaltes Bild, abgefilmt" — vertauscht man die Rollen, bekommt man
     entweder ein kribbelndes Papier oder ein statisches Korn, das wie ein
     verschmutzter Sensor aussieht.

     Kachelbar ueber dieselbe Ueberblendung wie bei aquarell(): an der Kante
     (g = 1) wird der um eine halbe Periode versetzte Zweitwert genommen, und
     der stimmt bei u = 0 und u = 1 exakt ueberein. Anders als dort duerfen
     die Frequenzen je Achse verschieden sein — genau daraus entstehen die
     langgezogenen Bahnen und Zuege. Rein datentragend, also KEIN sRGB. --- */
  (function malschichtTextur() {
    var N = 256;
    function tile(u, v, fx, fy, sd) {
      var n1 = fractal(u * fx, v * fy, sd);
      var n2 = fractal(((u + 0.5) % 1) * fx, ((v + 0.5) % 1) * fy, sd);
      var g = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2;
      return lerp(n1, n2, sstep(0.66, 0.98, g));
    }
    // Erst rechnen, dann normieren, dann schreiben. Die Normierung ist hier
    // NICHT kosmetisch: die Schicht wird im Shader multiplikativ um 0.5 herum
    // aufgetragen (c *= 1 + (wert - 0.5) * ...). Haette ein Kanal einen
    // Mittelwert von z. B. 0.41 — und fractal() liefert ueber ein endliches
    // Feld genau solche Abweichungen —, dann verdunkelte die Malschicht das
    // ganze Bild gleichmaessig, statt es nur zu strukturieren. Also je Kanal
    // Mittelwert exakt auf 0.5 und Streuung auf SIGMA ziehen.
    var SIGMA = 0.15;   // ±1σ ≈ 15 % Struktur; bei Staerke 0.12 sind das gut 2 %
    var kanal = [new Float32Array(N * N), new Float32Array(N * N), new Float32Array(N * N)];
    for (var j = 0; j < N; j++) {
      for (var i = 0; i < N; i++) {
        var u = (i + 0.5) / N, v = (j + 0.5) / N, k = j * N + i;
        // R — Papierfaser: langgezogene Schoepfrippen plus feine Narbe.
        kanal[0][k] = (tile(u, v, 4.5, 29.0, 8801) - 0.5) * 0.85
                    + (tile(u, v, 13.0, 61.0, 8807) - 0.5) * 0.45;
        // G — Pinselzug: breite Bahnen in einer Vorzugsrichtung, schwache
        //     Gegenlage, damit es nach Handgelenk aussieht und nicht nach Kamm.
        kanal[1][k] = (tile(u, v, 2.6, 12.0, 8813) - 0.5) * 1.00
                    + (tile(u, v, 11.0, 3.1, 8819) - 0.5) * 0.35;
        // B — Pigmentwolken: sehr niederfrequente Granulation (dort, wo sich
        //     Farbe in den Papiertaelern sammelt).
        kanal[2][k] = (tile(u, v, 2.0, 2.3, 8821) - 0.5) * 1.15;
      }
    }
    for (var c = 0; c < 3; c++) {
      var d = kanal[c], summe = 0, q = 0, p;
      for (p = 0; p < d.length; p++) summe += d[p];
      var mittel = summe / d.length;
      for (p = 0; p < d.length; p++) q += (d[p] - mittel) * (d[p] - mittel);
      var skala = SIGMA / Math.max(Math.sqrt(q / d.length), 1e-6);
      for (p = 0; p < d.length; p++) d[p] = 0.5 + (d[p] - mittel) * skala;
    }
    texFinish(texPaint(N, function (u, v, o) {
      var k = Math.floor(v * N) * N + Math.floor(u * N);
      o[0] = clamp(kanal[0][k], 0, 1);
      o[1] = clamp(kanal[1][k], 0, 1);
      o[2] = clamp(kanal[2][k], 0, 1);
      o[3] = 1;
    }), "malschicht", true);
  })();

  /* --- Kronenkarten: gemalte Blattmassen-Silhouetten ---------------------
     Geclusterte Ballen, innen dicht, aussen aufgeloest, abgesetzte
     Blattgruppen am Rand. -------------------------------------------- */
  function krone(name, ballenN, streu, kern, seed) {
    var ballen = [];
    for (var k = 0; k < ballenN; k++) {
      var a = hashi(k, 1, seed) * Math.PI * 2;
      var r = Math.pow(hashi(k, 2, seed), 0.6) * streu;
      ballen.push({
        x: 0.5 + Math.cos(a) * r * 0.42,
        y: 0.46 + Math.sin(a) * r * 0.34 - r * 0.05,
        r: kern * (0.55 + hashi(k, 3, seed) * 0.7)
      });
    }
    for (var m = 0; m < 5; m++) {   // abgesetzte Blattgruppen am Rand
      var aa = hashi(m, 9, seed) * Math.PI * 2;
      ballen.push({ x: 0.5 + Math.cos(aa) * 0.42, y: 0.47 + Math.sin(aa) * 0.36,
        r: kern * 0.22 * (0.6 + hashi(m, 11, seed)) });
    }
    texFinish(texPaint(256, function (u, v, o) {
      var d = 0;
      for (var i = 0; i < ballen.length; i++) {
        var B = ballen[i], dx = u - B.x, dy = (v - B.y) * 1.12;
        d = Math.max(d, 1 - Math.sqrt(dx * dx + dy * dy) / B.r);
      }
      var fr = fractal(u * 9, v * 9, seed + 31);
      var alpha = sstep(0.16 + (fr - 0.5) * 0.34, 0.34 + (fr - 0.5) * 0.2, d);
      alpha *= 0.75 + fractal(u * 17, v * 17, seed + 41) * 0.45;
      o[3] = clamp(alpha, 0, 1);
      var licht = 0.62 + (1 - v) * 0.5 + (fr - 0.5) * 0.22;
      o[0] = licht; o[1] = licht; o[2] = licht * 0.94;
    }), name, false);
  }
  krone("kroneRund", 7, 0.9, 0.34, 3301);
  krone("kroneSchmal", 5, 0.5, 0.30, 3307);
  krone("kroneZerzaust", 9, 1.15, 0.22, 3313);

  /* --- Nadelkrone: gestapelte, ausgefranste Lagen ------------------------ */
  texFinish(texPaint(256, function (u, v, o) {
    var y = 1 - v;
    var hw = (1 - y) * 0.42 + 0.03;
    var lage = Math.abs(((y * 6.5) % 1) - 0.45) * 0.14;
    var fr = fractal(u * 12, v * 12, 3319);
    var d = Math.abs(u - 0.5) - lage;
    var alpha = sstep(hw, hw * 0.55, d + (fr - 0.5) * 0.12);
    alpha *= sstep(0.0, 0.05, y) * (0.7 + fr * 0.5);
    o[3] = clamp(alpha, 0, 1);
    var licht = 0.55 + y * 0.5 + (fr - 0.5) * 0.2;
    o[0] = licht; o[1] = licht; o[2] = licht * 0.96;
  }), "kroneNadel", false);

  /* --- Grosses Rankenblatt: cremeweiss, helle Raender, Mittelrippe ------- */
  texFinish(texPaint(256, function (u, v, o) {
    var t = u;
    var hw = Math.sin(Math.PI * Math.pow(t, 0.62)) * 0.42 * (1 - t * 0.1);
    var fr = fractal(u * 7, v * 7, 3407);
    var d = Math.abs(v - 0.5);
    var alpha = sstep(hw, hw * 0.86, d - (fr - 0.5) * 0.05);
    if (t < 0.03) alpha *= sstep(0.0, 0.03, t);
    o[3] = alpha;
    var rippe = 1 - Math.min(1, d / 0.03);
    var ader = 1 - Math.min(1, Math.abs(((t * 6 + d * 4) % 1) - 0.5) * 6);
    var rand = sstep(hw * 0.5, hw * 0.92, d);
    // cremeweiss mit gruenlichem Unterton; Raender hell, Adern deutlich dunkler
    var hell = 0.78 + rand * 0.24 + rippe * 0.14 - ader * 0.16 + (fr - 0.5) * 0.10;
    o[0] = hell * 0.97; o[1] = hell; o[2] = hell * 0.80;
  }), "rankenBlatt", false);

  /* --- Bluetenquad: Halm mit hellem Bluetenkopf -------------------------- */
  texFinish(texPaint(128, function (u, v, o) {
    var y = 1 - v;
    var halm = 1 - Math.min(1, Math.abs(u - 0.5 + (fractal(v * 4, 0.3, 3502) - 0.5) * 0.2) * 9);
    var a = halm * sstep(0.0, 0.15, y) * (1 - sstep(0.55, 0.75, y));
    var kopf = 1 - Math.min(1, Math.hypot(u - 0.5, y - 0.78) / 0.16);
    var frk = fractal(u * 11, v * 11, 3503);
    var kopfA = sstep(0.25 + (frk - 0.5) * 0.3, 0.55, kopf);
    o[3] = clamp(Math.max(a * 0.9, kopfA), 0, 1);
    if (kopfA > a * 0.9) { o[0] = 1; o[1] = 0.97; o[2] = 0.95; }
    else { var g = 0.55 + y * 0.4; o[0] = g * 0.8; o[1] = g; o[2] = g * 0.6; }
  }), "bluete", false);

  /* --- Rauchballen: gemalte Silhouette statt glatter Kugel --------------- */
  texFinish(texPaint(128, function (u, v, o) {
    var dx = (u - 0.5) * 2, dy = (v - 0.52) * 2.2;
    var r = Math.sqrt(dx * dx + dy * dy);
    var fr = fractal(u * 6, v * 6, 3601);
    var a = sstep(0.95 + (fr - 0.5) * 0.5, 0.35, r);
    o[3] = clamp(a * (0.55 + fr * 0.5), 0, 1);
    var g = 0.92 + fr * 0.08;
    o[0] = g; o[1] = g; o[2] = g;
  }), "rauchPuff", false);
})();

// Farbtragende Texturen als sRGB deklarieren; Alpha-/Datentexturen bleiben linear.
["cloudPuff", "grassTuft", "leafBlade", "foamEdge", "cirrus", "sunDisc", "glow",
 "aquarellGrob", "aquarellMittel", "aquarellFein", "kroneRund", "kroneSchmal",
 "kroneZerzaust", "kroneNadel", "rankenBlatt", "bluete", "rauchPuff"]
  .forEach(function (n) { TEX[n].colorSpace = THREE.SRGBColorSpace; });

export { TEX, texCanvas, texFinish, texPaint };
