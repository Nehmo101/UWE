# Character Creator — Implementation Status

Stand: 2026-08-08T17:50:00+02:00

## Katalog
| Typ | Anzahl |
|-----|-------:|
| Spezies | 31 |
| Klassen | 14 |
| Hintergründe | 16 |
| Talente | 26 |
| Zauber | 330 (Grad 0–9) |
| Erfinder-Inventionen | 38 (12 auf Stufe 1) |

## Critic-Urteile
Siehe workstreams/*-critic.json — Kern-Workstreams APPROVED.

## Migration
- Local DB: Terra geseedet
- Character.species-Zeilen: 0
- NPC-Seiten: 0
- Legacy-SRD-Spezies-Keys: behalten (nicht gelöscht)

## Rollback
Git revert der Katalog-/Wizard-Dateien unter `packages/character-creator`, `packages/player-hub`, `apps/portal/src/components/character-wizard`.

## Bekannte Grenzen
- a11y e2e: Spec enthält `/auth/worlds/terra/characters/neu` hell+dunkel + Touch; voller Lauf über CI/`pnpm test:e2e:a11y` (Windows kann an `.next` EBUSY scheitern).
- Open5e wotc-srd ist klassischer SRD-Korpus (nicht 1:1 5.2.1-Wortlaut) — für UWE-Stufe-1 ausreichend.
- NPC-Spezies-Struktur: bewusst zurückgestellt (0 NPCs im Demo-Seed).
