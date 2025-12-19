import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import vapiService from '../services/vapi.js';
import cargoAggregator from '../services/cargo-aggregator.js';
import { removeStaticDateTimeFromPrompt } from '../utils/dateTime.js';

const router = express.Router();
const prisma = new PrismaClient();

const CREATE_APPOINTMENT_TOOL = {
  type: "function",
  function: {
    name: "create_appointment",
    description: "Creates appointment when customer requests booking. Use this when customer wants to schedule an appointment or reservation.",
    parameters: {
      type: "object",
      properties: {
        date: {
          type: "string",
          description: "Appointment date in YYYY-MM-DD format"
        },
        time: {
          type: "string",
          description: "Appointment time in HH:MM 24-hour format (e.g., 14:00)"
        },
        customer_name: {
          type: "string",
          description: "Customer's full name"
        },
        customer_phone: {
          type: "string",
          description: "Customer's phone number"
        },
        service_type: {
          type: "string",
          description: "Type of service requested (optional)"
        }
      },
      required: ["date", "time", "customer_phone"]
    }
  },
  server: {
    url: `${process.env.BACKEND_URL || 'https://marin-methoxy-suzette.ngrok-free.dev'}/api/vapi/functions`,
    timeoutSeconds: 20
  }
};

// ============================================================
// TRENDYOL E-COMMERCE TOOLS
// ============================================================

const CHECK_ORDER_STATUS_TOOL = {
  type: "function",
  function: {
    name: "check_order_status",
    description: "Müşterinin sipariş durumunu sorgular. Müşteri sipariş numarası veya telefon numarası verebilir. Sipariş durumu, kargo bilgisi ve teslimat tahmini döndürür.",
    parameters: {
      type: "object",
      properties: {
        order_number: {
          type: "string",
          description: "Trendyol sipariş numarası (örn: 123456789)"
        },
        customer_phone: {
          type: "string",
          description: "Müşterinin telefon numarası (örn: 5551234567)"
        }
      },
      required: []
    }
  },
  server: {
    url: `${process.env.BACKEND_URL || 'https://marin-methoxy-suzette.ngrok-free.dev'}/api/vapi/functions`,
    timeoutSeconds: 30
  }
};

const GET_PRODUCT_STOCK_TOOL = {
  type: "function",
  function: {
    name: "get_product_stock",
    description: "Ürünün stok durumunu ve fiyatını sorgular. Müşteri ürün adı veya barkod numarası verebilir.",
    parameters: {
      type: "object",
      properties: {
        product_name: {
          type: "string",
          description: "Ürün adı veya arama kelimesi"
        },
        barcode: {
          type: "string",
          description: "Ürün barkod numarası (opsiyonel, daha kesin sonuç için)"
        }
      },
      required: ["product_name"]
    }
  },
  server: {
    url: `${process.env.BACKEND_URL || 'https://marin-methoxy-suzette.ngrok-free.dev'}/api/vapi/functions`,
    timeoutSeconds: 20
  }
};

const GET_CARGO_TRACKING_TOOL = {
  type: "function",
  function: {
    name: "get_cargo_tracking",
    description: "Siparişin kargo takip bilgisini getirir. Kargo firması, takip numarası ve güncel durumu döndürür.",
    parameters: {
      type: "object",
      properties: {
        order_number: {
          type: "string",
          description: "Trendyol sipariş numarası"
        }
      },
      required: ["order_number"]
    }
  },
  server: {
    url: `${process.env.BACKEND_URL || 'https://marin-methoxy-suzette.ngrok-free.dev'}/api/vapi/functions`,
    timeoutSeconds: 20
  }
};

// ============================================================
// CARGO TRACKING TOOL
// ============================================================

