import * as THREE from 'three';
// Weltkonstanten und der explizite globale Zustand (statt loser Globals).

/* ==========================================================================
   Kartengroesse (H1b) — frueher drei `const`-Exporte, jetzt Laufzeitwerte.

   Warum das keinen Importeur bricht: ES-Module exportieren `let`-Variablen
   als LEBENDE Bindungen. Wer `import { HALF } from '../core/store.js'`
   schreibt, liest bei JEDEM Zugriff den aktuellen Wert — Zuweisungen finden
   ausschliesslich hier in setKartenGroesse() statt. Geprueft wurden alle
   Importeure (camera.js, pointer.js, objects.js, dirty.js, main.js, io.js,
   terrain.js): nur io.js kopierte den Wert beim Laden in eine eigene
   Konstante (CAM_FOCUS_MAX) — dort nachgezogen. Neue Regel fuer alle Module:
   MAP/VW/HALF/MAX_INST_PER_EL NIE beim Modulstart in eine eigene Variable
   kopieren, sondern in der Funktion lesen (oder KARTE.* verwenden).

   KARTE ist derselbe Zustand als benanntes Objekt — praktisch fuer Module,
   die die Groesse als Ganzes brauchen (pools.js Huellkugel, water.js Ebene).
   KARTE und MAP/VW/HALF sind immer synchron; setKartenGroesse ist die
   einzige Stelle, die beides schreibt.
   ========================================================================== */
export const KARTEN_GROESSEN = [256, 512, 1024];   // erlaubte Kantenlaengen
export const KARTE = { map: 256, vw: 257, half: 128 };
export let MAP = 256;                    // Kacheln pro Achse
export let VW = MAP + 1;                 // Vertices pro Achse
export let HALF = MAP / 2;
export const WATER = 0;                  // Wasserspiegel
export const VINE_R = 6;                 // globaler Rankenradius am Fuss - Massstabsanker
export const COS40 = Math.cos(40 * Math.PI / 180);

/* H1d — Instanz-Budget flaechenproportional. 24000 war auf die 256er-Karte
   kalibriert; eine viermal so grosse Flaeche braucht viermal so viele
   Instanzen, sonst wird eine grosse Wiese duenner statt groesser. Quadratisch
   mit der Kantenlaenge, aber gedeckelt: jenseits von ~96k Instanzen JE
   ELEMENT dominiert das Umpacken in pools.repack() (12 Zahlen je Instanz im
   JS-Array plus Matrix-Upload) alles andere — der Deckel ist ein
   Reissleinen-Wert, kein Gestaltungsmittel. 256 -> 24000 (unveraendert),
   512 -> 96000, 1024 -> ebenfalls 96000 (gedeckelt). */
const MAX_INST_DECKEL = 96000;
function instanzBudget(map) {
  return Math.min(MAX_INST_DECKEL, Math.round(24000 * (map * map) / (256 * 256)));
}
export let MAX_INST_PER_EL = instanzBudget(KARTE.map);   // Sicherheitsnetz je Element

/**
 * Setzt die Kartengroesse (256/512/1024). Aendert AUSSCHLIESSLICH die
 * Zahlenwerte — die abhaengigen Geometrien (Terrain-Patches, Huellkugeln der
 * Pools, Wasserebene/Meeresboden) zieht der Aufrufer nach, weil store.js
 * bewusst keine Abhaengigkeit auf world/ und render/ hat. Reihenfolge siehe
 * editor/io.js (setzeKartenGroesse).
 */
export function setKartenGroesse(n) {
  n = n | 0;
  if (KARTEN_GROESSEN.indexOf(n) < 0) n = 256;
  KARTE.map = n; KARTE.vw = n + 1; KARTE.half = n / 2;
  MAP = KARTE.map; VW = KARTE.vw; HALF = KARTE.half;
  MAX_INST_PER_EL = instanzBudget(n);
  return n;
}

/** Zentraler Zustand: Elemente, Seed, Raster, Biom. */
export const S = {
  worldSeed: 1337,
  elements: [],
  nextId: 1,
  elementSeedCounter: 0x1234,
  snap: false,
  biom: "wiese",
  // J3: Sprachfamilie der Karte fuer den Namensgenerator. "auto" = aus dem
  // Biom/Baustil abgeleitet; ein fester Wert praegt die ganze Karte.
  sprachfamilie: "auto",
  /* D1 — Marker sind BEWUSST kein Elementtyp. Ein Element ist Weltgeometrie
     (Punkte + Parameter + Seed -> Instanzen, Terrainwirkung, Korridore); ein
     Marker ist eine Notiz an einer Koordinate und erzeugt nichts davon. Als
     Element muesste er durch genElement/isHeavy/rebuildAll laufen, in den
     Instanzpools auftauchen und beim PNG-Export einzeln ausgeblendet werden.
     Deshalb eine eigene, flache Liste: [{x, z, text, art}].
     Nicht Teil der Undo-Historie (history.js sichert nur Elemente + Hoehen) —
     siehe Bericht. */
  marker: [],
  /* A3 — Stempelbibliothek: [{name, anker:{x,z}, elemente:[...]}]. Liegt
     parallel zu den Elementen, weil ein Stempel eine VORLAGE ist und keine
     Weltgeometrie. Dieselbe Liste dient als localStorage-Bibliothek (tools.js)
     und als optionales Kartenfeld `stempel` (io.js). */
  stempel: []
};

/* ==========================================================================
   Biom-Registry (G5). Ein Eintrag je Biom mit drei Bloecken:

   terrain — komplette Palette + Schwellen fuer terrainColor (world/terrain.js).
     Der Eintrag "wiese" enthaelt EXAKT die bisherigen Farbkonstanten und
     Schwellwerte aus terrain.js; der Default-Pfad bleibt dadurch
     byteidentisch zur alten Faerbung. Schluessel:
       grasKuehl/grasWarm/grasTrocken  drei Grundtoene der Flaeche
       erde, fels, schnee, sand        Zonenfarben (Hoehe/Hang)
       seegrund, tiefe, tritt, brandung
       driftGelb/driftBlau             F2-Farbdrift-Pole
       sandA/sandB, felsA/felsB, schneeA/schneeB   sstep-Kanten der Zonen
       saumSand/saumFels/saumSchnee    Zentren des dunklen Grenzsaums
       oase (0..1) + oaseFarbe         Senkenfarbe unter h ~2.4. Die Logik ist
                   farbneutral: sie zieht die Senken auf oaseFarbe zu. Der
                   Katalog nutzt sie deshalb sowohl "gruener" (wueste, steppe)
                   als auch invertiert "nasser/dunkler" (moor #574c33),
                   "gluehend" (vulkan), "kuehl leuchtend" (pilzwald) und
                   "Korallengarten" (korallenbank) — ohne Codeaenderung.
       brandungA/brandungB/brandungStaerke   OPTIONAL. Ersetzen die frueher
                   fest verdrahteten Werte 0.8 / 0.3 / 0.5 des Brandungssaums.
                   Fehlen sie, setzt terrainColor genau diese Standardwerte
                   ein — der wiese-Pfad bleibt dadurch byteidentisch.

   veg — Multiplikatoren fuer die Bestueckung (generators/areas.js):
       dichte      Annahme-Wahrscheinlichkeit je Kandidat (1 = alles wie bisher).
                   Wirkt NUR nach unten; >1 ist wirkungslos.
       abstand     OPTIONAL. Faktor auf das Ergebnis von safeSpacing in
                   genWald/genWiese. Werte < 1 verdichten (die einzige
                   Moeglichkeit, dichter als der Bestand zu werden), > 1
                   lichten auf. Fehlt das Feld (oder ist es 1), wird gar keine
                   Multiplikation ausgefuehrt — byteidentisch.
       blumen      Faktor auf p.blumen in genWiese
       unterwuchs  Faktor auf die Unterholz-Wahrscheinlichkeit in genWald
       arten       Behalte-Wahrscheinlichkeit je Baumart (fehlende Art = 1);
                   null = keine Umgewichtung
       ersatz      Baumart, die abgelehnte Kandidaten ortsstabil ersetzt
                   (statt Luecke); null = Ablehnung laesst die Zelle leer
       uwTabelle   eigene wpick-Tabelle fuer den Unterwuchs; null = Standard
       leitfarben  OPTIONAL. Ersetzt die modulweite LEITFARBEN-Konstante der
                   Blumennester in genWiese; fehlt sie, gilt die Konstante.
     Im wiese-Pfad sind alle Faktoren 1 bzw. null/fehlend — byteidentisch.

   schnee — OPTIONALER Schneeauflage-Block (Biomkatalog 27), gelesen von
     render/materials.js setSchnee(): { auflage, kante:[a,b], hoehe:[a,b],
     farbe, kuehle, bruch }. Fehlt der Block, setzt setSchnee uSchneeAuflage=0
     und der komplette Fragmentzweig faellt weg.

   luft — OPTIONALER Atmosphaere-Nachkorrekturblock (Biomkatalog 28), gelesen
     von world/atmosphere.js am Ende von applyTod():
       fogWarmTint/fogCoolTint [r,g,b]  multiplikativ auf die Nebelfarben
       fogNah/fogFern                   Faktoren auf scene.fog.near/far
       fogCapMax                        min() gegen den Preset-Nebeldeckel
       hemiBoden (hex) + hemiMisch      Bodenlicht Richtung Biomboden ziehen
       satMitte                         Faktor auf grade.satMitte
       wolkenschatten                   Faktor auf uCloudAmt
     Nachtregel des Katalogs: Tints und satMitte nie ueber 1.10.

   vfx — OPTIONALER Umgebungs-Partikelblock (world/vfx.js), gelesen von
     world/atmosphere.js (biomVfx). Zwei Schreibweisen sind erlaubt, weil
     atmosphere.js sie tolerant liest:
       vfx: "sporen"                                   Kurzform, dichte 1
       vfx: { typ, dichte, farbe }                     ausgeschrieben
         typ     "blueten" | "sporen" | "staub" | "schnee" (Sorten aus vfx.js)
         dichte  0..1, Grunddichte des Bioms. Das Wetter multipliziert sie
                 ueber WETTER[..].vfxBiom bzw. ersetzt den Typ ganz (Regen,
                 Schneefall, Sturm bringen ihren eigenen mit).
         farbe   OPTIONAL (hex). Fehlt sie, faerbt vfx.js die Sorte selbst —
                 deshalb tragen tundra/hochland bewusst keine: ihr Flugschnee
                 soll exakt so aussehen wie der des Wetters.
     Fehlt der Block, gibt es keinen Umgebungs-VFX und der ganze Zweig kostet
     nichts. Bewusst OHNE vfx bleiben die Biome, deren Luft leer sein soll:
     wiese, kueste, meer, klippenmeer, korallenbank, kreide, karst, terrassen.

   hoehe — OPTIONALES Hoehenprofil fuer genBaseIn (world/terrain.js, H6).
     Fehlt das Feld (Stand dieser Runde bei allen fuenf Biomen), gilt
     HOEHEN_STANDARD, und genBaseIn rechnet Byte fuer Byte wie bisher.
     Die konkreten Biomwerte setzt ein spaeterer Agent aus dem Biomkatalog.

   wasserTint — [r,g,b]-Multiplikator auf die Tageszeit-Wasserfarbe.
     BEWUSST INERT in dieser Runde: water.js/atmosphere.js sind tabu. Die
     Anbindung zieht der Orchestrator nach: in atmosphere.js direkt nach
     `mixHex(a.wasser, b.wasser, e, waterMat.color);` den Tint auf
     waterMat.color multiplizieren. Bis dahin liest kein Modul dieses Feld.
   ========================================================================== */
