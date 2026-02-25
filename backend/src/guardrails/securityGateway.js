/**
 * Security Gateway - Merkezi Güvenlik Politika Motoru
 *
 * TEK SORUMLULUK: Her turn için güvenlik kararı ver
 * - LLM'e bırakılmaz (deterministik)
 * - LLM sadece metin üretir, gateway ne çıkabiliri belirler
 *
 * MİMARİ:
 * 1. Security Gateway: verified state + intent + data class → karar
 * 2. Data Class Policy: hangi veriler hangi state'de çıkabilir
 * 3. Leak Filter: post-output filtreleme
 * 4. Identity Mismatch: verifiedIdentity vs requestedRecordOwner
 */
import {
  INTERNAL_METADATA_TERMS,
  POLICY_RESPONSE_HINT_PATTERNS
} from '../security/patterns/index.js';
import { comparePhones } from '../utils/text.js';
import { ToolOutcome, normalizeOutcome } from '../tools/toolResult.js';

export const GuardrailAction = Object.freeze({
  PASS: 'PASS',
  SANITIZE: 'SANITIZE',
  BLOCK: 'BLOCK',
  NEED_MIN_INFO_FOR_TOOL: 'NEED_MIN_INFO_FOR_TOOL'
});

const TOOL_REQUIRED_CLAIM_GATES = Object.freeze({
  ORDER_STATUS: {
    intents: new Set(['order_status', 'tracking_info']),
    flows: new Set(['ORDER_STATUS']),
    requiredTools: new Set(['customer_data_lookup', 'check_order_status', 'check_order_status_crm', 'order_search']),
    missingFields: ['order_number']
  },
  DEBT_INQUIRY: {
    intents: new Set(['debt_inquiry']),
    flows: new Set(['DEBT_INQUIRY']),
    requiredTools: new Set(['customer_data_lookup']),
    missingFields: ['vkn_or_tc_or_phone']
  },
  TICKET_STATUS: {
    intents: new Set(['ticket_status', 'support_ticket']),
    flows: new Set(['TICKET_STATUS', 'SUPPORT']),
    requiredTools: new Set(['check_ticket_status_crm']),
    missingFields: ['ticket_number']
  },
  PRODUCT_INFO: {
    intents: new Set(['product_spec', 'stock_check', 'pricing']),
    flows: new Set(['PRODUCT_INFO', 'STOCK_CHECK']),
    requiredTools: new Set(['get_product_stock', 'check_stock_crm', 'search_products']),
    missingFields: ['product_name']
  }
});

// ============================================================================
// DATA CLASS TANIMLARI
// ============================================================================

/**
 * Veri sınıfları ve erişim kuralları
 *
 * PUBLIC: Herkes görebilir (ürün bilgisi, genel politikalar)
 * ACCOUNT_VERIFIED: Sadece doğrulanmış kullanıcı görebilir
 * NEVER_EXPOSE: Hiçbir zaman dışarı çıkmaz (internal)
 */
export const DATA_CLASSES = {
  // PUBLIC - Doğrulama gerektirmez
  PUBLIC: {
    fields: [
      'product_name', 'product_description', 'product_price',
      'general_policy', 'return_policy', 'shipping_policy',
      'store_hours', 'contact_info', 'faq'
    ],
    requiresVerification: false
  },

  // ACCOUNT_VERIFIED - Doğrulama gerektirir
  ACCOUNT_VERIFIED: {
    fields: [
      // Sipariş bilgileri
      'order_status', 'order_items', 'order_total',
      // Kargo/Teslimat
      'tracking_number', 'carrier_name', 'branch_name',
      'delivery_date', 'delivery_time', 'delivery_window',
      'delivered_to', 'signature',
      // Adres bilgileri
      'address', 'street', 'neighborhood', 'district', 'postal_code',
      // Müşteri bilgileri
      'customer_name', 'phone_number', 'email',
      // Ticket/Destek
      'ticket_status', 'ticket_notes', 'assigned_agent'
    ],
    requiresVerification: true
  },

  // NEVER_EXPOSE - Asla dışarı çıkmaz
  NEVER_EXPOSE: {
    fields: [
      'system_prompt', 'tool_names', 'verification_fsm',
      'security_protocol', 'internal_notes', 'api_keys',
      'database_queries', 'admin_actions'
    ],
    requiresVerification: null // N/A - never exposed
  }
};

