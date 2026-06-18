# Subagent-Aufgaben: Odysseus → UWE Feature-Portierung

Jeder Subagent arbeitet **eigenständig auf einem Feature-Branch** und liefert **einen PR** mit vollständiger PR-Vorlage (siehe [PR_STRATEGY.md](./PR_STRATEGY.md)).

**Globale Regeln für alle Subagents:**

1. Odysseus AGPL-3.0 — **kein Code kopieren** ([LICENSE.md](./LICENSE.md))
2. `pnpm quality` vor PR
3. DM-only / player_visible / public überall respektieren
4. AI-Outputs → Proposal/Review, nie Auto-Kanon
5. Secrets (SMTP, IMAP, CalDAV, API Keys) nie ans Frontend
6. Bestehende UWE-Packages erweitern, keine parallelen Systeme

---

## 0. Architecture & License Agent

**Branch:** Basis für alle — arbeitet auf `feature/odysseus-auth-api-patterns` (Auth-Fundament) oder liefert nur Docs/Reviews.

### Aufgaben

| ID | Task | Output |
|----|------|--------|
| A0 | Lizenz-Check bestätigen, AGPL-Compliance-Checkliste | `LICENSE.md` (done) |
| A1 | Architektur-Review: Package-Grenzen validieren | Kommentar in PR |
| A2 | Player-Safety-Invarianten pro Feature dokumentieren | Matrix-Abschnitt Security |
| A3 | Merge-Konflikt-Radar nach jedem Subagent-PR | `PROGRESS.md` Update |

### Akzeptanz

- Kein Odysseus-Code im Diff
- Security-Impact pro Feature bewertet

---

## 1. Cookbook Agent

**Branch:** `feature/odysseus-cookbook-port`  
**Basis:** `main` → nach Auth-PR optional rebasen

### Scope

- RTX Agent: Ollama model list/pull/delete
- `InferenceEndpoint` Prisma model + Service
- Hardware-Fit API (GPU/VRAM via Agent)
- Settings UI: Endpoints + Model Admin
- `/hardware` + `/admin/status` Integration

### Nicht im Scope

- vLLM/SGLang/HF Download
- Remote SSH Serve

### Tests

- `inference-endpoint-service.test.ts`
- RTX agent model tests
- Secret redaction in API responses

### Abhängigkeiten

- Auth-Agent (scoped tokens für Inference-API) — soft dependency

---

## 2. Deep Research Agent

**Branch:** `feature/odysseus-deep-research-port`  
**Basis:** nach Cookbook + Auth

### Scope

- `ResearchSession`, `ResearchSource` models
- Multi-step Research Job + SSE
- Search Provider Interface (Mock + SearXNG config)
- Report → AiProposal
- UI: `/worlds/[slug]/research`, Life-Brain Variante

### Nicht im Scope

- Synapse-Viz v1
- Cloud search ohne explicit opt-in

### Tests

- `research/privacy.test.ts` — DM-only filter
- `research-service.test.ts`
- Mock search provider for CI

### Abhängigkeiten

- Cookbook (Inference Endpoints)
- Auth (API tokens für headless research)

---

## 3. Document Editor Agent

**Branch:** `feature/odysseus-document-editor-port`

### Scope

- Rich-Text Editor für `rich_text` / `gm_note` blocks (TipTap o.ä.)
- `PageVersion` model + History UI
- AI Diff → Proposal workflow
- Export MD/HTML erweitern

### Nicht im Scope

- Code-Editor (Python/JS)
- PDF Annotate (→ Email-Agent P3)

### Tests

- `page-version.test.ts`
- Wikilink roundtrip nach rich-text save
- Visibility: gm_note blocked in portal export

### Abhängigkeiten

- Auth (soft)

---

## 4. Email Agent

**Branch:** `feature/odysseus-email-port`  
**Basis:** nach Document Editor (Attachment-Bridge)

### Scope

- `MailAccount`, `MailDraft` models
- IMAP read-only sync job
- Inbox UI Tab auf `/mail`
- Encrypted credentials server-side
- AI Summarize → Proposal

