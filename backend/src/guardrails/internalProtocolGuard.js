/**
 * Internal Protocol Guard (P0-B)
 *
 * PROBLEM: LLM sistem/kural/yetki referansları sızdırıyor
 * - "Bu tarz bilgileri paylaşamam" (internal policy leak)
 * - "Sistem gereği erişimim yok" (architecture leak)
 * - "Güvenlik kurallarımız nedeniyle..." (security policy leak)
 *
 * SOLUTION: Intent-based detection + constraint guidance (NOT templates)
 *
 * YAKLAŞIM:
 * - LLM'e hazır yanıt vermiyoruz (robotik olur)
 * - LLM'e "neyi söylememesi gerektiğini" constraint olarak veriyoruz
 * - Violation tespit edilirse, LLM'e düzeltme talimatı gönderiyoruz
 */

/**
 * Internal protocol intent patterns
 * Bu ifadeler kullanıcıya iç sistemimizi ifşa ediyor
 */
const INTERNAL_INTENT_PATTERNS = {
  TR: {
    // System/architecture disclosure
    systemDisclosure: [
      /güvenlik\s*(kuralı|gereği|nedeniyle|politikası)/i,
      /sistem\s*(gereği|kuralı|sınırı|kısıtlaması)/i,
      /erişim(im)?\s*(yok|kısıtlı|yetkisi)/i,
      /yetki(m)?\s*(yok|dışında|sınırlı)/i,
      /kural(lar)?ım\s*(gereği|nedeniyle)/i,
      /programla(n)?ma(m)?\s*(gereği|nedeniyle)/i,
      /talimat(lar)?ım\s*(gereği|doğrultusunda)/i,
      /yönerge(ler)?im\s*(gereği|nedeniyle)/i,
    ],

    // Capability denial (exposes what we CAN'T do)
    capabilityDenial: [
      /bu\s*bilgi(ye|yi)\s*(erişe|göre)miyorum/i,
      /bu\s*işlemi?\s*yapamıyorum/i,
      /bu\s*konu(da|yu)\s*ele\s*alamıyorum/i,
      /böyle\s*bir\s*yetkim\s*yok/i,
      /bu\s*tür\s*bilgileri\s*paylaşamam/i,
      /bunu\s*yapmam\s*(yasak|engelli)/i,
    ],

    // Policy reference (exposes internal rules)
    policyReference: [
      /şirket\s*politikası\s*gereği/i,
      /iç\s*kural(lar)?ımız/i,
      /gizlilik\s*(ilke|politika|kural)/i,
      /veri\s*koruma\s*(kanun|kural)/i,
      /KVKK\s*gereği/i,
      /mevzuat\s*gereği/i,
    ],

    // AI/Bot disclosure (should never reveal we're AI)
    aiDisclosure: [
      /ben\s*(bir)?\s*(yapay\s*zeka|AI|bot|asistan)/i,
      /yapay\s*zeka\s*olarak/i,
      /programlandığım\s*için/i,
      /algoritma(m)?\s*gereği/i,
    ]
  },

  EN: {
    systemDisclosure: [
      /security\s*(rule|policy|reason)/i,
      /system\s*(rule|limit|restriction)/i,
      /access\s*(denied|restricted|limited)/i,
      /authorization\s*(denied|required)/i,
      /my\s*(rules|instructions|guidelines)/i,
      /programmed\s*to/i,
    ],

    capabilityDenial: [
      /cannot\s*access\s*this\s*information/i,
      /cannot\s*perform\s*this\s*(action|operation)/i,
      /not\s*authorized\s*to/i,
      /don't\s*have\s*(permission|access)/i,
      /unable\s*to\s*share\s*this/i,
    ],

    policyReference: [
      /company\s*policy\s*(requires|states)/i,
      /internal\s*rules/i,
      /privacy\s*(policy|rules)/i,
      /data\s*protection\s*(law|regulation)/i,
      /GDPR\s*(compliance|requirement)/i,
    ],

    aiDisclosure: [
      /I('m|\s*am)\s*(an?\s*)?(AI|artificial\s*intelligence|bot)/i,
      /as\s*an?\s*AI/i,
      /programmed\s*to/i,
      /my\s*algorithm/i,
    ]
  }
};

/**
 * Detect internal protocol disclosure intent
 *
 * @param {string} response - LLM response
 * @param {string} language - TR | EN
 * @returns {Object} { hasIntent: boolean, category: string|null, matchedPattern: string|null }
 */
export function detectInternalProtocolIntent(response, language = 'TR') {
  if (!response) return { hasIntent: false };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  const patterns = INTERNAL_INTENT_PATTERNS[lang] || INTERNAL_INTENT_PATTERNS.TR;

  for (const [category, categoryPatterns] of Object.entries(patterns)) {
    for (const pattern of categoryPatterns) {
      if (pattern.test(response)) {
        return {
          hasIntent: true,
          category,
          matchedPattern: pattern.toString()
        };
      }
    }
  }

  return { hasIntent: false, category: null };
}

/**
 * Get correction constraint for LLM
 * NOT A TEMPLATE - just guidance on what NOT to say
 *
 * @param {string} category - Violation category
 * @param {string} language - TR | EN
 * @returns {string} Constraint guidance for LLM
 */
export function getCorrectionConstraint(category, language = 'TR') {
  const constraints = {
    TR: {
      systemDisclosure: `
DÜZELTME GEREKLİ:
Yanıtında "sistem gereği", "güvenlik kuralı", "erişimim yok" gibi iç yapımızı açığa vuran ifadeler kullandın.

YASAK:
- Sistem/güvenlik/kural referansları
- "Erişimim yok", "yetkisizim" gibi ifadeler
- Teknik kısıtlamalardan bahsetme

BUNUN YERİNE:
- Müşteriye yardımcı olabileceğin konuları öner
- Alternatif çözümler sun
- Doğal ve yardımsever bir dille yanıt ver

Yanıtını bu kurallara göre yeniden yaz.`,

      capabilityDenial: `
DÜZELTME GEREKLİ:
Yanıtında "yapamıyorum", "erişemiyorum" gibi olumsuz ifadeler kullandın.

YASAK:
- "Yapamıyorum", "erişemiyorum", "göremiyorum"
- Kabiliyetlerimizi olumsuz çerçevede sunma

BUNUN YERİNE:
- Yapabileceğin şeylere odaklan
- "Şu konuda yardımcı olabilirim" gibi pozitif dil kullan
- Müşteriyi doğru kanala yönlendir

Yanıtını bu kurallara göre yeniden yaz.`,

      policyReference: `
DÜZELTME GEREKLİ:
Yanıtında şirket politikası, gizlilik kuralları gibi iç referanslar kullandın.

YASAK:
- "Politikamız gereği", "kurallarımız nedeniyle"
- KVKK, GDPR, mevzuat referansları (müşteriye değil bize ait bilgi)

BUNUN YERİNE:
- Doğrudan yardımcı ol veya yönlendir
- İç süreçlerimizi açıklamadan sonuca odaklan

Yanıtını bu kurallara göre yeniden yaz.`,

      aiDisclosure: `
DÜZELTME GEREKLİ:
Yanıtında yapay zeka/bot/asistan olduğunu açıkça belirttin.

YASAK:
- "Ben bir yapay zeka", "AI olarak", "bot olarak"
- Programlama, algoritma referansları

BUNUN YERİNE:
- Sadece işletme asistanı olarak konuş
- Kimliğini sorgulatma, yardımcı ol

Yanıtını bu kurallara göre yeniden yaz.`
    },

    EN: {
      systemDisclosure: `
CORRECTION REQUIRED:
Your response contains internal system references like "system rule", "security policy", "no access".

DO NOT:
- Reference system/security/rules
- Say "no access", "not authorized"
- Mention technical limitations

INSTEAD:
- Offer topics you can help with
- Provide alternative solutions
- Use natural, helpful language

Rewrite your response following these guidelines.`,

      capabilityDenial: `
CORRECTION REQUIRED:
Your response contains negative capability statements like "cannot", "unable to access".

DO NOT:
- Say "cannot", "unable to", "don't have access"
- Frame capabilities negatively

INSTEAD:
- Focus on what you CAN do
- Use positive framing: "I can help with..."
- Direct customer to appropriate channel

Rewrite your response following these guidelines.`,

      policyReference: `
CORRECTION REQUIRED:
Your response references internal policies, privacy rules, or regulations.

DO NOT:
- Reference "company policy", "internal rules"
- Mention GDPR, regulations (internal knowledge)

INSTEAD:
- Help directly or redirect
- Focus on outcome, not internal process

Rewrite your response following these guidelines.`,

      aiDisclosure: `
CORRECTION REQUIRED:
Your response explicitly states you are an AI/bot/assistant.

DO NOT:
- Say "I am an AI", "as a bot", "as an assistant"
- Reference programming, algorithms

INSTEAD:
- Simply act as business assistant
- Don't question identity, just help

Rewrite your response following these guidelines.`
    }
  };

  const lang = language.toUpperCase() === 'EN' ? 'EN' : 'TR';
  return constraints[lang][category] || constraints[lang].systemDisclosure;
}

/**
 * Validate response for internal protocol leaks
 *
 * @param {string} response - LLM response
 * @param {string} language - TR | EN
 * @returns {Object} { safe: boolean, violation?: object, correctionConstraint?: string }
 */
export function validateInternalProtocol(response, language = 'TR') {
  const detection = detectInternalProtocolIntent(response, language);

  if (!detection.hasIntent) {
    return { safe: true };
  }

  return {
    safe: false,
    violation: {
      type: 'INTERNAL_PROTOCOL_LEAK',
      category: detection.category,
      matchedPattern: detection.matchedPattern
    },
    correctionConstraint: getCorrectionConstraint(detection.category, language)
  };
}

export default {
  detectInternalProtocolIntent,
  getCorrectionConstraint,
  validateInternalProtocol
};
