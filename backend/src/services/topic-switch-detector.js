/**
 * Topic Switch Detector
 *
 * Detects when user is switching topics vs. providing slot input.
 *
 * Critical for preventing false positives:
 * - "Bir de borcumu öğrenmek istiyorum" → Topic switch (even if waiting for slot)
 * - "Ahmet Yılmaz" → NOT topic switch (name slot input)
 * - "SP001" → NOT topic switch (order number slot input)
 *
 * Uses multiple heuristics:
 * 1. Explicit topic switch keywords
 * 2. New intent signals
 * 3. Complaint/emotion signals
 * 4. Message length + structure
 * 5. Context-aware slot-like input filtering
 */

import { looksLikeSlotInput } from './slot-processor.js';

/**
 * Detect if message indicates a topic switch
 *
 * @param {string} message - User's message
 * @param {Object} state - Current conversation state
 * @returns {boolean} True if topic switch detected
 */
export function detectTopicSwitch(message, state) {
  const lowerMsg = message.toLowerCase().trim();

  // CRITICAL: If waiting for a slot and message looks like slot input, NOT a topic switch
  if (state.expectedSlot) {
    if (looksLikeSlotInput(message, state.expectedSlot)) {
      console.log('[TopicSwitch] Message looks like slot input, NOT switching');
      return false;
    }
  }

  // 1. Explicit topic switch keywords
  const switchKeywords = [
    'bir de', 'birde',
    'ayrıca', 'ayrica',
    'başka bir', 'baska bir',
    'farklı bir', 'farkli bir',
    'konuyu değiştirelim', 'konuyu degistirelim',
    'şunu sorayım', 'sunu sorayim',
    'peki şimdi', 'peki simdi',
    'bir sorum daha',
  ];

  for (const keyword of switchKeywords) {
    if (lowerMsg.includes(keyword)) {
      console.log(`[TopicSwitch] Explicit switch keyword detected: "${keyword}"`);
      return true;
    }
  }

  // 2. New intent signals (strong topic indicators)
  const intentSignals = [
    'borcum', 'borc',
    'borç', 'debt',
    'şikayet', 'sikayet', 'complaint',
    'iade', 'return',
    'iptal', 'cancel',
    'randevu', 'appointment',
    'insanla görüşmek', 'insanla gorusmek',
    'müşteri temsilcisi', 'musteri temsilcisi',
    'yetkiliye', 'yetkili',
    'insan', 'personel',
  ];

  for (const signal of intentSignals) {
    if (lowerMsg.includes(signal)) {
      // But check length - short messages might still be slot input
      if (message.length > 25 || message.includes('?')) {
        console.log(`[TopicSwitch] New intent signal detected: "${signal}"`);
        return true;
      }
    }
  }

  // 3. Complaint/emotion signals (strong indicators)
  const complaintSignals = [
    'rezalet', 'skandal', 'berbat',
    'kötü', 'kotu', 'bad',
    'memnun değil', 'memnun degil',
    'hiç beğenmedim', 'hic begenmedim',
    'çok kızgınım', 'cok kizginim',
    'sinir oldum',
  ];

  for (const signal of complaintSignals) {
    if (lowerMsg.includes(signal)) {
      console.log(`[TopicSwitch] Complaint signal detected: "${signal}"`);
      return true;
    }
  }

  // 4. Long message with question or request
  if (message.length > 30) {
    const requestIndicators = ['istiyorum', 'öğrenmek', 'ogrenmek', 'sormak', 'yapmak', '?'];

    for (const indicator of requestIndicators) {
      if (lowerMsg.includes(indicator)) {
        console.log('[TopicSwitch] Long message with request indicator');
        return true;
      }
    }
  }

  // 5. Flow resolved + new question
  if (state.flowStatus === 'resolved') {
    // Check if it's a short thank-you/acknowledgment
    const closingPhrases = [
      'tamam', 'teşekkür', 'tesekkur',
      'sağol', 'sagol', 'eyvallah',
      'ok', 'anladım', 'anladim',
      'peki', 'iyi', 'güzel', 'guzel',
      'süper', 'super', 'harika',
      'tamamdır', 'tamamdir',
      'görüşürüz', 'gorusuruz',
      'hoşçakal', 'hoscakal', 'bye',
    ];

    const isClosing = message.length <= 20 && closingPhrases.some(phrase =>
      lowerMsg.includes(phrase)
    );

    if (!isClosing && (message.length > 20 || message.includes('?'))) {
      console.log('[TopicSwitch] Flow resolved + new question/long message');
      return true;
    }
  }

  // Default: NOT a topic switch
  return false;
}
