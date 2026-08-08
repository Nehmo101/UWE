# Character Creator — Implementation Status

Stand: 2026-08-08T16:48:43+02:00

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
Git revert der Katalog-/Wizard-Dateien unter packages/character-creator, packages/player-hub, pps/portal/src/components/character-wizard.

## Bekannte Grenzen
- a11y e2e: Spec enthält /auth/worlds/terra/characters/neu hell+dunkel; lokaler Lauf kann an Windows .next EBUSY scheitern — CI ist maßgeblich.
- Zauber-Materialkomponenten teils Englisch (SRD-Original).
- /ultracode in dieser Umgebung nicht verfügbar.
