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
      console.log('🔐 Found pending verification for session:', sessionId);
      console.log('🔐 Expected fields:', pendingVerification.expectedVerificationFields?.map(f => f.type));

      // Try to verify with any of the expected fields
      const verificationResult = tryDynamicVerification(pendingVerification, {
        phone: lookupPhone,
        order_number,
        customer_name,
        query_type,
        // Pass all args in case user provides VKN, TC, etc.
        ...args
      }, business.language);

      if (verificationResult.verified) {
        console.log('✅ VERIFICATION SUCCESS:', verificationResult.matchedField);
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
      } else if (verificationResult.failed) {
        console.log('❌ VERIFICATION FAILED:', verificationResult.reason);
        verificationCache.delete(sessionId);
        return {
          success: false,
          error: verificationResult.message,
          verificationFailed: true
        };
      }
      // else: no verification attempt yet, continue with normal flow

      // Merge pending data if user is providing second identifier
      if (lookupPhone && pendingVerification.pendingOrderNumber && !order_number) {
        order_number = pendingVerification.pendingOrderNumber;
      } else if (order_number && pendingVerification.pendingPhone && !lookupPhone) {
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
    else if ((order_number && !lookupPhone) || (lookupPhone && !order_number)) {
      // Check if this is sensitive data (accounting, orders with financial info)
      const hasSensitiveData = customFields.sgkDebt || customFields['SGK Borcu'] ||
                               customFields.taxDebt || customFields['Vergi Borcu'] ||
                               customFields['Tutar'] || customFields['Toplam'] ||
                               customFields['Bakiye'] || customFields['Borç'];

      // ============================================================================
      // CALLER ID VERIFICATION - Skip verification if caller's phone matches record
      // This applies to PHONE and WHATSAPP channels where we have trusted caller ID
      // ============================================================================
      const callerPhone = context.callerPhone || context.phone || context.from;
      const channel = context.channel?.toUpperCase();
      const isTrustedChannel = channel === 'PHONE' || channel === 'WHATSAPP';

      if (isTrustedChannel && callerPhone && customer.phone) {
        const callerNormalized = normalizePhone(callerPhone);
        const customerNormalized = normalizePhone(customer.phone);
        const callerLast10 = String(callerPhone).replace(/[^\d]/g, '').slice(-10);
        const customerLast10 = String(customer.phone).replace(/[^\d]/g, '').slice(-10);

        const callerMatchesRecord = callerNormalized === customerNormalized ||
                                    callerLast10 === customerLast10 ||
                                    (callerLast10.length >= 7 && customerLast10.includes(callerLast10));

        if (callerMatchesRecord) {
          console.log('✅ CALLER ID VERIFICATION: Caller phone matches record - skipping verification');
          console.log(`   Caller: ${callerPhone} → Record: ${customer.phone}`);
          // Skip verification - caller is verified by their phone number
          // Fall through to return data directly
        }
      }

      // For sensitive data, require verification (unless caller was verified above)
      // Also require verification for order lookups (to prevent unauthorized tracking)
      const callerWasVerified = isTrustedChannel && callerPhone && customer.phone &&
        (normalizePhone(callerPhone) === normalizePhone(customer.phone) ||
         String(callerPhone).replace(/[^\d]/g, '').slice(-10) === String(customer.phone).replace(/[^\d]/g, '').slice(-10));

      if ((hasSensitiveData || order_number) && !callerWasVerified) {
        console.log('🔐 VERIFICATION REQUIRED: Sensitive data or order lookup');

        // Dynamically determine which fields can be used for verification
        // Based on what fields exist in the record and what user already provided
        const verificationOptions = getAvailableVerificationFields(customer, customFields, {
          providedPhone: lookupPhone,
          providedOrderNumber: order_number,
          providedName: customer_name
        });

        // Store pending verification with expected verification fields
        verificationCache.set(sessionId, {
          pendingOrderNumber: order_number || null,
          pendingPhone: lookupPhone || null,
          foundCustomerId: customer.id,
          foundCustomerName: customer.companyName,
          foundCustomerData: customFields, // Store all data for verification matching
          expectedVerificationFields: verificationOptions, // What fields we expect for verification
          timestamp: Date.now()
        });

        // Build verification question based on available fields
        const verificationMessage = buildVerificationMessage(verificationOptions, business.language);

        // Add instruction for AI - do NOT reveal any customer info before verification
        const aiInstruction = business.language === 'TR'
          ? '\n\n[AI TALİMAT: GÜVENLİK UYARISI - Doğrulama tamamlanana kadar müşteriye HİÇBİR BİLGİ VERME! İsim, adres, borç detayı vs. SÖYLEME. Sadece doğrulama bilgisi iste.]'
          : '\n\n[AI INSTRUCTION: SECURITY WARNING - Do NOT reveal ANY customer info until verification is complete! Do not say name, address, debt details etc. Just ask for verification info.]';

        return {
          success: true,
          requiresVerification: true,
          message: verificationMessage + aiInstruction,
          verificationPending: true,
          requiredVerificationType: verificationOptions.map(f => f.type).join('_or_')
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
 * Try to verify user with dynamically expected fields
 * Returns { verified: true, matchedField } or { failed: true, message } or { verified: false, failed: false }
 */
function tryDynamicVerification(pendingVerification, providedData, language) {
  const isTR = language === 'TR';
  const expectedFields = pendingVerification.expectedVerificationFields || [];
  const storedData = pendingVerification.foundCustomerData || {};
  const storedName = pendingVerification.foundCustomerName;

  // Check each expected verification field type
  for (const expectedField of expectedFields) {
    let providedValue = null;
    let storedValue = expectedField.value;

    // Get provided value based on field type
    // AI may send the value in various argument names
    switch (expectedField.type) {
      case 'phone':
        providedValue = providedData.phone;
        break;
      case 'name':
        providedValue = providedData.customer_name || providedData.name || providedData.firma || providedData.isletme;
        if (!storedValue) storedValue = storedName;
        break;
      case 'vkn':
        providedValue = providedData.vkn || providedData.vergi_kimlik || providedData.tax_id || providedData.vergi_no;
        break;
      case 'tc':
        providedValue = providedData.tc || providedData.tckn || providedData.tc_kimlik || providedData.tc_no || providedData.national_id;
        break;
      case 'order':
        providedValue = providedData.order_number || providedData.siparis_no || providedData.siparis;
        break;
      case 'email':
        providedValue = providedData.email || providedData.eposta;
        break;
      case 'plate':
        providedValue = providedData.plaka || providedData.plate || providedData.arac_plaka;
        break;
      case 'customer_id':
        providedValue = providedData.musteri_no || providedData.customer_id || providedData.hesap_no;
        break;
      case 'appointment':
        providedValue = providedData.randevu || providedData.randevu_tarihi || providedData.appointment;
        break;
      case 'ticket':
        providedValue = providedData.ariza_no || providedData.servis_no || providedData.ticket || providedData.destek_no;
        break;
    }

    // If user provided this field, try to verify
    if (providedValue && storedValue) {
      const matches = fuzzyMatch(providedValue, storedValue, expectedField.type);

      if (matches) {
        return { verified: true, matchedField: expectedField.type };
      } else {
        // User provided a value but it doesn't match
        const failMessage = isTR
          ? 'Verdiğiniz bilgi kayıtlarımızla eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum.'
          : 'The information you provided does not match our records. For security reasons, I cannot share the details.';
        return { failed: true, message: failMessage, reason: `${expectedField.type} mismatch` };
      }
    }
  }

  // No verification attempted yet (user didn't provide any expected field)
  return { verified: false, failed: false };
}

/**
 * Fuzzy match values based on field type
 */
function fuzzyMatch(provided, stored, fieldType) {
  if (!provided || !stored) return false;

  const providedStr = String(provided).toLowerCase().trim();
  const storedStr = String(stored).toLowerCase().trim();

  switch (fieldType) {
    case 'phone':
      // Compare last 10 digits for phone
      const providedDigits = providedStr.replace(/[^\d]/g, '').slice(-10);
      const storedDigits = storedStr.replace(/[^\d]/g, '').slice(-10);
      return providedDigits === storedDigits || providedDigits.length >= 7 && storedDigits.includes(providedDigits);

    case 'name':
      // Fuzzy name match - check if one contains the other
      return storedStr.includes(providedStr) || providedStr.includes(storedStr) || storedStr === providedStr;

    case 'vkn':
    case 'tc':
    case 'customer_id':
    case 'ticket':
      // Exact match for ID numbers (after removing spaces/dashes)
      const providedClean = providedStr.replace(/[\s\-]/g, '');
      const storedClean = storedStr.replace(/[\s\-]/g, '');
      return providedClean === storedClean;

    case 'email':
      return providedStr === storedStr;

    case 'plate':
      // Normalize plate (remove spaces, dashes)
      const providedPlate = providedStr.replace(/[\s\-]/g, '').toUpperCase();
      const storedPlate = storedStr.replace(/[\s\-]/g, '').toUpperCase();
      return providedPlate === storedPlate;

    case 'order':
      // Case-insensitive order number match
      return providedStr === storedStr || providedStr.replace(/[\s\-]/g, '') === storedStr.replace(/[\s\-]/g, '');

    case 'appointment':
      // Date matching - flexible format comparison
      // Remove common separators and compare
      const providedDate = providedStr.replace(/[\s\.\/\-]/g, '');
      const storedDate = storedStr.replace(/[\s\.\/\-]/g, '');
      return providedDate === storedDate || storedStr.includes(providedStr) || providedStr.includes(storedStr);

    default:
      return providedStr === storedStr;
  }
}

/**
 * Get available fields that can be used for verification
 * Automatically detects verifiable fields from record and excludes already provided ones
 */
function getAvailableVerificationFields(customer, customFields, providedData) {
  const verificationFields = [];

  // Define field patterns that can be used for verification
  // Format: { patterns: [...], type: 'identifier', labelTR: '...', labelEN: '...' }
  const verifiableFieldPatterns = [
    {
      patterns: ['telefon', 'phone', 'tel', 'gsm', 'cep', 'mobile'],
      type: 'phone',
      labelTR: 'telefon numaranızı',
      labelEN: 'your phone number'
    },
    {
      // VKN - Vergi Kimlik Numarası (10 haneli)
      patterns: ['vkn', 'vergi kimlik', 'vergi no', 'tax id', 'tax number'],
      type: 'vkn',
      labelTR: 'vergi kimlik numaranızı',
      labelEN: 'your tax ID number'
    },
    {
      // TC Kimlik No (11 haneli)
      patterns: ['tc no', 'tc kimlik', 'tckn', 'kimlik no', 'national id', 'identity'],
      type: 'tc',
      labelTR: 'TC kimlik numaranızı',
      labelEN: 'your national ID number'
    },
    {
      // İsim/Firma - birçok varyasyon
      patterns: ['işletme', 'isletme', 'müşteri adı', 'musteri adi', 'yetkili', 'firma', 'şirket', 'sirket', 'company', 'isim soyisim', 'ad soyad', 'name'],
      type: 'name',
      labelTR: 'adınızı veya firma adınızı',
      labelEN: 'your name or company name'
    },
    {
      // Sipariş numarası
      patterns: ['sipariş no', 'siparis no', 'sipariş', 'siparis', 'order no', 'order number', 'order'],
      type: 'order',
      labelTR: 'sipariş numaranızı',
      labelEN: 'your order number'
    },
    {
      patterns: ['email', 'e-posta', 'eposta', 'mail'],
      type: 'email',
      labelTR: 'e-posta adresinizi',
      labelEN: 'your email address'
    },
    {
      patterns: ['plaka', 'plate', 'araç plaka', 'arac plaka'],
      type: 'plate',
      labelTR: 'araç plakanızı',
      labelEN: 'your vehicle plate number'
    },
    {
      patterns: ['müşteri no', 'musteri no', 'customer id', 'customer number', 'hesap no', 'account'],
      type: 'customer_id',
      labelTR: 'müşteri numaranızı',
      labelEN: 'your customer number'
    },
    {
      // Randevu için tarih/saat
      patterns: ['randevu tarihi', 'randevu', 'appointment date', 'appointment'],
      type: 'appointment',
      labelTR: 'randevu tarihinizi',
      labelEN: 'your appointment date'
    },
    {
      // Arıza/Servis için
      patterns: ['arıza no', 'ariza no', 'servis no', 'ticket', 'ticket no', 'destek no'],
      type: 'ticket',
      labelTR: 'arıza/servis numaranızı',
      labelEN: 'your service ticket number'
    }
  ];

  // Check base customer fields
  if (customer.phone && !providedData.providedPhone) {
    verificationFields.push({ type: 'phone', labelTR: 'telefon numaranızı', labelEN: 'your phone number', value: customer.phone });
  }
  if (customer.companyName && !providedData.providedName) {
    verificationFields.push({ type: 'name', labelTR: 'adınızı veya firma adınızı', labelEN: 'your name or company name', value: customer.companyName });
  }
  if (customer.email) {
    verificationFields.push({ type: 'email', labelTR: 'e-posta adresinizi', labelEN: 'your email address', value: customer.email });
  }

  // Check customFields for verifiable data
  for (const [fieldName, fieldValue] of Object.entries(customFields)) {
    if (!fieldValue) continue;

    const fieldNameLower = fieldName.toLowerCase();

    for (const pattern of verifiableFieldPatterns) {
      const matches = pattern.patterns.some(p => fieldNameLower.includes(p));
      if (matches) {
        // Check if this type was already provided by user
        const alreadyProvided =
          (pattern.type === 'phone' && providedData.providedPhone) ||
          (pattern.type === 'order' && providedData.providedOrderNumber) ||
          (pattern.type === 'name' && providedData.providedName);

        // Check if we already have this type in verification fields
        const alreadyAdded = verificationFields.some(f => f.type === pattern.type);

        if (!alreadyProvided && !alreadyAdded) {
          verificationFields.push({
            type: pattern.type,
            labelTR: pattern.labelTR,
            labelEN: pattern.labelEN,
            value: fieldValue,
            fieldName: fieldName
          });
        }
        break;
      }
    }
  }

  // Limit to max 3 verification options (don't overwhelm user)
  return verificationFields.slice(0, 3);
}

/**
 * Build verification message based on available fields
 */
function buildVerificationMessage(verificationOptions, language) {
  const isTR = language === 'TR';

  if (verificationOptions.length === 0) {
    // No verification fields available - shouldn't happen but handle gracefully
    return isTR
      ? 'Kaydınızı buldum. Güvenlik doğrulaması için bilgilerinizi onaylar mısınız?'
      : 'I found your record. Could you please verify your information for security purposes?';
  }

  // Build list of what we can ask for
  const options = verificationOptions.map(f => isTR ? f.labelTR : f.labelEN);

  let optionsList;
  if (options.length === 1) {
    optionsList = options[0];
  } else if (options.length === 2) {
    optionsList = isTR ? `${options[0]} veya ${options[1]}` : `${options[0]} or ${options[1]}`;
  } else {
    const lastOption = options.pop();
    optionsList = isTR
      ? `${options.join(', ')} veya ${lastOption}`
      : `${options.join(', ')}, or ${lastOption}`;
  }

  return isTR
    ? `Kaydınızı buldum. Güvenlik doğrulaması için ${optionsList} söyler misiniz?`
    : `I found your record. For security verification, could you please provide ${optionsList}?`;
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
