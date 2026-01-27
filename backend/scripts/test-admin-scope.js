/**
 * Test P1: Admin business scope validation
 * Tests that regular ADMIN can only access their own business
 * Tests that SUPER_ADMIN can access any business
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testAdminScope() {
  console.log('\n🧪 Testing P1: Admin Business Scope Validation\n');

  try {
    // Get admin user
    const admin = await prisma.adminUser.findUnique({
      where: { email: 'nurettin@telyx.ai' }
    });

    if (!admin) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log(`✅ Admin found: ${admin.email}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   ID: ${admin.id}\n`);

    // Get two different businesses
    const businesses = await prisma.business.findMany({
      take: 2,
      include: { users: true }
    });

    if (businesses.length < 2) {
      console.log('❌ Need at least 2 businesses for testing');
      return;
    }

    console.log('📊 Test businesses:');
    console.log(`   Business 1: ${businesses[0].name} (ID: ${businesses[0].id})`);
    console.log(`   Business 2: ${businesses[1].name} (ID: ${businesses[1].id})\n`);

    // Simulate admin with businessId (would be set via authenticateToken)
    const mockUser1 = businesses[0].users[0] || { businessId: businesses[0].id };
    const mockUser2 = businesses[1].users[0] || { businessId: businesses[1].id };

    console.log('='.repeat(60));
    console.log('TEST 1: SUPER_ADMIN cross-business access');
    console.log('='.repeat(60));

    // Mock request for SUPER_ADMIN
    const mockReqSuperAdmin = {
      admin: { role: 'SUPER_ADMIN' },
      user: mockUser1
    };

    // Import the validation function
    const { canAccessBusiness } = await import('../src/middleware/adminAuth.js');

    // SUPER_ADMIN should access business 1 (own)
    const superAdminOwnAccess = canAccessBusiness(mockReqSuperAdmin, businesses[0].id);
    console.log(`SUPER_ADMIN accessing own business: ${superAdminOwnAccess ? '✅ ALLOWED' : '❌ DENIED'}`);

    // SUPER_ADMIN should access business 2 (other)
    const superAdminCrossAccess = canAccessBusiness(mockReqSuperAdmin, businesses[1].id);
    console.log(`SUPER_ADMIN accessing other business: ${superAdminCrossAccess ? '✅ ALLOWED' : '❌ DENIED'}`);

    console.log('\n' + '='.repeat(60));
    console.log('TEST 2: Regular ADMIN scope restriction');
    console.log('='.repeat(60));

    // Mock request for regular ADMIN
    const mockReqAdmin = {
      admin: { role: 'ADMIN' },
      user: mockUser1
    };

    // Regular ADMIN should access own business
    const adminOwnAccess = canAccessBusiness(mockReqAdmin, businesses[0].id);
    console.log(`ADMIN accessing own business: ${adminOwnAccess ? '✅ ALLOWED' : '❌ DENIED'}`);

    // Regular ADMIN should NOT access other business
    const adminCrossAccess = canAccessBusiness(mockReqAdmin, businesses[1].id);
    console.log(`ADMIN accessing other business: ${adminCrossAccess ? '❌ BLOCKED' : '⚠️  ALLOWED'}`);

    console.log('\n' + '='.repeat(60));
    console.log('TEST SUMMARY');
    console.log('='.repeat(60));

    const allPassed =
      superAdminOwnAccess === true &&
      superAdminCrossAccess === true &&
      adminOwnAccess === true &&
      adminCrossAccess === false;

    if (allPassed) {
      console.log('✅ ALL TESTS PASSED: Business scope validation working correctly');
    } else {
      console.log('❌ SOME TESTS FAILED:');
      if (!superAdminOwnAccess) console.log('   - SUPER_ADMIN should access own business');
      if (!superAdminCrossAccess) console.log('   - SUPER_ADMIN should access other business');
      if (!adminOwnAccess) console.log('   - ADMIN should access own business');
      if (adminCrossAccess) console.log('   - ADMIN should NOT access other business');
    }

    // Check audit log for access denied events
    console.log('\n' + '='.repeat(60));
    console.log('AUDIT LOG: Recent access denied events');
    console.log('='.repeat(60));

    const deniedLogs = await prisma.auditLog.findMany({
      where: { action: 'ACCESS_DENIED' },
      orderBy: { createdAt: 'desc' },
      take: 3
    });

    if (deniedLogs.length > 0) {
      deniedLogs.forEach(log => {
        console.log(`\n[${log.createdAt.toISOString()}]`);
        console.log(`  Admin: ${log.adminEmail}`);
        console.log(`  Target: ${log.entityType} ${log.entityId}`);
        console.log(`  Reason: ${log.metadata?.reason || 'N/A'}`);
      });
    } else {
      console.log('No access denied logs yet (expected for first run)');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAdminScope();
