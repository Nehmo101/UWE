// Atmosphaere: Tageszeit-Presets (Licht, Nebel, Himmel, Look), weiche Blende,
// dazu die zweite Achse Wetter (klar/bewoelkt/Regen/Schneefall/Sturm) und die
// bewegten Kleinigkeiten (Voegel, Schornsteinrauch, Wolkenschatten-Drift).
import * as THREE from 'three';
import { clamp, lerp, rngOf, rr } from '../core/rng.js';
import { S, BIOME } from '../core/store.js';
import { terraUniforms, tintedMats, vineMat, setSchnee } from '../render/materials.js';
import { TEX } from '../render/textures.js';
import { POOLS } from '../core/pools.js';
import { schattenMat } from '../core/pools.js';
import { waterMat } from './water.js';
import { paintSky, setSonne, setSonnenDir, setWolkenFarben, setSterne, cirrusMat, CLOUD_DRIFT_MITTEL } from './sky.js';
import { setLook } from '../render/pipeline.js';
import { cam, camera } from '../editor/camera.js';
// F5: uWindStaerke ist die Wetterachse des Windes (unten geschrieben),
// windVerstaerkung der CPU-Spiegel der oertlichen Nester — beides braucht der
// Boeen-Spiegel bei den Voegeln (siehe boeeWert weiter unten).
import { windUniforms, windVerstaerkung } from './wind.js';
import { setVfx } from './vfx.js';
import { initWeltleben, tickWeltleben } from './weltleben.js';

/* ==========================================================================
   Tageszeit-Presets. Jedes definiert die komplette Stimmung: Sonne,
   Hemisphaere, Gegenlicht, beide Nebelfarben samt Distanzen und Deckel,
   Himmelsverlauf mit fuenf Stuetzstellen, Wolkenfarben, Wolkenschatten,
   Kontaktschatten, Belichtung, Bloom und Farbgraduierung.
   ========================================================================== */
