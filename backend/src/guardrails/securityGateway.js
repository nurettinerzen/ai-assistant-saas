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
    const phoneMatch = normalizePhone(verifiedIdentity.phone) === normalizePhone(requestedRecord.phone);
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
 * Telefon numarası normalizasyonu
 */
function normalizePhone(phone) {
  if (!phone) return '';
  // Sadece rakamları al, başındaki 0 veya +90'ı kaldır
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) {
    return digits.slice(2); // +90 kaldır
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return digits.slice(1); // Başındaki 0'ı kaldır
  }
  return digits;
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

/**
 * Hassas veri pattern'leri
 * Bu pattern'ler LLM output'unda aranır
 */
const SENSITIVE_PATTERNS = {
  // Takip numarası (tam veya kısmi)
  tracking: [
    /\b[A-Z]{2}\d{9,12}[A-Z]{0,2}\b/i, // Standart tracking format
    /\b\d{10,20}\b/, // Sadece rakam
    /takip\s*(no|numarası?|kodu?)\s*[:=]?\s*\S+/i,
    /tracking\s*(number|code|id)?\s*[:=]?\s*\S+/i,
  ],

  // Adres bilgileri
  address: [
    /mahalle(si)?\s*[:=]?\s*[A-ZÇĞİÖŞÜa-zçğıöşü\s]{3,}/i,
    /sokak|cadde|bulvar/i,
    /\b(apt|apartman|bina|daire|kat)\b/i,
    /ilçe(si)?\s*[:=]?\s*[A-ZÇĞİÖŞÜa-zçğıöşü\s]{3,}/i,
  ],

  // Kargo/Şube bilgileri
  shipping: [
    /yurtiçi|aras|mng|ptt|ups|fedex|dhl|sürat|horoz/i,
    /şube(si|niz|miz)?\s*[:=]?\s*[A-ZÇĞİÖŞÜa-zçğıöşü\s]{3,}/i,
    /dağıtım\s*(merkez|şube)/i,
  ],

  // Teslimat detayları
  delivery: [
    /komşu(nuz)?a?\s*(teslim|bırak)/i,
    /kapıcı|güvenlik|resepsiyon/i,
    /imza(sı|lı)?\s*[:=]?\s*[A-ZÇĞİÖŞÜa-zçğıöşü\s\.]{2,}/i,
    /teslim\s*alan\s*[:=]?\s*\S+/i,
  ],

  // Zaman aralığı
  timeWindow: [
    /saat\s*(\d{1,2})[:\.](\d{2})?\s*(ile|[-–])\s*(\d{1,2})/i,
    /(\d{1,2})[:\.](\d{2})?\s*(civarı|sıralarında|gibi)/i,
    /(bugün|yarın)\s*saat\s*\d/i,
  ],

  // Telefon
  phone: [
    /\b0?5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}\b/,
    /\+90[\s\-]?5\d{2}/,
    /telefon(unuz)?\s*[:=]?\s*[\d\s\-\+]+/i,
  ],

  // Internal/System
  internal: [
    /check_order_status|customer_data_lookup|search_products|create_ticket/i,
    /verification\s*(state|flow|fsm)/i,
    /system\s*prompt/i,
    /güvenlik\s*protokol/i,
  ]
};

/**
 * Leak Filter - LLM output'unda hassas veri kontrolü
 *
 * @param {string} response - LLM response
 * @param {string} verificationState - Mevcut doğrulama durumu
 * @param {string} language - TR | EN
 * @param {Object} collectedData - Zaten toplanmış veriler (orderNumber, phone, name vb.)
 * @returns {Object} { safe, leaks, sanitized, telemetry }
 */
