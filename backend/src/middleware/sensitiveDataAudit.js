import { logSensitiveDataAccess } from './securityEventLogger.js';

/**
 * Audit middleware for sensitive data access.
 * Logs access metadata only (no payload/PII).
 */
export function auditSensitiveDataAccess(resourceType, getResourceId = null) {
  return async (req, _res, next) => {
    try {
      const resourceId = typeof getResourceId === 'function'
        ? getResourceId(req)
        : null;

      await logSensitiveDataAccess(req, {
        resourceType,
        resourceId,
        actorRole: req.userRole || null,
      });
    } catch (error) {
      console.error('Sensitive data audit log failed:', error.message);
      // Do not block the request on audit failure.
    }

    return next();
  };
}

export default {
  auditSensitiveDataAccess,
};
