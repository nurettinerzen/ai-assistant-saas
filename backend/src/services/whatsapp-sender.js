/**
 * WhatsApp Message Sender
 *
 * Centralized WhatsApp message sending logic
 * Handles credentials (DB or env fallback)
 * Includes outbound idempotency to prevent duplicate sends
 */

import axios from 'axios';
import { decryptPossiblyEncryptedValue } from '../utils/encryption.js';
import prisma from '../config/database.js';

const OUTBOUND_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (Meta can retry for 24h+)

function getWhatsAppAccessTokenForBusiness(business) {
  if (business._useEnvCredentials) {
    return process.env.WHATSAPP_ACCESS_TOKEN || process.env.META_SYSTEM_USER_ACCESS_TOKEN || null;
  }

  if (business.whatsappAccessToken) {
    return decryptPossiblyEncryptedValue(business.whatsappAccessToken, { allowPlaintext: true });
  }

  return (
    process.env.META_SYSTEM_USER_ACCESS_TOKEN ||
    process.env.WHATSAPP_SYSTEM_USER_ACCESS_TOKEN ||
    process.env.WHATSAPP_PARTNER_ACCESS_TOKEN ||
    process.env.WHATSAPP_ACCESS_TOKEN ||
    null
  );
}

function resolveWhatsAppSendContext(business) {
  let accessToken;
  let phoneNumberId;

  if (business._useEnvCredentials) {
    accessToken = getWhatsAppAccessTokenForBusiness(business);
    phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    console.log('📤 Using env credentials for WhatsApp send');
  } else {
    if (!business.whatsappPhoneNumberId) {
      throw new Error('WhatsApp credentials not configured for business');
    }

    accessToken = getWhatsAppAccessTokenForBusiness(business);
    phoneNumberId = business.whatsappPhoneNumberId;
  }

  if (!accessToken) {
    throw new Error('WhatsApp access token not configured for business');
  }

  return {
    accessToken,
    phoneNumberId,
  };
}

async function sendWhatsAppPayload(business, to, payload, options = {}) {
  const { inboundMessageId } = options;

  if (inboundMessageId) {
    try {
      const existing = await prisma.outboundMessage.findUnique({
        where: {
          businessId_channel_recipientId_inboundMessageId: {
            businessId: business.id,
            channel: 'WHATSAPP',
            recipientId: to,
            inboundMessageId,
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
    }
  }

  try {
    const { accessToken, phoneNumberId } = resolveWhatsAppSendContext(business);

    const response = await axios.post(
      `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        to,
        ...payload,
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
  return sendWhatsAppPayload(
    business,
    to,
    {
      type: 'text',
      text: { body: text }
    },
    options
  );
}

export async function sendWhatsAppInteractiveButtonsMessage(
  business,
  to,
  { bodyText, footerText = null, headerText = null, buttons = [] } = {},
  options = {}
) {
  const trimmedButtons = Array.isArray(buttons) ? buttons.slice(0, 3) : [];
  if (!bodyText || trimmedButtons.length === 0) {
    throw new Error('WhatsApp interactive message requires bodyText and at least one button');
  }

  return sendWhatsAppPayload(
    business,
    to,
    {
      type: 'interactive',
      interactive: {
        type: 'button',
        ...(headerText
          ? {
              header: {
                type: 'text',
                text: headerText
              }
            }
          : {}),
        body: {
          text: bodyText
        },
        ...(footerText
          ? {
              footer: {
                text: footerText
              }
            }
          : {}),
        action: {
          buttons: trimmedButtons.map((button) => ({
            type: 'reply',
            reply: {
              id: String(button.id),
              title: String(button.title),
            }
          }))
        }
      }
    },
    options
  );
}

export async function sendWhatsAppInteractiveListMessage(
  business,
  to,
  { bodyText, footerText = null, headerText = null, buttonText, sections = [] } = {},
  options = {}
) {
  const trimmedSections = Array.isArray(sections) ? sections.slice(0, 10) : [];
  if (!bodyText || !buttonText || trimmedSections.length === 0) {
    throw new Error('WhatsApp interactive list message requires bodyText, buttonText and at least one section');
  }

  return sendWhatsAppPayload(
    business,
    to,
    {
      type: 'interactive',
      interactive: {
        type: 'list',
        ...(headerText
          ? {
              header: {
                type: 'text',
                text: headerText
              }
            }
          : {}),
        body: {
          text: bodyText
        },
        ...(footerText
          ? {
              footer: {
                text: footerText
              }
            }
          : {}),
        action: {
          button: String(buttonText),
          sections: trimmedSections.map((section) => ({
            title: String(section.title),
            rows: (Array.isArray(section.rows) ? section.rows : []).slice(0, 10).map((row) => ({
              id: String(row.id),
              title: String(row.title),
              ...(row.description ? { description: String(row.description) } : {}),
            }))
          }))
        }
      }
    },
    options
  );
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
      accessToken = getWhatsAppAccessTokenForBusiness(business);
      phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    } else {
      if (!business.whatsappPhoneNumberId) {
        return;
      }

      accessToken = getWhatsAppAccessTokenForBusiness(business);
      phoneNumberId = business.whatsappPhoneNumberId;
    }

    if (!accessToken) {
      return;
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
  sendWhatsAppInteractiveButtonsMessage,
  sendWhatsAppInteractiveListMessage,
  sendTypingIndicator,
  cleanupExpiredOutboundMessages
};
