# Trust Boundaries and Data Flows

## Purpose
This document defines the main trust boundaries, critical components, and high-risk data flows for SAQ evidence.

## System Components
- `Frontend (Next.js)`: Browser-facing UI (`frontend/`), cookie-based session usage, no client-side authz decisions.
- `Backend API (Express)`: Security enforcement point (`backend/src/server.js`, route middleware stack).
- `PostgreSQL (Prisma)`: Primary data store for user data, audit data, auth tokens/challenges.
- `External Providers`: Stripe/Iyzico, ElevenLabs, WhatsApp/Meta, Google, Microsoft, Shopify, webhook consumers.

## Trust Boundaries
- `Boundary A: Browser -> Backend API`
  - Untrusted client input enters at HTTP API.
  - Enforced controls: auth, RBAC, route protection checks, parameter pollution defense, rate limiting.
- `Boundary B: Backend -> Database`
  - Server-side service account access only.
  - Enforced controls: tenant scoping (`businessId` checks), audit writes, token lifecycle controls.
- `Boundary C: Backend -> Third-party APIs`
  - Outbound network calls to allowlisted provider endpoints.
  - Enforced controls: SSRF validation for user-supplied URLs and signed webhook verification.
- `Boundary D: Third-party callbacks -> Backend Webhook Endpoints`
  - Untrusted inbound events from providers.
  - Enforced controls: signature verification, header-based shared secrets, replay/expiry checks where applicable.

## Significant Data Flows
- `Authentication flow`: Register/login -> hashed password verify -> signed session token -> HttpOnly cookie.
- `Step-up/MFA flow`: Admin challenge code generation -> hashed challenge verification -> MFA claim in session.
- `Password reset/email verify flow`: Secure random token creation -> DB persistence with expiry -> single-use invalidation.
- `Invitation flow`: Token delivered in URL fragment (`#token`) -> backend body-based lookup/accept -> token nullification after use.
- `File upload flow`: Untrusted files routed to isolated upload dirs -> malware/type checks -> controlled processing.
- `Signed media flow`: Short-lived token issued server-side -> token passed in header -> business/user ownership checks.
- `Sensitive data access flow`: Customer/call-data reads -> audit middleware -> metadata-only security event logging.

## Supporting Controls
- Route protection gate: `backend/src/middleware/routeEnforcement.js`
- Auth/session middleware: `backend/src/middleware/auth.js`, `backend/src/security/sessionToken.js`
- Admin auth/MFA: `backend/src/middleware/adminAuth.js`, `backend/src/routes/auth.js`
- Parameter pollution defense: `backend/src/middleware/parameterPollution.js`
- SSRF controls: `backend/src/utils/ssrf-protection.js`
- Upload security controls: `backend/src/security/uploadSecurity.js`
- Security event/audit logging: `backend/src/middleware/securityEventLogger.js`, `backend/src/middleware/sensitiveDataAudit.js`
