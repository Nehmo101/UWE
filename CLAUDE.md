# CLAUDE.md — UWE Projekt

UWE (Universeller Welten-Editor) ist ein selbst-gehostetes Alltags- und Hobby-Betriebssystem: DM-Studio, Spieler-Portal, Daily Admin OS, DnD-Brain, Life Brain — auf eigener Hardware.

## Architektur auf einen Blick

```
apps/studio   → DM-App (Port 3000) — Weltbearbeitung, Admin, AI, Daily Admin OS
apps/portal   → Spieler-Wiki (Port 3001) — nur gefilterte, freigegebene Inhalte
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
| Feature-Packages | `backup`, `calendar`, `mail`, `dnd-api`, `image-studio`, `agent-jobs` |

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

## CI-Gate — GitHub Cloud ist maßgeblich

**GitHub Cloud CI ist der verbindliche Gate.** Ein PR ist mergebar, wenn seine
GitHub-Checks grün sind: `pr-check.yml` (`pnpm ci:light`) auf jedem PR, volles
`pnpm quality` auf `main`. Es gibt **keinen** lokalen oder self-hosted Pflicht-Gate.

Lokal `pnpm quality` (oder schneller `pnpm ci:light`) vor dem Push laufen zu lassen
ist eine **optionale Vorprüfung**, um Fehler früher zu finden:

```bash
pnpm install --frozen-lockfile
pnpm quality
```

`pnpm quality` läuft in dieser Reihenfolge:
1. `pnpm --filter @uwe/database db:generate` — Prisma Client
2. `pnpm lint` — ESLint mit `--max-warnings 0`
3. `pnpm secret:scan` — Secrets-Scan
4. `pnpm typecheck` — alle Workspace-Packages
5. `pnpm test` — Unit + Integration
6. `pnpm test:security` — Authz, Leak-Scanner, Route Guards
7. `pnpm audit:prod` — Production Dependency Audit (high+)
8. `pnpm build:release` — Production Build

Maßgeblich sind die grünen GitHub-Checks; der lokale Lauf ist optionale Vorprüfung.

### Schnell-Gate (ohne Security/Audit)

```bash
pnpm ci:check   # lint → typecheck → test:ci → build:release
```

## Häufige CI-Fehler

### 1. Unused Imports (lint)
ESLint `@typescript-eslint/no-unused-vars` ist strikt.
- Unused Parameter: mit `_` prefixen: `function handler(_request: Request)`
- Unused Imports: sofort entfernen

### 2. Falsche Auth-Imports (typecheck)

| Symbol | Import von |
|--------|-----------|
| `SESSION_COOKIE_NAME`, `PREVIEW_COOKIE_NAME` | `@uwe/auth` oder `packages/auth/src/session` |
| `getUweRuntimeConfig`, `getSessionCookieOptions` | `@uwe/auth` oder `packages/auth/src/runtime-config` |

`SESSION_COOKIE_NAME` NICHT aus `runtime-config` importieren.

### 3. Prisma Client fehlt (typecheck/test)
Nach Änderungen in `packages/database` immer zuerst:
```bash
pnpm --filter @uwe/database db:generate
```

### 4. Lockfile out of sync
Nach `pnpm add` / Dependency-Änderungen: `pnpm install` und `pnpm-lock.yaml` committen.

## Sicherheits-Regeln

- Keine Secrets, Tokens oder Produktions-Passwörter in Source-Code.
- `pnpm secret:scan` vor jedem Push.
- `dm_only`-Inhalte dürfen **niemals** das Portal, Static Export oder anonyme API-Responses erreichen.
- Filtering in `packages/database/src/permissions.ts` — nicht nur in der UI.
- Studio-APIs brauchen `requireStudioApiAuth` oder äquivalente Guards.
- Cloud-AI bekommt **keinen** Kampagnen/Brain-Kontext; RTX bleibt im LAN.
- CORS, CSP, Security-Headers nicht ohne expliziten Review schwächen.

## TypeScript / React Konventionen

- Strict Typing, kein `any` außer bei untyped Externals.
- Server Actions für Studio-Formulare; API Routes für Uploads, Health, externe Callbacks.
- Keine Server-only Module (`node:crypto`, Prisma, Filesystem) in Client Components.
- Keine Cross-App Imports (`apps/studio` darf nicht von `apps/portal` importieren).
- Keine toten Features, auskommentierte Blöcke oder Orphan-Files.
- `@uwe/database/server` Barrel ist groß (~1080 Zeilen) — lieber direkte Service-Imports.

## Dev-Mode Gotcha: CSP blockiert `next dev`

Die CSP erlaubt kein `'unsafe-eval'`. `next dev` benötigt das für HMR. Für Browser-Tests in dev temporär `'unsafe-eval'` in `packages/auth/src/security-headers.ts` ergänzen — **vor Commit revertieren**.

## Lokale DB einrichten (einmalig)

```bash
cp -n .env.example .env
pnpm --filter @uwe/database db:deploy   # Migrations
pnpm --filter @uwe/database db:seed     # Demo-Welt "Terra" + User
# Login: dm@uwe.local / uwe-dev
```

## Aktive Runtime-Wahrheit

- **UWE Host**: Linux + Node.js 22 + `pnpm` + `systemd` (`deploy/systemd/uwe.service`).
- **RTX Host Connector**: optionaler **outbound** Worker (`tools/uwe-rtx-connector`).
- **Cloudflare Tunnel / Access**: optional davor.
- **CI/Agenten**: nur GitHub Cloud.
- **Kein** Docker, **kein** Windows-One-Click-Installer, **kein** inbound RTX-Agent als aktiver Pfad.

## Scope-Disziplin

- Minimaler Diff — nur das ändern, was der Task verlangt.
- Bestehende Package-Grenzen einhalten.
- Keine Drive-by Refactors.
- Bestehende Services erweitern statt Logik duplizieren.
- Kein Docker / Windows-Installer / inbound RTX-Agent wieder einführen.

## Wichtige Docs

- `AGENTS.md` — vollständige Agent-Qualitäts-Gate-Regeln
- `docs/ARCHITECTURE.md` — Architektur-Überblick
- `docs/engineering/ci.md` — CI-Workflows
- `.cursor/skills/` — 20+ projektspezifische Skills (Architecture, Auth, Security, etc.)
- `.cursor/rules/` — Coding-Standards, Security, Docs
