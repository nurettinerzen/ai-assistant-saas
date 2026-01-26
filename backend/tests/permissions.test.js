/**
 * Permission System Tests
 * Ensures permission integrity and prevents wildcards
 */

import { describe, it, expect } from '@jest/globals';
import { ROLE_PERMISSIONS, hasPermission } from '../src/middleware/permissions.js';

describe('Permission System Security', () => {
  it('should NOT allow wildcard permissions', () => {
    Object.entries(ROLE_PERMISSIONS).forEach(([role, permissions]) => {
      const hasWildcard = permissions.includes('*');
      expect(hasWildcard).toBe(false);
      if (hasWildcard) {
        throw new Error(`SECURITY: Role ${role} has wildcard permission`);
      }
    });
  });

  it('should have explicit permissions for all roles', () => {
    expect(ROLE_PERMISSIONS.OWNER.length).toBeGreaterThan(20);
    expect(ROLE_PERMISSIONS.MANAGER.length).toBeGreaterThan(10);
    expect(ROLE_PERMISSIONS.STAFF.length).toBeGreaterThan(5);
  });

  it('should enforce permission hierarchy (OWNER > MANAGER > STAFF)', () => {
    const ownerPerms = new Set(ROLE_PERMISSIONS.OWNER);
    const managerPerms = new Set(ROLE_PERMISSIONS.MANAGER);
    const staffPerms = new Set(ROLE_PERMISSIONS.STAFF);

    // All MANAGER permissions should be subset of OWNER
    ROLE_PERMISSIONS.MANAGER.forEach(perm => {
      expect(ownerPerms.has(perm)).toBe(true);
    });

    // All STAFF permissions should be subset of MANAGER
    ROLE_PERMISSIONS.STAFF.forEach(perm => {
      expect(managerPerms.has(perm) || ownerPerms.has(perm)).toBe(true);
    });
  });

  it('should check permissions correctly', () => {
    expect(hasPermission('OWNER', 'team:delete')).toBe(true);
    expect(hasPermission('MANAGER', 'team:delete')).toBe(false);
    expect(hasPermission('STAFF', 'team:delete')).toBe(false);

    expect(hasPermission('OWNER', 'billing:manage')).toBe(true);
    expect(hasPermission('MANAGER', 'billing:manage')).toBe(false);

    expect(hasPermission('MANAGER', 'team:invite')).toBe(true);
    expect(hasPermission('STAFF', 'team:invite')).toBe(false);
  });

  it('should return false for non-existent permissions', () => {
    expect(hasPermission('OWNER', 'nonexistent:permission')).toBe(false);
    expect(hasPermission('MANAGER', 'superadmin:access')).toBe(false);
  });

  it('should return false for invalid roles', () => {
    expect(hasPermission('INVALID_ROLE', 'dashboard:view')).toBe(false);
    expect(hasPermission(null, 'dashboard:view')).toBe(false);
    expect(hasPermission(undefined, 'dashboard:view')).toBe(false);
  });
});

describe('Permission Format Validation', () => {
  it('should follow namespace:action format', () => {
    Object.entries(ROLE_PERMISSIONS).forEach(([role, permissions]) => {
      permissions.forEach(perm => {
        expect(perm).toMatch(/^[a-z]+:[a-z]+$/);
        if (!perm.match(/^[a-z]+:[a-z]+$/)) {
          throw new Error(`Invalid permission format in ${role}: ${perm}`);
        }
      });
    });
  });

  it('should have no duplicate permissions', () => {
    Object.entries(ROLE_PERMISSIONS).forEach(([role, permissions]) => {
      const uniquePerms = new Set(permissions);
      expect(uniquePerms.size).toBe(permissions.length);
    });
  });
});
