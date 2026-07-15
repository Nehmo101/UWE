# ADR 004: Brain ist owner-only und lokal exponiert

## Status

Accepted — 2026-07-15

## Kontext

Brain verarbeitet persönliche Dokumente, Mail, Kalender, Verträge, Finanzen,
Geräteinformationen, Captures und Life-Brain-Kontext. Diese Daten sind
sensitiver als D&D-Weltdaten und liegen heute teilweise auf Studio-Routen. Eine
neue App allein würde weder Zugriff noch Netzwerk-Exposure sicher begrenzen.

## Entscheidung

Brain ist ein owner-only Produkt. Der Zugriff erfordert auf jeder Page, API,
Server Action und jedem Job sowohl eine gültige Brain-Session-Audience als auch
die Rolle `owner`. Lokaler Zugriff ist kein Auth-Bypass.

Das Exposure-Modell lautet:

| Modus | Verhalten |
|---|---|
| Standard | Bindung an Loopback beziehungsweise Zugriff nur vom lokalen Host. |
| LAN | Nur nach expliziter Owner-Aktivierung, mit Authentisierung, restriktiver Host-/Netzwerkregel und ohne öffentliche Weiterleitung. |
| Internet | Nicht unterstützt; Brain wird nicht automatisch in Tunnel-, Proxy-, DNS- oder Discovery-Konfiguration aufgenommen. |

Zusätzlich gelten folgende Invarianten:

- Nur `owner` darf Brain-Inhalte, Metadaten, Suchtreffer, Counts, Jobs und
  Backups sehen oder verändern.
- Private Brain-Inhalte und `personal_brain` werden niemals an Cloud-KI
  übertragen; diese Regel ist nicht konfigurierbar.
- Brain-Daten werden weder Portal noch Studio über generische Suche,
  Navigation, Activity Feeds, Tags oder Platform-APIs zugänglich gemacht.
- Gemeinsame Engines dürfen Brain-Daten nur für den konkreten Aufruf über einen
  Brain-eigenen Port verarbeiten und nicht dauerhaft halten.
- Audit- und Betriebsdaten minimieren private Titel, Snippets und Payloads.

## Konsequenzen

- `apps/brain` benötigt vor seiner Einführung einen deny-by-default Route-Guard
  und eigene Audience-Tests.
- Föderierte Suche und gemeinsame Cockpits sind kein impliziter Zugriffspfad;
  sie benötigen später einen owner-only, ergebnisminimierenden Vertrag.
- LAN-Freigabe ist eine bewusste Betriebsentscheidung und darf nicht als
  Installationsdefault entstehen.
- Backup-, Restore- und Diagnoseoberflächen für Brain sind ebenfalls
  owner-only.
- Diese Welle ändert weder Routing noch Netzwerk- oder Runtime-Konfiguration.

## Alternativen

- **Zugriff für `admin` und `dm`:** verworfen, weil technische Administration
  keine Berechtigung auf persönliche Owner-Daten begründet.
- **Öffentlich erreichbar mit zusätzlichem Login:** verworfen, weil die
  zusätzliche Angriffsfläche für das persönliche Produkt unnötig ist.
- **Nur UI-seitige Ausblendung:** verworfen, weil APIs, Jobs, Suche und
  Metadaten weiterhin leaken könnten.
