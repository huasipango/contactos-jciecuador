#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
if [[ "$TARGET" != "test" && "$TARGET" != "production" ]]; then
  echo "Uso: bash scripts/run-migrations.sh <test|production>"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/scripts/migrations"

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "No existe el directorio de migraciones: $MIGRATIONS_DIR"
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql no está disponible en PATH. Instala client de PostgreSQL o agrega libpq al PATH."
  exit 1
fi

if [[ "$TARGET" == "test" ]]; then
  DATABASE_URL="${DATABASE_URL_TEST:-}"
else
  DATABASE_URL="${DATABASE_URL_PRODUCTION:-${DATABASE_URL_PROD:-}}"
fi

if [[ -z "$DATABASE_URL" ]]; then
  echo "Falta DATABASE_URL para target=$TARGET."
  if [[ "$TARGET" == "test" ]]; then
    echo "Define DATABASE_URL_TEST."
  else
    echo "Define DATABASE_URL_PRODUCTION (o DATABASE_URL_PROD)."
  fi
  exit 1
fi

echo "Aplicando migraciones en target=$TARGET"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"

shopt -s nullglob
MIGRATION_FILES=("$MIGRATIONS_DIR"/*.sql)

if [[ ${#MIGRATION_FILES[@]} -eq 0 ]]; then
  echo "No hay migraciones en $MIGRATIONS_DIR"
  exit 0
fi

for migration_path in "${MIGRATION_FILES[@]}"; do
  migration_name="$(basename "$migration_path")"
  already_applied="$(psql "$DATABASE_URL" -Atq -c "SELECT 1 FROM schema_migrations WHERE name = '$migration_name' LIMIT 1;")"

  if [[ "$already_applied" == "1" ]]; then
    echo "SKIP  $migration_name"
    continue
  fi

  echo "RUN   $migration_name"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$migration_path"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (name) VALUES ('$migration_name');"
  echo "DONE  $migration_name"
done

echo "Migraciones completadas en target=$TARGET"
