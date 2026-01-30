/**
 * P0.3: Redis Connection Test
 * Tests cache service connection and basic operations
 */

import 'dotenv/config';
import cacheService from './src/services/cache-service.js';

async function testRedis() {
  console.log('🔍 Testing Redis connection...\n');

  // 1. Connection test
  const connected = await cacheService.connect();
  console.log('\n1️⃣ Connection:', connected ? '✅ SUCCESS' : '❌ FAILED');

  if (!connected) {
    console.error('\n❌ Redis connection failed. Check REDIS_URL in .env');
    process.exit(1);
  }

  // 2. Status check
  const status = cacheService.getStatus();
  console.log('2️⃣ Status:', JSON.stringify(status, null, 2));

  // 3. SET test
  console.log('\n3️⃣ Testing SET operation...');
  const setResult = await cacheService.set('test:key', { data: 'test value' }, 60, { keyType: 'test' });
  console.log('   Result:', setResult.success ? '✅' : '❌', JSON.stringify(setResult.metrics));

  // 4. GET test (should hit)
  console.log('\n4️⃣ Testing GET operation (should HIT)...');
  const getResult1 = await cacheService.get('test:key', { keyType: 'test' });
  console.log('   Hit:', getResult1.hit ? '✅' : '❌', JSON.stringify(getResult1.metrics));
  console.log('   Value:', getResult1.value);

  // 5. GET test with non-existent key (should miss)
  console.log('\n5️⃣ Testing GET operation (should MISS)...');
  const getResult2 = await cacheService.get('test:nonexistent', { keyType: 'test' });
  console.log('   Miss:', !getResult2.hit ? '✅' : '❌', JSON.stringify(getResult2.metrics));

  // 6. CRM lookup cache test
  console.log('\n6️⃣ Testing CRM lookup cache...');
  const crmData = { record: 'test customer', orderNo: 'TEST-001' };

  const setCrm = await cacheService.setCrmLookup(1, 1, 'order', 'TEST-001', crmData);
  console.log('   SET:', setCrm.success ? '✅' : '❌');

  const getCrm = await cacheService.getCrmLookup(1, 1, 'order', 'TEST-001');
  console.log('   GET Hit:', getCrm.hit ? '✅' : '❌');
  console.log('   Metrics:', JSON.stringify(getCrm.metrics));

  // 7. Cache invalidation test (version bump)
  console.log('\n7️⃣ Testing cache invalidation (version bump)...');
  const getCrmOldVersion = await cacheService.getCrmLookup(1, 2, 'order', 'TEST-001'); // version 2
  console.log('   Version 2 (should MISS):', !getCrmOldVersion.hit ? '✅' : '❌');

  // Cleanup
  console.log('\n🧹 Cleaning up test keys...');
  await cacheService.deletePattern('test:*');

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Redis test completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await cacheService.disconnect();
  process.exit(0);
}

testRedis().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
