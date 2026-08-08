/**
 * SRD-Zauber Grad 4 — Open5e wotc-srd (CC-BY-4.0), deutsche UWE-Fassungen.
 * Ability score names bleiben Englisch (Strength, Dexterity, …).
 */

import { SRD_SOURCE, type Spell } from "../types";

export const LEVEL4_SPELLS_B: Spell[] = [
  {
    key: "stone_shape",
    name: "Stein formen",
    nameEn: "Stone Shape",
    hook: "Stein formen: Grad 4, Verwandlung — Aktion, Berührung.",
    description: "Stein formen ist ein Zauber des 4. Grades (Verwandlung). Wirkungszeit: Aktion. Reichweite: Berührung. Dauer: Augenblicklich. Komponenten: V, G, M (Material: Soft clay, to be crudely worked into the desired shape for the stone object.). Listen: kleriker, druide, zauberer. Kernwirkung: Du berührst a stone object of Medium size or smaller or a section of stone no more than 1.5 Meter in any dimension and form it into any shape that suits dein purpose. So, for example, you could shape a large rock into a weapon, idol, or coffer, or make a small passage through a wall, as long as the wall is less than 1.5 Meter thick.",
    source: SRD_SOURCE,
    level: 4,
    school: "transmutation",
    castingTime: "Aktion",
    range: "Berührung",
    components: { verbal: true, somatic: true, material: "weicher Lehm, grob in die gewünschte Form des Steinobjekts gebracht" },
    duration: "Augenblicklich",
    concentration: false,
    ritual: false,
    lists: ["kleriker", "druide", "zauberer"],
  },
  {
    key: "stoneskin",
    name: "Steinhaut",
    nameEn: "Stoneskin",
    hook: "Steinhaut: Grad 4, Abwehr — Aktion, Berührung.",
    description: "Steinhaut ist ein Zauber des 4. Grades (Abwehr). Wirkungszeit: Aktion. Reichweite: Berührung. Dauer: Konzentration, bis zu 1 Stunde. Komponenten: V, G, M (Material: Diamond dust worth 100 gp, which the spell consumes.). Listen: kleriker, druide, waldlaeufer, hexenmeister, zauberer. Kernwirkung: Laut SRD: This spell turns the flesh of a willing Kreatur you touch as hard as stone. Until the spell ends, the target has resistance to nonmagical bludgeoning, piercing, and slashing Schaden.",
    source: SRD_SOURCE,
    level: 4,
    school: "abjuration",
    castingTime: "Aktion",
    range: "Berührung",
    components: { verbal: true, somatic: true, material: "Diamantstaub im Wert von 100 KM, den der Zauber verbraucht" },
    duration: "Konzentration, bis zu 1 Stunde",
    concentration: true,
    ritual: false,
    lists: ["kleriker", "druide", "waldlaeufer", "hexenmeister", "zauberer"],
  },
  {
    key: "wall_of_fire",
    name: "Feuerwall",
    nameEn: "Wall of Fire",
    hook: "Feuerwall: Grad 4, Hervorrufung — Aktion, 36 Meter.",
    description: "Feuerwall ist ein Zauber des 4. Grades (Hervorrufung). Wirkungszeit: Aktion. Reichweite: 36 Meter. Dauer: Konzentration, bis zu 1 Minute. Komponenten: V, G, M (Material: A small piece of phosphorus.). Listen: kleriker, druide, hexenmeister, hexenpakt_magier, zauberer. Kernwirkung: Du create a wall of fire on a solid surface in Reichweite. Du can make the wall up to 18 Meter long, 6 Meter high, and 0.3 Meter thick, or a ringed wall up to 6 Meter in diameter, 6 Meter high, and 0.3 Meter thick. Bei höherem Zauberplatz steigert sich der Effekt laut SRD.",
    source: SRD_SOURCE,
    level: 4,
    school: "evocation",
    castingTime: "Aktion",
    range: "36 Meter",
    components: { verbal: true, somatic: true, material: "ein kleines Stück Phosphor" },
    duration: "Konzentration, bis zu 1 Minute",
    concentration: true,
    ritual: false,
    lists: ["kleriker", "druide", "hexenmeister", "hexenpakt_magier", "zauberer"],
  },
];
