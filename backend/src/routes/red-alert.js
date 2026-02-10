/**
 * Red Alert: Security Event Monitoring Dashboard
 *
 * Real-time security event analytics and monitoring
 * Admin-only access
 */

import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// Require authentication for all routes
router.use(authenticateToken);

/**
 * GET /api/red-alert/summary
 * Security events summary for last 24h
 */
router.get('/summary', async (req, res) => {
  try {
    const { businessId } = req;
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get event counts by type (last 24h)
    const eventsByType = await prisma.securityEvent.groupBy({
      by: ['type'],
      where: {
        createdAt: { gte: last24h },
        ...(businessId && { businessId }),
      },
      _count: true,
    });

    // Get event counts by severity (last 24h)
    const eventsBySeverity = await prisma.securityEvent.groupBy({
      by: ['severity'],
      where: {
        createdAt: { gte: last24h },
        ...(businessId && { businessId }),
      },
      _count: true,
    });

    // Get total events (last 7 days for trend)
    const total7d = await prisma.securityEvent.count({
      where: {
        createdAt: { gte: last7d },
        ...(businessId && { businessId }),
      },
    });

    const total24h = await prisma.securityEvent.count({
      where: {
        createdAt: { gte: last24h },
        ...(businessId && { businessId }),
      },
    });

    // Critical events requiring immediate attention
    const criticalEvents = await prisma.securityEvent.count({
      where: {
        severity: 'critical',
        createdAt: { gte: last24h },
        ...(businessId && { businessId }),
      },
    });

    res.json({
      summary: {
        total24h,
        total7d,
        critical: criticalEvents,
      },
      byType: eventsByType.reduce((acc, item) => {
        acc[item.type] = item._count;
        return acc;
      }, {}),
      bySeverity: eventsBySeverity.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {}),
    });

  } catch (error) {
    console.error('Red Alert summary error:', error);
    res.status(500).json({ error: 'Failed to fetch security summary' });
  }
});

/**
 * GET /api/red-alert/events
 * Recent security events with pagination
 */
router.get('/events', async (req, res) => {
  try {
    const { businessId } = req;
    const {
      type,
      severity,
      limit = 50,
      offset = 0,
      hours = 24,
    } = req.query;

    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const where = {
      createdAt: { gte: since },
      ...(businessId && { businessId }),
      ...(type && { type }),
      ...(severity && { severity }),
    };

    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true,
          type: true,
          severity: true,
          endpoint: true,
          method: true,
          statusCode: true,
          ipAddress: true,
          userAgent: true,
          businessId: true,
          userId: true,
          details: true,
          createdAt: true,
        },
      }),
      prisma.securityEvent.count({ where }),
    ]);

    res.json({
      events,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit),
      },
    });

  } catch (error) {
    console.error('Red Alert events error:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

/**
 * GET /api/red-alert/timeline
 * Event timeline for charts (hourly buckets)
 */
router.get('/timeline', async (req, res) => {
  try {
    const { businessId } = req;
    const { hours = 24 } = req.query;

    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const events = await prisma.securityEvent.findMany({
      where: {
        createdAt: { gte: since },
        ...(businessId && { businessId }),
      },
      select: {
        type: true,
        severity: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group events into hourly buckets
    const buckets = {};
    const bucketSize = 60 * 60 * 1000; // 1 hour

    events.forEach(event => {
      const bucketTime = Math.floor(event.createdAt.getTime() / bucketSize) * bucketSize;
      const key = new Date(bucketTime).toISOString();

      if (!buckets[key]) {
        buckets[key] = { timestamp: key, count: 0, byType: {}, bySeverity: {} };
      }

      buckets[key].count++;
      buckets[key].byType[event.type] = (buckets[key].byType[event.type] || 0) + 1;
      buckets[key].bySeverity[event.severity] = (buckets[key].bySeverity[event.severity] || 0) + 1;
    });

    res.json({
      timeline: Object.values(buckets),
    });

  } catch (error) {
    console.error('Red Alert timeline error:', error);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

/**
 * GET /api/red-alert/top-threats
 * Top threat sources (IPs, endpoints, users)
 */
router.get('/top-threats', async (req, res) => {
  try {
    const { businessId } = req;
    const { hours = 24 } = req.query;

    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const events = await prisma.securityEvent.findMany({
      where: {
        createdAt: { gte: since },
        ...(businessId && { businessId }),
      },
      select: {
        ipAddress: true,
        endpoint: true,
        type: true,
        severity: true,
      },
    });

    // Count by IP
    const byIP = {};
    const byEndpoint = {};

    events.forEach(event => {
      if (event.ipAddress) {
        byIP[event.ipAddress] = (byIP[event.ipAddress] || 0) + 1;
      }
      if (event.endpoint) {
        byEndpoint[event.endpoint] = (byEndpoint[event.endpoint] || 0) + 1;
      }
    });

    // Top 10 IPs
    const topIPs = Object.entries(byIP)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([ip, count]) => ({ ip, count }));

    // Top 10 endpoints
    const topEndpoints = Object.entries(byEndpoint)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));

    res.json({
      topIPs,
      topEndpoints,
    });

  } catch (error) {
    console.error('Red Alert top threats error:', error);
    res.status(500).json({ error: 'Failed to fetch top threats' });
  }
});

/**
 * GET /api/red-alert/health
 * System security health score
 */
router.get('/health', async (req, res) => {
  try {
    const { businessId } = req;
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const criticalCount = await prisma.securityEvent.count({
      where: {
        severity: 'critical',
        createdAt: { gte: last24h },
        ...(businessId && { businessId }),
      },
    });

    const highCount = await prisma.securityEvent.count({
      where: {
        severity: 'high',
        createdAt: { gte: last24h },
        ...(businessId && { businessId }),
      },
    });

    const totalCount = await prisma.securityEvent.count({
      where: {
        createdAt: { gte: last24h },
        ...(businessId && { businessId }),
      },
    });

    // Simple health scoring
    let healthScore = 100;
    healthScore -= criticalCount * 10; // -10 per critical
    healthScore -= highCount * 3;      // -3 per high
    healthScore = Math.max(0, healthScore);

    let status = 'healthy';
    if (criticalCount > 0) status = 'critical';
    else if (highCount > 5) status = 'warning';
    else if (highCount > 0) status = 'caution';

    res.json({
      healthScore,
      status,
      events: {
        critical: criticalCount,
        high: highCount,
        total: totalCount,
      },
    });

  } catch (error) {
    console.error('Red Alert health error:', error);
    res.status(500).json({ error: 'Failed to calculate health score' });
  }
});

// ============================================================================
// ERROR TRACKING CENTER — Application Error Endpoints
// ============================================================================

/**
 * GET /api/red-alert/errors/summary
 * Error counts by category and severity (24h, 7d) + unresolved count
 */
router.get('/errors/summary', async (req, res) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      byCategory,
      bySeverity,
      total24h,
      total7d,
      unresolvedCount,
    ] = await Promise.all([
      prisma.errorLog.groupBy({
        by: ['category'],
        where: { createdAt: { gte: last24h } },
        _count: true,
        _sum: { occurrenceCount: true },
      }),
      prisma.errorLog.groupBy({
        by: ['severity'],
        where: { createdAt: { gte: last24h } },
        _count: true,
      }),
      prisma.errorLog.count({
        where: { createdAt: { gte: last24h } },
      }),
      prisma.errorLog.count({
        where: { createdAt: { gte: last7d } },
      }),
      prisma.errorLog.count({
        where: { resolved: false },
      }),
    ]);

    res.json({
      summary: {
        total24h,
        total7d,
        unresolved: unresolvedCount,
      },
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = {
          count: item._count,
          totalOccurrences: item._sum?.occurrenceCount || item._count,
        };
        return acc;
      }, {}),
      bySeverity: bySeverity.reduce((acc, item) => {
        acc[item.severity] = item._count;
        return acc;
      }, {}),
    });
  } catch (error) {
    console.error('Red Alert errors summary error:', error);
    res.status(500).json({ error: 'Failed to fetch error summary' });
  }
});

