/**
 * CRM Ticket Status Handler
 * Checks service/repair ticket status from custom CRM webhook data
 */

import prisma from '../../prismaClient.js';
import { ok, notFound, validationError, systemError, verificationRequired } from '../toolResult.js';

/**
 * Execute CRM ticket status check
 */
export async function execute(args, business, context = {}) {
  try {
    const { ticket_number, phone, verification_input } = args;
    const language = business.language || 'TR';

    console.log('🔍 CRM: Checking ticket status:', { ticket_number, phone, hasVerification: !!verification_input });

    // Validate - at least one parameter required
    if (!ticket_number && !phone) {
      return validationError(
        language === 'TR'
          ? 'Servis numarası veya telefon numarası gerekli.'
          : 'Ticket number or phone number is required.',
        'ticket_number | phone'
      );
    }

    // Normalize phone: strip to last 10 digits for flexible matching
    const phoneDigits = phone ? stripToLast10Digits(phone) : null;

    // Build query
    const whereClause = { businessId: business.id };

    if (ticket_number && phoneDigits) {
      whereClause.OR = [
        { ticketNumber: ticket_number },
        { customerPhone: { contains: phoneDigits } }
      ];
    } else if (ticket_number) {
      whereClause.ticketNumber = ticket_number;
    } else if (phoneDigits) {
      whereClause.customerPhone = { contains: phoneDigits };
    }

    // Search for ticket
    const ticket = await prisma.crmTicket.findFirst({
      where: whereClause,
      orderBy: { updatedAt: 'desc' }
    });

    if (!ticket) {
      return notFound(
        language === 'TR'
          ? 'Bu bilgilerle eşleşen bir servis kaydı bulunamadı. Lütfen bilgilerinizi kontrol edin.'
          : 'No service record found matching this information. Please check your details.'
      );
    }

    console.log(`✅ CRM Ticket found: ${ticket.ticketNumber}`);

    // Verification: require name before returning data
    if (!verification_input) {
      return verificationRequired(
        language === 'TR'
          ? 'Servis kaydı bulundu. Kimlik doğrulaması için ad ve soyadınızı söyler misiniz?'
          : 'Service record found. Could you please tell me your full name for verification?',
        { askFor: 'name' }
      );
    }

    // Verify name against customerName
    const inputName = verification_input.trim().toLowerCase().replace(/\s+/g, ' ');
    const storedName = (ticket.customerName || '').trim().toLowerCase().replace(/\s+/g, ' ');

    if (!storedName || !storedName.includes(inputName.split(' ')[0])) {
      // Generic message — don't reveal whether record exists (security)
      return notFound(
        language === 'TR'
          ? 'Bu bilgilerle eşleşen bir servis kaydı bulunamadı. Lütfen bilgilerinizi kontrol edin.'
          : 'No service record found matching this information. Please check your details.'
      );
    }

    // Verification passed — return full data
    const statusText = translateTicketStatus(ticket.status, language);
    const responseMessage = formatTicketMessage(ticket, statusText, language);

    return ok({
      ticket_number: ticket.ticketNumber,
      product: ticket.product,
      issue: ticket.issue,
      status: statusText,
      status_raw: ticket.status,
      notes: ticket.notes,
      estimated_completion: ticket.estimatedCompletion,
      cost: ticket.cost,
      last_update: ticket.externalUpdatedAt
    }, responseMessage);

  } catch (error) {
    console.error('❌ CRM ticket lookup error:', error);
    return systemError(
      business.language === 'TR'
        ? 'Servis sorgusunda sistem hatası oluştu.'
        : 'System error during ticket query.',
      error
    );
  }
}

// Strip phone to last 10 digits for flexible matching
// DB may store as "5572690717", user may input "05572690717" or "+905572690717"
function stripToLast10Digits(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
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