/**
 * Belirli bir field'ın data class'ını bul
 */
export function getDataClass(fieldName) {
  for (const [className, config] of Object.entries(DATA_CLASSES)) {
    if (config.fields.includes(fieldName)) {
      return className;
    }
  }
  return 'ACCOUNT_VERIFIED'; // Default: güvenli taraf
}

// ============================================================================
// SECURITY GATEWAY
// ============================================================================

/**
 * Security Gateway - Ana karar fonksiyonu
 *
 * @param {Object} context
 * @param {string} context.verificationState - 'none' | 'pending' | 'verified'
 * @param {Object} context.verifiedIdentity - Doğrulanmış kimlik {phone, email, orderId}
 * @param {Object} context.requestedRecord - İstenen kayıt sahibi bilgisi (tool output'tan)
 * @param {Array} context.requestedDataFields - İstenen veri alanları
 * @param {string} context.intent - Tespit edilen intent (opsiyonel, telemetri için)
 *
 * @returns {Object} Security decision
 */
export function evaluateSecurityGateway(context) {
  const {
    verificationState = 'none',
    verifiedIdentity = null,
    requestedRecord = null,
    requestedDataFields = [],
    intent = null
  } = context;

  // 1. Temel risk seviyesi belirle
  let riskLevel = 'low';
  const deniedFields = [];
  const allowedFields = [];

  // 2. Her istenen field için karar ver
  for (const field of requestedDataFields) {
    const dataClass = getDataClass(field);

    if (dataClass === 'NEVER_EXPOSE') {
      // Asla izin verme
      deniedFields.push({ field, reason: 'NEVER_EXPOSE' });
      riskLevel = 'high';
      continue;
    }

    if (dataClass === 'ACCOUNT_VERIFIED') {
      if (verificationState !== 'verified') {
        // Doğrulama yok → izin yok
        deniedFields.push({ field, reason: 'VERIFICATION_REQUIRED' });
        riskLevel = riskLevel === 'high' ? 'high' : 'medium';
        continue;
      }

      // Doğrulama var, identity match kontrolü
      if (requestedRecord && verifiedIdentity) {
        const identityMatch = checkIdentityMatch(verifiedIdentity, requestedRecord);
        if (!identityMatch.matches) {
          // Identity mismatch → hard deny
          deniedFields.push({ field, reason: 'IDENTITY_MISMATCH', details: identityMatch });
          riskLevel = 'high';
          continue;
        }
      }

      // Doğrulama var ve identity match → izin ver
      allowedFields.push(field);
      continue;
    }

    // PUBLIC → her zaman izin ver
    allowedFields.push(field);
  }

  // 3. Response mode belirle
  let responseMode = 'normal';
  if (riskLevel === 'high') {
    responseMode = 'safe_refusal';
  } else if (riskLevel === 'medium') {
    responseMode = 'safe_clarification';
  }

  // 4. İzin verilen aksiyonları belirle
  const allowedActions = determineAllowedActions(verificationState, riskLevel);

  return {
    riskLevel,
    responseMode,
    allowedActions,
    allowedFields,
    deniedFields,
    requiresVerification: deniedFields.some(d => d.reason === 'VERIFICATION_REQUIRED'),
    hasIdentityMismatch: deniedFields.some(d => d.reason === 'IDENTITY_MISMATCH'),
    hasNeverExpose: deniedFields.some(d => d.reason === 'NEVER_EXPOSE')
  };
}

