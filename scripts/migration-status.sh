#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/scripts/migrations"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql no está disponible en PATH."
  exit 1
fi

if [[ ! -d "$MIGRATIONS_DIR" ]]; then
  echo "No existe directorio de migraciones: $MIGRATIONS_DIR"
  exit 1
fi

shopt -s nullglob
ALL_MIGRATIONS=("$MIGRATIONS_DIR"/*.sql)
TOTAL=${#ALL_MIGRATIONS[@]}

if [[ $TOTAL -eq 0 ]]; then
  echo "No hay migraciones para reportar."
  exit 0
fi

print_status() {
  local target="$1"
  local db_url="$2"

  echo ""
  echo "Target: $target"

  if [[ -z "$db_url" ]]; then
    echo "  URL no configurada."
    return
  fi

  psql "$db_url" -v ON_ERROR_STOP=1 -q -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  " >/dev/null

  local applied_count
  applied_count="$(psql "$db_url" -Atq -c "SELECT COUNT(*) FROM schema_migrations;")"
  echo "  Aplicadas: $applied_count/$TOTAL"

  local pending=0
  for migration_path in "${ALL_MIGRATIONS[@]}"; do
    local migration_name
    migration_name="$(basename "$migration_path")"
    local exists
    exists="$(psql "$db_url" -Atq -c "SELECT 1 FROM schema_migrations WHERE name = '$migration_name' LIMIT 1;")"
    if [[ "$exists" != "1" ]]; then
      pending=$((pending + 1))
      echo "  PENDIENTE: $migration_name"
    fi
  done

  if [[ $pending -eq 0 ]]; then
    echo "  Sin pendientes."
  fi
}

print_status "test" "${DATABASE_URL_TEST:-}"
print_status "production" "${DATABASE_URL_PRODUCTION:-${DATABASE_URL_PROD:-}}"
