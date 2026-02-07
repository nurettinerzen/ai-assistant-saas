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
import { ToolOutcome } from '../../../tools/toolResult.js';

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
  const hadToolSuccess = toolResults?.some(r => r.outcome === ToolOutcome.OK);
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
  const verificationRequired = toolResults?.some(r => r.outcome === ToolOutcome.VERIFICATION_REQUIRED);

  const verificationResult = checkVerificationPolicy(modifiedContent, verificationRequired, language);
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
 * Ensures draft asks for verification when required
 */
function checkVerificationPolicy(content, verificationRequired, language) {
  if (!verificationRequired) {
    return { passed: true, content };
  }

  // Check if draft already asks for verification info
  const verificationRequestPatterns = language === 'TR' ? [
    /doğrulama/gi,
    /kimlik/gi,
    /sipariş numaras/gi,
    /telefon numaran/gi,
    /bilgilerinizi paylaş/gi
  ] : [
    /verification/gi,
    /verify/gi,
    /order number/gi,
    /phone number/gi,
    /confirm your identity/gi
  ];

  const hasVerificationRequest = verificationRequestPatterns.some(p => p.test(content));

  if (hasVerificationRequest) {
    return { passed: true, content };
  }

  // Add verification request to content
  const verificationMessage = language === 'TR'
    ? '\n\nKimliğinizi doğrulamamız için lütfen kayıtlı telefon numaranızı veya sipariş numaranızı paylaşır mısınız?'
    : '\n\nTo verify your identity, could you please provide your registered phone number or order number?';

  return {
    passed: false,
    content: content + verificationMessage
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
