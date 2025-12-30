// ============================================================================
// EMAIL STYLE ANALYZER SERVICE
// ============================================================================
// Analyzes user's sent emails to learn their writing style
// ============================================================================

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { getGmailService } from './gmail.js';
import { getOutlookService } from './outlook.js';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze user's writing style from sent emails
 * @param {number} businessId - Business ID
 * @returns {Promise<object>} Style profile
 */
export async function analyzeWritingStyle(businessId) {
  console.log(`[Style Analyzer] Starting analysis for business ${businessId}`);

  // Get email integration
  const integration = await prisma.emailIntegration.findUnique({
    where: { businessId },
  });

  if (!integration) {
    throw new Error('Email integration not found');
  }

  // Update status to processing
  await prisma.emailIntegration.update({
    where: { id: integration.id },
    data: { styleAnalysisStatus: 'PROCESSING' },
  });

  try {
    // Fetch sent emails based on provider
    let sentEmails = [];

    if (integration.provider === 'GMAIL') {
      sentEmails = await fetchGmailSentEmails(integration, 100);
    } else if (integration.provider === 'OUTLOOK') {
      sentEmails = await fetchOutlookSentEmails(integration, 100);
    }

    if (sentEmails.length === 0) {
      console.log(`[Style Analyzer] No sent emails found for business ${businessId}`);
      await prisma.emailIntegration.update({
        where: { id: integration.id },
        data: {
          styleAnalysisStatus: 'COMPLETED',
          styleAnalyzedAt: new Date(),
          styleProfile: {
            error: 'No sent emails found',
            analyzed: false,
          },
        },
      });
      return null;
    }

    console.log(`[Style Analyzer] Fetched ${sentEmails.length} sent emails for analysis`);

    // Analyze emails with AI
    const styleProfile = await analyzeEmailsWithAI(sentEmails);

    // Save profile
    await prisma.emailIntegration.update({
      where: { id: integration.id },
      data: {
        styleProfile,
        styleAnalysisStatus: 'COMPLETED',
        styleAnalyzedAt: new Date(),
      },
    });

    console.log(`[Style Analyzer] Analysis completed for business ${businessId}`);
    return styleProfile;
  } catch (error) {
    console.error(`[Style Analyzer] Error analyzing style for business ${businessId}:`, error);

    await prisma.emailIntegration.update({
      where: { id: integration.id },
      data: {
        styleAnalysisStatus: 'FAILED',
        styleProfile: {
          error: error.message,
          analyzed: false,
        },
      },
    });

    throw error;
  }
}

/**
 * Fetch sent emails from Gmail
 */
