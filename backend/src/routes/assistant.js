import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import vapiService from '../services/vapi.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

// GET /api/assistants - List all assistants
// GET /api/assistants - List all assistants
router.get('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;

    const assistants = await prisma.assistant.findMany({
      where: { 
        businessId,
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ assistants });
  } catch (error) {
    console.error('Error fetching assistants:', error);
    res.status(500).json({ error: 'Failed to fetch assistants' });
  }
});

// POST /api/assistants - Create new assistant
// POST /api/assistants - Create new assistant
router.post('/', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { name, voiceId, systemPrompt, model, language } = req.body;

    // Check subscription limits
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    const assistantCount = await prisma.assistant.count({
      where: { businessId, isActive: true },
    });

    // Plan limits: FREE=1, BASIC=3, PROFESSIONAL=10, ENTERPRISE=unlimited
    const limits = { FREE: 1, BASIC: 3, PROFESSIONAL: 10, ENTERPRISE: 999 };
    const limit = limits[subscription?.plan] || 1;

    if (assistantCount >= limit) {
      return res.status(403).json({ 
        error: `You've reached your plan limit of ${limit} assistant${limit > 1 ? 's' : ''}. Upgrade to add more.` 
      });
    }

    // Map our voice IDs to real 11Labs IDs
    // Turkish voices: Using native Turkish 11Labs voices
    // Reference: https://elevenlabs.io/text-to-speech/turkish
    const voiceMapping = {
      // English voices
      'male-1-professional': 'pNInz6obpgDQGcFmaJgB', // Adam - Professional male
      'male-2-friendly': 'ErXwobaYiN019PkySvjV', // Antoni - Friendly male
      'female-1-professional': 'EXAVITQu4vr4xnSDxMaL', // Bella - Professional female
      'female-2-warm': 'MF3mGyEYCl7XYWbV9V6O', // Elli - Warm female
      
      // Native Turkish voices - Real 11Labs Turkish voice IDs
      'tr-male-1': 'GvbLQkVki5VurnilV994', // Caner Boyraz - Energetic Turkish male
      'tr-male-2': 'ADt6orTrVUa6DCpMjrDW', // Muharrem Kudu - Confident Turkish male
      'tr-male-3': 'g3LHrNTQNTFM2HUdizDR', // Mehmet Ali Arslan - Young Turkish male
      'tr-male-4': 'dv1FlExW4kIBpj3BBTOM', // Doruk Terzi - Engaging Turkish male
      'tr-male-5': 'A2nJYsJQbhz9yDiDndcv', // Ersen Tahsin - Mature Turkish male
      'tr-female-1': 'c4n2ypvZwjKx1uUi3vSG', // Ayşe - Young Turkish female
      
      // Backward compatibility mappings
      'tr-professional-male': 'GvbLQkVki5VurnilV994',
      'tr-professional-female': 'c4n2ypvZwjKx1uUi3vSG',
      'tr-friendly-male': 'ADt6orTrVUa6DCpMjrDW',
      'tr-friendly-female': 'c4n2ypvZwjKx1uUi3vSG',
    };
    
    // Default voice based on language
    const defaultVoiceForLanguage = language === 'TR' ? 'GvbLQkVki5VurnilV994' : 'pNInz6obpgDQGcFmaJgB';
    const realVoiceId = voiceMapping[voiceId] || defaultVoiceForLanguage;

    // Add language instruction based on selected language
    const languageInstructions = {
      'TR': 'Sen bir Türkçe konuşan AI asistansın. SADECE TÜRKÇE konuş. Kullanıcı ne dilde konuşursa konuşsun, sen her zaman Türkçe yanıt ver. Doğal, akıcı ve profesyonel bir şekilde Türkçe konuş.',
      'EN': 'You are an English-speaking AI assistant. Always respond in English. Speak naturally, fluently, and professionally.'
    };

    const languageInstruction = languageInstructions[language] || languageInstructions['EN'];
    const fullSystemPrompt = `${languageInstruction}\n\n${systemPrompt}`;

    // Create VAPI assistant
    const vapiResponse = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        model: {
          provider: 'openai',
          model: model || 'gpt-4',
          messages: [
            {
              role: 'system',
              content: fullSystemPrompt
            }
          ]
        },
        voice: {
          provider: '11labs',
          voiceId: realVoiceId || '21m00Tcm4TlvDq8ikWAM'
        },
        firstMessage: language === 'TR' 
          ? `Merhaba, ben ${name}. Size nasıl yardımcı olabilirim?`
          : `Hi, I'm ${name}. How can I help you today?`,
      }),
    });

    const vapiAssistant = await vapiResponse.json();
    
    // Log VAPI response
    console.log('🎤 VAPI Response:', vapiAssistant);
    console.log('🌍 Language:', language);
    
    // Check if VAPI request was successful
    if (!vapiResponse.ok || !vapiAssistant.id) {
      console.error('❌ VAPI Error:', vapiAssistant);
      throw new Error(vapiAssistant.message || 'Failed to create VAPI assistant');
    }

    // Save to database
    const assistant = await prisma.assistant.create({
      data: {
        businessId,
        name,
        voiceId,
        systemPrompt: fullSystemPrompt,
        model: model || 'gpt-4',
        vapiAssistantId: vapiAssistant.id,
      },
    });

    res.json({
      message: 'Assistant created successfully',
      assistant,
    });
  } catch (error) {
    console.error('Error creating assistant:', error);
    res.status(500).json({ error: 'Failed to create assistant' });
  }
});

