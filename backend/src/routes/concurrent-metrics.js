// ============================================================================
// CONCURRENT CALL METRICS ROUTES
// ============================================================================
// FILE: backend/src/routes/concurrent-metrics.js
//
// P0.5: Metrics endpoints for monitoring concurrent calls
// - GET /api/concurrent-metrics - Summary (requires auth)
// - GET /api/concurrent-metrics/prometheus - Prometheus format (internal only)
// - GET /api/concurrent-metrics/status - Global status (requires auth)
// ============================================================================

import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import metricsService from '../services/metricsService.js';
import globalCapacityManager from '../services/globalCapacityManager.js';

const router = express.Router();

/**
 * GET /api/concurrent-metrics
 * Get metrics summary
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const summary = metricsService.getSummary();
    const globalStatus = await globalCapacityManager.getGlobalStatus();

    res.json({
      ...summary,
      globalStatus: {
        active: globalStatus.active,
        limit: globalStatus.limit,
        available: globalStatus.available,
        utilizationPercent: globalStatus.utilizationPercent,
        byPlan: globalStatus.byPlan
      }
    });
  } catch (error) {
    console.error('Error getting concurrent metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * GET /api/concurrent-metrics/prometheus
 * Get metrics in Prometheus format
 * Internal only - should be protected by network rules in production
 */
router.get('/prometheus', async (req, res) => {
  try {
    // Simple IP whitelist check (optional)
    const clientIp = req.ip || req.connection.remoteAddress;

    // Allow localhost and private IPs
    const allowedIps = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
    const isPrivateIp = clientIp.startsWith('192.168.') || clientIp.startsWith('10.');

    if (!allowedIps.includes(clientIp) && !isPrivateIp && process.env.NODE_ENV === 'production') {
      return res.status(403).text('Forbidden');
    }

    const prometheusText = metricsService.getPrometheusFormat();

    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(prometheusText);
  } catch (error) {
    console.error('Error getting Prometheus metrics:', error);
    res.status(500).text('Error generating metrics');
  }
});

/**
 * GET /api/concurrent-metrics/status
 * Get detailed global status
 */
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const globalStatus = await globalCapacityManager.getGlobalStatus();

    res.json(globalStatus);
  } catch (error) {
    console.error('Error getting global status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * GET /api/concurrent-metrics/events
 * Get recent events (for debugging)
 */
router.get('/events', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const events = metricsService.getRecentEvents(limit);

    res.json({ events });
  } catch (error) {
    console.error('Error getting recent events:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

export default router;
