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
      console.error('❌ 11Labs createAgent error:', error.response?.data || error.message);
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
      // 11Labs API expects 'sid' and 'token' at root level for Twilio
      const response = await elevenLabsClient.post('/convai/phone-numbers/create', {
        phone_number: config.phoneNumber,
        label: config.label || `Telyx - ${config.phoneNumber}`,
        provider: 'twilio',
        sid: config.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID,
        token: config.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN,
        agent_id: config.agentId
      });
      console.log('✅ 11Labs Phone number imported:', response.data.phone_number_id);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs importPhoneNumber error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Import a SIP trunk phone number to 11Labs (for NetGSM, etc.)
   * @param {Object} config - SIP trunk configuration
   */
  async importSipTrunkNumber(config) {
    try {
      const response = await elevenLabsClient.post('/convai/phone-numbers/create', {
        phone_number: config.phoneNumber,
        label: config.label || `SIP - ${config.phoneNumber}`,
        provider: 'sip_trunk',
        provider_config: {
          sip_trunk_termination_uri: config.sipUri || `sip:${config.sipUsername}@${config.sipServer}`,
          sip_trunk_origination_uri: config.originationUri || config.sipUri,
          sip_trunk_authentication: {
            username: config.sipUsername,
            password: config.sipPassword
          }
        },
        agent_id: config.agentId
      });
      console.log('✅ 11Labs SIP trunk phone number imported:', response.data.phone_number_id);
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
   * Initiate an outbound call
   * @param {Object} config - Call configuration
   */
  async initiateOutboundCall(config) {
    try {
      const response = await elevenLabsClient.post('/convai/twilio/outbound-call', {
        agent_id: config.agentId,
        agent_phone_number_id: config.phoneNumberId,
        to_number: config.toNumber,
        conversation_initiation_client_data: config.clientData || {}
      });
      console.log('✅ 11Labs Outbound call initiated:', response.data.call_sid);
      return response.data;
    } catch (error) {
      console.error('❌ 11Labs initiateOutboundCall error:', error.response?.data || error.message);
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
  async addKnowledgeToAgent(agentId, documentId) {
    try {
      // Get current agent config
      const agent = await this.getAgent(agentId);

      // 11Labs uses knowledge_base array with objects containing id and type
      // Format: [{ type: "file", id: "docId", name: "..." }, ...]
      const currentKnowledgeBase = agent.conversation_config?.agent?.prompt?.knowledge_base || [];

      console.log('📚 Current knowledge_base:', JSON.stringify(currentKnowledgeBase));

      // Check if document already exists
      const exists = currentKnowledgeBase.some(kb => kb.id === documentId);
      if (!exists) {
        currentKnowledgeBase.push({
          type: 'file',
          id: documentId
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
   * Legacy method for backward compatibility
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

      // Add to agent
      await this.addKnowledgeToAgent(agentId, knowledgeDoc.id);

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

/**
 * Build 11Labs agent configuration from assistant data
 * @param {Object} assistant - Local assistant object
 * @param {Object} business - Business object
 * @param {Array} tools - Array of tool definitions
 * @returns {Object} 11Labs agent configuration
 */
export function buildAgentConfig(assistant, business, tools = []) {
  const language = business.language?.toLowerCase() || 'tr';

  // Convert tools to 11Labs format
  const elevenLabsTools = tools.map(tool => ({
    type: 'webhook',
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
    webhook: {
      url: `${process.env.BACKEND_URL}/api/elevenlabs/webhook`,
      method: 'POST'
    }
  }));

  // Build webhook URL for post-call analysis
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';

  return {
    name: assistant.name,
    conversation_config: {
      agent: {
        prompt: {
          prompt: assistant.systemPrompt
        },
        first_message: assistant.firstMessage || getDefaultFirstMessage(language, assistant.name),
        language: language
      },
      llm: {
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        temperature: 0.15
      },
      tts: {
        voice_id: assistant.voiceId,
        model_id: 'eleven_turbo_v2',
        stability: 0.5,
        similarity_boost: 0.75,
        speed: 1.0,
        optimize_streaming_latency: 3,
        text_normalization: 'elevenlabs'
      },
      stt: {
        provider: 'elevenlabs',
        model: 'scribe_v1',
        language: language
      },
      turn: {
        mode: 'turn'
      }
    },
    platform_settings: {
      post_call_webhook: {
        url: `${backendUrl}/api/elevenlabs/post-call`
      },
      widget: {
        variant: 'full'
      }
    },
    tools: elevenLabsTools,
    metadata: {
      telyx_assistant_id: assistant.id,
      telyx_business_id: business.id
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

export default elevenLabsService;
