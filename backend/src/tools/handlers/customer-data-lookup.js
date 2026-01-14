/**
 * Customer Data Lookup Handler
 * Retrieves customer information based on phone number OR order number
 * Supports all data types: orders, accounting, support, appointments, etc.
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
    const { query_type, phone, order_number } = args;

    console.log('🔍 Customer Data Lookup:', { query_type, phone, order_number, businessId: business.id });

    // Get phone from args or context
    const lookupPhone = phone || context.callerPhone || context.phone || context.from;

    // Must have either order_number or phone
    if (!order_number && !lookupPhone) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Lütfen sipariş numaranızı veya telefon numaranızı söyleyin.'
          : 'Please provide your order number or phone number.'
      };
    }

    let customer = null;

    // SEARCH STRATEGY:
    // 1. If order_number provided -> search by order number in customFields
    // 2. If phone provided -> search by phone
    // 3. If both -> try order_number first, then phone

    if (order_number) {
      // Search by order number in customFields
      console.log('🔍 Searching by order number:', order_number);

      // Search in customFields JSON for matching order number
      const allCustomers = await prisma.customerData.findMany({
        where: { businessId: business.id }
      });

      // Find customer with matching order number in customFields
      console.log('🔍 Searching through', allCustomers.length, 'customers for order:', order_number);

      for (const c of allCustomers) {
        if (c.customFields) {
          const fields = c.customFields;
          // Log first customer's customFields keys for debugging
          if (allCustomers.indexOf(c) === 0) {
            console.log('📋 Sample customFields keys:', Object.keys(fields));
          }
          // Check common order number field names (expanded for various CSV formats)
          const orderFields = [
            'Sipariş No', 'Siparis No', 'SİPARİŞ NO', 'Sipariş Numarası', 'Siparis Numarasi',
            'SİPARİŞ NUMARASI', 'Sipariş no', 'sipariş no', 'SİPARİS NO', 'Siparis no',
            'order_number', 'orderNumber', 'Order Number', 'Order No', 'OrderNo',
            'ORDER NUMBER', 'ORDER NO', 'siparis_no', 'siparisNo', 'SiparisNo',
            'Sipariş', 'SIPARIS', 'siparis', 'order', 'Order', 'ORDER'
          ];
          for (const fieldName of orderFields) {
            if (fields[fieldName]) {
              console.log(`🔎 Found field "${fieldName}" with value "${fields[fieldName]}" - comparing to "${order_number}"`);
              if (String(fields[fieldName]).toUpperCase() === order_number.toUpperCase()) {
                customer = c;
                console.log('✅ Found by order number:', order_number);
                break;
              }
            }
          }
          if (customer) break;
        }
      }
    }

    // If not found by order_number, try phone
    if (!customer && lookupPhone) {
      const normalizedPhone = normalizePhone(lookupPhone);
      console.log('🔍 Searching by phone:', normalizedPhone);

      if (normalizedPhone) {
        // Try exact match first
        customer = await prisma.customerData.findUnique({
          where: {
            businessId_phone: {
              businessId: business.id,
              phone: normalizedPhone
            }
          }
        });

        // Try flexible search if exact match fails
        if (!customer) {
          const last10 = normalizedPhone.slice(-10);
          customer = await prisma.customerData.findFirst({
            where: {
              businessId: business.id,
              phone: { endsWith: last10 }
            }
          });
        }
      }
    }

    // Not found
    if (!customer) {
      const searchTerm = order_number || lookupPhone;
      console.log('❌ Customer not found for:', searchTerm);
      const notFoundMessage = business.language === 'TR'
        ? `${order_number ? 'Bu sipariş numarasına' : 'Bu telefon numarasına'} ait kayıt bulunamadı.`
        : `No record found for this ${order_number ? 'order number' : 'phone number'}.`;
      const notFoundInstruction = business.language === 'TR'
        ? '\n\n[TALİMAT: Bu bilgiyi müşteriye HEMEN sesli olarak aktar.]'
        : '\n\n[INSTRUCTION: Speak this information to the customer NOW.]';
      return {
        success: false,
        error: notFoundMessage + notFoundInstruction,
        notFound: true
      };
    }

    console.log('✅ Customer found:', customer.companyName);

    // Parse custom fields
    const customFields = customer.customFields || {};

    // Format response based on data type
    const responseData = formatAllData(customer, customFields);
    const responseMessage = formatResponseMessage(customer, customFields, query_type, business.language);

    // Add instruction for AI to speak the result (fixes "kontrol ediyorum" without follow-up issue)
    const instruction = business.language === 'TR'
      ? '\n\n[TALİMAT: Bu bilgiyi müşteriye HEMEN sesli olarak aktar. "Kontrol ediyorum" gibi şeyler SÖYLEME - direkt bilgiyi paylaş.]'
      : '\n\n[INSTRUCTION: Speak this information to the customer NOW. Do NOT say "checking" - share the info directly.]';

    return {
      success: true,
      data: responseData,
      message: responseMessage + instruction
    };

  } catch (error) {
    console.error('❌ Customer data lookup error:', error);
    return {
      success: false,
      error: business.language === 'TR'
        ? 'Veri sorgulanırken bir hata oluştu.'
        : 'An error occurred while looking up data.'
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
 * Format all data from customer record
 * Returns ALL customFields so AI can use any data
 */
