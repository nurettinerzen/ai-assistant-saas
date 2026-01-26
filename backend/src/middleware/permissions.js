/**
 * Role-Based Permission System
 * Defines permissions for each role and provides middleware for checking them
 */

// Permission definitions for each role
// SECURITY: Explicit permission list (NO wildcards)
// Each permission must be explicitly listed for auditability
export const ROLE_PERMISSIONS = {
  OWNER: [
    // Dashboard
    'dashboard:view',
    'dashboard:manage',

    // Assistants
    'assistants:view',
    'assistants:create',
    'assistants:edit',
    'assistants:delete',

    // Calls
    'calls:view',
    'calls:download',
    'calls:delete',

    // Campaigns
    'campaigns:view',
    'campaigns:create',
    'campaigns:control',
    'campaigns:delete',

    // Knowledge Base
    'knowledge:view',
    'knowledge:edit',
    'knowledge:delete',

    // Integrations
    'integrations:view',
    'integrations:connect',
    'integrations:disconnect',
    'integrations:configure',

    // Email
    'email:view',
    'email:send',
    'email:manage',
    'email:delete',

    // WhatsApp
    'whatsapp:view',
    'whatsapp:send',
    'whatsapp:manage',

    // Widget
    'widget:view',
    'widget:edit',
    'widget:manage',

    // Team Management
    'team:view',
    'team:invite',
    'team:edit',
    'team:delete',

    // Settings & Billing
    'settings:view',
    'settings:edit',
    'settings:manage',
    'billing:view',
    'billing:manage',

    // Analytics
    'analytics:view',
    'analytics:export',

    // Phone Numbers
    'phone:view',
    'phone:manage',

    // Voices
    'voices:view',
    'voices:manage',

    // Chat Widget
    'chat:view',
    'chat:manage',

    // Customer Data
    'customers:view',
    'customers:edit',
    'customers:delete',

    // Onboarding
    'onboarding:view',
    'onboarding:manage'
  ],

  MANAGER: [
    'dashboard:view',
    'assistants:view', 'assistants:create', 'assistants:edit',
    'calls:view', 'calls:download',
    'campaigns:view', 'campaigns:create', 'campaigns:control',
    'knowledge:view', 'knowledge:edit',
    'integrations:view',
    'email:view', 'email:send',
    'whatsapp:view',
    'widget:view', 'widget:edit',
    'settings:view', 'settings:edit',
    'team:view', 'team:invite',
    'analytics:view',
    'phone:view',
    'voices:view',
    'chat:view',
    'customers:view', 'customers:edit'
  ],

  STAFF: [
    'dashboard:view',
    'assistants:view',
    'calls:view', 'calls:download',
    'campaigns:view',
    'knowledge:view',
    'email:view', 'email:send',
    'whatsapp:view',
    'widget:view',
    'settings:view',
    'analytics:view',
    'phone:view',
    'voices:view',
    'chat:view',
    'customers:view'
  ]
};

/**
 * Check if a role has a specific permission
 * SECURITY: Explicit permission check (NO wildcard support)
 * @param {string} role - User role (OWNER, MANAGER, STAFF)
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export const hasPermission = (role, permission) => {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  // Direct permission check
  return permissions.includes(permission);
};

/**
 * Middleware to check if user has required permission
 * @param {string} permission - Required permission
 * @returns {Function} Express middleware
 */
export const checkPermission = (permission) => {
  return (req, res, next) => {
    // User should be set by authenticateToken middleware
    if (!req.user) {
      return res.status(401).json({ error: 'Kimlik doğrulama gerekli' });
    }

    const userRole = req.user.role;

    if (hasPermission(userRole, permission)) {
      return next();
    }

    return res.status(403).json({
      error: 'Bu işlem için yetkiniz yok',
      required: permission,
      yourRole: userRole
    });
  };
};

/**
 * Middleware to check if user has any of the required permissions
 * @param {string[]} permissions - Array of permissions (OR logic)
 * @returns {Function} Express middleware
 */
export const checkAnyPermission = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Kimlik doğrulama gerekli' });
    }

    const userRole = req.user.role;
    const hasAny = permissions.some(p => hasPermission(userRole, p));

    if (hasAny) {
      return next();
    }

    return res.status(403).json({
      error: 'Bu işlem için yetkiniz yok',
      required: permissions,
      yourRole: userRole
    });
  };
};

/**
 * Middleware to check if user has all required permissions
 * @param {string[]} permissions - Array of permissions (AND logic)
 * @returns {Function} Express middleware
 */
export const checkAllPermissions = (permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Kimlik doğrulama gerekli' });
    }

    const userRole = req.user.role;
    const hasAll = permissions.every(p => hasPermission(userRole, p));

    if (hasAll) {
      return next();
    }

    return res.status(403).json({
      error: 'Bu işlem için yetkiniz yok',
      required: permissions,
      yourRole: userRole
    });
  };
};

/**
 * Middleware to require OWNER role
 * @returns {Function} Express middleware
 */
export const requireOwner = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Kimlik doğrulama gerekli' });
  }

  if (req.user.role === 'OWNER') {
    return next();
  }

  return res.status(403).json({
    error: 'Bu işlem sadece işletme sahibi tarafından yapılabilir',
    yourRole: req.user.role
  });
};

/**
 * Middleware to require OWNER or MANAGER role
 * @returns {Function} Express middleware
 */
export const requireManagerOrAbove = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Kimlik doğrulama gerekli' });
  }

  if (['OWNER', 'MANAGER'].includes(req.user.role)) {
    return next();
  }

  return res.status(403).json({
    error: 'Bu işlem için yönetici yetkisi gerekli',
    yourRole: req.user.role
  });
};

export default {
  ROLE_PERMISSIONS,
  hasPermission,
  checkPermission,
  checkAnyPermission,
  checkAllPermissions,
  requireOwner,
  requireManagerOrAbove
};
