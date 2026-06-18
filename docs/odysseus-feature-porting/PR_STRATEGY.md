# PR-Strategie: Odysseus Feature-Portierung

## Branch-Schema

| Branch | Feature-Bereich | Merge-Reihenfolge |
|--------|-----------------|-------------------|
| `feature/odysseus-auth-api-patterns` | Auth, API Tokens, Webhooks | **1** |
| `feature/odysseus-cookbook-port` | Local Model Management | **2** |
| `feature/odysseus-calendar-port` | Kalender / CalDAV / ICS | **3** (parallel zu Cookbook) |
| `feature/odysseus-document-editor-port` | Dokumenteneditor | **4** |
| `feature/odysseus-image-editing-port` | Image Editing / Gallery | **4** (parallel zu Document) |
| `feature/odysseus-email-port` | E-Mail | **5** |
| `feature/odysseus-deep-research-port` | Deep Research | **5** (parallel zu Email) |
| `integration/odysseus-feature-porting-final` | Integration + QA | **6** |

Orchestrator-Docs-Branch (diese Matrix): `cursor/odysseus-feature-porting-orchestrator-200a`

---

## PR-Vorlage (Pflicht für jeden Feature-PR)

```md
## Odysseus Feature Port: <Bereich>

### Übernommenes Odysseus-Feature (inspiriert)
<Kurzbeschreibung der Odysseus-Funktion, auf die sich der Port bezieht>

### UWE-Änderungen
#### Packages / Dateien
- `packages/...`
- `apps/studio/...`

#### Datenmodelle / Migrationen
- `model X` — <Beschreibung>
- Migration: `YYYYMMDDHHMMSS_<name>`

#### API-Routen
| Method | Route | Beschreibung |
|--------|-------|--------------|
| GET | `/api/...` | ... |

#### UI-Flows
- `/route` — <Beschreibung>

### Tests
- [ ] `packages/.../foo.test.ts`
- [ ] `pnpm quality` grün

### Security / Privacy
- DM-only: <wie geschützt>
- Secrets: <wo verschlüsselt>
- Player Portal: <keine Regression>

### Offene TODOs
- [ ] ...

### Lizenznotiz
- [ ] Code kopiert (AGPL — nicht geplant)
- [x] Inspiriert von Odysseus UX/Architektur, nativ in UWE implementiert
- [ ] Gemischt (Details: …)
```

---

## Review-Checkliste (Orchestrator)

Für jeden eingehenden Subagent-PR:

1. **Lizenz:** Kein Odysseus/Python/AGPL-Code im Diff
2. **Architektur:** Package-Grenzen eingehalten (`@uwe/database`, `@uwe/auth`, …)
3. **Security:** `packages/security-tests` grün; keine Secrets im Client
4. **Player Safety:** `public-leak-scanner` + `visibility-security` unverändert grün
5. **AI Policy:** Kein Auto-Apply; Proposals für generierte Inhalte
6. **Migrationen:** SQLite-safe, dokumentiert in PR
7. **Scope:** Kein Drive-by-Refactor
8. **Tests:** Meaningful coverage für neue Services/Routes
9. **Konflikte:** Rebase auf aktuellen `main` + vorherige Feature-PRs

---

## Abhängigkeitsgraph (Merge)

```
main
 └── feature/odysseus-auth-api-patterns
      ├── feature/odysseus-cookbook-port
      │    ├── feature/odysseus-deep-research-port
      │    └── feature/odysseus-image-editing-port
      ├── feature/odysseus-calendar-port
      └── feature/odysseus-document-editor-port
           └── feature/odysseus-email-port
                └── integration/odysseus-feature-porting-final
```

**Rebase-Regel:** Jeder Subagent rebaset auf den jeweils neuesten Stand seiner Basis-Branch(es), bevor er PR öffnet.

---

## Konflikt-Hotspots

| Datei/Package | Betroffene Agents |
|---------------|-------------------|
| `packages/database/prisma/schema.prisma` | Alle |
| `packages/auth/src/security/route-policy.ts` | Auth, alle API-Features |
| `apps/studio/src/lib/admin-sidebar-nav.ts` | Alle UI-Features |
| `packages/security/src/security/guards.ts` | Auth, Mail, Research |
| `apps/studio/app/settings/page.tsx` | Cookbook, Mail, Calendar |

**Orchestrator-Regel:** Schema-Änderungen in **einer Migration pro PR**; bei Konflikten gewinnt Merge-Reihenfolge → späterer Agent rebaset.

---

## Geschätzte PR-Größen (Ziel)

| PR | Ziel-Zeilen (ca.) | Phasen |
|----|-------------------|--------|
| Auth/API | 800–1500 | P0 Token + Webhook |
| Cookbook | 1000–2000 | P0–P1 |
| Calendar | 800–1200 | P0 Grid + P1 credentials |
| Document | 1200–2500 | P0 Rich-Text |
| Image | 1000–1800 | P0 RTX + Gallery |
| Email | 1500–2500 | P1 IMAP |
| Research | 1200–2000 | P0–P1 |
| Integration | 200–500 | Docs + fixes only |

Kein PR > 3000 Zeilen ohne vorherige Aufteilung.

---

## Status-Tracking

Fortschritt wird in [PROGRESS.md](./PROGRESS.md) geführt.

Orchestrator aktualisiert nach jedem Merge:
- Matrix-Checkboxen
- PROGRESS.md
- Offene Risiken
