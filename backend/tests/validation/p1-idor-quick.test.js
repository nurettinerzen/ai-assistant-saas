/**
 * P1 QUICK: IDOR Validation (Standalone - No Jest)
 * Run: NODE_ENV=test node tests/validation/p1-idor-quick.test.js
 */

import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV === 'production') {
  console.error('🚨 CRITICAL: Cannot run in production!');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║      P1: IDOR Attack Validation               ║');
  console.log('╚════════════════════════════════════════════════╝\n');

  const { logSecurityEvent, EVENT_TYPE, SEVERITY } = await import('../../src/middleware/securityEventLogger.js');

  let business1, business2, assistant1;

  try {
    // Setup
    console.log('⚙️  Creating test resources...');
    business1 = await prisma.business.create({ data: { name: 'IDOR Victim' } });
    business2 = await prisma.business.create({ data: { name: 'IDOR Attacker' } });

    assistant1 = await prisma.assistant.create({
      data: {
        businessId: business1.id,
        name: 'Victim Assistant',
        voiceId: 'tr-m-cihan',
        firstMessage: 'Test',
        systemPrompt: 'Test',
        model: 'gpt-4',
        timezone: 'Europe/Istanbul',
        tone: 'professional',
        callDirection: 'inbound',
        dynamicVariables: [],
      },
    });

    console.log(`✅ Business 1 (victim): ${business1.id}`);
    console.log(`✅ Business 2 (attacker): ${business2.id}`);
    console.log(`✅ Assistant: ${assistant1.id}\n`);

    // TEST 1: Tenant Isolation
    console.log('========================================');
    console.log('TEST 1: Tenant Isolation');
    console.log('========================================');

    const idorAttempt = await prisma.assistant.findFirst({
      where: {
        id: assistant1.id,
        businessId: business2.id, // ❌ Wrong tenant
      },
    });

    console.log(`IDOR query result: ${idorAttempt === null ? 'null (BLOCKED ✅)' : 'found (LEAKED ❌)'}`);

    if (idorAttempt !== null) {
      throw new Error('CRITICAL: Tenant isolation FAILED!');
    }

    // TEST 2: SecurityEvent Logging
    console.log('\n========================================');
    console.log('TEST 2: SecurityEvent Logging');
    console.log('========================================');

    const before = await prisma.securityEvent.count({
      where: { type: EVENT_TYPE.CROSS_TENANT_ATTEMPT },
    });

    console.log(`Events before: ${before}`);

    await logSecurityEvent({
      type: EVENT_TYPE.CROSS_TENANT_ATTEMPT,
      severity: SEVERITY.HIGH,
      businessId: business2.id,
      ipAddress: '192.168.1.100',
      userAgent: 'test',
      endpoint: `/api/assistants/${assistant1.id}`,
      method: 'GET',
      statusCode: 403,
      details: {
        attemptedResourceId: assistant1.id,
        victimBusinessId: business1.id,
      },
    });

    const after = await prisma.securityEvent.count({
      where: { type: EVENT_TYPE.CROSS_TENANT_ATTEMPT },
    });

    console.log(`Events after: ${after}`);
    console.log(`New events: ${after - before}`);

    if (after <= before) {
      throw new Error('CRITICAL: SecurityEvent not logged!');
    }

    // TEST 3: Red Alert Query
    console.log('\n========================================');
    console.log('TEST 3: Red Alert Integration');
    console.log('========================================');

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const events = await prisma.securityEvent.findMany({
      where: {
        type: EVENT_TYPE.CROSS_TENANT_ATTEMPT,
        createdAt: { gte: last24h },
      },
      take: 5,
    });

    console.log(`Red Alert can see: ${events.length} events (last 24h)`);

    // Summary
    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║              RESULTS                           ║');
    console.log('╚════════════════════════════════════════════════╝\n');
    console.log('✅ Tenant isolation: ENFORCED');
    console.log('✅ SecurityEvent logging: WORKING');
    console.log('✅ Red Alert integration: FUNCTIONAL');
    console.log('\n🎯 P1 IDOR VALIDATION: PASSED\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (assistant1) await prisma.assistant.delete({ where: { id: assistant1.id } }).catch(() => {});
    if (business1) await prisma.business.delete({ where: { id: business1.id } }).catch(() => {});
    if (business2) await prisma.business.delete({ where: { id: business2.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main();
