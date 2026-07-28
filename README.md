# UWE — Universeller Welten-Editor

Selbst gehostetes Alltags- und Hobby-Betriebssystem: Kampagnen-Werkzeug für
Spielleiter:innen, Wiki für Mitspieler:innen und ein privater Wissens- und
Admin-Bereich für die eigene Person — alles auf eigener Hardware, ohne fremde
Cloud als Pflichtbestandteil.

UWE ist ein pnpm-Monorepo aus vier Next.js-Anwendungen und rund 40 Paketen. Die
Daten liegen in SQLite (PostgreSQL optional), die KI läuft standardmäßig lokal.

> **Status:** Version `0.1.0`, aktiv in Entwicklung und produktiv auf einem
> einzelnen Linux-Host im Einsatz. Eine ehrliche Einschätzung, was fertig ist und
> was nicht, steht in [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md).

---

## Die fünf Oberflächen

| App | Port | Zielgruppe | Inhalt |
|---|---|---|---|
| **Studio** (`apps/studio`) | 3000 | Spielleitung, Owner | Weltbearbeitung, Admin, KI, Daily Admin OS. `dm_only`-Inhalte sind hier bewusst sichtbar. |
| **Portal** (`apps/portal`) | 3001 | Mitspieler:innen | Spieler-Wiki. Zeigt ausschließlich freigegebene, gefilterte Inhalte. |
| **Brain** (`apps/brain`) | 3002 | nur Owner | Privater Wissens- und Daily-Admin-Bereich inkl. Mail-Center. Owner-only, lokal. |
| **Family** (`apps/family`) | 3004 | Haushalt | Geteilter Familienbereich: Verträge, Dokumente, Küche, Kalender (`uwe-family.db`). |
| **Landing** (`apps/landing`) | 3103 | öffentlich | Startseite auf dem Apex-Origin. Genau drei Routen, keine Inhalte. |

Dazu kommt der **Command Center** (`apps/rtx-connector-client`, Tauri) als
optionale Desktop-Oberfläche für Host- und Connector-Verwaltung.

Die Trennung ist keine Kosmetik: Sie wird durch `packages/product-contracts`
erzwungen und in CI geprüft. Inhalte der Klasse `dm_only` dürfen das Portal nie
erreichen, `owner_private_local` nie den Host verlassen.

---

## Schnellstart (lokale Entwicklung)

**Voraussetzungen:** Node.js ≥ 22, pnpm 10.

```bash
pnpm install
cp -n .env.example .env
pnpm --filter @uwe/database db:deploy
pnpm --filter @uwe/database db:seed
pnpm dev
```

Danach erreichbar: Studio auf <http://localhost:3000>, Portal auf
<http://localhost:3001>, Brain auf <http://localhost:3002>, Landing auf
<http://localhost:3103>.

Seed-Login: `dm@uwe.local` / `uwe-dev`.

Einzelne Apps starten:

```bash
pnpm dev:studio    # nur Studio
pnpm dev:portal    # nur Portal
pnpm dev:brain     # nur Brain
```

Für einen echten Owner-Account statt der Seed-Daten:

```bash
pnpm bootstrap:owner
```

---

## Architektur

```
apps/studio    → DM-App          — Weltbearbeitung, Admin, KI, Daily Admin OS
apps/portal    → Spieler-Wiki    — nur gefilterte, freigegebene Inhalte
apps/brain     → Owner-Bereich   — privater Daily-Admin- und Wissensbereich
apps/family    → Familienbereich — geteilte Haushaltsdaten (uwe-family.db)
apps/landing   → Startseite      — Apex-Origin, genau drei Routen
packages/*     → gesamte Fachlogik
terra/         → Karteneditor    — eigenständige ES-Module, per Copy eingebettet
```

**Goldene Regel:** Fachlogik gehört in `packages/`, nie in Next.js Route Handler
oder React-Komponenten.

### Wichtige Pakete

