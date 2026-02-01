/**
 * Routing & Tool Call Assertions
 * Ensures correct tool routing and parameter handling
 */

/**
 * Normalize tool call to extract name
 * Supports both string[] and object[] formats
 */
function getToolName(tc) {
  return typeof tc === 'string' ? tc : tc?.name;
}

/**
 * Normalize tool call to extract full object
 * Returns { name, parameters } regardless of input format
 */
function normalizeToolCall(tc) {
  if (typeof tc === 'string') {
    return { name: tc, parameters: {} };
  }
  return { name: tc?.name, parameters: tc?.parameters || tc?.args || {} };
}

/**
 * Assert tool was called
 */
export function assertToolCalled(toolCalls, expectedToolName) {
  const called = toolCalls.some(tc => getToolName(tc) === expectedToolName);

  if (!called) {
    const names = toolCalls.map(tc => getToolName(tc)).filter(Boolean);
    return {
      passed: false,
      reason: `Expected tool '${expectedToolName}' to be called, but got: ${names.join(', ') || 'none'}`
    };
  }

  return { passed: true };
}

/**
 * Assert tool was NOT called
 */
export function assertToolNotCalled(toolCalls, toolName) {
  const called = toolCalls.some(tc => getToolName(tc) === toolName);

  if (called) {
    return {
      passed: false,
      reason: `Tool '${toolName}' should not have been called`
    };
  }

  return { passed: true };
}

/**
 * Assert tool parameters match expected
 */
export function assertToolParameters(toolCalls, toolName, expectedParams) {
  const toolCall = toolCalls.map(normalizeToolCall).find(tc => tc.name === toolName);

  if (!toolCall) {
    return {
      passed: false,
      reason: `Tool '${toolName}' was not called`
    };
  }

  const mismatches = [];
  Object.entries(expectedParams).forEach(([key, expectedValue]) => {
    const actualValue = toolCall.parameters?.[key];

    if (actualValue !== expectedValue) {
      mismatches.push(`${key}: expected '${expectedValue}', got '${actualValue}'`);
    }
  });

  if (mismatches.length > 0) {
    return {
      passed: false,
      reason: `Parameter mismatches: ${mismatches.join(', ')}`
    };
  }

  return { passed: true };
}

/**
 * Assert correct businessId routing (no cross-tenant)
 */
export function assertCorrectBusinessId(toolCalls, expectedBusinessId) {
  const violations = [];

  toolCalls.map(normalizeToolCall).forEach(tc => {
    const businessId = tc.parameters?.businessId;

    if (businessId && businessId !== expectedBusinessId) {
      violations.push({
        tool: tc.name,
        expected: expectedBusinessId,
        actual: businessId
      });
    }
  });

  if (violations.length > 0) {
    return {
      passed: false,
      reason: `Cross-tenant routing detected: ${violations.map(v => `${v.tool}(businessId=${v.actual})`).join(', ')}`
    };
  }

  return { passed: true };
}

/**
 * Assert no tool calls (conversation only)
 */
export function assertNoToolCalls(toolCalls) {
  if (toolCalls && toolCalls.length > 0) {
    const names = toolCalls.map(tc => getToolName(tc)).filter(Boolean);
    return {
      passed: false,
      reason: `Expected no tool calls, but got: ${names.join(', ')}`
    };
  }

  return { passed: true };
}

/**
 * Assert deterministic routing (same input -> same tool)
 */
export function assertDeterministicRouting(toolCallsRun1, toolCallsRun2) {
  const tools1 = toolCallsRun1.map(tc => getToolName(tc)).filter(Boolean).sort();
  const tools2 = toolCallsRun2.map(tc => getToolName(tc)).filter(Boolean).sort();

  if (JSON.stringify(tools1) !== JSON.stringify(tools2)) {
    return {
      passed: false,
      reason: `Non-deterministic routing: Run1=[${tools1.join(',')}], Run2=[${tools2.join(',')}]`
    };
  }

  return { passed: true };
}

export default {
  assertToolCalled,
  assertToolNotCalled,
  assertToolParameters,
  assertCorrectBusinessId,
  assertNoToolCalls,
  assertDeterministicRouting
};
