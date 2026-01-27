/**
 * P0 TEST D: CRASH-SAFETY VERIFICATION
 *
 * Tests system recovery after hard crash (SIGKILL):
 * 1. Acquire 3 call slots
 * 2. Record state (Redis + DB)
 * 3. SIGKILL process (simulated crash)
 * 4. Wait for cleanup cron (10 minutes)
 * 5. Verify: global counter = 0, activeCalls = 0, no leaks
 *
 * This is a DESTRUCTIVE test - do NOT run in production!
 *
 * Usage:
 *   Phase 1: node scripts/test-crash-safety.js setup
 *   Phase 2: kill -9 <process_id>  (manual)
 *   Phase 3: Restart server, wait 10+ minutes
 *   Phase 4: node scripts/test-crash-safety.js verify
 */

import { PrismaClient } from '@prisma/client';
import globalCapacityManager from '../src/services/globalCapacityManager.js';
import concurrentCallManager from '../src/services/concurrentCallManager.js';
import fs from 'fs';

const prisma = new PrismaClient();

const STATE_FILE = '/tmp/p0-crash-test-state.json';
const TEST_BUSINESS_ID = 9001; // Reserved for crash test

const phase = process.argv[2] || 'setup';

console.log('\n🧪 P0 TEST D: CRASH-SAFETY VERIFICATION\n');
console.log(`Phase: ${phase.toUpperCase()}\n`);

/**
 * PHASE 1: Setup - Acquire slots and record state
 */
