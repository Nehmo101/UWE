/**
 * Datenkatalog der märchenhaften Architektur.
 *
 * Der Katalog trennt Kultur, Bautyp und Geometrie strikt. Dadurch kann jede
 * Kultur jeden Bautyp besitzen, ohne 216 handgeschriebene Registrierungen zu
 * pflegen. Pool-IDs bleiben absichtlich ASCII und werden niemals übersetzt.
 */

function palette(wand, dach, akzent, holz, fenster) {
  return Object.freeze({ wand, dach, akzent, holz, fenster });
}

function stil(id, label, kultur, kulturGruppe, form, dach, ornament, familie, farben, mass, schlankheit) {
  return Object.freeze({
    id, label, kultur, kulturGruppe, form, dach, ornament, familie,
    palette: farben, mass, schlankheit
  });
}

/**
 * Zwölf eigenständige Bildsprachen. `form`, `dach` und `ornament` sind keine
 * bloßen Labels: architektur-geometrie.js wertet alle drei unabhängig aus.
 */
export const ARCHITEKTUR_STILE = Object.freeze([
  stil("mondelfen", "Mondelfen", "Lunara-Höfe", "lichtreiche",
    "filigran", "blatt", "mond", "putz",
    palette(0xdce7df, 0x789b98, 0xf0cf83, 0x9a8065, 0xa7e7db), 1.04, 1.34),
  stil("tiefenzwerge", "Tiefenzwerge", "Basaltthrone", "erdreiche",
    "massiv", "stufe", "rune", "stein",
    palette(0x8d8478, 0x625d58, 0xe2aa5a, 0x6e5542, 0xffc16f), 1.13, 0.76),
  stil("windweiden", "Windweiden", "Hirten der singenden Hügel", "wanderreiche",
    "windschief", "schindel", "wirbel", "holz",
    palette(0xc8b890, 0x78916f, 0xf0d48a, 0x80684d, 0xcce8bd), 0.96, 1.08),
  stil("kupfernomaden", "Kupfernomaden", "Karawanen von Sahr", "wanderreiche",
    "zeltartig", "zelt", "sonne", "metall",
    palette(0xb9754c, 0x704c5b, 0xf1c66b, 0x6d4938, 0xffd47a), 1.02, 0.94),
  stil("korallenhoefe", "Korallenhöfe", "Pelagische Fürstentümer", "wasserreiche",
    "korallin", "muschel", "perle", "putz",
    palette(0xe0a58d, 0x5f9ca2, 0xf4d5b7, 0x735f67, 0xa9eff0), 1.07, 1.16),
  stil("pilzmarken", "Pilzmarken", "Sporenbund von Myra", "erdreiche",
    "pilzartig", "pilz", "spore", "rinde",
    palette(0xc8b889, 0x9a5269, 0xe2c978, 0x73543f, 0xc9e69a), 0.98, 0.88),
  stil("wolkenkloster", "Wolkenklöster", "Orden des hohen Atems", "lichtreiche",
    "schwebend", "wolke", "feder", "putz",
    palette(0xe8e4d4, 0x8aa9c2, 0xf2c875, 0x8c7961, 0xcbeeff), 1.01, 1.28),
  stil("wurzelbund", "Wurzelbund", "Hüter des alten Hains", "erdreiche",
    "organisch", "krone", "blattader", "rinde",
    palette(0x907857, 0x557154, 0xd6bd6a, 0x5d4937, 0xbfe39b), 1.09, 1.02),
  stil("kristallorden", "Kristallorden", "Prismatische Konvente", "lichtreiche",
    "kristallin", "kristall", "prisma", "stein",
    palette(0xb7c8d5, 0x6e72a8, 0xe2b9ef, 0x70647a, 0xc5f5ff), 1.00, 1.38),
  stil("schilfinseln", "Schilfinseln", "Delta-Gemeinschaften", "wasserreiche",
    "gestelzt", "schilf", "welle", "holz",
    palette(0xc9b278, 0x817d4c, 0xe2d49a, 0x66553f, 0xa8d9d0), 1.05, 1.06),
  stil("sternensteppe", "Sternensteppe", "Astrologen der weiten Nacht", "wanderreiche",
    "kuppelig", "stern", "stern", "stoff",
    palette(0x8a7895, 0x3f4c72, 0xe4c46b, 0x604d62, 0xb9d8ff), 1.03, 1.12),
  stil("drachenbasalt", "Drachenbasalt", "Glutclans der Caldera", "feuerreiche",
    "vulkanisch", "basalt", "flamme", "stein",
    palette(0x554d49, 0x2e2b2d, 0xd16d43, 0x5b4033, 0xff8b58), 1.14, 0.91)
]);

