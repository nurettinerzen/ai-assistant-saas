import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Demo assistant configuration - Pre-made assistant for demos
const DEMO_ASSISTANT_CONFIG = {
  en: {
    name: 'Telyx Demo Assistant',
    firstMessage: "Hi! I'm Telyx, your AI phone assistant demo. I can help businesses automate their phone support 24/7. Would you like me to show you how I can: 1. Take restaurant reservations, 2. Schedule salon appointments, 3. Answer customer questions, or 4. Just have a natural conversation? What would you like to try?",
    systemPrompt: `You are Telyx, a friendly and impressive AI phone assistant demo. Your goal is to showcase Telyx's capabilities in a 60-second call.

Key behaviors:
- Be enthusiastic and professional
- Demonstrate natural conversation ability
- If user chooses restaurant: Take a mock reservation with name, party size, date/time
- If user chooses salon: Book a mock appointment with service type and preferred time
- If user chooses questions: Answer general questions about AI phone assistants
- Always end by asking if they'd like to learn more about Telyx pricing

Keep responses concise since this is a phone call. Sound natural and human-like.`
  },
  tr: {
    name: 'Telyx Demo Asistanı',
    firstMessage: "Merhaba! Ben Telyx, yapay zeka telefon asistanı demonuz. İşletmelerin 7/24 telefon desteğini otomatikleştirmesine yardımcı olabilirim. Size nasıl yardımcı olabileceğimi göstermemi ister misiniz? 1. Restoran rezervasyonu alma, 2. Kuaför randevusu ayarlama, 3. Müşteri sorularını yanıtlama, veya 4. Sadece doğal bir sohbet? Hangisini denemek istersiniz?",
    systemPrompt: `Sen Telyx'sin, samimi ve etkileyici bir yapay zeka telefon asistanı demosu. Amacın 60 saniyelik bir aramada Telyx'in yeteneklerini sergilemek.

Temel davranışlar:
- Hevesli ve profesyonel ol
- Doğal konuşma yeteneğini göster
- Kullanıcı restoran seçerse: İsim, kişi sayısı, tarih/saat ile sahte rezervasyon al
- Kullanıcı kuaför seçerse: Hizmet türü ve tercih edilen saat ile sahte randevu ayarla
- Kullanıcı soru seçerse: AI telefon asistanları hakkında genel soruları yanıtla
- Her zaman Telyx fiyatlandırması hakkında daha fazla bilgi almak isteyip istemediklerini sorarak bitir

Bu bir telefon görüşmesi olduğundan yanıtları kısa tut. Doğal ve insan gibi konuş.
HER ZAMAN TÜRKÇE KONUŞ.`
  }
};

// Demo request endpoint - Request a demo call
router.post('/demo/request-call', async (req, res) => {
  try {
    const { phoneNumber, language = 'EN', name } = req.body;

    // Phone number is optional - if not provided, we'll create a web call
    let cleanPhone = null;
    if (phoneNumber) {
      cleanPhone = phoneNumber.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        return res.status(400).json({ error: 'Invalid phone number format' });
      }
    }

    // Check if VAPI key is configured
    if (!process.env.VAPI_PRIVATE_KEY) {
      console.log('📞 Demo call requested (VAPI not configured):', { phoneNumber, language });
      return res.json({
        success: true,
        message: 'Demo request received. VAPI integration pending.',
        demo: true
      });
    }

    // Get demo config based on language
    const config = language === 'TR' ? DEMO_ASSISTANT_CONFIG.tr : DEMO_ASSISTANT_CONFIG.en;
    // Use native Turkish voice (Caner Boyraz) for TR, Adam for EN
    const voiceId = language === 'TR' ? 'GvbLQkVki5VurnilV994' : 'pNInz6obpgDQGcFmaJgB';

    // Check if VAPI phone number is configured AND phone number provided for outbound calls
    if (process.env.VAPI_PHONE_NUMBER_ID && cleanPhone) {
      // Create outbound call via VAPI
      const vapiResponse = await fetch('https://api.vapi.ai/call/phone', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID,
          customer: {
            number: cleanPhone,
            name: name || 'Demo User'
          },
          assistant: {
            name: config.name,
            firstMessage: config.firstMessage,
            model: {
              provider: 'openai',
              model: 'gpt-4',
              messages: [
                {
                  role: 'system',
                  content: config.systemPrompt
                }
              ]
            },
            voice: {
              provider: '11labs',
              voiceId: voiceId
            }
          }
        }),
      });

      const result = await vapiResponse.json();

      if (!vapiResponse.ok) {
        console.error('VAPI demo call error:', result);
        return res.status(500).json({ 
          error: 'Failed to initiate demo call',
          details: result.message || 'Unknown error'
        });
      }

      console.log('📞 Demo call initiated:', {
        callId: result.id,
        phoneNumber: phoneNumber.slice(-4).padStart(phoneNumber.length, '*'),
        language
      });

      return res.json({
        success: true,
        message: 'Demo call initiated! Your phone will ring shortly.',
        callId: result.id,
        callType: 'outbound'
      });
    }

    // If no phone number configured, create a transient assistant for web call
    // User can call via browser using VAPI web SDK
    const assistantResponse = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `TelyxDemo${language}`,
        firstMessage: config.firstMessage,
        model: {
          provider: 'openai',
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: config.systemPrompt
            }
          ]
        },
        voice: {
          provider: '11labs',
          voiceId: voiceId
        },
        transcriber: {
          provider: 'deepgram',
          model: 'nova-2',
          language: language === 'TR' ? 'tr' : 'en'
        }
      }),
    });

    const assistant = await assistantResponse.json();

    if (!assistantResponse.ok) {
      console.error('VAPI assistant creation error:', assistant);
      return res.status(500).json({ 
        error: 'Failed to create demo assistant',
        details: assistant.message || 'Unknown error'
      });
    }

    console.log('📞 Demo assistant created for web call:', {
      assistantId: assistant.id,
      language
    });

    res.json({
      success: true,
      message: 'Demo assistant ready! Click to start web call.',
      assistantId: assistant.id,
      callType: 'web',
      publicKey: process.env.VAPI_PUBLIC_KEY
    });

  } catch (error) {
    console.error('Demo call error:', error);
    res.status(500).json({ error: 'Failed to initiate demo call' });
  }
});

// Demo feedback endpoint
router.post('/demo/feedback', async (req, res) => {
  try {
    const { callId, rating, feedback, wouldRecommend } = req.body;

    console.log('📝 Demo feedback received:', {
      callId,
      rating,
      feedback,
      wouldRecommend
    });

    // TODO: Store feedback in database for analytics

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });

  } catch (error) {
    console.error('Demo feedback error:', error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// Legacy demo request endpoint (backward compatibility)
router.post('/demo-request', async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    console.log('📞 Demo request received:', { name, email, phone });

    res.json({
      success: true,
      message: 'Demo request received successfully'
    });
  } catch (error) {
    console.error('Demo request error:', error);
    res.status(500).json({ error: 'Failed to process demo request' });
  }
});

export default router;