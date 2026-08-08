/**
 * SRD-Zauber Grad 6 — Open5e wotc-srd (CC-BY-4.0), deutsche UWE-Fassungen.
 * Ability score names bleiben Englisch (Strength, Dexterity, …).
 */

import { SRD_SOURCE, type Spell } from "../types";

export const LEVEL6_SPELLS_B: Spell[] = [
  {
    key: "wall_of_thorns",
    name: "Dornenwall",
    nameEn: "Wall of Thorns",
    hook: "Dornenwall: Grad 6, Beschwörung — Aktion, 36 Meter.",
    description: "Dornenwall ist ein Zauber des 6. Grades (Beschwörung). Wirkungszeit: Aktion. Reichweite: 36 Meter. Dauer: Konzentration, bis zu 10 Minuten. Komponenten: V, G, M (Material: A handful of thorns.). Listen: druide. Kernwirkung: Du create a wall of tough, pliable, tangled brush bristling with needle-sharp thorns. The wall appears in Reichweite on a solid surface and lasts für die Dauer. Bei höherem Zauberplatz steigert sich der Effekt laut SRD.",
    source: SRD_SOURCE,
    level: 6,
    school: "conjuration",
    castingTime: "Aktion",
    range: "36 Meter",
    components: { verbal: true, somatic: true, material: "eine Handvoll Dornen" },
    duration: "Konzentration, bis zu 10 Minuten",
    concentration: true,
    ritual: false,
    lists: ["druide"],
  },
  {
    key: "wind_walk",
    name: "Windwandeln",
    nameEn: "Wind Walk",
    hook: "Windwandeln: Grad 6, Verwandlung — 1 Minute, 9 Meter.",
    description: "Windwandeln ist ein Zauber des 6. Grades (Verwandlung). Wirkungszeit: 1 Minute. Reichweite: 9 Meter. Dauer: 8 Stunden. Komponenten: V, G, M (Material: Fire and holy water.). Listen: druide. Kernwirkung: Du and up to ten willing Kreaturen you can see in Reichweite assume a gaseous form für die Dauer, appearing as wisps of cloud. While in this cloud form, a Kreatur has a flying speed of 90 Meter and has resistance to Schaden from nonmagical weapons.",
    source: SRD_SOURCE,
    level: 6,
    school: "transmutation",
    castingTime: "1 Minute",
    range: "9 Meter",
    components: { verbal: true, somatic: true, material: "Feuer und Weihwasser" },
    duration: "8 Stunden",
    concentration: false,
    ritual: false,
    lists: ["druide"],
  },
  {
    key: "word_of_recall",
    name: "Rückrufwort",
    nameEn: "Word of Recall",
    hook: "Rückrufwort: Grad 6, Beschwörung — Aktion, 1.5 Meter.",
    description: "Rückrufwort ist ein Zauber des 6. Grades (Beschwörung). Wirkungszeit: Aktion. Reichweite: 1.5 Meter. Dauer: Augenblicklich. Komponenten: V. Listen: kleriker. Kernwirkung: Du and up to five willing Kreaturen within 1.5 Meter of you instantly teleport to a previously designated sanctuary. Du and any Kreaturen that teleport with you appear in the nearest unoccupied space to the spot you designated when you prepared dein sanctuary (see below).",
    source: SRD_SOURCE,
    level: 6,
    school: "conjuration",
    castingTime: "Aktion",
    range: "1.5 Meter",
    components: { verbal: true, somatic: false, material: null },
    duration: "Augenblicklich",
    concentration: false,
    ritual: false,
    lists: ["kleriker"],
  },
];
