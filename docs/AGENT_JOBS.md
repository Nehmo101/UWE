# Agent Jobs — Cursor / GitHub Actions Integration

UWE kann Entwicklungs-Prompts aus dem Admin-Portal als Agent-Jobs absetzen.

## Architektur

```
Admin-Portal (/admin/agent-jobs)
    → DevAgentJob (SQLite)
    → Job Queue (type: agent_job)
    → dispatchAgentJob()
        ├── GitHub Actions workflow_dispatch (cursor-agent.yml)
        ├── Cursor Cloud Agents API (optional)
        └── Cursor CLI lokal (manuell)
    → Branch + Draft-PR (kein Auto-Merge)
```

## ENV-Variablen

| Variable | Beschreibung |
|----------|--------------|
| `AGENT_JOBS_ENABLED` | `true` aktiviert Feature |
| `AGENT_JOBS_GITHUB_REPO` | `owner/repo` |
| `AGENT_JOBS_GITHUB_WORKFLOW` | Default: `cursor-agent.yml` |
| `GITHUB_TOKEN` / `AGENT_JOBS_GITHUB_TOKEN` | PAT mit `actions:write`, `contents:write` |
| `AGENT_JOBS_DEFAULT_PROVIDER` | `github_actions` \| `cursor_cloud` \| `cursor_cli_local` |
| `AGENT_JOBS_AUTO_MERGE` | **Immer `false` lassen** |
| `CURSOR_CLOUD_API_KEY` | Optional für Cursor Cloud Agents |
| `CURSOR_API_KEY` | Für Cursor CLI in GitHub Actions |

## Nutzung

1. ENV setzen und Studio neu starten.
2. `/admin/agent-jobs` öffnen.
3. Titel + Prompt eingeben, Provider wählen.
4. Job erscheint in `/jobs` und als `DevAgentJob`.
5. GitHub Actions erstellt Branch + Draft-PR.
6. Manuell reviewen und mergen — **kein Auto-Merge**.

## Sicherheit

- Admin-only: Session-Login (`owner`/`admin`) + optional `STUDIO_API_TOKEN` / Cloudflare Access.
- Tokens nur serverseitig.
- **Kein automatischer Brain-/Welt-Kontext** — nur der manuell eingegebene Prompt wird an GitHub Actions oder Cursor Cloud gesendet.
- Prompts werden in SQLite und ggf. in GitHub-Actions-Logs gespeichert — **keine Secrets, API-Keys, Passwörter oder Weltdaten einfügen**.
- `AGENT_JOBS_AUTO_MERGE` muss `false` bleiben.

## GitHub Workflow

`.github/workflows/cursor-agent.yml` — `workflow_dispatch` mit Inputs:
- `prompt`, `title`, `job_id`, `branch_name`

Der Workflow pusht den Branch und öffnet ein Draft-PR — **ohne** `pnpm ci:light` im Agent-Job (das würde ~9 Min doppelt laufen). Das geöffnete PR wird von `pr-check.yml` geprüft; das volle Gate läuft nach Merge auf `main` via `ci.yml`.

**Bevorzugt lokal/self-hosted:** `AGENT_JOBS_DEFAULT_PROVIDER=cursor_cli_local` (oder Self-hosted Runner) statt `github_actions` für routinemäßige Agent-Jobs.

## Agent Quality Gate

Alle Agenten (Cloud, CLI, Subagents) müssen die Checks lokal bestehen, bevor sie pushen:

```bash
pnpm install --frozen-lockfile
pnpm quality
```

GitHub-Actions-Agent-Jobs nutzen das leichtere `pnpm ci:light`; Entwickler und Cloud-Agenten sollten vor dem Merge weiterhin `pnpm quality` lokal ausführen.

Siehe `AGENTS.md` und `.cursor/skills/ci-quality-gate/` für wiederkehrende Fehlermuster (unused imports, Auth-Import-Pfade).

## Bekannte Limits

- Cursor CLI muss im CI-Runner installiert sein, sonst Placeholder-Commit.
- Cursor Cloud API URL/Format kann sich ändern — ENV `CURSOR_CLOUD_API_URL` anpassbar.
- Lokaler Cursor CLI Provider erfordert manuelle Ausführung auf Dev-Rechner.
