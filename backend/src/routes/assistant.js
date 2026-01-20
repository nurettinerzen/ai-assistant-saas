import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';
import { checkPermission } from '../middleware/permissions.js';
import elevenLabsService, { buildGatewayAgentConfig } from '../services/elevenlabs.js';
import cargoAggregator from '../services/cargo-aggregator.js';
import { removeStaticDateTimeFromPrompt } from '../utils/dateTime.js';
import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from '../services/promptBuilder.js';
// Note: Tool system now handled via gateway architecture in elevenlabs.js
// ✅ Central voice mapping
import { getElevenLabsVoiceId } from '../constants/voices.js';

const router = express.Router();

// ============================================================
// 11LABS LANGUAGE CODE MAPPING
// Our language codes -> 11Labs accepted language codes
// ============================================================
const ELEVENLABS_LANGUAGE_MAP = {
  'tr': 'tr',
  'en': 'en',
  'pr': 'pt-br',  // Brazilian Portuguese
  'pt': 'pt',     // European Portuguese
  'de': 'de',
  'es': 'es',
  'fr': 'fr',
  'it': 'it',
  'ja': 'ja',
  'ko': 'ko',
  'zh': 'zh',
  'ar': 'ar',
  'hi': 'hi',
  'nl': 'nl',
  'pl': 'pl',
  'ru': 'ru',
  'sv': 'sv'
};

/**
 * Convert our language code to 11Labs accepted language code
 * @param {string} lang - Our language code (e.g., 'pr', 'tr', 'en')
 * @returns {string} 11Labs language code (e.g., 'pt-br', 'tr', 'en')
 */
