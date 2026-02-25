# Security Configuration Integrity Control

## Objective
Allow authorized administrators and automation to detect tampering in security-relevant configuration.

## Components
- Digest builder: `backend/src/security/configIntegrity.js`
- CLI check: `backend/scripts/security-config-integrity.js`
- Admin API endpoint: `GET /api/admin/security/config-integrity`
- Scheduled workflow: `.github/workflows/security-ops-controls.yml` (job `config-integrity`)

## Monitored Scope
- Selected security environment keys (auth, SSRF, upload, webhook, posture flags).
- Security-critical middleware and security module files.

## Baseline Comparison
- Optional baseline digest: `SECURITY_CONFIG_BASELINE_SHA256`.
- `--fail-on-mismatch` mode for CI/CD blocking behavior.

## Operational Use
1. Generate initial digest and store as baseline in secure secret storage.
2. Run scheduled integrity checks.
3. Investigate any mismatch before release.
