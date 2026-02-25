/**
 * WhatsApp Business Integration Service
 * Meta Business API + Message Sending
 */

import axios from 'axios';
import crypto from 'crypto';
import { safeCompareStrings } from '../security/constantTime.js';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

class WhatsAppService {
  /**
   * Send text message
   */
  async sendMessage(accessToken, phoneNumberId, recipientPhone, message) {
    try {
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('WhatsApp send message error:', error.response?.data);
      throw error;
    }
  }

  /**
   * Send template message
   */
  async sendTemplateMessage(accessToken, phoneNumberId, recipientPhone, templateName, templateParams) {
    try {
      const response = await axios.post(
        `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipientPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: templateParams
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data;
    } catch (error) {
      console.error('WhatsApp send template error:', error.response?.data);
      throw error;
    }
  }

  /**
   * Send follow-up message after call
   */
  async sendCallFollowUp(accessToken, phoneNumberId, recipientPhone, callSummary) {
    const message = `Thank you for calling! Here's a summary of our conversation:\n\n${callSummary}\n\nIf you have any questions, feel free to reach out!`;
    return this.sendMessage(accessToken, phoneNumberId, recipientPhone, message);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature, appSecret) {
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');
    return safeCompareStrings(String(signature || ''), `sha256=${expectedSignature}`);
  }
}

export default new WhatsAppService();
