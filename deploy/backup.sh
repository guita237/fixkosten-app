#!/usr/bin/env bash
# Tägliche Sicherung der Fixkosten-Datenbank (pg_dump aus dem db-Container, gzip, Rotation).
# Crontab auf dem Server (crontab -e):
#   30 3 * * * /pfad/zu/fixkosten-app/deploy/backup.sh >> /var/log/fixkosten-backup.log 2>&1
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$APP_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

cd "$APP_DIR"
COMPOSE=(docker compose)
if [ -f docker-compose.prod.yml ]; then
  COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)
fi
# DB_USER / DB_NAME aus .env lesen (Standardwerte wie in docker-compose.yml)
DB_USER="$(grep -E '^DB_USER=' .env | cut -d= -f2- || true)"
DB_NAME="$(grep -E '^DB_NAME=' .env | cut -d= -f2- || true)"
DB_USER="${DB_USER:-fixkosten}"
DB_NAME="${DB_NAME:-fixkosten}"

mkdir -p "$BACKUP_DIR"
FILE="$BACKUP_DIR/fixkosten-$(date +%Y-%m-%d_%H%M).sql.gz"
TMP="$FILE.part"

"${COMPOSE[@]}" exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --clean --if-exists | gzip -9 > "$TMP"

# Leere oder kaputte Sicherung nicht behalten
if ! gzip -t "$TMP" || [ "$(gzip -dc "$TMP" | head -c 100 | wc -c)" -lt 100 ]; then
  echo "$(date -Is) FEHLER: Sicherung leer oder beschädigt" >&2
  rm -f "$TMP"
  exit 1
fi
mv "$TMP" "$FILE"
chmod 600 "$FILE"

find "$BACKUP_DIR" -name 'fixkosten-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date -Is) OK $(basename "$FILE") ($(du -h "$FILE" | cut -f1))"
