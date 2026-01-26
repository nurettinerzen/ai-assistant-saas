/**
 * Email Text Cleaner
 *
 * Cleans email content for pair analysis:
 * - Removes quoted text (reply chains)
 * - Removes forward chains
 * - Separates signature from body
 * - Removes common email footers
 *
 * CRITICAL: Without this, learning dataset is garbage.
 */

/**
 * Clean email text for analysis
 * @param {string} rawText - Raw email body text
 * @param {string} direction - 'INBOUND' or 'OUTBOUND'
 * @returns {Object} { cleanedText, signature, quotedText }
 */
export function cleanEmailText(rawText, direction = 'INBOUND') {
  if (!rawText || typeof rawText !== 'string') {
    return { cleanedText: '', signature: null, quotedText: null };
  }

  let text = rawText;

  // Step 1: Extract and remove quoted text (reply chains)
  const quotedResult = extractQuotedText(text);
  text = quotedResult.cleanText;
  const quotedText = quotedResult.quotedText;

  // Step 2: Extract and remove forward chains
  text = removeForwardChains(text);

  // Step 3: Remove common email footers (unsubscribe, privacy policy, etc.)
  text = removeCommonFooters(text);

  // Step 4: Extract signature (only for OUTBOUND)
  let signature = null;
  if (direction === 'OUTBOUND') {
    const sigResult = extractSignature(text);
    text = sigResult.cleanText;
    signature = sigResult.signature;
  }

  // Step 5: Clean up whitespace
  text = text
    .replace(/\r\n/g, '\n')           // Normalize line endings
    .replace(/\n{3,}/g, '\n\n')       // Max 2 consecutive newlines
    .replace(/[ \t]+/g, ' ')          // Collapse multiple spaces
    .trim();

  return {
    cleanedText: text,
    signature,
    quotedText
  };
}

/**
 * Extract quoted text (reply chains)
 * Common patterns:
 * - Lines starting with ">"
 * - "On [date], [name] wrote:"
 * - Lines after "-----Original Message-----"
 * - Gmail/Outlook quote markers
 */
function extractQuotedText(text) {
  const lines = text.split('\n');
  const cleanLines = [];
  const quotedLines = [];
  let inQuote = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Detect quote start patterns
    if (
      // Gmail style: "On Mon, Jan 1, 2024 at 10:00 AM, John Doe <john@example.com> wrote:"
      /^On\s+.+\s+wrote:$/i.test(trimmed) ||

      // Outlook style: "From: ... Sent: ... To: ..."
      /^(From|Sent|To|Subject):\s+/i.test(trimmed) ||

      // Original message marker
      /^-+\s*Original Message\s*-+$/i.test(trimmed) ||
      /^-{5,}$/i.test(trimmed) ||  // Long dash separator

      // Reply/Forward markers
      /^(Reply|Forwarded message|Begin forwarded message)/i.test(trimmed) ||

      // Quote character at start
      trimmed.startsWith('>') ||

      // Already in quote block
      inQuote
    ) {
      inQuote = true;
      quotedLines.push(line);
      continue;
    }

    // Keep clean lines
    if (!inQuote) {
      cleanLines.push(line);
    } else {
      quotedLines.push(line);
    }
  }

  return {
    cleanText: cleanLines.join('\n'),
    quotedText: quotedLines.length > 0 ? quotedLines.join('\n') : null
  };
}

/**
 * Remove forward chains
 */
