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

const LOOKUP_INTENT_HINTS = Object.freeze(new Set([
  'order_status',
  'tracking_info',
  'ticket_status',
  'debt_inquiry',
  'verification_response'
]));

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

function getNoToolPlanSanitizeMessage(language = 'TR') {
  return String(language || '').toUpperCase() === 'EN'
    ? 'I cannot verify account-specific details from that response yet. Share your order number and I can check safely.'
    : 'Bu yanıttaki hesaba özel detayları henüz doğrulayamıyorum. Sipariş numaranızı paylaşırsanız güvenli şekilde kontrol edebilirim.';
}

function sanitizeLeaksWithoutToolPlan(response, leaks = [], language = 'TR') {
  const leakTypes = new Set((Array.isArray(leaks) ? leaks : []).map(l => l?.type).filter(Boolean));
  if (leakTypes.size === 0) return null;

  // Phone-only leak'ler için partial redaction uygula (maksimum bağlam korunur).
  if ([...leakTypes].every(type => type === 'phone' || type === 'internal')) {
    return maskPhoneNumbers(response);
  }

  // Other account-specific leaks (tracking/address/name/shipping/delivery) için
  // deterministic safe rewrite kullan.
  return getNoToolPlanSanitizeMessage(language);
}

const INTERNAL_METADATA_PATTERNS = INTERNAL_METADATA_TERMS.map(term =>
  new RegExp(escapeRegExp(term), 'i')
);

/**
 * Hassas veri pattern'leri
 * Bu pattern'ler LLM output'unda aranır
 */
