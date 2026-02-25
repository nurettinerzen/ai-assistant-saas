#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

DRY_RUN=false
SKIP_MIGRATE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --skip-migrate) SKIP_MIGRATE=true ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: production-deploy.sh [--dry-run] [--skip-migrate]"
      exit 2
      ;;
  esac
done

required_env=(
  NODE_ENV
  JWT_SECRET
)

if [[ "${SKIP_MIGRATE}" != "true" ]]; then
  required_env+=("DATABASE_URL")
fi

for key in "${required_env[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required environment variable: ${key}"
    exit 1
  fi
done

echo "[deploy] Installing backend dependencies (reproducible npm ci)"
npm --prefix "${BACKEND_DIR}" ci --omit=dev

echo "[deploy] Building backend artifacts"
npm --prefix "${BACKEND_DIR}" run build

if [[ "${SKIP_MIGRATE}" != "true" ]]; then
  echo "[deploy] Applying production migrations"
  npm --prefix "${BACKEND_DIR}" run migrate:deploy
else
  echo "[deploy] Skipping migrations (--skip-migrate)"
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[deploy] Dry run completed successfully."
  exit 0
fi

echo "[deploy] Starting backend server"
exec npm --prefix "${BACKEND_DIR}" run start
