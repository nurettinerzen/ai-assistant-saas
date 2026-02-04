/**
 * Tool-Only Data Guard (P0-A)
 *
 * PROBLEM: LLM tool çağırmadan hassas veri sızdırabiliyor
 * - Paraphrase: "paketiniz teslim edilmiş görünüyor" (orderStatus leak)
 * - Field name yok ama anlam var
 *
 * SOLUTION: Semantic gating + tool-response binding
 * - Tool yoksa → response'ta tool-only data semantic olarak var mı?
 * - Tool varsa → response tool output ile tutarlı mı?
 *
 * NOT: Template vermiyoruz, sadece constraint veriyoruz
 */

/**
 * Tool-only data kategorileri ve semantic patterns
 * Bu veriler SADECE tool çağrısı ile erişilebilir olmalı
 */
const TOOL_ONLY_DATA_SEMANTICS = {
  // Sipariş durumu - sadece check_order_status/customer_data_lookup ile
  orderStatus: {
    toolNames: ['check_order_status', 'customer_data_lookup'],
    patterns: {
      TR: [
        // Durum belirten ifadeler
        /sipariş(iniz)?\s*(şu an|şuanda)?\s*(hazırlanıyor|kargoya verildi|teslim edildi|yolda|kargoda)/i,
        /paket(iniz)?\s*(teslim|ulaştı|gönderildi|yolda)/i,
        /kargo(nuz)?\s*(yola çıktı|teslim edildi|dağıtımda)/i,
        /teslimat\s*(yapıldı|tamamlandı|gerçekleşti)/i,
        // Tarih/lokasyon belirten
        /tahmini\s*teslimat\s*:\s*\d+/i,
        /(yarın|bugün|(\d+)\s*gün)\s*(içinde)?\s*teslim/i,
        /komşu(nuz)?a\s*(bırakıldı|teslim)/i,
        /kapıda\s*bekliyor/i,
        // Takip numarası
        /takip\s*(no|numarası?)\s*:\s*[A-Z0-9]+/i,
        /kargo\s*(takip|kodu)\s*:\s*[A-Z0-9]+/i,
      ],
      EN: [
        /order\s*(is)?\s*(being prepared|shipped|delivered|in transit)/i,
        /package\s*(was)?\s*(delivered|sent|dispatched)/i,
        /tracking\s*(number|code)\s*:\s*[A-Z0-9]+/i,
        /estimated\s*delivery\s*:\s*\d+/i,
        /left\s*with\s*(neighbor|reception)/i,
      ]
    }
  },

  // Müşteri kişisel bilgileri - sadece customer_data_lookup ile
  customerPII: {
    toolNames: ['customer_data_lookup'],
    patterns: {
      TR: [
        // Ad soyad kombinasyonları (2+ kelime)
        /ad(ınız)?\s*ve\s*soyad(ınız)?\s*:\s*[A-ZÇĞİÖŞÜ][a-zçğıöşü]+\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]+/i,
        // Telefon numarası formatları
        /telefon(unuz)?\s*:\s*(\+90|0)?[0-9\s\-]{10,}/i,
        /cep\s*(no|numarası?)\s*:\s*[0-9\s\-]+/i,
        // Adres bilgisi
        /adres(iniz)?\s*:\s*.{20,}/i,
        /teslimat\s*adresi\s*:\s*.{20,}/i,
        // Hesap/Bakiye
        /bakiye(niz)?\s*:\s*[\d\.,]+\s*(TL|₺|USD|\$)/i,
        /borç(unuz)?\s*:\s*[\d\.,]+\s*(TL|₺)/i,
      ],
      EN: [
        /your\s*name\s*:\s*[A-Z][a-z]+\s+[A-Z][a-z]+/i,
        /phone\s*(number)?\s*:\s*[\+0-9\s\-]+/i,
        /address\s*:\s*.{20,}/i,
        /balance\s*:\s*[\d\.,]+/i,
      ]
    }
  },

  // Ödeme/Fatura bilgileri
  paymentInfo: {
    toolNames: ['check_order_status', 'customer_data_lookup'],
    patterns: {
      TR: [
        /ödeme\s*(tutarı|miktarı)\s*:\s*[\d\.,]+\s*(TL|₺)/i,
        /fatura\s*(tutarı|no)\s*:\s*[\dA-Z]+/i,
        /kart.*son\s*\d+\s*hane/i,
        /taksit\s*sayısı\s*:\s*\d+/i,
      ],
      EN: [
        /payment\s*amount\s*:\s*[\d\.,]+/i,
        /invoice\s*(number|amount)\s*:\s*[\dA-Z]+/i,
        /card.*ending\s*in\s*\d+/i,
      ]
    }
  }
};

/**
 * Response'ta tool-only data semantic olarak var mı kontrol et
 *
 * @param {string} response - LLM response text
 * @param {string} language - TR | EN
 * @returns {Object} { hasSensitiveData: boolean, category: string|null, matchedPattern: string|null }
 */
export function containsSensitiveSemantics(response, language = 'TR') {
  if (!response) return { hasSensitiveData: false };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';

  for (const [category, config] of Object.entries(TOOL_ONLY_DATA_SEMANTICS)) {
    const patterns = config.patterns[lang] || config.patterns.TR;

    for (const pattern of patterns) {
      if (pattern.test(response)) {
        return {
          hasSensitiveData: true,
          category,
          matchedPattern: pattern.toString(),
          requiredTools: config.toolNames
        };
      }
    }
  }

  return { hasSensitiveData: false, category: null };
}

