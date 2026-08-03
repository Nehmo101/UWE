# Brain — Betrieb & Datenschutz (kanonisch)

Stand: 2026-07-25. Dieser Text ist die verbindliche Betriebs- und
Datenschutzbeschreibung für das dritte UWE-Produkt **Brain** (`apps/brain`,
Package `@uwe/brain`). Er ergänzt [ADR 004](../adr/004-brain-owner-only.md) und
[ADR 007](../adr/007-deployment-exposure.md) sowie den früheren Masterplan
(`docs/rework/uwe-portal-studio-brain-masterplan.md`, nach Abschluss des
Splits entfernt).

## Was Brain ist

Brain ist das **owner-private** Produkt: Daily Admin OS (Mail, Kalender,
Finanzen, Haushalt, Werkstatt) und Personal Brain (persönliches Wissen, lokale
KI). Es ist kein D&D-Produkt und teilt keine privaten Daten mit Studio oder
Portal.

## Nicht verhandelbare Betriebsregeln

- **Owner-only.** Jede Route, API und Server Action prüft serverseitig die
  globale Rolle `owner` (`requireBrainOwnerAuth`). Nicht-Owner erhalten 401/403.
- **Lokal per Default.** `dev`/`start` binden an `127.0.0.1:3002` (Loopback).
  Jede weitergehende Erreichbarkeit ist eine **explizite** Owner-Entscheidung:
  LAN über `BRAIN_EXPOSURE=lan` plus konkrete Interface-Adresse, ein
  öffentliches Origin über `BRAIN_EXPOSURE=public`.
- **Nie automatisch öffentlich.** Brain landet **niemals als Nebeneffekt** im
  Cloudflare-Tunnel, in Firewall-Freigaben, in `deploy/systemd/uwe.service`
  oder in `start-uwe.sh`. Ein grüner CI-Build erzeugt keine Erreichbarkeit.
  `deploy/scripts/check-cloudflare-tunnel.sh` schlägt fehl, wenn Port `3002`
  oder ein Brain-Hostname im Tunnel-Config auftaucht — **außer** bei gesetztem
  `BRAIN_PUBLIC_TUNNEL=1`, dem bewussten Opt-in für den owner-gated Betrieb
  (dann nur noch eine Warnung). 2FA auf dem Owner-Konto wird dringend erwartet.
- **Keine Cloud-KI für private Inhalte.** `personal_brain`- und `admin_life`-
  Inhalte verlassen den Host nicht; ein lokaler Ausfall führt zu Warten oder
  einem sicheren Fehler, nie zu einem Cloud-Fallback.

## Exposure-Schalter

`BRAIN_EXPOSURE` beschreibt, unter welchem Origin Brain erreichbar ist — nie,
ob authentifiziert wird. Die Owner-Prüfung liegt serverseitig auf jeder Route
und ist von diesem Wert unabhängig.

| Wert | Bedeutung |
|---|---|
| `loopback` (Default) | Nur vom Host selbst erreichbar (`127.0.0.1`). |
| `lan` | Nach Owner-Freigabe im LAN erreichbar (konkrete Interface-Adresse). |
| `public` | Eigenes Origin (z. B. `brain.<domain>`) hinter dem owner-gated Reverse-Proxy/Tunnel. Erfordert zusätzlich `BRAIN_PUBLIC_TUNNEL=1` im Tunnel-Check. |
| `off` | Brain-Einstieg vollständig deaktiviert (In-App 503). |

Der sichere Default und die Bind-Logik sind in `apps/brain/src/lib/exposure.ts`
kodiert und per Unit-Test abgesichert: `resolveBrainBindHostname` gibt nie
`0.0.0.0`/eine All-Interfaces-Adresse zurück. Das gilt auch für `public` — ein
öffentliches Brain wird vom **host-lokalen** Tunnel-Connector veröffentlicht,
nicht durch eine weitere Bind-Adresse. Wer das nutzt, muss wissen: Brain hält
die sensibelsten Daten der Installation; der einzige Schutz ist dann die
Owner-Session (deshalb 2FA).

## Produktgrenze (Contracts)

Brain deklariert seine Audience über `@uwe/product-contracts`
(`apps/brain/src/lib/audience.ts`, `BRAIN_AUDIENCE`). Laut der geteilten
Zugriffsmatrix darf die Brain-Audience ausschließlich `personal_brain` und
`admin_life` berühren; D&D- und Portal-Domänen sind deny-by-default `none`. Der
statische Guard `scripts/product-boundary-check.mjs` verbietet zusätzlich, dass
Brain eine andere App importiert oder von einem Paket importiert wird.

