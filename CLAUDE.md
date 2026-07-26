# CLAUDE.md — UWE Projekt

UWE (Universeller Welten-Editor) ist ein selbst-gehostetes Alltags- und Hobby-Betriebssystem: DM-Studio, Spieler-Portal, Daily Admin OS, DnD-Brain, Life Brain — auf eigener Hardware.

## Architektur auf einen Blick

```
apps/studio   → DM-App (Port 3000) — Weltbearbeitung, Admin, AI, Daily Admin OS
apps/portal   → Spieler-Wiki (Port 3001) — nur gefilterte, freigegebene Inhalte
apps/brain    → Owner-only Brain (Port 3002) — privater Daily-Admin-/Wissensbereich
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

Kernregeln: keine Secrets in Source; `dm_only` nie ins Portal; Filtering in `packages/database/src/permissions.ts`; Cloud-AI ohne Kampagnen/Brain-Kontext; CSP nicht ohne Review schwächen.

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
pnpm --filter @uwe/database db:deploy
pnpm --filter @uwe/database db:seed
# Login: dm@uwe.local / uwe-dev
```

## Aktive Runtime-Wahrheit

- **UWE Host**: Linux + Node.js 22 + `pnpm` + `systemd` (`deploy/systemd/uwe.service`).
- **RTX Host Connector**: optionaler **outbound** Worker (`tools/uwe-rtx-connector`).
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
- [.cursor/skills/manifest.json](.cursor/skills/manifest.json) — Skill-Index (23 Skills)