var PRESETS = {
  morgen: {
    /* LICHTAUFBAU — SCHLUESSEL UND FUELLUNG SIND GETRENNTE AUFGABEN.

       Die vorige Runde hat sonneStk hochgezogen und hemiStk gesenkt, in der
       Annahme, damit den Kontrast zu holen. Das war die falsche Schraube: der
       Kontrast steckte im Wrap-Diffuse (render/materials.js), der einer 84
       Grad abgewandten Flaeche noch 67 % der vollen Einstrahlung gab. Beide
       Lichter taten dadurch dasselbe — jedes von beiden beleuchtete die ganze
       Kugel, nur mit anderer Farbe. Das Ergebnis war ein einziger Ton mit
       Filter darueber, genau der Befund der Abnahme.

       Seit der Terminator im Direktlicht scharf ist, hat jedes der beiden
       Lichter genau EINE Aufgabe:
         sonne  = Schluessel. Warm, gerichtet, wirft. Trifft NUR die Lichtseite.
         hemi   = Fuellung.  Kuehl von oben, warm vom Boden. Trifft alles.
       hemiStk steigt deshalb wieder deutlich — nicht als Rueckschritt, sondern
       weil das Fuelllicht ab jetzt die Schattenseite ALLEIN traegt. Gerechnet:
       Lichtseite 2.85 + 0.86 = 3.71, Schattenseite 0.11 + 0.86 = 0.97, also
       rund 1 : 3.8. Im Wurfschatten (schattenTiefe 1.0) bleibt die Fuellung
       allein: 1 : 4.3. Das ist der Korridor der Vorbilder — dunkel genug fuer
       Tiefen, hell genug, dass ein Schatten Lokalfarbe behaelt. */
    sonneDir: [-0.80, 0.26, 0.50], sonne: 0xffd2a0, sonneStk: 3.10,
    hemiHimmel: 0xc6d9ec, hemiBoden: 0xa89272, hemiStk: 0.58,
    gegen: 0x9db8d8, gegenStk: 0.24,
    /* Nebelfarben eine Stufe zurueck (0.87/0.81 -> 0.82/0.75 Luminanz).
       Der Dunst ist die Farbe, in die ALLES Ferne laeuft, und seit die
       Kuppel ihren Horizontsaum aus genau dieser Farbe bildet (sky.js,
       paintSky), setzt sie zugleich die Obergrenze fuer die Helligkeit des
       Himmelsbands. Bei 0.87 war der Dunst heller als jede Wolkenoberkante —
       dann kann keine Wolke mehr vor ihm stehen. */
    fogWarm: 0xecd6b0, fogCool: 0xbcc8d2, fogNah: 140, fogFern: 820, fogCap: 1.0,
    fogKurve: 0.55, luftSockel: 0.010,
    /* Die beiden obersten Stuetzstellen lagen bei Luminanz 0.90/0.94 — also
       auf Papierweiss. Eine nach unten geneigte Kamera sieht fast nur dieses
       Band, und in JEDEM Referenzbild (Anno wie Ghibli) liegt der Anteil
       ueber 0.85 zwischen 0 % und 4.6 %, bei terra lag er ueber 25 %. Der
       hellste Wert im Bild gehoert dem besonnten Boden, nicht der Luft.

       Zweite Runde: die Stuetzstellen [2]..[4] sind das, was eine Weit-
       aufnahme ueberhaupt zu sehen bekommt (sky.js, baueKuppel — das
       Sichtfenster ueber dem Horizont ist wenige Grad hoch). [2] ist damit
       nicht mehr "irgendwo in der Mitte", sondern DIE Himmelsfarbe des
       Bildes und geht entsprechend in den mittleren Wertebereich. Der warme
       Dunst bleibt [3]/[4] vorbehalten und liegt jetzt in einem Saum von
       unter einem Grad. */
    /* Dritte Runde, und diesmal mit geaenderter BEDEUTUNG der Stuetzstellen
       (sky.js, paintSky): [0..2] und [4] sind die Hoehenrampe, [3] ist die
       SONNENGLUT und liegt nur dort, wo die Sonne steht. Sie darf und soll
       der hellste Wert des Presets sein — der Befund "kein Sonnenanker, der
       Dom ist rotationssymmetrisch gleichfoermig" laesst sich nur mit einer
       eigenen Farbe fuer die Sonnenseite beheben. Vorher war [3] Teil der
       Rampe UND das Azimutziel und musste beides zugleich sein. */
    himmel: [0x2f6aa8, 0x5288ba, 0x6f9ab8, 0xffd8a4, 0xc2bdae],
    scheibe: 0xffe8c8, scheibeGr: 170, gegenGlow: 0xd8e2ee,
    // Schattenseite der Ballen kuehler und tiefer: seit der Puff eine
    // Lichtrichtung hat (uSonneUV), traegt dieser Abstand die ganze Plastik.
    wolkeOben: 0xfff4e4, wolkeUnten: 0xa8b4c8, wolkeRand: 0xffe2b8, wolkeFern: 0xd6dee6,
    // 0.16 -> 0.26: die wandernden Wolkenschatten sind das Band zwischen
    // Himmel und Boden (anno-04, anno-10) und fehlten laut Befund ganz.
    wolkeDeck: 0.82, wolkenschatten: 0.26, fenster: 1.1,
    schatten: 0.34, wasser: 0x4a95ab, welt: 0xe8e4dc, bounce: 0xd8cebc,
    // G1: Rankenglut tags dezent warm-grau (entspricht dem bisherigen Look),
    // sterne 0 — kein Sternenfeld am Tag.
    /* 0.30 -> 0.10. Die Emission liegt FLACH auf dem Rankenmaterial, ohne
       Lichtrichtung — bei 0.30 war sie auf dem weissen Stamm der groesste
       Einzelbeitrag und machte aus den Riesenwurzeln texturloses Cremevolumen
       (Abnahmebefund). Tags leuchtet Arbor nicht, tags steht sie im Licht. */
    rankenGlut: 0.1, rankenGlutFarbe: 0x4a463e, sterne: 0,
    // H3: Arbor spendet der Welt Licht. Morgens traegt das Tageslicht schon,
    // die Ranke bleibt aber ein schwacher Nahlicht-Sockel.
    arborLicht: 0.15, arborFarbe: 0xdfe8f0,
    strahlen: 0.35,
    // F1-Startwert (Feinkalibrierung: F4): aufgehelltes, kuehles Morgenblau —
    // Hue ~20° blauwaerts gegenueber bounce, hell genug fuer den 15-%-Sockel.
    schattenKuehl: 0x96a8c8,
    // Sonnenschatten: `schattenWeich` ist der Vogel-Radius in Texeln,
    // `schattenTiefe` die Deckkraft der Maske. Morgens steht die Sonne flach
    // (Hoehe 0.26) — lange Schatten mit noch weicher Kante.
    // Tiefe 0.92 -> 1.00: die Maske schliesst jetzt ganz. Was im Wurfschatten
    // uebrig bleibt, ist ausschliesslich Fuelllicht — dieselbe Trennung wie
    // beim Terminator, und der Grund, warum ein Schatten kuehl ist.
    schattenWeich: 1.8, schattenTiefe: 1.0,
    // Gegenlichtsaum: morgens flach und warm, deutlich sichtbar.
    sonnensaum: 0xffc890, sonnensaumStk: 0.60,
    // Kontaktverdunklung (render/pipeline.js): flaches Morgenlicht wirft
    // lange Schatten, aber die Fuge selbst bleibt weich.
    kontakt: 0.55,
    // Warm/Kalt: warmes Streiflicht gegen blaue Schatten. Gemessen war das
    // Vorzeichen bisher UMGEKEHRT (Lichter kuehler als Tiefen), weil die
    // hellste Masse im Bild der kuehle Himmel war.
    farbskript: { licht: 0xffe8c8, mitte: 0xfdf6ec, schatten: 0x8ea6cc, staerke: 0.26 },
    belichtung: 0.98,
    // Kalibrierkorridor (F4): Landschaftsmassen S 0.25–0.50, Werteumfang
    // 0.20–0.85, reines Weiss nur Wolkenlichtern vorbehalten. Bloomschwelle
    // >= 1.0: nur echte Lichter bluehen. satMitte 1.2 → 1.15: "Mitten rauf"
    // gilt, aber 1.2 trieb die Wiesen an den oberen S-Rand (~0.5);
    // satLicht < 1 (Lichter entsaettigen) bleibt unveraendert.
    bloom: { staerke: 0.22, radius: 0.7, schwelle: 1.0 },
    /* GRADUIERUNG. lift und schwarz hoben den Schwarzpunkt bisher ZWEIMAL an
       (0.014/0.022/0.040 plus 0.028) — das war die zweite Haelfte des
       fehlenden Tonwertumfangs. Kein Referenzbild hat einen p05 ueber 0.251;
       terra lag bei 0.30. Beide Sockel gehen deutlich zurueck, bleiben aber
       vorhanden: die Tiefen sollen Zeichnung behalten, nicht zulaufen. */
    grade: { lift: [0.008, 0.013, 0.024], gamma: [1.0, 1.0, 1.0], gain: [1.06, 1.02, 0.95],
      satMitte: 1.15, satLicht: 0.94, kontrast: 0.34, schwarz: 0.020, vignette: 0.10 }
  },
  mittag: {
    // Haertestes Licht des Tages: der groesste Schluessel und die kleinste
    // Fuellung — ein Mittagsschatten ist der dunkelste des Tages (1 : 4.9).
    sonneDir: [0.45, 0.75, 0.35], sonne: 0xfff2dc, sonneStk: 3.15,
    hemiHimmel: 0xbfd8ee, hemiBoden: 0xb09b78, hemiStk: 0.55,
    gegen: 0xa8c8e8, gegenStk: 0.26,
    // Wie bei morgen: der Dunst gibt eine Stufe nach, damit die Wolkenbank
    // ueberhaupt heller sein kann als die Luft hinter ihr.
    fogWarm: 0xdccfb0, fogCool: 0xa8bccc, fogNah: 185, fogFern: 940, fogCap: 1.0,
    fogKurve: 0.50, luftSockel: 0.009,
    /* Nach anno-06 und totoro-001: mittags ist der Himmel ein SATTES,
       mittleres Blau, und der Dunst am Wasser ist ein schmaler, warmer Saum
       — keine grosse graugruene Flaeche. [3]/[4] standen bei einer
       Saettigung von 0.05, also praktisch auf Neutralgrau; gemessen war
       wasser-kueste mit sat 0.235 nur knapp ueber dem Korridorboden von
       0.228, und der Himmel war der Grund. */
    // [3] ist ab jetzt die Sonnenglut (siehe morgen). Mittags steht die Sonne
    // hoch, der Azimutanteil ist entsprechend schwach (azStk 0.57) — die Glut
    // liegt als warmer Dunstkern ueber dem Sonnenazimut, nicht als Scheibe.
    /* Deutlich tiefer und saettiger als der rechnerische Zielwert, und das
       ist Absicht: gemessen kommt die Kuppelfarbe NICHT unveraendert ins
       Bild. Zwischen ihr und dem Bildpunkt liegen Bloom, das Farbskript
       (mitte 0xfdf8f0, also fast Weiss, bei Staerke 0.22) und die
       Palettenbindung (0.16). Eine Stuetzstelle von 0x5b9ad0 kam als
       (155,184,195) heraus — 40 Stufen heller und um zwei Drittel
       entsaettigt. Kalibriert wird deshalb am Bildpunkt, nicht am Hexwert. */
    himmel: [0x0d4a96, 0x1f66b4, 0x3f89c8, 0xe0d8bc, 0xa8c0c4],
    scheibe: 0xfff8ec, scheibeGr: 120, gegenGlow: 0xd2e0ea,
    // Schattenseite deutlich kuehler: totoro-001 und kazetachinu-022 setzen
    // gegen das Weiss der Lichtseite ein klares Blaugrau, kein helles Grau.
    wolkeOben: 0xffffff, wolkeUnten: 0x8ea6c4, wolkeRand: 0xfff2da, wolkeFern: 0xcfdce8,
    wolkeDeck: 0.78, wolkenschatten: 0.36, fenster: 0.0,
    schatten: 0.45, wasser: 0x3f93ad, welt: 0xf2f0ea, bounce: 0xe0d8c0,
    // G1: mittags die schwaechste Glut — hartes Licht schluckt das Leuchten.
    rankenGlut: 0.06, rankenGlutFarbe: 0x4a463e, sterne: 0,
    // H3: mittags aus — hartes Sonnenlicht laesst kein Rankenlicht zu.
    arborLicht: 0.0, arborFarbe: 0xdfe8f0,
    strahlen: 0.12,
    // F1-Startwert (Feinkalibrierung: F4): neutrales Himmelblau — mittags
    // kommt die Schattenfuellung vom blauen Himmel, nicht von warmem Bounce.
    schattenKuehl: 0x8ea6c4,
    // Mittag zeichnet am haertesten: kleinster Vogel-Radius, volle Maske,
    // und die schaerfste Kontaktfuge des Tages.
    schattenWeich: 1.2, schattenTiefe: 1.0,
    kontakt: 0.62,
    // Mittags steht die Sonne im Ruecken der Silhouetten kaum je — der
    // schwaechste Saum des Tages.
    sonnensaum: 0xfff0d8, sonnensaumStk: 0.22,
    farbskript: { licht: 0xfff0d4, mitte: 0xfdf8f0, schatten: 0x93aacc, staerke: 0.22 },
    // 0.98 -> 0.93: gemessen brannten Schaumsaum und Schneefeld bei Mittag
    // auf 25 % der Bildflaeche ueber Luminanz 0.85 aus (Referenzen: 0-4.6 %).
    // Der hellste Wert im Bild gehoert dem besonnten Boden, nicht dem Wasser.
    belichtung: 0.93,
    // Kalibrierkorridor (F4): Landschaftsmassen S 0.25–0.50, Werteumfang
    // 0.20–0.85. Hoechste Bloomschwelle des Tages (1.05) — hartes Mittags-
    // licht soll zeichnen, nicht leuchten. satMitte 1.22 → 1.15: grenzwertig
    // hoch, die hellste Stimmung braucht die wenigste Nachsaettigung;
    // satLicht < 1 bleibt.
    bloom: { staerke: 0.18, radius: 0.7, schwelle: 1.05 },
    grade: { lift: [0.004, 0.007, 0.014], gamma: [1.0, 1.0, 1.0], gain: [1.05, 1.03, 0.97],
      satMitte: 1.15, satLicht: 0.95, kontrast: 0.16, schwarz: 0.018, vignette: 0.10 }
  },
  abend: {
    // Die staerkste Stimmung: dunkle Silhouetten gegen warmen Himmel, kuehle
    // Schatten gegen warmes Licht. Der Nebel staffelt, statt zu ueberdecken.
    /* Nachkalibriert: der erste Durchgang hat den Abend UEBERdunkelt (56.6 %
       der Pixel unter Luminanz 0.20 gegen 28.4 % vorher und 15-29 % in den
       Referenzen). Grund war die falsche Annahme, der Sonne-zu-Hemisphaere-
       Tausch trage in jeder Stimmung gleich: bei einer Sonnenhoehe von 0.10
       liegt fast die ganze Landschaft im Streiflicht, dotNL ist ueberall
       klein — die Sonne kann die weggenommene Fuellung dann gar nicht
       ersetzen. Der Abend war schon vor dieser Runde die EINZIGE Stimmung
       im Referenzkorridor; er bekommt deshalb nur die Haelfte der Kur. */
    /* ABEND, dritte Fassung. Der Befund der Abnahme lautete: "der Abend ist
       nicht beleuchtet, sondern global orange uebermalt". Das stimmte und
       hatte zwei Ursachen, die sich gegenseitig verdeckt haben.
       (1) Der Wrap-Diffuse gab jeder Flaeche mindestens 67 % Einstrahlung —
           bei einer Sonnenhoehe von 0.10 heisst das: Boden, Dachnord- und
           Dachsuedseite bekamen fast denselben Wert. Behoben in materials.js.
       (2) Die Fuellung war mit 0.40 auf einem sehr dunklen Blauviolett fast
           nicht vorhanden (Leuchtdichte rund 0.05). Alles, was NICHT vom
           orangen Streiflicht getroffen wurde, fiel damit in eine einzige
           schwarze Masse — und weil die Sonne bei 6 Grad Hoehe kaum etwas
           trifft, war das fast das ganze Bild.
       Jetzt: der Schluessel bleibt orange und flach — er soll nur noch die
       zur Sonne gedrehten Flaechen erwischen, das ist das Rimlight, das
       gefehlt hat. Die Fuellung wird zur eigentlichen Grundhelligkeit der
       Landschaft, deutlich staerker und heller, und sie ist BLAUVIOLETT. Der
       Kalt-Warm-Kontrast des Abends entsteht damit dort, wo er in jedem
       gemalten Sonnenuntergang entsteht: zwischen dem, was die Sonne noch
       trifft, und dem, was nur noch der Himmel beleuchtet. */
    sonneDir: [-0.95, 0.10, -0.26], sonne: 0xff9a4e, sonneStk: 3.0,
    hemiHimmel: 0x6e7cb6, hemiBoden: 0x6b5847, hemiStk: 1.34,
    gegen: 0x7a86b8, gegenStk: 0.40,
    /* DIE WICHTIGSTE ZEILE DES ABENDBILDES, und das ist ein Messergebnis.
       In weite-abend liegt der Horizont 1.38 Halbbildhoehen UEBER der oberen
       Bildkante (camera.js: ndc.y = tan(pitch)/tan(fov/2), pitch 0.40,
       fov 34). Was dort wie Himmel aussieht, IST keiner: es ist die
       Wasserebene (water.js, WASSER_RAND 872) bei 370 bis 730 Einheiten
       Abstand, voll vernebelt. Nachgewiesen mit einer Aufnahme, in der die
       Kuppel schwarz gefaerbt war — das Band blieb bei Luminanz 0.61 stehen,
       die Kuppel steuert dort keine 20 % bei.
       Damit ist die Nebelfarbe der einzige Regler, der dieses Band traegt.
       Sie geht deshalb deutlich zurueck (0.72 -> 0.63 warm, 0.40 kuehl):
       ein dunklerer, kaelterer Dunst vergroessert den Abstand zwischen dem
       klaren Vordergrund und der Ferne — genau die "Distanzabsorption statt
       globaler Rosa-Tonung", die der Befund verlangt. */
    fogWarm: 0xeda468, fogCool: 0x69709c, fogNah: 165, fogFern: 880, fogCap: 1.0,
    fogKurve: 0.62, luftSockel: 0.028,
    // Abendhimmel bleibt fast unangetastet: gemessen liegen hier bereits
    // 0.0 % ueber 0.85 und 28 % unter 0.20 — der einzige Werteumfang, der
    // schon vor dieser Runde den Referenzen entsprach. Nur der schmale
    // Horizontstreifen [4] gibt eine Spur nach, damit er nicht als einziges
    // Feld im Bild an die Weissgrenze stoesst.
    // Der Horizontstreifen bekommt wieder Farbe: gemessen war er als hellste
    // Flaeche im Bild ein fast neutrales Creme, und ein Abendrot ohne Rot am
    // Horizont ist kein Abendrot. Heller wird er dabei NICHT — nur satter.
    // Dritte Beruehrung, klein: der Horizontsaum war ein sandiges Creme und
    // damit die hellste Flaeche im Abendbild. Nach marnie-021 gehoert die
    // hellste Stelle des Abendhimmels der SONNE, und das Band darum ist
    // rosig-orange, nicht sandfarben. Nur Farbton und eine Spur Wert, die
    // Stimmung bleibt.
    /* VIERTE FASSUNG, und die erste, in der [3] und [4] nicht mehr dasselbe
       tun. Gemessen war [3] (0xe58a48, Luminanz 0.60) DUNKLER als [4]
       (0xeeb27e, 0.72) — das "Horizontgluehen" hat die Sonnenseite also
       nachweislich abgedunkelt: die Messspalte auf dem Sonnenazimut lag 16
       Stufen unter der Bildmitte. Ein Abendhimmel oeffnet gegen die Sonne
       hin auf (marnie-021: heller Kern, nach aussen saettigend und
       abkuehlend), er schliesst nicht.
       Jetzt: [4] ist der Horizont ABGEWANDT von der Sonne, [3] ist die Glut
       AN der Sonne und der hellste Wert des Presets. Der Verlauf zwischen
       beiden laeuft ueber den Azimut, nicht ueber die Hoehe. */
    himmel: [0x23264f, 0x494a80, 0x8d5f86, 0xffc98a, 0xd99b6e],
    scheibe: 0xffc078, scheibeGr: 260, gegenGlow: 0x8d94c2,
    wolkeOben: 0xf6c294, wolkeUnten: 0x615f8c, wolkeRand: 0xffb060, wolkeFern: 0x9a8aa2,
    // 0.06 -> 0.20: auch am Abend gliedern Wolkenschatten die Weite. Bei
    // streifendem Licht sind sie lang und weich, aber sie sind da.
    wolkeDeck: 0.85, wolkenschatten: 0.20, fenster: 2.6,
    schatten: 0.4, wasser: 0x46567c, welt: 0xdcc8b6, bounce: 0x9a8ca0,
    // G1: in der Daemmerung beginnt die Ranke zu leuchten; sterne 0.15 —
    // die ersten Sterne stehen schon am Abendhimmel.
    rankenGlut: 0.35, rankenGlutFarbe: 0x4a463e, sterne: 0.15,
    // H3: in der Daemmerung uebernimmt Arbor spuerbar — kuehles Weiss gegen
    // das orange Restlicht, der staerkste Kalt-Warm-Kontrast des Tages.
    arborLicht: 0.35, arborFarbe: 0xd8e6ee,
    strahlen: 0.5,
    // F1-Startwert (Feinkalibrierung: F4): kaeltestes und dunkelstes Blau der
    // vier Stimmungen — der Abend lebt vom maximalen Kalt-Warm-Kontrast
    // zwischen orangem Licht und blauvioletten Schatten.
    schattenKuehl: 0x5a628e,
    // Flachste Sonne des Tages (Hoehe 0.10): sehr lange Schatten, deren Kante
    // mit der Entfernung ausfranst — dafuer der groesste Radius am Tag.
    /* Deutlich flacher als am Tag, und das ist keine Zurueckhaltung, sondern
       Notwendigkeit: bei 6 Grad Sonnenhoehe wirft ein 400 Einheiten hoher
       Rankenstamm einen Streifen ueber die ganze Karte. Mit voller Maske
       waren das zwei schnurgerade schwarze Baender quer durchs Bild — kein
       Drama, sondern ein Fehler. Bei 0.5 lesen sie sich als lange, weiche
       Abendschatten. */
    schattenWeich: 3.2, schattenTiefe: 0.85,
    /* Der staerkste Saum der fuenf: im Gegenlicht ist die Kante das
       Einzige, was die Sonne noch trifft. Genau der Effekt, der im
       Abendbild fehlte — die Haeuser am Mittelhang standen als schwarze
       Flecken auf Braun, ohne dass irgendwo Licht vorbeistrich. */
    sonnensaum: 0xffa860, sonnensaumStk: 1.70,
    // Weichster Kontakt des Tages: bei streifendem Licht ist die Fuge selbst
    // schon halb im Schatten, ein harter Hof saehe aufgemalt aus.
    kontakt: 0.52,
    // Der staerkste Kalt-Warm-Kontrast der fuenf Stimmungen: oranges
    // Restlicht gegen blauviolette Schatten.
    farbskript: { licht: 0xffd0a0, mitte: 0xefd8c6, schatten: 0x565f92, staerke: 0.34 },
    belichtung: 0.99,
    // Kalibrierkorridor (F4): das Abendrot behaelt den groessten Tonwert-
    // umfang (dunkelste Silhouetten gegen den hellsten Himmel), deshalb
    // niedrigster lift-Sockel und die einzige Schwelle unter 1.0 (0.92 — ok,
    // bleibt ueber der ~0.9-Untergrenze). satMitte 1.05 bleibt: der Kontrast
    // kommt hier aus Kalt-Warm, nicht aus Saettigung; satLicht 0.9 bleibt.
    bloom: { staerke: 0.34, radius: 0.75, schwelle: 0.92 },
    // gamma 0.90 -> 0.97: die alte Kurve zog die Mitten zusaetzlich nach
    // unten (pow(c, 1/0.90) = pow(c, 1.11)). Solange der Abend seinen
    // Tonwertumfang aus einer Untermalung holen musste, war das richtig; seit
    // Schluessel und Fuellung getrennt sind, kommt er aus dem Licht.
    grade: { lift: [0.014, 0.021, 0.048], gamma: [0.97, 0.97, 1.0], gain: [1.10, 1.0, 0.88],
      satMitte: 1.05, satLicht: 0.9, kontrast: 0.12, schwarz: 0.016, vignette: 0.12 }
  },
  nebel: {
    // Kontrast reduziert, aber das Motiv bleibt lesbar: halbe Dichte und ein
    // Deckel, unter den nahe Objekte nicht fallen.
    // Die einzige Stimmung, in der die Fuellung den Schluessel UEBERSTEIGT —
    // genau das ist Dunst: ein Himmel, der von ueberall gleich hell ist.
    // Der Rest Sonne haelt das Bild davor, in eine flache Scheibe zu kippen.
    sonneDir: [0.20, 0.92, 0.22], sonne: 0xf2f2ea, sonneStk: 1.05,
    hemiHimmel: 0xe0e8ea, hemiBoden: 0xbdb8a8, hemiStk: 1.15,
    gegen: 0xdfe4e4, gegenStk: 0.12,
    fogWarm: 0xeceada, fogCool: 0xdde4e2, fogNah: 110, fogFern: 880, fogCap: 0.86,
    fogKurve: 0.28, luftSockel: 0.008,
    // Nebel bleibt grau — aber gemessen liegt weite-nebel mit sat 0.187 UNTER
    // dem Korridorboden 0.228, und "keine graue Suppe" steht ausdruecklich in
    // der Aufnahmefrage. Der Himmel bekommt deshalb oben einen kuehlen
    // Blaustich; unten bleibt er neutral, damit der Dunst weiss ausblasst.
    // [3] Sonnenglut: im Dunst steht die Sonne fast senkrecht (azStk 0.30),
    // der Azimutanteil ist entsprechend schwach — die Glut bleibt eine
    // Ahnung von Richtung, kein Loch in der Suppe.
    himmel: [0x93a5b2, 0xa6b6c0, 0xb4c2c6, 0xe8ece4, 0xc6cdc9],
    scheibe: 0xf6f4ea, scheibeGr: 90, gegenGlow: 0xe4e8e4,
    wolkeOben: 0xf2f4f0, wolkeUnten: 0xd4dad8, wolkeRand: 0xf0eee2, wolkeFern: 0xe2e7e2,
    wolkeDeck: 0.5, wolkenschatten: 0.0, fenster: 1.6,
    schatten: 0.15, wasser: 0xa6bcbb, welt: 0xeaece8, bounce: 0xdcd8cc,
    // G1: im Nebel traegt die Glut ein Stueck weiter als am klaren Tag.
    rankenGlut: 0.16, rankenGlutFarbe: 0x4a463e, sterne: 0,
    // H3: im Dunst traegt das Rankenlicht weiter als am klaren Tag, bleibt
    // aber schwach — der Nebelanteil (Lichtsaeule) macht hier die Wirkung.
    arborLicht: 0.15, arborFarbe: 0xe2eced,
    strahlen: 0.25,
    // F1-Startwert (Feinkalibrierung: F4): fast neutral, kaum blaeuer als das
    // Umgebungslicht — Nebel frisst Farbkontrast, kuehle Schatten wuerden
    // hier kuenstlich wirken.
    schattenKuehl: 0xaeb8bc,
    // Diffuses Licht: die Maske bleibt weitgehend offen (0.35) und der Rand
    // laeuft breit aus — ein Schatten im Nebel ist eine Ahnung, keine Kante.
    schattenWeich: 4.5, schattenTiefe: 0.35,
    // Im Dunst gibt es keine Kante, an der Licht vorbeistreift.
    sonnensaum: 0xf6f4ec, sonnensaumStk: 0.12,
    // Fast keine Kontaktfuge: bei rundum gleichem Licht gibt es kaum
    // Verdeckung. Ganz weg darf sie trotzdem nicht — sonst schwimmt im
    // Nebelbild alles, weil ihm auch der Wurfschatten fehlt.
    kontakt: 0.26,
    // Schwaechstes Toning der fuenf: Nebel frisst Farbkontrast, ein
    // deutliches Split-Toning wirkte hier aufgesetzt.
    farbskript: { licht: 0xf4eede, mitte: 0xfbfaf6, schatten: 0xa6b2be, staerke: 0.16 },
    belichtung: 1.05,
    // Kalibrierkorridor (F4): bewusst engster Werteumfang, aber lesbar —
    // fogCap 0.86 deckelt den Nebelfaktor, nahe Objekte behalten Zeichnung.
    // satMitte/satLicht < 1 druecken die Saettigung insgesamt (einzige
    // Stimmung, in der das erlaubt ist); hoechste Bloomschwelle 1.1, damit
    // das flache Licht nirgends blueht. Werte bleiben.
    bloom: { staerke: 0.10, radius: 0.6, schwelle: 1.1 },
    // satMitte 0.85 -> 0.98, satLicht 0.8 -> 0.88: gemessen lag der Nebel bei
    // mittlerer Saettigung 0.138, waehrend KEIN Referenzbild unter 0.228
    // faellt — auch ein Dunstbild behaelt Lokalfarbe, es verliert Kontrast.
    grade: { lift: [0.016, 0.018, 0.024], gamma: [1.0, 1.0, 1.0], gain: [1.0, 1.0, 1.0],
      satMitte: 0.98, satLicht: 0.88, kontrast: 0.16, schwarz: 0.024, vignette: 0.08 }
  },
  nacht: {
    // G1 — Mondnacht nach den Konzeptbildern: tiefdunkelblauer Himmel mit
    // Sternen, die weissen Ranken SELBSTLEUCHTEND als hellster Wert im Bild,
    // warmes Fensterglühen der Staedtchen als Gegenpol, Landschaft gedaempft
    // und kuehl, Nebel kuehl und duenn. Alle Werte sind kalibrierbare
    // Richtwerte. Die "Sonne" ist hier der Mond: kuehl, schwach, schraeg.
    // Mondlicht ist gerichtet und schwach; die Fuellung kommt vom Nachthimmel
    // und ist noch schwaecher. Beide steigen leicht mit, damit der schaerfere
    // Terminator die Nacht nicht in schwarze Flaechen ohne Zeichnung zerlegt —
    // der Kalibrierkorridor verlangt Tiefen MIT Zeichnung.
    sonneDir: [-0.55, 0.52, -0.42], sonne: 0xb8c8e8, sonneStk: 0.78,
    hemiHimmel: 0x3e4c78, hemiBoden: 0x24242f, hemiStk: 0.95,
    gegen: 0x36406a, gegenStk: 0.22,
    // fogWarm kaum warm — der Mond liefert kein warmes Streulicht; die
    // Nebelachse bleibt kuehl-in-kuehl, nur minimal aufgehellt zum Mond hin.
    fogWarm: 0x4a5680, fogCool: 0x252c48, fogNah: 220, fogFern: 1050, fogCap: 0.95,
    fogKurve: 0.45, luftSockel: 0.030,
    // [3] ist nachts das MONDgluehen — der helle Hof um die Scheibe, der
    // laut Kanon die Silhouetten traegt. Wie am Tag azimutal, nicht als Ring.
    himmel: [0x080d20, 0x121a34, 0x22304f, 0x6a7ea8, 0x35415f],
    // Die Scheibe IST der Mond — kein eigenes Objekt, sky.js rendert wie
    // immer die Preset-getriebene Sonnenscheibe.
    scheibe: 0xe8ecf4, scheibeGr: 110, gegenGlow: 0x2e3858,
    // Wolken oben hart (helle Mondkante), unten weich dunkel — die
    // Kunstrichtung gilt auch nachts.
    wolkeOben: 0x6a7898, wolkeUnten: 0x1e2438, wolkeRand: 0xb8c4dc, wolkeFern: 0x2a3450,
    wolkeDeck: 0.6, wolkenschatten: 0.0,
    fenster: 3.2,                        // hoechster Wert aller Presets: der warme Gegenpol
    schatten: 0.1, wasser: 0x1c2c48, welt: 0xc8d0e0, bounce: 0x3a4260,
    // Rankenglut: gazehaft-kuehles Eigenleuchten, mit Abstand der hellste
    // Wert der Nacht (rankenGlut 1.4 gegen fensterlose 0.25..0.55 am Tag).
    rankenGlut: 1.4, rankenGlutFarbe: 0x9ec8e8, sterne: 1,
    // H3: nachts IST Arbor das Licht der Welt — voller Faktor, Farbe kuehl-
    // weiss mit einem Stich ins Blaugruene (Kanon: die weissen Triebe
    // leuchten aus sich heraus). Das warme Fensterglut bleibt der Gegenpol.
    arborLicht: 1.0, arborFarbe: 0xc4e4e0,
    strahlen: 0.0,
    schattenKuehl: 0x3a4668,
    // Der Mond wirft Schatten — aber schwach und weich. 0.45 statt 1.0, sonst
    // saeuft die ohnehin dunkle Nacht in schwarzen Flaechen ab.
    schattenWeich: 3.2, schattenTiefe: 0.45,
    // Mondsaum: kuehl und schmal, aber vorhanden — er zeichnet nachts die
    // Silhouetten gegen den dunklen Himmel.
    sonnensaum: 0xa8bcdc, sonnensaumStk: 0.55,
    // Nachts sitzt der Kontakt nur als Andeutung: sonst zoege der Hof um jedes
    // beleuchtete Fenster einen schwarzen Rand.
    kontakt: 0.22,
    // Nachts liegt der Kalt-Warm-Kontrast zwischen Mondlicht (kuehl) und dem
    // Fensterglut der Staedtchen (warm) — das Skript stuetzt nur den kuehlen
    // Teil, die Glut ist Emission und laeuft ohnehin an der Graduierung
    // vorbei in den Bloom.
    farbskript: { licht: 0xd8e6fc, mitte: 0xa8b6d6, schatten: 0x2e3a5c, staerke: 0.20 },
    belichtung: 0.9,
    // Bewusste Ausnahme der ~0.9-Schwellen-Regel: schwelle 0.85 — die Glut
    // (Ranken, Fenster, Mond) DARF nachts bluehen; die gedaempfte Landschaft
    // liegt weit unter der Schwelle und bleibt davon unberuehrt.
    bloom: { staerke: 0.5, radius: 0.8, schwelle: 0.85 },
    // lift-Sockel ~0.03: die Nacht faellt nie auf reines Schwarz — Schatten
    // behalten Zeichnung (keine einfarbigen Flaechen), Sockel leicht blau.
    grade: { lift: [0.028, 0.030, 0.038], gamma: [1.0, 1.0, 1.04], gain: [0.92, 0.96, 1.06],
      satMitte: 1.0, satLicht: 0.85, kontrast: 0.06, schwarz: 0.03, vignette: 0.16 }
  }
};

