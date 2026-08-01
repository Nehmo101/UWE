# CLAUDE.md — UWE Projekt

UWE (Universeller Welten-Editor) ist ein selbst-gehostetes Alltags- und Hobby-Betriebssystem: DM-Studio, Spieler-Portal, Daily Admin OS, DnD-Brain, Life Brain — auf eigener Hardware.

## Architektur auf einen Blick

```
apps/studio   → DM-App (Port 3000) — Weltbearbeitung, Admin, AI, Daily Admin OS
apps/portal   → Spieler-Wiki (Port 3001) — nur gefilterte, freigegebene Inhalte
apps/brain    → Owner-only Brain (Port 3002) — privater Daily-Admin-/Wissensbereich
apps/family   → Family (Port 3004) — gemeinsamer Haushalt, Häkchen `Family`
apps/landing  → Öffentliche Startseite (Port 3103) — Apex-Origin, genau drei Routen
packages/*    → Alle Business-Logik, nie in Route Handlers oder Komponenten
```

**Goldene Regel:** Business-Logik gehört in `packages/`, nicht in Next.js Route Handler.

### Package-Map

| Package | Zuständigkeit |
|---------|---------------|
| `@uwe/database` | Prisma Schema, Repositories, Domain Services |
| `@uwe/auth` / `@uwe/security` | Sessions, RBAC, API Guards, CSRF |
| `@uwe/ai-brain` | AI-Router, DnD-Generator, Privacy Guards |
| `@uwe/assets` | Upload-Pfade, MIME-Validierung |
| `@uwe/shared-ui` | Geteilte React-Komponenten (AppShell, Nav) |
| `@uwe/shared-utils` | Framework-agnostische Utilities (Slugs, Lookup-Keys) |
| `@uwe/mcp` | MCP-Server für Studio/Portal/Brain (HTTP-Clients, kein DB-Zugriff) |
| `@uwe/cloudflare-edge` | Cloudflare-Edge-Konfiguration, die UWE selbst besitzt (Managed Challenge / WAF-Regel) |
| `@uwe/pdf-ocr` | Layout-treues PDF-Parsing über lokales Unlimited-OCR (Rendern, Seitenplanung, Marker) |
| `@uwe/doc-import` | Markdown-Import: deutscher Frontmatter-Dialekt, Markdown→HTML, Überschriftenbaum, Welt-Übernahme |
| `@uwe/session-runner` | Lesereihenfolge im Seitenbaum und Lesezeichen für den Spielabend |
| Feature-Packages | `backup`, `calendar`, `mail`, `dnd-api`, `image-studio`, `agent-jobs`, `brain-assistant` |

### Neuen Code platzieren

```
Schema-Änderung   → packages/database/prisma/schema.prisma + Migration
Domain-Logik      → packages/database/src/*-service.ts oder Feature-Package
Studio API        → apps/studio/app/api/**/route.ts
Studio UI         → apps/studio/app/**/page.tsx
Server Actions    → apps/studio/app/*-actions.ts
Portal            → apps/portal/app/**
Shared UI         → packages/shared-ui/src/
```

## CI & Agent-Regeln

**Kanonical source:** [AGENTS.md](AGENTS.md) — Quality Gate (`pnpm quality` / `pnpm ci:light`), Common Failures, Auth-Import-Tabelle, Cursor-Cloud-Setup.

Schnell-Gate ohne Security/Audit: `pnpm ci:check`

## Sicherheits-Regeln

Details: [SECURITY.md](SECURITY.md) und `.cursor/rules/security.mdc`.

Kernregeln: keine Secrets in Source; Zugang = vier Häkchen pro E-Mail (`packages/auth/src/area-access.ts`); Inhalt = Welt-Zuordnung (`packages/auth/src/permissions.ts`); jede KI-Aktion über den RTX-Host, kein Cloud-Provider; CSP nicht ohne Review schwächen.

**Zugangsmodell in einem Satz:** Das Häkchen sagt, welche App (Portal / Studio / Brain / Family). Die Welt-Zuordnung sagt, welche Welt. Sonst nichts. `owner` ist die einzige verbliebene Rolle — für Betrieb, Restore und das Command Center.

