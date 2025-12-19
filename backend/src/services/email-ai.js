/**
 * Email AI Service
 * Generates AI draft responses using OpenAI with Function Calling
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { getDateTimeContext } from '../utils/dateTime.js';
import { getActiveTools, executeTool } from '../tools/index.js';
import { buildAssistantPrompt, getActiveTools as getPromptBuilderTools } from './promptBuilder.js';

const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// ============================================================
// TOOL DEFINITIONS - Using Central Tool System
// ============================================================
// Tools are now managed centrally in ../tools/index.js
// This ensures consistency across all channels (Chat, WhatsApp, Email, Phone)

class EmailAIService {
  /**
   * Generate a draft reply for an incoming email
   */
  async generateDraft(businessId, thread, incomingMessage) {
    try {
      // Get business info with integrations
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          assistants: {
            where: { isActive: true },
            take: 1
          },
          integrations: {
            where: { isActive: true }
          }
        }
      });

      if (!business) {
        throw new Error('Business not found');
      }

      // Get Knowledge Base content
      const knowledgeItems = await prisma.knowledgeBase.findMany({
        where: { businessId, status: 'ACTIVE' }
      });

      // Get thread history (last 5 messages for context)
      const threadHistory = await prisma.emailMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
        take: 5
      });

      // Build context
      const businessName = business.name;
      const businessType = business.businessType;
      const assistantPrompt = business.assistants[0]?.systemPrompt || '';
      const language = business.language || this.detectLanguage(incomingMessage.bodyText || incomingMessage.subject);
      const timezone = business.timezone || 'UTC';

      // Build Knowledge Base context
      const knowledgeContext = this.buildKnowledgeContext(knowledgeItems);

      // Build the prompt using central prompt builder
      const assistant = business.assistants[0] || null;
      const systemPrompt = this.buildSystemPrompt({
        businessName,
        businessType,
        assistantPrompt,
        language,
        timezone,
        knowledgeContext,
        business,
        assistant
      });

      const userPrompt = this.buildUserPrompt({
        subject: incomingMessage.subject,
        from: incomingMessage.fromEmail,
        fromName: incomingMessage.fromName,
        body: incomingMessage.bodyText,
        threadHistory
      });

      // Get active tools for this business
      const activeTools = getActiveTools(business);
      console.log('📧 Email AI - Active tools:', activeTools.map(t => t.function.name));

      // Call OpenAI with tools
      const completionParams = {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      };

      // Add tools if available
      if (activeTools.length > 0) {
        completionParams.tools = activeTools;
        completionParams.tool_choice = 'auto';
      }

      let response = await openai.chat.completions.create(completionParams);
      let responseMessage = response.choices[0]?.message;

      // Handle tool calls
      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        console.log('🔧 Email tool calls detected:', responseMessage.tool_calls.length);

        const toolResponses = [];
        for (const toolCall of responseMessage.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);
          
          console.log('🔧 Executing tool:', functionName, functionArgs);
          
          const result = await this.executeToolCall(business, functionName, functionArgs, thread.customerEmail);
          
          toolResponses.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(result)
          });
        }

        // Get final response with tool results
        const secondResponse = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
            {
              role: 'assistant',
              content: responseMessage.content || null,
              tool_calls: responseMessage.tool_calls
            },
            ...toolResponses
          ],
          temperature: 0.7,
          max_tokens: 1000
        });

        responseMessage = secondResponse.choices[0]?.message;
      }

      const draftContent = responseMessage?.content || '';

      // Save draft to database
      const draft = await prisma.emailDraft.create({
        data: {
          messageId: incomingMessage.id,
          threadId: thread.id,
          businessId,
          generatedContent: draftContent,
          status: 'PENDING_REVIEW'
        }
      });

      // Update thread status
      await prisma.emailThread.update({
        where: { id: thread.id },
        data: { status: 'DRAFT_READY' }
      });

      console.log('✅ Email draft generated:', draft.id);
      return draft;
    } catch (error) {
      console.error('Generate draft error:', error);
      throw error;
    }
  }

  /**
   * Execute tool call using central tool system
   */
  async executeToolCall(business, functionName, args, customerEmail) {
    // Use central tool system for consistency across all channels
    return await executeTool(functionName, args, business, {
      channel: 'EMAIL',
      customerEmail
    });
  }

  // NOTE: Tool execution is now handled by the central tool system (../tools/index.js)
  // This ensures consistency across all channels: Chat, WhatsApp, Email, Phone

  /**
   * Build Knowledge Base context
   */
  buildKnowledgeContext(knowledgeItems) {
    if (!knowledgeItems || knowledgeItems.length === 0) return '';

    const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };

    for (const item of knowledgeItems) {
      if (item.type === 'FAQ' && item.question && item.answer) {
        kbByType.FAQ.push(`Q: ${item.question}\nA: ${item.answer}`);
      } else if (item.content) {
        kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 1000)}`);
      }
    }

    let context = '';
    if (kbByType.FAQ.length > 0) {
      context += '\n\n=== FREQUENTLY ASKED QUESTIONS ===\n' + kbByType.FAQ.join('\n\n');
    }
    if (kbByType.URL.length > 0) {
      context += '\n\n=== WEBSITE CONTENT ===\n' + kbByType.URL.join('\n\n');
    }
    if (kbByType.DOCUMENT.length > 0) {
      context += '\n\n=== DOCUMENTS ===\n' + kbByType.DOCUMENT.join('\n\n');
    }

    return context;
  }

  /**
   * Build system prompt for draft generation
   * Now uses the central promptBuilder service
   */
  buildSystemPrompt({ businessName, businessType, assistantPrompt, language, timezone, knowledgeContext, business, assistant }) {
    const languageInstruction = language === 'TR'
      ? 'Her zaman Türkçe yanıt ver.'
      : 'Always respond in English.';

    // Use central prompt builder if business and assistant are available
    let basePrompt = '';
    if (business && assistant) {
      const activeToolsList = getPromptBuilderTools(business, business.integrations || []);
      basePrompt = buildAssistantPrompt(assistant, business, activeToolsList);
    } else {
      // Fallback to basic prompt
      const dateTimeContext = getDateTimeContext(timezone, language);
      basePrompt = `You are an AI email assistant for ${businessName}, a ${businessType?.toLowerCase() || 'general'} business.

