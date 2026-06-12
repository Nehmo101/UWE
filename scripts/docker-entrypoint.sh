#!/bin/sh
set -eu

APP="${1:-portal}"
DB_PATH="${DATABASE_URL#file:}"
MIGRATIONS_DIR="/app/packages/database/prisma/migrations"
PRISMA_BIN="/app/node_modules/prisma/build/index.js"
TSX_BIN="/app/node_modules/tsx/dist/cli.mjs"
SEED_SCRIPT="/app/packages/database/prisma/seed.ts"
EMPTY_CHECK="/app/scripts/docker-db-empty-check.ts"
SEED_MARKER="${DB_PATH}.seeded"

mkdir -p "$(dirname "$DB_PATH")" /app/data/uploads /app/data/backups /app/exports

if [ -f "$PRISMA_BIN" ] && [ -d "$MIGRATIONS_DIR" ]; then
  # Safety net: copy the SQLite file before applying pending migrations, so a
  # broken migration can always be rolled back locally.
  if [ -f "$DB_PATH" ]; then
    if ! DATABASE_URL="$DATABASE_URL" node "$PRISMA_BIN" migrate status \
      --schema /app/packages/database/prisma/schema.prisma >/dev/null 2>&1; then
      PRE_MIGRATION_BACKUP="/app/data/backups/pre-migration-$(date +%Y%m%d-%H%M%S).db"
      echo "Pending migrations detected — creating local DB backup: $PRE_MIGRATION_BACKUP"
      cp "$DB_PATH" "$PRE_MIGRATION_BACKUP"
    fi
  fi

  echo "Running database migrations…"
  if ! DATABASE_URL="$DATABASE_URL" node "$PRISMA_BIN" migrate deploy \
    --schema /app/packages/database/prisma/schema.prisma; then
    echo "Prisma migrate failed — aborting startup"
    exit 1
  fi
fi

should_seed=false
seed_mode="${RUN_DB_SEED:-auto}"

case "$seed_mode" in
  false|0|no)
    should_seed=false
    ;;
  true|1|yes)
    if [ ! -f "$SEED_MARKER" ]; then
      should_seed=true
    fi
    ;;
  auto|"")
    if [ ! -f "$SEED_MARKER" ] && [ -f "$EMPTY_CHECK" ] && [ -f "$TSX_BIN" ]; then
      if DATABASE_URL="$DATABASE_URL" node "$TSX_BIN" "$EMPTY_CHECK"; then
        should_seed=true
      fi
    fi
    ;;
  *)
    echo "Unknown RUN_DB_SEED value: $seed_mode (expected auto, true, or false)"
    exit 1
    ;;
esac

if [ "$should_seed" = "true" ]; then
  echo "Seeding demo database (first start)…"
  if DATABASE_URL="$DATABASE_URL" node "$TSX_BIN" "$SEED_SCRIPT"; then
    touch "$SEED_MARKER"
    echo ""
    echo "Demo world ready. Portal login: dm@uwe.local / uwe-dev"
    echo "Studio: http://localhost:${STUDIO_PORT:-3000}"
    echo "Portal: http://localhost:${PORTAL_PORT:-3001}"
    echo ""
  else
    echo "Database seed failed — continuing without demo data"
  fi
fi

case "$APP" in
  studio)
    exec node /app/apps/studio/server.js
    ;;
  portal)
    exec node /app/apps/portal/server.js
    ;;
  *)
    echo "Unknown app: $APP"
    exit 1
    ;;
esac
