/**
 * Erfinder-Inventionen (Artificer Infusions) — Owner-Notizen-Import.
 *
 * Mechanik aus `Klassen__Artificer - Notizen.pdf.txt`; Flavour für Validori/Gilden.
 * Attribut- und Eigenschaftsnamen in Beschreibungen Englisch (Intelligence, Dexterity, …).
 */

import { OWNER_NOTES_SOURCE, type Invention } from "../types";

export { OWNER_NOTES_SOURCE };

/** Alle Inventionen der Erfinder-Klasse, sortiert nach prerequisiteLevel dann nameEn. */
export const INVENTIONS_ERFINDER: Invention[] = [
  {
    key: "arm_launcher",
    name: "Armschleuder",
    nameEn: "Arm Launcher",
    hook: "Kugellager, Säure oder Öl als Bonusaktion — aus dem Handschuh statt aus der Tasche.",
    description:
      "Gegenstand: Handschuh oder Panzerhandschuh. Als Aktion lädst du bis zu fünf winzige Objekte (Kugellager, Stacheln, Säure-/Alchemistenfeuer-/Öl-/Weihwasserphiolen). Als Bonusaktion feuert der Träger eines ab — Fernkampfangriff auf Ziel oder Feld in 6 m Sicht.",
    prerequisiteLevel: 1,
    itemType: "Handschuh oder Panzerhandschuh",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "enhanced_arcane_focus",
    name: "Verstärkter arkaner Fokus",
    nameEn: "Enhanced Arcane Focus",
    hook: "+1 auf Zauberangriffe und halbe Deckung zählt nicht — für Magister-Lehrlinge in Validori.",
    description:
      "Gegenstand: arkaner Fokus (Einstimmung). +1 auf Zauberangriffswürfe; bei Zauberangriffen zählt halbe Deckung nicht. Bonus steigt auf +2 (Stufe 11) und +3 (Stufe 17).",
    prerequisiteLevel: 1,
    itemType: "Arkaner Fokus",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "enhanced_defense",
    name: "Verstärkte Verteidigung",
    nameEn: "Enhanced Defense",
    hook: "Rüstung oder Schild mit +1 RK — Gildenstandard für Feldingenieure.",
    description:
      "Gegenstand: Rüstung oder Schild. +1 RK beim Tragen/Führen. Bonus steigt auf +2 (Stufe 11) und +3 (Stufe 17).",
    prerequisiteLevel: 1,
    itemType: "Rüstung oder Schild",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "enhanced_weapon",
    name: "Verstärkte Waffe",
    nameEn: "Enhanced Weapon",
    hook: "Einfache oder martialische Waffe mit +1 auf Angriff und Schaden.",
    description:
      "Gegenstand: einfache oder martialische Waffe. +1 auf Angriffs- und Schadenswürfe. Bonus steigt auf +2 (Stufe 11) und +3 (Stufe 17).",
    prerequisiteLevel: 1,
    itemType: "Einfache oder martialische Waffe",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "featherweight_belt",
    name: "Federleichter Gürtel",
    nameEn: "Featherweight Belt",
    hook: "Ein Zehntel des Gewichts — ohne schwächer zu werden.",
    description:
      "Gegenstand: Gürtel oder Umhang (Einstimmung). Reduziert das Gewicht des Trägers auf ein Zehntel, ohne körperliche Fähigkeiten zu mindern. Ab Stufe 11: ein Hundertstel.",
    prerequisiteLevel: 1,
    itemType: "Gürtel oder Umhang",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "featherweight_weapon",
    name: "Federleichte Waffe",
    nameEn: "Featherweight Weapon",
    hook: "Schwer und zweihändig fallen weg — oder die Waffe wird leicht.",
    description:
      "Gegenstand: einfache oder martialische Nahkampfwaffe (Einstimmung). Entfernt die Eigenschaften heavy und two-handed, falls vorhanden; sonst erhält die Waffe light. Ab Stufe 11: +1 Angriff/Schaden (+2 ab Stufe 17).",
    prerequisiteLevel: 1,
    itemType: "Einfache oder martialische Nahkampfwaffe",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "goggles_of_clearsight",
    name: "Brille des klaren Blicks",
    nameEn: "Goggles of Clearsight",
    hook: "36 m durch jede Verdeckung — und kein Nachteil durch Sunlight Sensitivity.",
    description:
      "Gegenstand: Helm, Brille oder Brillengestell. Normale Sicht durch leichte und starke Verdeckung (inkl. magische Dunkelheit) in 36 m. Kein Nachteil durch Sunlight Sensitivity; Vorteil auf Rettungswürfe gegen blinded.",
    prerequisiteLevel: 1,
    itemType: "Helm, Brille oder Brillengestell",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "homunculus_servant",
    name: "Homunkulus-Diener",
    nameEn: "Homunculus Servant",
    hook: "Ein kleiner Konstrukt-Gefährte — Berührungszauber aus 36 m.",
    description:
      "Gegenstand: Edelstein (mind. 100 Gold) als Kern. Nach langer Rast (1 Stunde, Tinkerwerkzeug) erschaffst du einen Homunculus Servant (nur einer gleichzeitig; erschaffst du einen neuen, wird der vorherige zu Asche). Er ist dir freundlich und gehorcht. In deinem Zug: Bewegung und Reaktion selbstständig; ohne deine Bonusaktion für eine Statblock-Aktion weicht er standardmäßig aus (Dodge). Arcane Conduit: Touch-Zauber der Erfinder-Liste über seine Berührung in 36 m. Evasion (Dexterity-Rettungswurf auf halben Schaden → kein Schaden bei Erfolg), Might of the Master (dein Übungsbonus auf seine Proben/Rettungswürfe), Acidic Spittle im Statblock. Bist du kampfunfähig, verteidigt er sich autonom nach bestem Urteil. Stirbt er: Zauberplatz + 1 Minute Reparatur mit Tinkerwerkzeug stellt ihn mit vollem Maximum wieder her. Stirbst du: nach 1 Minute wird er zu Asche.",
    prerequisiteLevel: 1,
    itemType: "Edelstein (mind. 100 Gold)",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "lightning_cannon",
    name: "Blitzkanone",
    nameEn: "Lightning Cannon",
    hook: "Statt eines Angriffs: 2W6 Blitzschaden auf 18 m — Intelligence als Zauberattribut.",
    description:
      "Gegenstand: Panzerhandschuh, arkaner Fokus oder Metallstab. Anstelle eines Angriffs: Fern-Zauberangriff (Intelligence) auf Ziel in 18 m Sicht; bei Treffer 2W6 Blitzschaden.",
    prerequisiteLevel: 1,
    itemType: "Panzerhandschuh, arkaner Fokus oder Metallstab",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "power_whip",
    name: "Kraftpeitsche",
    nameEn: "Power Whip",
    hook: "W6 wird W10 — und Große oder kleinere Ziele können zu Boden gehen.",
    description:
      "Gegenstand: Peitsche oder Kette. Schadenswürfel wird W10. Einmal pro Zug bei Treffer gegen Large oder kleiner: Dexterity-Rettungswurf oder zu Boden geworfen. Ab Stufe 11: +1 Angriff/Schaden (+2 ab Stufe 17).",
    prerequisiteLevel: 1,
    itemType: "Peitsche oder Kette",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "repeating_shot",
    name: "Wiederholungsschuss",
    nameEn: "Repeating Shot",
    hook: "Loading entfällt — leere Fernwaffe erzeugt magische Munition.",
    description:
      "Gegenstand: Fernkampfwaffe (Einstimmung). Ignoriert loading; ohne geladene Munition erzeugt die Waffe magische Munition beim Schuss (verschwindet nach Treffer/Fehlschlag). Ab Stufe 11: +1 Angriff/Schaden (+2 ab Stufe 17).",
    prerequisiteLevel: 1,
    itemType: "Fernkampfwaffe",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "returning_weapon",
    name: "Zurückkehrende Waffe",
    nameEn: "Returning Weapon",
    hook: "Nach dem Wurf fliegt die Waffe sofort zurück.",
    description:
      "Gegenstand: Waffe mit thrown. Kehrt nach einem Wurfwaffenangriff sofort in die Hand zurück. Ab Stufe 11: +1 Angriff/Schaden (+2 ab Stufe 17).",
    prerequisiteLevel: 1,
    itemType: "Waffe mit thrown",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "gem_of_warding",
    name: "Schutzstein",
    nameEn: "Gem of Warding",
    hook: "Schwebender Edelstein vergibt temporäre Trefferpunkte — Intelligence-Modifikator pro Ladung.",
    description:
      "Gegenstand: Edelstein (mind. 100 Gold). Aktion: 1 Ladung, werfen in freies Feld in 9 m (schwebt 1,5 m). Bonusaktion: bis 6 m bewegen oder Puls — gewählte Kreaturen in 3 m erhalten temporäre TP = Intelligence-Modifikator. TP des Steins = deine Erfinderstufe, RK = dein Intelligence-Wert. Aktiv 1 Minute oder bis zerstört, danach kehrt er zum Träger zurück. Ladungen = Intelligence-Modifikator (min. 1), täglich bei Morgendämmerung.",
    prerequisiteLevel: 5,
    itemType: "Edelstein (mind. 100 Gold)",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "homing_weapon",
    name: "Zielwaffe",
    nameEn: "Homing Weapon",
    hook: "Kein Nachteil in long range — präzise Schüsse aus der zweiten Reichweite.",
    description:
      "Gegenstand: Fern- oder Wurfwaffe. Ignoriert Nachteil bei Angriffen in long range. Ab Stufe 11: +1 Angriff/Schaden (+2 ab Stufe 17).",
    prerequisiteLevel: 5,
    itemType: "Fern- oder Wurfwaffe",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "immovable_boots",
    name: "Unbewegliche Stiefel",
    nameEn: "Immovable Boots",
    hook: "Auf ebenem Boden festnageln — selbst gegen Schwerkraft.",
    description:
      "Gegenstand: Stiefelpaar (Einstimmung). Aktion auf ebenem Boden: Stiefel fixieren bis Deaktivierung; Bewegen erfordert SG 30 Strength.",
    prerequisiteLevel: 5,
    itemType: "Stiefelpaar",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "infiltrator_armor",
    name: "Infiltrator-Rüstung",
    nameEn: "Infiltrator Armor",
    hook: "Formschlüssig unter Kleidung — Vorteil auf Stealth.",
    description:
      "Gegenstand: Rüstung (Einstimmung). Formschlüssig, unter Kleidung unsichtbar; Vorteil auf Dexterity (Stealth). Ab Stufe 11: +1 RK (+2 ab Stufe 17).",
    prerequisiteLevel: 5,
    itemType: "Rüstung",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "light_blade",
    name: "Lichtklinge",
    nameEn: "Light Blade",
    hook: "Bonusaktion: Strahlenklinge W8 radiant mit finesse — aus Griff oder Fokus.",
    description:
      "Gegenstand: Schwertgriff oder arkaner Fokus (Einstimmung). Bonusaktion: Klinge aus reinem Licht (W8 radiant, finesse, simple melee) erscheint/verschwindet; helles Licht 4,5 m und schwaches Licht weitere 4,5 m. Ab Stufe 11: +1 Angriff/Schaden (+2 ab Stufe 17).",
    prerequisiteLevel: 5,
    itemType: "Schwertgriff oder arkaner Fokus",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "many_handed_pouch",
    name: "Vielhändiger Beutel",
    nameEn: "Many-Handed Pouch",
    hook: "Mehrere Beutel teilen einen extradimensionalen Raum.",
    description:
      "Gegenstand: Beutel in Anzahl = Intelligence-Modifikator. Gemeinsamer extradimensionaler Raum; Zugriff nur wenn ein anderer Beutel innerhalb 160 km. Endet die Invention, wandern Inhalte zufällig in einen Beutel.",
    prerequisiteLevel: 5,
    itemType: "Mehrere Beutel",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "mind_sharpener",
    name: "Geisteschärfer",
    nameEn: "Mind Sharpener",
    hook: "Reaktion: gescheiterte Konzentration mit einer Ladung retten.",
    description:
      "Gegenstand: Helm, Diadem, Rüstung oder Roben. Reaktion bei gescheitertem Constitution-Rettungswurf für Konzentration: 1 Ladung, Erfolg stattdessen. Ladungen = Intelligence-Modifikator (min. 1), täglich bei Morgendämmerung.",
    prerequisiteLevel: 5,
    itemType: "Helm, Diadem, Rüstung oder Roben",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "radiant_weapon",
    name: "Strahlenwaffe",
    nameEn: "Radiant Weapon",
    hook: "Leuchtende Waffe — Ladung für blinded bis zu deinem nächsten Zug.",
    description:
      "Gegenstand: Nahkampfwaffe (Einstimmung). Bonusaktion: helles Licht 9 m / dämmrig 9 m darüber. Bei Treffer: 1 Ladung, Constitution-Rettungswurf oder blinded bis Beginn deines nächsten Zugs. Ladungen = Intelligence-Modifikator (min. 1). Ab Stufe 11: +1 Angriff/Schaden (+2 ab Stufe 17).",
    prerequisiteLevel: 5,
    itemType: "Nahkampfwaffe",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "repulsion_gauntlets",
    name: "Abstoßhandschuhe",
    nameEn: "Repulsion Gauntlets",
    hook: "Unbewaffneter Schlag oder Gauntlet: Ladung, 4,5 m zurückstoßen.",
    description:
      "Gegenstand: Handschuhe oder Panzerhandschuhe (Einstimmung). Bei Treffer mit unarmed strike oder Gauntlet: 1 Ladung, Strength-Rettungswurf (Large+ Vorteil) oder 4,5 m zurück in gerader Linie. Ladungen = Intelligence-Modifikator (min. 1). Ab Stufe 11: +1 Angriff/Schaden (+2 ab Stufe 17).",
    prerequisiteLevel: 5,
    itemType: "Handschuhe oder Panzerhandschuhe",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "repulsion_shield",
    name: "Abstoßschild",
    nameEn: "Repulsion Shield",
    hook: "Nach Nahkampftreffer: Angreifer zurückstoßen und zu Boden.",
    description:
      "Gegenstand: Schild (Einstimmung). Bei Treffer durch Nahkampfangriff: 1 Ladung, Strength-Rettungswurf (Large+ Vorteil) oder 4,5 m zurück und zu Boden. Ladungen = Intelligence-Modifikator (min. 1). Ab Stufe 11: +1 RK (+2 ab Stufe 17).",
    prerequisiteLevel: 5,
    itemType: "Schild",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "shield_wall",
    name: "Schildmauer",
    nameEn: "Shield Wall",
    hook: "Schild in den Boden — wall of stone ohne Konzentration.",
    description:
      "Gegenstand: Schild (Einstimmung). 4 Ladungen. Aktion, 1 Ladung: Schild in Boden — wall of stone mit Panel-Anzahl = Intelligence-Modifikator, ohne Konzentration. Aktion zum vorzeitigen Beenden (Schild heben).",
    prerequisiteLevel: 5,
    itemType: "Schild",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "armor_of_strength",
    name: "Rüstung der Stärke",
    nameEn: "Armor of Strength",
    hook: "+1 RK und Intelligence statt Strength — Ladung gegen Stoßen/Umwerfen.",
    description:
      "Gegenstand: Rüstung (Einstimmung). +1 RK; Intelligence statt Strength für Strength-basierte Checks/Saves. 1 Ladung, um gegen unfreiwillige Bewegung/Umwerfen zu widerstehen. Ladungen = Intelligence-Modifikator (min. 1). Ab Stufe 17: +2 RK.",
    prerequisiteLevel: 11,
    itemType: "Rüstung",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "arcane_propulsion_armor",
    name: "Arkane Antriebsrüstung",
    nameEn: "Arcane Propulsion Armor",
    hook: "Force-Gauntlets, +1,5 m Tempo — und fehlende Gliedmaßen ersetzt.",
    description:
      "Gegenstand: Rüstung (Einstimmung). +1,5 m Gehgeschwindigkeit; magische Force-Gauntlets (W8 force, thrown 6/18 m, kehren zurück); nicht gegen Willen entfernbar; ersetzt fehlende Gliedmaßen funktional.",
    prerequisiteLevel: 11,
    itemType: "Rüstung",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "chameleon_armor",
    name: "Chamäleon-Rüstung",
    nameEn: "Chameleon Armor",
    hook: "+1 RK und disguise self / invisibility / greater invisibility per Ladung.",
    description:
      "Gegenstand: Rüstung (Einstimmung). +1 RK. Aktion: Ladungen für disguise self (1), invisibility (2) oder greater invisibility (4) auf sich selbst. Ladungen = Intelligence-Modifikator (min. 1). Ab Stufe 17: +2 RK.",
    prerequisiteLevel: 11,
    itemType: "Rüstung",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "elemental_armor",
    name: "Elementar-Rüstung",
    nameEn: "Elemental Armor",
    hook: "+1 RK und Resistenz gegen ein Element — ab Stufe 17 optional psychic oder force.",
    description:
      "Gegenstand: Rüstung (Einstimmung). +1 RK; Resistenz gegen acid, cold, fire, lightning, necrotic, poison, radiant oder thunder (Wahl). Ab Stufe 17: +2 RK; optional Resistenz psychic oder force.",
    prerequisiteLevel: 11,
    itemType: "Rüstung",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "elemental_ring",
    name: "Elementarring",
    nameEn: "Elemental Ring",
    hook: "Kommandowort: maximaler Schaden eines Zaubers bis Stufe 3 (5 ab Stufe 17).",
    description:
      "Gegenstand: Ring (Einstimmung). Wähle Schadenstyp (acid, cold, fire, poison, lightning) und Kommandowort. Beim Wirken eines Zaubers Stufe 3 oder niedriger dieses Typs: Kommandowort für maximalen Schaden an einem Ziel (1× bis Morgendämmerung). Ab Stufe 17: bis Stufe 5.",
    prerequisiteLevel: 11,
    itemType: "Ring",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "elemental_weapon",
    name: "Elementarwaffe",
    nameEn: "Elemental Weapon",
    hook: "Kommandowort umhüllt die Klinge mit Bonus-W6 Elementarschaden.",
    description:
      "Gegenstand: Nahkampfwaffe (Einstimmung). Wähle acid, cold, fire, poison oder lightning und Kommandowort. Solange aktiv: +1W6 Schaden des Typs bei Treffer. Ab Stufe 17: +2W6.",
    prerequisiteLevel: 11,
    itemType: "Nahkampfwaffe",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "helm_of_awareness",
    name: "Helm des Wachsamkeit",
    nameEn: "Helm of Awareness",
    hook: "Nicht überrascht (außer incapacitated) — Intelligence auf Initiative.",
    description:
      "Gegenstand: Helm oder Diadem (Einstimmung). Keine Überraschung außer bei incapacitated; +Intelligence-Modifikator (min. +1) auf Initiative.",
    prerequisiteLevel: 11,
    itemType: "Helm oder Diadem",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "metamorphosis_armor",
    name: "Metamorphose-Rüstung",
    nameEn: "Metamorphosis Armor",
    hook: "enlarge/reduce auf sich selbst ohne Konzentration — ab Stufe 17 zwei Kategorien.",
    description:
      "Gegenstand: Rüstung (Einstimmung). 4 Ladungen. Aktion, 1 Ladung: enlarge/reduce nur auf dich, ohne Zauberplatz/Konzentration; erneutes Wirken beendet den Effekt. Ladungen bei Morgendämmerung. Ab Stufe 17: bis 2 Ladungen für zwei Größenkategorien.",
    prerequisiteLevel: 11,
    itemType: "Rüstung",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "ring_of_spell_refueling",
    name: "Ring der Zauberauffüllung",
    nameEn: "Ring of Spell Refueling",
    hook: "Bonusaktion: ein Zauberplatz Stufe 3 oder niedriger zurück — 1× bis Morgendämmerung.",
    description:
      "Gegenstand: Ring (Einstimmung). Bonusaktion: einen verbrauchten Zauberplatz Stufe 3 oder niedriger zurück. Einmal bis nächste Morgendämmerung.",
    prerequisiteLevel: 11,
    itemType: "Ring",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "vampiric_weapon",
    name: "Vampirwaffe",
    nameEn: "Vampiric Weapon",
    hook: "Kritischer Treffer: +2W6 necrotic und temporäre TP — Untote immun.",
    description:
      "Gegenstand: Nahkampfwaffe (Einstimmung). Kritischer Treffer: +2W6 necrotic, temporäre TP = necrotic-Schaden (Untote immun). Ab Stufe 17: +4W6.",
    prerequisiteLevel: 11,
    itemType: "Nahkampfwaffe",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "voyager_boots",
    name: "Wanderstiefel",
    nameEn: "Voyager Boots",
    hook: "Bonusaktion: Teleport 4,5 m (9 m ab Stufe 17).",
    description:
      "Gegenstand: Stiefelpaar (Einstimmung). Bonusaktion: Teleport bis 4,5 m in freies Feld in Sicht. Ab Stufe 17: bis 9 m.",
    prerequisiteLevel: 11,
    itemType: "Stiefelpaar",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "boots_of_destruction",
    name: "Stiefel der Zerstörung",
    nameEn: "Boots of Destruction",
    hook: "Aktion: destructive wave ohne Zauberplatz — 1× pro kurze oder lange Rast.",
    description:
      "Gegenstand: Stiefelpaar (Einstimmung). Aktion: Boden stampfen, destructive wave ohne Zauberplatz. Danach kurze oder lange Rast bis erneut.",
    prerequisiteLevel: 17,
    itemType: "Stiefelpaar",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "guardian_gauntlets",
    name: "Wächterhandschuhe",
    nameEn: "Guardian Gauntlets",
    hook: "Reaktion: Kreatur in 9 m zu dir ziehen — dann optional Nahkampfangriff.",
    description:
      "Gegenstand: Panzerhandschuhe (Einstimmung). Reaktion wenn Kreatur in 9 m ihren Zug beendet: 1 Ladung, Strength-Rettungswurf (Huge+ Vorteil) oder 9 m zu dir; innerhalb 1,5 m optional ein Nahkampfangriff. Ladungen = Intelligence-Modifikator (min. 1).",
    prerequisiteLevel: 17,
    itemType: "Panzerhandschuhe",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "masterwork_homunculus",
    name: "Meisterwerk-Homunkulus",
    nameEn: "Masterwork Homunculus",
    hook: "clone als Erfinder-Zauber — 12 Tage Reife, kein Zauberplatz mit Material.",
    description:
      "Kein Gegenstand: Du lernst clone (zählt als Erfinder-Zauber, nicht gegen Spells Known). Wirken ohne Zauberplatz mit Material; nur ein Klon, Reife in 12 Tagen. Ersetzt du die Invention vor Reife, schlägt der Zauber fehl.",
    prerequisiteLevel: 17,
    itemType: "— (kein Objekt)",
    source: OWNER_NOTES_SOURCE,
  },
  {
    key: "mind_shield",
    name: "Geistschild",
    nameEn: "Mind Shield",
    hook: "Resistenz psychic, immun gegen charmed/frightened und Gedankenlesen.",
    description:
      "Gegenstand: Helm oder Diadem (Einstimmung). Resistenz psychic; immun gegen charmed und frightened; immun gegen Magie, die Gedanken/Träume liest; keine Telepathie-Ziele ohne Zustimmung.",
    prerequisiteLevel: 17,
    itemType: "Helm oder Diadem",
    requiresAttunement: true,
    source: OWNER_NOTES_SOURCE,
  },
];

/** Inventionen, die ab der genannten Erfinderstufe erlernbar sind. */
export function inventionsForLevel(level: number): Invention[] {
  return INVENTIONS_ERFINDER.filter((entry) => entry.prerequisiteLevel <= level);
}
