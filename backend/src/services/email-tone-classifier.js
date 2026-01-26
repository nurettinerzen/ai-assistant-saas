/**
 * Email Tone Classifier
 *
 * Hybrid approach:
 * 1. Rule-based classification (fast, cheap)
 * 2. LLM fallback for low-confidence cases
 *
 * Tone categories:
 * - INBOUND: formal / neutral / casual / angry
 * - OUTBOUND: formal / neutral / casual
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Confidence threshold for rule-based classification
const CONFIDENCE_THRESHOLD = 0.7;

/**
 * Classify email tone (hybrid)
 * @param {string} text - Cleaned email text
 * @param {string} direction - 'INBOUND' or 'OUTBOUND'
 * @returns {Promise<Object>} { tone, confidence, method }
 */
export async function classifyTone(text, direction = 'INBOUND') {
  if (!text || text.trim().length === 0) {
    return { tone: 'neutral', confidence: 1.0, method: 'default' };
  }

  // Try rule-based first
  const ruleResult = classifyToneRuleBased(text, direction);

  // If high confidence, use it
  if (ruleResult.confidence >= CONFIDENCE_THRESHOLD) {
    return { ...ruleResult, method: 'rule-based' };
  }

  // Otherwise, fallback to LLM
  console.log(`[ToneClassifier] Low confidence (${ruleResult.confidence}), using LLM fallback`);

  try {
    const llmResult = await classifyToneWithLLM(text, direction);
    return { ...llmResult, method: 'llm' };
  } catch (error) {
    console.error('[ToneClassifier] LLM failed, using rule-based:', error.message);
    return { ...ruleResult, method: 'rule-based-fallback' };
  }
}

/**
 * Rule-based tone classification
 */
function classifyToneRuleBased(text, direction) {
  const lower = text.toLowerCase();

  // Angry indicators (INBOUND only)
  if (direction === 'INBOUND') {
    const angryScore = calculateAngryScore(lower, text);
    if (angryScore > 0.6) {
      return { tone: 'angry', confidence: angryScore };
    }
  }

  // Formal indicators
  const formalScore = calculateFormalScore(lower);

  // Casual indicators
  const casualScore = calculateCasualScore(lower, text);

  // Determine tone based on scores
  const scores = { formal: formalScore, casual: casualScore };

  if (direction === 'INBOUND') {
    // For inbound, if neither formal nor casual, it's neutral
    if (formalScore < 0.3 && casualScore < 0.3) {
      return { tone: 'neutral', confidence: 0.8 };
    }
  }

  // Pick highest score
  const maxScore = Math.max(formalScore, casualScore);
  const tone = formalScore > casualScore ? 'formal' : 'casual';

  // If scores are close, low confidence
  if (Math.abs(formalScore - casualScore) < 0.2) {
    return { tone: 'neutral', confidence: 0.5 };
  }

  return { tone, confidence: maxScore };
}

/**
 * Calculate angry score (INBOUND only)
 */
function calculateAngryScore(lower, original) {
  let score = 0;
  let indicators = 0;

  // Negative keywords
  const angryKeywords = [
    'unacceptable',
    'disappointed',
    'frustrated',
    'terrible',
    'horrible',
    'worst',
    'awful',
    'ridiculous',
    'disgrace',
    'complaint',
    'refund',
    'cancel',
    'lawyer',
    'sue',
    'immediately',
    'kabul edilemez',
    'hayal kırıklığı',
    'berbat',
    'rezalet',
    'şikayet',
    'iade',
    'iptal',
    'derhal',
    'hemen'
  ];

  for (const keyword of angryKeywords) {
    if (lower.includes(keyword)) {
      score += 0.15;
      indicators++;
    }
  }

  // Excessive punctuation
  const exclamationCount = (original.match(/!/g) || []).length;
  if (exclamationCount >= 3) {
    score += 0.2;
    indicators++;
  }

  // ALL CAPS words
  const words = original.split(/\s+/);
  const capsWords = words.filter(w => w.length > 3 && w === w.toUpperCase());
  if (capsWords.length >= 3) {
    score += 0.25;
    indicators++;
  }

  // Question marks (demanding answers)
  const questionCount = (original.match(/\?/g) || []).length;
  if (questionCount >= 3) {
    score += 0.1;
    indicators++;
  }

  return Math.min(score, 1.0);
}

/**
 * Calculate formal score
 */
