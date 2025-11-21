import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import vapiService from '../services/vapi.js';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);

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

export default router;