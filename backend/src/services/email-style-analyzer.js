// ============================================================================
// EMAIL STYLE ANALYZER SERVICE
// ============================================================================
// Analyzes user's sent emails to learn their writing style
// ============================================================================

import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { google } from 'googleapis';

const prisma = new PrismaClient();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Create authenticated Gmail API client for a business
 */
async function getAuthenticatedGmailClient(integration) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );

  oauth2Client.setCredentials(integration.credentials);

  // Handle token refresh if needed
  if (integration.credentials.expiry_date && Date.now() >= integration.credentials.expiry_date) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      await prisma.emailIntegration.update({
        where: { id: integration.id },
        data: { credentials }
      });
      oauth2Client.setCredentials(credentials);
    } catch (error) {
      console.error('[Style Analyzer] Token refresh failed:', error);
      throw error;
    }
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

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
    // Fetch sent emails based on provider (last 30 days, up to 150 emails)
    let sentEmails = [];

    if (integration.provider === 'GMAIL') {
      sentEmails = await fetchGmailSentEmails(integration, 150);
    } else if (integration.provider === 'OUTLOOK') {
      sentEmails = await fetchOutlookSentEmails(integration, 150);
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
 * Fetch sent emails from Gmail (last 30 days)
 */
async function fetchGmailSentEmails(integration, limit = 150) {
  try {
    const gmail = await getAuthenticatedGmailClient(integration);
    if (!gmail) return [];

    // Get sent emails from last 30 days
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);

    // Get message list from Sent folder
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      labelIds: ['SENT'],
      maxResults: limit,
      q: `after:${thirtyDaysAgo}`, // Only last 30 days
    });

    if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
      return [];
    }

    // Fetch message details (body text)
    const emails = [];
    const messageIds = listResponse.data.messages.slice(0, limit);

    for (const msg of messageIds) {
      try {
        const msgResponse = await gmail.users.messages.get({
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
 * Note: Outlook integration is not yet fully implemented
 */
async function fetchOutlookSentEmails(integration, limit = 100) {
  // TODO: Implement Outlook Graph API integration
  // For now, return empty array as Outlook is not yet supported
  console.warn('[Style Analyzer] Outlook style analysis not yet implemented');
  return [];
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
