/**
 * WhatsApp Message Sender
 *
 * Centralized WhatsApp message sending logic
 * Handles credentials (DB or env fallback)
 * Includes outbound idempotency to prevent duplicate sends
 */

import axios from 'axios';
import { decrypt } from '../utils/encryption.js';
import prisma from '../config/database.js';

const OUTBOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (Meta can retry for 24h+)

/**
 * Send WhatsApp message using business credentials
 * With outbound idempotency to prevent duplicate sends
 *
 * @param {Object} business - Business object
 * @param {string} to - Recipient phone number
 * @param {string} text - Message text
 * @param {Object} options - Options
 * @param {string} options.inboundMessageId - Original webhook message ID (for idempotency)
 * @returns {Promise<Object>} Send result
 */
export async function sendWhatsAppMessage(business, to, text, options = {}) {
  const { inboundMessageId } = options;

  // IDEMPOTENCY CHECK: Prevent duplicate outbound sends
  if (inboundMessageId) {
    try {
      const existing = await prisma.outboundMessage.findUnique({
        where: {
          businessId_channel_recipientId_inboundMessageId: {
            businessId: business.id,
            channel: 'WHATSAPP',
            recipientId: to,
            inboundMessageId
          }
        }
      });

      if (existing) {
        console.log(`♻️ [WhatsAppSender] Duplicate send blocked (messageId: ${inboundMessageId})`);
        return {
          success: true,
          messageId: existing.externalId,
          duplicate: true,
          data: { cached: true }
        };
      }
    } catch (dbError) {
      console.warn('⚠️ [WhatsAppSender] Idempotency check failed, proceeding:', dbError.message);
      // Continue with send on DB error
    }
  }

  try {
    // Determine credentials source
    let accessToken;
    let phoneNumberId;

    if (business._useEnvCredentials) {
      // Use environment variables (testing/dev)
      accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
      console.log('📤 Using env credentials for WhatsApp send');
    } else {
      // Use business's encrypted credentials
      if (!business.whatsappAccessToken || !business.whatsappPhoneNumberId) {
        throw new Error('WhatsApp credentials not configured for business');
      }

      accessToken = decrypt(business.whatsappAccessToken);
      phoneNumberId = business.whatsappPhoneNumberId;
    }

    // Send message via WhatsApp API
    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text }
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const waMessageId = response.data.messages?.[0]?.id;
    console.log(`✅ WhatsApp message sent to ${to}`);

    // CACHE SEND: Store for idempotency
    if (inboundMessageId) {
      try {
        await prisma.outboundMessage.create({
          data: {
            businessId: business.id,
            channel: 'WHATSAPP',
            recipientId: to,
            inboundMessageId,
            sent: true,
            externalId: waMessageId,
            expiresAt: new Date(Date.now() + OUTBOUND_TTL_MS)
          }
        });
        console.log(`💾 [WhatsAppSender] Cached outbound message (messageId: ${inboundMessageId})`);
      } catch (dbError) {
        console.warn('⚠️ [WhatsAppSender] Failed to cache outbound message:', dbError.message);
        // Non-critical, continue
      }
    }

    return {
      success: true,
      messageId: waMessageId,
      data: response.data
    };

  } catch (error) {
    console.error('❌ WhatsApp send error:', {
      to,
      error: error.response?.data || error.message
    });

    return {
      success: false,
      error: error.response?.data?.error?.message || error.message
    };
  }
}

/**
 * Send typing indicator (optional - for better UX)
 *
 * @param {Object} business
 * @param {string} to
 */
export async function sendTypingIndicator(business, to) {
  try {
    let accessToken;
    let phoneNumberId;

    if (business._useEnvCredentials) {
      accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
      phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    } else {
      if (!business.whatsappAccessToken || !business.whatsappPhoneNumberId) {
        return;
      }

      accessToken = decrypt(business.whatsappAccessToken);
      phoneNumberId = business.whatsappPhoneNumberId;
    }

    await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        type: 'typing'
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`⌨️ Typing indicator sent to ${to}`);
  } catch (error) {
    // Silently fail - typing indicator is not critical
    console.warn('⚠️ Failed to send typing indicator:', error.message);
  }
}

/**
 * Cleanup expired outbound messages (background job)
 */
export async function cleanupExpiredOutboundMessages() {
  try {
    const result = await prisma.outboundMessage.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    if (result.count > 0) {
      console.log(`🧹 [WhatsAppSender] Cleaned up ${result.count} expired outbound messages`);
    }

    return result.count;
  } catch (error) {
    console.error('⚠️ [WhatsAppSender] Cleanup error:', error.message);
    return 0;
  }
}

// Start cleanup job (every 1 hour - TTL is 7 days so no rush)
setInterval(() => {
  cleanupExpiredOutboundMessages().catch(err => {
    console.error('⚠️ [WhatsAppSender] Cleanup job error:', err);
  });
}, 60 * 60 * 1000);

export default {
  sendWhatsAppMessage,
  sendTypingIndicator,
  cleanupExpiredOutboundMessages
};
