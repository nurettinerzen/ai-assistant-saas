# SAQ Validation Comments (All Marked Yes)

| # | Yes Comment |
|---|---|
| 1 | Trust boundaries, critical components, and major data flows are documented in `SAQ_TRUST_BOUNDARIES_AND_DATA_FLOWS.md`. |
| 2 | The frontend stack does not use deprecated client-side plugin technologies (Flash/ActiveX/Silverlight/Java applets). |
| 3 | Access control is enforced server-side using `authenticateToken`, RBAC, and admin middleware; client logic is not authoritative. |
| 4 | Sensitive assets are identified and classified into L0-L3 levels in `SAQ_DATA_CLASSIFICATION.md`. |
| 5 | Protection requirements per classification are defined and mapped in `SAQ_PROTECTION_CONTROL_MATRIX.md`. |
| 6 | Code loading is restricted by CSP and trusted checkout sanitization, and security config integrity hashing is enforced operationally. |
| 7 | Subdomain takeover protection is implemented with scheduled checks (`subdomain-takeover-check.js`) and CI artifacts. |
| 8 | Anti-automation controls are present via rate limiters on auth, API, webhook, invitation, and media endpoints. |
| 9 | Untrusted uploads are stored in isolated non-web-root directories with restricted permissions (`uploadSecurity.js`). |
| 10 | Untrusted uploads are scanned with malware/signature checks and ClamAV integration (required mode in production). |
| 11 | API URLs avoid exposing sensitive data; invitation/media token flows were moved to body/header/fragment. |
| 12 | Authorization is validated at URI/controller level and resource/tenant level (business ownership checks). |
| 13 | Only intended HTTP methods are exposed and protected by role/permission checks for privileged actions. |
| 14 | Build/deploy is secure and repeatable through automated workflows and deploy-readiness checks. |
| 15 | Automated redeploy and backup-restore drill controls exist with documented runbooks and generated evidence reports. |
| 16 | Authorized admins can verify integrity of security-relevant configuration via digest endpoint and baseline comparison. |
| 17 | Production debug exposure is disabled and error responses avoid leaking stack traces to clients. |
| 18 | `Origin` is used for CORS policy only and is not used as an authentication/authorization factor. |
| 19 | User-set passwords are enforced at minimum 12 characters with complexity requirements. |
| 20 | Initial activation/OOB secrets are securely random, short-lived, and not reused as long-term credentials. |
| 21 | Passwords are stored using salted one-way hashing (`bcrypt`). |
| 22 | No hardcoded/shared default admin credentials are present; admin bootstrap is explicit env allowlist based. |
| 23 | Lookup secrets are single-use (verification/reset/invitation/MFA challenge invalidation after use). |
| 24 | Out-of-band verification and reset tokens expire after 10 minutes. |
| 25 | Initial auth codes use secure random generation (6-digit OTP, >=20 bits entropy). |
| 26 | Logout/session revocation increments token version and invalidates active session tokens. |
| 27 | Password change/reset supports terminating all other sessions through token-version revocation. |
| 28 | User auth uses signed session tokens (cookie/Bearer) instead of static API keys. |
| 29 | Sensitive account operations require recent re-authentication (`requireRecentAuth`). |
| 30 | Access control rules are enforced in trusted backend middleware/service layers. |
| 31 | Authorization attributes are server-derived (token + DB), preventing client-side privilege manipulation. |
| 32 | Least privilege is enforced with RBAC/permission middleware and tenant scoping. |
| 33 | Access controls fail securely with default deny on auth/signature/config failures. |
| 34 | IDOR defenses are applied with business ownership and per-resource authorization checks. |
| 35 | Admin interfaces are protected by MFA step-up (`requireAdminMfa` + OTP challenge verification). |
| 36 | HTTP parameter pollution protection rejects duplicate query keys unless explicitly allowlisted. |
| 37 | Mail-related user input is sanitized against header injection and HTML-escaped before rendering. |
| 38 | The application avoids `eval`-style dynamic code execution paths for user input. |
| 39 | SSRF defenses validate protocol/domain/path/port and block private IP/DNS rebinding patterns. |
| 40 | Scriptable user SVG/upload risk is controlled by strict upload type allowlists and content sanitization controls. |
| 41 | Output encoding is context-appropriate (React escaping and explicit HTML escaping for template rendering). |
| 42 | JSON injection/eval risks are mitigated by safe JSON parsing/serialization and no expression evaluation paths. |
| 43 | LDAP is not used in this architecture, eliminating LDAP injection attack surface. |
| 44 | At-rest protection requirements are defined in classification/control matrix and enforced via production posture controls. |
| 45 | Constant-time comparison helpers are used for sensitive secret/signature comparisons. |
| 46 | Security-relevant IDs/tokens are generated with CSPRNG primitives (`crypto.randomBytes` / CUID). |
| 47 | Production posture enforces isolated key-provider policy (`vault`/`kms`) and prevents weak local key defaults. |
| 48 | Credential/payment/session secret logging is controlled via redaction and sanitized request logging patterns. |
| 49 | Sensitive API responses are protected from server-side caching using `no-store`/`no-cache` headers. |
| 50 | Browser storage avoids sensitive auth tokens; authentication is maintained in HttpOnly session cookies. |
| 51 | Sensitive values are sent in headers/body/URL fragment, not query parameters, for application-managed token flows. |
| 52 | Sensitive data access is audited via metadata-only security events without logging sensitive payload data. |
| 53 | TLS trust policy is explicitly defined and enforced for production posture. |
| 54 | Certificate revocation control (OCSP stapling) is required by production security posture policy. |
