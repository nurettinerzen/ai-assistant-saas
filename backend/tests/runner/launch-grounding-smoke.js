import crypto from 'crypto';
import { once } from 'events';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { getOrCreateSession as getUniversalSession } from '../../src/services/session-mapper.js';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'launch-grounding-smoke-secret';
process.env.FEATURE_LLM_CHATTER_GREETING = 'false';
process.env.TEXT_STRICT_GROUNDING = 'true';

const prisma = new PrismaClient();

const capturedLogs = [];
const originalConsoleLog = console.log;
console.log = (...args) => {
  capturedLogs.push(args.map((arg) => (
    typeof arg === 'string' ? arg : JSON.stringify(arg)
  )).join(' '));
  originalConsoleLog(...args);
};

const { default: app } = await import('../../src/server.js');

function nowSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function record(results, id, pass, detail) {
  const status = pass ? 'PASS' : 'FAIL';
  const icon = pass ? '✅' : '❌';
  console.log(`${icon} ${status} ${id} - ${detail}`);
  results.push({ id, pass, detail });
}

function hasEntityResolverLog({ channel, matchType } = {}) {
  return capturedLogs.some((line) => (
    line.includes('ENTITY_RESOLVER')
    && (!channel || line.includes(`"channel":"${channel}"`))
    && (!matchType || line.includes(`"matchType":"${matchType}"`))
  ));
}

function hasShortCircuitLog({ channel, reason, matchType } = {}) {
  return capturedLogs.some((line) => (
    line.includes(`SHORT_CIRCUIT: ${reason}`)
    && (!channel || line.includes(`"channel":"${channel}"`))
    && (!matchType || line.includes(`"matchType":"${matchType}"`))
  ));
}

