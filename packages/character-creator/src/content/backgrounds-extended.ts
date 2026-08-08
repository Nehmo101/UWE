/**
 * Erweiterte Hintergründe aus Owner-Notizen (Kanka-Export).
 *
 * Die zwölf Einträge ergänzen die vier SRD-Hintergründe in `backgrounds.ts`.
 * Mechanik folgt den Owner-Notizen; Flavour ist für Terra (Validori / Nepurga /
 * Arbor-Saum) umgeschrieben — keine Tegora-/FR-Referenzen.
 *
 * Ability-Anzeigenamen in Prosa: Strength, Dexterity, Constitution,
 * Intelligence, Wisdom, Charisma (englisch, Produktregel).
 */

import { OWNER_NOTES_SOURCE, type Background } from "../types";

function goldOrPack(descriptionCore: string, gold: number): string {
  return (
    descriptionCore +
    `\n\nAusrüstung: Wähle A oder B — (A) das unten gelistete Paket samt ${gold} GM, ` +
    "oder (B) stattdessen 50 GM."
  );
}

/** Die 12 nicht-SRD-Hintergründe aus den Owner-Notizen. */
export const BACKGROUNDS_EXTENDED: Background[] = [
  {
    key: "handwerker",
    name: "Handwerker",
    nameEn: "Artisan",
    hook:
      "In Validori zählt, was deine Hände aus Metall, Holz oder Stoff machen — " +
      "und wen du davon überzeugen kannst, es zu kaufen.",
    description: goldOrPack(
      "Du hast eine Zunft oder Werkstatt geprägt: Maß nehmen, Werkzeug wählen, " +
        "Fristen halten. Am Arbor-Saum und in den Gassen Validoris kennt man dich " +
        "als jemanden, der weiß, was ein Auftrag wirklich kostet.\n\n" +
        "Am Tisch bringt der Handwerker Strength, Dexterity und Intelligence sowie " +
        "das Ursprungstalent „Handwerker“ — ideal, wenn Ausrüstung und Verhandlungen " +
        "genauso zählen wie der nächste Kampf.",
      32,
    ),
    abilityOptions: ["strength", "dexterity", "intelligence"],
    skills: ["investigation", "persuasion"],
    toolProficiency: "Ein Handwerkszeug deiner Wahl",
    originFeat: "handwerker",
    equipment: [
      "Handwerkszeug (dasselbe wie oben)",
      "2 Beutel",
      "Reisekleidung",
    ],
    startingGold: 32,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "scharlatan",
    name: "Scharlatan",
    nameEn: "Charlatan",
    hook:
      "Zwischen Hafenwirtschaft und Magisterhof weißt du, welche Geschichte man " +
      "glauben will — und wie man sie verkauft.",
    description: goldOrPack(
      "Du hast von falschen Heilmitteln, gefälschten Papieren und gut gespielten " +
        "Identitäten gelebt. In Validori und entlang der Handelswege Nepurgas " +
        "reicht oft ein Lächeln und ein Siegel, das fast echt aussieht.\n\n" +
        "Regeltechnisch deckt er Dexterity, Constitution und Charisma ab, mit " +
        "Fertigkeiten für Täuschung und Fingerfertigkeit sowie dem Talent „Begabt“.",
      15,
    ),
    abilityOptions: ["dexterity", "constitution", "charisma"],
    skills: ["deception", "sleight_of_hand"],
    toolProficiency: "Fälscherwerkzeug",
    originFeat: "begabt",
    equipment: ["Fälscherwerkzeug", "Kostüm", "Feine Kleidung"],
    startingGold: 15,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "unterhalter",
    name: "Unterhalter",
    nameEn: "Entertainer",
    hook:
      "Ob Marktbühne in Validori oder Lagerfeuer am Arbor-Saum — wenn du " +
      "auftreten, hören die Leute zu.",
    description: goldOrPack(
      "Musik, Akrobatik, Stimme: Du hast gelernt, eine Menge zu halten und im " +
        "richtigen Moment den Ton zu wechseln. Truppen, Karawanen und Hafenschenken " +
        "waren deine Schulen.\n\n" +
        "Attribute: Strength, Dexterity, Charisma. Talent „Musiker“.",
      11,
    ),
    abilityOptions: ["strength", "dexterity", "charisma"],
    skills: ["acrobatics", "performance"],
    toolProficiency: "Ein Musikinstrument deiner Wahl",
    originFeat: "musiker",
    equipment: [
      "Musikinstrument (dasselbe wie oben)",
      "2 Kostüme",
      "Spiegel",
      "Parfüm",
      "Reisekleidung",
    ],
    startingGold: 11,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "bauer",
    name: "Bauer",
    nameEn: "Farmer",
    hook:
      "Du kennst Wetter, Boden und Vieh besser als jede Stadtkarte — und " +
      "hältst durch, wenn andere schon aufgeben.",
    description: goldOrPack(
      "Felder, Ställe und die harte Saison zwischen Erntemond und Frostmond " +
        "haben dich geformt. Ob Hof am Inneren Meer oder Rodung Richtung Arbor: " +
        "Arbeit war nie optional.\n\n" +
        "Attribute: Strength, Constitution, Wisdom. Talent „Zäh“.",
      30,
    ),
    abilityOptions: ["strength", "constitution", "wisdom"],
    skills: ["animal_handling", "nature"],
    toolProficiency: "Zimmererwerkzeug",
    originFeat: "zaeh",
    equipment: [
      "Sichel",
      "Zimmererwerkzeug",
      "Heilerausrüstung",
      "Eisentopf",
      "Schaufel",
      "Reisekleidung",
    ],
    startingGold: 30,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "wache",
    name: "Wache",
    nameEn: "Guard",
    hook:
      "Tor, Wall, Nachtwache: Du hast gelernt, wer reingehört — und wer " +
      "nur so tut.",
    description: goldOrPack(
      "Stadtgarde Validori, Karawanenschutz oder Garnison an einer Nepurga-Straße: " +
        "Du kennst Schichtpläne, Alarmzeichen und das Gewicht einer Lanze in der Hand.\n\n" +
        "Attribute: Strength, Intelligence, Wisdom. Talent „Wachsam“.",
      12,
    ),
    abilityOptions: ["strength", "intelligence", "wisdom"],
    skills: ["athletics", "perception"],
    toolProficiency: "Ein Spielset deiner Wahl",
    originFeat: "wachsam",
    equipment: [
      "Speer",
      "Leichte Armbrust",
      "20 Bolzen",
      "Spielset (dasselbe wie oben)",
      "Verdeckte Laterne",
      "Handschellen",
      "Köcher",
      "Reisekleidung",
    ],
    startingGold: 12,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "kundschafter",
    name: "Kundschafter",
    nameEn: "Guide",
    hook:
      "Pfade am Arbor-Saum, Furten und Jägerzeichen — du bringst andere " +
      "durch, ohne Spuren zu hinterlassen.",
    description: goldOrPack(
      "Als Führer, Wildhüter oder Grenzläufer hast du Karten im Kopf und " +
        "den Bogen griffbereit. Magie der Wildnis war nie Theorie, sondern Werkzeug.\n\n" +
        "Attribute: Dexterity, Constitution, Wisdom. Talent „Eingeweihter der Magie (Druide)“.",
      3,
    ),
    abilityOptions: ["dexterity", "constitution", "wisdom"],
    skills: ["stealth", "survival"],
    toolProficiency: "Kartografenwerkzeug",
    originFeat: "eingeweihter-der-magie-druide",
    equipment: [
      "Kurzbogen",
      "20 Pfeile",
      "Kartografenwerkzeug",
      "Schlafrolle",
      "Köcher",
      "Zelt",
      "Reisekleidung",
    ],
    startingGold: 3,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "einsiedler",
    name: "Einsiedler",
    nameEn: "Hermit",
    hook:
      "Abseits der Gilden Validoris hast du Heilkunde, Gebet und Stille " +
      "geübt — bis die Welt dich wieder holte.",
    description: goldOrPack(
      "Klause, Schrein oder Hütte am Waldrand: Du hast dich zurückgezogen, " +
        "um zu heilen, zu forschen oder zu sühnen. Was du mitbringst, ist Geduld " +
        "und die Fähigkeit, Wunden zu lesen.\n\n" +
        "Attribute: Constitution, Wisdom, Charisma. Talent „Heiler“.",
      16,
    ),
    abilityOptions: ["constitution", "wisdom", "charisma"],
    skills: ["medicine", "religion"],
    toolProficiency: "Kräuterkunde-Ausrüstung",
    originFeat: "heiler",
    equipment: [
      "Kampfstab",
      "Kräuterkunde-Ausrüstung",
      "Schlafrolle",
      "Buch (Philosophie)",
      "Lampe",
      "Öl (3 Flaschen)",
      "Reisekleidung",
    ],
    startingGold: 16,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "kaufmann",
    name: "Kaufmann",
    nameEn: "Merchant",
    hook:
      "Zölle, Kurse und das Gerücht, welches Schiff zuerst Validori erreicht — " +
      "das ist dein Schlachtfeld.",
    description: goldOrPack(
      "Handel zwischen Hafen, Fluss und Landroute: Du hast gelernt, Risiken " +
        "zu rechnen und Menschen zu lesen. Nepurgas Straßen und Validoris Märkte " +
        "sind dir vertrauter als jede Kaserne.\n\n" +
        "Attribute: Constitution, Intelligence, Charisma. Talent „Glückspilz“.",
      22,
    ),
    abilityOptions: ["constitution", "intelligence", "charisma"],
    skills: ["animal_handling", "persuasion"],
    toolProficiency: "Navigationswerkzeug",
    originFeat: "glueckspilz",
    equipment: ["Navigationswerkzeug", "2 Beutel", "Reisekleidung"],
    startingGold: 22,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "adliger",
    name: "Adliger",
    nameEn: "Noble",
    hook:
      "Name, Siegel und die richtige Anrede öffnen Türen — in Validori " +
      "genauso wie an einem Nepurga-Hof.",
    description: goldOrPack(
      "Du kennst Etikette, Allianzen und die Kosten eines öffentlichen Fehlers. " +
        "Ob ererbter Rang oder erkauftes Ansehen: Du weißt, wann man spricht und " +
        "wann man schweigt.\n\n" +
        "Attribute: Strength, Intelligence, Charisma. Talent „Begabt“.",
      29,
    ),
    abilityOptions: ["strength", "intelligence", "charisma"],
    skills: ["history", "persuasion"],
    toolProficiency: "Ein Spielset deiner Wahl",
    originFeat: "begabt",
    equipment: [
      "Spielset (dasselbe wie oben)",
      "Feine Kleidung",
      "Parfüm",
    ],
    startingGold: 29,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "matrose",
    name: "Matrose",
    nameEn: "Sailor",
    hook:
      "Tauwerk, Sturm und die Kneipe am Kai — das Innere Meer hat dich " +
      "härter gemacht als jede Parade.",
    description: goldOrPack(
      "Du hast auf Handelsschiffen, Fischkuttern oder Kurieren gedient. " +
        "Validoris Hafen war Start und Ziel; dazwischen zählten Balance, Blick " +
        "und die Faust, wenn Worte nicht reichten.\n\n" +
        "Attribute: Strength, Dexterity, Wisdom. Talent „Wirtshausraufbold“.",
      20,
    ),
    abilityOptions: ["strength", "dexterity", "wisdom"],
    skills: ["acrobatics", "perception"],
    toolProficiency: "Navigationswerkzeug",
    originFeat: "wirtshausraufbold",
    equipment: [
      "Dolch",
      "Navigationswerkzeug",
      "Seil",
      "Reisekleidung",
    ],
    startingGold: 20,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "schreiber",
    name: "Schreiber",
    nameEn: "Scribe",
    hook:
      "Akten, Verträge, Randnotizen im Magister-Turm — du findest, was " +
      "andere überlesen.",
    description: goldOrPack(
      "Kanzlei, Archiv oder Gildenschreibstube: Du hast gelernt, Texte zu " +
        "ordnen und Widersprüche zu riechen. In Validori ist das Macht, die " +
        "leise wirkt.\n\n" +
        "Attribute: Dexterity, Intelligence, Wisdom. Talent „Begabt“.",
      23,
    ),
    abilityOptions: ["dexterity", "intelligence", "wisdom"],
    skills: ["investigation", "perception"],
    toolProficiency: "Kalligrafiewerkzeug",
    originFeat: "begabt",
    equipment: [
      "Kalligrafiewerkzeug",
      "Feine Kleidung",
      "Lampe",
      "Öl (3 Flaschen)",
      "Pergament (12 Blätter)",
    ],
    startingGold: 23,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "wanderer",
    name: "Wanderer",
    nameEn: "Wayfarer",
    hook:
      "Straßen, Schleichwege und fremde Tore — du bleibst in Bewegung, " +
      "bevor dich jemand festnagelt.",
    description: goldOrPack(
      "Ob Flucht, Suche oder schlichte Unruhe: Du hast gelernt, leicht zu " +
        "packen und Gesichter zu lesen. Zwischen Arbor-Saum und Hafenmauern " +
        "bist du selten lange am selben Feuer.\n\n" +
        "Attribute: Dexterity, Wisdom, Charisma. Talent „Glückspilz“.",
      16,
    ),
    abilityOptions: ["dexterity", "wisdom", "charisma"],
    skills: ["insight", "stealth"],
    toolProficiency: "Diebeswerkzeug",
    originFeat: "glueckspilz",
    equipment: [
      "2 Dolche",
      "Diebeswerkzeug",
      "Spielset (beliebig)",
      "Schlafrolle",
      "2 Beutel",
      "Reisekleidung",
    ],
    startingGold: 16,
    source: OWNER_NOTES_SOURCE,
  },
];
