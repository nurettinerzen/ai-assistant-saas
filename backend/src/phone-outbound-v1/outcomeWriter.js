import prisma from '../prismaClient.js';
import { normalizePhone } from '../utils/text.js';

function hasDoNotCallModel() {
  return prisma.doNotCall && typeof prisma.doNotCall.findUnique === 'function';
}

export function normalizePhoneE164(phone) {
  const normalized = normalizePhone(phone || '');
  return normalized || null;
}

export async function isDoNotCall({ businessId, phoneE164 }) {
  if (!businessId || !phoneE164 || !hasDoNotCallModel()) {
    return false;
  }

  const found = await prisma.doNotCall.findUnique({
    where: {
      businessId_phoneE164: {
        businessId,
        phoneE164
      }
    },
    select: { id: true }
  });

  return Boolean(found);
}

export async function setDoNotCall({ businessId, phoneE164, source = 'PHONE_OUTBOUND_V1' }) {
  if (!businessId || !phoneE164) {
    return { success: false, reason: 'MISSING_INPUT' };
  }

  if (!hasDoNotCallModel()) {
    console.warn('⚠️ [PHONE_OUTBOUND_V1] doNotCall model missing on Prisma client, skipping persist');
    return { success: false, reason: 'MODEL_NOT_AVAILABLE' };
  }

  const normalizedPhone = normalizePhoneE164(phoneE164);
  if (!normalizedPhone) {
    return { success: false, reason: 'INVALID_PHONE' };
  }

  await prisma.doNotCall.upsert({
    where: {
      businessId_phoneE164: {
        businessId,
        phoneE164: normalizedPhone
      }
    },
    create: {
      businessId,
      phoneE164: normalizedPhone,
      source
    },
    update: {
      source
    }
  });

  return { success: true, phoneE164: normalizedPhone };
}

export async function logCallOutcome({
  businessId,
  callType,
  callId,
  sessionId,
  label,
  metadata = {}
}) {
  const summary = `PHONE_OUTBOUND_V1 outcome=${label} callType=${callType}`;

  if (callId) {
    const updateResult = await prisma.callLog.updateMany({
      where: { callId },
      data: {
        status: 'answered',
        direction: 'outbound',
        summary,
        keyTopics: [String(callType || 'UNKNOWN').toLowerCase(), `label:${String(label || 'UNKNOWN').toLowerCase()}`],
        analysisData: {
          mode: 'PHONE_OUTBOUND_V1',
          label,
          callType,
          metadata
        },
        updatedAt: new Date()
      }
    });

    if (updateResult.count > 0) {
      return { success: true, updated: true };
    }
  }

  if (!businessId) {
    return { success: false, reason: 'NO_BUSINESS_ID' };
  }

  await prisma.callLog.create({
    data: {
      businessId,
      callId: callId || sessionId || `phone_outbound_v1_${Date.now()}`,
      status: 'answered',
      direction: 'outbound',
      summary,
      keyTopics: [String(callType || 'UNKNOWN').toLowerCase(), `label:${String(label || 'UNKNOWN').toLowerCase()}`],
      analysisData: {
        mode: 'PHONE_OUTBOUND_V1',
        label,
        callType,
        metadata
      },
      createdAt: new Date()
    }
  });

  return { success: true, created: true };
}

export async function createCallback({
  businessId,
  assistantId = null,
  callId = null,
  customerName = 'Müşteri',
  customerPhone,
  topic = 'PHONE_OUTBOUND_V1_CALLBACK'
}) {
  const normalizedPhone = normalizePhoneE164(customerPhone);
  if (!businessId || !normalizedPhone) {
    return { success: false, reason: 'MISSING_INPUT' };
  }

  const callback = await prisma.callbackRequest.create({
    data: {
      businessId,
      assistantId,
      callId,
      customerName: customerName || 'Müşteri',
      customerPhone: normalizedPhone,
      topic,
      priority: 'NORMAL'
    }
  });

  return { success: true, callbackId: callback.id };
}

export async function scheduleFollowup({
  businessId,
  assistantId = null,
  callId = null,
  customerName = 'Müşteri',
  customerPhone,
  callType = 'BILLING_REMINDER',
  delayHours = 24
}) {
  const normalizedPhone = normalizePhoneE164(customerPhone);
  if (!businessId || !normalizedPhone) {
    return { success: false, reason: 'MISSING_INPUT' };
  }

  const scheduledFor = new Date(Date.now() + Math.max(1, Number(delayHours) || 24) * 60 * 60 * 1000);

  const callback = await prisma.callbackRequest.create({
    data: {
      businessId,
      assistantId,
      callId,
      customerName: customerName || 'Müşteri',
      customerPhone: normalizedPhone,
      topic: `PHONE_OUTBOUND_V1_FOLLOWUP_${callType}`,
      priority: 'NORMAL',
      scheduledFor
    }
  });

  return { success: true, callbackId: callback.id, scheduledFor };
}

export async function applyOutboundV1Actions(actions = [], context = {}) {
  const results = [];

  for (const action of actions) {
    const actionName = action?.name;
    const actionArgs = action?.args || {};

    if (actionName === 'log_call_outcome') {
      results.push(await logCallOutcome({
        businessId: context.businessId,
        callType: actionArgs.callType,
        callId: actionArgs.callId || context.callId,
        sessionId: actionArgs.sessionId || context.sessionId,
        label: actionArgs.label,
        metadata: actionArgs.metadata || {}
      }));
      continue;
    }

    if (actionName === 'set_do_not_call') {
      results.push(await setDoNotCall({
        businessId: context.businessId,
        phoneE164: actionArgs.phoneE164 || context.phoneE164,
        source: actionArgs.source || 'PHONE_OUTBOUND_V1'
      }));
      continue;
    }

    if (actionName === 'create_callback') {
      results.push(await createCallback({
        businessId: context.businessId,
        assistantId: context.assistantId,
        callId: context.callId,
        customerName: actionArgs.customerName || context.customerName,
        customerPhone: actionArgs.customerPhone || context.phoneE164,
        topic: actionArgs.topic
      }));
      continue;
    }

    if (actionName === 'schedule_followup') {
      results.push(await scheduleFollowup({
        businessId: context.businessId,
        assistantId: context.assistantId,
        callId: context.callId,
        customerName: actionArgs.customerName || context.customerName,
        customerPhone: actionArgs.customerPhone || context.phoneE164,
        callType: actionArgs.callType,
        delayHours: actionArgs.delayHours
      }));
      continue;
    }

    results.push({ success: false, reason: `UNKNOWN_ACTION_${actionName}` });
  }

  return results;
}

export default {
  normalizePhoneE164,
  isDoNotCall,
  setDoNotCall,
  logCallOutcome,
  createCallback,
  scheduleFollowup,
  applyOutboundV1Actions
};