| Paket | Zuständigkeit |
|---|---|
| `@uwe/database` | Prisma-Schema, Repositories, Kern-Services |
| `@uwe/auth`, `@uwe/security` | Sessions, RBAC, API-Guards, CSRF |
| `@uwe/product-contracts` | Datenklassen und Produktgrenzen, in CI erzwungen |
| `@uwe/ai-brain` | KI-Router, DnD-Generator, Privacy-Guards |
| `@uwe/shared-ui` | Geteilte React-Komponenten, Theme-System |
| `@uwe/shared-utils` | Framework-agnostische Utilities |
| `@uwe/mcp` | MCP-Server für Studio, Portal und Brain |
| `@uwe/assets` | Upload-Pfade, MIME-Validierung |

Fachliche Feature-Pakete: `agent-jobs`, `backup`, `brain-assistant`,
`calendar`, `cloudflare-edge`, `connector`, `cookbook`, `daily-cockpit`,
`dnd-api`, `host-cockpit`, `host-monitor`, `image-studio`, `kitchen`,
`knoteforge-import`, `mail`, `mail-core`, `passkeys`, `pdf-campaign-import`,
`player-hub`, `roll-tables`, `scan-inbox`, `soundboard`, `static-export`,
`theme-studio`, `web-search`.

Der Karteneditor **Terra** lebt als eigenständiges ES-Modul-Projekt unter
`terra/` (außerhalb des pnpm-Workspace) und wird per `scripts/copy-terra.mjs`
nach Studio/Portal kopiert; die Atlas-/Atlas-3D-Editoren wurden am 2026-07-27
vollständig entfernt (siehe `docs/engineering/terra-runde-j-atlas-abbau.md`).

### Wohin neuer Code gehört

| Art der Änderung | Ort |
|---|---|
| Schema | `packages/database/prisma/schema.prisma` + Migration |
| Domain-Logik | Feature-Paket unter `packages/<domain>` |
| Studio-API | `apps/studio/app/api/**/route.ts` |
| Studio-UI | `apps/studio/app/**/page.tsx` |
| Formulare | Server Actions in `apps/studio/app/*-actions.ts` |
| Geteilte UI | `packages/shared-ui/src/` |

### Modul-Disziplin

Erzwungen durch `scripts/file-size-budget-check.mjs` als Teil von `pnpm test`:

- Neue Dateien maximal 700 Zeilen, Ziel unter 300. Wird es mehr, wird
  aufgeteilt — nicht die Baseline angehoben.
- Bestehende Monolithen (`scripts/file-size-baseline.json`) sind eingefroren.
  Baseline-Werte werden nie erhöht, `--ratchet` senkt sie nur.
- Neue Domänen-Services gehören in ein Feature-Paket, nicht in `@uwe/database`.
- Das `server.ts`-Barrel wächst nicht weiter; neue Symbole laufen über
  Subpath-Exports.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Funktionsumfang

**Studio** — Welten, Seiten und Wiki-Struktur mit Sichtbarkeitssteuerung;
Charakterbögen und Statblocks; Terra-Karteneditor (Three.js, unter
`/worlds/:slug/karten`); Bildstudio; Etiketten und Drucklisten; Soundboard;
Sitzungsplanung; Import von Kampagnen-PDFs; Admin-Bereich mit API-Tokens,
Häkchen-Zugangsverwaltung und Agent-Jobs.

**Portal** — Lesesicht auf freigegebene Welteninhalte, Charakterbögen der
eigenen Figur, Spieler-Hub. Kein Zugriff auf `dm_only`.

**Brain** — Persönliche Notizen und Fakten, Kalender, Mail-Center, Scan-Inbox
mit Prüf-Workflow, Küche und Vorratshaltung, Ideen- und Bug-Erfassung.

**KI** — Router über lokale und optionale Cloud-Anbieter, DnD-Generatoren mit
Review-Schritt, Brain-Assistent, Theme-Generator, Web-Recherche.

Der jeweils aktuelle Reifegrad steht in
[docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md), Geplantes in
[docs/ROADMAP.md](docs/ROADMAP.md).

---

## KI und Datenschutz

UWE ist local-first. Die Regeln sind nicht optional, sondern in Code gegossen und
durch Tests abgesichert:

- **Persönlicher Brain-Kontext geht nie an eine Cloud.** `assertPersonalBrainLocalOnly`
  bricht ab, bevor ein solcher Kontext einen entfernten Anbieter erreicht.
