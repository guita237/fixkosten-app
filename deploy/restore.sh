#!/usr/bin/env bash
# Sicherung zurückspielen:  ./deploy/restore.sh backups/fixkosten-2026-11-20_0330.sql.gz
# Überschreibt die aktuelle Datenbank! Die API wird währenddessen gestoppt.
set -euo pipefail

if [ $# -ne 1 ] || [ ! -f "$1" ]; then
  echo "Aufruf: $0 <backup.sql.gz>" >&2
  exit 1
fi
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FILE="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
cd "$APP_DIR"
COMPOSE=(docker compose)
if [ -f docker-compose.prod.yml ]; then
  COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
fi
DB_USER="$(grep -E '^DB_USER=' .env | cut -d= -f2- || true)"
DB_NAME="$(grep -E '^DB_NAME=' .env | cut -d= -f2- || true)"
DB_USER="${DB_USER:-fixkosten}"
DB_NAME="${DB_NAME:-fixkosten}"

read -r -p "Datenbank $DB_NAME mit $(basename "$FILE") überschreiben? [ja/N] " answer
if [ "$answer" != "ja" ]; then
  echo "Abgebrochen."
  exit 0
fi

"${COMPOSE[@]}" stop api
gzip -dc "$FILE" | "${COMPOSE[@]}" exec -T db psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q
"${COMPOSE[@]}" start api
echo "Wiederhergestellt aus $(basename "$FILE")"