/**
 * Identity match kontrolü
 * verifiedIdentity vs requestedRecord owner karşılaştırması
 */
function checkIdentityMatch(verifiedIdentity, requestedRecord) {
  // Eşleşme kriterleri (en az biri match etmeli)
  const checks = [];

  // Telefon kontrolü
  if (verifiedIdentity.phone && requestedRecord.phone) {
    const phoneMatch = comparePhones(verifiedIdentity.phone, requestedRecord.phone);
    checks.push({ field: 'phone', matches: phoneMatch });
  }

  // Email kontrolü
  if (verifiedIdentity.email && requestedRecord.email) {
    const emailMatch = verifiedIdentity.email.toLowerCase() === requestedRecord.email.toLowerCase();
    checks.push({ field: 'email', matches: emailMatch });
  }

  // Order ID kontrolü (aynı sipariş için doğrulama yapıldıysa)
  if (verifiedIdentity.orderId && requestedRecord.orderId) {
    const orderMatch = verifiedIdentity.orderId === requestedRecord.orderId;
    checks.push({ field: 'orderId', matches: orderMatch });
  }

  // Customer ID kontrolü
  if (verifiedIdentity.customerId && requestedRecord.customerId) {
    const customerMatch = verifiedIdentity.customerId === requestedRecord.customerId;
    checks.push({ field: 'customerId', matches: customerMatch });
  }

  // Eğer hiç kontrol yapılamadıysa, güvenli tarafta kal
  if (checks.length === 0) {
    return { matches: false, reason: 'NO_MATCHING_FIELDS', checks };
  }

  // En az bir match varsa OK
  const hasMatch = checks.some(c => c.matches);

  return {
    matches: hasMatch,
    reason: hasMatch ? 'IDENTITY_VERIFIED' : 'IDENTITY_MISMATCH',
    checks
  };
}

/**
 * İzin verilen aksiyonları belirle
 */
function determineAllowedActions(verificationState, riskLevel) {
  const actions = {
    answer_policy: true, // Genel politika soruları her zaman OK
    ask_verification: true, // Doğrulama istemek her zaman OK
    call_tools: false,
    share_verified_data: false,
    deny: false
  };

  if (riskLevel === 'high') {
    actions.deny = true;
    return actions;
  }

  if (verificationState === 'verified') {
    actions.call_tools = true;
    actions.share_verified_data = true;
  }

  if (verificationState === 'pending') {
    actions.call_tools = true; // Tool çağırabilir (doğrulama için)
  }

  return actions;
}

