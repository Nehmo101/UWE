# Cursor Subagents for UWE

Use this with the Cursor Subagents feature: https://cursor.com/de/docs/subagents

## Shared context

UWE runs on the old laptop and owns persistent data. The RTX PC is only used for local model execution. Cloudflare points to UWE, not to local model servers.

## Roles

- `repo-analyst`: repo analysis and risk map. Task P00.
- `platform-hosting-agent`: production host, env, storage, health checks. Task P01.
- `security-cloudflare-agent`: Cloudflare, auth, cookies, Player Preview. Task P02.
- `mail-agent`: SMTP, mail center, templates, recipient groups, logs. Task P03.
- `brain-store-agent`: Brain documents, chunks, facts, visibility, sources. Task P04.
- `inference-agent`: Ollama, LM Studio, OpenAI-compatible provider. Task P05.
- `ai-run-agent`: AI run history and run detail view. Task P06.
- `context-agent`: context builder, visibility filters, context budget. Task P07.
- `review-apply-agent`: generated patches, apply log, undo hooks. Task P08.
- `brain-actions-agent`: first brain actions. Task P09.
- `embedding-agent`: chunking, embeddings, vector search. Task P10.
- `dashboard-agent`: admin status dashboard. Task P11.
- `jobs-agent`: job queue and retries. Task P12.
- `qa-hardening-agent`: tests and final hardening. Task P13.

Detailed steps are in `GRANULAR_TASKS.md`.
