#!/usr/bin/env bash
# Резервное копирование БД Life OS. Пример: infra/scripts/backup.sh ./backups
# В проде запускать по расписанию; хранить бэкапы вне основного хоста, шифровать at-rest.
set -euo pipefail

OUT_DIR="${1:-./backups}"
CONTAINER="${DB_CONTAINER:-life-os-db}"
DB_USER="${POSTGRES_USER:-lifeos}"
DB_NAME="${POSTGRES_DB:-lifeos}"

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$OUT_DIR/lifeos_${STAMP}.sql.gz"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
echo "Бэкап создан: $FILE ($(du -h "$FILE" | cut -f1))"
