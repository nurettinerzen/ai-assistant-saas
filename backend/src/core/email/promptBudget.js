/**
 * Prompt Token Budget Manager
 *
 * Ensures total prompt doesn't exceed model context limits.
 * Priority: Tool Results > Snippets > RAG Examples > Knowledge Base
 *
 * MODEL-SPECIFIC LIMITS:
 * - gpt-4o: 128K context window
 * - gpt-4o-mini: 128K context window
 * - Input budget: 100K tokens (conservative, leaves room for output)
 * - Output budget: 4K tokens (max_tokens parameter)
 * - Total safe: 104K / 128K (81% utilization)
 *
 * NOTE: Using rough estimation (1 token ≈ 4 chars) for performance.
 * Production: Consider tiktoken for exact counts if budget becomes tight.
 */

// Token estimation (rough but fast: 1 token ≈ 4 chars for English/Turkish)
// This is conservative - actual ratio is ~3.5-4.5 chars/token for mixed content
const CHARS_PER_TOKEN = 4;

// Model-specific context windows
const MODEL_LIMITS = {
  'gpt-4o': {
    contextWindow: 128000,
    inputBudget: 100000,
    outputBudget: 4000
  },
  'gpt-4o-mini': {
    contextWindow: 128000,
    inputBudget: 100000,
    outputBudget: 4000
  },
  'gpt-4-turbo': {
    contextWindow: 128000,
    inputBudget: 100000,
    outputBudget: 4000
  },
  'gpt-4': {
    contextWindow: 8192,
    inputBudget: 6000,
    outputBudget: 2000
  }
};

/**
 * Get budget for model
 * @param {string} model - Model name (default: gpt-4o)
 * @returns {Object} Budget allocations
 */
function getModelBudget(model = 'gpt-4o') {
  const limits = MODEL_LIMITS[model] || MODEL_LIMITS['gpt-4o'];

  return {
    // Total input budget (leaves room for output)
    TOTAL_INPUT_MAX: limits.inputBudget,
    OUTPUT_MAX: limits.outputBudget,

    // Component allocations (in tokens)
    SYSTEM_PROMPT_BASE: 3000,   // Base system prompt + instructions
    USER_PROMPT: 2000,          // User message + email body
    THREAD_HISTORY: 4000,       // Previous conversation messages
    TOOL_RESULTS: 20000,        // PRIORITY 1: Tool data (PROTECTED - never truncate)
    SNIPPETS: 3000,             // PRIORITY 2: Approved templates
    RAG_EXAMPLES: 10000,        // PRIORITY 3: Similar emails
    KNOWLEDGE_BASE: 15000,      // PRIORITY 4: Docs/FAQs
    STYLE_PROFILE: 2000,        // User writing style
    BUFFER: 8000                // Safety margin (8% of total)
  };
}

/**
 * Estimate token count from text
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate text to approximate token limit
 */
function truncateToTokens(text, maxTokens) {
  if (!text) return '';

  const maxChars = maxTokens * CHARS_PER_TOKEN;

  if (text.length <= maxChars) {
    return text;
  }

  // Truncate at sentence boundary if possible
  const truncated = text.substring(0, maxChars);
  const lastSentence = truncated.lastIndexOf('.');

  if (lastSentence > maxChars * 0.7) {
    return truncated.substring(0, lastSentence + 1);
  }

  return truncated + '...';
}

/**
 * Apply token budget to context components
 *
 * Priority order (highest to lowest):
 * 1. Tool Results - NEVER truncate (business-critical data)
 * 2. Snippets - Truncate if needed
 * 3. RAG Examples - Truncate or drop
 * 4. Knowledge Base - Truncate aggressively
 *
 * @param {Object} components
 * @param {Object} options
 * @param {string} options.model - Model name for budget limits
 * @returns {Object} Budgeted components + stats
 */