async function phaseSetup() {
  console.log('PHASE 1: SETUP\n');

  // Create test business
  await prisma.business.upsert({
    where: { id: TEST_BUSINESS_ID },
    update: {},
    create: {
      id: TEST_BUSINESS_ID,
      name: 'Crash Safety Test Business',
      language: 'TR',
      country: 'TR'
    }
  });

  await prisma.subscription.upsert({
    where: { businessId: TEST_BUSINESS_ID },
    update: {
      plan: 'PRO',
      status: 'ACTIVE',
      activeCalls: 0,
      concurrentLimit: 3
    },
    create: {
      businessId: TEST_BUSINESS_ID,
      plan: 'PRO',
      status: 'ACTIVE',
      activeCalls: 0,
      concurrentLimit: 3
    }
  });

  // Reset state
  await globalCapacityManager.connect();
  await globalCapacityManager.forceReset();

  console.log('✅ Test business created\n');

  // Acquire 3 slots
  console.log('📞 Acquiring 3 call slots...\n');

  const callIds = [];
  for (let i = 1; i <= 3; i++) {
    const callId = `crash_test_${Date.now()}_${i}`;
    const result = await concurrentCallManager.acquireSlot(
      TEST_BUSINESS_ID,
      callId,
      'outbound',
      { crashTest: true }
    );

    if (result.success) {
      callIds.push(callId);
      console.log(`   ✅ Slot ${i}/3 acquired: ${callId}`);
    } else {
      console.log(`   ❌ Slot ${i}/3 failed: ${result.error}`);
    }

    // Small delay to ensure ordering
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Record state
  const globalStatus = await globalCapacityManager.getGlobalStatus();
  const subscription = await prisma.subscription.findUnique({
    where: { businessId: TEST_BUSINESS_ID },
    select: { activeCalls: true }
  });

  const activeSessions = await prisma.activeCallSession.findMany({
    where: { businessId: TEST_BUSINESS_ID, status: 'active' }
  });

  const state = {
    timestamp: new Date().toISOString(),
    processId: process.pid,
    callIds,
    beforeCrash: {
      globalActive: globalStatus.active,
      businessActiveCalls: subscription.activeCalls,
      activeSessionsCount: activeSessions.length,
      activeSessions: activeSessions.map(s => ({
        callId: s.callId,
        startedAt: s.startedAt
      }))
    }
  };

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

  console.log('\n📊 State Before Crash:');
  console.log(`   Global Active: ${state.beforeCrash.globalActive}`);
  console.log(`   Business Active Calls: ${state.beforeCrash.businessActiveCalls}`);
  console.log(`   Active Sessions: ${state.beforeCrash.activeSessionsCount}`);
  console.log(`   Call IDs: ${callIds.join(', ')}`);
  console.log();

  console.log(`✅ State saved to: ${STATE_FILE}\n`);

  console.log('🔪 NEXT STEP: Kill this process with SIGKILL\n');
  console.log(`   Run: kill -9 ${process.pid}\n`);
  console.log('   Then restart the server and wait 10+ minutes for cleanup cron\n');
  console.log('   Finally run: node scripts/test-crash-safety.js verify\n');

  // Keep process alive
  console.log('⏳ Process running... (PID: ' + process.pid + ')\n');
  console.log('   Waiting for SIGKILL...\n');

  // Never exit - wait for kill signal
  setInterval(() => {}, 10000);
}

/**
 * PHASE 4: Verify - Check system recovered after crash + cleanup
 */
async function phaseVerify() {
  console.log('PHASE 4: VERIFY\n');

  if (!fs.existsSync(STATE_FILE)) {
    console.log('❌ State file not found. Run setup phase first.\n');
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

  console.log('📊 State Before Crash (recorded):');
  console.log(`   Global Active: ${state.beforeCrash.globalActive}`);
  console.log(`   Business Active Calls: ${state.beforeCrash.businessActiveCalls}`);
  console.log(`   Active Sessions: ${state.beforeCrash.activeSessionsCount}`);
  console.log(`   Call IDs: ${state.callIds.join(', ')}`);
  console.log();

  const crashTime = new Date(state.timestamp);
  const now = new Date();
  const minutesSinceCrash = Math.floor((now - crashTime) / 1000 / 60);

  console.log(`⏱️  Time since crash: ${minutesSinceCrash} minutes\n`);

  if (minutesSinceCrash < 10) {
    console.log(`⚠️  Warning: Only ${minutesSinceCrash} minutes since crash`);
    console.log('   Cleanup cron runs every 10 minutes');
    console.log('   Wait a bit longer for accurate results\n');
  }

  // Check current state
  await globalCapacityManager.connect();

  const globalStatus = await globalCapacityManager.getGlobalStatus();
  const subscription = await prisma.subscription.findUnique({
    where: { businessId: TEST_BUSINESS_ID },
    select: { activeCalls: true }
  });

  const activeSessions = await prisma.activeCallSession.findMany({
    where: { businessId: TEST_BUSINESS_ID, status: 'active' }
  });

  console.log('📊 State After Crash + Cleanup:');
  console.log(`   Global Active: ${globalStatus.active}`);
  console.log(`   Business Active Calls: ${subscription.activeCalls}`);
  console.log(`   Active Sessions: ${activeSessions.length}`);
  console.log();

  // Check for leaks in call IDs
  const leakedCalls = state.callIds.filter(callId =>
    activeSessions.some(s => s.callId === callId)
  );

  console.log('🔍 Leak Detection:');
  if (leakedCalls.length > 0) {
    console.log(`   ❌ Leaked calls still active: ${leakedCalls.join(', ')}`);
  } else {
    console.log(`   ✅ No leaked calls from before crash`);
  }
  console.log();

  // Check cleanup status
  const cleanedSessions = await prisma.activeCallSession.findMany({
    where: {
      businessId: TEST_BUSINESS_ID,
      callId: { in: state.callIds }
    }
  });

  console.log('🧹 Cleanup Status:');
  for (const callId of state.callIds) {
    const session = cleanedSessions.find(s => s.callId === callId);
    if (session) {
      console.log(`   ${callId}: status=${session.status}, endedAt=${session.endedAt ? 'yes' : 'no'}`);
    } else {
      console.log(`   ${callId}: NOT FOUND (deleted?)`);
    }
  }
  console.log();

  // Test result
  const passed =
    globalStatus.active === 0 &&
    subscription.activeCalls === 0 &&
    activeSessions.length === 0 &&
    leakedCalls.length === 0;

  console.log('='.repeat(60));
  console.log('TEST RESULT');
  console.log('='.repeat(60));

  console.log(`Global Counter: ${globalStatus.active === 0 ? '✅' : '❌'} (expected 0, got ${globalStatus.active})`);
  console.log(`Business Counter: ${subscription.activeCalls === 0 ? '✅' : '❌'} (expected 0, got ${subscription.activeCalls})`);
  console.log(`Active Sessions: ${activeSessions.length === 0 ? '✅' : '❌'} (expected 0, got ${activeSessions.length})`);
  console.log(`No Leaks: ${leakedCalls.length === 0 ? '✅' : '❌'} (leaked: ${leakedCalls.length})`);

  console.log('='.repeat(60));

  if (passed) {
    console.log('🎉 TEST D PASSED: Crash-safety verified!\n');
    console.log('   System correctly recovered from hard crash');
    console.log('   All slots released, no leaks detected\n');
  } else {
    console.log('❌ TEST D FAILED: Leaks or inconsistencies detected\n');
    console.log('   Check cleanup cron logs');
    console.log('   Verify cleanup ran (check last 10 min logs)\n');
  }

  // Cleanup
  fs.unlinkSync(STATE_FILE);
  console.log(`🧹 Cleaned up state file: ${STATE_FILE}\n`);

  process.exit(passed ? 0 : 1);
}

/**
 * Main
 */
async function main() {
  try {
    if (phase === 'setup') {
      await phaseSetup();
    } else if (phase === 'verify') {
      await phaseVerify();
    } else {
      console.log('❌ Invalid phase. Use: setup or verify\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
    process.exit(1);
  } finally {
    if (phase !== 'setup') {
      await prisma.$disconnect();
      await globalCapacityManager.disconnect();
    }
  }
}

main();