**Ein Flag daneben:** `User.aiAccess` — darf diese Adresse die RTX-KI benutzen. Kein fünftes App-Häkchen, sondern eine Fähigkeit des Kontos; einstellbar im Command Center, Owner geht immer durch (`canUseRtxAi`). Durchgesetzt zentral: Pfadregel für KI-API-Routen, `require*AiActionAuth` für KI-Server-Actions. Details: [docs/engineering/access-model.md](docs/engineering/access-model.md).

## TypeScript / React Konventionen

- Strict Typing, kein `any` außer bei untyped Externals.
- Server Actions für Studio-Formulare; API Routes für Uploads, Health, externe Callbacks.
- Keine Server-only Module in Client Components; keine Cross-App Imports.
- **`@uwe/database/server`** ist der etablierte Import-Pfad für Bestandscode (~2180 Zeilen Barrel, ~440 Importer — **eingefroren**, siehe Modul-Disziplin). Service-Index: [docs/engineering/database-service-map.md](docs/engineering/database-service-map.md).

## Modul-Disziplin (Anti-Monolith)

Enforced durch `scripts/file-size-budget-check.mjs` (läuft in `pnpm test` / `test:ci`):

- **Neue Dateien: max. 700 Zeilen**, Ziel < 300. Beim Überschreiten in Module oder ein Feature-Package aufteilen — **nicht** die Baseline anpassen.
- **Bestands-Monolithen** (`scripts/file-size-baseline.json`) sind eingefroren (+10 % Toleranz). Wer sie ändert, zieht Code heraus statt anzubauen. Baseline-Werte **niemals erhöhen**, keine neuen Einträge hinzufügen; `--ratchet` senkt nur.
- **Neue Domänen-Services gehören NICHT in `packages/database`**, sondern in ein bestehendes oder neues Feature-Package (`packages/<domain>`). `@uwe/database` bleibt Data-Access + bestehende Kern-Services.
- **`server.ts`-Barrel nicht weiter vergrößern** (Budget nur +3 %): neue Symbole über Subpath-Exports (siehe `packages/database/package.json` → `exports`) oder das Feature-Package exportieren. Bestehende Importe bleiben gültig.
- Beim Aufteilen: Verhalten unverändert lassen; Re-Exports für Abwärtskompatibilität sind erlaubt.

## Dev-Mode CSP

Die CSP ist umgebungsabhängig: Der Dev-Zweig enthält bereits `'unsafe-eval'`, daher funktioniert `next dev` (HMR + Hydration) im Browser ohne CSP-Patch. Produktion bleibt strikt. Siehe [AGENTS.md](AGENTS.md).

## Lokale DB einrichten (einmalig)

```bash
cp -n .env.example .env
# Es sind drei Datenbanken — der Seed braucht alle drei, sonst bricht er ab.
pnpm --filter @uwe/database db:deploy          # uwe.db
pnpm --filter @uwe/database db:deploy:brain    # uwe-brain.db
pnpm --filter @uwe/database db:deploy:family   # uwe-family.db
pnpm --filter @uwe/database db:seed
# Login: dm@uwe.local / uwe-dev
```

Der Seed-Nutzer trägt die Häkchen `Portal` und `Studio`. Für Brain oder Family
das jeweilige Häkchen im Command Center setzen.

## Aktive Runtime-Wahrheit

- **Datenbanken**: `uwe.db` (D&D), `uwe-brain.db` (owner-privat), `uwe-family.db` (Family).
  Die Aufteilung kommt aus `PRISMA_MODEL_BOUNDARIES`; `scripts/generate-brain-schema-split.mjs`
  schreibt daraus die drei Prisma-Schemata.
