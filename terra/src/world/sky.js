// Himmel: Kuppel mit fuenf Stuetzstellen, Sonnenscheibe mit Halo, Gegengluehen,
// Zirrenschicht und Cumulus-Billboards in drei Tiefenlagen.
import * as THREE from 'three';
import { clamp, sstep, hashi, rngOf, rr } from '../core/rng.js';
// Bedienungsrunde: der Wolkenschalter lebt als S.wolken im Kartenzustand —
// eine Quelle fuer Billboards (hier), Bodenschatten (atmosphere.js) und
// Speicherformat (io.js).
import { S } from '../core/store.js';
import { TEX } from '../render/textures.js';
import { cam, camera } from '../editor/camera.js';

/* --- Kuppel -------------------------------------------------------------
   Die Kuppel ist KEINE gleichmaessig geteilte Kugel mehr, und das ist der
   Kern dieser Runde.

   Vorher: SphereGeometry(1500, 32, 24). Eine Kugel mit 24 Hoehensegmenten
   hat ihre Ringe alle 7.5 Grad, die Ringe um den Horizont liegen also bei
   y = 0 und y = +-0.1305 — DAZWISCHEN LIEGT KEIN EINZIGER VERTEX. Die Farbe
   ist eine Vertexfarbe; alles zwischen zwei Ringen ist eine gerade
   Interpolation der beiden Ringfarben.

   Genau in diesem Zwischenraum spielt sich aber jede Aufnahme ab. Die
   Kameras dieses Projekts sind nach unten geneigt, ihr Fenster ueber dem
   Horizont ist wenige Grad hoch: wasser-kueste blickt mit 13.8 Grad Neigung
   und 17 Grad halbem Bildfeld, sieht also Hoehenwinkel 0 bis 3.3 Grad —
   das ist y = 0 bis 0.057, vollstaendig innerhalb der EINEN Spanne.
   Der gesamte sichtbare Himmel war damit eine einzige gerade Blende zwischen
   zwei Farben; gemessen sah man ihn als flachen, entsaettigten Grauschleier.
   Die Stauchung der Rampe aus der Vorrunde (Stuetzstellen bei y = 0.02 und
   0.10) lief deshalb ins Leere: an diesen y-Werten wird gar nichts
   ausgewertet, weil dort keine Vertices sitzen.

   Jetzt: eigene Kuppel mit einer Ringverteilung, die sich am Horizont
   draengt. Der Hoehenwinkel laeuft ueber |t|^KUPPEL_BEUGUNG statt linear,
   die ersten Ringe ueber dem Horizont liegen damit bei 0.19, 0.74, 1.67,
   2.98 und 4.65 Grad. Das Sichtfenster einer Weitaufnahme bekommt so fuenf
   Stuetzpunkte statt eines halben. Nach oben wird die Teilung grob — dort
   ist der Verlauf ohnehin langsam, und kein Blick dieses Projekts schaut
   steil hinauf.

   Kosten: 2205 Vertices und 4224 Dreiecke gegen vorher 825 und 1536. Gegen
   die rund 1.0 Mio Dreiecke der Szene sind das 0.4 %, und paintSky laeuft
   NICHT je Bild, sondern nur waehrend einer Tageszeit- oder Wetterblende
   (atmosphere.js: tickAtmosphere ruft applyTod nur bei todT < 1).

   RINGE 44 -> 64, UND DER GRUND DAFUER IST GEMESSEN.
   Die Kamera dieses Projekts blickt nach unten, und zwar weiter, als die
   bisherige Rechnung angenommen hat. camera.js haelt selbst fest, wo der
   Horizont im Bild sitzt:  ndc.y(Horizont) = tan(pitch) / tan(fov/2).
   Fuer die elf Weltaufnahmen ergibt das

     weite-morgen  2.05   weite-nacht 1.62   weite-nebel 1.62   stadt-nah 1.23
     wetter-regen  1.16   weite-abend 1.38   berg-schnee 1.01   wald-nah  1.00
     wasser-kueste 0.80 (Zeile 90)   schildkroete 0.68 (Zeile 144)
     ranke-plateau 0.31 (Zeile 311)

   In SIEBEN von elf Aufnahmen liegt der Horizont ueber der oberen Bildkante.
   Was dort als "Himmel" im Bild steht, ist die Kuppel UNTER dem Horizont:
   weite-abend sieht y = -0.10 bis -0.20, weite-morgen y = -0.26 abwaerts.
   Die gesamte bisherige Arbeit an der Hoehenrampe (Stuetzstellen bei y > 0)
   war fuer diese Bilder wirkungslos — unter dem Horizont gab es genau EINE
   Farbe mal einem Abdunkelungsfaktor. Genau das ist der "einfarbige Dom"
   des Abnahmebefunds; es war kein zu flacher Verlauf, es war gar keiner.

   Deshalb bekommt die Haelfte unter dem Horizont ab jetzt eine eigene
   Staffelung (siehe paintSky), und dafuer braucht sie Ringe: bei 44 Ringen
   lagen im Fenster von weite-abend drei Stueck, bei 64 sind es fuenf.
   Kosten: 3185 Vertices und 6144 Dreiecke — 0.6 % der Szene, einmal je
   Tageszeitblende gefaerbt.                                                */
