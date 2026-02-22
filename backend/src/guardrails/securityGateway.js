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
  NOT_FOUND_RESPONSE_PATTERNS,
  ORDER_FABRICATION_PATTERNS,
  POLICY_RESPONSE_HINT_PATTERNS
} from '../security/patterns/index.js';
import { comparePhones } from '../utils/text.js';
import { ToolOutcome, normalizeOutcome } from '../tools/toolResult.js';
import { getMessageVariant } from '../messages/messageCatalog.js';

export const GuardrailAction = Object.freeze({
  PASS: 'PASS',
  SANITIZE: 'SANITIZE',
  BLOCK: 'BLOCK',
  NEED_MIN_INFO_FOR_TOOL: 'NEED_MIN_INFO_FOR_TOOL'
});

const LOOKUP_TOOL_HINTS = Object.freeze(new Set([
  'customer_data_lookup',
  'check_order_status',
  'check_order_status_crm',
  'check_ticket_status_crm',
  'order_search'
]));

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

/**
 * Mask phone numbers in response text.
 * Replaces digits with asterisks, keeping first 3 and last 2 visible.
 * e.g. "05551234567" → "055*****67"
 */
function maskPhoneNumbers(text) {
  if (!text) return text;
  return text
    // TR mobil: 0555 123 45 67 veya 05551234567
    .replace(/\b(0?5\d{2})[\s\-]?(\d{3})[\s\-]?(\d{2})[\s\-]?(\d{2})\b/g, (_, p1) => `${p1}*****${_.slice(-2)}`)
    // E.164: +90 555 123 4567
    .replace(/(\+90[\s\-]?5\d{2})[\s\-]?\d{3,}/g, (m) => m.slice(0, 7) + '*'.repeat(Math.max(0, m.replace(/[\s\-]/g, '').length - 9)) + m.slice(-2))
    // "son 4 hane 1234" / "last 4 digits 1234"
    .replace(/((?:son\s*4(?:\s*hane(?:si)?)?|last\s*4(?:\s*digits?)?)\s*[:=]?\s*)\d{4}\b/gi, '$1****')
    // 10-11 ardışık hane
    .replace(/\b(\d{3})\d{5,8}(\d{2})\b/g, '$1*****$2');
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
  // Telefon — SADECE rakam-temelli pattern'ler.
  // "telefon" kelimesi tek başına ASLA phone leak tetiklemez.
  phone: [
    /\b0?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b/,  // TR mobil: 05xx xxx xx xx
    /\+90[\s\-]?5\d{2}[\s\-]?\d{3}/,                       // E.164: +90 5xx xxx (en az 7 hane)
    /\b\d{10,11}\b/,                                        // 10-11 hane ardışık rakam
    /(?:son\s*4(?:\s*hane(?:si)?)?|last\s*4(?:\s*digits?)?|xxxx)\s*[:=]?\s*\d{4}\b/i, // "son 4 hanesi 1234"
    /telefon\s*(?:no|numarası?|numaranız)\s*[:=]\s*[\d\s\-\+]{7,}/i, // "telefon no: 05551234567" (rakam ZORUNLU)
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

function hasLookupContext(options = {}) {
  const toolsCalled = Array.isArray(options.toolsCalled) ? options.toolsCalled : [];
  const hasLookupTool = toolsCalled.some(toolName => LOOKUP_TOOL_HINTS.has(toolName));
  return hasLookupTool;
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

// ============================================================================
// PRODUCT NOT FOUND HANDLER (Kova C - HP-07, HP-18)
// ============================================================================

/**
 * Ürün bulunamadı durumunu tespit et
 * LLM "bilgim yok" yerine net "bulunamadı" demeli
 *
 * @param {string} response - LLM response
 * @param {Array} toolOutputs - Tool çıktıları
 * @param {string} language - TR | EN
 * @returns {Object} { needsOverride, overrideResponse }
 */
export function checkProductNotFound(response, toolOutputs = [], language = 'TR') {
  // Tool output'larında product search olup NOT_FOUND dönmüş mü?
  // toolOutputs artık full result objeleri içeriyor: { name, success, output, outcome, message }
  const productSearchResult = toolOutputs.find(result => {
    if (!result) return false;

    // Direct outcome check (from toolResult.js - PRIMARY check)
    if (normalizeOutcome(result.outcome) === ToolOutcome.NOT_FOUND) return true;

    // Check nested data in output
    const data = result.output?.truth || result.output?.data || result.output;

    return (
      normalizeOutcome(data?.outcome) === ToolOutcome.NOT_FOUND ||
      // Legacy flags
      result.output?.notFound === true ||
      data?.notFound === true ||
      data?.found === false ||
      data?.products?.length === 0 ||
      // Type/error indicators
      data?.type === 'PRODUCT_NOT_FOUND' ||
      data?.error === 'PRODUCT_NOT_FOUND' ||
      // Message content check
      /ürün.*bulunamadı|product.*not.*found|kayıt.*bulunamadı/i.test(result.message || data?.message || '')
    );
  });

  if (!productSearchResult) {
    return { needsOverride: false };
  }

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const patterns = NOT_FOUND_RESPONSE_PATTERNS[lang] || NOT_FOUND_RESPONSE_PATTERNS.TR;

  const hasNotFoundStatement = patterns.some(p => p.test(response));

  if (hasNotFoundStatement) {
    return { needsOverride: false }; // LLM zaten doğru söylemiş
  }

  // LLM "bulunamadı" dememiş - override et
  const overrideVariant = getMessageVariant('SECURITY_PRODUCT_NOT_FOUND', {
    language,
    directiveType: 'SECURITY_GATEWAY',
    severity: 'info',
    seedHint: `PRODUCT_NOT_FOUND|${response || ''}`
  });
  const overrideResponse = overrideVariant.text;

  return {
    needsOverride: true,
    overrideResponse,
    messageKey: overrideVariant.messageKey,
    variantIndex: overrideVariant.variantIndex,
    reason: 'PRODUCT_NOT_FOUND_NOT_ACKNOWLEDGED'
  };
}

// ============================================================================
// ORDER NOT FOUND HANDLER (HP-01 - Sipariş bulunamadı sonrası baskı)
// ============================================================================

/**
 * Sipariş bulunamadı durumunda:
 * 1. LLM "bulunamadı" demiş mi kontrol et (ürün gibi)
 * 2. LLM ürün listesi uyduruyor mu kontrol et
 *
 * @param {string} response - LLM response
 * @param {Array} toolOutputs - Tool çıktıları
 * @param {string} language - TR | EN
 * @returns {Object} { needsOverride, overrideResponse }
 */
export function checkOrderNotFoundPressure(response, toolOutputs = [], language = 'TR') {
  // P0-DEBUG: Log input for debugging
  console.log('🔍 [checkOrderNotFoundPressure] Input:', {
    responseLength: response?.length || 0,
    toolOutputsCount: toolOutputs?.length || 0,
    toolOutputs: toolOutputs?.map(r => ({
      name: r?.name,
      outcome: r?.outcome,
      success: r?.success,
      hasMessage: !!r?.message
    }))
  });

  // Tool output'larında order search olup NOT_FOUND dönmüş mü?
  // toolOutputs artık full result objeleri içeriyor: { name, success, output, outcome, message }
  const orderNotFound = toolOutputs.find(result => {
    if (!result) return false;

    // Direct outcome check (from toolResult.js - PRIMARY check)
    if (normalizeOutcome(result.outcome) === ToolOutcome.NOT_FOUND) {
      console.log('✅ [checkOrderNotFoundPressure] Found NOT_FOUND via direct outcome check');
      return true;
    }

    // Check nested data in output
    const data = result.output?.truth || result.output?.data || result.output;

    const isNotFound = (
      normalizeOutcome(data?.outcome) === ToolOutcome.NOT_FOUND ||
      // Legacy flags
      result.output?.notFound === true ||
      data?.notFound === true ||
      data?.orderFound === false ||
      data?.found === false ||
      // Type/error indicators
      data?.type === 'ORDER_NOT_FOUND' ||
      data?.error === 'ORDER_NOT_FOUND' ||
      data?.error === 'NOT_FOUND' ||
      // Message content check
      /sipariş.*bulunamadı|order.*not.*found|kayıt.*bulunamadı|no.*matching.*record|eşleşen.*bulunamadı/i.test(result.message || data?.message || '')
    );

    if (isNotFound) {
      console.log('✅ [checkOrderNotFoundPressure] Found NOT_FOUND via nested/legacy check');
    }

    return isNotFound;
  });

  console.log('🔍 [checkOrderNotFoundPressure] Detection result:', {
    orderNotFound: !!orderNotFound,
    foundInTool: orderNotFound?.name
  });

  if (!orderNotFound) {
    return { needsOverride: false };
  }

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';

  // ============================================
  // STEP 1: LLM "bulunamadı" demiş mi kontrol et
  // ============================================
  const notFoundPatternsForLang = NOT_FOUND_RESPONSE_PATTERNS[lang] || NOT_FOUND_RESPONSE_PATTERNS.TR;
  const hasNotFoundStatement = notFoundPatternsForLang.some(p => p.test(response));

  // ============================================
  // STEP 2: LLM ürün listesi uyduruyor mu?
  // ============================================
  const fabricationPatternsForLang = ORDER_FABRICATION_PATTERNS[lang] || ORDER_FABRICATION_PATTERNS.TR;
  const hasFabrication = fabricationPatternsForLang.some(p => p.test(response));

  // ============================================
  // DECISION LOGIC
  // ============================================

  // Case 1: LLM "bulunamadı" demiş ve fabrication yok → OK
  if (hasNotFoundStatement && !hasFabrication) {
    return { needsOverride: false };
  }

  // Case 2: LLM fabrication yapıyor → Override
  if (hasFabrication) {
    const overrideVariant = getMessageVariant('SECURITY_ORDER_NOT_FOUND_FABRICATION', {
      language: lang,
      directiveType: 'SECURITY_GATEWAY',
      severity: 'warning',
      seedHint: `ORDER_NOT_FOUND_FABRICATION|${response || ''}`
    });
    const overrideResponse = overrideVariant.text;

    return {
      needsOverride: true,
      overrideResponse,
      messageKey: overrideVariant.messageKey,
      variantIndex: overrideVariant.variantIndex,
      reason: 'ORDER_NOT_FOUND_FABRICATION_DETECTED'
    };
  }

  // Case 3: LLM "bulunamadı" DEMEMİŞ (spesifik cevap vermiş) → Override
  // Bu kritik: tool NOT_FOUND döndü ama LLM bunu acknowledge etmedi
  if (!hasNotFoundStatement) {
    console.warn('⚠️ [SecurityGateway] ORDER_NOT_FOUND but LLM did not acknowledge - enforcing fallback');

    const overrideVariant = getMessageVariant('SECURITY_ORDER_NOT_FOUND_NOT_ACK', {
      language: lang,
      directiveType: 'SECURITY_GATEWAY',
      severity: 'info',
      seedHint: `ORDER_NOT_FOUND_NO_ACK|${response || ''}`
    });
    const overrideResponse = overrideVariant.text;

    return {
      needsOverride: true,
      overrideResponse,
      messageKey: overrideVariant.messageKey,
      variantIndex: overrideVariant.variantIndex,
      reason: 'ORDER_NOT_FOUND_NOT_ACKNOWLEDGED'
    };
  }

  return { needsOverride: false };
}

// ============================================================================
// REQUIRES TOOL CALL ENFORCEMENT (HP-07 Fix)
// ============================================================================

/**
 * Intent'in tool çağrısı gerektirip gerektirmediğini kontrol et
 * Tool çağrılmamışsa deterministik response döndür
 *
 * @param {string} intent - Tespit edilen intent (product_spec, stock_check vb.)
 * @param {Array} toolsCalled - Çağrılan tool'ların listesi
 * @param {string} language - TR | EN
 * @returns {Object} { needsOverride, overrideResponse }
 */
export function enforceRequiredToolCall(intent, toolsCalled = [], language = 'TR', responseText = '') {
  // Intent'ler ve tool zorunlulukları
  const TOOL_REQUIRED_INTENTS = {
    product_spec: {
      requiredTools: ['get_product_stock', 'search_products'],
      messageKey: 'SECURITY_TOOL_REQUIRED_PRODUCT_SPEC'
    },
    stock_check: {
      requiredTools: ['get_product_stock', 'search_products'],
      messageKey: 'SECURITY_TOOL_REQUIRED_STOCK_CHECK'
    }
  };

  // Bu intent tool gerektiriyor mu?
  const intentConfig = TOOL_REQUIRED_INTENTS[intent];
  if (!intentConfig) {
    return { needsOverride: false };
  }

  // Tool çağrılmış mı kontrol et
  const calledRequiredTool = intentConfig.requiredTools.some(tool =>
    toolsCalled.includes(tool)
  );

  if (calledRequiredTool) {
    return { needsOverride: false }; // Tool çağrılmış, sorun yok
  }

  // P2-F: Enhanced check — even if tool wasn't called, check if LLM fabricated product data
  // Detect specific product claims (price, specs, availability) in response
  if (responseText && containsProductClaims(responseText, language)) {
    console.warn(`🚨 [SecurityGateway] Product data fabrication detected for intent "${intent}"!`);
  }

  // Tool çağrılmamış - deterministik response döndür
  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const overrideVariant = getMessageVariant(intentConfig.messageKey, {
    language: lang,
    directiveType: 'SECURITY_GATEWAY',
    severity: 'info',
    intent,
    seedHint: `${intent}|REQUIRED_TOOL_NOT_CALLED`
  });
  const overrideResponse = overrideVariant.text;

  console.warn(`⚠️ [SecurityGateway] TOOL_REQUIRED intent "${intent}" but no tool called! Enforcing fallback.`);

  return {
    needsOverride: true,
    overrideResponse,
    messageKey: overrideVariant.messageKey,
    variantIndex: overrideVariant.variantIndex,
    reason: 'TOOL_REQUIRED_NOT_CALLED',
    intent
  };
}

/**
 * P2-F: Detect product-specific claims in response text
 * Used to catch LLM hallucinating product info from training data
 */
function containsProductClaims(response, language = 'TR') {
  const patterns = {
    TR: [
      // Price claims
      /fiyat[ıi]?\s*[:\s]*[\d.,]+\s*(TL|₺|USD|\$|EUR|€)/i,
      /[\d.,]+\s*(TL|₺)\s*(fiyat|ücret|maliyet)/i,
      // Spec claims
      /özellik(ler)?[iı]?\s*[:\s]*(boyut|ağırlık|güç|kapasite|renk|malzeme)/i,
      /teknik\s*(detay|özellik|bilgi)\s*[:\s]/i,
      // Availability claims
      /stok(ta|umuzda)\s*(var|mevcut|bulunuyor)/i,
      /mağaza(mız)?da\s*(mevcut|satışta|bulunuyor)/i,
      /(web\s*site|online)\s*(mağaza)?(mız)?da\s*(mevcut|var|bulunuyor)/i,
    ],
    EN: [
      /price\s*[:\s]*[\d.,]+\s*(USD|\$|EUR|€|GBP|£)/i,
      /specifications?\s*[:\s]*(size|weight|power|capacity|color|material)/i,
      /technical\s*(details?|specs?)\s*[:\s]/i,
      /in\s*stock/i,
      /available\s*(in\s*store|online|now)/i,
    ]
  };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const langPatterns = patterns[lang] || patterns.TR;

  return langPatterns.some(p => p.test(response));
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
  runContextualDetection,
  extractFieldsFromToolOutput,
  extractRecordOwner,
  checkProductNotFound,
  checkOrderNotFoundPressure,
  enforceRequiredToolCall
};
