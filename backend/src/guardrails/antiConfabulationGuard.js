/**
 * Anti-Confabulation Guard (P1-A)
 *
 * PROBLEM: LLM tool çağırmadan olay/durum anlatıyor (halüsinasyon)
 * - "Paketiniz komşunuza bırakılmış" (tool yok)
 * - "Siparişiniz yarın teslim edilecek" (tool yok)
 * - "Mağazamızda bu ürün mevcut" (KB'de yok, tool yok)
 *
 * SOLUTION: Pattern + semantic uncertainty check
 * - Tool yoksa + olay anlatıyorsa → confabulation riski
 * - Template DEĞİL, constraint-based guidance
 *
 * YAKLAŞIM:
 * - Regex tek başına yetmez (paraphrase kaçırır)
 * - "Olay anlatan" semantik pattern'ler
 * - Tool yoksa kesin bilgi verme yasağı
 */

/**
 * Event/fact claim patterns
 * Bu pattern'ler kesin bilgi/olay iddiası içeriyor
 */
const EVENT_CLAIM_PATTERNS = {
  TR: {
    // Teslimat olayları
    deliveryEvents: [
      /paket(iniz)?\s*(teslim edildi|bırakıldı|ulaştı|geldi)/i,
      /(kapı|komşu|apartman|güvenlik)(n?[ae])?\s*(bırakıldı|teslim)/i,
      /kargo(nuz)?\s*(ulaştı|geldi|teslim edildi|dağıtıldı)/i,
      /teslimat\s*(gerçekleşti|yapıldı|tamamlandı)/i,
      /(bugün|yarın|dün)\s*(teslim|ulaştı|geldi)/i,
      /(\d+)\s*(gün|saat)\s*(içinde|sonra)\s*(teslim|ulaşacak)/i,
    ],

    // Sipariş durumu olayları
    orderEvents: [
      /sipariş(iniz)?\s*(hazır|kargoya verildi|onaylandı|iptal edildi)/i,
      /ürün(ünüz)?\s*(gönderildi|yola çıktı|hazırlandı)/i,
      /işlem(iniz)?\s*(tamamlandı|onaylandı|gerçekleşti)/i,
      /ödeme(niz)?\s*(alındı|onaylandı|başarılı)/i,
      // P0: "bulundu" claims without tool - hallucination
      /sipariş(iniz)?\s*(bulundu|buldum|bulduk|görüyorum)/i,
      /kayıt(ınız)?\s*(bulundu|buldum|bulduk|görüyorum)/i,
      /(kaydınızı|siparişinizi)\s*(buldum|gördüm|görüyorum)/i,
      /sistem(d?e|imizde)\s*(görüyorum|buldum|kayıtlı)/i,
    ],

    // Stok/mağaza durumu
    stockEvents: [
      /stok(ta|umuzda)\s*(var|mevcut|bulunuyor)/i,
      /mağaza(mız)?da\s*(mevcut|bulunuyor|var)/i,
      /ürün\s*(elimizde|rafta|satışta)/i,
      /(son|kalan)\s*(\d+)\s*(adet|tane)/i,
    ],

    // Müşteri hizmetleri olayları
    serviceEvents: [
      /taleb(iniz)?\s*(oluşturuldu|kaydedildi|alındı)/i,
      /şikayet(iniz)?\s*(kaydedildi|iletildi)/i,
      /geri\s*dönüş\s*(yapılacak|sağlanacak)/i,
      /ekibimiz\s*(sizinle|size)\s*(iletişime|ulaşacak)/i,
      /(\d+)\s*(saat|gün)\s*içinde\s*(dönüş|aranacak)/i,
    ],

    // Kesin tarih/zaman iddiaları
    timeAssertions: [
      /(pazartesi|salı|çarşamba|perşembe|cuma|cumartesi|pazar)\s*(günü|gününe)/i,
      /saat\s*(\d{1,2})[:\.]?(\d{2})?\s*(civarı|'da|'de|sıralarında)/i,
      /(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{2,4})\s*(tarihinde|'de|'da)/i,
    ]
  },

  EN: {
    deliveryEvents: [
      /package\s*(was)?\s*(delivered|left|arrived)/i,
      /left\s*(at|with)\s*(door|neighbor|reception|security)/i,
      /delivery\s*(completed|successful|made)/i,
      /(today|tomorrow|yesterday)\s*(deliver|arrive)/i,
      /(\d+)\s*(days?|hours?)\s*(delivery|arrival)/i,
    ],

    orderEvents: [
      /order\s*(is)?\s*(ready|shipped|confirmed|cancelled)/i,
      /product\s*(was)?\s*(sent|dispatched|prepared)/i,
      /transaction\s*(completed|confirmed|successful)/i,
      /payment\s*(received|confirmed|successful)/i,
    ],

    stockEvents: [
      /in\s*stock/i,
      /available\s*(in\s*store|now)/i,
      /(\d+)\s*(items?|units?)\s*(left|remaining)/i,
    ],

    serviceEvents: [
      /request\s*(was)?\s*(created|recorded|received)/i,
      /complaint\s*(was)?\s*(logged|forwarded)/i,
      /team\s*will\s*(contact|call|reach)/i,
      /within\s*(\d+)\s*(hours?|days?)/i,
    ],

    timeAssertions: [
      /(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
      /at\s*(\d{1,2})[:\.]?(\d{2})?\s*(am|pm|o'clock)?/i,
      /on\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/i,
    ]
  }
};

/**
 * Hedging/uncertainty phrases that make claims acceptable
 */
const HEDGING_PATTERNS = {
  TR: [
    /muhtemelen|büyük\s*ihtimalle|olabilir|belki/i,
    /tahmin(im)?|sanırım|galiba/i,
    /genellikle|normalde|çoğunlukla/i,
    /emin\s*değilim|bilmiyorum|kontrol\s*etmem\s*gerek/i,
    /bilgi\s*bankam(ız)?da\s*(yok|bulamadım)/i,
  ],
  EN: [
    /probably|likely|might|maybe|perhaps/i,
    /I\s*(think|believe|guess)/i,
    /usually|normally|typically/i,
    /not\s*sure|don't\s*know|need\s*to\s*check/i,
    /not\s*in\s*(my|our)\s*(knowledge|database)/i,
  ]
};

/**
 * Check if response contains event/fact claims
 *
 * @param {string} response - LLM response
 * @param {string} language - TR | EN
 * @returns {Object} { hasClaim: boolean, category: string|null, claim: string|null }
 */
export function detectEventClaim(response, language = 'TR') {
  if (!response) return { hasClaim: false };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const patterns = EVENT_CLAIM_PATTERNS[lang] || EVENT_CLAIM_PATTERNS.TR;

  // First check for hedging - if hedged, claims are OK
  const hedgingPatterns = HEDGING_PATTERNS[lang] || HEDGING_PATTERNS.TR;
  const isHedged = hedgingPatterns.some(p => p.test(response));

  if (isHedged) {
    return { hasClaim: false, hedged: true };
  }

  // Check for event claims
  for (const [category, categoryPatterns] of Object.entries(patterns)) {
    for (const pattern of categoryPatterns) {
      const match = response.match(pattern);
      if (match) {
        return {
          hasClaim: true,
          category,
          claim: match[0],
          pattern: pattern.toString()
        };
      }
    }
  }

  return { hasClaim: false };
}

/**
 * Validate response for confabulation
 *
 * @param {string} response - LLM response
 * @param {Array} toolCalls - Tool calls made
 * @param {boolean} hasKBMatch - Whether KB retrieval found relevant content
 * @param {string} language - TR | EN
 * @returns {Object} { safe: boolean, violation?: object, correctionConstraint?: string }
 */
export function validateConfabulation(response, toolCalls = [], hasKBMatch = false, language = 'TR') {
  const detection = detectEventClaim(response, language);

  // No claim detected → safe
  if (!detection.hasClaim) {
    return { safe: true };
  }

  // Hedged claim → safe (uncertainty expressed)
  if (detection.hedged) {
    return { safe: true, hedged: true };
  }

  // Check if claim is backed by tool or KB
  const hasToolSuccess = toolCalls.some(t => t.success);

  // Delivery/order claims need tool backup
  const needsToolBackup = ['deliveryEvents', 'orderEvents', 'serviceEvents', 'timeAssertions']
    .includes(detection.category);

  // Stock claims can use KB
  const canUseKB = ['stockEvents'].includes(detection.category);

  if (needsToolBackup && !hasToolSuccess) {
    return {
      safe: false,
      violation: {
        type: 'CONFABULATION',
        category: detection.category,
        claim: detection.claim,
        reason: 'Event claim without tool verification'
      },
      correctionConstraint: getConfabulationConstraint(detection.category, language)
    };
  }

  if (canUseKB && !hasKBMatch && !hasToolSuccess) {
    return {
      safe: false,
      violation: {
        type: 'CONFABULATION',
        category: detection.category,
        claim: detection.claim,
        reason: 'Stock/availability claim without KB or tool'
      },
      correctionConstraint: getConfabulationConstraint(detection.category, language)
    };
  }

  return { safe: true };
}

/**
 * Get constraint guidance for confabulation correction
 * NOT A TEMPLATE - guidance on what NOT to claim
 *
 * @param {string} category - Violation category
 * @param {string} language - TR | EN
 * @returns {string} Constraint guidance
 */
export function getConfabulationConstraint(category, language = 'TR') {
  const constraints = {
    TR: {
      deliveryEvents: `
DÜZELTME GEREKLİ - HALÜSİNASYON TESPİT EDİLDİ:
Teslimat durumu hakkında kesin bilgi verdin ama sistemi sorgulamadın.

YASAK (tool çağırmadan):
- "Paketiniz teslim edildi/bırakıldı/ulaştı"
- "Komşunuza/kapıya bırakıldı"
- "Yarın/bugün teslim edilecek"
- Kesin tarih/saat belirtme

BUNUN YERİNE:
- Sipariş numarası iste ve sistemi sorgula
- "Kontrol etmem gerekiyor" de
- Belirsizlik ifade et

Yanıtını kesin iddialar olmadan yeniden yaz.`,

      orderEvents: `
DÜZELTME GEREKLİ - HALÜSİNASYON TESPİT EDİLDİ:
Sipariş durumu hakkında kesin bilgi verdin ama sistemi sorgulamadın.

YASAK (tool çağırmadan):
- "Siparişiniz hazır/kargoda/onaylandı"
- "Ödemeniz alındı/onaylandı"
- "İşleminiz tamamlandı"

BUNUN YERİNE:
- Sipariş numarası iste ve sorgula
- "Durumu kontrol edeyim" de
- Kesin bilgi vermeden yardım öner

Yanıtını kesin iddialar olmadan yeniden yaz.`,

      stockEvents: `
DÜZELTME GEREKLİ - HALÜSİNASYON TESPİT EDİLDİ:
Stok/mevcut bilgisi verdin ama kaynaklarında bu bilgi yok.

YASAK (KB'de yoksa):
- "Stokta var/mevcut"
- "Mağazamızda bulunuyor"
- "X adet kaldı"

BUNUN YERİNE:
- "Stok durumunu kontrol edebilirsiniz" de
- Web sitesine veya mağazaya yönlendir
- "Bilgi bankamda bu ürün hakkında detay yok" de

Yanıtını kesin iddialar olmadan yeniden yaz.`,

      serviceEvents: `
DÜZELTME GEREKLİ - HALÜSİNASYON TESPİT EDİLDİ:
Müşteri hizmetleri aksiyonu iddia ettin ama tool çağırmadın.

YASAK (tool çağırmadan):
- "Talebiniz oluşturuldu/kaydedildi"
- "Ekibimiz sizinle iletişime geçecek"
- "X saat/gün içinde dönüş yapılacak"

BUNUN YERİNE:
- Gerçekten talep oluşturacaksan tool çağır
- "Talep oluşturmamı ister misiniz?" diye sor
- Kesin süre vermeden genel yönlendirme yap

Yanıtını kesin iddialar olmadan yeniden yaz.`,

      timeAssertions: `
DÜZELTME GEREKLİ - HALÜSİNASYON TESPİT EDİLDİ:
Kesin tarih/saat belirttin ama bu bilgiye sahip değilsin.

YASAK (tool/KB'den gelmiyorsa):
- "Pazartesi günü", "Yarın saat 14:00"
- Kesin tarihler (15.03.2024 gibi)
- "X gün/saat içinde" garantileri

BUNUN YERİNE:
- Genel süreç hakkında bilgi ver
- "Kesin süre için sistemi kontrol etmeliyim" de
- Müşteriyi güncel bilgi için yönlendir

Yanıtını kesin tarih/saat olmadan yeniden yaz.`
    },

    EN: {
      deliveryEvents: `
CORRECTION REQUIRED - CONFABULATION DETECTED:
You made delivery claims without querying the system.

DO NOT (without tool call):
- "Your package was delivered/left/arrived"
- "Left with neighbor/at door"
- "Will be delivered tomorrow/today"
- Specific dates/times

INSTEAD:
- Ask for order number and query system
- Say "I need to check"
- Express uncertainty

Rewrite without definitive claims.`,

      orderEvents: `
CORRECTION REQUIRED - CONFABULATION DETECTED:
You made order status claims without querying the system.

DO NOT (without tool call):
- "Your order is ready/shipped/confirmed"
- "Payment received/confirmed"
- "Transaction completed"

INSTEAD:
- Ask for order number and query
- Say "Let me check the status"
- Offer help without certainty

Rewrite without definitive claims.`,

      stockEvents: `
CORRECTION REQUIRED - CONFABULATION DETECTED:
You made stock/availability claims without KB source.

DO NOT (without KB match):
- "In stock/available"
- "Available in store"
- "X items left"

INSTEAD:
- Say "You can check stock on our website"
- Direct to store or website
- Say "I don't have current stock info"

Rewrite without definitive claims.`,

      serviceEvents: `
CORRECTION REQUIRED - CONFABULATION DETECTED:
You claimed customer service actions without tool call.

DO NOT (without tool call):
- "Request created/recorded"
- "Team will contact you"
- "Response within X hours/days"

INSTEAD:
- Call tool if creating request
- Ask "Would you like me to create a request?"
- Provide general guidance without timeframes

Rewrite without definitive claims.`,

      timeAssertions: `
CORRECTION REQUIRED - CONFABULATION DETECTED:
You specified exact date/time without verification.

DO NOT (without tool/KB):
- "Monday", "Tomorrow at 2pm"
- Specific dates
- "Within X days/hours" guarantees

INSTEAD:
- Give general process info
- Say "I need to check for exact timing"
- Direct customer to updated info

Rewrite without specific dates/times.`
    }
  };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  return constraints[lang][category] || constraints[lang].deliveryEvents;
}

/**
 * P1-D: Field-level grounding check
 *
 * Even when a tool was called successfully, the LLM may hallucinate
 * fields that don't exist in the tool output. This function extracts
 * claimed fields from the response and checks them against tool output.
 *
 * @param {string} response - LLM response text
 * @param {Array} toolOutputs - Tool outputs [{name, output, outcome}]
 * @param {string} language - TR | EN
 * @returns {Object} { grounded: boolean, violation?: object }
 */
export function validateFieldGrounding(response, toolOutputs = [], language = 'TR') {
  if (!response || !toolOutputs.length) return { grounded: true };

  // Only check successful data tool outputs
  const dataOutputs = toolOutputs.filter(t =>
    t.success && t.output && (t.outcome === 'OK' || t.outcome === 'VERIFICATION_REQUIRED')
  );

  if (!dataOutputs.length) return { grounded: true };

  const responseLower = response.toLowerCase();

  for (const toolOutput of dataOutputs) {
    const output = toolOutput.output;

    // Check order field grounding
    if (output.order) {
      const violation = checkOrderFieldGrounding(responseLower, output.order, language);
      if (violation) return { grounded: false, violation };
    }

    // Check tracking number fabrication
    const trackingViolation = checkTrackingFabrication(response, output, language);
    if (trackingViolation) return { grounded: false, violation: trackingViolation };

    // Check address fabrication (tool output never contains full address)
    const addressViolation = checkAddressFabrication(response, output, language);
    if (addressViolation) return { grounded: false, violation: addressViolation };

    // Check amount/price fabrication
    const amountViolation = checkAmountFabrication(response, output, language);
    if (amountViolation) return { grounded: false, violation: amountViolation };
  }

  return { grounded: true };
}

/**
 * Check if LLM claims a different order status than what tool returned
 */
function checkOrderFieldGrounding(responseLower, orderData, language) {
  if (!orderData.status) return null;

  const actualStatus = orderData.status.toLowerCase();

  // Status term mapping — each status has terms that CONTRADICT other statuses
  const statusTerms = {
    TR: {
      'hazırlanıyor': ['kargoya verildi', 'kargoda', 'yolda', 'teslim edildi', 'teslim', 'ulaştı', 'iptal'],
      'kargoya verildi': ['hazırlanıyor', 'teslim edildi', 'teslim', 'ulaştı', 'iptal'],
      'kargoda': ['hazırlanıyor', 'teslim edildi', 'teslim', 'ulaştı', 'iptal'],
      'teslim edildi': ['hazırlanıyor', 'kargoya verildi', 'kargoda', 'yolda', 'iptal'],
      'iptal': ['hazırlanıyor', 'kargoya verildi', 'kargoda', 'teslim edildi', 'yolda'],
    },
    EN: {
      'processing': ['shipped', 'delivered', 'in transit', 'cancelled'],
      'shipped': ['processing', 'delivered', 'cancelled'],
      'delivered': ['processing', 'shipped', 'in transit', 'cancelled'],
      'cancelled': ['processing', 'shipped', 'delivered', 'in transit'],
    }
  };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const terms = statusTerms[lang] || statusTerms.TR;

  // Find which status group the actual status belongs to
  for (const [statusKey, contradictingTerms] of Object.entries(terms)) {
    if (actualStatus.includes(statusKey)) {
      // Check if response contains contradicting terms
      for (const term of contradictingTerms) {
        if (responseLower.includes(term)) {
          return {
            type: 'FIELD_GROUNDING_VIOLATION',
            field: 'order.status',
            expected: orderData.status,
            claimed: term,
            reason: `Response claims "${term}" but tool returned status "${orderData.status}"`
          };
        }
      }
      break;
    }
  }

  return null;
}

/**
 * Check if LLM fabricates a tracking number not in tool output
 */
function checkTrackingFabrication(response, output, language) {
  const trackingPatterns = [
    /takip\s*(no|numarası?)\s*[:\s]*([A-Z0-9]{6,})/i,
    /kargo\s*(takip|kodu)\s*[:\s]*([A-Z0-9]{6,})/i,
    /tracking\s*(number|code|no)\s*[:\s]*([A-Z0-9]{6,})/i,
  ];

  for (const pattern of trackingPatterns) {
    const match = response.match(pattern);
    if (match) {
      const claimedTracking = match[2];
      const actualTracking = output.order?.trackingNumber;

      // If tool has no tracking number but LLM claims one → fabrication
      if (!actualTracking) {
        return {
          type: 'FIELD_GROUNDING_VIOLATION',
          field: 'trackingNumber',
          expected: null,
          claimed: claimedTracking,
          reason: 'Response contains tracking number but tool output has none'
        };
      }

      // If tool has a tracking number but LLM claims a different one → fabrication
      if (actualTracking && !actualTracking.toUpperCase().includes(claimedTracking.toUpperCase())) {
        return {
          type: 'FIELD_GROUNDING_VIOLATION',
          field: 'trackingNumber',
          expected: actualTracking,
          claimed: claimedTracking,
          reason: 'Response contains wrong tracking number'
        };
      }
    }
  }

  return null;
}

/**
 * Check if LLM fabricates an address (tool output never has full address for security)
 */
function checkAddressFabrication(response, output, language) {
  // If tool output has no address-like data but response mentions specific addresses
  const addressPatterns = [
    /adres(iniz)?\s*[:\s]+[A-ZÇĞİÖŞÜa-zçğıöşü]{3,}\s+(Mah|Cad|Sok|Bulv)/i,
    /address\s*[:\s]+\d+\s+[A-Z][a-z]+\s+(St|Ave|Rd|Blvd|Dr)/i,
    /teslimat\s*adresi\s*[:\s]+.{25,}/i,
    /delivery\s*address\s*[:\s]+.{25,}/i,
  ];

  // Check if tool output has any address field
  const hasAddress = output.address || output.deliveryAddress ||
    output.order?.deliveryAddress || output.order?.address;

  if (hasAddress) return null; // Tool has address data, can't validate content

  for (const pattern of addressPatterns) {
    if (pattern.test(response)) {
      return {
        type: 'FIELD_GROUNDING_VIOLATION',
        field: 'address',
        expected: null,
        claimed: 'specific address',
        reason: 'Response contains specific address but tool output has no address data'
      };
    }
  }

  return null;
}

/**
 * Check if LLM fabricates monetary amounts not in tool output
 */
function checkAmountFabrication(response, output, language) {
  // Extract amounts from response
  const amountPatterns = [
    /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(TL|₺|USD|\$|EUR|€)/g,
    /(TL|₺|USD|\$|EUR|€)\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)/g,
  ];

  // Collect all amounts from tool output for comparison
  const toolAmounts = new Set();
  if (output.order?.totalAmount) toolAmounts.add(normalizeAmount(String(output.order.totalAmount)));
  if (output.debt?.sgk) toolAmounts.add(normalizeAmount(String(output.debt.sgk)));
  if (output.debt?.tax) toolAmounts.add(normalizeAmount(String(output.debt.tax)));
  if (output.ticket?.cost) toolAmounts.add(normalizeAmount(String(output.ticket.cost)));

  // If no amounts in tool output, any specific amount in response is suspect
  if (toolAmounts.size === 0) return null; // Can't validate if no reference amounts

  for (const pattern of amountPatterns) {
    let match;
    while ((match = pattern.exec(response)) !== null) {
      const amount = normalizeAmount(match[1] || match[2]);
      if (amount && !toolAmounts.has(amount)) {
        return {
          type: 'FIELD_GROUNDING_VIOLATION',
          field: 'amount',
          expected: [...toolAmounts].join(', '),
          claimed: amount,
          reason: 'Response contains monetary amount not found in tool output'
        };
      }
    }
  }

  return null;
}

/**
 * Normalize amount string for comparison (remove dots/commas formatting)
 */
function normalizeAmount(str) {
  if (!str) return null;
  // Remove thousand separators and normalize decimal
  return str.replace(/\./g, '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
}

export default {
  detectEventClaim,
  validateConfabulation,
  validateFieldGrounding,
  getConfabulationConstraint
};
