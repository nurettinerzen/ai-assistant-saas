/**
 * Verification Policy Module
 *
 * Purpose: Define and enforce READ vs WRITE verification rules
 *
 * READ Operations:
 * - Check order status
 * - Check stock
 * - View customer data
 * - Query KB/FAQ
 * → Requires: caller phone match OR order number/email
 * → No OTP needed
 *
 * WRITE Operations:
 * - Create appointment
 * - Cancel appointment
 * - Create callback request
 * - Update customer data
 * → Requires: 2-factor verification (caller phone + name match)
 * → May require OTP for sensitive operations
 */

// Tool verification requirements
const TOOL_VERIFICATION_CONFIG = {
  // READ tools - minimal verification
  'check_order_by_number': {
    type: 'READ',
    requiredVerification: 'order_match', // Order number must match
    fallbackVerification: 'name_partial', // Partial name match as fallback
    description: 'Query order by order number'
  },
  'check_order_by_phone': {
    type: 'READ',
    requiredVerification: 'caller_match', // Caller phone must match order phone
    fallbackVerification: 'name_partial',
    description: 'Query order by phone number'
  },
  'check_order_by_email': {
    type: 'READ',
    requiredVerification: 'email_provided', // Just need email
    fallbackVerification: 'name_partial',
    description: 'Query order by email'
  },
  'get_product_stock': {
    type: 'READ',
    requiredVerification: 'none', // Public info
    description: 'Check product stock'
  },
  'get_tracking_info': {
    type: 'READ',
    requiredVerification: 'order_match', // Need order number
    description: 'Get shipping tracking'
  },
  'customer_data_lookup': {
    type: 'READ',
    requiredVerification: 'caller_match', // Must be customer's phone
    fallbackVerification: 'none', // Allow for inbound calls
    description: 'Query customer data'
  },
  'check_order_status_crm': {
    type: 'READ',
    requiredVerification: 'caller_match',
    description: 'Query CRM order status'
  },
  'check_stock_crm': {
    type: 'READ',
    requiredVerification: 'none',
    description: 'Check CRM stock'
  },
  'check_ticket_status_crm': {
    type: 'READ',
    requiredVerification: 'caller_match',
    description: 'Query CRM ticket status'
  },

  // WRITE tools - require verification
  'create_appointment': {
    type: 'WRITE',
    requiredVerification: 'name_phone_match', // Name + phone must be provided
    requiresConfirmation: true, // Ask user to confirm before creating
    description: 'Create new appointment'
  },
  'create_callback': {
    type: 'WRITE',
    requiredVerification: 'caller_exists', // Just needs to be a valid phone
    requiresConfirmation: false, // No confirmation needed for callback
    description: 'Create callback request'
  },
  'send_order_notification': {
    type: 'WRITE',
    requiredVerification: 'order_match',
    requiresConfirmation: true,
    description: 'Send notification to business'
  }
};

// Verification levels
const VERIFICATION_LEVELS = {
  none: {
    level: 0,
    description: 'No verification required'
  },
  caller_exists: {
    level: 1,
    description: 'Caller phone must be valid'
  },
  caller_match: {
    level: 2,
    description: 'Caller phone must match record'
  },
  order_match: {
    level: 2,
    description: 'Order number must match'
  },
  email_provided: {
    level: 2,
    description: 'Email must be provided'
  },
  name_partial: {
    level: 3,
    description: 'Partial name match required'
  },
  name_phone_match: {
    level: 4,
    description: 'Both name and phone must match'
  },
  otp_verified: {
    level: 5,
    description: 'OTP verification completed'
  }
};

class VerificationPolicy {
  constructor(context = {}) {
    this.callerPhone = context.callerPhone || context.phone || context.from;
    this.channel = context.channel || 'UNKNOWN';
    this.sessionId = context.sessionId;
    this.verificationState = {
      phoneVerified: false,
      nameVerified: false,
      otpVerified: false,
      failedAttempts: 0
    };
  }

  /**
   * Get verification requirements for a tool
   * @param {string} toolName - Name of the tool
   * @returns {Object} - { type, requiredVerification, requiresConfirmation }
   */
  getRequirements(toolName) {
    return TOOL_VERIFICATION_CONFIG[toolName] || {
      type: 'UNKNOWN',
      requiredVerification: 'none',
      description: 'Unknown tool'
    };
  }

  /**
   * Check if operation is allowed based on current verification state
   * @param {string} toolName - Name of the tool
   * @param {Object} params - Tool parameters
   * @param {Object} matchData - Data to verify against (e.g., order data)
   * @returns {Object} - { allowed, reason, requiresAction }
   */
  checkPermission(toolName, params = {}, matchData = null) {
    const requirements = this.getRequirements(toolName);

    // READ operations are more lenient
    if (requirements.type === 'READ') {
      return this.checkReadPermission(requirements, params, matchData);
    }

    // WRITE operations require verification
    if (requirements.type === 'WRITE') {
      return this.checkWritePermission(requirements, params, matchData);
    }

    // Unknown tool type - deny by default
    return {
      allowed: false,
      reason: 'Unknown tool type',
      requiresAction: 'contact_support'
    };
  }

