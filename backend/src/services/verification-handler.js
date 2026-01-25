/**
 * Verification Handler
 *
 * Handles user identity verification flow.
 * Session-based verification that persists across flows.
 *
 * Process:
 * 1. Check if verification is required for current flow
 * 2. If required and not verified, start verification
 * 3. Collect verification fields (name, phone, etc.)
 * 4. Validate against database
 * 5. Mark as verified and set customerId in state
 * 6. Verification persists for entire session
 */

import { getFlow, getVerificationFields } from '../config/flow-definitions.js';
import { processSlotInput, normalize } from '../services/slot-processor.js';
import { verifyInDatabase } from './customer-identity-resolver.js';

/**
 * Check if current flow needs verification and it's not done yet
 */
export function needsVerification(state) {
  if (!state.activeFlow) {
    return false;
  }

  const flow = getFlow(state.activeFlow);
  if (!flow || !flow.requiresVerification) {
    return false;
  }

  // Already verified?
  if (state.verification.status === 'verified') {
    return false;
  }

  return true;
}

/**
 * Check if user is already verified
 */
export function isVerified(state) {
  return state.verification.status === 'verified';
}

/**
 * Start verification process
 * Returns the first field to ask for
 */
export function startVerification(state, language = 'TR') {
  const flow = getFlow(state.activeFlow);
  const verificationFields = getVerificationFields(state.activeFlow);

  if (!verificationFields || verificationFields.length === 0) {
    console.warn('[Verification] No verification fields defined for flow:', state.activeFlow);
    return null;
  }

  // Set verification state
  state.verification.status = 'pending';
  state.verification.pendingField = verificationFields[0];
  state.verification.collected = {};

  console.log('[Verification] Started - First field:', verificationFields[0]);

  // Generate message for first field
  const fieldMessages = {
    name: language === 'TR'
      ? 'Bilgilerinize ulaşabilmem için kimlik doğrulaması gerekiyor. İsminizi ve soyadınızı alabilir miyim?'
      : 'I need to verify your identity to access your information. May I have your full name?',
    phone: language === 'TR'
      ? 'Kimlik doğrulaması için telefon numaranızı alabilir miyim?'
      : 'May I have your phone number for verification?',
    email: language === 'TR'
      ? 'E-posta adresinizi alabilir miyim?'
      : 'May I have your email address?',
  };

  return {
    action: 'ASK_VERIFICATION',
    field: verificationFields[0],
    message: fieldMessages[verificationFields[0]] || (language === 'TR' ? 'Lütfen bilgi verin.' : 'Please provide information.')
  };
}

/**
 * Process verification input
 * Returns action to take (next field, verification complete, or failed)
 */
export async function processVerificationInput(state, userMessage, businessId, language = 'TR') {
  const pendingField = state.verification.pendingField;

  if (!pendingField) {
    console.error('[Verification] No pending field - this should not happen');
    return {
      action: 'ERROR',
      message: language === 'TR' ? 'Bir hata oluştu.' : 'An error occurred.'
    };
  }

  console.log('[Verification] Processing input for field:', pendingField);

  // Process the input as a slot
  const slotResult = processSlotInput(pendingField, userMessage);

  if (!slotResult.filled) {
    // Invalid input - ask again with hint
    console.log('[Verification] Invalid input:', slotResult.error);
    return {
      action: 'RETRY_VERIFICATION',
      field: pendingField,
      message: slotResult.hint
    };
  }

  // Valid input - store it
  const normalizedValue = normalize(pendingField, slotResult.value);
  state.verification.collected[pendingField] = normalizedValue;

  console.log('[Verification] Collected:', pendingField, '=', normalizedValue);

  // Get verification fields for current flow
  const verificationFields = getVerificationFields(state.activeFlow);
  const currentFieldIndex = verificationFields.indexOf(pendingField);
  const nextField = verificationFields[currentFieldIndex + 1];

  // If there's a next field, ask for it
  if (nextField) {
    state.verification.pendingField = nextField;
    console.log('[Verification] Next field:', nextField);

    const fieldMessages = {
      name: language === 'TR' ? 'Teşekkürler. İsminizi ve soyadınızı alabilir miyim?' : 'Thank you. May I have your full name?',
      phone: language === 'TR' ? 'Telefon numaranızı alabilir miyim?' : 'May I have your phone number?',
      email: language === 'TR' ? 'E-posta adresinizi alabilir miyim?' : 'May I have your email address?',
    };

    return {
      action: 'NEXT_VERIFICATION_FIELD',
      field: nextField,
      message: fieldMessages[nextField] || (language === 'TR' ? 'Lütfen bilgi verin.' : 'Please provide information.')
    };
  }

  // All fields collected - verify in database
  console.log('[Verification] All fields collected, verifying in database...');

  const verifyResult = await verifyInDatabase(
    state.verification.collected,
    state.collectedSlots, // Include collected slots (e.g., order_number)
    businessId
  );

  if (verifyResult.success) {
    // Verification successful
    state.verification.status = 'verified';
    state.verification.customerId = verifyResult.customerId;
    state.verification.pendingField = null;

    console.log('[Verification] SUCCESS - Customer ID:', verifyResult.customerId);

    return {
      action: 'VERIFICATION_COMPLETE',
      customerId: verifyResult.customerId,
      message: language === 'TR'
        ? 'Kimlik doğrulaması başarılı. Size nasıl yardımcı olabilirim?'
        : 'Verification successful. How can I help you?'
    };
  } else {
    // Verification failed
    state.verification.attempts += 1;

    console.log('[Verification] FAILED - Attempts:', state.verification.attempts);

    // Block after 3 attempts
    if (state.verification.attempts >= 3) {
      state.verification.status = 'failed';
      state.verification.pendingField = null;

      return {
        action: 'VERIFICATION_BLOCKED',
        message: language === 'TR'
          ? 'Üzgünüm, bilgileriniz eşleşmedi. Lütfen müşteri hizmetleri ile iletişime geçin.'
          : 'Sorry, your information could not be verified. Please contact customer service.'
      };
    }

    // Ask to try again
    const attemptsLeft = 3 - state.verification.attempts;
    const retryMessage = language === 'TR'
      ? `Bilgileriniz eşleşmedi. Lütfen tekrar deneyin. (${attemptsLeft} deneme hakkınız kaldı)\n\n${verifyResult.suggestion || 'İsminizi ve telefon numaranızı kontrol edin.'}`
      : `Your information could not be verified. Please try again. (${attemptsLeft} attempts left)\n\n${verifyResult.suggestion || 'Please check your name and phone number.'}`;

    // Reset collected data for retry
    state.verification.collected = {};
    state.verification.pendingField = verificationFields[0]; // Start from first field

    return {
      action: 'VERIFICATION_FAILED',
      message: retryMessage,
      attemptsLeft: attemptsLeft
    };
  }
}

/**
 * Reset verification (for testing or manual intervention)
 */
export function resetVerification(state) {
  state.verification = {
    status: 'none',
    customerId: null,
    pendingField: null,
    attempts: 0,
    collected: {},
  };
  console.log('[Verification] Reset');
}
