/**
 * Step 8: Create Provider Draft
 *
 * Creates the draft in the email provider (Gmail/Outlook).
 * This is optional - the draft is always saved to our database regardless.
 *
 * IMPORTANT: This creates a DRAFT, not a sent email.
 * The user must manually review and send.
 */

import gmailService from '../../../services/gmail.js';
import outlookService from '../../../services/outlook.js';

/**
 * Create draft in email provider
 *
 * @param {Object} ctx - Pipeline context
 * @returns {Promise<Object>} { success, error? }
 */
export async function createProviderDraft(ctx) {
  const {
    businessId,
    provider,
    thread,
    inboundMessage,
    draftContent,
    subject,
    customerEmail,
    emailSignature,
    signatureType
  } = ctx;

  try {
    // Build the draft body with signature
    const draftBody = buildDraftBody(draftContent, emailSignature, signatureType);

    // Build reply subject with injection protection
    const replySubject = sanitizeSubject(subject);

    let result;

    if (provider === 'GMAIL') {
      result = await createGmailDraft({
        businessId,
        threadId: thread.threadId, // Provider's thread ID
        to: customerEmail,
        subject: replySubject,
        body: draftBody,
        inReplyTo: inboundMessage.messageId // Provider's message ID
      });
    } else if (provider === 'OUTLOOK') {
      result = await createOutlookDraft({
        businessId,
        conversationId: thread.threadId,
        to: customerEmail,
        subject: replySubject,
        body: draftBody,
        replyToId: inboundMessage.messageId
      });
    } else {
      return {
        success: false,
        error: `Unknown provider: ${provider}`
      };
    }

    ctx.providerDraft = result;

    console.log(`📧 [CreateDraft] Provider draft created: ${result.draftId || result.id}`);

    return { success: true };

  } catch (error) {
    console.error('❌ [CreateDraft] Error:', error);

    // Don't fail the pipeline - draft is still saved to database
    ctx.providerDraftError = error.message;

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sanitize email subject to prevent header injection
 *
 * CRITICAL: Email headers MUST NOT contain:
 * - Newlines (\r\n, \n, \r)
 * - Control characters
 * - Multiple header fields
 *
 * Attack example: "Subject\r\nBcc: attacker@evil.com"
 */
function sanitizeSubject(subject) {
  if (!subject) return 'Re: (no subject)';

  // Strip all newlines and control characters
  let sanitized = subject
    .replace(/[\r\n]/g, ' ')  // CRLF to space
    .replace(/[\x00-\x1F\x7F]/g, ''); // Control chars

  // Ensure it starts with Re: for replies
  if (!sanitized.startsWith('Re:')) {
    sanitized = `Re: ${sanitized}`;
  }

  // Max length for email subject (RFC 2822: 78 chars recommended, 998 max)
  const MAX_SUBJECT_LENGTH = 200;
  if (sanitized.length > MAX_SUBJECT_LENGTH) {
    sanitized = sanitized.substring(0, MAX_SUBJECT_LENGTH - 3) + '...';
  }

  // Validate result
  if (/[\r\n]/.test(sanitized)) {
    console.error('🚨 [CreateDraft] SECURITY: Subject contains newlines after sanitization!');
    return 'Re: (invalid subject)';
  }

  return sanitized;
}

/**
 * Build draft body with signature
 */
function buildDraftBody(content, signature, signatureType) {
  if (!signature) {
    return convertToHtml(content);
  }

  const htmlContent = convertToHtml(content);

  if (signatureType === 'HTML') {
    // HTML signature - append as-is
    return `${htmlContent}<br><br>${signature}`;
  } else {
    // Plain signature - convert to HTML
    const htmlSignature = convertToHtml(signature);
    return `${htmlContent}<br><br>${htmlSignature}`;
  }
}

/**
 * Convert plain text to HTML
 */
function convertToHtml(text) {
  if (!text) return '';

  // Escape HTML entities
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');

  return html;
}

/**
 * Create draft in Gmail
 */
async function createGmailDraft({ businessId, threadId, to, subject, body, inReplyTo }) {
  // Gmail doesn't have a separate createDraft API endpoint easily accessible
  // We'll add this method to the gmail service
  // For now, return a placeholder that indicates we need to implement this

  try {
    // Check if gmail service has createDraft method
    if (typeof gmailService.createDraft === 'function') {
      return await gmailService.createDraft(businessId, {
        threadId,
        to,
        subject,
        body,
        inReplyTo
      });
    }

    // Fallback: Gmail draft creation needs to be implemented
    console.warn('⚠️ [CreateDraft] Gmail createDraft not implemented yet');

    return {
      id: `pending-gmail-${Date.now()}`,
      draftId: null,
      provider: 'GMAIL',
      pending: true
    };
  } catch (error) {
    console.error('Gmail draft error:', error);
    throw error;
  }
}

/**
 * Create draft in Outlook
 */
async function createOutlookDraft({ businessId, conversationId, to, subject, body, replyToId }) {
  try {
    // Check if outlook service has createDraft method
    if (typeof outlookService.createDraft === 'function') {
      return await outlookService.createDraft(businessId, {
        conversationId,
        to,
        subject,
        body,
        replyToId
      });
    }

    // Fallback: Outlook draft creation needs to be implemented
    console.warn('⚠️ [CreateDraft] Outlook createDraft not implemented yet');

    return {
      id: `pending-outlook-${Date.now()}`,
      draftId: null,
      provider: 'OUTLOOK',
      pending: true
    };
  } catch (error) {
    console.error('Outlook draft error:', error);
    throw error;
  }
}

export default { createProviderDraft };
