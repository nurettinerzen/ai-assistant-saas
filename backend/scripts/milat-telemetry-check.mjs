#!/usr/bin/env node
/**
 * Milat Telemetry Check
 * =====================
 * 48 saat strict telemetry izleme scripti.
 *
 * Kontrol ettikleri:
 * 1. guardrailAction dağılımı (PASS / SANITIZE / BLOCK / NEED_MIN_INFO_FOR_TOOL)
 * 2. SANITIZE/BLOCK ani yükseliş tespiti
 * 3. NEED_MIN_INFO_FOR_TOOL doğru yerlerde mi tetikleniyor
 * 4. messageType dağılımı (assistant_claim vs system_barrier vs clarification)
 *
 * Kullanım:
 *   node scripts/milat-telemetry-check.mjs              # son 1 saat
 *   node scripts/milat-telemetry-check.mjs --hours=24    # son 24 saat
 *   node scripts/milat-telemetry-check.mjs --hours=48    # son 48 saat
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const hours = parseInt(process.argv.find(a => a.startsWith('--hours='))?.split('=')[1] || '1');
const since = new Date(Date.now() - hours * 60 * 60 * 1000);

async function run() {
  console.log(`\n📊 Milat Telemetry Check — son ${hours} saat (since ${since.toISOString()})\n`);

  const logs = await prisma.chatLog.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, sessionId: true, channel: true, messages: true, createdAt: true },
    orderBy: { createdAt: 'desc' }
  });

  console.log(`Toplam session: ${logs.length}\n`);

  if (logs.length === 0) {
    console.log('⚠️  Bu zaman aralığında session bulunamadı.\n');
    await prisma.$disconnect();
    return;
  }

  // Tüm mesajları topla
  const allMessages = [];
  for (const log of logs) {
    const messages = Array.isArray(log.messages) ? log.messages : [];
    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.metadata) {
        allMessages.push({
          sessionId: log.sessionId,
          channel: log.channel,
          createdAt: log.createdAt,
          guardrailAction: msg.metadata.guardrailAction || 'UNKNOWN',
          messageType: msg.metadata.messageType || 'unknown',
          guardrailReason: msg.metadata.guardrailReason || null,
          blockReason: msg.metadata.blockReason || null,
          leakFilterDebug: msg.metadata.leakFilterDebug || null
        });
      }
    }
  }

  console.log(`Toplam assistant mesaj: ${allMessages.length}\n`);

  // 1. GuardrailAction dağılımı
  const actionCounts = {};
  for (const m of allMessages) {
    actionCounts[m.guardrailAction] = (actionCounts[m.guardrailAction] || 0) + 1;
  }
  console.log('━━━ 1. GuardrailAction Dağılımı ━━━');
  const total = allMessages.length || 1;
  for (const [action, count] of Object.entries(actionCounts).sort((a, b) => b[1] - a[1])) {
    const pct = ((count / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(pct / 2));
    console.log(`  ${action.padEnd(25)} ${String(count).padStart(4)}  (${pct}%) ${bar}`);
  }

  // 2. SANITIZE/BLOCK oranı — ani yükseliş uyarısı
  const sanitizeCount = actionCounts['SANITIZE'] || 0;
  const blockCount = actionCounts['BLOCK'] || 0;
  const alertPct = ((sanitizeCount + blockCount) / total) * 100;
  console.log(`\n━━━ 2. SANITIZE+BLOCK Oranı ━━━`);
  console.log(`  ${sanitizeCount + blockCount}/${total} (${alertPct.toFixed(1)}%)`);
  if (alertPct > 30) {
    console.log('  🔴 ALARM: SANITIZE+BLOCK oranı %30 üstünde! Bug olabilir.');
  } else if (alertPct > 15) {
    console.log('  🟡 DİKKAT: SANITIZE+BLOCK oranı %15 üstünde.');
  } else {
    console.log('  🟢 Normal aralıkta.');
  }

  // 3. NEED_MIN_INFO_FOR_TOOL detay
  const needMinInfoMsgs = allMessages.filter(m => m.guardrailAction === 'NEED_MIN_INFO_FOR_TOOL');
  console.log(`\n━━━ 3. NEED_MIN_INFO_FOR_TOOL Detayları ━━━`);
  console.log(`  Toplam: ${needMinInfoMsgs.length}`);
  if (needMinInfoMsgs.length > 0) {
    for (const m of needMinInfoMsgs.slice(0, 5)) {
      console.log(`  → session=${m.sessionId.slice(0, 12)}… reason=${m.guardrailReason || m.blockReason || '-'}`);
    }
    if (needMinInfoMsgs.length > 5) console.log(`  ... ve ${needMinInfoMsgs.length - 5} tane daha`);
  }

  // 4. BLOCK detay (varsa)
  const blockMsgs = allMessages.filter(m => m.guardrailAction === 'BLOCK');
  console.log(`\n━━━ 4. BLOCK Detayları ━━━`);
  console.log(`  Toplam: ${blockMsgs.length}`);
  if (blockMsgs.length > 0) {
    for (const m of blockMsgs.slice(0, 5)) {
      console.log(`  → session=${m.sessionId.slice(0, 12)}… reason=${m.blockReason || '-'} debug=${JSON.stringify(m.leakFilterDebug || {})}`);
    }
  }

  // 5. MessageType dağılımı
  const typeCounts = {};
  for (const m of allMessages) {
    typeCounts[m.messageType] = (typeCounts[m.messageType] || 0) + 1;
  }
  console.log(`\n━━━ 5. MessageType Dağılımı ━━━`);
  for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type.padEnd(30)} ${String(count).padStart(4)}`);
  }

  // 6. Channel dağılımı
  const channelCounts = {};
  for (const m of allMessages) {
    channelCounts[m.channel] = (channelCounts[m.channel] || 0) + 1;
  }
  console.log(`\n━━━ 6. Channel Dağılımı ━━━`);
  for (const [ch, count] of Object.entries(channelCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ch.padEnd(15)} ${String(count).padStart(4)}`);
  }

  console.log('\n✅ Telemetry check tamamlandı.\n');
  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