function farbe(hex) { return new THREE.Color(hex); }

/* ==========================================================================
   Hoehenprofil (H6 / H2). genBaseIn zog den Kartenrand bisher fest ueber
   `lerp(-22, h, sstep(0, 55, d))` und die Grundform ueber die Literale
   26 / 4 / -6. Diese fuenf Zahlen stehen jetzt hier und koennen je Biom
   ueberschrieben werden — erst damit unterscheidet sich eine Aschebrache
   (senkrechte Abrisskante) wirklich von einer Kueste.

     amp        Amplitude der groben Oktave (Landschaftsmassen)
     fein       Amplitude der feinen Oktave (Bodenrelief)
     sockel     konstanter Hoehenversatz (bestimmt den Landanteil)
     randTiefe  Hoehe, auf die der Kartenrand gezogen wird
     randBreite Breite des Randabfalls in Kacheln (klein = Abrisskante)

   Vorbereitet, aber in dieser Runde bei allen Biomen 0 und damit ohne jede
   Wirkung (die Zweige in genBaseIn werden bei 0 komplett uebersprungen —
   das ist die Bedingung fuer Byte-Identitaet):

     grat       Staerke aufgesetzter Grate (Ridge-Noise, Gebirge) — H-Welle 2:
                RELATIV zu amp, weil der Biomkatalog Werte wie 0.15 … 0.7
                nennt und damit erkennbar Bruchteile der Landschaftsmasse
                meint (0.6 Welteinheiten waeren neben amp 26 unsichtbar).
                genBaseIn rechnet deshalb `ridge * grat * amp`.
     stufe      Hoehe der Terrassenstufen (Terrassenland, 0 = stufenlos)
     stufeKante Haerte der Terrassenkante 0..1 (1 = senkrechte Wange).
                Standard 0.8 = exakt die frueher fest verdrahtete Weichheit.
     senken     Tiefe eingesenkter Mulden (Dolinen im Karst)

   randBreite = 0 ist erlaubt und bedeutet "Kante ohne Uebergang"; genBaseIn
   ersetzt die 0 durch einen Winzigwert, damit sstep nicht durch 0 teilt.
   ========================================================================== */
export const HOEHEN_STANDARD = {
  amp: 26, fein: 4, sockel: -6,
  randTiefe: -22, randBreite: 55,
  grat: 0, stufe: 0, stufeKante: 0.8, senken: 0
};

/** Aufgeloestes Hoehenprofil eines Bioms: Registry-Werte ueber den Standard. */
export function hoehenProfil(biomName) {
  var b = BIOME[biomName] || BIOME.wiese;
  var out = {};
  for (var k in HOEHEN_STANDARD) out[k] = HOEHEN_STANDARD[k];
  if (b && b.hoehe) for (var q in b.hoehe) {
    if (out[q] !== undefined && typeof b.hoehe[q] === "number") out[q] = b.hoehe[q];
  }
  return out;
}

/** Vergleicht zwei aufgeloeste Profile — Biomwechsel muss das Basisterrain
 *  nur dann neu erzeugen, wenn sich die Form tatsaechlich aendert. */
export function hoehenProfilGleich(a, b) {
  for (var k in HOEHEN_STANDARD) if (a[k] !== b[k]) return false;
  return true;
}

