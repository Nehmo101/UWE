# ADR 007: Deployment und öffentliche Erreichbarkeit

## Status

Accepted — 2026-07-15 · **Ergänzt — 2026-07-25**

Diese Welle ändert keine systemd-Unit, Startskripte, Tunnel- oder
Proxy-Konfiguration.

Die Ergänzung von 2026-07-25 ist die in dieser ADR geforderte explizite
Entscheidung: Brain darf unter eigenem Origin über den owner-gated Tunnel
veröffentlicht werden (`BRAIN_EXPOSURE=public` + `BRAIN_PUBLIC_TUNNEL=1`). Alle
übrigen Regeln — deny-by-default in Generatoren, Owner-Auth auf jeder Route,
Maschinenraum/Ollama außerhalb öffentlicher Tunnel — bleiben unverändert.

## Kontext

Die aktive Linux-Runtime startet Studio und Portal gemeinsam über systemd.
Cloudflare Tunnel und Access sind optional. Ein eigenes `apps/brain` existiert
noch nicht. Beim späteren Produktsplit darf Brain nicht durch Wiederverwendung
der bestehenden Start- oder Tunnelkonfiguration unbeabsichtigt öffentlich
werden.

## Entscheidung

Das Ziel-Exposure ist produktbezogen:

| Produkt | Zulässige Erreichbarkeit |
|---|---|
| **Portal** | Lokal/LAN oder optional über Cloudflare Tunnel beziehungsweise Reverse Proxy; Auth-, Share- und player-safe Filterregeln bleiben zwingend. |
| **Studio** | Lokal/LAN oder optional über Cloudflare Tunnel; bei Internetzugriff mit Session-Schutz und vorgeschaltetem Access beziehungsweise gleichwertigem äußeren Schutz. |
| **Brain** | Standardmäßig Loopback; nach expliziter Owner-Freigabe im LAN (`BRAIN_EXPOSURE=lan`) oder öffentlich unter eigenem Origin hinter dem owner-gated Tunnel (`BRAIN_EXPOSURE=public` + `BRAIN_PUBLIC_TUNNEL=1`). Nie automatisch, immer als bewusste Betriebsentscheidung. |

Brain-Endpunkte werden in Deployment-Generatoren, Service-Discovery,
Health-Aggregation und Proxy-Beispielen weiterhin deny-by-default behandelt:
Erreichbarkeit entsteht nur durch die ausdrückliche Opt-in-Konfiguration, nie
als Nebeneffekt einer Generierung oder eines grünen Builds.

Lokale Inferenzendpunkte, Ollama/LM-Studio-Dienste und der Maschinenraum
bleiben ebenfalls außerhalb öffentlicher Tunnel. Der Connector arbeitet
outbound und ist keine öffentliche Produkt-Surface.

Für diese Foundation-Welle bleibt die bestehende systemd-Topologie vollständig
unverändert. Ein späteres `apps/brain`, eigene Healthchecks oder getrennte
Services werden erst nach Contracts, Guards und einer expliziten
Deployment-Wellenfreigabe implementiert.

## Konsequenzen

- Die Existenz einer neuen App darf sie nicht automatisch in bestehende
  `uwe.service`-, Tunnel- oder Proxy-Listen aufnehmen.
- Portal-Exposure ist kein Recht auf ungefilterte D&D-Daten; `dm_only` bleibt
  aus Portal und Export ausgeschlossen.
- Brain-LAN- und Public-Zugriff brauchen weiterhin Owner-Authentisierung und
  restriktive Netzwerkkonfiguration.
- Betriebsdokumentation und Smoke-Tests müssen beweisen, dass Brain in der
  *Standard*-Konfiguration nicht öffentlich erreichbar ist —
  `deploy/scripts/check-cloudflare-tunnel.sh` erzwingt dafür das Opt-in.
- Änderungen an systemd oder Host-Deployment gehören in eine eigene,
  überprüfbare Implementierungswelle.

## Alternativen

- **Alle drei Apps automatisch im selben Tunnel:** verworfen — Brain kommt nur
  durch ausdrückliches Opt-in in den Tunnel, nie durch Generierung.
- **Brain hinter Cloudflare Access als Standard:** verworfen; ein äußerer Guard
  ersetzt nicht die serverseitige Owner-Prüfung auf jeder Route.
- **systemd sofort aufteilen:** verworfen, weil diese Welle ausschließlich
  Architektur und Dokumentation festlegt.
