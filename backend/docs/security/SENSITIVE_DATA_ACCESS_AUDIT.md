# Sensitive Data Access Audit Control

## Objective
Audit access to sensitive customer/call records without logging sensitive payload values.

## Implementation
- Middleware: `backend/src/middleware/sensitiveDataAudit.js`
- Event logger: `backend/src/middleware/securityEventLogger.js` (`SENSITIVE_DATA_ACCESS`)
- Applied routes:
  - `backend/src/routes/customerData.js`
  - `backend/src/routes/callLogs.js`

## Logged Fields
- Actor metadata: `userId`, `businessId`, role.
- Request metadata: endpoint, method, IP, user-agent.
- Resource metadata: `resourceType`, `resourceId`.

## Explicitly Not Logged
- Raw customer payload values.
- Raw call transcript/audio content.
- Credentials/session tokens.

## Operational Use
- Security events are queryable for investigations and compliance evidence.
- Logging failures are non-blocking but reported to stderr for remediation.