/* ==========================================================================
   WETTER — die zweite Achse neben der Tageszeit.

   Bewusst KEIN zweiter Satz vollstaendiger Presets, sondern ein Satz von
   MODIFIKATOREN, der am Ende von applyTod() auf die fertige Tageszeit-Blende
   gelegt wird — dieselbe Stelle und derselbe Grund wie beim Biom-`luft`-Block:
   schnappschuss() friert beim Tageszeitwechsel den Ist-Zustand als Blendquelle
   ein; ein Wetteranteil INNERHALB der Presets wuerde beim Ueberblenden doppelt
   eingerechnet. Post-Blend angewandt bleibt das Wetter ueber jeden Uebergang
   stabil, und die 5 Tageszeiten x 5 Wetterlagen brauchen 5 statt 25 Tabellen.

   Alle Felder sind Zahlen und werden dadurch selbst weich ueberblendet
   (wetterFrom -> wetterTo ueber wetterT, Smoothstep wie bei der Tageszeit).
   Nicht-numerische Felder (label, vfxTyp, vfxFarbe) schalten hart um; die
   Partikeldichte blendet sie ueber Kreuz aus/ein, siehe wetterVfxSetzen().

     wolkeDeck       Faktor auf preset.wolkeDeck (Deckkraft der Cumulusschicht)
     wolkeGrau       0..1 Entsaettigung der vier Wolkenfarben Richtung Grau
     wolkeDunkel     Faktor auf das Grau (Regenwolken sind grau UND dunkel)
     wolkenschatten  Faktor auf uCloudAmt (Bodenschatten der Wolken)
     wolkenTempo     Faktor auf Wolkendrift und Wolkenschatten-Wanderung
     fogNah/fogFern  Faktoren auf scene.fog.near/far (Sichtweite)
     fogCap          min() gegen den Nebeldeckel
     fogTint         [r,g,b] multiplikativ auf beide Nebelfarben
     sonne/hemi      Faktoren auf die Lichtstaerken
     schatten        Faktor auf Kontaktschatten UND auf die Deckkraft der
                     Sonnenschattenmaske (sun.shadow.intensity) — unter einer
                     geschlossenen Wolkendecke gibt es beides kaum noch
     schattenWeich   Faktor auf den Vogel-Radius der Schattenkante: je
                     diffuser das Licht, desto breiter der Halbschatten
     wind            ZIEL fuer windUniforms.uWindStaerke (Gras, Kronen, Ranken)
     belichtung      Faktor auf look.belichtung
     gain            Faktor auf grade.gain (Regen/Sturm dunkeln die Welt ab)
     sat             Faktor auf grade.satMitte
     vignette        additiv auf grade.vignette
     bloom           Faktor auf bloom.staerke
     vfxTyp          Umgebungs-VFX; null = das Biom entscheidet (siehe biomVfx)
     vfxDichte       Dichte des Wetter-VFX
     vfxBiom         Faktor auf die Biomdichte, wenn vfxTyp null ist
   ========================================================================== */