export const BIOME = {
  wiese: {
    label: "Wiese",
    terrain: {
      grasKuehl: farbe(0x8ea86a), grasWarm: farbe(0xa8b877), grasTrocken: farbe(0xbcbd8a),
      erde: farbe(0x9d8560), fels: farbe(0xa9a99f), schnee: farbe(0xf4f6f8),
      sand: farbe(0xdfd0ab), seegrund: farbe(0xd2c6a2), tiefe: farbe(0x1f4750),
      tritt: farbe(0x8a7554), brandung: farbe(0xf2f6f4),
      driftGelb: farbe(0xb2b56e), driftBlau: farbe(0x82a87c),
      sandA: 2.0, sandB: 1.0, saumSand: 1.5,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 23, schneeB: 25, saumSchnee: 24,
      oase: 0, oaseFarbe: null
    },
    veg: { dichte: 1, blumen: 1, unterwuchs: 1, arten: null, ersatz: null, uwTabelle: null },
    wasserTint: [1, 1, 1]
  },
  wueste: {
    label: "Wüste",
    terrain: {
      // Grundton warmer, entsaettigter Sand statt Gras; Fels roetlich.
      grasKuehl: farbe(0xb89e70), grasWarm: farbe(0xc2a878), grasTrocken: farbe(0xcdb488),
      erde: farbe(0xa08058), fels: farbe(0xa0785c), schnee: farbe(0xf4f6f8),
      sand: farbe(0xe3d4ae), seegrund: farbe(0xd2c6a2), tiefe: farbe(0x1f4750),
      tritt: farbe(0x9a8258), brandung: farbe(0xf2f6f4),
      // Katalog 4: driftBlau war mit #ab9f82 fast deckungsgleich mit
      // grasTrocken — auf #9c9f8a gezogen, damit die F2-Drift noch atmet.
      driftGelb: farbe(0xcbb075), driftBlau: farbe(0x9c9f8a),
      sandA: 2.4, sandB: 1.0, saumSand: 1.7,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 32, schneeB: 35, saumSchnee: 33.5,   // praktisch nie erreicht
      oase: 0.65, oaseFarbe: farbe(0x6d7f54)        // Graugruen nur in Senken
    },
    hoehe: { amp: 14, fein: 6, sockel: -2, grat: 0 },   // Duenenwellen, kein Gebirge
    veg: {
      dichte: 0.35, blumen: 0.15, unterwuchs: 0.5,
      arten: { baum: 0.2, baum2: 0.2, bluetenbaum: 0.1, sumpfbaum: 0 },
      ersatz: "zypresse",
      uwTabelle: [["busch", 4], ["farn", 1], ["moos", 1], ["stumpf", 1],
        ["stammliegend", 1], ["fels", 5]]
    },
    wasserTint: [1, 1, 1],
    // Sandfahnen ueber den Duenen — das staerkste Staub-Biom neben dem Vulkan.
    vfx: { typ: "staub", dichte: 0.70, farbe: 0xdcc79a }
  },
  kueste: {
    label: "Küste",
    terrain: {
      // Wie wiese, aber deutlich breiteres, helleres Strandband und grauer Fels.
      grasKuehl: farbe(0x8ea86a), grasWarm: farbe(0xa8b877), grasTrocken: farbe(0xbcbd8a),
      erde: farbe(0x9d8560), fels: farbe(0x9c9fa0), schnee: farbe(0xf4f6f8),
      sand: farbe(0xd8c9a2), seegrund: farbe(0xd2c6a2), tiefe: farbe(0x1f4750),
      tritt: farbe(0x8a7554), brandung: farbe(0xf2f6f4),
      driftGelb: farbe(0xb2b56e), driftBlau: farbe(0x82a87c),
      sandA: 3.8, sandB: 0.6, saumSand: 2.2,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 23, schneeB: 25, saumSchnee: 24,
      oase: 0, oaseFarbe: null,
      brandungA: 1.1, brandungB: 0.15, brandungStaerke: 0.65   // breiterer Saum
    },
    veg: { dichte: 1, blumen: 1, unterwuchs: 1, arten: null, ersatz: null, uwTabelle: null },
    wasserTint: [1.02, 1.12, 1.02]   // Richtung Tuerkis (#3fa3ad aus 0x3f93ad)
  },
  sumpf: {
    label: "Sumpf",
    terrain: {
      // Dunkles, blaugruenes Gras; Erde fast schwarzbraun; breite nasse Uferzone.
      grasKuehl: farbe(0x55684c), grasWarm: farbe(0x5c7050), grasTrocken: farbe(0x6b7a5c),
      erde: farbe(0x4a4038), fels: farbe(0x767468), schnee: farbe(0xf4f6f8),
      sand: farbe(0x6f6852), seegrund: farbe(0x55584a), tiefe: farbe(0x2a352c),
      tritt: farbe(0x4e453a), brandung: farbe(0xaab4a6),
      driftGelb: farbe(0x6c7452), driftBlau: farbe(0x4c665c),
      sandA: 3.2, sandB: 0.4, saumSand: 1.8,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 32, schneeB: 35, saumSchnee: 33.5,
      oase: 0, oaseFarbe: null
    },
    veg: {
      dichte: 1, blumen: 0.5, unterwuchs: 1.35,
      arten: { baum: 0.3, baum2: 0.3, nadelbaum: 0.55, bluetenbaum: 0.35 },
      ersatz: "sumpfbaum",
      uwTabelle: [["busch", 3], ["farn", 7], ["moos", 6], ["stumpf", 2],
        ["stammliegend", 2], ["fels", 1]]
    },
    wasserTint: [0.9, 0.5, 0.35],    // Richtung dunkles #3a4a3c
    // Sporen ueber dem Faulwasser, sparsam: der Sumpf lebt vom Nebel (luft).
    vfx: { typ: "sporen", dichte: 0.30, farbe: 0xbcd489 },
    // Katalog 5: die Nebelbank knapp ueber der Flaeche traegt mehr zum Sumpf
    // bei als jede Farbkorrektur.
    luft: { fogNah: 0.55, fogCapMax: 0.95 }
  },
  schnee: {
    // Heisst im Katalog "Winterwald" (der Namensteil "Eis" gehoert zu `eis`).
    // Der SCHLUESSEL bleibt `schnee` — er steht so in gespeicherten Karten.
    label: "Winterwald",
    terrain: {
      // Kaltes Graugruen unten, Weiss/Blauweiss ab ~4; Steilhang-Fels bricht
      // durch, weil der Hang-Fels NACH dem Schnee-Lerp aufgetragen wird.
      grasKuehl: farbe(0x7c8a76), grasWarm: farbe(0x8a9480), grasTrocken: farbe(0x99a08e),
      erde: farbe(0x6e685e), fels: farbe(0x8b9298), schnee: farbe(0xe8edf2),
      sand: farbe(0xccd2d4), seegrund: farbe(0xb6c0c4), tiefe: farbe(0x22404e),
      tritt: farbe(0x7c807a), brandung: farbe(0xeef3f6),
      driftGelb: farbe(0x9aa189), driftBlau: farbe(0x84929a),
      sandA: 2.0, sandB: 1.0, saumSand: 1.5,
      felsA: 12.6, felsB: 14.1, saumFels: 13.3,
      schneeA: 3.5, schneeB: 5.5, saumSchnee: 4.5,
      oase: 0, oaseFarbe: null
    },
    veg: {
      dichte: 0.6, blumen: 0.1, unterwuchs: 0.7,
      arten: { baum: 0.25, baum2: 0.25, bluetenbaum: 0.1, sumpfbaum: 0.1, zypresse: 0.4 },
      ersatz: "nadelbaum",
      uwTabelle: [["busch", 3], ["farn", 1], ["moos", 4], ["stumpf", 2],
        ["stammliegend", 2], ["fels", 4]]
    },
    wasserTint: [0.85, 0.95, 1.05],  // stahlblau, kuehl entsaettigt
    // Leichter Flugschnee auch bei klarem Wetter — der Winterwald soll nie
    // ganz still stehen. Bei Schneefall/Sturm ersetzt ihn der Wetter-VFX.
    vfx: { typ: "schnee", dichte: 0.35, farbe: 0xf2f6fa },
    schnee: { auflage: 0.75, kante: [0.20, 0.70], hoehe: [1, 8],
      farbe: 0xf0f4f8, kuehle: 0.10, bruch: 0.40 }
  },

  /* ------------------------------------------------------------------ */
  /* Neu in H-Welle 2 — 20 Biome aus dem Katalog (docs/engineering/       */
  /* terra-biomkatalog.md, Abschnitte 7-26).                              */
  /* ------------------------------------------------------------------ */

  eis: {
    label: "Ewiges Eis",
    terrain: {
      // S 0.06-0.22, bewusst unter dem Korridor: die Farbe kommt hier aus dem
      // Licht, nicht aus dem Pigment. Der Kalt-Warm-Kontrast liefert die
      // Tageszeit (morgen/abend ist der staerkste Bildzustand des Katalogs).
      grasKuehl: farbe(0x9fb2c2), grasWarm: farbe(0xa8bac6), grasTrocken: farbe(0xbcc6c8),
      erde: farbe(0x7a8894), fels: farbe(0x6f7c88), schnee: farbe(0xeef4f8),
      sand: farbe(0xcfdde4), seegrund: farbe(0x9fb6c0), tiefe: farbe(0x1b3a52),
      tritt: farbe(0xa8b2b8), brandung: farbe(0xf2f8fb),
      driftGelb: farbe(0xb8bca8), driftBlau: farbe(0x93a8bc),
      sandA: 1.2, sandB: -0.4, saumSand: 0.4,
      felsA: 8, felsB: 10, saumFels: 9,
      schneeA: -3, schneeB: -1, saumSchnee: -2,
      oase: 0, oaseFarbe: null
    },
    hoehe: { amp: 24, fein: 2.5, sockel: 4, grat: 0.15 },
    veg: {
      dichte: 0.10, blumen: 0, unterwuchs: 0.35, abstand: 1.8,
      arten: { baum: 0, baum2: 0, bluetenbaum: 0, sumpfbaum: 0, zypresse: 0.3 },
      ersatz: "nadelbaum",
      uwTabelle: [["fels", 8], ["stumpf", 2], ["stammliegend", 2], ["moos", 1], ["busch", 1]]
    },
    wasserTint: [0.78, 0.95, 1.12],
    // Dichteres Schneetreiben als im Winterwald: hier ist die Luft das Motiv.
    vfx: { typ: "schnee", dichte: 0.50, farbe: 0xeaf2fa },
    schnee: { auflage: 1.0, kante: [0.05, 0.55], hoehe: [-10, 0],
      farbe: 0xf2f6fa, kuehle: 0.18, bruch: 0.25 },
    luft: { fogCoolTint: [0.95, 0.99, 1.06], fogNah: 0.85, fogCapMax: 1.00,
      hemiBoden: 0xc8d6e0, hemiMisch: 0.70, satMitte: 0.95 }
  },
  moor: {
    label: "Hochmoor",
    terrain: {
      grasKuehl: farbe(0x6e7a58), grasWarm: farbe(0x8a8458), grasTrocken: farbe(0x9d9264),
      erde: farbe(0x453a2e), fels: farbe(0x8a8578), schnee: farbe(0xeceef0),
      sand: farbe(0x8f8663), seegrund: farbe(0x4a4636), tiefe: farbe(0x22281f),
      tritt: farbe(0x53483a), brandung: farbe(0x9aa294),
      driftGelb: farbe(0x9c9060), driftBlau: farbe(0x62735e),
      sandA: 2.6, sandB: 0.2, saumSand: 1.4,
      felsA: 13, felsB: 15, saumFels: 14,
      schneeA: 30, schneeB: 33, saumSchnee: 31.5,
      // Oasenlogik INVERTIERT genutzt: die Senken werden nasser und dunkler,
      // nicht gruener. Die Funktion selbst ist farbneutral — kein Zusatzcode.
      oase: 0.55, oaseFarbe: farbe(0x574c33)
    },
    hoehe: { amp: 8, fein: 3, sockel: 1, grat: 0 },   // bretteben: die Wasserlinie zeichnet
    veg: {
      dichte: 0.45, blumen: 0.8, unterwuchs: 1.1,
      arten: { baum: 0.15, baum2: 0.2, bluetenbaum: 0, nadelbaum: 0.5, zypresse: 0.3 },
      ersatz: "stumpf",             // gueltiger Pool (Radius 0.5): tote Stuempfe
      uwTabelle: [["moos", 7], ["farn", 3], ["busch", 3], ["stumpf", 3],
        ["stammliegend", 2], ["fels", 1]]
    },
    wasserTint: [0.7, 0.72, 0.55],  // Huminsaeure-Braunschwarz
    // Wollgrasflug ueber der Ebene — gelbgruen, deutlich sichtbar.
    vfx: { typ: "sporen", dichte: 0.45, farbe: 0xc8e08a },
    luft: { fogCoolTint: [0.97, 0.99, 0.97], fogNah: 0.55, fogCapMax: 0.94,
      hemiBoden: 0x7d7357, hemiMisch: 0.55, satMitte: 0.95 }
  },
  meer: {
    label: "Offenes Meer",
    terrain: {
      grasKuehl: farbe(0x7f9370), grasWarm: farbe(0x94a077), grasTrocken: farbe(0xb0ae86),
      erde: farbe(0x8e7a58), fels: farbe(0x8d8d86), schnee: farbe(0xf4f6f8),
      sand: farbe(0xe6dcbe), seegrund: farbe(0xbfc9a6), tiefe: farbe(0x14384a),
      tritt: farbe(0x8a7554), brandung: farbe(0xf4f8f6),
      driftGelb: farbe(0xb4b478), driftBlau: farbe(0x7ea092),
      sandA: 4.5, sandB: 0.2, saumSand: 2.2,
      felsA: 10, felsB: 12, saumFels: 11,
      schneeA: 26, schneeB: 28, saumSchnee: 27,
      oase: 0, oaseFarbe: null
    },
    // Der Sockel -19 schiebt die Verteilung so weit nach unten, dass nur die
    // obersten Rauschwerte den Wasserspiegel brechen: verstreute Inselruecken
    // statt Landmasse mit See. randBreite 40 laesst den ohnehin
    // untergetauchten Rand steiler abfallen.
    //
    // GEMESSEN (Landanteil ueber sieben Seeds, 256er Karte, Pruefskript
    // H-Welle 2): wiese 32-57 %, meer 0-42 % mit Median ~6 %. Die im Katalog
    // genannten "~12 % der Rauschwerte" treffen nicht exakt zu, weil fractal()
    // seine Summe ueber eine S-Kurve spreizt UND auf 0..1 klemmt — die
    // Verteilung ist deutlich schmaler als angenommen. Wichtiger: bei
    // f = 0.006 passt auf eine 256er Karte nur rund eine Rauschperiode,
    // deshalb schwankt der Landanteil je Seed extrem. Beim Standardseed 1337
    // faellt `meer` auf 0 % Land (reine Wasserflaeche). Das ist kein Fehler
    // der Umsetzung, sondern eine Kalibrierfrage: wer garantiert Inseln will,
    // zieht den Sockel Richtung -15 (dann 7-50 %). Bewusst beim Katalogwert
    // belassen, damit die Kunstrichtung entscheidet.
    // Sockel -15 statt der -19 aus dem Katalog: gemessen ueber sieben Seeds
    // ergaben -19 einen Median von ~6 % Land und beim Standardseed 1337 gar
    // keines — eine leere Wasserflaeche ist keine Karte. -15 laesst die
    // Inselruecken zuverlaessig durchbrechen, ohne das Bild zu kippen.
    hoehe: { amp: 28, fein: 3.5, sockel: -15, randTiefe: -26, randBreite: 40 },
    veg: {
      dichte: 0.9, blumen: 0.6, unterwuchs: 0.9,
      arten: { sumpfbaum: 0.2, nadelbaum: 0.5 },
      ersatz: "baum",
      uwTabelle: [["busch", 5], ["farn", 3], ["fels", 4], ["moos", 2],
        ["stammliegend", 1], ["stumpf", 1]]
    },
    wasserTint: [0.95, 1.05, 1.12],
    luft: { fogCoolTint: [0.99, 1.01, 1.04], fogNah: 1.25, fogCapMax: 1.00,
      hemiBoden: 0x9fb0a8, hemiMisch: 0.45, satMitte: 1.00 }
  },
  hochland: {
    label: "Hochland",
    terrain: {
      grasKuehl: farbe(0x76866a), grasWarm: farbe(0x8b9670), grasTrocken: farbe(0x9d9c78),
      erde: farbe(0x7c6c54), fels: farbe(0x9b9488), schnee: farbe(0xf0f4f6),
      sand: farbe(0xc9c1a4), seegrund: farbe(0xa8ac92), tiefe: farbe(0x24444e),
      tritt: farbe(0x796a52), brandung: farbe(0xeef4f2),
      driftGelb: farbe(0xa39c66), driftBlau: farbe(0x6f8a80),
      sandA: 1.4, sandB: 0.4, saumSand: 0.9,
      felsA: 9, felsB: 11, saumFels: 10,
      schneeA: 17, schneeB: 19.5, saumSchnee: 18.2,
      oase: 0, oaseFarbe: null
    },
    hoehe: { amp: 22, fein: 6, sockel: 2, grat: 0.35 },   // Grate statt Kuppen
    veg: {
      dichte: 0.5, blumen: 1.4, unterwuchs: 0.6, abstand: 1.3,
      arten: { baum: 0.3, baum2: 0.3, sumpfbaum: 0, bluetenbaum: 0.15, zypresse: 0.4 },
      ersatz: "nadelbaum",
      uwTabelle: [["fels", 6], ["busch", 3], ["moos", 3], ["stumpf", 1],
        ["stammliegend", 1], ["farn", 1]]
    },
    wasserTint: [0.92, 1.0, 1.06],
    // Ohne farbe: der duenne Hochlandflug soll die Sortenfarbe von vfx.js
    // tragen und nicht auffallen — er ist Luftbewegung, kein Ereignis.
    vfx: { typ: "schnee", dichte: 0.20 },
    // Das Hoehenband beschneit nur die Gipfel — es ersetzt ein zweites Biom.
    schnee: { auflage: 0.5, kante: [0.25, 0.75], hoehe: [14, 20],
      farbe: 0xeef2f6, kuehle: 0.10, bruch: 0.5 }
  },
  steppe: {
    label: "Steppe",
    terrain: {
      grasKuehl: farbe(0x9aa172), grasWarm: farbe(0xb3ac7c), grasTrocken: farbe(0xc6b98c),
      erde: farbe(0xa08c66), fels: farbe(0xa39a8c), schnee: farbe(0xf2f4f6),
      sand: farbe(0xd9c9a2), seegrund: farbe(0xc6bd9a), tiefe: farbe(0x27505a),
      tritt: farbe(0x94805a), brandung: farbe(0xf0f4f0),
      driftGelb: farbe(0xc4b478), driftBlau: farbe(0x93a184),
      sandA: 2.2, sandB: 0.8, saumSand: 1.4,
      felsA: 14, felsB: 16, saumFels: 15,
      schneeA: 28, schneeB: 31, saumSchnee: 29.5,
      oase: 0.30, oaseFarbe: farbe(0x74845c)   // Flussgalerien und Senkenwiesen
    },
    hoehe: { amp: 12, fein: 3, sockel: 0, grat: 0 },   // sanfte, sehr lange Wellen
    veg: {
      dichte: 0.2, blumen: 0.5, unterwuchs: 0.4,
      arten: { nadelbaum: 0.1, zypresse: 0.2, sumpfbaum: 0.1, bluetenbaum: 0.2 },
      ersatz: "baum",
      uwTabelle: [["busch", 6], ["fels", 3], ["stumpf", 1], ["stammliegend", 1],
        ["farn", 1], ["moos", 1]]
    },
    wasserTint: [1.0, 1.0, 0.95],
    // Trockener Grasstaub ueber den langen Wellen.
    vfx: { typ: "staub", dichte: 0.40, farbe: 0xcfc094 }
  },
  vulkan: {
    label: "Aschekegel",
    terrain: {
      grasKuehl: farbe(0x5c5450), grasWarm: farbe(0x6b6058), grasTrocken: farbe(0x7d7064),
      erde: farbe(0x4a423c), fels: farbe(0x5b504a), schnee: farbe(0xe6e2dc),   // Ascheschnee
      sand: farbe(0x6e645a), seegrund: farbe(0x4c4640), tiefe: farbe(0x1c2830),
      tritt: farbe(0x4e453e), brandung: farbe(0xd8d2c8),
      driftGelb: farbe(0x846c52), driftBlau: farbe(0x5a6068),
      sandA: 3.0, sandB: 0.6, saumSand: 1.8,
      felsA: 6, felsB: 8, saumFels: 7,          // Fels bricht frueh durch
      schneeA: 22, schneeB: 24, saumSchnee: 23,
      // Der einzige Wert ueber dem Saettigungskorridor (S 0.56) — er trifft
      // < 5 % der Flaeche und ist als Glutakzent gewollt.
      oase: 0.50, oaseFarbe: farbe(0x7e4e38)
    },
    hoehe: { amp: 26, fein: 5, sockel: -2, grat: 0.6 },   // Grat-Rauschen = Kegelkanten
    veg: {
      dichte: 0.08, blumen: 0.05, unterwuchs: 0.3,
      arten: { baum: 0.05, baum2: 0.05, bluetenbaum: 0, sumpfbaum: 0, nadelbaum: 0.15 },
      ersatz: null,                 // Ablehnung laesst die Zelle leer — Kahlheit ist Motiv
      uwTabelle: [["fels", 10], ["stumpf", 2], ["stammliegend", 2], ["busch", 1]]
    },
    wasserTint: [0.72, 0.70, 0.68],
    // Ascheflug — das dichteste Biom-VFX ueberhaupt und Teil der Silhouette.
    vfx: { typ: "staub", dichte: 0.90, farbe: 0x8c7d74 },
    luft: { fogWarmTint: [0.94, 0.92, 0.92], fogCoolTint: [0.94, 0.92, 0.92],
      fogNah: 0.70, fogCapMax: 0.95, hemiBoden: 0x5e564e, hemiMisch: 0.65, satMitte: 0.98 }
  },
  salzwueste: {
    label: "Salzpfanne",
    terrain: {
      // Das hellste Biom: alle Flaechenwerte ueber 0.72.
      grasKuehl: farbe(0xd2cdbe), grasWarm: farbe(0xdcd6c6), grasTrocken: farbe(0xe6e0cd),
      erde: farbe(0xb8ab90), fels: farbe(0xa89c8c), schnee: farbe(0xf6f5ef),
      sand: farbe(0xe8e2d0), seegrund: farbe(0xd6d4c2), tiefe: farbe(0x3e6a70),
      tritt: farbe(0xb0a68e), brandung: farbe(0xf8f8f2),
      driftGelb: farbe(0xd8ceac), driftBlau: farbe(0xbfc8c4),
      sandA: 6.0, sandB: -2.0, saumSand: 2.0,   // praktisch alles ist Kruste
      felsA: 12, felsB: 14, saumFels: 13,
      schneeA: 30, schneeB: 33, saumSchnee: 31.5,
      oase: 0.50, oaseFarbe: farbe(0x7f9a9a)    // Solerinnsale
    },
    hoehe: { amp: 9, fein: 1.2, sockel: 1, grat: 0 },   // die Ebenheit IST das Motiv
    veg: {
      dichte: 0.04, blumen: 0, unterwuchs: 0.15,
      arten: { baum: 0, baum2: 0, bluetenbaum: 0, sumpfbaum: 0, nadelbaum: 0, zypresse: 0 },
      ersatz: null,
      uwTabelle: [["fels", 6], ["stumpf", 1]]
    },
    wasserTint: [1.15, 1.20, 1.05],
    // Salzstaub, fast weiss — er hellt die ohnehin helle Pfanne weiter auf.
    vfx: { typ: "staub", dichte: 0.50, farbe: 0xeee6d2 },
    luft: { fogWarmTint: [1.04, 1.03, 0.99], fogCoolTint: [1.04, 1.03, 0.99],
      fogNah: 1.35, fogCapMax: 1.00, hemiBoden: 0xe2ddc9, hemiMisch: 0.75, satMitte: 0.92 }
  },
  regenwald: {
    label: "Regenwald",
    terrain: {
      // S 0.31-0.42, oberes Ende des Korridors — bewusst.
      grasKuehl: farbe(0x4f6b4a), grasWarm: farbe(0x63784c), grasTrocken: farbe(0x7b8850),
      erde: farbe(0x674f3c), fels: farbe(0x77786c), schnee: farbe(0xf0f4f4),
      sand: farbe(0x9a8f68), seegrund: farbe(0x6f7a56), tiefe: farbe(0x1c3f3c),
      tritt: farbe(0x5e4c38), brandung: farbe(0xdcecdf),
      driftGelb: farbe(0x7b8850), driftBlau: farbe(0x3f6656),
      sandA: 2.0, sandB: 0.4, saumSand: 1.2,
      felsA: 15, felsB: 17, saumFels: 16,
      schneeA: 30, schneeB: 33, saumSchnee: 31.5,
      oase: 0, oaseFarbe: null
    },
    hoehe: { amp: 20, fein: 7, sockel: 0, grat: 0.3 },
    veg: {
      dichte: 1.0, abstand: 0.72,   // abstand ist hier der eigentliche Dichteregler
      blumen: 0.4, unterwuchs: 1.7,
      arten: { nadelbaum: 0.05, zypresse: 0.1, bluetenbaum: 0.5 },
      ersatz: "baum",
      uwTabelle: [["farn", 8], ["busch", 5], ["moos", 5], ["stammliegend", 2],
        ["stumpf", 2], ["fels", 1]]
    },
    wasserTint: [0.85, 0.98, 0.82],
    // Schwebende Sporen im Kronendunst, sparsam — der Regenwald ist voll genug.
    vfx: { typ: "sporen", dichte: 0.30, farbe: 0xd8e8a0 },
    luft: { fogCoolTint: [0.96, 1.00, 0.96], fogNah: 0.60, fogCapMax: 0.96,
      hemiBoden: 0x566b48, hemiMisch: 0.60, satMitte: 1.05 }
  },
  bambuswald: {
    label: "Bambuswald",
    terrain: {
      grasKuehl: farbe(0x7f9464), grasWarm: farbe(0x99a86c), grasTrocken: farbe(0xb2b47e),
      erde: farbe(0x7d6c50), fels: farbe(0x8f9086), schnee: farbe(0xf2f6f6),
      sand: farbe(0xcfc49e), seegrund: farbe(0xadb08c), tiefe: farbe(0x27505a),
      tritt: farbe(0x776448), brandung: farbe(0xeef6f2),
      driftGelb: farbe(0xb6b46e), driftBlau: farbe(0x6f9483),
      sandA: 2.0, sandB: 0.8, saumSand: 1.4,
      felsA: 13, felsB: 15, saumFels: 14,
      schneeA: 26, schneeB: 28, saumSchnee: 27,
      oase: 0, oaseFarbe: null
    },
    hoehe: { amp: 18, fein: 5, sockel: 0, grat: 0.25 },
    veg: {
      dichte: 1.0, abstand: 0.55,   // Bambus steht enger als jeder Baum
      blumen: 0.2, unterwuchs: 0.5,
      arten: { baum: 0.1, baum2: 0.1, sumpfbaum: 0, bluetenbaum: 0.15, nadelbaum: 0.1 },
      // bis der Pool `bambus` existiert ist die Zypresse die einzige schmale,
      // hohe Silhouette im Bestand — sie traegt das Bild ueberraschend gut.
      ersatz: "zypresse",
      uwTabelle: [["farn", 6], ["moos", 4], ["busch", 2], ["stumpf", 1], ["fels", 1]]
    },
    wasserTint: [0.95, 1.02, 0.98],
    // Bambusblaetter statt Blueten: dieselbe Sorte, aber blassgruen und viel
    // duenner als im Bluetental.
    vfx: { typ: "blueten", dichte: 0.35, farbe: 0xdfe8c0 }
  },
  mangrove: {
    label: "Mangrovenküste",
    terrain: {
      grasKuehl: farbe(0x5e7050), grasWarm: farbe(0x6e7c54), grasTrocken: farbe(0x87895e),
      erde: farbe(0x53483a), fels: farbe(0x7c7b70), schnee: farbe(0xeef2f2),
      sand: farbe(0x9c9070), seegrund: farbe(0x77785c), tiefe: farbe(0x1f3c3e),
      tritt: farbe(0x4f4436), brandung: farbe(0xd8e4dc),
      driftGelb: farbe(0x8c8a58), driftBlau: farbe(0x4e7068),
      // Das Watt reicht unter den Wasserspiegel und bleibt sichtbar.
      sandA: 3.6, sandB: -0.8, saumSand: 1.4,
      felsA: 14, felsB: 16, saumFels: 15,
      schneeA: 30, schneeB: 33, saumSchnee: 31.5,
      oase: 0, oaseFarbe: null
    },
    hoehe: { amp: 11, fein: 4, sockel: -3, randTiefe: -14, grat: 0 },
    veg: {
      dichte: 0.9, abstand: 0.85, blumen: 0.15, unterwuchs: 1.2,
      arten: { baum: 0.2, baum2: 0.2, nadelbaum: 0, zypresse: 0, bluetenbaum: 0.1 },
      ersatz: "sumpfbaum",
      uwTabelle: [["farn", 5], ["moos", 4], ["busch", 4], ["stammliegend", 3],
        ["stumpf", 2], ["fels", 1]]
    },
    wasserTint: [0.95, 1.02, 0.88],
    // Nur ein Hauch ueber dem Watt — die Mangrove lebt vom Wasser, nicht von
    // der Luft.
    vfx: { typ: "sporen", dichte: 0.22, farbe: 0xcfe0a8 }
  },
  kreide: {
    label: "Kreidefelsen",
    terrain: {
      grasKuehl: farbe(0x8fa36a), grasWarm: farbe(0xa6b078), grasTrocken: farbe(0xbcbb8c),
      erde: farbe(0xa2937a),
      fels: farbe(0xe4e6e2),        // S 0.02 — die weisse Wand ist der Sinn des Bioms
      schnee: farbe(0xf4f6f8),
      sand: farbe(0xe0dbc4), seegrund: farbe(0xcfd6c4), tiefe: farbe(0x2a6270),
      tritt: farbe(0x8f7d5c), brandung: farbe(0xf6faf8),
      driftGelb: farbe(0xb6b672), driftBlau: farbe(0x84a88a),
      sandA: 1.6, sandB: 0.2, saumSand: 0.9,
      // Der Fels beginnt direkt ueber der Wasserlinie und ist deshalb DIE Wand.
      felsA: 2.5, felsB: 4.5, saumFels: 3.5,
      schneeA: 26, schneeB: 28, saumSchnee: 27,
      oase: 0, oaseFarbe: null
    },
    // Katalog 17 nennt `stufe: [0.5, 9]` (Kliffstufe). Der in genBaseIn
    // implementierte Terrassenmechanismus leistet dasselbe mit einer harten
    // Kante: Stufenhoehe 9 legt das Grasplateau auf 9, die Wange dazwischen
    // wird bei stufeKante 0.85 fast senkrecht.
    hoehe: { amp: 18, fein: 3, sockel: -4, stufe: 9, stufeKante: 0.85 },
    veg: {
      dichte: 0.6, blumen: 1.3, unterwuchs: 0.5,
      arten: { sumpfbaum: 0, nadelbaum: 0.3, bluetenbaum: 0.3 },
      ersatz: "baum2",
      uwTabelle: [["busch", 5], ["fels", 3], ["moos", 2], ["farn", 2],
        ["stumpf", 1], ["stammliegend", 1]]
    },
    wasserTint: [1.10, 1.15, 1.05]
  },
  tundra: {
    label: "Tundra",
    terrain: {
      grasKuehl: farbe(0x7c8670), grasWarm: farbe(0x8e9070), grasTrocken: farbe(0xa39a78),
      erde: farbe(0x6e6656), fels: farbe(0x848e98), schnee: farbe(0xecf1f4),
      sand: farbe(0xbdbaa6), seegrund: farbe(0xa2a894), tiefe: farbe(0x24444e),
      tritt: farbe(0x6c6553), brandung: farbe(0xeef4f4),
      driftGelb: farbe(0xa6996c), driftBlau: farbe(0x7c8e8c),
      sandA: 1.6, sandB: 0.4, saumSand: 1.0,
      felsA: 7, felsB: 9, saumFels: 8,
      schneeA: 11, schneeB: 14, saumSchnee: 12.5,
      oase: 0, oaseFarbe: null
    },
    hoehe: { amp: 16, fein: 4, sockel: 1, grat: 0.2 },
    veg: {
      dichte: 0.3, blumen: 0.6, unterwuchs: 0.9, abstand: 1.5,
      arten: { baum: 0.1, baum2: 0.1, sumpfbaum: 0, bluetenbaum: 0.05, zypresse: 0.25 },
      ersatz: "nadelbaum",
      uwTabelle: [["moos", 7], ["fels", 5], ["busch", 3], ["stumpf", 2],
        ["stammliegend", 1], ["farn", 1]]
    },
    wasserTint: [0.88, 0.96, 1.04],
    // Ohne farbe (wie hochland): feiner Flugschnee in der Sortenfarbe.
    vfx: { typ: "schnee", dichte: 0.25 },
    schnee: { auflage: 0.6, kante: [0.20, 0.70], hoehe: [6, 12],
      farbe: 0xeef2f6, kuehle: 0.14, bruch: 0.45 }
  },
  karst: {
    label: "Karst",
    terrain: {
      grasKuehl: farbe(0x8a9668), grasWarm: farbe(0xa2a474), grasTrocken: farbe(0xbdb388),
      erde: farbe(0x9d8a68), fels: farbe(0xb8b4a6), schnee: farbe(0xf4f6f6),
      sand: farbe(0xdbd2b6), seegrund: farbe(0xc4c6a8), tiefe: farbe(0x2a6a72),
      tritt: farbe(0x8c7a58), brandung: farbe(0xf2f8f6),
      driftGelb: farbe(0xbcb474), driftBlau: farbe(0x86a496),
      sandA: 1.2, sandB: 0.2, saumSand: 0.7,
      felsA: 5, felsB: 7, saumFels: 6,          // sehr frueh, das Gestein dominiert
      schneeA: 24, schneeB: 27, saumSchnee: 25.5,
      oase: 0, oaseFarbe: null
    },
    // Grat-Rauschen + Dolinen ergeben zusammen die Turmkarst-Silhouette.
    // (Der Katalog nennt fuer die Senken zusaetzlich `dichte: 0.03`; die
    // Flaechendichte steckt in genBaseIn in der festen Schwelle 0.62..1.0.)
    hoehe: { amp: 22, fein: 6, sockel: 2, grat: 0.7, senken: 7 },
    veg: {
      dichte: 0.45, blumen: 0.8, unterwuchs: 0.7,
      arten: { sumpfbaum: 0, nadelbaum: 0.4, baum: 0.5, baum2: 0.5 },
      ersatz: "zypresse",           // mediterranes Karstbild
      uwTabelle: [["fels", 8], ["busch", 4], ["moos", 2], ["farn", 2],
        ["stumpf", 1], ["stammliegend", 1]]
    },
    wasserTint: [1.05, 1.15, 1.10]
  },
  bluetental: {
    label: "Blütental",
    terrain: {
      // S 0.14-0.30 — die Saettigung liegt in den INSTANZEN, nicht der Flaeche.
      grasKuehl: farbe(0x87a06a), grasWarm: farbe(0xa2b478), grasTrocken: farbe(0xbcbc8c),
      erde: farbe(0x9a8462), fels: farbe(0xa6a69c), schnee: farbe(0xf4f6f8),
      sand: farbe(0xdccfad), seegrund: farbe(0xcfc6a4), tiefe: farbe(0x24505a),
      tritt: farbe(0x8a7554), brandung: farbe(0xf4f8f6),
      driftGelb: farbe(0xc4a8ae),   // rosa Flor statt Gelb: der Bluetenteppich
      driftBlau: farbe(0x8fa4b2),
      sandA: 2.0, sandB: 1.0, saumSand: 1.5,
      felsA: 13, felsB: 15, saumFels: 14,
      schneeA: 22, schneeB: 24, saumSchnee: 23,
      oase: 0, oaseFarbe: null
    },
    hoehe: { amp: 18, fein: 3, sockel: -1, grat: 0.1 },   // weich, muldig — ein "Tal"
    veg: {
      dichte: 1.0, abstand: 0.85, blumen: 2.2, unterwuchs: 0.8,
      arten: { baum: 0.35, baum2: 0.35, nadelbaum: 0.1, zypresse: 0.15, sumpfbaum: 0 },
      ersatz: "bluetenbaum",
      uwTabelle: [["busch", 5], ["moos", 4], ["farn", 3], ["fels", 1],
        ["stumpf", 1], ["stammliegend", 1]],
      // Rosa/creme statt der Standard-Leitfarben der Blumennester.
      leitfarben: [[1.30, 0.80, 0.90], [1.22, 1.10, 1.05],
        [1.10, 0.95, 1.15], [1.25, 1.12, 0.85]]
    },
    wasserTint: [1.02, 0.99, 1.02],
    // Der Bluetenflug ist das Wahrzeichen des Bioms — hoechste Dichte der
    // Sorte, rosa wie die Leitfarben der Nester.
    vfx: { typ: "blueten", dichte: 0.9, farbe: 0xf6d2de }
  },
  aschebrache: {
    label: "Aschebrache",
    terrain: {
      grasKuehl: farbe(0x6c6a5c), grasWarm: farbe(0x7c7462), grasTrocken: farbe(0x8f8570),
      erde: farbe(0x574f42), fels: farbe(0x807a70), schnee: farbe(0xe4e4e0),   // Ascheflug
      sand: farbe(0x9a917c), seegrund: farbe(0x6e6a5e), tiefe: farbe(0x232a2e),
      tritt: farbe(0x5a5145), brandung: farbe(0xcfd2ca),
      driftGelb: farbe(0x8e8060), driftBlau: farbe(0x6c7a80),
      sandA: 2.4, sandB: 0.4, saumSand: 1.4,
      felsA: 4, felsB: 6, saumFels: 5,
      schneeA: 20, schneeB: 22, saumSchnee: 21,
      oase: 0, oaseFarbe: null
    },
    // Kernmerkmal und Setting-Anker: der Rand faellt ueber 10 Kacheln fast
    // senkrecht ins Bodenlose statt weich unter Wasser. Der Nebel schluckt
    // den Grund — die Karte bekommt eine echte Bruchkante statt einer Kueste.
    hoehe: { amp: 14, fein: 5, sockel: 6, grat: 0.4, randTiefe: -140, randBreite: 10 },
    veg: {
      dichte: 0.12, blumen: 0.05, unterwuchs: 0.4,
      arten: { baum: 0.1, baum2: 0.1, bluetenbaum: 0.1, sumpfbaum: 0.1,
        nadelbaum: 0.1, zypresse: 0.1 },
      ersatz: "stumpf",
      uwTabelle: [["fels", 7], ["stumpf", 4], ["stammliegend", 4], ["busch", 1]]
    },
    wasserTint: [0.6, 0.62, 0.66],   // falls ueberhaupt Wasser vorkommt
    // Ascheflug wie beim Vulkan, nur etwas kaelter und duenner.
    vfx: { typ: "staub", dichte: 0.80, farbe: 0x9a938c },
    luft: { fogWarmTint: [0.95, 0.95, 0.96], fogCoolTint: [0.95, 0.95, 0.96],
      fogNah: 0.75, fogCapMax: 0.90, hemiBoden: 0x6a655c, hemiMisch: 0.65, satMitte: 0.88 }
  },
  pilzwald: {
    label: "Pilzwald",
    terrain: {
      grasKuehl: farbe(0x5c6c66), grasWarm: farbe(0x6e7a66), grasTrocken: farbe(0x86886c),
      erde: farbe(0x4e4438), fels: farbe(0x76786e), schnee: farbe(0xeef0f0),
      sand: farbe(0x8c8a70), seegrund: farbe(0x646a58), tiefe: farbe(0x1e3038),
      tritt: farbe(0x50463a), brandung: farbe(0xd0dcd8),
      driftGelb: farbe(0x8a7a64), driftBlau: farbe(0x5a7a80),
      sandA: 2.4, sandB: 0.4, saumSand: 1.4,
      felsA: 13, felsB: 15, saumFels: 14,
      schneeA: 30, schneeB: 33, saumSchnee: 31.5,
      oase: 0.40, oaseFarbe: farbe(0x4a6270)   // kuehl leuchtende Senken
    },
    hoehe: { amp: 17, fein: 6, sockel: 0, grat: 0.2 },
    veg: {
      dichte: 1.0, abstand: 0.8, blumen: 0.3, unterwuchs: 1.5,
      arten: { nadelbaum: 0.1, zypresse: 0.1, baum: 0.3, baum2: 0.3, bluetenbaum: 0.2 },
      ersatz: "sumpfbaum",          // zerzauste Krone, bis `pilzhut` existiert
      uwTabelle: [["moos", 8], ["farn", 5], ["stumpf", 4], ["stammliegend", 3],
        ["busch", 2], ["fels", 1]]
    },
    wasserTint: [0.8, 0.95, 1.0],
    // Leuchtgruene Sporenwolke — dieselbe kuehle Leuchtfarbe wie die Senken.
    vfx: { typ: "sporen", dichte: 0.8, farbe: 0x9fe8c4 }
  },
  terrassen: {
    label: "Terrassenland",
    terrain: {
      grasKuehl: farbe(0x86a074), grasWarm: farbe(0x9fb27e), grasTrocken: farbe(0xbcbe94),
      erde: farbe(0x8f7c5c), fels: farbe(0x9a978c), schnee: farbe(0xf2f5f6),
      sand: farbe(0xd5c9a8), seegrund: farbe(0xb8bc9c), tiefe: farbe(0x2b5a60),
      tritt: farbe(0x82704f), brandung: farbe(0xf0f6f2),
      driftGelb: farbe(0xbdb478), driftBlau: farbe(0x7ea28c),
      sandA: 1.8, sandB: 0.6, saumSand: 1.2,
      felsA: 14, felsB: 16, saumFels: 15,
      schneeA: 24, schneeB: 26, saumSchnee: 25,
      oase: 0, oaseFarbe: null
    },
    // Kernmerkmal. Die Stufenwangen faerbt die bestehende steil/rock-Logik in
    // terrainColor automatisch erdig ein — kein Zusatzcode.
    hoehe: { amp: 20, fein: 3, sockel: 1, stufe: 2.2, stufeKante: 0.35 },
    veg: {
      dichte: 0.35, blumen: 0.7, unterwuchs: 0.4,
      arten: { sumpfbaum: 0.1, nadelbaum: 0.2 },
      ersatz: "bluetenbaum",
      uwTabelle: [["busch", 4], ["farn", 3], ["moos", 2], ["fels", 2],
        ["stumpf", 1], ["stammliegend", 1]]
    },
    wasserTint: [1.0, 1.05, 1.02]
  },
  nebelwald: {
    label: "Nebelwald",
    terrain: {
      // S 0.14-0.23 — das flachste Biom; der Kontrast kommt ausschliesslich
      // aus der Tiefenstaffelung, also aus dem luft-Block.
      grasKuehl: farbe(0x6f8272), grasWarm: farbe(0x82907a), grasTrocken: farbe(0x99a086),
      erde: farbe(0x6a5f52), fels: farbe(0x8b8f8a), schnee: farbe(0xf0f4f4),
      sand: farbe(0xb8b8a4), seegrund: farbe(0x939c8a), tiefe: farbe(0x22424a),
      tritt: farbe(0x66594a), brandung: farbe(0xe6eeea),
      driftGelb: farbe(0x9aa07c), driftBlau: farbe(0x6f8a8e),
      sandA: 2.0, sandB: 0.6, saumSand: 1.3,
      felsA: 11, felsB: 13, saumFels: 12,
      schneeA: 20, schneeB: 23, saumSchnee: 21.5,
      oase: 0, oaseFarbe: null
    },
    hoehe: { amp: 21, fein: 6, sockel: 1, grat: 0.35 },
    veg: {
      dichte: 1.0, abstand: 0.8, blumen: 0.25, unterwuchs: 1.7,
      arten: { bluetenbaum: 0.1, sumpfbaum: 0.6, zypresse: 0.2 },
      ersatz: "nadelbaum",
      uwTabelle: [["moos", 9], ["farn", 7], ["stammliegend", 3], ["stumpf", 3],
        ["busch", 2], ["fels", 1]]
    },
    wasserTint: [0.92, 0.98, 0.98],
    // Fast weisse Sporen: sie lesen sich als Dunstflocken und verstaerken die
    // Tiefenstaffelung, die dieses Biom traegt.
    vfx: { typ: "sporen", dichte: 0.35, farbe: 0xdfeae2 },
    luft: { fogCoolTint: [0.98, 1.00, 0.99], fogNah: 0.42, fogFern: 0.7,
      fogCapMax: 0.92, hemiBoden: 0x7e8a76, hemiMisch: 0.55, satMitte: 0.90 }
  },
  klippenmeer: {
    label: "Klippenmeer",
    terrain: {
      grasKuehl: farbe(0x7d9068), grasWarm: farbe(0x94a074), grasTrocken: farbe(0xafb086),
      erde: farbe(0x8a7a5e), fels: farbe(0x76808a), schnee: farbe(0xf2f6f8),
      sand: farbe(0xc8c2ae),        // Kies, kein Sand
      seegrund: farbe(0xa8ae9e), tiefe: farbe(0x1c3e50),
      tritt: farbe(0x7e6d52), brandung: farbe(0xf8fbfa),
      driftGelb: farbe(0xaeae76), driftBlau: farbe(0x77949a),
      sandA: 1.0, sandB: -0.6, saumSand: 0.2,   // kaum Strand
      felsA: 1.8, felsB: 3.6, saumFels: 2.6,    // Fels beginnt an der Wasserlinie
      schneeA: 24, schneeB: 26, saumSchnee: 25,
      oase: 0, oaseFarbe: null,
      // Die weissen Gischtsaeume zeichnen jede Kante nach — ohne die
      // Parametrisierung des Brandungssaums traegt dieses Biom kein Bild.
      brandungA: 1.4, brandungB: -0.3, brandungStaerke: 0.8
    },
    // Negativer Sockel plus Grat-Rauschen: Fjordzungen und Halbinseln statt
    // einer durchgehenden Kuestenlinie.
    hoehe: { amp: 24, fein: 7, sockel: -8, grat: 0.55, randTiefe: -26 },
    veg: {
      dichte: 0.35, blumen: 0.9, unterwuchs: 0.5,
      arten: { sumpfbaum: 0, bluetenbaum: 0.1, baum: 0.3, baum2: 0.4 },
      ersatz: "nadelbaum",          // windzerzaust
      uwTabelle: [["fels", 7], ["busch", 4], ["moos", 3], ["stumpf", 1],
        ["farn", 1], ["stammliegend", 1]]
    },
    wasserTint: [0.85, 0.98, 1.08]
  },
  korallenbank: {
    label: "Korallenbank",
    terrain: {
      grasKuehl: farbe(0x9aa878), grasWarm: farbe(0xb2b884), grasTrocken: farbe(0xc6c294),
      erde: farbe(0xa89272), fels: farbe(0xa8a294), schnee: farbe(0xf4f6f8),
      sand: farbe(0xeee2c4), seegrund: farbe(0xcfd2b0), tiefe: farbe(0x1d5e6e),
      tritt: farbe(0x9a8a66), brandung: farbe(0xfafcf8),
      driftGelb: farbe(0xc9c088), driftBlau: farbe(0x86b0ac),
      // Die Sandbank reicht weit unter Wasser und bleibt sichtbar.
      sandA: 5.5, sandB: -3.5, saumSand: 1.0,
      felsA: 12, felsB: 14, saumFels: 13,
      schneeA: 28, schneeB: 31, saumSchnee: 29.5,
      // Korallengaerten im Flachwasser: die Oasenlogik greift unter h ~2.4
      // und liegt damit genau richtig.
      oase: 0.50, oaseFarbe: farbe(0x6f9aa0)
    },
    hoehe: { amp: 8, fein: 2.5, sockel: -4, randTiefe: -12, grat: 0 },
    veg: {
      dichte: 0.25, blumen: 0.3, unterwuchs: 0.4,
      arten: { nadelbaum: 0, zypresse: 0.1, sumpfbaum: 0.1, bluetenbaum: 0.2 },
      ersatz: "baum",               // bis `palme` existiert
      uwTabelle: [["busch", 5], ["fels", 3], ["moos", 1], ["stumpf", 1],
        ["stammliegend", 1]]
    },
    wasserTint: [1.10, 1.25, 1.15]
  }
};