var KUPPEL_R = 1500, KUPPEL_SEG = 48, KUPPEL_RINGE = 64, KUPPEL_BEUGUNG = 2.0;
function baueKuppel() {
  var g = new THREE.BufferGeometry();
  var n = (KUPPEL_RINGE + 1) * (KUPPEL_SEG + 1);
  var pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), idx = [];
  var k = 0;
  // Ringe von oben (Zenit) nach unten (Nadir) — dieselbe Reihenfolge wie
  // THREE.SphereGeometry, damit der Wickelsinn (BackSide) unveraendert bleibt.
  for (var j = 0; j <= KUPPEL_RINGE; j++) {
    var t = 1 - 2 * j / KUPPEL_RINGE;                       // +1 Zenit .. -1 Nadir
    var hoehe = (t < 0 ? -1 : 1) * Math.pow(Math.abs(t), KUPPEL_BEUGUNG) * (Math.PI / 2);
    var sy = Math.sin(hoehe), sr = Math.cos(hoehe);
    for (var i = 0; i <= KUPPEL_SEG; i++) {
      var w = i / KUPPEL_SEG * Math.PI * 2;
      /* Das MINUS auf x ist die Vorzeichenkonvention von THREE.SphereGeometry
         (x = -cos(phi)*sin(theta)) und kein Schoenheitsfehler. Ohne es ist die
         Kuppel in x gespiegelt, damit dreht sich der Wickelsinn jedes Dreiecks
         um — und weil das Material auf BackSide steht, verwirft der Rasterizer
         dann ALLE Flaechen: die Kuppel verschwindet spurlos und das Bild zeigt
         die Loeschfarbe des Renderers (pipeline.js setzt sie auf fogMittel).
         Genau so ist es beim ersten Versuch dieser Runde passiert. Die zweite
         Konvention haengt daran: paintSky dottet pos.getX/getZ gegen die
         Sonnenrichtung — in einer gespiegelten Kuppel saesse das Abendgluehen
         auf der falschen Seite des Himmels. */
      var ux = -Math.cos(w) * sr, uz = Math.sin(w) * sr;
      pos[k * 3] = ux * KUPPEL_R; pos[k * 3 + 1] = sy * KUPPEL_R; pos[k * 3 + 2] = uz * KUPPEL_R;
      nor[k * 3] = ux; nor[k * 3 + 1] = sy; nor[k * 3 + 2] = uz;
      k++;
    }
  }
  for (var jr = 0; jr < KUPPEL_RINGE; jr++) {
    for (var ic = 0; ic < KUPPEL_SEG; ic++) {
      var a = jr * (KUPPEL_SEG + 1) + ic + 1, b = jr * (KUPPEL_SEG + 1) + ic;
      var c = (jr + 1) * (KUPPEL_SEG + 1) + ic, d = (jr + 1) * (KUPPEL_SEG + 1) + ic + 1;
      // An den beiden Polen faellt der Ring auf einen Punkt zusammen — dort
      // entfaellt je ein Dreieck, sonst waere es entartet.
      if (jr !== 0) idx.push(a, b, d);
      if (jr !== KUPPEL_RINGE - 1) idx.push(b, c, d);
    }
  }
  g.setIndex(idx);
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  return g;
}
var skyGeo = baueKuppel();
var skyDome = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({
  vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false
}));
skyDome.renderOrder = -10;
skyDome.frustumCulled = false;

/** Die ganze Himmelsgruppe folgt der Kamera. */
var skyGroup = new THREE.Group();
skyGroup.add(skyDome);

var _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(),
    _c4 = new THREE.Color(), _c5 = new THREE.Color(), _tmp = new THREE.Color();
/* Dunst = die fertige Nebelfarbe der Stimmung (atmosphere.js: fogMittel).
   Sie ist die Farbe, in die ALLES Ferne laeuft — Gelaende, Wasser, Rauch.
   Bis zu dieser Runde kannte der Himmel sie nicht, und deshalb traf der
   Abnahmebefund "abrupter Farbsprung von Himmel auf Gelaende an einer
   1-Pixel-Polygonkante" genau ins Schwarze: die beiden Flaechen, die sich
   dort beruehren, wurden aus zwei voneinander unabhaengigen Zahlensaetzen
   gefaerbt. Ab jetzt ist der Dunstsaum der Kuppel die gemeinsame Naht. */
var _dunst = new THREE.Color(0xc8d0d4);
var _fern1 = new THREE.Color(), _fern2 = new THREE.Color(), _kalt = new THREE.Color();

/* Die Ferne ist nicht nur dunkler, sie ist KUEHLER — das ist der ganze
   Unterschied zwischen Luftperspektive und einem Grauschleier. Diese drei
   Faktoren machen aus der Dunstfarbe die Farbe der jeweils naechsten
   Entfernungsstufe: Rot faellt am staerksten, Blau bleibt fast stehen.
   Auf das Abend-Dunstbeige (181,151,139) angewandt ergibt Stufe 2 ein
   (100,88,120) — aus Lachs wird Violett, ohne dass irgendwo eine
   Sonderfarbe fuer den Abend im Code steht. */
var FERN1 = [0.82, 0.85, 0.95], FERN2 = [0.58, 0.62, 0.84];

/**
 * Faerbt die Kuppel. Fuenf Farben und die Dunstfarbe der Stimmung.
 *
 * DIE FUENF STUETZSTELLEN HABEN SEIT DIESER RUNDE EINE ANDERE AUFGABE.
 * Vorher waren alle fuenf Stationen EINER Hoehenrampe, das "Gluehen" (_c4)
 * lag als Ring rundum. Ein Ring ist aber kein Sonnenstand — und beim Abend
 * war _c4 sogar DUNKLER als der Horizontstreifen darunter, das "Gluehen"
 * hat die Sonnenseite also nachweislich abgedunkelt (gemessen: x=1500, die
 * Spalte auf dem Sonnenazimut, war 16 Stufen dunkler als die Bildmitte).
 * Jetzt:
 *     _c1 zenit     Hoehenrampe, ab ~45°
 *     _c2 oben      Hoehenrampe, ~18°
 *     _c3 mitte     Hoehenrampe, ~5° — DIE Himmelsfarbe der Weitaufnahmen
 *     _c5 horizont  Hoehenrampe, 0° — der Dunstsaum, sonnenABGEWANDT
 *     _c4 sonnenglut  NICHT in der Hoehenrampe. Das ist die Farbe des
 *                     Himmels DORT, WO DIE SONNE STEHT, und sie ist der
 *                     hellste und saettigste Wert des Presets.
 * Damit ist der Sonnenstand im Bild eine Stelle statt einer Flaeche.
 *
 * ZWEI KEULEN, NICHT EINE. Die vierte Potenz der Vorrunde machte das
 * Gluehen so eng, dass es in den Aufnahmen ueberhaupt nicht mehr vorkam
 * (gemessen: die drei Messspalten lagen je Kanal innerhalb von 3 Stufen).
 * Ein gemalter Himmel hat beides: einen weiten Helligkeitsverlauf ueber das
 * ganze Bild (marnie-021 wird von links nach rechts stetig heller) UND
 * einen engen Kern an der Sonne. Deshalb
 *     breit = (0.5 + 0.5*cos)^2   traegt die Lichtrichtung durchs Bild
 *     eng   = cos^7               setzt den Ort
 * Die Gegenseite zieht in eine gekuehlte Fassung ihrer selbst: kaltes
 * Himmelslicht gegen warmes Sonnenlicht, der Kontrast, der laut Befund in
 * der ganzen Atmosphaere fehlte.
 *
 * UNTER DEM HORIZONT liegt der eigentliche Bildanteil (siehe baueKuppel:
 * sieben von elf Aufnahmen sehen NUR dieses Band). Dort steht kein Himmel,
 * sondern das, was jenseits des Kartenrandes liegt: Ferne im Dunst. Sie
 * bekommt drei Stufen mit weichen, aber lesbaren Kanten —
 *     0.0° – 1.7° unter dem Horizont   Dunstsaum, laeuft in _dunst
 *     1.7° – 5.7°                      erste Fernstufe  (dunkler, kuehler)
 *     6°   – 20°                       zweite Fernstufe (deutlich kuehler)
 * — weil eine Ferne in der Natur NIE ein stetiger Verlauf ist, sondern
 * gestaffelte Lagen: anno-10 setzt drei Kaemme hintereinander, marnie-021
 * legt die fernen Huegel als eigenen, hellen Streifen vor die nahen.
 */
