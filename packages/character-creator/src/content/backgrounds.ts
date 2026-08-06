/**
 * Hintergründe — der Ort, an dem in den Regeln von 2024 die Attributspunkte
 * verteilt werden.
 *
 * Wichtig für alle, die die Liste für zu kurz halten: **SRD 5.2.1 enthält
 * genau vier Hintergründe** — Acolyte, Criminal, Sage, Soldier. Die sechzehn
 * Hintergründe des Spielerhandbuchs 2024 (Artisan, Charlatan, Entertainer,
 * Farmer, Guard, Guide, Hermit, Merchant, Noble, Sailor, Scribe, Wayfarer)
 * stehen **nicht** im SRD und sind damit weder nachprüfbar noch unter
 * CC-BY-4.0 verwendbar. Geprüft am 2026-08-06 direkt gegen die offizielle
 * PDF `SRD_CC_v5.2.1` (Abschnitt „Character Origins → Character Backgrounds“,
 * S. 82) sowie gegen zwei unabhängige Markdown-Konversionen derselben Datei.
 *
 * // TODO(unverified): Artisan, Charlatan, Entertainer, Farmer, Guard, Guide,
 * // Hermit, Merchant, Noble, Sailor, Scribe, Wayfarer — nur im PHB 2024,
 * // nicht im SRD 5.2.1. Erst aufnehmen, wenn eine lizenzkonforme Quelle
 * // vorliegt; nicht aus dem Gedächtnis nachbauen.
 *
 * Was ein Hintergrund laut SRD mitbringt:
 * - drei Attribute; darin +2/+1 oder +1/+1/+1 (max. 20)
 * - ein Ursprungstalent
 * - Übung in zwei Fertigkeiten
 * - Übung mit einem Werkzeug
 * - die Wahl zwischen einem Ausrüstungspaket **oder** 50 GM
 *
 * Zur letzten Zeile: `equipment` + `startingGold` bilden immer **Paket A** ab.
 * Die Alternative „stattdessen 50 GM“ trägt der Datenvertrag nicht als
 * eigenes Feld; sie steht deshalb im Fließtext jedes Eintrags, damit sie in
 * der Oberfläche nicht verlorengeht.
 *
 * Deutsche Namen und Begriffe folgen der deutschen SRD-5.2.1-Fassung, damit
 * Charakterbogen, Wiki und Ersteller dieselben Wörter benutzen.
 */

import { SRD_SOURCE, type Background } from "../types";