const TRACK_SHIPMENT_TOOL = {
  type: "function",
  function: {
    name: "track_shipment",
    description: "Müşterinin kargo takip numarası ile gönderisinin durumunu sorgular. Müşteri kargo firmasını belirtmezse otomatik bulunur. Tracks customer's shipment status by tracking number.",
    parameters: {
      type: "object",
      properties: {
        tracking_number: {
          type: "string",
          description: "Kargo takip numarası / Shipment tracking number"
        },
        carrier: {
          type: "string",
          enum: ["yurtici", "aras", "mng"],
          description: "Kargo firması (opsiyonel). Belirtilmezse tüm bağlı firmalar denenir. / Cargo carrier (optional). If not specified, all connected carriers will be tried."
        }
      },
      required: ["tracking_number"]
    }
  },
  server: {
    url: `${process.env.BACKEND_URL || 'https://marin-methoxy-suzette.ngrok-free.dev'}/api/vapi/functions`,
    timeoutSeconds: 15
  }
};

// ============================================================
// ORDER TOOLS (Restaurant/Food)
// ============================================================

const CREATE_ORDER_TOOL = {
  type: "function",
  function: {
    name: "create_order",
    description: "Creates a new food/product order. ONLY use when customer specifies WHAT they want to order (specific products/items). If customer just says 'I want to order' without specifying items, ASK what they want first.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "string",
          description: "Order items with quantities (e.g., '2x Doner Plate, 1x Ayran')"
        },
        customer_name: {
          type: "string",
          description: "Customer's name"
        },
        customer_phone: {
          type: "string",
          description: "Customer's phone number"
        },
        order_type: {
          type: "string",
          description: "PICKUP or DELIVERY",
          enum: ["PICKUP", "DELIVERY"]
        },
        pickup_time: {
          type: "string",
          description: "When customer wants to pick up (e.g., '3 saat sonra', '18:00', 'hemen')"
        },
        delivery_address: {
          type: "string",
          description: "Delivery address (required for delivery orders)"
        },
        notes: {
          type: "string",
          description: "Special requests or notes"
        }
      },
      required: ["items", "customer_name"]
    }
  },
  server: {
    url: `${process.env.BACKEND_URL || 'https://marin-methoxy-suzette.ngrok-free.dev'}/api/vapi/functions`,
    timeoutSeconds: 20
  }
};

const UPDATE_ORDER_TOOL = {
  type: "function",
  function: {
    name: "update_order",
    description: "Updates an existing order. Use when customer wants to change pickup time, items, or cancel order.",
    parameters: {
      type: "object",
      properties: {
        order_id: {
          type: "string",
          description: "Order ID or last 8 characters of order number"
        },
        pickup_time: {
          type: "string",
          description: "New pickup time in HH:MM format or relative like '3 saat sonra'"
        },
        new_items: {
          type: "string",
          description: "Updated order items (replaces existing)"
        },
        cancel: {
          type: "boolean",
          description: "Set to true to cancel the order"
        },
        notes: {
          type: "string",
          description: "Additional notes"
        }
      },
      required: ["order_id"]
    }
  },
  server: {
    url: `${process.env.BACKEND_URL || 'https://marin-methoxy-suzette.ngrok-free.dev'}/api/vapi/functions`,
    timeoutSeconds: 20
  }
};

/**
 * Get active tools for a business based on their integrations
 * @param {number} businessId - Business ID
 * @returns {Promise<Array>} Array of VAPI tool definitions
 */
