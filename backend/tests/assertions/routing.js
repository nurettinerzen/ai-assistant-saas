/**
 * Routing & Tool Call Assertions
 * Ensures correct tool routing and parameter handling
 */

/**
 * Assert tool was called
 */
export function assertToolCalled(toolCalls, expectedToolName) {
  const called = toolCalls.some(tc => tc.name === expectedToolName);

  if (!called) {
    return {
      passed: false,
      reason: `Expected tool '${expectedToolName}' to be called, but got: ${toolCalls.map(tc => tc.name).join(', ') || 'none'}`
    };
  }

  return { passed: true };
}

/**
 * Assert tool was NOT called
 */
export function assertToolNotCalled(toolCalls, toolName) {
  const called = toolCalls.some(tc => tc.name === toolName);

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
  const toolCall = toolCalls.find(tc => tc.name === toolName);

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

  toolCalls.forEach(tc => {
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
    return {
      passed: false,
      reason: `Expected no tool calls, but got: ${toolCalls.map(tc => tc.name).join(', ')}`
    };
  }

  return { passed: true };
}

/**
 * Assert deterministic routing (same input -> same tool)
 */
export function assertDeterministicRouting(toolCallsRun1, toolCallsRun2) {
  const tools1 = toolCallsRun1.map(tc => tc.name).sort();
  const tools2 = toolCallsRun2.map(tc => tc.name).sort();

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
