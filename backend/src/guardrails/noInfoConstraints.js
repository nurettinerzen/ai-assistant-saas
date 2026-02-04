/**
 * NO_INFO Constraints (P1-B)
 *
 * PROBLEM: Bilgi yokken template yanıtlar robotik görünüyor
 * - "Bu konuda bilgim yok. İncehesap ile ilgili başka sorunuz var mı?"
 * - Marka lock-in, multi-tenant kırılıyor
 *
 * SOLUTION: Template-free, constraint-based guidance
 * - LLM'e template vermiyoruz
 * - LLM'e constraint + context veriyoruz
 * - Brand parametrik, her tenant için çalışır
 *
 * YAKLAŞIM:
 * - Hazır cümle YOK
 * - "Şu tarz yanıt ver" constraint'leri VAR
 * - LLM kendi doğal dilini kullanır
 */

/**
 * NO_INFO senaryoları ve constraint'leri
 */
const NO_INFO_CONSTRAINTS = {
  // Bilgi Bankası'nda bilgi bulunamadı
  KB_NOT_FOUND: {
    TR: {
      constraint: `
Kullanıcının sorusu hakkında Bilgi Bankası'nda bilgi bulunamadı.

YAPILMASI GEREKENLER:
- Bunu doğal bir şekilde ifade et (robotik olma)
- Yardımcı olabileceğin başka konular olup olmadığını sor
- Gerekirse müşteri hizmetlerine yönlendir
- İşletme adını kullanma zorunluluğu YOK

YAPILMAMASI GEREKENLER:
- "Bilgi bankamda yok" gibi teknik ifadeler
- Kalıp cümleler
- Özür dileme döngüsü
- Bilgi uydurmaya çalışma`,
      context: ['businessName', 'topic']
    },

    EN: {
      constraint: `
No information found in Knowledge Base for user's question.

DO:
- Express this naturally (don't be robotic)
- Ask if there's something else you can help with
- Direct to customer service if needed
- No need to force business name

DON'T:
- Technical phrases like "not in my knowledge base"
- Template sentences
- Excessive apologizing
- Try to make up information`,
      context: ['businessName', 'topic']
    }
  },

  // Tool bilgi döndürmedi (NOT_FOUND)
  TOOL_NOT_FOUND: {
    TR: {
      constraint: `
Sistemde arama yapıldı ama eşleşen kayıt bulunamadı.

YAPILMASI GEREKENLER:
- Bulunamadığını doğal şekilde ifade et
- Girilen bilginin doğruluğunu kontrol etmesini öner
- Alternatif yollar sun (farklı bilgi ile deneme, müşteri hizmetleri)

YAPILMAMASI GEREKENLER:
- "Kayıt bulunamadı" gibi sistem dili
- Müşteriyi suçlar gibi konuşma
- Aynı bilgiyi tekrar isteme döngüsü`,
      context: ['searchType', 'searchValue']
    },

    EN: {
      constraint: `
System search completed but no matching record found.

DO:
- Express this naturally
- Suggest checking the entered information
- Offer alternatives (try different info, customer service)

DON'T:
- System language like "record not found"
- Sound like blaming customer
- Loop asking for same info`,
      context: ['searchType', 'searchValue']
    }
  },

  // Konu dışı soru (off-topic)
  OFF_TOPIC: {
    TR: {
      constraint: `
Kullanıcının sorusu işletmenin hizmet alanı dışında.

YAPILMASI GEREKENLER:
- Kibarca yardımcı olamayacağını belirt
- İşletme hizmetleri hakkında yardım teklif et
- Doğal ve samimi bir dil kullan

YAPILMAMASI GEREKENLER:
- "Bu konu hizmet alanımız dışında" gibi kurumsal dil
- Uzun açıklamalar
- Ders verir gibi konuşma`,
      context: ['businessName', 'businessType']
    },

    EN: {
      constraint: `
User's question is outside business service area.

DO:
- Politely indicate you can't help with this
- Offer help with business services
- Use natural, friendly language

DON'T:
- Corporate language like "outside our service area"
- Long explanations
- Sound preachy`,
      context: ['businessName', 'businessType']
    }
  },

  // Hassas/yasak konu
  SENSITIVE_TOPIC: {
    TR: {
      constraint: `
Kullanıcının sorusu hassas veya yasak bir konuda.

YAPILMASI GEREKENLER:
- Bu konuda yardımcı olamayacağını belirt
- Başka bir konuda yardım teklif et
- Kısa ve net ol

YAPILMAMASI GEREKENLER:
- Neden yardımcı olamadığını açıklama
- Güvenlik/kural/politika referansları
- Ahlak dersi verme`,
      context: ['businessName']
    },

    EN: {
      constraint: `
User's question is about sensitive or prohibited topic.

DO:
- Indicate you can't help with this
- Offer help with something else
- Be brief and clear

DON'T:
- Explain why you can't help
- Reference security/rules/policies
- Be preachy`,
      context: ['businessName']
    }
  },

  // Doğrulama başarısız (verification failed)
  VERIFICATION_FAILED: {
    TR: {
      constraint: `
Kimlik doğrulama başarısız oldu.

YAPILMASI GEREKENLER:
- Bilgilerin eşleşmediğini nazikçe belirt
- Tekrar denemesini veya doğru bilgi girmesini öner
- Sabırlı ve anlayışlı ol

YAPILMAMASI GEREKENLER:
- "Doğrulama başarısız" gibi teknik dil
- "Yanlış bilgi girdiniz" gibi suçlayıcı dil
- Güvenlik uyarıları`,
      context: ['verificationType', 'attemptsLeft']
    },

    EN: {
      constraint: `
Identity verification failed.

DO:
- Gently indicate information didn't match
- Suggest trying again or entering correct info
- Be patient and understanding

DON'T:
- Technical language like "verification failed"
- Accusatory language like "you entered wrong info"
- Security warnings`,
      context: ['verificationType', 'attemptsLeft']
    }
  }
};

