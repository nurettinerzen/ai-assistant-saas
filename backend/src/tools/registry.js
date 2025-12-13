/**
 * Tool Registry
 * Combines tool definitions with handlers and provides lookup functions
 */

import definitions from './definitions/index.js';
import handlers from './handlers/index.js';

class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this._registerAll();
  }

  _registerAll() {
    // Register each definition with its handler
    Object.entries(definitions).forEach(([toolName, definition]) => {
      const handler = handlers[definition.name];

      if (!handler) {
        console.warn(`⚠️ Warning: No handler found for tool "${definition.name}"`);
        return;
      }

      this.tools.set(definition.name, {
        definition,
        handler
      });
    });

    console.log(`✅ ToolRegistry: ${this.tools.size} tools registered`);
  }

  /**
   * Get tool definition in OpenAI function calling format
   * @param {string} toolName - Tool name
   * @returns {Object|null} - OpenAI format tool definition or null
   */
  getDefinition(toolName) {
    const tool = this.tools.get(toolName);
    if (!tool) return null;

    // Return in OpenAI function calling format
    return {
      type: 'function',
      function: {
        name: tool.definition.name,
        description: tool.definition.description,
        parameters: tool.definition.parameters
      }
    };
  }

  /**
   * Get raw tool definition (with metadata)
   * @param {string} toolName - Tool name
   * @returns {Object|null} - Raw definition object or null
   */
  getRawDefinition(toolName) {
    const tool = this.tools.get(toolName);
    return tool ? tool.definition : null;
  }

  /**
   * Get tool handler
   * @param {string} toolName - Tool name
   * @returns {Object|null} - Handler object with execute function or null
   */
  getHandler(toolName) {
    const tool = this.tools.get(toolName);
    return tool ? tool.handler : null;
  }

  /**
   * Get all registered tool names
   * @returns {string[]} - Array of tool names
   */
  getAllToolNames() {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if tool exists
   * @param {string} toolName - Tool name
   * @returns {boolean}
   */
  has(toolName) {
    return this.tools.has(toolName);
  }

  /**
   * Get multiple tool definitions in OpenAI format
   * @param {string[]} toolNames - Array of tool names
   * @returns {Object[]} - Array of OpenAI format tool definitions
   */
  getDefinitions(toolNames) {
    return toolNames
      .map(name => this.getDefinition(name))
      .filter(Boolean);
  }

  /**
   * Get all tool definitions in OpenAI format
   * @returns {Object[]} - Array of OpenAI format tool definitions
   */
  getAllDefinitions() {
    return this.getDefinitions(this.getAllToolNames());
  }
}

// Singleton instance
const registry = new ToolRegistry();

export default registry;
