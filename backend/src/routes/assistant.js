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
    const { name, voiceId, systemPrompt, model } = req.body;

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
    const voiceMapping = {
      'male-1-professional': '21m00Tcm4TlvDq8ikWAM',
      'male-2-friendly': 'pNInz6obpgDQGcFmaJgB',
      'female-1-professional': '21m00Tcm4TlvDq8ikWAM',
      'female-2-warm': 'ThT5KcBeYPX3keUQqHPh',
      'tr-male-1': '21m00Tcm4TlvDq8ikWAM',
      'tr-male-2': 'pNInz6obpgDQGcFmaJgB',
      'tr-female-1': '21m00Tcm4TlvDq8ikWAM',
      'tr-female-2': 'ThT5KcBeYPX3keUQqHPh'
    };
    const realVoiceId = voiceMapping[voiceId] || '21m00Tcm4TlvDq8ikWAM';

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
              content: systemPrompt
            }
          ]
        },
        voice: {
          provider: '11labs',
          voiceId: realVoiceId || '21m00Tcm4TlvDq8ikWAM'
        },
        firstMessage: `Hi, I'm ${name}. How can I help you today?`,
      }),
    });

    const vapiAssistant = await vapiResponse.json();
    
    // Log VAPI response
    console.log('🎤 VAPI Response:', vapiAssistant);
    
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
        systemPrompt,
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

export default router;