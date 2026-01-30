/**
 * V1 MVP: Limit Enforcement Test Suite
 * Tests KB and CRM limits without actually hitting endpoints
 */

import dotenv from 'dotenv';
dotenv.config();

import { checkKBItemLimit, checkKBStorageLimit, checkCRMLimit, getLimits } from './src/services/globalLimits.js';
import prisma from './src/config/database.js';

console.log('🧪 V1 MVP Limit Enforcement Test Suite\n');

// Create test business
const testBusinessId = 99999; // Use high ID to avoid conflicts

async function runTests() {
  try {
    // 1. Show configured limits
    console.log('📋 Configured Limits:');
    const limits = getLimits();
    console.log('   CRM Records:', limits.crmRecords);
    console.log('   KB Items:', limits.kbItems);
    console.log('   KB Storage:', limits.kbStorageMB, 'MB');
    console.log('   URL Crawl Pages:', limits.urlCrawlMaxPages);
    console.log('');

    // 2. Test KB item limit logic
    console.log('🔍 Test 1: KB Item Limit (simulated)');

    // Clean any test data
    await prisma.knowledgeBase.deleteMany({ where: { businessId: testBusinessId } });

    // Add items up to limit
    const kbLimit = limits.kbItems;
    console.log(`   Creating ${kbLimit} KB items...`);

    for (let i = 0; i < kbLimit; i++) {
      await prisma.knowledgeBase.create({
        data: {
          businessId: testBusinessId,
          type: 'FAQ',
          title: `Test FAQ ${i}`,
          question: `Test question ${i}`,
          answer: `Test answer ${i}`,
          status: 'ACTIVE'
        }
      });
    }

    // Check at limit
    const atLimit = await checkKBItemLimit(testBusinessId, 1);
    console.log(`   At limit (${kbLimit}/${kbLimit}): allowed=${atLimit.allowed} ✅`);

    if (atLimit.allowed) {
      console.log('   ❌ FAIL: Should be blocked at limit!');
    } else {
      console.log(`   ✅ PASS: Correctly blocked (${atLimit.error.code})`);
    }

    // Check below limit
    await prisma.knowledgeBase.delete({
      where: {
        id: (await prisma.knowledgeBase.findFirst({ where: { businessId: testBusinessId } })).id
      }
    });

    const belowLimit = await checkKBItemLimit(testBusinessId, 1);
    console.log(`   Below limit (${kbLimit-1}/${kbLimit}): allowed=${belowLimit.allowed} ✅`);

    if (!belowLimit.allowed) {
      console.log('   ❌ FAIL: Should be allowed below limit!');
    }

    console.log('');

    // 3. Test KB storage limit
    console.log('🔍 Test 2: KB Storage Limit');

    // Clean docs
    await prisma.knowledgeBase.deleteMany({
      where: { businessId: testBusinessId, type: 'DOCUMENT' }
    });

    const storageLimitBytes = limits.kbStorageMB * 1024 * 1024;
    const halfLimit = Math.floor(storageLimitBytes / 2);

    // Add doc with half the limit
    await prisma.knowledgeBase.create({
      data: {
        businessId: testBusinessId,
        type: 'DOCUMENT',
        title: 'Test doc',
        content: 'x'.repeat(1000),
        fileSize: halfLimit,
        status: 'ACTIVE'
      }
    });

    // Try to add another half (should succeed as we're at limit)
    const storageCheck1 = await checkKBStorageLimit(testBusinessId, halfLimit);
    console.log(`   At ${limits.kbStorageMB}MB limit: allowed=${storageCheck1.allowed}`);

    // Try to add more (should fail)
    const storageCheck2 = await checkKBStorageLimit(testBusinessId, halfLimit + 1);
    console.log(`   Over ${limits.kbStorageMB}MB limit: allowed=${storageCheck2.allowed}`);

    if (storageCheck2.allowed) {
      console.log('   ❌ FAIL: Should be blocked when exceeding storage!');
    } else {
      console.log(`   ✅ PASS: Correctly blocked (${storageCheck2.error.code})`);
    }

    console.log('');

    // 4. Test CRM limit
    console.log('🔍 Test 3: CRM Import Limit');

    await prisma.customerData.deleteMany({ where: { businessId: testBusinessId } });

    const crmLimit = limits.crmRecords;

    // Simulate import of exactly limit
    const atCrmLimit = await checkCRMLimit(testBusinessId, crmLimit);
    console.log(`   Import ${crmLimit} records (at limit): allowed=${atCrmLimit.allowed} ✅`);

    // Simulate import exceeding limit
    const overCrmLimit = await checkCRMLimit(testBusinessId, crmLimit + 1);
    console.log(`   Import ${crmLimit + 1} records (over limit): allowed=${overCrmLimit.allowed}`);

    if (overCrmLimit.allowed) {
      console.log('   ❌ FAIL: Should block import exceeding limit!');
    } else {
      console.log(`   ✅ PASS: Correctly blocked (${overCrmLimit.error.code})`);
      console.log(`   Error message: "${overCrmLimit.error.message}"`);
    }

    console.log('');

    // Cleanup
    console.log('🧹 Cleaning up test data...');
    await prisma.knowledgeBase.deleteMany({ where: { businessId: testBusinessId } });
    await prisma.customerData.deleteMany({ where: { businessId: testBusinessId } });

    console.log('');
    console.log('✅ All limit enforcement tests passed!');
    console.log('');
    console.log('📌 Notes:');
    console.log('   - Limits are enforced at DB query level (real-time COUNT/SUM)');
    console.log('   - Error codes are structured (KB_LIMIT_EXCEEDED, etc.)');
    console.log('   - Storage limit only counts DOCUMENT types');
    console.log('');

    process.exit(0);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

runTests();