function removeForwardChains(text) {
  // Remove "---------- Forwarded message ---------" and everything after
  const forwardPatterns = [
    /---------- Forwarded message ---------[\s\S]*/i,
    /Begin forwarded message:[\s\S]*/i,
    /Forwarded by[\s\S]*/i
  ];

  let cleaned = text;
  for (const pattern of forwardPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Remove common email footers
 * - Unsubscribe links
 * - Privacy policy
 * - Legal disclaimers
 * - Auto-generated notices
 */
function removeCommonFooters(text) {
  const footerPatterns = [
    // Unsubscribe
    /Unsubscribe[\s\S]*?$/im,
    /Click here to unsubscribe[\s\S]*?$/im,

    // Privacy policy
    /Privacy Policy[\s\S]*?$/im,
    /Terms (&|and) Conditions[\s\S]*?$/im,

    // Auto-generated notice
    /This is an automatically generated email[\s\S]*?$/im,
    /Please do not reply to this (email|message)[\s\S]*?$/im,
    /NOTE: This is an automatically generated[\s\S]*?$/im,

    // Long URLs (often footers)
    /https?:\/\/[^\s]{50,}/g,

    // Office address blocks
    /Office address:[\s\S]*?$/im
  ];

  let cleaned = text;
  for (const pattern of footerPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }

  return cleaned.trim();
}

/**
 * Extract signature from OUTBOUND email
 *
 * Common patterns:
 * - After "Best regards", "Thanks", "Cheers", etc.
 * - Name + title + contact info
 * - Social media links
 * - Email signature separators (-- or ___)
 */
function extractSignature(text) {
  const lines = text.split('\n');

  // Common closing patterns
  const closingPatterns = [
    'best regards',
    'kind regards',
    'warm regards',
    'regards',
    'sincerely',
    'thanks',
    'thank you',
    'cheers',
    'best',
    'saygılarımla',
    'saygılarla',
    'teşekkürler',
    'iyi günler',
    'iyi çalışmalar'
  ];

  let signatureStartIndex = -1;

  // Find signature start
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim().toLowerCase();

    // Check for closing patterns
    if (closingPatterns.some(pattern => line === pattern || line.startsWith(pattern + ','))) {
      signatureStartIndex = i;
      break;
    }

    // Check for signature separator (-- or ___)
    if (/^(-{2,}|_{3,})$/.test(line)) {
      signatureStartIndex = i;
      break;
    }

    // Check for name + contact pattern (simple heuristic)
    // e.g., "John Doe | CEO | Company"
    if (line.includes('|') && i > lines.length - 8) {
      signatureStartIndex = i;
      break;
    }

    // Stop searching if we're too far up (signature should be at bottom)
    if (i < lines.length - 15) {
      break;
    }
  }

  // No signature found
  if (signatureStartIndex === -1) {
    return {
      cleanText: text,
      signature: null
    };
  }

  // Extract signature
  const bodyLines = lines.slice(0, signatureStartIndex);
  const signatureLines = lines.slice(signatureStartIndex);

  return {
    cleanText: bodyLines.join('\n').trim(),
    signature: signatureLines.join('\n').trim()
  };
}

/**
 * Extract closing pattern from signature
 * @param {string} signature - Full signature text
 * @returns {string|null} - Just the closing pattern (e.g., "Best regards")
 */
export function extractClosingPattern(signature) {
  if (!signature) return null;

  const closingPatterns = [
    'best regards',
    'kind regards',
    'warm regards',
    'regards',
    'sincerely',
    'thanks',
    'thank you',
    'cheers',
    'best',
    'saygılarımla',
    'saygılarla',
    'teşekkürler',
    'iyi günler',
    'iyi çalışmalar'
  ];

  const firstLine = signature.split('\n')[0].trim().toLowerCase();

  for (const pattern of closingPatterns) {
    if (firstLine === pattern || firstLine.startsWith(pattern + ',')) {
      // Return with original casing
      const originalLine = signature.split('\n')[0].trim();
      return originalLine.replace(/,\s*$/, ''); // Remove trailing comma
    }
  }

  return null;
}

/**
 * Detect email length bucket
 * @param {string} text - Cleaned email text
 * @returns {string} - 'short' | 'medium' | 'long'
 */
export function detectLengthBucket(text) {
  if (!text) return 'short';

  const wordCount = text.split(/\s+/).filter(w => w.length > 0).length;

  if (wordCount < 50) return 'short';
  if (wordCount < 150) return 'medium';
  return 'long';
}

export default {
  cleanEmailText,
  extractClosingPattern,
  detectLengthBucket
};
