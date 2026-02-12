/**
 * Step 7: Email Guardrails
 *
 * Applies safety guardrails to the generated draft:
 *
 * A) RECIPIENT GUARD (hard rule)
 *    - Draft can only reply to thread From/Reply-To
 *    - No CC/BCC additions by LLM
 *
 * B) ACTION-CLAIM GUARD
 *    - LLM cannot claim completed actions without tool success
 *    - "Gönderdim", "kaydettim", "işleme aldım" patterns blocked
 *
 * C) VERIFICATION POLICY
 *    - If verification required, draft must ask for minimum info
 *    - Cannot reveal sensitive data without verification
 *
 * D) PII SCRUB
 *    - Remove unnecessary repetition of sensitive data
 */
import { findActionClaims, replaceActionClaims } from '../../../security/actionClaimLexicon.js';
import { ToolOutcome, normalizeOutcome } from '../../../tools/toolResult.js';

/**
 * Apply all email guardrails
 *
 * @param {Object} ctx - Pipeline context
 * @returns {Promise<Object>} { success, blocked, blockReason, blockedBy }
 */
export async function applyEmailGuardrails(ctx) {
  const { draftContent, toolResults, customerEmail, language } = ctx;

  ctx.guardrailsApplied = [];

  let modifiedContent = draftContent;
  let blocked = false;
  let blockReason = null;
  let blockedBy = null;

  // ============================================
  // A) RECIPIENT GUARD
  // ============================================
  const recipientResult = checkRecipientGuard(modifiedContent, customerEmail);
  ctx.guardrailsApplied.push({
    name: 'RECIPIENT_GUARD',
    passed: recipientResult.passed,
    details: recipientResult.details
  });

  if (!recipientResult.passed) {
    blocked = true;
    blockReason = recipientResult.reason;
    blockedBy = 'RECIPIENT_GUARD';
    console.warn('🛡️ [Guardrails] BLOCKED by recipient guard:', blockReason);
    return { blocked, blockReason, blockedBy };
  }

  // ============================================
  // B) ACTION-CLAIM GUARD
  // ============================================
  const hadToolSuccess = toolResults?.some(r => normalizeOutcome(r.outcome) === ToolOutcome.OK);
  const hadToolCalls = toolResults?.length > 0;

  const actionClaimResult = checkActionClaimGuard(modifiedContent, hadToolSuccess, hadToolCalls, language);
  ctx.guardrailsApplied.push({
    name: 'ACTION_CLAIM_GUARD',
    passed: actionClaimResult.passed,
    modified: actionClaimResult.modified,
    claims: actionClaimResult.claims
  });

  if (actionClaimResult.modified) {
    modifiedContent = actionClaimResult.content;
    console.warn('🛡️ [Guardrails] Action claim modified:', actionClaimResult.claims);
  }

  // ============================================
  // C) VERIFICATION POLICY
  // ============================================
  const verificationRequired = toolResults?.some(r => normalizeOutcome(r.outcome) === ToolOutcome.VERIFICATION_REQUIRED);
  // Extract askFor from tool results so the fallback message only asks for the missing field
  const askForField = toolResults?.find(r => normalizeOutcome(r.outcome) === ToolOutcome.VERIFICATION_REQUIRED)?._askFor || null;

  const verificationResult = checkVerificationPolicy(modifiedContent, verificationRequired, language, askForField);
  ctx.guardrailsApplied.push({
    name: 'VERIFICATION_POLICY',
    passed: verificationResult.passed,
    verificationRequired
  });

  if (!verificationResult.passed) {
    // Don't block, but modify content to include verification request
    modifiedContent = verificationResult.content;
    console.warn('🛡️ [Guardrails] Verification policy applied');
  }

  // ============================================
  // D) PII SCRUB
  // ============================================
  const piiResult = scrubUnnecessaryPII(modifiedContent);
  ctx.guardrailsApplied.push({
    name: 'PII_SCRUB',
    passed: true,
    scrubbed: piiResult.scrubbed
  });

  if (piiResult.modified) {
    modifiedContent = piiResult.content;
    console.log('🛡️ [Guardrails] PII scrubbed:', piiResult.scrubbed);
  }

  // ============================================
  // E) EMPTY DRAFT CHECK
  // ============================================
  if (!modifiedContent || modifiedContent.trim().length < 10) {
    blocked = true;
    blockReason = 'Draft content is empty or too short';
    blockedBy = 'EMPTY_DRAFT';
    console.warn('🛡️ [Guardrails] BLOCKED: Empty draft');
    return { blocked, blockReason, blockedBy };
  }

  // Update context with modified content
  ctx.draftContent = modifiedContent;

  return { blocked: false };
}

