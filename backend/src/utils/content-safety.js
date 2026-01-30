/**
 * Content Safety Filter
 *
 * P0 SECURITY: Pre-LLM filter to block harmful content before it reaches the AI.
 * Zero tolerance for child safety violations.
 *
 * CRITICAL: This runs BEFORE LLM to prevent:
 * - Prompt injection with harmful content
 * - PII logging of harmful prompts
 * - Tool execution triggered by harmful content
 * - KB contamination
 */

/**
 * Check for child safety violations
 * @param {string} text - User input text to check
 * @returns {boolean} True if violation detected
 */
export function containsChildSafetyViolation(text) {
  if (!text) return false;

  const lowerText = text.toLowerCase();

  // Category 1: CSAM / Child exploitation terms (direct)
  const csamPatterns = [
    /\bcsam\b/i,
    /\bcp\b/i,
    /\bpthc\b/i,
    /\bchild\s+porn/i,
    /\bkid\s+porn/i,
    /\bchild\s+abuse\s+material/i,
    /\bpedophil/i,
    /\bçocuk\s+pornos/i, // Turkish
    /\bçocuk\s+istismar/i // Turkish
  ];

  // Category 2: Age + sexual context combinations
  const ageSexualPatterns = [
    // English
    /\b(child|children|kid|minor|underage|teen|adolescent|young|youth|boy|girl).{0,50}(sex|sexual|nude|naked|explicit|porn|masturbat|touch|molest|rape|abuse)/i,
    /\b(sex|sexual|nude|naked|explicit|porn|masturbat|touch|molest|rape|abuse).{0,50}(child|children|kid|minor|underage|teen|adolescent|young|youth|boy|girl)/i,

    // Turkish (comprehensive patterns)
    /\b(çocuk|çocuğ|küçük|genç|ergen|kız|oğlan).{0,50}(seks|cinsel|çıplak|pornografik|taciz|istismar|tecavüz|içerik|materyal)/i,
    /\b(seks|cinsel|çıplak|pornografik|taciz|istismar|tecavüz|içerik|materyal).{0,50}(çocuk|çocuğ|küçük|genç|ergen|kız|oğlan)/i,

    // Turkish direct combinations (tight matching)
    /çocuk\s+(cinsel|seks|pornografik|istismar)/i,
    /(cinsel|seks|pornografik|istismar)\s+çocuk/i,

    // Age numbers with sexual context
    /\b(1[0-7]|[1-9])\s*(year|yaş).{0,30}(sex|sexual|seks|cinsel|nude|çıplak)/i,
    /\b(under|altında|below)\s*(18|16|14).{0,30}(sex|sexual|seks|cinsel)/i
  ];

  // Category 3: Grooming language
  const groomingPatterns = [
    /\b(groom|lure|seduce|manipulate|trick|tempt).{0,40}(child|children|kid|minor|teen|çocuk|genç)/i,
    /\b(child|children|kid|minor|teen|çocuk|genç).{0,40}(secret|hide|don't tell|gizli|söyleme)/i,
    /\bour\s+little\s+secret/i,
    /\bdon't\s+tell\s+(your\s+)?(mom|dad|parents)/i
  ];

  // Category 4: Age gap with sexual context
  const ageGapPatterns = [
    /\b(adult|man|woman|yetişkin|erkek|kadın).{0,50}(13|14|15|16|17|under\s*18|reşit\s*olmayan).{0,50}(sex|relationship|love|seks|ilişki|aşk)/i,
    /\b(teacher|öğretmen|coach|antrenör|uncle|amca).{0,40}(student|öğrenci|kid|çocuk).{0,40}(sex|touch|kiss|seks|dokun|öp)/i
  ];

  // Category 5: Incest
  const incestPatterns = [
    /\b(father|dad|daddy|mother|mom|mommy|brother|sister|uncle|aunt|cousin|baba|anne|kardeş|amca|teyze|kuzen).{0,50}(sex|sexual|incest|ensest|cinsel|relationship|ilişki)/i,
    /\b(sex|sexual|incest|ensest|cinsel|relationship|ilişki).{0,50}(father|dad|daddy|mother|mom|mommy|brother|sister|uncle|aunt|cousin|baba|anne|kardeş|amca|teyze|kuzen)/i,
    /\bincest/i,
    /\bensest/i
  ];

  // Check all patterns
  const allPatterns = [
    ...csamPatterns,
    ...ageSexualPatterns,
    ...groomingPatterns,
    ...ageGapPatterns,
    ...incestPatterns
  ];

  for (const pattern of allPatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  return false;
}

/**
 * Get safe response for blocked content
 * @param {string} language - User's language (TR/EN)
 * @returns {string} Safe response message
 */
export function getBlockedContentMessage(language = 'TR') {
  if (language === 'TR') {
    return 'Üzgünüm, bu tür içeriklerle ilgili yardımcı olamam. Lütfen uygun bir konu seçin.';
  } else {
    return 'I cannot assist with this type of content. Please choose an appropriate topic.';
  }
}

/**
 * Log content safety violation (without logging the actual content for privacy)
 * @param {Object} params - Violation parameters
 */
export function logContentSafetyViolation(params) {
  const {
    sessionId,
    channel,
    businessId,
    timestamp
  } = params;

  // SECURITY: Do NOT log the actual content (PII + harmful content)
  console.error('🚨 [CONTENT_SAFETY] Violation detected', {
    sessionId,
    channel,
    businessId,
    timestamp,
    violation: 'CHILD_SAFETY',
    llmCalled: false // Critical: LLM was NOT called
  });

  // TODO: Send to monitoring system (Sentry, Datadog, etc.)
  // TODO: Consider flagging session for review (without exposing content)
}

export default {
  containsChildSafetyViolation,
  getBlockedContentMessage,
  logContentSafetyViolation
};
