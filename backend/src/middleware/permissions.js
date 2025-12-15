/**
 * Role-Based Permission System
 * Defines permissions for each role and provides middleware for checking them
 */

// Permission definitions for each role
export const ROLE_PERMISSIONS = {
  OWNER: ['*'], // Full access to everything
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
    'voices:view'
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
    'voices:view'
  ]
};

/**
 * Check if a role has a specific permission
 * @param {string} role - User role (OWNER, MANAGER, STAFF)
 * @param {string} permission - Permission to check
 * @returns {boolean}
 */
export const hasPermission = (role, permission) => {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return false;

  // OWNER has wildcard access
  if (permissions.includes('*')) return true;

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
