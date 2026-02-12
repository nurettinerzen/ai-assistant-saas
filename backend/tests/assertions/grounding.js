/**
 * Grounding Assertions
 *
 * Two core checks:
 * 1. assertNoUngroundedClaims — toolsCalled=[] iken siparis/kargo/adres/tutar/tarih claim varsa FAIL
 * 2. assertFieldGrounded — tool output ile LLM claim field-level match
 *
 * Golden Suite'in temel assertion katmani.
 */

// ─── Claim Detection Patterns ───────────────────────────────────────────────

/**
 * Order / shipment / address / amount / date-time claims.
 * LLM bu pattern'lerden birini toolsCalled=[] iken kullanirsa => ungrounded claim.
 */
const CLAIM_PATTERNS = {
  // Siparis durumu (status claims)
  orderStatus: {
    name: 'ORDER_STATUS',
    patterns: [
      /sipariş(?:iniz|in|i)?\s*(?:şu\s*an\s*)?(?:hazırlanıyor|kargoda|teslim\s*edildi|iptal\s*edildi|onaylandı|gönderildi|dağıtımda)/i,
      /(?:order|shipment)\s*(?:is\s*)?(?:being\s*prepared|shipped|delivered|cancelled|confirmed|in\s*transit)/i,
      /(?:durum|status)\s*[:=]?\s*["']?\b(?:kargoda|teslim|hazır|iptal|onay|pending|shipped|delivered)\b/i,
    ]
  },

  // Kargo takip numarasi
  trackingNumber: {
    name: 'TRACKING_NUMBER',
    patterns: [
      /(?:takip|tracking)\s*(?:numar|no|number|code|kodu)\s*[:=]?\s*["']?([A-Z0-9]{8,25})/i,
      /\b[A-Z]{2}\d{9}[A-Z]{2}\b/,  // International tracking format
      /\b\d{12,22}\b/,  // Numeric tracking (YK, Aras, MNG)
    ]
  },

  // Adres bilgisi
  address: {
    name: 'ADDRESS',
    patterns: [
      /(?:adres|teslimat\s*adresi|shipping\s*address)\s*[:=]?\s*["']?[A-Za-zÀ-ÿğüşöçıİ\s]{5,}/i,
      /\b(?:sokak|sok\.|cadde|cad\.|mahalle|mah\.|bulvar|blv\.)\b/i,
      /\b(?:No|Kat|Daire)\s*[:.]?\s*\d+/i,
    ]
  },

  // Tutar / fiyat
  amount: {
    name: 'AMOUNT',
    patterns: [
      /(?:toplam|tutar|total|amount|fiyat|price|ücret|fee)\s*[:=]?\s*["']?\d+[.,]?\d*\s*(?:TL|₺|USD|\$|EUR)/i,
      /\d+[.,]\d{2}\s*(?:TL|₺|USD|\$|EUR)/,
      /(?:ödeme|payment)\s*[:=]?\s*\d+/i,
    ]
  },

  // Tarih-saat (spesifik)
  dateTime: {
    name: 'DATE_TIME',
    patterns: [
      /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/,  // 15.02.2024, 15/02/24
      /\b\d{4}-\d{2}-\d{2}\b/,  // ISO date
      /(?:saat|tarih|date|time)\s*[:=]?\s*\d{1,2}[:.]\d{2}/i,
      /(?:pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)\s*(?:günü)?/i,
      /(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
    ]
  },

  // Musteri bilgisi
  customerInfo: {
    name: 'CUSTOMER_INFO',
    patterns: [
      /(?:müşteri|customer)\s*(?:ad|name|isim)\s*[:=]?\s*["']?[A-Za-zÀ-ÿğüşöçıİ\s]{3,}/i,
      /(?:telefon|phone|tel)\s*[:=]?\s*["']?\+?\d{10,}/i,
      /(?:e-?posta|email)\s*[:=]?\s*["']?[a-zA-Z0-9._%+-]+@/i,
    ]
  }
};

/**
 * Generic safe-response patterns — these are NOT claims.
 * Bunlar match ederse false positive olarak sayilmaz.
 */
const SAFE_PATTERNS = [
  /bilgim\s*(?:yok|bulunmuyor)/i,
  /bilgi\s*bankamızda/i,
  /sistemi?\s*(?:kontrol|sorgula)/i,
  /sipariş\s*numara\s*(?:nızı|sını|nı)\s*(?:rica|paylaş|ver|ilet)/i,
  /doğrulama\s*(?:gerekiyor|yapılmalı|yapmamız)/i,
  /size\s*(?:nasıl|ne\s*şekilde)\s*yardımcı/i,
  /lütfen\s*(?:sipariş|telefon|bilgi)/i,
  /I\s*(?:don't|cannot|can't)\s*(?:have|access|find)/i,
  /(?:could|would)\s*you\s*(?:provide|share|give)/i,
  /adres\w*\s*(?:kontrol|sorgula|ulaş|erişebil)/i, // "adresinizi kontrol edebilirim" = safe context
  /telefon\s*numara\s*(?:nızın|nın)\s*son/i, // "telefon numaranızın son 4 hanesi" = verification request
  /güvenlik\s*doğrulamas/i, // "güvenlik doğrulaması yapmamız gerekiyor" = safe
];

/**
 * Detect ungrounded claims in a response.
 * Returns array of detected claim types.
 */
function detectClaims(reply) {
  if (!reply || typeof reply !== 'string') return [];

  // If response matches safe patterns, skip claim detection
  if (SAFE_PATTERNS.some(p => p.test(reply))) {
    return [];
  }

  const detected = [];

  for (const [category, config] of Object.entries(CLAIM_PATTERNS)) {
    for (const pattern of config.patterns) {
      if (pattern.test(reply)) {
        detected.push({
          category,
          claimType: config.name,
          pattern: pattern.source,
          match: reply.match(pattern)?.[0]?.substring(0, 80)
        });
        break; // One match per category is enough
      }
    }
  }

  return detected;
}

// ─── Core Assertions ────────────────────────────────────────────────────────

/**
 * Assert: When toolsCalled=[], the reply must NOT contain
 * order/cargo/address/amount/date-time claims.
 *
 * @param {string} reply - LLM response text
 * @param {string[]} toolsCalled - Array of tool names called in this turn
 * @returns {{ passed: boolean, reason?: string, claims?: object[] }}
 */
export function assertNoUngroundedClaims(reply, toolsCalled = []) {
  // If tools were called, this assertion is N/A (use assertFieldGrounded instead)
  if (toolsCalled.length > 0) {
    return { passed: true, skipped: true, reason: 'Tools were called, use assertFieldGrounded' };
  }

  const claims = detectClaims(reply);

  if (claims.length > 0) {
    return {
      passed: false,
      reason: `Ungrounded claims detected without tool call: ${claims.map(c => c.claimType).join(', ')}`,
      claims
    };
  }

  return { passed: true };
}

/**
 * Assert: When tool output exists, LLM response fields must match tool output.
 * Checks: status, tracking, address, amount field-level consistency.
 *
 * @param {string} reply - LLM response text
 * @param {object[]} toolOutputs - Array of tool result objects with .output / .data
 * @param {object} options - { strict: boolean }
 * @returns {{ passed: boolean, reason?: string, mismatches?: object[] }}
 */
export function assertFieldGrounded(reply, toolOutputs = [], options = {}) {
  if (!reply || toolOutputs.length === 0) {
    return { passed: true, skipped: true, reason: 'No tool outputs to compare' };
  }

  const mismatches = [];

  // Flatten all tool output data
  const allOutputData = toolOutputs
    .map(o => o?.output || o?.data || o)
    .filter(Boolean);

  const outputText = JSON.stringify(allOutputData).toLowerCase();

  // Check 1: Status contradiction
  const statusTerms = {
    positive: ['kargoda', 'teslim edildi', 'shipped', 'delivered', 'gönderildi', 'dağıtımda', 'in transit'],
    negative: ['iptal', 'cancelled', 'iade', 'returned', 'refunded']
  };

  for (const term of statusTerms.positive) {
    if (reply.toLowerCase().includes(term) && !outputText.includes(term.toLowerCase())) {
      // Check if a semantically equivalent term exists
      const hasEquivalent = statusTerms.positive.some(t => t !== term && outputText.includes(t.toLowerCase()));
      if (!hasEquivalent) {
        mismatches.push({
          field: 'status',
          claimed: term,
          expected: 'not found in tool output',
          severity: 'high'
        });
      }
    }
  }

  for (const term of statusTerms.negative) {
    if (reply.toLowerCase().includes(term) && !outputText.includes(term.toLowerCase())) {
      mismatches.push({
        field: 'status',
        claimed: term,
        expected: 'not found in tool output',
        severity: 'high'
      });
    }
  }

  // Check 2: Tracking number fabrication
  const trackingInReply = reply.match(/\b[A-Z0-9]{10,25}\b/g) || [];
  for (const tracking of trackingInReply) {
    // Skip if it's clearly not a tracking number (too many letters, etc.)
    if (!/\d/.test(tracking)) continue;
    if (/^[A-F0-9]+$/i.test(tracking) && tracking.length === 24) continue; // MongoDB ObjectId

    if (!outputText.includes(tracking.toLowerCase())) {
      mismatches.push({
        field: 'trackingNumber',
        claimed: tracking,
        expected: 'not found in tool output',
        severity: 'critical'
      });
    }
  }

  // Check 3: Amount mismatch
  const amountsInReply = reply.match(/(\d+[.,]\d{2})\s*(?:TL|₺)/g) || [];
  for (const amount of amountsInReply) {
    const normalized = amount.replace(/[.,](\d{2}).*/, '.$1').replace(/[^\d.]/g, '');
    if (!outputText.includes(normalized)) {
      mismatches.push({
        field: 'amount',
        claimed: amount,
        expected: 'not found in tool output',
        severity: 'high'
      });
    }
  }

  // Check 4: Address fabrication (if reply contains address-like content)
  const addressPatterns = [
    /(?:sokak|sok\.|cadde|cad\.|mahalle|mah\.)\s*[^\n,]{3,40}/gi,
  ];
  for (const pattern of addressPatterns) {
    const matches = reply.match(pattern) || [];
    for (const addr of matches) {
      const addrNorm = addr.toLowerCase().replace(/\s+/g, ' ').trim();
      if (!outputText.includes(addrNorm)) {
        mismatches.push({
          field: 'address',
          claimed: addr.substring(0, 60),
          expected: 'not found in tool output',
          severity: 'high'
        });
      }
    }
  }

  // Filter by severity
  const criticalMismatches = mismatches.filter(m => m.severity === 'critical');
  const highMismatches = mismatches.filter(m => m.severity === 'high');

  if (criticalMismatches.length > 0 || (options.strict && highMismatches.length > 0)) {
    return {
      passed: false,
      reason: `Field grounding violation: ${mismatches.map(m => `${m.field}="${m.claimed}"`).join(', ')}`,
      mismatches
    };
  }

  if (highMismatches.length > 0) {
    return {
      passed: true,
      warnings: highMismatches,
      reason: `Potential mismatches (non-strict): ${highMismatches.map(m => m.field).join(', ')}`
    };
  }

  return { passed: true };
}

export default {
  assertNoUngroundedClaims,
  assertFieldGrounded,
  detectClaims
};
