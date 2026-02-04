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
 * 5. ENCODED_INJECTION: Base64/URL encoded injection attempts
 */

import { getLockMessage } from './session-lock.js';

/**
 * Decode potential Base64/URL encoded content
 * Returns decoded text if encoding detected, otherwise null
 */
function tryDecodeContent(text) {
  if (!text || typeof text !== 'string') return null;

  const decoded = [];

  // 1. URL Encoding Detection (%XX patterns)
  // Look for %20, %3D, %3C, etc.
  const urlEncodedPattern = /%[0-9A-Fa-f]{2}/g;
  const urlEncodedMatches = text.match(urlEncodedPattern) || [];

  if (urlEncodedMatches.length >= 3) {
    try {
      const urlDecoded = decodeURIComponent(text);
      if (urlDecoded !== text) {
        decoded.push({ type: 'URL', content: urlDecoded });
      }
    } catch (e) {
      // Ignore decode errors
    }
  }

  // 2. Base64 Detection
  // Look for Base64 strings (at least 20 chars, valid charset, properly padded)
  const base64Pattern = /[A-Za-z0-9+/]{20,}={0,2}/g;
  const base64Matches = text.match(base64Pattern) || [];

  for (const match of base64Matches) {
    try {
      const base64Decoded = Buffer.from(match, 'base64').toString('utf-8');
      // Verify it's actually readable text (not random bytes)
      if (/^[\x20-\x7E\u00A0-\u024F\s]+$/.test(base64Decoded) && base64Decoded.length > 5) {
        decoded.push({ type: 'BASE64', content: base64Decoded });
      }
    } catch (e) {
      // Ignore decode errors
    }
  }

  // 3. Hex Encoding Detection (\xHH patterns)
  const hexPattern = /\\x[0-9A-Fa-f]{2}/g;
  const hexMatches = text.match(hexPattern) || [];

  if (hexMatches.length >= 3) {
    try {
      const hexDecoded = text.replace(/\\x([0-9A-Fa-f]{2})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
      if (hexDecoded !== text) {
        decoded.push({ type: 'HEX', content: hexDecoded });
      }
    } catch (e) {
      // Ignore decode errors
    }
  }

  return decoded.length > 0 ? decoded : null;
}

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

  // === 0. ENCODED CONTENT DETECTION ===
  // Decode Base64/URL/Hex and check for hidden injection attempts
  const decodedContent = tryDecodeContent(message);

  if (decodedContent && decodedContent.length > 0) {
    console.warn('🔍 [Risk Detector] Encoded content detected:', decodedContent.map(d => d.type));

    // Check decoded content for injection patterns
    for (const decoded of decodedContent) {
      const injectionPatterns = [
        /ignore\s*(previous|all|your)\s*(instructions|prompt)/i,
        /system\s*prompt/i,
        /reveal\s*(your|the)\s*(instructions|prompt|rules)/i,
        /you\s*are\s*now/i,
        /forget\s*(all|your)\s*(rules|instructions)/i,
        /(admin|root|system)\s*override/i,
        /jailbreak/i,
        /DAN\s*mode/i,
        /bypass\s*(security|filter|rules)/i,
        // Turkish injection patterns
        /önceki\s*(komutları|talimatları)\s*unut/i,
        /sistem\s*(promptu|talimatları)/i,
        /kuralları\s*(göster|sıfırla)/i
      ];

      for (const pattern of injectionPatterns) {
        if (pattern.test(decoded.content)) {
          console.warn(`🚨 [Risk Detector] Encoded injection detected (${decoded.type}): ${decoded.content.substring(0, 50)}...`);

          // SOFT REFUSAL: Don't lock, just warn and neutralize
          warnings.push({
            type: 'ENCODED_INJECTION',
            severity: 'HIGH',
            encoding: decoded.type,
            action: 'WARN',
            userMessage: language === 'TR'
              ? '⚠️ Bu mesaj işlenemedi. Lütfen düz metin kullanın.'
              : '⚠️ This message could not be processed. Please use plain text.'
          });

          // Don't process further - message should be rejected but session stays open
          return {
            shouldLock: false,
            reason: null,
            softRefusal: true,
            refusalMessage: warnings[0].userMessage,
            warnings
          };
        }
      }
    }
  }

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
