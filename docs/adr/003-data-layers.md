# ADR 003: Getrennte Datenebenen für D&D und Brain

## Status

Accepted — 2026-07-15

Diese Entscheidung legt Ziel- und Übergangszustand fest. In dieser Welle findet
keine Datenmigration statt.

## Kontext

Die heutige `uwe.db`, gemeinsame Uploadroots und instanzweite Backups enthalten
Platform-, D&D-, Portal- und hochprivate Brain-Daten. Logische Modellnamen wie
`BrainDocument` und `PersonalBrainDocument` trennen Domänen, erzwingen aber
keine physische Isolation, getrennte Sicherung oder getrennte
Zugriffsberechtigung.

## Entscheidung

Der Zielzustand trennt die Datenebenen physisch und operativ:

| Ebene | Zielzustand |
|---|---|
| D&D-Weltdaten | Verbleiben in einer D&D-/Studio-Datenbank; Portal erhält daraus ausschließlich player-safe Projektionen. |
| Private Brain-Daten | Liegen in einer eigenen `uwe-brain.db`, ohne D&D-Tabellen, Portal-Read-Models oder fachfremde Platform-Payloads. |
| Brain-Dateien | Nutzen eigene Storage-Roots und eigene Pfad-Resolver; Weltasset-Namespaces sind dafür unzulässig. |
| Brain-Sicherungen | Werden als eigene, restriktive Backup-Menge mit eigener Retention, Restore-Autorisierung und Vollständigkeitsprüfung geführt. |
| Shared Engines | Erhalten Daten nur über produktdefinierte Ports und besitzen keine Credentials oder generischen Clients für beide privaten Stores. |

Im Übergangszustand bleibt die bestehende Datenbank unverändert. Die spätere
Implementierung muss zuerst logische Repository- und Servicegrenzen schaffen,
gemischte Job- und Storage-Contracts aufteilen und Zugriffe messbar machen.
Eine neue Datei, Kopie, Dual-Write-Strecke oder Cutover-Logik gehört ausdrücklich
nicht zu dieser Foundation-Welle.

Für eine spätere Migration gelten harte Freigabebedingungen:

1. separate, dokumentierte Owner-Freigabe für Umfang und Zeitpunkt;
2. vollständiges Backup beider Datenebenen und verifizierter Restore-Test;
3. Dry Run mit Mengen-, Beziehungs- und Dateiintegritätsprüfung;
4. definierter Rollback ohne Löschung der bisherigen Quelle;
5. erst nach Abnahme ein kontrollierter Cutover;
6. keine Datenlöschung oder irreversible Schema-/Storage-Migration ohne eine
   weitere explizite Owner-Entscheidung.

`personal_brain` und alle privaten Brain-Inhalte bleiben unabhängig vom
physischen Übergang hart local-only und dürfen niemals an Cloud-KI gelangen.

## Konsequenzen

- Backups und Restores werden künftig produktbewusst statt instanzweit
  undifferenziert geplant.
- Platform darf mehrere Stores betreiben, aber nicht deren private Inhalte über
  generische Repositories zusammenführen.
- Gemischte Modelle und Jobs müssen vor einer physischen Migration eindeutig
  Studio, Brain oder Platform zugeordnet werden.
- Der genaue Produktionspfad für `uwe-brain.db`, Brain-Storage und Brain-Backups
  wird in der Migrationswelle festgelegt; diese ADR erfindet keinen vorzeitigen
  Hostvertrag.
- Die bestehende Abweichung zwischen `/var/backups/uwe` und
  `/var/lib/uwe/backups` bleibt ein vor der Migration zu klärender Platform-Punkt.

## Alternativen

- **Dauerhaft eine gemeinsame Datenbank:** verworfen, weil Servicefehler,
  Backups und Restore-Vorgänge weiterhin alle privaten Domänen koppeln würden.
- **Nur Tabellenpräfixe oder getrennte Prisma-Clients:** verworfen als
  Zielzustand, weil sie Storage- und Backup-Isolation nicht herstellen.
- **Sofortige Migration in dieser Welle:** verworfen, weil Contracts, Guards,
  Dry Run, Restore-Test und Owner-Freigabe noch fehlen.
