// Gemeinsames Partikelsystem (VFX): Regen, Schnee, Blueten, Sporen, Staub,
// Funken — der Dunstschleier aus Nebelbaenken und Regenwaenden — die
// Aufschlagsringe auf dem Wasser — und der Arbor-Lichtflug um die Ranken.
//
// VFX-R2 — WARUM DER REGEN NEU GEBAUT IST. Die Bildabnahme von R1 nannte den
// Regen "kein Wetter, sondern ein Bildschirm-Overlay" und hatte damit recht.
// Drei Befunde, drei Ursachen, alle drei hier behandelt:
//
//   1. "Rund drei Dutzend duenne, exakt bildkantenparallele Striche, gleiche
//      Laenge, gleiche Deckkraft, gleiche Dichte oben wie unten." Das war
//      kein Zufall, sondern die Bauart: billboard() spannte das Quad in einer
//      BILDSCHIRMachse auf (achseY), die aus der Bewegungsrichtung im
//      SICHTraum gerechnet war. Eine Sichtraumrichtung ist fuer alle
//      Instanzen dieselbe — der Strich links am Rand bekam exakt denselben
//      Bildwinkel wie der in der Mitte. Weltvertikaler Regen muss bei
//      geneigter Kamera aber zu einem Fluchtpunkt KONVERGIEREN.
//      Abhilfe: der Streifen wird jetzt als echter Weltraum-Strich
//      aufgespannt (billboard(), Zweig uAusricht) — Laengsachse ist die
//      Bewegungsrichtung im Sichtraum MIT ihrer z-Komponente, Querachse das
//      Kreuzprodukt mit dem Augvektor. Erst dadurch traegt die perspektivische
//      Division die Konvergenz, und die Striche laufen sichtbar zusammen.
//   2. "Der Regen trifft auf nichts." Kein Aufschlagsring, kein Spritzer.
//      In anno-09 ist es genau das, was den Regen verkauft: das ganze
//      Wasserfeld ist mit konzentrischen Ringen ueberzogen. Neu: ringMesh,
//      ein eigener Zeichenaufruf mit waagerechten Ringquads auf Wasserhoehe
//      (Abschnitt "AUFSCHLAGSRINGE" weiter unten).
//   3. "Jeder Strich ist der gleiche Strich." Laenge, Helligkeit und Dichte
//      haengen jetzt an der SICHTTIEFE (uStaffel) und an je einer eigenen
//      Streuung pro Instanz: nah lang, weich und wenige; fern kurz, dicht und
//      im Schleier aufgehend.
//
// VFX-R1 — WARUM ES EINE ZWEITE EBENE GIBT. Die Bildabnahme der Wetterlage
// "Regen" las sich nicht als Regen: einzelne Streifen vorn, dahinter eine
// unveraenderte Schoenwetterlandschaft. Der Befund hatte drei Ursachen, und
// alle drei sind hier behandelt:
//
//   1. Ein Regenstreifen war 0,16 Welteinheiten breit. In 120 Einheiten
//      Entfernung ist das ein Bruchteil eines Bildpunkts — die bilineare
//      Filterung loescht ihn aus. Sichtbar blieb nur, was zufaellig vor einer
//      dunklen Flaeche stand. Abhilfe: uMindest, eine Mindestbreite im
//      BILDRAUM (siehe billboard()).
//   2. Regen ist in den Vorlagen (anno-03, anno-09) zu zwei Dritteln SCHLEIER
//      und nur zu einem Drittel Einzeltropfen: graue Waende, die von der
//      Wolkendecke bis zum Boden reichen und die Ferne auffressen. Einzelne
//      Instanzen koennen das nicht leisten — dafuer braucht es wenige, grosse,
//      weiche Flaechen. Das ist der Dunstschleier (dunstMesh) weiter unten.
//   3. Der Wind war unsichtbar, weil jedes System seine eigene Richtung hatte.
//      Die Richtung steht jetzt in world/wind.js und gilt fuer Gras UND
//      Partikel; die Boeenfront ebenfalls (terraBoee).
//
// GRUNDGEDANKE — die Bewegung liegt vollstaendig im Vertex-Shader.
// Jede Instanz traegt ihre Startwerte (Position, Phase, Tempo, Groesse, Farb-
// mischung, Alpha) als InstancedBufferAttribute; die Instanzmatrix bleibt die
// Einheitsmatrix und wird nie wieder angefasst. Pro Frame schreibt tickVfx()
// genau zwei Uniforms (Zeit und Kamerafokus) plus acht Bodenhoehen fuer den
// Arbor-Flug — also KEINE CPU-Arbeit pro Partikel. Zum Vergleich: rauchMesh
// und birdMesh in atmosphere.js rechnen jede Instanzmatrix je Bild neu; das
// traegt bei 360 bzw. 35 Instanzen, bei 3000 Regenstreifen traegt es nicht.
//
// DETERMINISMUS. Erzeugung ist streng deterministisch: alle Startwerte kommen
// aus rngOf()/hashi(), kein Math.random. Die Darstellung darf zeitabhaengig
// animieren — genau wie Wind (wind.js) und Wolkendrift (sky.js).
//
// VOLUMEN UND WRAPPING. Alle Partikel leben in einem Quader um den Kamerafokus
// und werden toroidal umgeschlagen (mod), genau wie die Wolken in sky.js ihre
// +-780-Kachel umschlagen. Dadurch bedient eine FESTE Instanzzahl jede Karten-
// groesse: was hinten hinauslaeuft, kommt vorn wieder herein.
//
// SHADER-PATCH. Wie ueberall im Projekt per onBeforeCompile mit Ankerpruefung
// und console.warn (Konvention aus render/materials.js). Die Zaehler liegen
// hier in vfxPatchInfo statt in patchInfo, weil materials.js in dieser Runde
// nicht angefasst werden darf — window.terraVfxInfo neben window.terraPatchInfo.
import * as THREE from 'three';
import { clamp, sstep, rngOf, rr } from '../core/rng.js';
import { texPaint } from '../render/textures.js';
import { windUniforms, WIND_RICHTUNG, WIND_SCHRAEG, BOEE_GLSL } from './wind.js';
import { terraUniforms, ARBOR_MAX, patchInfo } from '../render/materials.js';
import { heightAt } from './terrain.js';
/* Nur fuer die Aufschlagsringe: S liefert die Seeflaechen (kind "flaeche",
   variant "see") und WATER den Meeresspiegel. Bewusst core/store.js und
   ausdruecklich NICHT generators/see.js — see.js zieht objects, zeichen,
   wegsuche und materials nach und stuende damit in der Auswertungsreihenfolge
   von main.js vor diesem Modul; store.js haengt nur an three und luftbiom.
   Die Spiegelhoehe rechnet dieses Modul deshalb selbst (seenSammeln), als
   Median der Uferhoehen — dieselbe Vorschrift wie seeSpiegel() in see.js,
   aber nur ueber die Griffpunkte statt ueber die abgetastete Kontur. Fuer
   eine Ringebene, die ohnehin einen halben Meter ueber dem Spiegel schwebt,
   ist das genau genug; fuer die Wasserflaeche selbst waere es das nicht. */
import { S, WATER } from '../core/store.js';

/* ==========================================================================
   Bewegungsvorgabe des Systems. Gelesen wie in world/water.js und
   world/weltleben.js: EINMAL beim Modulstart, denn Terra kennt keinen Wechsel
   zur Laufzeit. `data-uwe-motion="off"` am Wurzelelement zaehlt genauso wie
   die Medienabfrage — das ist der Schalter, den die Einbettung setzt.

   Bei 0 steht die Uhr des Partikelsystems still (tickVfx schreibt uZeit dann
   nicht mehr fort). Die Partikel BLEIBEN sichtbar: sie liegen gleichverteilt
   im Band und lesen sich als Standbild eines Regens. Weggeblendet waere die
   Wetterlage nicht mehr erkennbar — beruhigt ist sie es.
   ========================================================================== */