export const BACKGROUNDS: Background[] = [
  // ───────────────────────────── Akolyth ─────────────────────────────
  {
    key: "akolyth",
    name: "Akolyth",
    nameEn: "Acolyte",
    hook:
      "Der Tempel hat dich großgezogen: Du kennst die Gebete, die Bücher und " +
      "die Leute, die zu beidem kommen, wenn es ihnen schlecht geht.",
    description:
      "Du hast im Dienst eines Tempels gestanden, lange bevor du zum ersten " +
      "Mal ein Abenteuer erlebt hast — Kerzen richten, Schriftrollen " +
      "abschreiben, Trauernden zuhören. Was dabei hängen geblieben ist, ist " +
      "nicht nur Frömmigkeit, sondern Handwerk: eine ruhige Hand für die " +
      "Feder und ein Gespür dafür, wann jemand die Wahrheit dehnt.\n\n" +
      "Am Tisch ist der Akolyth der Hintergrund für Charaktere, die eine " +
      "Institution im Rücken haben — Priesterschaft, Orden, Klosterschule. " +
      "Regeltechnisch bringt er die drei geistigen Attribute mit und mit " +
      "„Eingeweihter der Magie (Kleriker)“ echte Zauber auf Stufe 1, auch " +
      "wenn deine Klasse gar nicht zaubern kann.\n\n" +
      "Ausrüstung: Wähle A oder B — (A) das unten gelistete Paket samt 8 GM, " +
      "oder (B) stattdessen 50 GM.",
    abilityOptions: ["intelligence", "wisdom", "charisma"],
    skills: ["insight", "religion"],
    toolProficiency: "Kalligrafiewerkzeug",
    originFeat: "eingeweihter-der-magie-kleriker",
    equipment: [
      "Kalligrafiewerkzeug",
      "Buch (Gebete)",
      "Heiliges Symbol",
      "Pergament (10 Blätter)",
      "Robe",
    ],
    startingGold: 8,
    source: SRD_SOURCE,
  },

  // ─────────────────────────── Krimineller ───────────────────────────
  {
    key: "krimineller",
    name: "Krimineller",
    nameEn: "Criminal",
    hook:
      "Du weißt, welches Fenster klemmt und wann die Wache umdreht — und bei " +
      "Ärger bist du einen Herzschlag früher wach als alle anderen.",
    description:
      "Du hast dein Geld auf der falschen Seite des Gesetzes verdient: " +
      "Einbruch, Hehlerei, Botengänge, die niemand mitbekommen sollte. Was " +
      "davon bleibt, sind schnelle Finger, ein Blick für Fluchtwege und die " +
      "Angewohnheit, jeden Raum zuerst nach dem zweiten Ausgang " +
      "abzusuchen.\n\n" +
      "Am Tisch ist das der Hintergrund für alle, die den Plan lieber " +
      "unterwandern als ihm folgen. Regeltechnisch ist er ungewöhnlich " +
      "vielseitig: Geschicklichkeit, Konstitution und Intelligenz decken " +
      "Schurke, Waldläufer und Magier gleichermaßen ab, und „Wachsam“ " +
      "verschiebt dich zuverlässig an den Anfang der Initiativreihenfolge.\n\n" +
      "Ausrüstung: Wähle A oder B — (A) das unten gelistete Paket samt " +
      "16 GM, oder (B) stattdessen 50 GM.",
    abilityOptions: ["dexterity", "constitution", "intelligence"],
    skills: ["sleight_of_hand", "stealth"],
    toolProficiency: "Diebeswerkzeug",
    originFeat: "wachsam",
    equipment: [
      "2 Dolche",
      "Diebeswerkzeug",
      "Brechstange",
      "2 Beutel",
      "Reisekleidung",
    ],
    startingGold: 16,
    source: SRD_SOURCE,
  },

  // ───────────────────────────── Weiser ─────────────────────────────
  {
    key: "weiser",
    name: "Weiser",
    nameEn: "Sage",
    hook:
      "Du hast das Antwortenfinden gelernt, bevor du das Kämpfen gelernt " +
      "hast — und den ersten Zauber aus reiner Neugier ausprobiert.",
    description:
      "Bibliothek, Skriptorium, die Werkstatt einer alten Lehrmeisterin: Du " +
      "hast Jahre damit verbracht, Dinge nachzuschlagen, die andere für " +
      "erledigt hielten. Deshalb erkennst du eine Wappenkombination, ein " +
      "Runenalphabet oder den Namen eines längst gestürzten Fürstenhauses " +
      "auch dann noch, wenn nur ein Fetzen davon übrig ist.\n\n" +
      "Am Tisch ist der Weise der Hintergrund für Charaktere, die " +
      "Hintergrundwissen ins Spiel bringen sollen: Arkane Kunde und " +
      "Geschichte sind die beiden Fertigkeiten, mit denen man ein Rätsel " +
      "aufmacht, statt es zu erschlagen. „Eingeweihter der Magie (Magier)“ " +
      "gibt außerdem zwei Zaubertricks und einen Zauber des 1. Grades — " +
      "unabhängig von der Klasse.\n\n" +
      "Ausrüstung: Wähle A oder B — (A) das unten gelistete Paket samt 8 GM, " +
      "oder (B) stattdessen 50 GM.",
    abilityOptions: ["constitution", "intelligence", "wisdom"],
    skills: ["arcana", "history"],
    toolProficiency: "Kalligrafiewerkzeug",
    originFeat: "eingeweihter-der-magie-magier",
    equipment: [
      "Kampfstab",
      "Kalligrafiewerkzeug",
      "Buch (Geschichte)",
      "Pergament (8 Blätter)",
      "Robe",
    ],
    startingGold: 8,
    source: SRD_SOURCE,
  },

  // ───────────────────────────── Soldat ─────────────────────────────
  {
    key: "soldat",
    name: "Soldat",
    nameEn: "Soldier",
    hook:
      "Marschieren, Wachestehen, Würfeln im Zelt — und der eine Schlag, den " +
      "du sitzen lässt, wenn es wirklich darauf ankommt.",
    description:
      "Du warst Teil einer Truppe: Stadtgarde, Söldnerbande, Feldheer. Du " +
      "kennst Rangordnungen, Feldlager und das Geräusch, mit dem eine " +
      "Formation bricht. Und du weißt, dass die halbe Arbeit darin besteht, " +
      "die richtigen Leute im richtigen Moment einzuschüchtern, damit gar " +
      "nicht erst gekämpft werden muss.\n\n" +
      "Am Tisch ist der Soldat der geradlinigste Hintergrund im SRD: " +
      "Stärke, Geschicklichkeit und Konstitution sind exakt die drei " +
      "Attribute, die eine Nahkampfklasse braucht, und „Wilder Angreifer“ " +
      "rettet einmal pro Zug den verunglückten Schadenswurf. Das " +
      "Werkzeug ist ein Spielset deiner Wahl — im Lager wird gespielt.\n\n" +
      "Ausrüstung: Wähle A oder B — (A) das unten gelistete Paket samt " +
      "14 GM, oder (B) stattdessen 50 GM.",
    abilityOptions: ["strength", "dexterity", "constitution"],
    skills: ["athletics", "intimidation"],
    toolProficiency: "Ein Spielset deiner Wahl",
    originFeat: "wilder-angreifer",
    equipment: [
      "Speer",
      "Kurzbogen",
      "20 Pfeile",
      "Spielset (dasselbe wie oben)",
      "Heilerausrüstung",
      "Köcher",
      "Reisekleidung",
    ],
    startingGold: 14,
    source: SRD_SOURCE,
  },
];

/** Hintergrund per Schlüssel nachschlagen. */
export function findBackground(key: string): Background | undefined {
  return BACKGROUNDS.find((entry) => entry.key === key);
}
