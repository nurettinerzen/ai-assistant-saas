import { compareTurkishNames } from '../src/utils/text.js';
import { createAnchor } from '../src/services/verification-service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testNameComparison() {
  try {
    // Get the actual DB record
    const record = await prisma.customerData.findFirst({
      where: { orderNo: 'ORD-2024-001' }
    });

    console.log('=== DB RECORD ===');
    console.log('companyName:', record.companyName);
    console.log('contactName:', record.contactName);
    console.log('');

    // Create anchor
    const anchor = createAnchor(record, 'order', '2024001');
    console.log('=== ANCHOR ===');
    console.log('anchor.name:', anchor.name);
    console.log('');

    // Test comparisons
    console.log('=== COMPARISON TESTS ===');

    const tests = [
      { input: 'Ahmet Yılmaz', expected: true },
      { input: 'ahmet yılmaz', expected: true },
      { input: 'AHMET YILMAZ', expected: true },
      { input: 'Ahmet', expected: false },
      { input: 'Mehmet Kaya', expected: false },
      { input: 'TEST_Customer_Alpha', expected: false }
    ];

    for (const test of tests) {
      const result = compareTurkishNames(test.input, anchor.name);
      const status = result === test.expected ? '✓' : '✗';
      console.log(`${status} "${test.input}" vs "${anchor.name}" → ${result} (expected: ${test.expected})`);
    }

  } catch (error) {
    console.error('ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testNameComparison();
