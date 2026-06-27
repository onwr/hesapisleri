#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL required" >&2
  exit 1
fi

if [[ "${ALLOW_PRODUCTION_BACKUP:-}" != "1" ]]; then
  if [[ "${DATABASE_URL}" == *"hesapisleri.com"* ]] || [[ "${APP_ENV:-}" == "production" ]]; then
    echo "Production backup blocked. Set ALLOW_PRODUCTION_BACKUP=1 to override intentionally." >&2
    exit 2
  fi
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="${BACKUP_DIR:-./backups}"
mkdir -p "$OUT_DIR"
FILE="$OUT_DIR/hesapisleri-${STAMP}.sql.gz"

pg_dump "$DATABASE_URL" --no-owner --no-acl | gzip > "$FILE"

if [[ ! -s "$FILE" ]]; then
  echo "Backup file empty" >&2
  exit 3
fi

echo "$FILE"
