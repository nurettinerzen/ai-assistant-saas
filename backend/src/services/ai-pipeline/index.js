/**
 * AI Pipeline - 3-Stage Architecture
 * Router → Orchestrator → Responder
 *
 * Stage 1 (Router): Extract intent/domain/entities - NO tool calling
 * Stage 2 (Orchestrator): Backend decides tools, validates inputs
 * Stage 3 (Responder): Format response - NO tool calling
 *
 * Benefits:
 * - Model never decides tool calls (backend controls)
 * - Deterministic tool execution
 * - Proper validation before tools run
 * - Cleaner separation of concerns
 *
 * Two Router Implementations:
 * - Router: LLM-based for written channels (WhatsApp/Chat) - more accurate
 * - HeuristicRouter: Keyword-based for phone channel - ultra-fast (1-5ms)
 */

import Router from './router.js';
import HeuristicRouter from './heuristic-router.js';
import Orchestrator from './orchestrator.js';
import Responder from './responder.js';
import KBSelector from './kb-selector.js';
import VerificationPolicy from './verification.js';

export { Router, HeuristicRouter, Orchestrator, Responder, KBSelector, VerificationPolicy };

/**
 * Process a user message through the 3-stage pipeline
 * @param {Object} params
 * @param {string} params.userMessage - User's message
 * @param {Object} params.business - Business object
 * @param {Object} params.assistant - Assistant object
 * @param {Array} params.history - Conversation history
 * @param {Object} params.context - Additional context (phone, channel, etc.)
 * @returns {Promise<Object>} - { response, intent, toolResults, tokens }
 */
export async function processMessage({
  userMessage,
  business,
  assistant,
  history = [],
  context = {}
}) {
  const router = new Router(business);
  const orchestrator = new Orchestrator(business, context);
  const responder = new Responder(business, assistant);

  // Track total tokens
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Stage 1: Router - Extract intent/domain/entities
  console.log('🔀 [Pipeline] Stage 1: Router - Extracting intent...');
  const routerResult = await router.extractIntent(userMessage, history);

  totalInputTokens += routerResult.tokens?.input || 0;
  totalOutputTokens += routerResult.tokens?.output || 0;

  console.log('🔀 [Pipeline] Router result:', {
    domain: routerResult.domain,
    intent: routerResult.intent,
    entities: routerResult.entities
  });

  // Stage 2: Orchestrator - Decide & execute tools
  console.log('⚙️ [Pipeline] Stage 2: Orchestrator - Processing...');
  const orchestratorResult = await orchestrator.process(routerResult, history);

  console.log('⚙️ [Pipeline] Orchestrator result:', {
    toolsExecuted: orchestratorResult.toolsExecuted,
    success: orchestratorResult.success,
    forceEndCall: orchestratorResult.forceEndCall
  });

  // Check for security termination
  if (orchestratorResult.forceEndCall) {
    console.log('🚨 [Pipeline] Force end call - security termination');
    return {
      response: orchestratorResult.securityMessage,
      intent: routerResult,
      toolResults: orchestratorResult.results,
      forceEndCall: true,
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens
      }
    };
  }

  // Stage 3: Responder - Format final response
  console.log('💬 [Pipeline] Stage 3: Responder - Generating response...');
  const responderResult = await responder.generateResponse({
    routerResult,
    orchestratorResult,
    userMessage,
    history
  });

  totalInputTokens += responderResult.tokens?.input || 0;
  totalOutputTokens += responderResult.tokens?.output || 0;

  console.log('💬 [Pipeline] Response generated:', responderResult.response?.substring(0, 100));

  return {
    response: responderResult.response,
    intent: routerResult,
    toolResults: orchestratorResult.results,
    forceEndCall: false,
    tokens: {
      input: totalInputTokens,
      output: totalOutputTokens
    }
  };
}

export default {
  Router,
  HeuristicRouter,
  Orchestrator,
  Responder,
  KBSelector,
  VerificationPolicy,
  processMessage
};