/**
 * Tool çağrısı olmadan hassas veri sızıntısı kontrolü
 *
 * @param {string} response - LLM response
 * @param {Array} toolCalls - Yapılan tool çağrıları [{name, success}]
 * @param {string} language - TR | EN
 * @returns {Object} { safe: boolean, violation?: object }
 */
export function validateToolOnlyData(response, toolCalls = [], language = 'TR') {
  // Tool çağrısı VAR MI?
  const hasToolCalls = toolCalls && toolCalls.length > 0;
  const successfulTools = toolCalls.filter(t => t.success).map(t => t.name);

  // Response'ta hassas veri semantic'i var mı?
  const semanticCheck = containsSensitiveSemantics(response, language);

  if (!semanticCheck.hasSensitiveData) {
    // Hassas veri yok, güvenli
    return { safe: true };
  }

  // Hassas veri var, gerekli tool çağrıldı mı?
  if (!hasToolCalls) {
    // Tool yok ama hassas veri var → VIOLATION
    return {
      safe: false,
      violation: {
        type: 'TOOL_ONLY_DATA_LEAK',
        category: semanticCheck.category,
        matchedPattern: semanticCheck.matchedPattern,
        message: 'Response contains tool-only data without tool call',
        requiredTools: semanticCheck.requiredTools
      }
    };
  }

  // Tool var, doğru tool mu?
  const requiredTools = semanticCheck.requiredTools;
  const hasRequiredTool = requiredTools.some(t => successfulTools.includes(t));

  if (!hasRequiredTool) {
    // Yanlış tool ile hassas veri → VIOLATION
    return {
      safe: false,
      violation: {
        type: 'TOOL_MISMATCH_DATA_LEAK',
        category: semanticCheck.category,
        calledTools: successfulTools,
        requiredTools: requiredTools,
        message: `Response contains ${semanticCheck.category} data but required tool not called`
      }
    };
  }

  // Doğru tool çağrıldı, güvenli
  return { safe: true };
}

/**
 * Tool output ile response tutarlılığı kontrolü
 *
 * @param {string} response - LLM response
 * @param {Object} toolOutput - Tool'dan dönen structured data
 * @param {string} language - TR | EN
 * @returns {Object} { consistent: boolean, discrepancies?: array }
 */
export function validateResponseConsistency(response, toolOutput, language = 'TR') {
  if (!toolOutput || !toolOutput.truth) {
    // Tool output'ta truth yok, kontrol edilemez
    return { consistent: true, skipped: true };
  }

  const truth = toolOutput.truth;
  const discrepancies = [];

  // Sipariş durumu tutarlılığı
  if (truth.order?.status) {
    const statusMap = {
      'PROCESSING': ['hazırlanıyor', 'preparing', 'işleniyor'],
      'SHIPPED': ['kargoya verildi', 'shipped', 'yola çıktı', 'kargoda'],
      'DELIVERED': ['teslim edildi', 'delivered', 'ulaştı'],
      'CANCELLED': ['iptal', 'cancel'],
    };

    const expectedTerms = statusMap[truth.order.status] || [];
    const responseLower = response.toLowerCase();

    // Check if response contains WRONG status
    for (const [status, terms] of Object.entries(statusMap)) {
      if (status !== truth.order.status) {
        const hasWrongStatus = terms.some(t => responseLower.includes(t));
        if (hasWrongStatus) {
          discrepancies.push({
            field: 'orderStatus',
            expected: truth.order.status,
            found: status,
            severity: 'HIGH'
          });
        }
      }
    }
  }

  // Teslimat tarihi tutarlılığı
  if (truth.order?.deliveryDate) {
    // Response'ta farklı tarih var mı kontrol et
    const datePattern = /(\d{1,2})[\/\.\-](\d{1,2})[\/\.\-](\d{2,4})/g;
    const foundDates = response.match(datePattern);

    if (foundDates) {
      // Basit kontrol: truth'taki tarih response'ta var mı?
      const truthDate = truth.order.deliveryDate;
      const hasCorrectDate = foundDates.some(d => truthDate.includes(d) || d.includes(truthDate));

      if (!hasCorrectDate) {
        discrepancies.push({
          field: 'deliveryDate',
          expected: truthDate,
          found: foundDates[0],
          severity: 'MEDIUM'
        });
      }
    }
  }

  return {
    consistent: discrepancies.length === 0,
    discrepancies
  };
}

/**
 * Full validation pipeline
 *
 * @param {Object} params
 * @param {string} params.response - LLM response
 * @param {Array} params.toolCalls - Tool calls made
 * @param {Object} params.toolOutput - Last successful tool output
 * @param {string} params.language - Language code
 * @returns {Object} { safe: boolean, violations: array }
 */
export function validateToolOnlyDataFull(params) {
  const { response, toolCalls = [], toolOutput = null, language = 'TR' } = params;

  const violations = [];

  // 1. Tool-only data semantic check
  const dataCheck = validateToolOnlyData(response, toolCalls, language);
  if (!dataCheck.safe) {
    violations.push(dataCheck.violation);
  }

  // 2. Tool-response consistency check (if tool was called)
  if (toolOutput) {
    const consistencyCheck = validateResponseConsistency(response, toolOutput, language);
    if (!consistencyCheck.consistent) {
      violations.push({
        type: 'RESPONSE_INCONSISTENCY',
        discrepancies: consistencyCheck.discrepancies
      });
    }
  }

  return {
    safe: violations.length === 0,
    violations
  };
}

export default {
  containsSensitiveSemantics,
  validateToolOnlyData,
  validateResponseConsistency,
  validateToolOnlyDataFull
};
