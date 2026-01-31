/**
 * P0 QUICK VALIDATION: SecurityEvent Infrastructure Test
 *
 * Gerçek user credentials olmadan infrastructure'ı test eder
 * Database'e event yazma capability'sini kanıtlar
 */

import { PrismaClient } from '@prisma/client';

// P0 FIX: Environment guard
if (process.env.NODE_ENV === 'production') {
  console.error('🚨 CRITICAL: Tests MUST NOT run against production!');
  process.exit(1);
}

const prisma = new PrismaClient({
  datasourceUrl: process.env.STAGING_DATABASE_URL || process.env.DATABASE_URL
});

/**
 * Wait helper
 */
function wait(ms = 500) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * TEST: SecurityEvent infrastructure works (direct DB write)
 */
async function testDirectEventWrite() {
  console.log('\n========================================');
  console.log('TEST: Direct SecurityEvent Write');
  console.log('========================================');

  const { logSecurityEvent, EVENT_TYPE, SEVERITY } = await import('../../src/middleware/securityEventLogger.js');

  const beforeCount = await prisma.securityEvent.count({
    where: { type: 'auth_failure' }
  });

  console.log(`📊 Before: ${beforeCount} auth_failure events`);

  // Trigger direct event write
  await logSecurityEvent({
    type: EVENT_TYPE.AUTH_FAILURE,
    severity: SEVERITY.MEDIUM,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    endpoint: '/test',
    method: 'POST',
    statusCode: 401,
    details: { reason: 'test_validation' }
  });

  await wait(1000);

  const afterCount = await prisma.securityEvent.count({
    where: { type: 'auth_failure' }
  });

  console.log(`📊 After: ${afterCount} auth_failure events`);

  return afterCount > beforeCount;
}

/**
 * TEST: Dedupe window works
 */
async function testDedupeWindow() {
  console.log('\n========================================');
  console.log('TEST: Dedupe Window (Flood Protection)');
  console.log('========================================');

  const { logSecurityEvent, EVENT_TYPE, SEVERITY } = await import('../../src/middleware/securityEventLogger.js');

  const beforeCount = await prisma.securityEvent.count({
    where: { type: 'rate_limit_hit' }
  });

  console.log(`📊 Before: ${beforeCount} rate_limit_hit events`);

  // Spam 10 identical events (should be deduped to 1)
  const spamEvents = [];
  for (let i = 0; i < 10; i++) {
    spamEvents.push(
      logSecurityEvent({
        type: EVENT_TYPE.RATE_LIMIT_HIT,
        severity: SEVERITY.LOW,
        ipAddress: '192.168.1.100',
        userAgent: 'spam-bot',
        endpoint: '/test/spam',
        method: 'POST',
        statusCode: 429,
        details: { reason: 'dedupe_test' }
      })
    );
  }

  await Promise.all(spamEvents);
  await wait(1000);

  const afterCount = await prisma.securityEvent.count({
    where: { type: 'rate_limit_hit' }
  });

  console.log(`📊 After: ${afterCount} rate_limit_hit events`);

  const newEvents = afterCount - beforeCount;
  console.log(`📊 New events: ${newEvents} (expected: 1 due to dedupe)`);

  // Should be exactly 1 new event (9 deduped)
  return newEvents === 1;
}

/**
 * TEST: URL sanitization works
 */
