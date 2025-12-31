/**
 * Chat Widget API
 * Handles text-based chat for embedded widget
 * WITH FUNCTION CALLING SUPPORT - Using Central Tool System
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getActiveTools, executeTool } from '../tools/index.js';
import { getDateTimeContext } from '../utils/dateTime.js';
import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from '../services/promptBuilder.js';

const router = express.Router();
const prisma = new PrismaClient();

// Lazy initialization
let openai = null;
const getOpenAI = () => {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
  return openai;
};

// POST /api/chat/widget - Public endpoint for widget
router.post('/widget', async (req, res) => {
  console.log('📨 Chat request received:', {
    body: req.body,
    businessId: req.businessId,
    headers: req.headers.authorization ? 'Auth present' : 'No auth'
  });
  try {
    const { assistantId, message, conversationHistory = [] } = req.body;

    if (!assistantId || !message) {
      return res.status(400).json({ error: 'assistantId and message are required' });
    }

    // Try to find assistant by internal ID first, then by vapiAssistantId (for backward compatibility)
    const assistant = await prisma.assistant.findFirst({
      where: {
        OR: [
          { id: assistantId },
          { vapiAssistantId: assistantId }
        ]
      },
      include: {
        business: {
          include: {
            integrations: {
              where: { isActive: true }
            }
          },
        }
      }
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    const business = assistant.business;
    const language = business?.language || 'TR';

    // Get active tools for this business from central tool system
    const tools = getActiveTools(business);
    console.log(`🔧 [Chat] Active tools for business ${business.id}: ${tools.map(t => t.function.name).join(', ') || 'none'}`);

    // Get active tools list for prompt builder
    const activeToolsList = getPromptBuilderTools(business, business.integrations || []);

    // Build system prompt using central prompt builder
    const systemPromptBase = buildAssistantPrompt(assistant, business, activeToolsList);

    // Add tool-specific instructions
    const toolInstructions = language === 'TR'
      ? `
Müşteri randevu almak isterse:
1. İsmini sor (verilmediyse)
2. Telefon numarasını sor
3. Hangi hizmeti istediğini sor
4. Tercih ettiği tarih ve saati sor
5. create_appointment fonksiyonunu kullanarak randevu oluştur`
      : `
When a customer wants to book an appointment:
1. Ask for their name if not provided
2. Ask for their phone number if not provided
3. Ask what service they want (if applicable)
4. Ask for their preferred date and time
5. Use the create_appointment function to book it`;

    // Build messages array
    const messages = [
      {
        role: 'system',
        content: `${systemPromptBase}

${toolInstructions}`
      },
      ...conversationHistory.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Call OpenAI with function calling (only if tools available)
    const completionParams = {
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 500,
      temperature: 0.7
    };

    // Add tools if available
    if (tools && tools.length > 0) {
      completionParams.tools = tools;
      completionParams.tool_choice = 'auto';
    }

    const completion = await getOpenAI().chat.completions.create(completionParams);

    const responseMessage = completion.choices[0]?.message;

    // Check if AI wants to call a tool
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      // Process all tool calls
      const toolResults = [];
      const toolNames = [];

      for (const toolCall of responseMessage.tool_calls) {
        const toolName = toolCall.function.name;
        const toolArgs = JSON.parse(toolCall.function.arguments);

        console.log(`🔧 [Chat] Executing tool: ${toolName}`, JSON.stringify(toolArgs));

        // Execute tool using central tool system
        const result = await executeTool(toolName, toolArgs, business, { channel: 'CHAT' });

        console.log(`🔧 [Chat] Tool result for ${toolName}:`, result.success ? 'SUCCESS' : 'FAILED', result);

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
        toolNames.push(toolName);
      }

      // Build assistant message with tool_calls - ensure content is empty string, not null
      const assistantMessage = {
        role: 'assistant',
        content: responseMessage.content || '',
        tool_calls: responseMessage.tool_calls
      };

      // Send result back to AI to generate final response
      const secondMessages = [
        ...messages,
        assistantMessage,
        ...toolResults
      ];

      const secondCompletion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: secondMessages,
        max_tokens: 500,
        temperature: 0.7
      });

      const finalReply = secondCompletion.choices[0]?.message?.content;

      return res.json({
        success: true,
        reply: finalReply,
        assistantName: assistant.name,
        toolCalled: toolNames.join(', '),
        toolResult: toolResults.every(r => JSON.parse(r.content).success)
      });
    }

    // No tool call, just return the text response
    const reply = responseMessage?.content || 'Sorry, I could not generate a response.';

    res.json({
      success: true,
      reply: reply,
      assistantName: assistant.name
    });

  } catch (error) {
    console.error('Chat widget error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// GET /api/chat/assistant/:assistantId
router.get('/assistant/:assistantId', async (req, res) => {
  try {
    const { assistantId } = req.params;

    // Try to find assistant by internal ID first, then by vapiAssistantId (for backward compatibility)
    const assistant = await prisma.assistant.findFirst({
      where: {
        OR: [
          { id: assistantId },
          { vapiAssistantId: assistantId }
        ]
      },
      select: {
        name: true,
        business: {
          select: { name: true }
        }
      }
    });

    if (!assistant) {
      return res.status(404).json({ error: 'Assistant not found' });
    }

    res.json({
      name: assistant.name,
      businessName: assistant.business?.name || ''
    });

  } catch (error) {
    console.error('Get assistant error:', error);
    res.status(500).json({ error: 'Failed to get assistant info' });
  }
});

export default router;