function paintSky(zenit, oben, mitte, glut, horizont, dunst) {
  _c1.set(zenit); _c2.set(oben); _c3.set(mitte); _c4.set(glut); _c5.set(horizont);
  if (dunst !== undefined && dunst !== null) _dunst.set(dunst);
  // Die beiden Fernstufen einmal je Blende rechnen, nicht je Vertex.
  _fern1.setRGB(_dunst.r * FERN1[0], _dunst.g * FERN1[1], _dunst.b * FERN1[2]);
  _fern2.setRGB(_dunst.r * FERN2[0], _dunst.g * FERN2[1], _dunst.b * FERN2[2]);
  var pos = skyGeo.attributes.position, col = skyGeo.attributes.color;
  var sx = _sonnenDir.x, sz = _sonnenDir.z;
  var sl = Math.sqrt(sx * sx + sz * sz);
  // Steht die Sonne fast senkrecht (Nebel-Preset: Richtung [0.2, 0.92, 0.22]),
  // gibt es keinen Azimut — dann bleibt die Kuppel die reine Hoehenrampe.
  if (sl > 1e-3) { sx /= sl; sz /= sl; } else { sx = 0; sz = 0; }
  var azStk = sl;                       // flache Sonne -> starker Azimut
  for (var i = 0; i < pos.count; i++) {
    var y = pos.getY(i) / KUPPEL_R;
    /* Hoehenrampe. Die erste Stufe ist bewusst die breiteste, die im
       Sichtfenster einer Weitaufnahme ueberhaupt vorkommt (wasser-kueste
       sieht 0° bis 3.2°, also y = 0 bis 0.057): sie laeuft ueber 0 bis
       0.075 und traegt damit einen ECHTEN Verlauf im Bild statt einer
       Blende zwischen zwei fast gleichen Werten. */
    _tmp.copy(_c5).lerp(_c3, sstep(0.000, 0.075, y));     // Horizont -> Himmel, bis 4.3°
    _tmp.lerp(_c2, sstep(0.060, 0.300, y));               // bis 17°
    _tmp.lerp(_c1, sstep(0.250, 0.720, y));               // bis 46°
    if (y < 0) {
      /* Unter dem Horizont: Dunstsaum und zwei Fernstufen. tief ist der
         Abstand unter dem Horizont in y (also im Sinus des Winkels). */
      var tief = -y;
      _tmp.lerp(_dunst, sstep(0.000, 0.030, tief) * 0.85);
      _tmp.lerp(_fern1, sstep(0.030, 0.100, tief));
      _tmp.lerp(_fern2, sstep(0.105, 0.340, tief));
    }
    if (azStk > 0) {
      var vx = pos.getX(i), vz = pos.getZ(i);
      var vl = Math.sqrt(vx * vx + vz * vz);
      if (vl > 1e-3) {
        var zurSonne = clamp((vx * sx + vz * sz) / vl, -1, 1);
        /* Hoehenfenster des Gluehens. Nach oben laeuft es ueber rund 25 Grad
           aus (darueber gehoert der Himmel der Hoehenrampe), nach unten
           traegt es weiter, aber gedaempft: der Dunst ueber der fernen See
           wird von derselben Sonne beleuchtet, nur streifend. Ohne diesen
           zweiten Zweig haette die Lichtrichtung in genau den sieben
           Aufnahmen gefehlt, die NUR unter den Horizont sehen. */
        /* Hoehenfenster 0.44 -> 0.20 (rund 11.5 Grad), gemessen an
           ranke-plateau: das ist der einzige Blick mit viel Himmel im Bild
           (Horizont auf Zeile 311 von 900), und mit dem hohen Fenster stand
           dort die halbe Bildflaeche in der Sonnenglut — p50 sprang von
           0.629 auf 0.730, die Saettigung fiel von 0.292 auf 0.250. Ein
           Abendgluehen sitzt AM Horizont; darueber gehoert der Himmel der
           Hoehenrampe, sonst ist die Glut wieder eine Flaeche statt eines
           Ortes. Die breite Keule geht aus demselben Grund von 0.38 auf
           0.26 zurueck, die enge steigt von 0.55 auf 0.60 — Richtung ohne
           Aufhellung, Ort mit. */
        var bandNah = azStk * (y >= 0 ? (1 - sstep(0.0, 0.20, y))
          : (1 - sstep(0.0, 0.40, -y) * 0.55));
        var kos = 0.5 + 0.5 * zurSonne;
        var breit = kos * kos;
        var eng = zurSonne > 0 ? Math.pow(zurSonne, 7) : 0;
        _tmp.lerp(_c4, clamp(breit * 0.26 + eng * 0.60, 0, 1) * bandNah);
        // Gegenseite: dieselbe Farbe, nur kuehl gestimmt. Kein zweiter
        // Presetwert — der Kalt-Warm-Kontrast soll aus dem LICHT kommen.
        var gegen = zurSonne < 0 ? zurSonne * zurSonne : 0;
        if (gegen > 0.001) {
          _kalt.setRGB(_tmp.r * 0.86, _tmp.g * 0.92, _tmp.b * 1.06);
          _tmp.lerp(_kalt, gegen * bandNah * 0.75);
        }
      }
    }
    col.setXYZ(i, _tmp.r, _tmp.g, _tmp.b);
  }
  col.needsUpdate = true;
}

/* --- Sonnenscheibe und Gegengluehen ------------------------------------- */
var sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: TEX.sunDisc, transparent: true, depthWrite: false, depthTest: false, fog: false
}));
sunSprite.renderOrder = -9;
skyGroup.add(sunSprite);

var gegenSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: TEX.glow, transparent: true, depthWrite: false, depthTest: false, fog: false,
  opacity: 0.16
}));
gegenSprite.renderOrder = -9;
skyGroup.add(gegenSprite);

/** Sonnenrichtung, Scheibenfarbe und -groesse aus dem Tageszeit-Preset. */
function setSonne(dir, farbeHex, groesse, gegenHex) {
  sunSprite.position.copy(dir).multiplyScalar(1350);
  sunSprite.material.color.set(farbeHex);
  sunSprite.scale.setScalar(groesse);
  gegenSprite.position.set(-dir.x, Math.max(0.04, -dir.y * 0.3), -dir.z).normalize()
    .multiplyScalar(1380);
  gegenSprite.material.color.set(gegenHex);
  gegenSprite.scale.set(900, 380, 1);
}

