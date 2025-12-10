/**
 * Call Analysis Service
 * Uses OpenAI to analyze call transcripts and generate summaries, topics, actions, and sentiment
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze a call transcript using OpenAI GPT-4o-mini
 * @param {Array} messages - Array of transcript messages [{speaker, text, timestamp}]
 * @param {number} duration - Call duration in seconds
 * @returns {Promise<Object>} Analysis results with summary, topics, actions, and sentiment
 */
export async function analyzeCall(messages, duration) {
  try {
    if (!messages || messages.length === 0) {
      return {
        summary: null,
        keyTopics: [],
        actionItems: [],
        sentiment: 'neutral',
        sentimentScore: 0.5,
      };
    }

    // Format transcript for analysis
    const transcriptText = messages
      .map((msg) => `${msg.speaker === 'assistant' ? 'AI' : 'Customer'}: ${msg.text}`)
      .join('\n');

    // Create analysis prompt
    const prompt = `Analyze the following customer service call transcript and provide:
1. A brief summary (1-2 sentences)
2. Key topics discussed (max 5, as array)
3. Action items identified (max 5, as array)
4. Overall sentiment (positive/neutral/negative)
5. Sentiment score (0.0 to 1.0, where 0.0 is very negative and 1.0 is very positive)

Call duration: ${Math.round(duration / 60)} minutes

Transcript:
${transcriptText}

Respond in JSON format:
{
  "summary": "Brief summary of the call",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "actionItems": ["action1", "action2"],
  "sentiment": "positive|neutral|negative",
  "sentimentScore": 0.0-1.0
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a call analysis assistant. Analyze call transcripts and provide structured insights in JSON format.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const analysis = JSON.parse(response.choices[0].message.content);

    // Validate and normalize the response
    return {
      summary: analysis.summary || null,
      keyTopics: Array.isArray(analysis.keyTopics) ? analysis.keyTopics.slice(0, 5) : [],
      actionItems: Array.isArray(analysis.actionItems) ? analysis.actionItems.slice(0, 5) : [],
      sentiment: ['positive', 'neutral', 'negative'].includes(analysis.sentiment)
        ? analysis.sentiment
        : 'neutral',
      sentimentScore: typeof analysis.sentimentScore === 'number'
        ? Math.max(0, Math.min(1, analysis.sentimentScore))
        : 0.5,
    };
  } catch (error) {
    console.error('❌ Call analysis error:', error);

    // Return default values on error
    return {
      summary: null,
      keyTopics: [],
      actionItems: [],
      sentiment: 'neutral',
      sentimentScore: 0.5,
    };
  }
}

/**
 * Generate a quick summary of a call (lightweight version)
 * @param {string} transcriptText - Plain text transcript
 * @returns {Promise<string>} Summary text
 */
export async function generateQuickSummary(transcriptText) {
  try {
    if (!transcriptText || transcriptText.trim().length === 0) {
      return null;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a call summarization assistant. Create brief, one-sentence summaries of customer service calls.',
        },
        {
          role: 'user',
          content: `Summarize this call in one sentence:\n\n${transcriptText.slice(0, 2000)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 100,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('❌ Quick summary error:', error);
    return null;
  }
}

/**
 * Extract plain text from transcript messages for search
 * @param {Array} messages - Array of transcript messages
 * @returns {string} Plain text transcript
 */
export function extractTranscriptText(messages) {
  if (!messages || !Array.isArray(messages)) {
    return '';
  }

  return messages
    .map((msg) => msg.text || '')
    .join(' ')
    .trim();
}

export default {
  analyzeCall,
  generateQuickSummary,
  extractTranscriptText,
};
