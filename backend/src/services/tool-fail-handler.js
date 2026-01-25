/**
 * Tool Fail Handler - Production Guardrail
 *
 * CRITICAL: When tool fails with SYSTEM_ERROR, NEVER let LLM make up a response.
 * Use forced template to prevent action claims.
 *
 * NOTE: NOT_FOUND, VALIDATION_ERROR, VERIFICATION_REQUIRED are NOT failures.
 * These are valid outcomes that AI should handle naturally.
 * Only SYSTEM_ERROR triggers fail policy.
 */

import { shouldTriggerFailPolicy, ToolOutcome } from '../tools/toolResult.js';

/**
 * Get forced error response when tool fails
 *
 * @param {string} toolName - Name of failed tool
 * @param {string} language - Language code
 * @param {string} channel - CHAT | WHATSAPP | PHONE
 * @returns {Object} { reply: string, forceEnd: boolean, metadata: object }
 */
export function getToolFailResponse(toolName, language = 'TR', channel = 'CHAT') {
  const isPhone = channel === 'PHONE';

  // Different templates based on tool type
  const templates = {
    // High-impact tools (callback, integrations)
    'create_callback': {
      TR: 'Şu an talebinizi sistemimize kaydedemedim. Lütfen birkaç dakika sonra tekrar deneyin veya 0850 XXX XXXX numaralı hattımızdan bize ulaşın.',
      EN: 'I could not record your request in our system right now. Please try again in a few minutes or call us at 0850 XXX XXXX.'
    },

    // Data lookup tools
    'customer_data_lookup': {
      TR: 'Bilgilerinizi sorgularken bir sorun oluştu. Lütfen birkaç dakika sonra tekrar deneyin.',
      EN: 'There was an issue looking up your information. Please try again in a few minutes.'
    },

    // Integration tools (Calendly, OpenTable, etc.)
    'calendly': {
      TR: 'Randevu sistemine bağlanırken bir sorun oluştu. Lütfen daha sonra tekrar deneyin.',
      EN: 'Could not connect to appointment system. Please try again later.'
    },

    // Default for unknown tools
    'default': {
      TR: 'Şu an sisteme erişirken bir sorun yaşıyorum. Lütfen birkaç dakika sonra tekrar deneyin veya müşteri hizmetlerimizle iletişime geçin.',
      EN: 'I\'m having trouble accessing the system right now. Please try again in a few minutes or contact our customer service.'
    }
  };

  const template = templates[toolName] || templates['default'];

  return {
    reply: template[language],
    forceEnd: isPhone, // Only force end conversation on phone (to prevent long wait)
    hadToolFailure: true,
    failedTool: toolName,
    metadata: {
      type: 'TOOL_FAILURE',
      tool: toolName,
      timestamp: new Date().toISOString(),
      channel
    }
  };
}

/**
 * Validate that response doesn't contain action claims after tool failure
 *
 * @param {string} responseText - LLM response text
 * @param {boolean} hadToolSuccess - Whether any tool succeeded
 * @param {string} language - Language code
 * @returns {Object} { valid: boolean, forcedResponse?: string }
 */
export function validateResponseAfterToolFail(responseText, hadToolSuccess, language = 'TR') {
  // If tool succeeded, no validation needed
  if (hadToolSuccess) {
    return { valid: true };
  }

  // Check for action claims (Turkish)
  const actionClaimsTR = [
    'oluşturdum', 'oluşturuyorum', 'oluşturacağım',
    'kaydettim', 'kaydediyorum', 'kaydedeceğim',
    'ilettim', 'iletiyorum', 'ileteceğim',
    'aktardım', 'aktarıyorum', 'aktaracağım',
    'yaptım', 'yapıyorum', 'yapacağım',
    'hallettim', 'halledi rum', 'halledeceğim',
    'gönderdim', 'gönderiyorum', 'göndereceğim'
  ];

  const actionClaimsEN = [
    'created', 'recorded', 'sent', 'forwarded', 'submitted',
    'i have', 'i\'ve done', 'i will'
  ];

  const claims = language === 'TR' ? actionClaimsTR : actionClaimsEN;
  const textLower = responseText.toLowerCase();

  const hasClaim = claims.some(claim => textLower.includes(claim));

  if (hasClaim) {
    console.error('🚨 [ToolFail] LLM made action claim without tool success!');
    console.error('   Response:', responseText.substring(0, 200));

    // HARD BLOCK: Return forced apology
    const forcedResponse = language === 'TR'
      ? 'Özür dilerim, talebinizi şu an işleme alamadım. Lütfen birkaç dakika sonra tekrar deneyin.'
      : 'I apologize, I could not process your request right now. Please try again in a few minutes.';

    return {
      valid: false,
      forcedResponse,
      violationType: 'ACTION_CLAIM_WITHOUT_TOOL_SUCCESS'
    };
  }

  return { valid: true };
}