async function getActiveToolsForBusiness(businessId) {
  const tools = [CREATE_APPOINTMENT_TOOL]; // Default tool always available

  try {
    // Check for Trendyol integration
    const trendyolIntegration = await prisma.integration.findUnique({
      where: {
        businessId_type: {
          businessId,
          type: 'TRENDYOL'
        }
      }
    });

    if (trendyolIntegration && trendyolIntegration.isActive && trendyolIntegration.connected) {
      console.log(`✅ Trendyol integration active for business ${businessId} - adding e-commerce tools`);
      tools.push(CHECK_ORDER_STATUS_TOOL);
      tools.push(GET_PRODUCT_STOCK_TOOL);
      tools.push(GET_CARGO_TRACKING_TOOL);
    }

    // Check if business has cargo integration
    const hasCargoIntegration = await cargoAggregator.hasCargoIntegration(businessId);
    if (hasCargoIntegration) {
      tools.push(TRACK_SHIPMENT_TOOL);
      console.log(`📦 Cargo integration found, adding TRACK_SHIPMENT_TOOL for business ${businessId}`);
    }

    // Check business type for order tools
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { businessType: true }
    });
    
    if (business && ['RESTAURANT'].includes(business.businessType)) {
      tools.push(CREATE_ORDER_TOOL);
      tools.push(UPDATE_ORDER_TOOL);
      console.log(`🍽️ Order tools added for business ${businessId} (${business.businessType})`);
    }

  } catch (error) {
    console.error('❌ Error getting active tools for business:', error);
    // Return default tools on error
  }

  return tools;
}

// ============================================================
// ASSISTANT DEFAULTS BY LANGUAGE
// ============================================================
const ASSISTANT_DEFAULTS = {
  TR: {
    voice: 'tr-f-ecem',
    firstMessage: 'Merhaba, ben {name}. Size nasıl yardımcı olabilirim?',
    systemPromptPrefix: 'Sen yardımcı bir asistansın. Türkçe konuş. Kibar ve profesyonel ol.'
  },
  EN: {
    voice: 'en-f-kayla',
    firstMessage: "Hello, I'm {name}. How can I help you today?",
    systemPromptPrefix: 'You are a helpful assistant. Speak in English. Be polite and professional.'
  },
  DE: {
    voice: 'en-f-kayla', // Will use English voice as fallback
    firstMessage: "Hallo, ich bin {name}. Wie kann ich Ihnen helfen?",
    systemPromptPrefix: 'Du bist ein hilfreicher Assistent. Sprich auf Deutsch. Sei höflich und professionell.'
  },
  ES: {
    voice: 'en-f-kayla',
    firstMessage: "Hola, soy {name}. ¿Cómo puedo ayudarle?",
    systemPromptPrefix: 'Eres un asistente útil. Habla en español. Sé educado y profesional.'
  }
};

/**
 * Get formatted date/time string for a timezone
 * @param {string} timezone - IANA timezone string
 * @param {string} language - Language code (TR, EN, etc.)
 * @returns {string} Formatted date/time context string
 */
function getDateTimeContext(timezone, language = 'TR') {
  const now = new Date();
  const locale = language === 'TR' ? 'tr-TR' : 'en-US';

  const options = {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: language !== 'TR'
  };

  const formattedDateTime = now.toLocaleString(locale, options);

  if (language === 'TR') {
    return `\n\nÖNEMLİ: Şu anki tarih ve saat: ${formattedDateTime} (${timezone} saat dilimi). Tüm tarih ve saat hesaplamalarında bunu kullan.`;
  }
  return `\n\nIMPORTANT: Current date and time is ${formattedDateTime} (${timezone} timezone). Use this for all date and time calculations.`;
}

router.use(authenticateToken);

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

    // Clean system prompts - remove dynamic date/time lines for UI display
    const cleanedAssistants = assistants.map(assistant => ({
      ...assistant,
      systemPrompt: removeStaticDateTimeFromPrompt(assistant.systemPrompt)
    }));

    res.json({ assistants: cleanedAssistants });
  } catch (error) {
    console.error('Error fetching assistants:', error);
    res.status(500).json({ error: 'Failed to fetch assistants' });
  }
});

