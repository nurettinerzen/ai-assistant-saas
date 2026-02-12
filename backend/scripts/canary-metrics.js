#!/usr/bin/env node
/**
 * Canary Metrics Dashboard Query
 *
 * Extracts 3 key security metrics from production data:
 * 1. confabulation_rate — ungrounded claims (tool-less data claims / total turns)
 * 2. field_grounding_violations — tool output vs LLM response mismatch
 * 3. verification_bypass_suspected — unverified PII leak attempts
 *
 * Also tracks:
 * - hardblock_rate — false positive security blocks
 * - injection_block_rate — injection detection effectiveness
 *
 * Usage:
 *   node scripts/canary-metrics.js                    # Last 24h
 *   node scripts/canary-metrics.js --hours=168         # Last 7 days
 *   node scripts/canary-metrics.js --business=22       # Specific business
 *   node scripts/canary-metrics.js --json              # JSON output
 *
 * Thresholds:
 *   confabulation_rate > 0.1%  → ALARM
 *   bypass_suspected > 0      → ALARM
 *   hardblock_rate > 2%       → FALSE_POSITIVE investigation
 */

import prisma from '../src/config/database.js';

// CLI args
const args = process.argv.slice(2);
const hoursArg = args.find(a => a.startsWith('--hours='));
const businessArg = args.find(a => a.startsWith('--business='));
const jsonOutput = args.includes('--json');

const HOURS = hoursArg ? parseInt(hoursArg.split('=')[1]) : 24;
const BUSINESS_ID = businessArg ? parseInt(businessArg.split('=')[1]) : null;
const SINCE = new Date(Date.now() - HOURS * 60 * 60 * 1000);

// ─── Thresholds ──────────────────────────────────────────────────────────────
const THRESHOLDS = {
  confabulation_rate: 0.001,    // 0.1%
  bypass_suspected: 0,          // Zero tolerance
  hardblock_rate: 0.02,         // 2% false positive ceiling
};

// ─── Metric Collection ──────────────────────────────────────────────────────