function variante(id, label, gruppe, profil, breite, tiefe, hoehe, etagen, radius) {
  return Object.freeze({ id, label, gruppe, profil, breite, tiefe, hoehe, etagen, radius });
}

/** Achtzehn klar getrennte Bautypen pro Stil. */
export const ARCHITEKTUR_VARIANTEN = Object.freeze([
  variante("wohnhaus", "Wohnhaus", "wohnen", "haus", 3.2, 2.6, 2.5, 1, 2.5),
  variante("langhaus", "Langhaus", "wohnen", "langhaus", 5.4, 2.8, 2.8, 1, 3.5),
  variante("turmhaus", "Turmhaus", "wohnen", "turm", 2.5, 2.4, 5.2, 3, 2.3),
  variante("gasthaus", "Gasthaus", "gemeinschaft", "gasthaus", 4.5, 3.5, 3.7, 2, 3.4),
  variante("rathaus", "Rathaus", "gemeinschaft", "rathaus", 5.6, 4.0, 5.1, 2, 4.2),
  variante("markthalle", "Markthalle", "gemeinschaft", "halle", 6.4, 4.2, 3.6, 1, 4.4),
  variante("werkstatt", "Werkstatt", "handwerk", "werkstatt", 4.1, 3.2, 3.0, 1, 3.1),
  variante("schmiede", "Schmiede", "handwerk", "schmiede", 3.8, 3.1, 3.3, 1, 3.0),
  variante("bibliothek", "Bibliothek", "wissen", "bibliothek", 5.0, 4.0, 5.6, 3, 4.0),
  variante("tempel", "Tempel", "sakral", "tempel", 5.8, 5.0, 5.8, 2, 4.7),
  variante("schrein", "Wegschrein", "sakral", "schrein", 2.0, 1.8, 3.1, 1, 1.8),
  variante("torhaus", "Torhaus", "wehr", "tor", 5.2, 2.8, 5.0, 2, 4.0),
  variante("wehrturm", "Wehrturm", "wehr", "wehrturm", 3.4, 3.4, 6.5, 3, 3.0),
  variante("palast", "Palast", "herrschaft", "palast", 7.2, 5.2, 6.0, 3, 5.4),
  variante("bruecke", "Bogenbrücke", "infrastruktur", "bruecke", 7.4, 2.2, 2.7, 1, 4.5),
  variante("windmuehle", "Windmühle", "infrastruktur", "muehle", 3.0, 3.0, 6.2, 3, 3.2),
  variante("observatorium", "Observatorium", "wissen", "observatorium", 4.4, 4.4, 5.8, 2, 3.8),
  variante("gartenpavillon", "Gartenpavillon", "gemeinschaft", "pavillon", 4.2, 4.2, 3.8, 1, 3.4)
]);

/** Bautyp-Gruppen für Auswahlfelder und Generatorgewichte. */
export const ARCHITEKTUR_GRUPPEN = Object.freeze({
  wohnen: Object.freeze({ label: "Wohnen", varianten: Object.freeze(["wohnhaus", "langhaus", "turmhaus"]) }),
  gemeinschaft: Object.freeze({
    label: "Gemeinschaft",
    varianten: Object.freeze(["gasthaus", "rathaus", "markthalle", "gartenpavillon"])
  }),
  handwerk: Object.freeze({ label: "Handwerk", varianten: Object.freeze(["werkstatt", "schmiede"]) }),
  wissen: Object.freeze({ label: "Wissen", varianten: Object.freeze(["bibliothek", "observatorium"]) }),
  sakral: Object.freeze({ label: "Sakral", varianten: Object.freeze(["tempel", "schrein"]) }),
  wehr: Object.freeze({ label: "Wehrbau", varianten: Object.freeze(["torhaus", "wehrturm"]) }),
  herrschaft: Object.freeze({ label: "Herrschaft", varianten: Object.freeze(["palast"]) }),
  infrastruktur: Object.freeze({ label: "Infrastruktur", varianten: Object.freeze(["bruecke", "windmuehle"]) })
});