var WETTER = {
  klar: {
    label: "klar",
    wolkeDeck: 1.00, wolkeGrau: 0.00, wolkeDunkel: 1.00,
    wolkenschatten: 1.00, wolkenTempo: 1.00,
    fogNah: 1.00, fogFern: 1.00, fogCap: 1.00, fogTint: [1, 1, 1],
    sonne: 1.00, hemi: 1.00, schatten: 1.00, schattenWeich: 1.00, wind: 1.00,
    belichtung: 1.00, gain: 1.00, sat: 1.00, vignette: 0.00, bloom: 1.00,
    vfxTyp: null, vfxDichte: 1.0, vfxBiom: 1.00
  },
  bewoelkt: {
    // Geschlossenere, graue Decke; das Licht wird weicher (Sonne runter,
    // Hemisphaere rauf), die Kontaktschatten verlieren ihre Haerte.
    label: "bewölkt",
    wolkeDeck: 1.30, wolkeGrau: 0.35, wolkeDunkel: 0.90,
    wolkenschatten: 1.45, wolkenTempo: 1.30,
    fogNah: 0.85, fogFern: 0.92, fogCap: 1.00, fogTint: [0.99, 0.99, 1.01],
    sonne: 0.78, hemi: 1.12, schatten: 0.72, schattenWeich: 1.70, wind: 1.15,
    belichtung: 0.99, gain: 0.98, sat: 0.94, vignette: 0.02, bloom: 0.85,
    vfxTyp: null, vfxDichte: 1.0, vfxBiom: 0.70
  },
  regen: {
    // Gedaempfte Saettigung, kuerzere Sicht, dunklere Welt. Die "nasse"
    // Bodenfarbe kommt hier ueber gain (globale Abdunklung) und sat — das
    // Terrainmaterial selbst bleibt unberuehrt. Die Wolkenschatten werden
    // schwaecher, nicht staerker: unter einer geschlossenen Decke gibt es
    // keine einzelnen Wolkenschatten mehr, nur diffuses Grau.
    label: "Regen",
    wolkeDeck: 1.50, wolkeGrau: 0.70, wolkeDunkel: 0.72,
    wolkenschatten: 0.50, wolkenTempo: 1.55,
    fogNah: 0.55, fogFern: 0.55, fogCap: 0.97, fogTint: [0.94, 0.96, 1.00],
    sonne: 0.50, hemi: 1.05, schatten: 0.45, schattenWeich: 2.40, wind: 1.35,
    belichtung: 0.95, gain: 0.90, sat: 0.78, vignette: 0.06, bloom: 0.70,
    vfxTyp: "regen", vfxDichte: 1.0, vfxBiom: 0.00
  },
  schneefall: {
    // Heller als Regen (Schnee streut Licht zurueck), aber genauso kurzsichtig.
    label: "Schneefall",
    wolkeDeck: 1.40, wolkeGrau: 0.55, wolkeDunkel: 0.94,
    wolkenschatten: 0.40, wolkenTempo: 0.90,
    fogNah: 0.50, fogFern: 0.60, fogCap: 0.95, fogTint: [1.01, 1.01, 1.03],
    sonne: 0.60, hemi: 1.20, schatten: 0.50, schattenWeich: 2.20, wind: 0.80,
    belichtung: 1.02, gain: 1.00, sat: 0.80, vignette: 0.03, bloom: 0.90,
    vfxTyp: "schnee", vfxDichte: 1.0, vfxBiom: 0.00
  },
  sturm: {
    // Starker Wind (Gras, Kronen und Ranken schwingen ueber den vorhandenen
    // Wind-Shader heftiger), gejagte Wolken (wolkenTempo 2.6) und tief
    // haengender, kurzer Nebel.
    label: "Sturm",
    wolkeDeck: 1.60, wolkeGrau: 0.80, wolkeDunkel: 0.62,
    wolkenschatten: 0.90, wolkenTempo: 2.60,
    fogNah: 0.38, fogFern: 0.45, fogCap: 0.99, fogTint: [0.92, 0.94, 0.99],
    sonne: 0.42, hemi: 0.95, schatten: 0.35, schattenWeich: 2.00, wind: 2.60,
    belichtung: 0.93, gain: 0.86, sat: 0.72, vignette: 0.10, bloom: 0.65,
    vfxTyp: "regen", vfxDichte: 1.6, vfxBiom: 0.00
  }
};

var wetterName = "klar";
var wetterFrom = null, wetterTo = WETTER.klar, wetterT = 1;
/** Die fertig geblendete Wetterlage — jedes applyTod schreibt sie neu. */
var wetterMix = kopieWetter(WETTER.klar);

function kopieWetter(w) {
  var s = {};
  for (var k in w) s[k] = Array.isArray(w[k]) ? w[k].slice() : w[k];
  return s;
}

/** Blendet wetterFrom -> wetterTo und legt das Ergebnis in wetterMix ab. */
function mischeWetter() {
  var a = wetterFrom || wetterTo, b = wetterTo;
  var e = wetterT * wetterT * (3 - 2 * wetterT);
  for (var k in b) {
    var vb = b[k], va = a[k];
    if (typeof vb === 'number' && typeof va === 'number') wetterMix[k] = lerp(va, vb, e);
    else if (Array.isArray(vb) && Array.isArray(va)) wetterMix[k] = mixArr(va, vb, e);
    else wetterMix[k] = vb;          // label, vfxTyp, vfxFarbe: harter Wechsel
  }
  return e;
}

/* ==========================================================================
   Kartenmaßstab: der Hoehennebel gibt die Karte frei (Nachtrag)

   Auf Ortsmaßstab ist der Nebel Stimmung — Tiefenstaffelung, Uebergang zum
   Himmel, die halbe Wirkung jedes Presets. Auf Kontinentmaßstab ist er Physik
   am falschen Ort: eine Karte hat keinen Dunst, und mit fogFern um 1000
   Einheiten lag bei weit herausgezogener Kamera die halbe Karte im Milchglas.

   DIE SCHWELLE ist 600 m je Zelle — nicht irgendeine Zahl, sondern `ab` der
   Stufe „kontinent" aus MASSSTAB_LEITER (world/kartenbaum.js), dieselbe
   Schwelle und dieselbe Rampe wie die Schummerung (RELIEF_AB in
   world/terrain.js; Faktor 1.6 = eine halbe Groessenordnung, wie BLENDE in
   render/signaturen.js). Schummerung und Nebelfreigabe sind EINE Geste — das
   GELAENDE hoert auf, raeumlich zu sein: wo die Reliefschattierung das
   projizierte Licht ersetzt, ersetzt nichts mehr die Luftperspektive.
   Bewusst NICHT die fruehere Uebergabe Koerper -> Karte (60, seit Runde J
   die Schwelle der Beruhigung): zwischen 60 und 600 traegt das Bild zwar
   Zeichen, aber noch echtes Gelaende mit Tiefe — und der Nebel traegt dort
   weiterhin den Uebergang der Wasserebene zum Himmel (world/water.js
   kalkuliert seinen 872-Einheiten-Saum ausdruecklich gegen fogFern); eine
   Freigabe ab 60 risse diese Kante auf halben Maßstaeben auf. Bewusst als
   Zahl mit dieser Begruendung statt als Import aus kartenbaum.js: die
   Leiter aendert sich nicht beilaeufig, und Pruefung 19 haelt beide Zahlen
   gegeneinander fest.

   WIE GEDAEMPFT WIRD: zwei Handgriffe, beide oberhalb der Schwelle weich
   (Smoothstep ueber 600..960) und unterhalb EXAKT null — der Block in
   applyTod steht hinter einem einzigen Vergleich und wird dort gar nicht
   betreten; der Rechenweg darunter bleibt Bit fuer Bit der bisherige
   (dieselbe Zusage wie ruhig()/reliefFaktor in terrain.js).

     uFogCap * (1 - d)      Der Nebeldeckel der terra-Materialien faellt auf
                            exakt 0 (der Shader rechnet fogFactor =
                            min(fogFactor, uFogCap), der Nebelzweig wird zur
                            Nullsumme). Traegt Terrain, Wasser und alle
                            Instanzen — fast das ganze Bild.
     fog.near/far + d*60000 Der lineare Standardnebel (Voegel, Rauch, alles
                            ohne terraPatch) rueckt hinter jede Sichtweite;
                            smoothstep(near, far, d) ist fuer alles unter
                            60 km exakt 0. Die NEBELFARBEN bleiben stehen:
                            fogMittel speist weiter Horizont und Rauch.

   Der Punkt in applyTod ist das LETZTE Wort ueber die Distanzen — nach
   Tageszeit, Biom-luft und Wetter. Mit Absicht: Regen darf die Sicht einer
   Ortskarte verkuerzen, aber keine Kontinentkarte vernebeln.

   DAS NEBEL-PRESET wird mitgedaempft, mit voller Haerte. Entschieden und
   begruendet: „Nebel" ist auf Kartenmaßstab kein Dunst mehr, sondern truebes
   Licht — flache Sonne, engster Werteumfang, entsaettigte Grade, helle
   Palette bleiben alle stehen und unterscheiden das Preset weiterhin klar
   von Mittag. Ein Sonderrest Distanznebel nur fuer dieses Preset waere genau
   der Bildmangel, der hier behoben wird, und ein zweiter Rechenweg dazu.
   ========================================================================== */
var NEBEL_KARTE_AB = 600;                    // m je Zelle, ab hier gibt der Nebel frei
var NEBEL_KARTE_VOLL = NEBEL_KARTE_AB * 1.6; // dieselbe halbe Groessenordnung wie BLENDE
var NEBEL_KARTE_WEIT = 60000;                // wohin near/far bei voller Freigabe ruecken

/** Staerke der Freigabe bei diesem Maßstab: exakt 0 bis einschliesslich
 *  NEBEL_KARTE_AB, Smoothstep bis exakt 1 ab NEBEL_KARTE_VOLL. Getrennt
 *  exportiert, damit die Pruefung die Schwelle nachrechnen kann. */
function nebelDaempfung(m) {
  if (!Number.isFinite(m) || m <= NEBEL_KARTE_AB) return 0;
  if (m >= NEBEL_KARTE_VOLL) return 1;
  var t = (m - NEBEL_KARTE_AB) / (NEBEL_KARTE_VOLL - NEBEL_KARTE_AB);
  return t * t * (3 - 2 * t);
}

/* --- Lichtaufbau: Sonne, Hemisphaere, schwaches kuehles Gegenlicht ------- */
var sun = new THREE.DirectionalLight(0xfff2dc, 2.6);
var hemi = new THREE.HemisphereLight(0xbfd8ee, 0xcbb896, 0.9);
var rimLight = new THREE.DirectionalLight(0xa8c8e8, 0.32);

/* ==========================================================================
   SONNENSCHATTEN — eine mitgefuehrte Kaskade der Staerke eins

   Die Schattenkarte selbst schaltet render/pipeline.js ein. Hier steht, WAS
   sie sieht: eine orthografische Kamera, die je Bild eng um den Kamerafokus
   gelegt wird.

   WARUM KEINE ECHTE KASKADE. Eine geneigte Kamera sieht bis zum Horizont;
   eine einzige Schattenkarte kann das nicht abdecken. Drei Kaskadenstufen
   waeren drei zusaetzliche Geometriedurchlaeufe — bei rund 900.000 Dreiecken
   je Bild und einem ohnehin gerissenen 20-ms-Vertrag ist das nicht bezahlbar.
   Stattdessen waechst die EINE Karte mit der Kameradistanz mit:

     halbweite = dist * 1.9, geklemmt auf 90..430

   Der Faktor ist nachgerechnet, nicht geraten. Bei fov 34 und Bildhoehe 900
   deckt ein Bildpunkt in der Fokusebene rund dist * 0.0007 Welteinheiten ab;
   ein Schattentexel ist halbweite/1024 gross. Mit 1.9 landet ein Texel bei
   rund drei Bildpunkten — in JEDER Aufnahme, vom 44er-Nahblick auf die
   Schildkroete bis zum 230er-Rankenplateau. Die Schattenaufloesung bleibt
   also im BILD konstant, statt in der Nahaufnahme zu verschwenden und in der
   Weite zu verhungern.

   Was jenseits der Halbweite liegt, ist voll besonnt (three gibt ausserhalb
   des Frustums 1.0 zurueck). Bei halbweite = 1.9 * dist liegt diese Grenze
   rund das Doppelte der Kameradistanz hinter dem Fokus — dort traegt der
   Nebel das Bild bereits, eine Kante ist in keiner der 14 Aufnahmen sichtbar.

   TEXELRASTUNG. Ohne sie wandert die Karte beim Kamerafahren in
   Bruchteilen eines Texels und jede Schattenkante flimmert. Der Mittelpunkt
   wird deshalb in der Lichtebene (Seite/Hoch) auf ganze Texel gerundet.

   BIAS. Die Kamera ist orthografisch, die Tiefe also LINEAR — es gibt kein
   Praezisionsproblem in der Ferne, und `bias` waere in Weltmass sehr grob
   (0.0005 * Tiefenbereich). Der Streifenschutz laeuft deshalb fast
   vollstaendig ueber `normalBias`, das three in WELTeinheiten auf die
   Normale rechnet: 1.8 Texelbreiten, mitwachsend mit der Halbweite.
   ========================================================================== */
var SCHATTEN_KARTE = 2048;          // Kantenlaenge der Schattentextur
var SCHATTEN_NAH = 90, SCHATTEN_FERN = 430;   // Grenzen der Halbweite
sun.castShadow = true;
sun.shadow.mapSize.set(SCHATTEN_KARTE, SCHATTEN_KARTE);
sun.shadow.bias = -0.00035;
sun.shadow.camera.near = 1;

var SCHATTEN_HOEHE_MIN = 0.18;      // flachste Ausrichtung der Schattenkamera
var _schSeite = new THREE.Vector3(), _schHoch = new THREE.Vector3();
var _schRicht = new THREE.Vector3();
var _schAuf = new THREE.Vector3(0, 1, 0), _schMitte = new THREE.Vector3();
var schattenDir = new THREE.Vector3(0.45, 0.75, 0.35).normalize();

/**
 * Legt die Schattenkamera um den aktuellen Kamerafokus. Laeuft je Bild
 * (tickAtmosphere) und zusaetzlich am Ende jedes applyTod, damit ein
 * Tageszeitwechsel im STEHENDEN Bild sofort greift.
 */
