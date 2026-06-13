# Granular Cursor Tasks for Auto Mode

Use this file with `AUTOMODE_SUBAGENTS.md` and `SUBAGENTS.md`.

## P00 Repo analysis

Agent: `repo-analyst`

### P00A Structure map

Read the repo and identify:

- framework
- routing
- database/ORM
- auth
- player preview
- settings
- tests
- deployment scripts

Output only analysis. Do not build features.

### P00B Risk map

Identify risk areas:

- auth/public access
- player-visible vs DM-only
- database migrations
- mail settings
- local AI endpoints
- long-running jobs

### P00C Implementation map

Map package P01-P13 to likely files and modules.

## P01 Production host baseline

Agent: `platform-hosting-agent`

### P01A ENV inventory

Find current env usage. Propose missing env keys for app URL, storage, backups, auth, mail, brain, inference.

### P01B Healthcheck

Add or extend healthcheck for app, database and storage.

### P01C Persistent paths

Make uploads, data, backups and exports configurable through env or existing settings.

### P01D Production docs

Document old-laptop production start and smoke checks.

## P02 Cloudflare and auth

Agent: `security-cloudflare-agent`

### P02A Proxy config

Support public app URL and trusted proxy mode.

### P02B Cookie/auth config

Ensure production cookies and login work behind Cloudflare Tunnel.

### P02C Studio protection

Warn or fail safely if Studio is public without auth in production.

### P02D Player Preview security

Check and harden Player Preview visibility rules.

## P03 Mail Center

Agent: `mail-agent`

### P03A SMTP service

Add server-side SMTP config and test-mail service.

### P03B Mail logs

Add message log/status/error model or reuse existing logging.

### P03C Templates and recipients

Add templates and recipient groups, especially players.

### P03D Compose flows

Prepare mail from recap, handout or player-preview link. Do not auto-send generated drafts.

## P04 Brain Store

Agent: `brain-store-agent`

### P04A Data model

Add BrainDocument, BrainChunk, BrainFact or equivalent existing-pattern models.

### P04B Visibility and source

Add visibility, source/origin, status and object references.

### P04C CRUD API

Add server APIs for basic create/read/update/list.

### P04D Basic UI

Add minimal admin/studio view for Brain entries.

## P05 Inference connector

Agent: `inference-agent`

### P05A Provider interface

Create provider interface and Mock provider.

### P05B Ollama provider

Add Ollama text generation client with healthcheck and timeout.

### P05C OpenAI-compatible provider

Add generic OpenAI-compatible provider for LM Studio.

### P05D Settings and status

Add env/settings support and status endpoint.

## P06 AI Run History

Agent: `ai-run-agent`

### P06A Model

Add AiRun and context/result/error structures.

### P06B Status flow

Implement pending, running, completed, failed, cancelled, applied, discarded.

### P06C API

Add create/list/read/update APIs.

### P06D UI

Add run list and run detail view.

## P07 Context Builder

Agent: `context-agent`

### P07A Interface

Create context builder service interface.

### P07B Source collection

Collect world, campaign, session, object links and Brain Store entries.

### P07C Visibility filter

Filter context by dm_only, player_visible and public.

### P07D Budget and debug

Limit context size and expose used context in run details.

## P08 Review and apply

Agent: `review-apply-agent`

### P08A Patch model

Add generated patch/proposal representation.

### P08B Apply log

Log apply/discard actions.

### P08C UI actions

Add accept, discard, copy and rerun actions.

### P08D Snapshot hook

Connect to existing versioning if available, otherwise prepare hook.

## P09 First Brain actions

Agent: `brain-actions-agent`

### P09A Session recap

Generate recap using context builder and AI run history.

### P09B Next session prep

Generate next-session prep as proposal.

### P09C Expand knowledge text

Generate improved knowledge text as proposal.

### P09D Optional actions

If stable, add canon check, handout draft, dungeon room fill and mail draft.

## P10 Embeddings

Agent: `embedding-agent`

### P10A Chunking

Chunk Brain documents deterministically.

### P10B Embedding provider

Add embedding provider interface and local provider integration.

### P10C Store vectors

Persist vectors in UWE storage/database.

### P10D Search and reindex

Add semantic search and reindex job.

## P11 Admin dashboard

Agent: `dashboard-agent`

### P11A Status sources

Collect app, database, storage, auth, mail, Brain Store, inference and jobs status.

### P11B Dashboard UI

Add protected admin/studio status page.

### P11C Diagnostics

Show actionable errors without exposing secrets.

## P12 Jobs

Agent: `jobs-agent`

### P12A Job model

Add or extend job status model.

### P12B Long tasks

Connect mail send, AI run, embeddings, reindex and backup jobs.

### P12C Retry and errors

Add retry where safe and clear error display.

### P12D Job UI

Add protected job list/status view.

## P13 QA and hardening

Agent: `qa-hardening-agent`

### P13A Test matrix

Add tests for auth, player visibility, mail, inference offline, context filter and review/apply.

### P13B Security review

Check no secrets in frontend responses or logs.

### P13C Production smoke guide

Document old laptop, Cloudflare, mail and RTX smoke tests.

### P13D Final report

Summarize changed files, env keys, tests, risks and next steps.