/**
 * GET /api/red-alert/errors
 * Paginated error logs with filters
 */
router.get('/errors', async (req, res) => {
  try {
    const {
      category,
      severity,
      source,
      externalService,
      resolved,
      limit = 20,
      offset = 0,
      hours = 24,
    } = req.query;

    const since = new Date(Date.now() - parseInt(hours) * 60 * 60 * 1000);

    const where = {
      createdAt: { gte: since },
      ...(category && { category }),
      ...(severity && { severity }),
      ...(source && { source }),
      ...(externalService && { externalService }),
      ...(resolved !== undefined && resolved !== '' && { resolved: resolved === 'true' }),
    };

    const [errors, total] = await Promise.all([
      prisma.errorLog.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        take: parseInt(limit),
        skip: parseInt(offset),
        select: {
          id: true,
          category: true,
          severity: true,
          errorCode: true,
          message: true,
          stackTrace: true,
          businessId: true,
          requestId: true,
          sessionId: true,
          source: true,
          endpoint: true,
          method: true,
          toolName: true,
          externalService: true,
          externalStatus: true,
          responseTimeMs: true,
          occurrenceCount: true,
          firstSeenAt: true,
          lastSeenAt: true,
          latestRequestId: true,
          resolved: true,
          resolvedAt: true,
          resolvedBy: true,
          createdAt: true,
        },
      }),
      prisma.errorLog.count({ where }),
    ]);

    res.json({
      errors,
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: total > parseInt(offset) + parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Red Alert errors list error:', error);
    res.status(500).json({ error: 'Failed to fetch error logs' });
  }
});

/**
 * PATCH /api/red-alert/errors/:id/resolve
 * Mark an error as resolved (or unresolve)
 */
router.patch('/errors/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved = true } = req.body;

    const updated = await prisma.errorLog.update({
      where: { id: parseInt(id) },
      data: {
        resolved: Boolean(resolved),
        resolvedAt: resolved ? new Date() : null,
        resolvedBy: resolved ? (req.user?.email || 'admin') : null,
      },
    });

    res.json({
      message: resolved ? 'Error marked as resolved' : 'Error marked as unresolved',
      error: updated,
    });
  } catch (error) {
    console.error('Red Alert resolve error:', error);
    res.status(500).json({ error: 'Failed to update error status' });
  }
});

export default router;
