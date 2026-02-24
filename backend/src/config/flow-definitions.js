/**
 * Flow Definitions
 *
 * Defines conversation flows with their requirements, tools, and verification needs.
 *
 * Each flow specifies:
 * - Required slots: Must be collected before tool execution
 * - Optional slots: Nice to have but not required
 * - Allowed tools: Only these tools can be called in this flow
 * - Verification: Whether user identity verification is required
 * - Verification fields: Which fields to collect for verification
 *
 * Business Override Support:
 * Businesses can override these settings via database configuration:
 * - requiresVerification: Can make non-sensitive flows require verification
 * - verificationFields: Can add additional verification fields
 * - enabledFlows: Can disable certain flows entirely
 */

export const FLOW_DEFINITIONS = {
  ORDER_STATUS: {
    name: 'ORDER_STATUS',
    displayName: 'Sipariş Durumu',
    description: 'Kullanıcı sipariş durumunu sorgulamak istiyor',

    // Slot requirements
    requiredSlots: ['order_number'],
    optionalSlots: ['customer_name'],

    // Tool permissions
    allowedTools: [
      'customer_data_lookup',  // For order lookup
      'create_callback',       // If can't help
    ],

    // Verification requirements
    requiresVerification: true,
    verificationFields: ['name'], // Just name is enough (we have order_number)

    // Intent keywords (for router)
    keywords: [
      'sipariş', 'siparis', 'order',
      'kargo', 'teslimat', 'delivery',
      'nerede', 'where', 'durum', 'status'
    ],
  },

  DEBT_INQUIRY: {
    name: 'DEBT_INQUIRY',
    displayName: 'Borç Sorgulama',
    description: 'Kullanıcı borç durumunu öğrenmek istiyor',

    // No slots required - verification gives us customerId
    requiredSlots: [],
    optionalSlots: [],

    // Tool permissions
    allowedTools: [
      'customer_data_lookup',  // For debt lookup
      'create_callback',
    ],

    // Verification requirements (sensitive financial data)
    requiresVerification: true,
    verificationFields: ['name', 'phone'], // More strict verification

    // Intent keywords
    keywords: [
      'borç', 'borc', 'debt',
      'ödeme', 'odeme', 'payment',
      'bakiye', 'balance',
      'kaç para', 'ne kadar'
    ],
  },

  COMPLAINT: {
    name: 'COMPLAINT',
    displayName: 'Şikayet',
    description: 'Kullanıcı şikayette bulunuyor',

    // Required slots
    requiredSlots: ['complaint_details'],
    optionalSlots: ['order_number', 'reference_number'],

    // Tool permissions
    allowedTools: [
      'create_callback',       // Create callback for human handling
      'customer_data_lookup',  // If order_number provided
    ],

    // ⚠️ TOOL POLICY: COMPLAINT flow MUST call create_callback
    // This prevents AI from saying "I'll create a request" without actually doing it
    toolPolicy: {
      requiredTool: 'create_callback',
      reason: 'Complaints must create a callback request for human follow-up'
    },

    // Verification required
    requiresVerification: true,
    verificationFields: ['name', 'phone'],

    // Intent keywords (including sentiment)
    keywords: [
      'şikayet', 'sikayet', 'complaint',
      'memnun değil', 'memnun degil', 'unhappy',
      'kötü', 'kotu', 'bad',
      'berbat', 'rezalet', 'skandal',
      'iade', 'return', 'refund',
      'iptal', 'cancel'
    ],
  },

  APPOINTMENT: {
    name: 'APPOINTMENT',
    displayName: 'Randevu',
    description: 'Kullanıcı randevu almak istiyor',

    // Required slots
    requiredSlots: ['preferred_date'],
    optionalSlots: ['preferred_time', 'service_type', 'party_size'],

    // Tool permissions
    allowedTools: [
      'create_appointment',  // Primary: Create appointment/reservation
      'create_callback',     // Fallback: If appointment can't be created
    ],

    // No verification required — appointment tool collects name+phone itself
    requiresVerification: false,
    verificationFields: [],

    // Intent keywords
    keywords: [
      'randevu', 'appointment',
      'görüşme', 'gorusme', 'meeting',
      'rezervasyon', 'reservation',
      'tarih', 'date', 'saat', 'time'
    ],
  },

  PRODUCT_INFO: {
    name: 'PRODUCT_INFO',
    displayName: 'Ürün Bilgisi',
    description: 'Kullanıcı ürün hakkında bilgi istiyor',

    // Required slots
    requiredSlots: [],
    optionalSlots: ['product_name', 'sku'],

    // Tool permissions
    allowedTools: [
      'get_product_stock',     // Check stock
      'check_stock_crm',       // CRM stock lookup
    ],

    // NO verification required (public information)
    requiresVerification: false,
    verificationFields: [],

    // Intent keywords
    keywords: [
      'ürün', 'urun', 'product',
      'stok', 'stock', 'mevcut', 'available',
      'fiyat', 'price', 'kaç para',
      'özellik', 'ozellik', 'feature',
      'bilgi', 'info', 'information'
    ],
  },

  GENERAL: {
    name: 'GENERAL',
    displayName: 'Genel Sorgu',
    description: 'Genel soru veya bilgi talebi',

    // No slots required
    requiredSlots: [],
    optionalSlots: [],

    // Tool permissions (limited)
    allowedTools: [
      'create_callback',  // If can't answer
    ],

    // NO verification required
    requiresVerification: false,
    verificationFields: [],

    // Intent keywords (catch-all)
    keywords: [
      'merhaba', 'hello', 'hi',
      'yardım', 'yardim', 'help',
      'soru', 'question',
      'bilgi', 'info',
      'nasıl', 'nasil', 'how',
      'nedir', 'what is'
    ],
  },
};

