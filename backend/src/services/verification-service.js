/**
 * Verification Service
 *
 * Centralized verification logic for ALL tools.
 * Implements anchor-first verification pattern:
 * 1. Tool finds record (anchor)
 * 2. Service checks if verification needed
 * 3. If needed, requests verification with anchor
 * 4. User provides verification input
 * 5. Service verifies against anchor
 * 6. Returns full or minimal data based on verification status
 */

import { compareTurkishNames, comparePhones } from '../utils/text.js';

/**
 * Check if a query type requires verification
 */
export function requiresVerification(queryType) {
  const sensitiveTypes = ['siparis', 'order', 'borc', 'debt', 'muhasebe', 'accounting', 'odeme', 'payment', 'fatura', 'invoice'];
  return sensitiveTypes.includes(queryType?.toLowerCase());
}

/**
 * Create verification anchor from found record
 * @param {Object} record - The found database record (order, customer, ticket, etc.)
 * @param {string} anchorType - Type of anchor: 'order', 'ticket', 'vkn', 'tc'
 * @param {string} anchorValue - The identifying value (order number, ticket number, etc.)
 * @returns {Object} Anchor object with verification data
 */
export function createAnchor(record, anchorType, anchorValue) {
  return {
    id: record.id,
    name: record.customerName || record.companyName || record.contactName,
    phone: record.customerPhone || record.phone,
    email: record.customerEmail || record.email,
    anchorType,
    anchorValue
  };
}

/**
 * Check if verification is needed and return appropriate response
 * @param {Object} anchor - The verification anchor
 * @param {string} verificationInput - User's verification input (name, phone, etc.)
 * @param {string} queryType - Type of query
 * @param {string} language - User's language (TR/EN)
 * @returns {Object} Verification check result
 */
export function checkVerification(anchor, verificationInput, queryType, language = 'TR') {
  const needsVerify = requiresVerification(queryType);

  if (!needsVerify) {
    return {
      verified: true,
      action: 'PROCEED',
      reason: 'no_verification_needed'
    };
  }

  // No verification input provided yet
  if (!verificationInput) {
    return {
      verified: false,
      action: 'REQUEST_VERIFICATION',
      askFor: 'name',
      message: language === 'TR'
        ? 'Kaydınızı buldum. Güvenlik doğrulaması için isminizi ve soyadınızı söyler misiniz?'
        : 'I found your record. For security verification, could you please provide your full name?',
      anchor: {
        id: anchor.id,
        type: anchor.anchorType,
        value: anchor.anchorValue
      }
    };
  }

  // Verify the input against anchor
  const verifyResult = verifyAgainstAnchor(anchor, verificationInput);

  if (verifyResult.matches) {
    return {
      verified: true,
      action: 'PROCEED',
      reason: 'verification_passed'
    };
  } else {
    return {
      verified: false,
      action: 'VERIFICATION_FAILED',
      message: language === 'TR'
        ? 'Verdiğiniz isim kayıtla eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum.'
        : 'The name you provided does not match our records. For security reasons, I cannot share the information.'
    };
  }
}

/**
 * Verify user input against anchor
 * @param {Object} anchor - Verification anchor
 * @param {string} input - User's verification input
 * @returns {Object} Match result
 */
function verifyAgainstAnchor(anchor, input) {
  if (!input || !anchor) {
    return { matches: false, reason: 'missing_data' };
  }

  // Try name match
  if (anchor.name) {
    const nameMatches = compareTurkishNames(input, anchor.name);
    if (nameMatches) {
      return { matches: true, field: 'name' };
    }
  }

  // Try phone match (if input looks like a phone number)
  if (anchor.phone && /^\d{10,}$/.test(input.replace(/[^\d]/g, ''))) {
    const phoneMatches = comparePhones(input, anchor.phone);
    if (phoneMatches) {
      return { matches: true, field: 'phone' };
    }
  }

  return { matches: false, reason: 'no_match' };
}

/**
 * Get minimal result (for unverified users)
 * Only returns non-sensitive status information
 * @param {Object} record - Database record
 * @param {string} queryType - Type of query
 * @param {string} language - User's language
 * @returns {Object} Minimal safe data
 */
export function getMinimalResult(record, queryType, language = 'TR') {
  const minimal = {
    success: true,
    verified: false,
    data: {}
  };

  // Only include non-sensitive status information
  if (queryType === 'siparis' || queryType === 'order') {
    minimal.data = {
      status: record.status || record.customFields?.['Durum'],
      statusOnly: true
    };
    minimal.message = language === 'TR'
      ? `Sipariş durumu: ${minimal.data.status}`
      : `Order status: ${minimal.data.status}`;
  } else if (queryType === 'ariza' || queryType === 'ticket') {
    minimal.data = {
      status: record.status || record.customFields?.['Durum'],
      statusOnly: true
    };
    minimal.message = language === 'TR'
      ? `Servis durumu: ${minimal.data.status}`
      : `Service status: ${minimal.data.status}`;
  } else {
    minimal.message = language === 'TR'
      ? 'Kayıt bulundu ancak detaylar için kimlik doğrulaması gerekiyor.'
      : 'Record found but verification required for details.';
  }

  return minimal;
}