async function fetchGmailSentEmails(integration, limit = 100) {
  try {
    const gmailService = await getGmailService(integration);
    if (!gmailService) return [];

    // Get message list from Sent folder
    const listResponse = await gmailService.users.messages.list({
      userId: 'me',
      labelIds: ['SENT'],
      maxResults: limit,
    });

    if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
      return [];
    }

    // Fetch message details (body text)
    const emails = [];
    const messageIds = listResponse.data.messages.slice(0, limit);

    for (const msg of messageIds) {
      try {
        const msgResponse = await gmailService.users.messages.get({
          userId: 'me',
          id: msg.id,
          format: 'full',
        });

        const headers = msgResponse.data.payload?.headers || [];
        const subject = headers.find((h) => h.name === 'Subject')?.value || '';
        const to = headers.find((h) => h.name === 'To')?.value || '';

        // Extract body text
        let bodyText = '';
        const payload = msgResponse.data.payload;

        if (payload.body?.data) {
          bodyText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload.parts) {
          const textPart = payload.parts.find(
            (p) => p.mimeType === 'text/plain' && p.body?.data
          );
          if (textPart) {
            bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        if (bodyText) {
          emails.push({
            subject,
            to,
            body: bodyText.substring(0, 2000), // Limit body length
          });
        }
      } catch (msgError) {
        console.warn(`[Style Analyzer] Failed to fetch message ${msg.id}:`, msgError.message);
      }
    }

    return emails;
  } catch (error) {
    console.error('[Style Analyzer] Gmail fetch error:', error);
    return [];
  }
}

/**
 * Fetch sent emails from Outlook
 */
async function fetchOutlookSentEmails(integration, limit = 100) {
  try {
    const outlookService = await getOutlookService(integration);
    if (!outlookService) return [];

    // Get sent items
    const response = await outlookService
      .api('/me/mailFolders/sentitems/messages')
      .select('subject,toRecipients,body')
      .top(limit)
      .get();

    if (!response.value || response.value.length === 0) {
      return [];
    }

    return response.value.map((msg) => ({
      subject: msg.subject || '',
      to: msg.toRecipients?.map((r) => r.emailAddress?.address).join(', ') || '',
      body: msg.body?.content?.substring(0, 2000) || '',
    }));
  } catch (error) {
    console.error('[Style Analyzer] Outlook fetch error:', error);
    return [];
  }
}

/**
 * Analyze emails with OpenAI to extract writing style
 */
async function analyzeEmailsWithAI(emails) {
  // Prepare email samples for analysis
  const emailSamples = emails
    .slice(0, 50) // Limit to 50 for token management
    .map((e, i) => `--- Email ${i + 1} ---\nSubject: ${e.subject}\nBody:\n${e.body}`)
    .join('\n\n');

  const prompt = `Analyze the following ${emails.length} sent emails and create a detailed writing style profile for the author.

${emailSamples}

Based on these emails, provide a JSON object with the following structure:
{
  "formality": "formal" | "semi-formal" | "informal",
  "greetingPatterns": ["array of 3-5 most common greetings used"],
  "closingPatterns": ["array of 3-5 most common closings/sign-offs used"],
  "averageLength": "short" | "medium" | "long",
  "language": "tr" | "en" | "mixed",
  "tone": "professional" | "friendly" | "direct" | "warm",
  "additionalNotes": "Other notable characteristics (emoji usage, punctuation style, signature style, etc.)",
  "analyzed": true,
  "sampleCount": ${emails.length}
}

Respond ONLY with the JSON object, no other text.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert at analyzing writing styles. Analyze the emails and return a JSON profile. Respond only with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content?.trim();

    // Parse JSON response
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error('[Style Analyzer] Failed to parse AI response:', parseError);
    }

    // Default profile if parsing fails
    return {
      formality: 'semi-formal',
      greetingPatterns: ['Merhaba', 'İyi günler'],
      closingPatterns: ['Saygılarımla', 'İyi çalışmalar'],
      averageLength: 'medium',
      language: 'tr',
      tone: 'professional',
      additionalNotes: 'Unable to fully analyze - using defaults',
      analyzed: false,
      sampleCount: emails.length,
    };
  } catch (error) {
    console.error('[Style Analyzer] OpenAI API error:', error);
    throw error;
  }
}

/**
 * Get style profile for a business
 */
export async function getStyleProfile(businessId) {
  const integration = await prisma.emailIntegration.findUnique({
    where: { businessId },
    select: {
      styleProfile: true,
      styleAnalysisStatus: true,
      styleAnalyzedAt: true,
    },
  });

  return integration;
}

/**
 * Trigger re-analysis of writing style
 */
export async function reanalyzeWritingStyle(businessId) {
  // Reset status and trigger analysis
  await prisma.emailIntegration.update({
    where: { businessId },
    data: {
      styleAnalysisStatus: 'PENDING',
      styleProfile: null,
      styleAnalyzedAt: null,
    },
  });

  // Run analysis in background
  setImmediate(() => {
    analyzeWritingStyle(businessId).catch((err) => {
      console.error(`[Style Analyzer] Background analysis failed:`, err);
    });
  });

  return { message: 'Style re-analysis started' };
}

export default {
  analyzeWritingStyle,
  getStyleProfile,
  reanalyzeWritingStyle,
};
