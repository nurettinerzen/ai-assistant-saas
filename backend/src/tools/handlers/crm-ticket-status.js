/**
 * CRM Ticket Status Handler
 * Checks service/repair ticket status from custom CRM webhook data
 */

import prisma from '../../prismaClient.js';

/**
 * Execute CRM ticket status check
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object with integrations
 * @param {Object} context - Execution context (channel, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    const { ticket_number, phone } = args;

    console.log('🔍 CRM: Checking ticket status:', { ticket_number, phone });

    // Validate - at least one parameter required
    if (!ticket_number && !phone) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Servis numarası veya telefon numarası gerekli.'
          : 'Ticket number or phone number required.'
      };
    }

    // Normalize phone if provided
    const normalizedPhone = phone ? normalizePhone(phone) : null;

    // Build query
    const whereClause = {
      businessId: business.id
    };

    if (ticket_number && normalizedPhone) {
      whereClause.OR = [
        { ticketNumber: ticket_number },
        { customerPhone: normalizedPhone }
      ];
    } else if (ticket_number) {
      whereClause.ticketNumber = ticket_number;
    } else if (normalizedPhone) {
      whereClause.customerPhone = normalizedPhone;
    }

    // Search for ticket
    const ticket = await prisma.crmTicket.findFirst({
      where: whereClause,
      orderBy: { updatedAt: 'desc' }
    });

    if (!ticket) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Servis kaydı bulunamadı. Lütfen servis numaranızı kontrol edin.'
          : 'Ticket not found. Please check your ticket number.'
      };
    }

    console.log(`✅ CRM Ticket found: ${ticket.ticketNumber}`);

    // Format response
    const statusText = translateTicketStatus(ticket.status, business.language);
    const responseMessage = formatTicketMessage(ticket, statusText, business.language);

    return {
      success: true,
      data: {
        ticket_number: ticket.ticketNumber,
        product: ticket.product,
        issue: ticket.issue,
        status: statusText,
        status_raw: ticket.status,
        notes: ticket.notes,
        estimated_completion: ticket.estimatedCompletion,
        cost: ticket.cost,
        last_update: ticket.externalUpdatedAt
      },
      message: responseMessage
    };

  } catch (error) {
    console.error('❌ CRM ticket lookup error:', error);
    return {
      success: false,
      error: business.language === 'TR'
        ? 'Servis kaydı sorgulanırken bir hata oluştu.'
        : 'An error occurred while checking ticket.'
    };
  }
}

// Normalize phone number
function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (digits.startsWith('90') && digits.length > 10) digits = digits.substring(2);
  return digits;
}

// Translate ticket status
function translateTicketStatus(status, language) {
  if (language !== 'TR') return status;

  const statusMap = {
    'pending': 'Beklemede',
    'received': 'Teslim Alındı',
    'in_review': 'İnceleniyor',
    'in_progress': 'Tamir Ediliyor',
    'waiting_parts': 'Parça Bekleniyor',
    'completed': 'Tamir Edildi',
    'ready': 'Teslime Hazır',
    'delivered': 'Teslim Edildi',
    'cancelled': 'İptal Edildi',
    // Turkish status values
    'beklemede': 'Beklemede',
    'teslim_alindi': 'Teslim Alındı',
    'inceleniyor': 'İnceleniyor',
    'tamir_ediliyor': 'Tamir Ediliyor',
    'parca_bekleniyor': 'Parça Bekleniyor',
    'tamir_edildi': 'Tamir Edildi',
    'teslime_hazir': 'Teslime Hazır',
    'teslim_edildi': 'Teslim Edildi',
    'iptal': 'İptal Edildi'
  };

  return statusMap[status?.toLowerCase()] || status;
}

// Format ticket message
function formatTicketMessage(ticket, statusText, language) {
  if (language === 'TR') {
    let message = `${ticket.ticketNumber} numaralı servis kaydınız: ${ticket.product} - ${statusText}.`;

    if (ticket.issue) {
      message += ` Sorun: ${ticket.issue}.`;
    }

    if (ticket.notes) {
      message += ` Not: ${ticket.notes}.`;
    }

    if (ticket.estimatedCompletion) {
      const date = new Date(ticket.estimatedCompletion);
      message += ` Tahmini tamamlanma tarihi: ${date.toLocaleDateString('tr-TR')}.`;
    }

    if (ticket.cost) {
      message += ` Tahmini maliyet: ${ticket.cost.toLocaleString('tr-TR')} TL.`;
    }

    return message;
  }

  let message = `Ticket ${ticket.ticketNumber}: ${ticket.product} - ${statusText}.`;

  if (ticket.issue) {
    message += ` Issue: ${ticket.issue}.`;
  }

  if (ticket.notes) {
    message += ` Note: ${ticket.notes}.`;
  }

  if (ticket.estimatedCompletion) {
    const date = new Date(ticket.estimatedCompletion);
    message += ` Estimated completion: ${date.toLocaleDateString('en-US')}.`;
  }

  if (ticket.cost) {
    message += ` Estimated cost: ${ticket.cost} TL.`;
  }

  return message;
}

export default { execute };
