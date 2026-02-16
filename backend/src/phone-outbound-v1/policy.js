export const PHONE_OUTBOUND_V1_ALLOWED_TOOLS = Object.freeze([
  'log_call_outcome',
  'create_callback',
  'set_do_not_call',
  'schedule_followup'
]);

const OFF_TOPIC_PATTERNS = [
  /\b(siparis\w*|order\w*|tracking\w*|kargo\w*|shipment\w*|teslim\w*)\b/i,
  /\b(hesap\w*|account\w*|fatura\w*|invoice\w*)\b/i,
  /\b(odeme\w*|payment\w*|tutar\w*|amount\w*|borc\w*|debt\w*)\b/i,
  /\b(teslim\s*tarihi|delivery\s*date|ne\s*zaman\s*gelecek)\b/i
];

const ASK_AGENT_HINTS = [
  /\b(temsilci\w*|yetkili\w*|insan\w*|operator\w*)\b/i,
  /\b(agent\w*|human\w*|representative\w*|supervisor\w*)\b/i
];

function normalizeForPolicy(raw = '') {
  return String(raw || '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isAllowedOutboundV1Tool(toolName = '') {
  return PHONE_OUTBOUND_V1_ALLOWED_TOOLS.includes(String(toolName || '').trim());
}

export function detectOffTopic(utterance = '') {
  const text = normalizeForPolicy(utterance);
  if (!text) {
    return false;
  }

  return OFF_TOPIC_PATTERNS.some((pattern) => pattern.test(text));
}

export function shouldOfferAgentCallback(utterance = '') {
  const text = normalizeForPolicy(utterance);
  if (!text) {
    return false;
  }

  return ASK_AGENT_HINTS.some((pattern) => pattern.test(text));
}

export function getInboundDisabledMessage(language = 'TR') {
  const normalized = String(language || 'TR').toUpperCase();
  if (normalized === 'EN') {
    return 'Phone inbound is disabled in V1.';
  }

  return 'PHONE inbound V1 su anda devre disi.';
}

export default {
  PHONE_OUTBOUND_V1_ALLOWED_TOOLS,
  isAllowedOutboundV1Tool,
  detectOffTopic,
  shouldOfferAgentCallback,
  getInboundDisabledMessage
};
