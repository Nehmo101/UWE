/**
 * Sprachen und Gesinnungen — die beiden kleinen Kataloge, die kein eigenes
 * Modul rechtfertigen.
 *
 * Geprüft am 2026-08-06 gegen die offizielle PDF `SRD_CC_v5.2.1`
 * (Abschnitt „Creating a Character“: Schritt 2 „Choose Languages“,
 * Schritt 4 „Alignment“) und gegen die deutsche SRD-5.2.1-Fassung, aus der
 * die deutschen Begriffe stammen.
 *
 * **Zu den Schriftsystemen:** SRD 5.2.1 druckt keine mehr. Die Spalte
 * „Script“ der Sprachtabelle ist mit den Regeln von 2024 entfallen — die
 * Tabellen „Standard Languages“ und „Rare Languages“ führen nur noch den
 * Sprachnamen. Deshalb steht hier überall `script: null`.
 *
 * // TODO(unverified): Schriftsysteme (Common, Dwarvish, Elvish, Infernal,
 * // Celestial, Draconic …) standen in SRD 5.1, nicht in 5.2.1. Wer sie
 * // haben will, muss sie aus 5.1 übernehmen und dann auch dort
 * // attribuieren — nicht unter `SRD_SOURCE` (5.2.1) mitlaufen lassen.
 *
 * Ein Charakter kennt laut SRD mindestens drei Sprachen: die Gemeinsprache
 * plus zwei aus der Standardliste. Seltene Sprachen gibt es nur über
 * Merkmale, nicht über die freie Wahl bei der Erstellung.
 */

import { SRD_SOURCE, type Alignment, type Language } from "../types";