function calculateFormalScore(lower) {
  let score = 0;

  // Formal greetings
  const formalGreetings = [
    'dear sir',
    'dear madam',
    'to whom it may concern',
    'i am writing to',
    'i would like to',
    'please be advised',
    'sayın',
    'sayın bay',
    'sayın bayan',
    'ilgilinize',
    'bilgilerinize'
  ];

  for (const greeting of formalGreetings) {
    if (lower.includes(greeting)) {
      score += 0.3;
      break;
    }
  }

  // Formal closings
  const formalClosings = [
    'sincerely',
    'yours sincerely',
    'yours faithfully',
    'respectfully',
    'kind regards',
    'best regards',
    'saygılarımla',
    'saygılarımızla'
  ];

  for (const closing of formalClosings) {
    if (lower.includes(closing)) {
      score += 0.25;
      break;
    }
  }

  // Formal phrases
  const formalPhrases = [
    'i would appreciate',
    'could you please',
    'would you kindly',
    'i am pleased to',
    'it is my pleasure',
    'i regret to inform',
    'please find attached',
    'as per our discussion',
    'rica ederim',
    'lütfen',
    'müsait olduğunuzda',
    'bilgilerinize sunarım'
  ];

  for (const phrase of formalPhrases) {
    if (lower.includes(phrase)) {
      score += 0.15;
    }
  }

  // Avoid contractions (formal indicator)
  const contractionCount = (lower.match(/\b(don't|can't|won't|it's|i'm|you're|we're)\b/g) || []).length;
  if (contractionCount === 0 && lower.split(/\s+/).length > 20) {
    score += 0.1;
  }

  return Math.min(score, 1.0);
}

/**
 * Calculate casual score
 */
function calculateCasualScore(lower, original) {
  let score = 0;

  // Casual greetings
  const casualGreetings = [
    'hey',
    'hi there',
    'hello there',
    'sup',
    "what's up",
    'yo',
    'merhaba',
    'selam',
    'naber'
  ];

  for (const greeting of casualGreetings) {
    if (lower.includes(greeting)) {
      score += 0.3;
      break;
    }
  }

  // Casual closings
  const casualClosings = [
    'cheers',
    'thanks!',
    'thx',
    'talk soon',
    'take care',
    'see ya',
    'teşekkürler!',
    'sağol',
    'görüşürüz'
  ];

  for (const closing of casualClosings) {
    if (lower.includes(closing)) {
      score += 0.25;
      break;
    }
  }

  // Emojis
  const emojiCount = (original.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]/gu) || []).length;
  if (emojiCount > 0) {
    score += 0.2;
  }

  // Exclamation marks (enthusiastic)
  const exclamationCount = (original.match(/!/g) || []).length;
  if (exclamationCount >= 1 && exclamationCount <= 2) {
    score += 0.1;
  }

  // Contractions (casual indicator)
  const contractionCount = (lower.match(/\b(don't|can't|won't|it's|i'm|you're|we're)\b/g) || []).length;
  if (contractionCount >= 2) {
    score += 0.15;
  }

  // Informal words
  const informalWords = ['cool', 'awesome', 'great', 'nice', 'sure', 'yep', 'nope', 'gonna', 'wanna'];
  for (const word of informalWords) {
    if (lower.includes(word)) {
      score += 0.1;
    }
  }

  return Math.min(score, 1.0);
}

/**
 * LLM-based tone classification (fallback)
 */
async function classifyToneWithLLM(text, direction) {
  const toneOptions = direction === 'INBOUND'
    ? 'formal, neutral, casual, angry'
    : 'formal, neutral, casual';

  const prompt = `Classify the tone of this ${direction.toLowerCase()} email.

Email text:
"""
${text.substring(0, 500)}
"""

Respond with ONLY ONE WORD from: ${toneOptions}

Tone:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at classifying email tone. Respond with only one word.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.1,
    max_tokens: 10
  });

  const tone = response.choices[0]?.message?.content?.trim().toLowerCase() || 'neutral';

  // Validate tone
  const validTones = direction === 'INBOUND'
    ? ['formal', 'neutral', 'casual', 'angry']
    : ['formal', 'neutral', 'casual'];

  if (!validTones.includes(tone)) {
    return { tone: 'neutral', confidence: 0.6 };
  }

  return { tone, confidence: 0.85 }; // LLM is fairly confident
}

/**
 * Classify contact type from email domain
 * @param {string} fromEmail - Sender email address
 * @returns {string} - 'customer' | 'business' | 'personal'
 */
export function classifyContactType(fromEmail) {
  if (!fromEmail) return 'customer';

  const domain = fromEmail.split('@')[1]?.toLowerCase() || '';

  // Personal email domains
  const personalDomains = [
    'gmail.com',
    'yahoo.com',
    'hotmail.com',
    'outlook.com',
    'icloud.com',
    'aol.com',
    'mail.com',
    'protonmail.com',
    'yandex.com'
  ];

  if (personalDomains.includes(domain)) {
    return 'personal';
  }

  // Business indicators (common SaaS/service domains)
  const businessDomains = [
    'stripe.com',
    'paypal.com',
    'salesforce.com',
    'hubspot.com',
    'zendesk.com',
    'slack.com',
    'google.com',
    'microsoft.com',
    'amazon.com',
    'notification',
    'noreply',
    'no-reply',
    'support',
    'info'
  ];

  for (const biz of businessDomains) {
    if (domain.includes(biz)) {
      return 'business';
    }
  }

  // Default: customer (unknown business domain)
  return 'customer';
}

export default {
  classifyTone,
  classifyContactType
};
