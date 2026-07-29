// Kerndefinition des Luftarchipel-Bioms. Sie liegt bewusst in core/:
// biomfeld.js bildet seine stabilen Indizes bereits vor dem Laden der UI.
import * as THREE from 'three';

function farbe(hex) { return new THREE.Color(hex); }

/** Liefert eine frische Biomdefinition fuer Store und isolierte Registries. */
export function erstelleLuftarchipelBiom() {
  return {
    label: 'Luftarchipel',
    terrain: {
      grasKuehl: farbe(0x718a78), grasWarm: farbe(0x91a47c),
      grasTrocken: farbe(0xa8a68a), erde: farbe(0x7a7566),
      fels: farbe(0x7f8990), schnee: farbe(0xeef4f5),
      sand: farbe(0xc9c7aa), seegrund: farbe(0x83949a),
      tiefe: farbe(0x244e63), tritt: farbe(0x756b58),
      brandung: farbe(0xe9f2ef), driftGelb: farbe(0xb3ae78),
      driftBlau: farbe(0x6f9197),
      sandA: 1.6, sandB: 0.4, saumSand: 1.0,
      felsA: 8.5, felsB: 11.5, saumFels: 10,
      schneeA: 28, schneeB: 32, saumSchnee: 30,
      oase: 0, oaseFarbe: null
    },
    hoehe: {
      amp: 5.5, fein: 1.5, sockel: -38, randTiefe: -52, randBreite: 36,
      grat: 0.12, stufe: 0, stufeKante: 0.8, senken: 0
    },
    veg: {
      dichte: 0.38, blumen: 0.45, unterwuchs: 0.42,
      arten: {
        baum: 0.42, baum2: 0.35, bluetenbaum: 0.65,
        nadelbaum: 0.12, sumpfbaum: 0
      },
      ersatz: 'bluetenbaum', uwTabelle: null
    },
    wasserTint: [0.78, 0.96, 1.08],
    luft: {
      fogWarmTint: [1.06, 1.03, 0.96], fogCoolTint: [0.86, 0.98, 1.10],
      fogNah: 1.12, fogFern: 1.34, fogCapMax: 1200,
      hemiBoden: 0x657987, hemiMisch: 0.32,
      satMitte: 1.06, wolkenschatten: 0.72
    },
    vfx: { typ: 'blueten', dichte: 0.32, farbe: 0xd6e8df }
  };
}
