/**
 * Order Status Handler
 * Checks order status via E-commerce Aggregator (Shopify, WooCommerce, ikas)
 *
 * SECURITY: 2-way verification for order data
 * - Single identifier query → requires verification
 * - Two matching identifiers → returns data
 */

import ecommerceAggregator from '../../services/ecommerce-aggregator.js';

// In-memory verification state cache (same pattern as customer-data-lookup)
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
 * Normalize Turkish characters to ASCII equivalents
 */
function normalizeTurkish(str) {
  if (!str) return '';
  return str
    .replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ı/g, 'i').replace(/İ/g, 'i')
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c');
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.substring(1);
  if (digits.startsWith('90') && digits.length > 10) digits = digits.substring(2);
  return digits.slice(-10); // Last 10 digits
}

/**
 * Check if two values match (with fuzzy matching for names)
 */
function valuesMatch(provided, stored, type) {
  if (!provided || !stored) return false;

  const providedStr = String(provided).toLowerCase().trim();
  const storedStr = String(stored).toLowerCase().trim();

  if (type === 'phone') {
    return normalizePhone(providedStr) === normalizePhone(storedStr);
  }

  if (type === 'name') {
    const providedNorm = normalizeTurkish(providedStr);
    const storedNorm = normalizeTurkish(storedStr);
    // Check if first name or full name matches
    return storedNorm.includes(providedNorm) || providedNorm.includes(storedNorm) || storedNorm === providedNorm;
  }

  if (type === 'email') {
    return providedStr === storedStr;
  }

  return providedStr === storedStr;
}

/**
 * Execute order status check with 2-way verification
 * @param {Object} args - Tool arguments from AI
 * @param {Object} business - Business object with integrations
 * @param {Object} context - Execution context (channel, callerPhone, etc.)
 * @returns {Object} Result object
 */
