/**
 * Test audit log functionality
 * Creates a sample audit log entry and retrieves it
 */

import { PrismaClient } from '@prisma/client';
import { createAdminAuditLog } from '../src/middleware/auditLog.js';

const prisma = new PrismaClient();

async function testAuditLog() {
  console.log('\n🧪 Testing P0-C Audit Log\n');

  try {
    // Get or create admin user
    let admin = await prisma.adminUser.findUnique({
      where: { email: 'nurettin@telyx.ai' }
    });

    if (!admin) {
      console.log('❌ Admin user not found. Please login to admin panel first.');
      return;
    }

    console.log(`✅ Admin found: ${admin.email} (ID: ${admin.id})`);

    // Get a test business/subscription
    const business = await prisma.business.findFirst({
      include: { subscription: true }
    });

    if (!business || !business.subscription) {
      console.log('❌ No business with subscription found.');
      return;
    }

    console.log(`✅ Using business: ${business.name} (ID: ${business.id})`);

    // Simulate enterprise config update
    const oldSub = {
      enterpriseMinutes: business.subscription.enterpriseMinutes,
      enterprisePrice: business.subscription.enterprisePrice,
      plan: business.subscription.plan
    };

    console.log('\n📊 Creating audit log entry...');

    await createAdminAuditLog(
      admin,
      'enterprise_config_updated',
      {
        entityType: 'Subscription',
        entityId: business.subscription.id,
        changes: {
          enterpriseMinutes: { old: oldSub.enterpriseMinutes, new: 5000 },
          enterprisePrice: { old: oldSub.enterprisePrice, new: 10000 }
        },
        metadata: {
          businessId: business.id,
          operation: 'enterprise_config_test',
          oldPlan: oldSub.plan,
          timestamp: new Date().toISOString()
        },
        ipAddress: '127.0.0.1',
        userAgent: 'P0-C Test Script'
      }
    );

    console.log('✅ Audit log created');

    // Retrieve the log
    console.log('\n📊 Retrieving audit log from DB...\n');
    const logs = await prisma.auditLog.findMany({
      where: {
        entityType: 'Subscription',
        entityId: business.subscription.id.toString()
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    if (logs.length === 0) {
      console.log('❌ No audit log found!');
      return;
    }

    const log = logs[0];

    console.log('✅ AUDIT LOG RECORD FOUND:');
    console.log('='.repeat(60));
    console.log(`event:            ${log.metadata?.event || 'N/A'}`);
    console.log(`adminId:          ${log.adminId}`);
    console.log(`adminEmail:       ${log.adminEmail}`);
    console.log(`action:           ${log.action}`);
    console.log(`entityType:       ${log.entityType}`);
    console.log(`entityId:         ${log.entityId}`);
    console.log(`targetBusinessId: ${log.metadata?.businessId || 'N/A'}`);
    console.log(`ipAddress:        ${log.ipAddress}`);
    console.log(`userAgent:        ${log.userAgent}`);
    console.log(`createdAt:        ${log.createdAt}`);
    console.log('\nchanges.before & changes.after:');
    console.log(JSON.stringify(log.changes, null, 2));
    console.log('\nmetadata:');
    console.log(JSON.stringify(log.metadata, null, 2));
    console.log('='.repeat(60));

    // Verify all required fields
    const required = [
      'adminId',
      'adminEmail',
      'action',
      'entityType',
      'entityId',
      'ipAddress',
      'userAgent',
      'createdAt'
    ];

    const missing = required.filter(field => !log[field]);
    if (missing.length > 0) {
      console.log(`\n❌ Missing required fields: ${missing.join(', ')}`);
    } else {
      console.log('\n✅ All required fields present');
    }

    // Verify changes structure
    if (log.changes && typeof log.changes === 'object') {
      console.log('✅ Changes structure valid (before/after)');
    } else {
      console.log('❌ Changes structure invalid');
    }

    // Verify metadata
    if (log.metadata?.businessId && log.metadata?.operation) {
      console.log('✅ Metadata contains businessId and operation');
    } else {
      console.log('⚠️  Metadata missing businessId or operation');
    }

  } catch (error) {
    console.error('❌ Test error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditLog();
