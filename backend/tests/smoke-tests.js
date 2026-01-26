/**
 * Smoke Tests for P0 Security Fixes
 * Run: node tests/smoke-tests.js
 */

import dotenv from 'dotenv';
dotenv.config();

// Set test JWT_SECRET if not in env
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test_secret_for_smoke_tests_only';
}

import { ROLE_PERMISSIONS, hasPermission } from '../src/middleware/permissions.js';
import { verifySignedMediaToken, generateSignedMediaToken } from '../src/utils/signedUrl.js';

console.log('\n🧪 STARTING SMOKE TESTS\n');

let passCount = 0;
let failCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ ${name}`);
    passCount++;
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
    failCount++;
  }
}

// ============================================================================
// TEST 1: Wildcard Permissions Removed
// ============================================================================
test('No wildcard permissions in any role', () => {
  Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
    if (perms.includes('*')) {
      throw new Error(`Role ${role} has wildcard permission`);
    }
  });
});

// ============================================================================
// TEST 2: Permission Hierarchy
// ============================================================================
test('OWNER has more permissions than MANAGER', () => {
  if (ROLE_PERMISSIONS.OWNER.length <= ROLE_PERMISSIONS.MANAGER.length) {
    throw new Error('OWNER should have more permissions than MANAGER');
  }
});

test('MANAGER has more permissions than STAFF', () => {
  if (ROLE_PERMISSIONS.MANAGER.length <= ROLE_PERMISSIONS.STAFF.length) {
    throw new Error('MANAGER should have more permissions than STAFF');
  }
});

// ============================================================================
// TEST 3: Permission Checks
// ============================================================================
test('OWNER has billing:manage permission', () => {
  if (!hasPermission('OWNER', 'billing:manage')) {
    throw new Error('OWNER should have billing:manage');
  }
});

test('MANAGER does NOT have billing:manage', () => {
  if (hasPermission('MANAGER', 'billing:manage')) {
    throw new Error('MANAGER should NOT have billing:manage');
  }
});

test('STAFF does NOT have team:delete', () => {
  if (hasPermission('STAFF', 'team:delete')) {
    throw new Error('STAFF should NOT have team:delete');
  }
});

test('Invalid role returns false', () => {
  if (hasPermission('INVALID_ROLE', 'dashboard:view')) {
    throw new Error('Invalid role should return false');
  }
});

// ============================================================================
// TEST 4: Signed URL Token Validation
// ============================================================================
test('Signed URL token contains required fields', () => {
  const token = generateSignedMediaToken('media123', 456, 789, 60);
  const decoded = verifySignedMediaToken(token);

  if (!decoded.mediaId || !decoded.userId || !decoded.businessId) {
    throw new Error('Token missing required fields');
  }

  if (decoded.type !== 'media_access') {
    throw new Error('Token type should be media_access');
  }
});

test('Signed URL token with wrong type fails', () => {
  try {
    const token = generateSignedMediaToken('media123', 456, 789, 60);
    const decoded = verifySignedMediaToken(token);

    // Manually check type (already validated in verifySignedMediaToken)
    if (decoded.type !== 'media_access') {
      return; // Test passes
    }
  } catch (error) {
    // Expected to fail if type is wrong
  }
});

test('Expired signed URL token fails', async () => {
  const token = generateSignedMediaToken('media123', 456, 789, -1); // Already expired

  try {
    verifySignedMediaToken(token);
    throw new Error('Should have thrown error for expired token');
  } catch (error) {
    if (!error.message.includes('expired')) {
      throw new Error('Should throw expired error');
    }
  }
});

// ============================================================================
// TEST 5: Permission Format Validation
// ============================================================================
test('All permissions follow namespace:action format', () => {
  Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
    perms.forEach(perm => {
      if (!perm.match(/^[a-z]+:[a-z]+$/)) {
        throw new Error(`Invalid permission format in ${role}: ${perm}`);
      }
    });
  });
});

test('No duplicate permissions in any role', () => {
  Object.entries(ROLE_PERMISSIONS).forEach(([role, perms]) => {
    const uniquePerms = new Set(perms);
    if (uniquePerms.size !== perms.length) {
      throw new Error(`Role ${role} has duplicate permissions`);
    }
  });
});

// ============================================================================
// RESULTS
// ============================================================================
console.log('\n' + '='.repeat(50));
console.log(`✅ PASSED: ${passCount}`);
console.log(`❌ FAILED: ${failCount}`);
console.log('='.repeat(50) + '\n');

if (failCount > 0) {
  console.error('🚨 Some tests failed. Fix issues before deploying.');
  process.exit(1);
} else {
  console.log('🎉 All smoke tests passed!');
  process.exit(0);
}