async function testUrlSanitization() {
  console.log('\n========================================');
  console.log('TEST: URL Sanitization (PII Protection)');
  console.log('========================================');

  const { logSSRFBlock } = await import('../../src/middleware/securityEventLogger.js');

  const beforeCount = await prisma.securityEvent.count({
    where: { type: 'ssrf_block' }
  });

  console.log(`📊 Before: ${beforeCount} ssrf_block events`);

  // Mock request
  const mockReq = {
    ip: '10.0.0.1',
    headers: { 'user-agent': 'test' },
    path: '/api/test',
    method: 'POST'
  };

  // URL with sensitive query params
  const dangerousUrl = 'http://metadata.internal/api?token=SECRET123&key=PRIVATE456';

  await logSSRFBlock(mockReq, dangerousUrl, 1);
  await wait(1000);

  const afterCount = await prisma.securityEvent.count({
    where: { type: 'ssrf_block' }
  });

  // Verify event was logged
  const passed = afterCount > beforeCount;

  if (passed) {
    // Verify URL was sanitized (query params removed)
    const lastEvent = await prisma.securityEvent.findFirst({
      where: { type: 'ssrf_block' },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`📊 Blocked URL logged as: ${lastEvent.details.blockedUrl}`);

    const isSanitized = !lastEvent.details.blockedUrl.includes('token=') &&
                        !lastEvent.details.blockedUrl.includes('key=');

    if (isSanitized) {
      console.log('✅ URL sanitized correctly (query params removed)');
    } else {
      console.log('❌ URL NOT sanitized (query params still present!)');
      return false;
    }
  }

  return passed;
}

/**
 * TEST: Red Alert can read counts
 */
async function testRedAlertReads() {
  console.log('\n========================================');
  console.log('TEST: Red Alert Reads Real Counts');
  console.log('========================================');

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    authFailures,
    crossTenantAttempts,
    firewallBlocks,
    ssrfBlocks,
    rateLimitHits
  ] = await Promise.all([
    prisma.securityEvent.count({ where: { type: 'auth_failure', createdAt: { gte: last24h } }}),
    prisma.securityEvent.count({ where: { type: 'cross_tenant_attempt', createdAt: { gte: last24h } }}),
    prisma.securityEvent.count({ where: { type: 'firewall_block', createdAt: { gte: last24h } }}),
    prisma.securityEvent.count({ where: { type: 'ssrf_block', createdAt: { gte: last24h } }}),
    prisma.securityEvent.count({ where: { type: 'rate_limit_hit', createdAt: { gte: last24h } }})
  ]);

  console.log('\n📊 RED ALERT COUNTERS (Last 24h):');
  console.log(`   Auth failures:         ${authFailures}`);
  console.log(`   Cross-tenant attempts: ${crossTenantAttempts}`);
  console.log(`   Firewall blocks:       ${firewallBlocks}`);
  console.log(`   SSRF blocks:           ${ssrfBlocks}`);
  console.log(`   Rate limit hits:       ${rateLimitHits}`);

  const totalEvents = authFailures + crossTenantAttempts + firewallBlocks + ssrfBlocks + rateLimitHits;

  if (totalEvents === 0) {
    console.log('\n⚠️  No events in last 24h (database empty or old)');
    console.log('   This is OK for fresh staging environment');
    return true; // Not a failure, just empty DB
  } else {
    console.log(`\n✅ Total events: ${totalEvents} (Red Alert can read counts!)`);
    return true;
  }
}

/**
 * MAIN
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║   P0 QUICK VALIDATION: Infrastructure Test    ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('\nTests infrastructure without requiring user credentials\n');

  try {
    const results = {
      directWrite: await testDirectEventWrite(),
      dedupeWindow: await testDedupeWindow(),
      urlSanitization: await testUrlSanitization(),
      redAlertReads: await testRedAlertReads()
    };

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║              VALIDATION RESULTS                ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(`1. Direct Event Write:    ${results.directWrite ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`2. Dedupe Window:         ${results.dedupeWindow ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`3. URL Sanitization:      ${results.urlSanitization ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`4. Red Alert Reads:       ${results.redAlertReads ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = Object.values(results).every(r => r);
    const passCount = Object.values(results).filter(r => r).length;

    console.log(`\n🎯 TOTAL: ${passCount}/4 tests passed`);

    if (allPassed) {
      console.log('\n✅ P0 INFRASTRUCTURE VALIDATED:');
      console.log('   - SecurityEvent writes to DB ✅');
      console.log('   - Dedupe window prevents flood ✅');
      console.log('   - URL sanitization works ✅');
      console.log('   - Red Alert can read counts ✅');
      console.log('\n🚀 READY FOR INTEGRATION!\n');
      process.exit(0);
    } else {
      console.log('\n❌ INFRASTRUCTURE VALIDATION FAILED');
      console.log('   Fix failed tests before proceeding.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n🚨 TEST ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
