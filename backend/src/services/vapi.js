// ============================================================================
// VAPI SERVICE - API Client
// ============================================================================

import axios from 'axios';

const VAPI_API_KEY = process.env.VAPI_API_KEY || process.env.VAPI_PRIVATE_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';

const vapiClient = axios.create({
  baseURL: VAPI_BASE_URL,
  headers: {
    'Authorization': `Bearer ${VAPI_API_KEY}`,
    'Content-Type': 'application/json'
  }
});

const vapiService = {
  /**
   * Create a new VAPI assistant
   */
  async createAssistant(config) {
    try {
      const response = await vapiClient.post('/assistant', config);
      console.log('✅ VAPI Assistant created:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ VAPI createAssistant error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Update existing VAPI assistant
   */
  async updateAssistant(assistantId, config) {
    try {
      const { voiceId, speed, customGreeting, customInstructions, tools } = config;
      
      const updateData = {
        voice: {
          voiceId: voiceId,
          provider: '11labs'
        },
        firstMessage: customGreeting || undefined,
        model: {
          provider: 'openai',
          model: 'gpt-4',
          messages: [{
            role: 'system',
            content: customInstructions || 'You are a helpful assistant.'
          }]
        }
      };

      // Add tools if provided
      if (tools && tools.length > 0) {
        updateData.model.tools = tools;
        console.log('📤 VAPI Update - adding tools:', tools.map(t => t.function.name));
      }

      const response = await vapiClient.patch(`/assistant/${assistantId}`, updateData);
      console.log('✅ VAPI Assistant updated:', assistantId);
      return response.data;
    } catch (error) {
      console.error('❌ VAPI updateAssistant error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Get assistant details
   */
  async getAssistant(assistantId) {
    try {
      const response = await vapiClient.get(`/assistant/${assistantId}`);
      return response.data;
    } catch (error) {
      console.error('❌ VAPI getAssistant error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Delete assistant
   */
  async deleteAssistant(assistantId) {
    try {
      await vapiClient.delete(`/assistant/${assistantId}`);
      console.log('✅ VAPI Assistant deleted:', assistantId);
      return true;
    } catch (error) {
      console.error('❌ VAPI deleteAssistant error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Make outbound call
   */
  async makeCall(assistantId, phoneNumber) {
    try {
      const response = await vapiClient.post('/call/phone', {
        assistantId,
        customer: {
          number: phoneNumber
        }
      });
      console.log('✅ VAPI Call initiated:', response.data.id);
      return response.data;
    } catch (error) {
      console.error('❌ VAPI makeCall error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Buy a phone number from VAPI
   */
  async buyPhoneNumber(areaCode = '415') {
    try {
      const response = await vapiClient.post('/phone-number/buy', {
        areaCode,
        provider: 'twilio'
      });
      console.log('✅ VAPI Phone number purchased:', response.data.number);
      return response.data;
    } catch (error) {
      console.error('❌ VAPI buyPhoneNumber error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Assign a phone number to an assistant
   */
  async assignPhoneNumber(phoneNumberId, assistantId) {
    try {
      const response = await vapiClient.patch(`/phone-number/${phoneNumberId}`, {
        assistantId
      });
      console.log('✅ VAPI Phone number assigned to assistant:', assistantId);
      return response.data;
    } catch (error) {
      console.error('❌ VAPI assignPhoneNumber error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Update phone number configuration
   */
  async updatePhoneNumber(phoneNumberId, updates) {
    try {
      const response = await vapiClient.patch(`/phone-number/${phoneNumberId}`, updates);
      console.log('✅ VAPI Phone number updated:', phoneNumberId);
      return response.data;
    } catch (error) {
      console.error('❌ VAPI updatePhoneNumber error:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Delete/release a phone number
   */
  async deletePhoneNumber(phoneNumberId) {
    try {
      await vapiClient.delete(`/phone-number/${phoneNumberId}`);
      console.log('✅ VAPI Phone number deleted:', phoneNumberId);
      return true;
    } catch (error) {
      console.error('❌ VAPI deletePhoneNumber error:', error.response?.data || error.message);
      throw error;
    }
  }
};

export default vapiService;