/* --- Sterne: deterministisches Punktfeld auf der Kuppel-Halbkugel --------
   ~300 Punkte, verteilt ueber rngOf(0x57e11a) — kein Math.random. Groesse
   und Helligkeit variieren pro Stern. Der Mond IST die vorhandene
   Sonnenscheibe (scheibe/scheibeGr kommen aus dem Tageszeit-Preset), es gibt
   KEIN eigenes Mond-Objekt. Sichtbarkeit steuert atmosphere.js aus der
   Tageszeit-Blende ueber setSterne(alpha).                                  */
var STERNE_N = 300;
var sternGeo = new THREE.BufferGeometry();
(function () {
  var rng = rngOf(0x57e11a);
  var pos = new Float32Array(STERNE_N * 3);
  var col = new Float32Array(STERNE_N * 3);
  var gr = new Float32Array(STERNE_N);
  for (var i = 0; i < STERNE_N; i++) {
    // Gleichverteilung auf der Halbkugel (y uniform = flaechentreu), knapp
    // innerhalb der Kuppel (Radius 1430 < 1500), unterhalb des Horizonts nichts.
    var y = rr(rng, 0.07, 0.995);
    var w = rr(rng, 0, Math.PI * 2);
    var rxz = Math.sqrt(Math.max(0, 1 - y * y));
    pos[i * 3] = Math.cos(w) * rxz * 1430;
    pos[i * 3 + 1] = y * 1430;
    pos[i * 3 + 2] = Math.sin(w) * rxz * 1430;
    // Helligkeit variiert; Kalt-Warm auch hier: die meisten Sterne kuehl-
    // weiss, rund jeder sechste kippt leicht ins Warme.
    var hell = rr(rng, 0.35, 1.0);
    var warm = rng() < 0.18;
    col[i * 3]     = hell * (warm ? 1.0  : 0.82);
    col[i * 3 + 1] = hell * (warm ? 0.92 : 0.90);
    col[i * 3 + 2] = hell * (warm ? 0.78 : 1.0);
    gr[i] = rr(rng, 0.5, 1.6);
  }
  sternGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sternGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  sternGeo.setAttribute('sternGr', new THREE.BufferAttribute(gr, 1));
})();
var sternMat = new THREE.PointsMaterial({
  size: 2.8, sizeAttenuation: false, vertexColors: true, transparent: true,
  opacity: 0, depthWrite: false, depthTest: false, fog: false
});
// Groessenvariation pro Stern: Shader-Patch mit Ankerpruefung (Konvention).
sternMat.onBeforeCompile = function (shader) {
  var anker = 'gl_PointSize = size;';
  if (shader.vertexShader.indexOf(anker) >= 0) {
    shader.vertexShader = 'attribute float sternGr;\n' +
      shader.vertexShader.replace(anker, 'gl_PointSize = size * sternGr;');
  } else {
    console.warn('terra: Shader-Patch "sterngroesse" fand seinen Anker nicht.');
  }
};
sternMat.customProgramCacheKey = function () { return 'terraSterne'; };
var sternPunkte = new THREE.Points(sternGeo, sternMat);
sternPunkte.renderOrder = -9.5;   // knapp ueber der Kuppel (-10), unter der Scheibe (-9)
sternPunkte.frustumCulled = false;
sternPunkte.visible = false;
skyGroup.add(sternPunkte);        // folgt wie die Kuppel der Kamera

/** Sternsichtbarkeit 0..1, aus der Tageszeit-Ueberblendung gespeist. */
function setSterne(alpha) {
  sternMat.opacity = alpha;
  sternPunkte.visible = alpha > 0.003;
}

/* --- F5: Bewegungsdisziplin am Himmel -----------------------------------
   In den Vorlagen steht der Himmel praktisch. Beide Tempofaktoren wirken
   AUSSCHLIESSLICH an der Driftstelle (updateClouds/updateCirren); die
   Erzeugungsbloecke mit rngOf/rr bleiben Zeichen fuer Zeichen unveraendert,
   damit Positionen, Groessen, Blob-Versaetze und der Zufallsstrom identisch
   bleiben — es aendert sich nur, wie schnell ein bereits erzeugtes v
   abgefahren wird.

   WOLKEN_TEMPO 0.45: Cumulus liefen mit v = 0.22 .. 1.22 Welteinheiten/s
   (Mittel 0.62), jetzt mit 0.10 .. 0.55 (Mittel 0.279). Eine Wolke braucht
   fuer die 1560 Einheiten des Umlaufs damit rund 1.6 h statt 42 min.

   ZIRREN_TEMPO 0.12: Zirren liefen mit 0.25 .. 0.55 (Mittel 0.40) — nur
   knapp langsamer als die Cumulus, obwohl der Kommentar "sehr langsam"
   versprach. Jetzt 0.030 .. 0.066 (Mittel 0.048), also rund 5.8-mal
   langsamer als die mittlere Cumuluslage. Damit stehen sie fuer das Auge.

   Die Wetterskala bleibt erhalten: main.js ruft updateSky(dt * getWolkenTempo()),
   der Faktor greift also weiterhin voll auf beide Schichten.                */
var WOLKEN_TEMPO = 0.45;
var ZIRREN_TEMPO = 0.12;

/* --- Zirren: wenige langgezogene Streifen, sehr langsam ----------------- */
var CIRRUS_N = 7;
var cirrusMat = new THREE.MeshBasicMaterial({
  map: TEX.cirrus, transparent: true, depthWrite: false, fog: false, opacity: 0.2,
  side: THREE.DoubleSide
});
var cirrusMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
  cirrusMat, CIRRUS_N);
cirrusMesh.frustumCulled = false;
cirrusMesh.renderOrder = -8;
var cirren = [];
(function () {
  var rng = rngOf(0xc1235);
  for (var i = 0; i < CIRRUS_N; i++) {
    cirren.push({ x: rr(rng, -900, 900), z: rr(rng, -900, 900), y: rr(rng, 380, 470),
      l: rr(rng, 420, 760), b: rr(rng, 60, 130), a: rr(rng, 0, Math.PI),
      v: rr(rng, 0.25, 0.55) });
  }
})();
var _cirObj = new THREE.Object3D();

