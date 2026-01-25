/**
 * Router Decision Logic
 *
 * Decides when to run intent detection vs. continue with current flow.
 *
 * Intent router should run ONLY when:
 * 1. First message (no active flow)
 * 2. Flow resolved (task completed)
 * 3. Topic switch detected (user changing subject)
 *
 * Intent router should NOT run when:
 * - Slot filling in progress
 * - Verification in progress
 * - Flow in_progress
 */

import { detectTopicSwitch } from './topic-switch-detector.js';

/**
 * Decide whether to run intent router
 *
 * @param {Object} state - Current conversation state
 * @param {string} message - User's message
 * @returns {boolean} True if intent router should run
 */
export function shouldRunIntentRouter(state, message) {
  // CASE 1: No active flow → RUN ROUTER
  if (!state.activeFlow) {
    console.log('[RouterDecision] No active flow → Run router');
    return true;
  }

  // CASE 2: Flow resolved → Check if new topic or just acknowledgment
  if (state.flowStatus === 'resolved') {
    const lowerMsg = message.toLowerCase().trim();

    // Short thank-you/acknowledgment messages → DON'T RUN
    if (message.length <= 20) {
      const closingPhrases = [
        'tamam', 'teşekkür', 'tesekkur', 'sağol', 'sagol',
        'eyvallah', 'ok', 'anladım', 'anladim', 'peki',
        'iyi', 'güzel', 'guzel', 'süper', 'super', 'harika',
        'tamamdır', 'tamamdir',
        'görüşürüz', 'gorusuruz', 'hoşçakal', 'hoscakal', 'bye',
      ];

      if (closingPhrases.some(phrase => lowerMsg.includes(phrase))) {
        console.log('[RouterDecision] Flow resolved + closing phrase → Don\'t run router');
        return false;
      }
    }

    // Long message or question → RUN ROUTER
    if (message.length > 20 || message.includes('?')) {
      console.log('[RouterDecision] Flow resolved + new question → Run router');
      return true;
    }

    // Other short messages → DON'T RUN (probably acknowledgment)
    console.log('[RouterDecision] Flow resolved + short message → Don\'t run router');
    return false;
  }

  // CASE 3: Expected slot + Topic switch detected → RUN ROUTER
  if (state.expectedSlot) {
    const topicSwitch = detectTopicSwitch(message, state);

    if (topicSwitch) {
      console.log('[RouterDecision] Slot expected but topic switch detected → Run router');
      return true;
    }

    // No topic switch, waiting for slot → DON'T RUN
    console.log('[RouterDecision] Slot expected, no topic switch → Don\'t run router');
    return false;
  }

  // CASE 4: Flow in progress, no slot expected → Check for topic switch
  if (state.flowStatus === 'in_progress') {
    const topicSwitch = detectTopicSwitch(message, state);

    if (topicSwitch) {
      console.log('[RouterDecision] Flow in progress but topic switch detected → Run router');
      return true;
    }

    // No topic switch → DON'T RUN (continue with flow)
    console.log('[RouterDecision] Flow in progress, no topic switch → Don\'t run router');
    return false;
  }

  // DEFAULT: DON'T RUN
  console.log('[RouterDecision] Default case → Don\'t run router');
  return false;
}