/** Szene wird von main gesetzt; Module holen sie hier. */
export const sceneRef = { scene: null };
export function setScene(sc) { sceneRef.scene = sc; }

export function nextSeed() {
  S.elementSeedCounter = (S.elementSeedCounter + 0x9e3779b9) | 0;
  return S.elementSeedCounter;
}

export function mkElement(kind, variant, points, params, seed) {
  return {
    id: S.nextId++,
    kind: kind,             // pfad | flaeche | objekt | ranke
    variant: variant,
    points: points,         // [{x,z}]
    params: params,
    seed: seed,
    inst: {},               // Instanzdaten je Pool
    schatten: [],           // abgeleitete Kontaktschatten (nicht gespeichert)
    rauch: [],              // Schornsteinpositionen für den Rauch
    total: 0,
    group: null,            // eigene Meshes (Ranken, Flusswasser)
    streets: null           // Viertel: erzeugtes Wegenetz
  };
}

export function groupOf(el) {
  if (!el.group) { el.group = new THREE.Group(); sceneRef.scene.add(el.group); }
  return el.group;
}

export function clearElement(el) {
  el.inst = {};
  el.schatten.length = 0;
  el.rauch.length = 0;
  el.total = 0;
  if (el.group) {
    for (var i = el.group.children.length - 1; i >= 0; i--) {
      var c = el.group.children[i];
      if (c.geometry) c.geometry.dispose();
      // Materialien: alle Erzeuger von Element-Kind-Meshes (paths.js,
      // vines.js) nutzen geteilte Modul-Materialien (wegBandMat, flussMat,
      // vineMat, leafMat, rockMat) — die duerfen hier NICHT disposed werden,
      // sonst verlieren alle anderen Elemente ihr Material. Konvention:
      // nur Meshes mit userData.eigenesMaterial = true besitzen ein
      // exklusives Material und geben es hier frei. Das ist der einfachste
      // Weg, der garantiert kein geteiltes Material zerstoert.
      if (c.userData && c.userData.eigenesMaterial && c.material) {
        if (Array.isArray(c.material)) {
          for (var mi = 0; mi < c.material.length; mi++) c.material[mi].dispose();
        } else {
          c.material.dispose();
        }
      }
      el.group.remove(c);
    }
  }
}

