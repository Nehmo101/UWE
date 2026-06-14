# Test Plan — Media, Calendar, DnD & Agent Automation

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

### Agent Jobs
1. `AGENT_JOBS_ENABLED=true`, Token + Repo setzen
2. `/admin/agent-jobs` → Job erstellen
3. GitHub Actions Run prüfen
4. Draft-PR erscheint (kein Merge)

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
- [ ] Agent Job Draft-PR Workflow

## Bekannte Test-Lücken

- Kein E2E Playwright für neue Pages (Phase 2)
- CalDAV Integrationstest mit Mock-Server (TODO)
- Image Studio ohne RTX/Cloud nur Fehlerpfad testbar
