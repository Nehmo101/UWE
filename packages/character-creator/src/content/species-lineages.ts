/**
 * Abstammungen, Erben und Ahnenreihen der Spezies.
 *
 * Ausgelagert aus `species.ts`, weil beides zusammen das 700-Zeilen-Budget
 * sprengt (siehe CLAUDE.md § Modul-Disziplin). `species.ts` importiert die
 * Listen hier und reicht sie über `SPECIES[…].lineages` weiter — für
 * Bestandscode exportiert `species.ts` sie zusätzlich erneut.
 *
 * Herkunft: SRD 5.2.1 (CC-BY-4.0, Wizards of the Coast), Kapitel
 * „Character Origins → Character Species". Deutsche Begriffe folgen der
 * deutschen SRD-5.2.1-Fassung; hinter Zaubern steht der englische Name in
 * Klammern, damit der Zauberkatalog auffindbar bleibt.
 *
 * Einheiten: Reichweiten und Bewegungsraten in Fuß — genau wie in `types.ts`
 * (`speed`, `darkvision`) vereinbart, nicht in Metern.
 */

import { SRD_SOURCE, type SpeciesLineage, type Trait } from "../types";

// ─────────────────── Drachenblütige: Drakonische Abstammung ───────────────────

/**
 * Die Wahl des Drachenahnen legt genau eine Sache fest: die Schadensart von
 * Odemwaffe und Schadensresistenz. Deshalb ein gemeinsamer Merkmalsbauer statt
 * zehnmal derselbe Absatz.
 */
function draconicTrait(damage: string, damageEn: string): Trait {
  return {
    name: `Drakonische Abstammung: ${damage}`,
    description:
      `Deine Odemwaffe verursacht ${damage}schaden, und du bist gegen ` +
      `${damage}schaden resistent. Auch dein Aussehen — Schuppenfarbe, Hörner, ` +
      `der Schimmer deiner Flügel ab Stufe 5 — folgt diesem Ahnen. ` +
      `(SRD: ${damageEn})`,
    level: 1,
  };
}

