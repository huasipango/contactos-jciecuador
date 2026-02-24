#!/usr/bin/env bash
set -euo pipefail

ASSUME_YES="false"
if [[ "${1:-}" == "--yes" ]]; then
  ASSUME_YES="true"
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${DATABASE_URL_TEST:-}" ]]; then
  echo "Falta DATABASE_URL_TEST."
  exit 1
fi

if [[ -z "${DATABASE_URL_PRODUCTION:-${DATABASE_URL_PROD:-}}" ]]; then
  echo "Falta DATABASE_URL_PRODUCTION (o DATABASE_URL_PROD)."
  exit 1
fi

echo "Paso 1/3: aplicar migraciones en test"
bash "$ROOT_DIR/scripts/run-migrations.sh" test

echo "Paso 2/3: mostrar estado"
bash "$ROOT_DIR/scripts/migration-status.sh"

if [[ "$ASSUME_YES" != "true" ]]; then
  echo ""
  read -r -p "Aplicar migraciones pendientes a production? (yes/no): " answer
  if [[ "$answer" != "yes" ]]; then
    echo "Promoción cancelada."
    exit 0
  fi
fi

echo "Paso 3/3: aplicar migraciones en production"
bash "$ROOT_DIR/scripts/run-migrations.sh" production

echo "Promoción completada."
