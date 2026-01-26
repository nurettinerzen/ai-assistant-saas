/**
 * User Risk Detector
 *
 * Detects risky user inputs that should trigger session locks.
 * Runs BEFORE LLM to prevent abuse and protect system.
 *
 * Detection categories:
 * 1. ABUSE: Profanity, harassment
 * 2. THREAT: Violent threats
 * 3. PII_INPUT: User sharing sensitive data (warn first, lock on repeat)
 * 4. SPAM: Flooding, repetitive text
 */

/**
 * Abuse/profanity patterns (Turkish focus)
 * Keep threshold conservative - we want to catch severe abuse, not casual language
 */
const ABUSE_PATTERNS = {
  // Severe profanity (Turkish)
  severe_profanity: /\b(amk|orospu|piç|sikik|göt|yarrak|aq|amına|sikerim|siktir)\b/gi,

  // Harassment/insults
  harassment: /\b(aptal|salak|gerizekalı|mal|ahmak|dangalak)\b/gi,

  // Excessive caps (aggressive)
  excessive_caps: /^[A-ZĞÜŞİÖÇ\s!?]{30,}$/,

  // Repeated punctuation (aggressive)
  aggressive_punctuation: /[!?]{5,}/,
};

/**
 * Threat patterns
 */
const THREAT_PATTERNS = {
  // Direct threats
  violence: /\b(öldür|vur|öldüreceğim|vuracağım|döveceğim|patlatacağım|yok edeceğim)\b/gi,

  // Doxxing attempts
  doxxing: /\b(adresini biliyorum|seni bulacağım|nerede oturduğunu biliyorum|evini biliyorum)\b/gi,

  // Legal threats (not violent, but concerning)
  legal_threat: /\b(dava açacağım|mahkemeye vereceğim|avukatıma göstereceğim)\b/gi,
};

/**
 * PII patterns (user sharing their own sensitive data)
 */
const PII_PATTERNS = {
  // Turkish TC Kimlik (11 digits)
  tc_kimlik: /\b[1-9]\d{10}\b/g,

  // Credit card (16 digits)
  credit_card: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,

  // IBAN (Turkish format)
  iban: /\bTR\s?\d{2}\s?(?:\d{4}\s?){5}\d{2}\b/gi,

  // CVV/CVC
  cvv: /\b(?:cvv|cvc|güvenlik kodu|security code)\s*:?\s*(\d{3,4})\b/gi,

  // Password sharing
  password: /\b(?:password|şifre|parola)\s*:?\s*["']?([^\s"']{6,})["']?/gi,
};

/**
 * Spam patterns
 */
const SPAM_PATTERNS = {
  // Same character repeated 15+ times
  char_repeat: /(.)\1{14,}/,

  // Same word repeated 5+ times
  word_repeat: /\b(\w+)\s+\1\s+\1\s+\1\s+\1/gi,
};

/**
 * Detect user input risks
 *
 * @param {string} message - User message
 * @param {string} language - TR | EN
 * @param {Object} state - Current conversation state (for context)
 * @returns {Object} { shouldLock: boolean, reason: string|null, warnings: Array }
 */