const SENSITIVE_PATTERNS = {
  // ============================================
  // CUSTOMER NAME / IDENTITY (P0 - Never expose before verification!)
  // ============================================
  customerName: [
    // "İbrahim Yıldız adına kayıtlı", "Ahmet Kaya'ya ait"
    // NOTE: Previously the `ad` alternative was too greedy — matched Turkish suffixes like
    // "bulunmamaktadır" (-ad). Now requires standalone word boundary (\b) around ad/isim/kayıt.
    /\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s*(adına|'?(n?[ıiuü]n)?\s*\b(adı|isim|kayıt|sipariş)\b)/i,
    // "kayıtlı isim: Mehmet Demir"
    /(kayıtlı|sipariş sahibi|müşteri)\s*(isim|ad|adı?)\s*[:=]?\s*[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+/i,
    // "Sayın Ahmet Bey/Hanım"
    /sayın\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+(bey|hanım)/i,
    // English: "registered to John Smith", "belongs to Jane Doe"
    /(registered|belongs)\s+to\s+[A-Z][a-z]+\s+[A-Z][a-z]+/i,
  ],

  // ────────────────────────────────────────────────────────
  // tracking / shipping / delivery / address — KALDIRILDI.
  // Bu tipler artık CONTEXTUAL DETECTION ile taranır.
  // Candidate token + ±80 char context window modeline geçildi.
  // Aşağıdaki SENSITIVE_PATTERNS'ta kalan tipler:
  //   customerName, phone, internal
  // ────────────────────────────────────────────────────────

  // Adres bilgileri — hâlâ regex-only (her adres pattern zaten bağlamlı)
  address: [
    /mahalle(si)?\s*[:=]?\s*[A-ZÇĞİÖŞÜa-zçğıöşü\s]{3,}/i,
    /sokak|cadde|bulvar/i,
    /\b(apt|apartman|bina|daire)\b/i,
    /\b\d+\s*\.\s*kat\b/i,           // "3. kat"
    /\bkat\s*[:=]\s*\d/i,             // "kat: 5"
    /\b(daire|no)\s*[:=]?\s*\d+\s*[\s,/]+\s*kat\b/i, // "daire 5, kat 3"
    /ilçe(si)?\s*[:=]?\s*[A-ZÇĞİÖŞÜa-zçğıöşü\s]{3,}/i,
  ],

  // Zaman aralığı
  timeWindow: [
    /saat\s*(\d{1,2})[:\.](\d{2})?\s*(ile|[-–])\s*(\d{1,2})/i,
    /(\d{1,2})[:\.](\d{2})?\s*(civarı|sıralarında|gibi)/i,
    /(bugün|yarın)\s*saat\s*\d/i,
  ],

  // Telefon — SADECE rakam-temelli pattern'ler.
  // "telefon" kelimesi tek başına ASLA phone leak tetiklemez.
  // Tetiklenme koşulu: response'ta gerçek telefon numarası formatı olmalı.
  phone: [
    /\b0?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b/,  // TR mobil: 05xx xxx xx xx
    /\+90[\s\-]?5\d{2}[\s\-]?\d{3}/,                       // E.164: +90 5xx xxx (en az 7 hane)
    /\b\d{10,11}\b/,                                        // 10-11 hane ardışık rakam
    /(?:son\s*4(?:\s*hane(?:si)?)?|last\s*4(?:\s*digits?)?|xxxx)\s*[:=]?\s*\d{4}\b/i, // "son 4 hanesi 1234"
    /telefon\s*(?:no|numarası?|numaranız)\s*[:=]\s*[\d\s\-\+]{7,}/i, // "telefon no: 05551234567" (rakam ZORUNLU, en az 7 hane)
  ],

  // Internal/System
  internal: [
    ...INTERNAL_METADATA_PATTERNS,
    /verification\s*(state|flow|fsm)/i,
    /system\s*prompt/i,
    /güvenlik\s*protokol/i,
  ]
};

// ============================================================================
// CONTEXTUAL DETECTION — UNIFIED CANDIDATE + CONTEXT WINDOW MODEL
// ============================================================================
//
// MİMARİ: 2-aşamalı karar
//   A) Candidate token detection — metin içinde aday kelime bulunur
//   B) ±CONTEXT_WINDOW karakter içinde context keyword doğrulaması
//   → İkisi birlikte yoksa ASLA SANITIZE/BLOCK üretmez
//
// Context window = ±80 karakter.
//   – ±30 çok dar: "Kargonuz Aras ile gönderildi" gibi cümleler kaçabilir
//   – ±80 çoğu Türkçe/İngilizce cümleyi kapsar (~12-15 kelime)
//   – False positive riski düşük çünkü zaten context keyword şartı var
//
// 4 grup:
//   1. CARRIER  (aras, ptt, mng, ups, yurtiçi, ...) + shipping context
//   2. DELIVERY (kapıcı, güvenlik, resepsiyon, imza, komşu, teslim alan) + delivery context
//   3. TRACKING (takip, tracking, kargo + alfanumerik) + tracking context
//   4. NUMERIC  (10-20 haneli sayı) + shipping/tracking context
//
// Her match telemetri döndürür: { triggerType, candidateToken, contextHit }
// ============================================================================
const CONTEXT_WINDOW = 80;

// ── Shared context keyword sets ──────────────────────────────────────────
const SHIPPING_CONTEXT_KEYWORDS = /\b(kargo|gönderi|shipment|waybill|teslimat|tracking|cargo|paket|gönderildi|gonderildi|teslim|dağıtım)\b/i;
const DELIVERY_CONTEXT_KEYWORDS = /\b(teslim|bırak|bırakıldı|teslimat|kargo|gönderi|sipariş|paket|delivered|delivery)\b/i;
const TRACKING_CONTEXT_KEYWORDS = /\b(kargo|takip|gönderi|shipment|waybill|teslimat|tracking|cargo|paket|gönderildi|gonderildi|teslim)\b/i;

// ── Candidate token definitions ──────────────────────────────────────────

// 1. CARRIER candidates — firma isimleri
const CARRIER_CANDIDATES = /\b(yurtiçi|yurtici|aras|mng|ptt|ups|fedex|dhl|sürat|surat|horoz)\b/gi;

// 2. DELIVERY candidates — teslimat noktası / imza / kişi
//    Türkçe ek uyumlu: güvenlik → güvenliğe, komşu → komşunuza, resepsiyon → resepsiyona
//    \b sadece başta, sonda suffix'e izin ver ([a-zçğıöşüA-ZÇĞİÖŞÜ]* ile)
const DELIVERY_CANDIDATES = /\b(kapıcı|güvenli[kğ]|resepsiyon|imza|komşu)[a-zçğıöşüA-ZÇĞİÖŞÜ]*/gi;

// 3. TRACKING candidates — takip kelimesi + alfanumerik kod yakınlığı
//    "takip no: TR123", "kargo takip 123456", "tracking number ABC123"
//    NOT: "takip edin", "takip edebilirsiniz" (genel fiil kullanımı)
const TRACKING_CODE_PATTERN = /\b[A-Z]{2}\d{9,12}[A-Z]{0,2}\b/i;  // TR1234567890
const TRACKING_LABEL_PATTERN = /takip\s*(no|numarası?|kodu?)\s*[:=]?\s*[A-Z0-9\-]{6,}/i;
const TRACKING_LABEL_EN_PATTERN = /tracking\s*(number|code|id)?\s*[:=]?\s*[A-Z0-9\-]{6,}/i;
const TRACKING_PROXIMITY_CANDIDATES = /\b(kargo|tracking|shipment|waybill)\b/gi; // "takip" çıkarıldı — generic verb
const TRACKING_PROXIMITY_CODE = /\b[A-Z0-9\-]{6,}\b/g;

// 4. NUMERIC tracking — 10-20 haneli sayılar
const NUMERIC_TRACKING_CANDIDATE = /\b\d{10,20}\b/g;

// 5. SHIPPING-SPECIFIC patterns (daima bağlamlı — regex kendisi yeterli)
const SHIPPING_SELF_CONTEXTUAL = /dağıtım\s*(merkez|şube)/i;

// ── Generic context window scanner ──────────────────────────────────────
/**
 * Candidate regex'i response üzerinde tarar.
 * Her match için ±CONTEXT_WINDOW karakter penceresi açar.
 * Pencerede contextKeywords bulunursa → leak hit döndürür.
 *
 * @returns {Array<{candidateToken: string, contextHit: string, index: number}>}
 */
function scanCandidatesWithContext(response, candidateRegex, contextKeywords) {
  candidateRegex.lastIndex = 0;
  const hits = [];
  let match;
  while ((match = candidateRegex.exec(response)) !== null) {
    const from = Math.max(0, match.index - CONTEXT_WINDOW);
    const to = Math.min(response.length, match.index + match[0].length + CONTEXT_WINDOW);
    const window = response.slice(from, to);
    const ctxMatch = contextKeywords.exec(window);
    contextKeywords.lastIndex = 0; // reset for next iteration
    if (ctxMatch) {
      hits.push({
        candidateToken: match[0],
        contextHit: ctxMatch[0],
        index: match.index
      });
    }
  }
  return hits;
}

// ── Tracking proximity scanner (special: candidate + nearby code) ────────
function scanTrackingProximity(response) {
  TRACKING_PROXIMITY_CANDIDATES.lastIndex = 0;
  const hits = [];
  let match;
  while ((match = TRACKING_PROXIMITY_CANDIDATES.exec(response)) !== null) {
    const from = Math.max(0, match.index - 30);
    const to = Math.min(response.length, match.index + match[0].length + 30);
    const window = response.slice(from, to);
    TRACKING_PROXIMITY_CODE.lastIndex = 0;
    const codeMatch = TRACKING_PROXIMITY_CODE.exec(window);
    if (codeMatch) {
      hits.push({
        candidateToken: match[0],
        contextHit: codeMatch[0],
        index: match.index
      });
    }
  }
  return hits;
}

// ============================================================================
// PUBLIC API: runContextualDetection
// ============================================================================
/**
 * Tüm contextual leak gruplarını tarar.
 * @returns {Array<{type: string, triggerType: string, candidateToken: string, contextHit: string}>}
 */
export function runContextualDetection(response = '') {
  const results = [];

  // 1. CARRIER — firma + shipping context
  const carrierHits = scanCandidatesWithContext(response, CARRIER_CANDIDATES, SHIPPING_CONTEXT_KEYWORDS);
  for (const h of carrierHits) {
    results.push({ type: 'shipping', triggerType: 'carrier_context', ...h });
  }

  // 2. DELIVERY — teslimat noktası/imza + delivery context
  const deliveryHits = scanCandidatesWithContext(response, DELIVERY_CANDIDATES, DELIVERY_CONTEXT_KEYWORDS);
  for (const h of deliveryHits) {
    results.push({ type: 'delivery', triggerType: 'delivery_context', ...h });
  }

  // 3. TRACKING — structural patterns (no context needed, pattern itself is contextual)
  if (TRACKING_CODE_PATTERN.test(response)) {
    const m = response.match(TRACKING_CODE_PATTERN);
    results.push({ type: 'tracking', triggerType: 'tracking_code_format', candidateToken: m?.[0] || '', contextHit: 'format_match' });
  }
  if (TRACKING_LABEL_PATTERN.test(response)) {
    const m = response.match(TRACKING_LABEL_PATTERN);
    results.push({ type: 'tracking', triggerType: 'tracking_label_tr', candidateToken: m?.[0] || '', contextHit: 'label_match' });
  }
  if (TRACKING_LABEL_EN_PATTERN.test(response)) {
    const m = response.match(TRACKING_LABEL_EN_PATTERN);
    results.push({ type: 'tracking', triggerType: 'tracking_label_en', candidateToken: m?.[0] || '', contextHit: 'label_match' });
  }
  // Proximity: "kargo/tracking/shipment/waybill" + nearby alphanumeric code
  const proxHits = scanTrackingProximity(response);
  for (const h of proxHits) {
    results.push({ type: 'tracking', triggerType: 'tracking_proximity', ...h });
  }

  // 4. NUMERIC — 10-20 haneli sayı + tracking context
  const numericHits = scanCandidatesWithContext(response, NUMERIC_TRACKING_CANDIDATE, TRACKING_CONTEXT_KEYWORDS);
  for (const h of numericHits) {
    results.push({ type: 'tracking', triggerType: 'numeric_tracking', ...h });
  }

  // 5. SHIPPING self-contextual — dağıtım merkezi/şubesi (always contextual)
  if (SHIPPING_SELF_CONTEXTUAL.test(response)) {
    const m = response.match(SHIPPING_SELF_CONTEXTUAL);
    results.push({ type: 'shipping', triggerType: 'shipping_self_contextual', candidateToken: m?.[0] || '', contextHit: 'self' });
  }

  return results;
}

function hasLookupToolPlan(options = {}) {
  const toolsCalled = Array.isArray(options.toolsCalled) ? options.toolsCalled : [];
  const hasLookupTool = toolsCalled.some(toolName => LOOKUP_TOOL_HINTS.has(toolName));
  const intent = String(options.intent || '').trim().toLowerCase();
  const hasLookupIntent = LOOKUP_INTENT_HINTS.has(intent);

  if (options.toolPlanExists === true) {
    return true;
  }

  return hasLookupTool || hasLookupIntent;
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
    return {
      safe: true,
      action: GuardrailAction.PASS,
      leaks: [],
      sanitized: response,
      telemetry: null
    };
  }
  const callbackPending = options.callbackPending === true;
  const isCallbackFlow = callbackPending || options.activeFlow === 'CALLBACK_REQUEST';

  const leaks = [];
  const triggeredPatterns = []; // Debug: hangi pattern match etti

  // Internal pattern'ler her zaman kontrol edilir (NEVER_EXPOSE class)
  for (const pattern of SENSITIVE_PATTERNS.internal) {
    if (pattern.test(response)) {
      leaks.push({ type: 'internal', pattern: pattern.toString() });
      triggeredPatterns.push({ type: 'internal', pattern: pattern.toString(), dataClass: 'NEVER_EXPOSE' });
    }
  }

  // Verified değilse ACCOUNT_VERIFIED class pattern'leri kontrol et
  if (verificationState !== 'verified') {
    // ── A) Regex-only patterns (customerName, address, timeWindow, phone) ──
    for (const [type, patterns] of Object.entries(SENSITIVE_PATTERNS)) {
      if (type === 'internal') continue; // Zaten kontrol edildi

      for (const pattern of patterns) {
        if (pattern.test(response)) {
          leaks.push({ type, pattern: pattern.toString() });
          triggeredPatterns.push({ type, pattern: pattern.toString(), dataClass: 'ACCOUNT_VERIFIED' });
          break; // Her tip için bir leak yeterli
        }
      }
    }

    // ── B) Contextual detection (shipping, delivery, tracking) ──
    // Candidate token + ±80 char context window — aday tek başına ASLA leak üretmez
    const contextualHits = runContextualDetection(response);
    const seenTypes = new Set();
    for (const hit of contextualHits) {
      if (seenTypes.has(hit.type)) continue; // Her tip için bir leak yeterli
      if (leaks.some(l => l.type === hit.type)) continue; // regex zaten yakaladıysa skip
      seenTypes.add(hit.type);
      leaks.push({
        type: hit.type,
        pattern: `contextual:${hit.triggerType}`,
        triggerType: hit.triggerType,
        candidateToken: hit.candidateToken,
        contextHit: hit.contextHit
      });
      triggeredPatterns.push({
        type: hit.type,
        pattern: `contextual:${hit.triggerType}`,
        dataClass: 'ACCOUNT_VERIFIED',
        triggerType: hit.triggerType,
        candidateToken: hit.candidateToken,
        contextHit: hit.contextHit
      });
    }
  }

  if (leaks.length === 0) {
    return {
      safe: true,
      action: GuardrailAction.PASS,
      leaks: [],
      sanitized: response,
      telemetry: null
    };
  }

  // ============================================
  // CHECK: Is this a PUBLIC/policy response?
  // ============================================
  const onlyInternalLeak = leaks.every(l => l.type === 'internal');
  const isPolicyResponse = POLICY_RESPONSE_HINT_PATTERNS.some(pattern => pattern.test(response));

  // ============================================
  // PHONE LEAK RECLASSIFICATION (P0 FIX)
  // ============================================
  // "telefon" kelimesi ≠ phone number.
  // phone leak = sadece gerçek rakam-temelli pattern match.
  // Eğer response'ta hiç digit yoksa phone leak geçersiz → kaldır.
  const responseHasDigits = /\d/.test(response);
  const hasPhoneLeak = leaks.some(l => l.type === 'phone');

  if (hasPhoneLeak && !responseHasDigits) {
    // "Telefon kanalı" gibi bir ifade, gerçek numara değil → phone leak'i düşür
    console.log('✅ [LeakFilter] Phone pattern matched but NO digits in response — dropping phone leak (false positive)');
    const filteredLeaks = leaks.filter(l => l.type !== 'phone');
    if (filteredLeaks.length === 0 || filteredLeaks.every(l => l.type === 'internal')) {
      // Sadece phone leak vardı (veya phone + internal), digit yok → tamamen safe
      return {
        safe: true,
        action: GuardrailAction.PASS,
        leaks: [],
        sanitized: response,
        telemetry: { reason: 'phone_word_no_digits_pass', triggeredPatterns, responseHasDigits: false }
      };
    }
    // Diğer leak tipleri hâlâ var, phone'u çıkar ve devam et
    leaks.length = 0;
    leaks.push(...filteredLeaks);
  }

  // hasPersonalDataLeak: phone leak SADECE digit varsa sayılır
  // (phone leak zaten yukarıda digit yoksa kaldırıldı, ama yine de guard)
  const hasPersonalDataLeak = leaks.some(l => {
    if (l.type === 'phone') return responseHasDigits; // digit yoksa personal data değil
    return ['address', 'tracking', 'shipping', 'timeWindow', 'delivery', 'customerName'].includes(l.type);
  });

  if (isPolicyResponse && !hasPersonalDataLeak && onlyInternalLeak) {
    console.log('✅ [LeakFilter] Policy response detected, allowing through');
    return {
      safe: true,
      action: GuardrailAction.PASS,
      leaks: [],
      sanitized: response,
      telemetry: { reason: 'policy_response_allowed', triggeredPatterns }
    };
  }

  // ============================================
  // PHONE-ONLY LEAK → REDACT, NOT VERIFY (P0 FIX)
  // ============================================
  // Phone leak varsa ve digit varsa → gerçek numara yakalandı → redact (mask) + PASS.
  // needsVerification SADECE order-specific leak'ler için (tracking, address, customerName vb.)
  const onlyPhoneAndInternal = leaks.every(l => l.type === 'phone' || l.type === 'internal');
  if (hasPhoneLeak && responseHasDigits && onlyPhoneAndInternal) {
    // Gerçek telefon numarası bulundu ama bu order verification gerektirmez.
    // Numarayı maskele ve response'u geçir.
    const sanitized = maskPhoneNumbers(response);
    console.log('🔒 [LeakFilter] Phone number redacted (masked), no verification needed');
    return {
      safe: true,
      action: GuardrailAction.SANITIZE,
      leaks,
      sanitized,
      telemetry: {
        reason: 'phone_redacted_pass',
        triggeredPatterns,
        responseHasDigits: true,
        verificationMode: 'PHONE_REDACT',
        hasPersonalDataLeak: false
      }
    };
  }

  // ============================================
  // VERIFICATION REQUIREMENT DETECTION
  // ============================================
  // needsVerification SADECE order/account-specific leak'ler için:
  // tracking, address, shipping, delivery, timeWindow, customerName
  const hasOrderNumber = !!(collectedData.orderNumber || collectedData.order_number);
  const hasPhone = !!(collectedData.phone || collectedData.last4);
  const hasName = !!(collectedData.name || collectedData.customerName);

  let missingFields = [];
  if (!hasOrderNumber) missingFields.push('order_number');
  if (!hasPhone) missingFields.push('phone_last4');

  const lookupToolPlanExists = hasLookupToolPlan(options);

  // Telemetry objesi (debug için - hangi pattern neden trigger etti)
  const telemetry = {
    verificationState,
    reason: isCallbackFlow ? 'callback_flow_leak_filter_triggered' : 'leak_filter_triggered',
    extractedOrderNo: collectedData.orderNumber || collectedData.order_number || null,
    hasOrderNumber,
    hasPhone,
    hasName,
    missingFields,
    isCallbackFlow,
    leakTypes: leaks.map(l => l.type),
    triggeredPatterns,
    hasPersonalDataLeak,
    responseHasDigits,
    verificationMode: 'ORDER_VERIFY',
    hasLookupToolPlan: lookupToolPlanExists
  };

  if (isCallbackFlow) {
    return {
      safe: false,
      action: GuardrailAction.NEED_MIN_INFO_FOR_TOOL,
      leaks,
      needsCallbackInfo: true,
      missingFields: ['customer_name', 'phone'],
      blockReason: 'CALLBACK_INFO_REQUIRED',
      telemetry
    };
  }

  // Ask minimum info ONLY when planner/router produced a real lookup tool plan.
  // Guardrail never steers domain by itself.
  const shouldAskMinInfo = lookupToolPlanExists && missingFields.length > 0;
  if (shouldAskMinInfo) {
    return {
      safe: false,
      action: GuardrailAction.NEED_MIN_INFO_FOR_TOOL,
      leaks,
      needsVerification: true,
      missingFields,
      blockReason: 'NEED_MIN_INFO_FOR_TOOL',
      telemetry
    };
  }

  // Tool plan yoksa otomatik block yapma.
  // Kural:
  // - Personal/account leak yoksa PASS
  // - Personal/account leak varsa önce deterministic sanitize
  // - Sanitize başarısızsa BLOCK
  if (!lookupToolPlanExists) {
    if (!hasPersonalDataLeak) {
      return {
        safe: true,
        action: GuardrailAction.PASS,
        leaks: [],
        sanitized: response,
        telemetry: {
          ...telemetry,
          reason: 'no_tool_plan_non_personal_pass'
        }
      };
    }

    const sanitizedNoToolPlan = sanitizeLeaksWithoutToolPlan(response, leaks, language);
    if (typeof sanitizedNoToolPlan === 'string' && sanitizedNoToolPlan.trim()) {
      return {
        safe: true,
        action: GuardrailAction.SANITIZE,
        leaks,
        sanitized: sanitizedNoToolPlan,
        telemetry: {
          ...telemetry,
          reason: 'sanitized_no_tool_plan_personal_leak'
        }
      };
    }
  }

  // Residual high-risk path: sanitize üretilemedi veya tool-plan akışında
  // minimum bilgi kararı verilemedi. Bu durumda deterministic barrier uygula.
  return {
    safe: false,
    action: GuardrailAction.BLOCK,
    leaks,
    needsVerification: false,
    missingFields: [],
    blockReason: lookupToolPlanExists
      ? 'LEAK_FILTER_BLOCKED_TOOL_PLAN_PATH'
      : 'LEAK_FILTER_BLOCKED_SANITIZE_FAILED',
    blockedMessage: String(language || '').toUpperCase() === 'EN'
      ? 'I cannot share that detail right now for security reasons.'
      : 'Güvenlik nedeniyle bu detayı şu anda paylaşamıyorum.',
    telemetry: {
      ...telemetry,
      reason: lookupToolPlanExists ? 'blocked_tool_plan_path' : 'blocked_sanitize_failed'
    }
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