export const DRACONIC_ANCESTRIES: SpeciesLineage[] = [
  {
    key: "drache-schwarz",
    name: "Schwarzer Drache",
    nameEn: "Black Dragon",
    hook: "Sumpfluft und Moder: Dein Odem frisst sich durch Rüstung, Riemen und Verband.",
    description:
      "Schwarze Drachen hausen in Mooren und überfluteten Ruinen. Ihre Nachfahren tragen matt glänzende Schuppen und einen Atem, der Metall stumpf werden lässt.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Säure", "Acid")],
  },
  {
    key: "drache-kupfer",
    name: "Kupferdrache",
    nameEn: "Copper Dragon",
    hook: "Wüstenschluchten und ein hinterhältiger Humor — der Odem ätzt trotzdem.",
    description:
      "Kupferdrachen sind Spötter und Rätselsteller. Wer von ihnen abstammt, hat oft ein loses Mundwerk und einen Atem aus Säure, um es zu decken.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Säure", "Acid")],
  },
  {
    key: "drache-blau",
    name: "Blauer Drache",
    nameEn: "Blue Dragon",
    hook: "Wüstengewitter im Rachen: ein Blitz, der eine ganze Reihe Gegner aufreiht.",
    description:
      "Blaue Drachen herrschen über Sanddünen und Sturmfronten. Ihre Nachfahren gelten als beherrscht, eitel und gefährlich geduldig.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Blitz", "Lightning")],
  },
  {
    key: "drache-bronze",
    name: "Bronzedrache",
    nameEn: "Bronze Dragon",
    hook: "Küstenwächter mit Salz in den Schuppen und einem Blitz aus der Brandung.",
    description:
      "Bronzedrachen bewachen Küsten und mischen sich gern in Kriege von Sterblichen ein — auf der Seite, die sie für die richtige halten.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Blitz", "Lightning")],
  },
  {
    key: "drache-messing",
    name: "Messingdrache",
    nameEn: "Brass Dragon",
    hook: "Redselig bis zur Erschöpfung — und wenn das nicht hilft, kommt Feuer.",
    description:
      "Messingdrachen leben in Wüsten und lieben nichts mehr als ein langes Gespräch. Ihre Nachfahren erben die Zunge und den heißen Atem.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Feuer", "Fire")],
  },
  {
    key: "drache-gold",
    name: "Golddrache",
    nameEn: "Gold Dragon",
    hook: "Die Ahnenreihe, die man auf Wandteppichen sieht: Gold, Gerechtigkeit, Feuer.",
    description:
      "Golddrachen sind die königlichsten der metallischen Drachen. Wer von ihnen abstammt, trägt Anspruch und Erwartung mit sich — und einen Odem aus Flammen.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Feuer", "Fire")],
  },
  {
    key: "drache-rot",
    name: "Roter Drache",
    nameEn: "Red Dragon",
    hook: "Vulkanblut: Hochmütig, jähzornig und mit dem heißesten Atem der Tabelle.",
    description:
      "Rote Drachen sind die Gier in Schuppenform. Ihre Nachfahren müssen mit dem Ruf leben, der ihnen vorauseilt — oder ihn genießen.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Feuer", "Fire")],
  },
  {
    key: "drache-gruen",
    name: "Grüner Drache",
    nameEn: "Green Dragon",
    hook: "Waldnebel, der in der Lunge brennt — und eine Zunge, die noch schlimmer ist.",
    description:
      "Grüne Drachen sind Intriganten der alten Wälder. Ihre Nachfahren atmen giftige Schwaden und haben ein Gespür für die Schwäche im Gegenüber.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Gift", "Poison")],
  },
  {
    key: "drache-silber",
    name: "Silberdrache",
    nameEn: "Silver Dragon",
    hook: "Wolkenhöhen und Winterluft: freundlich zu Sterblichen, eisig zu Feinden.",
    description:
      "Silberdrachen leben gern unter Menschen und Zwergen, in geliehener Gestalt. Ihre Nachfahren erben die Neugier — und einen Atem aus Frost.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Kälte", "Cold")],
  },
  {
    key: "drache-weiss",
    name: "Weißer Drache",
    nameEn: "White Dragon",
    hook: "Gletscher statt Diplomatie: der einfachste Instinkt und der kälteste Odem.",
    description:
      "Weiße Drachen sind die urtümlichsten der chromatischen Drachen — Hunger, Kälte, Beute. Ihre Nachfahren gelten als direkt bis zur Schroffheit.",
    source: SRD_SOURCE,
    traits: [draconicTrait("Kälte", "Cold")],
  },
];

// ─────────────────────── Elf: Elfische Abstammungen ───────────────────────

/** Zauber, die eine Abstammung auf Stufe 3 bzw. 5 dauerhaft vorbereitet gibt. */
function lineageSpell(name: string, nameEn: string, level: 3 | 5): Trait {
  return {
    name,
    description:
      `Du hast ${name} (${nameEn}) stets vorbereitet. Du kannst den Zauber einmal ` +
      `ohne Zauberplatz wirken und erhältst diese Anwendung nach einer langen Rast ` +
      `zurück; mit passenden Zauberplätzen geht es zusätzlich.`,
    level,
  };
}

