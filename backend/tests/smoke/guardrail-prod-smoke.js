#!/usr/bin/env node
/**
 * P0 Launch Gate - Prod Smoke (Embed Key)
 *
 * Validates for each turn:
 * - metadata.guardrailAction exists
 * - metadata.LLM_CALLED === true
 * - metadata.llm_call_reason in CHAT|WHATSAPP|EMAIL
 * - metadata.bypassed === false
 *
 * Run:
 *   EMBED_KEY=emb_xxx API_URL=https://ai-assistant-saas.onrender.com node tests/smoke/guardrail-prod-smoke.js
 */

const API_URL = process.env.API_URL || 'https://ai-assistant-saas.onrender.com';
const EMBED_KEY = process.env.EMBED_KEY || process.env.GUARDRAIL_SMOKE_EMBED_KEY;
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 30000);
const WAIT_BETWEEN_MS = Number(process.env.SMOKE_WAIT_MS || 1500);
const VALID_REASONS = new Set(['CHAT', 'WHATSAPP', 'EMAIL']);

if (!EMBED_KEY) {
  console.error('❌ EMBED_KEY (or GUARDRAIL_SMOKE_EMBED_KEY) is required');
  process.exit(1);
}

const CASES = [
  { id: '01', message: 'selam' },
  { id: '02', message: 'naber' },
  { id: '03', message: 'Telyx nedir?', expectNoTool: true },
  { id: '04', message: 'Telyx’in özellikleri neler?', expectNoTool: true },
  { id: '05', message: 'Telyx nasıl kullanılır?' },
  { id: '06', message: 'Telefon görüşmesi yapabiliyor muyum?' },
  { id: '07', message: 'WhatsApp entegrasyonu var mı?' },
  { id: '08', message: 'Fiyatlar nedir?' },
  { id: '09', message: 'Siparişimin durumu nedir?' },
  { id: '10', message: 'Geri arama istiyorum, numaram 05551234567', expectTool: 'create_callback' }
];

function normalizeToolCalls(responseJson) {
  const calls = responseJson?.toolCalls || responseJson?.toolsCalled || [];
  return Array.isArray(calls) ? calls : [];
}

function summarizeResult(testCase, responseJson) {
  const metadata = responseJson?.metadata || {};
  const toolCalls = normalizeToolCalls(responseJson);

  return {
    id: testCase.id,
    message: testCase.message,
    success: !!responseJson?.success,
    guardrailAction: metadata.guardrailAction || null,
    LLM_CALLED: metadata.LLM_CALLED === true,
    llm_call_reason: metadata.llm_call_reason || null,
    bypassed: metadata.bypassed,
    toolCalls,
    replyPreview: String(responseJson?.reply || '').slice(0, 120)
  };
}

function validateCase(testCase, summary) {
  const errors = [];

  if (!summary.guardrailAction) {
    errors.push('metadata.guardrailAction missing');
  }
  if (summary.LLM_CALLED !== true) {
    errors.push(`metadata.LLM_CALLED=${summary.LLM_CALLED}, expected=true`);
  }
  if (!VALID_REASONS.has(String(summary.llm_call_reason || '').toUpperCase())) {
    errors.push(`metadata.llm_call_reason=${summary.llm_call_reason}, expected one of CHAT|WHATSAPP|EMAIL`);
  }
  if (summary.bypassed !== false) {
    errors.push(`metadata.bypassed=${summary.bypassed}, expected=false`);
  }

  if (testCase.expectNoTool && summary.toolCalls.length > 0) {
    errors.push(`toolCalls should be empty, got=[${summary.toolCalls.join(', ')}]`);
  }

  if (testCase.expectTool && !summary.toolCalls.includes(testCase.expectTool)) {
    errors.push(`expected tool "${testCase.expectTool}" not called (toolCalls=[${summary.toolCalls.join(', ')}])`);
  }

  return errors;
}

async function sendMessage({ message, sessionId }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${API_URL}/api/chat-v2/widget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        embedKey: EMBED_KEY,
        sessionId,
        message
      }),
      signal: controller.signal
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(body)}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function writeReport(rows, failures) {
  const fs = await import('fs');
  const reportDir = new URL('../pilot/reports/', import.meta.url).pathname;
  try {
    fs.mkdirSync(reportDir, { recursive: true });
  } catch {
    // noop
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = `${reportDir}guardrail-smoke-${timestamp}.txt`;
  const lines = [
    `P0 Launch Gate Prod Smoke — ${new Date().toISOString()}`,
    `API: ${API_URL}`,
    `Cases: ${rows.length}`,
    ''
  ];

  for (const row of rows) {
    lines.push(`[${row.id}] ${row.message}`);
    lines.push(`  guardrailAction=${row.guardrailAction}`);
    lines.push(`  LLM_CALLED=${row.LLM_CALLED}`);
    lines.push(`  llm_call_reason=${row.llm_call_reason}`);
    lines.push(`  bypassed=${row.bypassed}`);
    lines.push(`  toolCalls=${row.toolCalls.join(', ') || '-'}`);
    lines.push(`  reply="${row.replyPreview}"`);
    lines.push('');
  }

  if (failures.length > 0) {
    lines.push('FAILURES:');
    for (const failure of failures) {
      lines.push(`- [${failure.id}] ${failure.message}`);
      for (const err of failure.errors) {
        lines.push(`  * ${err}`);
      }
    }
    lines.push('');
  } else {
    lines.push('All launch-gate checks passed.');
    lines.push('');
  }

  fs.writeFileSync(reportPath, lines.join('\n'));
  return reportPath;
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  P0 Launch Gate Prod Smoke');
  console.log(`  API: ${API_URL}`);
  console.log(`  Time: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  const rows = [];
  const failures = [];

  for (let i = 0; i < CASES.length; i += 1) {
    const testCase = CASES[i];
    const sessionId = `p0_launch_gate_${Date.now()}_${testCase.id}`;

    try {
      const responseJson = await sendMessage({
        message: testCase.message,
        sessionId
      });
      const summary = summarizeResult(testCase, responseJson);
      const errors = validateCase(testCase, summary);
      rows.push(summary);

      if (errors.length > 0) {
        failures.push({
          id: testCase.id,
          message: testCase.message,
          errors
        });
        console.log(`❌ [${testCase.id}] ${testCase.message}`);
        for (const err of errors) {
          console.log(`   - ${err}`);
        }
      } else {
        console.log(
          `✅ [${testCase.id}] action=${summary.guardrailAction} LLM_CALLED=${summary.LLM_CALLED} reason=${summary.llm_call_reason} bypassed=${summary.bypassed} tools=${summary.toolCalls.join(',') || '-'}`
        );
      }
    } catch (error) {
      failures.push({
        id: testCase.id,
        message: testCase.message,
        errors: [error.message]
      });
      console.log(`❌ [${testCase.id}] ${testCase.message}`);
      console.log(`   - ${error.message}`);
    }

    if (i < CASES.length - 1) {
      await new Promise(resolve => setTimeout(resolve, WAIT_BETWEEN_MS));
    }
  }

  const reportPath = await writeReport(rows, failures);

  console.log('');
  console.log('───────────────────────────────────────────────────');
  console.log(`Result: ${rows.length - failures.length}/${rows.length} passed`);
  console.log(`Report: ${reportPath}`);
  if (failures.length > 0) {
    console.log(`Failed: ${failures.length}`);
  }
  console.log('───────────────────────────────────────────────────');
  console.log('');

  process.exit(failures.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
