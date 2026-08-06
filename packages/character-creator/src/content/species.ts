/**
 * Der Spezies-Katalog des Charakter-Erstellers.
 *
 * Herkunft: SRD 5.2.1 (CC-BY-4.0, Wizards of the Coast), Kapitel
 * „Character Origins → Character Species". Der SRD 5.2.1 enthält **neun**
 * Spezies — der Aasimar aus dem Spielerhandbuch 2024 ist dort ausdrücklich
 * **nicht** enthalten und fehlt deshalb auch hier.
 *
 * Zwei Dinge, die beim Umstieg von den 2014er Regeln regelmäßig überraschen:
 *
 * 1. **Spezies vergeben keine Attributsboni mehr.** Die +2/+1 kommen
 *    ausschließlich vom Hintergrund. Es gibt hier also bewusst kein Feld
 *    dafür — wer eines vermisst, sucht im Hintergrund-Katalog.
 * 2. **Spezies-Merkmale können später einsetzen.** `Trait.level` trägt die
 *    Stufe: Drakonischer Flug und Große Gestalt greifen erst ab Stufe 5, die
 *    Abstammungszauber von Elf und Tiefling auf Stufe 3 und 5.
 *
 * Einheiten: `speed` und `darkvision` in Fuß (30 Fuß = 9 m), wie in
 * `types.ts` vereinbart. Auch die Prosa bleibt bei Fuß, damit Datenfeld und
 * Beschreibung nicht auseinanderlaufen.
 *
 * Die Abstammungslisten stehen in `species-lineages.ts` (Zeilenbudget, siehe
 * CLAUDE.md § Modul-Disziplin) und werden hier erneut exportiert.
 */

import { SRD_SOURCE, type Species } from "../types";
import {
  DRACONIC_ANCESTRIES,
  ELVEN_LINEAGES,
  FIENDISH_LEGACIES,
  GIANT_ANCESTRIES,
  GNOMISH_LINEAGES,
} from "./species-lineages";

export {
  DRACONIC_ANCESTRIES,
  ELVEN_LINEAGES,
  FIENDISH_LEGACIES,
  GIANT_ANCESTRIES,
  GNOMISH_LINEAGES,
};