// POST /api/assistants - Create new assistant
router.post('/', authenticateToken, checkPermission('assistants:create'), async (req, res) => {
  try {
    const businessId = req.businessId;
    const { name, voiceId, firstMessage, systemPrompt, model, language, country, industry, timezone } = req.body;

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

    // ✅ YENİ: 11Labs Voice ID'leri (VAPI Assistant ID'leri DEĞİL!)
    const VOICE_MAPPING = {
      // Turkish voices - 11Labs Voice IDs
      'tr-m-cihan': 'Md4RAnfKt9kVIbvqUxly',
      'tr-m-yunus': 'Q5n6GDIjpN0pLOlycRFT',
      'tr-m-sukru': 'pMQM2vAjnEa9PmfDvgkY',
      'tr-m-murat': 'xouejoTN10DvXRSlXvmB',
      'tr-f-ecem': 'PVbzZmwmdI99VcmuRK7G',
      'tr-f-aslihan': '973ByT3y0FasCLLTLBAL',
      'tr-f-gokce': 'oPC5I9GKjMReiaM29gjY',
      'tr-f-auralis': 'X5CGTTx85DmIuopBFHlz',
      
      // English voices - 11Labs Voice IDs
      'en-m-jude': 'Yg7C1g7suzNt5TisIqkZ',
      'en-m-stokes': 'kHhWB9Fw3aF6ly7JvltC',
      'en-m-andrew': 'QCOsaFukRxK1IUh7WVlM',
      'en-m-ollie': 'jRAAK67SEFE9m7ci5DhD',
      'en-f-kayla': 'aTxZrSrp47xsP6Ot4Kgd',
      'en-f-shelby': 'rfkTsdZrVWEVhDycUYn9',
      'en-f-roshni': 'fq1SdXsX6OokE10pJ4Xw',
      'en-f-meera': '9TwzC887zQyDD4yBthzD'
    };
    
    // Default voice based on language (11Labs default voices)
    const defaultVoiceForLanguage = language === 'TR' ? 'Md4RAnfKt9kVIbvqUxly' : 'Yg7C1g7suzNt5TisIqkZ';
    const elevenLabsVoiceId = VOICE_MAPPING[voiceId] || defaultVoiceForLanguage;

    // Get business info for language/timezone defaults
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { language: true, timezone: true, country: true }
    });

    const lang = language?.toUpperCase() || business?.language || 'TR';
    const businessTimezone = timezone || business?.timezone || 'Europe/Istanbul';
    const defaults = ASSISTANT_DEFAULTS[lang] || ASSISTANT_DEFAULTS.TR;

    // Language-specific instruction
    const languageInstruction = lang === 'TR'
      ? 'Sen bir yapay zeka asistanısın. Müşterinin kullandığı dilde cevap ver. Eğer Türkçe konuşurlarsa Türkçe, İngilizce konuşurlarsa İngilizce yanıt ver. Dillerini tam olarak eşleştir. Doğal, akıcı ve profesyonel konuş.'
      : 'You are an AI assistant. Always respond in the SAME LANGUAGE the customer uses. If they speak Turkish, respond in Turkish. If they speak Spanish, respond in Spanish. Match their language exactly. Speak naturally, fluently, and professionally in whatever language they choose.';

    // Get date/time context in the right language
    const dateContext = getDateTimeContext(businessTimezone, lang);

    const fullSystemPrompt = `${languageInstruction}${dateContext}\n\n${systemPrompt}`;

    // Default first message based on language (use defaults from ASSISTANT_DEFAULTS)
    const defaultFirstMessage = defaults.firstMessage.replace('{name}', name);
    const finalFirstMessage = firstMessage || defaultFirstMessage;

    // Get active tools based on business integrations
    const activeTools = await getActiveToolsForBusiness(businessId);
    console.log('📤 VAPI Request - tools:', activeTools.map(t => t.function.name));

    // VAPI'de YENİ assistant oluştur
    const vapiResponse = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `${name} - ${Date.now()}`,

        // Transcriber - 11Labs
        transcriber: {
          provider: '11labs',
          model: 'scribe_v1',
          language: language === 'TR' ? 'tr' : 'en',
        },

        // Model
        model: {
          provider: 'openai',
          model: model || 'gpt-4',
          messages: [
            {
              role: 'system',
              content: fullSystemPrompt
            }
          ],
          tools: activeTools
        },
        
        // Voice - 11Labs
        voice: {
          provider: '11labs',
          voiceId: elevenLabsVoiceId,
          model: 'eleven_turbo_v2_5',
          stability: 0.5,
          similarityBoost: 0.75,
        },
        
        // First Message - Müşterinin yazdığı karşılama
        firstMessage: finalFirstMessage,
      }),
    });

    if (!vapiResponse.ok) {
      const errorData = await vapiResponse.json();
      console.error('VAPI Error:', errorData);
      return res.status(500).json({ error: 'Failed to create VAPI assistant', details: errorData });
    }

    const vapiAssistant = await vapiResponse.json();
