/**
 * Konvertierungstemplate für den Dungeon-Import.
 *
 * Das Dungeon-Cockpit liest eine feste Form: Dungeon → Ebenen → Räume, und an
 * Räumen und Ebenen hängen Begegnungen, Fallen, Rätsel, Beute und Geheimnisse
 * (`dungeon-cockpit.ts`). Der Import erkennt diese Form über die Regeln in
 * `semantic/roles.ts` — aber nur, wenn das Dokument sie auch trägt. Ein Dungeon,
 * dessen Fallen mitten im Fließtext stehen statt unter einer eigenen
 * Überschrift, kommt ohne Fallen an.
 *
 * Dieses Template ist die Gegenprobe in Vorlagenform: ein vollständiges
 * Beispiel-Dokument, dessen Überschriften exakt die Muster treffen, die der
 * Import versteht. Wer fremdes Material (PDF, KI-Ausgabe, Notizen) in diese
 * Form bringt — von Hand oder als Konvertierungsauftrag an eine KI —, bekommt
 * beim Import mit Profil „Dungeon" garantiert Ebenen, Räume, Begegnungen,
 * Fallen, Rätsel, Beute, Geheimnisse, Werteblöcke und Handouts als eigene
 * Seiten. Der Test `dungeon-template.test.ts` erzwingt genau das: Ändert sich
 * eine Import-Regel, bricht das Template sichtbar, nicht still.
 *
 * Die Vorlage selbst ist rein — ein String, keine Abhängigkeit. Das Studio
 * bietet sie in der Import-Zentrale zum Kopieren/Herunterladen an.
 */

export const DUNGEON_TEMPLATE_FILE_NAME = "dungeon-konvertierungstemplate.md";

export const DUNGEON_CONVERSION_TEMPLATE = `---
titel: Name des Dungeons
typ: dungeon
status: entwurf
kampagnen: [Name der Kampagne]
tags: [dungeon]
---

# Name des Dungeons

### Ein Dungeon für 4 Charaktere · Stufe 3 · D&D 5e

## Für die Spielleitung

Die Wahrheit in wenigen Sätzen: Was ist hier passiert, was will der
Gegenspieler, was geschieht, wenn die Gruppe nichts tut. Uhren, Fraktionen im
Dungeon, der Ton. Ein kurzer Abschnitt wie dieser wandert in den Text der
Dungeon-Seite; trägt er eigene Unterabschnitte, wird er eine Unterseite direkt
am Dungeon.

:::dm
Was nur die Spielleitung lesen darf, steht in einem solchen Kasten. Der Server
schneidet ihn aus jedem Lesepfad ohne Studio-Häkchen heraus.
:::

## Die Anfahrt

Der Außenbereich vor dem eigentlichen Bau. Er wird als eigene Ebene behandelt:
Hier kommt die Gruppe an, hier liegen die Zugänge. Alternativ funktionieren
auch Überschriften wie „Die Wurzelplattform", „Der Vorplatz" oder „Umgebung".

### Zugang 1 — Das Haupttor

Der direkte Weg hinein: was man sieht, was er kostet. Zugänge werden Orte an
der Anfahrts-Ebene.

## Ebene 1 — Der Eingangsring

> **Vorlesen:**
> *Der Text, den die Gruppe beim Betreten hört. Er bleibt im Ebenentext
> erhalten und ist im Cockpit auf der Ebenen-Seite vollständig sichtbar.*

Der komplette Text der Ebene: Leitmotiv, was hier lebt, wie die Räume
zusammenhängen. Ebenen heißen „Ebene 1", „Etage 2", „Stockwerk 3", „Keller",
„Erdgeschoss" oder „Das Dach" — die Nummer bzw. das Wort muss am Anfang der
Überschrift stehen.

### Raum 1 — Die Vorhalle

Beschreibung des Raums: was man sieht, riecht, hört. Räume heißen „Raum 1",
„Raum 2a" … und stehen als Unterüberschrift ihrer Ebene.

#### Begegnung: Die Wächter

2 Skelett-Wächter (Werteblock W.1). Auslöser, Taktik, Ausgang. Begegnungen,
Fallen, Rätsel, Beute und Geheimnisse stehen als Unterüberschriften ihres
Raums (oder ihrer Ebene) und werden eigene Seiten im Raum-Cockpit.

#### Falle: Die Bodenplatte

Auslöser, Entdecken (SG), Entschärfen (SG), Effekt und Schaden.

#### Rätsel: Die Inschrift

Das Rätsel, die Lösung, was ein Fehlversuch kostet.

#### Beute: Die Truhe

Was hier zu holen ist — Münzen, Gegenstände, Hinweise.

#### Geheimnis: Die verborgene Tür

Wie man es findet (SG), wohin es führt.

### Raum 2 — Die Zisterne

Nicht jeder Raum braucht alle Unterabschnitte — nur die, die es im Raum
wirklich gibt.

## Ebene 2 — Das Gewölbe

> **Vorlesen:**
> *Der Vorlesetext der zweiten Ebene.*

Text der zweiten Ebene.

### Raum 3 — Die Kammer des Hüters

Der Raum des Endkampfs.

#### Begegnung: Der Hüter

Der Endgegner (Werteblock W.2), seine Phasen, seine Fluchtbedingung.

## Danach

Enden, Folgen, Beute des Ganzen — was die Welt aus dem Ausgang macht.

## Werteblöcke

**W.1 Skelett-Wächter** — *Mittelgroßer Untoter*
**RK** 13 · **TP** 13 · **Tempo** 9 m
**Angriff:** Kurzschwert +4, 1W6+2 Hiebschaden.

**W.2 Der Hüter** — *Großes Konstrukt*
**RK** 16 · **TP** 68 · **Tempo** 6 m
**Multiattacke:** Zwei Schläge +6, je 2W8+3 Wuchtschaden.

## Handouts

**H.1 Die Inschrift am Tor**
Der Wortlaut, den die Gruppe zu lesen bekommt. Jeder nummerierte Fettdruck
unter „Handouts" wird ein eigenes Handout — ab zwei Einträgen löst sich die
Liste auf.

**H.2 Der Zettel des Hüters**
Text des zweiten Handouts.
`;
