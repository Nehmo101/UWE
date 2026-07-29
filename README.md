# UWE — Universeller Welten-Editor

**Ein selbst gehostetes Betriebssystem für Rollenspielrunden und den eigenen
Alltag** — Kampagnen-Werkzeug für die Spielleitung, Wiki für die Mitspielenden,
privater Wissensbereich für dich. Alles auf eigener Hardware.

[![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-blue.svg)](LICENSE)
[![Node.js ≥ 22](https://img.shields.io/badge/Node.js-%E2%89%A5%2022-339933.svg)](https://nodejs.org)
[![Letzte Aktivität](https://img.shields.io/github/last-commit/Nehmo101/UWE.svg)](https://github.com/Nehmo101/UWE/commits/main)

Keine fremde Cloud als Pflichtbestandteil: Die Daten liegen in SQLite auf deinem
Rechner, die KI läuft standardmäßig lokal über Ollama, LM Studio oder llama.cpp.
Cloud-Anbieter sind opt-in — und der persönliche Wissensbereich erreicht sie
grundsätzlich nie, hart codiert und durch Tests abgesichert.

Technisch ist UWE ein pnpm-Monorepo aus fünf Next.js-Anwendungen und rund 40
Paketen.

---

## Die fünf Oberflächen

| App | Port | Zielgruppe | Inhalt |
|---|---|---|---|
| **Studio** (`apps/studio`) | 3000 | Spielleitung, Owner | Weltbearbeitung, Admin, KI, Daily Admin OS. `dm_only`-Inhalte sind hier bewusst sichtbar. |
| **Portal** (`apps/portal`) | 3001 | Mitspieler:innen | Spieler-Wiki. Zeigt ausschließlich freigegebene, gefilterte Inhalte. |
| **Brain** (`apps/brain`) | 3002 | nur Owner | Privater Wissens- und Daily-Admin-Bereich. Owner-only, lokal. |
| **Family** (`apps/family`) | 3004 | Häkchen `Family` | Gemeinsamer Haushalt — Kalender, Küche, Dokumente, Chat. |
| **Landing** (`apps/landing`) | 3103 | öffentlich | Startseite auf dem Apex-Origin. Genau drei Routen, keine Inhalte. |

Dazu kommt das **Command Center** (`apps/rtx-connector-client`, Tauri) als
optionale Desktop-Oberfläche für Host- und Connector-Verwaltung.

Die Trennung ist keine Kosmetik: Sie wird durch `packages/product-contracts`
erzwungen und in CI geprüft. Inhalte der Klasse `dm_only` dürfen das Portal nie
erreichen, `owner_private_local` nie den Host verlassen.

---

## Schnellstart

**Voraussetzungen:** Node.js ≥ 22, pnpm 10.

```bash
pnpm install
cp -n .env.example .env
pnpm --filter @uwe/database db:deploy          # uwe.db
pnpm --filter @uwe/database db:deploy:brain    # uwe-brain.db
pnpm --filter @uwe/database db:deploy:family   # uwe-family.db
pnpm --filter @uwe/database db:seed
pnpm dev
```

Studio läuft danach auf <http://localhost:3000>, Portal auf
<http://localhost:3001>. Seed-Login: `dm@uwe.local` / `uwe-dev`.

Einzelne Apps starten, echten Owner-Account anlegen, Quality Gate:
[CONTRIBUTING.md](CONTRIBUTING.md).

---

## Oberfläche

> **Hier fehlt noch ein Screenshot.** Für ein UI-Projekt ist das die wichtigste
> Stelle der Seite — ein Bild von Studio oder Portal gehört hierhin.

---

## Status

Version `0.1.0`, **aktiv in Entwicklung** und produktiv auf einem einzelnen
Linux-Host im Einsatz.

Eine ehrliche Einschätzung, was fertig ist und was nicht, steht in der
[Feature-Reifegrad-Matrix](docs/FEATURE_MATURITY_MATRIX.md) — jedes Feature ist
dort als Stable, Beta, Lab oder Deprecated eingestuft.

---

## Dokumentation

| Dokument | Inhalt |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Architektur, Paket-Map, wohin neuer Code gehört |
| [docs/FEATURE_MATURITY_MATRIX.md](docs/FEATURE_MATURITY_MATRIX.md) | Reifegrad je Feature |
| [docs/PRODUCTION.md](docs/PRODUCTION.md) | Produktionsbetrieb auf einem Linux-Host |
| [docs/configuration.md](docs/configuration.md) | Umgebungsvariablen und Geheimnisse |
| [docs/ai-privacy-and-cloud-fallback.md](docs/ai-privacy-and-cloud-fallback.md) | KI-Datenschutz und Cloud-Grenzen |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Entwicklungsumgebung, Quality Gate, Architektur-Regeln |

---

## Mitmachen

Beiträge sind willkommen — Bug-Reports, Dokumentation, Tests und Code.
Projektsprache ist Deutsch. Größere Änderungen bitte vorher als Issue
besprechen; der Ablauf steht in [CONTRIBUTING.md](CONTRIBUTING.md), die
Umgangsregeln in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Sicherheitslücken bitte **nicht** als öffentliches Issue, sondern über
[GitHub Security Advisories](https://github.com/Nehmo101/UWE/security/advisories/new)
melden — siehe [SECURITY.md](SECURITY.md).

---

## Lizenz

[MIT](LICENSE) — Nutzung, Änderung und Weitergabe sind frei, auch kommerziell,
solange der Copyright- und Lizenzhinweis erhalten bleibt.

Die Lizenzlage fremder Werke, die UWE berührt, steht in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
