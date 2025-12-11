/**
 * Email AI Service
 * Generates AI draft responses using OpenAI
 */

import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

class EmailAIService {
  /**
   * Generate a draft reply for an incoming email
   */
  async generateDraft(businessId, thread, incomingMessage) {
    try {
      // Get business info
      const business = await prisma.business.findUnique({
        where: { id: businessId },
        include: {
          assistants: {
            where: { isActive: true },
            take: 1
          }
        }
      });

      if (!business) {
        throw new Error('Business not found');
      }

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

      // Detect language from incoming message
      const language = this.detectLanguage(incomingMessage.bodyText || incomingMessage.subject);

      // Build the prompt
      const systemPrompt = this.buildSystemPrompt({
        businessName,
        businessType,
        assistantPrompt,
        language
      });

      const userPrompt = this.buildUserPrompt({
        subject: incomingMessage.subject,
        from: incomingMessage.fromEmail,
        fromName: incomingMessage.fromName,
        body: incomingMessage.bodyText,
        threadHistory
      });

      // Call OpenAI
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      });

      const draftContent = response.choices[0]?.message?.content || '';

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

      return draft;
    } catch (error) {
      console.error('Generate draft error:', error);
      throw error;
    }
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
              assistants: {
                where: { isActive: true },
                take: 1
              }
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

      // Get thread history
      const threadHistory = await prisma.emailMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
        take: 5
      });

      const language = this.detectLanguage(incomingMessage?.bodyText || thread.subject);

      const systemPrompt = this.buildSystemPrompt({
        businessName: business.name,
        businessType: business.businessType,
        assistantPrompt: business.assistants[0]?.systemPrompt || '',
        language
      });

      let userPrompt = this.buildUserPrompt({
        subject: thread.subject,
        from: thread.customerEmail,
        fromName: thread.customerName,
        body: incomingMessage?.bodyText || '',
        threadHistory
      });

      // Add feedback for regeneration
      if (feedback) {
        userPrompt += `\n\n--- FEEDBACK ---\nThe previous draft was not satisfactory. Please regenerate with these considerations:\n${feedback}`;
      }

      userPrompt += `\n\n--- PREVIOUS DRAFT ---\n${existingDraft.generatedContent}`;

      // Call OpenAI
      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 1000
      });

      const newContent = response.choices[0]?.message?.content || '';

      // Update draft
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
   * Analyze email intent
   */
  async analyzeIntent(message) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are an email classifier. Classify the following email into one of these categories:
- INQUIRY: General question or information request
- SUPPORT: Technical issue or complaint
- APPOINTMENT: Scheduling or booking request
- PRICING: Price or quote inquiry
- FEEDBACK: Customer feedback or review
- ORDER: Order status or purchase related
- OTHER: Anything else

Respond with only the category name.`
          },
          {
            role: 'user',
            content: `Subject: ${message.subject}\n\n${message.bodyText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 50
      });

      return response.choices[0]?.message?.content?.trim() || 'OTHER';
    } catch (error) {
      console.error('Analyze intent error:', error);
      return 'OTHER';
    }
  }

  /**
   * Suggest quick replies
   */
  async suggestQuickReplies(thread, message) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Generate 3 short, professional quick reply options for this email. Each reply should be 1-2 sentences max. Return as a JSON array of strings.`
          },
          {
            role: 'user',
            content: `Subject: ${message.subject}\n\n${message.bodyText}`
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const content = response.choices[0]?.message?.content || '[]';
      return JSON.parse(content);
    } catch (error) {
      console.error('Suggest quick replies error:', error);
      return [
        'Thank you for your email. We will get back to you shortly.',
        'We have received your message and are looking into it.',
        'Thank you for reaching out. How can we assist you further?'
      ];
    }
  }

  /**
   * Build system prompt for draft generation
   */
  buildSystemPrompt({ businessName, businessType, assistantPrompt, language }) {
    const languageInstruction = language === 'TR'
      ? 'Respond in Turkish (Turkce).'
      : 'Respond in the same language as the incoming email.';

    return `You are an AI email assistant for ${businessName}, a ${businessType.toLowerCase()} business.

${assistantPrompt ? `Business Instructions:\n${assistantPrompt}\n` : ''}

Your task is to draft professional email responses on behalf of the business.

Guidelines:
1. ${languageInstruction}
2. Be professional but friendly
3. Address the customer's questions/concerns directly
4. Keep responses concise but helpful
5. Use appropriate greetings and sign-offs
6. Do NOT include a signature (it will be added automatically)
7. If you need more information to provide a complete answer, ask politely
8. Never make promises you can't keep (e.g., specific dates, discounts)
9. For complex issues, suggest a phone call or in-person meeting

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
   * Simple language detection
   */
  detectLanguage(text) {
    if (!text) return 'EN';

    // Turkish-specific characters and common words
    const turkishIndicators = [
      'merhaba', 'tesekkur', 'lutfen', 'nasil', 'iyi gunler',
      'sayin', 'rica', 'bilgi', 'hakkinda', 'musteri',
      'sikayet', 'randevu', 'fiyat', 'urun', 'hizmet',
      'bugun', 'yarin', 'hafta', 'gun', 'saat'
    ];

    const lowerText = text.toLowerCase();

    // Check for Turkish characters
    if (/[ığüşöçİĞÜŞÖÇ]/.test(text)) {
      return 'TR';
    }

    // Check for Turkish words
    for (const word of turkishIndicators) {
      if (lowerText.includes(word)) {
        return 'TR';
      }
    }

    return 'EN';
  }

  /**
   * Get draft by ID
   */
  async getDraft(draftId) {
    return await prisma.emailDraft.findUnique({
      where: { id: draftId },
      include: {
        thread: true,
        message: true
      }
    });
  }

  /**
   * Update draft content
   */
  async updateDraft(draftId, content) {
    return await prisma.emailDraft.update({
      where: { id: draftId },
      data: { editedContent: content }
    });
  }

  /**
   * Approve draft
   */
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

  /**
   * Mark draft as sent
   */
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

  /**
   * Reject draft
   */
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

  /**
   * Get pending drafts for a business
   */
  async getPendingDrafts(businessId) {
    return await prisma.emailDraft.findMany({
      where: {
        businessId,
        status: 'PENDING_REVIEW'
      },
      include: {
        thread: true,
        message: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }
}

export default new EmailAIService();