// Müşterinin assistant'ını oluştur
router.post('/create', async (req, res) => {
  try {
    const { businessId } = req.user;
    
    // Business bilgilerini al
    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    // Zaten assistant varsa hata ver
    if (business.vapiAssistantId) {
      return res.status(400).json({ error: 'Assistant already exists' });
    }

    // VAPI'de assistant oluştur
    const config = {
      voiceId: business.vapiVoiceId || '21m00Tcm4TlvDq8ikWAM',
      speed: business.vapiSpeed || 1.0,
      customGreeting: business.customGreeting,
      customInstructions: business.customInstructions
    };

    const vapiAssistant = await vapiService.createAssistant(business.name, config);

    // Database'e assistant ID'yi kaydet
    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: {
        vapiAssistantId: vapiAssistant.id
      }
    });

    res.json({
      success: true,
      assistant: vapiAssistant,
      business: updatedBusiness
    });

  } catch (error) {
    console.error('Create assistant error:', error);
    res.status(500).json({ error: 'Failed to create assistant' });
  }
});

// Assistant ayarlarını güncelle
router.put('/update', async (req, res) => {
  try {
    const { businessId } = req.user;
    const { voiceId, voiceGender, tone, speed, pitch, customGreeting, customInstructions } = req.body;

    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business.vapiAssistantId) {
      return res.status(400).json({ error: 'No assistant found. Create one first.' });
    }

    // 🔥 YENİ: AI TRAINING'LERİ ÇEK
    const trainings = await prisma.aiTraining.findMany({
      where: { businessId }
    });

    // 🔥 YENİ: TRAINING'LERİ SİSTEM PROMPT'A EKLE
    let fullInstructions = customInstructions || '';
    
    if (trainings.length > 0) {
      fullInstructions += '\n\n=== CUSTOM TRAINING DATA ===\n\n';
      trainings.forEach((training, index) => {
        fullInstructions += `${index + 1}. ${training.title}\n`;
        fullInstructions += `Category: ${training.category || 'General'}\n`;
        fullInstructions += `Instructions: ${training.instructions}\n\n`;
      });
    }

    // Database'i güncelle
    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: {
        vapiVoiceId: voiceId,
        vapiVoiceGender: voiceGender,
        vapiTone: tone,
        vapiSpeed: speed,
        vapiPitch: pitch,
        customGreeting,
        customInstructions
      }
    });

    // 🔥 YENİ: VAPI'Yİ GÜNCELLE (TRAINING DAHİL)
    const config = {
  voiceId: updatedBusiness.vapiVoiceId || '21m00Tcm4TlvDq8ikWAM',
  speed: updatedBusiness.vapiSpeed || 1.0,
  customGreeting: updatedBusiness.customGreeting,
  customInstructions: fullInstructions  // ← Bu doğru!
};

    await vapiService.updateAssistant(business.vapiAssistantId, config);

    console.log('✅ Sending response:', {
  success: true,
  trainingsApplied: trainings.length
});

