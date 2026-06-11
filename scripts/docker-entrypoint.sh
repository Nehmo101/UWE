#!/bin/sh
set -eu

APP="${1:-portal}"
DB_PATH="${DATABASE_URL#file:}"
MIGRATIONS_DIR="/app/packages/database/prisma/migrations"
PRISMA_BIN="/app/node_modules/prisma/build/index.js"

mkdir -p "$(dirname "$DB_PATH")" /app/data/uploads /app/data/backups /app/exports

if [ -f "$PRISMA_BIN" ] && [ -d "$MIGRATIONS_DIR" ]; then
  echo "Running database migrations…"
  DATABASE_URL="$DATABASE_URL" node "$PRISMA_BIN" migrate deploy \
    --schema /app/packages/database/prisma/schema.prisma || {
      echo "Prisma migrate failed — continuing startup"
    }
fi

if [ "${RUN_DB_SEED:-false}" = "true" ] && [ ! -f "${DB_PATH}.seeded" ]; then
  echo "Seeding demo database…"
  if DATABASE_URL="$DATABASE_URL" node /app/node_modules/tsx/dist/cli.mjs /app/packages/database/prisma/seed.ts; then
    touch "${DB_PATH}.seeded"
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