${dateTimeContext}

${assistantPrompt ? `Business Instructions:\n${assistantPrompt}\n` : ''}`;
    }

    return `${basePrompt}

${knowledgeContext ? `\n=== KNOWLEDGE BASE ===${knowledgeContext}\n` : ''}

## EMAIL-SPECIFIC GUIDELINES:
1. ${languageInstruction}
2. Be professional but friendly
3. Address the customer's questions/concerns directly
4. Keep responses concise but helpful
5. Use appropriate greetings and sign-offs
6. Do NOT include a signature (it will be added automatically)
7. If you need more information, ask politely
8. Never make promises you can't keep
9. Use the available tools to check order status, appointments, etc.

Format:
- Start with a greeting using the customer's name if available
- Address their main points
- End with a helpful closing (without signature)`;
  }

  /**
   * Build user prompt with context
   */
  buildUserPrompt({ subject, from, fromName, body, threadHistory }) {
    let prompt = `Please draft a reply to this email:\n\n`;
    prompt += `From: ${fromName ? `${fromName} <${from}>` : from}\n`;
    prompt += `Subject: ${subject}\n\n`;
    prompt += `Email Content:\n${body}\n`;

    if (threadHistory && threadHistory.length > 1) {
      prompt += `\n\n--- PREVIOUS CONVERSATION ---\n`;
      for (const msg of threadHistory.slice(0, -1)) {
        const direction = msg.direction === 'INBOUND' ? 'Customer' : 'Us';
        prompt += `\n[${direction}]: ${msg.bodyText?.substring(0, 500)}...\n`;
      }
    }

    return prompt;
  }

  /**
   * Regenerate a draft with optional feedback
   */
  async regenerateDraft(draftId, feedback = null) {
    try {
      const existingDraft = await prisma.emailDraft.findUnique({
        where: { id: draftId },
        include: {
          thread: true,
          message: true,
          business: {
            include: {
              assistants: { where: { isActive: true }, take: 1 },
              integrations: { where: { isActive: true } }
            }
          }
        }
      });

      if (!existingDraft) {
        throw new Error('Draft not found');
      }

      const business = existingDraft.business;
      const thread = existingDraft.thread;
      const incomingMessage = existingDraft.message;

      // Get Knowledge Base
      const knowledgeItems = await prisma.knowledgeBase.findMany({
        where: { businessId: business.id, status: 'ACTIVE' }
      });

      // Get thread history
      const threadHistory = await prisma.emailMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
        take: 5
      });

      const language = business.language || this.detectLanguage(incomingMessage?.bodyText || thread.subject);
      const knowledgeContext = this.buildKnowledgeContext(knowledgeItems);
      const assistant = business.assistants[0] || null;

      const systemPrompt = this.buildSystemPrompt({
        businessName: business.name,
        businessType: business.businessType,
        assistantPrompt: assistant?.systemPrompt || '',
        language,
        timezone: business.timezone || 'UTC',
        knowledgeContext,
        business,
        assistant
      });

      let userPrompt = this.buildUserPrompt({
        subject: thread.subject,
        from: thread.customerEmail,
        fromName: thread.customerName,
        body: incomingMessage?.bodyText || '',
        threadHistory
      });

      if (feedback) {
        userPrompt += `\n\n--- FEEDBACK ---\nPlease regenerate with these considerations:\n${feedback}`;
      }

      userPrompt += `\n\n--- PREVIOUS DRAFT ---\n${existingDraft.generatedContent}`;

      // Call OpenAI
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });

      const newContent = response.choices[0]?.message?.content || '';

      const updatedDraft = await prisma.emailDraft.update({
        where: { id: draftId },
        data: {
          generatedContent: newContent,
          editedContent: null,
          status: 'PENDING_REVIEW'
        }
      });

      return updatedDraft;
    } catch (error) {
      console.error('Regenerate draft error:', error);
      throw error;
    }
  }

  /**
   * Simple language detection
   */
  detectLanguage(text) {
    if (!text) return 'EN';

    const turkishIndicators = [
      'merhaba', 'tesekkur', 'lutfen', 'nasil', 'iyi gunler',
      'sayin', 'rica', 'bilgi', 'hakkinda', 'musteri',
      'sikayet', 'randevu', 'fiyat', 'urun', 'hizmet'
    ];

    const lowerText = text.toLowerCase();

    if (/[ığüşöçİĞÜŞÖÇ]/.test(text)) return 'TR';

    for (const word of turkishIndicators) {
      if (lowerText.includes(word)) return 'TR';
    }

    return 'EN';
  }

  // ==================== EXISTING METHODS ====================

  async getDraft(draftId) {
    return await prisma.emailDraft.findUnique({
      where: { id: draftId },
      include: { thread: true, message: true }
    });
  }

  async updateDraft(draftId, content) {
    return await prisma.emailDraft.update({
      where: { id: draftId },
      data: { editedContent: content }
    });
  }

  async approveDraft(draftId, userId) {
    return await prisma.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: userId
      }
    });
  }

  async markDraftSent(draftId, sentMessageId) {
    return await prisma.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        sentMessageId
      }
    });
  }

  async rejectDraft(draftId, userId) {
    return await prisma.emailDraft.update({
      where: { id: draftId },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: userId
      }
    });
  }

  async getPendingDrafts(businessId) {
    return await prisma.emailDraft.findMany({
      where: { businessId, status: 'PENDING_REVIEW' },
      include: { thread: true, message: true },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export default new EmailAIService();