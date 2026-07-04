#!/bin/bash
# UWE SessionStart harness for Claude Code on the web.
#
# Guarantees a fresh remote container is lint / typecheck / test / build ready
# before the agent loop starts, so Claude never trips over missing deps or a
# missing Prisma client. Runs synchronously (session waits until it finishes).
#
# Idempotent — safe to re-run on every session:
#   * pnpm install --frozen-lockfile   → no-op when node_modules already match
#   * db:generate                      → regenerates the Prisma client (cheap)
#   * migrate deploy                   → only applies pending migrations
#   * db:seed                          → seed-tracker skips already-applied seeds
#
# Canonical setup docs: AGENTS.md ("Cursor Cloud specific instructions") and
# CLAUDE.md ("Lokale DB einrichten").
set -euo pipefail

# Only run in the remote (Claude Code on the web) environment. Local sessions
# manage their own setup and should not pay the install cost on every start.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

# Human-readable progress goes to stderr so stdout stays clean for the single
# JSON object we emit at the end (additionalContext for the model).
log() { printf '[uwe-harness] %s\n' "$*" >&2; }

# --- Required steps (failure aborts the hook) ---------------------------------

log "1/4 Installing dependencies (pnpm install --frozen-lockfile)…"
pnpm install --frozen-lockfile 1>&2

log "2/4 Generating Prisma client (@uwe/database db:generate)…"
pnpm --filter @uwe/database db:generate 1>&2

# --- Best-effort dev database (never blocks the session) ----------------------
# lint / typecheck / build only need the steps above; the seeded SQLite DB is
# for running the apps and DB-backed tests. A hiccup here must not kill startup.
DB_STATUS="skipped"
setup_db() {
  cp -n .env.example .env 2>/dev/null || true         # never overwrite an existing .env
  pnpm --filter @uwe/database db:deploy 1>&2 \
    && pnpm --filter @uwe/database db:seed 1>&2
}

log "3/4 Preparing local SQLite dev database (best effort)…"
if setup_db; then
  DB_STATUS="ready"
  log "    Dev DB ready — login dm@uwe.local / uwe-dev (SQLite at packages/database/data/uwe.db)."
else
  DB_STATUS="incomplete"
  log "    WARN: dev DB setup incomplete. Lint/typecheck/build still work; run"
  log "          'pnpm --filter @uwe/database db:deploy && ... db:seed' manually if needed."
fi

log "4/4 Workspace ready."

# --- Inject durable guidance into the model's context -------------------------
DB_NOTE="Dev SQLite DB seeded (login dm@uwe.local / uwe-dev)."
if [ "$DB_STATUS" != "ready" ]; then
  DB_NOTE="Dev DB not seeded this session (setup was $DB_STATUS); run 'pnpm --filter @uwe/database db:deploy && pnpm --filter @uwe/database db:seed' before app/e2e work."
fi

cat <<JSON
{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"UWE workspace is ready: dependencies installed and Prisma client generated. ${DB_NOTE} Quality gate: run 'pnpm quality:quiet' (full main gate) or 'pnpm ci:light' (faster PR mirror); on failure read only the last ~60 lines. Golden rules: business logic lives in packages/, never in Next.js route handlers or components; dm_only content must never reach the Portal; new files max 700 lines and never raise scripts/file-size-baseline.json. Skill index: .cursor/skills/manifest.json; service map: docs/engineering/database-service-map.md."}}
JSON