  /**
   * Check READ operation permission
   */
  checkReadPermission(requirements, params, matchData) {
    const verification = requirements.requiredVerification;

    switch (verification) {
      case 'none':
        return { allowed: true, reason: 'Public information' };

      case 'caller_exists':
        if (this.callerPhone) {
          return { allowed: true, reason: 'Caller phone exists' };
        }
        return {
          allowed: false,
          reason: 'No caller phone available',
          requiresAction: 'ask_phone'
        };

      case 'caller_match':
        // For inbound calls, caller phone is automatically trusted
        if (this.channel === 'VOICE' || this.channel === 'WHATSAPP') {
          return { allowed: true, reason: 'Inbound caller trusted' };
        }
        // For chat, need to verify
        if (params.phone && this.normalizePhone(params.phone) === this.normalizePhone(this.callerPhone)) {
          return { allowed: true, reason: 'Phone numbers match' };
        }
        // Allow with fallback verification
        if (requirements.fallbackVerification === 'none') {
          return { allowed: true, reason: 'Fallback allowed for inbound' };
        }
        return {
          allowed: false,
          reason: 'Phone verification required',
          requiresAction: 'verify_phone'
        };

      case 'order_match':
        if (params.order_number) {
          return { allowed: true, reason: 'Order number provided' };
        }
        return {
          allowed: false,
          reason: 'Order number required',
          requiresAction: 'ask_order_number'
        };

      case 'email_provided':
        if (params.email || params.customer_email) {
          return { allowed: true, reason: 'Email provided' };
        }
        return {
          allowed: false,
          reason: 'Email required',
          requiresAction: 'ask_email'
        };

      default:
        return { allowed: true, reason: 'Default allow for READ' };
    }
  }

  /**
   * Check WRITE operation permission
   */
  checkWritePermission(requirements, params, matchData) {
    const verification = requirements.requiredVerification;

    switch (verification) {
      case 'caller_exists':
        if (this.callerPhone || params.phone) {
          return {
            allowed: true,
            reason: 'Phone available',
            requiresConfirmation: requirements.requiresConfirmation
          };
        }
        return {
          allowed: false,
          reason: 'Phone number required for WRITE operation',
          requiresAction: 'ask_phone'
        };

      case 'name_phone_match':
        const hasPhone = this.callerPhone || params.phone;
        const hasName = params.name || params.customer_name;

        if (!hasPhone) {
          return {
            allowed: false,
            reason: 'Phone number required',
            requiresAction: 'ask_phone'
          };
        }
        if (!hasName) {
          return {
            allowed: false,
            reason: 'Name required',
            requiresAction: 'ask_name'
          };
        }

        return {
          allowed: true,
          reason: 'Name and phone provided',
          requiresConfirmation: requirements.requiresConfirmation
        };

      case 'order_match':
        if (!params.order_number) {
          return {
            allowed: false,
            reason: 'Order number required',
            requiresAction: 'ask_order_number'
          };
        }
        return {
          allowed: true,
          reason: 'Order number provided',
          requiresConfirmation: requirements.requiresConfirmation
        };

      case 'otp_verified':
        if (!this.verificationState.otpVerified) {
          return {
            allowed: false,
            reason: 'OTP verification required',
            requiresAction: 'send_otp'
          };
        }
        return {
          allowed: true,
          reason: 'OTP verified',
          requiresConfirmation: requirements.requiresConfirmation
        };

      default:
        return {
          allowed: true,
          reason: 'Default allow for WRITE',
          requiresConfirmation: requirements.requiresConfirmation
        };
    }
  }

  /**
   * Normalize phone number for comparison
   */
  normalizePhone(phone) {
    if (!phone) return '';
    // Remove all non-digits
    let normalized = phone.replace(/\D/g, '');
    // Ensure starts with 0 for Turkish numbers
    if (normalized.startsWith('90')) {
      normalized = '0' + normalized.slice(2);
    } else if (normalized.startsWith('5') && normalized.length === 10) {
      normalized = '0' + normalized;
    }
    return normalized;
  }

  /**
   * Record a failed verification attempt
   * @returns {Object} - { shouldBlock, message }
   */
  recordFailedAttempt() {
    this.verificationState.failedAttempts++;

    if (this.verificationState.failedAttempts >= 3) {
      return {
        shouldBlock: true,
        message: 'Too many failed verification attempts. Ending conversation for security.',
        forceEndCall: true
      };
    }

    return {
      shouldBlock: false,
      attemptsRemaining: 3 - this.verificationState.failedAttempts
    };
  }

  /**
   * Get verification status summary
   */
  getStatus() {
    return {
      phoneVerified: this.verificationState.phoneVerified,
      nameVerified: this.verificationState.nameVerified,
      otpVerified: this.verificationState.otpVerified,
      failedAttempts: this.verificationState.failedAttempts,
      channel: this.channel,
      callerPhone: this.callerPhone ? `***${this.callerPhone.slice(-4)}` : null
    };
  }
}

export default VerificationPolicy;
export { TOOL_VERIFICATION_CONFIG, VERIFICATION_LEVELS };
