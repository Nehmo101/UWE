# Beiträge zu UWE

Danke für dein Interesse. UWE ist ein selbst-gehostetes Alltags- und
Hobby-Betriebssystem — ein pnpm-Monorepo aus fünf Next.js-Anwendungen und rund
40 Paketen. Beiträge sind willkommen: Bug-Reports, Dokumentation, Tests und Code.

Projektsprache ist **Deutsch** — für Issues, PR-Beschreibungen, Commit-Messages
und Code-Kommentare. Englische Beiträge werden nicht abgelehnt, aber die
bestehende Codebasis und Dokumentation ist durchgängig deutsch.

---

## Bevor du anfängst

- **Kleine Korrekturen** (Tippfehler, kaputte Links, offensichtliche Bugs):
  einfach einen PR aufmachen.
- **Größere Änderungen** (neue Features, neue Pakete, Schema-Änderungen):
  vorher ein Issue aufmachen und den Ansatz kurz skizzieren. Das erspart dir
  Arbeit, die aus Architekturgründen nicht übernommen werden kann.
- **Sicherheitslücken:** bitte **nicht** als öffentliches Issue. Siehe
  [SECURITY.md](SECURITY.md).

---

## Entwicklungsumgebung

**Voraussetzungen:** Node.js ≥ 22, pnpm 10.

```bash
pnpm install
cp -n .env.example .env
```

UWE hat **drei** Datenbanken. Der Seed bricht ab, wenn nicht alle drei
existieren:

```bash
pnpm --filter @uwe/database db:deploy          # uwe.db        (D&D / Welten)
pnpm --filter @uwe/database db:deploy:brain    # uwe-brain.db  (owner-privat)
pnpm --filter @uwe/database db:deploy:family   # uwe-family.db (Family)
pnpm --filter @uwe/database db:seed
```

Danach:

```bash
pnpm dev            # alle Apps
pnpm dev:studio     # nur Studio (Port 3000)
```

Seed-Login: `dm@uwe.local` / `uwe-dev`. Der Seed-Nutzer trägt die Häkchen
`Portal` und `Studio`; `Brain` und `Family` setzt du im Command Center.

Der Demo-Seed verweigert den Dienst bei `NODE_ENV=production` — die
Demo-Zugangsdaten sind ausschließlich für lokale Entwicklung.

---

## Quality Gate

Vor jedem PR muss das Gate lokal grün sein:

```bash
pnpm quality        # vollständiges Gate (wie auf main)
```

Schnellere Varianten während der Arbeit:

```bash
pnpm ci:light       # spiegelt den PR-Check
pnpm ci:check       # ohne Security-/Audit-Schritte
pnpm lint
pnpm typecheck
pnpm test
```

Details und die wiederkehrenden Fehlerbilder stehen in [AGENTS.md](AGENTS.md) —
das ist die kanonische Quelle für das Gate.

---

## Architektur-Regeln

Diese vier Regeln werden in CI erzwungen. Ein PR, der sie verletzt, wird rot,
bevor jemand ihn liest.

### 1. Fachlogik gehört in `packages/`

Nie in Next.js Route Handler oder React-Komponenten. Route Handler nehmen eine
Anfrage entgegen, rufen einen Service und formen eine Antwort — mehr nicht.

```
apps/studio   → DM-App (Port 3000)
apps/portal   → Spieler-Wiki (Port 3001)
apps/brain    → Owner-Bereich (Port 3002)
apps/family   → Family (Port 3004)
apps/landing  → Startseite (Port 3103)
packages/*    → gesamte Fachlogik
```

Wo neuer Code hingehört, steht in [CLAUDE.md](CLAUDE.md) und
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

### 2. Modul-Disziplin (Anti-Monolith)

Geprüft durch `scripts/file-size-budget-check.mjs`:

- **Neue Dateien: maximal 700 Zeilen**, Ziel unter 300. Beim Überschreiten in
  Module aufteilen — **nicht** die Baseline anpassen.
- Bestands-Monolithen in `scripts/file-size-baseline.json` sind eingefroren.
  Werte dort **niemals erhöhen**, keine neuen Einträge. Wer eine solche Datei
  anfasst, zieht Code heraus statt anzubauen.
- **Neue Domänen-Services gehören nicht in `packages/database`**, sondern in ein
  Feature-Package (`packages/<domain>`). `@uwe/database` bleibt Data-Access plus
  die bestehenden Kern-Services.
