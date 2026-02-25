# Subdomain Takeover Control

## Objective
Continuously detect dangling DNS records and takeover fingerprints for application-owned subdomains.

## Implementation
- Scanner script: `backend/scripts/subdomain-takeover-check.js`
- Command: `npm --prefix backend run security:subdomain-check`
- Input: `SUBDOMAIN_ASSETS` (comma-separated hostnames)

## Detection Logic
- DNS resolution checks (`resolveAny`).
- HTTP/HTTPS probe per host.
- Fingerprint matching for common takeover responses.
- Risk classification (`LOW`, `MEDIUM`, `HIGH`).

## Automation
- Executed by `.github/workflows/security-ops-controls.yml`.
- JSON report uploaded as build artifact:
  - `backend/tests/reports/subdomain-takeover-check-*.json`

## Response Procedure
1. Review report for `HIGH` risk findings.
2. Remove/repair stale DNS records or reclaim external service binding.
3. Re-run scanner and confirm zero high-risk hosts.
