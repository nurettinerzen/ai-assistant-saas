/**
 * Routing Metrics & Logging
 *
 * Tracks classification accuracy, routing decisions, and potential issues.
 * Critical for measuring classifier quality before production.
 */

const metrics = {
  classifications: [],
  routingDecisions: [],
  violations: []
};

const MAX_HISTORY = 1000; // Keep last 1000 events

/**
 * Log message classification with full context
 */
export function logClassification(data) {
  const entry = {
    timestamp: new Date().toISOString(),
    sessionId: data.sessionId,
    messageType: data.messageType.type,
    confidence: data.messageType.confidence,
    reason: data.messageType.reason,
    // Context
    expectedSlot: data.state.expectedSlot,
    flowStatus: data.state.flowStatus,
    activeFlow: data.state.activeFlow,
    // Message
    userMessage: data.userMessage?.substring(0, 100),
    lastAssistantMessage: data.lastAssistantMessage?.substring(0, 100)
  };

  metrics.classifications.push(entry);
  if (metrics.classifications.length > MAX_HISTORY) {
    metrics.classifications.shift();
  }

  // Console log for immediate debugging
  console.log('📊 [Metrics] Classification:', JSON.stringify({
    type: entry.messageType,
    confidence: entry.confidence,
    reason: entry.reason,
    expectedSlot: entry.expectedSlot,
    flowStatus: entry.flowStatus
  }, null, 2));

  return entry;
}

/**
 * Log routing decision with details
 */
export function logRoutingDecision(data) {
  const entry = {
    timestamp: new Date().toISOString(),
    sessionId: data.sessionId,
    action: data.routing.action,
    reason: data.routing.reason,
    confidence: data.routing.confidence,
    // Trigger details for FOLLOWUP_DISPUTE
    triggerRule: data.triggerRule || null, // 'contradiction' | 'keyword' | 'both'
    // State before routing
    previousFlow: data.state.activeFlow,
    previousFlowStatus: data.state.flowStatus,
    // State after routing
    newFlow: data.newFlow || null,
    newFlowStatus: data.newFlowStatus || null
  };

  metrics.routingDecisions.push(entry);
  if (metrics.routingDecisions.length > MAX_HISTORY) {
    metrics.routingDecisions.shift();
  }

  // Console log
  console.log('🔀 [Metrics] Routing:', JSON.stringify({
    action: entry.action,
    reason: entry.reason,
    triggerRule: entry.triggerRule,
    previousFlow: entry.previousFlow,
    newFlow: entry.newFlow
  }, null, 2));

  return entry;
}

/**
 * Log violations (action claims, slot errors, etc.)
 */
export function logViolation(type, data) {
  const entry = {
    timestamp: new Date().toISOString(),
    type, // 'ACTION_CLAIM' | 'SLOT_ERROR' | 'COMPLAINT_NO_CALLBACK' | 'TOOL_FAILURE' | 'CLASSIFIER_TIMEOUT'
    sessionId: data.sessionId,
    details: data.details,
    resolved: data.resolved || false
  };

  metrics.violations.push(entry);
  if (metrics.violations.length > MAX_HISTORY) {
    metrics.violations.shift();
  }

  console.error('🚨 [Metrics] VIOLATION:', JSON.stringify({
    type: entry.type,
    details: entry.details,
    resolved: entry.resolved
  }, null, 2));

  return entry;
}

/**
 * Log tool execution (for fail rate tracking)
 */
export function logToolExecution(data) {
  const entry = {
    timestamp: new Date().toISOString(),
    sessionId: data.sessionId,
    toolName: data.toolName,
    success: data.success,
    attempts: data.attempts || 1,
    errorType: data.errorType || null,
    executionTime: data.executionTime || null
  };

  if (!metrics.toolExecutions) {
    metrics.toolExecutions = [];
  }

  metrics.toolExecutions.push(entry);
  if (metrics.toolExecutions.length > MAX_HISTORY) {
    metrics.toolExecutions.shift();
  }

  console.log(`🔧 [Metrics] Tool Execution: ${data.toolName} → ${data.success ? 'SUCCESS' : 'FAIL'}`);

  return entry;
}

/**
 * Get classification accuracy metrics
 */
export function getClassificationMetrics() {
  const total = metrics.classifications.length;
  if (total === 0) return null;

  const byType = metrics.classifications.reduce((acc, entry) => {
    acc[entry.messageType] = (acc[entry.messageType] || 0) + 1;
    return acc;
  }, {});

  const avgConfidence = metrics.classifications.reduce((sum, entry) => sum + entry.confidence, 0) / total;

  return {
    total,
    byType,
    avgConfidence,
    recent: metrics.classifications.slice(-10)
  };
}

/**
 * Get routing accuracy metrics
 */