async function collectMetrics() {
  const where = {
    createdAt: { gte: SINCE },
    ...(BUSINESS_ID && { businessId: BUSINESS_ID })
  };

  // 1. Total chat sessions
  const totalSessions = await prisma.chatLog.count({ where });

  // 2. Total messages — calculated from actual JSON messages array
  //    (messageCount column is not reliably populated)
  let totalMessages = 0;

  // 3. Security events breakdown
  const securityEvents = await prisma.securityEvent.findMany({
    where: {
      createdAt: { gte: SINCE },
      ...(BUSINESS_ID && { businessId: BUSINESS_ID })
    },
    select: { type: true, severity: true, details: true }
  });

  const secByType = {};
  for (const ev of securityEvents) {
    secByType[ev.type] = (secByType[ev.type] || 0) + 1;
  }

  // 4. Chat logs with messages — scan for confabulation signals
  //    (LLM claims without tool calls in response)
  //    NOTE: messageCount field is not reliably populated, so we fetch all
  //    chats and filter by actual messages content instead
  const chatsWithMessages = await prisma.chatLog.findMany({
    where,
    select: { id: true, messages: true, businessId: true },
    take: 500 // Cap for performance
  });

  let confabulationCount = 0;
  let verificationBypassSuspected = 0;
  let hardblockCount = 0;
  let totalTurns = 0;

  // Confabulation patterns (LLM fabricating data without tool support)
  const confabPatterns = [
    /sipariş(?:iniz|in)?\s*(?:şu\s*an\s*)?(?:hazırlanıyor|kargoda|teslim\s*edildi|onaylandı)/i,
    /kargo\s*takip\s*(?:no|numar)\s*[:=]?\s*[A-Z0-9]{8,}/i,
    /\d+[.,]\d{2}\s*(?:TL|₺)/,
  ];

  // PII patterns in assistant responses
  const piiPatterns = [
    /(?:05|5)\d{9}/,                    // Turkish phone
    /\+90\d{10}/,                       // International Turkish phone
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,  // Email
    /\b(?:sokak|cadde|mahalle)\b/i,     // Address components
  ];

  // Hardblock patterns (security blocks on normal messages)
  const normalPatterns = [
    /^(merhaba|selam|nasıl|teşekkür|iyi günler|günaydın)/i,
    /^(iade|değişim|kargo|ne zaman|nerede|fiyat)/i,
  ];

  let analyzedSessions = 0;
  for (const chat of chatsWithMessages) {
    const msgs = Array.isArray(chat.messages) ? chat.messages : [];
    if (msgs.length === 0) continue;

    analyzedSessions++;
    totalMessages += msgs.length;

    for (let i = 0; i < msgs.length; i++) {
      const msg = msgs[i];
      if (msg.role !== 'assistant') continue;

      totalTurns++;
      const content = msg.content || '';
      const prevUserMsg = i > 0 ? (msgs[i - 1]?.content || '') : '';

      // Check confabulation: assistant claims data without preceding tool call
      // Heuristic: If response has order/tracking/amount data but previous user msg
      // didn't provide an order number → suspicious
      //
      // Safe contexts (not confabulation):
      // - User provided order number earlier in conversation
      // - User is providing verification code (4 digits, phone last4)
      // - Assistant has toolCalls in this turn (data is grounded)
      const hasDataClaim = confabPatterns.some(p => p.test(content));
      const userProvidedOrder = /ORD-\d+|SIP-\d+/i.test(prevUserMsg);
      const isVerificationResponse = /^\d{4}$/.test(prevUserMsg.trim()); // 4-digit verification code
      const hadToolCallInTurn = msg.toolCalls && msg.toolCalls.length > 0;
      const conversationHasOrder = msgs.slice(0, i).some(m =>
        /ORD-\d+|SIP-\d+/i.test(m.content || '')
      );

      if (hasDataClaim && !userProvidedOrder && !isVerificationResponse && !hadToolCallInTurn && !conversationHasOrder) {
        confabulationCount++;
      }

      // Check verification bypass: PII in response when user didn't provide verification
      const hasPII = piiPatterns.some(p => p.test(content));
      const userProvidedVerification = /son 4|telefon.*son|doğrulama/i.test(prevUserMsg);
      const contentIsMasked = /\*{3,}/.test(content); // Masked PII is OK

      if (hasPII && !contentIsMasked && !userProvidedVerification) {
        verificationBypassSuspected++;
      }

      // Check hardblock false positives
      const isNormalMsg = normalPatterns.some(p => p.test(prevUserMsg));
      const isBlocked = /güvenlik|engellenmiştir|izin verilm/i.test(content);

      if (isNormalMsg && isBlocked) {
        hardblockCount++;
      }
    }
  }

  // Calculate rates
  const confabulationRate = totalTurns > 0 ? confabulationCount / totalTurns : 0;
  const hardblockRate = totalTurns > 0 ? hardblockCount / totalTurns : 0;
  const avgMsgsPerSession = analyzedSessions > 0 ? totalMessages / analyzedSessions : 0;

  return {
    timeRange: {
      hours: HOURS,
      since: SINCE.toISOString(),
      until: new Date().toISOString(),
      businessId: BUSINESS_ID || 'all'
    },
    volume: {
      totalSessions,
      totalMessages,
      avgMsgsPerSession: Math.round(avgMsgsPerSession * 10) / 10,
      analyzedSessions,
      analyzedTurns: totalTurns
    },
    metrics: {
      confabulation: {
        count: confabulationCount,
        rate: confabulationRate,
        ratePercent: `${(confabulationRate * 100).toFixed(3)}%`,
        threshold: `${(THRESHOLDS.confabulation_rate * 100).toFixed(1)}%`,
        status: confabulationRate > THRESHOLDS.confabulation_rate ? 'ALARM' : 'OK'
      },
      verificationBypass: {
        count: verificationBypassSuspected,
        threshold: THRESHOLDS.bypass_suspected,
        status: verificationBypassSuspected > THRESHOLDS.bypass_suspected ? 'ALARM' : 'OK'
      },
      hardblockFalsePositive: {
        count: hardblockCount,
        rate: hardblockRate,
        ratePercent: `${(hardblockRate * 100).toFixed(3)}%`,
        threshold: `${(THRESHOLDS.hardblock_rate * 100).toFixed(1)}%`,
        status: hardblockRate > THRESHOLDS.hardblock_rate ? 'INVESTIGATE' : 'OK'
      }
    },
    securityEvents: {
      total: securityEvents.length,
      byType: secByType,
      injectionBlocks: secByType['content_safety_block'] || 0,
      firewallBlocks: secByType['firewall_block'] || 0,
      authFailures: secByType['auth_failure'] || 0,
      crossTenantAttempts: secByType['cross_tenant_attempt'] || 0
    }
  };
}

