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

/** Schräg gesehene Terrain- und Gebäudeflächen behalten ihre Pigmentdetails. */
function setzeTexturAnisotropie(maximum) {
  var wert = Math.max(1, Math.min(8, Math.floor(maximum || 1)));
  for (var name in TEX) {
    if (!Object.prototype.hasOwnProperty.call(TEX, name)) continue;
    var textur = TEX[name];
    if (textur && textur.isTexture && textur.anisotropy !== wert) {
      textur.anisotropy = wert;
      textur.needsUpdate = true;
    }
  }
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

  /* ======================================================================
     NAHFELD-BODEN — warum die Aquarellschicht dafuer nicht reicht

     render/materials.js tastet die Familientextur `erde` dreimal ab, die
     feinste Stufe alle 3,44 Welteinheiten. Das ist die richtige Frequenz,
     aber die falsche BAUART: die Aquarelltexturen sind blasenfoermiges
     Fraktalrauschen, tragen nur Helligkeit (kein Farbwechsel, keine Normale)
     und werden mit KORN_AMP 1.5 bei Familienstaerke 0.15 aufgetragen — nach-
     gerechnet ±2,8 % Helligkeit. Auf einer gefaerbten Flaeche ist das
     unsichtbar; die Abnahme hat den Boden folgerichtig als "eingefaerbte
     Flaeche" bezeichnet.

     Diese beiden Texturen sind das Gegenteil und ausschliesslich fuer den
     Nahbereich gebaut. world/terrain.js bindet sie selbst an das Terrain-
     material (eigener onBeforeCompile-Block) und tastet sie in Welt-
     koordinaten ab — die Aquarellschicht bleibt unberuehrt, jedes andere
     Material auch.

     VIER KANAELE, und jeder traegt eine Aufgabe, die eine reine Helligkeits-
     textur nicht erfuellen kann:

       R,G  NORMALE (xy, um 0.5 kodiert). Aus dem Hoehenfeld per Zentral-
            differenz. Erst sie macht aus einem Fleck einen Koerper: ein
            Kiesel bekommt Licht- und Schattenseite, die mit der Sonne
            mitdreht, und eine Grasnarbe bekommt Flor. Die Schraffur in
            materials.js kann das nicht — sie hat EINE feste Lichtrichtung
            und wirkt multiplikativ auf die Farbe, nicht auf das Licht.
       B    ALBEDO um 0.5. Steinoberseiten hell, Fugen dunkel, Blueten hell —
            der Kontrast, den anno-05 auf seiner Wiese zeigt.
       A    HOEHE, normiert. world/terrain.js verschiebt damit die Weg- und
            Materialgrenzen PRO BILDPUNKT (Height-Blend). Das ist der Grund,
            warum die Uebergaenge kuenftig nicht mehr auf den Dreieckskanten
            des Gitters liegen: die Grenze wird an der Textur gebrochen, und
            die hat ihre eigene, viel feinere Aufloesung.

     512 statt 256 Texel: die Kachel deckt BODEN_FEIN = 2,6 Welteinheiten ab
     (world/terrain.js), im Nahblick also rund 75 Bildpunkte je Einheit
     gegenueber 197 Texeln — eine Kachel steht damit knapp ueber 1:1 und ein
     Kiesel von 30 Texeln misst rund 6 Bildpunkte. Bei 256 waere er 3 und
     lieferte wieder Rauschen statt Form (dieselbe Grenze, die der Abschnitt
     `koernungsFeld` weiter unten teuer gelernt hat).

     Kachelbar: die Streuzellen laufen ringfoermig (Modulo auf den Zellindex),
     die Rauschlagen liegen auf Gittern, deren Weite N teilt. Deterministisch
     ueber hashi/vnoise, kein Math.random. DATENTEXTUR — nicht sRGB, denn R
     und G sind Richtungen und keine Farben.
     ====================================================================== */
  function bodenTextur(name, seed, gras) {
    var N = 512;
    var hoehe = new Float32Array(N * N);
    var albedo = new Float32Array(N * N);     // um 0 zentriert

    /* Streuung runder Koerper (Kiesel, Erdkrumen, Grasbuelten). Der Aufbau
       folgt `koernungsFeld` weiter unten, mit zwei Unterschieden: die
       Zellwerte sind VORGERECHNET (statt 18 hashi-Aufrufen je Bildpunkt nur
       noch neun Feldzugriffe — bei 512² ist das der Unterschied zwischen
       einer halben und einer zehntel Sekunde Startzeit), und der Koerper
       schreibt in HOEHE und ALBEDO getrennt. Die Trennung ist der Kern:
       ein Kiesel ist heller als der Grund UND woelbt sich, ein Erdkrumen
       woelbt sich, ist aber dunkler. Mit nur einem Kanal ginge das nicht. */
    function streue(zell, deck, luecke, hAmp, aAmp, sd) {
      var zn = Math.max(1, Math.round(N / zell)), zs = N / zn;
      var ox = new Float32Array(zn * zn), oy = new Float32Array(zn * zn),
          rad = new Float32Array(zn * zn), ton = new Float32Array(zn * zn);
      for (var cj = 0; cj < zn; cj++) {
        for (var ci = 0; ci < zn; ci++) {
          var q = cj * zn + ci, h3 = hashi(ci, cj, sd + 29);
          ox[q] = hashi(ci, cj, sd);
          oy[q] = hashi(ci, cj, sd + 17);
          rad[q] = h3 > luecke ? 0 : zs * deck * (0.45 + h3 * 1.1);
          ton[q] = 0.55 + hashi(ci, cj, sd + 41) * 0.9;    // Steine sind nicht gleich
        }
      }
      for (var j = 0; j < N; j++) {
        var bj = Math.floor(j / zs);
        for (var i = 0; i < N; i++) {
          var bi = Math.floor(i / zs);
          var besteK = 0, besteT = 1, besteTon = 1;
          for (var dj = -1; dj <= 1; dj++) {
            for (var di = -1; di <= 1; di++) {
              var qi = ((bi + di) % zn + zn) % zn, qj = ((bj + dj) % zn + zn) % zn;
              var q2 = qj * zn + qi, r = rad[q2];
              if (r <= 0) continue;
              var dx = i + 0.5 - (bi + di + ox[q2]) * zs;
              var dy = j + 0.5 - (bj + dj + oy[q2]) * zs;
              var d2 = dx * dx + dy * dy;
              if (d2 > r * r) continue;
              var t = Math.sqrt(d2) / r;
              var kuppe = Math.sqrt(1 - t * t);
              if (kuppe > besteK) { besteK = kuppe; besteT = t; besteTon = ton[q2]; }
            }
          }
          if (besteK <= 0) continue;
          var k2 = j * N + i;
          // Kontaktsaum: der Koerper liegt IM Boden, nicht darauf.
          var saum = sstep(0.74, 1.0, besteT);
          hoehe[k2] += besteK * hAmp - saum * hAmp * 0.45;
          albedo[k2] += (besteK - 0.42) * aAmp * besteTon - saum * aAmp * 0.55;
        }
      }
    }

    /* Gestreckte Rauschlage in frei waehlbarer Richtung. `fl` ist die Weite
       LAENGS der Lage, `fq` quer dazu — beide als Kehrwerte ganzer Texel-
       zahlen, die N teilen, damit das Gitter von vnoise auf die Kachelgrenze
       faellt und die Textur nahtlos bleibt. Die Richtung kommt aus einer
       ganzzahligen Scherung (dieselbe Bedingung), deshalb nur 0°, 45°, 90°
       und 135° — vier Lagen genuegen: eine Grasnarbe hat keine Vorzugs-
       richtung, sie hat WECHSELNDE. */
    function lage(fl, fq, sd, amp, ri, aAmp) {
      for (var j = 0; j < N; j++) {
        for (var i = 0; i < N; i++) {
          var a, b;
          if (ri === 0) { a = i; b = j; }
          else if (ri === 1) { a = j; b = i; }
          else if (ri === 2) { a = i + j; b = i - j; }
          else { a = i - j; b = i + j; }
          var w = vnoise(a * fl, b * fq, sd) - 0.5;
          var k = j * N + i;
          hoehe[k] += w * amp;
          /* Die Lage schreibt AUCH ins Albedo, und das ist keine Zugabe: eine
             Grasnarbe ist nicht nur reliefiert, sie ist auch fleckig hell und
             dunkel (totoro-018 zeichnet den Bewuchs fast ausschliesslich ueber
             Helligkeitsstufen, das Relief traegt dort gar nichts). Der erste
             Anlauf hatte die Halme nur in der Hoehe — im Bild blieb davon nur
             eine Beleuchtungsnuance uebrig, und der Boden las sich weiter als
             gefaerbte Flaeche. */
          if (aAmp) albedo[k] += w * aAmp;
        }
      }
    }

    if (gras) {
      /* Grasnarbe: Bulten, dann Halme, dann Flor.
         Die Bulten sind flach und breit (Zelle 46 Texel = 23 cm bei 2,6
         Einheiten je Kachel) — das ist die Ordnung, in der eine Weide
         "atmet" (howl-009 ist ueber die ganze Bildbreite daraus gebaut).
         Die Halme laufen in vier Richtungen; ihre Wellenlaenge liegt bei
         64 Texeln laengs und 8 quer, also 33 zu 4 cm. */
      streue(46, 0.46, 0.55, 0.42, 0.34, seed);
      streue(21, 0.50, 0.62, 0.24, 0.28, seed + 131);
      lage(1 / 64, 1 / 8, seed + 211, 0.34, 0, 0.30);
      lage(1 / 64, 1 / 8, seed + 223, 0.30, 1, 0.26);
      lage(1 / 128, 1 / 16, seed + 227, 0.26, 2, 0.22);
      lage(1 / 128, 1 / 16, seed + 229, 0.22, 3, 0.20);
      lage(1 / 8, 1 / 8, seed + 233, 0.16, 0, 0.12);
    } else {
      /* Kies und Erde: drei Steinlagen und der Grus dazwischen. Die groebste
         Zelle (66 Texel) ergibt Steine von rund 16 cm — genau die Groesse,
         die in anno-05 im Trampelpfad liegt und den Massstab lesbar macht. */
      streue(66, 0.44, 0.70, 0.60, 0.46, seed);
      streue(29, 0.46, 0.66, 0.38, 0.36, seed + 131);
      streue(13, 0.48, 0.60, 0.20, 0.22, seed + 137);
      lage(1 / 16, 1 / 16, seed + 211, 0.26, 0, 0.20);
      lage(1 / 8, 1 / 8, seed + 223, 0.18, 2, 0.14);
    }

    // Hoehe auf 0..1 normieren — die Normalenstaerke haengt sonst daran, wie
    // viele Lagen zufaellig zusammenfallen.
    var lo = Infinity, hi = -Infinity, p;
    for (p = 0; p < hoehe.length; p++) {
      if (hoehe[p] < lo) lo = hoehe[p];
      if (hoehe[p] > hi) hi = hoehe[p];
    }
    var sp = hi - lo > 1e-6 ? 1 / (hi - lo) : 1;
    for (p = 0; p < hoehe.length; p++) hoehe[p] = (hoehe[p] - lo) * sp;

    /* Blueten- und Kleeflecken: die kleinste sichtbare Ordnung. In anno-05
       sind es weisse und gelbe Tupfen, in totoro-018 die hellen Doldensterne
       am Wegrand — sie liegen NUR im Albedo (eine Bluete woelbt nichts) und
       stehen bewusst ueber der Abtastgrenze: Radius 5..11 Texel sind bei 2,6
       Einheiten je Kachel 2,5..5,6 cm, im Nahblick also gut zwei Bildpunkte.
       Der Shader blendet sie zusaetzlich fleckenweise ein, damit nicht die
       ganze Karte blueht. */
    if (gras) {
      var bn = 34, bs = N / bn;
      for (var fj = 0; fj < bn; fj++) {
        for (var fi = 0; fi < bn; fi++) {
          if (hashi(fi, fj, seed + 307) > 0.34) continue;
          var mx = (fi + hashi(fi, fj, seed + 311)) * bs;
          var my = (fj + hashi(fi, fj, seed + 313)) * bs;
          var br = 5 + hashi(fi, fj, seed + 317) * 6;
          var i0 = Math.floor(mx - br), i1 = Math.ceil(mx + br);
          var j0 = Math.floor(my - br), j1 = Math.ceil(my + br);
          for (var bj2 = j0; bj2 <= j1; bj2++) {
            for (var bi2 = i0; bi2 <= i1; bi2++) {
              var ddx = bi2 + 0.5 - mx, ddy = bj2 + 0.5 - my;
              var dd = Math.sqrt(ddx * ddx + ddy * ddy);
              if (dd > br) continue;
              var wi = ((bi2 % N) + N) % N, wj = ((bj2 % N) + N) % N;
              albedo[wj * N + wi] += (1 - sstep(br * 0.35, br, dd)) * 0.42;
            }
          }
        }
      }
    }

    // Albedo mittelwertfrei: der Kanal wirkt im Shader als (b - 0.5) und
    // duerfte sonst den ganzen Boden auf- oder abdunkeln statt ihn zu
    // strukturieren — derselbe Grund wie bei koernungsFeld weiter unten.
    var summe = 0;
    for (p = 0; p < albedo.length; p++) summe += albedo[p];
    var mittel = summe / albedo.length;
    for (p = 0; p < albedo.length; p++) albedo[p] -= mittel;

    /* Normale aus der Zentraldifferenz, mit Wickelung — die Kachel muss auch
       in ihrer Beleuchtung nahtlos sein, sonst zeichnet jede Kachelgrenze
       einen Lichtstreifen quer durch die Wiese.
       NORM_SKALA 5.5: eine Struktur von 20 Texeln Breite und 0.5 Hoehe hat
       ueber zwei Texel eine Differenz von rund 0.1, kodiert also rund 0.55 —
       Vollausschlag genau an den Steinflanken, flach dazwischen. */
    var NORM_SKALA = 5.5;
    texFinish(texPaint(N, function (u, v, o) {
      var i = Math.min(N - 1, Math.floor(u * N)), j = Math.min(N - 1, Math.floor(v * N));
      var hl = hoehe[j * N + ((i - 1 + N) % N)], hr = hoehe[j * N + ((i + 1) % N)];
      var hd = hoehe[((j - 1 + N) % N) * N + i], hu = hoehe[((j + 1) % N) * N + i];
      o[0] = 0.5 + clamp((hl - hr) * NORM_SKALA, -1, 1) * 0.5;
      o[1] = 0.5 + clamp((hd - hu) * NORM_SKALA, -1, 1) * 0.5;
      o[2] = clamp(0.5 + albedo[j * N + i], 0, 1);
      o[3] = hoehe[j * N + i];
    }), name, true);
  }
  bodenTextur("bodenGras", 5501, true);
  bodenTextur("bodenErde", 5507, false);

  /* --- Malerische Flaechentexturen: Aquarell in drei Koernungen ----------
     Mehrere Rauschoktaven, weiche Ton-/Helligkeitsverschiebung, vereinzelte
     dunklere Raender wie auslaufende Farbe. Kachelbar; wird im Shader in
     Weltkoordinaten abgetastet, damit die Koernung nie mitskaliert. ------ */
  function aquarell(name, grund, kontrast, seed, grus) {
    // `grus` (0 = aus) legt die Bodenkoernung darueber — Begruendung im
    // Abschnitt `koernungsFeld` weiter unten. Ohne den Parameter ist der
    // Rechenweg Zahl fuer Zahl der bisherige.
    var korn = grus > 0 ? koernungsFeld(256, seed + 4400) : null;
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
      if (korn) {
        // MITTELWERTFREI addiert (koernungsFeld normiert auf exakt 0): der
        // Kanalmittelwert bleibt, den materials.js als KORN_MITTE = 0.47
        // einkompiliert hat. Eine Verschiebung dort waere kein Korn, sondern
        // ein Grauschleier ueber jedem Boden und jedem Fels.
        var kw = korn[(Math.floor(v * 256) | 0) * 256 + (Math.floor(u * 256) | 0)] * grus;
        o[0] = clamp(o[0] + kw, 0, 1);
        o[1] = clamp(o[1] + kw, 0, 1);
        o[2] = clamp(o[2] + kw * 0.94, 0, 1);   // Steine minimal kuehler als der Grund
      }
      o[3] = 1;
    }), name, true);
  }
  /* --- Bodenkoernung: Kiesel, Erdkrumen, Grus ----------------------------
     Warum ueberhaupt in DIESE Textur und nicht in eine eigene: render/
     materials.js tastet die Familientextur DREIMAL ab, und zwar in drei
     Weltmassstaeben. Fuer die Familie `erde` (Gelaende und Wegband) sind das
     nachgerechnet:

       Grobschicht   Kachel alle 606 Welteinheiten  -> ganze Landmasse
       Grundschicht  Kachel alle 75,8 Einheiten     -> Landschaftsflecken
       Feinkorn      Kachel alle 3,44 Einheiten     -> Oberflaeche

     Nur die dritte liegt im Nahbereich ueberhaupt in Bildaufloesung: im
     Nahblick (Kameradistanz 54, fov 32) sind 3,44 Einheiten rund 178
     Bildpunkte, eine 256er Textur also fast 1:1. Genau dort stand bisher
     dasselbe blasenfoermige Fraktalrauschen wie in den beiden Grobschichten
     — Strukturen von einer Viertel- bis einer ganzen Kachelbreite. Auf dem
     Bild ergibt das keine Oberflaeche, sondern die weichgezeichnete Schliere,
     die die Abnahme benannt hat.

     Dieselbe Textur traegt beide Auftraege, weil die beiden Massstaebe
     denselben Texelbereich verschieden lesen:

       Steine  14..40 Texel  = 0,19..0,54 Einheiten fein  -> Kiesel im Nahblick
                             = 4,2..12 Einheiten grob     -> Flecken in der Weite
       Grus     6..12 Texel  = Zahn zwischen den Steinen

     UNTERE GRENZE, teuer gelernt. Der erste Anlauf hatte den Grus bei 2 bis 5
     Texeln. Auf 3,44 Einheiten Kachel sind 74 Texel eine Welteinheit, im
     Nahblick misst ein Texel also gut einen halben Bildpunkt — der Grus lag
     UNTER der Abtastgrenze. Sichtbar wurde daraus kein Korn, sondern ein
     Fellstrich: die Schraffur bildet die Differenz zweier um einen festen
     Vektor versetzter Abtastungen, und wenn beide unkorreliert sind, ist das
     Ergebnis gerichtetes Rauschen. In berg-schnee lag daraufhin ein Pelz ueber
     dem ganzen Hang. Alles unter etwa sechs Texeln gehoert deshalb nicht in
     diese Textur.

     Die Steine sind KEINE Rauschflecken, sondern Scheiben mit einer
     Lichtseite und einer Schattenseite. Der Grund steht in materials.js:
     die Schraffur bildet die Differenz zweier um eine halbe Welteinheit ZUR
     SONNE versetzter Abtastungen und wirkt damit wie eine Normalkarte. Ein
     symmetrischer Fleck liefert dieser Differenz nichts als Rauschen; eine
     Scheibe mit gerichtetem Verlauf liefert Woelbung. Deshalb der feste
     Lichtvektor in `LX/LY` — er dreht mit der Sonne nicht mit, aber der
     Kiesel ist Textur, kein Objekt: es genuegt, dass er PLASTISCH ist.

     Kachelbar durch Modulo auf den Zellindex (Zellen laufen ringfoermig),
     deterministisch ueber hashi. Rueckgabe ist ein mittelwertfreies
     Float32Array — siehe die Begruendung an der Additionsstelle oben. -- */
  function koernungsFeld(N, seed) {
    var feld = new Float32Array(N * N);
    var LX = -0.62, LY = -0.78;               // Licht von links oben
    // Zwei Steinlagen: grobe Kiesel und feiner Splitt. `zell` ist die
    // Kantenlaenge einer Streuzelle in Texeln, `deck` der Anteil der Zelle,
    // den ein Stein hoechstens fuellt.
    var lagen = [
      { zell: 43, deck: 0.42, tiefe: 0.66, sd: seed },
      { zell: 19, deck: 0.48, tiefe: 0.44, sd: seed + 131 }
    ];
    for (var L = 0; L < lagen.length; L++) {
      var lg = lagen[L], zn = Math.round(N / lg.zell);   // Zellen je Achse
      var zs = N / zn;                                   // exakte Zellgroesse
      for (var j = 0; j < N; j++) {
        for (var i = 0; i < N; i++) {
          var cj = Math.floor(j / zs), ci = Math.floor(i / zs);
          var best = 0;
          // 3x3-Nachbarschaft: ein Stein darf ueber seine Zellgrenze ragen
          for (var dj = -1; dj <= 1; dj++) {
            for (var di = -1; di <= 1; di++) {
              var qi = ((ci + di) % zn + zn) % zn, qj = ((cj + dj) % zn + zn) % zn;
              var h1 = hashi(qi, qj, lg.sd), h2 = hashi(qi, qj, lg.sd + 17);
              var h3 = hashi(qi, qj, lg.sd + 29);
              if (h3 > 0.72) continue;                   // Luecken: nicht jede Zelle traegt
              // Mittelpunkt in Texeln, mit Wickelung auf das Kachelbild
              var mx = (ci + di + h1) * zs, my = (cj + dj + h2) * zs;
              var r = zs * lg.deck * (0.45 + h3 * 1.1);
              var dx = i + 0.5 - mx, dy = j + 0.5 - my;
              var d = Math.sqrt(dx * dx + dy * dy);
              if (d > r) continue;
              var t = d / r;
              // Woelbung: Kuppe innen, harte Kante aussen (1 - t^2 gedeckelt)
              var kuppe = Math.sqrt(Math.max(0, 1 - t * t));
              // gerichteter Verlauf ueber die Scheibe = Licht- und Schattenseite
              var richt = (dx * LX + dy * LY) / r;
              var wert = kuppe * (0.30 + richt * 0.95) * lg.tiefe;
              // dunkler Kontaktsaum, damit der Stein IM Boden liegt
              wert -= sstep(0.72, 1.0, t) * 0.42 * lg.tiefe;
              if (Math.abs(wert) > Math.abs(best)) best = wert;
            }
          }
          feld[j * N + i] += best;
        }
      }
    }
    /* Grus: der Zahn zwischen den Steinen. Beide Frequenzen sind Kehrwerte
       ganzer Texelzahlen, die N teilen (1/8 und 1/16) — das Gitter von vnoise
       faellt damit auf die Kachelgrenze und die Textur bleibt nahtlos. Und
       beide liegen ueber der Grenze aus dem Abschnitt oben: 8 bzw. 16 Texel
       je Welle, also 4 bis 8 Bildpunkte im Nahblick. */
    for (var q = 0; q < N * N; q++) {
      var qi2 = q % N, qj2 = (q / N) | 0;
      var g1 = vnoise(qi2 * 0.125, qj2 * 0.125, seed + 211) - 0.5;
      var g2 = vnoise(qi2 * 0.0625, qj2 * 0.0625, seed + 223) - 0.5;
      // Zurueckgenommen von 0.34/0.30: die Schraffur in materials.js
      // VERSTAERKT den Kontrast dieser Textur um den Faktor 2.8, und bei der
      // ersten Fassung lag daraufhin ein sichtbares Rieseln ueber jeder
      // hellen Flaeche — auf Schnee am staerksten, weil dort nichts anderes
      // konkurriert. Die Steine tragen die Koernung, der Grus fuellt nur die
      // Zwischenraeume.
      feld[q] += g1 * 0.26 + g2 * 0.23;
    }
    // Mittelwert exakt auf 0 (siehe Additionsstelle): erst dann ist die
    // Koernung Struktur und keine Helligkeitsverschiebung.
    var summe = 0, p;
    for (p = 0; p < feld.length; p++) summe += feld[p];
    var mittel = summe / feld.length;
    for (p = 0; p < feld.length; p++) feld[p] -= mittel;
    return feld;
  }
  /* `grus` NUR auf aquarellGrob: die Familientabelle in materials.js bindet
     diese Textur an `erde` (Gelaende, Wegband) und `stein` (Fels, Mauerwerk) —
     genau die beiden Materialien, die Koernung haben MUESSEN. aquarellFein
     traegt Putz, Dachziegel, Metall und Stoff, aquarellMittel Holz, Reet, Laub
     und Rinde; ein Kieselfeld auf einer verputzten Wand saehe aus wie
     Schimmel (die Amplitudennotiz in materials.js beschreibt genau diesen
     Fehlversuch). Beide bleiben deshalb byteidentisch. */
  aquarell("aquarellGrob", 3.2, 1.05, 2201, 0.34);
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

export { TEX, texCanvas, texFinish, texPaint, setzeTexturAnisotropie };