// ============================================================================
// LEAK FILTER - Post-Output Filtreleme
// ============================================================================

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeTopicText(value = '') {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function looksLikeAmbiguousOrderOrPhoneInput(userMessage = '') {
  const raw = String(userMessage || '').trim();
  if (!raw) return false;

  // Any alphabetic marker means the user already disambiguated the identifier type.
  if (/[a-zA-Z\u00C0-\u024F]/.test(raw)) return false;

  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 10 && digits.length !== 11) return false;

  // Allow numeric-only entries with lightweight punctuation/spaces.
  return /^[\d\s()+\-_.#]+$/.test(raw);
}

function looksLikeDebtOrPaymentInput(userMessage = '') {
  const text = normalizeTopicText(userMessage);
  if (!text) return false;

  return /\b(borc|borcum|debt|odeme|payment|fatura|invoice|bakiye|vergi|sgk|tahsilat)\b/i.test(text);
}

/**
 * Mask phone numbers in response text.
 * Replaces digits with asterisks, keeping first 3 and last 2 digits visible.
 */
function maskPhoneNumbers(text) {
  if (!text) return text;

  const maskDigitsPreservingFormat = (value, keepStart = 3, keepEnd = 2) => {
    const raw = String(value || '');
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 0) return raw;

    const visibleStart = Math.min(keepStart, digits.length);
    const visibleEnd = Math.min(keepEnd, Math.max(0, digits.length - visibleStart));
    let digitIndex = 0;

    return raw.replace(/\d/g, (digit) => {
      const current = digitIndex;
      digitIndex += 1;
      const inVisibleStart = current < visibleStart;
      const inVisibleEnd = current >= (digits.length - visibleEnd);
      return inVisibleStart || inVisibleEnd ? digit : '*';
    });
  };

  return text
    .replace(/(?:\+90[\s.-]?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/g, match => maskDigitsPreservingFormat(match))
    .replace(/(?:\+1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/g, match => maskDigitsPreservingFormat(match))
    .replace(/((?:son\s*4(?:\s*hane(?:si)?)?|last\s*4(?:\s*digits?)?)\s*[:=]?\s*)\d{4}\b/gi, '$1****');
}

const INTERNAL_METADATA_PATTERNS = INTERNAL_METADATA_TERMS.map(term =>
  new RegExp(escapeRegExp(term), 'i')
);

// ============================================================================
// LEAK FILTER PATTERN'LERİ — SADECE phone + internal
// ============================================================================
// customerName / address / shipping / delivery / tracking / timeWindow
// KALDIRILDI. Bu tipler false positive üretiyordu ve LLM'i bozuyordu.
//
// GÜVENLİK NASIL SAĞLANIYOR:
// - Sipariş/CRM verileri zaten tool ile geliyor. Tool çağrılmadan detay yok.
// - LLM prompt'unda "kanıt yoksa iddia yok" kuralı var.
// - Guardrail = son bariyer (phone mask + internal block), direksiyon değil.
// ============================================================================
const SENSITIVE_PATTERNS = {
  // Telefon — sadece net TR/US formatlari.
  // Rastgele 10-11 haneli sayilar telefon kabul edilmez.
  phone: [
    /(?:\+90[\s.-]?)?0?5\d{2}[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/, // TR: 0555 123 45 67 / +90 555 123 45 67
    /(?:\+1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]\d{3}[\s.-]\d{4}\b/,      // US: (555) 123-4567 / 555-123-4567
    /(?:son\s*4(?:\s*hane(?:si)?)?|last\s*4(?:\s*digits?)?)\s*[:=]?\s*\d{4}\b/i
  ],

  // Internal/System — asla dışarı çıkmamalı
  internal: [
    ...INTERNAL_METADATA_PATTERNS,
    /verification\s*(state|flow|fsm)/i,
    /system\s*prompt/i,
    /güvenlik\s*protokol/i,
  ]
};

/**
 * Backward-compat stub — contextual detection kaldırıldı.
 * Artık boş array döner. Eski test'ler kırılmasın diye export korunuyor.
 */
export function runContextualDetection(_response = '') {
  return [];
}

/**
 * Leak Filter - LLM output'unda hassas veri kontrolü
 *
 * IMPORTANT: Only triggers for ACCOUNT_VERIFIED class data (personal/order info)
 * Does NOT trigger for PUBLIC/policy questions like "iade süresi kaç gün?"
 *
 * @param {string} response - LLM response
 * @param {string} verificationState - Mevcut doğrulama durumu
 * @param {string} language - TR | EN
 * @param {Object} collectedData - Zaten toplanmış veriler (orderNumber, phone, name vb.)
 * @param {Object} options - Flow context (callback pending vs regular verification)
 * @returns {Object} { safe, leaks, sanitized, telemetry }
 */
export function applyLeakFilter(response, verificationState = 'none', language = 'TR', collectedData = {}, options = {}) {
  if (!response) {
    return { safe: true, action: GuardrailAction.PASS, leaks: [], sanitized: response, telemetry: null };
  }

  const leaks = [];

  // ── 1. Internal metadata — ASLA dışarı çıkmamalı (NEVER_EXPOSE) ──
  for (const pattern of SENSITIVE_PATTERNS.internal) {
    if (pattern.test(response)) {
      leaks.push({ type: 'internal', pattern: pattern.toString() });
    }
  }

  // ── 2. Phone number — gerçek rakam-temelli maskeleme ──
  const responseHasDigits = /\d/.test(response);
  if (responseHasDigits) {
    for (const pattern of SENSITIVE_PATTERNS.phone) {
      if (pattern.test(response)) {
        leaks.push({ type: 'phone', pattern: pattern.toString() });
        break; // Bir phone leak yeterli
      }
    }
  }

  // ── Hiç leak yoksa → PASS ──
  if (leaks.length === 0) {
    return { safe: true, action: GuardrailAction.PASS, leaks: [], sanitized: response, telemetry: null };
  }

  const hasPhoneLeak = leaks.some(l => l.type === 'phone');
  const hasInternalLeak = leaks.some(l => l.type === 'internal');

  // ── Internal-only leak → policy response kontrolü ──
  if (hasInternalLeak && !hasPhoneLeak) {
    const isPolicyResponse = POLICY_RESPONSE_HINT_PATTERNS.some(p => p.test(response));
    if (isPolicyResponse) {
      return { safe: true, action: GuardrailAction.PASS, leaks: [], sanitized: response,
        telemetry: { reason: 'policy_response_allowed' } };
    }
    // Internal leak, policy response değil → BLOCK
    return {
      safe: false, action: GuardrailAction.BLOCK, leaks,
      blockedMessage: String(language || '').toUpperCase() === 'EN'
        ? 'I cannot share that detail right now for security reasons.'
        : 'Güvenlik nedeniyle bu detayı şu anda paylaşamıyorum.',
      blockReason: 'INTERNAL_METADATA_LEAK',
      telemetry: { reason: 'internal_metadata_blocked', leakTypes: ['internal'] }
    };
  }

  // ── Phone leak → mask ve geçir ──
  if (hasPhoneLeak) {
    const sanitized = maskPhoneNumbers(response);
    console.log('🔒 [LeakFilter] Phone number redacted (masked)');
    return {
      safe: true, action: GuardrailAction.SANITIZE, leaks, sanitized,
      telemetry: { reason: 'phone_redacted_pass', responseHasDigits: true, verificationMode: 'PHONE_REDACT' }
    };
  }

  // Fallback — buraya düşmemeli
  return { safe: true, action: GuardrailAction.PASS, leaks: [], sanitized: response, telemetry: null };
}

function detectClaimGateTopic({ intent = null, activeFlow = null, userMessage = '' }) {
  const normalizedIntent = String(intent || '').toLowerCase();
  const normalizedFlow = String(activeFlow || '').toUpperCase();
  const text = normalizeTopicText(userMessage);

  // ORDER_STATUS: Intent/flow match is authoritative
  if (TOOL_REQUIRED_CLAIM_GATES.ORDER_STATUS.intents.has(normalizedIntent) ||
      TOOL_REQUIRED_CLAIM_GATES.ORDER_STATUS.flows.has(normalizedFlow)) {
    return 'ORDER_STATUS';
  }

  // ORDER_STATUS text fallback: detect direct "where is my order" variants (TR/EN)
  // using accent-insensitive text to cover "siparisim nerde kaldi" type inputs.
  const hasOrderIdentifier = /\b(ord|sip|order)[-_]\d+\b/i.test(text) ||
    /\bsiparis\s*(no|numarasi|numaram|num)\b/i.test(text) ||
    /\btracking\b/i.test(text) ||
    /\border\s*status\b/i.test(text) ||
    /\bwhere\s+is\s+my\s+(order|package)\b/i.test(text) ||
    /\bsiparis(?:im)?\s*(nerede|nerde|durum(?:u)?|ne durumda|hangi asamada|ne asamada|kaldi)\b/i.test(text) ||
    /\bkargom?\s*(nerede|nerde|durum(?:u)?|ne durumda|kaldi)\b/i.test(text);
  if (hasOrderIdentifier) return 'ORDER_STATUS';

  // DEBT_INQUIRY
  if (TOOL_REQUIRED_CLAIM_GATES.DEBT_INQUIRY.intents.has(normalizedIntent) ||
      TOOL_REQUIRED_CLAIM_GATES.DEBT_INQUIRY.flows.has(normalizedFlow)) {
    return 'DEBT_INQUIRY';
  }
  if (looksLikeDebtOrPaymentInput(text)) {
    return 'DEBT_INQUIRY';
  }

  // TICKET_STATUS
  if (TOOL_REQUIRED_CLAIM_GATES.TICKET_STATUS.intents.has(normalizedIntent) ||
      TOOL_REQUIRED_CLAIM_GATES.TICKET_STATUS.flows.has(normalizedFlow)) {
    return 'TICKET_STATUS';
  }
  if (/\b(ticket|destek kaydı|support ticket|ariza kaydi|case id)\b/i.test(text)) {
    return 'TICKET_STATUS';
  }

  // PRODUCT_INFO
  if (TOOL_REQUIRED_CLAIM_GATES.PRODUCT_INFO.intents.has(normalizedIntent) ||
      TOOL_REQUIRED_CLAIM_GATES.PRODUCT_INFO.flows.has(normalizedFlow)) {
    return 'PRODUCT_INFO';
  }
  if (/\b(stok|stock|ürün|urun|product|özellik|ozellik|spec|fiyat|price|sku|model)\b/i.test(text)) {
    return 'PRODUCT_INFO';
  }

  return null;
}

/**
 * Tool-required claim gate:
 * If a lookup-required topic is detected but no required tool is called,
 * return a minimal-information request instead of backend templates.
 */
export function evaluateToolRequiredClaimGate({
  intent = null,
  activeFlow = null,
  userMessage = '',
  toolsCalled = []
} = {}) {
  const topic = detectClaimGateTopic({ intent, activeFlow, userMessage });
  if (!topic) return { needsMinInfo: false };

  const topicConfig = TOOL_REQUIRED_CLAIM_GATES[topic];
  if (!topicConfig) return { needsMinInfo: false };

  const called = new Set((Array.isArray(toolsCalled) ? toolsCalled : []).map(String));
  const hasRequiredToolCall = [...topicConfig.requiredTools].some(tool => called.has(tool));
  if (hasRequiredToolCall) {
    return { needsMinInfo: false };
  }

  return {
    needsMinInfo: true,
    reason: 'TOOL_REQUIRED_NOT_CALLED',
    topic,
    missingFields: topicConfig.missingFields
  };
}

/**
 * NOT_FOUND claim gate:
 * If any tool produced NOT_FOUND, convert to a clarification action.
 */
export function evaluateNotFoundClaimGate(toolOutputs = [], options = {}) {
  const { userMessage = '', intent = null, activeFlow = null } = options;
  const firstNotFound = (Array.isArray(toolOutputs) ? toolOutputs : []).find((output) => {
    const normalized = normalizeOutcome(output?.outcome);
    if (normalized === ToolOutcome.NOT_FOUND) return true;
    const data = output?.output?.truth || output?.output?.data || output?.output;
    return normalizeOutcome(data?.outcome) === ToolOutcome.NOT_FOUND;
  });

  if (!firstNotFound) {
    return { needsClarification: false };
  }

  // Check if debt context is active via intent/flow OR message content
  const normalizedIntent = String(intent || '').toLowerCase();
  const normalizedFlow = String(activeFlow || '').toUpperCase();
  const isDebtContext =
    TOOL_REQUIRED_CLAIM_GATES.DEBT_INQUIRY.intents.has(normalizedIntent) ||
    TOOL_REQUIRED_CLAIM_GATES.DEBT_INQUIRY.flows.has(normalizedFlow) ||
    looksLikeDebtOrPaymentInput(userMessage);

  const toolName = String(firstNotFound?.name || '').toLowerCase();
  let missingFields = ['reference_id'];
  if (toolName.includes('ticket')) {
    missingFields = ['ticket_number'];
  } else if (toolName.includes('stock') || toolName.includes('product')) {
    missingFields = ['product_name'];
  } else if (toolName.includes('customer_data_lookup') && isDebtContext) {
    missingFields = ['vkn_or_tc_or_phone'];
  } else if (toolName.includes('order') || toolName.includes('customer_data_lookup')) {
    missingFields = looksLikeAmbiguousOrderOrPhoneInput(userMessage)
      ? ['order_or_phone']
      : ['order_number'];
  }

  return {
    needsClarification: true,
    reason: 'TOOL_NOT_FOUND',
    missingFields,
    toolName: firstNotFound?.name || null
  };
}

// ============================================================================
// TOOL OUTPUT FIELD EXTRACTOR
// ============================================================================

/**
 * Tool output'tan hangi field'ların döndüğünü çıkar
 * Bu, Security Gateway'e requestedDataFields olarak geçilir
 */
export function extractFieldsFromToolOutput(toolResult) {
  if (!toolResult) return [];

  const fields = [];
  // Support both new format (toolResult.output) and legacy format
  const rawOutput = toolResult.output || toolResult;
  const data = rawOutput?.truth || rawOutput?.data || rawOutput;

  if (!data) return fields;

  // Sipariş bilgileri
  if (data.status || data.orderStatus) fields.push('order_status');
  if (data.items || data.products || data.orderItems) fields.push('order_items');
  if (data.total || data.orderTotal) fields.push('order_total');

  // Kargo/Teslimat
  if (data.trackingNumber || data.tracking) fields.push('tracking_number');
  if (data.carrier || data.courier || data.shippingCompany) fields.push('carrier_name');
  if (data.branch || data.distributionCenter) fields.push('branch_name');
  if (data.deliveryDate) fields.push('delivery_date');
  if (data.deliveryTime || data.deliveryWindow) fields.push('delivery_window');
  if (data.deliveredTo || data.recipient || data.signedBy) fields.push('delivered_to');

  // Adres
  if (data.address) fields.push('address');
  if (data.neighborhood || data.mahalle) fields.push('neighborhood');
  if (data.district || data.ilce) fields.push('district');

  // Müşteri
  if (data.customerName || data.name) fields.push('customer_name');
  if (data.phone || data.phoneNumber) fields.push('phone_number');
  if (data.email) fields.push('email');

  return fields;
}

/**
 * Tool output'tan record owner bilgisini çıkar
 * Identity match için kullanılır
 */
export function extractRecordOwner(toolResult) {
  if (!toolResult) return null;

  // Support both new format (toolResult.output) and legacy format
  const rawOutput = toolResult.output || toolResult;
  const data = rawOutput?.truth || rawOutput?.data || rawOutput;

  if (!data) return null;

  return {
    phone: data.phone || data.phoneNumber || data.customerPhone,
    email: data.email || data.customerEmail,
    customerId: data.customerId || data.customer_id,
    orderId: data.orderId || data.order_id
  };
}

/**
 * Backward-compatible no-op wrappers.
 * Steering overrides were removed; claim gates are now handled via
 * evaluateToolRequiredClaimGate / evaluateNotFoundClaimGate.
 */
export function checkProductNotFound() {
  return { needsOverride: false };
}

export function checkOrderNotFoundPressure() {
  return { needsOverride: false };
}

export function enforceRequiredToolCall() {
  return { needsOverride: false };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  GuardrailAction,
  DATA_CLASSES,
  getDataClass,
  evaluateSecurityGateway,
  applyLeakFilter,
  evaluateToolRequiredClaimGate,
  evaluateNotFoundClaimGate,
  runContextualDetection,
  extractFieldsFromToolOutput,
  extractRecordOwner,
  checkProductNotFound,
  checkOrderNotFoundPressure,
  enforceRequiredToolCall
};