export const ELVEN_LINEAGES: SpeciesLineage[] = [
  {
    key: "drow",
    name: "Drow",
    nameEn: "Drow",
    hook: "Unter der Welt aufgewachsen: Deine Dunkelsicht reicht doppelt so weit, und du spielst mit Licht und Finsternis.",
    description:
      "Drow stammen aus lichtlosen Tiefen und tragen das an den Augen. Am Tisch ist das die Abstammung für alle, die vorausgehen und sehen wollen, was der Rest der Gruppe noch nicht sieht — und die später einen ganzen Raum auslöschen möchten.",
    source: SRD_SOURCE,
    darkvision: 120,
    traits: [
      {
        name: "Drow-Erbe",
        description:
          "Die Reichweite deiner Dunkelsicht steigt auf 120 Fuß. Außerdem kennst du den Zaubertrick Tanzende Lichter (Dancing Lights).",
        level: 1,
      },
      lineageSpell("Feenfeuer", "Faerie Fire", 3),
      lineageSpell("Dunkelheit", "Darkness", 5),
    ],
  },
  {
    key: "hochelf",
    name: "Hochelf",
    nameEn: "High Elf",
    hook: "Ein Zaubertrick, den du nach jeder langen Rast austauschen darfst — jeden Morgen ein anderes Werkzeug.",
    description:
      "Hochelfen wachsen mit Magie als Selbstverständlichkeit auf. Der austauschbare Magier-Zaubertrick ist der Grund, diese Abstammung zu nehmen: Wer vorausdenkt, hat für jedes Abenteuer den passenden Trick dabei.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Hochelfen-Erbe",
        description:
          "Du kennst den Zaubertrick Taschenspielerei (Prestidigitation). Nach jeder langen Rast kannst du ihn durch einen anderen Zaubertrick von der Zauberliste des Magiers ersetzen.",
        level: 1,
      },
      lineageSpell("Magie entdecken", "Detect Magic", 3),
      lineageSpell("Nebelschritt", "Misty Step", 5),
    ],
  },
  {
    key: "waldelf",
    name: "Waldelf",
    nameEn: "Wood Elf",
    hook: "35 Fuß Bewegungsrate ab Stufe 1 — und ab Stufe 5 zieht die ganze Gruppe unsichtbare Spuren.",
    description:
      "Waldelfen gehören in Wälder und Grenzland. Die höhere Bewegungsrate merkt man in jedem Kampf, und Spurloses Gehen macht auf Stufe 5 aus einer lauten Gruppe eine, die niemand kommen sieht.",
    source: SRD_SOURCE,
    speed: 35,
    traits: [
      {
        name: "Waldelfen-Erbe",
        description:
          "Deine Bewegungsrate steigt auf 35 Fuß. Außerdem kennst du den Zaubertrick Druidenkunst (Druidcraft).",
        level: 1,
      },
      lineageSpell("Lange Schritte", "Longstrider", 3),
      lineageSpell("Spurloses Gehen", "Pass without Trace", 5),
    ],
  },
];

// ────────────────────── Gnom: Gnomische Abstammungen ──────────────────────

export const GNOMISH_LINEAGES: SpeciesLineage[] = [
  {
    key: "waldgnom",
    name: "Waldgnom",
    nameEn: "Forest Gnome",
    hook: "Du redest mit dem Wachhund, dem Raben auf dem Dach und der Katze in der Taverne — mehrmals am Tag.",
    description:
      "Waldgnome leben versteckt zwischen Wurzeln und Unterholz. Mit Tieren sprechen ist kein Ritual, sondern Alltag: Die halbe Nachbarschaft einer Stadt hat vier Beine oder Federn und redet gern.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Waldgnom-Erbe",
        description:
          "Du kennst den Zaubertrick Einfache Illusion (Minor Illusion). Außerdem hast du Mit Tieren sprechen (Speak with Animals) stets vorbereitet und kannst es ohne Zauberplatz so oft wirken, wie dein Übungsbonus beträgt; nach einer langen Rast sind alle Anwendungen zurück.",
        level: 1,
      },
    ],
  },
  {
    key: "felsengnom",
    name: "Felsengnom",
    nameEn: "Rock Gnome",
    hook: "Zehn Minuten Bastelei, und du hast ein Uhrwerk, das für dich zündet, klingelt oder ablenkt.",
    description:
      "Felsengnome sind Tüftler. Bis zu drei winzige Geräte gleichzeitig, jedes mit einem selbst gewählten Effekt — das ist weniger Kampfkraft als Werkzeugkasten, und ein Anlass, kreativ zu spielen.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Felsengnom-Erbe",
        description:
          "Du kennst die Zaubertricks Ausbessern (Mending) und Taschenspielerei (Prestidigitation). Außerdem kannst du zehn Minuten lang Taschenspielerei wirken, um ein winziges Uhrwerkgerät (RK 5, 1 TP) zu bauen — Spielzeug, Anzünder, Spieluhr. Du legst bei der Herstellung einen Effekt von Taschenspielerei fest; das Gerät erzeugt ihn, wenn jemand es mit einer Bonusaktion berührt. Du kannst drei Geräte gleichzeitig haben; jedes zerfällt nach acht Stunden oder wenn du es mit einer Verwenden-Aktion zerlegst.",
        level: 1,
      },
    ],
  },
];