export const LANGUAGES: Language[] = [
  // ─────────────────────────── Standardsprachen ───────────────────────────
  {
    key: "gemeinsprache",
    name: "Gemeinsprache",
    nameEn: "Common",
    hook: "Die Handelssprache jeder Stadt am Weg — jeder Spielercharakter kann sie, ohne dafür eine Wahl zu verbrauchen.",
    description:
      "Die weitest verbreitete Sprache der Kampagnenwelt. Sie kostet keine deiner " +
      "beiden Wahlmöglichkeiten: Jeder Spielercharakter beherrscht sie automatisch.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "gebaerden-gemeinsprache",
    name: "Gebärden-Gemeinsprache",
    nameEn: "Common Sign Language",
    hook: "Reden quer durch einen lauten Saal oder lautlos durch einen Gang, in dem gerade jemand schläft.",
    description:
      "Die gebärdete Entsprechung der Gemeinsprache. Am Tisch ist sie die " +
      "unauffälligste Art, sich innerhalb der Gruppe abzustimmen, ohne dass ein " +
      "Geräusch entsteht — und die einzige Sprache, die durch eine Glasscheibe " +
      "funktioniert.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "drakonisch",
    name: "Drakonisch",
    nameEn: "Draconic",
    hook: "Die Sprache der Drachen — und die, in der die meisten alten Zauberinschriften geschrieben sind.",
    description:
      "Von Drachen, Drachenblütigen und Kultisten gesprochen. Wer alte Ruinen, " +
      "Horte und arkane Inschriften mag, holt hier am meisten heraus.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "zwergisch",
    name: "Zwergisch",
    nameEn: "Dwarvish",
    hook: "Unter Tage, in Schmieden und an Bergwerkstoren — dort, wo Verträge in Stein stehen.",
    description:
      "Die Sprache der Zwergenreiche. Nützlich überall dort, wo Handwerk, Handel " +
      "und Bergbau das Sagen haben.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "elfisch",
    name: "Elfisch",
    nameEn: "Elvish",
    hook: "Alte Verse, ältere Verträge und die halbe Feenwelt versteht dich damit halbwegs.",
    description:
      "Die Sprache der Elfenvölker. Sie eröffnet Zugang zu Dichtung, Diplomatie " +
      "und zu vielem, was mit den Feenlanden zu tun hat.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "riesisch",
    name: "Riesisch",
    nameEn: "Giant",
    hook: "Die Sprache derer, die dich zerquetschen könnten — und die man deshalb besser verhandelt.",
    description:
      "Gesprochen von Riesen, Oger und vielem, was groß und ungeduldig ist. Oft " +
      "die einzige Möglichkeit, einen Kampf gar nicht erst anzufangen.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "gnomisch",
    name: "Gnomisch",
    nameEn: "Gnomish",
    hook: "Erfinderjargon: Für jede Schraube gibt es ein eigenes Wort und für jedes Wort drei Fußnoten.",
    description:
      "Die Sprache der Gnome, voller Fachbegriffe für Mechanik, Alchemie und " +
      "Illusionen. Praktisch überall dort, wo etwas gebaut oder repariert wird.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "goblinisch",
    name: "Goblinisch",
    nameEn: "Goblin",
    hook: "Die Sprache der häufigsten Gegner auf niedrigen Stufen — Gefangene reden damit plötzlich.",
    description:
      "Gesprochen von Goblins, Hobgoblins und Bugbears. Auf den ersten Stufen " +
      "wahrscheinlich die Sprache mit dem meisten Spielnutzen pro Sitzung.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "halblingisch",
    name: "Halblingisch",
    nameEn: "Halfling",
    hook: "Wird selten geschrieben und noch seltener Fremden beigebracht — wer sie kann, gehört dazu.",
    description:
      "Die Sprache der Halblingsgemeinschaften. Sie öffnet Türen in Dörfern, in " +
      "denen ein Fremder sonst höflich, aber bestimmt draußen bleibt.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "orkisch",
    name: "Orkisch",
    nameEn: "Orc",
    hook: "Knapp, laut und unmissverständlich — eine Sprache, in der Drohungen funktionieren.",
    description:
      "Die Sprache der Orks. Wer einschüchtern will oder mit einer Kriegsschar " +
      "verhandeln muss, kommt damit weiter als mit Höflichkeit.",
    rarity: "standard",
    script: null,
    source: SRD_SOURCE,
  },

  // ──────────────────────────── Seltene Sprachen ────────────────────────────
  {
    key: "abyssisch",
    name: "Abyssisch",
    nameEn: "Abyssal",
    hook: "Die Sprache der Dämonen — man lernt sie nicht zufällig, und niemand fragt ohne Grund danach.",
    description:
      "Die Sprache des Abyss. Sie zu beherrschen ist selbst schon eine Aussage " +
      "über die Vorgeschichte deines Charakters.",
    rarity: "rare",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "celestisch",
    name: "Celestisch",
    nameEn: "Celestial",
    hook: "Die Sprache der Himmlischen: In ihr klingt selbst eine schlechte Nachricht wie ein Trost.",
    description:
      "Gesprochen von Engeln und anderen himmlischen Wesen. Häufig die Sprache " +
      "geweihter Inschriften und der Wesen, die Beschwörungszauber herbeirufen.",
    rarity: "rare",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "tiefensprache",
    name: "Tiefensprache",
    nameEn: "Deep Speech",
    hook: "Für den menschlichen Mundraum eigentlich nicht gemacht — und genau deshalb unheimlich.",
    description:
      "Die Sprache der Aberrationen aus dem Fernen Reich. Wer sie versteht, hört " +
      "in dunklen Gängen Dinge, die er lieber nicht verstanden hätte.",
    rarity: "rare",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "druidisch",
    name: "Druidisch",
    nameEn: "Druidic",
    hook: "Die Geheimsprache der Druiden — verboten weiterzugeben, ideal für Botschaften am Wegrand.",
    description:
      "Nur Druiden kennen sie, und sie geben sie nicht weiter. In der Praxis dient " +
      "sie für versteckte Zeichen, die außer Eingeweihten niemand als Schrift " +
      "erkennt.",
    rarity: "rare",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "infernalisch",
    name: "Infernalisch",
    nameEn: "Infernal",
    hook: "Die Vertragssprache der Neun Höllen — hier entscheidet jede Formulierung.",
    description:
      "Gesprochen von Teufeln. Wo Abyssisch schreit, verhandelt Infernalisch: " +
      "präzise, verbindlich und mit einem Nebensatz, den man übersehen soll.",
    rarity: "rare",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "urtuemlich",
    name: "Urtümlich",
    nameEn: "Primordial",
    hook: "Eine Sprache, vier Dialekte — wer einen kann, versteht Wesen aller vier Elemente.",
    description:
      "Die Sprache der Elementarwesen. Sie umfasst die Dialekte Aqual, Aural, " +
      "Ignal und Terral; wer einen davon spricht, versteht sich auch mit " +
      "Kreaturen, die einen anderen sprechen.",
    rarity: "rare",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "sylvanisch",
    name: "Sylvanisch",
    nameEn: "Sylvan",
    hook: "Die Sprache der Feenwesen — höflich bleiben, denn Zusagen zählen hier wörtlich.",
    description:
      "Gesprochen in den Feenlanden von Dryaden, Satyrn und ihresgleichen. " +
      "Verhandeln lässt sich damit hervorragend; nur sollte man vorher wissen, " +
      "worauf man sich einlässt.",
    rarity: "rare",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "diebessprache",
    name: "Diebessprache",
    nameEn: "Thieves' Cant",
    hook: "Ein Gespräch über das Wetter, das für Eingeweihte eine Ortsangabe ist.",
    description:
      "Der verschlüsselte Jargon der Unterwelt: Wortwahl, Handzeichen und " +
      "Kreidesymbole an Hauswänden. Für Außenstehende klingt es nach Geplauder.",
    rarity: "rare",
    script: null,
    source: SRD_SOURCE,
  },
  {
    key: "gemeinsprache-der-unterreiche",
    name: "Gemeinsprache der Unterreiche",
    nameEn: "Undercommon",
    hook: "Die Handelssprache unter der Erde — ohne sie ist im Unterreich jedes Gespräch ein Kampf.",
    description:
      "Was die Gemeinsprache oben ist, ist diese Sprache unten: das gemeinsame " +
      "Mittel der Völker des Unterreichs, wenn gehandelt statt gekämpft wird.",
    rarity: "rare",
    script: null,
    source: SRD_SOURCE,
  },
];

