/**
 * Tool Registry Adapter
 *
 * Adapter for the main tool registry to provide simplified API for state machine.
 * Delegates to the actual tool registry from ../tools/registry.js
 *
 * Usage:
 *   const tools = toolRegistry.pick(['customer_data_lookup', 'create_callback']);
 */

import registry from '../tools/registry.js';

class ToolRegistryAdapter {
  /**
   * Get tool definition by name (OpenAI format)
   */
  get(toolName) {
    return registry.getDefinition(toolName);
  }

  /**
   * Get multiple tool definitions by names (OpenAI format)
   * @param {string[]} toolNames - Array of tool names
   * @returns {Array} Array of tool definitions in OpenAI format
   */
  pick(toolNames) {
    if (!Array.isArray(toolNames)) {
      return [];
    }

    return registry.getDefinitions(toolNames);
  }

  /**
   * Get all tool definitions
   * @returns {Array} Array of all tool definitions in OpenAI format
   */
  getAll() {
    return registry.getAllDefinitions();
  }

  /**
   * Check if tool exists
   */
  has(toolName) {
    return registry.has(toolName);
  }

  /**
   * Get all registered tool names
   */
  getToolNames() {
    return registry.getAllToolNames();
  }
}

// Export singleton instance
export const toolRegistry = new ToolRegistryAdapter();

// Also export class for testing
export { ToolRegistryAdapter };