/* --- Cumulus: Billboards mit vertikalem Farbverlauf ---------------------
   CLOUD_BLOBS 4 -> 7 wegen der FORMENHIERARCHIE. Vier gleich grosse Ballen
   ergeben eine Traube, keine Wolke. Ein gemalter Kumulus (kazetachinu-022,
   totoro-001) hat drei Groessenordnungen: eine grosse Ballung, zwei bis drei
   mittlere Buckel, die die Silhouette seitlich aufbrechen, und kleine Lappen
   auf der Oberkante, die ihr die gezeichnete Zacke geben. Die vierte, noch
   feinere Ordnung liefert die Textur selbst (TEX.cloudPuff hat sieben eigene
   Lappen mit harter Ober- und weicher Unterkante).
   Zeichenaufrufe bleiben unveraendert: es ist dieselbe eine InstancedMesh,
   nur mit 280 statt 160 Instanzen.                                         */
/* CLOUD_N 40 -> 54, und die zwoelf neuen gehen alle in die ferne Bank.
   Zwanzig Wolken auf einem Ring von 1200 bis 2600 Einheiten sind rechnerisch
   eine alle 18 Grad — im 57 Grad breiten Bild also drei Stueck. Drei Ballen
   sind eine Gruppe, kein Band. Mit 32 sind es fuenf bis sechs, und erst dann
   entsteht die Reihung, die anno-04 bis zum Horizont staffelt.
   CLOUD_BLOBS bleibt bei 7: die neuen Instanzen sitzen alle in der fernen
   Bank und sind dort wenige Bildpunkte gross — die Fuellrate der grossen
   nahen Ballen bleibt damit unveraendert. */
var CLOUD_N = 54, CLOUD_BLOBS = 7;
var LUFT_WOLKEN_ABSENKUNG = [145, 90, 25];
var cloudGeo = new THREE.PlaneGeometry(1, 1);
var cloudUniforms = {
  uWolkeOben: { value: new THREE.Color(0xffffff) },
  uWolkeUnten: { value: new THREE.Color(0xb9c6d4) },
  /* Sonnenrichtung IM BILLBOARD, nicht in der Welt. Die Puffs stehen
     aufrecht und drehen sich nur um Y zur Kamera (updateClouds) — ihre
     lokale Hochachse ist also immer die Welt-Hochachse und ihre lokale
     Querachse immer die Querachse der Kamera. Damit ist die Sonnenlage in
     der Textur EINE Zahl fuer alle Instanzen und kostet ein Uniform statt
     eines Instanzattributs. Wird je Bild in updateSky nachgezogen. */
  uSonneUV: { value: new THREE.Vector2(0.7, 0.7) }
};
var cloudMat = new THREE.MeshBasicMaterial({
  color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, map: TEX.cloudPuff,
  /* fog: false — DER EINZELNE GRUND, WARUM IN KEINER AUFNAHME EINE WOLKE STAND.
     MeshBasicMaterial nebelt standardmaessig mit. Die ferne Bank steht bei
     1200–2600 Einheiten, scene.fog.far liegt je nach Stimmung bei 880–1050:
     jede Wolke der Bank wurde also mit fogFactor 1.0 gerendert und damit
     EXAKT in fogMittel gemalt — der Farbe, die an dieser Stelle ohnehin im
     Bild steht. Die Bank war die ganze Zeit da, in voller Deckkraft, und
     unsichtbar. Gemessen: im Himmelsband von wasser-kueste lag die
     Standardabweichung der Luminanz bei 0.0 ueber ganze Zeilen.
     Die Luftperspektive der Wolken macht ab jetzt recolorClouds selbst —
     nach ECHTER Entfernung und mit Farbverschiebung, statt als
     Alles-oder-nichts des linearen Szenennebels. */
  fog: false
});
// Beleuchtung pro Puff: Hoehe im Ballen UND Lage zur Sonne, in gezeichneten
// Stufen statt als Verlauf.
cloudMat.onBeforeCompile = function (shader) {
  shader.uniforms.uWolkeOben = cloudUniforms.uWolkeOben;
  shader.uniforms.uWolkeUnten = cloudUniforms.uWolkeUnten;
  shader.uniforms.uSonneUV = cloudUniforms.uSonneUV;
  var anker = '#include <map_fragment>';
  if (shader.fragmentShader.indexOf(anker) >= 0 &&
      shader.fragmentShader.indexOf('#include <map_pars_fragment>') >= 0) {
    shader.fragmentShader = 'uniform vec3 uWolkeOben;\nuniform vec3 uWolkeUnten;\n' +
      'uniform vec2 uSonneUV;\n' +
      shader.fragmentShader.replace(anker, anker +
        '\n#ifdef USE_MAP\n' +
        'float terraWolkenHoehe = smoothstep( 0.10, 0.90, vMapUv.y );\n' +
        'float terraWolkenKern = 1.0 - abs( vMapUv.y * 2.0 - 1.0 );\n' +
        /* Lage zur Sonne in der Puffscheibe. Das ist der Unterschied
           zwischen einem Ballen mit Oben und Unten und einem Ballen mit
           Licht- und Schattenseite — totoro-001 und kazetachinu-022 leben
           ausschliesslich davon. */
        'float terraWolkenSonne = dot( vMapUv * 2.0 - 1.0, uSonneUV ) * 0.5 + 0.5;\n' +
        'float terraLicht = terraWolkenHoehe * 0.48 + terraWolkenSonne * 0.52;\n' +
        /* GEZEICHNETE STUFEN. Ein gemalter Kumulus hat zwei bis drei flache
           Tonwerte mit harten Graenzen, keinen Farbverlauf. Zwei
           Smoothsteps mit sehr enger Flanke geben genau das; die 0.22
           Restverlauf halten den Ballen davor, zur Pappscheibe zu werden. */
        'float terraStufen = smoothstep( 0.30, 0.38, terraLicht ) * 0.46\n' +
        '  + smoothstep( 0.56, 0.65, terraLicht ) * 0.54;\n' +
        'terraLicht = mix( terraStufen, terraLicht, 0.14 );\n' +
        'vec3 terraWolkenFarbe = mix( uWolkeUnten, uWolkeOben, terraLicht );\n' +
        'diffuseColor.rgb *= terraWolkenFarbe * ( 0.94 + terraWolkenKern * 0.06 );\n' +
        /* Kante 0.035/0.18 -> 0.20/0.44: die Silhouette ist das, was eine
           gezeichnete Wolke ausmacht. Der weite Ausblendbereich hat aus
           jedem Ballen eine Rauchfahne gemacht — genau der "Rausch-Schleier
           ohne Silhouette" des Befunds. Die Textur selbst haelt ihre
           Oberkante schon hart und ihre Unterkante weich (textures.js,
           cloudPuff: `hart = 1 - sstep(0.30, 0.78, v)`); dieser zweite
           Schwellwert schneidet nur den ausgefransten Saum ab, der ueber
           dem eigentlichen Ballen lag. */
        'diffuseColor.a *= smoothstep( 0.20, 0.44, diffuseColor.a );\n#endif');
  } else {
    console.warn('terra: Shader-Patch "wolkenverlauf" fand seinen Anker nicht.');
  }
};
cloudMat.customProgramCacheKey = function () { return 'terraWolke'; };
var cloudMesh = new THREE.InstancedMesh(cloudGeo, cloudMat, CLOUD_N * CLOUD_BLOBS);
cloudMesh.frustumCulled = false;
cloudMesh.renderOrder = 3;
cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
cloudMesh.instanceColor = new THREE.InstancedBufferAttribute(
  new Float32Array(CLOUD_N * CLOUD_BLOBS * 3).fill(1), 3);
cloudMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);

/* Drei Tiefenlagen — seit dieser Runde mit einer echten FERNEN Bank.

   Befund: in KEINER der drei Weitaufnahmen war eine einzige Wolke im Bild.
   Die Ursache ist Geometrie, nicht Deckkraft. Wolken standen auf 205–365
   Einheiten Hoehe im Umkreis von 760 Einheiten; vom Auge einer Weitaufnahme
   (rund 40–110 Einheiten ueber Grund) aus sind das Hoehenwinkel von 11 bis
   25 Grad. Das Sichtfenster dieser Kameras endet bei 3 bis 12 Grad — die
   Wolken lagen also samt und sonders ueber dem oberen Bildrand.

   Lage 2 zieht deshalb weit hinaus (1200–2600 Einheiten) und steht ueber
   einem festen HOEHENWINKEL statt ueber einer Welthoehe (siehe FERN_WINKEL) —
   damit steht sie dort, wo sie in anno-04 und anno-06 steht: als Baenderung
   knapp ueber dem Horizont, die den Uebergang zum Meer traegt. Sie bekommt
   zwanzig der vierzig Wolken, weil ein Band aus dreizehn Stueck kein Band ist.
   Lage 0 und 1 bleiben nah: sie tragen den Luftarchipel (dort steht die
   Kamera ueber den Inseln) und jeden Blick, der nach oben geht.

   Die Groesse der fernen Bank ist am Bildwinkel bemessen, nicht am Abstand:
   der sichtbare Himmelsstreifen ist nur rund 3.3 Grad hoch, eine Wolke darf
   also hoechstens gut 2 Grad hoch werden, sonst fuellt eine einzige den
   ganzen Streifen. Bei 1800 Einheiten heisst das s = 22..53 — in der Breite
   ergibt das 3 bis 8 Grad, die Proportion einer Bank statt eines Ballons. */
var LAGE_RADIUS  = [[110, 620], [420, 1180], [1200, 2600]];
var LAGE_HOEHE   = [[195, 250], [240, 320], [0, 0]];   // Lage 2: siehe FERN_WINKEL
/* Lage 2 von 1.05 auf 1.85. GEMESSEN, nicht geschaetzt: mit magenta
   eingefaerbten Instanzen aufgenommen (diag-wolken) stand die ferne Bank in
   wasser-kueste als Reihe duenner Striche in den obersten 45 Bildzeilen —
   vorhanden, aber zu klein, um als Wolke gelesen zu werden. Bei 1.85 ist ein
   Ballen der Bank rund 5 Grad breit und 2 Grad hoch, also so gross wie die
   Reihen am Horizont von anno-04. */
var LAGE_GROESSE = [1.0, 1.35, 1.85];
var LAGE_WICKEL  = [780, 1250, 2700];
/* Hoehenstauchung je Lage. Ein Kumulus, den man von der Seite und aus grosser
   Entfernung sieht, ist keine Kugel mehr, sondern eine flache Bank: die
   Wolkenreihen von anno-04 sind am Horizont dreimal so breit wie hoch, die
   Ballen darueber fast quadratisch. Genau diese perspektivische Stauchung
   fehlte — die ferne Bank hatte dieselbe Proportion wie die nahen Ballen und
   las sich deshalb wie ein zu klein geratener Nahblick. */
var LAGE_FLACH   = [1.0, 0.92, 0.78];
var FERN_INNEN   = 1050;   // die ferne Bank kommt nie naeher heran
/* Die ferne Bank steht ueber einem HOEHENWINKEL, nicht ueber einer Welthoehe.
   Das ist der Punkt, an dem der erste Versuch dieser Runde gescheitert ist:
   eine feste Welthoehe von 170–360 Einheiten liegt fuer eine Kamera 36
   Einheiten ueber Grund bei 3–14 Grad, fuer eine 119 Einheiten hohe bei
   1–6 Grad. Das Sichtfenster ueber dem Horizont ist aber nur rund 3.3 Grad
   hoch (in wasser-kueste genau 90 der 900 Bildzeilen) — mit einer festen
   Welthoehe trifft die Bank es nur zufaellig, und in den Aufnahmen traf sie
   es gar nicht.
   Ein Maler setzt eine ferne Wolkenbank nicht auf eine Hoehe, sondern auf den
   Horizont: bei anno-06 und anno-04 steht sie zwischen einem halben und drei
   Grad darueber, unabhaengig vom Standpunkt. Genau das ist FERN_WINKEL — je
   Wolke ein fester Winkel, aus dem die Welthoehe je Bild gerechnet wird.  */
/* 0.008..0.055 -> 0.0025..0.042 (0.14° bis 2.4°). Die Aufnahme mit
   eingefaerbten Instanzen hat die Bank in den obersten 45 von 900 Zeilen
   gezeigt, also am oberen Bildrand statt am Horizont. Das Sichtfenster von
   wasser-kueste reicht von 0° bis 3.2°; die Bank sitzt jetzt in seiner
   unteren Haelfte und laesst darueber Luft — die Reihung von anno-04 sitzt
   ebenfalls tief und laesst den Zenit frei. */
var FERN_WINKEL = [0.0025, 0.042];

