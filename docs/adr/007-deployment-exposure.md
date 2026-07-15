# ADR 007: Deployment und öffentliche Erreichbarkeit

## Status

Accepted — 2026-07-15

Diese Welle ändert keine systemd-Unit, Startskripte, Tunnel- oder
Proxy-Konfiguration.

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
| **Brain** | Standardmäßig Loopback, optional nach expliziter Owner-Freigabe im LAN; niemals automatisch öffentlich und niemals automatisch Teil eines Cloudflare Tunnels. |

Brain-Endpunkte werden in Deployment-Generatoren, Service-Discovery,
Health-Aggregation und Proxy-Beispielen deny-by-default behandelt. Eine spätere
öffentliche Brain-Erreichbarkeit wäre keine Konfigurationsvariation dieser ADR,
sondern benötigte eine neue Security- und Architekturentscheidung.

Lokale Inferenzendpunkte, Ollama/LM-Studio-Dienste und der RTX Host Connector
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
- Brain-LAN-Zugriff braucht weiterhin Owner-Authentisierung und restriktive
  Netzwerkkonfiguration.
- Betriebsdokumentation und Smoke-Tests müssen später beweisen, dass Brain in
  öffentlichen Standardkonfigurationen nicht erreichbar ist.
- Änderungen an systemd oder Host-Deployment gehören in eine eigene,
  überprüfbare Implementierungswelle.

## Alternativen

- **Alle drei Apps im selben Tunnel:** verworfen, weil Brain dadurch unnötig
  eine öffentliche Angriffsfläche erhält.
- **Brain hinter Cloudflare Access als Standard:** verworfen; ein äußerer Guard
  ersetzt nicht den local-first Exposure-Grundsatz.
- **systemd sofort aufteilen:** verworfen, weil diese Welle ausschließlich
  Architektur und Dokumentation festlegt.