function formatAllData(customer, customFields) {
  return {
    // Base customer info
    customer_name: customer.companyName,
    contact_name: customer.contactName,
    phone: customer.phone,
    email: customer.email,
    notes: customer.notes,
    tags: customer.tags,
    // ALL custom fields - includes order info, accounting, support, etc.
    ...customFields
  };
}

/**
 * Format human-readable response message
 * Automatically detects data type from customFields
 */
function formatResponseMessage(customer, customFields, queryType, language) {
  const isTR = language === 'TR';
  let message = '';

  // Detect data type from customFields (expanded detection for various field names)
  const orderFieldNames = [
    'Sipariş No', 'Siparis No', 'SİPARİŞ NO', 'Sipariş Numarası', 'Siparis Numarasi',
    'SİPARİŞ NUMARASI', 'Sipariş no', 'sipariş no', 'SİPARİS NO', 'Siparis no',
    'order_number', 'orderNumber', 'Order Number', 'Order No', 'OrderNo',
    'ORDER NUMBER', 'ORDER NO', 'siparis_no', 'siparisNo', 'SiparisNo',
    'Sipariş', 'SIPARIS', 'siparis', 'order', 'Order', 'ORDER'
  ];
  const hasOrderData = orderFieldNames.some(fieldName => customFields[fieldName]);
  const hasAccountingData = customFields.sgkDebt || customFields['SGK Borcu'] || customFields.taxDebt || customFields['Vergi Borcu'];
  const hasSupportData = customFields['Arıza Türü'] || customFields['Durum'] || customFields['ariza_turu'];
  const hasAppointmentData = customFields['Randevu Tarihi'] || customFields['randevu_tarihi'];

  // ORDER DATA
  if (hasOrderData || queryType === 'siparis' || queryType === 'order') {
    // Find order number from any of the possible field names
    let orderNo = '-';
    for (const fieldName of orderFieldNames) {
      if (customFields[fieldName]) {
        orderNo = customFields[fieldName];
        break;
      }
    }
    const product = customFields['Ürün'] || customFields['Urun'] || customFields['ÜRÜN'] || customFields['product'] || '-';
    const amount = customFields['Tutar'] || customFields['TUTAR'] || customFields['tutar'] || customFields['amount'] || '-';
    const orderDate = customFields['Sipariş Tarihi'] || customFields['Siparis Tarihi'] || customFields['order_date'] || '-';
    const status = customFields['Kargo Durumu'] || customFields['Durum'] || customFields['status'] || '-';
    const trackingNo = customFields['Kargo Takip No'] || customFields['tracking_number'] || '-';
    const customerName = customFields['Müşteri Adı'] || customFields['Musteri Adi'] || customer.companyName;
    const notes = customFields['Notlar'] || customFields['NOTLAR'] || customer.notes || '';

    if (isTR) {
      message = `${orderNo} numaralı siparişiniz ${customerName} adına kayıtlı`;
      if (orderDate !== '-') message += ` ve ${orderDate} tarihinde oluşturulmuş`;
      message += `. Şu anda "${status}" aşamasında.`;

      if (product !== '-') {
        message += ` Siparişinizdeki ürünler: ${product}.`;
      }
      if (amount !== '-') {
        message += ` Toplam tutar: ${amount} TL.`;
      }
      if (trackingNo !== '-') {
        message += ` Kargo takip numaranız: ${trackingNo}.`;
      }
      if (notes) {
        message += ` Not: ${notes}`;
      }
    } else {
      message = `Order ${orderNo} is registered to ${customerName}`;
      if (orderDate !== '-') message += ` and was created on ${orderDate}`;
      message += `. Current status: "${status}".`;

      if (product !== '-') {
        message += ` Products: ${product}.`;
      }
      if (amount !== '-') {
        message += ` Total amount: ${amount}.`;
      }
      if (trackingNo !== '-') {
        message += ` Tracking number: ${trackingNo}.`;
      }
    }
    return message;
  }

  // ACCOUNTING DATA
  if (hasAccountingData || queryType === 'muhasebe' || queryType === 'sgk_borcu' || queryType === 'vergi_borcu') {
    message = isTR ? `Müşteri: ${customer.companyName}` : `Customer: ${customer.companyName}`;

    const sgkDebt = customFields.sgkDebt || customFields['SGK Borcu'];
    const taxDebt = customFields.taxDebt || customFields['Vergi Borcu'];

    if (sgkDebt) {
      message += isTR ? `\nSGK Borcu: ${formatMoney(sgkDebt)}` : `\nSSI Debt: ${formatMoney(sgkDebt)}`;
    }
    if (taxDebt) {
      message += isTR ? `\nVergi Borcu: ${formatMoney(taxDebt)}` : `\nTax Debt: ${formatMoney(taxDebt)}`;
    }
    return message;
  }

  // SUPPORT/SERVICE DATA
  if (hasSupportData || queryType === 'ariza') {
    const issueType = customFields['Arıza Türü'] || customFields['ariza_turu'] || '-';
    const status = customFields['Durum'] || customFields['status'] || '-';
    const address = customFields['Adres'] || customFields['address'] || '';

    if (isTR) {
      message = `${customer.companyName} için kayıtlı arıza/servis talebi:\n`;
      message += `Arıza Türü: ${issueType}\n`;
      message += `Durum: ${status}`;
      if (address) message += `\nAdres: ${address}`;
    } else {
      message = `Service request for ${customer.companyName}:\n`;
      message += `Issue Type: ${issueType}\n`;
      message += `Status: ${status}`;
      if (address) message += `\nAddress: ${address}`;
    }
    return message;
  }

  // APPOINTMENT DATA
  if (hasAppointmentData || queryType === 'randevu') {
    const date = customFields['Randevu Tarihi'] || customFields['randevu_tarihi'] || '-';
    const time = customFields['Randevu Saati'] || customFields['randevu_saati'] || '';
    const service = customFields['Hizmet'] || customFields['hizmet'] || '';
    const status = customFields['Durum'] || customFields['status'] || '';

    if (isTR) {
      message = `${customer.companyName} için randevu bilgisi:\n`;
      message += `Tarih: ${date}`;
      if (time) message += ` Saat: ${time}`;
      if (service) message += `\nHizmet: ${service}`;
      if (status) message += `\nDurum: ${status}`;
    } else {
      message = `Appointment for ${customer.companyName}:\n`;
      message += `Date: ${date}`;
      if (time) message += ` Time: ${time}`;
      if (service) message += `\nService: ${service}`;
      if (status) message += `\nStatus: ${status}`;
    }
    return message;
  }

  // GENERIC - Show all available data
  message = isTR ? `${customer.companyName} bilgileri:\n` : `${customer.companyName} info:\n`;

  // Add all custom fields
  for (const [key, value] of Object.entries(customFields)) {
    if (value && !key.startsWith('_')) {
      message += `${key}: ${value}\n`;
    }
  }

  if (customer.notes) {
    message += isTR ? `\nNotlar: ${customer.notes}` : `\nNotes: ${customer.notes}`;
  }

  return message.trim();
}

/**
 * Format money value
 */
function formatMoney(value) {
  if (value === null || value === undefined) return '0 TL';
  const num = Number(value);
  if (isNaN(num)) return String(value);
  return `${num.toLocaleString('tr-TR')} TL`;
}

export default { execute };