export function dropElement(el) {
  clearElement(el);
  if (el.group) { sceneRef.scene.remove(el.group); el.group = null; }
  var i = S.elements.indexOf(el);
  if (i >= 0) S.elements.splice(i, 1);
}

export function serializeElements() {
  var out = [];
  for (var i = 0; i < S.elements.length; i++) {
    var e = S.elements[i];
    out.push({ id: e.id, kind: e.kind, variant: e.variant, points: e.points,
      params: e.params, seed: e.seed });
  }
  return out;
}

export function hydrate(list) {
  while (S.elements.length) dropElement(S.elements[0]);
  for (var i = 0; i < list.length; i++) {
    var d = list[i];
    var el = mkElement(d.kind, d.variant, d.points, d.params, d.seed);
    el.id = d.id || el.id;
    S.nextId = Math.max(S.nextId, el.id + 1);
    S.elements.push(el);
  }
}

/* ==========================================================================
   D1 — Marker
   Datenmodell: { x, z, text, art }. `art` ist eine der MARKER_ARTEN und
   steuert ausschliesslich die Farbe der Stecknadel (selection.js); eine
   unbekannte Art faellt beim Laden auf "ort" zurueck, damit eine fremde
   Datei nie eine unbezeichnete Nadel erzeugt. Kein Seed, keine Parameter:
   ein Marker wird nicht generiert, er wird gesetzt.
   ========================================================================== */