/**
 * Die neun Gesinnungen.
 *
 * `Alignment` trägt bewusst weder `description` noch `source` — die Wahl
 * braucht einen Satz, keine Abhandlung. Die Kürzel (RG, NG, CG …) folgen der
 * deutschen SRD-Fassung und stecken im Schlüssel wieder, nicht im Namen.
 *
 * Das SRD merkt an: Das Spiel geht davon aus, dass Spielercharaktere **keine**
 * böse Gesinnung haben — vor einem bösen Charakter also mit der Spielleitung
 * sprechen.
 */
export const ALIGNMENTS: Alignment[] = [
  {
    key: "rechtschaffen-gut",
    name: "Rechtschaffen gut",
    nameEn: "Lawful Good",
    hook: "Du stellst dich vor Wehrlose, ohne zu fragen, ob es sich lohnt — und hältst dabei die Regeln ein, an die du glaubst.",
  },
  {
    key: "neutral-gut",
    name: "Neutral gut",
    nameEn: "Neutral Good",
    hook: "Du hilfst denen, die es brauchen, so gut es geht; Vorschriften sind dabei ein Werkzeug, kein Eid.",
  },
  {
    key: "chaotisch-gut",
    name: "Chaotisch gut",
    nameEn: "Chaotic Good",
    hook: "Dein Gewissen zählt mehr als jede Vorschrift — und die Steuereintreiber eines grausamen Barons zählen gar nicht.",
  },
  {
    key: "rechtschaffen-neutral",
    name: "Rechtschaffen neutral",
    nameEn: "Lawful Neutral",
    hook: "Du hast eine Ordnung, an der du dich festhältst: weder Bitten noch Versuchungen bringen dich davon ab.",
  },
  {
    key: "neutral",
    name: "Neutral",
    nameEn: "Neutral",
    hook: "Grundsatzdebatten langweilen dich; du tust, was in diesem Moment das Vernünftigste ist, und lässt dich nicht einspannen.",
  },
  {
    key: "chaotisch-neutral",
    name: "Chaotisch neutral",
    nameEn: "Chaotic Neutral",
    hook: "Deine Freiheit ist der einzige Grundsatz — alles andere entscheidest du, wenn es soweit ist.",
  },
  {
    key: "rechtschaffen-boese",
    name: "Rechtschaffen böse",
    nameEn: "Lawful Evil",
    hook: "Du nimmst dir methodisch, was du willst, und bleibst dabei im Rahmen einer Ordnung, die dich deckt.",
  },
  {
    key: "neutral-boese",
    name: "Neutral böse",
    nameEn: "Neutral Evil",
    hook: "Wenn dein Ziel andere etwas kostet, dann kostet es sie eben etwas — Grausamkeit brauchst du dafür nicht.",
  },
  {
    key: "chaotisch-boese",
    name: "Chaotisch böse",
    nameEn: "Chaotic Evil",
    hook: "Zerstörung ist für dich kein Mittel zum Zweck, sondern der Zweck — Hass und Blutdurst geben den Takt vor.",
  },
];
