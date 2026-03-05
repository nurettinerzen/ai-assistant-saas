/**
 * CRM Ticket Status Handler
 * Checks service/repair ticket status from custom CRM webhook data
 */

import prisma from '../../prismaClient.js';
import { ok, notFound, validationError, systemError, verificationRequired } from '../toolResult.js';
import { OutcomeEventType } from '../../security/outcomePolicy.js';

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

    // Verification: phone_last4 if phone exists, otherwise name (consistent with customer_data_lookup)
    const askFor = ticket.customerPhone ? 'phone_last4' : 'name';

    const anchor = {
      id: ticket.id,
      name: ticket.customerName,
      phone: ticket.customerPhone,
      sourceTable: 'CrmTicket',
      anchorType: 'TICKET',
      anchorValue: ticket.ticketNumber
    };

    if (!verification_input) {
      const askMessage = askFor === 'phone_last4'
        ? (language === 'TR'
          ? 'Servis kaydı bulundu. Güvenlik doğrulaması için kayıtlı telefon numaranızın son 4 hanesini söyler misiniz?'
          : 'Service record found. Could you please tell me the last 4 digits of your registered phone number?')
        : (language === 'TR'
          ? 'Servis kaydı bulundu. Kimlik doğrulaması için ad ve soyadınızı söyler misiniz?'
          : 'Service record found. Could you please tell me your full name for verification?');

      const result = verificationRequired(askMessage, { askFor });
      result.stateEvents = [{
        type: OutcomeEventType.VERIFICATION_REQUIRED,
        askFor,
        anchor
      }];
      return result;
    }

    // Verify input against stored data
    const input = verification_input.trim();
    let verified = false;

    if (askFor === 'phone_last4') {
      // Extract digits from input
      const inputDigits = input.replace(/\D/g, '');
      const storedPhone = (ticket.customerPhone || '').replace(/\D/g, '');
      // Match last 4 digits
      if (inputDigits.length >= 4 && storedPhone.length >= 4) {
        verified = storedPhone.slice(-4) === inputDigits.slice(-4);
      }
    } else {
      // Name verification fallback
      const inputName = input.toLowerCase().replace(/\s+/g, ' ');
      const storedName = (ticket.customerName || '').trim().toLowerCase().replace(/\s+/g, ' ');
      verified = storedName && storedName.includes(inputName.split(' ')[0]);
    }

    if (!verified) {
      const failResult = notFound(
        language === 'TR'
          ? 'Doğrulama başarısız. Lütfen bilgilerinizi kontrol edip tekrar deneyin.'
          : 'Verification failed. Please check your information and try again.'
      );
      failResult.stateEvents = [{
        type: OutcomeEventType.VERIFICATION_FAILED
      }];
      return failResult;
    }

    // Verification passed — return full data
    const statusText = translateTicketStatus(ticket.status, language);
    const responseMessage = formatTicketMessage(ticket, statusText, language);

    const verifiedAnchor = {
      id: ticket.id,
      name: ticket.customerName,
      phone: ticket.customerPhone,
      sourceTable: 'CrmTicket',
      anchorType: 'TICKET',
      anchorValue: ticket.ticketNumber
    };

    const okResult = ok({
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

    okResult.stateEvents = [{
      type: OutcomeEventType.VERIFICATION_PASSED,
      anchor: verifiedAnchor,
      verifiedField: 'name'
    }];
    okResult._identityContext = {
      verifiedName: ticket.customerName,
      sourceTable: 'CrmTicket'
    };

    return okResult;

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