export function getRoutingMetrics() {
  const total = metrics.routingDecisions.length;
  if (total === 0) return null;

  const byAction = metrics.routingDecisions.reduce((acc, entry) => {
    acc[entry.action] = (acc[entry.action] || 0) + 1;
    return acc;
  }, {});

  // FOLLOWUP_DISPUTE trigger analysis
  const disputeTriggers = metrics.routingDecisions
    .filter(e => e.action === 'HANDLE_DISPUTE')
    .reduce((acc, entry) => {
      const trigger = entry.triggerRule || 'unknown';
      acc[trigger] = (acc[trigger] || 0) + 1;
      return acc;
    }, {});

  return {
    total,
    byAction,
    disputeTriggers,
    recent: metrics.routingDecisions.slice(-10)
  };
}

/**
 * Get violations summary
 */
export function getViolationMetrics() {
  const total = metrics.violations.length;
  if (total === 0) return null;

  const byType = metrics.violations.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {});

  const resolved = metrics.violations.filter(v => v.resolved).length;

  return {
    total,
    byType,
    resolved,
    unresolved: total - resolved,
    recent: metrics.violations.slice(-10)
  };
}

/**
 * Print full metrics report
 */
export function printMetricsReport() {
  console.log('\n📊 ===== ROUTING METRICS REPORT =====\n');

  const classification = getClassificationMetrics();
  if (classification) {
    console.log('📨 Classifications:', classification.total);
    console.log('   By type:', classification.byType);
    console.log('   Avg confidence:', classification.avgConfidence.toFixed(2));
  }

  const routing = getRoutingMetrics();
  if (routing) {
    console.log('\n🔀 Routing Decisions:', routing.total);
    console.log('   By action:', routing.byAction);
    console.log('   Dispute triggers:', routing.disputeTriggers);
  }

  const violations = getViolationMetrics();
  if (violations) {
    console.log('\n🚨 Violations:', violations.total);
    console.log('   By type:', violations.byType);
    console.log('   Resolved:', violations.resolved, '/', violations.total);
  }

  console.log('\n=====================================\n');
}

/**
 * Export metrics for analysis
 */
export function exportMetrics() {
  return {
    classifications: metrics.classifications,
    routingDecisions: metrics.routingDecisions,
    violations: metrics.violations,
    summary: {
      classification: getClassificationMetrics(),
      routing: getRoutingMetrics(),
      violations: getViolationMetrics()
    }
  };
}

/**
 * Get tool execution metrics (for dashboard)
 */
export function getToolMetrics() {
  if (!metrics.toolExecutions || metrics.toolExecutions.length === 0) {
    return null;
  }

  const total = metrics.toolExecutions.length;
  const byTool = {};

  metrics.toolExecutions.forEach(exec => {
    if (!byTool[exec.toolName]) {
      byTool[exec.toolName] = { total: 0, success: 0, failed: 0, failRate: 0 };
    }

    byTool[exec.toolName].total++;
    if (exec.success) {
      byTool[exec.toolName].success++;
    } else {
      byTool[exec.toolName].failed++;
    }
  });

  // Calculate fail rates
  Object.keys(byTool).forEach(tool => {
    const stats = byTool[tool];
    stats.failRate = stats.total > 0 ? (stats.failed / stats.total) : 0;
  });

  const totalFailed = metrics.toolExecutions.filter(e => !e.success).length;
  const overallFailRate = total > 0 ? (totalFailed / total) : 0;

  return {
    total,
    totalFailed,
    overallFailRate,
    byTool,
    recent: metrics.toolExecutions.slice(-10)
  };
}

/**
 * Get blocked claim count (for dashboard)
 */
export function getBlockedClaimMetrics() {
  const blockedClaims = metrics.violations.filter(v =>
    v.type === 'ACTION_CLAIM' && !v.resolved
  );

  const classifierTimeouts = metrics.violations.filter(v =>
    v.type === 'CLASSIFIER_TIMEOUT'
  );

  return {
    blockedClaimCount: blockedClaims.length,
    classifierTimeoutCount: classifierTimeouts.length,
    recentBlocked: blockedClaims.slice(-10),
    recentTimeouts: classifierTimeouts.slice(-10)
  };
}

/**
 * Get dashboard summary (for API endpoint)
 */
export function getDashboardMetrics() {
  return {
    classification: getClassificationMetrics(),
    routing: getRoutingMetrics(),
    violations: getViolationMetrics(),
    tools: getToolMetrics(),
    blockedClaims: getBlockedClaimMetrics(),
    timestamp: new Date().toISOString()
  };
}

export default {
  logClassification,
  logRoutingDecision,
  logViolation,
  logToolExecution,
  getClassificationMetrics,
  getRoutingMetrics,
  getViolationMetrics,
  getToolMetrics,
  getBlockedClaimMetrics,
  getDashboardMetrics,
  printMetricsReport,
  exportMetrics
};
