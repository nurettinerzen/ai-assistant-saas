/**
 * Fallback & Hallucination Detection
 * Ensures assistant doesn't fabricate data
 */

const FALLBACK_KEYWORDS = {
  tr: ['bulunamadı', 'mevcut değil', 'kaydı yok', 'kontrol edemedim', 'bilgiye ulaşamadım', 'tespit edemedim'],
  en: ['not found', 'no record', 'unable to find', 'could not locate', 'not available']
};

const HALLUCINATION_INDICATORS = {
  shippingDetails: [/kargo\s+(?:firması|şirketi)/i, /takip\s+(?:no|numarası)/i, /cargo|shipping/i, /tracking\s+number/i],
  dates: [/\d{1,2}[./]\d{1,2}[./]\d{2,4}/, /teslim\s+tarihi/i, /delivery\s+date/i],
  specifics: [/adet/i, /tutar/i, /amount/i, /quantity/i, /price/i, /fiyat/i]
};

export function assertFallback(reply, language = 'tr') {
  const keywords = FALLBACK_KEYWORDS[language] || FALLBACK_KEYWORDS.tr;
  const hasFallback = keywords.some(keyword => reply.toLowerCase().includes(keyword));

  if (!hasFallback) {
    return {
      passed: false,
      reason: 'Expected fallback response (not found/unavailable) but got specific answer'
    };
  }

  return { passed: true };
}

export function assertNoHallucination(reply, category) {
  const indicators = HALLUCINATION_INDICATORS[category] || [];
  const detected = indicators.filter(pattern => pattern.test(reply));

  if (detected.length > 0) {
    return {
      passed: false,
      reason: `Hallucinated ${category}: ${detected.map(p => p.source).join(', ')}`
    };
  }

  return { passed: true };
}

export default {
  assertFallback,
  assertNoHallucination
};
