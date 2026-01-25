/**
 * Gemini Utilities
 * Centralized Gemini AI functions for all channels
 *
 * This service provides:
 * - Gemini client initialization (lazy loading)
 * - Tool conversion to Gemini function format
 * - Common Gemini configurations
 * - Token counting helpers
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazy initialization for Gemini
let genAI = null;

/**
 * Get or initialize Gemini client
 * @returns {GoogleGenerativeAI} Gemini client instance
 */
export function getGeminiClient() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
}

/**
 * Convert tool definitions (OpenAI format) to Gemini function declarations
 * @param {Array} tools - Array of tool definitions in OpenAI format
 * @returns {Array} Gemini function declarations
 */
export function convertToolsToGeminiFunctions(tools) {
  return tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: {
      type: 'OBJECT',
      properties: Object.fromEntries(
        Object.entries(tool.function.parameters.properties || {}).map(([key, value]) => [
          key,
          {
            type: value.type?.toUpperCase() || 'STRING',
            description: value.description || '',
            ...(value.enum ? { enum: value.enum } : {})
          }
        ])
      ),
      required: tool.function.parameters.required || []
    }
  }));
}

/**
 * Get Gemini model with standard configuration
 * @param {Object} options - Model options
 * @param {string} options.model - Model name (default: gemini-2.5-flash)
 * @param {number} options.temperature - Temperature (default: 0.7)
 * @param {number} options.maxOutputTokens - Max output tokens (default: 1500)
 * @param {Array} options.tools - Tools for function calling (optional)
 * @returns {Object} Gemini model instance
 */
export function getGeminiModel({
  model = 'gemini-2.5-flash',
  temperature = 0.7,
  maxOutputTokens = 1500,
  tools = null,
  toolConfig = null // Allow caller to override tool config
} = {}) {
  const genAI = getGeminiClient();

  const config = {
    model,
    generationConfig: {
      temperature,
      maxOutputTokens,
      // Disable thinking mode to prevent empty responses
      thinkingConfig: {
        thinkingBudget: 0
      }
    }
  };

  // Add tools if provided
  if (tools && tools.length > 0) {
    const geminiFunctions = convertToolsToGeminiFunctions(tools);
    config.tools = [{
      functionDeclarations: geminiFunctions
    }];

    // Use provided toolConfig or default to AUTO
    config.toolConfig = toolConfig || {
      functionCallingConfig: {
        mode: 'AUTO' // Gemini decides when to use tools
      }
    };
  }

  return genAI.getGenerativeModel(config);
}

/**
 * Build Gemini chat history from conversation messages
 * Includes system prompt injection as first user/model exchange
 * @param {string} systemPrompt - System instructions
 * @param {Array} conversationHistory - Array of {role, content} messages
 * @param {boolean} excludeLastUserMessage - Whether to exclude last user message (default: true)
 * @returns {Array} Gemini-formatted chat history
 */
export function buildGeminiChatHistory(systemPrompt, conversationHistory, excludeLastUserMessage = true) {
  const chatHistory = [];

  // Add system prompt as first user message (Gemini doesn't have system role in chat)
  chatHistory.push({
    role: 'user',
    parts: [{ text: `SİSTEM TALİMATLARI (bunları kullanıcıya gösterme):\n${systemPrompt}` }]
  });
  chatHistory.push({
    role: 'model',
    parts: [{ text: 'Anladım, bu talimatlara göre davranacağım.' }]
  });

  // Add conversation history (last 10 messages)
  let recentHistory = conversationHistory.slice(-10);

  // Remove the last message if it's a user message (will be sent separately)
  if (excludeLastUserMessage && recentHistory.length > 0 && recentHistory[recentHistory.length - 1]?.role === 'user') {
    recentHistory = recentHistory.slice(0, -1);
  }

  for (const msg of recentHistory) {
    chatHistory.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    });
  }

  return chatHistory;
}

/**
 * Extract token usage from Gemini response
 * @param {Object} response - Gemini response object
 * @returns {Object} {inputTokens, outputTokens}
 */
export function extractTokenUsage(response) {
  return {
    inputTokens: response.usageMetadata?.promptTokenCount || 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount || 0
  };
}

/**
 * Handle Gemini function calls iteration
 * Processes function calls from Gemini and sends results back
 * @param {Object} chat - Gemini chat instance
 * @param {Object} response - Initial Gemini response
 * @param {Function} toolExecutor - Function to execute tools: async (toolName, params) => result
 * @param {number} maxIterations - Maximum iterations (default: 3)
 * @returns {Promise<Object>} {text, totalInputTokens, totalOutputTokens}
 */
export async function handleGeminiFunctionCalls(chat, response, toolExecutor, maxIterations = 3) {
  let currentResponse = response;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iterations = 0;
  let finalText = '';

  // Track initial tokens
  const initialUsage = extractTokenUsage(currentResponse);
  totalInputTokens += initialUsage.inputTokens;
  totalOutputTokens += initialUsage.outputTokens;

  // Try to get initial text
  try {
    finalText = currentResponse.text() || '';
  } catch (e) {
    // text() might throw if response only contains function call
  }

  // Process function calls
  while (iterations < maxIterations) {
    const functionCalls = currentResponse.functionCalls();

    if (!functionCalls || functionCalls.length === 0) {
      break; // No more function calls
    }

    console.log(`🔄 Gemini iteration ${iterations + 1}: ${functionCalls.length} function call(s)`);

    // Execute all function calls
    const functionResponses = [];
    for (const call of functionCalls) {
      console.log(`🔧 Executing function: ${call.name}`);

      try {
        const result = await toolExecutor(call.name, call.args);
        functionResponses.push({
          name: call.name,
          response: result
        });
      } catch (error) {
        console.error(`❌ Function ${call.name} failed:`, error.message);
        functionResponses.push({
          name: call.name,
          response: { error: error.message }
        });
      }
    }

    // Send function results back to Gemini
    const nextResult = await chat.sendMessage(functionResponses.map(fr => ({
      functionResponse: fr
    })));

    currentResponse = nextResult.response;

    // Track tokens
    const usage = extractTokenUsage(currentResponse);
    totalInputTokens += usage.inputTokens;
    totalOutputTokens += usage.outputTokens;

    // Try to get text
    try {
      const text = currentResponse.text();
      if (text) {
        finalText = text;
      }
    } catch (e) {
      // Might not have text yet
    }

    iterations++;
  }

  return {
    text: finalText,
    totalInputTokens,
    totalOutputTokens,
    iterations
  };
}
