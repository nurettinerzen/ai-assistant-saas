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

// ─── CRM Stock Seed Data ─────────────────────────────────────────────
// Creates product families with multiple variants to test:
// 1. Disambiguation (MULTIPLE_CANDIDATES) — "iPhone 17 var mı?" → 6 ürün eşleşir
// 2. Exact SKU match (EXACT_SKU) — SKU ile direkt sonuç
// 3. Stock disclosure policy — adet ifşa yok, sadece band
// 4. Quantity threshold check — "50 adet var mı?"
// 5. Out of stock handling
// 6. Low stock handling
async function seedCrmStock() {
  console.log('\n🌱 Seeding CRM stock test data...\n');

  // Clean up existing test stock (TEST_ prefix SKUs)
  const deleted = await prisma.crmStock.deleteMany({
    where: {
      businessId: TEST_BUSINESS_ID,
      sku: { startsWith: 'TEST-' }
    }
  });
  console.log(`🗑️  Cleaned up ${deleted.count} existing test stock records\n`);

  const testStockItems = [
    // ─── iPhone 17 ailesi (Disambiguation test) ────────────────
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-IPH17-128-BLK',
      productName: 'iPhone 17 128GB Siyah',
      inStock: true,
      quantity: 1500,
      price: 64999,
      externalUpdatedAt: new Date()
    },
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-IPH17-256-WHT',
      productName: 'iPhone 17 256GB Beyaz',
      inStock: true,
      quantity: 800,
      price: 74999,
      externalUpdatedAt: new Date()
    },
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-IPH17P-256-BLK',
      productName: 'iPhone 17 Pro 256GB Siyah',
      inStock: true,
      quantity: 350,
      price: 89999,
      externalUpdatedAt: new Date()
    },
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-IPH17P-512-GLD',
      productName: 'iPhone 17 Pro 512GB Gold',
      inStock: true,
      quantity: 45,  // Düşük stok
      price: 99999,
      externalUpdatedAt: new Date()
    },
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-IPH17PM-256-TTN',
      productName: 'iPhone 17 Pro Max 256GB Titanium',
      inStock: true,
      quantity: 200,
      price: 109999,
      externalUpdatedAt: new Date()
    },
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-IPH17PM-1TB-BLK',
      productName: 'iPhone 17 Pro Max 1TB Siyah',
      inStock: false,
      quantity: 0,
      price: 139999,
      estimatedRestock: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 hafta sonra
      externalUpdatedAt: new Date()
    },

    // ─── Tekil ürün (Exact match test) ─────────────────────────
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-KBL-001',
      productName: 'Kablosuz Kulaklık Premium',
      inStock: true,
      quantity: 230,
      price: 2499,
      externalUpdatedAt: new Date()
    },

    // ─── Stokta yok ürün ──────────────────────────────────────
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-SSD-2TB',
      productName: 'SSD 2TB NVMe',
      inStock: false,
      quantity: 0,
      price: 4999,
      estimatedRestock: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 hafta sonra
      externalUpdatedAt: new Date()
    },

    // ─── Düşük stok ürün (LOW_STOCK band test) ────────────────
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-AF-PRO',
      productName: 'Airfryer Pro 5.5L',
      inStock: true,
      quantity: 3,   // Çok düşük → LOW_STOCK
      price: 3999,
      externalUpdatedAt: new Date()
    },

    // ─── Quantity threshold test ürünü ─────────────────────────
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-MNTR-27',
      productName: 'Monitor 27" 4K IPS',
      inStock: true,
      quantity: 35,  // 50 adet sorulursa → PARTIAL
      price: 12999,
      externalUpdatedAt: new Date()
    },

    // ─── Samsung ailesi (İkinci disambiguation test) ──────────
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-SS-S25-128',
      productName: 'Samsung Galaxy S25 128GB',
      inStock: true,
      quantity: 600,
      price: 49999,
      externalUpdatedAt: new Date()
    },
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-SS-S25U-256',
      productName: 'Samsung Galaxy S25 Ultra 256GB',
      inStock: true,
      quantity: 150,
      price: 79999,
      externalUpdatedAt: new Date()
    },
    {
      businessId: TEST_BUSINESS_ID,
      sku: 'TEST-SS-S25U-512',
      productName: 'Samsung Galaxy S25 Ultra 512GB',
      inStock: false,
      quantity: 0,
      price: 89999,
      externalUpdatedAt: new Date()
    }
  ];

  for (const item of testStockItems) {
    await prisma.crmStock.upsert({
      where: {
        businessId_sku: {
          businessId: item.businessId,
          sku: item.sku
        }
      },
      update: {
        productName: item.productName,
        inStock: item.inStock,
        quantity: item.quantity,
        price: item.price,
        estimatedRestock: item.estimatedRestock || null,
        externalUpdatedAt: item.externalUpdatedAt
      },
      create: item
    });
    const status = item.inStock ? (item.quantity <= 10 ? '⚠️ LOW' : '✅ IN_STOCK') : '❌ OUT';
    console.log(`  ${status}  ${item.sku} — ${item.productName} (qty: ${item.quantity}, ${item.price} TL)`);
  }

  console.log(`\n✨ Successfully seeded ${testStockItems.length} CRM stock items`);
  return testStockItems.length;
}

async function main() {
  try {
    console.log('╔═══════════════════════════════════════╗');
    console.log('║   TEST DATA SEEDING                   ║');
    console.log('╚═══════════════════════════════════════╝\n');

    const customerCount = await seedTestCustomers();
    const stockCount = await seedCrmStock();

    console.log('\n═══════════════════════════════════════');
    console.log(`✅ Seeding complete: ${customerCount} customers, ${stockCount} stock items`);
    console.log('═══════════════════════════════════════\n');

  } catch (error) {
    console.error('🚨 SEEDING ERROR:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
