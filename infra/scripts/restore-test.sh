#!/usr/bin/env bash
# Тест РЕАЛЬНОГО восстановления (а не только наличия бэкапа): дамп → восстановление в
# изолированную БД → проверка, что данные на месте → уборка. Запускать по расписанию.
set -euo pipefail

CONTAINER="${DB_CONTAINER:-life-os-db}"
DB_USER="${POSTGRES_USER:-lifeos}"
DB_NAME="${POSTGRES_DB:-lifeos}"
TEST_DB="lifeos_restore_test_$(date +%s)"

echo "1) Дамп основной БД…"
docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > /tmp/lifeos_restore.sql

echo "2) Создаю изолированную БД $TEST_DB и восстанавливаю…"
docker exec "$CONTAINER" createdb -U "$DB_USER" "$TEST_DB"
docker exec -i "$CONTAINER" psql -q -U "$DB_USER" -d "$TEST_DB" < /tmp/lifeos_restore.sql > /dev/null

echo "3) Проверяю восстановленные данные…"
SRC=$(docker exec "$CONTAINER" psql -tAc "select count(*) from users" -U "$DB_USER" -d "$DB_NAME")
DST=$(docker exec "$CONTAINER" psql -tAc "select count(*) from users" -U "$DB_USER" -d "$TEST_DB")
TABLES=$(docker exec "$CONTAINER" psql -tAc "select count(*) from information_schema.tables where table_schema='public'" -U "$DB_USER" -d "$TEST_DB")

echo "   таблиц восстановлено: $TABLES | users: источник=$SRC восстановлено=$DST"

echo "4) Уборка…"
docker exec "$CONTAINER" dropdb -U "$DB_USER" "$TEST_DB"
rm -f /tmp/lifeos_restore.sql

if [ "$SRC" = "$DST" ] && [ "$TABLES" -ge 10 ]; then
  echo "✓ Восстановление успешно проверено."
else
  echo "✗ Несовпадение при восстановлении!" >&2
  exit 1
fi
