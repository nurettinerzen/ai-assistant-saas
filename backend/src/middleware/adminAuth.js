/**
 * Admin Authentication & Authorization Middleware
 * Handles admin access control, audit logging, and data sanitization
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Admin email whitelist
const ADMIN_EMAILS = [
  'nurettin@telyx.ai',
  'admin@telyx.ai'
];

/**
 * Check if user is admin and create/update AdminUser record
 */
export async function isAdmin(req, res, next) {
  try {
    const userEmail = req.user?.email;

    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    }

    // Get or create AdminUser record
    let admin = await prisma.adminUser.findUnique({
      where: { email: userEmail }
    });

    if (!admin) {
      // First login - auto create
      admin = await prisma.adminUser.create({
        data: {
          email: userEmail,
          name: req.user.name || userEmail.split('@')[0],
          role: 'SUPER_ADMIN'
        }
      });
    } else if (!admin.isActive) {
      return res.status(403).json({ error: 'Admin hesabı devre dışı' });
    }

    // Update last login
    await prisma.adminUser.update({
      where: { id: admin.id },
      data: { lastLogin: new Date() }
    });

    req.admin = admin;
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Yetkilendirme hatası' });
  }
}

/**
 * Role-based access control middleware
 * @param {Array<string>} allowedRoles - Array of allowed roles
 */
export function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(403).json({ error: 'Admin yetkisi gerekli' });
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return res.status(403).json({ error: 'Bu işlem için yetkiniz yok' });
    }

    next();
  };
}

/**
 * Log admin action to audit log
 * @param {Object} admin - Admin user object
 * @param {string} action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {string} entityType - Entity type (User, Business, Assistant, etc.)
 * @param {string} entityId - Entity ID
 * @param {Object} changes - Change details { field: { old: x, new: y } }
 * @param {Object} req - Express request object (optional, for IP/User-Agent)
 */
export async function logAuditAction(admin, action, entityType, entityId, changes = null, req = null) {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: admin.id,
        adminEmail: admin.email,
        action,
        entityType,
        entityId: String(entityId),
        changes,
        ipAddress: req?.ip || req?.connection?.remoteAddress || null,
        userAgent: req?.headers?.['user-agent'] || null
      }
    });
  } catch (error) {
    // Audit log error should not block main operation
    console.error('Audit log error:', error);
  }
}

/**
 * Sensitive fields that should never be exposed in API responses
 */
const SENSITIVE_FIELDS = {
  User: ['password'],
  Business: [
    'googleSheetsAccessToken',
    'googleSheetsRefreshToken',
    'whatsappAccessToken',
    'whatsappVerifyToken'
  ],
  CallLog: [
    'transcript',
    'transcriptText',
    'recordingUrl',
    'recordingDuration'
  ],
  Assistant: [], // systemPrompt will be truncated, not removed
  Subscription: [
    'stripeCustomerId',
    'iyzicoCardToken',
    'iyzicoPaymentId',
    'stripeSubscriptionId'
  ],
  Integration: ['credentials'],
  PhoneNumber: ['sipPassword'],
  EmailIntegration: ['credentials'],
  WebhookConfig: ['webhookSecret'],
  CrmWebhook: ['webhookSecret']
};

/**
 * Remove sensitive fields from an object
 * @param {Object} data - Data object to sanitize
 * @param {string} entityType - Entity type for field lookup
 * @returns {Object} Sanitized data
 */
export function sanitizeResponse(data, entityType) {
  if (!data) return data;

  const sensitiveFields = SENSITIVE_FIELDS[entityType] || [];

  if (Array.isArray(data)) {
    return data.map(item => sanitizeSingleObject(item, entityType, sensitiveFields));
  }

  return sanitizeSingleObject(data, entityType, sensitiveFields);
}

function sanitizeSingleObject(obj, entityType, sensitiveFields) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };

  // Remove sensitive fields
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      delete sanitized[field];
    }
  }

  // Special handling for systemPrompt - truncate instead of remove
  if (entityType === 'Assistant' && sanitized.systemPrompt) {
    sanitized.systemPromptPreview = sanitized.systemPrompt.substring(0, 200) +
      (sanitized.systemPrompt.length > 200 ? '...' : '');
    delete sanitized.systemPrompt;
  }

  return sanitized;
}

/**
 * Build changes object for audit log
 * @param {Object} oldData - Original data
 * @param {Object} newData - Updated data
 * @param {Array<string>} fields - Fields to compare
 * @returns {Object} Changes object
 */
export function buildChangesObject(oldData, newData, fields) {
  const changes = {};

  for (const field of fields) {
    if (newData[field] !== undefined && oldData[field] !== newData[field]) {
      changes[field] = {
        old: oldData[field],
        new: newData[field]
      };
    }
  }

  return Object.keys(changes).length > 0 ? changes : null;
}

export { ADMIN_EMAILS };