/**
 * Get full result (for verified users)
 * Returns all data including sensitive information
 * @param {Object} record - Database record
 * @param {string} queryType - Type of query
 * @param {string} language - User's language
 * @returns {Object} Full data with detailed message
 */
export function getFullResult(record, queryType, language = 'TR') {
  const customFields = record.customFields || {};

  const result = {
    success: true,
    verified: true,
    data: {
      customerName: record.customerName || record.companyName,
      phone: record.customerPhone || record.phone,
      email: record.customerEmail || record.email,
      ...customFields
    }
  };

  // Generate detailed message based on query type AND add structured data
  if (queryType === 'siparis' || queryType === 'order') {
    const orderNo = customFields['Sipariş No'] || record.orderNumber;
    const status = customFields['Durum'] || record.status;
    const tracking = customFields['Kargo Takip No'] || record.trackingNumber;
    const carrier = customFields['Kargo Firması'] || record.carrier;
    const delivery = customFields['Tahmini Teslimat'] || record.estimatedDelivery;
    const items = record.items;
    const totalAmount = record.totalAmount;

    // CRITICAL: Add order fields to data so LLM has structured access
    result.data.order = {
      orderNumber: orderNo,
      status: status,
      trackingNumber: tracking || null,
      carrier: carrier || null,
      estimatedDelivery: delivery ? formatDate(delivery, language) : null,
      items: items || null,
      totalAmount: totalAmount || null
    };

    result.message = language === 'TR'
      ? `${orderNo} numaralı siparişiniz "${status}" durumunda.${tracking ? ` Kargo takip no: ${tracking}` : ''}${carrier ? ` (${carrier})` : ''}${delivery ? ` Tahmini teslimat: ${formatDate(delivery, language)}` : ''}`
      : `Your order ${orderNo} is "${status}".${tracking ? ` Tracking: ${tracking}` : ''}${carrier ? ` (${carrier})` : ''}`;

  } else if (queryType === 'borc' || queryType === 'debt') {
    const sgk = customFields['SGK Borcu'] || customFields.sgkDebt;
    const tax = customFields['Vergi Borcu'] || customFields.taxDebt;

    // Add debt fields to data
    result.data.debt = {
      sgk: sgk || null,
      tax: tax || null
    };

    result.message = language === 'TR'
      ? `Borç bilgileriniz:${sgk ? ` SGK: ${sgk} TL` : ''}${tax ? `, Vergi: ${tax} TL` : ''}`
      : `Your debt information:${sgk ? ` SSI: ${sgk} TL` : ''}${tax ? `, Tax: ${tax} TL` : ''}`;

  } else if (queryType === 'ariza' || queryType === 'ticket') {
    const ticketNo = customFields['Servis No'] || record.ticketNumber;
    const status = customFields['Durum'] || record.status;
    const issue = customFields['Arıza'] || record.issue;
    const notes = record.notes;
    const estimatedCompletion = record.estimatedCompletion;
    const cost = record.cost;

    // Add ticket fields to data
    result.data.ticket = {
      ticketNumber: ticketNo,
      status: status,
      issue: issue || null,
      notes: notes || null,
      estimatedCompletion: estimatedCompletion ? formatDate(estimatedCompletion, language) : null,
      cost: cost || null
    };

    result.message = language === 'TR'
      ? `${ticketNo} numaralı servis talebiniz "${status}" durumunda.${issue ? ` Arıza: ${issue}` : ''}`
      : `Your service ticket ${ticketNo} is "${status}".${issue ? ` Issue: ${issue}` : ''}`;

  } else {
    result.message = language === 'TR'
      ? 'Kayıt bilgileriniz başarıyla getirildi.'
      : 'Your record information retrieved successfully.';
  }

  return result;
}

/**
 * Format date for display
 * Uses UTC date components to avoid timezone shift
 */
function formatDate(date, language) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);

  // Use UTC date components to avoid timezone conversion issues
  // e.g., "2026-01-22T00:00:00.000Z" should display as "22 Ocak 2026", not "21 Ocak 2026"
  const day = d.getUTCDate();
  const month = d.getUTCMonth();
  const year = d.getUTCFullYear();

  const monthNamesTR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
                        'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const monthNamesEN = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];

  if (language === 'TR') {
    return `${day} ${monthNamesTR[month]} ${year}`;
  } else {
    return `${monthNamesEN[month]} ${day}, ${year}`;
  }
}

export default {
  requiresVerification,
  createAnchor,
  checkVerification,
  getMinimalResult,
  getFullResult
};
