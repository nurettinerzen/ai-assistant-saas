import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

process.env.NODE_ENV = 'test';
process.env.ELEVENLABS_API_KEY = '';

const prisma = new PrismaClient();
const { default: app } = await import('../../src/server.js');

function nowSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function printResult(status, id, detail) {
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} ${status} ${id} - ${detail}`);
}

function hasPlaceholder(text) {
  return /\{\{[^}]+\}\}/.test(String(text || ''));
}

async function requestJson(baseUrl, method, path, body, headers = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: controller.signal
  }).finally(() => clearTimeout(timeout));

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
}

async function main() {
  const suffix = nowSuffix();
  const email = `assistant-smoke-${suffix}@example.com`;
  const embedKey = `emb_${crypto.randomBytes(12).toString('hex')}`;

  const business = await prisma.business.create({
    data: {
      name: `Assistant Smoke ${suffix}`,
      chatEmbedKey: embedKey,
      chatWidgetEnabled: true
    }
  });

  const user = await prisma.user.create({
    data: {
      email,
      password: 'smoke-test-not-used',
      role: 'OWNER',
      businessId: business.id,
      emailVerified: true
    }
  });

  await prisma.subscription.create({
    data: {
      businessId: business.id,
      plan: 'ENTERPRISE',
      status: 'ACTIVE'
    }
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, businessId: business.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const auth = { Authorization: `Bearer ${token}` };
  const results = [];
  let firstTextId = null;
  let secondTextId = null;
  let phoneAssistantId = null;
  const server = app.listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 1) Create text assistant
    const textCreateRes = await requestJson(baseUrl, 'POST', '/api/assistants', {
        name: 'Yazi Smoke 1',
        assistantType: 'text',
        systemPrompt: 'Kisa ve net cevap ver.',
        language: 'TR',
        tone: 'professional',
        customNotes: 'Smoke note'
      }, auth);

    firstTextId = textCreateRes.data?.assistant?.id || null;
    const createTextPass =
      textCreateRes.status === 200 &&
      firstTextId &&
      textCreateRes.data?.assistant?.assistantType === 'text' &&
      textCreateRes.data?.assistant?.voiceId === null &&
      textCreateRes.data?.assistant?.elevenLabsAgentId === null;

    results.push({
      id: 'API_TEXT_CREATE',
      status: createTextPass ? 'PASS' : 'FAIL',
      detail: `status=${textCreateRes.status}`
    });

    // 2) Update text assistant with voice fields (must be ignored)
    let updateTextPass = false;
    if (firstTextId) {
      const textUpdateRes = await requestJson(baseUrl, 'PUT', `/api/assistants/${firstTextId}`, {
          name: 'Yazi Smoke 1 Updated',
          systemPrompt: 'Guncel talimat',
          tone: 'professional',
          customNotes: 'Updated note',
          voiceId: 'tr-f-ecem',
          firstMessage: 'Should be ignored'
        }, auth);

      const refreshed = await prisma.assistant.findUnique({
        where: { id: firstTextId },
        select: { voiceId: true, elevenLabsAgentId: true, firstMessage: true }
      });

      updateTextPass =
        textUpdateRes.status === 200 &&
        refreshed?.voiceId === null &&
        refreshed?.elevenLabsAgentId === null &&
        refreshed?.firstMessage === null;

      results.push({
        id: 'API_TEXT_UPDATE_IGNORES_PHONE_FIELDS',
        status: updateTextPass ? 'PASS' : 'FAIL',
        detail: `status=${textUpdateRes.status}, voiceId=${String(refreshed?.voiceId)}`
      });
    } else {
      results.push({
        id: 'API_TEXT_UPDATE_IGNORES_PHONE_FIELDS',
        status: 'FAIL',
        detail: 'text assistant create failed; update skipped'
      });
    }

    // 3) Create second text assistant (regression scenario)
    const secondTextRes = await requestJson(baseUrl, 'POST', '/api/assistants', {
        name: 'Yazi Smoke 2',
        assistantType: 'text',
        systemPrompt: 'Ikinci text asistan.',
        language: 'TR',
        tone: 'professional'
      }, auth);

    secondTextId = secondTextRes.data?.assistant?.id || null;
    const secondTextPass = secondTextRes.status === 200 && !!secondTextId;
    results.push({
      id: 'API_SECOND_TEXT_ASSISTANT',
      status: secondTextPass ? 'PASS' : 'FAIL',
      detail: `status=${secondTextRes.status}`
    });

    // 4) Phone assistant without voiceId (expect 4xx validation)
    const phoneNoVoiceRes = await requestJson(baseUrl, 'POST', '/api/assistants', {
        name: 'Phone No Voice',
        assistantType: 'phone',
        systemPrompt: 'Telefon testi',
        language: 'TR',
        callDirection: 'outbound',
        callPurpose: 'general'
      }, auth);

    const phoneNoVoicePass = phoneNoVoiceRes.status >= 400 && phoneNoVoiceRes.status < 500;
    phoneAssistantId = phoneNoVoiceRes.data?.assistant?.id || null;
    results.push({
      id: 'API_PHONE_CREATE_WITHOUT_VOICE_RETURNS_4XX',
      status: phoneNoVoicePass ? 'PASS' : 'FAIL',
      detail: `status=${phoneNoVoiceRes.status}`
    });

    // 5) V1 outbound-only: inbound create must fail-closed
    const inboundCreateRes = await requestJson(baseUrl, 'POST', '/api/assistants', {
        name: 'Inbound Blocked',
        assistantType: 'phone',
        systemPrompt: 'Inbound should be blocked in V1.',
        language: 'TR',
        callDirection: 'inbound'
      }, auth);

    const inboundCreatePass =
      inboundCreateRes.status === 403 &&
      inboundCreateRes.data?.error === 'OUTBOUND_ONLY_V1';
    results.push({
      id: 'API_INBOUND_CREATE_FAIL_CLOSED',
      status: inboundCreatePass ? 'PASS' : 'FAIL',
      detail: `status=${inboundCreateRes.status}, error=${inboundCreateRes.data?.error || 'none'}`
    });

    // 6) V1 outbound-only: inbound update must fail-closed
    if (firstTextId) {
      const inboundUpdateRes = await requestJson(baseUrl, 'PUT', `/api/assistants/${firstTextId}`, {
          callDirection: 'inbound'
        }, auth);

      const inboundUpdatePass =
        inboundUpdateRes.status === 403 &&
        inboundUpdateRes.data?.error === 'OUTBOUND_ONLY_V1';
      results.push({
        id: 'API_INBOUND_UPDATE_FAIL_CLOSED',
        status: inboundUpdatePass ? 'PASS' : 'FAIL',
        detail: `status=${inboundUpdateRes.status}, error=${inboundUpdateRes.data?.error || 'none'}`
      });
    } else {
      results.push({
        id: 'API_INBOUND_UPDATE_FAIL_CLOSED',
        status: 'FAIL',
        detail: 'text assistant create failed; inbound update test skipped'
      });
    }

    // 7) Widget status should resolve to text assistant
    const statusRes = await requestJson(baseUrl, 'GET', `/api/chat-v2/widget/status/embed/${embedKey}`);

    const statusAssistantId = statusRes.data?.assistantId || null;
    const statusPass =
      statusRes.status === 200 &&
      statusRes.data?.active === true &&
      statusAssistantId &&
      (!secondTextId || statusAssistantId === secondTextId);

    results.push({
      id: 'WIDGET_STATUS_RESOLVES_TEXT_ASSISTANT',
      status: statusPass ? 'PASS' : 'FAIL',
      detail: `status=${statusRes.status}, assistantId=${statusAssistantId || 'none'}`
    });

    if (statusAssistantId) {
      const selected = await prisma.assistant.findUnique({
        where: { id: statusAssistantId },
        select: { assistantType: true }
      });
      const selectedTypePass = selected?.assistantType === 'text';
      results.push({
        id: 'WIDGET_SELECTED_ASSISTANT_TYPE_IS_TEXT',
        status: selectedTypePass ? 'PASS' : 'FAIL',
        detail: `assistantType=${selected?.assistantType || 'none'}`
      });
    } else {
      results.push({
        id: 'WIDGET_SELECTED_ASSISTANT_TYPE_IS_TEXT',
        status: 'FAIL',
        detail: 'status endpoint returned no assistantId'
      });
    }

    // 8) Sync endpoint must be blocked for text assistant
    if (firstTextId) {
      const syncTextRes = await requestJson(baseUrl, 'POST', `/api/assistants/${firstTextId}/sync`, {}, auth);

      const syncBlockedPass = syncTextRes.status === 400;
      results.push({
        id: 'TEXT_SYNC_BLOCKED',
        status: syncBlockedPass ? 'PASS' : 'FAIL',
        detail: `status=${syncTextRes.status}`
      });
    } else {
      results.push({
        id: 'TEXT_SYNC_BLOCKED',
        status: 'FAIL',
        detail: 'text assistant create failed; sync test skipped'
      });
    }

    // 9) Widget message smoke ('selam') + placeholder guard
    const widgetRes = await requestJson(baseUrl, 'POST', '/api/chat-v2/widget', {
        embedKey,
        sessionId: `smoke_${suffix}`,
        message: 'selam'
      });

    const reply = widgetRes.data?.reply || '';
    const widgetPass =
      widgetRes.status === 200 &&
      typeof reply === 'string' &&
      reply.length > 0 &&
      !hasPlaceholder(reply);

    results.push({
      id: 'WIDGET_SELAM_NO_PLACEHOLDER',
      status: widgetPass ? 'PASS' : 'FAIL',
      detail: `status=${widgetRes.status}, hasPlaceholder=${hasPlaceholder(reply)}`
    });

    const failCount = results.filter((r) => r.status === 'FAIL').length;
    for (const item of results) {
      printResult(item.status, item.id, item.detail);
    }

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));

    // If phone assistant creation unexpectedly succeeded, remove via API route
    // so associated 11Labs agent is cleaned up too.
    if (phoneAssistantId) {
      await requestJson(baseUrl, 'DELETE', `/api/assistants/${phoneAssistantId}`, undefined, auth).catch(() => {});
    }

    // Cleanup
    await prisma.chatLog.deleteMany({ where: { businessId: business.id } }).catch(() => {});
    await prisma.sessionMapping.deleteMany({ where: { businessId: business.id } }).catch(() => {});
    await prisma.conversationState.deleteMany({ where: { businessId: business.id } }).catch(() => {});
    await prisma.toolExecution.deleteMany({ where: { businessId: business.id } }).catch(() => {});
    await prisma.outboundMessage.deleteMany({ where: { businessId: business.id } }).catch(() => {});
    await prisma.assistant.deleteMany({ where: { businessId: business.id } }).catch(() => {});
    await prisma.subscription.deleteMany({ where: { businessId: business.id } }).catch(() => {});
    await prisma.user.deleteMany({ where: { businessId: business.id } }).catch(() => {});
    await prisma.business.deleteMany({ where: { id: business.id } }).catch(() => {});
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error('API smoke failed:', error);
  process.exitCode = 1;
  await prisma.$disconnect().catch(() => {});
});