function schattenFitten() {
  var halb = cam.dist * 1.9;
  if (halb < SCHATTEN_NAH) halb = SCHATTEN_NAH;
  if (halb > SCHATTEN_FERN) halb = SCHATTEN_FERN;
  var texel = 2 * halb / SCHATTEN_KARTE;

  /* Mindesthoehe der SCHATTENrichtung. Die Beleuchtung selbst behaelt die
     Preset-Richtung — nur die Schattenkamera richtet sich flacher als
     SCHATTEN_HOEHE_MIN nicht mehr aus. Grund: die Schattenlaenge waechst mit
     1/tan(Hoehe) und laeuft gegen unendlich. Beim Abendpreset (Hoehe 0.10)
     legte ein Rankenstamm dadurch einen Streifen ueber die halbe Karte,
     und die Schattenkamera musste eine Tiefe abdecken, in der jedes Texel
     wertlos wurde. 0.18 laesst die Abendschatten rund fuenfmal so lang wie
     ihr Objekt — deutlich laenger als am Mittag, aber endlich.
     Die Abweichung ist bei streifendem Licht nicht ablesbar: der AZIMUT
     bleibt exakt erhalten, und die Terminatorzeichnung auf den Objekten
     kommt weiterhin aus der echten Richtung. */
  _schRicht.copy(schattenDir);
  if (_schRicht.y < SCHATTEN_HOEHE_MIN) {
    var eben = Math.sqrt(Math.max(1e-6, 1 - _schRicht.y * _schRicht.y));
    var zielEben = Math.sqrt(1 - SCHATTEN_HOEHE_MIN * SCHATTEN_HOEHE_MIN);
    _schRicht.x *= zielEben / eben;
    _schRicht.z *= zielEben / eben;
    _schRicht.y = SCHATTEN_HOEHE_MIN;
    _schRicht.normalize();
  }

  // Orthonormale Lichtbasis. Bei fast senkrechter Sonne (mittag/nebel) ist
  // die Weltachse Y kein brauchbarer Aufwaerts-Bezug mehr — dann dient Z.
  _schAuf.set(0, 1, 0);
  if (Math.abs(_schRicht.y) > 0.985) _schAuf.set(0, 0, 1);
  _schSeite.crossVectors(_schAuf, _schRicht).normalize();
  _schHoch.crossVectors(_schRicht, _schSeite).normalize();

  // Mittelpunkt: der Kamerafokus, in der Lichtebene auf ganze Texel gerundet.
  _schMitte.set(cam.focus.x, cam.focusY, cam.focus.z);
  var s = Math.round(_schMitte.dot(_schSeite) / texel) * texel;
  var h = Math.round(_schMitte.dot(_schHoch) / texel) * texel;
  var t = _schMitte.dot(_schRicht);
  _schMitte.set(0, 0, 0)
    .addScaledVector(_schSeite, s).addScaledVector(_schHoch, h)
    .addScaledVector(_schRicht, t);

  // Abstand der Lichtquelle: hoch genug, dass Ranken (bis 1000 Einheiten),
  // Schwebeinseln und Bergkaemme noch VOR der nahen Ebene liegen.
  var abstand = 1250;
  sun.position.copy(_schMitte).addScaledVector(_schRicht, abstand);
  sun.target.position.copy(_schMitte);
  sun.target.updateMatrixWorld();
  var c = sun.shadow.camera;
  c.left = -halb; c.right = halb; c.top = halb; c.bottom = -halb;
  c.far = abstand + halb * 2.4 + 400;
  c.updateProjectionMatrix();
  // 1.8 Texelbreiten: unter ~1.2 kommen Streifen auf schraegen Daechern
  // zurueck, ueber ~2.5 loest sich der Schatten sichtbar vom Fuss des
  // Objekts. Waechst mit der Halbweite mit, weil das Texel es auch tut.
  sun.shadow.normalBias = texel * 1.8;
}

var todName = "mittag";
var todFrom = null, todTo = PRESETS.mittag, todT = 1;
var fogMittel = new THREE.Color();          // Fallback-Nebelfarbe (Rauch, fog.color)
var sceneHook = null;

function getTodName() { return todName; }

var _a = new THREE.Color(), _b = new THREE.Color(), _m = new THREE.Color();
function mixHex(ka, kb, e, out) { _a.set(ka); _b.set(kb); out.copy(_a).lerp(_b, e); return out; }
function mixNum(a, b, e) { return lerp(a, b, e); }
function mixArr(a, b, e) { return [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)]; }

var _dir = new THREE.Vector3();
var _col = new THREE.Color();
var _luft = new THREE.Color();   // eigener Puffer fuer den Biom-Nachkorrekturblock
var _grau = new THREE.Color();   // eigener Puffer fuer die Wetter-Wolkenfarbe

/**
 * Zieht eine fertig geblendete Wolkenfarbe Richtung Regengrau und gibt sie als
 * Hex zurueck (setWolkenFarben erwartet Hex). Das Grau wird aus der Luminanz
 * der Farbe gebildet und leicht ins Kuehle gekippt — so bleibt der Tageszeit-
 * charakter erhalten, statt ihn durch ein festes Grau zu ersetzen.
 * EIGENER Farbpuffer: mixHex benutzt intern _a und _b, deshalb darf hier
 * keiner der geteilten Puffer angefasst werden.
 */
function wetterWolke(c) {
  var g = wetterMix.wolkeGrau;
  if (g <= 0.001) return c.getHex();
  var l = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
  var d = wetterMix.wolkeDunkel;
  _grau.setRGB(l * d * 0.98, l * d, l * d * 1.04);
  return c.lerp(_grau, clamp(g, 0, 1)).getHex();
}

