/**
 * Customer Data Lookup Handler
 * Retrieves customer information based on phone number OR order number
 * Supports all data types: orders, accounting, support, appointments, etc.
 *
 * SECURITY: 2-way verification for sensitive data
 * - First query with single identifier → requires verification
 * - Second query with both identifiers → verifies and returns data
 */

import prisma from '../../prismaClient.js';

// In-memory verification state cache
// Key: sessionId, Value: { pendingOrderNumber, pendingPhone, foundCustomerId, timestamp }
const verificationCache = new Map();
const VERIFICATION_TTL = 10 * 60 * 1000; // 10 minutes

// Cleanup old verification states every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of verificationCache) {
    if (now - state.timestamp > VERIFICATION_TTL) {
      verificationCache.delete(key);
    }
  }
}, 2 * 60 * 1000);

/**
 * Execute customer data lookup
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object
 * @param {Object} context - Execution context (callerPhone, channel, sessionId, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    let { query_type, phone, order_number, customer_name } = args;
    const sessionId = context.sessionId || context.conversationId || `${business.id}-unknown`;

    console.log('🔍 Customer Data Lookup:', { query_type, phone, order_number, customer_name, businessId: business.id, sessionId });

    // Get phone from args or context
    let lookupPhone = phone || context.callerPhone || context.phone || context.from;

    // ============================================================================
    // PENDING VERIFICATION CHECK - Merge with previous query if exists
    // ============================================================================
    const pendingVerification = verificationCache.get(sessionId);

    if (pendingVerification) {
      console.log('🔐 Found pending verification for session:', sessionId, pendingVerification);

      // If user provided phone and we were waiting for verification (had order_number pending)
      if (lookupPhone && pendingVerification.pendingOrderNumber && !order_number) {
        console.log('🔐 Merging: User provided phone for pending order verification');
        order_number = pendingVerification.pendingOrderNumber;
      }
      // If user provided customer_name for verification
      else if (customer_name && pendingVerification.pendingOrderNumber) {
        console.log('🔐 Verifying by customer name:', customer_name);
        // Check if name matches
        const pendingCustomerName = pendingVerification.foundCustomerName?.toLowerCase().trim();
        const providedName = customer_name.toLowerCase().trim();

        // Fuzzy match: check if provided name contains or is contained in customer name
        const nameMatches = pendingCustomerName?.includes(providedName) ||
                           providedName.includes(pendingCustomerName) ||
                           pendingCustomerName === providedName;

        if (nameMatches) {
          console.log('✅ VERIFICATION SUCCESS: Name matches');
          verificationCache.delete(sessionId);
          // Return the customer data directly
          const customer = await prisma.customerData.findUnique({
            where: { id: pendingVerification.foundCustomerId }
          });
          if (customer) {
            const customFields = customer.customFields || {};
            const responseData = formatAllData(customer, customFields);
            const responseMessage = formatResponseMessage(customer, customFields, query_type, business.language);
            const instruction = business.language === 'TR'
              ? '\n\n[TALİMAT: Bu bilgiyi müşteriye HEMEN aktar.]'
              : '\n\n[INSTRUCTION: Share this information with the customer NOW.]';
            return {
              success: true,
              data: responseData,
              message: responseMessage + instruction
            };
          }
        } else {
          console.log('❌ VERIFICATION FAILED: Name does not match');
          verificationCache.delete(sessionId);
          const failMessage = business.language === 'TR'
            ? 'Verdiğiniz isim bu siparişle eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum.'
            : 'The name you provided does not match this order. For security reasons, I cannot share the details.';
          return {
            success: false,
            error: failMessage,
            verificationFailed: true
          };
        }
      }
      // If user provided order_number and we were waiting for order (had phone pending)
      else if (order_number && pendingVerification.pendingPhone && !lookupPhone) {
        console.log('🔐 Merging: User provided order for pending phone verification');
        lookupPhone = pendingVerification.pendingPhone;
      }
    }

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
      const rawPhone = String(lookupPhone).replace(/[^\d]/g, ''); // Just digits
      const last10 = rawPhone.slice(-10); // Last 10 digits (Turkish mobile format)

      console.log('🔍 Searching by phone:', { normalizedPhone, rawPhone, last10 });

      // Try multiple formats to find the customer
      const phoneVariants = [
        normalizedPhone,           // e.g., 905321234567
        rawPhone,                  // e.g., 05321234567 or 5321234567
        last10,                    // e.g., 5321234567
        '0' + last10,              // e.g., 05321234567
        '90' + last10,             // e.g., 905321234567
        '+90' + last10             // e.g., +905321234567
      ].filter(Boolean);

      // Remove duplicates
      const uniqueVariants = [...new Set(phoneVariants)];
      console.log('🔍 Phone variants to try:', uniqueVariants);

      // Try exact match with each variant
      for (const phone of uniqueVariants) {
        customer = await prisma.customerData.findFirst({
          where: {
            businessId: business.id,
            phone: phone
          }
        });
        if (customer) {
          console.log('✅ Found by exact match with:', phone);
          break;
        }
      }

      // Try flexible endsWith search if exact match fails
      if (!customer && last10) {
        console.log('🔍 Trying endsWith search with last 10 digits:', last10);
        customer = await prisma.customerData.findFirst({
          where: {
            businessId: business.id,
            phone: { endsWith: last10 }
          }
        });
        if (customer) {
          console.log('✅ Found by endsWith with:', last10);
        }
      }

      // Try contains search as last resort
      if (!customer && last10) {
        console.log('🔍 Trying contains search with last 10 digits:', last10);
        customer = await prisma.customerData.findFirst({
          where: {
            businessId: business.id,
            phone: { contains: last10 }
          }
        });
        if (customer) {
          console.log('✅ Found by contains with:', last10);
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

    // ============================================================================
    // 2-WAY VERIFICATION LOGIC
    // ============================================================================

    // Note: pendingVerification was already fetched at the top for merge logic
    // Re-fetch here in case it was modified (though currently it shouldn't be)
    const currentPendingVerification = verificationCache.get(sessionId);

    // CASE 1: Verification in progress - user provided second identifier
    if (pendingVerification && pendingVerification.foundCustomerId === customer.id) {
      // User's second identifier matched the same customer record = VERIFIED
      console.log('✅ VERIFICATION SUCCESS: Both identifiers match customer', customer.id);
      verificationCache.delete(sessionId); // Clear verification state

      // Proceed to return full data (fall through to existing logic)
    }
    // CASE 2: Verification in progress but second identifier points to DIFFERENT customer
    else if (pendingVerification && pendingVerification.foundCustomerId !== customer.id) {
      console.log('❌ VERIFICATION FAILED: Identifiers point to different customers');
      verificationCache.delete(sessionId);

      const failMessage = business.language === 'TR'
        ? 'Verdiğiniz bilgiler birbiriyle eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum. Lütfen doğru bilgilerle tekrar deneyin.'
        : 'The information you provided does not match. For security reasons, I cannot share the details. Please try again with correct information.';

      return {
        success: false,
        error: failMessage,
        verificationFailed: true
      };
    }
    // CASE 3: First query with SINGLE identifier - require verification
    // Only if user provided ONLY one of: order_number OR phone (not both)
    // AND user did NOT provide customer_name (if they did, skip to CASE 5 for direct verification)
    else if (((order_number && !lookupPhone) || (lookupPhone && !order_number)) && !customer_name) {
      // Check if this is sensitive data (accounting, orders with financial info)
      const hasSensitiveData = customFields.sgkDebt || customFields['SGK Borcu'] ||
                               customFields.taxDebt || customFields['Vergi Borcu'] ||
                               customFields['Tutar'] || customFields['Toplam'] ||
                               customFields['Bakiye'] || customFields['Borç'];

      // For sensitive data, require verification
      // Also require verification for order lookups (to prevent unauthorized tracking)
      if (hasSensitiveData || order_number) {
        console.log('🔐 VERIFICATION REQUIRED: Sensitive data or order lookup');

        // Store pending verification
        verificationCache.set(sessionId, {
          pendingOrderNumber: order_number || null,
          pendingPhone: lookupPhone || null,
          foundCustomerId: customer.id,
          foundCustomerName: customer.companyName,
          timestamp: Date.now()
        });

        // Ask for second identifier - MUST be phone number for order lookups
        // SECURITY: Do NOT reveal customer name or any other info before verification!
        const askForPhone = order_number != null; // User gave order, ask for phone
        const verificationMessage = business.language === 'TR'
          ? (askForPhone
              ? `Bu sipariş numarasına ait bir kayıt buldum. Güvenlik doğrulaması için siparişe kayıtlı telefon numaranızı veya adınızı söyler misiniz?`
              : `Kaydınızı buldum. Güvenlik doğrulaması için sipariş numaranızı söyler misiniz?`)
          : (askForPhone
              ? `I found a record for this order number. For security verification, could you please provide your phone number or name registered with this order?`
              : `I found your record. For security verification, could you please provide your order number?`);

        // Add instruction for AI - do NOT reveal any customer info before verification
        const aiInstruction = business.language === 'TR'
          ? '\n\n[AI TALİMAT: GÜVENLİK UYARISI - Doğrulama tamamlanana kadar müşteriye HİÇBİR BİLGİ VERME! İsim, adres, sipariş detayı vs. SÖYLEME. Sadece telefon veya isim iste.]'
          : '\n\n[AI INSTRUCTION: SECURITY WARNING - Do NOT reveal ANY customer info until verification is complete! Do not say name, address, order details etc. Just ask for phone or name.]';

        return {
          success: true,
          requiresVerification: true,
          message: verificationMessage + aiInstruction,
          verificationPending: true,
          requiredVerificationType: 'phone_or_name' // Accept phone or name for verification
        };
      }
    }

    // CASE 4: User provided BOTH identifiers at once - verify they match
    if (order_number && lookupPhone) {
      // We already found a customer, but need to verify the other identifier matches
      // Check if customer's phone matches the provided phone
      const customerPhoneNormalized = normalizePhone(customer.phone);
      const providedPhoneNormalized = normalizePhone(lookupPhone);
      const providedLast10 = String(lookupPhone).replace(/[^\d]/g, '').slice(-10);
      const customerLast10 = String(customer.phone).replace(/[^\d]/g, '').slice(-10);

      const phoneMatches = customerPhoneNormalized === providedPhoneNormalized ||
                          customerLast10 === providedLast10 ||
                          customer.phone?.includes(providedLast10);

      if (!phoneMatches) {
        console.log('❌ VERIFICATION FAILED: Phone does not match order record');
        const failMessage = business.language === 'TR'
          ? 'Verdiğiniz telefon numarası bu siparişle eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum.'
          : 'The phone number you provided does not match this order. For security reasons, I cannot share the details.';

        return {
          success: false,
          error: failMessage,
          verificationFailed: true
        };
      }
      console.log('✅ Both identifiers provided and match - verification passed');
    }

    // CASE 5: User provided order_number AND customer_name together (no pending verification needed)
    // This handles the case when user corrects their name after a failed verification
    if (order_number && customer_name && !lookupPhone) {
      // Verify customer name matches
      const storedCustomerName = customer.companyName?.toLowerCase().trim();
      const providedName = customer_name.toLowerCase().trim();

      // Fuzzy match: check if provided name contains or is contained in customer name
      const nameMatches = storedCustomerName?.includes(providedName) ||
                          providedName.includes(storedCustomerName) ||
                          storedCustomerName === providedName;

      if (nameMatches) {
        console.log('✅ DIRECT VERIFICATION SUCCESS: Name matches with order');
        verificationCache.delete(sessionId); // Clear any old state
        // Fall through to return data
      } else {
        console.log('❌ DIRECT VERIFICATION FAILED: Name does not match order record');
        const failMessage = business.language === 'TR'
          ? 'Verdiğiniz isim bu siparişle eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum. Lütfen siparişe kayıtlı telefon numaranızı söyleyin.'
          : 'The name you provided does not match this order. For security reasons, I cannot share the details. Please provide your registered phone number.';

        return {
          success: false,
          error: failMessage,
          verificationFailed: true
        };
      }
    }

    // ============================================================================
    // END VERIFICATION LOGIC - Proceed to return data
    // ============================================================================

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

    // SGK Debt and Due Date
    const sgkDebt = customFields.sgkDebt || customFields['SGK Borcu'] || customFields['SGK BORCU'];
    const sgkDueDate = customFields.sgkDueDate || customFields['SGK Vadesi'] || customFields['SGK VADESİ'] || customFields['SGK VADESI'];

    // Tax Debt and Due Date
    const taxDebt = customFields.taxDebt || customFields['Vergi Borcu'] || customFields['VERGİ BORCU'] || customFields['VERGI BORCU'];
    const taxDueDate = customFields.taxDueDate || customFields['Vergi Vadesi'] || customFields['VERGİ VADESİ'] || customFields['VERGI VADESI'];

    // Other Debt
    const otherDebt = customFields.otherDebt || customFields['Diğer Borç'] || customFields['DİĞER BORÇ'] || customFields['DIGER BORC'];
    const otherDebtDesc = customFields.otherDebtDescription || customFields['Diğer Borç Açıklama'] || customFields['DİĞER BORÇ AÇIKLAMA'];

    if (sgkDebt) {
      message += isTR ? `\nSGK Borcu: ${formatMoney(sgkDebt)}` : `\nSSI Debt: ${formatMoney(sgkDebt)}`;
      if (sgkDueDate) {
        message += isTR ? ` (Son ödeme: ${sgkDueDate})` : ` (Due: ${sgkDueDate})`;
      }
    }
    if (taxDebt) {
      message += isTR ? `\nVergi Borcu: ${formatMoney(taxDebt)}` : `\nTax Debt: ${formatMoney(taxDebt)}`;
      if (taxDueDate) {
        message += isTR ? ` (Son ödeme: ${taxDueDate})` : ` (Due: ${taxDueDate})`;
      }
    }
    if (otherDebt && parseFloat(otherDebt) > 0) {
      message += isTR ? `\nDiğer Borç: ${formatMoney(otherDebt)}` : `\nOther Debt: ${formatMoney(otherDebt)}`;
      if (otherDebtDesc) {
        message += ` (${otherDebtDesc})`;
      }
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