/**
 * Get flow definition by name (case-insensitive)
 */
export function getFlow(flowName) {
  if (!flowName) return null;

  // Try exact match first
  if (FLOW_DEFINITIONS[flowName]) {
    return FLOW_DEFINITIONS[flowName];
  }

  // Try uppercase match
  const uppercaseName = flowName.toUpperCase();
  return FLOW_DEFINITIONS[uppercaseName] || null;
}

/**
 * Map intent name to flow name
 * Intent router uses snake_case (order_status, debt_inquiry)
 * Flow definitions use UPPER_CASE (ORDER_STATUS, DEBT_INQUIRY)
 *
 * @param {string} intentName - Intent from intent-router.js (e.g., 'order_status', 'debt_inquiry')
 * @returns {string|null} - Flow name in UPPER_CASE (e.g., 'ORDER_STATUS', 'DEBT_INQUIRY') or null
 */
export function mapIntentToFlow(intentName) {
  if (!intentName) return null;

  // Intent → Flow mapping
  const INTENT_TO_FLOW = {
    // Direct mappings (intent_name → FLOW_NAME)
    'order_status': 'ORDER_STATUS',
    'debt_inquiry': 'DEBT_INQUIRY',
    'complaint': 'COMPLAINT',
    'appointment': 'APPOINTMENT',

    // Multiple intents can map to same flow
    'tracking_info': 'ORDER_STATUS',     // Tracking is part of order status
    'stock_check': 'PRODUCT_INFO',       // Stock queries → product info
    'product_spec': 'PRODUCT_INFO',      // Product spec queries → product info (REQUIRES TOOL)
    'company_info': 'GENERAL',           // Company info → general conversation
    'greeting': 'GENERAL',               // Greetings → general
    'general_question': 'GENERAL',       // General questions → general

    // Special cases (no specific flow)
    'profanity': null,                   // Profanity doesn't start a flow
    'off_topic': null,                   // Off-topic doesn't start a flow
  };

  return INTENT_TO_FLOW[intentName] || null;
}

/**
 * Get all flow names
 */
export function getAllFlowNames() {
  return Object.keys(FLOW_DEFINITIONS);
}

/**
 * Check if a flow requires verification
 */
export function flowRequiresVerification(flowName) {
  const flow = getFlow(flowName);
  return flow ? flow.requiresVerification : false;
}

/**
 * Get allowed tools for a flow
 */
export function getAllowedTools(flowName) {
  const flow = getFlow(flowName);
  return flow ? flow.allowedTools : [];
}

/**
 * Get verification fields for a flow
 */
export function getVerificationFields(flowName) {
  const flow = getFlow(flowName);
  return flow ? flow.verificationFields : [];
}

/**
 * Apply business overrides to flow definition
 * TODO: Implement when business config is ready
 *
 * @param {string} flowName
 * @param {number} businessId
 * @returns {Object} Flow definition with business overrides applied
 */
export async function getFlowWithOverrides(flowName, businessId) {
  const baseFlow = getFlow(flowName);
  if (!baseFlow) return null;

  // TODO: Fetch business overrides from DB
  // const overrides = await prisma.businessFlowConfig.findUnique({
  //   where: { businessId_flowName: { businessId, flowName } }
  // });

  // For now, return base flow
  return baseFlow;
}