/**
 * Get NO_INFO constraint for a scenario
 *
 * @param {string} scenario - Scenario type (KB_NOT_FOUND, TOOL_NOT_FOUND, etc.)
 * @param {string} language - TR | EN
 * @param {Object} context - Context variables (businessName, topic, etc.)
 * @returns {Object} { constraint: string, contextUsed: array }
 */
export function getNoInfoConstraint(scenario, language = 'TR', context = {}) {
  const scenarioConfig = NO_INFO_CONSTRAINTS[scenario];

  if (!scenarioConfig) {
    // Default fallback
    return {
      constraint: language === 'TR'
        ? 'Bu konuda yardımcı olamıyorum. Doğal bir şekilde ifade et.'
        : 'Cannot help with this. Express naturally.',
      contextUsed: []
    };
  }

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const config = scenarioConfig[lang] || scenarioConfig.TR;

  // Build context string
  let contextInfo = '';
  const usedContext = [];

  if (config.context) {
    for (const key of config.context) {
      if (context[key]) {
        contextInfo += `\n${key}: ${context[key]}`;
        usedContext.push(key);
      }
    }
  }

  const fullConstraint = contextInfo
    ? `${config.constraint}\n\nKONTEKST:${contextInfo}`
    : config.constraint;

  return {
    constraint: fullConstraint,
    contextUsed: usedContext
  };
}

/**
 * Build system prompt addition for NO_INFO scenarios
 * This goes into the base prompt, not as a response template
 *
 * @param {string} businessName - Business name
 * @param {string} language - TR | EN
 * @returns {string} Prompt addition
 */