/** Blendet zwischen todFrom und todTo und schreibt alles in die Welt. */
function applyTod(t) {
  var a = todFrom || todTo, b = todTo;
  var e = t * t * (3 - 2 * t);
  var satFaktor = 1;   // Biom-Nachkorrektur auf grade.satMitte, s. luft-Block unten
  // Wetter: eigene, langsamere Blende. mischeWetter() fuellt wetterMix und
  // liefert die geglaettete Blendlage — beides braucht der VFX-Kreuzblender
  // am Ende der Funktion.
  var wE = mischeWetter();
  var W = wetterMix;

  _dir.set(lerp(a.sonneDir[0], b.sonneDir[0], e), lerp(a.sonneDir[1], b.sonneDir[1], e),
    lerp(a.sonneDir[2], b.sonneDir[2], e)).normalize();
  /* Die Sonnenposition setzt jetzt schattenFitten() (Position UND Ziel wandern
     gemeinsam mit dem Kamerafokus). Fuer die Lichtrichtung ist das
     wertneutral: three bildet sie als position - target.position, und beide
     verschieben sich um denselben Betrag. */
  schattenDir.copy(_dir);
  mixHex(a.sonne, b.sonne, e, sun.color);
  sun.intensity = mixNum(a.sonneStk, b.sonneStk, e) * W.sonne;
  // Schattenhaerte und -tiefe gehoeren zur Stimmung: Mittag zeichnet hart,
  // Nebel loest fast auf, die Nacht behaelt nur eine Andeutung. `radius` ist
  // der Halbmesser des 5-Punkt-Vogel-Kreises in Texeln, `intensity` mischt
  // die fertige Maske gegen 1.0 (three: mix( 1.0, shadow, shadowIntensity )).
  sun.shadow.radius = mixNum(a.schattenWeich, b.schattenWeich, e)
    * (W.schattenWeich === undefined ? 1 : W.schattenWeich);
  sun.shadow.intensity = clamp(mixNum(a.schattenTiefe, b.schattenTiefe, e)
    * W.schatten, 0, 1);
  mixHex(a.hemiHimmel, b.hemiHimmel, e, hemi.color);
  mixHex(a.hemiBoden, b.hemiBoden, e, hemi.groundColor);
  hemi.intensity = mixNum(a.hemiStk, b.hemiStk, e) * W.hemi;
  rimLight.position.copy(_dir).multiplyScalar(-600);
  rimLight.position.y = Math.abs(rimLight.position.y) * 0.5 + 120;
  mixHex(a.gegen, b.gegen, e, rimLight.color);
  rimLight.intensity = mixNum(a.gegenStk, b.gegenStk, e);

  // Nebel: zwei Farben in die Uniforms, Mittelwert als Fallback in scene.fog
  mixHex(a.fogWarm, b.fogWarm, e, terraUniforms.uFogWarm.value);
  mixHex(a.fogCool, b.fogCool, e, terraUniforms.uFogCool.value);
  terraUniforms.uSunDir.value.copy(_dir);
  terraUniforms.uFogCap.value = mixNum(a.fogCap, b.fogCap, e);
  /* Staffelung und Luftsockel der Luftperspektive (render/materials.js,
     Patch 4). Beide werden TOLERANT gelesen: fehlt das Feld auf einer Seite
     der Blende, blendet es gegen 0 — also gegen den Zustand vor dieser Runde
     (Nebelgerade, kein Sockel), nicht gegen NaN. Damit tragen sie auch
     Wetter- und Biomtabellen, die diese Felder nicht kennen. */
  terraUniforms.uFogKurve.value = mixNum(a.fogKurve === undefined ? 0 : a.fogKurve,
    b.fogKurve === undefined ? 0 : b.fogKurve, e);
  terraUniforms.uLuftSockel.value = mixNum(a.luftSockel === undefined ? 0 : a.luftSockel,
    b.luftSockel === undefined ? 0 : b.luftSockel, e);
  mixHex(a.bounce, b.bounce, e, terraUniforms.uBounce.value);
  // F1: kuehle Schattenfarbe blendet wie alle Farbfelder weich mit
  mixHex(a.schattenKuehl, b.schattenKuehl, e, terraUniforms.uSchattenKuehl.value);
  /* Gegenlichtsaum: Farbe und Staerke blenden getrennt und werden erst hier
     zusammengefuehrt. Getrennt, weil eine Farbe im Farbraum interpoliert und
     eine Staerke linear — ein vorab multiplizierter Wert blendete beim
     Tageszeitwechsel ueber Schwarz und der Saum blinkte. Der Wetterfaktor
     ist derselbe wie beim Wurfschatten: unter einer Wolkendecke streift kein
     Licht mehr an einer Kante vorbei. */
  mixHex(a.sonnensaum === undefined ? 0 : a.sonnensaum,
    b.sonnensaum === undefined ? 0 : b.sonnensaum, e, terraUniforms.uSonnensaum.value)
    .multiplyScalar(mixNum(a.sonnensaumStk === undefined ? 0 : a.sonnensaumStk,
      b.sonnensaumStk === undefined ? 0 : b.sonnensaumStk, e) * W.schatten);
  fogMittel.copy(terraUniforms.uFogWarm.value).lerp(terraUniforms.uFogCool.value, 0.5);
  if (sceneHook && sceneHook.fog) {
    sceneHook.fog.color.copy(fogMittel);
    sceneHook.fog.near = mixNum(a.fogNah, b.fogNah, e);
    sceneHook.fog.far = mixNum(a.fogFern, b.fogFern, e);
  }
  // Bedienungsrunde: abgeschaltete Wolken (S.wolken === false, siehe sky.js)
  // werfen auch keinen Bodenschatten — sonst zoege ein unsichtbarer Himmel
  // wandernde Flecken uebers Land.
  terraUniforms.uCloudAmt.value = mixNum(a.wolkenschatten, b.wolkenschatten, e)
    * W.wolkenschatten * (S.wolken === false ? 0 : 1);
  // Fensterglut: warme Emission bei Abendrot, Morgen, Nebel und (am
  // staerksten) in der Nacht
  var glut = mixNum(a.fenster === undefined ? 0 : a.fenster,
    b.fenster === undefined ? 0 : b.fenster, e);
  if (POOLS.fensterlicht && POOLS.fensterlicht.mat) POOLS.fensterlicht.mat.emissiveIntensity = glut;

  // Himmel mit fuenf Stuetzstellen
  var h = [];
  for (var i = 0; i < 5; i++) h.push(mixHex(a.himmel[i], b.himmel[i], e, _col).getHex());
  /* setSonnenDir VOR paintSky: die Kuppel faerbt seit dieser Runde auch
     azimutal (Sonnengluehen am Horizont, world/sky.js) und liest dafuer die
     hinterlegte Sonnenrichtung. Umgekehrt haette sie beim ersten applyTod die
     Startrichtung des Moduls benutzt und danach je einen Takt nachgehinkt. */
  setSonnenDir(_dir);
  /* fogMittel als sechstes Argument: die Kuppel bildet ihren Horizontsaum und
     ihre beiden Fernstufen aus der ECHTEN Nebelfarbe der Stimmung (sky.js,
     paintSky). Vorher wurden die beiden Flaechen, die sich an der Horizont-
     kante beruehren, aus zwei voneinander unabhaengigen Zahlensaetzen
     gefaerbt — daher der Abnahmebefund "abrupter Farbsprung von beige auf
     mauve an einer 1-Pixel-Polygonkante".
     BEWUSST HIER und nicht nach den Nachkorrekturen: an dieser Stelle steht
     die Tageszeit-Blende von fogMittel. Die Biom- und Wetterkorrekturen
     danach sind reine Multiplikatoren im Bereich 0.92–1.06 (store.js
     luft.fogCoolTint, WETTER.fogTint) — sie verschieben den Saum um wenige
     Stufen, waehrend ein Verschieben dieses Aufrufs die Reihenfolge von
     setWolkenFarben/recolorClouds mitreissen wuerde, das die Dunstfarbe
     ebenfalls liest. Die Naht bleibt damit gemessen unter drei Stufen. */
  paintSky(h[0], h[1], h[2], h[3], h[4], fogMittel);
  setSonne(_dir, mixHex(a.scheibe, b.scheibe, e, _col).getHex(),
    mixNum(a.scheibeGr, b.scheibeGr, e),
    mixHex(a.gegenGlow, b.gegenGlow, e, _m).getHex());
  // Wolkendeckung und -farbe tragen den groessten Teil der Wetterwirkung:
  // wolkeDeck macht die Schicht dichter, wolkeGrau/wolkeDunkel ziehen die vier
  // Preset-Wolkenfarben Richtung Regengrau — die Tageszeit bleibt dabei
  // erkennbar (ein Abendrot-Regen ist grau MIT warmem Rest).
  var deck = clamp(mixNum(a.wolkeDeck, b.wolkeDeck, e) * W.wolkeDeck, 0, 1);
  setWolkenFarben(wetterWolke(mixHex(a.wolkeOben, b.wolkeOben, e, _col)),
    wetterWolke(mixHex(a.wolkeUnten, b.wolkeUnten, e, _m)),
    wetterWolke(mixHex(a.wolkeRand, b.wolkeRand, e, _a)),
    wetterWolke(mixHex(a.wolkeFern, b.wolkeFern, e, _b)),
    deck);
  cirrusMat.opacity = deck * 0.24 * (1 - W.wolkeGrau * 0.8);   // Zirren verschwinden unter der Decke
  // Sterne blenden mit der Tageszeit (nacht 1, abend 0.15, sonst 0). Der
  // Mond ist die Preset-getriebene Sonnenscheibe oben — kein eigenes Objekt.
  setSterne(mixNum(a.sterne === undefined ? 0 : a.sterne,
    b.sterne === undefined ? 0 : b.sterne, e));

  // Kontaktschatten: unter einer geschlossenen Decke gibt es kaum noch
  // gerichtetes Licht, also auch kaum noch harte Schlagschatten.
  // SCHATTEN_BLOB_REST: seit die Sonne eine echte Schattenkarte hat, liegt
  // unter jedem Objekt beides. Der gemalte Fleck bleibt als Fugenschluss am
  // Kontaktpunkt (siehe core/pools.js), aber nur noch mit einem Drittel
  // seiner Deckkraft — sonst summierten sich Fleck und Wurfschatten zu einem
  // schwarzen Sockel. Der Faktor haengt an der Schattentiefe der Stimmung:
  // wo die Karte kaum wirkt (Nebel 0.35, Nacht 0.45), traegt der Fleck
  // wieder mehr.
  var schattenTiefe = mixNum(a.schattenTiefe, b.schattenTiefe, e);
  schattenMat.opacity = mixNum(a.schatten, b.schatten, e) * W.schatten
    * (1 - 0.62 * schattenTiefe);
  mixHex(a.wasser, b.wasser, e, waterMat.color);
  // Biom-Tint (G5): faerbt die Preset-Wasserfarbe je Biom um (wiese = [1,1,1]).
  // io.js ruft nach jedem Biomwechsel setTod(..., true), damit er sofort greift.
  var wt = (BIOME[S.biom] || BIOME.wiese).wasserTint;
  waterMat.color.setRGB(waterMat.color.r * wt[0], waterMat.color.g * wt[1], waterMat.color.b * wt[2]);
  mixHex(a.welt, b.welt, e, _col);
  for (var m = 0; m < tintedMats.length; m++) tintedMats[m].color.copy(_col);
  // Rankenglut (G1): eigene Emissive-Farbe und -Staerke pro Tageszeit statt
  // des frueheren pauschalen welt*0.32 — tags dezent warm-grau, nachts
  // kuehles Gazeleuchten als hellster Wert im Bild. Blendet weich mit.
  mixHex(a.rankenGlutFarbe, b.rankenGlutFarbe, e, vineMat.emissive)
    .multiplyScalar(mixNum(a.rankenGlut, b.rankenGlut, e));
  // H3 — Arbor als Lichtquelle: Staerke und Farbe blenden wie jedes andere
  // Presetfeld weich mit. Die Rankenpositionen selbst setzt setArborQuellen()
  // (materials.js), gefuettert aus dem Commit-Nachlauf.
  terraUniforms.uArborStaerke.value = mixNum(
    a.arborLicht === undefined ? 0 : a.arborLicht,
    b.arborLicht === undefined ? 0 : b.arborLicht, e);
  mixHex(a.arborFarbe === undefined ? 0xdfe8f0 : a.arborFarbe,
    b.arborFarbe === undefined ? 0xdfe8f0 : b.arborFarbe, e,
    terraUniforms.uArborFarbe.value);

  /* --- Biom-Atmosphaere (Biomkatalog 28) --------------------------------
     Nachkorrektur NACH der fertigen Tageszeit-Blende — genau hier, wo auch
     der wasserTint sitzt. Bewusst NICHT in die Presets hinein: schnappschuss()
     friert beim Tageszeitwechsel den Ist-Zustand als Blendquelle ein, eine
     Biom-Nuance in den Presets wuerde beim Ueberblenden doppelt eingerechnet.
     Post-Blend angewandt bleibt sie ueber jeden Uebergang stabil.
     Fehlt der luft-Block im Biom, laeuft der ganze Zweig nicht — das Bild ist
     dann byteidentisch zu vorher. Alle Felder sind einzeln optional.
     Nachtregel: die Tints wirken nur multiplikativ und duerfen (laut Katalog)
     nie ueber 1.10 liegen, satMitte ebenso — so bleibt der Kalibrierkorridor
     (Massen S 0.25–0.50, Werteumfang 0.20–0.85) ueber alle Kombinationen
     erhalten, ohne dass die Nacht aufgehellt wird. */
  var L = (BIOME[S.biom] || BIOME.wiese).luft;
  if (L) {
    var tw = L.fogWarmTint, tc = L.fogCoolTint, fc;
    if (tw) { fc = terraUniforms.uFogWarm.value; fc.setRGB(fc.r * tw[0], fc.g * tw[1], fc.b * tw[2]); }
    if (tc) { fc = terraUniforms.uFogCool.value; fc.setRGB(fc.r * tc[0], fc.g * tc[1], fc.b * tc[2]); }
    // Mittelwert nachziehen: fogMittel speist scene.fog, den Rauch und den
    // Horizont der Farbgraduierung.
    fogMittel.copy(terraUniforms.uFogWarm.value).lerp(terraUniforms.uFogCool.value, 0.5);
    if (typeof L.fogCapMax === 'number')
      terraUniforms.uFogCap.value = Math.min(terraUniforms.uFogCap.value, L.fogCapMax);
    if (sceneHook && sceneHook.fog) {
      sceneHook.fog.color.copy(fogMittel);
      if (typeof L.fogNah === 'number') sceneHook.fog.near *= L.fogNah;
      if (typeof L.fogFern === 'number') sceneHook.fog.far *= L.fogFern;
    }
    // Wirksamstes Einzelfeld: der Hemisphaeren-Bodenanteil ist physikalisch
    // das vom Boden zurueckgeworfene Licht — er verkoppelt Terrainpalette und
    // Beleuchtung mit einer Zeile.
    if (L.hemiBoden !== undefined && L.hemiBoden !== null && L.hemiMisch)
      hemi.groundColor.lerp(_luft.set(L.hemiBoden), clamp(L.hemiMisch, 0, 1));
    if (typeof L.wolkenschatten === 'number')
      terraUniforms.uCloudAmt.value *= L.wolkenschatten;
    if (typeof L.satMitte === 'number') satFaktor = L.satMitte;
  }

  /* --- Wetter-Nachkorrektur ---------------------------------------------
     NACH der Tageszeit- UND nach der Biomkorrektur: Wetter ist die
     kurzlebigste der drei Achsen und muss deshalb das letzte Wort haben.
     Regen soll auch in einem Biom mit weiter Sicht kurzsichtig sein.
     Angefasst werden ausschliesslich die schon vorhandenen globalen Regler —
     kein Material und kein Pool wird beruehrt.                            */
  var wt = W.fogTint, fw = terraUniforms.uFogWarm.value, fk = terraUniforms.uFogCool.value;
  fw.setRGB(fw.r * wt[0], fw.g * wt[1], fw.b * wt[2]);
  fk.setRGB(fk.r * wt[0], fk.g * wt[1], fk.b * wt[2]);
  fogMittel.copy(fw).lerp(fk, 0.5);
  terraUniforms.uFogCap.value = Math.min(terraUniforms.uFogCap.value, W.fogCap);
  if (sceneHook && sceneHook.fog) {
    sceneHook.fog.color.copy(fogMittel);
    sceneHook.fog.near *= W.fogNah;
    sceneHook.fog.far *= W.fogFern;
  }

  /* --- Kartenmaßstab-Nachkorrektur (Begruendung oben bei NEBEL_KARTE_AB) --
     NACH allen drei Achsen: der Maßstab hat ueber die Distanzen das letzte
     Wort. Unterhalb der Schwelle ist d exakt 0 und der Block wird nicht
     betreten — kein zusaetzlicher Faktor, kein veraenderter Float.        */
  var nebelFrei = nebelDaempfung(S.einheitMeter);
  if (nebelFrei > 0) {
    terraUniforms.uFogCap.value *= 1 - nebelFrei;
    if (sceneHook && sceneHook.fog) {
      sceneHook.fog.near += nebelFrei * NEBEL_KARTE_WEIT;
      sceneHook.fog.far += nebelFrei * NEBEL_KARTE_WEIT;
    }
  }
  // Windstaerke: wind.js exportiert die geteilten Uniforms, der Wind-Patch in
  // materials.js multipliziert die Auslenkung damit. Ein reiner Schreibzugriff
  // auf uWindStaerke reicht also aus — wind.js selbst bleibt unveraendert.
  windUniforms.uWindStaerke.value = W.wind;

  // H2a — Schneeauflage: ein einziger Schreibvorgang beschneit die ganze
  // Szene. Fehlt der Block im Biom, setzt setSchnee uSchneeAuflage = 0 und der
  // Fragmentzweig faellt komplett weg. io.js ruft nach jedem Biomwechsel
  // setTod(getTodName(), true) — damit greift der Wechsel sofort.
  var BS = BIOME[S.biom] || BIOME.wiese;
  setSchnee(BS.schnee || (BS.luft && BS.luft.schnee) || null);

  // W.gain dunkelt die ganze Welt ab — das ist der einzige globale Regler, mit
  // dem sich der "nasse Boden" bei Regen andeuten laesst, ohne das
  // Terrainmaterial anzufassen (Vorschlag fuer die echte Loesung im Bericht).
  var gain = mixArr(a.grade.gain, b.grade.gain, e);
  gain[0] *= W.gain; gain[1] *= W.gain; gain[2] *= W.gain;
  setLook({
    belichtung: mixNum(a.belichtung, b.belichtung, e) * W.belichtung,
    bloom: { staerke: mixNum(a.bloom.staerke, b.bloom.staerke, e) * W.bloom,
      radius: mixNum(a.bloom.radius, b.bloom.radius, e),
      schwelle: mixNum(a.bloom.schwelle, b.bloom.schwelle, e) },
    grade: { lift: mixArr(a.grade.lift, b.grade.lift, e),
      gamma: mixArr(a.grade.gamma, b.grade.gamma, e),
      gain: gain,
      // satFaktor ist die Biom-Nachkorrektur (luft.satMitte, neutral = 1) —
      // die Saettigung wird dadurch nie global angehoben, sondern nur je Biom
      // nachgezogen; der Katalog deckelt den Faktor bei 1.10. W.sat ist die
      // Wetterkorrektur und drueckt nur (Regen 0.78, Sturm 0.72).
      satMitte: mixNum(a.grade.satMitte, b.grade.satMitte, e) * satFaktor * W.sat,
      satLicht: mixNum(a.grade.satLicht, b.grade.satLicht, e),
      // Tonwertumfang: fehlt das Feld auf einer Seite, blendet es gegen 0
      // (die Identitaet), nicht gegen NaN.
      kontrast: mixNum(a.grade.kontrast === undefined ? 0 : a.grade.kontrast,
        b.grade.kontrast === undefined ? 0 : b.grade.kontrast, e),
      schwarz: mixNum(a.grade.schwarz, b.grade.schwarz, e),
      vignette: mixNum(a.grade.vignette, b.grade.vignette, e) + W.vignette },
    horizont: fogMittel,
    /* Kontaktverdunklung: dieselbe Wetterachse wie der Wurfschatten. Unter
       einer geschlossenen Wolkendecke verschwindet die Fuge mit dem
       gerichteten Licht — W.schatten traegt beides. */
    kontakt: mixNum(a.kontakt === undefined ? 0 : a.kontakt,
      b.kontakt === undefined ? 0 : b.kontakt, e) * (0.45 + 0.55 * W.schatten),
    // C1: Godrays. Der Wert je Tageszeit steuert die Staerke, die
    // Sonnenrichtung liefert den Ursprung im Bildraum. Nachts 0 —
    // dann strahlen die Ranken statt der Sonne (Kanon).
    strahlen: mixNum(a.strahlen === undefined ? 0 : a.strahlen,
      b.strahlen === undefined ? 0 : b.strahlen, e) * (W.strahlen === undefined ? 1 : W.strahlen),
    sonneDir: _dir,
    // Warm/Kalt-Trennung als Filmlook ueber der Palette. Fehlt das Feld
    // (Wetter-/Biomtabellen liefern es nicht), schaltet setLook den Zweig ab.
    farbskript: mischeSkript(a.farbskript, b.farbskript, e)
  });

  // Die Schattenkamera folgt der Sonnenrichtung — nach der Blende, damit ein
  // Tageszeitwechsel auch im stehenden Bild sofort die richtige Richtung hat.
  schattenFitten();
  wetterVfxSetzen(wE);
}

/* Blendet die beiden Farbskripte zweier Presets. Eigene Funktion statt eines
   Eintrags in schnappschuss(): das Skript ist ein Objekt aus drei Hexfarben
   plus einer Zahl, und mixHex braucht je Farbe einen eigenen Zielpuffer.
   Fehlt es auf einer Seite, blendet die Staerke der anderen Seite gegen 0 —
   ein Preset ohne Skript zieht das Toning also sauber heraus. */
var _skLicht = new THREE.Color(), _skMitte = new THREE.Color(), _skSchatten = new THREE.Color();
var _skript = { licht: _skLicht, mitte: _skMitte, schatten: _skSchatten, staerke: 0 };
function mischeSkript(a, b, e) {
  if (!a && !b) return null;
  var q = a || b, r = b || a;
  mixHex(q.licht, r.licht, e, _skLicht);
  mixHex(q.mitte, r.mitte, e, _skMitte);
  mixHex(q.schatten, r.schatten, e, _skSchatten);
  _skript.staerke = lerp(a ? a.staerke : 0, b ? b.staerke : 0, e);
  return _skript;
}

/* ==========================================================================
   VFX-Kopplung: Wetter zuerst, sonst das Biom.
   ========================================================================== */