/**
 * A) Recipient Guard
 * Checks that draft doesn't try to add recipients beyond thread scope
 */
function checkRecipientGuard(content, allowedEmail) {
  // Check for CC/BCC mentions in draft
  const ccPattern = /\b(CC|BCC|Cc|Bcc|cc|bcc):\s*([^\n]+)/gi;
  const matches = content.match(ccPattern);

  if (matches) {
    return {
      passed: false,
      reason: 'Draft contains CC/BCC recipients which is not allowed',
      details: matches
    };
  }

  // Check for "send to" or "forward to" patterns
  const forwardPattern = /(forward|ilet|gönder|send)\s+(this|bunu|to|şuna)/gi;
  if (forwardPattern.test(content)) {
    return {
      passed: false,
      reason: 'Draft suggests forwarding which is not allowed',
      details: 'Forward pattern detected'
    };
  }

  return { passed: true };
}

/**
 * B) Action Claim Guard
 * Prevents LLM from claiming completed actions without tool success
 */
function checkActionClaimGuard(content, hadToolSuccess, hadToolCalls, language) {
  const claims = findActionClaims(content, language);
  let modifiedContent = content;

  // Keep signature stable for callers while centralizing detection.
  void hadToolCalls;

  if (claims.length > 0 && !hadToolSuccess) {
    const replacement = language === 'TR'
      ? 'bu konuda size yardımcı olabilirim'
      : 'I can help you with this';

    modifiedContent = replaceActionClaims(content, replacement, language);
  }

  return {
    passed: claims.length === 0 || hadToolSuccess,
    modified: claims.length > 0 && !hadToolSuccess,
    content: modifiedContent,
    claims
  };
}

/**
 * C) Verification Policy
 * Ensures draft asks for verification when required.
 * Also strips "false promise" patterns — when tool outcome is VERIFICATION_REQUIRED,
 * the LLM must NOT claim it's working on the request or will get back to the customer.
 * Only asking for the missing verification info is acceptable.
 */
