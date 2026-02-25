# Secure Build and Deploy Runbook

## Objective
Provide repeatable, auditable, and secure build/deployment controls.

## Automated Pipelines
- `Deploy Readiness`: `.github/workflows/deploy-readiness.yml`
  - Executes `backend/deploy/production-deploy.sh --dry-run --skip-migrate`.
- `Security Ops Controls`: `.github/workflows/security-ops-controls.yml`
  - Runs config integrity digest checks.
  - Runs subdomain takeover scan.
  - Runs backup/restore drill script and uploads report artifacts.

## Deployment Script
- Primary script: `backend/deploy/production-deploy.sh`
- Security checks in script:
  - `set -euo pipefail` (fail fast)
  - required env validation (`NODE_ENV`, `JWT_SECRET`, `DATABASE_URL` unless skipped)
  - reproducible install (`npm ci --omit=dev`)
  - deterministic build (`npm run build`)
  - migration gate (`npm run migrate:deploy`)

## Release Procedure
1. Run deploy-readiness workflow on target branch.
2. Verify workflow success and no security control failures.
3. Confirm production env includes required security posture variables (`productionGuardrails`).
4. Execute deployment using the runbook script.
5. Validate health endpoint and core auth/admin flows post-deploy.

## Rollback Strategy
- Re-deploy previous known-good commit via same script.
- Re-apply schema state using Prisma migration history.
- Validate `/health` and critical API smoke checks.

## Evidence Artifacts
- GitHub Actions run logs for workflows.
- Uploaded JSON reports from `security-ops-controls`.
- Deployment logs from `production-deploy.sh`.