export const MARKER_ARTEN = ["ort", "gefahr", "notiz", "arbor"];

export function mkMarker(x, z, text, art) {
  return {
    x: +x, z: +z,
    text: typeof text === "string" ? text : "",
    art: MARKER_ARTEN.indexOf(art) >= 0 ? art : "ort"
  };
}

/** Kartenfeld `marker` — flach, ohne Laufzeitfelder (es gibt keine). */
export function serializeMarker() {
  var out = [];
  for (var i = 0; i < S.marker.length; i++) {
    var m = S.marker[i];
    out.push({ x: m.x, z: m.z, text: m.text, art: m.art });
  }
  return out;
}

/** Uebernimmt eine bereits gepruefte Markerliste (io.js validiert streng). */
export function hydrateMarker(list) {
  S.marker.length = 0;
  if (!Array.isArray(list)) return;
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.z)) continue;
    S.marker.push(mkMarker(m.x, m.z, m.text, m.art));
  }
}

/* ==========================================================================
   A3 — Stempel
   Datenmodell: { name, anker:{x,z}, elemente:[{kind, variant, points, params}] }
   Die Punkte liegen RELATIV zum Anker; `anker` selbst dokumentiert nur, wo
   der Stempel ausgeschnitten wurde (beim Setzen zaehlt die Mausposition).
   BEWUSST OHNE seed: ein Stempel wird nie identisch gesetzt, die Seeds
   vergibt stempelSetzen() frisch ueber nextSeed().
   BEWUSST OHNE Terrainhoehen: der Stempel setzt Elemente, kein Gelaende.
   Hoehen sind ein globales Feld (base) mit Fluss-/Bruchstempeln darauf; ein
   mitkopierter Hoehenausschnitt wuerde beim Setzen fremdes Relief in die
   Karte schneiden, das Delta-Speicherformat aufblaehen und mit jeder
   Terrainbearbeitung an dieser Stelle kollidieren.
   ========================================================================== */