/**
 * Liest BIOME[S.biom].vfx TOLERANT. Erlaubt sind:
 *   vfx: "blueten"                                  (Kurzform)
 *   vfx: { typ: "sporen", dichte: 0.8, farbe: 0x9fe8c4 }
 * Fehlt das Feld — Stand dieser Runde bei allen 25 Biomen —, gibt es keinen
 * Umgebungs-VFX und der Zweig kostet nichts. Die konkreten Vorschlaege je Biom
 * stehen im Rundenbericht; store.js gehoert dieser Runde nicht.
 */
function biomVfx() {
  var v = (BIOME[S.biom] || {}).vfx;
  if (!v) return null;
  if (typeof v === 'string') return { typ: v, dichte: 1, farbe: null };
  if (typeof v === 'object' && v.typ)
    return { typ: v.typ, dichte: (typeof v.dichte === 'number') ? v.dichte : 1,
      farbe: (v.farbe === undefined) ? null : v.farbe };
  return null;
}

/** Das Ziel des aktuellen Wetters: eigener Typ, sonst der des Bioms. */
function vfxZiel(w) {
  if (w.vfxTyp) return { typ: w.vfxTyp, dichte: w.vfxDichte, farbe: null };
  var b = biomVfx();
  if (!b || w.vfxBiom <= 0) return { typ: 'aus', dichte: 0, farbe: null };
  return { typ: b.typ, dichte: b.dichte * w.vfxBiom, farbe: b.farbe };
}

var vfxVon = { typ: 'aus', dichte: 0, farbe: null };

/**
 * Kreuzblende der Partikel. Ein Typ laesst sich nicht interpolieren, die
 * DICHTE dagegen schon: bei gleichem Typ wird sie einfach geblendet, bei
 * einem Wechsel faehrt die alte Sorte bis zur Blendmitte aus und die neue
 * danach ein. Beides laeuft ueber EIN Mesh — der Umschaltpunkt bei e = 0.5
 * ist genau der Moment, in dem beide Dichten 0 sind.
 * `e` ist die geglaettete Wetterblende aus mischeWetter().
 */
function wetterVfxSetzen(e) {
  var nach = vfxZiel(wetterMix);
  var typ, d, farbe;
  if (vfxVon.typ === nach.typ) {
    typ = nach.typ; farbe = nach.farbe;
    d = lerp(vfxVon.dichte, nach.dichte, e);
  } else if (e < 0.5) {
    typ = vfxVon.typ; farbe = vfxVon.farbe; d = vfxVon.dichte * (1 - e * 2);
  } else {
    typ = nach.typ; farbe = nach.farbe; d = nach.dichte * (e * 2 - 1);
  }
  setVfx({ typ: typ, dichte: d, farbe: farbe });
  // Am Ende der Blende ist das Ziel erreicht — es wird zur neuen Quelle,
  // damit ein Biomwechsel bei stehendem Wetter (wetterT === 1) sofort greift.
  if (e >= 1) { vfxVon.typ = nach.typ; vfxVon.dichte = nach.dichte; vfxVon.farbe = nach.farbe; }
}

/** Merkt sich den Ist-Zustand als Blendquelle und startet die Ueberblendung. */
function schnappschuss() {
  var a = todFrom || todTo, b = todTo, e = todT * todT * (3 - 2 * todT);
  var s = {};
  for (var k in b) {
    var va = a[k], vb = b[k];
    if (typeof vb === 'number') s[k] = lerp(va, vb, e);
    else if (Array.isArray(vb) && typeof vb[0] === 'number' && vb.length === 3 && k !== 'himmel')
      s[k] = mixArr(va, vb, e);
    else if (k === 'himmel') {
      s[k] = [];
      for (var i = 0; i < 5; i++) s[k].push(mixHex(va[i], vb[i], e, _col).getHex());
    }
    else if (k === 'bloom' || k === 'grade') {
      s[k] = {};
      for (var kk in vb) {
        s[k][kk] = Array.isArray(vb[kk]) ? mixArr(va[kk], vb[kk], e) : lerp(va[kk], vb[kk], e);
      }
    }
    else s[k] = vb;   // Hex-Zahlen sind numbers und oben schon abgedeckt
  }
  // Hex-Farben sind numbers — lerp im Zahlenraum waere falsch. Farbfelder gezielt:
  ['sonne','hemiHimmel','hemiBoden','gegen','fogWarm','fogCool','scheibe','gegenGlow',
   'wolkeOben','wolkeUnten','wolkeRand','wolkeFern','wasser','welt','bounce',
   'schattenKuehl','sonnensaum','rankenGlutFarbe','arborFarbe'].forEach(function (k) {
    s[k] = mixHex(a[k], b[k], e, _col).getHex();
  });
  // Farbskript: drei Hexfarben plus Staerke — die generische Schleife oben
  // wuerde es als Objekt hart uebernehmen und beim Wechsel mitten in einer
  // Blende einen Tonsprung erzeugen.
  if (a.farbskript || b.farbskript) {
    var qa = a.farbskript || b.farbskript, qb = b.farbskript || a.farbskript;
    s.farbskript = {
      licht: mixHex(qa.licht, qb.licht, e, _col).getHex(),
      mitte: mixHex(qa.mitte, qb.mitte, e, _col).getHex(),
      schatten: mixHex(qa.schatten, qb.schatten, e, _col).getHex(),
      staerke: lerp(a.farbskript ? a.farbskript.staerke : 0,
        b.farbskript ? b.farbskript.staerke : 0, e)
    };
  } else s.farbskript = null;
  return s;
}

function setTod(name, instant) {
  // Tolerantes Speicherformat: unbekannte Tageszeiten (z. B. eine Karte aus
  // einem neueren Editor mit weiteren Stimmungen) fallen auf "mittag"
  // zurueck, statt still ignoriert zu werden — der Loader ruft
  // setTod(d.tageszeit || "mittag") und darf nie crashen.
  if (!PRESETS[name]) name = "mittag";
  todFrom = schnappschuss();
  todTo = PRESETS[name];
  todName = name;
  todT = instant ? 1 : 0;
  applyTod(todT);
  var btns = document.querySelectorAll("#bar .tod");
  for (var i = 0; i < btns.length; i++) btns[i].classList.toggle("on", btns[i].dataset.t === name);
}

/**
 * Wetterlage setzen. Gleiches Muster wie setTod: der Ist-Zustand wird als
 * Blendquelle eingefroren, danach faehrt wetterT ueber ~1.6 s zum Ziel.
 * Unbekannte Namen fallen tolerant auf "klar" zurueck.
 */
function setWetter(name, instant) {
  if (!WETTER[name]) name = "klar";
  wetterFrom = kopieWetter(wetterMix);
  wetterTo = WETTER[name];
  wetterName = name;
  wetterT = instant ? 1 : 0;
  applyTod(todT);
  if (typeof document !== 'undefined') {
    var sel = document.getElementById("wetterSel");
    if (sel && sel.value !== name) sel.value = name;
  }
}

function getWetterName() { return wetterName; }

/**
 * Faktor auf die Wolkendrift (sky.js). Wird von der Renderschleife auf das dt
 * von updateSky() gelegt — so jagen die Wolken im Sturm, OHNE dass sky.js eine
 * Zeile aendern muesste.
 */
function getWolkenTempo() { return wetterMix.wolkenTempo; }

/** Blende und Wolkenschatten-Drift, von der Renderschleife bedient. */
function tickAtmosphere(raw) {
  var lauf = false;
  if (todT < 1) { todT = Math.min(1, todT + Math.min(0.3, raw) / 1.1); lauf = true; }
  // Wetter blendet bewusst langsamer als die Tageszeit (1.6 s gegen 1.1 s) —
  // ein aufziehendes Unwetter darf nicht schalten, sondern muss aufziehen.
  if (wetterT < 1) { wetterT = Math.min(1, wetterT + Math.min(0.3, raw) / 1.6); lauf = true; }
  if (lauf) applyTod(todT);
  // Die Schattenkamera haengt am Kamerafokus und muss deshalb JEDES Bild
  // nachgezogen werden, nicht nur bei einer laufenden Blende. Der Aufruf ist
  // reine Vektorrechnung (kein Renderzugriff) und kostet nichts Messbares.
  else schattenFitten();
  // Wolkenschatten wandern synchron zur mittleren Wolkenlage — im Sturm
  // schneller, im Schneefall langsamer (derselbe Faktor wie fuer sky.js).
  terraUniforms.uCloudDrift.value.x +=
    CLOUD_DRIFT_MITTEL * raw * 0.006 * wetterMix.wolkenTempo;
  tickWeltleben(Math.min(0.05, raw), performance.now() * 0.001);
}

function initAtmosphere(scene) {
  sceneHook = scene;
  scene.add(sun);
  // Das Ziel MUSS in der Szene haengen: three liest die Lichtrichtung aus
  // target.matrixWorld, und die wird nur fuer Objekte im Graphen aktualisiert.
  scene.add(sun.target);
  scene.add(hemi);
  scene.add(rimLight);
  scene.add(birdMesh);
  scene.add(rauchMesh);
  initWeltleben(scene);
  // Wetterauswahl selbst verdrahten: io.js bedient Biom, Kartengroesse und
  // die Tageszeit-Knoepfe, kennt das Wetter aber nicht. Der Listener sitzt
  // deshalb hier, wo auch die Presets liegen.
  if (typeof document !== 'undefined') {
    var sel = document.getElementById("wetterSel");
    if (sel) {
      sel.value = wetterName;
      sel.addEventListener("change", function () { setWetter(this.value, false); });
    }
  }
}

/* ==========================================================================
   Voegel (F5) und Schornsteinrauch

   F5 — Bewegungsdisziplin, dritter Teil (nach der Windamplitude in wind.js und
   dem Wolkentempo in sky.js): Frueher waren alle fuenf Schwaerme dauerhaft in
   der Luft. In einem Ghibli-Hintergrund steht fast alles still und EINE Sache
   bewegt sich — ein Himmel, ueber den ununterbrochen fuenf Formationen ziehen,
   ist genau das Gegenteil.

   Neu hat jeder Schwarm einen Zustand: ruhend oder fliegend. Ein Schwarm
   startet, wenn (a) seine Ruhezeit abgelaufen ist UND (b) an seiner Stelle
   gerade eine Boee durchgeht — Voegel steigen mit dem Wind auf, und dadurch
   haengt die einzige grosse Bewegung im Bild an derselben Front, die auch das
   Gras und die Kronen bewegt. Das ist der ganze Witz: es sieht nicht nach
   Zufallsgenerator aus, sondern nach Ursache.
   ========================================================================== */
var BIRD_FLOCKS = 5, BIRD_PER = 7, BIRD_N = BIRD_FLOCKS * BIRD_PER;
var birdGeo = (function () {
  var v = [0, 0, 0, -1, 0.4, -0.6, -0.7, 0.02, -0.16,
           0, 0, 0, -0.7, 0.02, 0.16, -1, 0.4, 0.6];
  var g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(v), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(18).fill(0.26), 3));
  g.computeVertexNormals();
  return g;
})();
var birdMesh = new THREE.InstancedMesh(birdGeo,
  new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), BIRD_N);
birdMesh.frustumCulled = false;
birdMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
var flocks = [];
(function () {
  var rng = rngOf(0xb17d5);
  for (var f = 0; f < BIRD_FLOCKS; f++) {
    var mitglieder = [];
    for (var b = 0; b < BIRD_PER; b++) {
      var reihe = Math.floor(b / 2) + 1, seite = (b % 2) ? 1 : -1;
      mitglieder.push({ dx: -reihe * rr(rng, 2.4, 3.4), dz: seite * reihe * rr(rng, 2.2, 3.2),
        dy: rr(rng, -1.5, 1.5), phase: rng() * 6.28, s: rr(rng, 1.1, 1.9) });
    }
    flocks.push({ x: rr(rng, -400, 400), z: rr(rng, -400, 400), y: rr(rng, 55, 150),
      kurs: rng() * 6.28, v: rr(rng, 5, 9), voegel: mitglieder });
  }
  /* F5 — Zustandsfelder. Der Block steht GANZ AM ENDE des Erzeugungsblocks,
     hinter der letzten Ziehung der Schleife oben, und zieht aus `rng` KEINEN
     einzigen Wert mehr: jeder Schwarm bekommt hier seinen EIGENEN Strom
     (rngOf verbraucht nichts, es erzeugt nur einen Generator). Damit ist der
     gemeinsame Strom Ziehung fuer Ziehung derselbe wie vorher — Startpunkte,
     Kurse, Geschwindigkeiten und alle Mitgliederversaetze sind unveraendert.
     Ein Zwischenschieben in die Schleife oben haette dagegen ab dem zweiten
     Schwarm alles verschoben.
     Der eigene Strom je Schwarm ist auch zur Laufzeit das Richtige: Ruhe- und
     Flugzeiten werden gezogen, wenn ein Schwarm landet bzw. startet — aus
     einem gemeinsamen Strom haenge die Zahlenfolge eines Schwarms dann daran,
     in welcher Reihenfolge die anderen vier gerade wechseln. */
  for (var q = 0; q < flocks.length; q++) {
    var fq = flocks[q];
    fq.rng = rngOf((0xb17d5 + Math.imul(q + 1, 0x9e3779b9)) | 0);
    fq.fliegt = false;
    fq.sicht = 0;                 // 0 = unsichtbar (Skalierung 0), 1 = voll da
    fq.frei = -1;                 // "ab wann darf er starten" — erste Setzung: siehe unten
    fq.geduld = 0;
    fq.bis = 0;                   // Landezeit, nur waehrend des Flugs gueltig
  }
})();

