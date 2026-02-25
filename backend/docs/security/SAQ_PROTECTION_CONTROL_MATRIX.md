# Protection Control Matrix

This matrix maps classification levels to mandatory controls.

| Control Domain | L0_PUBLIC | L1_INTERNAL | L2_SENSITIVE | L3_REGULATED |
|---|---|---|---|---|
| AuthN/AuthZ | Optional | Required for write | Required | Required + step-up/MFA for privileged ops |
| At-rest protection | Standard storage | Encrypted storage | Encrypted storage | Encrypted storage + key-provider policy |
| In-transit protection | TLS | TLS | TLS strict trust policy | TLS strict trust policy + OCSP stapling |
| Logging | Basic ops logs | Redacted logs | Redacted + security event logs | Redacted + audited sensitive access only |
| Browser cache/storage | Allowed | Limited | `no-store` for sensitive responses | `no-store`, no sensitive browser storage |
| Retention | Business-defined | Business-defined | Policy-based | Privacy policy + legal retention schedule |
| Upload handling | Basic checks | Basic checks | Type/size checks | Type/size + malware scan + isolated perms |

## Implementation Evidence
- No-store headers: [`backend/src/server.js`](/Users/nurettinerzen/Desktop/ai-assistant-saas/backend/src/server.js)
- Frontend no sensitive storage: [`frontend/lib/api.js`](/Users/nurettinerzen/Desktop/ai-assistant-saas/frontend/lib/api.js)
- Step-up auth and admin MFA: [`backend/src/routes/auth.js`](/Users/nurettinerzen/Desktop/ai-assistant-saas/backend/src/routes/auth.js)
- Upload malware defenses: [`backend/src/security/uploadSecurity.js`](/Users/nurettinerzen/Desktop/ai-assistant-saas/backend/src/security/uploadSecurity.js)
- Sensitive access audit events: [`backend/src/middleware/securityEventLogger.js`](/Users/nurettinerzen/Desktop/ai-assistant-saas/backend/src/middleware/securityEventLogger.js)
