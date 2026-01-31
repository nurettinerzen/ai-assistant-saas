import { PrismaClient } from '@prisma/client';
import customerDataLookup from '../src/tools/handlers/customer-data-lookup.js';

const prisma = new PrismaClient();

async function testToolDirect() {
  try {
    console.log('--- DIRECT TOOL TEST ---');

    // Test 1: Lookup with order number only (should trigger verification)
    console.log('\n1) Lookup ORD-2024-001 with NO name (should ask for verification)');
    const result1 = await customerDataLookup.execute(
      {
        order_number: 'ORD-2024-001',
        // customer_name: undefined, // Not provided
        query_type: 'order_lookup'
      },
      { businessId: 1, language: 'TR' },
      { sessionId: 'test-direct-1' }
    );

    console.log('Tool Result:', JSON.stringify(result1, null, 2));
    console.log('outcome:', result1.outcome);
    console.log('data.askFor:', result1.data?.askFor);
    console.log('data.anchor:', result1.data?.anchor ? 'EXISTS' : 'MISSING');

    // Test 2: Lookup with order number AND partial name
    console.log('\n\n2) Lookup ORD-2024-001 with partial name "Ahmet" (should verify)');
    const result2 = await customerDataLookup.execute(
      {
        order_number: 'ORD-2024-001',
        customer_name: 'Ahmet',
        query_type: 'order_lookup'
      },
      { businessId: 1, language: 'TR' },
      { sessionId: 'test-direct-2' }
    );

    console.log('Tool Result:', JSON.stringify(result2, null, 2));
    console.log('outcome:', result2.outcome);

    // Test 3: Lookup with order number AND FULL name
    console.log('\n\n3) Lookup ORD-2024-001 with FULL name "Ahmet Yılmaz" (should succeed)');
    const result3 = await customerDataLookup.execute(
      {
        order_number: 'ORD-2024-001',
        customer_name: 'Ahmet Yılmaz',
        query_type: 'order_lookup'
      },
      { businessId: 1, language: 'TR' },
      { sessionId: 'test-direct-3' }
    );

    console.log('Tool Result:', JSON.stringify(result3, null, 2));
    console.log('outcome:', result3.outcome);

  } catch (error) {
    console.error('ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testToolDirect();
