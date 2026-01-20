// ============================================================================
// 11LABS CONVERSATIONAL AI SERVICE
// ============================================================================
// API client for 11Labs Conversational AI
// Replaces VAPI for phone channel - provides better Turkish voice quality
// ============================================================================

import axios from 'axios';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';

const elevenLabsClient = axios.create({
  baseURL: ELEVENLABS_BASE_URL,
  headers: {
    'xi-api-key': ELEVENLABS_API_KEY,
    'Content-Type': 'application/json'
  }
});

// ============================================================================
// AGENT (ASSISTANT) MANAGEMENT
// ============================================================================

const elevenLabsService = {
  /**
   * Create a new Conversational AI Agent
   * @param {Object} config - Agent configuration
   * @returns {Object} Created agent with agent_id
   */
  async createAgent(config) {
    try {
      const response = await elevenLabsClient.post('/convai/agents/create', config);
      console.log('✅ 11Labs Agent created:', response.data.agent_id);
      return response.data;
    } catch (error) {
      // Log full error details including loc array
      const errorData = error.response?.data;
      if (errorData?.detail) {
        console.error('❌ 11Labs createAgent error details:');
        errorData.detail.forEach((d, i) => {
          console.error(`  [${i}] type: ${d.type}, loc: ${JSON.stringify(d.loc)}, msg: ${d.msg}, input: ${JSON.stringify(d.input)}`);
        });
      } else {
        console.error('❌ 11Labs createAgent error:', errorData || error.message);
      }
      throw error;
    }
  },

  /**
   * Update an existing agent
   * @param {string} agentId - Agent ID
   * @param {Object} config - Updated configuration
   */
  async updateAgent(agentId, config) {
    try {
      const response = await elevenLabsClient.patch(`/convai/agents/${agentId}`, config);
      console.log('✅ 11Labs Agent updated:', agentId);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs updateAgent error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get agent details
   * @param {string} agentId - Agent ID
   */
  async getAgent(agentId) {
    try {
      const response = await elevenLabsClient.get(`/convai/agents/${agentId}`);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs getAgent error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Delete an agent
   * @param {string} agentId - Agent ID
   */
  async deleteAgent(agentId) {
    try {
      await elevenLabsClient.delete(`/convai/agents/${agentId}`);
      console.log('✅ 11Labs Agent deleted:', agentId);
      return true;
    } catch (error) {
      console.error('❌ 11Labs deleteAgent error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * List all agents
   */
  async listAgents() {
    try {
      const response = await elevenLabsClient.get('/convai/agents');
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs listAgents error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================================================
  // TOOL MANAGEMENT
  // ============================================================================

  /**
   * Create a webhook tool in 11Labs
   * @param {Object} toolConfig - Tool configuration
   * @returns {Object} Created tool with id
   */
  async createTool(toolConfig) {
    try {
      const response = await elevenLabsClient.post('/convai/tools', {
        tool_config: toolConfig
      });
      console.log('✅ 11Labs Tool created:', response.data.id, '-', toolConfig.name);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs createTool error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Delete a tool from 11Labs
   * @param {string} toolId - Tool ID
   */
  async deleteTool(toolId) {
    try {
      await elevenLabsClient.delete(`/convai/tools/${toolId}`);
      console.log('✅ 11Labs Tool deleted:', toolId);
      return true;
    } catch (error) {
      console.error('❌ 11Labs deleteTool error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * List all tools
   */
  async listTools() {
    try {
      const response = await elevenLabsClient.get('/convai/tools');
      return response.data.tools || [];
    } catch (error) {
      console.error('❌ 11Labs listTools error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Add tools to an agent by tool IDs
   * NOTE: 11Labs requires tool_ids at root level in PATCH request
   * @param {string} agentId - Agent ID
   * @param {string[]} toolIds - Array of tool IDs to add
   */
  async addToolsToAgent(agentId, toolIds) {
    try {
      // Get current agent to preserve existing tools
      const agent = await this.getAgent(agentId);
      const currentToolIds = agent.tool_ids || [];

      // Merge with new tool IDs (avoid duplicates)
      const allToolIds = [...new Set([...currentToolIds, ...toolIds])];

      console.log('🔧 Adding tool_ids to agent:', agentId);
      console.log('🔧 Current tool_ids:', currentToolIds);
      console.log('🔧 New tool_ids to add:', toolIds);
      console.log('🔧 Final tool_ids:', allToolIds);

      // PATCH with tool_ids at root level
      const response = await elevenLabsClient.patch(`/convai/agents/${agentId}`, {
        tool_ids: allToolIds
      });

      // Verify the update
      console.log('🔧 PATCH response tool_ids:', response.data?.tool_ids);

      // Double-check by fetching the agent again
      const verifyAgent = await this.getAgent(agentId);
      console.log('🔧 Verified agent tool_ids:', verifyAgent.tool_ids);

      if (!verifyAgent.tool_ids || verifyAgent.tool_ids.length === 0) {
        console.warn('⚠️ tool_ids did not persist! Trying alternative approach...');

        // Try updating via conversation_config approach
        // Some 11Labs API versions require tools in a different structure
        const altResponse = await elevenLabsClient.patch(`/convai/agents/${agentId}`, {
          conversation_config: {
            agent: {
              tools: {
                tool_ids: allToolIds
              }
            }
          }
        });
        console.log('🔧 Alternative PATCH response:', altResponse.data?.tool_ids || altResponse.data?.conversation_config?.agent?.tools);
      }

      console.log('✅ 11Labs Tools added to agent:', agentId, 'Tool IDs:', allToolIds);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs addToolsToAgent error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get or create webhook tools without linking to an agent
   * Use this to get tool IDs that can be included in agent creation
   * @param {Object[]} toolDefinitions - Array of tool definitions in our format
   * @param {string} backendUrl - Backend URL for webhook
   * @returns {string[]} Array of tool IDs
   */
  async getOrCreateTools(toolDefinitions, backendUrl) {
    const toolIds = [];
    const webhookUrl = `${backendUrl}/api/elevenlabs/webhook`;

    // Get all existing tools
    const existingTools = await this.listTools();
    console.log(`📋 Found ${existingTools.length} existing tools in 11Labs`);

    for (const toolDef of toolDefinitions) {
      const toolName = toolDef.function.name;

      // Find existing tool with same name
      let existingTool = existingTools.find(t => {
        const config = t.tool_config || {};
        const url = config.api_schema?.url || '';
        return config.name === toolName && url.includes('api/elevenlabs/webhook');
      });

      if (existingTool) {
        console.log(`✅ Found existing tool: ${toolName} (${existingTool.id})`);
        toolIds.push(existingTool.id);
      } else {
        // Create new tool
        try {
          const toolConfig = {
            type: 'webhook',
            name: toolName,
            description: toolDef.function.description,
            api_schema: {
              url: webhookUrl,
              method: 'POST',
              request_body_schema: {
                type: 'object',
                properties: {
                  tool_name: {
                    type: 'string',
                    description: 'Tool name',
                    constant_value: toolName
                  },
                  ...Object.fromEntries(
                    Object.entries(toolDef.function.parameters.properties || {}).map(([key, value]) => [
                      key,
                      {
                        type: value.type || 'string',
                        description: value.description || '',
                        ...(value.enum ? { enum: value.enum } : {})
                      }
                    ])
                  )
                },
                required: toolDef.function.parameters.required || []
              }
            }
          };

          const createdTool = await this.createTool(toolConfig);
          console.log(`✅ Created new tool: ${toolName} (${createdTool.id})`);
          toolIds.push(createdTool.id);
        } catch (err) {
          console.error(`❌ Failed to create tool ${toolName}:`, err.message);
        }
      }
    }

    return toolIds;
  },

  /**
   * Find or create webhook tools and add them to an agent
   * First tries to find existing tools with matching names, then creates if needed
   * @param {string} agentId - Agent ID
   * @param {Object[]} toolDefinitions - Array of tool definitions in our format
   * @param {string} webhookUrl - Webhook URL for tools
   * @returns {string[]} Array of tool IDs added to agent
   */
  async setupAgentTools(agentId, toolDefinitions, webhookUrl) {
    const toolIdsToAdd = [];

    // Get all existing tools
    const existingTools = await this.listTools();
    console.log(`📋 Found ${existingTools.length} existing tools in 11Labs`);

    for (const toolDef of toolDefinitions) {
      const toolName = toolDef.function.name;

      // Find existing tool with same name and matching webhook URL (or create new)
      let existingTool = existingTools.find(t => {
        const config = t.tool_config || {};
        const url = config.api_schema?.url || '';
        // Match by name and URL containing our domain
        return config.name === toolName && url.includes('api/elevenlabs/webhook');
      });

      if (existingTool) {
        console.log(`✅ Using existing tool: ${toolName} (${existingTool.id})`);

        // Update the tool's webhook URL to include this agent's ID
        try {
          await elevenLabsClient.patch(`/convai/tools/${existingTool.id}`, {
            tool_config: {
              ...existingTool.tool_config,
              api_schema: {
                ...existingTool.tool_config.api_schema,
                url: webhookUrl
              }
            }
          });
          console.log(`🔄 Updated tool webhook URL: ${existingTool.id}`);
        } catch (updateErr) {
          console.warn(`⚠️ Could not update tool URL, using as-is:`, updateErr.message);
        }

        toolIdsToAdd.push(existingTool.id);
      } else {
        // Create new tool
        try {
          const toolConfig = {
            type: 'webhook',
            name: toolName,
            description: toolDef.function.description,
            api_schema: {
              url: webhookUrl,
              method: 'POST',
              request_body_schema: {
                type: 'object',
                properties: {
                  tool_name: {
                    type: 'string',
                    description: 'Tool name',
                    constant_value: toolName
                  },
                  ...Object.fromEntries(
                    Object.entries(toolDef.function.parameters.properties || {}).map(([key, value]) => [
                      key,
                      {
                        type: value.type || 'string',
                        description: value.description || '',
                        ...(value.enum ? { enum: value.enum } : {})
                      }
                    ])
                  )
                },
                required: toolDef.function.parameters.required || []
              }
            }
          };

          const createdTool = await this.createTool(toolConfig);
          toolIdsToAdd.push(createdTool.id);
        } catch (err) {
          console.error(`❌ Failed to create tool ${toolName}:`, err.message);
        }
      }
    }

    // Add all tools to the agent
    if (toolIdsToAdd.length > 0) {
      await this.addToolsToAgent(agentId, toolIdsToAdd);
    }

    return toolIdsToAdd;
  },

  // ============================================================================
  // PHONE NUMBER MANAGEMENT
  // ============================================================================

  /**
   * Import a Twilio phone number to 11Labs
   * @param {Object} config - Phone number configuration
   * @param {string} config.phoneNumber - Phone number in E.164 format
   * @param {string} config.twilioAccountSid - Twilio Account SID
   * @param {string} config.twilioAuthToken - Twilio Auth Token
   * @param {string} config.agentId - 11Labs Agent ID to assign
   * @param {string} config.label - Optional label for the phone number
   */
  async importPhoneNumber(config) {
    try {
      // Step 1: Import phone number to 11Labs
      // Note: agent_id in create request is often ignored, so we update separately
      const response = await elevenLabsClient.post('/convai/phone-numbers/create', {
        phone_number: config.phoneNumber,
        label: config.label || `Telyx - ${config.phoneNumber}`,
        provider: 'twilio',
        sid: config.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID,
        token: config.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN
      });
      console.log('✅ 11Labs Phone number imported:', response.data.phone_number_id);

      // Step 2: Assign agent to the phone number (separate API call)
      if (config.agentId) {
        console.log('📞 Assigning agent to phone number...');
        await elevenLabsClient.patch(`/convai/phone-numbers/${response.data.phone_number_id}`, {
          agent_id: config.agentId
        });
        console.log('✅ Agent assigned to phone number');
      }

      return response.data;
    } catch (error) {
      console.error('❌ 11Labs importPhoneNumber error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Import a SIP trunk phone number to 11Labs (for NetGSM, etc.)
   * @param {Object} config - SIP trunk configuration
   *
   * SIP Trunk Configuration (Based on NetGSM + ElevenLabs integration):
   * - inbound_trunk_config: Only media_encryption and username (NO password for inbound)
   * - outbound_trunk_config: address, transport, media_encryption, and full credentials
   *
   * IMPORTANT:
   * - Both inbound and outbound must have media_encryption: 'disabled'
   * - Transport must be 'tcp' (ElevenLabs doesn't support UDP with NetGSM)
   * - Inbound only needs username, no password
   * - Outbound needs full credentials (username + password)
   */
  async importSipTrunkNumber(config) {
    try {
      // Extract just the number part for SIP username (remove + and country code prefix if needed)
      // NetGSM format: 8503078914 (not +908503078914)
      let sipUsername = config.sipUsername;
      if (sipUsername.startsWith('+90')) {
        sipUsername = sipUsername.substring(3);
      } else if (sipUsername.startsWith('90')) {
        sipUsername = sipUsername.substring(2);
      } else if (sipUsername.startsWith('+')) {
        sipUsername = sipUsername.substring(1);
      }

      // Build the request payload based on actual ElevenLabs panel fields
      const payload = {
        phone_number: config.phoneNumber,
        label: config.label || `SIP - ${config.phoneNumber}`,
        provider: 'sip_trunk',
        supports_inbound: true,
        supports_outbound: true,
        // Inbound configuration - ONLY media_encryption, NO credentials
        inbound_trunk_config: {
          media_encryption: 'disabled'
          // Note: No credentials for inbound based on ElevenLabs panel
        },
        // Outbound configuration - full credentials with address
        outbound_trunk_config: {
          address: config.sipServer,  // e.g., "sip.netgsm.com.tr"
          transport: 'tcp',  // Must be TCP for NetGSM + ElevenLabs
          media_encryption: 'disabled',
          credentials: {
            username: sipUsername,
            password: config.sipPassword
          }
        },
        agent_id: config.agentId
      };

      console.log('📞 11Labs SIP trunk payload:', JSON.stringify(payload, null, 2));

      // Use /convai/phone-numbers endpoint
      const response = await elevenLabsClient.post('/convai/phone-numbers', payload);
      console.log('✅ 11Labs SIP trunk phone number imported:', response.data.phone_number_id);
      console.log('📋 11Labs response:', JSON.stringify(response.data, null, 2));

      // Agent assignment doesn't work in create call, do it separately
      if (config.agentId && response.data.phone_number_id) {
        console.log('📞 Assigning agent to SIP trunk phone number...');
        try {
          await elevenLabsClient.patch(`/convai/phone-numbers/${response.data.phone_number_id}`, {
            agent_id: config.agentId
          });
          console.log('✅ Agent assigned to SIP trunk phone number');
        } catch (agentError) {
          console.error('⚠️ Failed to assign agent:', agentError.response?.data || agentError.message);
        }
      }

      return response.data;
    } catch (error) {
      console.error('❌ 11Labs importSipTrunkNumber error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Update phone number (change agent)
   * @param {string} phoneNumberId - 11Labs phone number ID
   * @param {string} agentId - New agent ID to assign
   */
  async updatePhoneNumber(phoneNumberId, agentId) {
    try {
      const response = await elevenLabsClient.patch(`/convai/phone-numbers/${phoneNumberId}`, {
        agent_id: agentId
      });
      console.log('✅ 11Labs Phone number updated:', phoneNumberId);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs updatePhoneNumber error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Update SIP trunk configuration for a phone number
   * @param {string} phoneNumberId - 11Labs phone number ID
   * @param {Object} config - SIP configuration to update
   *
   * Note: Inbound config has NO password, only username
   */
  async updateSipTrunkConfig(phoneNumberId, config) {
    try {
      // Extract just the number part for SIP username
      let sipUsername = config.sipUsername;
      if (sipUsername.startsWith('+90')) {
        sipUsername = sipUsername.substring(3);
      } else if (sipUsername.startsWith('90')) {
        sipUsername = sipUsername.substring(2);
      } else if (sipUsername.startsWith('+')) {
        sipUsername = sipUsername.substring(1);
      }

      const updatePayload = {
        // Inbound - ONLY media_encryption, NO credentials
        inbound_trunk_config: {
          media_encryption: 'disabled'
        },
        // Outbound - full credentials
        outbound_trunk_config: {
          address: config.sipServer,
          transport: 'tcp',  // Must be TCP
          media_encryption: 'disabled',
          credentials: {
            username: sipUsername,
            password: config.sipPassword
          }
        }
      };

      if (config.agentId) {
        updatePayload.agent_id = config.agentId;
      }

      console.log('📞 Updating 11Labs SIP config:', JSON.stringify(updatePayload, null, 2));

      const response = await elevenLabsClient.patch(`/convai/phone-numbers/${phoneNumberId}`, updatePayload);
      console.log('✅ 11Labs SIP trunk config updated:', phoneNumberId);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs updateSipTrunkConfig error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Delete/release a phone number
   * @param {string} phoneNumberId - 11Labs phone number ID
   */
  async deletePhoneNumber(phoneNumberId) {
    try {
      await elevenLabsClient.delete(`/convai/phone-numbers/${phoneNumberId}`);
      console.log('✅ 11Labs Phone number deleted:', phoneNumberId);
      return true;
    } catch (error) {
      console.error('❌ 11Labs deletePhoneNumber error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get phone number details
   * @param {string} phoneNumberId - 11Labs phone number ID
   */
  async getPhoneNumber(phoneNumberId) {
    try {
      const response = await elevenLabsClient.get(`/convai/phone-numbers/${phoneNumberId}`);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs getPhoneNumber error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * List all phone numbers
   */
  async listPhoneNumbers() {
    try {
      const response = await elevenLabsClient.get('/convai/phone-numbers');
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs listPhoneNumbers error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================================================
  // OUTBOUND CALLS
  // ============================================================================

  /**
   * Initiate an outbound call via SIP trunk (NetGSM, etc.)
   * @param {Object} config - Call configuration
   * @param {string} config.agentId - 11Labs Agent ID
   * @param {string} config.phoneNumberId - 11Labs Phone Number ID
   * @param {string} config.toNumber - Destination phone number (E.164)
   * @param {Object} config.clientData - Optional data to pass to conversation
   */
  async initiateOutboundCall(config) {
    try {
      // 11Labs SIP trunk outbound call endpoint
      const response = await elevenLabsClient.post('/convai/conversation/outbound-call', {
        agent_id: config.agentId,
        phone_number_id: config.phoneNumberId,
        to_phone_number: config.toNumber,
        conversation_initiation_client_data: config.clientData || {}
      });
      console.log('✅ 11Labs Outbound call initiated:', response.data.conversation_id || response.data.call_sid);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs initiateOutboundCall error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Initiate an outbound call via Twilio (legacy)
   * @param {Object} config - Call configuration
   */
  async initiateOutboundCallTwilio(config) {
    try {
      const response = await elevenLabsClient.post('/convai/twilio/outbound-call', {
        agent_id: config.agentId,
        agent_phone_number_id: config.phoneNumberId,
        to_number: config.toNumber,
        conversation_initiation_client_data: config.clientData || {}
      });
      console.log('✅ 11Labs Twilio Outbound call initiated:', response.data.call_sid);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs initiateOutboundCallTwilio error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================================================
  // CONVERSATION (CALL LOG) MANAGEMENT
  // ============================================================================

  /**
   * Get conversation details
   * @param {string} conversationId - Conversation ID
   */
  async getConversation(conversationId) {
    try {
      const response = await elevenLabsClient.get(`/convai/conversations/${conversationId}`);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs getConversation error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * List conversations
   * @param {number|string} pageSizeOrAgentId - Page size (number) or Agent ID (string for backward compat)
   * @param {Object} params - Query parameters (page_size, cursor, agent_id)
   */
  async listConversations(pageSizeOrAgentId, params = {}) {
    try {
      let queryParams;

      // Support both new (pageSize) and old (agentId, params) signatures
      if (typeof pageSizeOrAgentId === 'number') {
        // New signature: listConversations(50)
        queryParams = new URLSearchParams({
          page_size: pageSizeOrAgentId.toString(),
          ...params
        });
      } else if (typeof pageSizeOrAgentId === 'string') {
        // Old signature: listConversations(agentId, params)
        queryParams = new URLSearchParams({
          agent_id: pageSizeOrAgentId,
          ...params
        });
      } else {
        queryParams = new URLSearchParams({ page_size: '50' });
      }

      const response = await elevenLabsClient.get(`/convai/conversations?${queryParams}`);
      return response.data.conversations || response.data;
    } catch (error) {
      console.error('❌ 11Labs listConversations error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get conversation audio
   * @param {string} conversationId - Conversation ID
   */
  async getConversationAudio(conversationId) {
    try {
      const response = await elevenLabsClient.get(`/convai/conversations/${conversationId}/audio`, {
        responseType: 'arraybuffer'
      });
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs getConversationAudio error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================================================
  // SIGNED URL FOR WEB CLIENT
  // ============================================================================

  /**
   * Get signed URL for web client
   * This is used for browser-based voice calls (replaces VAPI web SDK)
   * @param {string} agentId - Agent ID
   */
  async getSignedUrl(agentId) {
    try {
      const response = await elevenLabsClient.get(`/convai/conversation/get-signed-url?agent_id=${agentId}`);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs getSignedUrl error:', error.response?.data || error.message);
      throw error;
    }
  },

  // ============================================================================
  // KNOWLEDGE BASE MANAGEMENT
  // ============================================================================

  /**
   * Create knowledge base document from URL
   * @param {string} url - URL to scrape
   * @param {string} name - Optional document name
   * @returns {Object} - { id, name }
   */
  async createKnowledgeFromUrl(url, name = null) {
    try {
      const response = await elevenLabsClient.post('/convai/knowledge-base/url', {
        url,
        ...(name && { name })
      });
      console.log('✅ 11Labs Knowledge document created from URL:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs createKnowledgeFromUrl error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Create knowledge base document from text content
   * Uses file upload endpoint with a text file
   * @param {string} content - Text content
   * @param {string} name - Document name
   * @returns {Object} - { id, name }
   */
  async createKnowledgeFromText(content, name) {
    try {
      const FormData = (await import('form-data')).default;
      const formData = new FormData();

      // Create a text file buffer from content
      const buffer = Buffer.from(content, 'utf-8');
      formData.append('file', buffer, {
        filename: `${name.replace(/[^a-zA-Z0-9]/g, '_')}.txt`,
        contentType: 'text/plain'
      });
      formData.append('name', name);

      const response = await elevenLabsClient.post('/convai/knowledge-base', formData, {
        headers: {
          ...formData.getHeaders()
        }
      });
      console.log('✅ 11Labs Knowledge document created from text:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs createKnowledgeFromText error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Add existing knowledge document to an agent
   * @param {string} agentId - Agent ID
   * @param {string} documentId - Knowledge document ID
   */
  async addKnowledgeToAgent(agentId, documentId, documentName) {
    try {
      // Get current agent config
      const agent = await this.getAgent(agentId);

      // 11Labs uses knowledge_base array with objects containing id, type, and name
      // Format: [{ type: "file", id: "docId", name: "Document Name" }, ...]
      const currentKnowledgeBase = agent.conversation_config?.agent?.prompt?.knowledge_base || [];

      console.log('📚 Current knowledge_base:', JSON.stringify(currentKnowledgeBase));

      // Check if document already exists
      const exists = currentKnowledgeBase.some(kb => kb.id === documentId);
      if (!exists) {
        currentKnowledgeBase.push({
          type: 'file',
          id: documentId,
          name: documentName || `Document ${documentId.substring(0, 8)}`
        });
      }

      // Update agent with new knowledge base - nested in conversation_config
      const response = await elevenLabsClient.patch(`/convai/agents/${agentId}`, {
        conversation_config: {
          agent: {
            prompt: {
              knowledge_base: currentKnowledgeBase
            }
          }
        }
      });

      console.log('✅ 11Labs Knowledge document added to agent:', documentId);
      console.log('📚 Updated knowledge_base:', JSON.stringify(response.data?.conversation_config?.agent?.prompt?.knowledge_base || []));
      return { success: true };
    } catch (error) {
      console.error('❌ 11Labs addKnowledgeToAgent error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Remove knowledge document from an agent
   * @param {string} agentId - Agent ID
   * @param {string} documentId - Knowledge document ID to remove
   */
  async removeKnowledgeFromAgent(agentId, documentId) {
    try {
      // Get current agent config
      const agent = await this.getAgent(agentId);
      const currentKnowledgeBase = agent.conversation_config?.agent?.prompt?.knowledge_base || [];

      // Filter out the document
      const updatedKnowledgeBase = currentKnowledgeBase.filter(kb => kb.id !== documentId);

      // Update agent
      await elevenLabsClient.patch(`/convai/agents/${agentId}`, {
        conversation_config: {
          agent: {
            prompt: {
              knowledge_base: updatedKnowledgeBase
            }
          }
        }
      });

      console.log('✅ 11Labs Knowledge document removed from agent:', documentId);
      return { success: true };
    } catch (error) {
      console.error('❌ 11Labs removeKnowledgeFromAgent error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Delete knowledge document from 11Labs
   * @param {string} documentId - Knowledge document ID
   */
  async deleteKnowledgeDocument(documentId) {
    try {
      await elevenLabsClient.delete(`/convai/knowledge-base/${documentId}`);
      console.log('✅ 11Labs Knowledge document deleted:', documentId);
      return { success: true };
    } catch (error) {
      console.error('❌ 11Labs deleteKnowledgeDocument error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get agent details
   * @param {string} agentId - Agent ID
   */
  async getAgent(agentId) {
    try {
      const response = await elevenLabsClient.get(`/convai/agents/${agentId}`);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs getAgent error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Creates document and adds to agent in one step
   * @param {string} agentId - Agent ID
   * @param {Object} document - { name, content } or { name, url }
   */
  async addKnowledgeDocument(agentId, document) {
    try {
      let knowledgeDoc;

      if (document.url) {
        // Create from URL
        knowledgeDoc = await this.createKnowledgeFromUrl(document.url, document.name);
      } else if (document.content) {
        // Create from text content
        knowledgeDoc = await this.createKnowledgeFromText(document.content, document.name);
      } else {
        throw new Error('Either url or content is required');
      }

      // Add to agent with document name
      await this.addKnowledgeToAgent(agentId, knowledgeDoc.id, document.name || knowledgeDoc.name);

      return knowledgeDoc;
    } catch (error) {
      console.error('❌ 11Labs addKnowledgeDocument error:', error.response?.data || error.message);
      throw error;
    }
  }
};

// ============================================================================
// AGENT CONFIG BUILDER
// ============================================================================

import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from './promptBuilder.js';
import { buildGatewayToolConfig, GATEWAY_SYSTEM_PROMPT_RULES } from '../tools/definitions/agent-gateway.js';

/**
 * Build 11Labs agent configuration from assistant data
 * @param {Object} assistant - Local assistant object
 * @param {Object} business - Business object
 * @param {Array} tools - Array of tool definitions
 * @param {Array} integrations - Active integrations (optional)
 * @returns {Object} 11Labs agent configuration
 */
export function buildAgentConfig(assistant, business, tools = [], integrations = []) {
  const language = business.language?.toLowerCase() || 'tr';
  const backendUrl = process.env.BACKEND_URL || 'https://api.aicallcenter.app';

  // Build system prompt using central promptBuilder for consistency
  const activeToolsList = getPromptBuilderTools(business, integrations);
  const systemPrompt = buildAssistantPrompt(assistant, business, activeToolsList);

  // NOTE: Webhook tools are now created separately via /convai/tools endpoint
  // and linked to agents via tool_ids in setupAgentTools() function.
  // This buildAgentConfig only creates the base agent config without tools.

  // Build analysis prompt based on language
  const analysisPrompt = language === 'tr'
    ? {
        transcript_summary: 'Bu görüşmenin kısa bir özetini Türkçe olarak yaz. Müşterinin amacını ve sonucu belirt.',
        data_collection: {},
        success_evaluation: 'Görüşme başarılı mı? Müşterinin talebi karşılandı mı?'
      }
    : {
        transcript_summary: 'Write a brief summary of this conversation. State the customer\'s purpose and the outcome.',
        data_collection: {},
        success_evaluation: 'Was the conversation successful? Was the customer\'s request fulfilled?'
      };

  // NOTE: Do NOT include 'tools' array here - webhook tools are created separately via
  // /convai/tools endpoint and linked via tool_ids. Including inline tools here may conflict.
  return {
    name: assistant.name,
    conversation_config: {
      agent: {
        prompt: {
          // Use central promptBuilder for consistent system prompt across all channels
          prompt: systemPrompt,
          llm: 'gemini-2.5-flash'         // Fast and good quality for Turkish
        },
        first_message: assistant.firstMessage || getDefaultFirstMessage(language, assistant.name),
        language: language
      },
      tts: {
        voice_id: assistant.voiceId,
        model_id: 'eleven_turbo_v2',
        stability: 0.4,                   // 0.4 daha doğal tonlama için (0.5'ten düşük)
        similarity_boost: 0.6,            // 0.6 daha doğal konuşma için
        style: 0.15,                      // Hafif stil varyasyonu
        speed: 1.1,                       // Biraz daha hızlı konuşma
        optimize_streaming_latency: 3,
        text_normalization: 'elevenlabs'
      },
      stt: {
        provider: 'elevenlabs',
        model: 'scribe_v1',
        language: language
      },
      turn: {
        mode: 'turn',
        turn_timeout: 8,                     // 8sn - tool çağrısı sırasında yoklama yapmasın
        turn_eagerness: 'normal',            // Normal mod - dengeli tepki
        silence_end_call_timeout: 30         // 30sn toplam sessizlikten sonra kapat
      },
      // Analysis settings for post-call summary in correct language
      analysis: {
        transcript_summary: analysisPrompt.transcript_summary,
        data_collection: analysisPrompt.data_collection,
        success_evaluation: analysisPrompt.success_evaluation
      }
    },
    platform_settings: {
      post_call_webhook: {
        url: `${backendUrl}/api/webhooks/elevenlabs/call-ended`
      },
      conversation_initiation_client_data_webhook: {
        url: `${backendUrl}/api/webhooks/elevenlabs/call-started`
      },
      widget: {
        variant: 'full'
      }
    },
    // NOTE: tools array removed - use tool_ids with separately created webhook tools
    // The elevenLabsTools were defined but are now linked via setupAgentTools() instead
    metadata: {
      telyx_assistant_id: assistant.id,
      telyx_business_id: business.id,
      business_id: business.id.toString()  // For webhook extraction
    }
  };
}

/**
 * Get default first message based on language
 */
function getDefaultFirstMessage(language, name) {
  const messages = {
    tr: `Merhaba, ben ${name}. Size nasıl yardımcı olabilirim?`,
    en: `Hello, I'm ${name}. How can I help you today?`,
    de: `Hallo, ich bin ${name}. Wie kann ich Ihnen helfen?`,
    es: `Hola, soy ${name}. ¿Cómo puedo ayudarle?`,
    fr: `Bonjour, je suis ${name}. Comment puis-je vous aider?`
  };
  return messages[language] || messages.en;
}

// ============================================================================
// GATEWAY MODE CONFIG BUILDER
// ============================================================================

/**
 * Build 11Labs agent configuration using Gateway Architecture
 *
 * Gateway Architecture:
 * - Single tool (agent_gateway) handles ALL user messages
 * - Backend uses heuristic router for ultra-fast intent detection
 * - Model only reads responses and decides end_call/transfer based on next_action
 *
 * @param {Object} assistant - Local assistant object
 * @param {Object} business - Business object
 * @returns {Object} 11Labs agent configuration with gateway pattern
 */
export function buildGatewayAgentConfig(assistant, business) {
  const language = business.language?.toLowerCase() || 'tr';
  const backendUrl = process.env.BACKEND_URL || 'https://api.aicallcenter.app';

  // Build simplified system prompt for gateway mode
  const gatewaySystemPrompt = buildGatewaySystemPrompt(assistant, business, language);

  // Build analysis prompt based on language
  const analysisPrompt = language === 'tr'
    ? {
        transcript_summary: 'Bu görüşmenin kısa bir özetini Türkçe olarak yaz. Müşterinin amacını ve sonucu belirt.',
        data_collection: {},
        success_evaluation: 'Görüşme başarılı mı? Müşterinin talebi karşılandı mı?'
      }
    : {
        transcript_summary: 'Write a brief summary of this conversation. State the customer\'s purpose and the outcome.',
        data_collection: {},
        success_evaluation: 'Was the conversation successful? Was the customer\'s request fulfilled?'
      };

  // Build webhook URL for gateway tool
  const webhookUrl = `${backendUrl}/api/elevenlabs/agent-gateway?agentId=${assistant.id || 'pending'}`;

  // All tools: gateway webhook + system tools (inline in prompt.tools)
  const allTools = [
    // Gateway webhook tool - handles ALL user messages
    {
      type: 'webhook',
      name: 'agent_gateway',
      description: language === 'tr'
        ? `Her kullanıcı mesajı için bu tool'u çağır. Kullanıcının söylediğini gönder, backend ne söylemen gerektiğini döndürecek. Dönen 'say' alanını sesli söyle. 'next_action': "continue" devam et, "end_call" görüşmeyi kapat, "transfer" numaraya aktar.`
        : `Call this tool for every user message. Send what the user said, backend will return what to say. Speak the 'say' field. 'next_action': "continue" keep going, "end_call" end call, "transfer" transfer to number.`,
      api_schema: {
        url: webhookUrl,
        method: 'POST',
        request_body_schema: {
          type: 'object',
          properties: {
            user_message: {
              type: 'string',
              description: language === 'tr'
                ? 'Kullanıcının söylediği mesaj - olduğu gibi gönder'
                : 'The user message - send as-is'
            },
            conversation_id: {
              type: 'string',
              dynamic_variable: 'system__conversation_id'
            },
            caller_phone: {
              type: 'string',
              dynamic_variable: 'system__caller_id'
            }
          },
          required: ['user_message']
        }
      }
    },
    // System tool: end_call
    {
      type: 'system',
      name: 'end_call',
      description: language === 'tr'
        ? 'Görüşmeyi sonlandır. next_action "end_call" olduğunda veya müşteri vedalaştığında kullan.'
        : 'End the call. Use when next_action is "end_call" or customer says goodbye.',
      params: {
        system_tool_type: 'end_call'
      }
    },
    // System tool: voicemail_detection
    {
      type: 'system',
      name: 'voicemail_detection',
      description: language === 'tr'
        ? 'Sesli mesaj algılandığında aramayı otomatik sonlandır.'
        : 'Automatically end call when voicemail is detected.',
      params: {
        system_tool_type: 'voicemail_detection',
        voicemail_message: '',
        use_out_of_band_dtmf: false
      }
    }
  ];

  return {
    name: assistant.name,
    conversation_config: {
      agent: {
        prompt: {
          prompt: gatewaySystemPrompt,
          llm: 'gemini-2.5-flash',  // Fast and cost-effective
          tools: allTools  // Gateway webhook + system tools (all inline)
        },
        first_message: assistant.firstMessage || getDefaultFirstMessage(language, assistant.name),
        language: language
      },
      tts: {
        voice_id: assistant.voiceId,
        model_id: 'eleven_turbo_v2',
        stability: 0.4,
        similarity_boost: 0.6,
        style: 0.15,
        speed: 1.1,
        optimize_streaming_latency: 3,
        text_normalization: 'elevenlabs'
      },
      stt: {
        provider: 'elevenlabs',
        model: 'scribe_v1',
        language: language
      },
      turn: {
        mode: 'turn',
        turn_timeout: 10,                    // Longer timeout for gateway processing
        turn_eagerness: 'normal',
        silence_end_call_timeout: 30
      },
      analysis: {
        transcript_summary: analysisPrompt.transcript_summary,
        data_collection: analysisPrompt.data_collection,
        success_evaluation: analysisPrompt.success_evaluation
      }
    },
    platform_settings: {
      post_call_webhook: {
        url: `${backendUrl}/api/webhooks/elevenlabs/call-ended`
      },
      conversation_initiation_client_data_webhook: {
        url: `${backendUrl}/api/webhooks/elevenlabs/call-started`
      },
      widget: {
        variant: 'full'
      }
    },
    metadata: {
      telyx_assistant_id: assistant.id,
      telyx_business_id: business.id,
      business_id: business.id.toString(),
      architecture: 'gateway'  // Mark this agent as using gateway architecture
    }
  };
}

/**
 * Build simplified system prompt for gateway mode
 * The heavy lifting is done by backend, so prompt is minimal
 */
function buildGatewaySystemPrompt(assistant, business, language) {
  const businessName = business.name || 'İşletme';
  const assistantName = assistant.name || 'Asistan';

  if (language === 'tr') {
    return `Sen ${businessName} için çalışan ${assistantName} adlı sesli asistansın.

## ROL
- Müşterilere telefonda yardımcı ol
- Nazik, profesyonel ve yardımsever ol
- Kısa ve net cevaplar ver

${GATEWAY_SYSTEM_PROMPT_RULES}

## ÖNEMLİ
- Hiçbir zaman bilgi UYDURMA
- Her kullanıcı mesajı için agent_gateway tool'unu kullan
- Tool'dan dönen yanıtı aynen oku
- Eğer next_action "end_call" ise, söyledikten sonra görüşmeyi kapat
- Eğer next_action "transfer" ise, söyledikten sonra belirtilen numaraya aktar`;
  }

  return `You are ${assistantName}, a voice assistant for ${businessName}.

## ROLE
- Help customers over the phone
- Be polite, professional and helpful
- Give short and clear answers

${GATEWAY_SYSTEM_PROMPT_RULES}

## IMPORTANT
- Never make up information
- Use agent_gateway tool for every user message
- Read the response from the tool as-is
- If next_action is "end_call", end the call after speaking
- If next_action is "transfer", transfer to the specified number after speaking`;
}

/**
 * Setup gateway tool for an agent
 * Creates the agent_gateway tool and links it to the agent
 *
 * @param {string} agentId - 11Labs Agent ID
 * @returns {Promise<string>} Tool ID
 */
elevenLabsService.setupGatewayTool = async function(agentId) {
  const backendUrl = process.env.BACKEND_URL || 'https://api.aicallcenter.app';

  // Build gateway tool configuration
  const toolConfig = buildGatewayToolConfig(backendUrl, agentId);

  // Check if tool already exists
  const existingTools = await this.listTools();
  const existingGateway = existingTools.find(t =>
    t.tool_config?.name === 'agent_gateway' &&
    t.tool_config?.api_schema?.url?.includes(agentId)
  );

  let toolId;

  if (existingGateway) {
    console.log(`✅ Gateway tool already exists for agent ${agentId}: ${existingGateway.id}`);
    toolId = existingGateway.id;

    // Update URL in case backend URL changed
    try {
      await elevenLabsClient.patch(`/convai/tools/${toolId}`, {
        tool_config: toolConfig
      });
      console.log(`🔄 Updated gateway tool URL for agent ${agentId}`);
    } catch (updateErr) {
      console.warn('⚠️ Could not update gateway tool:', updateErr.message);
    }
  } else {
    // Create new gateway tool
    const createdTool = await this.createTool(toolConfig);
    toolId = createdTool.id;
    console.log(`✅ Created gateway tool for agent ${agentId}: ${toolId}`);
  }

  // Link tool to agent
  await this.addToolsToAgent(agentId, [toolId]);

  return toolId;
};

/**
 * Migrate an existing agent to gateway architecture
 * - Removes all existing tools
 * - Adds single gateway tool
 * - Updates system prompt for gateway mode
 *
 * @param {string} agentId - 11Labs Agent ID
 * @param {Object} assistant - Assistant object
 * @param {Object} business - Business object
 */
elevenLabsService.migrateToGateway = async function(agentId, assistant, business) {
  console.log(`🔄 Migrating agent ${agentId} to gateway architecture...`);

  // Get current agent config
  const currentAgent = await this.getAgent(agentId);

  // Remove all existing tool_ids
  if (currentAgent.tool_ids && currentAgent.tool_ids.length > 0) {
    console.log(`📋 Removing ${currentAgent.tool_ids.length} existing tools...`);
    await elevenLabsClient.patch(`/convai/agents/${agentId}`, {
      tool_ids: []
    });
  }

  // Build new gateway config
  const gatewayConfig = buildGatewayAgentConfig(assistant, business);

  // Update agent with gateway config (excluding name to avoid conflicts)
  const { name, ...configWithoutName } = gatewayConfig;
  await this.updateAgent(agentId, configWithoutName);

  // Setup gateway tool
  const toolId = await this.setupGatewayTool(agentId);

  console.log(`✅ Agent ${agentId} migrated to gateway architecture (tool: ${toolId})`);

  return { agentId, toolId, architecture: 'gateway' };
};

export default elevenLabsService;