async function startServer() {
  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address !== 'object') {
    throw new Error('SERVER_PORT_RESOLUTION_FAILED');
  }
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}`
  };
}

async function cleanupSmokeData(businessId) {
  if (!businessId) return;

  try {
    const threads = await prisma.emailThread.findMany({
      where: { businessId },
      select: { id: true }
    });
    const threadIds = threads.map((thread) => thread.id);

    if (threadIds.length > 0) {
      await prisma.emailDraft.deleteMany({
        where: {
          OR: [
            { businessId },
            { threadId: { in: threadIds } }
          ]
        }
      });
      await prisma.emailMessage.deleteMany({
        where: { threadId: { in: threadIds } }
      });
    }

    await prisma.emailThread.deleteMany({ where: { businessId } });
    await prisma.knowledgeBase.deleteMany({ where: { businessId } });
    await prisma.chatLog.deleteMany({ where: { businessId } });
    await prisma.conversationState.deleteMany({ where: { businessId } });
    await prisma.emailIntegration.deleteMany({ where: { businessId } });
    await prisma.integration.deleteMany({ where: { businessId } });
    await prisma.assistant.deleteMany({ where: { businessId } });
    await prisma.subscription.deleteMany({ where: { businessId } });
    await prisma.user.deleteMany({ where: { businessId } });
    await prisma.business.deleteMany({ where: { id: businessId } });
  } catch (cleanupError) {
    console.warn('⚠️ Cleanup warning:', cleanupError.message);
  }
}

async function requestJson(baseUrl, method, path, body, headers = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: controller.signal
  }).finally(() => clearTimeout(timer));

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  return { status: response.status, data };
}

function buildWebhookSignature(payload) {
  const appSecret = process.env.WHATSAPP_APP_SECRET || process.env.META_APP_SECRET;
  if (!appSecret) return null;
  const hash = crypto.createHmac('sha256', appSecret).update(JSON.stringify(payload)).digest('hex');
  return `sha256=${hash}`;
}

async function pollForWhatsAppAssistantMessage({ sessionId, minimumMessages, timeoutMs = 25000 }) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const chatLog = await prisma.chatLog.findUnique({
      where: { sessionId },
      select: { messages: true }
    });

    const messages = chatLog?.messages || [];
    if (messages.length >= minimumMessages) {
      const assistantMessage = [...messages].reverse().find((msg) => msg?.role === 'assistant');
      if (assistantMessage) {
        return assistantMessage;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return null;
}

async function createEmailThread({ businessId, inboundText, suffix }) {
  const thread = await prisma.emailThread.create({
    data: {
      businessId,
      threadId: `smoke-thread-${suffix}-${crypto.randomBytes(4).toString('hex')}`,
      subject: inboundText.slice(0, 80) || `Smoke ${suffix}`,
      customerEmail: `customer-${suffix}@example.com`,
      customerName: 'Smoke Customer',
      lastMessageAt: new Date()
    }
  });

  const message = await prisma.emailMessage.create({
    data: {
      threadId: thread.id,
      messageId: `msg-${suffix}-${crypto.randomBytes(4).toString('hex')}`,
      direction: 'INBOUND',
      fromEmail: thread.customerEmail,
      toEmail: 'support@telyx-smoke.test',
      subject: thread.subject,
      bodyText: inboundText,
      receivedAt: new Date()
    }
  });

  return { thread, message };
}

async function main() {
  const results = [];
  const suffix = nowSuffix();
  let server = null;
  let baseUrl = '';

  const business = await prisma.business.create({
    data: {
      name: `Grounding Smoke ${suffix}`,
      chatEmbedKey: `emb_${crypto.randomBytes(12).toString('hex')}`,
      chatWidgetEnabled: true,
      language: 'TR',
      country: 'TR',
      timezone: 'Europe/Istanbul',
      whatsappPhoneNumberId: `wa_${crypto.randomBytes(8).toString('hex')}`,
      aliases: ['Telyx'],
      identitySummary: 'Telyx, işletmeler için outbound calling assistant platformudur.'
    }
  });

  const user = await prisma.user.create({
    data: {
      email: `grounding-smoke-${suffix}@example.com`,
      password: 'smoke-not-used',
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

  await prisma.assistant.create({
    data: {
      businessId: business.id,
      name: 'Grounding Text Assistant',
      assistantType: 'text',
      systemPrompt: 'Kısa ve net cevap ver.',
      model: 'gpt-4',
      isActive: true,
      callDirection: 'chat',
      channelCapabilities: ['chat', 'whatsapp', 'email']
    }
  });

  // Avoid chat route KB-empty hard fallback by enabling an e-commerce integration.
  await prisma.integration.create({
    data: {
      businessId: business.id,
      type: 'SHOPIFY',
      credentials: {},
      isActive: true,
      connected: true
    }
  });

  await prisma.emailIntegration.create({
    data: {
      businessId: business.id,
      provider: 'GMAIL',
      email: `support-${suffix}@example.com`,
      credentials: {},
      connected: true
    }
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email, businessId: business.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );
  const authHeaders = { Authorization: `Bearer ${token}` };

  const serverRuntime = await startServer();
  server = serverRuntime.server;
  baseUrl = serverRuntime.baseUrl;

  const scenarios = [
    {
      id: 'FUZZY_MATCH_CLARIFICATION',
      message: 'telix nedir',
      expectedGrounding: 'CLARIFICATION',
      expectedMatchType: 'FUZZY_MATCH'
    },
    {
      id: 'OUT_OF_SCOPE_REDIRECT',
      message: 'netflix nedir',
      expectedGrounding: 'OUT_OF_SCOPE',
      expectedMatchType: 'OUT_OF_SCOPE'
    },
    {
      id: 'KB_LOW_CLARIFICATION',
      message: 'telyx 4k sunuyor mu',
      expectedGrounding: 'CLARIFICATION'
    }
  ];

  try {
    const healthRes = await requestJson(baseUrl, 'GET', '/health');
    const healthPass = healthRes.status === 200
      && typeof healthRes.data?.commitHash === 'string'
      && healthRes.data.commitHash.length > 0;
    record(
      results,
      'DEPLOY_HEALTH_COMMIT_HASH',
      healthPass,
      `status=${healthRes.status}, commitHash=${healthRes.data?.commitHash || 'none'}`
    );

    const versionRes = await requestJson(baseUrl, 'GET', '/version');
    const versionPass = versionRes.status === 200
      && typeof versionRes.data?.commitHash === 'string'
      && versionRes.data.commitHash.length > 0;
    record(
      results,
      'DEPLOY_VERSION_COMMIT_HASH',
      versionPass,
      `status=${versionRes.status}, commitHash=${versionRes.data?.commitHash || 'none'}`
    );

    for (const scenario of scenarios) {
      // -------------------------
      // CHAT widget endpoint
      // -------------------------
      const chatRes = await requestJson(baseUrl, 'POST', '/api/chat-v2/widget', {
        embedKey: business.chatEmbedKey,
        sessionId: `chat_${scenario.id}_${suffix}`,
        message: scenario.message
      });

      const chatGrounding = chatRes.data?.metadata?.responseGrounding;
      const chatMatchType = chatRes.data?.metadata?.entityMatchType;
      const chatPass = chatRes.status === 200 &&
        chatGrounding === scenario.expectedGrounding &&
        (!scenario.expectedMatchType || chatMatchType === scenario.expectedMatchType);
      record(
        results,
        `CHAT_${scenario.id}`,
        chatPass,
        `status=${chatRes.status}, grounding=${chatGrounding || 'none'}, match=${chatMatchType || 'none'}`
      );

      // -------------------------
      // WHATSAPP webhook endpoint
      // -------------------------
      const from = `90555${Math.floor(1000000 + Math.random() * 8999999)}`;
      const waSessionId = await getUniversalSession(business.id, 'WHATSAPP', from);
      const beforeLog = await prisma.chatLog.findUnique({
        where: { sessionId: waSessionId },
        select: { messages: true }
      });
      const beforeMessageCount = (beforeLog?.messages || []).length;

      const webhookPayload = {
        object: 'whatsapp_business_account',
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: {
                    phone_number_id: business.whatsappPhoneNumberId
                  },
                  messages: [
                    {
                      id: `wamid.${crypto.randomBytes(12).toString('hex')}`,
                      from,
                      text: { body: scenario.message },
                      type: 'text'
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      const signature = buildWebhookSignature(webhookPayload);
      const webhookHeaders = signature ? { 'x-hub-signature-256': signature } : {};

      const waRes = await requestJson(baseUrl, 'POST', '/api/whatsapp/webhook', webhookPayload, webhookHeaders);

      const waAssistantMessage = await pollForWhatsAppAssistantMessage({
        sessionId: waSessionId,
        minimumMessages: beforeMessageCount + 2
      });

      const waGrounding = waAssistantMessage?.responseGrounding;
      const waPass = waRes.status === 200 && waGrounding === scenario.expectedGrounding;
      record(
        results,
        `WHATSAPP_${scenario.id}`,
        waPass,
        `status=${waRes.status}, grounding=${waGrounding || 'none'}`
      );

      // -------------------------
      // EMAIL generate-draft endpoint
      // -------------------------
      const { thread, message } = await createEmailThread({
        businessId: business.id,
        inboundText: scenario.message,
        suffix: `${scenario.id}_${suffix}`
      });

      const emailRes = await requestJson(
        baseUrl,
        'POST',
        `/api/email/threads/${thread.id}/generate-draft`,
        {
          messageId: message.id,
          createProviderDraft: false
        },
        authHeaders
      );

      const emailGrounding = emailRes.data?.responseGrounding;
      const emailPass = emailRes.status === 200 && emailGrounding === scenario.expectedGrounding;
      record(
        results,
        `EMAIL_${scenario.id}`,
        emailPass,
        `status=${emailRes.status}, grounding=${emailGrounding || 'none'}`
      );
    }

    // KB HIGH + document -> GROUNDED (chat channel)
    await prisma.knowledgeBase.create({
      data: {
        businessId: business.id,
        type: 'FAQ',
        title: 'Telyx outbound assistant',
        question: 'Telyx nedir?',
        answer: 'Telyx outbound calling assistant hizmeti sunar.',
        status: 'ACTIVE'
      }
    });

    const groundedRes = await requestJson(baseUrl, 'POST', '/api/chat-v2/widget', {
      embedKey: business.chatEmbedKey,
      sessionId: `chat_high_${suffix}`,
      message: 'selam telyx'
    });

    const grounded = groundedRes.data?.metadata?.responseGrounding;
    const groundedKbConfidence = groundedRes.data?.metadata?.kbConfidence;
    const groundedPass = groundedRes.status === 200 && grounded === 'GROUNDED' && groundedKbConfidence === 'HIGH';
    record(
      results,
      'CHAT_KB_HIGH_GROUNDED',
      groundedPass,
      `status=${groundedRes.status}, grounding=${grounded || 'none'}, kbConfidence=${groundedKbConfidence || 'none'}`
    );

    const channels = ['CHAT', 'WHATSAPP', 'EMAIL'];
    for (const channel of channels) {
      record(
        results,
        `LOG_ENTITY_RESOLVER_${channel}_FUZZY`,
        hasEntityResolverLog({ channel, matchType: 'FUZZY_MATCH' }),
        `ENTITY_RESOLVER FUZZY_MATCH log exists for ${channel}`
      );
      record(
        results,
        `LOG_ENTITY_RESOLVER_${channel}_OUT_OF_SCOPE`,
        hasEntityResolverLog({ channel, matchType: 'OUT_OF_SCOPE' }),
        `ENTITY_RESOLVER OUT_OF_SCOPE log exists for ${channel}`
      );
      record(
        results,
        `LOG_SHORT_CIRCUIT_${channel}_CLARIFICATION`,
        hasShortCircuitLog({ channel, reason: 'clarification' }),
        `SHORT_CIRCUIT clarification log exists for ${channel}`
      );
      record(
        results,
        `LOG_SHORT_CIRCUIT_${channel}_OUT_OF_SCOPE`,
        hasShortCircuitLog({ channel, reason: 'out_of_scope' }),
        `SHORT_CIRCUIT out_of_scope log exists for ${channel}`
      );
    }

    const failed = results.filter((item) => !item.pass);
    console.log('\n📊 Launch Grounding Smoke Summary');
    console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
    if (failed.length > 0) {
      process.exitCode = 1;
    }
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await cleanupSmokeData(business.id);
  }
}

main()
  .catch((error) => {
    console.error('❌ launch-grounding-smoke failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    console.log = originalConsoleLog;
    await prisma.$disconnect();
  });
