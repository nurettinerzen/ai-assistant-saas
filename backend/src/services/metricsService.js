// ============================================================================
// METRICS SERVICE
// ============================================================================
// FILE: backend/src/services/metricsService.js
//
// P0.5: Minimum metrics for concurrent call monitoring
// - platform_global_active_calls (gauge)
// - concurrent_rejected_total (counter by reason, plan)
// - elevenlabs_429_total (counter)
//
// Simple in-memory implementation (can be extended to Prometheus/Datadog)
// ============================================================================

class MetricsService {
  constructor() {
    // Gauges (current values)
    this.gauges = {
      platform_global_active_calls: 0
    };

    // Counters (cumulative)
    this.counters = {
      concurrent_rejected_total: {}, // { reason_plan: count }
      elevenlabs_429_total: 0,
      phone_inbound_blocked_total: 0,       // lifecycle inbound block
      phone_inbound_tool_blocked_total: 0   // tool-call inbound block
    };

    // Recent events (for debugging)
    this.recentEvents = [];
    this.maxRecentEvents = 100;
  }

  /**
   * Set gauge value
   * @param {string} name - Gauge name
   * @param {number} value - Current value
   */
  setGauge(name, value) {
    if (this.gauges.hasOwnProperty(name)) {
      this.gauges[name] = value;
      this._logEvent('gauge_set', { name, value });
    }
  }

  /**
   * Increment counter
   * @param {string} name - Counter name
   * @param {Object} labels - Labels for counter (e.g., {reason, plan})
   * @param {number} amount - Amount to increment (default 1)
   */
  incrementCounter(name, labels = {}, amount = 1) {
    if (name === 'concurrent_rejected_total') {
      const key = `${labels.reason || 'unknown'}_${labels.plan || 'unknown'}`;
      this.counters.concurrent_rejected_total[key] = (this.counters.concurrent_rejected_total[key] || 0) + amount;

      this._logEvent('rejection', {
        reason: labels.reason,
        plan: labels.plan,
        count: this.counters.concurrent_rejected_total[key]
      });
    } else if (name === 'elevenlabs_429_total') {
      this.counters.elevenlabs_429_total += amount;

      this._logEvent('elevenlabs_429', {
        count: this.counters.elevenlabs_429_total
      });
    } else if (name === 'phone_inbound_blocked_total') {
      this.counters.phone_inbound_blocked_total += amount;
      this._logEvent('phone_inbound_blocked', {
        source: labels.source,
        count: this.counters.phone_inbound_blocked_total
      });
    } else if (name === 'phone_inbound_tool_blocked_total') {
      this.counters.phone_inbound_tool_blocked_total += amount;
      this._logEvent('phone_inbound_tool_blocked', {
        source: labels.source,
        count: this.counters.phone_inbound_tool_blocked_total
      });
    }
  }

  /**
   * Get current metrics snapshot
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      gauges: { ...this.gauges },
      counters: {
        concurrent_rejected_total: { ...this.counters.concurrent_rejected_total },
        elevenlabs_429_total: this.counters.elevenlabs_429_total,
        phone_inbound_blocked_total: this.counters.phone_inbound_blocked_total,
        phone_inbound_tool_blocked_total: this.counters.phone_inbound_tool_blocked_total
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get Prometheus-style text format
   * @returns {string} Metrics in Prometheus format
   */
  getPrometheusFormat() {
    let output = '';

    // Gauges
    output += '# HELP platform_global_active_calls Current number of active calls globally\n';
    output += '# TYPE platform_global_active_calls gauge\n';
    output += `platform_global_active_calls ${this.gauges.platform_global_active_calls}\n\n`;

    // Counters
    output += '# HELP concurrent_rejected_total Total number of rejected calls due to capacity limits\n';
    output += '# TYPE concurrent_rejected_total counter\n';
    for (const [key, value] of Object.entries(this.counters.concurrent_rejected_total)) {
      const [reason, plan] = key.split('_');
      output += `concurrent_rejected_total{reason="${reason}",plan="${plan}"} ${value}\n`;
    }
    output += '\n';

    output += '# HELP elevenlabs_429_total Total number of 429 errors from 11Labs\n';
    output += '# TYPE elevenlabs_429_total counter\n';
    output += `elevenlabs_429_total ${this.counters.elevenlabs_429_total}\n\n`;

    output += '# HELP phone_inbound_blocked_total Total inbound calls blocked by PHONE_INBOUND_ENABLED=false\n';
    output += '# TYPE phone_inbound_blocked_total counter\n';
    output += `phone_inbound_blocked_total ${this.counters.phone_inbound_blocked_total}\n\n`;

    output += '# HELP phone_inbound_tool_blocked_total Total inbound tool calls blocked\n';
    output += '# TYPE phone_inbound_tool_blocked_total counter\n';
    output += `phone_inbound_tool_blocked_total ${this.counters.phone_inbound_tool_blocked_total}\n\n`;

    return output;
  }

