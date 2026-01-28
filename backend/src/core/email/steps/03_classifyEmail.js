/**
 * Step 3: Classify Email
 *
 * Classifies the inbound email to determine:
 * - Intent/topic (order, billing, ticket, appointment, general, etc.)
 * - Urgency level
 * - Whether tools are needed
 * - Language confirmation
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_KEY);

// Classification prompt
const CLASSIFICATION_PROMPT = `You are an email classifier for a business assistant.

Analyze this email and return a JSON object with:
- intent: One of [ORDER, BILLING, APPOINTMENT, SUPPORT, COMPLAINT, INQUIRY, FOLLOW_UP, CONFIRMATION, THANK_YOU, GENERAL]
- urgency: One of [LOW, MEDIUM, HIGH, URGENT]
- needs_tools: Boolean - does this email require looking up customer/order data?
- topic: Brief 2-3 word topic description
- sentiment: One of [POSITIVE, NEUTRAL, NEGATIVE]
- actionable: Boolean - does this email require a response or action?

Examples:
- "Where is my order #12345?" → intent: ORDER, needs_tools: true, urgency: MEDIUM
- "Thanks for your help!" → intent: THANK_YOU, needs_tools: false, urgency: LOW
- "I need to reschedule my appointment" → intent: APPOINTMENT, needs_tools: true, urgency: MEDIUM
- "Your service is terrible, I want a refund" → intent: COMPLAINT, needs_tools: true, urgency: HIGH

Return ONLY valid JSON, no markdown or explanation.`;

/**
 * Classify the inbound email
 *
 * @param {Object} ctx - Pipeline context
 * @returns {Promise<Object>} { success, error? }
 */
export async function classifyEmail(ctx) {
  const { inboundMessage, subject, customerName } = ctx;

  try {
    const emailContent = `
From: ${customerName || 'Customer'} <${ctx.customerEmail}>
Subject: ${subject}

${inboundMessage.bodyText || ''}
`.trim();

    // Use Gemini Flash for fast classification
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
        responseMimeType: 'application/json'
      }
    });

    const prompt = `${CLASSIFICATION_PROMPT}

Email to classify:
---
${emailContent}
---

JSON response:`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse JSON response
    let classification;
    try {
      // Clean response if needed
      const cleanedResponse = responseText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

      classification = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.warn('⚠️ [ClassifyEmail] Failed to parse classification, using defaults');
      classification = getDefaultClassification();
    }

    // Validate and normalize
    ctx.classification = normalizeClassification(classification);

    console.log(`📧 [ClassifyEmail] Intent: ${ctx.classification.intent}, Urgency: ${ctx.classification.urgency}`);
    console.log(`📧 [ClassifyEmail] Needs tools: ${ctx.classification.needs_tools}, Actionable: ${ctx.classification.actionable}`);

    return { success: true };

  } catch (error) {
    console.error('❌ [ClassifyEmail] Error:', error);

    // Use default classification on error (fail-open for classification)
    ctx.classification = getDefaultClassification();

    console.warn('⚠️ [ClassifyEmail] Using default classification due to error');
    return { success: true }; // Don't fail the pipeline for classification errors
  }
}

/**
 * Get default classification for fallback
 */
function getDefaultClassification() {
  return {
    intent: 'GENERAL',
    urgency: 'MEDIUM',
    needs_tools: false,
    topic: 'General inquiry',
    sentiment: 'NEUTRAL',
    actionable: true,
    confidence: 0.5
  };
}

/**
 * Normalize and validate classification
 */
function normalizeClassification(raw) {
  const validIntents = ['ORDER', 'BILLING', 'APPOINTMENT', 'SUPPORT', 'COMPLAINT', 'INQUIRY', 'FOLLOW_UP', 'CONFIRMATION', 'THANK_YOU', 'GENERAL'];
  const validUrgencies = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const validSentiments = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];

  return {
    intent: validIntents.includes(raw.intent?.toUpperCase())
      ? raw.intent.toUpperCase()
      : 'GENERAL',
    urgency: validUrgencies.includes(raw.urgency?.toUpperCase())
      ? raw.urgency.toUpperCase()
      : 'MEDIUM',
    needs_tools: Boolean(raw.needs_tools),
    topic: raw.topic || 'General',
    sentiment: validSentiments.includes(raw.sentiment?.toUpperCase())
      ? raw.sentiment.toUpperCase()
      : 'NEUTRAL',
    actionable: raw.actionable !== false, // Default to actionable
    confidence: raw.confidence || 0.8
  };
}

export default { classifyEmail };