export function buildNoInfoPromptGuidance(businessName, language = 'TR') {
  if (language === 'TR') {
    return `
## BİLGİ YOKSA DAVRANIŞI

Bilgi Bankası'nda veya sistemde bilgi bulamadığında:
- Bunu doğal ve samimi bir dille ifade et
- Robotik kalıp cümleler KULLANMA
- "Bilgi bankamda yok" gibi teknik ifadeler KULLANMA
- Yardımcı olabileceğin başka konular sor
- Gerekirse müşteri hizmetlerine yönlendir

ÖNEMLİ: Her yanıtın farklı olsun, aynı kalıbı tekrarlama.
`;
  }

  return `
## NO INFORMATION BEHAVIOR

When you can't find information in Knowledge Base or system:
- Express this naturally and friendly
- DO NOT use robotic template sentences
- DO NOT use technical phrases like "not in my database"
- Ask if you can help with something else
- Direct to customer service if needed

IMPORTANT: Each response should be different, don't repeat same pattern.
`;
}

/**
 * Detect if response is using forbidden templates
 *
 * @param {string} response - LLM response
 * @param {string} language - TR | EN
 * @returns {Object} { hasTemplate: boolean, template: string|null }
 */
export function detectForbiddenTemplate(response, language = 'TR') {
  const forbiddenPatterns = {
    TR: [
      /bilgi\s*bankam(ız)?da\s*(bu|bununla|şu)\s*(konuda|ilgili)\s*bilgi\s*(yok|bulunmuyor)/i,
      /bu\s*konuda\s*bilgim\s*yok\s*\.\s*[^.]+\s*ile\s*ilgili\s*başka/i,
      /maalesef\s*bu\s*konuda\s*yardımcı\s*olamıyorum/i,
      /sistemimizde\s*bu\s*bilgiye\s*ulaşamıyorum/i,
      /kayıt\s*bulunamadı/i,
      /doğrulama\s*başarısız/i,
    ],
    EN: [
      /not\s*in\s*my\s*knowledge\s*base/i,
      /i\s*don't\s*have\s*information\s*about\s*this.*\s*anything\s*else/i,
      /unfortunately\s*i\s*cannot\s*help\s*with\s*this/i,
      /cannot\s*access\s*this\s*information\s*in\s*our\s*system/i,
      /record\s*not\s*found/i,
      /verification\s*failed/i,
    ]
  };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const patterns = forbiddenPatterns[lang] || forbiddenPatterns.TR;

  for (const pattern of patterns) {
    if (pattern.test(response)) {
      return {
        hasTemplate: true,
        template: pattern.toString()
      };
    }
  }

  return { hasTemplate: false };
}

/**
 * Validate NO_INFO response quality
 *
 * @param {string} response - LLM response
 * @param {string} language - TR | EN
 * @returns {Object} { quality: 'good'|'template'|'poor', issues: array }
 */
export function validateNoInfoResponse(response, language = 'TR') {
  const issues = [];

  // Check for forbidden templates
  const templateCheck = detectForbiddenTemplate(response, language);
  if (templateCheck.hasTemplate) {
    issues.push({
      type: 'FORBIDDEN_TEMPLATE',
      pattern: templateCheck.template
    });
  }

  // Check for excessive apologizing
  const apologyCount = (response.match(/özür|sorry|maalesef|unfortunately/gi) || []).length;
  if (apologyCount > 1) {
    issues.push({
      type: 'EXCESSIVE_APOLOGY',
      count: apologyCount
    });
  }

  // Check for technical language
  const technicalTerms = language === 'TR'
    ? /sistem|veritabanı|kayıt|sorgu|doğrulama|erişim/gi
    : /system|database|record|query|verification|access/gi;

  const techCount = (response.match(technicalTerms) || []).length;
  if (techCount > 2) {
    issues.push({
      type: 'TECHNICAL_LANGUAGE',
      count: techCount
    });
  }

  if (issues.length === 0) {
    return { quality: 'good', issues: [] };
  }

  const hasTemplate = issues.some(i => i.type === 'FORBIDDEN_TEMPLATE');
  return {
    quality: hasTemplate ? 'template' : 'poor',
    issues
  };
}

export default {
  getNoInfoConstraint,
  buildNoInfoPromptGuidance,
  detectForbiddenTemplate,
  validateNoInfoResponse,
  NO_INFO_CONSTRAINTS
};
