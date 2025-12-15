/**
 * Date/Time Utilities
 * Helper functions for generating dynamic date/time context
 */

/**
 * Generate current date/time context string for AI prompts
 * @param {string} timezone - Timezone (e.g., 'Europe/Istanbul')
 * @param {string} language - Language code (e.g., 'TR', 'EN')
 * @returns {string} Formatted date/time context
 */
export function getDateTimeContext(timezone = 'Europe/Istanbul', language = 'TR') {
  const now = new Date();

  const options = {
    timeZone: timezone,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };

  const locale = language === 'TR' ? 'tr-TR' : 'en-US';

  try {
    const formatted = now.toLocaleString(locale, options);

    if (language === 'TR') {
      return `ÖNEMLİ: Şu anki tarih ve saat: ${formatted} (${timezone} saat dilimi). Tüm tarih ve saat hesaplamalarında bunu kullan.`;
    }

    return `IMPORTANT: Current date and time: ${formatted} (${timezone} timezone). Use this for all date/time calculations.`;
  } catch (error) {
    // Fallback if timezone is invalid
    const fallback = now.toISOString();
    if (language === 'TR') {
      return `ÖNEMLİ: Şu anki tarih ve saat: ${fallback}. Tüm tarih ve saat hesaplamalarında bunu kullan.`;
    }
    return `IMPORTANT: Current date and time: ${fallback}. Use this for all date/time calculations.`;
  }
}

/**
 * Prepend date/time context to a system prompt
 * @param {string} prompt - Original system prompt
 * @param {string} timezone - Timezone
 * @param {string} language - Language code
 * @returns {string} Prompt with date/time prepended
 */
export function prependDateTimeToPrompt(prompt, timezone = 'Europe/Istanbul', language = 'TR') {
  const dateTimeContext = getDateTimeContext(timezone, language);
  return `${dateTimeContext}\n\n${prompt}`;
}

/**
 * Remove static date/time lines from a prompt
 * Removes lines that contain patterns like "Şu anki tarih" or "Current date"
 * @param {string} prompt - Original prompt
 * @returns {string} Cleaned prompt
 */
export function removeStaticDateTimeFromPrompt(prompt) {
  if (!prompt) return prompt;

  // Patterns to match static date/time lines
  const patterns = [
    /^.*ÖNEMLİ:\s*Şu anki tarih.*$/gim,
    /^.*IMPORTANT:\s*Current date.*$/gim,
    /^.*Şu anki tarih ve saat:.*$/gim,
    /^.*Current date and time:.*$/gim,
    /^.*Bugünün tarihi:.*$/gim,
    /^.*Today's date:.*$/gim,
  ];

  let cleanedPrompt = prompt;

  for (const pattern of patterns) {
    cleanedPrompt = cleanedPrompt.replace(pattern, '');
  }

  // Remove excessive blank lines (more than 2 consecutive)
  cleanedPrompt = cleanedPrompt.replace(/\n{3,}/g, '\n\n');

  // Trim whitespace
  return cleanedPrompt.trim();
}

export default {
  getDateTimeContext,
  prependDateTimeToPrompt,
  removeStaticDateTimeFromPrompt,
};