/** Tolerante Strukturpruefung fuer die localStorage-Bibliothek: kaputte
 *  Eintraege werden verworfen statt geworfen. Die STRENGE Pruefung des
 *  Kartenfelds `stempel` steht in io.js/validiereKarte (atomar, mit
 *  Fehlermeldung) — hier waere ein Wurf falsch, weil ein defekter
 *  Browser-Speicher den Editor nicht am Starten hindern darf. */
export function stempelGueltig(st) {
  if (!st || typeof st !== "object" || Array.isArray(st)) return false;
  if (typeof st.name !== "string" || !st.name) return false;
  if (!st.anker || !Number.isFinite(st.anker.x) || !Number.isFinite(st.anker.z)) return false;
  if (!Array.isArray(st.elemente) || !st.elemente.length) return false;
  for (var i = 0; i < st.elemente.length; i++) {
    var e = st.elemente[i];
    if (!e || typeof e !== "object" || typeof e.kind !== "string" || !e.kind) return false;
    if (e.variant !== undefined && typeof e.variant !== "string") return false;
    if (!Array.isArray(e.points) || !e.points.length) return false;
    for (var p = 0; p < e.points.length; p++) {
      var q = e.points[p];
      if (!q || !Number.isFinite(q.x) || !Number.isFinite(q.z)) return false;
    }
    if (e.params !== undefined &&
        (typeof e.params !== "object" || e.params === null || Array.isArray(e.params))) return false;
  }
  return true;
}

/** Kartenfeld `stempel` — tiefe Kopie, damit spaetere Bearbeitungen der
 *  Bibliothek die gespeicherte Datei nicht nachtraeglich veraendern. */
export function serializeStempel() {
  return JSON.parse(JSON.stringify(S.stempel));
}

/* ==========================================================================
   Browser-Speicher (A3 Bibliothek, D6 Autosave). Einzige Stelle, die
   localStorage anfasst: der Zugriff wirft im Privatmodus, bei blockierten
   Cookies und in jeder Nicht-Browser-Umgebung (Testlaeufe). Alle Aufrufer
   bekommen deshalb null bzw. false statt einer Ausnahme.
   ========================================================================== */
export function speicherLesen(schluessel) {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(schluessel);
  } catch (e) { return null; }
}
export function speicherSchreiben(schluessel, wert) {
  try {
    if (typeof localStorage === "undefined") return false;
    localStorage.setItem(schluessel, wert);
    return true;
  } catch (e) { return false; }     // Kontingent voll oder Speicher gesperrt
}