// ─────────────────────── Goliath: Riesische Abstammung ───────────────────────

export const GIANT_ANCESTRIES: SpeciesLineage[] = [
  {
    key: "wolkenriese",
    name: "Wolkenriese",
    nameEn: "Cloud Giant",
    hook: "Wolkensprung: 30 Fuß Teleport als Bonusaktion — aus der Umklammerung, über die Schlucht, hinter den Zauberer.",
    description:
      "Die Abstammung für Beweglichkeit statt Rohschaden. Wer gern Positionen bricht, Geiseln erreicht oder aus einem Nahkampf verschwindet, nimmt den Wolkenriesen.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Wolkensprung",
        description:
          "Als Bonusaktion teleportierst du dich bis zu 30 Fuß weit in einen freien Bereich, den du sehen kannst. Anwendungen wie Übungsbonus, zurück nach einer langen Rast.",
        level: 1,
      },
    ],
  },
  {
    key: "feuerriese",
    name: "Feuerriese",
    nameEn: "Fire Giant",
    hook: "Feuersbrunst: 1W10 Feuerschaden obendrauf — der härteste Einzelschlag der sechs Optionen.",
    description:
      "Schlicht und wirkungsvoll: Wenn du triffst, brennt es zusätzlich. Die Wahl für alle, die den Goliath als Nahkämpfer spielen und Schaden wollen, den man mitzählt.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Feuersbrunst",
        description:
          "Wenn du ein Ziel mit einem Angriffswurf triffst und Schaden verursachst, kannst du ihm zusätzlich 1W10 Feuerschaden zufügen. Anwendungen wie Übungsbonus, zurück nach einer langen Rast.",
        level: 1,
      },
    ],
  },
  {
    key: "frostriese",
    name: "Frostriese",
    nameEn: "Frost Giant",
    hook: "Eiseskälte: weniger Schaden als Feuer, dafür 10 Fuß weniger Bewegung für den, der fliehen will.",
    description:
      "Kontrolle statt Wucht. Wer Gegner am Weglaufen hindert oder den Abstand zur Gruppe hält, tauscht die 1W10 gern gegen die Verlangsamung.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Eiseskälte",
        description:
          "Wenn du ein Ziel mit einem Angriffswurf triffst und Schaden verursachst, kannst du ihm zusätzlich 1W6 Kälteschaden zufügen und seine Bewegungsrate bis zum Beginn deines nächsten Zugs um 10 Fuß senken. Anwendungen wie Übungsbonus, zurück nach einer langen Rast.",
        level: 1,
      },
    ],
  },
  {
    key: "huegelriese",
    name: "Hügelriese",
    nameEn: "Hill Giant",
    hook: "Hügelsturz: Du wirfst dein Ziel zu Boden — und der Rest der Gruppe schlägt mit Vorteil nach.",
    description:
      "Kein eigener Schaden, sondern Schaden für alle anderen. In einer Gruppe mit vielen Nahkämpfern ist Hügelsturz oft die stärkste der sechs Gaben.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Hügelsturz",
        description:
          "Wenn du eine Kreatur von höchstens großer Größe mit einem Angriffswurf triffst und Schaden verursachst, kannst du ihr den Zustand Liegend geben. Anwendungen wie Übungsbonus, zurück nach einer langen Rast.",
        level: 1,
      },
    ],
  },
  {
    key: "steinriese",
    name: "Steinriese",
    nameEn: "Stone Giant",
    hook: "Felsenfestigkeit: 1W12 plus Konstitution weniger Schaden, als Reaktion — die Option, die dich am Leben hält.",
    description:
      "Die defensive Wahl. Gegen einen kritischen Treffer oder den Schlag, der dich auf null bringen würde, ist Felsenfestigkeit oft mehr wert als jeder Zusatzschaden.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Felsenfestigkeit",
        description:
          "Wenn du Schaden erleidest, kannst du als Reaktion 1W12 würfeln, deinen Konstitutionsmodifikator addieren und den Schaden um diese Summe verringern. Anwendungen wie Übungsbonus, zurück nach einer langen Rast.",
        level: 1,
      },
    ],
  },
  {
    key: "sturmriese",
    name: "Sturmriese",
    nameEn: "Storm Giant",
    hook: "Sturmdonner: Wer dich trifft, bekommt Donner zurück — auch aus 60 Fuß Entfernung.",
    description:
      "Die einzige Gabe, die auf Fernkampf und Zauberer antwortet. Der Bogenschütze auf dem Dach zahlt für jeden Pfeil, ohne dass du dich bewegen musst.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Sturmdonner",
        description:
          "Wenn dir eine Kreatur im Umkreis von 60 Fuß Schaden zufügt, kannst du als Reaktion 1W8 Schallschaden an ihr verursachen. Anwendungen wie Übungsbonus, zurück nach einer langen Rast.",
        level: 1,
      },
    ],
  },
];

