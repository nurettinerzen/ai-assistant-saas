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

# ── Build-time env (always required) ──
build_env=(
  NODE_ENV
)

# ── Runtime env (only required for real deploy, skipped in dry-run) ──
runtime_env=(
  JWT_SECRET
)

# ── Migration env (only when migrations are not skipped) ──
if [[ "${SKIP_MIGRATE}" != "true" ]]; then
  build_env+=("DATABASE_URL")
fi

echo "[deploy] Mode: $(${DRY_RUN} && echo 'DRY-RUN (build-only)' || echo 'FULL DEPLOY')"
echo "[deploy] Checking build-time env: ${build_env[*]}"

for key in "${build_env[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required build-time variable: ${key}"
    exit 1
  fi
done

if [[ "${DRY_RUN}" != "true" ]]; then
  echo "[deploy] Checking runtime env: ${runtime_env[*]}"
  for key in "${runtime_env[@]}"; do
    if [[ -z "${!key:-}" ]]; then
      echo "Missing required runtime variable: ${key}"
      exit 1
    fi
  done
else
  echo "[deploy] Skipping runtime env check (dry-run)"
fi

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
