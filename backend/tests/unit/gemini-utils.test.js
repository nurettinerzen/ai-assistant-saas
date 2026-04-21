import { describe, expect, it } from '@jest/globals';
import { isGeminiGenerationFailure } from '../../src/services/gemini-utils.js';

describe('isGeminiGenerationFailure', () => {
  it('detects invalid api key provider failures', () => {
    expect(isGeminiGenerationFailure(new Error(
      '[GoogleGenerativeAI Error]: Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent: [400 Bad Request] API key not valid. Please pass a valid API key.'
    ))).toBe(true);
  });

  it('ignores unrelated internal errors', () => {
    expect(isGeminiGenerationFailure(new Error('Knowledge base query failed'))).toBe(false);
  });
});