console.log('✅ VAPI Assistant created:', vapiAssistant.id);
console.log('✅ VAPI Response:', JSON.stringify(vapiAssistant, null, 2));

    // ✅ YENİ: Database'e VAPI'den dönen assistant ID'yi kaydet
    const assistant = await prisma.assistant.create({
      data: {
        businessId,
        name,
        voiceId,  // Frontend'den gelen voiceId (örn: 'tr-m-cihan')
        systemPrompt: fullSystemPrompt,
        model: model || 'gpt-4',
        vapiAssistantId: vapiAssistant.id,  // ✅ VAPI'den dönen YENİ assistant ID
        timezone: businessTimezone,
        firstMessage: finalFirstMessage,
      },
    });

    await prisma.business.update({
      where: { id: businessId },
      data: {
        vapiAssistantId: vapiAssistant.id,
        ...(timezone && { timezone }),
        ...(industry && { businessType: industry }),
        ...(country && { country }),
        ...(lang && { language: lang })
      }
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

    // 🔥 YENİ: KNOWLEDGE BASE'İ ÇEK
    const knowledgeItems = await prisma.knowledgeBase.findMany({
      where: { businessId, status: 'ACTIVE' }
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

    // 🔥 YENİ: KNOWLEDGE BASE İÇERİĞİNİ EKLE
    if (knowledgeItems.length > 0) {
      const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };
      
      for (const item of knowledgeItems) {
        if (item.type === 'FAQ' && item.question && item.answer) {
          kbByType.FAQ.push(`Q: ${item.question}\nA: ${item.answer}`);
        } else if (item.content) {
          kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 1000)}`);
        }
      }

      if (kbByType.FAQ.length > 0) {
        fullInstructions += '\n\n=== FREQUENTLY ASKED QUESTIONS ===\n' + kbByType.FAQ.join('\n\n');
      }
      if (kbByType.URL.length > 0) {
        fullInstructions += '\n\n=== WEBSITE CONTENT ===\n' + kbByType.URL.join('\n\n');
      }
      if (kbByType.DOCUMENT.length > 0) {
        fullInstructions += '\n\n=== DOCUMENTS ===\n' + kbByType.DOCUMENT.join('\n\n');
      }
      
      console.log('📚 Knowledge Base items added:', knowledgeItems.length);
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
    const activeTools = await getActiveToolsForBusiness(businessId);
    console.log('📤 Updating VAPI with tools:', activeTools.map(t => t.function.name));
    
    const config = {
      voiceId: updatedBusiness.vapiVoiceId || '21m00Tcm4TlvDq8ikWAM',
      speed: updatedBusiness.vapiSpeed || 1.0,
      customGreeting: updatedBusiness.customGreeting,
      customInstructions: fullInstructions,
      tools: activeTools
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
router.put('/:id', authenticateToken, checkPermission('assistants:edit'), async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { name, voiceId, systemPrompt, model, language } = req.body;

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

    // ✅ YENİ: 11Labs Voice ID'leri
    const VOICE_MAPPING = {
      'tr-m-cihan': 'Md4RAnfKt9kVIbvqUxly',
      'tr-m-yunus': 'Q5n6GDIjpN0pLOlycRFT',
      'tr-m-sukru': 'pMQM2vAjnEa9PmfDvgkY',
      'tr-m-murat': 'xouejoTN10DvXRSlXvmB',
      'tr-f-ecem': 'PVbzZmwmdI99VcmuRK7G',
      'tr-f-aslihan': '973ByT3y0FasCLLTLBAL',
      'tr-f-gokce': 'oPC5I9GKjMReiaM29gjY',
      'tr-f-auralis': 'X5CGTTx85DmIuopBFHlz',
      'en-m-jude': 'Yg7C1g7suzNt5TisIqkZ',
      'en-m-stokes': 'kHhWB9Fw3aF6ly7JvltC',
      'en-m-andrew': 'QCOsaFukRxK1IUh7WVlM',
      'en-m-ollie': 'jRAAK67SEFE9m7ci5DhD',
      'en-f-kayla': 'aTxZrSrp47xsP6Ot4Kgd',
      'en-f-shelby': 'rfkTsdZrVWEVhDycUYn9',
      'en-f-roshni': 'fq1SdXsX6OokE10pJ4Xw',
      'en-f-meera': '9TwzC887zQyDD4yBthzD'
    };

    const elevenLabsVoiceId = VOICE_MAPPING[voiceId] || VOICE_MAPPING['tr-m-cihan'];

    // Universal language instruction - AI will match the customer's language
    const languageInstruction = 'You are an AI assistant. Always respond in the SAME LANGUAGE the customer uses. If they speak Turkish, respond in Turkish. If they speak Spanish, respond in Spanish. If they speak French, respond in French. Match their language exactly. Speak naturally, fluently, and professionally in whatever language they choose.';

    // 🔥 KNOWLEDGE BASE İÇERİĞİNİ ÇEK
    const knowledgeItems = await prisma.knowledgeBase.findMany({
      where: { businessId, status: 'ACTIVE' }
    });

    let knowledgeContext = '';
    if (knowledgeItems.length > 0) {
      const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };
      
      for (const item of knowledgeItems) {
        if (item.type === 'FAQ' && item.question && item.answer) {
          kbByType.FAQ.push(`Q: ${item.question}\nA: ${item.answer}`);
        } else if (item.content) {
          kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 1000)}`);
        }
      }

      if (kbByType.FAQ.length > 0) {
        knowledgeContext += '\n\n=== FREQUENTLY ASKED QUESTIONS ===\n' + kbByType.FAQ.join('\n\n');
      }
      if (kbByType.URL.length > 0) {
        knowledgeContext += '\n\n=== WEBSITE CONTENT ===\n' + kbByType.URL.join('\n\n');
      }
      if (kbByType.DOCUMENT.length > 0) {
        knowledgeContext += '\n\n=== DOCUMENTS ===\n' + kbByType.DOCUMENT.join('\n\n');
      }
      
      console.log('📚 Knowledge Base items added:', knowledgeItems.length);
    }

    const fullSystemPrompt = `${systemPrompt}${knowledgeContext}`;

    // Update in database
    const updatedAssistant = await prisma.assistant.update({
      where: { id },
      data: {
        name,
        voiceId,
        systemPrompt: fullSystemPrompt,
        model,
      },
    });

