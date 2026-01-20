/**
 * Orchestrator - Stage 2 of AI Pipeline
 *
 * Purpose: Backend decides which tools to call based on Router output
 * - Model does NOT call tools directly
 * - Backend validates inputs before tool execution
 * - Handles security verification (READ vs WRITE)
 * - Returns structured results for Responder
 */

import { getActiveTools, executeTool } from '../../tools/index.js';
import VerificationPolicy from './verification.js';

// Tool mapping by domain/intent
const TOOL_MAPPING = {
  ORDER: {
    check_status: {
      // Prefer by order_number, then phone, then email
      tools: ['check_order_by_number', 'check_order_by_phone', 'check_order_by_email'],
      requiredEntities: ['order_number', 'phone', 'email'], // At least one
      verificationType: 'READ'
    },
    track: {
      tools: ['get_tracking_info'],
      requiredEntities: ['order_number'],
      verificationType: 'READ'
    },
    cancel: {
      tools: [], // Not supported yet - human handoff
      verificationType: 'WRITE'
    },
    return: {
      tools: [], // Not supported yet - human handoff
      verificationType: 'WRITE'
    }
  },
  APPOINTMENT: {
    create: {
      tools: ['create_appointment'],
      requiredEntities: ['date', 'time'], // name, phone collected in conversation
      verificationType: 'WRITE'
    },
    cancel: {
      tools: [], // Not supported yet
      verificationType: 'WRITE'
    },
    check: {
      tools: [], // Not supported yet
      verificationType: 'READ'
    }
  },
  SERVICE: {
    check_ticket: {
      tools: ['check_ticket_status_crm'],
      requiredEntities: [],
      verificationType: 'READ'
    },
    report_issue: {
      tools: ['create_callback'], // Create callback for service request
      requiredEntities: [],
      verificationType: 'WRITE'
    }
  },
  ACCOUNTING: {
    check_debt: {
      tools: ['customer_data_lookup'],
      requiredEntities: [], // Phone from context
      verificationType: 'READ'
    },
    payment_info: {
      tools: ['customer_data_lookup'],
      requiredEntities: [],
      verificationType: 'READ'
    }
  },
  STOCK: {
    check_stock: {
      tools: ['get_product_stock', 'check_stock_crm'],
      requiredEntities: ['product_name'],
      verificationType: 'READ'
    },
    product_info: {
      tools: ['get_product_stock'],
      requiredEntities: ['product_name'],
      verificationType: 'READ'
    }
  },
  CALLBACK: {
    request_callback: {
      tools: ['create_callback'],
      requiredEntities: [], // Will use caller phone
      verificationType: 'WRITE'
    }
  }
};

// Verification requirements
const VERIFICATION_RULES = {
  READ: {
    // READ operations: minimal verification
    // Just need to match caller phone OR provide order number
    requiresVerification: false,
    allowedWithoutVerification: true
  },
  WRITE: {
    // WRITE operations: require some form of verification
    // OTP or caller phone + name match for sensitive ops
    requiresVerification: true,
    allowedWithoutVerification: false
  }
};

class Orchestrator {
  constructor(business, context = {}) {
    this.business = business;
    this.context = context;
    this.callerPhone = context.callerPhone || context.phone || context.from;
    this.channel = context.channel || 'UNKNOWN';

    // Initialize verification policy
    this.verificationPolicy = new VerificationPolicy(context);

    // Get available tools for this business
    this.availableTools = getActiveTools(business).map(t => t.function?.name || t.name);
    console.log('⚙️ [Orchestrator] Available tools:', this.availableTools);
  }

  /**
   * Process router result and decide/execute tools
   * @param {Object} routerResult - { domain, intent, entities, confidence }
   * @param {Array} history - Conversation history
   * @returns {Object} { toolsExecuted, results, success, needsMoreInfo, forceEndCall }
   */
  async process(routerResult, history = []) {
    const { domain, intent, entities } = routerResult;

    // Get tool configuration for this domain/intent
    const toolConfig = TOOL_MAPPING[domain]?.[intent];

    // No tool needed (GREETING, GENERAL, or unmapped)
    if (!toolConfig || !toolConfig.tools || toolConfig.tools.length === 0) {
      console.log('⚙️ [Orchestrator] No tools needed for:', domain, intent);
      return {
        toolsExecuted: [],
        results: [],
        success: true,
        needsMoreInfo: false,
        noToolNeeded: true
      };
    }

    // Check which tools are available for this business
    const availableToolsForIntent = toolConfig.tools.filter(t => this.availableTools.includes(t));

    if (availableToolsForIntent.length === 0) {
      console.log('⚙️ [Orchestrator] No available tools for intent:', intent);
      return {
        toolsExecuted: [],
        results: [],
        success: false,
        needsMoreInfo: false,
        error: 'NO_TOOLS_AVAILABLE',
        errorMessage: this.business.language === 'TR'
          ? 'Bu işlem için gerekli sistem bağlantısı mevcut değil.'
          : 'Required system integration is not available for this operation.'
      };
    }

    // Decide which tool to use based on available entities
    const toolDecision = this.decideToolAndParams(availableToolsForIntent, entities, toolConfig);

    if (toolDecision.needsMoreInfo) {
      console.log('⚙️ [Orchestrator] Need more info:', toolDecision.missingInfo);
      return {
        toolsExecuted: [],
        results: [],
        success: false,
        needsMoreInfo: true,
        missingInfo: toolDecision.missingInfo
      };
    }

    // Check verification policy before executing tool
    const verificationCheck = this.verificationPolicy.checkPermission(
      toolDecision.tool,
      toolDecision.params
    );

    if (!verificationCheck.allowed) {
      console.log('⚙️ [Orchestrator] Verification failed:', verificationCheck.reason);

      // Map verification action to missing info
      const actionToMissingInfo = {
        'ask_phone': 'phone',
        'ask_order_number': 'order_number',
        'ask_email': 'email',
        'ask_name': 'customer_name',
        'verify_phone': 'phone_verification',
        'send_otp': 'otp'
      };

      return {
        toolsExecuted: [],
        results: [],
        success: false,
        needsMoreInfo: true,
        missingInfo: actionToMissingInfo[verificationCheck.requiresAction] || 'verification',
        verificationReason: verificationCheck.reason
      };
    }

    console.log('✅ [Orchestrator] Verification passed:', verificationCheck.reason);

    // Execute the selected tool
    console.log('⚙️ [Orchestrator] Executing tool:', toolDecision.tool, toolDecision.params);

    try {
      const result = await executeTool(
        toolDecision.tool,
        toolDecision.params,
        this.business,
        this.context
      );

      console.log('⚙️ [Orchestrator] Tool result:', result.ok ?? result.success, result.error_code);

      // Check for security termination
      if (result.forceEndCall) {
        return {
          toolsExecuted: [toolDecision.tool],
          results: [result],
          success: false,
          forceEndCall: true,
          securityMessage: result.error || result.message ||
            (this.business.language === 'TR'
              ? 'Güvenlik nedeniyle bu görüşmeyi sonlandırıyorum.'
              : 'Ending this conversation for security reasons.')
        };
      }

      return {
        toolsExecuted: [toolDecision.tool],
        results: [result],
        success: result.ok ?? result.success ?? false
      };
    } catch (error) {
      console.error('⚙️ [Orchestrator] Tool execution error:', error);
      return {
        toolsExecuted: [toolDecision.tool],
        results: [],
        success: false,
        error: 'EXECUTION_ERROR',
        errorMessage: error.message
      };
    }
  }

