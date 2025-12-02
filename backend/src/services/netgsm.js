import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

/**
 * Netgsm API Service for Turkey Phone Numbers (0850)
 *
 * This service handles:
 * - Purchasing 0850 numbers from Netgsm
 * - Getting SIP credentials for BYOC setup
 * - Managing number lifecycle (cancel, status checks)
 *
 * API Documentation: https://www.netgsm.com.tr/dokuman/
 */

const NETGSM_API_BASE = 'https://api.netgsm.com.tr';

class NetgsmService {
  constructor() {
    this.username = process.env.NETGSM_USERNAME;
    this.password = process.env.NETGSM_PASSWORD;
    this.apiKey = process.env.NETGSM_API_KEY;

    console.log('📞 Netgsm Configuration:');
    console.log('Username:', this.username ? '✅ Exists' : '❌ Missing');
    console.log('Password:', this.password ? '✅ Exists' : '❌ Missing');
    console.log('API Key:', this.apiKey ? '✅ Exists' : '❌ Missing');

    this.client = axios.create({
      baseURL: NETGSM_API_BASE,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * List available 0850 numbers for purchase
   * @param {string} countryCode - Country code (TR for Turkey)
   * @returns {Promise<Array>} List of available numbers
   */
  async listAvailableNumbers(countryCode = 'TR') {
    try {
      const response = await this.client.get('/santral/numara/liste', {
        params: {
          usercode: this.username,
          password: this.password,
          tip: '0850' // 0850 numbers
        }
      });

      return response.data;
    } catch (error) {
      console.error('❌ Netgsm list numbers error:', error.response?.data || error.message);
      throw new Error(`Failed to list available numbers: ${error.message}`);
    }
  }

  /**
   * Purchase a new 0850 number from Netgsm
   * @param {string} numberId - The ID of the number to purchase (optional)
   * @returns {Promise<Object>} Purchase result with number details
   */
  async purchaseNumber(numberId = null) {
    try {
      // If no specific number ID is provided, get the first available
      let selectedNumber;

      if (!numberId) {
        const availableNumbers = await this.listAvailableNumbers();
        if (!availableNumbers || availableNumbers.length === 0) {
          throw new Error('No available 0850 numbers found');
        }
        selectedNumber = availableNumbers[0];
      } else {
        selectedNumber = { id: numberId };
      }

      // Purchase the number
      const response = await this.client.post('/santral/numara/satin-al', {
        usercode: this.username,
        password: this.password,
        numara_id: selectedNumber.id || numberId
      });

      // Check if purchase was successful
      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Number purchase failed');
      }

      return {
        success: true,
        numberId: response.data.numara_id,
        phoneNumber: response.data.numara,
        monthlyCost: 0.46, // ~$0.46/month (191 TL/year ÷ 12)
        annualCost: 5.50, // ~$5.50/year (191 TL at ~35 TRY/USD)
        message: response.data.message
      };

    } catch (error) {
      console.error('❌ Netgsm purchase number error:', error.response?.data || error.message);
      throw new Error(`Failed to purchase number: ${error.message}`);
    }
  }

  /**
   * Get SIP credentials for a purchased number
   * Required for VAPI BYOC integration
   * @param {string} numberId - The Netgsm number ID
   * @returns {Promise<Object>} SIP configuration
   */
  async getSipCredentials(numberId) {
    try {
      const response = await this.client.get('/santral/numara/sip-bilgileri', {
        params: {
          usercode: this.username,
          password: this.password,
          numara_id: numberId
        }
      });

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Failed to get SIP credentials');
      }

      return {
        sipUsername: response.data.sip_kullanici_adi,
        sipPassword: response.data.sip_sifre,
        sipServer: response.data.sip_sunucu || 'sip.netgsm.com.tr',
        sipPort: response.data.sip_port || 5060,
        sipDomain: response.data.sip_domain || 'netgsm.com.tr'
      };

    } catch (error) {
      console.error('❌ Netgsm get SIP credentials error:', error.response?.data || error.message);
      throw new Error(`Failed to get SIP credentials: ${error.message}`);
    }
  }

  /**
   * Cancel/release a number
   * @param {string} numberId - The Netgsm number ID
   * @returns {Promise<Object>} Cancellation result
   */
  async cancelNumber(numberId) {
    try {
      const response = await this.client.post('/santral/numara/iptal', {
        usercode: this.username,
        password: this.password,
        numara_id: numberId
      });

      if (response.data.status !== 'success') {
        throw new Error(response.data.message || 'Number cancellation failed');
      }

      return {
        success: true,
        message: response.data.message
      };

    } catch (error) {
      console.error('❌ Netgsm cancel number error:', error.response?.data || error.message);
      throw new Error(`Failed to cancel number: ${error.message}`);
    }
  }

  /**
   * Get number status and details
   * @param {string} numberId - The Netgsm number ID
   * @returns {Promise<Object>} Number status
   */
  async getNumberStatus(numberId) {
    try {
      const response = await this.client.get('/santral/numara/durum', {
        params: {
          usercode: this.username,
          password: this.password,
          numara_id: numberId
        }
      });

      return {
        status: response.data.durum, // 'aktif', 'askida', 'iptal'
        phoneNumber: response.data.numara,
        expiryDate: response.data.bitis_tarihi,
        isActive: response.data.durum === 'aktif'
      };

    } catch (error) {
      console.error('❌ Netgsm get number status error:', error.response?.data || error.message);
      throw new Error(`Failed to get number status: ${error.message}`);
    }
  }

  /**
   * Test SIP connection
   * @param {Object} sipConfig - SIP configuration
   * @returns {Promise<boolean>} Connection test result
   */
  async testSipConnection(sipConfig) {
    try {
      // This is a simple connectivity test
      // In production, you might want to use a proper SIP library
      const response = await this.client.post('/santral/sip-test', {
        usercode: this.username,
        password: this.password,
        sip_username: sipConfig.sipUsername,
        sip_password: sipConfig.sipPassword,
        sip_server: sipConfig.sipServer
      });

      return response.data.status === 'success';

    } catch (error) {
      console.error('❌ Netgsm SIP test error:', error.response?.data || error.message);
      return false;
    }
  }

  /**
   * Format phone number to E.164 format
   * @param {string} number - Raw number (e.g., "8501234567")
   * @returns {string} Formatted number (e.g., "+908501234567")
   */
  formatPhoneNumber(number) {
    // Remove any non-digit characters
    const cleaned = number.replace(/\D/g, '');

    // If it starts with 0, replace with +90
    if (cleaned.startsWith('0')) {
      return '+90' + cleaned.substring(1);
    }

    // If it doesn't have country code, add +90
    if (!cleaned.startsWith('90')) {
      return '+90' + cleaned;
    }

    return '+' + cleaned;
  }
}

export default new NetgsmService();