// ✅ YENİ: VAPI'deki assistant'ı da güncelle (PATCH)
    if (assistant.vapiAssistantId) {
      // Get active tools for this business
      const activeTools = await getActiveToolsForBusiness(businessId);
      console.log('📤 VAPI Update - tools:', activeTools.map(t => t.function.name));

      const vapiResponse = await fetch(`https://api.vapi.ai/assistant/${assistant.vapiAssistantId}`, {
        method: 'PATCH',
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
            ],
            tools: activeTools
          },
          voice: {
            provider: '11labs',
            voiceId: elevenLabsVoiceId
          },
          firstMessage: language === 'TR' 
            ? `Merhaba, ben ${name}. Size nasıl yardımcı olabilirim?`
            : `Hi, I'm ${name}. How can I help you today?`,
        }),
      });

      if (!vapiResponse.ok) {
        console.error('❌ VAPI update failed:', await vapiResponse.text());
      } else {
        console.log('✅ VAPI Assistant updated with tools');

        // Sync all phone numbers connected to this assistant in VAPI
        const connectedPhones = await prisma.phoneNumber.findMany({
          where: {
            assistantId: id,
            vapiPhoneId: { not: null }
          }
        });

        if (connectedPhones.length > 0) {
          console.log(`📞 Syncing ${connectedPhones.length} phone numbers to updated assistant`);
          for (const phone of connectedPhones) {
            try {
              await vapiService.assignPhoneNumber(phone.vapiPhoneId, assistant.vapiAssistantId);
              console.log(`✅ VAPI Phone ${phone.phoneNumber} synced to assistant`);
            } catch (syncErr) {
              console.error(`❌ Failed to sync phone ${phone.phoneNumber}:`, syncErr.message);
            }
          }
        }
      }
    }

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
router.delete('/:id', authenticateToken, checkPermission('assistants:edit'), async (req, res) => {
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

    // ✅ YENİ: VAPI'den de sil
    if (assistant.vapiAssistantId) {
      try {
        await fetch(`https://api.vapi.ai/assistant/${assistant.vapiAssistantId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${process.env.VAPI_PRIVATE_KEY}` },
        });
        console.log('✅ VAPI Assistant deleted:', assistant.vapiAssistantId);
      } catch (vapiError) {
        console.error('VAPI delete error (continuing anyway):', vapiError);
      }
    }

    // Delete from database (soft delete)
    await prisma.assistant.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Assistant deleted successfully' });
  } catch (error) {
    console.error('Error deleting assistant:', error);
    res.status(500).json({ error: 'Failed to delete assistant' });
  }
});