export function applyLeakFilter(response, verificationState = 'none', language = 'TR', collectedData = {}) {
  if (!response) return { safe: true, leaks: [], sanitized: response, telemetry: null };

  const leaks = [];

  // Internal pattern'ler her zaman kontrol edilir
  for (const pattern of SENSITIVE_PATTERNS.internal) {
    if (pattern.test(response)) {
      leaks.push({ type: 'internal', pattern: pattern.toString() });
    }
  }

  // Verified değilse diğer hassas pattern'leri de kontrol et
  if (verificationState !== 'verified') {
    for (const [type, patterns] of Object.entries(SENSITIVE_PATTERNS)) {
      if (type === 'internal') continue; // Zaten kontrol edildi

      for (const pattern of patterns) {
        if (pattern.test(response)) {
          leaks.push({ type, pattern: pattern.toString() });
          break; // Her tip için bir leak yeterli
        }
      }
    }
  }

  if (leaks.length === 0) {
    return { safe: true, leaks: [], sanitized: response, telemetry: null };
  }

  // ============================================
  // SMART VERIFICATION REQUEST
  // ============================================
  // Zaten bilinen verilere göre akıllı mesaj üret
  const hasOrderNumber = !!(collectedData.orderNumber || collectedData.order_number);
  const hasPhone = !!(collectedData.phone || collectedData.last4);
  const hasName = !!(collectedData.name || collectedData.customerName);

  let safeResponse;
  let missingFields = [];

  if (hasOrderNumber && !hasPhone) {
    // Sipariş no var, telefon yok - sadece telefon sor
    safeResponse = language === 'TR'
      ? 'Teşekkürler. Şimdi kimlik doğrulaması için kayıtlı telefon numaranızın son 4 hanesini yazar mısınız?'
      : 'Thank you. For verification, could you please provide the last 4 digits of your registered phone number?';
    missingFields = ['phone_last4'];
  } else if (!hasOrderNumber && hasPhone) {
    // Telefon var, sipariş no yok - sadece sipariş sor
    safeResponse = language === 'TR'
      ? 'Teşekkürler. Sipariş numaranızı paylaşır mısınız?'
      : 'Thank you. Could you please provide your order number?';
    missingFields = ['order_number'];
  } else if (!hasOrderNumber && !hasPhone) {
    // İkisi de yok - ikisini birden sor
    safeResponse = language === 'TR'
      ? 'Bu bilgiyi paylaşabilmem için önce kimliğinizi doğrulamam gerekiyor. Sipariş numaranızı ve kayıtlı telefon numaranızın son 4 hanesini paylaşır mısınız?'
      : 'I need to verify your identity before sharing this information. Could you provide your order number and the last 4 digits of your registered phone number?';
    missingFields = ['order_number', 'phone_last4'];
  } else {
    // İkisi de var ama hala verified değil - sistem sorunu veya mismatch olabilir
    safeResponse = language === 'TR'
      ? 'Doğrulama işlemi tamamlanamadı. Lütfen bilgilerinizi tekrar kontrol edin veya müşteri hizmetlerimizi arayın.'
      : 'Verification could not be completed. Please check your information or contact customer service.';
    missingFields = [];
  }

  // Telemetry objesi (debug için)
  const telemetry = {
    verificationState,
    reason: 'leak_filter_triggered',
    extractedOrderNo: collectedData.orderNumber || collectedData.order_number || null,
    hasPhone,
    hasName,
    missingFields,
    leakTypes: leaks.map(l => l.type)
  };

  return {
    safe: false,
    leaks,
    sanitized: safeResponse,
    originalBlocked: true,
    telemetry
  };
}

// ============================================================================
// TOOL OUTPUT FIELD EXTRACTOR
// ============================================================================

/**
 * Tool output'tan hangi field'ların döndüğünü çıkar
 * Bu, Security Gateway'e requestedDataFields olarak geçilir
 */
