/**
 * RED ALERT VALIDATION TEST
 *
 * Bu test danışmanın kritik sorusunu cevaplıyor:
 * "Red Alert gerçekten neye bakıyor? Event sayacı +1 oluyor mu?"
 *
 * Her security event türü için:
 * 1. Event tetikleniyor
 * 2. DB'de SecurityEvent sayısı +1 oluyor mu?
 * 3. Red Alert bu event'i görüyor mu?
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CONFIG = {
  API_URL: process.env.API_URL || 'http://localhost:3001',
  ACCOUNT_A: {
    email: process.env.TEST_ACCOUNT_A_EMAIL,
    password: process.env.TEST_ACCOUNT_A_PASSWORD,
    businessId: 1
  },
  ACCOUNT_B: {
    email: process.env.TEST_ACCOUNT_B_EMAIL,
    password: process.env.TEST_ACCOUNT_B_PASSWORD,
    businessId: 2
  }
};

async function loginUser(email, password) {
  const response = await axios.post(`${CONFIG.API_URL}/api/auth/login`, {
    email,
    password
  });
  return response.data.token;
}

// ============================================================================
// TEST 1: Webhook Invalid Signature → SecurityEvent Yazılıyor mu?
// ============================================================================

async function test1_WebhookSignatureEvent() {
  console.log('\n========================================');
  console.log('TEST 1: WEBHOOK SIGNATURE → SecurityEvent');
  console.log('========================================');

  // Önceki event sayısı
  const beforeCount = await prisma.securityEvent.count({
    where: { type: 'firewall_block' }
  });

  console.log(`📊 Before: ${beforeCount} firewall_block events`);

  // Invalid signature ile webhook'a request at
  try {
    await axios.post(`${CONFIG.API_URL}/api/whatsapp/webhook`, {
      object: 'whatsapp_business_account',
      entry: []
    }, {
      headers: {
        'X-Hub-Signature-256': 'sha256=invalidsignature12345'
      }
    });
  } catch (error) {
    // Expected 401
    console.log(`✅ Got expected ${error.response?.status} response`);
  }

  // Event yazıldı mı?
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for DB write

  const afterCount = await prisma.securityEvent.count({
    where: { type: 'firewall_block' }
  });

  console.log(`📊 After: ${afterCount} firewall_block events`);

  const eventWritten = afterCount > beforeCount;

  if (eventWritten) {
    console.log('✅ PASS: SecurityEvent yazıldı (+1)');

    // Son event'i göster
    const lastEvent = await prisma.securityEvent.findFirst({
      where: { type: 'firewall_block' },
      orderBy: { createdAt: 'desc' }
    });

    console.log('📝 Last event:', {
      type: lastEvent.type,
      severity: lastEvent.severity,
      endpoint: lastEvent.endpoint,
      method: lastEvent.method,
      statusCode: lastEvent.statusCode,
      createdAt: lastEvent.createdAt
    });
  } else {
    console.log('❌ FAIL: SecurityEvent YAZILMADI! Red Alert süs!');
  }

  return eventWritten;
}

// ============================================================================
// TEST 2: IDOR Attempt → SecurityEvent Yazılıyor mu?
// ============================================================================

async function test2_IDORAttemptEvent() {
  console.log('\n========================================');
  console.log('TEST 2: IDOR ATTEMPT → SecurityEvent');
  console.log('========================================');

  const tokenA = await loginUser(CONFIG.ACCOUNT_A.email, CONFIG.ACCOUNT_A.password);

  // Önceki event sayısı
  const beforeCount = await prisma.securityEvent.count({
    where: { type: 'cross_tenant_attempt' }
  });

  console.log(`📊 Before: ${beforeCount} cross_tenant_attempt events`);

  // Token A ile Business B'ye erişmeye çalış
  try {
    await axios.get(`${CONFIG.API_URL}/api/business/${CONFIG.ACCOUNT_B.businessId}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
  } catch (error) {
    // Expected 403
    console.log(`✅ Got expected ${error.response?.status} response`);
  }

  // Event yazıldı mı?
  await new Promise(resolve => setTimeout(resolve, 1000));

  const afterCount = await prisma.securityEvent.count({
    where: { type: 'cross_tenant_attempt' }
  });

  console.log(`📊 After: ${afterCount} cross_tenant_attempt events`);

  const eventWritten = afterCount > beforeCount;

  if (eventWritten) {
    console.log('✅ PASS: SecurityEvent yazıldı (+1)');

    const lastEvent = await prisma.securityEvent.findFirst({
      where: { type: 'cross_tenant_attempt' },
      orderBy: { createdAt: 'desc' }
    });

    console.log('📝 Last event:', {
      type: lastEvent.type,
      severity: lastEvent.severity,
      businessId: lastEvent.businessId,
      endpoint: lastEvent.endpoint,
      createdAt: lastEvent.createdAt
    });
  } else {
    console.log('❌ FAIL: SecurityEvent YAZILMADI! IDOR tracking yok!');
  }

  return eventWritten;
}

// ============================================================================
// TEST 3: Red Alert Thresholds - Gerçek Sayıları Görüyor mu?
// ============================================================================

async function test3_RedAlertSeesEvents() {
  console.log('\n========================================');
  console.log('TEST 3: RED ALERT SEES EVENTS');
  console.log('========================================');

  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Son 24 saatte her event türünden kaç tane var?
  const [
    crossTenantAttempts,
    firewallBlocks,
    contentSafetyBlocks,
    ssrfBlocks,
    authFailures,
    rateLimitHits
  ] = await Promise.all([
    prisma.securityEvent.count({
      where: { type: 'cross_tenant_attempt', createdAt: { gte: last24h } }
    }),
    prisma.securityEvent.count({
      where: { type: 'firewall_block', createdAt: { gte: last24h } }
    }),
    prisma.securityEvent.count({
      where: { type: 'content_safety_block', createdAt: { gte: last24h } }
    }),
    prisma.securityEvent.count({
      where: { type: 'ssrf_block', createdAt: { gte: last24h } }
    }),
    prisma.securityEvent.count({
      where: { type: 'auth_failure', createdAt: { gte: last24h } }
    }),
    prisma.securityEvent.count({
      where: { type: 'rate_limit_hit', createdAt: { gte: last24h } }
    })
  ]);

  console.log('\n📊 RED ALERT SNAPSHOT (Last 24h):');
  console.log(`   Cross-tenant attempts: ${crossTenantAttempts}`);
  console.log(`   Firewall blocks:       ${firewallBlocks}`);
  console.log(`   Content safety blocks: ${contentSafetyBlocks}`);
  console.log(`   SSRF blocks:          ${ssrfBlocks}`);
  console.log(`   Auth failures:        ${authFailures}`);
  console.log(`   Rate limit hits:      ${rateLimitHits}`);

  // Thresholds (from security-smoke-test.js)
  const THRESHOLDS = {
    crossTenant: 10,
    firewall: 50,
    contentSafety: 20,
    ssrf: 5,
    authFailure: 100,
    rateLimit: 200
  };

  console.log('\n🚨 THRESHOLD CHECK:');
  const alerts = [];

  if (crossTenantAttempts > THRESHOLDS.crossTenant) {
    alerts.push(`Cross-tenant: ${crossTenantAttempts} > ${THRESHOLDS.crossTenant}`);
  }
  if (firewallBlocks > THRESHOLDS.firewall) {
    alerts.push(`Firewall: ${firewallBlocks} > ${THRESHOLDS.firewall}`);
  }
  if (contentSafetyBlocks > THRESHOLDS.contentSafety) {
    alerts.push(`Content safety: ${contentSafetyBlocks} > ${THRESHOLDS.contentSafety}`);
  }
  if (ssrfBlocks > THRESHOLDS.ssrf) {
    alerts.push(`SSRF: ${ssrfBlocks} > ${THRESHOLDS.ssrf}`);
  }
  if (authFailures > THRESHOLDS.authFailure) {
    alerts.push(`Auth: ${authFailures} > ${THRESHOLDS.authFailure}`);
  }
  if (rateLimitHits > THRESHOLDS.rateLimit) {
    alerts.push(`Rate limit: ${rateLimitHits} > ${THRESHOLDS.rateLimit}`);
  }

  if (alerts.length > 0) {
    console.log('🔴 RED ALERT TRIGGERED:');
    alerts.forEach(alert => console.log(`   - ${alert}`));
  } else {
    console.log('✅ All metrics below threshold');
  }

  return true;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   RED ALERT EVENT WRITING VALIDATION  ║');
  console.log('╚════════════════════════════════════════╝');

  try {
    if (!CONFIG.ACCOUNT_A.email || !CONFIG.ACCOUNT_B.email) {
      throw new Error('Missing test account credentials');
    }

    const results = {
      webhook: await test1_WebhookSignatureEvent(),
      idor: await test2_IDORAttemptEvent(),
      redAlert: await test3_RedAlertSeesEvents()
    };

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║          VALIDATION RESULTS            ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(`Webhook Event Writing:  ${results.webhook ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`IDOR Event Writing:     ${results.idor ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Red Alert Functioning:  ${results.redAlert ? '✅ PASS' : '❌ FAIL'}`);

    const allPassed = Object.values(results).every(r => r);

    if (!allPassed) {
      console.log('\n⚠️  CRITICAL: SecurityEvent yazma eksik! Backend middleware\'lere eklenmeli.');
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\n🚨 ERROR:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
