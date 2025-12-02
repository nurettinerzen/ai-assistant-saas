import express from 'express';
import axios from 'axios';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

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

// Webhook verification (Meta'nın ilk kurulumda çağırdığı)
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified');
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Webhook - Incoming messages
router.post('/webhook', async (req, res) => {
  console.log('🔔 WEBHOOK RECEIVED:', JSON.stringify(req.body, null, 2));
  
  try {
    const body = req.body;

    // Meta'dan gelen mesaj kontrolü
    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Mesaj varsa
      if (value?.messages && value.messages.length > 0) {
        const message = value.messages[0];
        const from = message.from; // Gönderen numarası
        const messageBody = message.text?.body; // Mesaj içeriği
        const messageId = message.id;

        console.log('📩 WhatsApp message received:', {
          from,
          message: messageBody,
          id: messageId
        });

        // AI cevap oluştur
        const aiResponse = await generateAIResponse(from, messageBody);
        
        // Cevabı gönder
        await sendWhatsAppMessage(from, aiResponse);
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

// WhatsApp mesaj gönderme fonksiyonu
async function sendWhatsAppMessage(to, text) {
  try {
    const response = await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`,
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
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

    console.log('✅ WhatsApp message sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

// AI response generator with Assistant system prompt
async function generateAIResponse(phoneNumber, userMessage) {
  try {
    const client = getOpenAI();

    // 🔥 YENİ: İlk aktif assistant'ı bul
    const assistant = await prisma.assistant.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    // System prompt'u belirle
    let systemPrompt;
    let assistantName = 'Assistant';

    if (assistant) {
      systemPrompt = assistant.systemPrompt;
      assistantName = assistant.name;
      console.log(`🤖 Using assistant: ${assistantName} (ID: ${assistant.id})`);
    } else {
      // Fallback: Assistant yoksa default prompt
      systemPrompt = `You are a professional customer service representative.

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
      console.log('⚠️ No assistant found, using default prompt');
    }

    // Conversation history'yi al (yoksa oluştur)
    if (!conversations.has(phoneNumber)) {
      conversations.set(phoneNumber, []);
    }
    const history = conversations.get(phoneNumber);

    // Kullanıcı mesajını ekle
    history.push({
      role: 'user',
      content: userMessage
    });

    // OpenAI'ye gönder
    const completion = await client.chat.completions.create({
      model: assistant?.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10) // Son 10 mesajı gönder (context limit için)
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const aiResponse = completion.choices[0].message.content;

    // AI cevabını history'ye ekle
    history.push({
      role: 'assistant',
      content: aiResponse
    });

    // History'yi sınırla (son 20 mesaj)
    if (history.length > 20) {
      conversations.set(phoneNumber, history.slice(-20));
    }

    console.log('🤖 AI Response generated:', aiResponse);
    return aiResponse;

  } catch (error) {
    console.error('❌ Error generating AI response:', error);
    return 'Üzgünüm, şu anda bir sorun yaşıyorum. Lütfen daha sonra tekrar deneyin.';
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