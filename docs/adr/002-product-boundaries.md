# ADR 002: Produktgrenzen für Portal, Studio und Brain

## Status

Accepted — 2026-07-15

Diese Entscheidung beschreibt das Zielbild. Die aktuelle Welle ändert keine
Laufzeit, Routen oder Datenzugriffe.

## Kontext

UWE betreibt heute Portal und Studio als Apps. Persönliche Funktionen des
Daily Admin OS und des Life Brain liegen noch im Studio-Baum. Das
Repo-Inventar (ehem. `docs/rework/three-product-split/00-inventory.md`, mit dem Abschluss des Splits entfernt) zeigte dadurch
gemischte Navigationen, APIs, Jobs, Datenzugriffe und Storage-Pfade. Ohne eine
verbindliche fachliche Grenze würde ein bloßes Verschieben von Routen die
privaten Zugriffe nur an einen neuen Ort verlagern.

## Entscheidung

UWE wird fachlich in drei Produkte sowie zwei unterstützende Schichten
geschnitten:

| Bereich | Zielverantwortung |
|---|---|
| **Portal** | Player-safe, read-mostly Projektionen veröffentlichter D&D-Daten. Schreibzugriffe sind standardmäßig verboten und nur über eng begrenzte, explizite Spieleraktions-Contracts zulässig. |
| **Studio** | Ausschließlich D&D-Spielleitung, World-Brain, Authoring, Review, Apply und Veröffentlichung. Studio ist die Quelle für Welt- und Kampagneninhalte. |
| **Brain** | Owner-private persönliche Daten, Daily Admin OS und persönliche lokale KI. Brain ist owner-only; die Erreichbarkeit (lokal, LAN oder öffentlich hinter dem owner-gated Tunnel) ist eine bewusste Betriebsentscheidung — siehe [ADR 004](004-brain-owner-only.md) und [ADR 007](007-deployment-exposure.md). |
| **Platform** | Identität, Security, Konfiguration, Persistenz-Infrastruktur, Queue-Supervision, Connector, Deployment und CI. Platform erhält daraus kein Recht auf generische private Fachdatenzugriffe. |
| **Shared Engines** | Datenquellenneutrale Engines, UI-Primitives und Verträge. Sie sind I/O-frei oder arbeiten über eng geschnittene, vom jeweiligen Produkt bereitgestellte Ports. |

Für Abhängigkeiten gelten folgende Regeln:

- Apps importieren niemals aus einer anderen App. Gemeinsamer Code liegt in
  Packages mit stabilen, produktneutralen Verträgen.
- Gemeinsame Engines sind erlaubt; gemeinsame private Repository- oder
  Datenbankzugriffe sind verboten.
- Portal konsumiert nur serverseitig gefilterte Read Models. Eine privilegierte
  Rolle erweitert innerhalb des Portals nicht automatisch die Datenprojektion.
- Spieleraktionen wie Notizen, Fragen oder Verfügbarkeiten benötigen je einen
  expliziten, validierten Write-Contract; es gibt keinen generischen
  Portal-Schreibzugriff auf Studio-Daten.
- Platform orchestriert produktübergreifend, darf aber Payloads nicht als
  Abkürzung zu fachfremden Datenzugriffen verwenden.

Produktübergreifend gelten diese Invarianten:

- `dm_only` erreicht niemals Portal oder statischen Export.
- `personal_brain` ist owner-only, hart local-only und nicht konfigurierbar.
- Private Brain-Inhalte werden niemals an Cloud-KI übertragen.
- Brain bleibt owner-only und lokal beziehungsweise explizit LAN-begrenzt.
- Es gibt keine Cross-App-Imports und keine gemeinsam genutzten privaten
  Datenzugriffe.
- Daten werden nicht gelöscht oder irreversibel migriert, solange keine
  separate Owner-Freigabe vorliegt.

## Konsequenzen

- Die heutige physische Lage einer Route oder eines Services bestimmt nicht
  länger seine Zielverantwortung.
- Produkt-Contracts und Guards müssen vor dem Verschieben von Routen entstehen.
- Gemischte Hotspots wie Suche, Jobs, Research, Kalender, Mail, Image Studio,
  Tags und Uploads brauchen produktbezogene Adapter.
- Portal-Leak-Tests bleiben eine zwingende Freigabebedingung.
- Die Package-zu-App-Abhängigkeit des Static Export auf Portal-CSS muss in
  einer späteren Implementierungswelle in ein Package umgedreht werden.

## Alternativen

- **Studio als dauerhafte Super-App:** verworfen, weil persönliche Daten und
  D&D-Administration dieselbe Zugriffs- und Exposure-Fläche behalten würden.
- **Ein gemeinsamer Core mit generischem Datenbankzugriff:** verworfen, weil
  technische Wiederverwendung dadurch private Produktgrenzen aushebelt.
- **Engines je Produkt duplizieren:** verworfen, weil datenquellenneutrale Logik
  sicher gemeinsam genutzt werden kann.