  /**
   * Decide which tool to use and prepare parameters
   * @param {Array} availableTools - Tools available for this intent
   * @param {Object} entities - Extracted entities
   * @param {Object} toolConfig - Tool configuration
   * @returns {Object} { tool, params, needsMoreInfo, missingInfo }
   */
  decideToolAndParams(availableTools, entities, toolConfig) {
    // For ORDER domain, prioritize based on what entities we have
    if (availableTools.includes('check_order_by_number') && entities.order_number) {
      return {
        tool: 'check_order_by_number',
        params: {
          order_number: Array.isArray(entities.order_number)
            ? entities.order_number[0]
            : entities.order_number,
          customer_name: entities.customer_name || entities.name
        },
        needsMoreInfo: false
      };
    }

    if (availableTools.includes('check_order_by_phone') && (entities.phone || this.callerPhone)) {
      return {
        tool: 'check_order_by_phone',
        params: {
          customer_phone: Array.isArray(entities.phone)
            ? entities.phone[0]
            : (entities.phone || this.callerPhone),
          customer_name: entities.customer_name || entities.name
        },
        needsMoreInfo: false
      };
    }

    if (availableTools.includes('check_order_by_email') && entities.email) {
      return {
        tool: 'check_order_by_email',
        params: {
          customer_email: Array.isArray(entities.email) ? entities.email[0] : entities.email,
          customer_name: entities.customer_name || entities.name
        },
        needsMoreInfo: false
      };
    }

    // For customer data lookup
    if (availableTools.includes('customer_data_lookup')) {
      return {
        tool: 'customer_data_lookup',
        params: {
          phone: entities.phone || this.callerPhone,
          query_type: 'tum_bilgiler'
        },
        needsMoreInfo: false
      };
    }

    // For product stock
    if (availableTools.includes('get_product_stock') && entities.product_name) {
      return {
        tool: 'get_product_stock',
        params: {
          product_name: entities.product_name
        },
        needsMoreInfo: false
      };
    }

    // For callback request
    if (availableTools.includes('create_callback')) {
      return {
        tool: 'create_callback',
        params: {
          phone: entities.phone || this.callerPhone,
          name: entities.customer_name || entities.name,
          reason: 'Müşteri geri arama talep etti'
        },
        needsMoreInfo: false
      };
    }

    // For tracking info
    if (availableTools.includes('get_tracking_info') && entities.order_number) {
      return {
        tool: 'get_tracking_info',
        params: {
          order_number: entities.order_number
        },
        needsMoreInfo: false
      };
    }

    // For appointments
    if (availableTools.includes('create_appointment')) {
      if (!entities.date || !entities.time) {
        return {
          needsMoreInfo: true,
          missingInfo: !entities.date ? 'date' : 'time'
        };
      }
      return {
        tool: 'create_appointment',
        params: {
          date: entities.date,
          time: entities.time,
          name: entities.customer_name || entities.name,
          phone: entities.phone || this.callerPhone
        },
        needsMoreInfo: false
      };
    }

    // Default: need more info (we have tools but not enough entities)
    // For ORDER, we need at least order number, phone, or email
    if (availableTools.some(t => t.startsWith('check_order_'))) {
      return {
        needsMoreInfo: true,
        missingInfo: 'order_identifier', // Sipariş numarası, telefon veya email
        availableTools
      };
    }

    // Fallback: try first available tool with whatever we have
    const firstTool = availableTools[0];
    return {
      tool: firstTool,
      params: {
        ...entities,
        phone: entities.phone || this.callerPhone
      },
      needsMoreInfo: false
    };
  }
}

export default Orchestrator;
