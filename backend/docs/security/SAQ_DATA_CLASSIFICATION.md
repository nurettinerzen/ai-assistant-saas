# Data Classification Standard

## Version
- `SECURITY_DATA_CLASSIFICATION_VERSION`: `2026-02-25`
- Review cadence: quarterly and on major feature releases.
- Control owner: Security + Platform team.

## Classification Levels
- `L0_PUBLIC`: Public marketing/help content. No confidentiality requirement.
- `L1_INTERNAL`: Internal operational data not intended for public disclosure.
- `L2_SENSITIVE`: Customer/business operational data that requires strict access control.
- `L3_REGULATED`: PII, credentials, payment metadata, and data under privacy regulation.

## Asset Mapping
- `User.email`, `User.name`, `CallLog.transcript*`, `CustomerData.*`: `L3_REGULATED`
- OAuth tokens, webhook secrets, API credentials (`Business.*Token`, `Integration.credentials`): `L3_REGULATED`
- Business operational records (appointments, orders, inventory, callbacks): `L2_SENSITIVE`
- Product catalogs without PII: `L1_INTERNAL`
- Public docs/marketing pages: `L0_PUBLIC`

## Enforcement Linkage
- Password policy: [`backend/src/security/passwordPolicy.js`](/Users/nurettinerzen/Desktop/ai-assistant-saas/backend/src/security/passwordPolicy.js)
- Session revocation / cookie-only auth: [`backend/src/security/sessionToken.js`](/Users/nurettinerzen/Desktop/ai-assistant-saas/backend/src/security/sessionToken.js)
- Sensitive access audit events: [`backend/src/middleware/sensitiveDataAudit.js`](/Users/nurettinerzen/Desktop/ai-assistant-saas/backend/src/middleware/sensitiveDataAudit.js)
- Upload hardening and malware scan: [`backend/src/security/uploadSecurity.js`](/Users/nurettinerzen/Desktop/ai-assistant-saas/backend/src/security/uploadSecurity.js)