export function applyTokenBudget(components, options = {}) {
  const BUDGET = getModelBudget(options.model || 'gpt-4o');
  const {
    systemPromptBase = '',
    userPrompt = '',
    threadHistory = '',
    toolResults = '',
    snippets = '',
    ragExamples = [],
    knowledgeBase = '',
    styleProfile = ''
  } = components;

  // Track token usage
  const usage = {
    systemPromptBase: estimateTokens(systemPromptBase),
    userPrompt: estimateTokens(userPrompt),
    threadHistory: estimateTokens(threadHistory),
    toolResults: estimateTokens(toolResults),
    snippets: estimateTokens(snippets),
    ragExamples: 0,
    knowledgeBase: estimateTokens(knowledgeBase),
    styleProfile: estimateTokens(styleProfile)
  };

  // Calculate fixed usage (cannot be truncated)
  const fixedUsage =
    usage.systemPromptBase +
    usage.userPrompt +
    usage.threadHistory +
    usage.toolResults; // Tool results are PROTECTED

  // Calculate remaining budget
  let remainingBudget = BUDGET.TOTAL_INPUT_MAX - fixedUsage - BUDGET.BUFFER;

  if (remainingBudget < 0) {
    console.error('🚨 [TokenBudget] CRITICAL: Fixed components exceed budget!');
    console.error(`Fixed usage: ${fixedUsage} tokens, Max: ${BUDGET.TOTAL_INPUT_MAX}`);

    // Emergency truncation (last resort)
    return {
      components: {
        systemPromptBase: truncateToTokens(systemPromptBase, BUDGET.SYSTEM_PROMPT_BASE),
        userPrompt: truncateToTokens(userPrompt, BUDGET.USER_PROMPT),
        threadHistory: truncateToTokens(threadHistory, BUDGET.THREAD_HISTORY),
        toolResults, // NEVER truncate
        snippets: '',
        ragExamples: [],
        knowledgeBase: '',
        styleProfile: truncateToTokens(styleProfile, BUDGET.STYLE_PROFILE)
      },
      usage,
      truncated: true,
      budgetExceeded: true
    };
  }

  // Apply budgets in priority order

  // PRIORITY 2: Snippets (protected but can be truncated if needed)
  let snippetsBudgeted = snippets;
  if (usage.snippets > BUDGET.SNIPPETS) {
    snippetsBudgeted = truncateToTokens(snippets, BUDGET.SNIPPETS);
    usage.snippets = BUDGET.SNIPPETS;
    console.warn(`⚠️ [TokenBudget] Snippets truncated to ${BUDGET.SNIPPETS} tokens`);
  }
  remainingBudget -= usage.snippets;

  // PRIORITY 3: RAG Examples (truncate or drop)
  let ragExamplesBudgeted = ragExamples;
  let ragTokensUsed = 0;

  if (Array.isArray(ragExamples) && ragExamples.length > 0) {
    const ragBudget = Math.min(BUDGET.RAG_EXAMPLES, remainingBudget * 0.6); // Max 60% of remaining
    ragExamplesBudgeted = [];

    for (const example of ragExamples) {
      const exampleText = example.reply_body || '';
      const exampleTokens = estimateTokens(exampleText);

      if (ragTokensUsed + exampleTokens <= ragBudget) {
        ragExamplesBudgeted.push(example);
        ragTokensUsed += exampleTokens;
      } else {
        console.log(`⚠️ [TokenBudget] Dropped RAG example (budget exceeded)`);
        break;
      }
    }

    usage.ragExamples = ragTokensUsed;
    remainingBudget -= ragTokensUsed;

    console.log(`📊 [TokenBudget] RAG: ${ragExamplesBudgeted.length}/${ragExamples.length} examples, ${ragTokensUsed} tokens`);
  }

  // PRIORITY 4: Knowledge Base (aggressive truncation)
  let knowledgeBaseBudgeted = knowledgeBase;
  const kbBudget = Math.min(BUDGET.KNOWLEDGE_BASE, remainingBudget * 0.8); // Max 80% of remaining

  if (usage.knowledgeBase > kbBudget) {
    knowledgeBaseBudgeted = truncateToTokens(knowledgeBase, kbBudget);
    usage.knowledgeBase = kbBudget;
    console.warn(`⚠️ [TokenBudget] Knowledge base truncated to ${kbBudget} tokens`);
  }
  remainingBudget -= usage.knowledgeBase;

  // Final usage calculation
  const totalUsage = Object.values(usage).reduce((sum, val) => sum + val, 0);
  const utilizationPercent = Math.round((totalUsage / BUDGET.TOTAL_INPUT_MAX) * 100);

  console.log(`📊 [TokenBudget] Input: ${totalUsage}/${BUDGET.TOTAL_INPUT_MAX} tokens (${utilizationPercent}%), Output budget: ${BUDGET.OUTPUT_MAX}`);

  if (totalUsage > BUDGET.TOTAL_INPUT_MAX) {
    console.error(`🚨 [TokenBudget] INPUT EXCEEDED: ${totalUsage} > ${BUDGET.TOTAL_INPUT_MAX}`);
  }

  return {
    components: {
      systemPromptBase,
      userPrompt,
      threadHistory,
      toolResults,
      snippets: snippetsBudgeted,
      ragExamples: ragExamplesBudgeted,
      knowledgeBase: knowledgeBaseBudgeted,
      styleProfile
    },
    usage,
    totalUsage,
    utilizationPercent,
    inputBudget: BUDGET.TOTAL_INPUT_MAX,
    outputBudget: BUDGET.OUTPUT_MAX,
    truncated: totalUsage > BUDGET.TOTAL_INPUT_MAX * 0.9,
    budgetExceeded: totalUsage > BUDGET.TOTAL_INPUT_MAX
  };
}

