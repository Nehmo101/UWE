# Test Plan — Media, Calendar, DnD, Security & Agent Automation

## Security & Auth QA

| Bereich | Datei / Befehl | Beschreibung |
|---------|----------------|--------------|
| Security Suite | `pnpm test:security` | Role matrix, route authz, leak scanner, studio route inventory |
| Authz | `pnpm test:authz` | Role matrix + route guards |
| Leak Scanner | `pnpm test:leaks` | Anonymous portal leak scan |
| Studio Route Auth | `scripts/studio-route-auth.test.ts` | Every Studio API route has auth guard |
| Visibility | `packages/database/src/visibility-security.test.ts` | `dm_only` never on portal |
| Setup | `packages/database/src/auth-setup.test.ts` | One-time owner bootstrap |
| Password | `packages/database/src/password-security.test.ts` | Hashing, admin reset, change-password |
| Password reset flow | `packages/database/src/auth-password-reset.test.ts` | Self-service forgot/reset |
| **QA Matrix** | [docs/SECURITY_QA_MATRIX.md](./SECURITY_QA_MATRIX.md) | Manuelle + automatisierte Auth/Route-Checks |

## Automatisierte Tests

| Bereich | Datei | Beschreibung |
|---------|-------|--------------|
| iCal Parse/Export | `packages/calendar/src/ical.test.ts` | VEVENT parsing, .ics generation |
| Integration Smoke | `scripts/integration-smoke.test.ts` | Routes, docs, no secrets |
| Job Types | `packages/database/src/job-service.ts` | Labels für neue Job-Typen |
| Bestehend | `pnpm test` | 96+ Testdateien im Monorepo |

## Manuelle Tests

### Image Studio
1. `IMAGE_STUDIO_ENABLED=true`, RTX mock oder `AI_USE_MOCK`
2. `/image-studio` → Prompt senden
3. `/jobs` → Job `image_studio` completed
4. Asset in Welt-Medienbibliothek

### Kalender
1. `/calendar` → Termin anlegen
2. `.ics` Export downloaden
3. iCal-Feed URL hinzufügen (öffentlicher Test-Feed)
4. Sync-Job in `/jobs`

### DnD API
1. `/worlds/{slug}/dnd-api` → Suche "goblin"
2. D&D Beyond Link speichern (URL mit dndbeyond.com)
3. Cache-Hit bei wiederholter Suche

### GitHub-Issues aus dem Bug-Center
1. `GITHUB_ISSUE_REPO=owner/repo` + `GITHUB_TOKEN` setzen
2. `/bugs` → Bug-Report öffnen → „Als GitHub-Issue erstellen"
3. Issue im Repo prüfen, Link steht am Report
4. Zweiter Klick meldet 409 (Issue schon verknüpft)

## CI Pipeline

```bash
pnpm install --frozen-lockfile
pnpm --filter @uwe/database db:generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Release Checklist

- [ ] Migration `20260614120000_media_calendar_dnd_agents` deployed
- [ ] `.env.example` auf Host aktualisiert
- [ ] RTX `/v1/images` Endpoint (optional)
- [ ] FamilyWall iCal URL getestet

## Auth UI (Landing, Login, Passwort-Reset)

Manuelle Frontend-QA für Studio (Port 3000) und Portal (Port 3001):

### Landing Page `/`
1. Ohne Session: `/` zeigt UWE-Branding, Beschreibung, Buttons „Zum Studio“ und „Zum Portal“.
2. Beide Buttons führen zu `/login` (bzw. Cross-App-Login-URL).
3. Mit Session: Buttons führen zu `/studio` (Studio) bzw. `/portal` (Portal).
4. Abmelden-Button sichtbar und funktionsfähig.
5. Mobile (375px): Buttons stapeln sich, Text lesbar, Touch-Ziele ≥ 44px.

### Login `/login`
1. E-Mail + Passwort + Anmelden; Tab-Reihenfolge logisch.
2. Falsches Passwort → neutrale Fehlermeldung ohne Account-Leak.
3. Ladezustand „Anmelden…“ während Request.
4. Link „Passwort vergessen?“ → `/forgot-password`.
5. Dev: `dm@uwe.local` / `uwe-dev` (Studio), `aman@uwe.local` / `uwe-dev` (Portal).

### Logout
1. Studio: Landing-Abmelden oder `/logout` → Session weg, zurück zu `/`.
2. Portal: AuthHeader-Abmelden → zurück zu `/`.

### Passwort vergessen `/forgot-password`
1. E-Mail-Feld + Button; Ladezustand sichtbar.
2. Erfolg → neutrale Meldung (unabhängig von Konto-Existenz).
3. Link zurück zu `/login`.

### Passwort zurücksetzen `/reset-password?token=…`
1. Ohne Token → Fehlermeldung.
2. Mit gültigem Token: Passwort + Bestätigung, min. 8 Zeichen.
3. Erfolg → Redirect zu `/login?reset=success` mit Bestätigung.
4. Abgelaufener Token → Fehlermeldung.

### Tastatur & A11y
1. Alle Formularfelder haben `<label htmlFor=…>`.
2. Fehler mit `role="alert"`, Erfolg mit `role="status"`.
3. Enter sendet Formulare; Buttons per Tab erreichbar.

### Cross-App Links
1. `.env`: `NEXT_PUBLIC_STUDIO_URL`, `NEXT_PUBLIC_PORTAL_URL` gesetzt.
2. Von Portal-Landing → Studio-Link zeigt auf Studio-Origin.
3. Von Studio-Landing → Portal-Link zeigt auf Portal-Origin.

**Hinweis:** `/api/auth/forgot-password` und `/api/auth/reset-password` müssen vom Backend-Subagenten bereitstehen, damit Reset-Flows End-to-End funktionieren.

## Bekannte Test-Lücken

- Kein E2E Playwright für Auth-Flows (Login, Setup, Forgot/Reset, Logout) — manuelle QA in [SECURITY_QA_MATRIX.md](./SECURITY_QA_MATRIX.md)
- Kein E2E Playwright für neue Pages (Phase 2)
- CalDAV Integrationstest mit Mock-Server (TODO)
- Image Studio ohne RTX/Cloud nur Fehlerpfad testbar
