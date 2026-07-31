# Mitglieder

Ein Mitglied ist eine **Person im Haushalt** — ein Konto ist optional. Das ist der
Unterschied zu früher: bis zur Ausbaustufe war ein Mitglied an eine Benutzer-ID gebunden,
ein Kleinkind oder eine Katze konnte also gar nicht existieren.

```mermaid
flowchart LR
  U["User in uwe.db<br/>(Häkchen Family)"] -. "userId, optional" .-> M["FamilyMemberProfile<br/>in uwe-family.db"]
  M --> C["Termine<br/>CalendarEventMember"]
  M --> G["Gesundheitsakte<br/>FamilyHealthRecord"]
  M --> A["Kalender-Abo<br/>FamilyCalendarSubscription"]
  M --> B["Geburtstag & Jahrestag"]
```

## Zwei Arten von Mitgliedern

| | Mit Konto | Ohne Konto |
|---|---|---|
| Anmelden | ja | nie |
| Entsteht durch | ersten Besuch | Anlegen auf `/members` |
| Profil pflegt | die Person selbst | der Haushalt gemeinsam |
| Entfernen | wird deaktiviert | wird gelöscht |
| Beispiele | Erwachsene | Kleinkind, Gast, Katze |

Ein Mitglied **mit** Konto wird beim Entfernen nur deaktiviert. Sonst legt der nächste
Besuch es sofort wieder an — und alte Beiträge verlören ihren Namen.

## Farben

Jede Person bekommt eine Farbe aus einer Palette von acht, die sich auch als kleiner Punkt
noch unterscheiden lassen. Die Vergabe ist automatisch (nächste freie Farbe) und lässt sich
überschreiben. Ohne gespeicherte Farbe wird eine aus der Kennung abgeleitet — im Kalender
ist nie jemand farblos.

Code: `packages/family-core/src/member-colours.ts`.

## Geburtstage und Jahrestage

Beides liegt am Mitglied und wird **nicht** als Termin gespeichert. Für Kalender, ICS-Feed
und Wochenbriefing werden die Vorkommen im gefragten Zeitraum aufgespannt. Ein Geburtstag
ist kein Kalendereintrag, den man versehentlich löschen können sollte.

Der 29. Februar rutscht in Nicht-Schaltjahren auf den 28. — wie es auch die iOS-Kalender-App
hält. Ein Geburtstag darf nicht drei von vier Jahren fehlen.

Code: `packages/family-core/src/anniversaries.ts`.

## Zugang bleibt getrennt

Diese Seite vergibt **keine Zugänge**. Welche E-Mail-Adresse Family betreten darf,
entscheidet allein das Häkchen im Command Center. Ein Mitglied anzulegen heisst: „diese
Person gehört zum Haushalt" — nicht „diese Person darf sich anmelden".
