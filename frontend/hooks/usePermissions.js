/**
 * usePermissions Hook
 * Provides role-based permission checking for the frontend
 */

import { useState, useEffect, useCallback } from 'react';

// Permission definitions - must match backend
const ROLE_PERMISSIONS = {
  OWNER: ['*'], // Full access
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
 * Hook for checking user permissions
 * @returns {Object} Permission utilities
 */
export function usePermissions() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to get user from localStorage
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to parse user from localStorage:', e);
    }
    setLoading(false);
  }, []);

  /**
   * Check if current user has a specific permission
   * @param {string} permission - Permission to check
   * @returns {boolean}
   */
  const can = useCallback((permission) => {
    if (!user || !user.role) return false;

    const permissions = ROLE_PERMISSIONS[user.role];
    if (!permissions) return false;

    // OWNER has wildcard access
    if (permissions.includes('*')) return true;

    return permissions.includes(permission);
  }, [user]);

  /**
   * Check if user has any of the given permissions
   * @param {string[]} permissions - Array of permissions (OR logic)
   * @returns {boolean}
   */
  const canAny = useCallback((permissions) => {
    return permissions.some(p => can(p));
  }, [can]);

  /**
   * Check if user has all of the given permissions
   * @param {string[]} permissions - Array of permissions (AND logic)
   * @returns {boolean}
   */
  const canAll = useCallback((permissions) => {
    return permissions.every(p => can(p));
  }, [can]);

  const isOwner = user?.role === 'OWNER';
  const isManager = user?.role === 'MANAGER';
  const isStaff = user?.role === 'STAFF';
  const role = user?.role;

  /**
   * Update user in state (call this after login/profile update)
   * @param {Object} newUser - Updated user object
   */
  const updateUser = useCallback((newUser) => {
    setUser(newUser);
    if (newUser) {
      localStorage.setItem('user', JSON.stringify(newUser));
    } else {
      localStorage.removeItem('user');
    }
  }, []);

  return {
    // Permission checks
    can,
    canAny,
    canAll,

    // Role checks
    isOwner,
    isManager,
    isStaff,
    role,

    // User state
    user,
    loading,
    updateUser,

    // Permission list (for debugging)
    permissions: user?.role ? ROLE_PERMISSIONS[user.role] : []
  };
}

/**
 * Get role display name in Turkish
 * @param {string} role - Role code
 * @returns {string} Display name
 */
export function getRoleDisplayName(role) {
  const names = {
    OWNER: 'İşletme Sahibi',
    MANAGER: 'Yönetici',
    STAFF: 'Personel'
  };
  return names[role] || role;
}

/**
 * Get role badge color
 * @param {string} role - Role code
 * @returns {string} Tailwind color class
 */
export function getRoleBadgeColor(role) {
  const colors = {
    OWNER: 'bg-purple-100 text-purple-800',
    MANAGER: 'bg-blue-100 text-blue-800',
    STAFF: 'bg-gray-100 text-gray-800'
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

export default usePermissions;