/* --- F5: Wann geht eine Boee durch? --------------------------------------
   CPU-Spiegel der Boee aus world/wind.js. Dort steht sie als GLSL in
   terraWind(); wertgetreu portiert sind die beiden Zeilen

     float boee = sin( ( wp.x + wp.z ) * 0.02 - t * 1.9 );
     boee = max( 0.0, boee ) * max( 0.0, sin( ( wp.x - wp.z ) * 0.013 - t * 0.53 ) );

   samt der Quadrierung, mit der terraWind sie danach in die Amplitude nimmt
   (`0.34 * boee * boee`). Es ist DIESELBE Front: erster Faktor die schnelle
   Welle quer ueber die Karte (Periode 2π/1.9 ≈ 3.3 s), zweiter Faktor das
   langsame Fenster (2π/0.53 ≈ 11.9 s), das entscheidet, WO die Front gerade
   ueberhaupt etwas bewegt. Beide sind halbwellengleichgerichtet — zusammen
   ist der Wert nur rund ein Viertel der Zeit ueberhaupt groesser als null.

   Zeitachse ist bewusst windUniforms.uWindZeit und nicht das t der
   Renderschleife: das ist die Uhr, die tickWind() dem Shader gibt (dieselbe
   Sekundenzahl, aber modulo 3600). Nur so gehen Voegel und Grashalme
   garantiert auf dieselbe Boee.

   Die oertliche Verstaerkung kommt aus windVerstaerkung() — genau der
   Funktion, die wind.js als CPU-Spiegel von terraNester() fuehrt. Ein Schwarm
   in einem Windnest (bis 2.70) fliegt also viel eher auf als einer in der
   Ruhezone (0.28..0.46); die Nester sind fuer Gras, Kronen und Voegel
   dieselben. uWindStaerke ist die Wetterachse (Sturm 2.6, Schneefall 0.8) und
   multipliziert wie im Shader rein: im Sturm reisst die Boee die Schwelle
   frueher, die Schwaerme starten also dichter am Ende ihrer Ruhezeit. Auf die
   Flugquote schlaegt das nur schwach durch (gemessen 22 % -> 23 %), weil die
   Ruhezeit den Takt vorgibt — der Himmel soll im Sturm nicht voller Voegel
   haengen, die Starts sollen nur praeziser auf dem Wind sitzen.

   Bewusst NICHT uebernommen ist der Amplitudenfaktor 0.34 (AMP_BOEE in
   wind.js): er ist ein reiner Darstellungsmassstab fuer die Vertexauslenkung
   und wuerde die Schwelle hier nur um denselben Faktor mitverschieben — waere
   er kopiert, muesste jede Feinjustierung der Halmbewegung in wind.js die
   Vogelschwelle nachziehen. Der Wert unten ist deshalb der reine Boeenanteil
   (0 .. ~2.70 in einem Nest bei klarem Wetter). */
function boeeWert(x, z) {
  var t = windUniforms.uWindZeit.value;
  var b = Math.sin((x + z) * 0.02 - t * 1.9);
  b = Math.max(0, b) * Math.max(0, Math.sin((x - z) * 0.013 - t * 0.53));
  return b * b * windVerstaerkung(x, z) * windUniforms.uWindStaerke.value;
}

/* Schwelle und Zeiten. Gemessen ueber 30 Minuten Modellzeit (Pruefskript, der
   Bericht nennt die Zahlen): Flugquote 22 %, im Mittel 1.1 von 5 Schwaermen
   gleichzeitig in der Luft, in 32 % der Zeit gar keiner (laengste Stille
   50 s). Genau das, was F5 verlangt — meistens ein einziger Zug am Himmel,
   oft keiner.
   Die Boee bestimmt dabei den ZEITPUNKT, nicht die Haeufigkeit: die
   Wartezeit auf die naechste Boee liegt im Median bei 6.5 s gegen 40-110 s
   Ruhe. Genau so soll es sein — der Start soll nach Wind aussehen, aber der
   Himmel soll nicht bei jedem Windstoss voll Voegel sein.                  */
var VOEGEL_SCHWELLE = 0.22;      // Boeenwert, ab dem ein Schwarm auffliegt
var VOEGEL_RUHE0 = 40, VOEGEL_RUHE1 = 110;   // Sekunden Ruhe nach der Landung
var VOEGEL_FLUG0 = 14, VOEGEL_FLUG1 = 30;    // Sekunden in der Luft
/* Anteil der Schwaerme, die beim ersten Bild schon in der Luft sind. Ohne ihn
   waere der Himmel nach dem Laden erst einmal eine halbe Minute voellig leer
   — ein schlechter erster Eindruck fuer eine Kleinigkeit, die Leben zeigen
   soll. Der Wert entspricht der gemessenen Flugquote, der Anfangszustand ist
   also bereits der eingeschwungene. */
var VOEGEL_START = 0.25;
/* Geduld: sitzt ein Schwarm in einer Ruhezone des Nestfeldes, kann die Boee
   dort dauerhaft unter der Schwelle bleiben (Verstaerkung faellt bis 0.28) —
   ohne Deckel bliebe er fuer immer am Boden. Nach so vielen Sekunden startet
   er auch ohne Boee. */
var VOEGEL_GEDULD = 25;
var VOEGEL_BLENDE = 1.1;         // Sekunden fuer das Ein- und Ausblenden

/**
 * Zustandsmaschine eines Schwarms. Setzt fl.fliegt und fuehrt fl.sicht (die
 * geblendete Sichtbarkeit) nach. Alle Zufallswerte kommen aus fl.rng.
 */
function voegelZustand(fl, dt, t) {
  // Erste Setzung erst hier, nicht im Erzeugungsblock: `t` ist die Uhr der
  // Renderschleife (Sekunden seit Seitenstart) und beim Modulstart noch
  // unbekannt. Der Versatz zieht die fuenf Schwaerme auseinander — sonst
  // liefe ihre erste Ruhezeit gleichzeitig ab.
  if (fl.frei < 0) {
    if (fl.rng() < VOEGEL_START) {
      fl.fliegt = true;
      fl.bis = t + rr(fl.rng, 1, VOEGEL_FLUG1);      // mitten im Flug einsteigen
      fl.frei = t;
    } else {
      fl.frei = t + rr(fl.rng, 0, VOEGEL_RUHE1);
    }
    fl.geduld = fl.frei + VOEGEL_GEDULD;
  }
  if (fl.fliegt) {
    if (t >= fl.bis) {
      fl.fliegt = false;
      fl.frei = t + rr(fl.rng, VOEGEL_RUHE0, VOEGEL_RUHE1);
      fl.geduld = fl.frei + VOEGEL_GEDULD;
    }
  } else if (t >= fl.frei &&
             (t >= fl.geduld || boeeWert(fl.x, fl.z) >= VOEGEL_SCHWELLE)) {
    fl.fliegt = true;
    fl.bis = t + rr(fl.rng, VOEGEL_FLUG0, VOEGEL_FLUG1);
  }
  // Blende statt Sprung: sieben Voegel, die aus dem Nichts erscheinen, sind
  // genau die Art von Ruck, die F5 vermeiden will. Lineare Rampe, sie
  // erreicht 0 und 1 exakt.
  var ziel = fl.fliegt ? 1 : 0, schritt = dt / VOEGEL_BLENDE;
  fl.sicht += clamp(ziel - fl.sicht, -schritt, schritt);
}

var _birdObj = new THREE.Object3D();
_birdObj.rotation.order = "YXZ";
function updateBirds(dt, t) {
  var i = 0;
  for (var f = 0; f < flocks.length; f++) {
    var fl = flocks[f];
    voegelZustand(fl, dt, t);
    /* Umlauf um den Kamerafokus. Steht jetzt VOR der Ruhe-Abkuerzung und
       laeuft als `while` statt als `if`: ein ruhender Schwarm bewegt sich
       nicht mehr, die Kamera aber schon — nach einer langen Ruhe und einer
       weiten Fahrt kann der Versatz ein Vielfaches von 1120 betragen, und ein
       einzelner Sprung holte ihn nicht mehr zurueck. Fuer einen fliegenden
       Schwarm ist die Schleife wortgleich zum bisherigen `if`: er entfernt
       sich je Bild nur um v*dt, die Bedingung greift also hoechstens einmal. */
    while (fl.x - cam.focus.x > 560) fl.x -= 1120;
    while (fl.x - cam.focus.x < -560) fl.x += 1120;
    while (fl.z - cam.focus.z > 560) fl.z -= 1120;
    while (fl.z - cam.focus.z < -560) fl.z += 1120;
    if (fl.sicht <= 0) {
      /* Ruhend: die sieben Instanzen bekommen eine Matrix mit Skalierung 0
         (entartete Dreiecke, in der Rasterung nicht vorhanden). Bewusst KEIN
         Umsortieren und kein Herunterzaehlen von birdMesh.count — Index i
         laeuft weiter wie immer, jeder Schwarm behaelt seinen festen
         Instanzblock. Sonst muesste die Zuordnung Schwarm -> Instanz bei
         jedem Wechsel neu geschrieben werden, und das ist genau die Art
         Buchhaltung, die spaeter still danebenliegt. */
      for (var rb = 0; rb < fl.voegel.length; rb++, i++) {
        _birdObj.position.set(fl.x, fl.y, fl.z);
        _birdObj.rotation.set(0, -fl.kurs, 0, "YXZ");
        _birdObj.scale.setScalar(0);
        _birdObj.updateMatrix();
        birdMesh.setMatrixAt(i, _birdObj.matrix);
      }
      continue;
    }
    fl.kurs += Math.sin(t * 0.13 + f) * 0.09 * dt;
    fl.x += Math.cos(fl.kurs) * fl.v * dt;
    fl.z += Math.sin(fl.kurs) * fl.v * dt;
    var ck = Math.cos(fl.kurs), sk = Math.sin(fl.kurs);
    for (var b = 0; b < fl.voegel.length; b++, i++) {
      var v = fl.voegel[b];
      var flap = Math.sin(t * 5.5 + v.phase);
      _birdObj.position.set(
        fl.x + v.dx * ck - v.dz * sk,
        fl.y + v.dy + flap * 0.5,
        fl.z + v.dx * sk + v.dz * ck);
      _birdObj.rotation.set(0, -fl.kurs, flap * 0.35, "YXZ");
      // Die Blende sitzt in der Skalierung, nicht in der Deckkraft: das
      // Material ist undurchsichtig und wird von allen Voegeln geteilt.
      _birdObj.scale.setScalar(v.s * fl.sicht);
      _birdObj.updateMatrix();
      birdMesh.setMatrixAt(i, _birdObj.matrix);
    }
  }
  birdMesh.instanceMatrix.needsUpdate = true;
}


var RAUCH_MAX = 90, RAUCH_PUFF = 4;
var rauchGeo = new THREE.PlaneGeometry(2, 2);
rauchGeo.setAttribute("color", new THREE.BufferAttribute(
  new Float32Array(rauchGeo.attributes.position.count * 3).fill(1), 3));
var rauchMesh = new THREE.InstancedMesh(rauchGeo,
  new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.3,
    depthWrite: false, map: TEX.rauchPuff }), RAUCH_MAX * RAUCH_PUFF);
rauchMesh.frustumCulled = false;
rauchMesh.renderOrder = 3;
rauchMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
rauchMesh.instanceColor = new THREE.InstancedBufferAttribute(
  new Float32Array(RAUCH_MAX * RAUCH_PUFF * 3).fill(1), 3);
rauchMesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
rauchMesh.count = 0;
var rauchPunkte = [];
var _rauchObj = new THREE.Object3D(), _rauchCol = new THREE.Color();
var C_RAUCH = new THREE.Color(0xf2eee6);
function updateRauch(t) {
  var n = Math.min(RAUCH_MAX, rauchPunkte.length / 3), k = 0;
  for (var i = 0; i < n; i++) {
    var x = rauchPunkte[i * 3], y = rauchPunkte[i * 3 + 1], z = rauchPunkte[i * 3 + 2];
    for (var q = 0; q < RAUCH_PUFF; q++) {
      var ph = ((t * 0.16 + q / RAUCH_PUFF + i * 0.37) % 1);
      var drift = ph * ph * 5;
      _rauchObj.position.set(x + drift * 0.9 + Math.sin(t * 0.5 + i) * 0.5,
        y + ph * 11, z + drift * 0.45);
      // oben breiter und durchsichtiger; Billboard zur Kamera gedreht
      var sc = (0.3 + ph * 2.3);
      _rauchObj.scale.set(sc, sc * 0.85, sc);
      _rauchObj.rotation.set(0, Math.atan2(camera.position.x - _rauchObj.position.x,
        camera.position.z - _rauchObj.position.z), 0);
      _rauchObj.updateMatrix();
      rauchMesh.setMatrixAt(k, _rauchObj.matrix);
      _rauchCol.copy(C_RAUCH).lerp(fogMittel, 0.15 + ph * 0.85);
      rauchMesh.setColorAt(k, _rauchCol);
      k++;
    }
  }
  rauchMesh.count = k;
  rauchMesh.instanceMatrix.needsUpdate = true;
  if (rauchMesh.instanceColor) rauchMesh.instanceColor.needsUpdate = true;
}


/** Rauchquellen kommen aus dem Dirty-Flush der Pools. */
function setRauchQuellen(punkte) {
  rauchPunkte.length = 0;
  for (var i = 0; i < punkte.length; i++) rauchPunkte.push(punkte[i]);
}

/* birdMesh und boeeWert sind fuer Pruefskripte und Debug exportiert (Muster
   wie vfxMesh in world/vfx.js): am Instanzblock eines Schwarms laesst sich von
   aussen ablesen, ob er gerade ruht (Skalierung 0) — die Flugquote aus dem
   F5-Bericht ist genau so gemessen. Die Renderschleife braucht beides nicht. */
export { PRESETS, WETTER, setTod, getTodName, setWetter, getWetterName,
  getWolkenTempo, applyTod, tickAtmosphere, initAtmosphere,
  updateBirds, updateRauch, setRauchQuellen, sun, hemi, rimLight, fogMittel,
  birdMesh, boeeWert, BIRD_FLOCKS, BIRD_PER,
  // Nachtrag: Nebelfreigabe auf Kartenmaßstab — exportiert fuer Pruefung 19.
  nebelDaempfung, NEBEL_KARTE_AB, NEBEL_KARTE_VOLL, NEBEL_KARTE_WEIT };