res.status(200).json({
  success: true,
  business: updatedBusiness,
  trainingsApplied: trainings.length
});

  } catch (error) {
    console.error('Update assistant error:', error);
    res.status(500).json({ error: 'Failed to update assistant' });
  }
});

// Test call yap
router.post('/test-call', async (req, res) => {
  try {
    const { businessId } = req.user;
    const { phoneNumber } = req.body;

    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });

    if (!business.vapiAssistantId) {
      return res.status(400).json({ error: 'No assistant configured' });
    }

    const call = await vapiService.makeTestCall(business.vapiAssistantId, phoneNumber);

    res.json({
      success: true,
      call
    });

  } catch (error) {
    console.error('Test call error:', error);
    res.status(500).json({ error: 'Failed to initiate test call' });
  }
});

// Mevcut sesleri getir
router.get('/voices', async (req, res) => {
  try {
    const voices = await vapiService.getVoices();
    res.json(voices);
  } catch (error) {
    console.error('Get voices error:', error);
    res.status(500).json({ error: 'Failed to get voices' });
  }
});

// PUT /api/assistants/:id - Update assistant
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { name, voiceId, systemPrompt, model } = req.body;

    // Check if assistant belongs to this business
    const assistant = await prisma.assistant.findFirst({
      where: { 
        id,
        businessId,
        isActive: true,
      },
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    // Update in database
    const updatedAssistant = await prisma.assistant.update({
      where: { id },
      data: {
        name,
        voiceId,
        systemPrompt,
        model,
      },
    });

    // Optionally: Update in VAPI too
    // if (assistant.vapiAssistantId) {
    //   await fetch(`https://api.vapi.ai/assistant/${assistant.vapiAssistantId}`, {
    //     method: 'PATCH',
    //     headers: {
    //       'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
    //       'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({ name, voice: { voiceId }, systemPrompt }),
    //   });
    // }

    res.json({
      message: 'Assistant updated successfully',
      assistant: updatedAssistant,
    });
  } catch (error) {
    console.error('Error updating assistant:', error);
    res.status(500).json({ error: 'Failed to update assistant' });
  }
});

// DELETE /api/assistants/:id - Delete assistant
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    // Check if assistant belongs to this business
    const assistant = await prisma.assistant.findFirst({
      where: { 
        id,
        businessId,
      },
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    // Delete from database (soft delete)
    await prisma.assistant.update({
      where: { id },
      data: { isActive: false },
    });

    // Optionally: Delete from VAPI too
    // await fetch(`https://api.vapi.ai/assistant/${assistant.vapiAssistantId}`, {
    //   method: 'DELETE',
    //   headers: { 'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}` },
    // });

    res.json({ message: 'Assistant deleted successfully' });
  } catch (error) {
    console.error('Error deleting assistant:', error);
    res.status(500).json({ error: 'Failed to delete assistant' });
  }
});

