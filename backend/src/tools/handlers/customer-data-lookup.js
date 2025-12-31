/**
 * Customer Data Lookup Handler
 * Retrieves customer information based on phone number
 */

import prisma from '../../prismaClient.js';

/**
 * Execute customer data lookup
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object
 * @param {Object} context - Execution context (callerPhone, channel, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    const { query_type, phone } = args;

    // Get phone from args or context (caller phone from call metadata)
    const lookupPhone = phone || context.callerPhone || context.phone || context.from;

    console.log('🔍 Customer Data Lookup:', { query_type, phone: lookupPhone, businessId: business.id });

    if (!lookupPhone) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Telefon numarası bulunamadı. Müşteri bilgilerini getirmek için telefon numarası gerekli.'
          : 'Phone number not found. Phone number is required to lookup customer information.'
      };
    }

    // Normalize phone number
    const normalizedPhone = normalizePhone(lookupPhone);
    if (!normalizedPhone) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Geçersiz telefon numarası formatı.'
          : 'Invalid phone number format.'
      };
    }

    // Look up customer
    const customer = await prisma.customerData.findUnique({
      where: {
        businessId_phone: {
          businessId: business.id,
          phone: normalizedPhone
        }
      }
    });

    if (!customer) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Bu telefon numarasına kayıtlı müşteri bilgisi bulunamadı.'
          : 'No customer information found for this phone number.',
        notFound: true
      };
    }

    console.log(`✅ Customer found: ${customer.companyName}`);

    // Parse custom fields
    const customFields = customer.customFields || {};

    // Format response based on query type
    const responseData = formatResponseData(customer, customFields, query_type, business.language);
    const responseMessage = formatResponseMessage(customer, customFields, query_type, business.language);

    return {
      success: true,
      data: responseData,
      message: responseMessage
    };

  } catch (error) {
    console.error('❌ Customer data lookup error:', error);
    return {
      success: false,
      error: business.language === 'TR'
        ? 'Müşteri bilgileri sorgulanırken bir hata oluştu.'
        : 'An error occurred while looking up customer information.'
    };
  }
}

/**
 * Normalize phone number for consistent matching
 */
function normalizePhone(phone) {
  if (!phone) return null;

  let cleaned = String(phone).replace(/[^\d+]/g, '');
  cleaned = cleaned.replace(/^\+/, '');

  // Handle Turkish numbers
  if (cleaned.startsWith('90') && cleaned.length >= 12) {
    return cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    return '90' + cleaned.substring(1);
  } else if (cleaned.length === 10 && cleaned.startsWith('5')) {
    return '90' + cleaned;
  }

  return cleaned || null;
}

/**
 * Format response data based on query type
 */
function formatResponseData(customer, customFields, queryType, language) {
  const baseData = {
    company_name: customer.companyName,
    contact_name: customer.contactName,
    phone: customer.phone,
    email: customer.email,
    vkn: customer.vkn,
    tc_no: customer.tcNo
  };

  switch (queryType) {
    case 'sgk_borcu':
      return {
        ...baseData,
        sgk_debt: customFields.sgkDebt,
        sgk_due_date: customFields.sgkDueDate ? formatDate(customFields.sgkDueDate, language) : null
      };

    case 'vergi_borcu':
      return {
        ...baseData,
        tax_debt: customFields.taxDebt,
        tax_due_date: customFields.taxDueDate ? formatDate(customFields.taxDueDate, language) : null
      };

    case 'beyanname':
      return {
        ...baseData,
        declaration_type: customFields.declarationType,
        declaration_period: customFields.declarationPeriod,
        declaration_due_date: customFields.declarationDueDate ? formatDate(customFields.declarationDueDate, language) : null,
        declaration_status: customFields.declarationStatus
      };

    case 'tum_bilgiler':
    case 'genel':
    default:
      return {
        ...baseData,
        sgk_debt: customFields.sgkDebt,
        sgk_due_date: customFields.sgkDueDate ? formatDate(customFields.sgkDueDate, language) : null,
        tax_debt: customFields.taxDebt,
        tax_due_date: customFields.taxDueDate ? formatDate(customFields.taxDueDate, language) : null,
        other_debt: customFields.otherDebt,
        other_debt_note: customFields.otherDebtNote,
        declaration_type: customFields.declarationType,
        declaration_period: customFields.declarationPeriod,
        declaration_due_date: customFields.declarationDueDate ? formatDate(customFields.declarationDueDate, language) : null,
        declaration_status: customFields.declarationStatus,
        notes: customer.notes,
        tags: customer.tags,
        custom_fields: customFields
      };
  }
}

/**
 * Format human-readable response message
 */