export function extractFieldsFromToolOutput(toolOutput) {
  if (!toolOutput) return [];

  const fields = [];
  const data = toolOutput.truth || toolOutput.data || toolOutput;

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
export function extractRecordOwner(toolOutput) {
  if (!toolOutput) return null;

  const data = toolOutput.truth || toolOutput.data || toolOutput;

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
  const productSearchResult = toolOutputs.find(output => {
    const data = output?.truth || output?.data || output;
    return (
      data?.type === 'PRODUCT_NOT_FOUND' ||
      data?.found === false ||
      data?.products?.length === 0 ||
      data?.error === 'PRODUCT_NOT_FOUND'
    );
  });

  if (!productSearchResult) {
    return { needsOverride: false };
  }

  // LLM "bulunamadı" demiş mi kontrol et
  const notFoundPatterns = {
    TR: [
      /bulunamadı/i,
      /bulunmuyor/i,
      /mevcut\s*değil/i,
      /sistemimizde\s*yok/i,
      /kayıtlı\s*değil/i,
      /ürün(ü|ümüz)?\s*yok/i,
    ],
    EN: [
      /not\s*found/i,
      /couldn't\s*find/i,
      /no\s*results?/i,
      /doesn't\s*exist/i,
      /not\s*available/i,
    ]
  };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const patterns = notFoundPatterns[lang] || notFoundPatterns.TR;

  const hasNotFoundStatement = patterns.some(p => p.test(response));

  if (hasNotFoundStatement) {
    return { needsOverride: false }; // LLM zaten doğru söylemiş
  }

  // LLM "bulunamadı" dememiş - override et
  const overrideResponse = language === 'TR'
    ? 'Bu ürünü sistemimizde bulamadım. Ürün adını, model numarasını veya barkodunu paylaşır mısınız? Böylece daha doğru bir arama yapabilirim.'
    : 'I couldn\'t find this product in our system. Could you share the product name, model number, or barcode? This will help me search more accurately.';

  return {
    needsOverride: true,
    overrideResponse,
    reason: 'PRODUCT_NOT_FOUND_NOT_ACKNOWLEDGED'
  };
}

// ============================================================================
// ORDER NOT FOUND HANDLER (HP-01 - Sipariş bulunamadı sonrası baskı)
// ============================================================================

/**
 * Sipariş bulunamadı durumunda ürün listesi uydurma kontrolü
 *
 * @param {string} response - LLM response
 * @param {Array} toolOutputs - Tool çıktıları
 * @param {string} language - TR | EN
 * @returns {Object} { needsOverride, overrideResponse }
 */
export function checkOrderNotFoundPressure(response, toolOutputs = [], language = 'TR') {
  // Tool output'larında order search olup NOT_FOUND dönmüş mü?
  const orderNotFound = toolOutputs.find(output => {
    const data = output?.truth || output?.data || output;
    return (
      data?.type === 'ORDER_NOT_FOUND' ||
      data?.orderFound === false ||
      data?.error === 'ORDER_NOT_FOUND'
    );
  });

  if (!orderNotFound) {
    return { needsOverride: false };
  }

  // Sipariş bulunamadı ama LLM ürün listesi mi uyduruyor?
  const fabricationPatterns = {
    TR: [
      /sipariş(iniz)?de\s*(şu|bu)?\s*(ürünler|ürün)/i,
      /\d+\s*(adet|tane)\s+[A-ZÇĞİÖŞÜa-zçğıöşü]{3,}/i, // "2 adet iPhone"
      /içerisinde\s*.+\s*bulunuyor/i,
      /sipariş\s*içeriği/i,
    ],
    EN: [
      /your\s*order\s*(contains|includes)/i,
      /\d+\s*x\s+[A-Za-z]{3,}/i,
      /order\s*items/i,
    ]
  };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const patterns = fabricationPatterns[lang] || fabricationPatterns.TR;

  const hasFabrication = patterns.some(p => p.test(response));

  if (!hasFabrication) {
    return { needsOverride: false };
  }

  // Ürün listesi uyduruyor - override et
  const overrideResponse = language === 'TR'
    ? 'Bu sipariş numarasıyla eşleşen bir kayıt bulamadım. Sipariş numaranızı kontrol edip tekrar paylaşır mısınız? Alternatif olarak, siparişi verirken kullandığınız telefon numarası veya e-posta adresiyle de arama yapabilirim.'
    : 'I couldn\'t find a record matching this order number. Could you double-check and share it again? Alternatively, I can search using the phone number or email address you used when placing the order.';

  return {
    needsOverride: true,
    overrideResponse,
    reason: 'ORDER_NOT_FOUND_FABRICATION_DETECTED'
  };
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
export function enforceRequiredToolCall(intent, toolsCalled = [], language = 'TR') {
  // Intent'ler ve tool zorunlulukları
  const TOOL_REQUIRED_INTENTS = {
    product_spec: {
      requiredTools: ['get_product_stock', 'search_products'],
      fallbackResponse: {
        TR: 'Ürün özelliklerini kontrol etmem gerekiyor. Hangi ürün hakkında bilgi almak istediğinizi söyleyebilir misiniz?',
        EN: 'I need to check the product specifications. Could you tell me which product you\'d like information about?'
      }
    },
    stock_check: {
      requiredTools: ['get_product_stock', 'search_products'],
      fallbackResponse: {
        TR: 'Stok bilgisini kontrol etmem gerekiyor. Ürün adını veya kodunu paylaşır mısınız?',
        EN: 'I need to check the stock information. Could you share the product name or code?'
      }
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

  // Tool çağrılmamış - deterministik response döndür
  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const overrideResponse = intentConfig.fallbackResponse[lang] || intentConfig.fallbackResponse.TR;

  console.warn(`⚠️ [SecurityGateway] TOOL_REQUIRED intent "${intent}" but no tool called! Enforcing fallback.`);

  return {
    needsOverride: true,
    overrideResponse,
    reason: 'TOOL_REQUIRED_NOT_CALLED',
    intent
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  DATA_CLASSES,
  getDataClass,
  evaluateSecurityGateway,
  applyLeakFilter,
  extractFieldsFromToolOutput,
  extractRecordOwner,
  checkProductNotFound,
  checkOrderNotFoundPressure,
  enforceRequiredToolCall
};