- **UWE Host**: Linux + Node.js 22 + `pnpm` + `systemd` (`deploy/systemd/uwe.service`).
- **Maschinenraum**: optionaler **outbound** Worker (`tools/uwe-rtx-connector`).
  Früher „RTX Host Connector“ — umbenannt wurde nur der Produktname; Ordner,
  Paketnamen, `UWE_CONNECTOR_*`, Token-Präfix `uwec_` und die systemd-Unit
  bleiben eingefroren ([docs/rtx-connector.md](docs/rtx-connector.md)).
- **UWE Command Center**: Desktop-App (`apps/rtx-connector-client`) mit
  Ersteinrichtungs-Assistent. Welche Apps eine Installation betreibt, steht in
  `install-selection.json` neben den Host-Daten und steuert Migrationen, Builds,
  Statuskarten und Start ([docs/command-center.md](docs/command-center.md)).
- **Cloudflare Tunnel / Access**: optional davor.
- **CI/Agenten**: nur GitHub Cloud.
- **Kein** Docker, **kein** Windows-One-Click-Installer, **kein** inbound RTX-Agent als aktiver Pfad.

## Self-Service-Betrieb (kein manuelles Host-Setup)

**Leitprinzip:** Jede Einrichtung/Konfiguration (Backups, Auto-Briefing, Scheduling, Integrationen …) muss **in UWE selbst** einstellbar sein und automatisch zum Host **zurückgesynct** werden. Ziel: so wenig wie möglich — idealerweise nichts — manuell auf dem UWE-Host konfigurieren.

**Etabliertes Muster (DB-Setting → host-lesbare Datei → systemd liest):**
1. Setting in `packages/database/src/settings-service.ts` (Gruppe + Default) + Validierung in `settings-validation.ts`.
2. UI-Toggle in den Studio-Settings; Speichern über `updateSettingsAction` (`apps/studio/app/settings-actions.ts`).
3. Nach dem Speichern schreibt ein Sync-Wrapper (`apps/studio/src/lib/*-schedule-sync.ts`) eine **host-lesbare** JSON-Datei (Writer im Feature-Package, z. B. `writeBackupScheduleConfig` in `@uwe/backup`).
4. Das systemd-Skript (`deploy/scripts/*.sh`) **liest** diese JSON und gated enabled/Parameter — der Timer bleibt statisch.

**Regel:** Kein neuer *laufender* Host-Schritt. Wer einen Timer/Cron/Env-Wert braucht, macht ihn über dieses Muster aus UWE steuerbar. Nur die **einmalige** Unit-Installation (`cp` + `systemctl enable`) darf manuell bleiben. Referenz: [docs/engineering/self-service-config.md](docs/engineering/self-service-config.md).

## Scope-Disziplin

Minimaler Diff; Package-Grenzen einhalten; keine Drive-by Refactors; Services erweitern statt duplizieren.

## Wichtige Docs

- [AGENTS.md](AGENTS.md) — Agent-Gate & Cloud-Setup
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — Architektur
- [docs/engineering/ci.md](docs/engineering/ci.md) — CI-Workflows
- [docs/engineering/self-service-config.md](docs/engineering/self-service-config.md) — Self-Service-Konfig & Host-Sync-Muster
- [docs/engineering/mcp-servers.md](docs/engineering/mcp-servers.md) — MCP-Server & `/uwestudio` `/uweportal` `/uwebrain` `/uwefamily`
- [docs/family/README.md](docs/family/README.md) — Family: Mitglieder, Kalender, API, Kochbuch, Konto
- [docs/engineering/doc-import-und-session-runner.md](docs/engineering/doc-import-und-session-runner.md) — Frontmatter-Dialekt, Seitenbaum-Import, Splitscreen am Spieltisch, API-Allowlist-Falle
- [docs/design/responsive-tables.md](docs/design/responsive-tables.md) — Tabellen auf dem Telefon: `ResponsiveTable`, `DataTable`, Attribut-Vertrag
- [docs/design/theme-a11y-checklist.md](docs/design/theme-a11y-checklist.md) — Schwellen der a11y-Prüfmatrix und die Kaskadenfallen
- [.cursor/skills/manifest.json](.cursor/skills/manifest.json) — Skill-Index (24 Skills)
