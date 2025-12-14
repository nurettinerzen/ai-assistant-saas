import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, verifyBusinessAccess, requireRole } from '../middleware/auth.js';
import vapiService from '../services/vapi.js';

const router = express.Router();
const prisma = new PrismaClient();

// 🌍 SUPPORTED LANGUAGES (15+)
const SUPPORTED_LANGUAGES = [
  'EN', 'TR', 'DE', 'FR', 'ES', 'IT', 'PT', 
  'RU', 'AR', 'JA', 'KO', 'ZH', 'HI', 'NL', 'PL', 'SV'
];

// Get business details
router.get('/:businessId', authenticateToken, verifyBusinessAccess, async (req, res) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.businessId },
      include: {
        subscription: true,
        users: {
          select: {
            id: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }

    res.json(business);
  } catch (error) {
    console.error('Get business error:', error);
    res.status(500).json({ error: 'Failed to fetch business data' });
  }
});

// Update business settings
router.put('/:businessId', authenticateToken, verifyBusinessAccess, requireRole(['OWNER', 'ADMIN']), async (req, res) => {
  try {
    const { name, vapiPhoneNumber, vapiAssistantId, gender, tone, language, businessType } = req.body;

    // 🌍 Validate language if provided
    if (language && !SUPPORTED_LANGUAGES.includes(language.toUpperCase())) {
      return res.status(400).json({ 
        error: 'Invalid language code',
        supportedLanguages: SUPPORTED_LANGUAGES
      });
    }

    const business = await prisma.business.findUnique({
      where: { id: req.businessId }
    });

    // 🔥 DEBUG LOG EKLE
    console.log('📊 Business update request:');
    console.log('  - Incoming vapiAssistantId:', vapiAssistantId);
    console.log('  - Current business.vapiAssistantId:', business.vapiAssistantId);
    console.log('  - Gender:', gender, 'Tone:', tone);

    // 🔥 EĞER YENİ ASSISTANT SEÇİLİYORSA VE HENÜZ OLUŞTURULMAMIŞSA
    if (vapiAssistantId && vapiAssistantId !== business.vapiAssistantId) {
      console.log('🔥 Creating new VAPI assistant...');

      // Ses ID'lerini belirle
      const voiceMap = {
  // İngilizce
  male_professional: 'pNInz6obpgDQGcFmaJgB',
  male_friendly: 'N2lVS1w4EtoT3dr4eOWO',
  female_professional: 'EXAVITQu4vr4xnSDxMaL',
  female_friendly: '21m00Tcm4TlvDq8ikWAM',
  
  // Türkçe (11Labs Turkish voices)
  male_professional_tr: 'yoZ06aMxZJJ28mfd3POQ',  // Türkçe Erkek
  male_friendly_tr: 'yoZ06aMxZJJ28mfd3POQ',
  female_professional_tr: 'XB0fDUnXU5powFXDhCwa', // Türkçe Kadın
  female_friendly_tr: 'XB0fDUnXU5powFXDhCwa'
};

const voiceKey = language === 'tr' 
  ? `${gender}_${tone}_tr` 
  : `${gender}_${tone}`;
const voiceId = voiceMap[voiceKey] || voiceMap.male_professional;

      console.log(`🎤 Voice selected: ${gender} ${tone} -> ${voiceId}`);

      // 🔥 YENİ: TRAINING'LERİ ÇEK
      const trainings = await prisma.aiTraining.findMany({
        where: { businessId: req.businessId },
        where: { isActive: true }
      });

      // 🔥 YENİ: TRAINING'LERİ SİSTEM PROMPT'A EKLE
      let fullInstructions = `You are an AI assistant for ${business.name}. Be helpful and ${tone || 'professional'}.`;
      
      if (trainings.length > 0) {
        fullInstructions += '\n\n=== CUSTOM TRAINING DATA ===\n\n';
        trainings.forEach((training, index) => {
          fullInstructions += `${index + 1}. ${training.title}\n`;
          fullInstructions += `Category: ${training.category || 'General'}\n`;
          fullInstructions += `Instructions: ${training.instructions}\n\n`;
        });
      }

      console.log(`📚 Applying ${trainings.length} trainings to new assistant`);
      
      // VAPI'de yeni assistant oluştur
      const vapiAssistant = await vapiService.createAssistant(business.name, {
  gender: gender || 'male',
  tone: tone || 'professional',
  language: language || 'en',
  voiceId: voiceId,
  customInstructions: fullInstructions,
  customGreeting: extractGreetingFromTrainings(trainings, business.name)  // ← EKLE!
});

      console.log('✅ Assistant created:', vapiAssistant.id);

      // Database'i güncelle
      const updatedBusiness = await prisma.business.update({
        where: { id: req.businessId },
        data: {
          name: name || business.name,
          vapiPhoneNumber,
          vapiAssistantId: vapiAssistant.id,
          vapiVoiceGender: gender?.toUpperCase(),
          vapiTone: tone?.toUpperCase(),
          ...(businessType && { businessType: businessType.toUpperCase() }),
        },
      });

      return res.json(updatedBusiness);
    }

    // Normal update (assistant zaten var)
    // Also accept region fields from settings page
    const { country, timezone } = req.body;

    const updatedBusiness = await prisma.business.update({
      where: { id: req.businessId },
      data: {
        ...(name && { name }),
        ...(vapiPhoneNumber !== undefined && { vapiPhoneNumber }),
        ...(vapiAssistantId !== undefined && { vapiAssistantId }),
        ...(businessType && { businessType: businessType.toUpperCase() }),
        ...(language && { language: language.toUpperCase() }),
        ...(country && { country: country.toUpperCase() }),
        ...(timezone && { timezone }),
      },
    });

    console.log(`✅ Business updated: ${updatedBusiness.name}, type: ${updatedBusiness.businessType}`);
    res.json(updatedBusiness);
  } catch (error) {
    console.error('Update business error:', error);
    res.status(500).json({ error: 'Failed to update business' });
  }
});

function extractGreetingFromTrainings(trainings, businessName) {
  // Greeting training var mı?
  const greetingTraining = trainings.find(t => 
    t.title.toLowerCase().includes('greeting') || 
    t.title.toLowerCase().includes('greet')
  );

  if (greetingTraining) {
    const instructions = greetingTraining.instructions.toLowerCase();
    
    // Bonjour varsa
    if (instructions.includes('bonjour')) {
      return `Bonjour! How can I help you today?`;
    }
    
    // Aloha varsa
    if (instructions.includes('aloha')) {
      return `Aloha! How can I help you today?`;
    }
    
    // Diğer custom greeting'ler
    if (instructions.includes('say ')) {
      // "say hello" → "hello"
      const match = instructions.match(/say (\w+)/i);
      if (match) {
        return `${match[1].charAt(0).toUpperCase() + match[1].slice(1)}! How can I help you today?`;
      }
    }
  }

  // Varsayılan
  return `Hello! Thank you for calling ${businessName}. How can I help you today?`;
}

export default router;