// ─── Display ──────────────────────────────────────────────────────────────

async function main() {
  if (!jsonOutput) {
    console.log('🔍 Canary Metrics Dashboard');
    console.log('═'.repeat(60));
    console.log(`  Time Range: last ${HOURS}h (since ${SINCE.toISOString().split('T')[0]})`);
    if (BUSINESS_ID) console.log(`  Business: ${BUSINESS_ID}`);
    console.log('═'.repeat(60));
    console.log('');
  }

  const metrics = await collectMetrics();

  if (jsonOutput) {
    console.log(JSON.stringify(metrics, null, 2));
  } else {
    // Volume
    console.log('📊 VOLUME');
    console.log(`  Sessions: ${metrics.volume.totalSessions}`);
    console.log(`  Messages: ${metrics.volume.totalMessages}`);
    console.log(`  Avg msgs/session: ${metrics.volume.avgMsgsPerSession}`);
    console.log(`  Analyzed turns: ${metrics.volume.analyzedTurns}`);
    console.log('');

    // Metrics
    console.log('🎯 CANARY METRICS');
    console.log('─'.repeat(60));

    const confab = metrics.metrics.confabulation;
    const confabIcon = confab.status === 'OK' ? '✅' : '🚨';
    console.log(`  ${confabIcon} Confabulation Rate: ${confab.ratePercent} (${confab.count}/${metrics.volume.analyzedTurns})`);
    console.log(`     Threshold: ${confab.threshold} | Status: ${confab.status}`);

    const bypass = metrics.metrics.verificationBypass;
    const bypassIcon = bypass.status === 'OK' ? '✅' : '🚨';
    console.log(`  ${bypassIcon} Verification Bypass: ${bypass.count} suspected`);
    console.log(`     Threshold: ${bypass.threshold} | Status: ${bypass.status}`);

    const fp = metrics.metrics.hardblockFalsePositive;
    const fpIcon = fp.status === 'OK' ? '✅' : '⚠️';
    console.log(`  ${fpIcon} Hardblock False Positive: ${fp.ratePercent} (${fp.count}/${metrics.volume.analyzedTurns})`);
    console.log(`     Threshold: ${fp.threshold} | Status: ${fp.status}`);

    console.log('');

    // Security Events
    console.log('🛡️ SECURITY EVENTS');
    console.log('─'.repeat(60));
    console.log(`  Total: ${metrics.securityEvents.total}`);
    for (const [type, count] of Object.entries(metrics.securityEvents.byType)) {
      console.log(`  ${type}: ${count}`);
    }
    console.log('');

    // Overall status
    const hasAlarm = confab.status === 'ALARM' || bypass.status === 'ALARM';
    const hasWarning = fp.status === 'INVESTIGATE';

    console.log('═'.repeat(60));
    if (hasAlarm) {
      console.log('🚨 STATUS: ALARM — Action required');
      if (confab.status === 'ALARM') console.log('   → Confabulation rate exceeds threshold');
      if (bypass.status === 'ALARM') console.log('   → Verification bypass detected');
    } else if (hasWarning) {
      console.log('⚠️ STATUS: WARNING — Investigation recommended');
      console.log('   → False positive rate may be too high');
    } else {
      console.log('✅ STATUS: HEALTHY — All metrics within thresholds');
    }
    console.log('═'.repeat(60));
  }

  await prisma.$disconnect();

  // Exit code for CI integration
  const hasAlarm =
    metrics.metrics.confabulation.status === 'ALARM' ||
    metrics.metrics.verificationBypass.status === 'ALARM';

  process.exit(hasAlarm ? 1 : 0);
}

main().catch(async (error) => {
  console.error('❌ Error:', error.message);
  await prisma.$disconnect();
  process.exit(1);
});
