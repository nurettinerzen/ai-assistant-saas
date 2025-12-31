/**
 * Central Tool System
 * Main entry point for all tool operations
 *
 * Usage:
 *   import { getActiveTools, executeTool } from '../tools/index.js';
 *
 *   // Get tools for OpenAI function calling
 *   const tools = getActiveTools(business);
 *
 *   // Execute a tool
 *   const result = await executeTool('create_appointment', args, business, { channel: 'PHONE' });
 */

import registry from './registry.js';
import { getActiveToolNames } from './utils/business-rules.js';

/**
 * Get active tool definitions for a business (OpenAI format)
 * Filters tools based on business type and active integrations
 *
 * @param {Object} business - Business object with businessType and integrations
 * @returns {Object[]} - Array of OpenAI function calling format tool definitions
 */
export function getActiveTools(business) {
  const activeToolNames = getActiveToolNames(business);
  return registry.getDefinitions(activeToolNames);
}

/**
 * Get active tool definitions for 11Labs Conversational AI
 * 11Labs format uses webhook-based tools with different structure
 *
 * @param {Object} business - Business object with businessType and integrations
 * @param {string} serverUrl - Optional server URL (defaults to BACKEND_URL)
 * @returns {Object[]} - Array of tool definitions in 11Labs format
 */
export function getActiveToolsForElevenLabs(business, serverUrl = null) {
  const baseTools = getActiveTools(business);
  const backendUrl = serverUrl || process.env.BACKEND_URL || 'https://api.aicallcenter.app';
  const webhookUrl = `${backendUrl}/api/elevenlabs/webhook`;

  // Convert OpenAI format to 11Labs webhook format
  // 11Labs uses api_schema - omit path_params_schema and query_params_schema if not needed
  return baseTools.map(tool => ({
    type: 'webhook',
    name: tool.function.name,
    description: tool.function.description,
    api_schema: {
      url: webhookUrl,
      method: 'POST',
      request_body_schema: {
        type: 'object',
        properties: {
          tool_name: {
            type: 'string',
            description: 'Name of the tool being called'
          },
          ...tool.function.parameters.properties
        },
        required: tool.function.parameters.required || []
      }
    }
  }));
}

/**
 * Execute a tool
 *
 * @param {string} toolName - Name of the tool to execute
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object with integrations
 * @param {Object} context - Execution context
 * @param {string} context.channel - Channel type: 'PHONE' | 'WHATSAPP' | 'CHAT' | 'EMAIL'
 * @param {string} context.conversationId - Optional conversation ID
 * @param {string} context.messageId - Optional message ID
 * @returns {Object} - Result object with success, data/error, and message
 */
export async function executeTool(toolName, args, business, context = {}) {
  // Get handler
  const handler = registry.getHandler(toolName);

  if (!handler) {
    console.error(`❌ No handler found for tool: ${toolName}`);
    return {
      success: false,
      error: `Unknown tool: ${toolName}`
    };
  }

  // Verify business has access to this tool
  const activeToolNames = getActiveToolNames(business);

  if (!activeToolNames.includes(toolName)) {
    console.warn(`⚠️ Tool "${toolName}" not allowed for business type "${business.businessType}"`);
    return {
      success: false,
      error: business.language === 'TR'
        ? 'Bu işlem mevcut değil.'
        : 'This operation is not available.'
    };
  }

  // Execute handler
  try {
    const result = await handler.execute(args, business, context);
    return result;
  } catch (error) {
    console.error(`❌ Tool execution error for ${toolName}:`, error);
    return {
      success: false,
      error: business.language === 'TR'
        ? 'İşlem sırasında bir hata oluştu.'
        : 'An error occurred during the operation.'
    };
  }
}

/**
 * Get tool definition by name (OpenAI format)
 *
 * @param {string} toolName - Tool name
 * @returns {Object|null} - Tool definition or null
 */
export function getToolDefinition(toolName) {
  return registry.getDefinition(toolName);
}

/**
 * Check if a tool exists
 *
 * @param {string} toolName - Tool name
 * @returns {boolean}
 */
export function hasTool(toolName) {
  return registry.has(toolName);
}

/**
 * Get all registered tool names
 *
 * @returns {string[]} - Array of tool names
 */
export function getAllToolNames() {
  return registry.getAllToolNames();
}

// Export registry for advanced use cases
export { registry };

// Export business rules utilities
export { getActiveToolNames } from './utils/business-rules.js';

// Default export with all functions
export default {
  getActiveTools,
  getActiveToolsForElevenLabs,
  executeTool,
  getToolDefinition,
  hasTool,
  getAllToolNames,
  registry
};