/**
 * Add retry logic for critical tools with idempotency
 *
 * @param {Function} toolExecutor - Tool execution function
 * @param {string} toolName - Tool name
 * @param {Object} args - Tool arguments
 * @param {number} maxRetries - Max retry attempts (default: 1)
 * @returns {Promise<Object>} Tool result
 */
/**
 * Check if a tool result is a real failure (SYSTEM_ERROR) vs valid outcome
 *
 * Valid outcomes (NOT failures):
 * - NOT_FOUND: Query succeeded, just no matching record
 * - VALIDATION_ERROR: User provided invalid input
 * - VERIFICATION_REQUIRED: Need identity verification
 *
 * Real failure (triggers fail policy):
 * - SYSTEM_ERROR: DB down, API timeout, etc.
 */
export function isRealToolFailure(result) {
  // Use contract if available
  if (result.outcome) {
    return result.outcome === ToolOutcome.SYSTEM_ERROR;
  }

  // Backward compat: notFound is NOT a failure
  if (result.notFound === true) {
    return false;
  }

  // Backward compat: verificationRequired is NOT a failure
  if (result.verificationRequired === true || result.action === 'VERIFICATION_REQUIRED') {
    return false;
  }

  // Backward compat: validationError is NOT a failure
  if (result.validationError === true || result.action === 'VERIFICATION_FAILED') {
    return false;
  }

  // Only success=false without above flags is a real failure
  return result.success === false;
}

export async function executeToolWithRetry(toolExecutor, toolName, args, maxRetries = 1) {
  let lastError = null;

  // Critical tools that need retry (only on SYSTEM_ERROR)
  const criticalTools = ['create_callback', 'customer_data_lookup'];
  const shouldRetry = criticalTools.includes(toolName);

  const attempts = shouldRetry ? maxRetries + 1 : 1;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      console.log(`🔧 [ToolRetry] Attempt ${attempt + 1}/${attempts} for ${toolName}`);

      const result = await toolExecutor(toolName, args);

      // Check if this is a valid outcome (not a failure)
      if (!isRealToolFailure(result)) {
        if (attempt > 0) {
          console.log(`✅ [ToolRetry] Success on attempt ${attempt + 1}`);
        }

        // Log outcome type for debugging
        const outcomeType = result.outcome ||
          (result.notFound ? 'NOT_FOUND' : result.success ? 'OK' : 'UNKNOWN');
        console.log(`📋 [ToolRetry] Outcome: ${outcomeType}`);

        return result;
      }

      lastError = result.error || 'Tool returned SYSTEM_ERROR';

      // Wait before retry (exponential backoff)
      if (attempt < attempts - 1) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 3000); // Max 3s
        console.log(`⏳ [ToolRetry] Waiting ${waitMs}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }

    } catch (error) {
      lastError = error.message;
      console.error(`❌ [ToolRetry] Attempt ${attempt + 1} failed:`, error.message);

      if (attempt < attempts - 1) {
        const waitMs = Math.min(1000 * Math.pow(2, attempt), 3000);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }
  }

  // All attempts failed - this is a SYSTEM_ERROR
  console.error(`❌ [ToolRetry] All ${attempts} attempts failed for ${toolName}`);
  return {
    outcome: ToolOutcome.SYSTEM_ERROR,
    success: false,
    error: lastError || 'Tool execution failed after retries',
    attempts
  };
}

export default {
  getToolFailResponse,
  validateResponseAfterToolFail,
  executeToolWithRetry,
  isRealToolFailure
};
