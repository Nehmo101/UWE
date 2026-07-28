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

/* ==========================================================================
   Tageszeit-Presets. Jedes definiert die komplette Stimmung: Sonne,
   Hemisphaere, Gegenlicht, beide Nebelfarben samt Distanzen und Deckel,
   Himmelsverlauf mit fuenf Stuetzstellen, Wolkenfarben, Wolkenschatten,
   Kontaktschatten, Belichtung, Bloom und Farbgraduierung.
   ========================================================================== */
var PRESETS = {
  morgen: {
    sonneDir: [-0.80, 0.26, 0.50], sonne: 0xffd2a0, sonneStk: 2.4,
    hemiHimmel: 0xc6d9ec, hemiBoden: 0xbfae94, hemiStk: 0.85,
    gegen: 0x9db8d8, gegenStk: 0.28,
    fogWarm: 0xf8e2bc, fogCool: 0xc2d2e2, fogNah: 195, fogFern: 860, fogCap: 1.0,
    himmel: [0x6d9cc8, 0x93b9dc, 0xbcd3e6, 0xf0e3cd, 0xf9eeda],
    scheibe: 0xffe8c8, scheibeGr: 170, gegenGlow: 0xd8e2ee,
    wolkeOben: 0xfff4e4, wolkeUnten: 0xb9c2d2, wolkeRand: 0xffe2b8, wolkeFern: 0xdfe6ec,
    wolkeDeck: 0.82, wolkenschatten: 0.16, fenster: 1.1,
    schatten: 0.34, wasser: 0x4a95ab, welt: 0xf4f2ee, bounce: 0xd8cebc,
    // G1: Rankenglut tags dezent warm-grau (entspricht dem bisherigen Look),
    // sterne 0 — kein Sternenfeld am Tag.
    rankenGlut: 0.3, rankenGlutFarbe: 0x4a463e, sterne: 0,
    // H3: Arbor spendet der Welt Licht. Morgens traegt das Tageslicht schon,
    // die Ranke bleibt aber ein schwacher Nahlicht-Sockel.
    arborLicht: 0.15, arborFarbe: 0xdfe8f0,
    strahlen: 0.35,
    // F1-Startwert (Feinkalibrierung: F4): aufgehelltes, kuehles Morgenblau —
    // Hue ~20° blauwaerts gegenueber bounce, hell genug fuer den 15-%-Sockel.
    schattenKuehl: 0x96a8c8,
    belichtung: 0.98,
    // Kalibrierkorridor (F4): Landschaftsmassen S 0.25–0.50, Werteumfang
    // 0.20–0.85, reines Weiss nur Wolkenlichtern vorbehalten. Bloomschwelle
    // >= 1.0: nur echte Lichter bluehen. satMitte 1.2 → 1.15: "Mitten rauf"
    // gilt, aber 1.2 trieb die Wiesen an den oberen S-Rand (~0.5);
    // satLicht < 1 (Lichter entsaettigen) bleibt unveraendert.
    bloom: { staerke: 0.22, radius: 0.7, schwelle: 1.0 },
    grade: { lift: [0.014, 0.022, 0.040], gamma: [1.0, 1.0, 1.0], gain: [1.06, 1.02, 0.95],
      satMitte: 1.15, satLicht: 0.94, schwarz: 0.028, vignette: 0.10 }
  },
  mittag: {
    sonneDir: [0.45, 0.75, 0.35], sonne: 0xfff2dc, sonneStk: 2.6,
    hemiHimmel: 0xbfd8ee, hemiBoden: 0xcbb896, hemiStk: 0.9,
    gegen: 0xa8c8e8, gegenStk: 0.32,
    fogWarm: 0xf2e8d4, fogCool: 0xc8d8e4, fogNah: 240, fogFern: 980, fogCap: 1.0,
    himmel: [0x4f92cf, 0x77aede, 0xa8cbe8, 0xe6ecdf, 0xf6f1e3],
    scheibe: 0xfff8ec, scheibeGr: 120, gegenGlow: 0xd2e0ea,
    wolkeOben: 0xffffff, wolkeUnten: 0xb6c4d4, wolkeRand: 0xfff2da, wolkeFern: 0xd8e4ee,
    wolkeDeck: 0.78, wolkenschatten: 0.25, fenster: 0.0,
    schatten: 0.45, wasser: 0x3f93ad, welt: 0xffffff, bounce: 0xe0d8c0,
    // G1: mittags die schwaechste Glut — hartes Licht schluckt das Leuchten.
    rankenGlut: 0.25, rankenGlutFarbe: 0x4a463e, sterne: 0,
    // H3: mittags aus — hartes Sonnenlicht laesst kein Rankenlicht zu.
    arborLicht: 0.0, arborFarbe: 0xdfe8f0,
    strahlen: 0.12,
    // F1-Startwert (Feinkalibrierung: F4): neutrales Himmelblau — mittags
    // kommt die Schattenfuellung vom blauen Himmel, nicht von warmem Bounce.
    schattenKuehl: 0x8ea6c4,
    belichtung: 0.98,
    // Kalibrierkorridor (F4): Landschaftsmassen S 0.25–0.50, Werteumfang
    // 0.20–0.85. Hoechste Bloomschwelle des Tages (1.05) — hartes Mittags-
    // licht soll zeichnen, nicht leuchten. satMitte 1.22 → 1.15: grenzwertig
    // hoch, die hellste Stimmung braucht die wenigste Nachsaettigung;
    // satLicht < 1 bleibt.
    bloom: { staerke: 0.18, radius: 0.7, schwelle: 1.05 },
    grade: { lift: [0.010, 0.016, 0.028], gamma: [1.0, 1.0, 1.0], gain: [1.05, 1.03, 0.97],
      satMitte: 1.15, satLicht: 0.95, schwarz: 0.024, vignette: 0.10 }
  },
  abend: {
    // Die staerkste Stimmung: dunkle Silhouetten gegen warmen Himmel, kuehle
    // Schatten gegen warmes Licht. Der Nebel staffelt, statt zu ueberdecken.
    sonneDir: [-0.95, 0.10, -0.26], sonne: 0xff9a4e, sonneStk: 2.5,
    hemiHimmel: 0x55639c, hemiBoden: 0x4c4238, hemiStk: 0.34,
    gegen: 0x7a86b8, gegenStk: 0.42,
    fogWarm: 0xf6b070, fogCool: 0x757ea6, fogNah: 260, fogFern: 1150, fogCap: 1.0,
    himmel: [0x252a55, 0x4a4a7c, 0x8d6a90, 0xf0a860, 0xffd9a0],
    scheibe: 0xffc078, scheibeGr: 260, gegenGlow: 0x8d94c2,
    wolkeOben: 0xf6c294, wolkeUnten: 0x6e6f96, wolkeRand: 0xffb060, wolkeFern: 0x9a8aa2,
    wolkeDeck: 0.85, wolkenschatten: 0.06, fenster: 2.6,
    schatten: 0.4, wasser: 0x46567c, welt: 0xe8d2c0, bounce: 0x9a8ca0,
    // G1: in der Daemmerung beginnt die Ranke zu leuchten; sterne 0.15 —
    // die ersten Sterne stehen schon am Abendhimmel.
    rankenGlut: 0.55, rankenGlutFarbe: 0x4a463e, sterne: 0.15,
    // H3: in der Daemmerung uebernimmt Arbor spuerbar — kuehles Weiss gegen
    // das orange Restlicht, der staerkste Kalt-Warm-Kontrast des Tages.
    arborLicht: 0.35, arborFarbe: 0xd8e6ee,
    strahlen: 0.5,
    // F1-Startwert (Feinkalibrierung: F4): kaeltestes und dunkelstes Blau der
    // vier Stimmungen — der Abend lebt vom maximalen Kalt-Warm-Kontrast
    // zwischen orangem Licht und blauvioletten Schatten.
    schattenKuehl: 0x5a628e,
    belichtung: 0.94,
    // Kalibrierkorridor (F4): das Abendrot behaelt den groessten Tonwert-
    // umfang (dunkelste Silhouetten gegen den hellsten Himmel), deshalb
    // niedrigster lift-Sockel und die einzige Schwelle unter 1.0 (0.92 — ok,
    // bleibt ueber der ~0.9-Untergrenze). satMitte 1.05 bleibt: der Kontrast
    // kommt hier aus Kalt-Warm, nicht aus Saettigung; satLicht 0.9 bleibt.
    bloom: { staerke: 0.34, radius: 0.75, schwelle: 0.92 },
    grade: { lift: [0.012, 0.020, 0.050], gamma: [0.90, 0.90, 0.95], gain: [1.10, 1.0, 0.88],
      satMitte: 1.05, satLicht: 0.9, schwarz: 0.02, vignette: 0.12 }
  },
  nebel: {
    // Kontrast reduziert, aber das Motiv bleibt lesbar: halbe Dichte und ein
    // Deckel, unter den nahe Objekte nicht fallen.
    sonneDir: [0.20, 0.92, 0.22], sonne: 0xf2f2ea, sonneStk: 0.9,
    hemiHimmel: 0xe0e8ea, hemiBoden: 0xcfcabc, hemiStk: 1.1,
    gegen: 0xdfe4e4, gegenStk: 0.12,
    fogWarm: 0xeceada, fogCool: 0xdde4e2, fogNah: 110, fogFern: 880, fogCap: 0.86,
    himmel: [0xb9c6cc, 0xc9d4d6, 0xd9e0de, 0xe8ebe4, 0xf0f1ea],
    scheibe: 0xf6f4ea, scheibeGr: 90, gegenGlow: 0xe4e8e4,
    wolkeOben: 0xf2f4f0, wolkeUnten: 0xd4dad8, wolkeRand: 0xf0eee2, wolkeFern: 0xe2e7e2,
    wolkeDeck: 0.5, wolkenschatten: 0.0, fenster: 1.6,
    schatten: 0.15, wasser: 0xa6bcbb, welt: 0xf4f6f2, bounce: 0xdcd8cc,
    // G1: im Nebel traegt die Glut ein Stueck weiter als am klaren Tag.
    rankenGlut: 0.4, rankenGlutFarbe: 0x4a463e, sterne: 0,
    // H3: im Dunst traegt das Rankenlicht weiter als am klaren Tag, bleibt
    // aber schwach — der Nebelanteil (Lichtsaeule) macht hier die Wirkung.
    arborLicht: 0.15, arborFarbe: 0xe2eced,
    strahlen: 0.25,
    // F1-Startwert (Feinkalibrierung: F4): fast neutral, kaum blaeuer als das
    // Umgebungslicht — Nebel frisst Farbkontrast, kuehle Schatten wuerden
    // hier kuenstlich wirken.
    schattenKuehl: 0xaeb8bc,
    belichtung: 1.05,
    // Kalibrierkorridor (F4): bewusst engster Werteumfang, aber lesbar —
    // fogCap 0.86 deckelt den Nebelfaktor, nahe Objekte behalten Zeichnung.
    // satMitte/satLicht < 1 druecken die Saettigung insgesamt (einzige
    // Stimmung, in der das erlaubt ist); hoechste Bloomschwelle 1.1, damit
    // das flache Licht nirgends blueht. Werte bleiben.
    bloom: { staerke: 0.10, radius: 0.6, schwelle: 1.1 },
    grade: { lift: [0.030, 0.034, 0.040], gamma: [1.0, 1.0, 1.0], gain: [1.0, 1.0, 1.0],
      satMitte: 0.85, satLicht: 0.8, schwarz: 0.05, vignette: 0.08 }
  },
  nacht: {
    // G1 — Mondnacht nach den Konzeptbildern: tiefdunkelblauer Himmel mit
    // Sternen, die weissen Ranken SELBSTLEUCHTEND als hellster Wert im Bild,
    // warmes Fensterglühen der Staedtchen als Gegenpol, Landschaft gedaempft
    // und kuehl, Nebel kuehl und duenn. Alle Werte sind kalibrierbare
    // Richtwerte. Die "Sonne" ist hier der Mond: kuehl, schwach, schraeg.
    sonneDir: [-0.55, 0.52, -0.42], sonne: 0xb8c8e8, sonneStk: 0.55,
    hemiHimmel: 0x2a3454, hemiBoden: 0x1c1c28, hemiStk: 0.5,
    gegen: 0x36406a, gegenStk: 0.22,
    // fogWarm kaum warm — der Mond liefert kein warmes Streulicht; die
    // Nebelachse bleibt kuehl-in-kuehl, nur minimal aufgehellt zum Mond hin.
    fogWarm: 0x4a5680, fogCool: 0x252c48, fogNah: 220, fogFern: 1050, fogCap: 0.95,
    himmel: [0x0a1026, 0x141c3a, 0x1e2a52, 0x2c3a66, 0x38466e],
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
    belichtung: 0.9,
    // Bewusste Ausnahme der ~0.9-Schwellen-Regel: schwelle 0.85 — die Glut
    // (Ranken, Fenster, Mond) DARF nachts bluehen; die gedaempfte Landschaft
    // liegt weit unter der Schwelle und bleibt davon unberuehrt.
    bloom: { staerke: 0.5, radius: 0.8, schwelle: 0.85 },
    // lift-Sockel ~0.03: die Nacht faellt nie auf reines Schwarz — Schatten
    // behalten Zeichnung (keine einfarbigen Flaechen), Sockel leicht blau.
    grade: { lift: [0.028, 0.030, 0.038], gamma: [1.0, 1.0, 1.04], gain: [0.92, 0.96, 1.06],
      satMitte: 1.0, satLicht: 0.85, schwarz: 0.03, vignette: 0.16 }
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
     schatten        Faktor auf die Kontaktschatten-Deckkraft
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
    sonne: 1.00, hemi: 1.00, schatten: 1.00, wind: 1.00,
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
    sonne: 0.78, hemi: 1.12, schatten: 0.72, wind: 1.15,
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
    sonne: 0.50, hemi: 1.05, schatten: 0.45, wind: 1.35,
    belichtung: 0.95, gain: 0.90, sat: 0.78, vignette: 0.06, bloom: 0.70,
    vfxTyp: "regen", vfxDichte: 1.0, vfxBiom: 0.00
  },
  schneefall: {
    // Heller als Regen (Schnee streut Licht zurueck), aber genauso kurzsichtig.
    label: "Schneefall",
    wolkeDeck: 1.40, wolkeGrau: 0.55, wolkeDunkel: 0.94,
    wolkenschatten: 0.40, wolkenTempo: 0.90,
    fogNah: 0.50, fogFern: 0.60, fogCap: 0.95, fogTint: [1.01, 1.01, 1.03],
    sonne: 0.60, hemi: 1.20, schatten: 0.50, wind: 0.80,
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
    sonne: 0.42, hemi: 0.95, schatten: 0.35, wind: 2.60,
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
  sun.position.copy(_dir).multiplyScalar(600);
  mixHex(a.sonne, b.sonne, e, sun.color);
  sun.intensity = mixNum(a.sonneStk, b.sonneStk, e) * W.sonne;
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
  mixHex(a.bounce, b.bounce, e, terraUniforms.uBounce.value);
  // F1: kuehle Schattenfarbe blendet wie alle Farbfelder weich mit
  mixHex(a.schattenKuehl, b.schattenKuehl, e, terraUniforms.uSchattenKuehl.value);
  fogMittel.copy(terraUniforms.uFogWarm.value).lerp(terraUniforms.uFogCool.value, 0.5);
  if (sceneHook && sceneHook.fog) {
    sceneHook.fog.color.copy(fogMittel);
    sceneHook.fog.near = mixNum(a.fogNah, b.fogNah, e);
    sceneHook.fog.far = mixNum(a.fogFern, b.fogFern, e);
  }
  terraUniforms.uCloudAmt.value = mixNum(a.wolkenschatten, b.wolkenschatten, e) * W.wolkenschatten;
  // Fensterglut: warme Emission bei Abendrot, Morgen, Nebel und (am
  // staerksten) in der Nacht
  var glut = mixNum(a.fenster === undefined ? 0 : a.fenster,
    b.fenster === undefined ? 0 : b.fenster, e);
  if (POOLS.fensterlicht && POOLS.fensterlicht.mat) POOLS.fensterlicht.mat.emissiveIntensity = glut;

  // Himmel mit fuenf Stuetzstellen
  var h = [];
  for (var i = 0; i < 5; i++) h.push(mixHex(a.himmel[i], b.himmel[i], e, _col).getHex());
  paintSky(h[0], h[1], h[2], h[3], h[4]);
  setSonnenDir(_dir);
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
  schattenMat.opacity = mixNum(a.schatten, b.schatten, e) * W.schatten;
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
      schwarz: mixNum(a.grade.schwarz, b.grade.schwarz, e),
      vignette: mixNum(a.grade.vignette, b.grade.vignette, e) + W.vignette },
    horizont: fogMittel,
    // C1: Godrays. Der Wert je Tageszeit steuert die Staerke, die
    // Sonnenrichtung liefert den Ursprung im Bildraum. Nachts 0 —
    // dann strahlen die Ranken statt der Sonne (Kanon).
    strahlen: mixNum(a.strahlen === undefined ? 0 : a.strahlen,
      b.strahlen === undefined ? 0 : b.strahlen, e) * (W.strahlen === undefined ? 1 : W.strahlen),
    sonneDir: _dir
  });

  wetterVfxSetzen(wE);
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
   'schattenKuehl','rankenGlutFarbe','arborFarbe'].forEach(function (k) {
    s[k] = mixHex(a[k], b[k], e, _col).getHex();
  });
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
  // Wolkenschatten wandern synchron zur mittleren Wolkenlage — im Sturm
  // schneller, im Schneefall langsamer (derselbe Faktor wie fuer sky.js).
  terraUniforms.uCloudDrift.value.x +=
    CLOUD_DRIFT_MITTEL * raw * 0.006 * wetterMix.wolkenTempo;
}

function initAtmosphere(scene) {
  sceneHook = scene;
  scene.add(sun);
  scene.add(hemi);
  scene.add(rimLight);
  scene.add(birdMesh);
  scene.add(rauchMesh);
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