export async function execute(args, business, context = {}) {
  try {
    const { order_number, customer_phone, customer_email, customer_name } = args;
    const sessionId = context.sessionId || `order-${business.id}-${Date.now()}`;
    const callerPhone = context.callerPhone;

    console.log('🔍 Checking order status:', { order_number, customer_phone, customer_email, customer_name, sessionId });

    // Validate - at least one parameter required
    if (!order_number && !customer_phone && !customer_email) {
      return {
        success: false,
        error: business.language === 'TR'
          ? 'Sipariş numarası, telefon numarası veya e-posta gerekli. Lütfen birini belirtin.'
          : 'Order number, phone number, or email required. Please provide at least one.'
      };
    }

    // Check for pending verification
    const pendingVerification = verificationCache.get(sessionId);

    if (pendingVerification) {
      console.log('🔐 Found pending verification for session:', sessionId);

      // User is providing verification info
      const order = pendingVerification.order;

      // Try to verify with provided info
      let verified = false;
      let verificationField = null;

      // Check phone verification
      if (customer_phone && order.customerPhone) {
        if (valuesMatch(customer_phone, order.customerPhone, 'phone')) {
          verified = true;
          verificationField = 'phone';
        } else {
          console.log('❌ Phone verification failed:', customer_phone, 'vs', order.customerPhone);
          verificationCache.delete(sessionId);
          return {
            success: false,
            error: business.language === 'TR'
              ? 'Verdiğiniz telefon numarası bu siparişle eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum.'
              : 'The phone number you provided does not match this order. For security reasons, I cannot share the details.',
            verificationFailed: true
          };
        }
      }

      // Check name verification
      if (!verified && customer_name && order.customerName) {
        if (valuesMatch(customer_name, order.customerName, 'name')) {
          verified = true;
          verificationField = 'name';
        } else {
          console.log('❌ Name verification failed:', customer_name, 'vs', order.customerName);
          verificationCache.delete(sessionId);
          return {
            success: false,
            error: business.language === 'TR'
              ? 'Verdiğiniz isim bu siparişle eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum.'
              : 'The name you provided does not match this order. For security reasons, I cannot share the details.',
            verificationFailed: true
          };
        }
      }

      // Check email verification
      if (!verified && customer_email && order.customerEmail) {
        if (valuesMatch(customer_email, order.customerEmail, 'email')) {
          verified = true;
          verificationField = 'email';
        } else {
          console.log('❌ Email verification failed');
          verificationCache.delete(sessionId);
          return {
            success: false,
            error: business.language === 'TR'
              ? 'Verdiğiniz e-posta bu siparişle eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum.'
              : 'The email you provided does not match this order. For security reasons, I cannot share the details.',
            verificationFailed: true
          };
        }
      }

      if (verified) {
        console.log('✅ Verification SUCCESS via:', verificationField);
        verificationCache.delete(sessionId);

        // Return order data
        const responseMessage = ecommerceAggregator.formatOrderStatus(order, business.language);
        return {
          success: true,
          data: {
            orderNumber: order.orderNumber,
            status: order.status,
            statusText: order.statusText,
            totalPrice: order.totalPrice,
            currency: order.currency,
            tracking: order.tracking,
            items: order.items?.map(i => i.title).join(', '),
            platform: order.platform
          },
          message: responseMessage
        };
      }

      // No verification provided yet, remind user
      return {
        success: false,
        requiresVerification: true,
        message: pendingVerification.verificationMessage
      };
    }

    // Use aggregator to search across platforms
    const result = await ecommerceAggregator.searchOrder(business.id, {
      orderNumber: order_number,
      phone: customer_phone,
      email: customer_email
    });

    // Handle not found / no platform
    if (!result.success) {
      if (result.code === 'NO_PLATFORM') {
        return {
          success: false,
          error: business.language === 'TR'
            ? 'E-ticaret platformu bağlı değil.'
            : 'No e-commerce platform connected.'
        };
      }

      return {
        success: false,
        error: result.error || (business.language === 'TR'
          ? 'Sipariş bulunamadı. Lütfen sipariş numaranızı veya telefon numaranızı kontrol edin.'
          : 'Order not found. Please check your order number or phone number.')
      };
    }

    const order = result.order;
    console.log(`✅ Order found from ${order.platform}: ${order.orderNumber}`);

    // ============================================================
    // 2-WAY VERIFICATION LOGIC
    // ============================================================

    // Count how many identifiers were provided
    let providedIdentifiers = 0;
    let verifiedByCallerPhone = false;

    if (order_number) providedIdentifiers++;
    if (customer_phone) providedIdentifiers++;
    if (customer_email) providedIdentifiers++;
    if (customer_name) providedIdentifiers++;

    // Check if caller's phone matches order's phone (auto-verify for phone calls)
    if (callerPhone && order.customerPhone) {
      if (valuesMatch(callerPhone, order.customerPhone, 'phone')) {
        console.log('✅ CALLER ID VERIFICATION: Caller phone matches order - skipping verification');
        verifiedByCallerPhone = true;
      }
    }

    // If caller phone matches OR two identifiers provided and match, return data
    if (verifiedByCallerPhone || providedIdentifiers >= 2) {
      // Verify the second identifier matches
      if (providedIdentifiers >= 2 && !verifiedByCallerPhone) {
        let matchCount = 0;

        if (order_number && order.orderNumber &&
            order_number.toLowerCase() === order.orderNumber.toLowerCase()) {
          matchCount++;
        }
        if (customer_phone && order.customerPhone &&
            valuesMatch(customer_phone, order.customerPhone, 'phone')) {
          matchCount++;
        }
        if (customer_email && order.customerEmail &&
            valuesMatch(customer_email, order.customerEmail, 'email')) {
          matchCount++;
        }
        if (customer_name && order.customerName &&
            valuesMatch(customer_name, order.customerName, 'name')) {
          matchCount++;
        }

        if (matchCount < 2) {
          console.log('❌ Two identifiers provided but they point to different orders');
          return {
            success: false,
            error: business.language === 'TR'
              ? 'Verdiğiniz bilgiler birbiriyle eşleşmiyor. Güvenlik nedeniyle bilgileri paylaşamıyorum.'
              : 'The information you provided does not match. For security reasons, I cannot share the details.',
            verificationFailed: true
          };
        }
      }

      console.log('✅ Verification passed - returning order data');
      const responseMessage = ecommerceAggregator.formatOrderStatus(order, business.language);

      return {
        success: true,
        data: {
          orderNumber: order.orderNumber,
          status: order.status,
          statusText: order.statusText,
          totalPrice: order.totalPrice,
          currency: order.currency,
          tracking: order.tracking,
          items: order.items?.map(i => i.title).join(', '),
          platform: order.platform
        },
        message: responseMessage
      };
    }

    // Single identifier provided - require verification
    console.log('🔐 Single identifier provided - requiring verification');

    // Determine what verification options are available
    const verificationOptions = [];

    if (order.customerPhone && !customer_phone) {
      verificationOptions.push({
        type: 'phone',
        labelTR: 'telefon numaranızı',
        labelEN: 'your phone number'
      });
    }
    if (order.customerName && !customer_name) {
      verificationOptions.push({
        type: 'name',
        labelTR: 'adınızı',
        labelEN: 'your name'
      });
    }
    if (order.customerEmail && !customer_email) {
      verificationOptions.push({
        type: 'email',
        labelTR: 'e-posta adresinizi',
        labelEN: 'your email'
      });
    }

    // Build verification message
    let verificationMessage;
    if (verificationOptions.length === 0) {
      // No additional info available for verification - unusual but handle gracefully
      verificationMessage = business.language === 'TR'
        ? 'Siparişinizi buldum. Güvenlik doğrulaması için bilgilerinizi onaylar mısınız?'
        : 'I found your order. Could you please confirm your details for security verification?';
    } else {
      const isTR = business.language === 'TR';
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

      verificationMessage = isTR
        ? `Siparişinizi buldum. Güvenlik doğrulaması için ${optionsList} söyler misiniz?`
        : `I found your order. For security verification, could you please provide ${optionsList}?`;
    }

    // Store pending verification
    verificationCache.set(sessionId, {
      order: order,
      timestamp: Date.now(),
      verificationMessage: verificationMessage,
      verificationOptions: verificationOptions
    });

    // Add AI instruction
    const aiInstruction = business.language === 'TR'
      ? '\n\n[AI TALİMAT: GÜVENLİK - Doğrulama tamamlanana kadar sipariş detaylarını SÖYLEME! Sadece doğrulama bilgisi iste.]'
      : '\n\n[AI INSTRUCTION: SECURITY - Do NOT reveal order details until verification is complete! Just ask for verification info.]';

    return {
      success: false,
      requiresVerification: true,
      message: verificationMessage + aiInstruction,
      verificationPending: true
    };

  } catch (error) {
    console.error('❌ Check order status error:', error);

    return {
      success: false,
      error: business.language === 'TR'
        ? 'Sipariş sorgulanırken bir hata oluştu. Lütfen daha sonra tekrar deneyin.'
        : 'An error occurred while checking order. Please try again later.'
    };
  }
}

export default { execute };