## KI-Chat (`/ki-chat`)

Der Brain-Assistent (`@uwe/brain-assistant`) ist **lokal-only**: der Chat-Runner
pinnt `providerMode: "local_engine"` und nutzt ausschließlich die Kontextmodi
`general_chat` und `personal_brain`. Es gibt keinen Cloud-Fallback und keinen
Schalter dafür — `packages/brain-assistant/src/chat-runner.test.ts` hält das
fest.

**Hinterlegte KI.** Beantwortet wird mit einem Modell, das der Command Center
per Connector-Heartbeat übertragen hat (`enabledForUwe`). Die Auswahl liegt als
`{connectorId, modelId}` plus Label-Snapshot in `BrainAssistantProfile`
(Brain-DB); pro Unterhaltung ist ein Override möglich. Ohne eigene Auswahl gilt
der globale `ConnectorWorkflowDefault` des Slots `chat` bzw. `vision`.

**Bilder** gehen nie direkt an ein Chat-Modell: kein `AiProvider` in UWE nimmt
Bilddaten entgegen. Ein Anhang wird per `vision_extract`-Connector-Job zu Text
gemacht und als Textblock in den Prompt gehängt. Das Ergebnis bleibt am Anhang
gespeichert, damit Folge-Turns keinen zweiten GPU-Job auslösen.

**Diktat** hat zwei Wege:

- **Lokal (Standard).** `MediaRecorder` → `POST /api/ai/assistant/transcribe` →
  Connector-Job `audio_transcribe` (Capability `stt_local`) → lokales
  Sprach-Kommando. Die Aufnahme wird nie auf Platte geschrieben und verlässt den
  Maschinenraum-PC nicht. Das Kommando wird **im Command Center** gesetzt
  (`sttCommand` → `UWE_CONNECTOR_STT_CMD`), nicht von Hand auf dem Host;
  Referenz-Wrapper: `deploy/scripts/uwe-stt-whisper.sh`.
- **Browser-Fallback (opt-in, aus).** Die Web-Speech-API sendet das Audio in
  Chrome an den Browser-Hersteller. Sie wird nur angeboten, wenn kein Connector
  `stt_local` meldet, erfordert ein ausdrückliches Häkchen mit sichtbarer
  Warnung und liegt ausschließlich im `localStorage` — nie in der DB, nie als
  serverseitiger Default.

**Mikrofon-Berechtigung.** Brain ist die einzige Fläche, die
`Permissions-Policy: microphone=(self)` sendet (`allowMicrophone` in
`packages/auth/src/security-headers.ts`, gesetzt in `apps/brain/next.config.ts`
und in **allen** Zweigen von `apps/brain/middleware.ts` — die Middleware
überschreibt die Header aus `next.config.ts`). Studio und Portal behalten
`microphone=()`. `camera=()` bleibt überall gesperrt.

**Kein Streaming.** UWE hat nirgends Token-Streaming, und die Connector-Queue
ist request/response. Eine Antwort erscheint am Stück; der Composer zeigt dafür
einen Warte- und Abbrechen-Zustand. Der Vision-Teil begrenzt sich auf 60 s, um
unter dem ~100-s-Edge-Timeout eines Cloudflare-Tunnels zu bleiben.

## Aktueller Stand und was bewusst noch fehlt

`apps/brain` existiert als bootfähiger, owner-only Prozess mit `/`, `/login`,
`/api/health/private` und der owner-/exposure-Middleware. Die **eigentlichen
Brain-Flächen** (`/life-brain`, `/today`, `/mail`, `/capture`, `/kalender` …)
liegen weiterhin im Studio-Baum; ihre Migration nach `apps/brain` ist Teil der
späteren Wellen.

Owner-gated (separate Freigabe nötig, siehe ADR 003/007 und Masterplan
Invariante 7):

- physische Datenmigration nach `uwe-brain.db`, getrennte Brain-Backups und
  Restore-Rechte,
- eine eigene systemd-Unit für einen dauerhaften lokalen Brain-Dienst
  (loopback-gebunden, **nicht** in der 0.0.0.0-Unit).

Keiner dieser Schritte wird durch den Port, das Package oder einen grünen Build
vorentschieden.