function formatResponseMessage(customer, customFields, queryType, language) {
  const isTR = language === 'TR';
  let message = '';

  // Header
  message += isTR
    ? `Müşteri: ${customer.companyName}`
    : `Customer: ${customer.companyName}`;

  if (customer.contactName) {
    message += isTR
      ? `\nYetkili: ${customer.contactName}`
      : `\nContact: ${customer.contactName}`;
  }

  message += '\n';

  switch (queryType) {
    case 'sgk_borcu':
      if (customFields.sgkDebt !== undefined && customFields.sgkDebt !== null) {
        message += isTR
          ? `\nSGK Borcu: ${formatMoney(customFields.sgkDebt)} TL`
          : `\nSSI Debt: ${formatMoney(customFields.sgkDebt)} TL`;

        if (customFields.sgkDueDate) {
          message += isTR
            ? ` (Vade: ${formatDate(customFields.sgkDueDate, language)})`
            : ` (Due: ${formatDate(customFields.sgkDueDate, language)})`;
        }
      } else {
        message += isTR
          ? '\nSGK borcu kaydı bulunmuyor.'
          : '\nNo SSI debt record found.';
      }
      break;

    case 'vergi_borcu':
      if (customFields.taxDebt !== undefined && customFields.taxDebt !== null) {
        message += isTR
          ? `\nVergi Borcu: ${formatMoney(customFields.taxDebt)} TL`
          : `\nTax Debt: ${formatMoney(customFields.taxDebt)} TL`;

        if (customFields.taxDueDate) {
          message += isTR
            ? ` (Vade: ${formatDate(customFields.taxDueDate, language)})`
            : ` (Due: ${formatDate(customFields.taxDueDate, language)})`;
        }
      } else {
        message += isTR
          ? '\nVergi borcu kaydı bulunmuyor.'
          : '\nNo tax debt record found.';
      }
      break;

    case 'beyanname':
      if (customFields.declarationType) {
        message += isTR
          ? `\nBeyanname Türü: ${customFields.declarationType}`
          : `\nDeclaration Type: ${customFields.declarationType}`;

        if (customFields.declarationPeriod) {
          message += isTR
            ? `\nDönem: ${customFields.declarationPeriod}`
            : `\nPeriod: ${customFields.declarationPeriod}`;
        }

        if (customFields.declarationDueDate) {
          message += isTR
            ? `\nSon Tarih: ${formatDate(customFields.declarationDueDate, language)}`
            : `\nDue Date: ${formatDate(customFields.declarationDueDate, language)}`;
        }

        if (customFields.declarationStatus) {
          message += isTR
            ? `\nDurum: ${customFields.declarationStatus}`
            : `\nStatus: ${customFields.declarationStatus}`;
        }
      } else {
        message += isTR
          ? '\nBeyanname kaydı bulunmuyor.'
          : '\nNo declaration record found.';
      }
      break;

    case 'tum_bilgiler':
    case 'genel':
    default:
      // SGK Debt
      if (customFields.sgkDebt !== undefined && customFields.sgkDebt !== null) {
        message += isTR
          ? `\nSGK Borcu: ${formatMoney(customFields.sgkDebt)} TL`
          : `\nSSI Debt: ${formatMoney(customFields.sgkDebt)} TL`;

        if (customFields.sgkDueDate) {
          message += isTR
            ? ` (Vade: ${formatDate(customFields.sgkDueDate, language)})`
            : ` (Due: ${formatDate(customFields.sgkDueDate, language)})`;
        }
      }

      // Tax Debt
      if (customFields.taxDebt !== undefined && customFields.taxDebt !== null) {
        message += isTR
          ? `\nVergi Borcu: ${formatMoney(customFields.taxDebt)} TL`
          : `\nTax Debt: ${formatMoney(customFields.taxDebt)} TL`;

        if (customFields.taxDueDate) {
          message += isTR
            ? ` (Vade: ${formatDate(customFields.taxDueDate, language)})`
            : ` (Due: ${formatDate(customFields.taxDueDate, language)})`;
        }
      }

      // Other Debt
      if (customFields.otherDebt !== undefined && customFields.otherDebt !== null) {
        message += isTR
          ? `\nDiğer Borç: ${formatMoney(customFields.otherDebt)} TL`
          : `\nOther Debt: ${formatMoney(customFields.otherDebt)} TL`;

        if (customFields.otherDebtNote) {
          message += ` (${customFields.otherDebtNote})`;
        }
      }

      // Declaration
      if (customFields.declarationType) {
        message += isTR
          ? `\n\nBeyanname: ${customFields.declarationType}`
          : `\n\nDeclaration: ${customFields.declarationType}`;

        if (customFields.declarationPeriod) {
          message += ` - ${customFields.declarationPeriod}`;
        }

        if (customFields.declarationDueDate) {
          message += isTR
            ? `\nSon Tarih: ${formatDate(customFields.declarationDueDate, language)}`
            : `\nDue Date: ${formatDate(customFields.declarationDueDate, language)}`;
        }

        if (customFields.declarationStatus) {
          message += isTR
            ? `\nDurum: ${customFields.declarationStatus}`
            : `\nStatus: ${customFields.declarationStatus}`;
        }
      }

      // Notes
      if (customer.notes) {
        message += isTR
          ? `\n\nNotlar: ${customer.notes}`
          : `\n\nNotes: ${customer.notes}`;
      }

      // If no data at all
      if (!customFields.sgkDebt && !customFields.taxDebt && !customFields.declarationType && !customer.notes) {
        message += isTR
          ? '\n\nMüşteri için ek bilgi kaydı bulunmuyor.'
          : '\n\nNo additional information recorded for this customer.';
      }
      break;
  }

  return message;
}

/**
 * Format money value
 */
function formatMoney(value) {
  if (value === null || value === undefined) return '0';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

/**
 * Format date value
 */
function formatDate(dateValue, language) {
  if (!dateValue) return '';

  try {
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return dateValue;

    return date.toLocaleDateString(language === 'TR' ? 'tr-TR' : 'en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return dateValue;
  }
}

export default { execute };