/** Kulturgruppen sind bewusst getrennt von den Bautyp-Gruppen. */
export const ARCHITEKTUR_KULTURGRUPPEN = Object.freeze({
  lichtreiche: Object.freeze({
    label: "Lichtreiche",
    stile: Object.freeze(["mondelfen", "wolkenkloster", "kristallorden"])
  }),
  erdreiche: Object.freeze({
    label: "Erdreiche",
    stile: Object.freeze(["tiefenzwerge", "pilzmarken", "wurzelbund"])
  }),
  wanderreiche: Object.freeze({
    label: "Wanderreiche",
    stile: Object.freeze(["windweiden", "kupfernomaden", "sternensteppe"])
  }),
  wasserreiche: Object.freeze({
    label: "Wasserreiche",
    stile: Object.freeze(["korallenhoefe", "schilfinseln"])
  }),
  feuerreiche: Object.freeze({
    label: "Feuerreiche",
    stile: Object.freeze(["drachenbasalt"])
  })
});

export const ARCHITEKTUR_KULTUREN = Object.freeze(Object.fromEntries(
  ARCHITEKTUR_STILE.map((s) => [s.id, Object.freeze({
    label: s.kultur,
    baustil: s.label,
    gruppe: s.kulturGruppe,
    ornament: s.ornament
  })])
));

export function architekturAssetId(stilId, variantenId) {
  return "arch_" + stilId + "_" + variantenId;
}

export const ARCHITEKTUR_ASSETS = Object.freeze(ARCHITEKTUR_STILE.flatMap((s, stilIndex) =>
  ARCHITEKTUR_VARIANTEN.map((v, variantenIndex) => Object.freeze({
    id: architekturAssetId(s.id, v.id),
    label: s.label + " · " + v.label,
    stilId: s.id,
    variantenId: v.id,
    stilIndex,
    variantenIndex,
    gruppe: v.gruppe,
    kulturGruppe: s.kulturGruppe
  }))
));

export const ARCHITEKTUR_ASSET_NAMEN = Object.freeze(ARCHITEKTUR_ASSETS.map((a) => a.id));
export const ARCHITEKTUR_ASSET_LABELS = Object.freeze(Object.fromEntries(
  ARCHITEKTUR_ASSETS.map((a) => [a.id, a.label])
));
export const ARCHITEKTUR_ASSET_COUNT = ARCHITEKTUR_ASSET_NAMEN.length;

/*
 * Gewichtete Tabellen fuer Viertel, Strassenrand, Blattstaedte und das
 * Objektwerkzeug. Die Gewichte haengen an der Rolle, nicht am Kulturstil:
 * Wohnhaeuser bilden den Teppich, Palast und Observatorium bleiben
 * Landmarken. Jede Kultur bekommt dadurch dieselbe vollstaendige Grammatik,
 * ohne 216 Eintraege in generators/objects.js zu duplizieren.
 */
const ARCHITEKTUR_ROLLEN_GEWICHT = Object.freeze({
  wohnhaus: 7, langhaus: 5, turmhaus: 3,
  gasthaus: 3, rathaus: 2, markthalle: 2,
  werkstatt: 4, schmiede: 3,
  bibliothek: 1, tempel: 1, schrein: 3,
  torhaus: 1, wehrturm: 2, palast: 1,
  bruecke: 1, windmuehle: 1, observatorium: 1, gartenpavillon: 2
});

export const ARCHITEKTUR_STIL_TABELLEN = Object.freeze(Object.fromEntries(
  ARCHITEKTUR_STILE.map((s) => [s.id, Object.freeze(
    ARCHITEKTUR_VARIANTEN.map((v) => Object.freeze([
      architekturAssetId(s.id, v.id),
      ARCHITEKTUR_ROLLEN_GEWICHT[v.id] || 1
    ]))
  )])
));

if (ARCHITEKTUR_STILE.length !== 12 || ARCHITEKTUR_VARIANTEN.length !== 18 ||
    ARCHITEKTUR_ASSET_COUNT !== 216 || new Set(ARCHITEKTUR_ASSET_NAMEN).size !== 216 ||
    ARCHITEKTUR_ASSET_NAMEN.some((id) => !/^[a-z0-9_]+$/.test(id))) {
  throw new Error("Architektur-Katalog verletzt den stabilen 12×18-Assetvertrag");
}
