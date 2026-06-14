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

- Admin-only (Studio-Netzwerk-Schutz + optional `STUDIO_API_TOKEN`).
- Tokens nur serverseitig.
- Prompts werden in DB gespeichert — keine Weltdaten/Brain an Cloud unless explizit im Prompt.

## GitHub Workflow

`.github/workflows/cursor-agent.yml` — `workflow_dispatch` mit Inputs:
- `prompt`, `title`, `job_id`, `branch_name`

## Bekannte Limits

- Cursor CLI muss im CI-Runner installiert sein, sonst Placeholder-Commit.
- Cursor Cloud API URL/Format kann sich ändern — ENV `CURSOR_CLOUD_API_URL` anpassbar.
- Lokaler Cursor CLI Provider erfordert manuelle Ausführung auf Dev-Rechner.
