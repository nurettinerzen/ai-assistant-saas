import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

/**
 * VAPI BYOC (Bring Your Own Carrier) Service
 *
 * This service handles:
 * - Importing external SIP trunks (like Netgsm) into VAPI
 * - Managing BYOC phone numbers
 * - Connecting/disconnecting SIP trunks
 *
 * API Documentation: https://docs.vapi.ai/api-reference/phone-numbers/import
 */

const VAPI_API_URL = 'https://api.vapi.ai';

class VapiByocService {
  constructor() {
    this.apiKey = process.env.VAPI_API_KEY;

    console.log('🔗 VAPI BYOC Configuration:');
    console.log('API Key:', this.apiKey ? '✅ Exists' : '❌ Missing');

    this.client = axios.create({
      baseURL: VAPI_API_URL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Import a BYOC phone number into VAPI
   * @param {Object} config - BYOC configuration
   * @param {string} config.phoneNumber - Phone number in E.164 format (e.g., "+908501234567")
   * @param {string} config.sipUri - SIP URI (e.g., "sip:username@sip.netgsm.com.tr")
   * @param {string} config.sipUsername - SIP username
   * @param {string} config.sipPassword - SIP password
   * @param {string} config.assistantId - VAPI Assistant ID to assign (optional)
   * @param {string} config.name - Friendly name for the number
   * @returns {Promise<Object>} VAPI phone number object
   */
  async importByocNumber(config) {
    try {
      const {
        phoneNumber,
        sipUri,
        sipUsername,
        sipPassword,
        assistantId,
        name = 'BYOC Phone Number'
      } = config;

      // Validate required fields
      if (!phoneNumber || !sipUsername || !sipPassword) {
        throw new Error('Missing required BYOC configuration: phoneNumber, sipUsername, sipPassword');
      }

      // Construct the BYOC payload
      const payload = {
        provider: 'byoc',
        number: phoneNumber,
        name: name,
        sipUri: sipUri || `sip:${sipUsername}@${this.extractDomainFromNumber(phoneNumber)}`,
        credentials: {
          username: sipUsername,
          password: sipPassword
        }
      };

      // Add assistant if provided
      if (assistantId) {
        payload.assistantId = assistantId;
      }

      console.log('📞 Importing BYOC number to VAPI:', phoneNumber);

      const response = await this.client.post('/phone-number', payload);

      console.log('✅ BYOC number imported successfully:', response.data.id);

      return {
        success: true,
        vapiPhoneId: response.data.id,
        phoneNumber: response.data.number,
        provider: response.data.provider,
        assistantId: response.data.assistantId,
        createdAt: response.data.createdAt
      };

    } catch (error) {
      console.error('❌ VAPI BYOC import error:', error.response?.data || error.message);

      // Provide more specific error messages
      if (error.response?.status === 400) {
        throw new Error(`Invalid BYOC configuration: ${error.response.data.message || 'Check SIP credentials'}`);
      } else if (error.response?.status === 401) {
        throw new Error('VAPI authentication failed. Check API key.');
      } else if (error.response?.status === 409) {
        throw new Error('Phone number already exists in VAPI');
      }

      throw new Error(`Failed to import BYOC number: ${error.message}`);
    }
  }

  /**
   * Update BYOC phone number configuration
   * @param {string} vapiPhoneId - VAPI phone number ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated phone number
   */
  async updateByocNumber(vapiPhoneId, updates) {
    try {
      const response = await this.client.patch(`/phone-number/${vapiPhoneId}`, updates);

      console.log('✅ BYOC number updated:', vapiPhoneId);

      return {
        success: true,
        vapiPhoneId: response.data.id,
        phoneNumber: response.data.number,
        assistantId: response.data.assistantId
      };

    } catch (error) {
      console.error('❌ VAPI BYOC update error:', error.response?.data || error.message);
      throw new Error(`Failed to update BYOC number: ${error.message}`);
    }
  }

  /**
   * Assign an assistant to a BYOC phone number
   * @param {string} vapiPhoneId - VAPI phone number ID
   * @param {string} assistantId - VAPI Assistant ID
   * @returns {Promise<Object>} Updated phone number
   */
  async assignAssistant(vapiPhoneId, assistantId) {
    try {
      console.log(`🔗 Assigning assistant ${assistantId} to BYOC number ${vapiPhoneId}`);

      const response = await this.client.patch(`/phone-number/${vapiPhoneId}`, {
        assistantId: assistantId
      });

      console.log('✅ Assistant assigned successfully');

      return {
        success: true,
        vapiPhoneId: response.data.id,
        assistantId: response.data.assistantId
      };

    } catch (error) {
      console.error('❌ VAPI assign assistant error:', error.response?.data || error.message);
      throw new Error(`Failed to assign assistant: ${error.message}`);
    }
  }

  /**
   * Remove/delete a BYOC phone number from VAPI
   * @param {string} vapiPhoneId - VAPI phone number ID
   * @returns {Promise<Object>} Deletion result
   */
  async removeByocNumber(vapiPhoneId) {
    try {
      console.log(`🗑️ Removing BYOC number from VAPI: ${vapiPhoneId}`);

      await this.client.delete(`/phone-number/${vapiPhoneId}`);

      console.log('✅ BYOC number removed from VAPI');

      return {
        success: true,
        message: 'BYOC number removed successfully'
      };

    } catch (error) {
      console.error('❌ VAPI BYOC remove error:', error.response?.data || error.message);

      // Don't throw if the number doesn't exist (already deleted)
      if (error.response?.status === 404) {
        console.log('⚠️ Phone number not found in VAPI (may already be deleted)');
        return {
          success: true,
          message: 'Phone number not found (may already be deleted)'
        };
      }

      throw new Error(`Failed to remove BYOC number: ${error.message}`);
    }
  }

  /**
   * Get BYOC phone number details from VAPI
   * @param {string} vapiPhoneId - VAPI phone number ID
   * @returns {Promise<Object>} Phone number details
   */
  async getByocNumber(vapiPhoneId) {
    try {
      const response = await this.client.get(`/phone-number/${vapiPhoneId}`);

      return {
        vapiPhoneId: response.data.id,
        phoneNumber: response.data.number,
        provider: response.data.provider,
        assistantId: response.data.assistantId,
        name: response.data.name,
        createdAt: response.data.createdAt
      };

    } catch (error) {
      console.error('❌ VAPI get BYOC number error:', error.response?.data || error.message);
      throw new Error(`Failed to get BYOC number: ${error.message}`);
    }
  }

  /**
   * List all phone numbers in VAPI account
   * @returns {Promise<Array>} List of phone numbers
   */
  async listPhoneNumbers() {
    try {
      const response = await this.client.get('/phone-number');
      return response.data;

    } catch (error) {
      console.error('❌ VAPI list phone numbers error:', error.response?.data || error.message);
      throw new Error(`Failed to list phone numbers: ${error.message}`);
    }
  }

  /**
   * Test a BYOC phone number by making a test call
   * @param {string} vapiPhoneId - VAPI phone number ID
   * @param {string} testPhoneNumber - Phone number to call for testing
   * @returns {Promise<Object>} Test call result
   */
  async testByocNumber(vapiPhoneId, testPhoneNumber) {
    try {
      // Get the phone number details first to get the assistant
      const phoneDetails = await this.getByocNumber(vapiPhoneId);

      if (!phoneDetails.assistantId) {
        throw new Error('No assistant assigned to this phone number');
      }

      console.log(`📞 Making test call from ${phoneDetails.phoneNumber} to ${testPhoneNumber}`);

      const response = await this.client.post('/call', {
        assistantId: phoneDetails.assistantId,
        customer: {
          number: testPhoneNumber
        },
        phoneNumberId: vapiPhoneId
      });

      console.log('✅ Test call initiated:', response.data.id);

      return {
        success: true,
        callId: response.data.id,
        status: response.data.status,
        message: 'Test call initiated successfully'
      };

    } catch (error) {
      console.error('❌ VAPI test call error:', error.response?.data || error.message);
      throw new Error(`Failed to make test call: ${error.message}`);
    }
  }

  /**
   * Extract domain from phone number (helper for SIP URI)
   * @param {string} phoneNumber - Phone number
   * @returns {string} Default SIP domain
   */
  extractDomainFromNumber(phoneNumber) {
    // Default to a generic domain - should be overridden with actual SIP server
    if (phoneNumber.startsWith('+90')) {
      return 'sip.netgsm.com.tr';
    }
    return 'sip.vapi.ai';
  }

  /**
   * Validate SIP configuration before import
   * @param {Object} sipConfig - SIP configuration to validate
   * @returns {boolean} Validation result
   */
  validateSipConfig(sipConfig) {
    const required = ['phoneNumber', 'sipUsername', 'sipPassword'];
    const missing = required.filter(field => !sipConfig[field]);

    if (missing.length > 0) {
      throw new Error(`Missing required SIP fields: ${missing.join(', ')}`);
    }

    // Validate phone number format (E.164)
    if (!sipConfig.phoneNumber.startsWith('+')) {
      throw new Error('Phone number must be in E.164 format (starting with +)');
    }

    return true;
  }
}

export default new VapiByocService();
