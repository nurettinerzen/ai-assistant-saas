/**
 * Complaint Flow Enforcer
 *
 * PROBLEM: AI says "I'll create a callback" but doesn't call create_callback tool.
 * SOLUTION: Backend-enforced rule - COMPLAINT flow MUST call create_callback.
 *
 * This is the FINAL safety net. Even if:
 * - Action claim validator fails
 * - Flow tool policy is ignored
 * - AI doesn't follow prompt
 *
 * This enforcer ensures create_callback is called for complaints.
 */

/**
 * Check if complaint flow resolved without calling callback tool
 *
 * @param {string} flowName - Flow name (e.g., 'COMPLAINT')
 * @param {boolean} flowResolved - Whether flow just resolved
 * @param {Array} toolsCalled - List of tool names called during this conversation
 * @returns {Object} { valid: boolean, error: string|null, requiredTool: string|null }
 */
export function validateComplaintResolution(flowName, flowResolved, toolsCalled = []) {
  // Only enforce for COMPLAINT flow
  if (flowName !== 'COMPLAINT') {
    return { valid: true, error: null, requiredTool: null };
  }

  // Only check when flow is being resolved
  if (!flowResolved) {
    return { valid: true, error: null, requiredTool: null };
  }

  // Check if create_callback was called
  const hasCallback = toolsCalled.some(tool =>
    tool === 'create_callback' || tool.includes('callback')
  );

  if (!hasCallback) {
    return {
      valid: false,
      error: 'COMPLAINT flow resolved without calling create_callback tool',
      requiredTool: 'create_callback'
    };
  }

  return { valid: true, error: null, requiredTool: null };
}

/**
 * Force callback tool call for complaint
 * Used when AI doesn't call tool on its own
 *
 * @param {Object} state - Current conversation state
 * @param {Object} business - Business object
 * @param {Function} executeTool - Tool executor function
 * @returns {Promise<Object>} Tool result
 */
export async function forceCallbackCreation(state, business, executeTool) {
  console.log('🔧 [Enforcer] Forcing create_callback for COMPLAINT flow');

  // Extract complaint details from collected slots or last messages
  const complaintDetails = state.collectedSlots.complaint_details ||
    state.collectedSlots.complaintDetails ||
    'Customer complaint (details in conversation)';

  const toolArgs = {
    reason: complaintDetails,
    customer_name: state.collectedSlots.customer_name ||
      state.collectedSlots.customerName ||
      state.verification?.collected?.name ||
      'Unknown',
    customer_phone: state.collectedSlots.phone ||
      state.verification?.collected?.phone ||
      'Unknown',
    priority: 'high', // Complaints are high priority
    notes: `Auto-created by complaint enforcer. Original flow: ${state.activeFlow}`
  };

  try {
    const result = await executeTool('create_callback', toolArgs, business, {
      sessionId: state.sessionId,
      channel: 'CHAT',
      intent: 'complaint'
    });

    console.log('✅ [Enforcer] Callback created:', result.success ? 'SUCCESS' : 'FAILED');
    return result;
  } catch (error) {
    console.error('❌ [Enforcer] Failed to force callback creation:', error);
    return {
      success: false,
      error: 'Failed to create callback automatically'
    };
  }
}

export default {
  validateComplaintResolution,
  forceCallbackCreation
};