### Nicht im Scope

- Gmail OAuth v1
- Auto-send without review

### Tests

- IMAP mock tests
- Password never in API JSON
- Handout mail visibility check

### Abhängigkeiten

- Document Editor (attachment → asset)
- Calendar (reminder extraction) — optional P2

---

## 5. Calendar Agent

**Branch:** `feature/odysseus-calendar-port`

### Scope

- Month/Week grid UI
- Per-feed encrypted credentials
- CalDAV write-back (local feeds)
- GameSession ↔ CalendarEvent sync
- `calendar-service.test.ts`

### Nicht im Scope

- UWE as CalDAV server
- Public ICS mit DM-only events

### Tests

- iCal roundtrip
- SSRF for CalDAV URLs
- Session sync integration

### Abhängigkeiten

- Auth (credential encryption patterns)

---

## 6. Image Editing Agent

**Branch:** `feature/odysseus-image-editing-port`  
**Basis:** nach Cookbook (RTX /v1/images)

### Scope

- RTX Agent `POST /v1/images`
- Gallery block renderer
- `ImageEditorDraft` model
- Basic canvas: crop, rotate, annotate
- Inpaint job UI (mask)

### Nicht im Scope

- Full layer compositor
- Cloud inpaint for dm_only assets

### Tests

- `image-studio` extended tests
- AI policy: cloud blocked for dm_only
- RTX integration smoke

### Abhängigkeiten

- Cookbook (RTX image endpoint)
- Document Editor (embed images in handouts) — soft

---

## 7. Auth/API Agent

**Branch:** `feature/odysseus-auth-api-patterns`  
**Basis:** `main` — **MERGE FIRST**

### Scope

- `ApiToken` + `Webhook` Prisma models
- Token CRUD API + Admin UI
- Bearer `uwe_*` middleware neben Session
- Webhook delivery mit HMAC + SSRF guard
- Scopes: `studio:read`, `research:run`, `mail:send`, etc.

### Nicht im Scope

- 2FA (P2 follow-up)
- Player Portal bearer auth

### Tests

- `api-token.test.ts`
- `route-authz.test.ts` extensions
- Webhook SSRF tests

### Abhängigkeiten

- Keine — **Blocker für alle anderen**

---

## 8. QA/Integration Agent

**Branch:** `integration/odysseus-feature-porting-final`  
**Basis:** alle Feature-Branches gemerged (oder cherry-picked)

### Scope

- Rebase/merge all feature PRs
- `pnpm quality` full run
- Cross-feature smoke tests
- Player-leak-scanner
- Final status doc + risk register
- Update FEATURE_PORTING_MATRIX.md checkboxes

### Deliverables

- Integration PR mit Abschlussbericht
- Offene Risiken + nächste Schritte
- TEST_PLAN.md Ergänzungen (manual QA)

### Akzeptanz

- DoD aus FEATURE_PORTING_MATRIX.md erfüllt
- Keine regressions in `packages/security-tests`

---

## Parallelisierungs-Regeln

| Phase | Parallel erlaubt |
|-------|------------------|
| 1 | Nur Auth/API Agent |
| 2 | Cookbook + Calendar (nach Auth merge) |
| 3 | Document + Image (nach Cookbook) |
| 4 | Email (nach Document) + Research (nach Cookbook) |
| 5 | Nur QA/Integration |

**Nie parallel:** zwei Agents am selben Package (`packages/database`, `packages/auth`).

---

## Subagent-Prompt-Vorlage

```md
You are the <AGENT_NAME> for UWE Odysseus feature porting.

Read:
- docs/odysseus-feature-porting/LICENSE.md
- docs/odysseus-feature-porting/FEATURE_PORTING_MATRIX.md (section <N>)
- docs/odysseus-feature-porting/PR_STRATEGY.md

Branch: <branch-name>
Rules: No Odysseus code copy. Native TypeScript. pnpm quality before PR.

Implement only the P0/P1 items listed in the matrix for your area.
Report: changed files, migrations, API routes, UI flows, tests, security impact, license note.
```