function reduzierteBewegung() {
  if (typeof document !== 'undefined' && document.documentElement &&
      typeof document.documentElement.getAttribute === 'function' &&
      document.documentElement.getAttribute('data-uwe-motion') === 'off') return true;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
const BEWEGT = reduzierteBewegung() ? 0 : 1;

/* ==========================================================================
   Diagnose — zwei Ebenen, bewusst: `patchInfo.vfx` (materials.js) ist die eine
   Ja/Nein-Zeile fuers Abnahmemuster, window.terraVfxInfo die Feinaufloesung
   (welcher Teilpatch griff). `versuche` bleibt hier, weil es in patchInfo die
   terraPatch()-Aufrufe zaehlt, nicht die des VFX-Shaders.
   `dunst` zaehlt den Schleierpatch getrennt: schlaegt nur er fehl, laeuft das
   Wetter weiter und nur die Tiefenstaffelung fehlt — das soll man an der
   Zahl sehen koennen, ohne das Bild zu deuten. `ring` zaehlt aus demselben
   Grund die Aufschlagsringe getrennt.
   ========================================================================== */
const vfxPatchInfo = { versuche: 0, billboard: 0, farbe: 0, form: 0, arbor: 0,
  dunst: 0, ring: 0 };
if (typeof window !== 'undefined') window.terraVfxInfo = vfxPatchInfo;

/* ==========================================================================
   Texturatlas: zwei 128er-Zellen nebeneinander in einer 256x128-Textur.
     Zelle 0 (u 0.0 .. 0.5) "Korn"  — weiches Rundkorn mit festem Kern.
       Traegt Regen (in die Laenge gezogen), Schnee, Sporen, Staub, Funken.
     Zelle 1 (u 0.5 .. 1.0) "Blatt" — schmales Bluetenblatt mit Mittelrippe.
   EIN Atlas statt zweier Texturen: der Typwechsel verschiebt dann nur ein
   Uniform (uForm) und muss weder material.map noch needsUpdate anfassen.
   Beide Zellen laufen weit vor ihrem Rand auf Alpha 0 aus, damit die bilineare
   Filterung nicht aus der Nachbarzelle blutet; Mipmaps sind aus demselben
   Grund abgeschaltet (Partikelquads sind ohnehin klein).
   Gezeichnet mit texPaint() aus render/textures.js — dieselbe Fabrik, aber
   OHNE texFinish(), damit die Registry TEX nicht von aussen beschrieben wird.
   ========================================================================== */
function malKorn(u, v, o) {
  var dx = (u - 0.5) * 2, dy = (v - 0.5) * 2;
  var r = Math.sqrt(dx * dx + dy * dy);
  var kern = 1 - sstep(0.0, 0.44, r);              // dichte Mitte
  var hof = Math.pow(Math.max(0, 1 - r), 2.4);     // weiter, weicher Saum
  var a = clamp(kern * 0.72 + hof * 0.58, 0, 1);
  o[3] = a * (1 - sstep(0.80, 0.99, r));           // Zellrand sicher auf 0
  o[0] = o[1] = o[2] = 1;                          // Farbe kommt aus dem Shader
}

function malBlatt(u, v, o) {
  // Diagonal liegendes Blatt: Stiel unten links, Spitze oben rechts. Die
  // Diagonale nutzt die quadratische Zelle besser aus als ein waagerechtes
  // Blatt und laesst mehr Rand fuer den sicheren Alpha-Auslauf.
  var x = u - 0.5, y = v - 0.5;
  var c = Math.cos(0.62), s = Math.sin(0.62);
  var px = x * c - y * s, py = x * s + y * c;
  if (px < -0.38 || px > 0.38) { o[3] = 0; return; }
  var t = clamp(px / 0.76 + 0.5, 0, 1);            // 0 Stiel .. 1 Spitze
  var hw = Math.sin(Math.PI * Math.pow(t, 0.72)) * 0.19 * (1 - t * 0.22);
  var d = Math.abs(py);
  if (d > hw) { o[3] = 0; return; }
  var a = 1 - sstep(hw * 0.52, hw, d);
  a *= sstep(0.0, 0.06, t);                        // Stielansatz auslaufen
  var rippe = 1 - Math.min(1, d / 0.013);
  var hell = 0.84 + rippe * 0.18 + (1 - t) * 0.12;
  o[3] = clamp(a, 0, 1);
  o[0] = hell; o[1] = hell * 0.96; o[2] = hell * 0.97;
}

function baueAtlas() {
  if (typeof document === 'undefined') return null;   // headless: kein Atlas
  var c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  var ctx = c.getContext('2d');
  ctx.drawImage(texPaint(128, malKorn), 0, 0);
  ctx.drawImage(texPaint(128, malBlatt), 128, 0);
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const VFX_ATLAS = baueAtlas();

/* ==========================================================================
   Zweiter Atlas: der Dunstschleier. Wieder zwei 128er-Zellen in 256x128.
     Zelle 0 (u 0.0 .. 0.5) "Bank"     — weiche, laengliche Nebelbank.
     Zelle 1 (u 0.5 .. 1.0) "Schleier" — senkrechte Regenstreifen.

   Ein EIGENER Atlas statt zweier weiterer Zellen im ersten: der Schleier muss
   in V kacheln (er scrollt nach unten, siehe uSchub), der Partikelatlas darf
   das ausdruecklich nicht — dort wuerde ein wrapT ausserhalb der Zelle die
   Nachbarzelle einblenden. Zwei Texturen mit unterschiedlichem Wrapping sind
   die ehrlichere Loesung als ein Atlas mit zwei Regeln.
   ========================================================================== */

/* Nebelbank (marnie-010: waagerechte Schwaden, die zwischen sich Luecken
   lassen). Drei ineinandergeschobene Ellipsen statt einer: eine einzelne
   Ellipse liest sich als Wattebausch, drei ergeben eine Silhouette mit
   Buchten. Der Alphaverlauf laeuft nach UNTEN deutlich weicher aus als nach
   oben — die Unterkante ist die Kante, die in das Gelaende schneidet, und was
   dort schon fast durchsichtig ist, schneidet unsichtbar. */
function malBank(u, v, o) {
  var a = 0;
  /* VFX-R2 — sechs Lappen statt drei, in zwei Groessen. Die Abnahme nannte die
     Baenke "flaechig fast deckendes Weiss mit stellenweise harter Kante".
     Drei fast gleich grosse Ellipsen ergeben eine konvexe Wolke, und eine
     konvexe Silhouette hat keine Buchten — sie liest sich als Flaeche. In
     marnie-010 hat jede Dunstlage AUSFRANSUNGEN: kleine Zungen, die sich vor
     die grosse Bank legen, und Luecken dazwischen, durch die man das Wasser
     sieht. Die drei kleinen Lappen unten liefern genau die. */
  var lappen = [
    [0.34, 0.57, 0.30, 0.20],
    [0.63, 0.51, 0.27, 0.16],
    [0.50, 0.63, 0.20, 0.12],
    [0.19, 0.46, 0.13, 0.075],
    [0.79, 0.44, 0.11, 0.065],
    [0.46, 0.40, 0.16, 0.055]
  ];
  for (var i = 0; i < lappen.length; i++) {
    var L = lappen[i];
    var dx = (u - L[0]) / L[2], dy = (v - L[1]) / L[3];
    var r = Math.sqrt(dx * dx + dy * dy);
    a = Math.max(a, Math.pow(Math.max(0, 1 - r), 1.9));
  }
  /* Eine sehr flache Laengsmaserung: die Bank ist nicht ueberall gleich
     dicht. Zusammen mit den gehaltenen Stufen im Fragmentshader wird daraus
     die Lasur mit sichtbaren Lagen statt eines Wattebauschs — die Maserung
     entscheidet, WO eine Stufe umspringt. */
  a *= 0.80 + 0.20 * Math.sin(u * 13.7 + v * 4.1) * Math.sin(v * 9.3 + 1.7);
  /* Federung nach unten. Sie ist der einzige Schutz gegen die harte Kante,
     die entsteht, wo das senkrechte Quad das Gelaende oder die Wasserflaeche
     durchstoesst — der Tiefenpuffer der Szene steht diesem Modul nicht zur
     Verfuegung (Vorschlag dazu im Bericht). Deshalb ist die untere Haelfte
     der Zelle fast durchsichtig: die Schnittlinie faellt dort in einen
     Bereich, in dem ohnehin kaum noch etwas gezeichnet wird. */
  a *= 0.08 + 0.92 * sstep(0.06, 0.58, v);
  o[3] = clamp(a, 0, 1) * (1 - sstep(0.86, 1.0, Math.abs(u - 0.5) * 2));
  o[0] = o[1] = o[2] = 1;
}

/* Regenschleier — nur die MASERUNG, nicht die Form.
   Der erste Anlauf malte die ganze Wand in diese Zelle: sieben schmale, harte
   Streifen mit sichtbaren Raendern. Im Bild waren daraus helle Pfosten
   geworden, keine Schleier — der Fehler war, eine Form in eine Textur zu
   malen, die anschliessend gescrollt wird und deshalb keinen Rand haben darf.
   Jetzt traegt die Zelle nur noch die Laengsmaserung eines fallenden Vorhangs
   (flach, kontrastarm, ueber die ganze Zelle), und die FORM — Trapez, unten
   breit, oben schmal, an allen Kanten weich — entsteht im Fragmentshader aus
   der ungescrollten Quadkoordinate. Zwei Dinge, zwei Zustaendigkeiten.

   In V ist die Zelle STRENG PERIODISCH: jede Modulation laengs v ist ein
   ganzzahliges Vielfaches von 2*PI*v. Damit kachelt sie beim Scrollen
   fugenlos, und die Maserung wandert sichtbar nach unten. */
function malSchleier(u, v, o) {
  var a = 0.46;
  for (var k = 0; k < 9; k++) {
    var mitte = 0.055 + k * 0.111;
    var breit = 0.030 + (k % 3) * 0.014;
    var d = Math.abs(u - mitte) / breit;
    if (d > 1) continue;
    // Periodische Laengsschwankung: die Bahn reisst stellenweise auf.
    var w = 0.5 + 0.5 * Math.sin(2 * Math.PI * v * (1 + (k % 3)) + k * 1.9);
    a += Math.pow(1 - d, 1.5) * (0.16 + 0.30 * w);
  }
  o[3] = clamp(a, 0, 1);
  o[0] = o[1] = o[2] = 1;
}

function baueDunstAtlas() {
  if (typeof document === 'undefined') return null;
  var c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  var ctx = c.getContext('2d');
  ctx.drawImage(texPaint(128, malBank), 0, 0);
  ctx.drawImage(texPaint(128, malSchleier), 128, 0);
  var t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;   // Zellgrenze in U darf nicht bluten
  t.wrapT = THREE.RepeatWrapping;        // Schleier scrollt in V
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const DUNST_ATLAS = baueDunstAtlas();

/* ==========================================================================
   Dritte Textur: der Aufschlagsring. Eine eigene 128er-Zelle statt einer
   dritten Spalte im Partikelatlas — der Ring braucht ClampToEdge in BEIDEN
   Achsen (er ist rund, keine Kante darf bluten) und eine eigene Geometrie
   ohne die halbierte Basis-UV von quadGeo(). Ein Atlas mit drei Regeln waere
   wieder die Loesung, die malSchleier oben schon einmal verworfen hat.

   Gemalt sind ZWEI Ringe und ein Kern, nicht einer: in anno-09 ist jeder
   Einschlag eine Doppelwelle — die vorlaufende Front und die zweite, die ihr
   nachlaeuft — mit einem hellen Punkt in der Mitte, wo der Tropfen die
   Oberflaeche aufreisst. Weil das Quad ueber die Lebensdauer WAECHST, wandern
   beide Ringe gemeinsam nach aussen; das ist genau die Bewegung, die man
   sieht, und sie kostet keine zweite Instanz.
   ========================================================================== */
function malRing(u, v, o) {
  var dx = (u - 0.5) * 2, dy = (v - 0.5) * 2;
  var r = Math.sqrt(dx * dx + dy * dy);
  var a = 0;
  a += Math.exp(-Math.pow((r - 0.74) / 0.090, 2)) * 0.95;   // Wanderfront
  a += Math.exp(-Math.pow((r - 0.43) / 0.078, 2)) * 0.42;   // zweite Welle
  a += Math.exp(-Math.pow(r / 0.115, 2)) * 0.34;            // Einschlagpunkt
  a *= 1 - sstep(0.84, 1.0, r);                             // Zellrand auf 0
  o[3] = clamp(a, 0, 1);
  o[0] = o[1] = o[2] = 1;
}

function baueRingTex() {
  if (typeof document === 'undefined') return null;
  var t = new THREE.CanvasTexture(texPaint(128, malRing));
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.minFilter = THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}
const RING_TEX = baueRingTex();

/* ==========================================================================
   Typenkatalog. Jeder Typ ist eine reine Uniform-Belegung — ein Typwechsel
   kostet keine Neuberechnung, keinen Buffer-Upload und keine Neukompilierung.

     basis        Instanzzahl bei dichte 1 (Deckel: VFX_MAX)
     form         0 = Korn, 1 = Blatt (Atlaszelle)
     halb         halbe Kantenlaenge des Volumens in XZ (Wrapping-Kachel)
     boxY         [Untergrenze relativ zum Fokus, Hoehe des Bandes]
     fall         Vertikaltempo in Einheiten/s (negativ = fallend)
     zug          waagerechtes Tempo LAENGS WIND_RICHTUNG in Einheiten/s
     taumel       [Frequenz, Amplitude XZ, Amplitude Y] — das Trudeln
     bahn         [Radius der langsamen Schleife, Frequenzteiler] — die grosse
                  Bogenbahn ueber dem Taumeln (0 = keine)
     boee         [Schub laengs Wind, Auftrieb, Drehzuschlag] beim Boeenstoss
     schere       Windscherung in Einheiten: um so viel treibt die Oberkante
                  des Bandes weiter als die Unterkante
     mindest      Entfernung, ab der die Quadbreite mitwaechst (0 = nie)
     groesse      [Breite, Laenge] des Billboardquads in Welteinheiten
     ausricht     1 = Quad laeuft entlang der Bewegungsrichtung (Streifen),
                  0 = bildschirmparallel mit Eigendrehung
     dreh         Eigendrehung in rad/s (nur bei ausricht 0)
     deck         Grunddeckkraft
     flacker      0..1 Anteil sinusfoermiger Helligkeitsschwankung
     wind         0..1 Kopplung von Zug und Boee an windUniforms.uWindStaerke
     schleier     0..1 Anteil, mit dem dieser Typ den Regenschleier (dunstMesh)
                  anwirft — nur Regen tut das
     ring         0..1 Anteil, mit dem dieser Typ die Aufschlagsringe auf dem
                  Wasser anwirft (ringMesh) — Regen voll, Schneefall schwach
     staffel      [nah, fern, staerke] TIEFENSTAFFELUNG des Streifens:
                  zwischen `nah` und `fern` Sichttiefe verkuerzt sich der
                  Strich und nimmt seine Deckkraft aus dem Nahfeld in die
                  Ferne mit. `staerke` 0 schaltet die ganze Staffelung ab —
                  ein Funke ueber der Esse hat keine Tiefe, in der er staffeln
                  koennte. Siehe billboard().
     additiv      true = AdditiveBlending (emissiv)
     farbA/farbB  die beiden Enden der Farbstreuung je Instanz

   VFX-R1 — `drift` als Paar ist ersatzlos verschwunden. Die Richtung kommt
   ausnahmslos aus WIND_RICHTUNG (world/wind.js), die Typen geben nur noch das
   TEMPO vor. Damit kann kein Typ mehr aus der Reihe tanzen: Regen, Staub und
   Blueten ziehen zwangslaeufig in dieselbe Richtung wie das Gras schwingt.
   ========================================================================== */
const VFX_MAX = 3400;

const VFX_TYPEN = {
  aus: { basis: 0, form: 0, halb: 100, boxY: [0, 1], fall: 0, zug: 0,
    taumel: [0, 0, 0], bahn: [0, 1], boee: [0, 0, 0], schere: 0, mindest: 0,
    groesse: [1, 1], ausricht: 0, dreh: 0, deck: 0,
    flacker: 0, wind: 0, schleier: 0, ring: 0, staffel: [0, 1, 0],
    additiv: false, farbA: 0xffffff, farbB: 0xffffff },

  /* Regen: schnelle Streifen, als echte Weltraum-Striche aufgespannt
     (billboard(), Zweig uAusricht — Begruendung im Dateikopf, Punkt 1).

     ZUG IST KEINE FREIE ZAHL MEHR. Er ist das Fallvermoegen mal der
     gemeinsamen Windschraege aus wind.js: 46 * 0.45 = 20.7. Damit faellt der
     Regen unter genau dem Winkel, unter dem auch die Regenwaende und die
     Nebelbaenke scheren und unter dem der Rauch stehen soll — 24 Grad aus der
     Senkrechten bei uWindStaerke 1, im Sturm (2.6) sichtbar flacher. Der
     alte Wert 13.0 waren 16 Grad und las sich als "senkrecht mit Fehler".

     Breite 0.34 und mindest 62: ohne die Mindestbreite im Bildraum war ab
     rund 80 Einheiten Entfernung nichts mehr zu sehen (siehe Kopf).
     Laenge 6.4 statt 5.0 — der Strich streut jetzt in der Laenge (0.55..1.6
     je Instanz, siehe billboard()), 6.4 ist der Mittelwert, nicht das Mass
     jedes Strichs. Der lange Strich ist deshalb 10 Einheiten lang und der
     kurze 3,5; im Bild ist das der Unterschied, den die Abnahme vermisst hat
     ("jeder Strich ist der gleiche Strich").
     basis bleibt bei 2900. Ein Zwischenstand hatte auf 2200 gekuerzt, um die
     Ringe zu bezahlen — im Bild war der Regen danach ein Nieseln. Bezahlt
     sind die Ringe stattdessen aus dem Deckel der Mindestbreite (2.6 -> 2.0,
     siehe billboard()): die fernsten Streifen sind damit ein Fuenftel
     schmaler, und das ist genau dort gespart, wo die Streifen ohnehin im
     Schleier aufgehen sollen. Gemessen: 236 Zeichenaufrufe gegen 234 vorher,
     Bildzeit unveraendert. */
  regen: { basis: 2900, form: 0, halb: 165, boxY: [-16, 150],
    fall: -46, zug: 46 * WIND_SCHRAEG, taumel: [0, 0, 0], bahn: [0, 1],
    boee: [3.2, 0, 0], schere: 26, mindest: 62,
    groesse: [0.34, 6.4], ausricht: 1, dreh: 0, deck: 0.60,
    flacker: 0, wind: 1.0, schleier: 1.0, ring: 1.0, staffel: [24, 300, 1.0],
    additiv: false, farbA: 0xbcccdc, farbB: 0xf0f6fb },

  // Schnee: langsam, taumelnd, mit leichter Eigendrehung und Y-Wippen.
  // Die Boee hebt die Flocken an (Auftrieb 2.4) — Schnee faellt nicht, Schnee
  // wird getragen.
  schnee: { basis: 1500, form: 0, halb: 145, boxY: [-12, 118],
    fall: -3.6, zug: 2.6, taumel: [0.9, 1.7, 0.35], bahn: [2.2, 0.21],
    boee: [4.5, 2.4, 0.7], schere: 9, mindest: 90,
    groesse: [0.88, 0.88], ausricht: 0, dreh: 0.5, deck: 0.62,
    flacker: 0, wind: 0.6, schleier: 0, ring: 0.22, staffel: [0, 1, 0],
    additiv: false, farbA: 0xeaf2fa, farbB: 0xffffff },

  // Blueten: seitlich driftend, deutlich rotierend, kaum fallend. Der
  // groesste Bogenradius aller Typen — ein Bluetenblatt segelt, es rieselt
  // nicht. Der Drehzuschlag laesst es in der Boee schneller wirbeln.
  blueten: { basis: 760, form: 1, halb: 115, boxY: [-8, 66],
    fall: -2.4, zug: 4.9, taumel: [0.75, 2.6, 0.9], bahn: [4.6, 0.19],
    boee: [7.5, 3.6, 2.6], schere: 7, mindest: 0,
    groesse: [0.95, 0.95], ausricht: 0, dreh: 1.7, deck: 0.78,
    flacker: 0, wind: 0.85, schleier: 0, ring: 0, staffel: [0, 1, 0],
    additiv: false, farbA: 0xf2bed0, farbB: 0xfff0f4 },

  // Sporen/Irrlichter: langsam AUFsteigend (fall positiv), emissiv, pulsend.
  // Sie steigen in weiten, langsamen Schrauben — Bogenradius gross,
  // Frequenzteiler klein, Boee schwach (im Windschatten des Waldes).
  sporen: { basis: 540, form: 0, halb: 120, boxY: [-4, 58],
    fall: 1.5, zug: 1.1, taumel: [0.45, 1.9, 0.7], bahn: [3.4, 0.14],
    boee: [1.8, 1.2, 0], schere: 4, mindest: 0,
    groesse: [0.62, 0.62], ausricht: 0, dreh: 0, deck: 0.55,
    flacker: 0.75, wind: 0.25, schleier: 0, ring: 0, staffel: [0, 1, 0],
    additiv: true, farbA: 0x8ce0b8, farbB: 0xdaffe8 },

  // Staub/Asche: waagerecht treibend, praktisch schwerelos, flaches Band.
  // Der staerkste Boeenschub — Staub ist das, woran man eine Boee ueberhaupt
  // erst sieht.
  staub: { basis: 950, form: 0, halb: 165, boxY: [-6, 50],
    fall: -0.4, zug: 11.9, taumel: [0.4, 1.8, 0.5], bahn: [3.0, 0.24],
    boee: [12.0, 3.0, 1.4], schere: 12, mindest: 120,
    groesse: [0.75, 0.75], ausricht: 0, dreh: 0.35, deck: 0.28,
    flacker: 0.15, wind: 0.9, schleier: 0, ring: 0, staffel: [0, 1, 0],
    additiv: false, farbA: 0xc6ae88, farbB: 0xeaddc6 },

  // Funken: schnell aufsteigend, kurz (flaches Band = kurze Lebensdauer),
  // warm und emissiv. Fuer Schmieden und Feuerstellen.
  funken: { basis: 260, form: 0, halb: 90, boxY: [-2, 26],
    fall: 7.5, zug: 1.4, taumel: [0.9, 0.8, 0.2], bahn: [0.9, 0.4],
    boee: [3.0, 1.6, 0], schere: 5, mindest: 0,
    groesse: [0.30, 0.58], ausricht: 1, dreh: 0, deck: 0.85,
    flacker: 0.9, wind: 0.35, schleier: 0, ring: 0, staffel: [0, 1, 0],
    additiv: true, farbA: 0xff9a3c, farbB: 0xffe2a8 }
};

/* ==========================================================================
   Shader. Ein gemeinsamer Patch fuer beide Meshes; `istArbor` schaltet den
   Bewegungsteil um (Volumen-Wrapping <-> Umlauf um die Rankenfuesse).
   Anker im Vertexshader: #include <project_vertex>. Der Ersatz MUSS die
   Variable `mvPosition` deklarieren — #include <fog_vertex> liest sie.
   Anker im Fragmentshader: #include <color_fragment>.
   Anker fuer die Atlaszelle: #include <uv_vertex> (nur Nicht-Arbor).
   ========================================================================== */

/** Startwerte-Attribute, gemeinsame Kopfzeilen beider Vertexshader. */
const KOPF_GEMEINSAM = [
  'attribute vec4 vfxStart;',   // Nicht-Arbor: xyz Startpunkt normiert, w Phase
  'attribute vec4 vfxVar;',     // x Tempo, y Groessenfaktor, z Farbmischung, w Alpha
  'uniform float uZeit;',
  'uniform vec2  uGroesse;',
  'uniform float uDeckkraft;',
  'uniform float uFlacker;',
  'varying vec4  vVfxCol;'
].join('\n');

const KOPF_WETTER = [
  BOEE_GLSL,                     // terraBoee — dieselbe Front wie im Gras
  'uniform vec3  uFokus;',
  'uniform float uHalb;',
  'uniform vec2  uBoxY;',
  'uniform float uFall;',
  'uniform vec2  uDrift;',
  'uniform vec3  uTaumel;',
  'uniform vec2  uBahn;',
  'uniform vec3  uBoee;',
  'uniform float uSchere;',
  'uniform float uAusricht;',
  'uniform float uDreh;',
  'uniform vec3  uFarbA;',
  'uniform vec3  uFarbB;',
  'uniform float uWindKopplung;',
  'uniform float uWindStaerke;',
  'uniform float uMindest;',
  'uniform vec3  uStaffel;',
  'uniform vec2  uForm;',
  /* Biomflaechen werden im Wetterkern an der Partikel-Weltposition gelesen.
     Die Uniforms muessen deshalb nicht nur im Three-Uniformobjekt, sondern
     auch im GLSL-Kopf des MeshBasicMaterial-Vertexshaders deklariert sein. */
  'uniform float uBiomAn;',
  'uniform sampler2D uBiomKarte;',
  'uniform sampler2D uBiomLut;',
  'uniform vec2 uBiomAbb;',
  'uniform float uBiomZeilen;',
  /* Segelkurve — die Begruendung steht an der Aufrufstelle im Wetterkern.
     Hier im KOPF, weil GLSL keine Funktionsdefinition im Rumpf von main()
     erlaubt und der Kern genau dorthin gespleisst wird. */
  'float terraSegel( float s ) { return sign( s ) * pow( abs( s ), 0.70 ); }'
].join('\n');

const KOPF_ARBOR = [
  'attribute float vfxQuelle;',
  'uniform vec4  uArborPos[' + ARBOR_MAX + '];',
  'uniform float uArborBoden[' + ARBOR_MAX + '];',
  'uniform int   uArborAnzahl;',
  'uniform vec3  uArborFarbe;',
  'uniform float uArborStaerke;',
  'uniform float uArborHoehe;'
].join('\n');

/* Bewegung + Alpha des Wetter-/Umgebungs-VFX. Ergebnis: vec3 p (Weltpunkt),
   float vfxA (Deckkraft), vec3 vfxC (Farbe), vec2 achseY (Bildschirmachse). */
const KERN_WETTER = [
  'float tempo = vfxVar.x;',
  'float ph    = vfxStart.w;',
  'float t     = uZeit * tempo;',
  'float wind  = mix( 1.0, uWindStaerke, uWindKopplung );',
  /* Die eine Windrichtung, als Literal aus world/wind.js in den Text gebacken
     (Begruendung dort bei WIND_ACHSE). uDrift ist bereits WIND_RICHTUNG mal
     dem Typtempo — windRi wird nur fuer die Verschiebungen gebraucht, die
     nicht mit der Zeit wachsen (Scherung, Boee). */
  'vec2  windRi = vec2( ' + WIND_RICHTUNG[0].toFixed(5) + ', ' +
    WIND_RICHTUNG[1].toFixed(5) + ' );',
  'vec2  drift = uDrift * wind;',
  // Startpunkt: normierte Attribute auf das aktuelle Volumen abgebildet.
  'vec3 p = vec3( vfxStart.x * uHalb, uBoxY.x + vfxStart.y * uBoxY.y, vfxStart.z * uHalb );',
  'p.y  += uFall * t;',
  'p.xz += drift * t;',
  /* Taumeln: drei entkoppelte Frequenzen, damit keine Reihe entsteht.
     VFX-R1 — die Frequenz haengt jetzt zusaetzlich am Eigentempo der Instanz
     (`tempo`, 0.78..1.28). Vorher hatten ALLE Partikel exakt dieselbe
     Taumelfrequenz und unterschieden sich nur in der Phase; im Bild las sich
     das als gleichfoermiges Rieseln — viele Dinge, ein Takt. Mit gestreuter
     Frequenz laeuft die Reihe auseinander und kommt nie wieder zusammen. */
  /* VFX-R2 — die SEGELKURVE. Bis hierher war das Taumeln eine reine
     Sinusbahn: gleichmaessiges Hin und Her, im Bild als "gleichfoermiges
     Rieseln" abgenommen. Ein Bluetenblatt, eine Flocke oder ein Staubkorn
     bewegt sich nicht so — es HAELT an den Umkehrpunkten, wo es flach in der
     Luft liegt, und KIPPT dann schnell durch die Mitte, wo es hochkant faellt.
     `segel()` biegt den Sinus genau dahin: der Exponent 0.7 unter 1 zieht die
     Werte an die Extreme, die Umkehrpunkte werden zu Plateaus und die
     Durchgaenge steil. Die Bahn bleibt periodisch, deterministisch und
     kostet zwei Instruktionen. (terraSegel steht im KOPF_WETTER — mitten im
     Rumpf von main() darf keine Funktion stehen.) */
  'float ft = uTaumel.x * ( 0.62 + tempo * 0.66 );',
  'float sw1 = terraSegel( sin( uZeit * ft + ph * 6.2831 ) );',
  'float sw2 = terraSegel( cos( uZeit * ft * 0.83 + ph * 4.7 ) );',
  'p.x  += sw1 * uTaumel.y;',
  'p.z  += sw2 * uTaumel.y;',
  /* Der Hoehenversatz laeuft mit DERSELBEN Kurve wie die Seitwaertsbewegung,
     nur halb so schnell: das Blatt steigt kurz an, wenn es flach liegt, und
     saeuft ab, wenn es kippt. Ein eigener, unabhaengiger Sinus (so war es
     bisher) trennt Auf und Ab von der Drehung — und dann rieselt es wieder. */
  'p.y  += terraSegel( sin( uZeit * ft * 0.61 + ph * 3.1 ) ) * uTaumel.z;',
  'p.y  -= abs( sw1 ) * uTaumel.z * 0.45;',
  /* Die grosse Bahn. Das Taumeln oben ist das Zittern im Nahbereich; hier
     kommt der weite Bogen dazu, den ein Bluetenblatt oder eine Spore
     beschreibt: derselbe Kreis, aber mit uBahn.y (0.14..0.4) verlangsamt und
     mit uBahn.x (bis 4.6 Einheiten) aufgeweitet. Zwei leicht verstimmte
     Frequenzen ergeben eine offene Lissajous-Figur — eine Bahn, die sich nie
     schliesst, statt eines sichtbaren Kreisels. */
  'float fb = ft * uBahn.y;',
  'p.x += sin( uZeit * fb + ph * 5.1 ) * uBahn.x;',
  'p.z += cos( uZeit * fb * 0.77 + ph * 2.7 ) * uBahn.x;',
  // Toroidales Wrapping in XZ um den Fokus (Muster: Wolken in sky.js).
  'vec2 rel = p.xz - uFokus.xz;',
  'rel = mod( rel + uHalb, 2.0 * uHalb ) - uHalb;',
  'p.xz = uFokus.xz + rel;',
  // Wrapping in Y; `leben` ist die normierte Bandposition 0..1.
  'float relY  = mod( p.y - uFokus.y - uBoxY.x, uBoxY.y );',
  'float leben = relY / uBoxY.y;',
  'p.y = uFokus.y + uBoxY.x + relY;',
  /* Windscherung: oben weht es schneller als unten. Bewusst als begrenzte
     VERSCHIEBUNG und nicht als Faktor auf drift*t — ein Faktor waere mit t
     multipliziert und versetzte das Partikel bei t = 3600 um Zehntausende
     Einheiten. So bleibt der Effekt im Band auf -0.45 bis +0.55 mal uSchere
     beschraenkt (bei Regen also rund -10 bis +12 Einheiten).
     Der Sprung beim Y-Umschlag faellt nicht auf: dort ist die Deckkraft
     bauartbedingt 0 (siehe Bandenden gleich darunter). */
  'p.xz += windRi * ( uSchere * ( leben - 0.45 ) );',
  /* Die Boee — dieselbe Front, die durch das Gras laeuft (terraBoee aus
     world/wind.js), abgefragt an der WELTposition des Partikels. Genau
     deshalb steht sie hier unten und nicht oben: erst nach dem Wrapping ist
     p.xz die Weltposition, an der auch der Grashalm darunter steht. Damit
     hebt dieselbe Boee im selben Moment am selben Ort Gras UND Blueten.
     Quadriert wie in terraWind() — die Boee soll ein Stoss sein, kein Wehen. */
  'float boe = terraBoee( p, uZeit );',
  // Der Deckel bei 2.4 haelt den Sturm (uWindStaerke 2.6) davon ab, die
  // Blueten in einen Kreisel zu verwandeln — er greift nur in der Spitze.
  'boe = min( boe * boe * wind, 2.4 );',
  'p.xz += windRi * ( uBoee.x * boe );',
  'p.y  += uBoee.y * boe;',
  // Alphaverlauf: zum Kachelrand hin ausblenden (kein Aufpoppen beim
  // Umschlagen) und an beiden Bandenden weich ein-/austreten.
  'float kante = max( abs( rel.x ), abs( rel.y ) ) / uHalb;',
  'float vfxA = 1.0 - smoothstep( 0.70, 1.0, kante );',
  'vfxA *= smoothstep( 0.0, 0.10, leben ) * ( 1.0 - smoothstep( 0.86, 1.0, leben ) );',
  'vfxA *= uDeckkraft * vfxVar.w;',
  'vfxA *= mix( 1.0, 0.5 + 0.5 * sin( uZeit * 2.7 * tempo + ph * 6.2831 ), uFlacker );',
  /* I6 — Partikelstaerke aus der Biom-LUT. Bis hierher gilt das Wetter der
     ganzen Karte; ab hier auch die Flaeche darunter. Ein Schneefall ueber
     einer Wuestenflaeche soll dort duenner werden, statt gleichmaessig ueber
     die Karte zu liegen.

     Nachgeschlagen wird an der WELTPOSITION des Partikels (`p.xz`), die der
     Kern oben ohnehin schon gerechnet hat — dieselbe Abbildung wie beim
     Terrain (uBiomAbb) und bei der Bruchmaske. Zwei Texturzugriffe je
     Instanz, und nur solange uBiomAn ueber 0 steht: ohne eine einzige
     Biomflaeche auf der Karte faellt der ganze Block uniform-kohaerent weg
     und das Bild ist Zeichen fuer Zeichen das bisherige.

     Auf die DECKKRAFT und nicht auf die Groesse: ein halb so grosses
     Schneekorn liest sich als weiter entfernt, ein blasseres als weniger.
     Der Deckel bei 0.05 laesst die Instanz stehen statt sie verschwinden zu
     lassen — ein Partikel, das mitten im Flug erlischt, blinkt. */
  'if ( uBiomAn > 0.5 ) {',
  '  vec2 bUv = p.xz * uBiomAbb.x + vec2( uBiomAbb.y );',
  '  vec2 bKa = texture2D( uBiomKarte, bUv ).rg;',
  '  float bZeile = ( bKa.r * 255.0 + 0.5 ) / uBiomZeilen;',
  '  float bStaerke = texture2D( uBiomLut, vec2( 0.25, bZeile ) ).a;',
  '  vfxA *= mix( 1.0, max( bStaerke, 0.05 ), bKa.g );',
  '}',
  'vec3 vfxC = mix( uFarbA, uFarbB, vfxVar.z );',
  /* Bewegungsrichtung in WELTkoordinaten. Der Boeenschub zaehlt mit: im
     Boeenstoss legt sich der Regen sichtbar flacher, und zwar genau dann,
     wenn sich auch das Gras darunter legt.
     VFX-R2 — sie bleibt hier ein WELTvektor und wird NICHT mehr in eine
     Bildschirmachse zusammengedrueckt. Das Zusammendruecken war der Fehler,
     den die Abnahme als "Bildschirm-Overlay" gelesen hat: eine Richtung im
     Sichtraum ist fuer alle Instanzen dieselbe, und alle Striche wurden
     bildkantenparallel. Aufgespannt wird der Streifen jetzt in billboard(). */
  'vec2 bew  = drift + windRi * ( uBoee.x * boe * 1.6 );',
  'vec3 bewW = vec3( bew.x, uFall, bew.y );',
  // Bildschirmachse des Quads fuer alles, was KEIN Streifen ist: die
  // Senkrechte mit Eigendrehung (taumelnde Flocken und Blaetter).
  'vec2 achseY = vec2( 0.0, 1.0 );',
  'if ( uAusricht <= 0.5 && uDreh != 0.0 ) {',
  /* Drehzuschlag in der Boee (uBoee.z): ein Blatt wirbelt im Stoss herum.
     Als WINKELAUFSCHLAG und nicht als Faktor auf die Drehrate — derselbe
     Grund wie bei der Scherung weiter oben. Ein Faktor multiplizierte den
     Winkel mit uZeit; bei uZeit = 100 spraenge das Blatt beim Boeenstoss um
     Hunderte Radiant weiter und beim Abklingen wieder zurueck. Der Aufschlag
     bleibt auf uBoee.z * 2.4 Radiant begrenzt und laeuft mit der Boee weich
     auf und ab: bei Blueten rund eine volle Drehung. */
  '  float w = uZeit * uDreh * tempo + ph * 6.2831 + uBoee.z * boe;',
  '  achseY = vec2( -sin( w ), cos( w ) );',
  '}'
].join('\n');

/* Bewegung + Alpha des Arbor-Lichtflugs: Umlauf um den Rankenfuss, dabei
   aufsteigend. Die Quellen kommen unveraendert aus terraUniforms.uArborPos —
   dasselbe Array, das auch das Arbor-Bodenlicht speist (materials.js, H3);
   setArborQuellen() aus dem Commit-Nachlauf (dirty.js) haelt es aktuell. Es
   gibt deshalb KEINE eigene Rankenliste und keinen zweiten Update-Pfad. */
const KERN_ARBOR = [
  // clamp als Sicherung: uArborPos hat feste Laenge, ein Index daneben waere
  // in GLSL undefiniert. vfxQuelle liegt bauartbedingt in 0..ARBOR_MAX-1.
  'int qi = clamp( int( vfxQuelle + 0.5 ), 0, ' + (ARBOR_MAX - 1) + ' );',
  'vec4 Q  = uArborPos[ qi ];',
  'float boden = uArborBoden[ qi ];',
  'float aktiv = ( qi < uArborAnzahl && Q.w > 0.0001 ) ? 1.0 : 0.0;',
  // Sichtbarkeitskurve: nachts voll, abends spuerbar, morgens/im Nebel aus.
  // uArborStaerke traegt bereits die weiche Tageszeit-Blende (nacht 1.0,
  // abend 0.35, morgen/nebel 0.15, mittag 0.0).
  'float sicht = smoothstep( 0.15, 0.60, uArborStaerke ) * Q.w * aktiv;',
  'float tempo = vfxVar.x;',
  'float t = uZeit * tempo;',
  'float leben = fract( vfxStart.w + t * 0.055 );',
  'float ri = vfxStart.y > 0.5 ? 1.0 : -1.0;',
  'float w  = vfxStart.x * 6.2831 + t * 0.42 * ri;',
  'float radius = max( Q.z, 1.0 ) * ( 1.15 + vfxStart.z * 1.9 ) * ( 0.75 + leben * 0.55 );',
  'vec3 p = vec3( Q.x + cos( w ) * radius,',
  '               boden + 1.2 + leben * uArborHoehe + sin( t * 0.9 + vfxStart.w * 6.2831 ) * 1.4,',
  '               Q.y + sin( w ) * radius );',
  'float vfxA = smoothstep( 0.0, 0.12, leben ) * ( 1.0 - smoothstep( 0.70, 1.0, leben ) );',
  'vfxA *= sicht * uDeckkraft * vfxVar.w;',
  'vfxA *= mix( 1.0, 0.5 + 0.5 * sin( uZeit * 2.3 * tempo + vfxStart.w * 6.2831 ), uFlacker );',
  'vec3 vfxC = mix( uArborFarbe, vec3( 1.0 ), vfxVar.z * 0.5 );',
  'vec2 achseY = vec2( 0.0, 1.0 );'
].join('\n');

/**
 * Gemeinsamer Abschluss: Billboard in Sichtkoordinaten aufspannen.
 * `p` ist bereits eine WELTposition (uFokus und uArborPos sind Weltkoordinaten),
 * deshalb steht hier viewMatrix und NICHT modelViewMatrix — beide Meshes
 * haengen ohne eigene Transformation direkt an der Szene, und die
 * Instanzmatrix bleibt die Einheitsmatrix.
 * Der Versatz wird in Sichtkoordinaten addiert: das Quad steht damit immer
 * senkrecht zur Blickachse (echtes Bildschirm-Billboard) und behaelt seine
 * WELTgroesse, laeuft also korrekt perspektivisch mit der Entfernung.
 */
/**
 * `istArbor` schaltet Mindestbreite und Streifenzweig ab: der Lichtflug haengt
 * an festen Rankenfuessen und soll perspektivisch schrumpfen wie jedes andere
 * Ding.
 *
 * MINDESTBREITE (uMindest) — der Kern des Regenbefunds aus R1. Ein Quad mit
 * 0.34 Einheiten Breite ist bei 1600 Bildpunkten und 34 Grad Blickfeld ab rund
 * 100 Einheiten Entfernung schmaler als ein Bildpunkt; die bilineare
 * Filterung verteilt seine Deckkraft dann auf die Nachbarschaft und loescht
 * es praktisch aus. Die Abhilfe waechst die Breite proportional zur
 * Sichttiefe, sobald diese uMindest ueberschreitet. Der Deckel liegt seit R2
 * bei 2.0 statt 2.6: die Ferne soll ein DICHTES FEINES Korn sein, das im
 * Schleier aufgeht, keine Reihe fetter Balken — die Wand ist Aufgabe des
 * Dunstschleiers und nicht der Einzeltropfen.
 *
 * DER STREIFENZWEIG (uAusricht) — VFX-R2, der eigentliche Umbau.
 * Bis R1 wurde der Streifen entlang einer BILDSCHIRMachse aufgespannt, die aus
 * der Bewegungsrichtung im Sichtraum kam. Diese Achse ist fuer alle Instanzen
 * dieselbe — jeder Strich lag im selben Bildwinkel, und bei einer geneigten
 * Kamera fehlte damit jede perspektivische Konvergenz. Die Abnahme nannte das
 * ein 2D-Post-Overlay, und genau das war es rechnerisch auch.
 *
 * Jetzt wird der Strich als KOERPER im Sichtraum aufgespannt:
 *   laufE  Bewegungsrichtung im Sichtraum, MIT z-Anteil — die Laengsachse.
 *   augeE  Richtung von der Kamera zum Partikel.
 *   seitE  Kreuzprodukt beider: die Querachse steht senkrecht auf beiden und
 *          dreht sich mit, sodass der Strich der Kamera immer die breite
 *          Seite zeigt (das ist der Billboard-Anteil, den er behalten muss).
 * Weil der Versatz jetzt eine z-Komponente hat, teilt die perspektivische
 * Division die beiden Streifenenden UNTERSCHIEDLICH — der Strich konvergiert.
 * Am Fluchtpunkt der Fallrichtung laufen alle Striche zusammen, am Bildrand
 * kippen sie sichtbar auseinander. Das ist der Unterschied zwischen Regen in
 * der Welt und Regen auf der Scheibe.
 *
 * TIEFENSTAFFELUNG (uStaffel = [nah, fern, staerke]) — der zweite Befund:
 * "gleiche Laenge, gleiche Deckkraft, gleiche Dichte oben wie unten".
 *   Laenge:    nah 1.45-fach, fern 0.42-fach der Typlaenge. Zusammen mit der
 *              perspektivischen Verkuerzung wird der ferne Strich damit zum
 *              kurzen Korn — wie in anno-03, wo der Regen mit der Entfernung
 *              in einen Schleier zerfaellt und nur nah als Strich lesbar ist.
 *   Deckkraft: nur die ersten 30 Einheiten vor der Linse sind ausgeblendet,
 *              danach voll, in der Ferne wieder abfallend, weil dort der
 *              Schleier uebernimmt. Ohne diesen Abfall addieren sich die
 *              fernen Striche zu einem milchigen Grau.
 *              WARNUNG AUS DER ERFAHRUNG: die Nahblende darf NICHT an tS
 *              haengen. Der erste Anlauf tat das und hat den halben Bildinhalt
 *              trocken gelegt — bei 60 Einheiten steht tS erst bei 0.05, und
 *              das ist die Entfernung, in der bei dieser Kamera der ganze
 *              Vordergrund liegt. Absolute Tiefe, nicht normierte.
 *   Streuung:  jede Instanz bekommt EIGENE Laenge (0.55..1.60) und EIGENE
 *              Helligkeit (0.45..1.35) aus zwei entkoppelten Hashes der schon
 *              vorhandenen Attribute. Kein neues Attribut, kein zusaetzlicher
 *              Speicher — und der Determinismus bleibt, weil vfxStart/vfxVar
 *              selbst deterministisch erzeugt sind.
 */
function billboard(istArbor) {
  var z = ['vec4 mvPosition = viewMatrix * vec4( p, 1.0 );'];
  if (istArbor) {
    z.push('vec2 achseX = vec2( achseY.y, -achseY.x );',
      'mvPosition.xy += ( achseX * position.x * uGroesse.x',
      '                 + achseY * position.y * uGroesse.y ) * vfxVar.y;');
  } else {
    z.push(
      'float tiefe = max( -mvPosition.z, 0.001 );',
      /* Zwei entkoppelte Streuungen aus vorhandenen Attributen. Die Faktoren
         sind teilerfremd gewaehlt, damit die beiden Reihen nicht in Takt
         geraten (sonst ist der lange Strich immer auch der helle). */
      'float lVar = 0.55 + 1.05 * fract( vfxStart.w * 7.13 + vfxVar.z * 3.77 );',
      'float hVar = 0.45 + 0.90 * fract( vfxStart.w * 3.31 + vfxVar.y * 5.91 );',
      'float tS   = smoothstep( uStaffel.x, uStaffel.y, tiefe );',
      'float laengF = mix( 1.0, mix( 1.45, 0.42, tS ) * lVar, uStaffel.z );',
      /* Die Nahblende haengt an der ABSOLUTEN Tiefe und nicht an tS.
         Erster Anlauf von R2 nahm tS und hat sich damit selbst den Regen
         weggeraeumt: bei 60 Einheiten steht tS erst bei 0.05, die Blende
         also bei 0.05 — und der ganze Vordergrund, also die untere Bildhaelfte,
         war praktisch trocken. Gemeint war nur, die Linse freizuhalten: ein
         Streifen fuenf Einheiten vor der Kamera ist ein weisser Balken quer
         durchs Bild und sonst nichts. Sechs bis dreissig Einheiten reicht
         dafuer vollstaendig. */
      'float nahD  = smoothstep( 6.0, 30.0, tiefe );',
      /* In der Ferne uebernimmt der Schleier. Ohne diesen Abfall addieren
         sich die fernen Striche zu einem milchigen Grau, das die Wand doppelt
         malt. */
      'float fernD = 1.0 - 0.45 * smoothstep( 0.55, 1.0, tS );',
      'vfxA *= mix( 1.0, nahD * fernD * hVar, uStaffel.z );',
      'float breitG = uGroesse.x;',
      'if ( uMindest > 0.0 ) breitG *= clamp( tiefe / uMindest, 1.0, 2.0 );',
      'if ( uAusricht > 0.5 ) {',
      '  vec3 laufV = ( viewMatrix * vec4( bewW, 0.0 ) ).xyz;',
      '  float lL   = length( laufV );',
      '  vec3 laufE = lL > 1e-5 ? laufV / lL : vec3( 0.0, -1.0, 0.0 );',
      '  vec3 augeE = normalize( mvPosition.xyz );',
      '  vec3 querQ = cross( laufE, augeE );',
      '  float qL   = length( querQ );',
      /* Ausweichachse fuer den Grenzfall "Blick genau laengs der Fallbahn":
         dort verschwindet das Kreuzprodukt. Die Sicht-Rechtsachse ist dann
         die richtige Antwort, weil der Strich zum Punkt entartet und seine
         Querausdehnung frei waehlbar ist. */
      '  vec3 querE = qL > 1e-4 ? querQ / qL : vec3( 1.0, 0.0, 0.0 );',
      '  mvPosition.xyz += querE * ( position.x * breitG * vfxVar.y )',
      '                  + laufE * ( position.y * uGroesse.y * vfxVar.y * laengF );',
      '} else {',
      '  vec2 achseX = vec2( achseY.y, -achseY.x );',
      '  mvPosition.xy += ( achseX * position.x * breitG',
      '                   + achseY * position.y * uGroesse.y * laengF ) * vfxVar.y;',
      '}');
  }
  z.push('gl_Position = projectionMatrix * mvPosition;');
  return z.join('\n');
}

/**
 * Haengt den VFX-Patch in ein MeshBasicMaterial. Ankerpruefung und
 * console.warn nach der Projektkonvention (render/materials.js).
 */
function vfxPatch(shader, istArbor) {
  vfxPatchInfo.versuche++;
  var pv = '#include <project_vertex>';
  if (shader.vertexShader.indexOf(pv) >= 0) {
    var kern = istArbor ? KERN_ARBOR : KERN_WETTER;
    var kopf = KOPF_GEMEINSAM + '\n' + (istArbor ? KOPF_ARBOR : KOPF_WETTER) + '\n';
    var rumpf = kern + '\n' + billboard(istArbor) +
      '\nvVfxCol = vec4( vfxC, max( vfxA, 0.0 ) );';
    shader.vertexShader = kopf + shader.vertexShader.replace(pv, rumpf);
    vfxPatchInfo.billboard++;
    patchInfo.vfx++;   // eine Zeile fuers Abnahmemuster (materials.js)
    if (istArbor) vfxPatchInfo.arbor++;
  } else {
    console.warn('terra: Shader-Patch "vfx-billboard" fand seinen Anker nicht — Partikel bleiben unbewegt.');
    return;
  }

  // Atlaszelle waehlen (nur Wetter-VFX; der Arbor-Flug nutzt immer das Korn
  // und bekommt seine Zelle fest ueber die Geometrie-UV).
  if (!istArbor) {
    var uvv = '#include <uv_vertex>';
    if (shader.vertexShader.indexOf(uvv) >= 0) {
      shader.vertexShader = shader.vertexShader.replace(uvv, uvv +
        '\n#ifdef USE_MAP\n' +
        '  vMapUv = vMapUv * vec2( uForm.y, 1.0 ) + vec2( uForm.x, 0.0 );\n' +
        '#endif');
      vfxPatchInfo.form++;
    } else {
      console.warn('terra: Shader-Patch "vfx-form" fand seinen Anker nicht — Atlaszelle bleibt fest.');
    }
  }

  var cf = '#include <color_fragment>';
  if (shader.fragmentShader.indexOf(cf) >= 0) {
    shader.fragmentShader = 'varying vec4 vVfxCol;\n' +
      shader.fragmentShader.replace(cf, cf +
        '\ndiffuseColor.rgb *= vVfxCol.rgb;\ndiffuseColor.a *= vVfxCol.a;');
    vfxPatchInfo.farbe++;
  } else {
    console.warn('terra: Shader-Patch "vfx-farbe" fand seinen Anker nicht — Partikel bleiben weiss.');
  }
}

/* ==========================================================================
   Uniforms und Material des Wetter-/Umgebungs-VFX
   ========================================================================== */
const vfxUniforms = {
  uZeit: { value: 0 },
  uFokus: { value: new THREE.Vector3(0, 0, 0) },
  uHalb: { value: 140 },
  uBoxY: { value: new THREE.Vector2(-10, 110) },
  uFall: { value: -10 },
  uDrift: { value: new THREE.Vector2(0, 0) },
  uTaumel: { value: new THREE.Vector3(0, 0, 0) },
  uBahn: { value: new THREE.Vector2(0, 1) },
  uBoee: { value: new THREE.Vector3(0, 0, 0) },
  uSchere: { value: 0 },
  uMindest: { value: 0 },
  uStaffel: { value: new THREE.Vector3(0, 1, 0) },
  uGroesse: { value: new THREE.Vector2(0.5, 0.5) },
  uAusricht: { value: 0 },
  uDreh: { value: 0 },
  uFarbA: { value: new THREE.Color(0xffffff) },
  uFarbB: { value: new THREE.Color(0xffffff) },
  uDeckkraft: { value: 0.5 },
  uFlacker: { value: 0 },
  uWindKopplung: { value: 0 },
  uForm: { value: new THREE.Vector2(0, 0.5) }
};

const vfxMat = new THREE.MeshBasicMaterial({
  map: VFX_ATLAS, transparent: true, depthWrite: false, depthTest: true,
  side: THREE.DoubleSide, fog: true
});
vfxMat.onBeforeCompile = function (shader) {
  for (var k in vfxUniforms) shader.uniforms[k] = vfxUniforms[k];
  shader.uniforms.uWindStaerke = windUniforms.uWindStaerke;
  shader.uniforms.uBiomAn = terraUniforms.uBiomAn;
  shader.uniforms.uBiomKarte = terraUniforms.uBiomKarte;
  shader.uniforms.uBiomLut = terraUniforms.uBiomLut;
  shader.uniforms.uBiomAbb = terraUniforms.uBiomAbb;
  shader.uniforms.uBiomZeilen = terraUniforms.uBiomZeilen;
  vfxPatch(shader, false);
};
vfxMat.customProgramCacheKey = function () { return 'terraVfx'; };

/* --- Arbor-Lichtflug: eigenes Material, immer additiv, ohne Nebel --------- */
const arborUniforms = {
  uZeit: { value: 0 },
  uGroesse: { value: new THREE.Vector2(0.55, 0.55) },
  uDeckkraft: { value: 0.9 },
  uFlacker: { value: 0.65 },
  uArborBoden: { value: new Float32Array(ARBOR_MAX) },
  uArborHoehe: { value: 74 }
};

const arborMat = new THREE.MeshBasicMaterial({
  map: VFX_ATLAS, transparent: true, depthWrite: false, depthTest: true,
  side: THREE.DoubleSide, fog: false, blending: THREE.AdditiveBlending
});
arborMat.onBeforeCompile = function (shader) {
  for (var k in arborUniforms) shader.uniforms[k] = arborUniforms[k];
  shader.uniforms.uArborPos = terraUniforms.uArborPos;
  shader.uniforms.uArborAnzahl = terraUniforms.uArborAnzahl;
  shader.uniforms.uArborFarbe = terraUniforms.uArborFarbe;
  shader.uniforms.uArborStaerke = terraUniforms.uArborStaerke;
  vfxPatch(shader, true);
};
arborMat.customProgramCacheKey = function () { return 'terraVfxArbor'; };

/* ==========================================================================
   DER DUNSTSCHLEIER — Nebelbaenke und Regenwaende

   WAS ER LOEST. Der lineare Nebel der Szene (scene.fog) legt ueber jede
   Entfernung genau denselben Grauwert. Das ist Luftperspektive, aber es ist
   kein WETTER: in anno-03 und marnie-010 liegt der Dunst in BAENKEN — hier
   frisst er die Ferne ganz, zwei Kilometer weiter steht die Insel klar, und
   dazwischen haengen einzelne Schwaden ueber dem Wasser. Genau diese
   Staffelung ist der Unterschied zwischen "verhangen" und "grau".
   Der Regenschleier ist dieselbe Sache um 90 Grad gedreht: senkrechte Waende,
   die von der Wolkendecke bis zum Boden reichen (anno-03, anno-09). Sie sind
   es, die den Regen mit der Wolke VERBINDEN — einzelne Tropfen koennen das
   nicht, weil ein Tropfen keine Hoehe hat, die man sehen kann.

   WARUM NICHT MEHR PARTIKEL. Eine Wand aus 30 Instanzen zu bauen kostet
   dreissigmal so viel Fuellrate wie eine Instanz, die dreissigmal so gross
   ist — und sieht schlechter aus, weil die Ueberlappungen die Deckkraft
   stufig aufaddieren. Wenige, grosse, sehr weiche Flaechen sind hier die
   billigere UND die richtigere Loesung: 30 Instanzen, ein Zeichenaufruf.

   WARUM DIE LAGE AUF DER CPU GERECHNET WIRD. Der Kopf dieser Datei begruendet
   ausfuehrlich, warum die Partikelbewegung vollstaendig im Vertexshader
   liegt: bei 2900 Regenstreifen traegt CPU-Arbeit je Instanz nicht. Bei 24
   traegt sie sehr wohl — und sie kauft etwas, das der Shader nicht kann:
   heightAt(). Eine Nebelbank, die am Gelaende KLEBT, liegt in den Senken und
   ueber dem Wasser, wo Nebel hingehoert; eine Bank auf fester Hoehe schwebt
   ueber dem Berg und schneidet durchs Tal. 30 Hoehenabfragen je Bild sind
   dreimal so viel wie der Arbor-Flug schon macht und ein Fuenfzehntel dessen,
   was rauchMesh in world/atmosphere.js pro Bild an Matrizen rechnet.

   WORAN DIE STAERKE HAENGT. An scene.fog.near — dem einzigen Wert, der
   Tageszeit UND Wetter schon zusammengerechnet enthaelt (atmosphere.js
   multipliziert den Preset-Wert mit W.fogNah). Kurze Nahsicht heisst dicke
   Luft: Nebelmorgen 110, Regen 102, Schneefall 92, Sturm 70 — klarer Mittag
   dagegen 185. Damit braucht dieses Modul KEINE neue Schnittstelle zu
   atmosphere.js: die Wetterlage steuert den Schleier ueber einen Wert, den
   sie ohnehin schon setzt. Bei klarem Wetter ist die Staerke exakt 0, das
   Mesh unsichtbar und der Zeichenaufruf weg.
   ========================================================================== */
const DUNST_N = 30;
const DUNST_BAENKE = 14;              // Instanz 0..13 Bank, 14..23 Schleier
/* VFX-R2 — Instanz 24..29: der SPRITZNEBEL. Er beantwortet den Teil der
   Abnahmefrage, den weder Streifen noch Ringe treffen: "nasse Stimmung".
   Wo Regen auf Land faellt, zerstaeubt er — in anno-09 liegt ueber der ganzen
   Marsch ein flaches, helles Band aus zurueckgeworfenem Spruehwasser, und
   genau dieses Band ist der Unterschied zwischen "es regnet" und "alles ist
   nass". Gebaut ist es als sehr flache, sehr breite Bank dicht ueber dem
   Gelaende: dieselbe Zelle, dieselbe Silhouette, dieselben gehaltenen Stufen —
   nur an den NIEDERSCHLAG gehaengt statt an die Sichttruebung, damit es mit
   dem Regen kommt und geht und bei Nebel ohne Regen ausbleibt.
   Sechs Instanzen im selben Zeichenaufruf; das Mesh war ohnehin da. */
const DUNST_SPRITZ = 24;
/* Nahsicht, zwischen der die Staerke laeuft: bei 150 Einheiten ist die Luft
   klar, bei 95 steht der Schleier voll. Gemessene Nahsichten: Mittag 185,
   Nacht 220, Abend 165, Morgen 140 — alle klar; Nebel 110, Regen 102,
   Schneefall 92, Sturm 70 — alle dick. Die Spanne trennt die beiden Gruppen
   sauber, ohne dass hier eine Wetterlage beim Namen genannt werden muss. */
const DUNST_NAH0 = 95, DUNST_NAH1 = 150;

const dunstUniforms = {
  uZeit: { value: 0 },
  uDunstFarbe: { value: new THREE.Color(0xdde2e2) },
  /* VFX-R2 — die FERNfarbe der Baenke. Die Abnahme hielt fest, dass
     Mittelgrund, Fernhuegel und Meer auf denselben entsaettigten Pastellwert
     zusammenlaufen: "Wertbegrenzung durch Nebel, keine Tiefenstaffelung".
     Ein Dunstschleier, der in jeder Entfernung dieselbe Farbe hat, kann nur
     das leisten. Deshalb hat er jetzt zwei Enden — nah die Nebelfarbe der
     Szene, fern eine kuehlere und hellere Fassung davon — und der Shader
     blendet ueber die Sichttiefe zwischen ihnen. Damit verschiebt sich mit
     der Distanz die FARBE und nicht nur der Wert (anno-03 geht kuehl
     blaugrau, kazetachinu-006 schiebt warmes Ocker in die Ferne; welches von
     beidem, entscheidet die Nebelfarbe der Tageszeit). */
  uDunstFern: { value: new THREE.Color(0xe6ecee) },
  uSchleierFarbe: { value: new THREE.Color(0xccd6de) },
  // Schraege der Regenwand: der KOPF wandert gegen den Wind, weil ein Tropfen,
  // der oben startet, unten weiter windabwaerts ankommt. Dieselbe Geometrie
  // wie bei den Streifen (ausricht 1) — beide muessen in dieselbe Richtung
  // kippen, sonst kaempfen sie gegeneinander.
  // R2: aus der gemeinsamen Windschraege abgeleitet statt frei gewaehlt. Der
  // Faktor 0.26 rechnet sie auf das Verhaeltnis Quer-zu-Hoehe des Quads um —
  // die Wand ist 0.36*reich hoch und 0.32*reich breit, ihr Kopf wandert damit
  // rund eine Drittel Wandbreite gegen den Wind.
  uSchraeg: { value: WIND_SCHRAEG * 0.26 }
};

/* Windrichtung als Literal — dieselbe Begruendung wie im Wetterkern. */
const DUNST_WIND_GLSL = 'vec3( ' + WIND_RICHTUNG[0].toFixed(5) + ', 0.0, ' +
  WIND_RICHTUNG[1].toFixed(5) + ' )';

const DUNST_KOPF = [
  'attribute vec4 dunstOrt;',    // xyz Weltmitte des Quads, w Deckkraft
  'attribute vec4 dunstMass;',   // x Halbbreite, y Halbhoehe, z Atlaszelle, w Scrolltempo
  'uniform float uZeit;',
  'uniform vec3  uDunstFarbe;',
  'uniform vec3  uDunstFern;',
  'uniform vec3  uSchleierFarbe;',
  'uniform float uSchraeg;',
  'uniform float uWindStaerke;',
  'varying vec4  vVfxCol;',
  'varying vec3  vDunstUv;'
].join('\n');

/* Zylindrisches Billboard: die Flaeche dreht sich NUR um die Welt-Hochachse.
   Ein volles Bildschirm-Billboard (wie bei den Partikeln) waere hier falsch —
   eine Regenwand, die sich mit der Kameraneigung mitkippt, haengt schief in
   der Landschaft, und eine Nebelbank waere von oben ein Blatt Papier.
   Die Rechtsachse ist das Kreuzprodukt aus Blickachse (in Sichtkoordinaten
   0,0,-1) und der abgebildeten Welt-Hochachse; das ergibt direkt
   vec3( up.y, -up.x, 0 ). Der Betragsschutz faengt den Grenzfall Blick
   senkrecht nach unten ab, in dem das Kreuzprodukt verschwindet. */
const DUNST_KERN = [
  'vec4 mvPosition = viewMatrix * vec4( dunstOrt.xyz, 1.0 );',
  'vec3 hochV = ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz;',
  'vec3 rQ = vec3( hochV.y, -hochV.x, 0.0 );',
  'float rL = length( rQ );',
  'vec3 rechtsV = rL > 0.001 ? rQ / rL : vec3( 1.0, 0.0, 0.0 );',
  // dunstMass.z traegt die Atlaszelle (0.0 Bank, 0.5 Schleier) — mal zwei ist
  // sie zugleich das Kennzeichen "ist Schleier". Nur der Schleier schert.
  'float istSchleier = dunstMass.z * 2.0;',
  'vec3 windV = ( viewMatrix * vec4( ' + DUNST_WIND_GLSL + ', 0.0 ) ).xyz;',
  /* VFX-R2 — die BANK SCHERT MIT. Bisher stand hinter dem Ausdruck der
     Faktor `istSchleier`, und damit war die Bank die einzige Sache im Bild,
     die den Wind nicht kannte. Die Abnahme las das als "der Nebel steht
     still". In anno-09 teilen sich Regen, Bodendunst und Feuerrauch dieselbe
     leichte Scherung; sie muss nicht gleich stark sein — eine Bank ist
     traege — aber sie muss dieselbe Richtung haben. 0.42 gegen 1.0. */
  'float scherA = mix( 0.42, 1.0, istSchleier );',
  'float quer = -dot( windV, rechtsV ) * uSchraeg * min( uWindStaerke, 2.2 ) * scherA;',
  'float hoch01 = position.y + 0.5;',
  'mvPosition.xyz += rechtsV * ( position.x * 2.0 * dunstMass.x',
  '                            + quer * hoch01 * dunstMass.y )',
  '                + hochV  * ( position.y * 2.0 * dunstMass.y );',
  'gl_Position = projectionMatrix * mvPosition;',
  'float dTiefe = -mvPosition.z;',
  /* Nahblende — und seit R2 zugleich die NAHDISTANZ-STARTZONE, die die
     Abnahme vermisst hat ("der milchige Nebelhub liegt bis in den untersten
     Bildrand, wo praktisch keine Distanz mehr ist"). Ein Dunst ist die Summe
     ueber einen Sichtweg: auf zwanzig Metern gibt es nichts zu summieren, und
     genau deshalb ist in marnie-010 die Wasserflaeche im Vordergrund klar und
     der Dunst beginnt erst dahinter.
     Die Bank startet deshalb erst bei rund 55 Einheiten und steht erst bei
     150 voll. Die Regenwand darf frueher einsetzen — sie ist ein Ereignis in
     der Landschaft und keine aufsummierte Sichttruebung. */
  'float nahB = mix( smoothstep( 34.0, 92.0, dTiefe ),',
  '                  smoothstep( 22.0, 74.0, dTiefe ), istSchleier );',
  /* Luftperspektive der Schicht selbst: nah die Nebelfarbe, fern die
     Fernfarbe (Begruendung bei uDunstFern). Die Regenwand macht das nicht
     mit — sie ist Niederschlag und keine Sichttruebung. */
  'vec3 bankC = mix( uDunstFarbe, uDunstFern, smoothstep( 110.0, 430.0, dTiefe ) );',
  'vVfxCol = vec4( mix( bankC, uSchleierFarbe, istSchleier ),',
  '                max( dunstOrt.w * nahB, 0.0 ) );',
  // Rohe Quadkoordinate 0..1 fuer die Huelle im Fragment, plus das Kennzeichen.
  'vDunstUv = vec3( position.xy + 0.5, istSchleier );'
].join('\n');

/**
 * Patch des Dunstmaterials. Dieselben drei Anker wie beim Partikelpatch und
 * dieselbe Warnkonvention (render/materials.js): kein stiller Ausfall.
 */
function dunstPatch(shader) {
  vfxPatchInfo.versuche++;
  var pv = '#include <project_vertex>';
  if (shader.vertexShader.indexOf(pv) >= 0) {
    shader.vertexShader = DUNST_KOPF + '\n' + shader.vertexShader.replace(pv, DUNST_KERN);
    vfxPatchInfo.dunst++;
    patchInfo.vfx++;
  } else {
    console.warn('terra: Shader-Patch "vfx-dunst" fand seinen Anker nicht — der Schleier bleibt unbewegt.');
    return;
  }

  /* Atlaszelle waehlen UND den Schleier nach unten scrollen. Das Scrollen
     macht aus einer stehenden Textur fallenden Regen; die Zelle ist in V
     streng periodisch gemalt (malSchleier), damit dabei keine Naht laeuft.
     Die Bank scrollt nicht — ihr Tempo im Attribut ist 0. */
  var uvv = '#include <uv_vertex>';
  if (shader.vertexShader.indexOf(uvv) >= 0) {
    shader.vertexShader = shader.vertexShader.replace(uvv, uvv +
      '\n#ifdef USE_MAP\n' +
      '  vMapUv += vec2( dunstMass.z, -uZeit * dunstMass.w );\n' +
      '#endif');
    vfxPatchInfo.form++;
  } else {
    console.warn('terra: Shader-Patch "vfx-dunst-form" fand seinen Anker nicht — der Schleier faellt nicht.');
  }

  var cf = '#include <color_fragment>';
  if (shader.fragmentShader.indexOf(cf) >= 0) {
    shader.fragmentShader = 'varying vec4 vVfxCol;\nvarying vec3 vDunstUv;\n' +
      shader.fragmentShader.replace(cf, cf + '\n' + [
        /* Die FORM des Regenschleiers. Sie steht hier und nicht in der Textur,
           weil die Textur scrollt (Begruendung bei malSchleier) — eine
           gescrollte Form waere eine Form, die aus dem Quad herauslaeuft.
           vDunstUv ist die rohe Quadkoordinate und scrollt nicht.

           Trapez: unten ueber die volle Breite, oben auf 40 % verjuengt. So
           sieht ein Regenschauer unter einer Wolke aus — eine Saeule, die
           sich nach unten oeffnet, weil der Wind sie auffaechert (anno-03).
           Senkrecht: unten sofort da (die Wand steht auf dem Land), nach oben
           ueber zwei Drittel der Hoehe in die Wolkendecke ausblendend.
           Die Bank braucht davon nichts — sie bringt ihre Form als Silhouette
           aus der Textur mit; mix() mit dem Kennzeichen schaltet die Huelle
           fuer sie ab. */
        'float wB   = mix( 1.05, 0.40, vDunstUv.y );',
        'float seit = 1.0 - smoothstep( wB * 0.30, wB, abs( vDunstUv.x - 0.5 ) * 2.0 );',
        'float hue  = smoothstep( 0.0, 0.10, vDunstUv.y )',
        '           * ( 1.0 - smoothstep( 0.34, 1.0, vDunstUv.y ) ) * seit;',
        /* EIGENSCHATTIERUNG DER BANK (R2). Die Abnahme: "flaechig fast
           deckendes Weiss ... ohne Dichtegradient und ohne Eigenschattierung".
           Eine Nebelbank ist ein Koerper: ihr Scheitel bekommt Himmelslicht,
           ihr Fuss liegt im eigenen Schatten. Als Faktor auf die Farbe und
           nicht auf die Deckkraft — eine dunklere Bank ist eine beleuchtete
           Bank, eine duennere waere eine andere Bank. */
        'float schatt = mix( 0.82, 1.07, smoothstep( 0.02, 0.72, vDunstUv.y ) );',
        'diffuseColor.rgb *= vVfxCol.rgb * mix( schatt, 1.0, vDunstUv.z );',
        /* Gesamtdeckkraft: Silhouette aus der Textur mal Instanzdeckkraft mal
           Huelle. Sie und nicht ein Teilbetrag ist es, was gleich gestuft
           wird — eine Stufung, die die Silhouette nicht mitnimmt, waere ein
           waagerechtes Streifenmuster statt einer Lasurkante. */
        'float dA = diffuseColor.a * vVfxCol.a * mix( 1.0, hue, vDunstUv.z );',
        /* DICHTEGRADIENT statt Deckelwand: die Bank ist unten dicht und laeuft
           nach oben aus. In der Textur steht die Silhouette, hier die Dichte —
           zwei Dinge, zwei Zustaendigkeiten (dieselbe Trennung wie bei
           malSchleier). */
        'dA *= mix( mix( 1.14, 0.58, smoothstep( 0.15, 0.95, vDunstUv.y ) ), 1.0, vDunstUv.z );',
        /* Gamma unter 1 hebt die MITTEN und laesst die Null bei Null: die
           Bank bekommt einen dichten Kern, ohne dass ihr Saum breiter wird.
           Ohne das lag die ganze Bank bei rund einem Viertel Deckkraft — im
           Bild eine Ahnung, keine Schwade. Eine hoehere Instanzdeckkraft
           haette stattdessen auch den Saum mit angehoben und genau das
           flaechige Weiss zurueckgebracht, das die Abnahme geruegt hat. */
        'dA = pow( clamp( dA, 0.0, 1.0 ), 0.72 );',
        /* GEHALTENE STUFEN — der gezeichnete Charakter, den die Abnahme in der
           ganzen Effektebene vermisst hat ("keine Tuschekante, kein
           Pinselrand, keine gehaltenen Stufen"). Ein gemalter Dunst ist eine
           LASUR: wenige gehaltene Dichten, die uebereinanderliegen, keine
           stufenlose Rampe eines Weichzeichners. In marnie-010 sieht man die
           Lagen als Plateaus, und genau dort entsteht die Form.
           Fuenf Stufen; der smoothstep in der Bruchzahl haelt jede Stufe ueber
           rund 70 % ihrer Breite und blendet auf den restlichen 30 % weich zur
           naechsten — hart genug, dass man die Lage sieht, weich genug, dass
           keine Ringe entstehen. Nur die Bank: eine gestufte Regenwand waere
           eine Jalousie. */
        'float stB = 4.0;',
        'float stQ = floor( dA * stB ) / stB;',
        'float stF = smoothstep( 0.34, 0.66, fract( dA * stB ) );',
        /* Ein Drittel der stufenlosen Rampe bleibt beigemischt. Rein gestuft
           verschwand der weiche Aussensaum jeder Bank restlos (alles unter
           1/4 Stufe faellt auf 0) — die Bank bekam damit zwar Lagen, verlor
           aber ihre Ausdehnung, und im Bild blieb von der Schwade ein
           Kern uebrig. Die Beimischung haelt den Saum und laesst die Lagen
           trotzdem lesbar. */
        'float stufig = mix( mix( stQ, stQ + 1.0 / stB, stF ), dA, 0.34 );',
        'diffuseColor.a = mix( stufig, dA, vDunstUv.z );'
      ].join('\n'));
    vfxPatchInfo.farbe++;
  } else {
    console.warn('terra: Shader-Patch "vfx-dunst-farbe" fand seinen Anker nicht — der Schleier bleibt weiss.');
  }
}

const dunstMat = new THREE.MeshBasicMaterial({
  map: DUNST_ATLAS, transparent: true, depthWrite: false, depthTest: true,
  side: THREE.DoubleSide, fog: true
});
dunstMat.onBeforeCompile = function (shader) {
  for (var k in dunstUniforms) shader.uniforms[k] = dunstUniforms[k];
  shader.uniforms.uWindStaerke = windUniforms.uWindStaerke;
  dunstPatch(shader);
};
dunstMat.customProgramCacheKey = function () { return 'terraVfxDunst'; };

/* ==========================================================================
   Geometrien und Meshes. Die Instanzmatrix wird EINMAL auf die Einheitsmatrix
   gesetzt und danach nie wieder angefasst — die Position kommt komplett aus
   dem Vertexshader. frustumCulled bleibt aus (three kennt die wahren
   Positionen nicht), renderOrder 4 legt die Partikel hinter die Wolken (3).
   ========================================================================== */
function einheitsMatrizen(mesh, n) {
  var m = new THREE.Matrix4();
  for (var i = 0; i < n; i++) mesh.setMatrixAt(i, m);
  mesh.instanceMatrix.needsUpdate = true;
}

/** Halbe Zellenbreite im Atlas: die Basis-UV zeigt auf Zelle 0. */
function quadGeo() {
  var g = new THREE.PlaneGeometry(1, 1);
  var uv = g.attributes.uv;
  for (var i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 0.5);
  uv.needsUpdate = true;
  return g;
}

/* --- Wetter-/Umgebungsmesh ---------------------------------------------- */
var vfxGeo = quadGeo();
(function () {
  var rng = rngOf(0x7f2c19);
  var start = new Float32Array(VFX_MAX * 4);
  var vari = new Float32Array(VFX_MAX * 4);
  for (var i = 0; i < VFX_MAX; i++) {
    start[i * 4] = rr(rng, -1, 1);          // X normiert
    start[i * 4 + 1] = rng();               // Y normiert (0..1 im Band)
    start[i * 4 + 2] = rr(rng, -1, 1);      // Z normiert
    start[i * 4 + 3] = rng();               // Phase 0..1
    vari[i * 4] = rr(rng, 0.78, 1.28);      // Tempo
    vari[i * 4 + 1] = rr(rng, 0.62, 1.45);  // Groessenfaktor
    vari[i * 4 + 2] = rng();                // Farbmischung
    vari[i * 4 + 3] = rr(rng, 0.55, 1.0);   // Alphafaktor
  }
  vfxGeo.setAttribute('vfxStart', new THREE.InstancedBufferAttribute(start, 4));
  vfxGeo.setAttribute('vfxVar', new THREE.InstancedBufferAttribute(vari, 4));
})();
const vfxMesh = new THREE.InstancedMesh(vfxGeo, vfxMat, VFX_MAX);
vfxMesh.frustumCulled = false;
vfxMesh.renderOrder = 4;
vfxMesh.count = 0;
vfxMesh.visible = false;
einheitsMatrizen(vfxMesh, VFX_MAX);

/* --- Dunstschleier ------------------------------------------------------- */
/* Startwerte je Instanz. Deterministisch aus rngOf() wie alles hier; sie
   aendern sich nie, nur ihre Abbildung auf die Welt tut es (dunstStellen). */
/* Die drei Tiefenlagen als [Kachelstreckung, Groessenstreckung,
   Deckkraftfaktor]. Begruendung an der Verwendungsstelle in dunstStellen(). */
const DUNST_KLASSE = [
  [0.55, 0.50, 1.00],   // 0 nah    — kleine Zungen im Vordergrund
  [1.00, 1.00, 0.98],   // 1 mittel — die Lage, die die Arbeit macht
  [2.05, 2.00, 0.80]    // 2 fern   — grosse Waende hinter allem
];

const DUNST_FEST = (function () {
  var rng = rngOf(0x5c31a7);
  var a = [];
  for (var i = 0; i < DUNST_N; i++) {
    a.push({
      // Der Spritznebel laeuft im Bank-Zweig (Zelle 0, Bank-Silhouette),
      // unterscheidet sich dort aber in Groesse, Hoehe und Quelle.
      bank: i < DUNST_BAENKE || i >= DUNST_SPRITZ,
      spritz: i >= DUNST_SPRITZ,
      /* Reihum verteilt und nicht gewuerfelt: bei 14 Baenken haette ein
         Wuerfel leicht fuenf in dieselbe Lage gelegt und eine ganz leer
         gelassen — dann fehlte eine Ebene der Staffelung, und genau die ist
         der Zweck. Reihum stehen 5/5/4 fest. */
      klasse: i % 3,
      u: rr(rng, -1, 1), v: rr(rng, -1, 1),   // Platz in der Wanderkachel
      tempo: rr(rng, 0.35, 1.15),             // Eigenanteil an der Windfahrt
      breit: rr(rng, 0.70, 1.34),
      hoch: rr(rng, 0.76, 1.30),
      hebung: rr(rng, 0, 1),
      deck: rr(rng, 0.58, 1.0),
      phase: rng()
    });
  }
  return a;
})();

var dunstGeo = quadGeo();
const dunstOrt = new Float32Array(DUNST_N * 4);
const dunstMass = new Float32Array(DUNST_N * 4);
(function () {
  for (var i = 0; i < DUNST_N; i++) {
    // Atlaszelle steht ein fuer alle Mal fest; Groesse und Lage schreibt
    // dunstStellen() je Bild. Deckkraft 0 bis dahin — nie ein erstes Bild
    // mit undefinierter Lage.
    dunstMass[i * 4 + 2] = DUNST_FEST[i].bank ? 0 : 0.5;
  }
  var aOrt = new THREE.InstancedBufferAttribute(dunstOrt, 4);
  var aMass = new THREE.InstancedBufferAttribute(dunstMass, 4);
  aOrt.setUsage(THREE.DynamicDrawUsage);
  aMass.setUsage(THREE.DynamicDrawUsage);
  dunstGeo.setAttribute('dunstOrt', aOrt);
  dunstGeo.setAttribute('dunstMass', aMass);
})();
const dunstMesh = new THREE.InstancedMesh(dunstGeo, dunstMat, DUNST_N);
dunstMesh.frustumCulled = false;
// renderOrder 3 wie die Wolken: der Schleier gehoert zur Luft und liegt damit
// vor dem Himmel und hinter den Partikeln (4).
dunstMesh.renderOrder = 3;
dunstMesh.visible = false;
einheitsMatrizen(dunstMesh, DUNST_N);

/* ==========================================================================
   AUFSCHLAGSRINGE — der Regen trifft auf etwas

   WAS SIE LOESEN. Die Bildabnahme von R1 nannte das den entscheidenden
   Ausfall, und der Satz sitzt: "Nimmt man die weissen Striche aus dem Bild
   heraus, wuerde niemand die Szene als Regenszene bezeichnen." Der Grund ist
   nicht die Qualitaet der Striche, sondern dass sie folgenlos blieben — der
   Teich, die Bucht und die Kuestenlinie lagen spiegelglatt da. In anno-09 ist
   es genau umgekehrt: das ganze Wasserfeld ist mit konzentrischen Ringen
   ueberzogen, und DAS verkauft den Regen. Fallende Tropfen sind die Ursache,
   der Aufschlag ist die Wirkung, und ein Bild liest die Wirkung.

   WIE DIE RINGE WISSEN, WO WASSER IST — die drei Wege und warum es dieser
   geworden ist:
     (a) Wasserkarte einlesen. Haette eine neue Schnittstelle zu world/water.js
         gebraucht, die dieses Modul nicht bauen darf.
     (b) heightAt() je Instanz auf der CPU. 900 Hoehenabfragen je Bild — das
         Vierzigfache des Dunstschleiers, fuer eine Frage, die der
         Tiefenpuffer bereits beantwortet.
     (c) DER TIEFENPUFFER SELBST. Die Ringe liegen auf einer waagerechten
         Ebene ein halbes Mass ueber dem Meeresspiegel. Wo Land ueber dem
         Spiegel steht, verdeckt das Gelaende sie — ohne eine einzige
         Abfrage, ohne Sonderfall, exakt an der Uferlinie. Wo Wasser steht,
         schwimmen sie darauf. Die Maskierung ist damit geschenkt und
         obendrein pixelgenau; sie kostet buchstaeblich keine Anweisung.
   Gewaehlt ist (c). Der halbe Meter Schwebehoehe deckt zugleich die Wogen der
   Wasserflaeche ab (Amplitude in world/water.js zusammen 0.78) — ohne ihn
   verschluckte jeder Wellenkamm die Ringe dahinter.

   DIE SEEFLAECHEN sind der eine Fall, den der Tiefenpuffer nicht loest: ein
   Bergsee liegt auf seiner eigenen Spiegelhoehe, teils viele Mass ueber dem
   Meer. Ein Ring auf Meereshoehe laege dort UNTER dem Seeblatt und waere
   verdeckt. Deshalb traegt der Shader bis zu vier Seekreise (Mitte, Radius,
   Spiegel) als Uniform: liegt ein Ring in einem davon, hebt er sich auf
   dessen Spiegel. Vier, weil in einem Blickfeld nie mehr als eine Handvoll
   Seen liegt und ein Kreis vier Gleitkommazahlen kostet — die Liste stellt
   seenSammeln() alle 40 Bilder neu.

   KOSTEN. Ein Zeichenaufruf, 900 Instanzen, 1800 Dreiecke, die gesamte
   Bewegung im Vertexshader (kein CPU-Anteil je Instanz, dieselbe Bauart wie
   die Partikel). Der CPU-Anteil des ganzen Systems sind vier Uniforms je Bild
   plus alle 40 Bilder ein Durchlauf durch die Elementliste (seenSammeln).
   Die Fuellrate ist mit dem gesenkten Mindestbreiten-Deckel der Regenstreifen
   gegenfinanziert; gemessen liegt die Bildzeit der Aufnahme wetter-regen
   unveraendert bei 17 ms Median, die Zeichenaufrufe stiegen von 234 auf 236
   (Ringe und Spritznebel).
   ========================================================================== */
const RING_N = 900;
const RING_HALB = 100;      // halbe Kantenlaenge der Wanderkachel um den Fokus
const RING_HUB = 0.62;      // Schwebehoehe ueber dem Spiegel (> Wogenamplitude)
const RING_SEEN = 4;        // so viele Seekreise traegt der Shader

const ringUniforms = {
  uZeit: { value: 0 },
  uRingFokus: { value: new THREE.Vector3(0, 0, 0) },
  uRingHalb: { value: RING_HALB },
  uRingY: { value: WATER + RING_HUB },
  uRingStaerke: { value: 0 },
  // [Maximalradius in Welteinheiten, Einschlaege je Sekunde]
  uRingMass: { value: new THREE.Vector2(2.10, 0.62) },
  uRingFarbe: { value: new THREE.Color(0xdfe9ee) },
  /* Seekreise: xy Mitte, z Radius im QUADRAT (spart die Wurzel im Shader),
     w Spiegelhoehe. Ein unbenutzter Platz traegt z = -1: `dot(d,d) < -1` ist
     nie wahr, damit braucht es keinen Zaehler als zweites Uniform und keine
     Schleifenbedingung, die von einem Uniform abhaengt. */
  uRingSeen: { value: (function () {
    var a = [];
    for (var i = 0; i < RING_SEEN; i++) a.push(new THREE.Vector4(0, 0, -1, 0));
    return a;
  })() }
};

const RING_KOPF = [
  'attribute vec4 ringStart;',   // x,z normiert, z Phase, w Eigentempo 0..1
  'uniform float uZeit;',
  'uniform vec3  uRingFokus;',
  'uniform float uRingHalb;',
  'uniform float uRingY;',
  'uniform float uRingStaerke;',
  'uniform vec2  uRingMass;',
  'uniform vec3  uRingFarbe;',
  'uniform vec4  uRingSeen[' + RING_SEEN + '];',
  'varying vec4  vVfxCol;'
].join('\n');

const RING_KERN = [
  // Toroidales Wrapping um den Fokus — dasselbe Muster wie bei den Partikeln.
  'vec2 rp  = ringStart.xy * uRingHalb;',
  'vec2 rel = mod( rp - uRingFokus.xz + uRingHalb, 2.0 * uRingHalb ) - uRingHalb;',
  'vec2 wxz = uRingFokus.xz + rel;',
  /* Wasserhoehe. Meeresspiegel, sofern der Ring nicht in einem Seekreis
     liegt; dann dessen Spiegel. Feste Schleifenlaenge, kein break — eine
     Verzweigung, die fuer alle Instanzen gleich laeuft, ist auf der GPU
     billiger als eine, die es nicht tut. */
  'float ringY = uRingY;',
  'for ( int i = 0; i < ' + RING_SEEN + '; i++ ) {',
  '  vec4 Sk = uRingSeen[ i ];',
  '  vec2 dS = wxz - Sk.xy;',
  '  ringY = ( dot( dS, dS ) < Sk.z ) ? Sk.w : ringY;',
  '}',
  /* Die Mitte zuerst abbilden: ihre Sichttiefe steuert die Groesse, und ein
     Ring, den man ohnehin nicht mehr sieht, soll gar nicht erst Flaeche
     belegen (deshalb geht die Fernblende in den RADIUS und nicht nur in die
     Deckkraft — Fuellrate spart man nur mit Geometrie). */
  'vec4 mvMitte = viewMatrix * vec4( wxz.x, ringY, wxz.y, 1.0 );',
  'float rTiefe = -mvMitte.z;',
  'float fern   = 1.0 - smoothstep( 190.0, 285.0, rTiefe );',
  'float nah    = smoothstep( 5.0, 20.0, rTiefe );',
  /* Lebenslauf eines Einschlags: der Ring waechst von fast nichts auf seinen
     Maximalradius und verblasst dabei. Deckkraft als (1-leben)^1.4 — der
     Aufschlag ist sofort da und klingt lange aus, nicht umgekehrt.
     `ringStart.w` streut Tempo UND Groesse: kleine Ringe laufen schnell,
     grosse langsam, so wie ein kleiner und ein grosser Tropfen. */
  'float takt  = 0.55 + ringStart.w * 0.95;',
  'float leben = fract( ringStart.z + uZeit * uRingMass.y * takt );',
  'float rad   = uRingMass.x * ( 0.10 + 0.90 * leben )',
  '            * ( 0.55 + ringStart.w * 0.95 ) * fern;',
  'float a = smoothstep( 0.0, 0.09, leben ) * pow( 1.0 - leben, 1.4 );',
  'a *= uRingStaerke * nah * fern;',
  // Kachelrand ausblenden — kein Aufpoppen beim Umschlagen.
  'a *= 1.0 - smoothstep( 0.74, 1.0, max( abs( rel.x ), abs( rel.y ) ) / uRingHalb );',
  'vec4 mvPosition = mvMitte;',
  'mvPosition.xyz += ( viewMatrix * vec4( position.x * 2.0 * rad, 0.0,',
  '                                       position.y * 2.0 * rad, 0.0 ) ).xyz;',
  'gl_Position = projectionMatrix * mvPosition;',
  'vVfxCol = vec4( uRingFarbe, max( a, 0.0 ) );'
].join('\n');

/** Patch des Ringmaterials — dieselben Anker und dieselbe Warnkonvention. */
function ringPatch(shader) {
  vfxPatchInfo.versuche++;
  var pv = '#include <project_vertex>';
  if (shader.vertexShader.indexOf(pv) >= 0) {
    shader.vertexShader = RING_KOPF + '\n' + shader.vertexShader.replace(pv, RING_KERN);
    vfxPatchInfo.ring++;
    patchInfo.vfx++;
  } else {
    console.warn('terra: Shader-Patch "vfx-ring" fand seinen Anker nicht — der Regen trifft auf nichts.');
    return;
  }
  var cf = '#include <color_fragment>';
  if (shader.fragmentShader.indexOf(cf) >= 0) {
    shader.fragmentShader = 'varying vec4 vVfxCol;\n' +
      shader.fragmentShader.replace(cf, cf +
        '\ndiffuseColor.rgb *= vVfxCol.rgb;\ndiffuseColor.a *= vVfxCol.a;');
    vfxPatchInfo.farbe++;
  } else {
    console.warn('terra: Shader-Patch "vfx-ring-farbe" fand seinen Anker nicht — die Ringe bleiben weiss.');
  }
}

const ringMat = new THREE.MeshBasicMaterial({
  map: RING_TEX, transparent: true, depthWrite: false, depthTest: true,
  side: THREE.DoubleSide, fog: true
});
ringMat.onBeforeCompile = function (shader) {
  for (var k in ringUniforms) shader.uniforms[k] = ringUniforms[k];
  ringPatch(shader);
};
ringMat.customProgramCacheKey = function () { return 'terraVfxRing'; };

/* Eigene Geometrie mit VOLLER Basis-UV: quadGeo() halbiert sie fuer den
   zweizelligen Partikelatlas, die Ringtextur hat nur eine Zelle. */
var ringGeo = new THREE.PlaneGeometry(1, 1);
(function () {
  var rng = rngOf(0x2d9f41);
  var start = new Float32Array(RING_N * 4);
  for (var i = 0; i < RING_N; i++) {
    start[i * 4] = rr(rng, -1, 1);
    start[i * 4 + 1] = rr(rng, -1, 1);
    start[i * 4 + 2] = rng();          // Phase im Lebenslauf
    start[i * 4 + 3] = rng();          // Eigentempo/Groesse
  }
  ringGeo.setAttribute('ringStart', new THREE.InstancedBufferAttribute(start, 4));
})();
const ringMesh = new THREE.InstancedMesh(ringGeo, ringMat, RING_N);
ringMesh.frustumCulled = false;
/* renderOrder 7: hinter der Wasserflaeche (4), dem Seeblatt (5) und dessen
   Schaumsaum (6) — die Ringe liegen AUF dem Wasser und muessen nach ihm
   gezeichnet werden, sonst rechnet der Alphablender sie mit dem Untergrund
   von vorgestern. */
ringMesh.renderOrder = 7;
ringMesh.visible = false;
einheitsMatrizen(ringMesh, RING_N);

/* --- Arbor-Lichtflug ----------------------------------------------------- */
const ARBOR_PRO_QUELLE = 56;
const ARBOR_N = ARBOR_MAX * ARBOR_PRO_QUELLE;      // 8 * 56 = 448
var arborGeo = quadGeo();
(function () {
  var rng = rngOf(0x3ab5e1);
  var start = new Float32Array(ARBOR_N * 4);
  var vari = new Float32Array(ARBOR_N * 4);
  var quelle = new Float32Array(ARBOR_N);
  for (var i = 0; i < ARBOR_N; i++) {
    start[i * 4] = rng();                     // Startwinkel 0..1
    start[i * 4 + 1] = rng();                 // Umlaufrichtung (>0.5 = links)
    start[i * 4 + 2] = rng();                 // Radiusmischung
    start[i * 4 + 3] = rng();                 // Phase im Aufstieg
    vari[i * 4] = rr(rng, 0.7, 1.35);
    vari[i * 4 + 1] = rr(rng, 0.5, 1.5);
    vari[i * 4 + 2] = rng();
    vari[i * 4 + 3] = rr(rng, 0.45, 1.0);
    quelle[i] = Math.floor(i / ARBOR_PRO_QUELLE);
  }
  arborGeo.setAttribute('vfxStart', new THREE.InstancedBufferAttribute(start, 4));
  arborGeo.setAttribute('vfxVar', new THREE.InstancedBufferAttribute(vari, 4));
  arborGeo.setAttribute('vfxQuelle', new THREE.InstancedBufferAttribute(quelle, 1));
})();
const arborMesh = new THREE.InstancedMesh(arborGeo, arborMat, ARBOR_N);
arborMesh.frustumCulled = false;
arborMesh.renderOrder = 4;
arborMesh.count = ARBOR_N;
einheitsMatrizen(arborMesh, ARBOR_N);

/* ==========================================================================
   API
   ========================================================================== */
var aktiverTyp = 'aus';
var aktiveDichte = 0;
var _farbe = new THREE.Color();
/* Anteil, mit dem der aktive Typ den Regenschleier anwirft: T.schleier mal
   Dichte, gedeckelt. Wird in setVfx() fortgeschrieben und in tickVfx()
   gelesen — der Schleier folgt damit der Wetterblende ohne eigenen Weg. */
var schleierAnteil = 0;
/* Dasselbe fuer die Aufschlagsringe: T.ring mal Dichte. Getrennt vom
   Schleieranteil, weil Schneefall Ringe wirft (0.22 — eine Flocke trifft das
   Wasser weich) aber keine Regenwand. */
var ringAnteil = 0;

/* Die Szene, um an scene.fog zu kommen. Sie ist die Quelle fuer Farbe UND
   Staerke des Dunstschleiers (Begruendung oben im Abschnitt). Ein Verweis
   statt einer Kopie: atmosphere.js schreibt fog.near/far/color je Bild neu. */
var szene = null;

/** Haengt alle drei Meshes in die Szene. Aus main.js, einmal beim Start. */
function initVfx(scene) {
  szene = scene;
  scene.add(vfxMesh);
  scene.add(dunstMesh);
  scene.add(ringMesh);
  scene.add(arborMesh);
}

/**
 * Setzt Typ, Dichte und (optional) Farbe des Umgebungs-VFX.
 *   cfg = { typ: "regen"|"schnee"|"blueten"|"sporen"|"staub"|"funken"|"aus",
 *           dichte: 0..~1.6, farbe: hex|THREE.Color (optional) }
 * Ein Aufruf schreibt nur Uniforms und mesh.count — er ist billig genug, um
 * waehrend der Wetterblende in jedem Bild zu laufen. Unbekannte Typen fallen
 * tolerant auf "aus" zurueck (Muster: setTod mit unbekannter Tageszeit).
 */
function setVfx(cfg) {
  cfg = cfg || {};
  var name = cfg.typ;
  if (!VFX_TYPEN[name]) name = 'aus';
  var T = VFX_TYPEN[name];
  var d = (typeof cfg.dichte === 'number') ? clamp(cfg.dichte, 0, 4) : 1;
  aktiverTyp = name;
  aktiveDichte = d;

  var u = vfxUniforms;
  u.uHalb.value = T.halb;
  u.uBoxY.value.set(T.boxY[0], T.boxY[1]);
  u.uFall.value = T.fall;
  // Die Richtung ist NICHT verhandelbar: sie kommt aus wind.js, der Typ gibt
  // nur das Tempo. Deshalb steht hier ein Produkt und kein Wertepaar.
  u.uDrift.value.set(WIND_RICHTUNG[0] * T.zug, WIND_RICHTUNG[1] * T.zug);
  u.uTaumel.value.set(T.taumel[0], T.taumel[1], T.taumel[2]);
  u.uBahn.value.set(T.bahn[0], T.bahn[1]);
  u.uBoee.value.set(T.boee[0], T.boee[1], T.boee[2]);
  u.uSchere.value = T.schere;
  u.uMindest.value = T.mindest;
  u.uStaffel.value.set(T.staffel[0], T.staffel[1], T.staffel[2]);
  u.uGroesse.value.set(T.groesse[0], T.groesse[1]);
  u.uAusricht.value = T.ausricht;
  u.uDreh.value = T.dreh;
  u.uDeckkraft.value = T.deck;
  u.uFlacker.value = T.flacker;
  u.uWindKopplung.value = T.wind;
  u.uForm.value.set(T.form * 0.5, 0.5);
  schleierAnteil = T.schleier * Math.min(1, d);
  ringAnteil = T.ring * Math.min(1, d);

  if (cfg.farbe !== undefined && cfg.farbe !== null) {
    // Vorgegebene Farbe: sie besetzt das dunkle Ende, das helle Ende wird
    // Richtung Weiss aufgehellt — so bleibt die Streuung je Instanz erhalten.
    u.uFarbA.value.set(cfg.farbe);
    u.uFarbB.value.copy(u.uFarbA.value).lerp(_farbe.setRGB(1, 1, 1), 0.45);
  } else {
    u.uFarbA.value.set(T.farbA);
    u.uFarbB.value.set(T.farbB);
  }

  var blend = T.additiv ? THREE.AdditiveBlending : THREE.NormalBlending;
  // material.blending wird von WebGLState je Zeichenaufruf gelesen — der
  // Wechsel braucht KEIN needsUpdate und loest keine Neukompilierung aus.
  if (vfxMat.blending !== blend) vfxMat.blending = blend;

  var n = Math.min(VFX_MAX, Math.round(T.basis * d));
  vfxMesh.count = n;
  vfxMesh.visible = n > 0;
}

/** Aktueller Typ — fuer Statuszeile und Diagnose. */
function getVfx() {
  return { typ: aktiverTyp, dichte: aktiveDichte, instanzen: vfxMesh.count,
    dunst: dunstMesh.visible ? DUNST_N : 0,
    ringe: ringMesh.visible ? RING_N : 0 };
}

/* ==========================================================================
   Dunstschleier je Bild stellen
   ========================================================================== */

/** Toroidales Umschlagen auf [-halb, halb) — die CPU-Fassung von mod() im
 *  Shader. Der Umweg ueber den positiven Rest ist noetig, weil % in JS das
 *  Vorzeichen des Dividenden behaelt und GLSL mod() nicht. */
function umschlag(v, halb) {
  var s = 2 * halb;
  var m = (v + halb) % s;
  if (m < 0) m += s;
  return m - halb;
}

/* Wanderungstempo des Schleiers in Einheiten/s bei uWindStaerke 1. Deutlich
   langsamer als die Partikel: eine Nebelbank zieht, sie fliegt nicht. */
const DUNST_FAHRT = 2.4;

/**
 * Schreibt Lage, Groesse und Deckkraft aller DUNST_N Instanzen.
 * Kosten je Bild: DUNST_N Hoehenabfragen und zwei Attribut-Uploads von je
 * DUNST_N * 4 Gleitkommazahlen (480 Byte) — siehe Begruendung im Abschnitt.
 * Liefert true, wenn ueberhaupt etwas zu sehen ist.
 */
function dunstStellen(t, fx, fy, fz) {
  var f = szene && szene.fog;
  if (!f) return false;

  /* Staerke aus der Nahsicht: kurze Nahsicht = dicke Luft. Ein einziger Wert
     traegt damit Tageszeit und Wetter (siehe Abschnittskopf). */
  var dick = 1 - sstep(DUNST_NAH0, DUNST_NAH1, f.near);
  var bankS = dick;
  /* Der Regenschleier braucht BEIDES: Niederschlag und dicke Luft. Regen bei
     klarer Fernsicht gibt es nicht, und der Anteil sorgt dafuer, dass die
     Waende mit der Wetterblende kommen und gehen statt zu schalten. */
  var schleierS = schleierAnteil * (0.30 + 0.70 * dick);
  /* Schwelle statt Null: unter 0.12 blieb im Bild nichts uebrig, was den
     Zeichenaufruf wert waere. Gemessen am Morgenpreset (fog.near 140, dick
     0.09) — dort war der Unterschied zwischen Mesh an und Mesh aus im
     Abnahmebild Punkt fuer Punkt keiner, die zwei Zeichenaufrufe aber echt.
     Nebel (0.82), Regen (0.96), Schneefall (0.95) und Sturm (1.0) liegen
     allesamt weit darueber; bei klarem Wetter kostet dieses Modul damit
     nichts. */
  if (bankS < 0.12 && schleierS < 0.04) return false;

  /* Reichweite: der Schleier soll da stehen, wo der Nebel ohnehin schliesst.
     fog.far ist der Wert, an dem die Sicht endet — ein Drittel davon ist die
     Zone, in der eine Bank noch als Form lesbar ist statt als Grau. */
  var reich = clamp(f.far * 0.30, 95, 250);
  var wind = windUniforms.uWindStaerke.value;
  var fahrt = t * DUNST_FAHRT * wind;

  for (var i = 0; i < DUNST_N; i++) {
    var D = DUNST_FEST[i];
    var weg = fahrt * D.tempo;
    /* VFX-R2 — TIEFENKLASSEN. Bis R1 lagen alle Baenke in derselben Kachel
       und hatten dieselbe Groessenordnung; im Bild wurde daraus ein Kranz
       gleich grosser Schwaden in gleicher Entfernung — flaechiges Grau, genau
       der Befund. Gestaffelt ist Nebel aber nicht deshalb Nebel, weil er
       ueberall ist, sondern weil er in LAGEN liegt: in marnie-010 steht eine
       kleine Zunge im Mittelgrund vor einer riesigen Wand dahinter, und erst
       ihr Groessenunterschied macht die Tiefe.
       D.klasse (0 nah, 1 mittel, 2 fern) streckt deshalb Kachel UND Groesse
       gemeinsam: die ferne Bank steht dreimal so weit weg und ist dreimal so
       gross — im Bild also aehnlich breit, aber mit dem Mittelgrund davor. */
    /* Nur die BAENKE staffeln sich in die Tiefe. Eine Regenwand ist ein
       Ereignis im Mittelgrund — dreifach herausgeschoben und dreifach
       vergroessert stuende sie hinter dem Horizont oder halb hinter der
       Kamera, und ihre Aufgabe (die Verbindung von Wolkendecke und Boden zu
       zeigen) kann sie nur dort erfuellen, wo man beides sieht. */
    var kl = DUNST_KLASSE[D.bank ? D.klasse : 1];
    var reichI = reich * kl[0];
    var x = umschlag(D.u * reichI + WIND_RICHTUNG[0] * weg, reichI);
    var z = umschlag(D.v * reichI + WIND_RICHTUNG[1] * weg, reichI);
    x += fx; z += fz;
    var boden = heightAt(x, z);

    var halbB, halbH, mitteY, deck, scroll;
    if (D.bank) {
      /* Nebelbank: breit, flach, dicht ueber dem Gelaende. Die Mitte liegt so
         tief, dass die Unterkante des Quads IM Boden steckt — dort ist die
         Textur ohnehin fast durchsichtig, und die Schnittlinie mit dem Hang
         faellt damit nicht auf (der Tiefenpuffer der Szene steht diesem Modul
         nicht zur Verfuegung, siehe Bericht). */
      halbB = reich * 0.36 * D.breit * kl[1];
      halbH = reich * 0.125 * D.hoch * kl[1];
      /* Der Boden unter Wasser ist der MEERESboden und kann tief liegen; eine
         Bank, die ihm folgt, versaenke unter der Wasserflaeche. Die Schranke
         bei fy - 22 (fy ist die Gelaendehoehe am Blickpunkt) haelt sie in der
         Naehe der Uferhoehe, ohne dass dieses Modul den Wasserspiegel kennen
         muss. */
      mitteY = Math.max(boden, fy - 22) + halbH * 0.70 + D.hebung * 11;
      /* Die ferne Lage ist DUENNER als die nahe (kl[2] faellt von 1.0 auf
         0.62). Das ist gegenintuitiv — in der Ferne steht doch mehr Luft —
         aber der Nebel der Szene (scene.fog) besorgt die Ferne bereits
         vollstaendig. Was diese Schicht dort noch drauflegt, ist reine
         Wertbegrenzung, und genau die hat die Abnahme als "die hinteren
         Ebenen kleben aufeinander" gelesen. Die Bank soll im MITTELGRUND
         arbeiten, wo der Szenennebel noch nichts tut. */
      deck = 1.00 * D.deck * bankS * kl[2];
      scroll = 0;
      if (D.spritz) {
        /* Spritznebel: flach wie ein Tuch, breit wie eine Bank, und er sitzt
           AUF dem Gelaende statt darueber zu schweben. halbH ist ein Zehntel
           der Bankhoehe — mehr waere Nebel, und Nebel gibt es hier schon.
           Die Quelle ist schleierS (der Niederschlag) und nicht bankS (die
           Sichttruebung): bei Nebel ohne Regen bleibt das Band aus, bei Regen
           bei klarer Fernsicht ist es da. */
        halbB = reich * 0.24 * D.breit;
        halbH = reich * 0.026 * D.hoch;
        mitteY = boden + halbH * 0.55;
        /* 0.60 und nicht mehr: bei 0.90 zog das Band als geschlossener
           heller Streifen quer durch den Mittelgrund — genau das flaechige
           Weiss, das die Abnahme bemaengelt hat, nur einen halben Meter
           tiefer. Spruehwasser soll die Senken fuellen und die Kuppen frei
           lassen, deshalb bleibt auch der Senkenfaktor darunter stehen. */
        deck = 0.60 * D.deck * schleierS;
      }
      /* Baenke sammeln sich in den Senken. `fy` ist die Gelaendehoehe am
         Kamerafokus — was tiefer liegt als der Blickpunkt (Wasser, Taeler),
         bekommt mehr. Genau das Bild von marnie-010 und anno-03: der Dunst
         liegt ueber dem Wasser, die Kuppe steht frei. */
      deck *= 0.70 + 0.68 * clamp((fy - boden) / 26 + 0.35, 0, 1);
    } else {
      /* Regenwand: breit und hoch, vom Boden bis in die Wolkendecke. Der
         erste Anlauf war mit reich*0.17 zu SCHMAL — im Bild wurden daraus
         helle Pfosten. Eine Wand muss breiter sein als hoch wirkt, sonst
         liest sie sich als Gegenstand statt als Wetter.
         Die Unterkante steckt knapp im Boden, damit die Wand aufsitzt und
         nicht in der Luft haengt. */
      halbB = reich * 0.32 * D.breit * kl[1];
      halbH = reich * 0.36 * D.hoch * kl[1];
      mitteY = boden + halbH * 0.92;
      deck = 0.66 * D.deck * schleierS;
      scroll = 0.16 + D.tempo * 0.13;   // Falltempo der Streifen in der Textur
    }
    // Sehr langsames Atmen, damit die Staffelung nicht steht.
    deck *= 0.74 + 0.26 * Math.sin(t * 0.085 + D.phase * 6.2831);

    var o = i * 4;
    dunstOrt[o] = x; dunstOrt[o + 1] = mitteY; dunstOrt[o + 2] = z;
    dunstOrt[o + 3] = Math.max(0, deck);
    dunstMass[o] = halbB; dunstMass[o + 1] = halbH;
    dunstMass[o + 3] = scroll;           // [o+2] ist die feste Atlaszelle
  }
  dunstGeo.attributes.dunstOrt.needsUpdate = true;
  dunstGeo.attributes.dunstMass.needsUpdate = true;

  /* Farbe aus dem Nebel der Szene. Sie traegt Tageszeit UND Wettertoenung
     bereits — ein eigener Farbweg waere ein zweiter, der auseinanderlaeuft.
     Die Bank liegt eine Spur ueber dem Nebelgrau (sie streut Licht zurueck),
     die Regenwand eine Spur darunter und kuehler (sie schluckt es). */
  dunstUniforms.uDunstFarbe.value.copy(f.color).lerp(_farbe.setRGB(1, 1, 1), 0.22);
  /* Die Fernfarbe geht denselben Weg, aber weiter: heller UND kuehler. Damit
     hat der Schleier ueber die Distanz eine Farbrichtung und nicht nur einen
     Wert (Begruendung bei uDunstFern). Der Betrag ist bewusst klein — die
     Luftperspektive der LANDSCHAFT rechnet render/materials.js, dieses Modul
     legt nur seine eigene Schicht richtig darueber. */
  dunstUniforms.uDunstFern.value.copy(f.color)
    .lerp(terraUniforms.uFogCool.value, 0.30).lerp(_farbe.setRGB(1, 1, 1), 0.34);
  dunstUniforms.uSchleierFarbe.value.copy(f.color)
    .lerp(terraUniforms.uFogCool.value, 0.35).multiplyScalar(0.94);
  return true;
}

/* ==========================================================================
   Seekreise fuer die Aufschlagsringe

   Gesucht sind die vier naechsten Seeflaechen um den Blickpunkt, je als
   Kreis (Mitte, Radius, Spiegel). Der Radius ist der MITTLERE Abstand der
   Griffpunkte von ihrer Mitte und nicht der groesste: der groesste
   ueberdeckte bei einem langgezogenen See auch das Ufer daneben, und dort
   laegen die Ringe dann einen halben Meter ueber trockenem Gras. Der mittlere
   ist bei einem runden See derselbe Wert und bei einem schmalen deutlich
   kleiner — im Zweifel fehlt ein Ring am Zipfel, statt dass einer an Land
   steht.

   Der Spiegel ist der MEDIAN der Gelaendehoehe an den Griffpunkten, genau wie
   seeSpiegel() in generators/see.js, nur ueber die Griffe statt ueber die
   abgetastete Kontur — die Begruendung fuer den Median (unempfindlich gegen
   einzelne Kerben und Nasen) gilt unveraendert. Die Abweichung liegt im
   Zentimeterbereich und die Ringe schweben ohnehin RING_HUB darueber.
   ========================================================================== */
var seenTakt = 0;
var _seenH = [];

function seenSammeln(fx, fz) {
  var ziel = ringUniforms.uRingSeen.value;
  for (var k = 0; k < RING_SEEN; k++) ziel[k].set(0, 0, -1, 0);
  var el = S && S.elements;
  if (!el || !el.length) return;

  var gefunden = [];
  for (var i = 0; i < el.length; i++) {
    var e = el[i];
    if (!e || e.kind !== 'flaeche' || e.variant !== 'see') continue;
    var pts = e.points;
    if (!pts || pts.length < 3) continue;
    var mx = 0, mz = 0, n = pts.length;
    for (var j = 0; j < n; j++) { mx += pts[j].x; mz += pts[j].z; }
    mx /= n; mz /= n;
    var dm = (mx - fx) * (mx - fx) + (mz - fz) * (mz - fz);
    // Weit ausserhalb der Ringkachel ist ein See belanglos — der Vergleich
    // spart die Hoehenabfragen, nicht nur den Platz in der Liste.
    if (dm > (RING_HALB * 2.2) * (RING_HALB * 2.2)) continue;
    var summe = 0;
    _seenH.length = 0;
    for (var q = 0; q < n; q++) {
      var dx = pts[q].x - mx, dz = pts[q].z - mz;
      summe += Math.sqrt(dx * dx + dz * dz);
      _seenH.push(heightAt(pts[q].x, pts[q].z));
    }
    _seenH.sort(function (a, b) { return a - b; });
    var stau = (e.params && Number.isFinite(e.params.stau)) ? e.params.stau : 0;
    var spiegel = Math.max(WATER + 0.05, _seenH[_seenH.length >> 1] + stau);
    var radius = (summe / n) * 1.04;
    gefunden.push({ d: dm, x: mx, z: mz, r2: radius * radius, y: spiegel + RING_HUB });
  }
  gefunden.sort(function (a, b) { return a.d - b.d; });
  for (var m = 0; m < RING_SEEN && m < gefunden.length; m++) {
    var g = gefunden[m];
    ziel[m].set(g.x, g.z, g.r2, g.y);
  }
}

/**
 * Stellt die Aufschlagsringe. Kosten je Bild: vier Uniformschreibvorgaenge —
 * die Lage jeder einzelnen Instanz rechnet der Vertexshader.
 * Liefert true, wenn ueberhaupt etwas zu sehen ist.
 */
function ringStellen(fx, fy, fz) {
  var f = szene && szene.fog;
  /* Die Ringe brauchen Niederschlag UND eine Wetterlage, in der er ankommt.
     Dieselbe Nahsichtprobe wie beim Dunstschleier — ein Modul, ein Mass. */
  var dick = f ? 1 - sstep(DUNST_NAH0, DUNST_NAH1, f.near) : 0;
  var st = ringAnteil * (0.35 + 0.65 * dick);
  if (st < 0.05) return false;

  ringUniforms.uRingStaerke.value = st * 0.88;
  ringUniforms.uRingFokus.value.set(fx, fy, fz);
  /* Farbe aus dem Nebel der Szene, kraeftig aufgehellt: ein Aufschlagsring
     ist die Stelle, an der die Wasseroberflaeche den Himmel statt den Grund
     zeigt — er ist deshalb immer heller als das Wasser und traegt dessen
     Tageszeit. Ein fester Weisston liefe bei Abendrot und Nacht aus dem
     Bild heraus. */
  if (f) ringUniforms.uRingFarbe.value.copy(f.color).lerp(_farbe.setRGB(1, 1, 1), 0.55);

  // Seekreise selten nachfuehren: sie aendern sich nur, wenn jemand die Karte
  // bearbeitet oder die Kamera weit faehrt. 40 Bilder sind rund zwei Drittel
  // einer Sekunde und im Bild nicht zu bemerken.
  if (seenTakt <= 0) { seenSammeln(fx, fz); seenTakt = 40; }
  seenTakt--;
  return true;
}

/**
 * Pro Frame aus der Renderschleife. `zeit` sind Sekunden (now * 0.001),
 * `fokus` ein Punkt mit x/z und optional y (Kamerafokus, cam.focus + focusY).
 * Kosten: drei Uniformschreibvorgaenge, bis zu ARBOR_MAX Hoehenabfragen fuer
 * den Lichtflug und DUNST_N fuer den Schleier — beides unabhaengig von der
 * Partikelzahl.
 */
function tickVfx(zeit, fokus) {
  // Zeit beschneiden wie in wind.js (tickWind: now % 3600). Ohne das waechst
  // das Produkt drift*zeit in Bereiche, in denen float32 sichtbar quantisiert.
  // BEWEGT ist 0, wenn das System reduzierte Bewegung verlangt: dann steht
  // die Uhr auf 0 und JEDE Bewegung dieses Moduls steht mit ihr still —
  // Partikelflug, Taumeln, Boee, Schleierfahrt und Scrollen.
  var t = (zeit * BEWEGT) % 3600;
  vfxUniforms.uZeit.value = t;
  arborUniforms.uZeit.value = t;
  dunstUniforms.uZeit.value = t;
  /* Auch die Ringe stehen bei reduzierter Bewegung still — und zwar an
     ueber die Lebensdauer GLEICHVERTEILTEN Punkten, weil die Phase je
     Instanz gestreut ist: das Standbild zeigt Ringe in jeder Groesse
     nebeneinander und liest sich als Regen auf Wasser. Weggeblendet waere
     die Wetterlage nicht mehr erkennbar, beruhigt ist sie es. */
  ringUniforms.uZeit.value = t;

  var fx = 0, fy = 0, fz = 0;
  if (fokus) {
    fx = fokus.x || 0;
    fy = (typeof fokus.y === 'number') ? fokus.y : 0;
    fz = fokus.z || 0;
    vfxUniforms.uFokus.value.set(fx, fy, fz);
  }

  dunstMesh.visible = dunstStellen(t, fx, fy, fz);
  ringMesh.visible = ringStellen(fx, fy, fz);

  // Bodenhoehe je Rankenfuss: der Lichtflug soll am Boden beginnen, nicht auf
  // Meereshoehe. Die Quellen selbst kommen aus terraUniforms.uArborPos.
  var n = terraUniforms.uArborAnzahl.value;
  if (n > 0 && terraUniforms.uArborStaerke.value > 0.15) {
    var pos = terraUniforms.uArborPos.value;
    var boden = arborUniforms.uArborBoden.value;
    for (var i = 0; i < n && i < ARBOR_MAX; i++) boden[i] = heightAt(pos[i].x, pos[i].y);
    arborMesh.visible = true;
  } else {
    arborMesh.visible = false;
  }
}

export { initVfx, setVfx, getVfx, tickVfx, VFX_TYPEN, VFX_MAX, DUNST_N, RING_N,
  vfxPatchInfo, vfxMesh, arborMesh, dunstMesh, ringMesh, vfxUniforms,
  arborUniforms, dunstUniforms, ringUniforms };
