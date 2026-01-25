/**
 * Step 6: Generate Email Draft
 *
 * Uses LLM to generate the draft response.
 * Includes:
 * - Business context and assistant prompt
 * - Knowledge base
 * - Style profile
 * - Tool results (with full contract)
 * - Thread history
 */

import OpenAI from 'openai';
import { getDateTimeContext } from '../../../utils/dateTime.js';
import { buildAssistantPrompt, getActiveTools } from '../../../services/promptBuilder.js';
import {
  retrieveExamplesForPrompt,
  formatExamplesForPrompt
} from '../rag/retrievalService.js';
import {
  selectSnippetsForContext,
  applyVariablesToSnippet,
  formatSnippetsForPrompt,
  recordSnippetUsage
} from '../rag/snippetService.js';
import {
  recordRAGMetrics,
  shouldUseRAG
} from '../rag/ragMetrics.js';
import {
  enforceFactGrounding,
  getFactGroundingInstructions
} from '../policies/toolRequiredPolicy.js';
import { sanitizeToolResults } from '../toolResultSanitizer.js';
import {
  estimateTokens,
  recordTokenAccuracy
} from '../promptBudget.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate email draft content
 *
 * @param {Object} ctx - Pipeline context
 * @returns {Promise<Object>} { success, inputTokens, outputTokens, error? }
 */