- Das `server.ts`-Barrel wird nicht weiter vergrößert. Neue Symbole über
  Subpath-Exports (`packages/database/package.json` → `exports`).

### 3. Keine Cross-App-Imports

`apps/studio` importiert nicht aus `apps/portal`. Gemeinsames gehört nach
`packages/shared-ui` oder `packages/shared-utils`. Server-only Module gehören
nicht in Client Components — geprüft durch `scripts/client-server-boundary.test.ts`.

### 4. Sichtbarkeitsgrenzen sind nicht verhandelbar

- Inhalte der Klasse `dm_only` dürfen das **Portal** nie erreichen.
- Inhalte der Klasse `owner_private_local` dürfen den **Host** nie verlassen.

Erzwungen durch `packages/product-contracts` und
`scripts/product-boundary-check.mjs`. Details in [SECURITY.md](SECURITY.md).

---

## Konventionen

- **TypeScript strict.** Kein `any` außer bei untypisierten Externals.
- **Server Actions** für Studio-Formulare; **API Routes** für Uploads, Health
  und externe Callbacks.
- **Minimaler Diff.** Keine Drive-by-Refactors, keine Umformatierung
  unbeteiligter Dateien. Bestehende Services erweitern statt duplizieren.
- **Keine Secrets im Quelltext.** `pnpm secret:scan` läuft im Gate.

### Schema-Änderungen

Änderungen an `packages/database/prisma/schema.prisma` brauchen immer eine
Migration. Die Aufteilung auf die drei Datenbanken kommt aus
`PRISMA_MODEL_BOUNDARIES`; `scripts/generate-brain-schema-split.mjs` erzeugt
daraus die drei Prisma-Schemata — die generierten Schemata nicht von Hand
bearbeiten.

### Self-Service-Betrieb

Jede Einrichtung muss **in UWE selbst** einstellbar sein und automatisch zum
Host zurückgesynct werden. Neue laufende Host-Schritte (Cron, manuell gesetzte
Env-Werte) werden nicht übernommen. Das etablierte Muster steht in
[docs/engineering/self-service-config.md](docs/engineering/self-service-config.md).

---

## Pull Requests

1. Branch von `main` abzweigen.
2. Änderung umsetzen, Tests ergänzen.
3. `pnpm quality` lokal grün bekommen.
4. PR aufmachen — die Vorlage füllt sich beim Öffnen aus.

Was einen PR schnell durchgehen lässt:

- **Eine Sache pro PR.** Getrennte Anliegen in getrennte PRs.
- **Beschreib das Warum**, nicht nur das Was. Das Was steht im Diff.
- **Tests für neues Verhalten.** Bugfixes bekommen einen Test, der ohne den Fix
  fehlschlägt.
- **Dokumentation mitziehen**, wenn sich Verhalten oder Einrichtung ändert.

Commit-Messages: Imperativ, erste Zeile unter 72 Zeichen, deutsch. Der Rumpf
erklärt die Begründung.

```
Portal-Suche filtert dm_only-Treffer vor dem Ranking

Bisher wurden dm_only-Einträge erst nach dem Ranking entfernt, wodurch
die Trefferzahl auf ihre Existenz schließen ließ.
```

---

## Projektstruktur

| Package | Zuständigkeit |
|---------|---------------|
| `@uwe/database` | Prisma-Schema, Repositories, Kern-Services |
| `@uwe/auth` / `@uwe/security` | Sessions, RBAC, API-Guards, CSRF |
| `@uwe/ai-brain` | AI-Router, DnD-Generator, Privacy Guards |
| `@uwe/assets` | Upload-Pfade, MIME-Validierung |
| `@uwe/shared-ui` | Geteilte React-Komponenten |
| `@uwe/shared-utils` | Framework-agnostische Utilities |
| `@uwe/mcp` | MCP-Server für Studio/Portal/Brain |
| `@uwe/product-contracts` | Sichtbarkeits- und Produktgrenzen |

Vollständiger Service-Index:
[docs/engineering/database-service-map.md](docs/engineering/database-service-map.md).

---

## Lizenz

Mit deinem Beitrag stimmst du zu, dass er unter der
[MIT-Lizenz](LICENSE) veröffentlicht wird.