export function detectUserRisks(message, language = 'TR', state = {}) {
  if (!message || typeof message !== 'string') {
    return { shouldLock: false, reason: null, warnings: [] };
  }

  const warnings = [];

  // === 1. THREAT DETECTION (highest priority - immediate permanent lock) ===
  const violenceMatches = message.match(THREAT_PATTERNS.violence);
  if (violenceMatches && violenceMatches.length >= 1) {
    return {
      shouldLock: true,
      reason: 'THREAT',
      severity: 'CRITICAL',
      message: getLockMessage('THREAT', language),
      warnings: [{
        type: 'THREAT_VIOLENCE',
        severity: 'CRITICAL',
        action: 'LOCK_PERMANENT'
      }]
    };
  }

  const doxxingMatches = message.match(THREAT_PATTERNS.doxxing);
  if (doxxingMatches && doxxingMatches.length >= 1) {
    return {
      shouldLock: true,
      reason: 'THREAT',
      severity: 'CRITICAL',
      message: getLockMessage('THREAT', language),
      warnings: [{
        type: 'THREAT_DOXXING',
        severity: 'CRITICAL',
        action: 'LOCK_PERMANENT'
      }]
    };
  }

  // === 2. ABUSE DETECTION (counter-based with 10min sliding window) ===
  const profanityMatches = message.match(ABUSE_PATTERNS.severe_profanity);

  if (profanityMatches && profanityMatches.length > 0) {
    const now = new Date();
    const TEN_MINUTES = 10 * 60 * 1000;

    // Initialize or reset abuse tracking in state
    if (!state.abuseCounter) {
      state.abuseCounter = 0;
      state.abuseWindowStart = null;
    }

    // Check if window expired (reset counter)
    if (state.abuseWindowStart) {
      const windowStart = new Date(state.abuseWindowStart);
      if (now - windowStart > TEN_MINUTES) {
        // Window expired - reset
        state.abuseCounter = 0;
        state.abuseWindowStart = null;
      }
    }

    // Increment counter
    state.abuseCounter++;

    // Set window start if first profanity
    if (!state.abuseWindowStart) {
      state.abuseWindowStart = now.toISOString();
    }

    console.log(`[Abuse Tracking] Counter: ${state.abuseCounter}/3 (window: ${state.abuseWindowStart})`);

    // Lock after 3 profanity messages in 10 minutes
    if (state.abuseCounter >= 3) {
      // Reset counter
      state.abuseCounter = 0;
      state.abuseWindowStart = null;

      return {
        shouldLock: true,
        reason: 'ABUSE',
        severity: 'HIGH',
        message: getLockMessage('ABUSE', language),
        warnings: [{
          type: 'REPEATED_PROFANITY',
          severity: 'HIGH',
          count: 3,
          action: 'LOCK_1H'
        }]
      };
    }

    // Warn but don't lock yet
    warnings.push({
      type: 'PROFANITY',
      severity: 'MEDIUM',
      count: profanityMatches.length,
      action: 'WARN',
      warningNumber: state.abuseCounter,
      remaining: 3 - state.abuseCounter
    });
  } else {
    // No profanity in this message
    // Option 1: Reset counter immediately (strict)
    // Option 2: Keep counter (lenient, wait for window expiry)
    // Using Option 2 (lenient) - counter stays until window expires
  }

  // Harassment
  const harassmentMatches = message.match(ABUSE_PATTERNS.harassment);
  if (harassmentMatches && harassmentMatches.length >= 3) {
    warnings.push({
      type: 'HARASSMENT',
      severity: 'MEDIUM',
      count: harassmentMatches.length,
      action: 'WARN'
    });
  }

  // === 3. SPAM DETECTION ===
  if (SPAM_PATTERNS.char_repeat.test(message)) {
    return {
      shouldLock: true,
      reason: 'SPAM',
      severity: 'MEDIUM',
      message: getLockMessage('SPAM', language),
      warnings: [{
        type: 'CHAR_SPAM',
        severity: 'MEDIUM',
        action: 'LOCK_5M'
      }]
    };
  }

  if (SPAM_PATTERNS.word_repeat.test(message)) {
    return {
      shouldLock: true,
      reason: 'SPAM',
      severity: 'MEDIUM',
      message: getLockMessage('SPAM', language),
      warnings: [{
        type: 'WORD_SPAM',
        severity: 'MEDIUM',
        action: 'LOCK_5M'
      }]
    };
  }

  // === 4. PII INPUT DETECTION (warn, don't lock immediately) ===
  const tcMatches = message.match(PII_PATTERNS.tc_kimlik);
  if (tcMatches && tcMatches.length > 0) {
    warnings.push({
      type: 'PII_TC_KIMLIK',
      severity: 'HIGH',
      count: tcMatches.length,
      action: 'WARN',
      userMessage: language === 'TR'
        ? '⚠️ Lütfen TC Kimlik numaranızı burada paylaşmayın.'
        : '⚠️ Please do not share your ID number here.'
    });
  }

  const cardMatches = message.match(PII_PATTERNS.credit_card);
  if (cardMatches && cardMatches.length > 0) {
    warnings.push({
      type: 'PII_CREDIT_CARD',
      severity: 'CRITICAL',
      count: cardMatches.length,
      action: 'WARN',
      userMessage: language === 'TR'
        ? '⚠️ Lütfen kredi kartı bilgilerinizi burada paylaşmayın.'
        : '⚠️ Please do not share your credit card information here.'
    });
  }

  const ibanMatches = message.match(PII_PATTERNS.iban);
  if (ibanMatches && ibanMatches.length > 0) {
    warnings.push({
      type: 'PII_IBAN',
      severity: 'CRITICAL',
      count: ibanMatches.length,
      action: 'WARN',
      userMessage: language === 'TR'
        ? '⚠️ Lütfen IBAN bilginizi burada paylaşmayın.'
        : '⚠️ Please do not share your IBAN here.'
    });
  }

  const passwordMatches = message.match(PII_PATTERNS.password);
  if (passwordMatches && passwordMatches.length > 0) {
    warnings.push({
      type: 'PII_PASSWORD',
      severity: 'CRITICAL',
      count: passwordMatches.length,
      action: 'WARN',
      userMessage: language === 'TR'
        ? '⚠️ Lütfen şifre bilgilerinizi burada paylaşmayın.'
        : '⚠️ Please do not share your password here.'
    });
  }

  // === 5. EXCESSIVE CAPS (aggressive) ===
  if (ABUSE_PATTERNS.excessive_caps.test(message)) {
    warnings.push({
      type: 'EXCESSIVE_CAPS',
      severity: 'LOW',
      action: 'WARN'
    });
  }

  return {
    shouldLock: false,
    reason: null,
    warnings
  };
}