- **Kampagnen- und Brain-Kontext** bleiben von Cloud-Fallbacks ausgeschlossen.
- **Cloud-Anbieter sind opt-in** und werden im Admin-Bereich konfiguriert, nicht
  über versteckte Voreinstellungen.
- Lokale Inferenz läuft über Ollama, LM Studio, llama.cpp oder einen
  RTX-Host-Connector.

Der **RTX Host Connector** (`tools/uwe-rtx-connector`) ist ein optionaler Worker,
der sich **ausgehend** beim Host meldet. Es gibt keinen eingehenden Port und
keinen inbound Agent.

> Inferenz-Endpunkte gehören nie ins offene Netz. Ein Cloudflare Tunnel darf
> ausschließlich auf UWE zeigen, niemals auf Ollama, LM Studio oder llama.cpp.

Details: [docs/ai-privacy-and-cloud-fallback.md](docs/ai-privacy-and-cloud-fallback.md),
[docs/life-brain-privacy.md](docs/life-brain-privacy.md),
[SECURITY_NOTES.md](SECURITY_NOTES.md).

---

## Produktionsbetrieb

Die aktive Betriebsform ist ein einzelner Linux-Host mit Node.js 22, pnpm und
systemd. Kein Docker, kein Windows-Installer als Pflichtpfad.

```bash
pnpm build:release              # alle Apps bauen, Standalone-Prüfung inklusive
sudo bash deploy/scripts/setup-uwe-host.sh
```

Die systemd-Unit liegt unter `deploy/systemd/uwe.service`. Ein optionaler
Cloudflare Tunnel und Cloudflare Access können davorgeschaltet werden; Vorlagen
stehen in `deploy/cloudflare/`.

Deploy nach grünem CI übernimmt `.github/workflows/deploy.yml` auf einem selbst
gehosteten Runner am UWE-Host. Der Job ist auf dieses Repository, den
Standard-Branch und Nicht-Fork-Läufe eingegrenzt.

### Self-Service-Prinzip

Jede laufende Einstellung — Backups, Auto-Briefing, Zeitpläne, Integrationen —
muss **in UWE selbst** konfigurierbar sein und automatisch zum Host
zurückgeschrieben werden. Das etablierte Muster:

1. Setting in `packages/database/src/settings-service.ts` plus Validierung.
2. Bedienelement in den Studio-Einstellungen, gespeichert über
   `updateSettingsAction`.
3. Ein Sync-Wrapper schreibt eine host-lesbare JSON-Datei.
4. Das systemd-Skript liest diese JSON; der Timer selbst bleibt statisch.

Es kommt kein neuer *laufender* Host-Schritt dazu. Nur die einmalige
Unit-Installation darf manuell bleiben. Referenz:
[docs/engineering/self-service-config.md](docs/engineering/self-service-config.md).

Weiter: [docs/PRODUCTION.md](docs/PRODUCTION.md),
[docs/host-linux.md](docs/host-linux.md),
[docs/deployment-hardening.md](docs/deployment-hardening.md).

---

## Konfiguration

Alle Einstellungen laufen über Umgebungsvariablen; `.env.example` ist die
kommentierte Referenz, `.env.production.example` die Produktionsvariante.
Geheimnisse gehören nie in den Quelltext — `pnpm secret:scan` prüft das bei jedem
Lauf.

Die wichtigsten Werte:

| Variable | Bedeutung |
|---|---|
| `SESSION_SECRET` | Pflicht in Produktion, zufällig erzeugen |
| `DATABASE_URL` | Standard `file:./data/uwe.db` |
| `BRAIN_DATABASE_URL` | Getrennte Datenbank für den Owner-Bereich |
| `PUBLIC_APP_URL` | Öffentliche Basis-URL, u. a. für Tunnel-Checks |
| `SESSION_COOKIE_DOMAIN` | Für geteilte Anmeldung über Subdomains |
| `BRAIN_EXPOSURE` | `loopback` (Standard), `lan`, `public` oder `off` |
| `MAX_UPLOAD_MB` | Obergrenze für Uploads |

Details: [docs/secrets.md](docs/secrets.md),
[docs/deployment.md](docs/deployment.md).

---

## Qualität und CI