var clouds = [];
(function () {
  var rng = rngOf(0x51ee7);
  for (var i = 0; i < CLOUD_N; i++) {
    var lage = i < 10 ? 0 : (i < 22 ? 1 : 2);   // 10 nah, 12 mittel, 32 fern
    var blobs = [];
    for (var b = 0; b < CLOUD_BLOBS; b++) {
      if (b === 0) {
        // Kern: traegt die Masse, sitzt mittig und etwas tief
        blobs.push({ ox: rr(rng, -0.14, 0.14), oz: rr(rng, -0.25, 0.25),
          oy: rr(rng, -0.10, 0.06), s: rr(rng, 0.95, 1.18) });
      } else if (b <= 2) {
        // Zwei Buckel: brechen die Silhouette seitlich auf
        blobs.push({ ox: (b === 1 ? -1 : 1) * rr(rng, 0.52, 0.98), oz: rr(rng, -0.45, 0.45),
          oy: rr(rng, -0.06, 0.20), s: rr(rng, 0.54, 0.80) });
      } else {
        // Vier Randlappen: sitzen auf der Oberkante und zacken sie auf
        blobs.push({ ox: rr(rng, -1.15, 1.15), oz: rr(rng, -0.55, 0.55),
          oy: rr(rng, 1.00, 1.48), s: rr(rng, 0.24, 0.44) });
      }
    }
    // Ringfoermig um den Ursprung setzen statt in einem Quadrat: nur so
    // laesst sich eine Lage ueberhaupt als "fern" beschreiben.
    var w = rr(rng, 0, Math.PI * 2);
    var d = rr(rng, LAGE_RADIUS[lage][0], LAGE_RADIUS[lage][1]);
    clouds.push({
      x: Math.cos(w) * d, z: Math.sin(w) * d,
      y: rr(rng, LAGE_HOEHE[lage][0], LAGE_HOEHE[lage][1]),
      // Nur die ferne Bank benutzt den Winkel; bei Lage 0/1 bleibt er ungenutzt,
      // wird aber gezogen, damit der Zufallsstrom je Wolke gleich lang ist.
      winkel: rr(rng, FERN_WINKEL[0], FERN_WINKEL[1]),
      s: rr(rng, 26, 62) * LAGE_GROESSE[lage],
      v: rr(rng, 0.35, 0.9) * [1.35, 1.0, 0.62][lage],
      lage: lage, blobs: blobs
    });
  }
})();

var _sonnenDir = new THREE.Vector3(0.45, 0.72, 0.35);
var _basisFarbe = new THREE.Color(0xffffff);
var _randFarbe = new THREE.Color(0xffffff);
var _fernFarbe = new THREE.Color(0xdfe8f0);
var _cCol = new THREE.Color(), _fern = new THREE.Color();

/**
 * Wolkenfarben aus dem Preset: Grundton, Streulicht-Rand zur Sonne,
 * Fernton (naehert die hinterste Lage an den Himmel an).
 */
function setWolkenFarben(obenHex, untenHex, randHex, fernHex, deckkraft) {
  cloudUniforms.uWolkeOben.value.set(obenHex);
  cloudUniforms.uWolkeUnten.value.set(untenHex);
  _randFarbe.set(randHex);
  _fernFarbe.set(fernHex);
  cloudMat.opacity = deckkraft;
  recolorClouds();
}
function setSonnenDir(dir) { _sonnenDir.copy(dir); }

/** Instanzfarben: sonnenzugewandte Puffs bekommen den Streulicht-Rand. */
function recolorClouds() {
  for (var i = 0; i < CLOUD_N; i++) {
    var c = clouds[i];
    var f = 0.92 + hashi(i, 7, 3) * 0.16;
    // Ausrichtung der Wolke relativ zur Sonne (nur XZ, grob und billig)
    var dx = c.x - cam.focus.x, dz = c.z - cam.focus.z;
    var l = Math.sqrt(dx * dx + dz * dz) || 1;
    var zurSonne = clamp((dx / l) * _sonnenDir.x + (dz / l) * _sonnenDir.z, -1, 1);
    _cCol.copy(_basisFarbe).multiplyScalar(f);
    /* VORZEICHEN KORRIGIERT. Hier stand `if (zurSonne < 0)` unter dem
       Kommentar "Sonnenseite" — Bedingung und Beschriftung widersprachen
       sich, denn zurSonne > 0 heisst, dass die Wolke in Sonnenrichtung
       steht. Den hellen Streulichtrand hat in jeder Vorlage die Wolke NEBEN
       der Sonne (marnie-021, anno-10): man blickt an ihrer beleuchteten
       Flanke vorbei. Der Fehler war bisher unsichtbar, weil ueberhaupt keine
       Wolke im Bild stand. */
    if (zurSonne > 0) _cCol.lerp(_randFarbe, zurSonne * 0.62);
    /* Luftperspektive GESTAFFELT, nach echter Entfernung statt nach Lage.
       Vorher gab es drei feste Stufen (0 / 0.22 / 0.55) — drei Farbklassen
       sind eine Staffelung, aber eine sichtbar gestufte. Jetzt zieht jede
       Wolke stetig Richtung Fernton, die Bank am Horizont steht damit fast
       im Himmel und die nahen Ballen voll in ihrer eigenen Farbe.
       Die Spanne liegt bewusst auf 900–3200 und nicht auf dem Bereich der
       Bank selbst (1200–2600): laege sie darin, waere die ganze Bank
       gleichmaessig ausgewaschen — gemessen war sie dann im Bild kaum mehr
       von der Luft zu unterscheiden. So bleibt der vordere Rand der Bank
       fast in Wolkenfarbe und nur ihr hinterer Saum verliert sich, und genau
       daraus entsteht die Tiefe, die anno-06 zwischen seinen Wolkenreihen hat.
       Seit `fog: false` am Material (Begruendung dort) ist das hier die
       EINZIGE Luftperspektive der Wolken — sie faengt deshalb frueher an
       (500 statt 900) und traegt weiter (0.88 statt 0.55), und ihr Ziel ist
       nicht mehr allein die Presetfarbe, sondern zur Haelfte die echte
       Dunstfarbe der Stimmung. Damit landet der hinterste Saum der Bank
       exakt auf der Farbe, in der auch der Horizont steht. */
    _fern.copy(_fernFarbe).lerp(_dunst, 0.5);
    _cCol.lerp(_fern, sstep(1100, 3400, l) * 0.72);
    for (var b = 0; b < CLOUD_BLOBS; b++) cloudMesh.setColorAt(i * CLOUD_BLOBS + b, _cCol);
  }
  if (cloudMesh.instanceColor) cloudMesh.instanceColor.needsUpdate = true;
}