// GET /api/assistants/templates - Get assistant templates
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const templates = [
      // English Templates
      {
        id: 'restaurant-en',
        name: 'Restaurant Reservation',
        language: 'EN',
        industry: 'Restaurant',
        voiceId: 'female-1-professional',
        description: 'AI assistant that handles restaurant reservations, answers menu questions, and manages booking inquiries.',
        systemPrompt: `You are a friendly and professional restaurant receptionist AI. Your job is to:
1. Greet customers warmly
2. Take reservations - ask for name, party size, date, time, and any special requests
3. Answer questions about the menu, hours, location, and parking
4. Handle cancellations and modifications
5. Suggest popular dishes when asked

Always be polite, patient, and helpful. If you can't answer something, offer to have a manager call them back.`
      },
      {
        id: 'salon-en',
        name: 'Salon Appointment',
        language: 'EN',
        industry: 'Salon',
        voiceId: 'female-2-warm',
        description: 'AI assistant for beauty salons that books appointments, describes services, and handles scheduling.',
        systemPrompt: `You are a friendly salon receptionist AI. Your responsibilities include:
1. Greeting clients warmly
2. Booking appointments - ask for name, phone, desired service, stylist preference, date and time
3. Explaining services and pricing
4. Handling rescheduling and cancellations
5. Recommending services based on client needs

Be warm, professional, and make clients feel valued. Confirm all booking details before ending the call.`
      },
      {
        id: 'ecommerce-en',
        name: 'E-commerce Support',
        language: 'EN',
        industry: 'E-commerce',
        voiceId: 'male-1-professional',
        description: 'AI assistant for online stores that handles order inquiries, returns, and product questions.',
        systemPrompt: `You are a helpful e-commerce customer support AI. Your duties include:
1. Helping customers track their orders
2. Processing return and exchange requests
3. Answering product questions
4. Explaining shipping policies and timeframes
5. Handling billing inquiries

Always ask for order number or email to assist better. Be patient and solution-oriented.`
      },
      
      // Turkish Templates
      {
        id: 'restaurant-tr',
        name: 'Restoran Rezervasyonu',
        language: 'TR',
        industry: 'Restaurant',
        voiceId: 'tr-female-1',
        description: 'Restoran rezervasyonları alan, menü soruları yanıtlayan AI asistan.',
        systemPrompt: `Sen samimi ve profesyonel bir restoran resepsiyonist yapay zekasısın. Görevlerin:
1. Müşterileri sıcak bir şekilde karşıla
2. Rezervasyon al - isim, kişi sayısı, tarih, saat ve özel istekleri sor
3. Menü, çalışma saatleri, konum ve park yeri hakkındaki soruları yanıtla
4. İptal ve değişiklikleri yönet
5. Sorulduğunda popüler yemekleri öner

Her zaman kibar, sabırlı ve yardımsever ol. Cevaplayamadığın bir şey olursa, bir yöneticinin geri aramasını teklif et.
HER ZAMAN TÜRKÇE KONUŞ.`
      },
      {
        id: 'salon-tr',
        name: 'Kuaför Randevusu',
        language: 'TR',
        industry: 'Salon',
        voiceId: 'tr-female-2',
        description: 'Kuaför ve güzellik salonları için randevu alan AI asistan.',
        systemPrompt: `Sen samimi bir kuaför resepsiyonist yapay zekasısın. Sorumlulukların:
1. Müşterileri sıcak bir şekilde karşıla
2. Randevu al - isim, telefon, istenen hizmet, kuaför tercihi, tarih ve saat sor
3. Hizmetleri ve fiyatları açıkla
4. Erteleme ve iptalleri yönet
5. Müşteri ihtiyaçlarına göre hizmet öner

Sıcak, profesyonel ol ve müşterilerin kendilerini değerli hissetmesini sağla. Aramayı bitirmeden önce tüm randevu detaylarını onayla.
HER ZAMAN TÜRKÇE KONUŞ.`
      }
    ];

    res.json({ templates });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /api/assistants/from-template - Create assistant from template
router.post('/from-template', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { templateId, customName } = req.body;

    // Get template
    const templatesResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/assistants/templates`, {
      headers: { 'Authorization': req.headers.authorization }
    });
    const { templates } = await templatesResponse.json();
    const template = templates.find(t => t.id === templateId);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // Create assistant using the template
    const name = customName || template.name;
    const language = template.language;
    const voiceId = template.voiceId;
    const systemPrompt = template.systemPrompt;

    // Forward to the main create endpoint
    const createResponse = await fetch(`http://localhost:${process.env.PORT || 3001}/api/assistants`, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.authorization,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        voiceId,
        systemPrompt,
        model: 'gpt-4',
        language
      })
    });

    const result = await createResponse.json();
    
    if (!createResponse.ok) {
      return res.status(createResponse.status).json(result);
    }

    res.json({
      message: 'Assistant created from template successfully',
      assistant: result.assistant,
      template: template.name
    });

  } catch (error) {
    console.error('Error creating from template:', error);
    res.status(500).json({ error: 'Failed to create assistant from template' });
  }
});

export default router;