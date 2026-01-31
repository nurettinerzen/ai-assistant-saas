/**
 * Seed Test Data for Automated Tests
 *
 * Creates consistent, valid test data for assistant & security tests
 * Run before test suite: npm run seed-test-data
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_BUSINESS_ID = 1; // incehesap test business

async function seedTestCustomers() {
  console.log('🌱 Seeding test customer data...\n');

  // Clean up existing test customers (marked with TEST_ prefix)
  const deleted = await prisma.customerData.deleteMany({
    where: {
      businessId: TEST_BUSINESS_ID,
      companyName: { startsWith: 'TEST_' }
    }
  });
  console.log(`🗑️  Cleaned up ${deleted.count} existing test customers\n`);

  // Seed customers for verification bypass tests
  const testCustomers = [
    {
      businessId: TEST_BUSINESS_ID,
      companyName: 'TEST_Customer_Alpha',
      contactName: 'Ahmet Yılmaz',
      phone: '905551234567',
      email: 'test.alpha@example.com',
      orderNo: 'ORD-2024-001',
      tcNo: '12345678901',
      notes: 'Test customer for verification bypass - valid data'
    },
    {
      businessId: TEST_BUSINESS_ID,
      companyName: 'TEST_Customer_Beta',
      contactName: 'Ayşe Demir',
      phone: '905557654321',
      email: 'test.beta@example.com',
      orderNo: 'ORD-2024-002',
      tcNo: '98765432109',
      notes: 'Test customer for verification bypass - valid data'
    },
    {
      businessId: TEST_BUSINESS_ID,
      companyName: 'TEST_Customer_Gamma',
      contactName: 'Mehmet Kaya',
      phone: '905559876543',
      email: 'test.gamma@example.com',
      orderNo: 'ORD-2024-003',
      tcNo: '11122233344',
      notes: 'Test customer for tool calling tests'
    },
    {
      businessId: TEST_BUSINESS_ID,
      companyName: 'TEST_Customer_Partial',
      contactName: null, // Intentionally missing
      phone: '905551111111',
      email: null,
      orderNo: 'ORD-2024-999',
      notes: 'Test customer with partial data - for testing null handling'
    }
  ];

  for (const customer of testCustomers) {
    const created = await prisma.customerData.create({
      data: customer
    });
    console.log(`✅ Created: ${customer.companyName} (${customer.contactName || 'NO NAME'}) - Order: ${customer.orderNo}`);
  }

  console.log(`\n✨ Successfully seeded ${testCustomers.length} test customers`);

  return testCustomers.length;
}

async function main() {
  try {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║   TEST DATA SEEDING                   ║');
    console.log('╚═══════════════════════════════════════╝\n');

    const count = await seedTestCustomers();

    console.log('\n═══════════════════════════════════════');
    console.log(`✅ Seeding complete: ${count} customers created`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('🚨 SEEDING ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