var _cloudObj = new THREE.Object3D();
function updateClouds(dt) {
  for (var i = 0; i < CLOUD_N; i++) {
    var c = clouds[i];
    c.x += c.v * WOLKEN_TEMPO * dt;
    // Umlauf je Lage: die ferne Bank braucht ein entsprechend weites Feld,
    // sonst zoege sie beim Schwenken staendig durch die Bildmitte.
    var g = LAGE_WICKEL[c.lage], g2 = g * 2;
    if (c.x - cam.focus.x > g) c.x -= g2;
    if (c.x - cam.focus.x < -g) c.x += g2;
    if (c.z - cam.focus.z > g) c.z -= g2;
    if (c.z - cam.focus.z < -g) c.z += g2;
    /* Der Umlauf darf die ferne Bank nie in die Naehe setzen: eine Wolke von
       150 Einheiten Halbmesser direkt ueber der Kamera waere eine Wand statt
       einer Bank. Nach dem Wickeln wird sie deshalb auf FERN_INNEN
       hinausgeschoben. Greift nur beim Schwenken — durch die eigene Drift
       (0.10–0.25 Einheiten/s) braucht eine Wolke dafuer Stunden. */
    if (c.lage === 2) {
      var rx = c.x - cam.focus.x, rz = c.z - cam.focus.z;
      var rl = Math.sqrt(rx * rx + rz * rz);
      if (rl < FERN_INNEN) {
        if (rl > 1e-3) { var f = FERN_INNEN / rl; c.x = cam.focus.x + rx * f; c.z = cam.focus.z + rz * f; }
        else { c.x = cam.focus.x + FERN_INNEN; c.z = cam.focus.z; }
        rl = FERN_INNEN;
      }
      // Welthoehe aus dem festen Hoehenwinkel: die Bank sitzt damit in JEDER
      // Aufnahme knapp ueber dem Horizont, gleich wie hoch die Kamera steht.
      c.y = camera.position.y + rl * c.winkel;
    }
    for (var b = 0; b < CLOUD_BLOBS; b++) {
      var bl = c.blobs[b];
      var px = c.x + bl.ox * c.s, pz = c.z + bl.oz * c.s;
      // Im Luftarchipel ziehen die nahen Wolken deutlich unter den Inseln vorbei:
      // dieselben Instanzen, aber eine echte Vorder-/Mittel-/Fernstaffelung im Raum.
      var luftAbsenkung = S.biom === 'luftarchipel' ? LUFT_WOLKEN_ABSENKUNG[c.lage] : 0;
      _cloudObj.position.set(px, c.y - luftAbsenkung + bl.oy * c.s * 0.5, pz);
      // Billboard: bleibt aufrecht, dreht sich nur zur Kamera
      _cloudObj.rotation.set(0, Math.atan2(camera.position.x - px, camera.position.z - pz), 0);
      _cloudObj.scale.set(c.s * bl.s * 2.1, c.s * bl.s * 1.25 * LAGE_FLACH[c.lage], 1);
      _cloudObj.updateMatrix();
      cloudMesh.setMatrixAt(i * CLOUD_BLOBS + b, _cloudObj.matrix);
    }
  }
  cloudMesh.instanceMatrix.needsUpdate = true;
}

function updateCirren(dt) {
  for (var i = 0; i < CIRRUS_N; i++) {
    var c = cirren[i];
    // Zirren stehen praktisch: ~5.8-mal langsamer als die mittlere Cumuluslage
    c.x += c.v * ZIRREN_TEMPO * dt;
    if (c.x - cam.focus.x > 980) c.x -= 1960;
    if (c.x - cam.focus.x < -980) c.x += 1960;
    _cirObj.position.set(c.x, c.y, c.z);
    _cirObj.rotation.set(0, c.a, 0);
    _cirObj.scale.set(c.l, 1, c.b);
    _cirObj.updateMatrix();
    cirrusMesh.setMatrixAt(i, _cirObj.matrix);
  }
  cirrusMesh.instanceMatrix.needsUpdate = true;
}

function initSky(scene) {
  scene.add(skyGroup);
  scene.add(cloudMesh);
  scene.add(cirrusMesh);
}

/** Pro Frame: Kuppel folgt der Kamera, Wolken und Zirren driften.
 *
 *  Bedienungsrunde: `S.wolken === false` schaltet beide Wolkenschichten ab
 *  (Kartenfeld, tolerant gespeichert — editor/io.js). Die Sichtbarkeit wird
 *  hier je Bild nachgezogen statt in einem Setter: der Zustand hat genau
 *  EINE Quelle (S), und die Kuppel folgt der Kamera auch ohne Wolken. Der
 *  Bodenschatten der Wolken haengt an derselben Quelle (atmosphere.js,
 *  uCloudAmt). */
/**
 * Sonnenlage in der Wolkentextur. Die Puffs drehen sich nur um Y (Billboard),
 * ihre Texturachsen sind also die Querachse der Kamera und die Welt-Hochachse.
 * Damit genuegt ein Uniform fuer alle Instanzen: u = Anteil der Sonne auf der
 * Querachse, v = ihre Hoehe. Die Querachse steht als erste Spalte in der
 * Weltmatrix der Kamera — bewusst von dort und nicht aus cam.yaw gerechnet,
 * damit die Zahl auch dann stimmt, wenn jemand die Kamerakonvention aendert.
 */
var _quer = new THREE.Vector3();
function sonneImPuff() {
  var e = camera.matrixWorld.elements;
  _quer.set(e[0], e[1], e[2]);
  var ql = Math.sqrt(_quer.x * _quer.x + _quer.z * _quer.z);
  if (ql < 1e-4) { cloudUniforms.uSonneUV.value.set(0, 1); return; }
  var u = (_sonnenDir.x * _quer.x + _sonnenDir.z * _quer.z) / ql;
  var v = _sonnenDir.y;
  var l = Math.sqrt(u * u + v * v);
  if (l < 1e-4) { cloudUniforms.uSonneUV.value.set(0, 1); return; }
  cloudUniforms.uSonneUV.value.set(u / l, v / l);
}

function updateSky(dt) {
  skyGroup.position.copy(camera.position);
  var an = S.wolken !== false;
  cloudMesh.visible = an;
  cirrusMesh.visible = an;
  if (!an) return;                 // stehende Wolken kosten dann auch nichts
  sonneImPuff();
  updateClouds(dt);
  updateCirren(dt);
}

/** Mittlere Driftgeschwindigkeit (fuer synchrone Wolkenschatten am Boden).
    MUSS WOLKEN_TEMPO enthalten: atmosphere.js schiebt uCloudDrift mit genau
    diesem Wert weiter, sonst laufen die Bodenschatten ihren Wolken davon.

    Gemittelt wird ueber die Lagen 0 und 1, NICHT ueber alle drei: den
    Bodenschatten wirft, was ueber dem Betrachter steht. Die ferne Bank
    (Lage 2) steht ab 1050 Einheiten Entfernung und beschattet dort nichts,
    was im Bild ist — ihr Tempofaktor 0.62 wuerde die Flecken nur bremsen.
    mittel(rr(0.35, 0.9)) = 0.625, mittel([1.35, 1.0]) = 1.175.             */
var CLOUD_DRIFT_MITTEL = 0.625 * 1.175 * WOLKEN_TEMPO;   // 0.330

export { initSky, updateSky, paintSky, setSonne, setSonnenDir, setWolkenFarben,
  setSterne, recolorClouds, cirrusMat, CLOUD_DRIFT_MITTEL,
  WOLKEN_TEMPO, ZIRREN_TEMPO };