function getElevenLabsLanguage(lang) {
  const normalized = lang?.toLowerCase() || 'tr';
  return ELEVENLABS_LANGUAGE_MAP[normalized] || normalized;
}
const prisma = new PrismaClient();

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
    const { name, voiceId, firstMessage, systemPrompt, model, language, country, industry, timezone, tone, customNotes, callDirection, callPurpose, dynamicVariables } = req.body;

    // Validate assistant name length
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        error: 'Assistant name is required',
        errorTR: 'Asistan adı zorunludur'
      });
    }

    if (name.length > 25) {
      return res.status(400).json({
        error: 'Assistant name must be 25 characters or less',
        errorTR: 'Asistan adı en fazla 25 karakter olabilir'
      });
    }

    // Check subscription limits
    const subscription = await prisma.subscription.findUnique({
      where: { businessId },
    });

    const assistantCount = await prisma.assistant.count({
      where: { businessId, isActive: true },
    });

    // Plan limits removed - unlimited assistants for all plans
    // const limits = { FREE: 1, BASIC: 3, PROFESSIONAL: 10, ENTERPRISE: 999 };
    // const limit = limits[subscription?.plan] || 1;
    // if (assistantCount >= limit) {
    //   return res.status(403).json({
    //     error: `You've reached your plan limit of ${limit} assistant${limit > 1 ? 's' : ''}. Upgrade to add more.`
    //   });
    // }

    // Get 11Labs voice ID from central mapping
    const elevenLabsVoiceId = getElevenLabsVoiceId(voiceId, language);

    // Get business info for language/timezone defaults
    let business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { integrations: { where: { isActive: true } } }
    });

    // Update business country if provided and not already set (from onboarding)
    if (country && (!business.country || business.country === 'US')) {
      business = await prisma.business.update({
        where: { id: businessId },
        data: { country: country.toUpperCase() },
        include: { integrations: { where: { isActive: true } } }
      });
      console.log('📍 Updated business country to:', country.toUpperCase());
    }

    const lang = language?.toUpperCase() || business?.language || 'TR';
    const businessTimezone = timezone || business?.timezone || 'Europe/Istanbul';
    const defaults = ASSISTANT_DEFAULTS[lang] || ASSISTANT_DEFAULTS.TR;

    // Determine effective callDirection based on callPurpose
    // For outbound calls, callPurpose determines the actual callDirection for prompt selection
    // 3 main purposes: sales, collection, general
    let effectiveCallDirection = callDirection || 'inbound';
    if (effectiveCallDirection === 'outbound' && callPurpose) {
      // Map callPurpose to specific callDirection for promptBuilder
      if (callPurpose === 'sales') {
        effectiveCallDirection = 'outbound_sales';
      } else if (callPurpose === 'collection') {
        effectiveCallDirection = 'outbound_collection';
      } else if (callPurpose === 'general') {
        effectiveCallDirection = 'outbound_general';
      }
      console.log('📞 Outbound call purpose mapping:', callPurpose, '->', effectiveCallDirection);
    }

    // Build full system prompt using promptBuilder
    // Create temporary assistant object for promptBuilder
    const tempAssistant = {
      name,
      systemPrompt: systemPrompt,
      tone: tone || 'professional',
      customNotes: customNotes || null,
      callDirection: effectiveCallDirection
    };

    // Get active tools list for prompt builder
    const activeToolsList = getPromptBuilderTools(business, business.integrations || []);

    // Use central prompt builder to create the full system prompt
    const fullSystemPrompt = buildAssistantPrompt(tempAssistant, business, activeToolsList);

    // Default first message based on language (use defaults from ASSISTANT_DEFAULTS)
    const defaultFirstMessage = defaults.firstMessage.replace('{name}', name);
    const finalFirstMessage = firstMessage || defaultFirstMessage;

    // ✅ 11Labs Conversational AI'da YENİ agent oluştur (GATEWAY MİMARİSİ)
    let elevenLabsAgentId = null;

    try {
      // Convert our language code to 11Labs format (e.g., 'pr' -> 'pt-br')
      const elevenLabsLang = getElevenLabsLanguage(lang);
      console.log('📝 Language mapping:', lang, '->', elevenLabsLang);

      // ✅ Gateway mimarisi kullan - tek bir agent_gateway tool
      const agentConfig = buildGatewayAgentConfig({
        name,
        systemPrompt: fullSystemPrompt,
        firstMessage: finalFirstMessage,
        tone: tone || 'professional'
      }, business);

      // Override voice settings
      agentConfig.conversation_config.tts = {
        voice_id: elevenLabsVoiceId,
        model_id: 'eleven_turbo_v2_5',
        stability: 0.4,
        similarity_boost: 0.6,
        style: 0.15,
        optimize_streaming_latency: 3
      };

      // Override language settings
      agentConfig.conversation_config.agent.language = elevenLabsLang;
      agentConfig.conversation_config.stt.language = elevenLabsLang;

      // Add metadata
      agentConfig.metadata = {
        ...agentConfig.metadata,
        telyx_business_id: businessId.toString(),
        model: model || 'gpt-4'
      };

      console.log('🔧 Creating agent with GATEWAY architecture (single agent_gateway tool)');

      const elevenLabsResponse = await elevenLabsService.createAgent(agentConfig);
      elevenLabsAgentId = elevenLabsResponse.agent_id;
      console.log('✅ 11Labs Agent created:', elevenLabsAgentId);

      // ✅ Update gateway tool's webhook URL with actual agentId
      // (Initial config used 'pending' placeholder since agentId wasn't known yet)
      const correctWebhookUrl = `${process.env.BACKEND_URL || 'https://api.aicallcenter.app'}/api/elevenlabs/agent-gateway?agentId=${elevenLabsAgentId}`;
      await elevenLabsService.updateAgent(elevenLabsAgentId, {
        conversation_config: {
          agent: {
            prompt: {
              tools: agentConfig.conversation_config.agent.prompt.tools.map(tool => {
                if (tool.type === 'webhook' && tool.name === 'agent_gateway') {
                  return {
                    ...tool,
                    api_schema: {
                      ...tool.api_schema,
                      url: correctWebhookUrl
                    }
                  };
                }
                return tool;
              })
            }
          }
        }
      });
      console.log('✅ Gateway tool webhook URL updated with agentId');
    } catch (elevenLabsError) {
      console.error('❌ 11Labs Agent creation failed:', elevenLabsError.response?.data || elevenLabsError.message);
      return res.status(500).json({
        error: 'Failed to create 11Labs agent',
        details: elevenLabsError.response?.data || elevenLabsError.message
      });
    }

    // ✅ Database'e 11Labs'den dönen agent ID'yi kaydet
    // Save effectiveCallDirection so promptBuilder uses correct prompt on updates too
    const assistant = await prisma.assistant.create({
      data: {
        businessId,
        name,
        voiceId,  // Frontend'den gelen voiceId (örn: 'tr-m-cihan')
        systemPrompt: fullSystemPrompt,
        model: model || 'gpt-4',
        elevenLabsAgentId: elevenLabsAgentId,  // ✅ 11Labs'den dönen YENİ agent ID
        timezone: businessTimezone,
        firstMessage: finalFirstMessage,
        tone: tone || 'professional',  // "friendly" or "professional"
        customNotes: customNotes || null,  // Business-specific notes
        callDirection: effectiveCallDirection,  // "inbound", "outbound", "outbound_sales", or "outbound_collection"
        callPurpose: callPurpose || null,  // For outbound: "collection", "reminder", "survey", "info", "custom"
        dynamicVariables: dynamicVariables || [],  // Dynamic variable names for outbound calls
      },
    });

    await prisma.business.update({
      where: { id: businessId },
      data: {
        ...(timezone && { timezone }),
        ...(industry && { businessType: industry }),
        ...(country && { country }),
        ...(lang && { language: lang })
      }
    });

    // ✅ Telefon numarası varsa, yeni asistanı otomatik ata
    // NOT: Outbound asistanlar için otomatik atama yapılmaz - onlar batch call için kullanılır
    // Ayrıca telefon numarasında zaten bir asistan varsa, onu koruruz
    try {
      // Only auto-assign for inbound assistants (effectiveCallDirection already defined above)
      if (effectiveCallDirection === 'inbound') {
        const phoneNumber = await prisma.phoneNumber.findFirst({
          where: { businessId }
        });

        // Only auto-assign if phone number has no assistant assigned yet
        if (phoneNumber && phoneNumber.elevenLabsPhoneId && elevenLabsAgentId && !phoneNumber.assistantId) {
          console.log('📱 Auto-assigning assistant to phone number:', phoneNumber.phoneNumber);
          await elevenLabsService.updatePhoneNumber(phoneNumber.elevenLabsPhoneId, elevenLabsAgentId);
          await prisma.phoneNumber.update({
            where: { id: phoneNumber.id },
            data: { assistantId: assistant.id }
          });
          console.log('✅ Phone number assigned to new assistant');
        } else if (phoneNumber?.assistantId) {
          console.log('📱 Phone number already has an assistant assigned, skipping auto-assign');
        }
      } else {
        console.log('📱 Outbound assistant created, skipping phone number auto-assign');
      }
    } catch (phoneError) {
      console.error('⚠️ Failed to auto-assign phone number:', phoneError);
      // Don't fail the request, just log the error
    }

    // ✅ YENİ: Mevcut Knowledge Base içeriklerini yeni asistana ekle
    if (elevenLabsAgentId) {
      try {
        const existingKBs = await prisma.knowledgeBase.findMany({
          where: { businessId, status: 'ACTIVE' }
        });

        if (existingKBs.length > 0) {
          console.log(`📚 Syncing ${existingKBs.length} existing KB items to new assistant...`);

          for (const kb of existingKBs) {
            try {
              let kbContent = '';
              let kbName = kb.title || 'Knowledge Item';

              if (kb.type === 'FAQ' && kb.question && kb.answer) {
                kbContent = `Q: ${kb.question}\nA: ${kb.answer}`;
                kbName = `FAQ: ${kb.question.substring(0, 50)}`;
              } else if (kb.type === 'URL' && kb.url) {
                // For URLs, let 11Labs fetch directly
                await elevenLabsService.addKnowledgeDocument(elevenLabsAgentId, {
                  name: kbName,
                  url: kb.url
                });
                console.log(`✅ URL KB synced to new assistant: ${kbName}`);
                continue;
              } else if (kb.content) {
                kbContent = kb.content;
              }

              if (kbContent) {
                await elevenLabsService.addKnowledgeDocument(elevenLabsAgentId, {
                  name: kbName,
                  content: kbContent
                });
                console.log(`✅ KB synced to new assistant: ${kbName}`);
              }
            } catch (kbError) {
              console.error(`⚠️ Failed to sync KB "${kb.title}" to new assistant:`, kbError.message);
              // Continue with other KBs even if one fails
            }
          }
        }
      } catch (kbSyncError) {
        console.error('⚠️ Failed to sync existing KBs to new assistant:', kbSyncError);
        // Don't fail the request, just log the error
      }
    }

    console.log('✅ Assistant saved to DB:', {
      id: assistant.id,
      name: assistant.name,
      elevenLabsAgentId: assistant.elevenLabsAgentId
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


// Test call yap
router.post('/test-call', async (req, res) => {
  try {
    const { businessId } = req.user;
    const { phoneNumber } = req.body;

    // Get assistant for this business
    const assistant = await prisma.assistant.findFirst({
      where: { businessId, isActive: true }
    });

    if (!assistant) {
      return res.status(400).json({ error: 'No assistant configured' });
    }

    if (!assistant.elevenLabsAgentId) {
      return res.status(400).json({ error: 'Assistant not configured with 11Labs' });
    }

    // Get phone number for outbound call
    const fromPhoneNumber = await prisma.phoneNumber.findFirst({
      where: { businessId, status: 'ACTIVE' }
    });

    if (!fromPhoneNumber || !fromPhoneNumber.elevenLabsPhoneId) {
      return res.status(400).json({ error: 'No phone number configured' });
    }

    const call = await elevenLabsService.initiateOutboundCall({
      agentId: assistant.elevenLabsAgentId,
      phoneNumberId: fromPhoneNumber.elevenLabsPhoneId,
      toNumber: phoneNumber
    });

    res.json({
      success: true,
      call
    });

  } catch (error) {
    console.error('Test call error:', error);
    res.status(500).json({ error: 'Failed to initiate test call' });
  }
});

// PUT /api/assistants/:id - Update assistant
router.put('/:id', authenticateToken, checkPermission('assistants:edit'), async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;
    const { name, voiceId, systemPrompt, firstMessage, model, language, tone, customNotes, callDirection, callPurpose, dynamicVariables } = req.body;

    // Validate assistant name length if provided
    if (name && name.length > 25) {
      return res.status(400).json({
        error: 'Assistant name must be 25 characters or less',
        errorTR: 'Asistan adı en fazla 25 karakter olabilir'
      });
    }

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

    // Get business info with integrations for promptBuilder
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { integrations: { where: { isActive: true } } }
    });

    // Get 11Labs voice ID from central mapping
    const elevenLabsVoiceId = getElevenLabsVoiceId(voiceId, language || business?.language);

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

    // Determine effective callDirection based on callPurpose
    // For outbound calls, callPurpose determines the actual callDirection for prompt selection
    // 3 main purposes: sales, collection, general
    const effectivePurpose = callPurpose !== undefined ? callPurpose : assistant.callPurpose;
    let effectiveCallDirection = callDirection || assistant.callDirection || 'inbound';
    if (effectiveCallDirection === 'outbound' && effectivePurpose) {
      // Map callPurpose to specific callDirection for promptBuilder
      if (effectivePurpose === 'sales') {
        effectiveCallDirection = 'outbound_sales';
      } else if (effectivePurpose === 'collection') {
        effectiveCallDirection = 'outbound_collection';
      } else if (effectivePurpose === 'general') {
        effectiveCallDirection = 'outbound_general';
      }
      console.log('📞 Outbound call purpose mapping (update):', effectivePurpose, '->', effectiveCallDirection);
    }

    // Build full system prompt using promptBuilder
    const tempAssistant = {
      name,
      systemPrompt: systemPrompt,
      tone: tone || assistant.tone || 'professional',
      customNotes: customNotes !== undefined ? customNotes : assistant.customNotes,
      callDirection: effectiveCallDirection
    };

    // Get active tools list for prompt builder
    const activeToolsList = getPromptBuilderTools(business, business.integrations || []);

    // Use central prompt builder to create the full system prompt, then add knowledge context
    const fullSystemPrompt = buildAssistantPrompt(tempAssistant, business, activeToolsList) + knowledgeContext;

    // Update in database - save effectiveCallDirection so promptBuilder uses correct prompt
    const updatedAssistant = await prisma.assistant.update({
      where: { id },
      data: {
        name,
        voiceId,
        systemPrompt: fullSystemPrompt,
        firstMessage: firstMessage || assistant.firstMessage,
        model,
        tone: tone || assistant.tone || 'professional',  // Keep existing if not provided
        customNotes: customNotes !== undefined ? customNotes : assistant.customNotes,  // Allow null/empty
        callDirection: effectiveCallDirection,  // "inbound", "outbound", "outbound_sales", or "outbound_collection"
        callPurpose: callPurpose !== undefined ? callPurpose : assistant.callPurpose,
        dynamicVariables: dynamicVariables || assistant.dynamicVariables || [],
      },
    });

// ✅ Update 11Labs agent
    console.log('🔄 Checking 11Labs update - elevenLabsAgentId:', assistant.elevenLabsAgentId);
    if (assistant.elevenLabsAgentId) {
      try {
        const lang = language || business?.language || 'TR';
        const elevenLabsLang = getElevenLabsLanguage(lang);
        console.log('📝 Update language mapping:', lang, '->', elevenLabsLang);
        console.log('🔧 Updating 11Labs agent:', assistant.elevenLabsAgentId);

        // ✅ Gateway mimarisi kullan - migrateToGateway ile güncelle
        await elevenLabsService.migrateToGateway(assistant.elevenLabsAgentId, {
          name,
          systemPrompt: fullSystemPrompt,
          firstMessage: firstMessage || assistant.firstMessage,
          tone: tone || assistant.tone || 'professional'
        }, business);

        // Update voice and language settings
        await elevenLabsService.updateAgent(assistant.elevenLabsAgentId, {
          conversation_config: {
            agent: {
              language: elevenLabsLang
            },
            tts: {
              voice_id: elevenLabsVoiceId,
              model_id: 'eleven_turbo_v2_5',
              stability: 0.4,
              similarity_boost: 0.6,
              style: 0.15,
              optimize_streaming_latency: 3
            },
            stt: {
              language: elevenLabsLang
            }
          }
        });

        console.log('✅ 11Labs Agent updated with GATEWAY architecture');

        // Sync all phone numbers connected to this assistant in 11Labs
        const connectedPhones = await prisma.phoneNumber.findMany({
          where: {
            assistantId: id,
            elevenLabsPhoneId: { not: null }
          }
        });

        if (connectedPhones.length > 0) {
          console.log(`📞 Syncing ${connectedPhones.length} phone numbers to updated assistant`);
          for (const phone of connectedPhones) {
            try {
              await elevenLabsService.updatePhoneNumber(phone.elevenLabsPhoneId, assistant.elevenLabsAgentId);
              console.log(`✅ 11Labs Phone ${phone.phoneNumber} synced to agent`);
            } catch (syncErr) {
              console.error(`❌ Failed to sync phone ${phone.phoneNumber}:`, syncErr.message);
            }
          }
        }
      } catch (updateError) {
        console.error('❌ 11Labs update failed:', updateError.response?.data || updateError.message);
        // Don't fail the request, but warn in response
        return res.json({
          message: 'Assistant updated in database but 11Labs sync failed',
          assistant: updatedAssistant,
          warning: '11Labs sync failed: ' + (updateError.response?.data?.detail || updateError.message)
        });
      }
    } else {
      console.warn('⚠️ No elevenLabsAgentId found for assistant:', assistant.id);
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

    // ✅ YENİ: 11Labs'den de sil
    if (assistant.elevenLabsAgentId) {
      try {
        await elevenLabsService.deleteAgent(assistant.elevenLabsAgentId);
        console.log('✅ 11Labs Agent deleted:', assistant.elevenLabsAgentId);
      } catch (elevenLabsError) {
        console.error('11Labs delete error (continuing anyway):', elevenLabsError);
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

// GET /api/assistants/:id/debug - Debug 11Labs agent status
router.get('/:id/debug', authenticateToken, async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    const assistant = await prisma.assistant.findFirst({
      where: { id, businessId, isActive: true },
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    if (!assistant.elevenLabsAgentId) {
      return res.status(400).json({ error: 'No 11Labs agent ID' });
    }

    // Get agent from 11Labs
    const agent = await elevenLabsService.getAgent(assistant.elevenLabsAgentId);

    // Extract tool info
    const toolIds = agent.tool_ids || [];
    const inlineTools = agent.conversation_config?.agent?.prompt?.tools || [];

    res.json({
      assistant: {
        id: assistant.id,
        name: assistant.name,
        elevenLabsAgentId: assistant.elevenLabsAgentId,
        createdAt: assistant.createdAt
      },
      elevenLabs: {
        agentId: agent.agent_id,
        name: agent.name,
        tool_ids: toolIds,
        tool_ids_count: toolIds.length,
        inline_tools: inlineTools.map(t => ({ name: t.name, type: t.type })),
        inline_tools_count: inlineTools.length,
        hasToolIdsProblem: toolIds.length > 0,
        hasInlineTools: inlineTools.length > 0
      },
      diagnosis: toolIds.length > 0
        ? '⚠️ Agent uses tool_ids (may cause Unknown tool error). Run SYNC to fix.'
        : inlineTools.length > 0
          ? '✅ Agent uses inline tools (correct setup)'
          : '❌ Agent has no tools at all!'
    });
  } catch (error) {
    console.error('Debug error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/assistants/:id/sync - Sync assistant to 11Labs (fix tools)
router.post('/:id/sync', authenticateToken, checkPermission('assistants:edit'), async (req, res) => {
  try {
    const businessId = req.businessId;
    const { id } = req.params;

    // Get assistant with business info
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

    if (!assistant.elevenLabsAgentId) {
      return res.status(400).json({ error: 'Assistant has no 11Labs agent ID' });
    }

    // Get business with integrations
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      include: { integrations: { where: { isActive: true } } }
    });

    const lang = business?.language || 'TR';
    const elevenLabsLang = getElevenLabsLanguage(lang);
    const elevenLabsVoiceId = getElevenLabsVoiceId(assistant.voiceId, lang);

    console.log('🔄 Syncing assistant to 11Labs:', assistant.id, '->', assistant.elevenLabsAgentId);

    // First, check current agent state
    try {
      const currentAgent = await elevenLabsService.getAgent(assistant.elevenLabsAgentId);
      const currentToolIds = currentAgent.tool_ids || [];
      const currentInlineTools = currentAgent.conversation_config?.agent?.prompt?.tools || [];
      const architecture = currentAgent.metadata?.architecture;
      console.log('📊 CURRENT AGENT STATE:');
      console.log('   - tool_ids:', currentToolIds.length > 0 ? currentToolIds : 'none');
      console.log('   - inline_tools:', currentInlineTools.length > 0 ? currentInlineTools.map(t => t.name) : 'none');
      console.log('   - architecture:', architecture || 'legacy (multi-tool)');
      if (currentToolIds.length > 0) {
        console.log('   ⚠️ PROBLEM: Agent has tool_ids which may be broken!');
      }
      if (architecture !== 'gateway') {
        console.log('   🔄 Will migrate to GATEWAY architecture');
      }
    } catch (checkErr) {
      console.warn('⚠️ Could not check current agent state:', checkErr.message);
    }

    // ✅ Gateway mimarisi kullan - migrateToGateway ile senkronize et
    await elevenLabsService.migrateToGateway(assistant.elevenLabsAgentId, {
      name: assistant.name,
      systemPrompt: assistant.systemPrompt,
      firstMessage: assistant.firstMessage,
      tone: assistant.tone || 'professional'
    }, business);

    // Update voice and language settings
    await elevenLabsService.updateAgent(assistant.elevenLabsAgentId, {
      conversation_config: {
        agent: {
          language: elevenLabsLang
        },
        tts: {
          voice_id: elevenLabsVoiceId,
          model_id: 'eleven_turbo_v2_5',
          stability: 0.4,
          similarity_boost: 0.6,
          style: 0.15,
          optimize_streaming_latency: 3
        },
        stt: {
          language: elevenLabsLang
        }
      }
    });

    console.log('✅ 11Labs Agent synced with GATEWAY architecture');

    res.json({
      success: true,
      message: 'Assistant synced to 11Labs with GATEWAY architecture',
      architecture: 'gateway',
      tools: ['agent_gateway', 'end_call', 'voicemail_detection']
    });

  } catch (error) {
    console.error('Error syncing assistant:', error);
    res.status(500).json({ error: 'Failed to sync assistant: ' + (error.response?.data?.detail || error.message) });
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