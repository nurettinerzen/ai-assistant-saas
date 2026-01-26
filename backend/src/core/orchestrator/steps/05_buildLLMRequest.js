/**
 * Step 5: Build LLM Request
 *
 * - Applies tool gating policy
 * - Builds Gemini request with gated tools
 * - Returns chat session and request configuration
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { applyToolGatingPolicy } from '../../../policies/toolGatingPolicy.js';
import { convertToolsToGeminiFunctions as convertToolsToGemini } from '../../../services/gemini-utils.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function buildLLMRequest(params) {
  const {
    systemPrompt,
    conversationHistory,
    userMessage,
    classification,
    state,
    toolsAll,
    metrics
  } = params;

  // STEP 0: Enhance system prompt with known customer info
  let enhancedSystemPrompt = systemPrompt;
  if (state.extractedSlots && Object.keys(state.extractedSlots).length > 0) {
    const knownInfo = [];
    if (state.extractedSlots.customer_name) {
      knownInfo.push(`Name: ${state.extractedSlots.customer_name}`);
    }
    if (state.extractedSlots.phone) {
      knownInfo.push(`Phone: ${state.extractedSlots.phone}`);
    }
    if (state.extractedSlots.order_number) {
      knownInfo.push(`Order: ${state.extractedSlots.order_number}`);
    }
    if (state.extractedSlots.email) {
      knownInfo.push(`Email: ${state.extractedSlots.email}`);
    }

    if (knownInfo.length > 0) {
      enhancedSystemPrompt += `\n\nKnown Customer Info: ${knownInfo.join(', ')}`;
      console.log('📝 [BuildLLMRequest] Added Known Info to prompt:', knownInfo.join(', '));
    }
  }

  // STEP 1: Apply tool gating policy
  const classifierConfidence = classification?.confidence || 0.9;

  // If no flow-specific tools, use ALL available tools (extract names from toolsAll)
  const allToolNames = toolsAll.map(t => t.function?.name).filter(Boolean);
  const flowTools = (state.allowedTools && state.allowedTools.length > 0)
    ? state.allowedTools
    : allToolNames;

  const gatedTools = applyToolGatingPolicy({
    confidence: classifierConfidence,
    activeFlow: state.activeFlow,
    allowedTools: flowTools,
    verificationStatus: state.verificationStatus,
    metrics
  });

  console.log('🔧 [BuildLLMRequest]:', {
    originalTools: flowTools.length,
    gatedTools: gatedTools.length,
    confidence: classifierConfidence.toFixed(2),
    removed: flowTools.filter(t => !gatedTools.includes(t))
  });

  // STEP 2: Filter tools based on gated list
  // toolsAll is in OpenAI format: {type: 'function', function: {name, description, parameters}}
  const allowedToolObjects = toolsAll.filter(tool =>
    gatedTools.includes(tool.function?.name)
  );

  // STEP 3: Convert tools to Gemini format
  const geminiTools = allowedToolObjects.length > 0
    ? convertToolsToGemini(allowedToolObjects)
    : [];

  // STEP 4: Build conversation history for Gemini
  const geminiHistory = conversationHistory.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  // STEP 5: Create Gemini chat session
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: enhancedSystemPrompt,
    tools: geminiTools.length > 0 ? [{ functionDeclarations: geminiTools }] : undefined,
    toolConfig: geminiTools.length > 0 ? {
      functionCallingConfig: {
        mode: 'AUTO'
      }
    } : undefined,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 1024,
      // CRITICAL: Disable thinking mode to prevent empty responses with tool-enabled requests
      thinkingConfig: {
        thinkingBudget: 0
      }
    }
  });

  const chat = model.startChat({
    history: geminiHistory
  });

  // STEP 6: Update state with gated tools
  state.allowedTools = gatedTools;

  return {
    chat,
    gatedTools,
    hasTools: gatedTools.length > 0,
    model,
    confidence: classifierConfidence
  };
}

export default { buildLLMRequest };
