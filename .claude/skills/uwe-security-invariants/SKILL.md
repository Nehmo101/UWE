---
name: uwe-security-invariants
description: UWE security and privacy invariants — content visibility (dm_only never reaches the Portal), RBAC, player-safe filtering, and local-first AI privacy. Use when touching auth, sessions, Portal/export output, permissions, AI provider routing, or brain context.
---

# UWE Security & Privacy Invariants

Non-negotiable rules. When a change touches any of these, verify the invariant and the guarding test.

## Content visibility

Das Modell seit der Portal-Freigabe (#85): Die **Welt-Zuordnung** entscheidet,
ob jemand überhaupt Inhalte sieht; der **Portal-Haken je Seite**
(`Page.portalReleased`) entscheidet, WELCHE Seiten im Spieler-Wiki auftauchen;
der **`:::dm`-Bereich** im Wikitext schneidet Zeilen aus Seiten, die es gibt.

| Sicht | Studio (DM) | Portal (Spieler) | Static export |
|-------|-------------|------------------|---------------|
| Seite mit `portalReleased: false` | Ja | **Nie** | **Nie** |
| Seite mit `portalReleased: true` | Ja | Ja (wenn Weltmitglied) | Ja |
| `:::dm … :::`-Bereich | Ja | **Nie** | **Nie** |

- Filtering ist zentral: `filterPagesForViewer` / `filterBlocksForViewer` /
  `redactDmSectionsForViewer` in **`packages/auth/src/permissions.ts`** —
  dort filtern, nie ad-hoc in Routen/Komponenten.
- **Fail-closed:** `filterPagesForViewer` wirft jede Seite heraus, deren
  Select `portalReleased` nicht mitgeladen hat. Selects für Viewer-Pfade
  nutzen `PORTAL_PAGE_SELECT` (`packages/database/src/portal-page-select.ts`)
  oder laden das Feld explizit — sonst verschwinden auch freigegebene Seiten.
- Jeder Lesepfad zählt: Listen, Direktlink, **Suche** (`searchForAuthContext`),
  **Graph**, **Timeline-Links**, **Wikilink-Auflösung** (gesperrtes Ziel =
  `broken`), **statischer Export** (`staticExportViewerContext`) und die
  MCP-Spielersicht (`preview=player` → `buildPlayerViewContext`).
- Recap-/Ereignis-Textfelder (`summaryPlayer`, `playerDecisions`, `openPlots`)
  sind Wikitext und laufen durch den DM-Schnitt.
- Guarding tests: `packages/security-tests/src/role-matrix.test.ts` (Suche,
  Graph, Timeline, Dashboard, Wiki-Export), `scripts/studio-route-auth.test.ts`,
  `scripts/security-leaks.test.ts`, `packages/security-tests/`.

## Auth imports

Import session symbols from `@uwe/auth` (`SESSION_COOKIE_NAME` from `session`, **not** `runtime-config`) — see the table in `AGENTS.md`.

## Local-first AI privacy

- **`personal_brain` (Life Brain) is hard local-only — never to cloud, not configurable.** `LOCAL_ONLY_CONTEXT_MODES = ["personal_brain"]`.
- DnD `brain` / `current_object` modes may use cloud when admin policy allows (W0 default: cloud allowed, Maschinenraum preferred).
- Validation lives in `packages/ai-brain/src/router/` (`validateProviderContextCombination`, `validateResolvedRouteForContext`).
- Maschinenraum/Ollama/LM Studio = LAN only, never behind Cloudflare Tunnel or public DNS.
- AI never writes canon without explicit DM Apply.

## CSP

CSP is environment-aware (`packages/auth/src/security-headers.ts`): dev adds `'unsafe-eval'`, production stays strict. **Do not weaken the production CSP without security review** (`.cursor/rules/security.mdc`).

Depth: `.cursor/skills/auth-rbac-visibility/SKILL.md`, `.cursor/skills/local-first-privacy/SKILL.md`, `SECURITY.md`.