// ────────────────────── Tiefling: Unholdisches Erbe ──────────────────────

export const FIENDISH_LEGACIES: SpeciesLineage[] = [
  {
    key: "abyssisch",
    name: "Abyssisches Erbe",
    nameEn: "Abyssal Legacy",
    hook: "Dämonenblut aus dem Abyss: Gift prallt an dir ab, und auf Stufe 5 hältst du einen Gegner komplett fest.",
    description:
      "Das chaotischste der drei Erben. Giftresistenz trägt durch die ganze Kampagne, und Person festhalten ist auf Stufe 5 der stärkste Einzelzauber der drei Listen — ein Gegner ist für eine Runde aus dem Kampf.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Abyssisches Erbe",
        description:
          "Du bist gegen Giftschaden resistent und kennst den Zaubertrick Gift versprühen (Poison Spray).",
        level: 1,
      },
      lineageSpell("Strahl der Übelkeit", "Ray of Sickness", 3),
      lineageSpell("Person festhalten", "Hold Person", 5),
    ],
  },
  {
    key: "chthonisch",
    name: "Chthonisches Erbe",
    nameEn: "Chthonic Legacy",
    hook: "Grabeskälte im Blut: Nekrotischer Schaden findet keinen Halt an dir, und du borgst dir Trefferpunkte, die du nicht hast.",
    description:
      "Das Erbe der Unterwelt. Resistenz gegen nekrotischen Schaden ist gegen Untote Gold wert, und Falsches Leben gibt dir vor jedem Kampf ein Polster, das nichts kostet.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Chthonisches Erbe",
        description:
          "Du bist gegen nekrotischen Schaden resistent und kennst den Zaubertrick Kalte Hand (Chill Touch).",
        level: 1,
      },
      lineageSpell("Falsches Leben", "False Life", 3),
      lineageSpell("Schwächestrahl", "Ray of Enfeeblement", 5),
    ],
  },
  {
    key: "infernalisch",
    name: "Infernalisches Erbe",
    nameEn: "Infernal Legacy",
    hook: "Neun Höllen: Feuer tut dir nur halb weh, und wer dich trifft, bekommt es sofort zurück.",
    description:
      "Das klassische Tiefling-Erbe. Feuerresistenz ist die nützlichste der drei, Feuerpfeil gibt auch einem Kämpfer einen brauchbaren Fernangriff, und Höllischer Tadel bestraft jeden Treffer.",
    source: SRD_SOURCE,
    traits: [
      {
        name: "Infernalisches Erbe",
        description:
          "Du bist gegen Feuerschaden resistent und kennst den Zaubertrick Feuerpfeil (Fire Bolt).",
        level: 1,
      },
      lineageSpell("Höllischer Tadel", "Hellish Rebuke", 3),
      lineageSpell("Dunkelheit", "Darkness", 5),
    ],
  },
];
