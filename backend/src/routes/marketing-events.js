import express from 'express';
import rateLimit from 'express-rate-limit';

const router = express.Router();

const allowedEvents = new Set([
  'page_view',
  'scroll',
  'cta_click',
  'signup_page_view',
  'signup_start',
  'signup_submit',
  'signup_complete',
  'trial_start',
  'pricing_view',
  'demo_request',
  'form_error',
  'form_start',
  'form_submit',
  'signup_success',
  'start_trial',
  'complete_registration',
  'pricing_plan_click',
  'generate_lead',
  'contact_click',
]);

const relayLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many analytics events. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
});

function sanitizeString(value) {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
}

function sanitizeObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  return value;
}

router.post('/events', relayLimiter, async (req, res) => {
  try {
    const orchestratorBaseUrl = process.env.CAMPAIGN_ORCHESTRATOR_URL;
    const orchestratorSecret = process.env.CAMPAIGN_ORCHESTRATOR_INGEST_SECRET;

    if (!orchestratorBaseUrl) {
      return res.status(503).json({
        error: 'Marketing event relay is not configured.',
        code: 'RELAY_NOT_CONFIGURED',
      });
    }

    const eventName = sanitizeString(req.body?.eventName);
    if (!eventName || !allowedEvents.has(eventName)) {
      return res.status(400).json({
        error: 'Invalid eventName',
        code: 'INVALID_EVENT_NAME',
      });
    }

    const payload = {
      secret: orchestratorSecret,
      sessionId: sanitizeString(req.body?.sessionId),
      anonymousId: sanitizeString(req.body?.anonymousId),
      userId: sanitizeString(req.body?.userId),
      eventName,
      pageUrl: sanitizeString(req.body?.pageUrl),
      pagePath: sanitizeString(req.body?.pagePath),
      referrer: sanitizeString(req.body?.referrer),
      source: sanitizeString(req.body?.source),
      medium: sanitizeString(req.body?.medium),
      campaignName: sanitizeString(req.body?.campaignName),
      properties: sanitizeObject(req.body?.properties),
      occurredAt: new Date().toISOString(),
    };

    const response = await fetch(`${orchestratorBaseUrl.replace(/\/$/, '')}/api/analytics/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(502).json({
        error: 'Campaign orchestrator analytics relay failed.',
        code: 'RELAY_FAILED',
        details: result?.error || result,
      });
    }

    return res.status(202).json({
      success: true,
      relayed: true,
    });
  } catch (error) {
    console.error('Marketing event relay failed:', error);
    return res.status(500).json({
      error: 'Failed to relay marketing event',
      code: 'SERVER_ERROR',
    });
  }
});

export default router;
