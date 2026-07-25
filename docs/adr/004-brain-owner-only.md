# ADR 004: Brain ist owner-only

## Status

Accepted — 2026-07-15 · **Ergänzt — 2026-07-25**

Die Ergänzung betrifft ausschließlich das *Exposure*-Modell: Brain darf unter
einem eigenen Origin über den owner-gated Reverse-Proxy/Tunnel veröffentlicht
werden. Die Zugriffsregel („owner-only auf jeder Route") ist unverändert und
bleibt die tragende Invariante dieses ADR.

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
| Standard (`loopback`) | Bindung an Loopback beziehungsweise Zugriff nur vom lokalen Host. |
| LAN (`lan`) | Nur nach expliziter Owner-Aktivierung, mit Authentisierung und restriktiver Host-/Netzwerkregel. |
| Öffentlich (`public`) | Nur nach expliziter Owner-Aktivierung: eigenes Origin hinter dem owner-gated Reverse-Proxy beziehungsweise Cloudflare-Tunnel (`BRAIN_PUBLIC_TUNNEL=1`). Brain bindet weiterhin an Loopback — der Connector läuft auf dem Host. 2FA auf dem Owner-Konto wird dringend empfohlen. |

Erreichbarkeit ist in keinem Modus ein Auth-Bypass: die Rollenprüfung liegt
serverseitig auf jeder Route und ist von der Netzwerkkonfiguration unabhängig.
Kein Modus entsteht als Installationsdefault; jede Ausweitung über Loopback
hinaus ist eine bewusste Betriebsentscheidung.

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
- LAN- und Public-Freigabe sind bewusste Betriebsentscheidungen und dürfen nicht
  als Installationsdefault entstehen.
- Backup-, Restore- und Diagnoseoberflächen für Brain sind ebenfalls
  owner-only.
- Diese Welle ändert weder Routing noch Netzwerk- oder Runtime-Konfiguration.

## Alternativen

- **Zugriff für `admin` und `dm`:** verworfen, weil technische Administration
  keine Berechtigung auf persönliche Owner-Daten begründet.
- **Öffentlich erreichbar ohne Owner-Gate:** verworfen — die Erreichbarkeit
  darf nie die Rollenprüfung ersetzen. Die 2026-07-25 ergänzte Public-Option
  veröffentlicht ausschließlich ein Origin hinter dem owner-gated Proxy; jede
  Route prüft weiterhin serverseitig die Rolle `owner`.
- **Nur UI-seitige Ausblendung:** verworfen, weil APIs, Jobs, Suche und
  Metadaten weiterhin leaken könnten.