/** Alle Spezies des SRD 5.2.1, in der Reihenfolge des Regelwerks. */
export const SPECIES: Species[] = [
  {
    key: "drachenblutige",
    name: "Drachenblütige",
    nameEn: "Dragonborn",
    hook: "Ein Drache in der Ahnenreihe: Du atmest Feuer, Frost, Säure, Blitz oder Gift — und ab Stufe 5 wachsen dir Flügel, wenn der Boden verschwindet.",
    description:
      "Drachenblütige stehen aufrecht, tragen Schuppen statt Haut und sehen aus wie das, was sie sind: die Nachkommen von Drachen. Am Tisch sind sie die Spezies mit der größten Geste — die Odemwaffe ist ein Angriff, den man ansagt, und den der Rest des Tisches jedes Mal kommen sieht.\n\nMechanisch ist die Odemwaffe ein Ersatz für einen Angriff, kein Extra: Du tauschst einen Schwerthieb gegen einen Kegel oder eine Linie, die mehrere Gegner trifft. Das lohnt sich, sobald zwei oder mehr im Bereich stehen. Dazu kommt Resistenz gegen genau die Schadensart, die du selbst austeilst — was Drachenblütige zu einer robusten Wahl gegen Gegner desselben Elements macht. Der Drakonische Flug ab Stufe 5 ist die eigentliche Belohnung: zehn Minuten Fliegen, einmal pro langer Rast, und plötzlich sind Abgründe, Mauern und Bogenschützen auf dem Dach kein Problem mehr.",
    source: SRD_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: 60,
    lineageLabel: "Drakonische Abstammung",
    lineages: DRACONIC_ANCESTRIES,
    art: "/character-creator/species/drachenblutige.svg",
    traits: [
      {
        name: "Drakonische Abstammung",
        description:
          "Du wählst einen Drachenahnen. Diese Wahl bestimmt die Schadensart deiner Odemwaffe, deine Schadensresistenz und dein Aussehen.",
        level: 1,
      },
      {
        name: "Odemwaffe",
        description:
          "Wenn du die Angriffsaktion ausführst, kannst du einen deiner Angriffe durch einen Odem ersetzen: ein Kegel von 15 Fuß oder eine Linie von 30 Fuß Länge und 5 Fuß Breite (Form jedes Mal frei wählbar). Jede Kreatur darin macht einen Geschicklichkeitsrettungswurf (SG 8 + Konstitutionsmodifikator + Übungsbonus) und erleidet bei Misserfolg 1W10 Schaden deiner Ahnen-Schadensart, bei Erfolg die Hälfte. Der Schaden steigt auf 2W10 (Stufe 5), 3W10 (Stufe 11) und 4W10 (Stufe 17). Anwendungen wie dein Übungsbonus, zurück nach einer langen Rast.",
        level: 1,
      },
      {
        name: "Schadensresistenz",
        description:
          "Du bist gegen die Schadensart resistent, die deine Drakonische Abstammung festlegt.",
        level: 1,
      },
      {
        name: "Dunkelsicht",
        description: "Du hast Dunkelsicht mit einer Reichweite von 60 Fuß.",
        level: 1,
      },
      {
        name: "Drakonischer Flug",
        description:
          "Ab Stufe 5 lässt du dir als Bonusaktion geisterhafte Flügel wachsen. Zehn Minuten lang — oder bis du sie einziehst oder kampfunfähig wirst — hast du eine Flugbewegungsrate in Höhe deiner Bewegungsrate. Einmal pro langer Rast.",
        level: 5,
      },
    ],
  },
  {
    key: "zwerg",
    name: "Zwerg",
    nameEn: "Dwarf",
    hook: "Gift perlt an dir ab, jeder Stufenaufstieg macht dich zäher, und eine Hand auf dem Fels verrät dir, was sich hinter der Wand bewegt.",
    description:
      "Zwerge sind gedrungen, langlebig und an Stein gewöhnt wie andere an Tageslicht. Mit 120 Fuß Dunkelsicht sehen sie im Dungeon doppelt so weit wie fast jeder andere in der Gruppe — der Zwerg ist die Figur, die vorausgeht, wenn die Fackel ausgeht.\n\nDie 2024er Regeln haben aus Zwergen richtige Überlebenskünstler gemacht. Zwergische Zähigkeit gibt einen Trefferpunkt pro Stufe — auf Stufe 10 sind das zehn geschenkte Trefferpunkte, unabhängig von der Klasse. Zwergische Unverwüstlichkeit deckt Gift ab, eine der häufigsten Schadensarten in den unteren Stufen. Und Steingespür ist kein Wissensbonus mehr, sondern echter Erschütterungssinn: Als Bonusaktion spürst du zehn Minuten lang alles, was den Stein um dich herum berührt — durch Wände, durch Dunkelheit, durch Unsichtbarkeit hindurch.",
    source: SRD_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: 120,
    art: "/character-creator/species/zwerg.svg",
    traits: [
      {
        name: "Dunkelsicht",
        description: "Du hast Dunkelsicht mit einer Reichweite von 120 Fuß.",
        level: 1,
      },
      {
        name: "Zwergische Unverwüstlichkeit",
        description:
          "Du bist gegen Giftschaden resistent. Außerdem bist du bei Rettungswürfen im Vorteil, mit denen du den Zustand Vergiftet vermeidest oder beendest.",
        level: 1,
      },
      {
        name: "Zwergische Zähigkeit",
        description:
          "Dein Trefferpunktemaximum steigt um 1 — und bei jedem Stufenaufstieg um einen weiteren Punkt.",
        level: 1,
      },
      {
        name: "Steingespür",
        description:
          "Als Bonusaktion erhältst du zehn Minuten lang Erschütterungssinn mit einer Reichweite von 60 Fuß. Du musst dafür auf Stein stehen oder Stein berühren; natürlich gewachsen oder bearbeitet ist egal. Anwendungen wie dein Übungsbonus, zurück nach einer langen Rast.",
        level: 1,
      },
    ],
  },
  {
    key: "elf",
    name: "Elf",
    nameEn: "Elf",
    hook: "Vier Stunden Trance statt einer Nacht Schlaf — und eine Abstammung, die dir Magie in die Hand legt, bevor du überhaupt eine Klasse gewählt hast.",
    description:
      "Elfen sind schlank, langlebig und niemals ganz von dieser Welt. Sie sind die einzige Spezies im SRD, deren Abstammung über die ganze Kampagne weiterwächst: Auf Stufe 1, 3 und 5 kommt jeweils etwas dazu, unabhängig von der Klasse.\n\nDas macht Elfen zur flexibelsten Wahl im Katalog. Ein Kämpfer mit Drow-Abstammung bekommt auf Stufe 5 Dunkelheit, ein Schurke mit Waldelfen-Abstammung Spurloses Gehen für die ganze Gruppe, ein Hochelf tauscht jeden Morgen seinen Magier-Zaubertrick gegen den, der heute gebraucht wird. Dazu kommen Vorteil gegen Bezaubern, eine frei gewählte Sinnesfertigkeit und Trance: Elfen schlafen nicht, sie meditieren vier Stunden — praktisch, wenn die Gruppe Wachen einteilt.",
    source: SRD_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: 60,
    lineageLabel: "Elfische Abstammung",
    lineages: ELVEN_LINEAGES,
    art: "/character-creator/species/elf.svg",
    traits: [
      {
        name: "Dunkelsicht",
        description:
          "Du hast Dunkelsicht mit einer Reichweite von 60 Fuß. Die Drow-Abstammung erhöht sie auf 120 Fuß.",
        level: 1,
      },
      {
        name: "Elfische Abstammung",
        description:
          "Du wählst eine Abstammung (Drow, Hochelf oder Waldelf) und erhältst deren Vorzug auf Stufe 1 sowie je einen Zauber auf Stufe 3 und 5. Intelligenz, Weisheit oder Charisma ist dabei dein Zauberattribut — du legst es bei der Wahl der Abstammung fest.",
        level: 1,
      },
      {
        name: "Feenblut",
        description:
          "Du bist bei Rettungswürfen im Vorteil, mit denen du den Zustand Bezaubert vermeidest oder beendest.",
        level: 1,
      },
      {
        name: "Scharfe Sinne",
        description:
          "Du bist in einer Fertigkeit deiner Wahl geübt: Motiv erkennen, Wahrnehmung oder Überlebenskunst.",
        level: 1,
      },
      {
        name: "Trance",
        description:
          "Du musst nicht schlafen, und Magie kann dich nicht einschläfern. Eine lange Rast schließt du in vier Stunden tranceartiger Meditation ab und bleibst dabei bei Bewusstsein.",
        level: 1,
      },
    ],
  },
  {
    key: "gnom",
    name: "Gnom",
    nameEn: "Gnome",
    hook: "Klein, unverschämt schwer zu verzaubern — und mit einem Kopf voller Uhrwerke oder einem Ohr für das Gespräch der Tiere.",
    description:
      "Gnome sind knapp einen Meter groß, neugierig bis zur Unvorsichtigkeit und im ganzen Multiversum dafür bekannt, Dinge auseinanderzunehmen. Als kleine Kreaturen können sie keine schweren Waffen führen — dafür bringen sie die beste Verteidigung im Katalog mit.\n\nGnomische Gerissenheit gibt Vorteil auf alle Rettungswürfe gegen Intelligenz, Weisheit und Charisma. Genau dort sitzen die Effekte, die einen Charakter aus dem Spiel nehmen: Bezaubern, Angst, Beherrschung, Illusionen, psychischer Schaden. Kein anderes Merkmal im SRD deckt so viel auf einmal ab. Der Rest ist Charakter statt Kampfkraft — der Waldgnom redet mit Tieren, der Felsengnom baut winzige Uhrwerke, und beides erzeugt am Tisch mehr Szenen als Schaden.",
    source: SRD_SOURCE,
    size: "small",
    speed: 30,
    darkvision: 60,
    lineageLabel: "Gnomische Abstammung",
    lineages: GNOMISH_LINEAGES,
    art: "/character-creator/species/gnom.svg",
    traits: [
      {
        name: "Dunkelsicht",
        description: "Du hast Dunkelsicht mit einer Reichweite von 60 Fuß.",
        level: 1,
      },
      {
        name: "Gnomische Gerissenheit",
        description:
          "Du bist bei Rettungswürfen auf Intelligenz, Weisheit und Charisma im Vorteil.",
        level: 1,
      },
      {
        name: "Gnomische Abstammung",
        description:
          "Du wählst eine Abstammung: Waldgnom oder Felsengnom. Intelligenz, Weisheit oder Charisma ist dein Zauberattribut für die Zauber dieses Merkmals — du legst es bei der Wahl fest.",
        level: 1,
      },
    ],
  },
  {
    key: "goliath",
    name: "Goliath",
    nameEn: "Goliath",
    hook: "Riesenblut auf zwei Metern: 35 Fuß Bewegungsrate, eine Gabe deiner Ahnen — und ab Stufe 5 wirst du zehn Minuten lang wirklich groß.",
    description:
      "Goliaths sind über zwei Meter groß, tragen die Muster ihrer Riesenahnen auf der Haut und bewegen sich schneller als alle anderen im Katalog. Sie sind die neue Spezies für alle, die früher zum Halbork gegriffen haben — nur mit mehr Auswahl.\n\nDie Riesische Abstammung ist der Kern: Sechs sehr unterschiedliche Gaben, von reinem Zusatzschaden (Feuerriese) über Kontrolle (Frost- und Hügelriese) bis zu Verteidigung (Steinriese) und Beweglichkeit (Wolkenriese). Diese Wahl prägt den Charakter deutlicher als bei jeder anderen Spezies. Dazu kommen Kräftiger Körperbau — Vorteil gegen Umklammerungen und eine Größenkategorie mehr Traglast — und Große Gestalt: Ab Stufe 5 wirst du für zehn Minuten wirklich Groß, mit Vorteil auf Stärkewürfe und 10 Fuß mehr Bewegungsrate.",
    source: SRD_SOURCE,
    size: "medium",
    speed: 35,
    darkvision: null,
    lineageLabel: "Riesische Abstammung",
    lineages: GIANT_ANCESTRIES,
    art: "/character-creator/species/goliath.svg",
    traits: [
      {
        name: "Riesische Abstammung",
        description:
          "Du stammst von Riesen ab und wählst eine ihrer Gaben. Du kannst sie so oft einsetzen, wie dein Übungsbonus beträgt; nach einer langen Rast sind alle Anwendungen zurück.",
        level: 1,
      },
      {
        name: "Kräftiger Körperbau",
        description:
          "Du bist bei allen Attributswürfen im Vorteil, mit denen du den Zustand Gepackt beendest. Für deine Traglast zählst du als eine Größenkategorie größer.",
        level: 1,
      },
      {
        name: "Große Gestalt",
        description:
          "Ab Stufe 5 wechselst du als Bonusaktion in die Größenkategorie Groß, sofern genug Platz da ist. Zehn Minuten lang — oder bis du es beendest — bist du bei Stärkewürfen im Vorteil, und deine Bewegungsrate steigt um 10 Fuß. Einmal pro langer Rast.",
        level: 5,
      },
    ],
  },
  {
    key: "halbling",
    name: "Halbling",
    nameEn: "Halfling",
    hook: "Die Eins auf dem W20 darfst du noch einmal würfeln — und wenn es eng wird, versteckst du dich hinter dem Ork, der gerade auf dich einschlägt.",
    description:
      "Halblinge sind knapp einen Meter groß, gutmütig und erstaunlich schwer umzubringen. Sie haben keine Dunkelsicht und keinen Zauber — dafür vier Merkmale, die jede einzelne Spielsitzung berühren.\n\nHalblingsglück ist das bekannteste: Jede gewürfelte 1 auf einem W20 darf wiederholt werden, ohne Begrenzung, ohne Rast. Über eine Kampagne hinweg ist das der stärkste passive Effekt im ganzen Katalog. Tapferkeit deckt Angst ab, Halblingsgewandtheit lässt dich durch besetzte Bereiche laufen, und Angeborene Verstohlenheit erlaubt dir, dich hinter jeder größeren Kreatur zu verstecken — auch hinter Feinden, auch mitten im Kampf. Für Schurken und Bogenschützen ist das eine Kombination, die kaum eine andere Spezies bietet.",
    source: SRD_SOURCE,
    size: "small",
    speed: 30,
    darkvision: null,
    art: "/character-creator/species/halbling.svg",
    traits: [
      {
        name: "Tapferkeit",
        description:
          "Du bist bei Rettungswürfen im Vorteil, mit denen du den Zustand Verängstigt vermeidest oder beendest.",
        level: 1,
      },
      {
        name: "Halblingsgewandtheit",
        description:
          "Du kannst dich durch den Bereich jeder Kreatur bewegen, die mindestens eine Größenkategorie größer ist als du — anhalten darfst du dort aber nicht.",
        level: 1,
      },
      {
        name: "Halblingsglück",
        description:
          "Würfelst du bei einer W20-Prüfung eine 1, darfst du den Würfel neu werfen. Das neue Ergebnis zählt.",
        level: 1,
      },
      {
        name: "Angeborene Verstohlenheit",
        description:
          "Du kannst die Verstecken-Aktion auch dann ausführen, wenn dich nur eine Kreatur verdeckt, die mindestens eine Größenkategorie größer ist als du.",
        level: 1,
      },
    ],
  },
  {
    key: "mensch",
    name: "Mensch",
    nameEn: "Human",
    hook: "Keine Dunkelsicht, keine Magie im Blut — dafür ein ganzes Talent extra, eine Fertigkeit obendrauf und jeden Morgen eine zweite Chance.",
    description:
      "Menschen sind die Spezies ohne Ahnentafel: kein Erbe, kein Odem, kein Erschütterungssinn. Was sie stattdessen bekommen, ist Auswahl — und die ist in den 2024er Regeln überraschend viel wert.\n\nVielseitig gibt ein zusätzliches Ursprungstalent, also genau das, was sonst der Hintergrund vergibt. Das ist der stärkste einzelne Vorteil, den eine Spezies im SRD bietet: Kriegsmeister, Zäh, Magiebegabt oder Begabt — der Charakter startet damit auf einem Niveau, das andere erst mit Stufe 4 erreichen. Geschickt legt noch eine Fertigkeit obendrauf, und Einfallsreich gibt nach jeder langen Rast Heldische Inspiration, also einen freien Wiederholungswurf, jeden Spieltag neu. Menschen sind deshalb selten die auffälligste, aber oft die mechanisch sauberste Wahl — und bei ihnen entscheidest du zusätzlich, ob dein Charakter mittelgroß oder klein ist.",
    source: SRD_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: null,
    art: "/character-creator/species/mensch.svg",
    traits: [
      {
        name: "Einfallsreich",
        description:
          "Nach jeder langen Rast erhältst du Heldische Inspiration — einen Wurf, den du wiederholen darfst.",
        level: 1,
      },
      {
        name: "Geschickt",
        description: "Du bist in einer Fertigkeit deiner Wahl geübt.",
        level: 1,
      },
      {
        name: "Vielseitig",
        description:
          "Du erhältst ein Ursprungstalent deiner Wahl. Das Regelwerk empfiehlt Begabt (Skilled), aber jedes Ursprungstalent ist erlaubt.",
        level: 1,
      },
    ],
  },
  {
    key: "ork",
    name: "Ork",
    nameEn: "Orc",
    hook: "Ein Sprint mitten hinein, 120 Fuß Sicht in völliger Finsternis — und ein Körper, der sich weigert, bei null Trefferpunkten liegen zu bleiben.",
    description:
      "Orks sind kräftig gebaut, gut zwei Meter groß und tragen Hauer wie andere ein Lächeln. Seit den 2024er Regeln sind sie eine eigene Spezies statt einer Beimischung — und eine der wirkungsvollsten für alle, die vorne stehen wollen.\n\nAdrenalinrausch ist das Merkmal, das den Spielstil prägt: Spurten als Bonusaktion, dazu temporäre Trefferpunkte in Höhe des Übungsbonus, und das mehrfach pro kurzer Rast. Ein Ork überbrückt damit in Runde 1 fast jede Distanz und kommt trotzdem mit Polster an. Durchhaltevermögen fängt einmal pro langer Rast den Schlag ab, der jeden anderen umgeworfen hätte. Und mit 120 Fuß Dunkelsicht sieht der Ork im Dungeon so weit wie der Zwerg.",
    source: SRD_SOURCE,
    size: "medium",
    speed: 30,
    darkvision: 120,
    art: "/character-creator/species/ork.svg",
    traits: [
      {
        name: "Adrenalinrausch",
        description:
          "Du kannst die Spurt-Aktion als Bonusaktion ausführen. Dabei erhältst du temporäre Trefferpunkte in Höhe deines Übungsbonus. Anwendungen wie dein Übungsbonus, zurück nach einer kurzen oder langen Rast.",
        level: 1,
      },
      {
        name: "Dunkelsicht",
        description: "Du hast Dunkelsicht mit einer Reichweite von 120 Fuß.",
        level: 1,
      },
      {
        name: "Durchhaltevermögen",
        description:
          "Sinken deine Trefferpunkte auf 0, ohne dass du sofort stirbst, kannst du stattdessen bei 1 Trefferpunkt bleiben. Einmal pro langer Rast.",
        level: 1,
      },
    ],
  },
  {
    key: "tiefling",
    name: "Tiefling",
    nameEn: "Tiefling",
    hook: "Höllenblut, das man dir ansieht: Feuer, Gift oder Grabeskälte prallen an dir ab, und mit jeder Stufe wächst dir ein weiterer Zauber zu.",
    description:
      "Tieflinge tragen Hörner, ungewöhnliche Augen und einen Stammbaum, den niemand in der Familie gern erklärt. Sie sind die Spezies, deren Aussehen im Rollenspiel sofort eine Rolle spielt — Wachen schauen zweimal hin, Priester wechseln die Straßenseite.\n\nMechanisch funktioniert das Unholdische Erbe wie die elfische Abstammung: ein Vorzug auf Stufe 1, je ein Zauber auf Stufe 3 und 5, unabhängig von der Klasse. Die drei Erben unterscheiden sich klar — Infernalisch gibt Feuerresistenz und einen Fernangriff, Chthonisch nekrotische Resistenz und ein Trefferpunkte-Polster, Abyssisch Giftresistenz und auf Stufe 5 den stärksten Kontrollzauber der drei. Dazu kommt Thaumaturgie als kostenloser Zaubertrick, mit dem sich ein ganzer Raum einschüchtern lässt, ohne einen Würfel anzufassen. Wie beim Menschen wählst du außerdem, ob dein Tiefling mittelgroß oder klein ist.",
    source: SRD_SOURCE,
    size: "medium",
    sizeChoice: ["medium", "small"],
    speed: 30,
    darkvision: 60,
    lineageLabel: "Unholdisches Erbe",
    lineages: FIENDISH_LEGACIES,
    art: "/character-creator/species/tiefling.svg",
    traits: [
      {
        name: "Dunkelsicht",
        description: "Du hast Dunkelsicht mit einer Reichweite von 60 Fuß.",
        level: 1,
      },
      {
        name: "Unholdisches Erbe",
        description:
          "Du wählst ein Erbe (Abyssisch, Chthonisch oder Infernalisch) und erhältst dessen Vorzug auf Stufe 1 sowie je einen Zauber auf Stufe 3 und 5. Intelligenz, Weisheit oder Charisma ist dabei dein Zauberattribut — du legst es bei der Wahl des Erbes fest.",
        level: 1,
      },
      {
        name: "Außerweltliche Präsenz",
        description:
          "Du kennst den Zaubertrick Thaumaturgie (Thaumaturgy). Wirkst du ihn über dieses Merkmal, nutzt er dasselbe Zauberattribut wie dein Unholdisches Erbe.",
        level: 1,
      },
    ],
  },
];

/** Nachschlag über den technischen Schlüssel — `undefined`, wenn es ihn nicht gibt. */
export function findSpecies(key: string): Species | undefined {
  return SPECIES.find((species) => species.key === key);
}
