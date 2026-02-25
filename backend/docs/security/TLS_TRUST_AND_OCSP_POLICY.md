# TLS Trust and Revocation Policy

## Objective
Define mandatory transport security controls for production traffic.

## Production Policy
- TLS certificates must be issued by trusted public or explicitly trusted private CAs.
- Self-signed certs are allowed only for local/internal environments with explicit trust pinning.
- Certificate trust policy must be strict (`TLS_TRUST_POLICY=strict`).
- OCSP stapling must be enabled at the TLS termination layer (`OCSP_STAPLING_ENABLED=true`).

## Runtime Guardrail
- `backend/src/security/productionGuardrails.js` enforces production startup checks for:
  - `TLS_TRUST_POLICY`
  - `OCSP_STAPLING_ENABLED`
  - related security posture flags.

## Operational Enforcement
- TLS termination is handled by edge/load-balancer infrastructure.
- Infra configuration must reject unknown/untrusted certificate chains.
- Revocation checking (OCSP stapling) must be validated during infrastructure changes.

## Evidence
- Production env configuration values used by guardrail startup assertions.
- Infra-level TLS/OCSP settings from the deployment platform.
- Successful application startup in production with guardrail checks enabled.