```bash
pnpm quality         # vollständiges Gate: Lint, Secrets, Typen, Tests, Security, Audit, Build, Bundle-Budget
pnpm quality:quiet   # dasselbe, gekürzte Ausgabe
pnpm ci:light        # schnellerer PR-Spiegel
pnpm ci:check        # ohne Security und Audit
```

Einzelne Bausteine: `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm test:security`, `pnpm secret:scan`, `pnpm docs:check`,
`pnpm file-size:check`, `pnpm boundary:check`, `pnpm test:e2e`.

Workflows unter `.github/workflows/`: `ci.yml` (Push auf `main` und wöchentlich),
`pr-check.yml` (jeder PR), `security.yml` (wöchentlich), `docs-check.yml`,
`deploy.yml` sowie die Release-Workflows.

Regeln für Agenten und wiederkehrende Fehlerbilder: [AGENTS.md](AGENTS.md).
Aufbau der Workflows: [docs/engineering/ci.md](docs/engineering/ci.md).

---

## Sicherheit

Die tragenden Invarianten:

- `dm_only` erreicht das Portal nie. Gefiltert wird zentral in
  `packages/database/src/permissions.ts`.
- Der Brain-Bereich ist owner-only und standardmäßig nur über Loopback
  erreichbar.
- Keine Geheimnisse im Quelltext.
- Die Content-Security-Policy wird nicht ohne Review abgeschwächt. In Produktion
  ist sie strikt; nur der Entwicklungszweig enthält `'unsafe-eval'` für HMR.
- Sicherheitsrelevante Pfade sind durch eigene Tests abgedeckt
  (`pnpm test:security`, `pnpm test:leaks`, `pnpm test:authz`).

Richtlinie und Meldeweg: [SECURITY.md](SECURITY.md).
Prüfmatrix: [docs/SECURITY_QA_MATRIX.md](docs/SECURITY_QA_MATRIX.md).

---

## Backup

```bash
pnpm backup:create
```

Backups umfassen Datenbank und Uploads und lassen sich in den
Studio-Einstellungen planen. Ablauf und Wiederherstellung:
[docs/BACKUP.md](docs/BACKUP.md) und
[docs/backup-restore.md](docs/backup-restore.md).

---

## MCP-Server

UWE bringt MCP-Server für Studio, Portal und Brain mit, damit KI-Werkzeuge
kontrolliert auf die laufende Instanz zugreifen können:

```bash
pnpm mcp:studio
pnpm mcp:portal
pnpm mcp:brain
```

Der Brain-Server gibt ohne ausdrückliche Freigabe nur Metadaten heraus, keine
Inhalte. Details:
[docs/engineering/mcp-servers.md](docs/engineering/mcp-servers.md).

---

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architektur und Repository-Aufbau |
| [docs/CURRENT_STATE.md](docs/CURRENT_STATE.md) | Aktueller Stand |
| [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md) | Ehrlicher Reifegrad je Feature |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Geplant und in Arbeit |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Produktionsbetrieb und Updates |
| [docs/daily-admin-os.md](docs/daily-admin-os.md) | Daily Admin OS |
| [docs/rtx-connector.md](docs/rtx-connector.md) | Ausgehender RTX Host Connector |
| [docs/engineering/ci.md](docs/engineering/ci.md) | CI-Workflows und lokale Gates |
| [docs/engineering/self-service-config.md](docs/engineering/self-service-config.md) | Self-Service-Konfiguration |
| [docs/engineering/database-service-map.md](docs/engineering/database-service-map.md) | Service-Index von `@uwe/database` |
| [AGENTS.md](AGENTS.md) | Regeln für Agenten und Quality Gate |
| [CHANGELOG.md](CHANGELOG.md) | Änderungen je Version |
| [SECURITY.md](SECURITY.md) | Sicherheitsrichtlinie |
| [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) | Fremde Werke und deren Lizenzlage |

---

## Lizenz

[MIT](LICENSE) — Nutzung, Änderung und Weitergabe sind frei, auch kommerziell,
solange der Copyright- und Lizenzhinweis erhalten bleibt.

Die Lizenzlage fremder Werke, die UWE berührt — das AGPL-Projekt Odysseus als
UX-Referenz sowie die über öffentliche APIs geladenen SRD-Inhalte unter OGL 1.0a
bzw. CC-BY-4.0 — steht in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
