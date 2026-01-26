/**
 * Test Audit Log Database Integration
 * Run: node tests/test-audit-log.js
 */

import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '@prisma/client';
import {
  logInvitationCreated,
  logInvitationAccepted,
  logRoleChanged,
  logMemberRemoved
} from '../src/utils/auditLogger.js';

const prisma = new PrismaClient();

console.log('\n🧪 TESTING AUDIT LOG DATABASE INTEGRATION\n');

async function cleanup() {
  // Clean up test data
  console.log('🧹 Cleaning up test data...');
  await prisma.businessAuditLog.deleteMany({
    where: {
      metadata: {
        path: ['test'],
        equals: true
      }
    }
  });
}

async function testAuditLog() {
  try {
    // Test 1: Direct database insert
    console.log('📝 Test 1: Direct database insert...');
    const testLog = await prisma.businessAuditLog.create({
      data: {
        action: 'test_action',
        actorUserId: null,
        businessId: 1,
        targetUserId: null,
        targetEmail: 'test@example.com',
        metadata: { test: true },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent'
      }
    });
    console.log(`✅ Created audit log with ID: ${testLog.id}`);

    // Test 2: Query audit log
    console.log('\n📝 Test 2: Query audit log...');
    const retrieved = await prisma.businessAuditLog.findUnique({
      where: { id: testLog.id }
    });
    console.log(`✅ Retrieved audit log: ${retrieved.action}`);

    // Test 3: Use helper function
    console.log('\n📝 Test 3: Use helper function (logInvitationCreated)...');
    await logInvitationCreated({
      inviterId: null,
      businessId: 1,
      inviteeEmail: 'helper-test@example.com',
      role: 'MANAGER',
      req: { ip: '127.0.0.1', headers: { 'user-agent': 'test' } }
    });
    console.log('✅ Helper function executed successfully');

    // Test 4: Verify it was saved
    console.log('\n📝 Test 4: Verify helper function saved to DB...');
    const helperLog = await prisma.businessAuditLog.findFirst({
      where: {
        action: 'invitation_created',
        targetEmail: 'helper-test@example.com'
      },
      orderBy: { createdAt: 'desc' }
    });

    if (helperLog) {
      console.log(`✅ Found audit log from helper: ID ${helperLog.id}`);
      console.log(`   - Action: ${helperLog.action}`);
      console.log(`   - Email: ${helperLog.targetEmail}`);
      console.log(`   - Metadata: ${JSON.stringify(helperLog.metadata)}`);
    } else {
      throw new Error('Helper function did not save to database');
    }

    // Test 5: Test with null businessId (should handle gracefully)
    console.log('\n📝 Test 5: Test with null businessId...');
    try {
      await prisma.businessAuditLog.create({
        data: {
          action: 'login_success',
          actorUserId: null,
          businessId: null, // This should fail due to NOT NULL constraint
          targetEmail: 'test@example.com',
          metadata: { test: true }
        }
      });
      console.log('⚠️ Null businessId was accepted (unexpected)');
    } catch (error) {
      if (error.code === 'P2011' || error.message.includes('null')) {
        console.log('✅ Null businessId correctly rejected');
      } else {
        throw error;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ ALL AUDIT LOG TESTS PASSED');
    console.log('='.repeat(50) + '\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

testAuditLog();