// GET /api/assistants/templates - Get assistant templates
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const { language } = req.query; // Optional language filter

    const templates = [
      // English Templates
      {
        id: 'restaurant-en',
        name: 'Restaurant Reservation',
        language: 'EN',
        industry: 'Restaurant',
        voiceId: 'en-f-kayla',
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
        voiceId: 'en-f-shelby',
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
        voiceId: 'en-m-jude',
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
        voiceId: 'tr-f-ecem',
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
        voiceId: 'tr-f-aslihan',
        description: 'Kuaför ve güzellik salonları için randevu alan AI asistan.',
        systemPrompt: `Sen samimi bir kuaför resepsiyonist yapay zekasısın. Sorumlulukların:
1. Müşterileri sıcak bir şekilde karşıla
2. Randevu al - isim, telefon, istenen hizmet, kuaför tercihi, tarih ve saat sor
3. Hizmetleri ve fiyatları açıkla
4. Erteleme ve iptalleri yönet
5. Müşteri ihtiyaçlarına göre hizmet öner

Sıcak, profesyonel ol ve müşterilerin kendilerini değerli hissetmesini sağla. Aramayı bitirmeden önce tüm randevu detaylarını onayla.
HER ZAMAN TÜRKÇE KONUŞ.`
      },
      {
        id: 'ecommerce-tr',
        name: 'E-ticaret Müşteri Desteği',
        language: 'TR',
        industry: 'E-commerce',
        voiceId: 'tr-m-kaan',
        description: 'Online mağazalar için sipariş sorgulama, iade ve ürün sorularını yanıtlayan AI asistan.',
        systemPrompt: `Siz yardımsever bir e-ticaret müşteri destek yapay zekasısınız. Görevleriniz:
1. Müşterilerin siparişlerini takip etmelerine yardımcı olmak
2. İade ve değişim taleplerini işlemek
3. Ürün sorularını yanıtlamak
4. Kargo politikalarını ve teslimat sürelerini açıklamak
5. Fatura sorularını ele almak

Daha iyi yardımcı olmak için her zaman sipariş numarası veya e-posta sorun. Sabırlı ve çözüm odaklı olun.
HER ZAMAN TÜRKÇE KONUŞ.`
      }
    ];

    // Filter by language if specified
    const filteredTemplates = language
      ? templates.filter(t => t.language?.toUpperCase() === language.toUpperCase())
      : templates;

    res.json({ templates: filteredTemplates });
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