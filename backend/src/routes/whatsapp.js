import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/encryption.js';
import { webhookRateLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();
const prisma = new PrismaClient();

// OpenAI client
let openai;
const getOpenAI = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
};

// In-memory conversation history (geçici - sonra database'e taşıyacağız)
const conversations = new Map();

// Webhook verification (Meta's initial setup verification)
// Multi-tenant: Verifies against any business's verify token
router.get('/webhook', webhookRateLimiter.middleware(), async (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe') {
      // Check if any business has this verify token
      const business = await prisma.business.findFirst({
        where: {
          whatsappVerifyToken: token
        }
      });

      if (business) {
        console.log(`✅ Webhook verified for business: ${business.name} (ID: ${business.id})`);
        res.status(200).send(challenge);
      } else {
        console.log('❌ Webhook verification failed: Invalid verify token');
        res.sendStatus(403);
      }
    } else {
      res.sendStatus(403);
    }
  } else {
    res.sendStatus(400);
  }
});

// Webhook - Incoming messages (Multi-tenant)
router.post('/webhook', webhookRateLimiter.middleware(), async (req, res) => {
  console.log('🔔 WEBHOOK RECEIVED:', JSON.stringify(req.body, null, 2));

  try {
    const body = req.body;

    // Validate webhook payload from Meta
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Get the phone number ID to identify which business this message is for
      const phoneNumberId = value?.metadata?.phone_number_id;

      if (!phoneNumberId) {
        console.error('❌ No phone number ID in webhook payload');
        return res.sendStatus(400);
      }

      // Find the business by phone number ID
      const business = await prisma.business.findFirst({
        where: {
          whatsappPhoneNumberId: phoneNumberId
        },
        include: {
          assistants: {
            where: { isActive: true },
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      if (!business) {
        console.error(`❌ No business found for phone number ID: ${phoneNumberId}`);
        return res.sendStatus(404);
      }

      console.log(`✅ Message for business: ${business.name} (ID: ${business.id})`);

      // Process incoming messages
      if (value?.messages && value.messages.length > 0) {
        const message = value.messages[0];
        const from = message.from; // Sender's phone number
        const messageBody = message.text?.body; // Message content
        const messageId = message.id;

        console.log('📩 WhatsApp message received:', {
          businessId: business.id,
          businessName: business.name,
          from,
          message: messageBody,
          id: messageId
        });

        // Generate AI response using business's assistant
        const aiResponse = await generateAIResponse(business, from, messageBody);

        // Send response using business's credentials
        await sendWhatsAppMessage(business, from, aiResponse);
      }

      res.sendStatus(200);
    } else {
      res.sendStatus(404);
    }
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.sendStatus(500);
  }
});

// WhatsApp message sending function (Multi-tenant)
async function sendWhatsAppMessage(business, to, text) {
  try {
    // Decrypt the access token
    const accessToken = decrypt(business.whatsappAccessToken);
    const phoneNumberId = business.whatsappPhoneNumberId;

    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: text
        }
      }
    });

    console.log(`✅ WhatsApp message sent for business ${business.name}:`, response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

// AI response generator with Assistant system prompt (Multi-tenant)
async function generateAIResponse(business, phoneNumber, userMessage) {
  try {
    const client = getOpenAI();

    // Get the business's active assistant
    const assistant = business.assistants?.[0];

    // Determine system prompt
    let systemPrompt;
    let assistantName = 'Assistant';

    if (assistant) {
      systemPrompt = assistant.systemPrompt;
      assistantName = assistant.name;
      console.log(`🤖 Using assistant: ${assistantName} (ID: ${assistant.id}) for business: ${business.name}`);
    } else {
      // Fallback: No assistant configured for this business
      systemPrompt = `You are a professional customer service representative for ${business.name}.

CRITICAL RULES:
- NEVER mention that you are an AI, bot, or artificial intelligence
- Act as a real human employee
- ALWAYS respond in the SAME LANGUAGE the customer uses
- Be warm, helpful, and professional
- Keep responses concise (2-3 sentences max)
- If you don't know something, say "Let me check that for you"

Your name is Customer Support Team.
Remember: You are a real person helping customers.`;
      assistantName = 'Customer Support Team';
      console.log(`⚠️ No assistant found for business ${business.name}, using default prompt`);
    }

    // Conversation history key includes business ID to separate conversations per business
    const conversationKey = `${business.id}:${phoneNumber}`;

    // Get conversation history (create if doesn't exist)
    if (!conversations.has(conversationKey)) {
      conversations.set(conversationKey, []);
    }
    const history = conversations.get(conversationKey);

    // Add user message to history
    history.push({
      role: 'user',
      content: userMessage
    });

    // Send to OpenAI
    const completion = await client.chat.completions.create({
      model: assistant?.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10) // Last 10 messages (for context limit)
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const aiResponse = completion.choices[0].message.content;

    // Add AI response to history
    history.push({
      role: 'assistant',
      content: aiResponse
    });

    // Limit history (last 20 messages)
    if (history.length > 20) {
      conversations.set(conversationKey, history.slice(-20));
    }

    console.log(`🤖 AI Response generated for business ${business.name}:`, aiResponse);
    return aiResponse;

  } catch (error) {
    console.error('❌ Error generating AI response:', error);
    // Return error message in business's language
    const language = business.language || 'EN';
    const errorMessages = {
      'EN': 'Sorry, I\'m experiencing an issue right now. Please try again later.',
      'TR': 'Üzgünüm, şu anda bir sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.',
      'ES': 'Lo siento, estoy experimentando un problema en este momento. Por favor, inténtelo de nuevo más tarde.',
      'FR': 'Désolé, je rencontre un problème en ce moment. Veuillez réessayer plus tard.',
      'DE': 'Entschuldigung, ich habe gerade ein Problem. Bitte versuchen Sie es später erneut.'
    };
    return errorMessages[language] || errorMessages['EN'];
  }
}

// Manuel mesaj gönderme endpoint (test için)
router.post('/send', async (req, res) => {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'to and message required' });
    }

    const result = await sendWhatsAppMessage(to, message);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

// Conversation history temizleme endpoint (admin için)
router.delete('/conversations/:phoneNumber', (req, res) => {
  const { phoneNumber } = req.params;
  conversations.delete(phoneNumber);
  res.json({ success: true, message: 'Conversation history cleared' });
});

// Aktif konuşmaları listele (admin için)
router.get('/conversations', (req, res) => {
  const activeConversations = Array.from(conversations.keys()).map(phone => ({
    phoneNumber: phone,
    messageCount: conversations.get(phone).length
  }));
  res.json({ conversations: activeConversations });
});

export default router;