/**
 * Get lock message for a reason
 */
function getLockMessage(reason, language = 'TR') {
  const messages = {
    ABUSE: {
      TR: 'Bu dil nedeniyle sohbet kapatıldı. Lütfen daha sonra tekrar deneyin.',
      EN: 'Conversation closed due to inappropriate language. Please try again later.'
    },
    THREAT: {
      TR: 'Güvenlik nedeniyle sohbet kalıcı olarak kapatılmıştır.',
      EN: 'Conversation permanently closed for security reasons.'
    },
    SPAM: {
      TR: 'Spam tespit edildi. Lütfen 5 dakika sonra tekrar deneyin.',
      EN: 'Spam detected. Please try again in 5 minutes.'
    }
  };

  return messages[reason]?.[language] || messages.ABUSE[language];
}

/**
 * Get PII warning messages to show user
 *
 * @param {Array} warnings - Warning objects from detectUserRisks
 * @returns {Array<string>} Array of user-facing warning messages
 */
export function getPIIWarningMessages(warnings) {
  return warnings
    .filter(w => w.userMessage)
    .map(w => w.userMessage);
}

/**
 * Check if user has been warned about PII before (track in state)
 * If warned 2+ times, escalate to lock
 *
 * @param {Object} state - Conversation state
 * @param {string} piiType - PII_TC_KIMLIK | PII_CREDIT_CARD | PII_IBAN | PII_PASSWORD
 * @returns {boolean} True if should escalate to lock
 */
export function shouldEscalatePIIToLock(state, piiType) {
  if (!state.piiWarnings) {
    state.piiWarnings = {};
  }

  if (!state.piiWarnings[piiType]) {
    state.piiWarnings[piiType] = 0;
  }

  state.piiWarnings[piiType]++;

  // Lock after 2nd warning
  return state.piiWarnings[piiType] >= 2;
}

export default {
  detectUserRisks,
  getPIIWarningMessages,
  shouldEscalatePIIToLock
};