  /**
   * Get recent events (for debugging)
   * @param {number} limit - Number of recent events
   * @returns {Array} Recent events
   */
  getRecentEvents(limit = 20) {
    return this.recentEvents.slice(-limit);
  }

  /**
   * Reset all counters (for testing)
   */
  reset() {
    this.gauges.platform_global_active_calls = 0;
    this.counters.concurrent_rejected_total = {};
    this.counters.elevenlabs_429_total = 0;
    this.counters.phone_inbound_blocked_total = 0;
    this.counters.phone_inbound_tool_blocked_total = 0;
    this.recentEvents = [];
  }

  /**
   * Log event to recent events buffer
   * @private
   */
  _logEvent(type, data) {
    this.recentEvents.push({
      type,
      data,
      timestamp: new Date().toISOString()
    });

    // Trim to max size
    if (this.recentEvents.length > this.maxRecentEvents) {
      this.recentEvents.shift();
    }
  }

  /**
   * Get metrics summary for dashboard
   * @returns {Object} Summary
   */
  getSummary() {
    const rejectionsByReason = {};
    const rejectionsByPlan = {};
    let totalRejections = 0;

    for (const [key, count] of Object.entries(this.counters.concurrent_rejected_total)) {
      const [reason, plan] = key.split('_');
      rejectionsByReason[reason] = (rejectionsByReason[reason] || 0) + count;
      rejectionsByPlan[plan] = (rejectionsByPlan[plan] || 0) + count;
      totalRejections += count;
    }

    return {
      activeCalls: this.gauges.platform_global_active_calls,
      totalRejections,
      rejectionsByReason,
      rejectionsByPlan,
      elevenlabs429Count: this.counters.elevenlabs_429_total,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Periodic update of gauge from global capacity manager
   * Should be called regularly (e.g., every 10 seconds)
   */
  async updateGlobalActiveCallsGauge() {
    try {
      const globalCapacityManager = (await import('./globalCapacityManager.js')).default;
      const status = await globalCapacityManager.getGlobalStatus();

      this.setGauge('platform_global_active_calls', status.active);

    } catch (error) {
      console.error('❌ Error updating global active calls gauge:', error);
    }
  }
}

// Singleton instance
const metricsService = new MetricsService();

// Auto-update gauge every 10 seconds
setInterval(async () => {
  await metricsService.updateGlobalActiveCallsGauge();
}, 10000);

export default metricsService;

// Named exports
export const {
  setGauge,
  incrementCounter,
  getMetrics,
  getPrometheusFormat,
  getRecentEvents,
  getSummary,
  reset
} = {
  setGauge: (name, value) => metricsService.setGauge(name, value),
  incrementCounter: (name, labels, amount) => metricsService.incrementCounter(name, labels, amount),
  getMetrics: () => metricsService.getMetrics(),
  getPrometheusFormat: () => metricsService.getPrometheusFormat(),
  getRecentEvents: (limit) => metricsService.getRecentEvents(limit),
  getSummary: () => metricsService.getSummary(),
  reset: () => metricsService.reset()
};