function checkVerificationPolicy(content, verificationRequired, language, askFor = null) {
  if (!verificationRequired) {
    return { passed: true, content };
  }

  let modifiedContent = content;

  // STEP 1: Strip false-promise / action-taking patterns.
  // When tool returned VERIFICATION_REQUIRED, LLM should NOT say things like:
  //   "Kontrol ediyorum", "en kısa sürede bilgi vereceğim", "telefon numaranızı aldım"
  // These create false expectations — the system cannot proceed without verification.
  const falsePromisePatterns = language === 'TR' ? [
    /(?:en kısa sürede|hemen|şimdi)\s+(?:bilgi\s+)?(?:vereceğim|döneceğim|dönüş\s+yapacağım|ileteceğim|kontrol\s+edeceğim|bakacağım)[.!]?/gi,
    /(?:siparişinizi|talebinizi|bilgilerinizi)\s+(?:kontrol\s+ediyorum|inceliyorum|takip\s+ediyorum)[.!]?/gi,
    /(?:telefon\s+numaranızı|bilgilerinizi)\s+(?:aldım|kaydettim|not\s+ettim)[.,]?\s*(?:şimdi|hemen)?\s*(?:siparişinizi|bilgilerinizi)?\s*(?:kontrol\s+ediyorum|inceliyorum)?[.!]?/gi,
    /size\s+(?:en\s+kısa\s+sürede\s+)?geri\s+dönüş\s+yapacağım[.!]?/gi,
    /(?:inceleyip|kontrol\s+edip)\s+(?:geri\s+)?(?:dönüş\s+yapacağım|döneceğim|bilgi\s+vereceğim)[.!]?/gi
  ] : [
    /(?:i(?:'m|\s+am)\s+(?:checking|looking\s+into|processing|reviewing))\s+(?:your|the)\s+(?:order|request|information)[.!]?/gi,
    /(?:i\s+will|i'll)\s+(?:get\s+back\s+to\s+you|follow\s+up|check|review)\s+(?:shortly|soon|right\s+away|immediately)?[.!]?/gi,
    /(?:i(?:'ve|\s+have)\s+(?:noted|recorded|received))\s+your\s+(?:phone|information|details)[.!]?/gi
  ];

  let stripped = false;
  for (const pattern of falsePromisePatterns) {
    if (pattern.test(modifiedContent)) {
      modifiedContent = modifiedContent.replace(pattern, '').trim();
      stripped = true;
    }
  }

  // Clean up orphaned whitespace/newlines after stripping
  if (stripped) {
    modifiedContent = modifiedContent
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
    console.log('🛡️ [Guardrails] Stripped false-promise patterns from VERIFICATION_REQUIRED draft');
  }

  // STEP 2: Check if draft already asks for verification info
  const verificationRequestPatterns = language === 'TR' ? [
    /doğrulama/gi,
    /kimlik/gi,
    /son\s*4\s*hane/gi,
    /telefon.*son.*hane/gi,
    /bilgilerinizi paylaş/gi
  ] : [
    /verification/gi,
    /verify/gi,
    /last\s*4\s*digits/gi,
    /phone number/gi,
    /confirm your identity/gi
  ];

  const hasVerificationRequest = verificationRequestPatterns.some(p => p.test(modifiedContent));

  if (hasVerificationRequest) {
    return { passed: !stripped, content: modifiedContent };
  }

  // STEP 3: Build askFor-aware verification request.
  // Only ask for the missing piece — do NOT re-ask for data already provided.
  let verificationMessage;
  if (askFor === 'phone_last4') {
    verificationMessage = language === 'TR'
      ? '\n\nDoğrulama için kayıtlı telefon numaranızın son 4 hanesini paylaşır mısınız?'
      : '\n\nFor verification, could you please provide the last 4 digits of your registered phone number?';
  } else if (askFor === 'name') {
    verificationMessage = language === 'TR'
      ? '\n\nDoğrulama için adınızı ve soyadınızı paylaşır mısınız?'
      : '\n\nFor verification, could you please provide your full name?';
  } else {
    // Generic fallback (should be rare now)
    verificationMessage = language === 'TR'
      ? '\n\nKimliğinizi doğrulamamız için lütfen kayıtlı telefon numaranızın son 4 hanesini paylaşır mısınız?'
      : '\n\nTo verify your identity, could you please provide the last 4 digits of your registered phone number?';
  }

  return {
    passed: false,
    content: modifiedContent + verificationMessage
  };
}

/**
 * D) PII Scrub
 * Remove unnecessary repetition of sensitive data
 */
function scrubUnnecessaryPII(content) {
  const scrubbed = [];
  let modifiedContent = content;

  // Turkish TC (national ID) - never include full number
  const tcPattern = /\b[1-9]\d{10}\b/g;
  if (tcPattern.test(content)) {
    modifiedContent = modifiedContent.replace(tcPattern, '[TC Kimlik No]');
    scrubbed.push('TC_KIMLIK');
  }

  // Credit card numbers
  const ccPattern = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  if (ccPattern.test(content)) {
    modifiedContent = modifiedContent.replace(ccPattern, '[Kart No]');
    scrubbed.push('CREDIT_CARD');
  }

  // Full phone numbers repeated multiple times
  const phonePattern = /(?:\+90|0)?[5][0-9]{9}/g;
  const phoneMatches = content.match(phonePattern);
  if (phoneMatches && phoneMatches.length > 2) {
    // Keep first occurrence, mask others
    let count = 0;
    modifiedContent = modifiedContent.replace(phonePattern, (match) => {
      count++;
      return count > 1 ? '[Telefon]' : match;
    });
    scrubbed.push('REPEATED_PHONE');
  }

  return {
    modified: scrubbed.length > 0,
    content: modifiedContent,
    scrubbed
  };
}

export default { applyEmailGuardrails };