/**
 * Get token budget stats for a model
 */
export function getBudgetStats(model = 'gpt-4o') {
  return {
    model,
    limits: MODEL_LIMITS[model] || MODEL_LIMITS['gpt-4o'],
    budget: getModelBudget(model),
    CHARS_PER_TOKEN,
    note: 'Using rough estimation. For exact counts, use tiktoken library.'
  };
}

// Token estimation accuracy tracking (in-memory)
const estimationAccuracy = {
  samples: [],
  maxSamples: 100 // Keep last 100 samples
};

/**
 * Record token estimation accuracy
 * Compare estimated vs actual tokens from OpenAI response
 *
 * @param {number} estimated - Our rough estimate
 * @param {number} actual - Actual tokens from OpenAI API
 * @param {string} component - Which component (systemPrompt, toolResults, etc.)
 */
export function recordTokenAccuracy(estimated, actual, component = 'total') {
  const error = actual - estimated;
  const errorPercent = Math.round((error / actual) * 100);

  const sample = {
    estimated,
    actual,
    error,
    errorPercent,
    component,
    timestamp: new Date()
  };

  estimationAccuracy.samples.push(sample);

  // Keep only last maxSamples
  if (estimationAccuracy.samples.length > estimationAccuracy.maxSamples) {
    estimationAccuracy.samples.shift();
  }

  // Log significant errors (>20% off)
  if (Math.abs(errorPercent) > 20) {
    console.warn(`⚠️ [TokenBudget] Estimation off by ${errorPercent}% for ${component}: estimated=${estimated}, actual=${actual}`);
  }

  return sample;
}

/**
 * Get token estimation accuracy stats
 */
export function getEstimationAccuracy() {
  if (estimationAccuracy.samples.length === 0) {
    return {
      samples: 0,
      avgError: 0,
      avgErrorPercent: 0,
      recommendation: 'No data yet'
    };
  }

  const totalError = estimationAccuracy.samples.reduce((sum, s) => sum + s.error, 0);
  const totalErrorPercent = estimationAccuracy.samples.reduce((sum, s) => sum + Math.abs(s.errorPercent), 0);

  const avgError = Math.round(totalError / estimationAccuracy.samples.length);
  const avgErrorPercent = Math.round(totalErrorPercent / estimationAccuracy.samples.length);

  // Provide recommendation
  let recommendation = 'Estimation is accurate';
  if (avgErrorPercent > 20) {
    recommendation = 'Consider using tiktoken library for exact counts';
  } else if (avgErrorPercent > 10) {
    recommendation = 'Estimation acceptable but could be improved';
  }

  return {
    samples: estimationAccuracy.samples.length,
    avgError,
    avgErrorPercent,
    recommendation,
    recent: estimationAccuracy.samples.slice(-5)
  };
}

/**
 * Adjust CHARS_PER_TOKEN based on observed accuracy
 * Call this periodically to tune estimation
 */
export function calibrateEstimation() {
  const stats = getEstimationAccuracy();

  if (stats.samples < 20) {
    return { calibrated: false, reason: 'Not enough samples (<20)' };
  }

  // If we're consistently over/underestimating, suggest adjustment
  const adjustmentFactor = 1 + (stats.avgErrorPercent / 100);
  const suggestedCharsPerToken = Math.round(CHARS_PER_TOKEN * adjustmentFactor * 10) / 10;

  console.log(`📊 [TokenBudget] Calibration: avgError=${stats.avgErrorPercent}%, suggested CHARS_PER_TOKEN=${suggestedCharsPerToken} (current=${CHARS_PER_TOKEN})`);

  return {
    calibrated: true,
    currentCharsPerToken: CHARS_PER_TOKEN,
    suggestedCharsPerToken,
    avgErrorPercent: stats.avgErrorPercent,
    recommendation: stats.recommendation
  };
}

export default {
  applyTokenBudget,
  getBudgetStats,
  estimateTokens,
  truncateToTokens,
  recordTokenAccuracy,
  getEstimationAccuracy,
  calibrateEstimation
};
