export const ASSISTANT_CHANNEL_CAPABILITIES = Object.freeze({
  CHAT: 'chat',
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  PHONE_OUTBOUND: 'phone_outbound',
  PHONE_INBOUND: 'phone_inbound'
});

export const CHAT_CAPABLE_CHANNELS = Object.freeze([
  ASSISTANT_CHANNEL_CAPABILITIES.CHAT,
  ASSISTANT_CHANNEL_CAPABILITIES.WHATSAPP,
  ASSISTANT_CHANNEL_CAPABILITIES.EMAIL
]);

const VALID_CAPABILITIES = new Set(Object.values(ASSISTANT_CHANNEL_CAPABILITIES));

export const DEFAULT_CHAT_ASSISTANT_NAME = 'Yazı Asistanı';

export function getDefaultCapabilitiesForCallDirection(callDirection) {
  const normalizedDirection = (callDirection || '').toLowerCase();

  if (normalizedDirection.startsWith('outbound')) {
    return [ASSISTANT_CHANNEL_CAPABILITIES.PHONE_OUTBOUND];
  }

  if (normalizedDirection === 'inbound') {
    return [
      ASSISTANT_CHANNEL_CAPABILITIES.PHONE_INBOUND,
      ASSISTANT_CHANNEL_CAPABILITIES.CHAT,
      ASSISTANT_CHANNEL_CAPABILITIES.WHATSAPP,
      ASSISTANT_CHANNEL_CAPABILITIES.EMAIL
    ];
  }

  if (
    normalizedDirection === 'chat' ||
    normalizedDirection === 'whatsapp' ||
    normalizedDirection === 'email'
  ) {
    return [...CHAT_CAPABLE_CHANNELS];
  }

  return [ASSISTANT_CHANNEL_CAPABILITIES.PHONE_OUTBOUND];
}

export function normalizeChannelCapabilities(capabilities, fallbackCapabilities = [ASSISTANT_CHANNEL_CAPABILITIES.PHONE_OUTBOUND]) {
  const fallback = Array.isArray(fallbackCapabilities) && fallbackCapabilities.length > 0
    ? fallbackCapabilities
    : [ASSISTANT_CHANNEL_CAPABILITIES.PHONE_OUTBOUND];

  if (!Array.isArray(capabilities)) {
    return [...fallback];
  }

  const normalized = [];

  for (const capability of capabilities) {
    if (typeof capability !== 'string') continue;
    const value = capability.trim().toLowerCase();
    if (!VALID_CAPABILITIES.has(value)) continue;
    if (!normalized.includes(value)) {
      normalized.push(value);
    }
  }

  return normalized.length > 0 ? normalized : [...fallback];
}

export function assistantHasCapability(assistant, capability) {
  if (!assistant || typeof capability !== 'string') {
    return false;
  }

  const fallback = getDefaultCapabilitiesForCallDirection(assistant.callDirection);
  const capabilities = normalizeChannelCapabilities(assistant.channelCapabilities, fallback);
  return capabilities.includes(capability);
}

function getFallbackChatVoice(language) {
  return String(language || '').toUpperCase() === 'TR' ? 'tr-f-ecem' : 'en-f-kayla';
}

function getFallbackChatPrompt(language, businessName) {
  const name = businessName || 'isletme';

  if (String(language || '').toUpperCase() === 'TR') {
    return [
      `Sen ${name} için web chat asistanısın.`,
      'Kısa, net ve nazik cevap ver.',
      'Telefon arama scripti kullanma.',
      'Bilgi eksikse dürüstçe belirt ve gerekirse canlı desteğe yönlendir.'
    ].join(' ');
  }

  return [
    `You are the web chat assistant for ${name}.`,
    'Keep answers short, clear, and polite.',
    'Never use a phone call script.',
    'If information is missing, say so clearly and guide the user to human support.'
  ].join(' ');
}

function getFallbackChatFirstMessage(language) {
  if (String(language || '').toUpperCase() === 'TR') {
    return 'Merhaba! Size nasıl yardımcı olabilirim?';
  }

  return 'Hello! How can I help you today?';
}

async function bindChatAssistant(prisma, businessId, assistantId) {
  await prisma.business.update({
    where: { id: businessId },
    data: { chatAssistantId: assistantId }
  });
}

export async function resolveChatAssistantForBusiness({ prisma, business, businessId, allowAutoCreate = true }) {
  let businessRecord = business || null;

  if (!businessRecord) {
    businessRecord = await prisma.business.findUnique({
      where: { id: businessId },
      include: {
        assistants: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
  } else if (!Array.isArray(businessRecord.assistants)) {
    const assistants = await prisma.assistant.findMany({
      where: {
        businessId: businessRecord.id,
        isActive: true
      },
      orderBy: { createdAt: 'desc' }
    });

    businessRecord = {
      ...businessRecord,
      assistants
    };
  }

  if (!businessRecord) {
    return { assistant: null, business: null, createdFallback: false };
  }

  const chatAssistants = (businessRecord.assistants || []).filter((assistant) =>
    assistantHasCapability(assistant, ASSISTANT_CHANNEL_CAPABILITIES.CHAT)
  );

  let selectedAssistant = null;

  if (businessRecord.chatAssistantId) {
    selectedAssistant = chatAssistants.find((assistant) => assistant.id === businessRecord.chatAssistantId) || null;
  }

  if (!selectedAssistant && chatAssistants.length > 0) {
    selectedAssistant = chatAssistants[0];
  }

  if (selectedAssistant) {
    if (businessRecord.chatAssistantId !== selectedAssistant.id) {
      await bindChatAssistant(prisma, businessRecord.id, selectedAssistant.id);
    }
    return { assistant: selectedAssistant, business: businessRecord, createdFallback: false };
  }

  if (!allowAutoCreate) {
    return { assistant: null, business: businessRecord, createdFallback: false };
  }

  const recheck = await prisma.assistant.findFirst({
    where: {
      businessId: businessRecord.id,
      isActive: true,
      channelCapabilities: {
        has: ASSISTANT_CHANNEL_CAPABILITIES.CHAT
      }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (recheck) {
    await bindChatAssistant(prisma, businessRecord.id, recheck.id);
    return { assistant: recheck, business: businessRecord, createdFallback: false };
  }

  const language = businessRecord.language || 'TR';
  const createdAssistant = await prisma.assistant.create({
    data: {
      businessId: businessRecord.id,
      name: DEFAULT_CHAT_ASSISTANT_NAME,
      assistantType: 'text',
      systemPrompt: getFallbackChatPrompt(language, businessRecord.name),
      model: 'gpt-4',
      timezone: businessRecord.timezone || 'Europe/Istanbul',
      firstMessage: getFallbackChatFirstMessage(language),
      tone: 'professional',
      callDirection: 'outbound',
      channelCapabilities: [...CHAT_CAPABLE_CHANNELS]
    }
  });

  await bindChatAssistant(prisma, businessRecord.id, createdAssistant.id);

  return { assistant: createdAssistant, business: businessRecord, createdFallback: true };
}