export async function generateEmailDraft(ctx) {
  const {
    businessId,
    business,
    assistant,
    inboundMessage,
    threadMessages,
    knowledgeItems,
    toolResults,
    customerData,
    classification,
    language,
    styleProfile,
    emailSignature,
    signatureType,
    subject,
    customerEmail,
    customerName,
    options = {}
  } = ctx;

  try {
    const ragStartTime = Date.now();
    const effectiveBusinessId = businessId || business?.id;

    // Check business-level RAG settings
    const ragSettings = await shouldUseRAG(effectiveBusinessId, options);

    // Retrieve similar emails for RAG (if enabled)
    let ragExamples = [];
    if (ragSettings.useRAG) {
      try {
        ragExamples = await retrieveExamplesForPrompt({
          businessId: effectiveBusinessId,
          customerEmail: inboundMessage?.bodyText || inboundMessage?.body || '',
          classification,
          maxExamples: ragSettings.maxExamples || 3
        });
        console.log(`📚 [GenerateDraft] Retrieved ${ragExamples.length} RAG examples`);
      } catch (ragError) {
        // RAG failure should not block draft generation
        console.warn('⚠️ [GenerateDraft] RAG retrieval failed:', ragError.message);
      }
    }

    // Select and apply snippets (if enabled)
    let resolvedSnippets = [];
    if (ragSettings.useSnippets) {
      try {
        const selectedSnippets = await selectSnippetsForContext({
          businessId: effectiveBusinessId,
          classification,
          language: language || 'TR',
          ctx,
          maxSnippets: ragSettings.maxSnippets || 2
        });

        // Resolve variables in selected snippets
        for (const snippet of selectedSnippets) {
          const resolved = applyVariablesToSnippet(snippet, snippet.availableVars || {});
          resolvedSnippets.push(resolved);

          // Record usage for analytics
          if (snippet.id) {
            recordSnippetUsage(snippet.id).catch(() => {}); // Fire and forget
          }
        }

        console.log(`📋 [GenerateDraft] Applied ${resolvedSnippets.length} snippets`);
      } catch (snippetError) {
        console.warn('⚠️ [GenerateDraft] Snippet selection failed:', snippetError.message);
      }
    }

    const ragLatencyMs = Date.now() - ragStartTime;

    // CRITICAL: Sanitize tool results before LLM
    // - Remove PII-sensitive fields
    // - Slim verbose data
    // - Enforce size limits
    const sanitizedToolResults = toolResults ? sanitizeToolResults(toolResults, {
      strict: false, // Don't be too aggressive - business data is important
      maxTokensPerTool: 3000
    }) : [];

    // Enforce fact grounding for tool-required intents
    const factGrounding = enforceFactGrounding({
      classification,
      toolResults: sanitizedToolResults,
      ragExamples
    });

    // Build system prompt with sanitized tool results
    const systemPrompt = buildEmailSystemPrompt({
      business,
      assistant,
      knowledgeItems,
      toolResults: sanitizedToolResults, // Use sanitized version
      customerData,
      language,
      styleProfile,
      emailSignature,
      signatureType,
      classification,
      ragExamples,
      snippets: resolvedSnippets,
      factGrounding
    });

    // Build user prompt (the email to reply to)
    const userPrompt = buildEmailUserPrompt({
      inboundMessage,
      threadMessages,
      subject,
      customerEmail,
      customerName
    });

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const draftContent = response.choices[0]?.message?.content || '';

    if (!draftContent || draftContent.trim().length === 0) {
      return {
        success: false,
        error: 'LLM returned empty draft'
      };
    }

    ctx.draftContent = draftContent;
    ctx.rawLLMResponse = response;

    // Store RAG context for metrics
    ctx.ragExamples = ragExamples;
    ctx.resolvedSnippets = resolvedSnippets;
    ctx.ragSettings = ragSettings;

    const inputTokens = response.usage?.prompt_tokens || 0;
    const outputTokens = response.usage?.completion_tokens || 0;

    // Track token estimation accuracy
    // Estimate vs actual from OpenAI API
    const estimatedSystemPrompt = estimateTokens(systemPrompt);
    const estimatedUserPrompt = estimateTokens(userPrompt);
    const estimatedTotal = estimatedSystemPrompt + estimatedUserPrompt;

    recordTokenAccuracy(estimatedTotal, inputTokens, 'total_input');

    if (Math.abs(estimatedTotal - inputTokens) / inputTokens > 0.15) {
      console.warn(`⚠️ [GenerateDraft] Token estimation off by ${Math.round(((estimatedTotal - inputTokens) / inputTokens) * 100)}%`);
    }

    // Record RAG metrics
    recordRAGMetrics({
      businessId: effectiveBusinessId,
      threadId: ctx.threadId,
      retrievalLatencyMs: ragLatencyMs,
      examplesFound: ragExamples.length,
      snippetsFound: resolvedSnippets.length,
      promptTokensBefore: 0, // Would need baseline measurement
      promptTokensAfter: inputTokens,
      ragEnabled: ragSettings.useRAG,
      snippetsEnabled: ragSettings.useSnippets
    });

    return {
      success: true,
      inputTokens,
      outputTokens,
      ragMetrics: {
        latencyMs: ragLatencyMs,
        examplesUsed: ragExamples.length,
        snippetsUsed: resolvedSnippets.length,
        factGroundingEnforced: factGrounding.mustUseVerification
      }
    };

  } catch (error) {
    console.error('❌ [GenerateDraft] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Build system prompt for email draft generation
 */
function buildEmailSystemPrompt({
  business,
  assistant,
  knowledgeItems,
  toolResults,
  customerData,
  language,
  styleProfile,
  emailSignature,
  signatureType,
  classification,
  ragExamples = [],
  snippets = [],
  factGrounding = {}
}) {
  const timezone = business.timezone || 'UTC';
  const dateTimeContext = getDateTimeContext(timezone, language);

  // Base prompt from assistant or default
  let basePrompt = '';
  if (assistant && business) {
    const integrations = business.integrations || [];
    const activeToolsList = getActiveTools(business, integrations);
    basePrompt = buildAssistantPrompt(assistant, business, activeToolsList);
  } else {
    basePrompt = `You are an AI email assistant for ${business.name}, a ${business.businessType?.toLowerCase() || 'general'} business.`;
  }

  // Language instruction
  const languageInstruction = language === 'TR'
    ? 'CRITICAL: Respond ONLY in Turkish (Türkçe). The customer wrote in Turkish.'
    : 'CRITICAL: Respond ONLY in English. The customer wrote in English.';

  // Knowledge base context
  const knowledgeContext = buildKnowledgeContext(knowledgeItems);

  // Style context
  const styleContext = buildStyleContext(styleProfile, language, emailSignature, signatureType);

  // Tool results context
  const toolContext = buildToolResultsContext(toolResults, customerData, language);

  // RAG examples context (reference replies)
  const ragContext = formatExamplesForPrompt(ragExamples);

  // Snippet templates context
  const snippetContext = formatSnippetsForPrompt(snippets);

  // Fact grounding instructions (for tool-required intents)
  const factGroundingContext = getFactGroundingInstructions(factGrounding, language);

  return `${basePrompt}

${dateTimeContext}

${knowledgeContext}

${styleContext}

${toolContext}
${ragContext}
${snippetContext}
${factGroundingContext}
## CRITICAL EMAIL DRAFT RULES:

### 1. LANGUAGE (MOST IMPORTANT)
${languageInstruction}
- NEVER mix languages in the same email
- Match greetings to language (English email = English greeting, Turkish email = Turkish greeting)

### 2. TOOL DATA USAGE
${getToolDataInstructions(toolResults, language)}

### 3. DRAFT-ONLY MODE
- You are generating a DRAFT that will be reviewed before sending
- Do NOT claim you have already taken actions (e.g., "I have processed your order")
- Use tentative language: "I can help with...", "Based on our records...", "I see that..."
- If tool data is not found, ask for clarifying information

### 4. NO PLACEHOLDERS
- NEVER use placeholders like [Your Name], [Company], [İletişim Bilgileri]
- If you don't have information, either ask for it or omit it
- Use only REAL information from context

### 5. RESPONSE STYLE
- Be natural and human-like
- Match the formality level of the incoming email
- Keep responses concise but complete
- Address the customer's actual question/concern

### 6. FORMAT
- Brief greeting (use customer's name if known)
- Direct response to their message
- If applicable, next steps or what you need from them
- Short closing with signature

### 7. VERIFICATION POLICY
- If sensitive information is requested but customer identity is not verified:
  - Ask for minimum required verification info (order number, phone, etc.)
  - Do NOT guess or assume customer details
  - Be helpful about what info you need

Current email classification: ${classification.intent} | Urgency: ${classification.urgency}`;
}

/**
 * Build user prompt with email to reply to
 */
function buildEmailUserPrompt({
  inboundMessage,
  threadMessages,
  subject,
  customerEmail,
  customerName
}) {
  let prompt = `Please draft a reply to this email.\n\n`;

  prompt += `CONTEXT (for your understanding only - do NOT include in response):\n`;
  prompt += `- From: ${customerName || 'Customer'} <${customerEmail}>\n`;
  prompt += `- Subject: ${subject}\n\n`;

  prompt += `IMPORTANT: Your response should be ONLY the email body. Do NOT include:\n`;
  prompt += `- Subject line\n`;
  prompt += `- "Subject:" prefix\n`;
  prompt += `- Email headers\n`;
  prompt += `- Any meta-information\n\n`;

  prompt += `Just write the email reply content directly.\n\n`;
  prompt += `Email to reply to:\n${inboundMessage.bodyText || ''}\n`;

  // Add thread history if more than just the current message
  if (threadMessages && threadMessages.length > 1) {
    prompt += `\n\n--- PREVIOUS CONVERSATION (context only) ---\n`;
    for (const msg of threadMessages.slice(0, -1).slice(-5)) { // Last 5 before current
      const direction = msg.direction === 'INBOUND' ? 'Customer' : 'Us';
      prompt += `\n[${direction}]: ${msg.body?.substring(0, 500)}...\n`;
    }
  }

  return prompt;
}

/**
 * Build knowledge base context
 */
function buildKnowledgeContext(knowledgeItems) {
  if (!knowledgeItems || knowledgeItems.length === 0) return '';

  const kbByType = { URL: [], DOCUMENT: [], FAQ: [] };

  for (const item of knowledgeItems) {
    if (item.type === 'FAQ' && item.question && item.answer) {
      kbByType.FAQ.push(`Q: ${item.question}\nA: ${item.answer}`);
    } else if (item.content) {
      kbByType[item.type]?.push(`[${item.title}]: ${item.content.substring(0, 1000)}`);
    }
  }

  let context = '';
  if (kbByType.FAQ.length > 0) {
    context += '\n\n=== FREQUENTLY ASKED QUESTIONS ===\n' + kbByType.FAQ.join('\n\n');
  }
  if (kbByType.URL.length > 0) {
    context += '\n\n=== WEBSITE CONTENT ===\n' + kbByType.URL.join('\n\n');
  }
  if (kbByType.DOCUMENT.length > 0) {
    context += '\n\n=== DOCUMENTS ===\n' + kbByType.DOCUMENT.join('\n\n');
  }

  return context;
}

/**
 * Build style context from profile
 */
function buildStyleContext(styleProfile, language, emailSignature, signatureType) {
  let context = '';

  // Custom signature
  if (emailSignature) {
    context += '=== EMAIL SIGNATURE ===\n';
    context += 'ALWAYS add this exact signature at the end of every email:\n';
    if (signatureType === 'HTML') {
      context += `[HTML SIGNATURE - Use exactly as provided]\n${emailSignature}\n`;
    } else {
      context += `${emailSignature}\n`;
    }
    context += '\n';
  }

  // Style profile
  if (styleProfile && styleProfile.analyzed) {
    context += '=== WRITING STYLE (MATCH THIS) ===\n';

    if (styleProfile.formality) {
      context += `- Formality: ${styleProfile.formality}\n`;
    }
    if (styleProfile.tone) {
      context += `- Tone: ${styleProfile.tone}\n`;
    }
    if (styleProfile.averageLength) {
      context += `- Length: ${styleProfile.averageLength}\n`;
    }

    // Language-specific greetings
    const langKey = language === 'TR' ? 'turkish' : 'english';
    if (styleProfile.greetingPatterns?.[langKey]) {
      context += `- Use these greetings: ${styleProfile.greetingPatterns[langKey].join(', ')}\n`;
    }
    if (styleProfile.closingPatterns?.[langKey]) {
      context += `- Use these closings: ${styleProfile.closingPatterns[langKey].join(', ')}\n`;
    }
  }

  return context;
}

/**
 * Build tool results context for LLM
 * CRITICAL: Always include outcome + data + message
 *
 * CONTRACT:
 * - outcome: REQUIRED (OK, NOT_FOUND, SYSTEM_ERROR, VERIFICATION_NEEDED)
 * - data: Optional (structured data from tool)
 * - message: REQUIRED (human-readable summary - ALWAYS show in response context)
 *
 * The message field is crucial because:
 * 1. It provides actionable guidance for the LLM
 * 2. It may contain verification requirements
 * 3. It explains WHY data was/wasn't found
 * 4. It must be shown PROMINENTLY even when data exists
 */
function buildToolResultsContext(toolResults, customerData, language) {
  if (!toolResults || toolResults.length === 0) {
    return '=== DATA LOOKUP ===\nNo customer/order data available. Ask for verification if needed.';
  }

  let context = '=== DATA LOOKUP RESULTS ===\n';
  context += 'IMPORTANT: Use these results to inform your response.\n\n';

  // Collect actionable messages to highlight at the top
  const actionableMessages = [];

  for (const result of toolResults) {
    context += `### ${result.toolName}\n`;
    context += `Status: ${result.outcome}\n`;

    // MESSAGE IS CRITICAL - always show it prominently
    if (result.message) {
      context += `📌 Message: ${result.message}\n`;

      // Collect messages that require action
      if (result.outcome !== 'OK' || result.message.includes('doğrulama') || result.message.includes('verification')) {
        actionableMessages.push({
          tool: result.toolName,
          outcome: result.outcome,
          message: result.message
        });
      }
    }

    // Show data if available
    if (result.outcome === 'OK' && result.data) {
      context += `Data:\n${JSON.stringify(result.data, null, 2)}\n`;
    }

    context += '\n';
  }

  // Highlight actionable messages at the top level
  if (actionableMessages.length > 0) {
    context += '\n⚠️ ACTIONABLE ITEMS:\n';
    for (const item of actionableMessages) {
      context += `- [${item.tool}] ${item.message}\n`;
    }
    context += '\n';
  }

  // Highlight customer data if found
  if (customerData) {
    context += '\n### VERIFIED CUSTOMER INFO\n';
    context += `Name: ${customerData.name || 'Unknown'}\n`;
    context += `Phone: ${customerData.phone || 'Unknown'}\n`;
    if (customerData.email) context += `Email: ${customerData.email}\n`;
    if (customerData.lastOrder) context += `Last Order: ${customerData.lastOrder}\n`;
  }

  return context;
}

/**
 * Get tool data usage instructions
 */
function getToolDataInstructions(toolResults, language) {
  if (!toolResults || toolResults.length === 0) {
    return language === 'TR'
      ? '- Müşteri verisi bulunamadı. Gerekirse doğrulama için bilgi isteyin.'
      : '- No customer data found. Ask for verification info if needed.';
  }

  const hasSuccess = toolResults.some(r => r.outcome === 'OK');
  const hasNotFound = toolResults.some(r => r.outcome === 'NOT_FOUND');
  const hasError = toolResults.some(r => r.outcome === 'SYSTEM_ERROR');

  let instructions = '';

  if (hasSuccess) {
    instructions += language === 'TR'
      ? '- Müşteri/sipariş verisi bulundu. Bu bilgileri kullanarak yanıt verin.\n'
      : '- Customer/order data found. Use this information in your response.\n';
  }

  if (hasNotFound) {
    instructions += language === 'TR'
      ? '- Bazı aramalar sonuç vermedi. Müşteriden ek bilgi isteyebilirsiniz.\n'
      : '- Some lookups returned no results. You may ask customer for more info.\n';
  }

  if (hasError) {
    instructions += language === 'TR'
      ? '- Sistem hatası oluştu. Müşteriye teknik sorun yaşandığını bildirin ve daha sonra yardımcı olacağınızı belirtin.\n'
      : '- System error occurred. Inform customer of technical issue and that you will help shortly.\n';
  }

  return instructions;
}

export default { generateEmailDraft };
